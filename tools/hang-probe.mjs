// hang-probe.mjs: open a page in headless Chrome, in real time, and say where it stalls.
//
//   node tools/hang-probe.mjs https://matthorrigan.com/ [seconds]
//
// Prints console messages and uncaught exceptions as they come, pings the main
// thread once a second, and when a ping goes unanswered for three seconds pauses
// the page's script and prints the call stack it was in. Uses the DevTools
// protocol over Node's built-in WebSocket, so it needs nothing installed.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] || "https://matthorrigan.com/";
const seconds = Number(process.argv[3] || 30);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1280,900",
  "--remote-debugging-port=" + port, "--user-data-dir=" + mkdtempSync(join(tmpdir(), "hang-")), "about:blank"], { stdio: "ignore" });
const t0 = Date.now(), at = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
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
let paused = null;
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled") console.log(at(), "console." + m.params.type, m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 300));
  else if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails; console.log(at(), "EXCEPTION", (d.exception && d.exception.description || d.text).slice(0, 400), d.url || "", d.lineNumber); }
  else if (m.method === "Log.entryAdded") console.log(at(), "log." + m.params.entry.level, m.params.entry.text.slice(0, 300), m.params.entry.url || "");
  else if (m.method === "Page.loadEventFired") console.log(at(), "load event");
  else if (m.method === "Page.domContentEventFired") console.log(at(), "DOMContentLoaded");
  else if (m.method === "Debugger.paused") paused = m.params;
});
await Promise.all(["Runtime.enable", "Log.enable", "Page.enable", "Debugger.enable"].map((x) => send(x)));
send("Page.navigate", { url });
console.log(at(), "navigating to", url);

let lastAnswer = Date.now(), reported = false;
while (Date.now() - t0 < seconds * 1000) {
  const ping = send("Runtime.evaluate", { expression: "1" }).then(() => { lastAnswer = Date.now(); });
  await Promise.race([ping, sleep(1000)]);
  await sleep(Math.max(0, 1000 - (Date.now() - lastAnswer)));
  if (!reported && Date.now() - lastAnswer > 3000) {
    reported = true;
    console.log(at(), "MAIN THREAD NOT ANSWERING for", ((Date.now() - lastAnswer) / 1000).toFixed(1) + "s; pausing it");
    send("Debugger.pause");
    for (let i = 0; i < 50 && !paused; i++) await sleep(100);
    if (paused) {
      for (const f of paused.callFrames.slice(0, 15)) console.log("   at", f.functionName || "(anonymous)", f.url.split("/").pop() + ":" + (f.location.lineNumber + 1) + ":" + (f.location.columnNumber + 1));
      await send("Debugger.resume"); paused = null;
    } else console.log("   (could not pause it)");
  }
}
const r = await Promise.race([send("Runtime.evaluate", { expression: "JSON.stringify({ready: document.readyState, iso: !!window.MH_ISO, canvases: document.querySelectorAll('canvas').length})", returnByValue: true }), sleep(3000)]);
console.log(at(), "end:", r && r.result ? r.result.result.value : "no answer (still blocked)");
chrome.kill(); process.exit(0);
