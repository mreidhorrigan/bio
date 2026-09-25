// a11y-audit.mjs: what a screen reader and a keyboard meet on each page.
//
//   node tools/a11y-audit.mjs                  every public page
//   node tools/a11y-audit.mjs about.html ...   these pages
//
// For each page, in one headless Chrome at background priority (as probe-runner.mjs
// runs the probes), muted:
//   the page's language, title, landmarks and headings;
//   the accessibility tree as a screen reader gets it: every link, button, field,
//     image and region, with its name, and the ones with no name;
//   the keyboard: Tab pressed up to 60 times, each stop listed (name, and whether
//     it is visible and shows a focus ring), a loop or a trap noted;
//   text whose contrast with its background falls below WCAG AA (4.5:1, 3:1 large);
//   canvases (a world): whether they have a name, and what else speaks for them;
//   live regions, dialogs, media, new-tab links, reduced motion, a zoom lock.
// Then, for the three worlds, a visit by keyboard: into the world, a house opened,
// closed, and where focus goes.
//
// It reports; it passes or fails nothing. The findings, and the plan, are in docs/accessibility.md.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try { execFileSync("taskpolicy", ["-b", "-p", String(process.pid)]); } catch (e) { /* not macOS */ }
try { process.setPriority(19); } catch (e) { /* fine */ }

const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "index.html", "about.html", "Horrigan_CV.html", "toolbox.html", "glossary.html", "musebots.html",
  "slimeverse3d.html", "Rock_Walls_and_Damp.html", "criticism.html",
  "MCQer.html", "SeatPlanner.html", "ExamTimer.html", "Nameplates.html",
];

/* ── a quiet file server ── */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname), file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try { statSync(file); } catch (e) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[file.slice(file.lastIndexOf("."))] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

/* ── one Chrome ── */
const profile = mkdtempSync(join(tmpdir(), "a11y-"));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn("taskpolicy", ["-b", CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--mute-audio",
  "--window-size=1280,900", "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
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
  try { browserWs = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { /* not up */ }
}
if (!browserWs) { console.log("chrome did not start"); process.exit(1); }
const ws = new WebSocket(browserWs);
await new Promise((r) => ws.addEventListener("open", r));
let nid = 0; const waiting = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const n = ++nid; waiting.set(n, res);
  ws.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params }));
  setTimeout(() => { if (waiting.has(n)) { waiting.delete(n); rej(new Error("timeout: " + method)); } }, 30000);
});
const evaluate = async (sid, fn, arg) => {
  const r = await send("Runtime.evaluate", { expression: "(" + fn + ")(" + JSON.stringify(arg === undefined ? null : arg) + ")", returnByValue: true, awaitPromise: true }, sid);
  if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text };
  return r.result && r.result.result ? r.result.result.value : null;
};
// Enter and Space carry their characters, as a real keyboard's do: without them a
// focused button is not pressed (the browser activates it from the key's text)
const key = async (sid, k, code, vk, mods = 0) => {
  const text = k === "Enter" ? "\r" : k === " " ? " " : undefined;
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, text, unmodifiedText: text }, sid);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods }, sid);
};
const TAB = (sid, shift) => key(sid, "Tab", "Tab", 9, shift ? 8 : 0);

