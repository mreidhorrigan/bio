// probe-runner.mjs: the probes, run gently.
//
//   node tools/probe-runner.mjs                     every probe (not shots or perf)
//   node tools/probe-runner.mjs __scale.html ...    these probes
//
// The same probes and the same verdicts as run-probes.py (a line with NO,
// EXCEPTION, MISSING or FAIL fails; so does a probe that only says "running"),
// run so they cost as little as they can and give way to everything else:
//
//   one Chrome for the whole run, not one per probe (a cold start is seconds of CPU);
//   each probe's tab closed the moment it sets its title to "done", where a
//     virtual-time budget ran the page, and its animating worlds, to the end of
//     the budget whatever the probe had finished;
//   in real time, so a probe waiting on a timer waits idle instead of spinning;
//   at background priority (macOS taskpolicy -b, and nice), so the machine's other
//     work comes first: a probe run may take longer, never crowds anything out.
//
// It prints each probe's own CPU time (the tab's task time, from the DevTools
// Performance metrics), costliest last in the summary, to show where to trim.
// A probe gets `seconds` of wall time (default 900: slow is fine, stuck is not).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { createReadStream, statSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROBES = join(ROOT, "brand/backstage/probes");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LIMIT = Number(process.env.PROBE_SECONDS || 900);
const BAD = /\bNO\b|EXCEPTION|MISSING|FAIL/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// this process at background priority too: it only waits, but its children inherit it
try { execFileSync("taskpolicy", ["-b", "-p", String(process.pid)]); } catch (e) { /* not macOS: nice alone */ }
try { process.setPriority(19); } catch (e) { /* fine */ }

/* ── a quiet file server for the repo root ─────────────────────────────── */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname), file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try { statSync(file); } catch (e) { res.writeHead(404); res.end(); return; }
  const ext = file.slice(file.lastIndexOf("."));
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/brand/backstage/probes/`;

/* ── one Chrome, at background priority ────────────────────────────────── */
const profile = mkdtempSync(join(tmpdir(), "probes-"));
const port = 9400 + Math.floor(Math.random() * 400);
const args = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--mute-audio", "--window-size=1280,900",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"];
const chrome = spawn("taskpolicy", ["-b", CHROME, ...args], { stdio: "ignore" });
// however this ends (done, an error, Ctrl-C), the browser goes with it: a Chrome left
// behind by a run that threw kept a page spinning for most of a day (2026-09-24)
const stopChrome = () => { try { chrome.kill("SIGKILL"); } catch (e) { /* gone */ } };
process.on("exit", stopChrome);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { stopChrome(); process.exit(130); });
process.on("uncaughtException", (e) => { console.log("ERROR " + (e && e.stack || e)); stopChrome(); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("ERROR " + (e && e.stack || e)); stopChrome(); process.exit(1); });
let browserWs = null;
for (let i = 0; i < 100 && !browserWs; i++) {
  await sleep(200);
  try { browserWs = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { /* not up yet */ }
}
if (!browserWs) { console.log("chrome did not start"); process.exit(1); }
const ws = new WebSocket(browserWs);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const waiting = new Map();
const thrown = new Map();                                   // sessionId → the first uncaught exception in that probe's page
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown" && m.sessionId && !thrown.has(m.sessionId)) {
    const d = m.params.exceptionDetails;
    thrown.set(m.sessionId, ((d.exception && d.exception.description) || d.text || "an exception").split("\n")[0] + " (" + (d.url || "").split("/").pop() + ":" + (d.lineNumber + 1) + ")");
  }
});
const send = (method, params = {}, sessionId) => new Promise((res) => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params })); });

/* ── the probes ─────────────────────────────────────────────────────────── */
const names = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(PROBES).filter((f) => /^__.*\.html$/.test(f) && !/shot|perf|cost/.test(f)).sort();   // shots are pictures, perf needs a real browser, cost probes are measurements
const failed = [], costs = [];
for (const name of names) {
  const t0 = Date.now();
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Performance.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);                // its uncaught exceptions: a probe whose script failed to parse fails now, not at the limit
  await send("Page.navigate", { url: base + name }, sessionId);
  let text = "", done = false;
  while (Date.now() - t0 < LIMIT * 1000) {
    await sleep(700);
    const r = await send("Runtime.evaluate", { expression: "JSON.stringify([document.title, (document.getElementById('out') || document.querySelector('pre') || {}).textContent || ''])", returnByValue: true }, sessionId);
    const v = r.result && r.result.result && r.result.result.value;
    if (!v) continue;
    const [title, out] = JSON.parse(v);
    text = out.trim();
    if (title === "done") { done = true; break; }
    if (thrown.has(sessionId)) { text = (text ? text + "\n" : "") + "EXCEPTION " + thrown.get(sessionId); break; }   // an uncaught exception anywhere in the probe: it fails now
    if (!text && Date.now() - t0 > 20000) { text = "(no <pre> output: is it a probe page?) MISSING"; break; }   // a 404 or a page that never wrote: fail now, not after the limit
  }
  const m = await send("Performance.getMetrics", {}, sessionId);
  const metric = (k) => ((m.result && m.result.metrics) || []).find((x) => x.name === k)?.value || 0;
  const cpu = metric("TaskDuration"), wall = (Date.now() - t0) / 1000;
  await send("Target.closeTarget", { targetId });
  console.log("=== " + name + "  (" + cpu.toFixed(1) + " s of CPU in the page, " + wall.toFixed(0) + " s on the clock)");
  console.log(done ? text || "(no <pre> output)" : (text ? text + "\n" : "") + "TIMEOUT (never said done)");
  costs.push([name, cpu]);
  if (!done || !text || text === "running" || BAD.test(text)) failed.push(name);
}
ws.close(); chrome.kill(); server.close();
await new Promise((r) => chrome.on("exit", r));
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* fine */ }
const total = costs.reduce((a, c) => a + c[1], 0);
console.log("\nCPU in the pages: " + total.toFixed(0) + " s in all; the costliest: " + costs.slice().sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => n + " " + c.toFixed(0) + " s").join(", "));
console.log(failed.length + " probe" + (failed.length === 1 ? "" : "s") + " failed" + (failed.length ? ": " + failed.join(", ") : ""));
process.exit(failed.length ? 1 : 0);
