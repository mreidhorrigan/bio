// switch-sound.mjs: does the iso world sound after switching to it from 3D?
//
//   node tools/switch-sound.mjs            (serves the repo itself on a spare port)
//   node tools/switch-sound.mjs --file     (opens the files from disk, file://, as a
//                                           double-click does: no web origin)
//
// The probes cannot test this: a page's own synthetic keys carry no user
// activation, so a browser never lets them start audio. This drives Chrome
// through the DevTools protocol with REAL input (Input.dispatchKeyEvent and
// Input.dispatchMouseEvent), as a visitor's keys and clicks are:
//   1. the 3D village: walk with the arrow keys (its audio starts);
//   2. click "Isometric" (the switch): the iso world loads in the same tab;
//   3. walk there with the arrow keys, and report its AudioContext's state and
//      the tones it made (the step), counted by a hook put in before its scripts run.
// One headless Chrome, muted, at background priority.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, createReadStream, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try { execFileSync("taskpolicy", ["-b", "-p", String(process.pid)]); } catch (e) { /* not macOS */ }
try { process.setPriority(19); } catch (e) { /* fine */ }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname), file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  try { statSync(file); } catch (e) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[file.slice(file.lastIndexOf("."))] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = process.argv.includes("--file") ? "file://" + ROOT + "/" : `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(tmpdir(), "switch-sound-"));
const port = 9950 + Math.floor(Math.random() * 40);
const chrome = spawn("taskpolicy", ["-b", CHROME, "--headless=new", "--mute-audio", "--no-first-run", "--window-size=1100,800",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
// however this ends (done, an error, Ctrl-C), the browser goes with it: a Chrome left
// behind by a run that threw kept a page spinning for most of a day (2026-09-24)
const stopChrome = () => { try { chrome.kill("SIGKILL"); } catch (e) { /* gone */ } };
process.on("exit", stopChrome);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { stopChrome(); process.exit(130); });
process.on("uncaughtException", (e) => { console.log("ERROR " + (e && e.stack || e)); stopChrome(); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("ERROR " + (e && e.stack || e)); stopChrome(); process.exit(1); });
let wsUrl = null;
for (let i = 0; i < 100 && !wsUrl; i++) { await sleep(200); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { /* not up */ } }
const sock = new WebSocket(wsUrl);
await new Promise((r) => sock.addEventListener("open", r));
let id = 0; const waiting = new Map(), logs = [];
sock.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]);
});
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const n = ++id, t = setTimeout(() => { waiting.delete(n); res({ timedOut: true }); }, 20000);
  waiting.set(n, (m) => { clearTimeout(t); res(m); });
  sock.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params }));
});
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId: S } } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, S); await send("Page.enable", {}, S);
await send("Log.enable", {}, S);
sock.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.method === "Log.entryAdded" && /error|warning/.test(m.params.entry.level)) logs.push(m.params.entry.level + ": " + m.params.entry.text.slice(0, 200)); if (m.method === "Runtime.consoleAPICalled" && /error|warn/.test(m.params.type)) logs.push("console." + m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)); });
const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, S); return r.result?.result?.value; };
// every page this tab loads gets the tone counter before its own scripts
await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  window.__tones = 0; window.__ctxs = [];
  const AC = window.AudioContext; if (!AC) return;
  const make = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () { window.__tones++; if (!window.__ctxs.includes(this)) window.__ctxs.push(this); return make.call(this); };
})();` }, S);
const key = async (k, code, ms) => {
  const vk = { ArrowUp: 38, ArrowLeft: 37 }[k];
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk }, S);
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }, S);
};
const load = async (url, test) => { await send("Page.navigate", { url }, S); for (let i = 0; i < 80; i++) { await sleep(250); if (await js(test)) return true; } return false; };

// 1. the 3D village
await load(base + "slimeverse3d.html?theme=technurture&place=village", "!!(window.MH_SLIMEVERSE3D && document.readyState === 'complete')");
await sleep(800);
await key("ArrowUp", "ArrowUp", 1500);
const d3 = JSON.parse(await js("JSON.stringify({ state: MH_SLIMEVERSE3D.audioContext() ? MH_SLIMEVERSE3D.audioContext().state : 'none', tones: window.__tones, steps: MH_SLIMEVERSE3D.steps() })"));
console.log("3D village, after walking: audio " + d3.state + ", " + d3.tones + " tones, " + d3.steps + " steps");
// 2. the switch, clicked where it stands
const box = JSON.parse(await js("(() => { const a = document.getElementById('view-iso'); if (!a || a.hidden) return 'null'; const r = a.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()"));
if (!box) { console.log("the Isometric switch: not shown NO"); process.exit(1); }
for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 }, S);
for (let i = 0; i < 80; i++) { await sleep(250); if (await js("location.pathname.endsWith('index.html') && !!window.MH_ISO && document.readyState === 'complete'")) break; }
await sleep(1500);
console.log("switched to: " + (await js("location.pathname + location.search")));
// 3. walk in the iso world
const before = JSON.parse(await js("JSON.stringify({ tones: window.__tones, ctx: window.MH_ISO.sharedAudioContext ? 'yes' : 'no' })"));
await key("ArrowUp", "ArrowUp", 2500);
const iso = JSON.parse(await js(`JSON.stringify({ tones: window.__tones, contexts: window.__ctxs.map((c) => c.state) })`));
console.log("iso world, after walking 2.5 s: " + (iso.tones - before.tones) + " tones made, contexts: " + (iso.contexts.join(", ") || "none"));
console.log(iso.tones - before.tones > 0 && iso.contexts.includes("running") ? "verdict: the iso world sounds after the switch" : "verdict: the iso world is SILENT after the switch NO");
if (logs.length) console.log(logs.join("\n"));
sock.close(); chrome.kill(); server.close();
await new Promise((r) => chrome.on("exit", r));
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* fine */ }