/* ── in the page: the static checks ── */
function pageFacts() {
  const out = {};
  const d = document, html = d.documentElement;
  out.lang = html.getAttribute("lang") || "(none)";
  out.title = d.title || "(none)";
  const vp = d.querySelector('meta[name="viewport"]');
  out.zoomLock = vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp.content) ? vp.content : "";
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id; else if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/)[0]; return s; };
  out.landmarks = [...d.querySelectorAll("main,[role=main],nav,[role=navigation],header,[role=banner],footer,[role=contentinfo],aside,[role=complementary],[role=region][aria-label],section[aria-label]")]
    .map((el) => desc(el) + (el.getAttribute("aria-label") ? ' "' + el.getAttribute("aria-label") + '"' : ""));
  out.headings = [...d.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(vis).map((h) => h.tagName + " " + (h.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70));
  const skip = [...d.querySelectorAll("a[href^='#']")].find((a) => /skip|main|content/i.test(a.textContent));
  out.skipLink = skip ? skip.textContent.trim() : "";
  out.imgNoAlt = [...d.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).map((i) => (i.getAttribute("src") || "").split("/").pop()).slice(0, 12);
  out.svgUnnamed = [...d.querySelectorAll("svg")].filter((s) => vis(s) && !s.closest("[aria-hidden=true]") && !s.querySelector("title") && !s.getAttribute("aria-label") && s.getAttribute("role") !== "presentation" && !s.closest("a,button")).length;
  out.canvases = [...d.querySelectorAll("canvas")].filter(vis).map((c) => desc(c) + " role=" + (c.getAttribute("role") || "-") + " name=" + JSON.stringify(c.getAttribute("aria-label") || c.getAttribute("title") || "") + " fallback=" + JSON.stringify((c.textContent || "").trim().slice(0, 50)) + " tabindex=" + c.getAttribute("tabindex"));
  out.live = [...d.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")].map((el) => desc(el) + " " + (el.getAttribute("aria-live") || el.getAttribute("role")));
  out.dialogs = [...d.querySelectorAll("dialog,[role=dialog],[role=alertdialog]")].map((el) => desc(el) + (el.getAttribute("aria-modal") ? " aria-modal" : "") + (el.getAttribute("aria-labelledby") || el.getAttribute("aria-label") ? " named" : " UNNAMED"));
  out.tabindexPos = [...d.querySelectorAll("[tabindex]")].filter((el) => +el.getAttribute("tabindex") > 0).map(desc);
  const described = (a) => (a.getAttribute("aria-describedby") || "").split(/\s+/).map((i) => (d.getElementById(i) || {}).textContent || "").join(" ");
  out.newTab = [...d.querySelectorAll("a[target=_blank]")].filter((a) => !/new tab|nouvel onglet|nouvelle fenêtre|new window/i.test((a.getAttribute("aria-label") || "") + (a.title || "") + a.textContent + described(a))).length;
  out.media = [...d.querySelectorAll("video,audio,iframe")].map((m) => desc(m) + (m.tagName === "IFRAME" ? " title=" + JSON.stringify(m.title || "") : (m.autoplay ? " AUTOPLAY" : "") + (m.controls ? " controls" : " NO-CONTROLS")));
  out.fields = [...d.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(vis).filter((f) => {
    if (f.getAttribute("aria-label") || f.getAttribute("aria-labelledby") || f.title) return false;
    if (f.id && d.querySelector('label[for="' + CSS.escape(f.id) + '"]')) return false;
    return !f.closest("label");
  }).map((f) => desc(f) + "[" + (f.type || f.tagName.toLowerCase()) + "]");
  // reduced motion honoured anywhere in the page's CSS?
  let rm = false;
  for (const sh of d.styleSheets) { try { for (const r of sh.cssRules) if (r.media && /reduced-motion/.test(r.media.mediaText)) rm = true; } catch (e) { /* cross-origin */ } }
  out.reducedMotionCss = rm;
  // contrast: every visible element with its own text, against the first opaque background up the tree
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const low = [], seen = new Set();
  const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let unknown = 0;
  while (walker.nextNode()) {
    const t = walker.currentNode, el = t.parentElement;
    if (!el || !t.textContent.trim() || seen.has(el) || !vis(el) || el.closest("[aria-hidden=true],script,style,noscript,.mh-sr,.sr-only")) continue;
    { const r = el.getBoundingClientRect(), c = getComputedStyle(el); if ((r.width <= 1 && r.height <= 1) || (c.clip && c.clip !== "auto")) continue; }   // text for a screen reader only
    seen.add(el);
    const cs = getComputedStyle(el), fg = parse(cs.color);
    if (!fg || +cs.opacity === 0) continue;
    // translucent layers are blended down onto the first opaque one (a HUD pill at .7 over the page)
    let bg = null, n = el, img = false; const layers = [];
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none") { img = true; break; }
      const b = parse(s.backgroundColor); if (b && b.a > 0.9) { bg = b; break; }
      if (b && b.a > 0) layers.push(b);
      n = n.parentElement;
    }
    if (img) { unknown++; continue; }
    if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; bg = { r: l.r * l.a + bg.r * (1 - l.a), g: l.g * l.a + bg.g * (1 - l.a), b: l.b * l.a + bg.b * (1 - l.a), a: 1 }; }
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio * (fg.a < 1 ? fg.a : 1) < need) low.push(ratio.toFixed(2) + " (need " + need + ") " + desc(el) + ' "' + t.textContent.trim().slice(0, 40) + '" ' + cs.color + " on " + `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`);
  }
  out.lowContrast = low.slice(0, 15); out.lowContrastCount = low.length; out.contrastUnknown = unknown;
  return out;
}

