// frame-probe.mjs: how evenly a page draws its frames, in real time.
//
//   node tools/frame-probe.mjs http://127.0.0.1:8790/slimeverse3d.html [seconds] [walk] [profile]
//
// Opens the page in headless Chrome, lets it settle for two seconds, then for the
// given seconds records every animation frame's interval and every long task
// (over 50 ms on the main thread), and prints the median, the 95th percentile,
// the worst frame, and how many frames took over 25 ms and over 50 ms: jitter is
// the tail, not the mean. With "walk", holds the up-arrow key down the whole
// time (the 3D slime walks, the iso slime walks). Headless Chrome paints on the
// CPU, so the numbers run slower than a laptop's GPU; compare runs, not devices.
// With "profile", also samples the CPU and prints the functions that took the
// most time themselves (self time), with their file and line.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
const seconds = Number(process.argv[3] || 8);
const walk = process.argv.includes("walk"), profile = process.argv.includes("profile");
if (!url) { console.log("usage: node tools/frame-probe.mjs <url> [seconds] [walk]"); process.exit(1); }
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9800 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--window-size=1280,800", "--autoplay-policy=no-user-gesture-required", "--mute-audio",   // the page's sound runs (its cost counts) but never reaches the speakers
  "--remote-debugging-port=" + port, "--user-data-dir=" + mkdtempSync(join(tmpdir(), "frames-")), "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch (e) { /* not up yet */ }
}
if (!target) { console.log("chrome did not start"); chrome.kill(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const waiting = new Map();
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url });
await sleep(2500);
// click once (starts audio and the world, as a visitor's first gesture does), then measure
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 700, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 700, button: "left", clickCount: 1 });
await sleep(800);
await send("Runtime.evaluate", { expression: `
  window.__fp = { d: [], long: [] };
  (() => { let last = 0; const f = (t) => { if (last) window.__fp.d.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); })();
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__fp.long.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: false }); } catch (e) {}
` });
if (profile) { await send("Profiler.enable"); await send("Profiler.setSamplingInterval", { interval: 200 }); await send("Profiler.start"); }
if (walk) await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 });
const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  await sleep(1000);
  if (walk) await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38, autoRepeat: true });
}
if (walk) await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 });
const r = await send("Runtime.evaluate", { expression: "JSON.stringify(window.__fp)", returnByValue: true });
const fp = JSON.parse(r.result.result.value), d = fp.d.slice().sort((a, b) => a - b);
const q = (p) => d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))] : NaN;
console.log(url + (walk ? " (walking)" : "") + ": " + d.length + " frames in " + seconds + " s; median " + q(0.5).toFixed(1) + " ms, 95th " + q(0.95).toFixed(1) +
  " ms, worst " + (d[d.length - 1] || 0).toFixed(0) + " ms; over 25 ms: " + d.filter((x) => x > 25).length + ", over 50 ms: " + d.filter((x) => x > 50).length +
  "; long tasks: " + fp.long.length + (fp.long.length ? " (" + fp.long.slice(0, 12).join(", ") + " ms)" : ""));
if (profile) {
  const P = (await send("Profiler.stop")).result.profile, self = new Map(), byId = new Map(P.nodes.map((n) => [n.id, n]));
  const dt = P.timeDeltas || [], total = dt.reduce((a, b) => a + b, 0) / 1000;
  P.samples.forEach((sid, i) => {
    const n = byId.get(sid), f = n.callFrame, key = (f.functionName || "(anonymous)") + " " + (f.url || "").split("/").pop() + ":" + (f.lineNumber + 1);
    self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
  });
  console.log("  self time, of " + total.toFixed(0) + " ms sampled:");
  for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log("   " + ms.toFixed(0).padStart(6) + " ms  " + (100 * ms / total).toFixed(1).padStart(5) + "%  " + k);
}
chrome.kill(); process.exit(0);