/* ── in the page: where focus is, and what it looks like ── */
function focusNow() {
  let a = document.activeElement;
  while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
  if (!a || a === document.body) return { at: "body" };
  const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
  const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && cs.visibility !== "hidden";
  const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
  let s = a.tagName.toLowerCase(); if (a.id) s += "#" + a.id;
  const by = (a.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((i) => (document.getElementById(i) || {}).textContent || "").join(" ");
  const name = (by || a.getAttribute("aria-label") || a.getAttribute("title") || a.textContent || a.value || a.getAttribute("alt") || "").trim().replace(/\s+/g, " ").slice(0, 50);
  let hiddenBy = "";
  for (let n = a; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0 || n.hidden || n.getAttribute("aria-hidden") === "true" || n.inert) { hiddenBy = (n.id || n.className || n.tagName) + ""; break; } }
  return { at: s, name, onScreen, ring: !!ring, hiddenBy: hiddenBy.slice(0, 40) };
}

/* ── the accessibility tree, as a screen reader would list it ── */
const KEEP = new Set(["link", "button", "heading", "img", "image", "textbox", "combobox", "checkbox", "radio", "slider", "spinbutton", "switch", "tab", "menuitem",
  "dialog", "alertdialog", "navigation", "main", "banner", "contentinfo", "region", "complementary", "form", "search", "status", "alert", "log", "Canvas", "canvas", "application", "toolbar", "group", "DisclosureTriangle", "listbox", "option", "video", "audio", "Iframe"]);
async function axOutline(sid) {
  const r = await send("Accessibility.getFullAXTree", {}, sid);
  const nodes = (r.result && r.result.nodes) || [];
  const rows = [], unnamed = [];
  let textChars = 0;
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role && n.role.value, name = ((n.name && n.name.value) || "").trim();
    if (role === "StaticText" || role === "InlineTextBox") { if (role === "StaticText") textChars += name.length; continue; }
    if (!KEEP.has(role)) continue;
    rows.push(role + ' "' + name.replace(/\s+/g, " ").slice(0, 60) + '"');
    if (!name && ["link", "button", "img", "image", "textbox", "combobox", "checkbox", "radio", "slider", "dialog", "Canvas", "canvas", "switch", "menuitem"].includes(role)) unnamed.push(role);
  }
  return { rows, unnamed, textChars };
}

async function tabWalk(sid, max = 60) {
  const stops = [];
  for (let i = 0; i < max; i++) {
    await TAB(sid);
    await sleep(60);
    const f = await evaluate(sid, focusNow);
    const sig = f.at + "|" + f.name;
    if (stops.length && stops[0].sig === sig) { stops.push({ sig, f, loop: true }); break; }   // back to the first: one full circuit
    stops.push({ sig, f });
    if (stops.length > 3 && stops.slice(-3).every((s) => s.sig === sig)) { stops.push({ sig, f, trap: true }); break; }
  }
  return stops;
}
const fmtStop = (s, i) => {
  const f = s.f; if (f.at === "body") return "  " + String(i + 1).padStart(2) + ". (the page itself)";
  const flags = [!f.onScreen ? "OFF-SCREEN" : "", f.hiddenBy ? "HIDDEN(" + f.hiddenBy + ")" : "", f.onScreen && !f.hiddenBy && !f.ring ? "no-ring?" : "", !f.name ? "UNNAMED" : ""].filter(Boolean).join(" ");
  return "  " + String(i + 1).padStart(2) + ". " + f.at + ' "' + f.name + '"' + (flags ? "  [" + flags + "]" : "") + (s.loop ? "  (back to the start)" : "") + (s.trap ? "  TRAPPED" : "");
};

/* ── the worlds, visited by keyboard ── */
const VISITS = {
  "index.html": async (sid, say) => {
    // the world starts at once (no intro page): what is there on arrival
    await sleep(1500);
    say("on arrival: focus " + JSON.stringify(await evaluate(sid, focusNow)));
    say("the slime's tips, for a screen reader: " + JSON.stringify(await evaluate(sid, () => { const t = document.getElementById("mh-tips"); return t ? { text: t.textContent.slice(0, 120), live: t.getAttribute("aria-live") || t.getAttribute("role") || "(not live)" } : null; })));
    const ax = await axOutline(sid);
    say("the screen reader finds " + ax.rows.length + " items:\n    " + ax.rows.join("\n    "));
    // the Mute button silences the page's one speaker (the Musebots' music goes out through it too).
    // A real key press here counts as the visitor's gesture, so the page's audio may start.
    await key(sid, "ArrowLeft", "ArrowLeft", 37); await sleep(400);
    const LEVEL = async () => { await sleep(300); return evaluate(sid, () => { const a = new Float32Array(window.__an.fftSize); window.__an.getFloatTimeDomainData(a); return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length); }); };
    const ready = await evaluate(sid, () => {
      const ctx = window.MH_ISO.sharedAudioContext(); if (ctx.state !== "running") return ctx.state;
      const an = ctx.createAnalyser(); an.fftSize = 2048; ctx.mhSpeaker.connect(an); window.__an = an;
      const osc = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0.2; osc.connect(g); g.connect(ctx.destination); osc.start(); window.__osc = osc;   // as the Musebots send theirs
      return "running";
    });
    if (ready !== "running") say("the Mute button: the audio context is " + ready + ", not measured");
    else {
      const on = await LEVEL();
      await evaluate(sid, () => document.getElementById("mh-mute").focus());
      await key(sid, "Enter", "Enter", 13); const off = await LEVEL();
      await key(sid, "Enter", "Enter", 13); const back = await LEVEL();
      await evaluate(sid, () => { window.__osc.stop(); document.activeElement.blur(); });
      say("the Mute button, pressed with Enter: a tone sent to the destination measures " + on.toFixed(3) + " at the page's speaker, " + off.toFixed(4) + " muted" + (off < 0.005 && on > 0.05 ? "" : " NO") + ", " + back.toFixed(3) + " again" + (back > 0.05 ? "" : " NO"));
    }
    // the ☰ Menu, by keyboard: Tab until it has focus, then Enter
    let found = false;
    for (let i = 0; i < 40 && !found; i++) { await TAB(sid); await sleep(40); found = await evaluate(sid, () => document.activeElement && document.activeElement.id === "mh-menu"); }
    say("the ☰ Menu button " + (found ? "reached by Tab" : "never reached by Tab"));
    if (found) {
      await key(sid, "Enter", "Enter", 13); await sleep(500);
      const nav = await evaluate(sid, () => { const n = document.getElementById("mh-navbar"), m = document.getElementById("mh-menu"); return { shown: !n.classList.contains("mh-faded"), expanded: m.getAttribute("aria-expanded") || "(no aria-expanded)", items: [...n.querySelectorAll("button,a")].map((x) => x.textContent.trim()) }; });
      say("after Enter: " + JSON.stringify(nav) + "; focus " + JSON.stringify(await evaluate(sid, focusNow)));
      // on to the first house in it, by Tab, and Enter: the slime walks there, then the page opens
      let onHouse = false;
      for (let i = 0; i < 20 && !onHouse; i++) { await TAB(sid); await sleep(40); onHouse = await evaluate(sid, () => /^1\./.test((document.activeElement && document.activeElement.textContent || "").trim())); }
      say("the first house in the menu " + (onHouse ? "reached by Tab" : "not reached by Tab (focus went " + JSON.stringify(await evaluate(sid, focusNow)) + ")"));
      if (onHouse) {
        const t0 = Date.now(); await key(sid, "Enter", "Enter", 13);
        let where = "index.html", said = [];
        for (let i = 0; i < 40; i++) {
          await sleep(250);
          const v = await evaluate(sid, () => ({ page: location.pathname.split("/").pop(), tips: (document.getElementById("mh-tips") || {}).textContent || "" })).catch(() => null);
          if (!v || v.error) continue;
          if (v.tips && !said.includes(v.tips)) said.push(v.tips);
          if (v.page !== "index.html" && v.page !== "") { where = v.page; break; }
        }
        say("after Enter on it: " + (where === "index.html" ? "still in the village after 10 s" : "on " + where + " after " + ((Date.now() - t0) / 1000).toFixed(1) + " s") + "; what the tips region said on the way: " + JSON.stringify(said));
      }
    }
  },
  "slimeverse3d.html": async (sid, say) => {
    await sleep(1500);
    say("on arrival: focus " + JSON.stringify(await evaluate(sid, focusNow)));
    say("the slime's tips: " + JSON.stringify(await evaluate(sid, () => { const t = document.getElementById("tips") || document.querySelector("[aria-live]"); return t ? { id: t.id, text: t.textContent.slice(0, 80), live: t.getAttribute("aria-live") || t.getAttribute("role") } : "no text alternative"; })));
    const ax = await axOutline(sid);
    say("the screen reader finds " + ax.rows.length + " items:\n    " + ax.rows.join("\n    "));
    // a house's card: opened as walking into its door does
    const r = await evaluate(sid, async () => {
      const W = window.MH_SLIMEVERSE3D; if (!W) return "no W";
      W.load("outdoors", "start"); for (let i = 0; i < 3; i++) W.tick(0.016);
      const q = W.S().portals.find((p) => p.open && p.open.kind === "link" && !/glossary/.test(p.open.url));
      W.me.x = q.x + 14; W.me.z = q.z + 14; for (let i = 0; i < 3; i++) W.tick(0.016);
      W.me.x = q.x; W.me.z = q.z; W.me.speed = 0; for (let i = 0; i < 3; i++) W.tick(0.016);
      const c = document.getElementById("card");
      return { open: !c.hidden, role: c.getAttribute("role") || (c.firstElementChild && c.firstElementChild.getAttribute("role")) || "(none)", modal: c.getAttribute("aria-modal") || "(none)", title: document.getElementById("card-title").textContent };
    });
    say("a house's card: " + JSON.stringify(r) + "; focus " + JSON.stringify(await evaluate(sid, focusNow)));
    // does Tab stay in the open card (a modal), or wander behind it?
    const out = [];
    for (let i = 0; i < 5; i++) { await TAB(sid); await sleep(40); out.push(await evaluate(sid, () => { const c = document.getElementById("card"); return c.contains(document.activeElement) ? "in" : ((document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || "?"); })); }
    say("Tab ×5 with the card open: " + out.join(", ") + (out.every((x) => x === "in") ? " (kept in the card)" : " (focus leaves the open card)"));
    await key(sid, "Escape", "Escape", 27); await sleep(200);
    say("after Escape: focus " + JSON.stringify(await evaluate(sid, focusNow)));
  },
  "glossary.html": async (sid, say) => {
    await sleep(1200);
    say("on arrival: focus " + JSON.stringify(await evaluate(sid, focusNow)));
    const alt = await evaluate(sid, () => {
      const words = document.querySelectorAll("[data-i]"), list = document.querySelector("dl, #glossary-list, .glossary-list, main ol, main ul");
      return { entriesInMarkup: words.length, firstEntries: [...words].slice(0, 3).map((w) => w.textContent.trim().slice(0, 60)), listTag: list ? list.tagName + (list.id ? "#" + list.id : "") : "(none)" };
    });
    say("the words, as text: " + JSON.stringify(alt));
    const ax = await axOutline(sid);
    say("the screen reader finds " + ax.rows.length + " items (" + ax.textChars + " characters of text); the first 25:\n    " + ax.rows.slice(0, 25).join("\n    "));
  },
};

/* ── run ── */
for (const page of PAGES) {
  const lines = []; const say = (t) => lines.push(t);
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId: sid } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid); await send("Accessibility.enable", {}, sid);
  // keep sounds and storage from a previous page out of this one
  await send("Page.navigate", { url: base + page }, sid);
  await sleep(3500);
  try {
    const f = await evaluate(sid, pageFacts);
    if (f && f.error) { say("page script error: " + f.error); }
    else {
      say("lang " + f.lang + " · title " + JSON.stringify(f.title) + (f.zoomLock ? " · ZOOM LOCKED (" + f.zoomLock + ")" : ""));
      say("landmarks: " + (f.landmarks.join(", ") || "NONE") + " · skip link: " + (f.skipLink || "none"));
      say("headings: " + (f.headings.length ? "\n    " + f.headings.slice(0, 20).join("\n    ") + (f.headings.length > 20 ? "\n    … " + (f.headings.length - 20) + " more" : "") : "NONE"));
      if (f.canvases.length) say("canvases: " + f.canvases.join("; "));
      say("live regions: " + (f.live.join(", ") || "none") + " · dialogs: " + (f.dialogs.join(", ") || "none"));
      if (f.imgNoAlt.length) say("images with no alt: " + f.imgNoAlt.join(", "));
      if (f.svgUnnamed) say("visible svgs with no name, not hidden: " + f.svgUnnamed);
      if (f.fields.length) say("fields with no label: " + f.fields.join(", "));
      if (f.tabindexPos.length) say("positive tabindex: " + f.tabindexPos.join(", "));
      if (f.newTab) say("links opening a new tab without saying so: " + f.newTab);
      if (f.media.length) say("media: " + f.media.join("; "));
      say("reduced-motion CSS: " + (f.reducedMotionCss ? "yes" : "none"));
      say("contrast below AA: " + f.lowContrastCount + (f.lowContrast.length ? "\n    " + f.lowContrast.join("\n    ") : "") + " (" + f.contrastUnknown + " text elements over images or canvas, not measured)");
    }
    const ax = await axOutline(sid);
    say("accessibility tree: " + ax.rows.length + " items, " + ax.textChars + " characters of text" + (ax.unnamed.length ? "; UNNAMED: " + Object.entries(ax.unnamed.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {})).map(([r, n]) => n + " " + r).join(", ") : ""));
    const stops = await tabWalk(sid);
    say("keyboard, Tab by Tab (" + stops.length + " stops):\n" + stops.map(fmtStop).join("\n"));
    if (VISITS[page]) {
      await send("Page.navigate", { url: base + page }, sid); await sleep(3000);
      say("── a visit by keyboard ──");
      await VISITS[page](sid, say);
    }
  } catch (e) { say("AUDIT ERROR " + e.message); }
  await send("Target.closeTarget", { targetId });
  console.log("\n=================== " + page + " ===================\n" + lines.join("\n"));
}
ws.close(); chrome.kill(); server.close();
await new Promise((r) => chrome.on("exit", r));
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* fine */ }
