var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// native/live/site/page.js
var KEPT = "musebots-live-dial-kept";
var STRINGS_KEPT = "musebots-live-dial-strings-kept";
var kept = (key = KEPT) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
};
var keep = (key, record) => {
  try {
    localStorage.setItem(key, JSON.stringify([...kept(key), record]));
  } catch {
  }
};
function served(worker, { key, line: line2 } = {}) {
  const waiting = /* @__PURE__ */ new Map();
  let next = 0;
  worker.onmessage = ({ data }) => {
    if (data.said !== void 0) {
      console.log(data.said);
      return;
    }
    if (data.line !== void 0) {
      line2?.(data.line);
      return;
    }
    if (data.kept) {
      keep(key, data.kept);
      return;
    }
    const { resolve: resolve2 } = waiting.get(data.id) ?? {};
    waiting.delete(data.id);
    if (!resolve2) return;
    const headers = Object.fromEntries(Object.entries(data.headers ?? {}).map(([k, v]) => [k, String(v)]));
    resolve2(data.samples ? new Response(data.samples.buffer, { status: data.status, headers: { "content-type": "application/octet-stream", ...headers } }) : data.json !== void 0 ? new Response(JSON.stringify(data.json), { status: data.status, headers: { "content-type": "application/json" } }) : new Response(data.text ?? null, { status: data.status }));
  };
  worker.onerror = (error) => {
    for (const { reject } of waiting.values()) reject(new Error(`the dial stopped: ${error.message ?? error}`));
    waiting.clear();
  };
  return (method, path, query, given) => {
    const id = next++;
    return new Promise((resolve2, reject) => {
      waiting.set(id, { resolve: resolve2, reject });
      worker.postMessage({ id, method, path, query, given });
    });
  };
}
var winds = served(new Worker(new URL("dial-worker.js", document.baseURI), { type: "module" }), { key: KEPT });
var listening = /* @__PURE__ */ new Set();
var strings = null;
function stringsWorker() {
  if (strings) return strings;
  const worker = new Worker(new URL("strings-worker.js", document.baseURI), { type: "module" });
  const ask2 = served(worker, { key: STRINGS_KEPT, line: (line2) => {
    for (const listener of listening) listener(line2);
  } });
  strings = { worker, ask: ask2, ended: null, running: false };
  strings.ready = ask2("GET", "/state").then(
    async (r) => {
      if (!r.ok) throw new Error(await r.text());
      strings.rate = (await r.json()).rate;
      strings.running = true;
      sound();
    },
    (error) => {
      strings.ended = `the strings' dial stopped: ${error.message}`;
      throw error;
    }
  );
  strings.ready.catch(() => {
  });
  worker.postMessage({ listen: true });
  return strings;
}
var family = () => ({ instruments: [], ...strings ? { running: strings.running, starting: !strings.running && !strings.ended, ended: strings.ended } : { running: false, starting: false, ended: null } });
async function families() {
  const f = await (await winds("GET", "/families")).json();
  f.strings = { ...f.strings, ...family(), instruments: f.strings.instruments };
  return new Response(JSON.stringify(f), { headers: { "content-type": "application/json" } });
}
function stringsKept(path, given) {
  if (path === "/kept") return new Response(JSON.stringify(kept(STRINGS_KEPT)), { headers: { "content-type": "application/json" } });
  const all = kept(STRINGS_KEPT), left = all.filter((k) => k.at !== given?.at);
  if (left.length === all.length) return new Response(`nothing kept at ${given?.at}`, { status: 404 });
  try {
    localStorage.setItem(STRINGS_KEPT, JSON.stringify(left));
  } catch {
  }
  return new Response(JSON.stringify({ left: left.length }), { headers: { "content-type": "application/json" } });
}
var own = globalThis.fetch.bind(globalThis);
var ROUTE = /^\/(families|start|winds\/.*|strings\/.*)$/;
globalThis.fetch = async (input, init2 = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith("/") || !ROUTE.test(url.pathname)) return own(input, init2);
  const method = (init2.method ?? "GET").toUpperCase(), given = typeof init2.body === "string" && init2.body ? JSON.parse(init2.body) : void 0;
  if (url.pathname === "/families") return families();
  if (url.pathname === "/start") {
    if (url.searchParams.get("family") !== "strings") {
      const r = await winds(method, url.pathname, url.search, given);
      if (!r.ok) return r;
    } else try {
      await stringsWorker().ready;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 503, headers: { "content-type": "application/json" } });
    }
    return families();
  }
  const m = /^\/strings(\/.*)$/.exec(url.pathname);
  if (m) {
    if (m[1] === "/kept" || m[1] === "/forget") return stringsKept(m[1], given);
    const { ask: ask2, ready } = stringsWorker();
    try {
      await ready;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 503, headers: { "content-type": "application/json" } });
    }
    return ask2(method, m[1], url.search, given);
  }
  return winds(method, url.pathname, url.search, given);
};
var OwnEventSource = globalThis.EventSource;
globalThis.EventSource = class extends EventTarget {
  constructor(address, options) {
    const url = new URL(address, location.origin);
    if (url.origin !== location.origin || url.pathname !== "/strings/events") return new OwnEventSource(address, options);
    super();
    this.url = url.href;
    this.readyState = 0;
    this.onmessage = this.onopen = this.onerror = null;
    const heard2 = (line2) => {
      const e = new MessageEvent("message", { data: line2 });
      this.onmessage?.(e);
      this.dispatchEvent(e);
    };
    listening.add(heard2);
    stringsWorker();
    this.close = () => {
      listening.delete(heard2);
      this.readyState = 2;
    };
    queueMicrotask(() => {
      if (this.readyState === 0) {
        this.readyState = 1;
        const e = new Event("open");
        this.onopen?.(e);
        this.dispatchEvent(e);
      }
    });
  }
};
var RING = `class Ring extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(sampleRate*2);this.r=0;this.w=0;this.n=0;this.got=0;this.t=0;
this.port.onmessage=({data})=>{this.out=data.port;this.out.onmessage=({data})=>{this.got+=data.length;for(let i=0;i<data.length&&this.n<this.b.length;i++){this.b[this.w]=data[i];this.w=(this.w+1)%this.b.length;this.n++}};this.ask()}}
ask(){this.out?.postMessage({n:this.n,got:this.got})}
process(_,outs){const o=outs[0];for(let i=0;i<o[0].length;i++){let v=0;if(this.n>0){v=this.b[this.r];this.r=(this.r+1)%this.b.length;this.n--}for(const c of o)c[i]=v}
if(++this.t%2===0)this.ask();return true}}registerProcessor('strings-ring',Ring);`;
var LET_GO = 3;
var context = null;
var letting = null;
var shown = () => document.querySelector('[data-family="strings"]')?.hidden === false;
async function sound() {
  if (!strings?.running || !shown() || !navigator.userActivation?.hasBeenActive) return;
  clearTimeout(letting);
  if (context) {
    if (context.state === "suspended") context.resume();
    return;
  }
  context = new AudioContext({ sampleRate: strings.rate });
  await context.audioWorklet.addModule(URL.createObjectURL(new Blob([RING], { type: "text/javascript" })));
  const node = new AudioWorkletNode(context, "strings-ring", { numberOfInputs: 0, outputChannelCount: [2] });
  node.connect(context.destination);
  const channel = new MessageChannel();
  strings.worker.postMessage({ sound: channel.port2 }, [channel.port2]);
  node.port.postMessage({ port: channel.port1 }, [channel.port1]);
}
for (const event of ["pointerdown", "keydown"]) addEventListener(event, () => {
  sound();
}, true);
function watch() {
  new MutationObserver(() => {
    if (shown()) sound();
    else if (context?.state === "running") {
      clearTimeout(letting);
      letting = setTimeout(() => {
        if (!shown()) context.suspend();
      }, LET_GO * 1e3);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
}
function line() {
  const note = document.createElement("div");
  note.className = "muted";
  note.style.margin = "0 0 10px";
  note.innerHTML = `Wind instruments modelled by OpenWInD's scheme and bowed strings by Artifastring, played in this browser by the Musebots engines in WebAssembly (<a href="SOURCES.html">their source, GPL-3.0</a>). Press <b>space</b> or <b>blow</b> to sound a wind, <b>play</b> to bow a string.`;
  const say2 = document.createElement("span");
  fetch("/families").then((r) => r.json()).then((f) => {
    say2.textContent = f.engine?.error ? ` The engine did not load: ${f.engine.error}` : f.engine?.threaded ? "" : " This browser gives the page one core (it is not cross-origin isolated): the larger instruments may play slower than real time.";
  });
  note.append(say2);
  document.body.prepend(note);
  watch();
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", line);
else line();
window.addEventListener("load", () => {
  if (window.live) window.live.kept = () => kept();
});

// native/live/strings.js
var strings_exports = {};
__export(strings_exports, {
  kept: () => kept2,
  keys: () => keys,
  load: () => load,
  rest: () => rest,
  settings: () => settings,
  take: () => take
});

// public/shared/performers/transitions.js
var TRANSITIONS = Object.freeze({
  // (A woodwind's key, open or shut: "The time taken for a key to open or close was typically 10 ms when pushed by a
  // finger or 16 ms when moved by a spring" -- A. Almeida, R. Chow, J. Smith & J. Wolfe 2009, "The kinetics and acoustics
  // of fingering and note transitions on the flute", JASA 126(3), 1521-1529, doi:10.1121/1.3179674. Its fingers' delays
  // between one another "typically tens of milliseconds", the more fingers the longer: a change's keys need not move
  // together.)
  key: Object.freeze({ least: 0.01, basis: "measured", source: "Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674: a key pushed by a finger 10 ms (a spring 16 ms)" }),
  keyBySpring: Object.freeze({ least: 0.016, basis: "measured", source: "Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674: a key moved by its spring 16 ms" }),
  // (A brass valve's piston pressed or let up: not found measured; a finger's push, as a key's.)
  valve: Object.freeze({ least: 0.01, basis: "provisional", source: "a woodwind key pushed by a finger (Almeida et al. 2009), until a valve is measured" }),
  // (The lips' tension and opening, and the frequency they buzz at, moving with a change: as the valve or key it goes with.)
  lips: Object.freeze({ least: 0.01, basis: "provisional", source: "the fingering change it goes with (key, valve)" }),
  // (A trombone's slide: not found measured; its change already under a legato tongue's dip.)
  slide: Object.freeze({ least: 0.02, basis: "provisional", source: "the slide moving under a legato tongue (breath.mjs), until measured" }),
  // (The breath rising at an attack, the tongue let go, or moving between two notes' pressures: the quickest the breath
  // rose when it was first written (render/synthesis/src/breath.mjs, 9 October 2026, which now reads it here), its source
  // untraced.)
  breathRise: Object.freeze({ least: 0.014, basis: "provisional", source: "the breath's quickest rise as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The breath falling at a release: as first written there, untraced.)
  breathFall: Object.freeze({ least: 0.03, basis: "provisional", source: "the breath's quickest release as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The tongue stopping the air before a tongued note, or dipping it in a legato tongue: as first written there,
  // untraced. Notes closer than it are let go after it.)
  tongueStop: Object.freeze({ least: 8e-3, basis: "provisional", source: "the tongue's stop as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The tongue touching a reed and leaving it: its tip's motion, not found measured -- a few milliseconds, its corners
  // smoothed; the reed's own oscillation then grows as its physics has it.)
  tongueTouch: Object.freeze({ least: 5e-3, basis: "provisional", source: "openwind_worker.py TONGUE_TOUCH, its corners smoothed" }),
  tongueRelease: Object.freeze({ least: 5e-3, basis: "provisional", source: "openwind_worker.py TONGUE_RELEASE, its corners smoothed" }),
  // (The vocal tract's resonances moving -- the tongue's body and the jaw shaping it, as between vowels (native/openwind
  // src/tract.rs): not found measured for a wind player; as the breath's quickest release.)
  tract: Object.freeze({ least: 0.03, basis: "provisional", source: "the breath's quickest release (breathFall), until a player's tract is measured moving" }),
  // (A technique begun or ended within a note -- a hum, a growl, flutter tonguing, its noise: as a breath rises.)
  technique: Object.freeze({ least: 0.014, basis: "provisional", source: "the breath's rise (breathRise)" }),
  // (A pitch's own modulation crossing a note's edge -- a vibrato's factor, a glide: continuous, never a jump.)
  modulation: Object.freeze({ least: 0.01, basis: "provisional", source: "a finger's motion (key)" }),
  // (The bowed strings: the bow's force and its contact point changing, a string crossed, the bow lifted or set down, a
  // finger stopping or leaving a string. Not found measured as rise times here -- A. Askenfelt 1989, "Measurement of the
  // bowing parameters in violin playing. II: Bow-bridge distance, dynamic range, and limits of bow force", JASA 86(2),
  // doi:10.1121/1.398230, to read for them.)
  bowForce: Object.freeze({ least: 0.01, basis: "provisional", source: "a finger's motion (key), until bowing rise times are read (Askenfelt 1989)" }),
  bowContact: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  stringCrossing: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  bowLift: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  finger: Object.freeze({ least: 0.01, basis: "measured-analogue", source: "a finger pushing a flute key, 10 ms (Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674)" }),
  // (Anything else a model is given that changes: never under this.)
  any: Object.freeze({ least: 5e-3, basis: "provisional", source: "the least of any kind: no control steps" })
});
var eased = (x2) => {
  const c = Math.min(1, Math.max(0, x2));
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
};

// public/shared/performers/drawn-curves.js
var POINTS = 64;
function curveAt(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) {
    const [a, y0] = points[k - 1], [b, y1, shape2] = points[k];
    if (t < b) {
      const x2 = (t - a) / (b - a);
      return y0 + (y1 - y0) * (shape2 === "straight" ? x2 : eased(x2));
    }
  }
  return points.at(-1)[1];
}
var peakOf = (points) => points.reduce((p, q) => q[1] > p[1] ? q : p);
var fewestOf = (kind) => kind.from != null || kind.settled != null ? 2 : 1;
function curveOf(given, kind) {
  const { least = 0, most = Infinity, longest = Infinity, from = null, settled = null, straight = true, points: count = POINTS } = kind;
  if (!Array.isArray(given) || !given.length || given.length > count) throw new Error(`a curve is from 1 to ${count} points`);
  const points = given.map((p) => {
    if (!Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) throw new Error("a curve's point is [t, y]");
    const t = Math.min(longest, Math.max(0, +p[0])), y2 = Math.min(most, Math.max(least, +p[1]));
    return p[2] === "straight" && straight ? [t, y2, "straight"] : [t, y2];
  }).sort((a, b) => a[0] - b[0]);
  points[0] = [0, from ?? points[0][1]];
  for (let k = 1; k < points.length; k++) if (!(points[k][0] > points[k - 1][0])) throw new Error("a curve's points are each later than the one before");
  if (points.length < fewestOf(kind)) {
    if (from != null) throw new Error("a curve from a fixed start moves: two points at least");
    points[0] = [0, settled];
  } else if (settled != null) points[points.length - 1] = [points.at(-1)[0], settled, ...points.at(-1).slice(2)];
  return points;
}
function segmentLasting(points, k, seconds, longest = Infinity) {
  if (k < 1 || k >= points.length) return points;
  const shift = Math.min(longest - points.at(-1)[0], points[k - 1][0] + seconds - points[k][0]);
  return points.map((p, i) => i >= k ? [+(p[0] + shift).toFixed(6), ...p.slice(1)] : p);
}
var firstEndingAt = (points, seconds) => points.length < 2 ? points : segmentLasting(points, 1, seconds);

// public/shared/performers/attack-curves.js
var MOST = 4;
var LONGEST = 2;
var ATTACK = Object.freeze({ least: 0, most: MOST, longest: LONGEST, from: null, settled: 1, straight: true, points: POINTS });
var attackKind = ({ from = null, straight = true } = {}) => Object.freeze({ ...ATTACK, from, straight });
function bowedAttack({ from, least }, { attack: attack2, onset = null, bite = 0 }) {
  const a = bite + attack2;
  if (!onset || !(onset.speed > 1 || onset.force > 1))
    return { force: [[0, from], [a, 1]], speed: [...bite > 0 ? [[0, 0], [bite, 0]] : [[0, 0]], [a, 1, "straight"]] };
  const back = a + Math.max(onset.decay, least);
  return {
    force: bite > 0 ? [[0, onset.force], [a, onset.force], [back, 1]] : [[0, onset.force * onset.from], [a, onset.force], [back, 1]],
    speed: [...bite > 0 ? [[0, 0], [bite, 0]] : [[0, 0]], [a, onset.speed, "straight"], [back, 1]]
  };
}

// native/live/curves.js
var SVG = "http://www.w3.org/2000/svg";
var make = (name2, attrs = {}, parent) => {
  const el = document.createElementNS(SVG, name2);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
};
var html = (name2, attrs = {}, parent) => {
  const el = document.createElement(name2);
  for (const [k, v] of Object.entries(attrs)) el[k] = v;
  parent?.append(el);
  return el;
};
var W = 640;
var H = 180;
var PAD = { left: 46, right: 12, top: 12, bottom: 24 };
var stepOver = (span, most) => [1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((s2) => span / s2 <= most) ?? span / most;
var ms = (t) => `${Math.round(1e3 * t)} ms`;
function curveEditor(box, { kind, label: label3, color = "var(--accent)", change, unit: unit2 = "×", meaning = null }) {
  const fewest = fewestOf(kind), longest = Math.min(kind.longest ?? 2, 60);
  const svg = make("svg", { viewBox: `0 0 ${W} ${H}`, class: "curve", role: "img", tabindex: "0", "aria-label": label3 }, box);
  const grid = make("g", {}, svg), settled = make("line", { class: "settled" }, svg), path = make("path", { class: "line", fill: "none", stroke: color }, svg);
  const dots = make("g", {}, svg), tip = make("text", { class: "tip", x: W - PAD.right, y: PAD.top + 10, "text-anchor": "end" }, svg);
  const tools = html("div", { className: "curveTools" }, box);
  const which = html("span", { className: "muted" }, tools);
  const tBox = html("input", { type: "number", step: "1", min: "0", title: "its time (ms)" }, tools), tUnit = html("span", { textContent: "ms", className: "muted" }, tools);
  const yBox = html("input", { type: "number", step: "0.01", title: "its value" }, tools), yUnit = html("span", { textContent: unit2, className: "muted" }, tools);
  const shapeBox = html("select", { title: "the segment that reaches it" }, tools);
  shapeBox.innerHTML = '<option value="eased">eased into it</option><option value="straight">straight into it</option>';
  const remove = html("button", { type: "button", textContent: "− Remove it" }, tools), add = html("button", { type: "button", textContent: "+ Add a point" }, tools);
  const count = html("span", { className: "muted" }, tools);
  let points = curveOf(kind.from != null ? [[0, kind.from], [0.05, kind.settled ?? kind.from]] : [[0, kind.settled ?? kind.least]], kind);
  let span = 0.2, low = kind.least, top = kind.settled != null ? 2 * kind.settled : kind.most, dragging2 = -1, selected = -1;
  const X = (t) => PAD.left + (W - PAD.left - PAD.right) * t / span, Y = (y2) => H - PAD.bottom - (H - PAD.top - PAD.bottom) * (y2 - low) / (top - low);
  const tOf = (px) => (px - PAD.left) / (W - PAD.left - PAD.right) * span, yOf = (py2) => low + (H - PAD.bottom - py2) / (H - PAD.top - PAD.bottom) * (top - low);
  const fit = () => {
    span = Math.min(longest * 1.1, Math.max(0.1, 1.6 * points.at(-1)[0]));
    const peak = peakOf(points)[1];
    top = Number.isFinite(kind.most) ? Math.min(kind.most, Math.max(kind.settled != null ? 2 * kind.settled : kind.least + 1, 1.15 * peak)) : Math.max(1, 1.15 * peak);
  };
  const where = (e) => {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  };
  const fixedT = (k) => k === 0, fixedY = (k) => k === 0 && kind.from != null || k === points.length - 1 && points.length > 1 && kind.settled != null;
  function draw2() {
    grid.replaceChildren();
    const ts = stepOver(span, 8);
    for (let t = 0; t <= span + 1e-9; t += ts) {
      make("line", { x1: X(t), x2: X(t), y1: PAD.top, y2: H - PAD.bottom, class: "grid" }, grid);
      make("text", { x: X(t), y: H - 6, "text-anchor": "middle" }, grid).textContent = ms(t);
    }
    const ys = stepOver(top - low, 5);
    for (let y2 = Math.ceil(low / ys) * ys; y2 <= top + 1e-9; y2 += ys) {
      make("line", { x1: PAD.left, x2: W - PAD.right, y1: Y(y2), y2: Y(y2), class: "grid" }, grid);
      make("text", { x: PAD.left - 6, y: Y(y2) + 4, "text-anchor": "end" }, grid).textContent = `${+y2.toFixed(3)}${unit2}`;
    }
    if (kind.settled != null) Object.entries({ x1: PAD.left, x2: W - PAD.right, y1: Y(kind.settled), y2: Y(kind.settled) }).forEach(([k, v]) => settled.setAttribute(k, v));
    let d = `M${X(0)},${Y(points[0][1])}`;
    for (let k = 1; k < points.length; k++) {
      const [a] = points[k - 1], [b] = points[k];
      for (let i = 1; i <= 24; i++) {
        const t = a + (b - a) * i / 24;
        d += `L${X(t)},${Y(curveAt(points, t))}`;
      }
    }
    d += `L${X(span)},${Y(points.at(-1)[1])}`;
    path.setAttribute("d", d);
    dots.replaceChildren();
    points.forEach(([t, y2], k) => {
      const dot = make("circle", { cx: X(t), cy: Y(y2), r: k === selected ? 8 : 6, fill: color, class: k === selected ? "dot selected" : "dot" }, dots);
      dot.dataset.point = k;
      make("title", {}, dot).textContent = `${ms(t)}, ${y2.toFixed(2)}${unit2}` + (k === 0 && kind.from != null ? " (from rest)" : k === points.length - 1 && kind.settled != null ? " (settled)" : "");
    });
    const [pt, py2] = peakOf(points);
    tip.textContent = `peak ${py2.toFixed(2)}${unit2}${meaning ? ` (${meaning(py2)})` : ""} at ${ms(pt)} · settled at ${ms(points.at(-1)[0])}`;
    shown4();
  }
  function shown4() {
    const k = selected, on = k >= 0 && k < points.length;
    which.textContent = on ? `Point ${k + 1} of ${points.length}:` : `${points.length} points: press on the plot to add one, or select one to set it.`;
    for (const el of [tBox, tUnit, yBox, yUnit, remove]) el.style.display = on ? "" : "none";
    shapeBox.style.display = on && kind.straight ? "" : "none";
    if (on) {
      const [t, y2, shape2] = points[k];
      if (document.activeElement !== tBox) tBox.value = Math.round(1e3 * t);
      if (document.activeElement !== yBox) yBox.value = +y2.toFixed(3);
      tBox.disabled = fixedT(k);
      yBox.disabled = fixedY(k);
      shapeBox.value = shape2 === "straight" ? "straight" : "eased";
      shapeBox.disabled = k === 0 || !kind.straight;
      remove.disabled = k === 0 || points.length <= fewest;
    }
    add.disabled = points.length >= (kind.points ?? 64);
    count.textContent = `${points.length} of at most ${kind.points ?? 64}`;
  }
  const changed = () => {
    draw2();
    change?.(points.map((p) => [...p]));
  };
  function place(k, t, y2) {
    const last = points.length - 1;
    if (fixedT(k)) t = 0;
    else t = Math.min(k < last ? points[k + 1][0] - 1e-3 : longest, Math.max(points[k - 1][0] + 1e-3, t));
    y2 = fixedY(k) ? points[k][1] : Math.min(kind.most, Math.max(kind.least, y2));
    points[k] = [+t.toFixed(4), +y2.toFixed(3), ...points[k].slice(2)];
  }
  function added(t, y2) {
    if (points.length >= (kind.points ?? 64) || !(t > 0 && t < longest)) return -1;
    y2 = Math.min(kind.most, Math.max(kind.least, y2));
    const at = points.findIndex((p) => p[0] > t);
    if (at > 0) {
      if (t - points[at - 1][0] < 1e-3 || points[at][0] - t < 1e-3) return -1;
      points.splice(at, 0, [+t.toFixed(4), +y2.toFixed(3)]);
      return at;
    }
    if (t - points.at(-1)[0] < 1e-3) return -1;
    if (kind.settled != null) {
      if (points.length + 1 >= (kind.points ?? 64)) return -1;
      const end = Math.min(longest, t + Math.max(0.02, t - points.at(-1)[0]));
      if (end - t < 1e-3) return -1;
      points.push([+t.toFixed(4), +y2.toFixed(3)], [+end.toFixed(4), kind.settled]);
      return points.length - 2;
    }
    points.push([+t.toFixed(4), +y2.toFixed(3)]);
    return points.length - 1;
  }
  function removed(k) {
    if (k <= 0 || points.length <= fewest) return;
    points.splice(k, 1);
    points = curveOf(points, kind);
    selected = Math.min(k, points.length - 1);
    fit();
    changed();
  }
  const DOUBLE = 400;
  let pressed = { k: -1, at: 0 };
  svg.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const k = e.target.dataset?.point;
    if (k != null && pressed.k === +k && e.timeStamp - pressed.at < DOUBLE) {
      pressed = { k: -1, at: 0 };
      removed(+k);
      e.preventDefault();
      return;
    }
    pressed = { k: k != null ? +k : -1, at: e.timeStamp };
    if (k != null) {
      dragging2 = selected = +k;
    } else {
      const [px, py2] = where(e), at = added(tOf(px), yOf(py2));
      if (at < 0) return;
      dragging2 = selected = at;
      changed();
    }
    svg.setPointerCapture(e.pointerId);
    svg.focus();
    draw2();
    e.preventDefault();
  };
  svg.onpointermove = (e) => {
    if (dragging2 < 0) return;
    const [px, py2] = where(e);
    place(dragging2, tOf(px), yOf(py2));
    changed();
  };
  svg.onpointerup = svg.onpointercancel = () => {
    if (dragging2 >= 0) {
      dragging2 = -1;
      fit();
      draw2();
    }
  };
  svg.onkeydown = (e) => {
    if (selected < 0) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      removed(selected);
      e.preventDefault();
      return;
    }
    const step = e.shiftKey ? 10 : 1, moves = { ArrowLeft: [-1e-3, 0], ArrowRight: [1e-3, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] }[e.key];
    if (!moves) return;
    e.preventDefault();
    place(selected, points[selected][0] + step * moves[0], points[selected][1] + step * moves[1]);
    fit();
    changed();
  };
  tBox.onchange = () => {
    const v = +tBox.value;
    if (Number.isFinite(v) && selected > 0) {
      place(selected, v / 1e3, points[selected][1]);
      fit();
      changed();
    } else shown4();
  };
  yBox.onchange = () => {
    const v = +yBox.value;
    if (Number.isFinite(v) && selected >= 0) {
      place(selected, points[selected][0], v);
      fit();
      changed();
    } else shown4();
  };
  shapeBox.onchange = () => {
    if (selected < 1) return;
    const [t, y2] = points[selected];
    points[selected] = shapeBox.value === "straight" ? [t, y2, "straight"] : [t, y2];
    changed();
  };
  remove.onclick = () => removed(selected);
  add.onclick = () => {
    let k = 1;
    for (let i = 2; i < points.length; i++) if (points[i][0] - points[i - 1][0] > points[k][0] - points[k - 1][0]) k = i;
    const t = points.length > 1 ? (points[k - 1][0] + points[k][0]) / 2 : Math.min(longest / 2, 0.05), at = added(t, curveAt(points, t));
    if (at >= 0) {
      selected = at;
      fit();
      changed();
    }
  };
  fit();
  draw2();
  return {
    // (Set from outside -- a preset, a kept setting, a dial moving its time, the dial's answer -- without saying it back,
    // and never under the pointer dragging it.)
    set(given) {
      if (dragging2 >= 0) return;
      points = curveOf(given, kind);
      if (selected >= points.length) selected = points.length - 1;
      fit();
      draw2();
    },
    get: () => points.map((p) => [...p]),
    dragging: () => dragging2 >= 0
  };
}

// native/live/players.js
function playersBand(input) {
  let track = input.parentElement;
  if (!track.classList.contains("track")) {
    track = document.createElement("span");
    track.className = "track";
    input.replaceWith(track);
    track.append(input);
  }
  const band2 = document.createElement("span"), fill2 = document.createElement("i"), said2 = document.createElement("small");
  band2.className = "players";
  band2.append(fill2, said2);
  track.append(band2);
  return (entry, place, written) => {
    const value3 = entry?.value != null, [low, high] = value3 ? [entry.value, entry.value] : entry?.range ?? [null, null];
    if (!entry || low == null && high == null) {
      fill2.hidden = true;
      said2.textContent = "unmeasured";
      band2.title = "Nobody measured yet for this control.";
      return;
    }
    const clip = (x2) => Math.min(1, Math.max(0, x2)), a = low == null ? 0 : place(low), b = high == null ? 1 : place(high);
    const placed2 = Number.isFinite(a) && Number.isFinite(b), from = clip(Math.min(a, b)), to = clip(Math.max(a, b)), beyond = placed2 && (Math.max(a, b) < 0 || Math.min(a, b) > 1);
    fill2.hidden = !placed2 || beyond;
    fill2.classList.toggle("tick", value3);
    fill2.style.left = `calc(8px + (100% - 16px) * ${from})`;
    fill2.style.width = value3 ? "" : `calc((100% - 16px) * ${to - from})`;
    said2.textContent = `measured ${value3 ? written(low) : low == null ? `≤ ${written(high)}` : high == null ? `≥ ${written(low)}` : `${written(low)}–${written(high)}`}` + (beyond ? ", beyond its reach" : "") + (entry.by ? " (borrowed)" : "");
    band2.title = `${entry.what[0].toUpperCase()}${entry.what.slice(1)}: ${entry.source}${entry.by ? `; borrowed from ${entry.by}` : ""}.`;
  };
}
function atPitch(entry, midi) {
  const p = entry?.points;
  if (!p?.length || midi < p[0][0] || midi > p.at(-1)[0]) return null;
  const k = Math.max(0, p.findLastIndex((q) => q[0] <= midi)), [m0, l0, h0] = p[k], [m1, l1, h1] = p[Math.min(k + 1, p.length - 1)], t = m1 > m0 ? (midi - m0) / (m1 - m0) : 0;
  return { ...entry, range: [l0 + t * (l1 - l0), h0 + t * (h1 - h0)] };
}

// public/random-source.js
var MULBERRY_STEP = 1831565813;
function hashSeed(value3) {
  const text = String(value3), numeric = Number(text);
  if (text.trim() !== "" && Number.isFinite(numeric)) return numeric >>> 0;
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function freshSeed() {
  return hashSeed(Date.now());
}
function mulberry(state2) {
  let value3 = state2;
  value3 = Math.imul(value3 ^ value3 >>> 15, value3 | 1);
  value3 ^= value3 + Math.imul(value3 ^ value3 >>> 7, value3 | 61);
  return ((value3 ^ value3 >>> 14) >>> 0) / 4294967296;
}
function createRandomStream(value3) {
  const seed2 = hashSeed(value3);
  let state2 = seed2;
  return {
    seed: seed2,
    next() {
      state2 = state2 + MULBERRY_STEP >>> 0;
      return mulberry(state2);
    },
    snapshot() {
      return { algorithm: "mulberry32", seed: seed2, state: state2 };
    },
    restore(saved) {
      if (saved?.algorithm !== "mulberry32" || saved.seed !== seed2 || !Number.isInteger(saved.state) || saved.state < 0 || saved.state > 4294967295) throw new Error("Invalid random stream state");
      state2 = saved.state;
    }
  };
}
var seed = freshSeed();
var stream = createRandomStream(seed);

// public/shared/rhythm-vocabulary.js
var KRISHNASWAMY_WELLS = Object.freeze({
  citation: 'Jagdish A. Krishnaswamy and Robert Wells, "A Novel Generative Paradigm for Carnatic Rhythmic Composition", Analytical Approaches to Music of South Asia 1 (2023)',
  uri: "https://southasia.iftawm.org/wp-content/uploads/KrishnaswamyWells_Article.pdf",
  accessed: "2026-09-28"
});
var TOUSSAINT = Object.freeze({
  citation: 'Godfried T. Toussaint, The Geometry of Musical Rhythm: What Makes a "Good" Rhythm Good? (CRC Press, 2013), and "The Euclidean algorithm generates traditional musical rhythms", Bridges (2005)',
  uri: "https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf",
  accessed: "2026-09-28"
});
var VURKAC = Object.freeze({
  citation: 'Mehmet Vurkaç, "A Cross-Cultural Grammar for Temporal Harmony in Afro-Latin Musics: Clave, Partido-Alto and Other Timelines", Current Musicology 94 (2012)',
  uri: "https://doi.org/10.7916/cm.v0i94.5234",
  accessed: "2026-07-24"
});
var CLAYTON = Object.freeze({ citation: "Martin Clayton, Time in Indian Music: Rhythm, Metre, and Form in North Indian Rāg Performance (Oxford University Press, 2000)", uri: null, accessed: null });
var wikipedia = (title, accessed = "2026-09-28") => Object.freeze({ citation: `"${title}", Wikipedia`, uri: `https://en.wikipedia.org/wiki/${title}`, accessed });
var NADAI = Object.freeze({ caturasra: 1, tisra: 3, khanda: 5, misra: 7, sankirna: 9, "sampurna-khanda": 10 });
var THEKA_BAYAN = Object.freeze({ dha: true, dhin: true, dhi: true, ta: false, tin: false, ti: false, na: false });
var tala = (record) => {
  const beats = record.components.reduce((sum, component) => sum + component.beats, 0);
  if (record.theka && (record.theka.length !== beats || record.theka.some((bol) => !(bol in THEKA_BAYAN)))) throw new RangeError(`${record.id}: a theka is a known bol for each beat`);
  return Object.freeze({
    kind: "tala",
    license: "metadata-only",
    ...record,
    ...record.theka ? { theka: Object.freeze([...record.theka]) } : {},
    components: Object.freeze(record.components.map((component) => Object.freeze({ ...component, gestures: component.gestures ? Object.freeze([...component.gestures]) : null })))
  });
};
var clave = (record) => Object.freeze({ kind: "clave", license: "metadata-only", ...record, onsets: Object.freeze([...record.onsets]) });
var RHYTHM_VOCABULARY = Object.freeze(Object.fromEntries([
  // Ādi tāḷa: "8 beats of equal duration ... grouped into three angas of 4, 2, and 2 beats" (¶15). A laghu's beats are a
  // clap and finger counts from the little finger, a drutam's a clap and a wave (Figure 1, shown there for tisra
  // triputa's laghu of three: clap, pinky, ring).
  tala({
    id: "carnatic.adi",
    tradition: "Carnatic",
    name: "Ādi tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "laghu", beats: 4, gestures: ["clap", "pinky", "ring", "middle"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }]
  }),
  // Tiśra tripuṭa tāḷa: "seven-beat cycles divided into angas of lengths 3, 2, and 2", each beat marked by its kriyā:
  // clap, pinky, ring; clap, wave; clap, wave (Figure 1).
  tala({
    id: "carnatic.tisra-triputa",
    tradition: "Carnatic",
    name: "Tiśra tripuṭa tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "laghu", beats: 3, gestures: ["clap", "pinky", "ring"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }]
  }),
  // Rūpaka tāḷa as the source takes it: "3 beats of equal duration" (¶15), "a 3-beat rhythmic cycle with 4 subdivisions
  // per beat" (¶3). The source gives no kriyās for it, so none are claimed.
  tala({
    id: "carnatic.rupaka",
    tradition: "Carnatic",
    name: "Rūpaka tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "beats", beats: 3, gestures: null }]
  }),
  // Miśra cāpu tāḷa, a cāpu tāḷa, "whose beats vary in duration" (¶12), as the source takes it: "one long beat (three
  // subdivisions) followed by two shorter beats (two subdivisions)", seven subdivisions a cycle (note 3; "miṣra cāpu
  // tāḷa in tiṣra naḍai, totalling 21 subdivisions per cycle"). Other artists count it as seven equal beats (note 3).
  // No kriyās are claimed.
  tala({
    id: "carnatic.misra-capu",
    tradition: "Carnatic",
    name: "Miśra cāpu tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "long", beats: 1, units: 3, gestures: null }, { kind: "short", beats: 2, units: 2, gestures: null }]
  }),
  // Hindustani taals: vibhags, each begun with a clap (tali; the cycle's first, sam, marked X) or a wave (khali, "empty",
  // marked 0), the other matras ungestured; and the theka, the taal's stroke names (bols) a matra each. Where a bol
  // sounds the bayan, the left-hand bass drum (dha, dhin, dhi), and where it does not (ta, tin, ti, na) is the theka's
  // own (THEKA_BAYAN), so a part's bass can follow it: the khali vibhag is where it thins.
  // Teentaal: 16 matras, 4+4+4+4, marked X 2 0 3.
  tala({
    id: "hindustani.teentaal",
    tradition: "Hindustani",
    name: "Tīntāl",
    source: [CLAYTON, wikipedia("Teental")],
    components: [
      { kind: "vibhag", role: "tali", marker: "X", beats: 4, gestures: ["sam", null, null, null] },
      { kind: "vibhag", role: "tali", marker: "2", beats: 4, gestures: ["tali", null, null, null] },
      { kind: "vibhag", role: "khali", marker: "0", beats: 4, gestures: ["khali", null, null, null] },
      { kind: "vibhag", role: "tali", marker: "3", beats: 4, gestures: ["tali", null, null, null] }
    ],
    theka: ["dha", "dhin", "dhin", "dha", "dha", "dhin", "dhin", "dha", "dha", "tin", "tin", "ta", "ta", "dhin", "dhin", "dha"]
  }),
  // Jhaptaal: 10 matras, 2+3+2+3, marked X 2 0 3.
  tala({
    id: "hindustani.jhaptaal",
    tradition: "Hindustani",
    name: "Jhaptāl",
    source: [CLAYTON, wikipedia("Jhaptal")],
    components: [
      { kind: "vibhag", role: "tali", marker: "X", beats: 2, gestures: ["sam", null] },
      { kind: "vibhag", role: "tali", marker: "2", beats: 3, gestures: ["tali", null, null] },
      { kind: "vibhag", role: "khali", marker: "0", beats: 2, gestures: ["khali", null] },
      { kind: "vibhag", role: "tali", marker: "3", beats: 3, gestures: ["tali", null, null] }
    ],
    theka: ["dhi", "na", "dhi", "dhi", "na", "ti", "na", "dhi", "dhi", "na"]
  }),
  // Clave: an orienting timeline with a direction, not five marked slots (Vurkaç 2012). Onsets on sixteen pulses, as
  // Toussaint writes them: son x..x..x...x.x..., rumba x..x...x..x.x..., bossa nova x..x..x...x..x... The 2-3 side is
  // the same timeline begun at its other half.
  clave({ id: "afro-cuban.son-clave-3-2", tradition: "Afro-Cuban", name: "Son clave, 3-2", pulses: 16, onsets: [0, 3, 6, 10, 12], direction: "3-2", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.son-clave-2-3", tradition: "Afro-Cuban", name: "Son clave, 2-3", pulses: 16, onsets: [2, 4, 8, 11, 14], direction: "2-3", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.rumba-clave-3-2", tradition: "Afro-Cuban", name: "Rumba clave, 3-2", pulses: 16, onsets: [0, 3, 7, 10, 12], direction: "3-2", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.rumba-clave-2-3", tradition: "Afro-Cuban", name: "Rumba clave, 2-3", pulses: 16, onsets: [2, 4, 8, 11, 15], direction: "2-3", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "brazilian.bossa-nova-clave", tradition: "Brazilian", name: "Bossa nova clave", pulses: 16, onsets: [0, 3, 6, 10, 13], direction: null, source: [TOUSSAINT] })
].map((record) => [record.id, record])));

// public/shared/meter-space.js
var METER_SPACE = Object.freeze({
  numerators: Object.freeze([1, 40]),
  // Power-of-two denominators mostly; the irrational ones besides (docs/NOTATION.md writes those as the real meter nearest,
  // with a tempo).
  denominators: Object.freeze([[2, 1], [3, 1], [4, 4], [5, 1], [6, 1], [8, 4], [10, 1], [12, 2], [16, 3], [24, 1], [32, 1]].map(Object.freeze)),
  // A bar's groups: 2s and 3s mostly, now and then a 1 or a 4.
  groupSizes: Object.freeze([[2, 4], [3, 4], [1, 0.3], [4, 1]].map(Object.freeze)),
  // The share of draws grouped as they draw, rather than as the meter's most-threes.
  ownGrouping: 0.7,
  // Pulses a unit.
  subdivisions: Object.freeze([[1, 1], [2, 3], [3, 2], [4, 3], [5, 1], [6, 1]].map(Object.freeze)),
  // The share of draws that are a named cycle (the rhythm vocabulary's talas).
  talas: 0.12,
  // A bar the band plays, in seconds at its tempo (longer bars: meterform's sections).
  barSeconds: Object.freeze([0.5, 10])
});
var TALAS = Object.freeze(Object.keys(RHYTHM_VOCABULARY).filter((id) => RHYTHM_VOCABULARY[id].kind === "tala").sort());

// public/shared/felt-meter-catalog.js
var freeze = (value3) => {
  if (value3 && typeof value3 === "object") {
    Object.values(value3).forEach(freeze);
    Object.freeze(value3);
  }
  return value3;
};
var FELT_METER_POLICY = freeze({
  "id": "score-selection-v2",
  "evidence": "authored-policy-not-human-calibration",
  "favoredBeatSeconds": [
    "2/5",
    "4/5"
  ],
  "candidateBeatSeconds": [
    "3/10",
    "1"
  ],
  "cyclePreferenceMaxSeconds": "4",
  "cycleMinimumSeconds": null,
  "catalog": [
    { "id": "2/4-in-2", "numerator": 2, "denominator": 4, "beatWeights": [1, 1], "groups": [1, 1], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "3/4-in-3", "numerator": 3, "denominator": 4, "beatWeights": [1, 1, 1], "groups": [3], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "4/4-in-4", "numerator": 4, "denominator": 4, "beatWeights": [1, 1, 1, 1], "groups": [2, 2], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "2/2-in-2", "numerator": 2, "denominator": 2, "beatWeights": [1, 1], "groups": [1, 1], "kind": "standard", "reference": { "unit": 2, "dots": 0 }, "favoredQuarterBPM": ["150", "300"], "candidateQuarterBPM": ["120", "400"] },
    { "id": "3/2-in-3", "numerator": 3, "denominator": 2, "beatWeights": [1, 1, 1], "groups": [3], "kind": "standard", "reference": { "unit": 2, "dots": 0 }, "favoredQuarterBPM": ["150", "300"], "candidateQuarterBPM": ["120", "400"] },
    { "id": "6/8-in-2", "numerator": 6, "denominator": 8, "beatWeights": [3, 3], "groups": [3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "9/8-in-3", "numerator": 9, "denominator": 8, "beatWeights": [3, 3, 3], "groups": [3, 3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "12/8-in-4", "numerator": 12, "denominator": 8, "beatWeights": [3, 3, 3, 3], "groups": [3, 3, 3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "5/4-in-5", "numerator": 5, "denominator": 4, "beatWeights": [1, 1, 1, 1, 1], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["75", "200"] },
    { "id": "7/4-in-7", "numerator": 7, "denominator": 4, "beatWeights": [1, 1, 1, 1, 1, 1, 1], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["105", "150"], "candidateQuarterBPM": ["105", "200"] },
    { "id": "5/4-in-2", "numerator": 5, "denominator": 4, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225", "300"], "candidateQuarterBPM": ["180", "400"] },
    { "id": "7/4-in-3", "numerator": 7, "denominator": 4, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225", "300"], "candidateQuarterBPM": ["180", "400"] },
    { "id": "5/8-in-2", "numerator": 5, "denominator": 8, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "7/8-in-3", "numerator": 7, "denominator": 8, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "8/8-in-3", "numerator": 8, "denominator": 8, "beatWeights": [3, 3, 2], "groups": [3, 3, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "9/8-in-4", "numerator": 9, "denominator": 8, "beatWeights": [2, 2, 2, 3], "groups": [2, 2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "11/8-in-5", "numerator": 11, "denominator": 8, "beatWeights": [2, 2, 3, 2, 2], "groups": [2, 2, 3, 2, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "13/8-in-5", "numerator": 13, "denominator": 8, "beatWeights": [3, 3, 3, 2, 2], "groups": [3, 3, 3, 2, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["195/2", "200"] },
    { "id": "17/8-in-6", "numerator": 17, "denominator": 8, "beatWeights": [3, 3, 3, 3, 3, 2], "groups": [3, 3, 3, 3, 3, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["255/2", "150"], "candidateQuarterBPM": ["255/2", "200"] },
    { "id": "5/16-in-2", "numerator": 5, "denominator": 16, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/4", "75"], "candidateQuarterBPM": ["45", "100"] },
    { "id": "7/16-in-3", "numerator": 7, "denominator": 16, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/4", "75"], "candidateQuarterBPM": ["45", "100"] },
    { "id": "17/16-in-7", "numerator": 17, "denominator": 16, "beatWeights": [2, 2, 3, 2, 2, 3, 3], "groups": [2, 2, 3, 2, 2, 3, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["255/4", "75"], "candidateQuarterBPM": ["255/4", "100"] },
    { "id": "17/16-in-4", "numerator": 17, "denominator": 16, "beatWeights": [4, 4, 4, 5], "groups": [4, 4, 4, 5], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["375/4", "150"], "candidateQuarterBPM": ["75", "200"] },
    { "id": "107/32-in-5", "numerator": 107, "denominator": 32, "beatWeights": [19, 19, 19, 25, 25], "groups": [57, 50], "kind": "specialist", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["1875/8", "1425/4"], "candidateQuarterBPM": ["1605/8", "475"] },
    { "id": "107/32-in-2", "numerator": 107, "denominator": 32, "beatWeights": [57, 50], "groups": [57, 50], "kind": "specialist", "reference": { "unit": 1, "dots": 0 }, "favoredQuarterBPM": ["4275/8", "1875/2"], "candidateQuarterBPM": ["855/2", "1250"] }
  ]
});
var FELT_METER_CATALOG = FELT_METER_POLICY.catalog;

// public/shared/tempo-range.js
var TEMPO_LIMITS = Object.freeze({ notated: Object.freeze([40, 220]), coordinate: Object.freeze([30, 720]) });

// public/shared/meter-reading.js
var EDITORIAL_ACTIONS = Object.freeze([
  "PUBLISH_STANDARD",
  "PUBLISH_GROUPED",
  "PUBLISH_SPECIALIST_WITH_LEGEND",
  "KEEP_WITH_SUPPORT",
  "PREFER_LOCAL_BARS_WITH_CYCLE_BRACKET",
  "HOLD_FOR_REVIEW",
  "FREE_TIME_BY_INTENT"
]);

// public/shared/metric-home/grouping.js
var REMAINDER_UNITS = Object.freeze([3, 2]);

// public/shared/metric-home/nested.js
var NESTING = Object.freeze({
  // The longest group a listener hears as one (seconds; meterform_clodbot's and grouping-choice.js's longestGroupSeconds,
  // ours, within the few seconds a measure can last: London 2012, Hearing in Time, 2nd ed.,
  // doi:10.1093/acprof:oso/9780199744374.001.0001).
  longestSeconds: 5,
  // A split into sections is told apart by their lengths: the shorter section at least this share of the span and the
  // two sections' shares differing by at least `contrast` (37/107 against 70/107 differ by 0.31). Ours.
  shortestShare: 0.25,
  contrast: 0.12,
  // Candidate splits offered at most for one span, the best first. Ours.
  offered: 12,
  // Groups under one at most (grouping.js MAX_GROUPS_UNDER_ONE, Scansion Maker's: four or more are grouped again).
  maxParts: 3
});

// public/shared/felt-tempo.js
var value = (text) => {
  const [n, d = "1"] = String(text).split("/");
  return Number(n) / Number(d);
};
var band = (list) => [value(list[0]), value(list[1])];
var FELT_TEMPO = Object.freeze({
  beat: Object.freeze(band(FELT_METER_POLICY.candidateBeatSeconds)),
  favoredBeat: Object.freeze(band(FELT_METER_POLICY.favoredBeatSeconds)),
  longestBarSeconds: NESTING.longestSeconds
});

// public/shared/opening-time.js
var DEFAULT_SEED = 20260916;
var OPENING_TIME = Object.freeze({
  // A phrase's length, in seconds, drawn log-uniform between these (ours: about meterspace_clodbot's eight).
  phraseSeconds: Object.freeze([5, 13]),
  // A phrase's bars at most (ours: meterspace_clodbot's).
  phraseBarsAtMost: 8,
  // The band's density before any is heard, drawn between these (ours).
  density: Object.freeze([0.35, 0.85]),
  // The note a drawn meter's tempo counts (tempo-range.js tempoUnit): the quarter, as the research reports count every
  // tempo (research/meter/MUSEBOTS_METER_SELECTION_RESEARCH_REPORT.md: "All BPM values below mean quarter-note BPM").
  reference: 4
});

// native/live/musebot.js
var words = (name2) => name2.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
function musebotControls({ box, seed: seed2, seconds }) {
  let built = null, shown4 = null;
  function share(into, id, name2, { grammar = false } = {}) {
    const r = document.createElement("div");
    r.className = "row";
    r.innerHTML = '<label><input type="checkbox"> <span></span></label><input type="range" min="0" max="1" step="0.01"><input type="number" min="0" max="1" step="0.01">';
    r.querySelector("span").textContent = words(name2);
    r.title = `${grammar ? `its motifs' ${name2} grammar's share` : `its ${words(name2)}`}: drawn from its seed unless ticked, 0 to 1 across its range (registry/method/personality.json)`;
    const [tick, range, number] = r.querySelectorAll("input");
    range.id = `${id}-${name2}`;
    r.querySelector("label").htmlFor = range.id;
    const drawnShown = () => r.classList.toggle("drawn", !tick.checked);
    const set = (v) => {
      range.value = v;
      number.value = (+v).toFixed(2);
    };
    range.oninput = () => {
      tick.checked = true;
      number.value = (+range.value).toFixed(2);
      drawnShown();
    };
    number.onchange = () => {
      const v = +number.value;
      if (Number.isFinite(v) && v >= 0 && v <= 1) {
        tick.checked = true;
        range.value = v;
        drawnShown();
      } else number.value = (+range.value).toFixed(2);
    };
    tick.onchange = drawnShown;
    into.append(r);
    set(0.5);
    drawnShown();
    return {
      name: name2,
      grammar,
      get given() {
        return tick.checked;
      },
      value: () => +range.value,
      take(v, given) {
        tick.checked = given;
        if (v != null) set(v);
        drawnShown();
      }
    };
  }
  function span(into, id, name2) {
    const r = document.createElement("div");
    r.className = "row";
    r.innerHTML = '<label><input type="checkbox"> <span></span></label><input type="number" min="0" max="1" step="0.01"><input type="number" min="0" max="1" step="0.01">';
    r.querySelector("span").textContent = words(name2);
    r.title = `its range of ${words(name2)}, its low and high shares of its span on its instrument: drawn from its seed unless ticked (personality.js TONE_RANGES; docs/PLAYER_PERSONALITY.md)`;
    const [tick, low, high] = r.querySelectorAll("input");
    low.id = `${id}-range-${name2}`;
    r.querySelector("label").htmlFor = low.id;
    let last = [0, 1];
    const drawnShown = () => r.classList.toggle("drawn", !tick.checked);
    const set = ([a, b]) => {
      low.value = (+a).toFixed(2);
      high.value = (+b).toFixed(2);
      last = [+a, +b];
    };
    low.onchange = high.onchange = () => {
      const a = +low.value, b = +high.value;
      if (!(a >= 0 && a <= 1 && b >= 0 && b <= 1)) {
        set(last);
        return;
      }
      set([Math.min(a, b), Math.max(a, b)]);
      tick.checked = true;
      drawnShown();
    };
    tick.onchange = drawnShown;
    into.append(r);
    set(last);
    drawnShown();
    return {
      name: name2,
      range: true,
      get given() {
        return tick.checked;
      },
      value: () => [...last],
      take(v, given) {
        tick.checked = given;
        if (v != null) set(v);
        drawnShown();
      }
    };
  }
  function build2(player2) {
    box.replaceChildren();
    const id = box.id || "musebot", head = document.createElement("div");
    head.className = "note musebotNote";
    head.textContent = "Each drawn from its seed unless ticked; a piece's draw shown on those not ticked.";
    const all = document.createElement("button");
    all.type = "button";
    all.textContent = "All from its seed";
    all.onclick = () => {
      for (const s2 of built) s2.take(null, false);
    };
    box.append(head, all);
    const levers = player2.levers.map((name2) => share(box, id, name2));
    const g = document.createElement("div");
    g.className = "curveLabel";
    g.textContent = "Its motifs' grammars";
    box.append(g);
    built = [...levers, ...(player2.grammars ?? []).map((name2) => share(box, id, name2, { grammar: true }))];
    if (player2.ranges?.length) {
      const r = document.createElement("div");
      r.className = "curveLabel";
      r.textContent = "Its tone's ranges, low and high";
      box.append(r);
      built.push(...player2.ranges.map((name2) => span(box, id, name2)));
    }
  }
  return {
    // (What a piece is asked with: the levers, grammars and ranges ticked, each by its name.)
    given() {
      const personality = {}, grammars = {}, ranges = {};
      for (const s2 of built ?? []) if (s2.given) (s2.range ? ranges : s2.grammar ? grammars : personality)[s2.name] = s2.value();
      if (Object.keys(grammars).length) personality.grammars = grammars;
      if (Object.keys(ranges).length) personality.ranges = ranges;
      return { seed: Number(seed2.value), seconds: Number(seconds.value), personality };
    },
    // (The dial's player: its controls built the first time, and set again only when it changes -- a file loaded, a
    // piece asked -- so that what is being set here is not undone by a poll; `drawn`, a piece's own levers.)
    show(player2, drawn = null) {
      if (!player2?.levers) return;
      if (!built) build2(player2);
      const now = JSON.stringify([player2.seed, player2.seconds, player2.personality, drawn?.levers ?? null, drawn?.ranges ?? null]);
      if (now === shown4) return;
      shown4 = now;
      if (document.activeElement !== seed2) seed2.value = player2.seed;
      if (document.activeElement !== seconds) seconds.value = player2.seconds;
      const given = player2.personality ?? {};
      for (const s2 of built) {
        const set = s2.range ? given.ranges?.[s2.name] : s2.grammar ? given.grammars?.[s2.name] : given[s2.name];
        s2.take(set ?? (s2.range ? drawn?.ranges?.[s2.name] : s2.grammar ? drawn?.grammars?.[s2.name] : drawn?.levers?.[s2.name]) ?? null, set != null);
      }
    }
  };
}

// native/live/strings.js
var $ = (id) => document.getElementById(`s-${id}`);
var NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
var name = (midi) => {
  const n = Math.round(midi), c = Math.round(100 * (midi - n));
  return `${NAMES[(n % 12 + 12) % 12]}${Math.floor(n / 12) - 1}${c ? ` ${c > 0 ? "+" : ""}${c} ¢` : ""}`;
};
var midiOf = (f) => 69 + 12 * Math.log2(f / 440);
var state;
var s = 0;
var bowing = false;
var bridge = false;
var direction = 1;
var builds = [];
var INSTRUMENT_OF = [];
var value2 = {};
var setters = {};
var notes = {};
function dial(box, id, label3, { min, max, log, value: start, step = "any", onchange, note }) {
  for (const taken of [id, `${id}N`, `${id}Note`]) if ($(taken)) throw new Error(`dial ${id}: the id s-${taken} is taken`);
  const row2 = document.createElement("div");
  row2.className = "row";
  row2.innerHTML = `<label for="s-${id}"></label><input type="range" id="s-${id}" step="any"><input type="number" id="s-${id}N" step="${step}">`;
  row2.querySelector("label").textContent = label3;
  $(box).append(row2);
  if (note !== void 0) {
    const n = document.createElement("div");
    n.className = "note";
    n.id = `s-${id}Note`;
    n.textContent = note;
    $(box).append(n);
    notes[id] = n;
  }
  const range = $(id), number = $(id + "N"), to = (v) => log ? Math.log(v) : v, from = (x2) => log ? Math.exp(x2) : x2;
  const bounds = (lo, hi) => {
    range.min = to(lo);
    range.max = to(hi);
    min = lo;
    max = hi;
    range.value = to(Math.min(max, Math.max(min, value2[id])));
  };
  const set = (v, quiet) => {
    value2[id] = v;
    range.value = to(Math.min(max, Math.max(min, v)));
    number.value = +(+v).toPrecision(4);
    if (!quiet) onchange?.();
  };
  range.min = to(min);
  range.max = to(max);
  range.oninput = () => set(from(+range.value));
  number.onchange = () => {
    const v = +number.value;
    if (Number.isFinite(v) && (!log || v > 0)) set(v);
    else number.value = value2[id];
  };
  set(start, true);
  setters[id] = Object.assign(set, { bounds, place: (v) => (to(v) - range.min) / (range.max - range.min) });
}
async function ask(asks) {
  if (!asks.length) return;
  const r = await fetch("/strings/set", { method: "POST", body: JSON.stringify({ asks }) });
  $("said").textContent = r.ok ? "" : `The model refused a setting: ${await r.text()}`;
}
var pending = /* @__PURE__ */ new Map();
function later(key, build2) {
  if (!pending.size) requestAnimationFrame(() => {
    const asks = [...pending.values()].flatMap((b) => b());
    pending.clear();
    ask(asks);
  });
  pending.set(key, build2);
}
var finger = () => 1 - 2 ** (-value2.pitch / 12);
var pos = () => value2.beta * (1 - finger());
var alternating = () => $("alternate").checked;
var fingerAsk = () => ({ do: "finger", string: s, finger: finger(), firmness: value2.firmness });
var dampingAsk = () => ({ do: "damping", string: s, ratio: value2.damping });
var bowAsk = () => ({ do: "bow", string: s, pos: pos(), force: value2.force, vel: direction * value2.speed });
var strokeAsk = () => ({ do: "stroke", string: s, pos: pos(), force: value2.force, vel: direction * value2.speed, acc: value2.speed / value2.start });
var alternateAsk = () => ({ do: "alternate", string: s, stroke: alternating() ? value2.stroke / 100 : 0, end: value2.end, start: value2.start });
var vibratoAsk = (string = s) => ({ do: "vibrato", string, width: $("vibrating").checked ? value2.width : 0, rate: value2.rate });
var buildAsk = (string = s) => ({ do: "build", string, ...builds[string] });
var radiateAsk = () => ({ do: "radiate", corner: $("radiating").checked ? value2.corner : 0, order: +$("falling").value });
var correctAsk = () => ({ do: "correct", on: $("correcting").checked });
var heardDb = () => state.neutralDb ?? state.gainDb + state.rendersDb - state.startedRendersDb;
var cornerFor = (corrected) => corrected && state.correctedRadiation ? state.correctedRadiation.hz : state.airMode.hz;
var hairAsk = (string = s) => ({ do: "hair", string, width: value2.hair / 1e3 });
var NOISE_KINDS = [
  ["force", "Bow force", (sd) => `At 1, ${+(100 * sd).toPrecision(2)} % of the force asked.`],
  ["speed", "Bow speed", (sd) => `At 1, ${+(100 * sd).toPrecision(2)} % of the speed asked.`],
  ["contact", "The bow's place", (sd) => `At 1, ${+(1e3 * sd).toPrecision(2)} thousandths of the string's length.`],
  ["finger", "The finger's pitch", (sd) => `At 1, ${sd} cents.`]
];
var noiseId = (kind) => `noise${kind[0].toUpperCase()}${kind.slice(1)}`;
var noiseAsks = () => NOISE_KINDS.map(([kind]) => ({ do: "noise", what: kind, temperature: value2.noisePlayer * value2[noiseId(kind)] }));
var noiseAt = (player2, kinds = {}) => {
  setters.noisePlayer(player2, true);
  for (const [kind] of NOISE_KINDS) setters[noiseId(kind)](kinds[kind] ?? 1, true);
};
var BUILD = [
  ["T", "Tension (N)", "build"],
  ["L", "Length (m)", "build"],
  ["d", "Diameter (m)", "build"],
  ["pl", "Linear density (kg/m)", "build"],
  ["E", "Young's modulus (Pa)", "build"],
  ["mus", "Static friction μs", "buildPhysics"],
  ["mud", "Dynamic friction μd", "buildPhysics"],
  ["v0", "Friction curve slope v0 (m/s)", "buildPhysics"],
  ["loss", "Modes' losses (× own)", "buildPhysics"],
  ["slope", "Losses tilt (× n^slope)", "buildPhysics"],
  ["modes", "Modes (the most)", "buildPhysics"]
];
var ownBuild = (k) => ({ T: k.T, L: k.L, d: k.d, pl: k.pl, E: k.E, mus: k.mus, mud: k.mud, v0: k.v0, loss: 1, slope: 0, modes: k.N });
var startBuild = (k) => ({ ...ownBuild(k), modes: state.mostModes });
var inUse = { modes: [], points: [], cellMm: [] };
var openHz = (k) => Math.sqrt(k.T / k.pl) / (2 * k.L);
function way() {
  $("way").textContent = bowing ? direction > 0 ? "↓ down-bow" : "↑ up-bow" : "";
}
function read() {
  const k = builds[s];
  if (!k) return;
  const f0 = openHz(k), length = k.L * (1 - finger()), Z2 = Math.sqrt(k.T * k.pl), v = value2.speed, b = value2.beta, F2 = value2.force;
  const most = 2 * Z2 * v / (b * (k.mus - k.mud)), corner = 2 * Z2 * v / b;
  notes.pitch.textContent = `${name(midiOf(f0) + value2.pitch)} · finger ${(100 * finger()).toFixed(1)} % of the string from the nut`;
  notes.beta.textContent = `${(1e3 * b * length).toFixed(1)} mm from the bridge, of ${(1e3 * length).toFixed(0)} mm sounding · smaller is nearer the bridge (sul ponticello), larger toward the fingerboard (sul tasto)`;
  notes.stroke.textContent = `${(value2.stroke / state.bow.length).toFixed(0)} % of a ${(100 * state.bow.length).toFixed(0)} cm bow · a stroke lasts about ${(value2.stroke / 100 / value2.speed).toFixed(2)} s at this speed`;
  const rows = [
    ["The force most for a clean (Helmholtz) tone", k.mus > k.mud ? `${most.toFixed(2)} N — you are at ${(100 * F2 / most).toFixed(0)} % of it` : "none: μs is not over μd"],
    ["Helmholtz force on the bridge, 2Zv/β", `${corner.toFixed(2)} N (${(20 * Math.log10(corner)).toFixed(1)} dB re 1 N): what loudness the stroke asks`],
    ["Speed over contact point, v/β", `${(v / b).toFixed(2)} m/s`],
    ["This string", `open ${name(midiOf(f0))} (${f0.toFixed(1)} Hz), impedance Z ${Z2.toFixed(3)} kg/s`]
  ];
  $("reading").innerHTML = rows.map(([a, b2]) => `<tr><td>${a}</td><td>${b2}</td></tr>`).join("");
  attackSaid();
}
function strings2() {
  $("strings").innerHTML = builds.map((k, i) => `<label><input type="radio" name="s-string" value="${i}"${i === s ? " checked" : ""}> ${name(midiOf(openHz(k)))} string</label>`).join("");
  for (const r of document.querySelectorAll("input[name=s-string]")) r.onchange = () => cross(+r.value);
}
function cross(next) {
  const was = s;
  if (next === was) return;
  const asks = [{ do: "vibrato", string: was, width: 0, rate: value2.rate }, ...bowing ? [{ do: "lift", string: was, pos: pos(), vel: direction * value2.speed }] : []];
  s = next;
  limits();
  showBuild();
  asks.push(fingerAsk(), dampingAsk(), vibratoAsk(), hairAsk());
  if (bowing) asks.push(alternateAsk(), strokeAsk());
  ask(asks);
  read();
  hairNote();
}
var fingerboard = () => $("limitFingerboard").checked;
var hairLimited = () => $("limitHair").checked;
function limits() {
  const top = fingerboard() ? state.fingerboard : Math.max(state.fingerboard, state.range.range[1] - midiOf(openHz(builds[s])));
  setters.pitch.bounds(0, top);
  if (value2.pitch > top) setters.pitch(top, true);
  const length = builds[s].L * (1 - finger()), nearest = Math.min(0.5, hairLimited() ? Math.max(0.02, value2.hair / 2e3 / length) : 0.02);
  setters.beta.bounds(nearest, 0.5);
  if (value2.beta < nearest) setters.beta(nearest, true);
  hairNote();
  drawPlayers();
  $("fingerboardLimit").textContent = `at most ${state.fingerboard.toFixed(1)} semitones over the open string, where it meets the end of the ${state.name}'s fingerboard (Goldblatt's measurements)`;
  $("hairLimit").textContent = `its middle at least half the hair on the string from the bridge (${(value2.hair / 2).toFixed(1)} mm): a violin bow's hair is about ${(1e3 * state.bow.hairWidth).toFixed(0)} mm wide (Schoonderwaldt, Guettler & Askenfelt 2003)${state.instrument === "violin" ? "" : `; the ${state.name}'s not found measured`}`;
}
var bands = {};
function drawPlayers() {
  const R = state.players;
  if (!R) return;
  const open = midiOf(openHz(builds[s])), shortly2 = (v) => String(+(+v).toPrecision(2));
  const WRITTEN2 = { pitch: (v) => name(Math.round(open + v)), force: (v) => `${shortly2(v)} N`, width: (v) => `${Math.round(v)} ¢`, rate: (v) => `${shortly2(v)} Hz`, damping: (v) => `${shortly2(v)}×` };
  for (const [id, set] of Object.entries(setters)) {
    if (id === "volume") continue;
    const entry = id === "pitch" && R.pitch ? { ...R.pitch, range: R.pitch.range.map((m) => m - open) } : R[id] ?? null;
    (bands[id] ??= playersBand($(id)))(entry, set.place, WRITTEN2[id] ?? shortly2);
  }
}
function hairNote() {
  const modes = inUse.modes[s] ?? state.strings[s].N, cells = inUse.points[s] ?? 0, cell = inUse.cellMm[s];
  notes.hair.textContent = value2.hair > 0 && cells > 0 ? `${cells > 1 ? `${cells} cells of ${(value2.hair / cells).toFixed(1)} mm` : `one cell, ${value2.hair.toFixed(1)} mm`}, each sticking and slipping on its own: its ${modes} modes hold cells no finer than ${Number.isFinite(cell) ? cell.toFixed(1) : "?"} mm apart (more modes, finer cells); under the ribbon's ${(1e3 * state.bow.hairWidth).toFixed(0)} mm, the bow tilted` : "Artifastring's point bow";
  notes.modes.textContent = `${modes} in use, as many as asked and as its rate holds (Artifastring's own ${state.strings[s].N}): more resolve the bow's hair more finely, and take more processing`;
}
function bodyNote() {
  const c = state.correctedRadiation;
  const b = state.bodyScaled;
  $("bodyNote").textContent = (b ? `Its body: Artifastring's ${b.from} bodies scaled to the ${state.name}'s size, every resonance ${b.ratio} times lower (the ratio of the two instruments' lowest air modes) -- for now, until a measured bass body is fitted. ` : "") + `Corrected: Artifastring's ${b ? b.from : state.name} bodies, whose highs fall as a low-pass filter's do, brought to the instrument's radiation by the renders' own filter${b ? ", scaled with them" : ""}. Radiating: a body sounds nothing at 0 Hz, so the bow's drag, building as a stroke starts, is not heard as a low thump. Lowest air mode (A0): ${state.airMode.hz} Hz, ${state.airMode.source}.` + (c ? ` Corrected, the fall starts at ${c.hz} Hz, where the correction's own cut stops` + (c.scaled ? ` (the ${b.from}'s, scaled).` : ` (within ${c.offDb} dB of the radiation under A0, against ${c.unradiatedOffDb} dB without it).`) : "");
}
function showBuild() {
  const own2 = state.strings[s];
  for (const [key] of BUILD) {
    if (!["loss", "slope", "modes"].includes(key)) setters[key].bounds(own2[key] / 10, own2[key] * 10);
    setters[key](builds[s][key], true);
  }
}
function play() {
  bowing = !bowing;
  $("play").classList.toggle("on", bowing);
  $("play").textContent = bowing ? "■ Stop" : "▶ Play";
  way();
  return ask(bowing ? [alternateAsk(), strokeAsk()] : [{ do: "stop" }]);
}
function reverse() {
  direction = -direction;
  way();
  if (bowing) ask([{ ...alternateAsk(), stroke: 0 }, strokeAsk(), alternateAsk()]);
}
var arrived = null;
async function instrument(type, variant) {
  if (bowing) play();
  const got = new Promise((done) => {
    arrived = { left: 4, done };
  });
  await ask([{ do: "stop" }, { do: "instrument", type, variant }]);
  await got;
  state = await (await fetch("/strings/state", { cache: "no-store" })).json();
  builds = state.strings.map(startBuild);
  s = Math.min(s, builds.length - 1);
  inUse = state.inUse;
  variants();
  strings2();
  limits();
  showBuild();
  $("vibratoNote").textContent = `measured for the ${state.name}: ${state.vibrato.width} cents at ${state.vibrato.rate} Hz`;
  setters.corner(cornerFor($("correcting").checked), true);
  bodyNote();
  await ask([fingerAsk(), dampingAsk(), radiateAsk(), ...builds.map((_, i) => buildAsk(i)), hairAsk()]);
  read();
  describe();
}
function variants() {
  const n = state.variants[state.instrument];
  $("variant").innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i}"${i === state.variant ? " selected" : ""}>no. ${i}</option>`).join("");
  $("variants").textContent = `of ${n}`;
}
function describe() {
  document.getElementById("what").textContent = `The ${state.name} on Artifastring, heard through ${state.heardThrough}: ${state.bodyScaled ? `the ${state.bodyScaled.from}'s body` : "Artifastring's"} no. ${state.variant}, seed ${state.seed} · ` + (state.neutral ? `taken up on its neutral note, from ${state.neutral.map.split("/").pop()}` : `its good note made from ${state.from.split("/").pop()}`);
}
async function init(status2) {
  for (const until = performance.now() + 6e4; ; ) {
    state = await (await fetch("/strings/state", { cache: "no-store" })).json();
    if (state.rate && Object.keys(state.constants).length && state.strings.filter(Boolean).length === 4) break;
    if (performance.now() > until) throw new Error("its host did not say its strings within a minute");
    status2.textContent = "Starting the strings' host ...";
    await new Promise((done) => setTimeout(done, 250));
  }
  INSTRUMENT_OF = Object.keys(state.variants);
  soloShown();
  const st = state.start;
  s = st.string;
  direction = st.direction;
  builds = state.strings.map(startBuild);
  inUse = state.inUse;
  variants();
  strings2();
  $("seed").value = state.seed;
  const semis = -12 * Math.log2(1 - st.finger), beta = st.pos / (1 - st.finger);
  const times = [st.startSeconds, state.bow.endSeconds];
  const bowed = () => {
    if (bowing) later("bow", () => [bowAsk()]);
    read();
  };
  const strokes = () => {
    if (bowing) later("alternate", () => [alternateAsk()]);
    read();
  };
  dial("strokes", "stroke", "Bow a stroke (cm)", { min: state.bow.length, max: 100 * state.bow.length, log: true, value: Math.min(100 * state.bow.length, 100 * st.drawn), onchange: strokes, note: "" });
  dial("strokes", "start", "A stroke's start (s)", {
    min: Math.min(...times) / 10,
    max: Math.max(...times) * 10,
    log: true,
    value: st.startSeconds,
    onchange: () => {
      started();
      strokes();
    },
    note: "How long the bow takes to come up to speed: at Play, and in every stroke after a turn."
  });
  dial("strokes", "end", "A stroke's end (s)", {
    min: Math.min(...times) / 10,
    max: Math.max(...times) * 10,
    log: true,
    value: state.bow.endSeconds,
    onchange: strokes,
    note: "How long the bow takes to slow into the turn; from there it comes up to speed the other way over the start."
  });
  attackCurves();
  dial("left", "pitch", "Pitch (semitones)", { min: 0, max: 1, value: semis, onchange: () => {
    limits();
    later("finger", () => [fingerAsk()]);
    bowed();
  }, note: "" });
  dial("left", "firmness", "Finger firmness", {
    min: 1e-3,
    max: 1,
    log: true,
    value: 1,
    onchange: () => later("finger", () => [fingerAsk()]),
    note: "A share of Artifastring's finger stiffness (K_FINGER): 1 a finger stopping the string; light, it touches and sounds a harmonic."
  });
  const fingertip = state.finger, artifastring = fingertip.artifastring / fingertip.damping;
  dial("left", "damping", "Finger damping (× a fingertip's)", {
    min: 0.1,
    max: 10 * Math.ceil(artifastring / 10),
    log: true,
    value: 1,
    onchange: () => later("damping", () => [dampingAsk()]),
    note: `1: a fingertip's measured, ${fingertip.damping} N·s/m (Wiertlewski & Hayward 2012); a light touch its pad's, in proportion. Artifastring's own, ${Math.round(artifastring)}: stopped notes dead within a fifth of a second, the high ones with sidebands.`
  });
  dial("right", "beta", "Contact point β", { min: 0.02, max: 0.5, log: true, value: beta, onchange: () => {
    limits();
    bowed();
  }, note: "" });
  dial("right", "force", "Bow force (N)", { min: 0.1, max: 4, log: true, value: st.force, onchange: bowed });
  dial("right", "speed", "Bow speed (m/s)", { min: st.speed / 10, max: st.speed * 10, log: true, value: st.speed, onchange: bowed });
  dial("right", "hair", "Bow hair on the string (mm)", {
    min: 0,
    max: 1e3 * state.bow.hairWidth,
    value: 1e3 * state.bow.hairWidth,
    step: 0.1,
    onchange: () => {
      limits();
      later("hair", () => [hairAsk()]);
      bowed();
    },
    note: ""
  });
  const vibrated = () => {
    $("vibrating").checked = true;
    later("vibrato", () => [vibratoAsk()]);
  };
  dial("vibrato", "width", "Width (cents)", {
    min: state.vibrato.width / 10,
    max: state.vibrato.width * 10,
    log: true,
    value: state.vibrato.width,
    onchange: vibrated,
    note: "Peak to peak: the pitch goes half of it above and half below."
  });
  dial("vibrato", "rate", "Rate (Hz)", { min: state.vibrato.rate / 10, max: state.vibrato.rate * 10, log: true, value: state.vibrato.rate, onchange: vibrated });
  $("vibrating").onchange = () => later("vibrato", () => [vibratoAsk()]);
  $("vibratoNote").textContent = `measured for the ${state.name}: ${state.vibrato.width} cents at ${state.vibrato.rate} Hz`;
  const profile = state.noise.profile, noised = () => later("noise", noiseAsks);
  dial("noise", "noisePlayer", "The player's temperature", {
    min: 0,
    max: 5,
    value: 1,
    step: 0.05,
    onchange: noised,
    note: `Each kind drawn with its power falling as 1/f^${profile.beta} from ${profile.low} to ${profile.high} Hz, a ${profile.tremor.hz} Hz tremor carrying ${Math.round(100 * profile.tremor.share)} % of it.`
  });
  for (const [kind, label3, size] of NOISE_KINDS) dial("noise", noiseId(kind), label3, { min: 0, max: 5, value: 1, step: 0.05, onchange: noised, note: size(state.noise.kinds[kind].sd) });
  const pulls = Object.values(state.pluck.pull);
  dial("plucking", "pluckPos", "Where (β)", { min: 0.02, max: 0.5, log: true, value: state.pluck.position });
  dial("plucking", "pluckForce", "Pull (N)", { min: Math.min(...pulls), max: Math.max(...pulls), log: true, value: state.pluck.pull.mf });
  const built = (key) => () => {
    builds[s][key] = value2[key];
    later("build", () => [buildAsk()]);
    read();
    strings2();
  };
  for (const [key, label3, box] of BUILD) {
    const own2 = state.strings[s][key];
    dial(box, key, label3, key === "slope" ? { min: -2, max: 2, value: 0, step: 0.01, onchange: built(key) } : key === "loss" ? { min: 0.1, max: 10, log: true, value: 1, onchange: built(key) } : key === "modes" ? { min: 4, max: state.mostModes, log: true, value: state.mostModes, step: 1, onchange: () => {
      setters.modes(Math.round(value2.modes), true);
      built("modes")();
    }, note: "" } : { min: own2 / 10, max: own2 * 10, log: true, value: own2, onchange: built(key) });
  }
  const CONSTANTS = [
    ["A_noise", "Friction noise (share of v0)", "estimated from listening"],
    ["PLUCK_VELOCITY", "Pluck: finger speed (m/s)", "estimated from listening"],
    ["PLUCK_DISPLACEMENT", "Pluck: pull (m at full)", "estimated from listening"],
    ["PLUCK_SECONDS", "Pluck: held (s)", "estimated from listening"],
    ["K_PLUCK", "Pluck: stiffness (N/m)"],
    ["R_PLUCK", "Pluck: damping (kg/s)"],
    ["PLUCK_WIDTH", "Pluck: width (m)"],
    ["FINGER_WIDTH", "Finger: width (m)"]
  ];
  for (const [key, label3, said2] of CONSTANTS) {
    const own2 = state.constants[key];
    dial("constants", key, label3, key === "A_noise" ? { min: 0, max: own2 * 10, value: own2, step: 1e-3, onchange: () => later(key, () => [{ do: "constant", name: key, value: value2[key] }]), note: said2 ? `Artifastring's ${own2}, ${said2}.` : void 0 } : { min: own2 / 10, max: own2 * 10, log: true, value: own2, onchange: () => later(key, () => [{ do: "constant", name: key, value: value2[key] }]), note: said2 ? `Artifastring's ${own2}, ${said2}.` : void 0 });
  }
  $("ownConstants").onclick = () => {
    for (const [key] of CONSTANTS) setters[key](state.constants[key], true);
    ask(CONSTANTS.map(([key]) => ({ do: "constant", name: key, value: state.constants[key] })));
  };
  dial("listening", "volume", "Volume (dB)", {
    min: -40,
    max: 40,
    value: 0,
    step: 0.5,
    onchange: () => later("gain", () => [{ do: "gain", gain: 10 ** ((heardDb() + value2.volume) / 20) }]),
    note: "0 dB: the instrument's neutral note at broadcast loudness (EBU R128). Louder or softer playing is heard louder or softer against it."
  });
  $("correcting").checked = state.corrected;
  dial("body", "corner", "Radiation falls under (Hz)", { min: 20, max: 1e3, log: true, value: cornerFor(state.corrected), onchange: () => {
    $("radiating").checked = true;
    later("radiate", () => [radiateAsk()]);
  } });
  $("radiating").onchange = $("falling").onchange = () => later("radiate", () => [radiateAsk()]);
  $("correcting").onchange = () => {
    setters.corner(cornerFor($("correcting").checked), true);
    later("correct", () => [correctAsk(), radiateAsk()]);
  };
  const limited = () => {
    limits();
    later("finger", () => [fingerAsk()]);
    bowed();
  };
  $("limitFingerboard").onchange = $("limitHair").onchange = limited;
  new EventSource("/strings/events").onmessage = (e) => {
    const [word, ...rest3] = e.data.split(" ");
    if (word === "level") {
      const db = Number(rest3[0]);
      $("meter").style.width = `${Number.isFinite(db) ? Math.max(0, Math.min(100, 100 + 100 * db / 60)) : 0}%`;
      $("level").textContent = Number.isFinite(db) ? `${db.toFixed(1)} dB of full scale (rms)` : "silent";
    } else if (word === "turn") {
      if (+rest3[0] === s) {
        direction = rest3[1] === "down" ? 1 : -1;
        way();
      }
    } else if (word === "runaway") $("said").textContent = `The model ran away at ${rest3[0]} s and was started again (a moment of silence).`;
    else if (word === "string" && arrived && !--arrived.left) {
      arrived.done();
      arrived = null;
    } else if (word === "modes") {
      inUse.modes[+rest3[0]] = +rest3[1];
      hairNote();
    } else if (word === "hair") {
      inUse.points[+rest3[0]] = +rest3[1];
      inUse.cellMm[+rest3[0]] = +rest3[2];
      hairNote();
    }
  };
  limits();
  showBuild();
  read();
  bodyNote();
  describe();
  await ask([{ do: "gain", gain: 10 ** (heardDb() / 20) }, fingerAsk(), radiateAsk(), ...builds.map((_, i) => buildAsk(i)), hairAsk(), ...noiseAsks()]);
  $("good").onclick = () => state.neutral ? neutral() : good();
  $("play").onclick = play;
  $("reverse").onclick = reverse;
  $("alternate").onchange = () => {
    if (bowing) ask([alternateAsk()]);
    read();
  };
  $("output").onclick = () => {
    bridge = !bridge;
    $("output").textContent = bridge ? "Hearing: the bridge force (no body)" : "Hearing: the instrument";
    ask([{ do: "output", bridge }]);
  };
  $("pluck").onclick = () => ask([{ do: "pluck", string: s, pos: value2.pluckPos * (1 - finger()), force: value2.pluckForce }]);
  $("ownBuild").onclick = () => {
    builds[s] = ownBuild(state.strings[s]);
    showBuild();
    ask([buildAsk()]);
    read();
    strings2();
  };
  $("variant").onchange = () => instrument(state.type, +$("variant").value);
  $("reseed").onclick = async () => {
    const seed2 = Math.round(+$("seed").value);
    if (seed2 >= 0) {
      await ask([{ do: "seed", seed: seed2 }]);
      state.seed = seed2;
      describe();
    }
  };
  $("keep").onclick = async () => {
    const r = await fetch("/strings/keep", { method: "POST", body: JSON.stringify({ words: $("words").value, ...settingsNow() }) });
    $("kept").textContent = r.ok ? ` kept (${(/* @__PURE__ */ new Date()).toLocaleTimeString()})` : ` not kept: ${await r.text()}`;
    if (r.ok) {
      $("words").value = "";
      kept2();
    }
  };
  kept2();
}
function settingsNow() {
  return {
    string: s,
    openHz: openHz(builds[s]),
    pitchSemitones: value2.pitch,
    finger: finger(),
    firmness: value2.firmness,
    damping: value2.damping,
    dampingNsPerM: value2.damping * state.finger.damping,
    beta: value2.beta,
    pos: pos(),
    force: value2.force,
    speed: value2.speed,
    direction,
    bowing,
    alternating: alternating(),
    strokeCm: value2.stroke,
    startSeconds: value2.start,
    endSeconds: value2.end,
    attack: { shape: $("attackFrom").value, force: forceCurve.get(), speed: speedCurve.get() },
    vibrato: $("vibrating").checked ? { widthCents: value2.width, rateHz: value2.rate } : null,
    build: builds[s],
    constants: Object.fromEntries(Object.keys(state.constants).map((key) => [key, value2[key]])),
    heard: bridge ? "bridge force" : "instrument",
    body: { corrected: $("correcting").checked, radiated: $("radiating").checked, cornerHz: value2.corner, order: +$("falling").value },
    limits: { fingerboard: fingerboard(), hair: hairLimited() },
    hairMm: value2.hair,
    noise: { player: value2.noisePlayer, ...Object.fromEntries(NOISE_KINDS.map(([kind]) => [kind, value2[noiseId(kind)]])) }
  };
}
async function kept2() {
  const all = (await (await fetch("/strings/kept", { cache: "no-store" })).json()).reverse();
  $("keptNone").style.display = all.length ? "none" : "";
  $("keptList").innerHTML = "";
  for (const k of all) {
    const row2 = document.createElement("tr"), open = k.openHz ? midiOf(k.openHz) : null;
    const what2 = [
      k.instrument,
      open != null && k.pitchSemitones != null ? name(open + k.pitchSemitones) : null,
      k.beta != null ? `β ${k.beta.toFixed(3)}` : null,
      k.force != null ? `${k.force.toFixed(2)} N` : null,
      k.speed != null ? `${k.speed.toFixed(3)} m/s` : null,
      k.strokeCm != null && k.alternating ? `${k.strokeCm.toFixed(1)} cm a stroke` : null,
      k.vibrato ? `vibrato ${k.vibrato.widthCents.toFixed(0)} ¢ at ${k.vibrato.rateHz.toFixed(2)} Hz` : null,
      k.heard === "bridge force" ? "bridge force" : null
    ].filter(Boolean).join(" · ");
    row2.innerHTML = `<td>${new Date(k.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td><b></b><br><span class="muted"></span></td><td><button>Load</button><button>Delete</button></td>`;
    row2.querySelector("b").textContent = k.words || "(no words)";
    row2.querySelector(".muted").textContent = what2;
    const [load3, forget] = row2.querySelectorAll("button");
    load3.onclick = () => recall(k);
    forget.onclick = async () => {
      if (!confirm(`Delete "${k.words || "(no words)"}"?`)) return;
      const r = await fetch("/strings/forget", { method: "POST", body: JSON.stringify({ at: k.at }) });
      if (!r.ok) $("said").textContent = await r.text();
      kept2();
    };
    $("keptList").append(row2);
  }
}
var forceCurve = null;
var speedCurve = null;
var riseOf = (points) => points.findIndex((p, k) => k && p[1] > 0);
var startOf = (points) => {
  const k = riseOf(points);
  return points[k][0] - points[k - 1][0];
};
var startingAt = (points, seconds) => segmentLasting(points, riseOf(points), seconds, LONGEST);
var ownForce = (points) => points.every((p) => p[1] === 1);
var ownSpeed = (points) => points.length === 2 && points[1][2] === "straight";
var asked = { force: null, speed: null };
function attackAsks() {
  const now = { force: ownForce(forceCurve.get()) ? null : forceCurve.get(), speed: ownSpeed(speedCurve.get()) ? null : speedCurve.get() };
  const asks = ["force", "speed"].filter((what2) => JSON.stringify(now[what2]) !== JSON.stringify(asked[what2])).map((what2) => ({ do: "attack", what: what2, points: now[what2] }));
  asked = now;
  return asks;
}
function shaped(name2) {
  const start = value2.start, a = state.attacks;
  if (name2 === "neutral" || !a) return { force: [[0, 1], [start, 1]], speed: [[0, 0], [start, 1, "straight"]] };
  if (name2 === "silence") return bowedAttack(a, { attack: start });
  const onset = a.articulations[name2];
  return bowedAttack(a, { attack: start, onset, bite: onset.bite });
}
function shape(name2) {
  const { force, speed } = shaped(name2);
  forceCurve.set(force);
  speedCurve.set(speed);
  $("attackFrom").value = name2;
  attackSaid();
}
function started() {
  const name2 = $("attackFrom").value;
  if (name2 === "drawn") speedCurve.set(startingAt(speedCurve.get(), value2.start));
  else shape(name2);
  later("attack", attackAsks);
}
function attackSaid() {
  if (!forceCurve || !builds[s]) return;
  const [ft, fy] = peakOf(forceCurve.get()), [vt, vy] = peakOf(speedCurve.get());
  $("attackSaid").textContent = `Its force at most ${(fy * value2.force).toFixed(2)} N (${fy.toFixed(2)}×, ${Math.round(1e3 * ft)} ms in), its speed at most ${(vy * value2.speed).toFixed(3)} m/s (${vy.toFixed(2)}×, ${Math.round(1e3 * vt)} ms in); settled ${Math.round(1e3 * Math.max(forceCurve.get().at(-1)[0], speedCurve.get().at(-1)[0]))} ms in.`;
}
function attackCurves() {
  const a = state.attacks;
  $("attackFrom").innerHTML = `<option value="neutral">as the neutral note is played: set down, drawn up to speed</option>` + (a ? `<option value="silence">the renders' attack from silence</option>` + Object.keys(a.articulations).map((n) => `<option value="${n}">the renders' ${n}</option>`).join("") : "") + `<option value="drawn" disabled>as drawn</option>`;
  $("attackNote").textContent = a ? `The renders' attacks as they play them at ${a.dynamic}: ${a.fitted ? `the ${state.name}'s fitted onset` : "the model's authored onset (physical-strings.js MODEL.onset; no onset fitted yet)"}, each over the stroke's start dialled. A note held quietly may need its attack to peak over what it settles at to start.` : "The renders' attacks come with the strings' server restarted.";
  const drawn = () => {
    $("attackFrom").value = "drawn";
    attackSaid();
    later("attack", attackAsks);
  };
  forceCurve = curveEditor($("forceCurve"), {
    kind: attackKind({ straight: true }),
    label: "Bow force at a stroke's start",
    color: "var(--strings)",
    change: drawn,
    meaning: (y2) => `${(y2 * value2.force).toFixed(2)} N`
  });
  speedCurve = curveEditor($("speedCurve"), {
    kind: attackKind({ from: 0, straight: true }),
    label: "Bow speed at a stroke's start",
    color: "var(--strings)",
    meaning: (y2) => `${(y2 * value2.speed).toFixed(3)} m/s`,
    change: (points) => {
      const start = startOf(points);
      if (Math.abs(start - value2.start) > 1e-6) {
        setters.start(start, true);
        if (bowing) later("alternate", () => [alternateAsk()]);
      }
      drawn();
    }
  });
  $("attackFrom").onchange = () => {
    shape($("attackFrom").value);
    later("attack", attackAsks);
  };
  shape("neutral");
}
var chosen = () => {
};
async function recall(k) {
  if (k.type != null && (k.type !== state.type || (k.variant ?? 0) !== state.variant)) {
    await instrument(k.type, k.variant ?? 0);
    chosen(INSTRUMENT_OF[k.type]);
  }
  if (k.string != null && k.string !== s && builds[k.string]) cross(k.string);
  const damping = Number.isFinite(k.dampingNsPerM) ? k.dampingNsPerM / state.finger.damping : k.damping * state.finger.artifastring / state.finger.damping;
  for (const [id, v] of [
    ["pitch", k.pitchSemitones],
    ["firmness", k.firmness],
    ["damping", damping],
    ["beta", k.beta],
    ["force", k.force],
    ["speed", k.speed],
    ["stroke", k.strokeCm],
    ["start", k.startSeconds],
    ["end", k.endSeconds]
  ]) if (Number.isFinite(v)) setters[id](v, true);
  if (k.alternating != null) $("alternate").checked = k.alternating;
  if (k.attack) {
    forceCurve.set(k.attack.force);
    speedCurve.set(k.attack.speed);
    $("attackFrom").value = k.attack.shape ?? "drawn";
    attackSaid();
  } else shape("neutral");
  $("vibrating").checked = Boolean(k.vibrato);
  if (k.vibrato) {
    setters.width(k.vibrato.widthCents, true);
    setters.rate(k.vibrato.rateHz, true);
  }
  if (k.build) {
    builds[s] = { ...builds[s], ...k.build };
    showBuild();
    strings2();
  }
  const constants = Object.entries(k.constants ?? {}).filter(([key, v]) => setters[key] && Number.isFinite(v));
  for (const [key, v] of constants) setters[key](v, true);
  setters.hair(Number.isFinite(k.hairMm) ? k.hairMm : 0, true);
  if (k.noise) noiseAt(k.noise.player, k.noise);
  else noiseAt(0);
  if (k.body) {
    $("radiating").checked = k.body.radiated;
    $("falling").value = String(k.body.order);
    if (Number.isFinite(k.body.cornerHz)) setters.corner(k.body.cornerHz, true);
  }
  const before = $("correcting").checked && k.body?.corrected == null;
  $("correcting").checked = k.body?.corrected ?? false;
  const past = [];
  if (fingerboard() && k.pitchSemitones > state.fingerboard) {
    $("limitFingerboard").checked = false;
    past.push("past the fingerboard's end");
  }
  if (hairLimited() && value2.beta * builds[s].L * (1 - finger()) < state.bow.hairWidth / 2) {
    $("limitHair").checked = false;
    past.push("with the bow nearer the bridge than half its hair's width");
  }
  limits();
  const asks = [fingerAsk(), dampingAsk(), vibratoAsk(), ...attackAsks(), ...k.build ? [buildAsk()] : [], ...constants.map(([name2, v]) => ({ do: "constant", name: name2, value: v })), correctAsk(), radiateAsk(), hairAsk(), ...noiseAsks()];
  if (bowing) asks.push(alternateAsk(), bowAsk());
  await ask(asks);
  read();
  $("said").textContent = [
    past.length ? `This setting plays ${past.join(" and ")}: switched off under The hands' reach to play it.` : "",
    before ? "Kept before bodies were corrected: heard as it was then, uncorrected (switch it on under Instrument)." : "",
    k.noise ? "" : "Kept before the hands' noise: heard as it was then, without it.",
    Number.isFinite(k.dampingNsPerM) || !Number.isFinite(k.damping) ? "" : "Kept before the finger's measured damping: its stopping finger heard as it was then, Artifastring's own."
  ].filter(Boolean).join(" ");
}
async function good() {
  const p = state.pick, st = p.start, was = bowing;
  if (bowing) play();
  if (state.variant !== p.variant && p.variant < state.variants[state.instrument]) await instrument(state.type, p.variant);
  if (st.string !== s && builds[st.string]) cross(st.string);
  builds = state.strings.map((k2, i) => ({ ...ownBuild(k2), modes: builds[i]?.modes ?? state.mostModes }));
  showBuild();
  strings2();
  const k = state.strings[s], q = p.string, own2 = state.type === p.type || !q;
  const force = own2 ? st.force : st.force * Math.sqrt(k.T * k.pl) / Math.sqrt(q.T * q.pl) * (k.mus - k.mud) / (q.mus - q.mud);
  const set = {
    pitch: -12 * Math.log2(1 - st.finger),
    firmness: 1,
    damping: 1,
    beta: st.pos / (1 - st.finger),
    force,
    speed: st.speed,
    stroke: Math.min(100 * state.bow.length, 100 * st.drawn),
    start: st.startSeconds,
    end: state.bow.endSeconds,
    width: state.vibrato.width,
    rate: state.vibrato.rate,
    corner: cornerFor(true),
    volume: 0,
    ...state.constants
  };
  for (const [id, v] of Object.entries(set)) if (setters[id] && Number.isFinite(v)) setters[id](v, true);
  direction = st.direction;
  $("alternate").checked = true;
  $("vibrating").checked = false;
  $("correcting").checked = true;
  $("radiating").checked = true;
  $("falling").value = "2";
  bridge = false;
  $("output").textContent = "Hearing: the instrument";
  limits();
  noiseAt(1);
  shape("neutral");
  await ask([
    { do: "seed", seed: p.seed },
    ...builds.map((_, i) => buildAsk(i)),
    ...Object.entries(state.constants).map(([name2, v]) => ({ do: "constant", name: name2, value: v })),
    fingerAsk(),
    dampingAsk(),
    vibratoAsk(),
    ...attackAsks(),
    { do: "gain", gain: 10 ** (heardDb() / 20) },
    { do: "output", bridge: false },
    correctAsk(),
    radiateAsk(),
    hairAsk(),
    ...noiseAsks()
  ]);
  state.seed = p.seed;
  $("seed").value = p.seed;
  describe();
  read();
  way();
  if (was) await play();
  $("said").textContent = own2 ? "" : `A good note made from the ${INSTRUMENT_OF[p.type]}'s: the same bowing at the same place on Schelleng's diagram, ${force.toFixed(2)} N here.`;
}
var begun = null;
var taking = Promise.resolve();
var placed = /* @__PURE__ */ new Set();
async function neutral() {
  const n = state.neutral, was = bowing;
  if (bowing) play();
  if (state.variant !== n.variant) await instrument(state.type, n.variant);
  if (n.string !== s && builds[n.string]) cross(n.string);
  builds = state.strings.map((k, i) => ({ ...ownBuild(k), modes: builds[i]?.modes ?? state.mostModes }));
  showBuild();
  strings2();
  const set = {
    pitch: n.stop,
    firmness: 1,
    damping: 1,
    beta: n.contact,
    force: n.force,
    speed: n.speed,
    stroke: 100 * state.bow.length,
    start: n.attack,
    end: state.bow.endSeconds,
    width: state.vibrato.width,
    rate: state.vibrato.rate,
    corner: cornerFor(true),
    volume: 0,
    ...state.constants
  };
  for (const [id, v] of Object.entries(set)) if (setters[id] && Number.isFinite(v)) setters[id](v, true);
  $("alternate").checked = true;
  $("vibrating").checked = false;
  $("correcting").checked = true;
  $("radiating").checked = true;
  $("falling").value = "2";
  bridge = false;
  $("output").textContent = "Hearing: the instrument";
  limits();
  noiseAt(1);
  shape("neutral");
  await ask([
    ...builds.map((_, i) => buildAsk(i)),
    ...Object.entries(state.constants).map(([name2, v]) => ({ do: "constant", name: name2, value: v })),
    fingerAsk(),
    dampingAsk(),
    vibratoAsk(),
    ...attackAsks(),
    { do: "gain", gain: 10 ** (heardDb() / 20) },
    { do: "output", bridge: false },
    correctAsk(),
    radiateAsk(),
    hairAsk(),
    ...noiseAsks()
  ]);
  describe();
  read();
  way();
  if (was) await play();
  $("said").textContent = "";
}
var neutralSaid = (n) => `its neutral note (${n.dynamic}, ${name(n.pitch)} on its ${["first", "second", "third", "fourth", "fifth", "sixth"][n.string] ?? `${n.string + 1}th`} string, ${+n.force.toPrecision(3)} N at ${+n.speed.toPrecision(3)} m/s, settling in ${n.settlesMs} ms${n.withinLimit ? "" : ` -- none of its notes within listeners' ${state.neutralLimitMs} ms`}; the neutral-note fit's ${n.rehearsal ? "rehearsal " : ""}map, round ${n.round})`;
function take(model2, { status: status2, choose: choose2 }) {
  chosen = choose2 ?? chosen;
  return taking = taking.catch(() => {
  }).then(async () => {
    begun ??= init(status2);
    await begun.catch((error) => {
      begun = null;
      throw error;
    });
    const type = INSTRUMENT_OF.indexOf(model2);
    if (type < 0) throw new Error(`no ${model2} among the strings`);
    status2.classList.remove("failed");
    if (type !== state.type || !placed.has(type)) {
      status2.textContent = `Taking up the ${model2.replace(/-/g, " ")} ...`;
      if (type !== state.type) await instrument(type, 0);
      await (state.neutral ? neutral() : good());
      placed.add(type);
    }
    status2.textContent = `The ${state.name}, ready: heard through ${state.heardThrough}, on ` + (state.neutral ? neutralSaid(state.neutral) : `its good note${type === state.pick.type ? " (the note it started from)" : " (the violin's note, bowed at the same place on Schelleng's diagram)"}`) + ".";
    describe();
  }).catch((error) => {
    status2.classList.add("failed");
    status2.textContent = `The strings could not take up the ${model2}: ${error.message}`;
  });
}
$("soloSeed").value = DEFAULT_SEED;
var musebot = musebotControls({ box: $("personality"), seed: $("soloSeed"), seconds: $("soloSeconds") });
var following = null;
$("solo").onclick = async () => {
  if (!state) return;
  const on = !state.soloist?.playing;
  if (on) {
    if (bowing) play();
    $("soloSaid").textContent = "Its band composes the piece ...";
  }
  const r = await fetch("/strings/soloist", { method: "POST", body: JSON.stringify(on ? { on, ...musebot.given() } : { on }) });
  if (!r.ok) {
    $("soloSaid").textContent = await r.text();
    return;
  }
  state = { ...state, ...await r.json() };
  soloShown();
  follow();
};
async function follow() {
  clearTimeout(following);
  state = await (await fetch("/strings/state", { cache: "no-store" })).json();
  soloShown();
  if (state.soloist?.playing) following = setTimeout(follow, 500);
}
var minutes = (x2) => `${Math.floor(x2 / 60)}:${String(Math.floor(x2 % 60)).padStart(2, "0")}`;
function soloShown() {
  const playing = Boolean(state.soloist?.playing), said2 = state.soloist?.said, tone = said2?.personality?.tone;
  $("solo").textContent = playing ? "■ Stop the musebot" : "▶ A musebot plays";
  $("solo").classList.toggle("on", playing);
  musebot.show(state.player, said2?.personality);
  if (!said2) return;
  $("soloSaid").textContent = `${said2.player} on the ${state.name}, seed ${said2.seed}: ${playing ? "" : "played "}${minutes(Math.min(said2.at, said2.seconds))} of ${minutes(said2.seconds)}, ${said2.notes} notes` + (said2.late ? `; ${said2.late} lines came late` : "") + (said2.personality ? `; its register ${name(said2.personality.register[0])} to ${name(said2.personality.register[1])}` : "") + (tone ? `; its tone ${said2.personality.levers.tone.toFixed(2)}: ${tone.kinds.length ? `${tone.kinds.join(", ")} in ${Math.round(100 * tone.share)}% of phrases` : "no techniques"}, vibrato ${tone.vibrato[0].toFixed(1)} to ${tone.vibrato[1].toFixed(1)} × its players'` : "") + ".";
}
async function settings() {
  await taking.catch(() => {
  });
  if (!state) throw new Error("no instrument yet");
  const model2 = INSTRUMENT_OF[state.type];
  return {
    model: model2,
    settings: { family: "strings", model: model2, type: state.type, variant: state.variant, seed: state.seed, ...settingsNow(), player: musebot.given() },
    words: $("words").value,
    heard: { through: bridge ? "bridge force" : "instrument", bowing, said: $("listening").textContent }
  };
}
async function load(file) {
  await taking.catch(() => {
  });
  if (!state) throw new Error("no instrument yet");
  const k = file.settings;
  if (Number.isInteger(k.seed) && k.seed !== state.seed) {
    await ask([{ do: "seed", seed: k.seed }]);
    state.seed = k.seed;
    describe();
  }
  await recall(k);
  if (file.words) $("words").value = file.words;
  const refused = [];
  if (k.player) {
    const r = await fetch("/strings/player", { method: "POST", body: JSON.stringify(k.player) });
    if (r.ok) {
      state = { ...state, ...await r.json() };
      soloShown();
    } else refused.push({ path: "/player", error: await r.text() });
  }
  return { made: "every one", refused };
}
function rest() {
  if (bowing) play();
  if (state?.soloist?.playing) fetch("/strings/soloist", { method: "POST", body: JSON.stringify({ on: false }) }).then(follow);
}
function keys(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") {
    e.preventDefault();
    play();
  } else if (e.key === "r") reverse();
  else if (e.key === "p") $("pluck").click();
}

// native/live/winds.js
var winds_exports = {};
__export(winds_exports, {
  keys: () => keys2,
  load: () => load2,
  rest: () => rest2,
  settings: () => settings2,
  take: () => take2
});

// registry/sources.json
var sources_default = {
  schema: "musebots.registry-sources/1",
  about: "Every source a registry value cites, once (registry/README.md). literature: a published measurement or standard, its DOI checked with Crossref where it has one; vernacular: a maker's chart, a retailer's page, players' common knowledge, looked up, with the page and a saved copy; other: Printables, a dataset, an engine's own data, a CT, with where it is and its licence. Saved copies are in the trunk's research-downloads/.",
  sources: {
    "fletcher-rossing-1998": { kind: "literature", authors: "N. H. Fletcher, T. D. Rossing", title: "The Physics of Musical Instruments", year: 1998, doi: "10.1007/978-0-387-21603-4", edition: "2nd", publisher: "Springer" },
    "weinzierl-2017": { kind: "literature", authors: "S. Weinzierl, M. Vorländer, G. Behler, F. Brinkmann, H. von Coler, E. Detzner, J. Krämer, A. Lindau, M. Pollow, F. Schulz, N. R. Shabtai", title: "A Database of Anechoic Microphone Array Measurements of Musical Instruments", year: 2017, doi: "10.14279/depositonce-5861.2", url: "https://depositonce.tu-berlin.de/handle/11303/6305.2", note: "a published dataset, its DOI checked on DataCite (not on Crossref); its recordings in the trunk's research-downloads/tu-berlin-anechoic/, read by native/openwind/turbulence-fit.mjs and tools/sound_power_table.py" },
    "fletcher-1975": { kind: "literature", authors: "N. H. Fletcher", title: "Acoustical correlates of flute performance technique", year: 1975, doi: "10.1121/1.380430", in: "The Journal of the Acoustical Society of America 57(1), 233-237", note: "its laws as render/synthesis/workers/openwind_worker.py quotes them; the paper not yet fetched (research/SOURCES_TO_FETCH.md)" },
    "fletcher-1964": { kind: "literature", authors: "H. Fletcher", title: "Normal Vibration Frequencies of a Stiff Piano String", year: 1964, doi: "10.1121/1.1918933", in: "JASA 36(1), 203-209" },
    "schelleng-1973": { kind: "literature", authors: "J. C. Schelleng", title: "The bowed string and the player", year: 1973, doi: "10.1121/1.1913322", in: "JASA 53(1), 26-41" },
    "schoonderwaldt-2009": { kind: "literature", authors: "E. Schoonderwaldt", title: "The player and the bowed string: Coordination of bowing parameters in violin and viola performance", year: 2009, doi: "10.1121/1.3203209", in: "JASA 126(5), 2709-2720" },
    "schoonderwaldt-guettler-askenfelt-2003": { kind: "literature", authors: "E. Schoonderwaldt, K. Guettler, A. Askenfelt", title: "Effect of the width of the bow hair on the violin string spectrum", year: 2003, in: "Proceedings of the Stockholm Music Acoustics Conference (SMAC 03), Stockholm", saved: "research-downloads/strings/bow-hair/schoonderwaldt-guettler-askenfelt-2003-smac-bow-width.pdf", noDoi: "conference proceedings: none found at Crossref (29 October 2026)" },
    "guettler-askenfelt-1997": { kind: "literature", authors: "K. Guettler, A. Askenfelt", title: "Acceptance limits for the duration of pre-Helmholtz transients in bowed string attacks", year: 1997, doi: "10.1121/1.418520", in: "JASA 101(5), 2903-2913" },
    "iso-16-1975": { kind: "literature", authors: "International Organization for Standardization", title: "ISO 16:1975 Acoustics -- Standard tuning frequency (Standard musical pitch)", year: 1975, standard: "ISO 16:1975" },
    "iso-3382-1-2009": { kind: "literature", authors: "International Organization for Standardization", title: "ISO 3382-1:2009 Acoustics -- Measurement of room acoustic parameters -- Part 1: Performance spaces", year: 2009, standard: "ISO 3382-1:2009" },
    "nist-sp811-2008": { kind: "literature", authors: "A. Thompson, B. N. Taylor", title: "Guide for the Use of the International System of Units (SI), NIST Special Publication 811", year: 2008, doi: "10.6028/NIST.SP.811e2008" },
    "physics-factbook-steel": { kind: "vernacular", who: 'G. Elert (ed.), The Physics Factbook: K. Sutherland 2004, "Density of Steel", a compilation of handbook values', url: "https://hypertextbook.com/facts/2004/KarenSutherland.shtml", accessed: "2026-10-27", saved: "research-downloads/physics/physics-factbook-density-of-steel.html" },
    "dadario-helicore-orchestral-bass": { kind: "vernacular", who: "D'Addario, the maker: Helicore orchestral double bass strings' tension chart (H611-H614, 3/4 medium)", url: null, accessed: null, saved: "research-downloads/strings/double-bass-strings/helicore-orchestral-bass-tension-chart.png", note: "its page and the date it was read were not recorded when it was saved (October 2026)" },
    "vsco2-ce": { kind: "other", who: "Versilian Studios, VSCO 2 Community Edition: orchestral samples, its contrabass's pizzicati among them", url: "https://versilian-studios.com/vsco-community/", licence: "CC0 1.0", note: "the recordings our fits read a bass's strings' stiffness and decays from (native/strings-model/string_tail.py --plucked)" },
    "rosa-size-chart": { kind: "vernacular", who: 'Rosa Musical Instrument, a retailer: its violin, viola and cello size chart ("approximate sizing and measurements; exact size will vary from maker to maker")', url: "https://www.rosamusicalinstrument.com/blogs/blog/violin-viola-cello-size-chart", accessed: "2026-10-27" },
    "simplyforstrings-bass-bows": { kind: "vernacular", who: `Simply for Strings, a retailer: "French and German double bass bows, what's the difference"`, url: "https://simplyforstrings.com.au/blogs/news/french-and-german-double-bass-bows-whats-the-difference", accessed: "2026-10-27" },
    "thomann-rjb-bass-bow-review": { kind: "vernacular", who: `Thomann, a retailer: a player's review (Baur, 28 March 2021) of the Roth & Junius RJB carbon bass bow 4/4 F -- "Bow total length: 72.5 cm", "Length of the working hair area: 57.5 cm" ("These are the parameters of my bow! You may have differences")`, url: "https://www.thomannmusic.com/roth_junius_rjb_carbon_bass_bow_4_4f_bk_reviews.htm", accessed: "2026-10-29" },
    artifastring: { kind: "other", who: `G. Percival, Artifastring, the bowed-string engine we play on: its strings' constants (constants/strings_<instrument>.h, made by its make-constants.py; each mode's decay calculated by its mode-detect/all-modes.py from recordings), and its bodies' measured impulse responses; Percival's thesis, 2013, University of Glasgow, "Physical modelling meets machine learning: performing music with a virtual string ensemble"`, url: "https://github.com/gperciva/artifastring", licence: "GPL-3.0-or-later" },
    "rayleigh-1896": { kind: "literature", authors: "J. W. Strutt (Lord Rayleigh)", title: "The Theory of Sound, vol. 2 (on the conductivity of apertures)", year: 1896, edition: "2nd", publisher: "Macmillan", noDoi: "a book of 1896, before DOIs" },
    "nia-2015": { kind: "literature", authors: "H. T. Nia, A. D. Jain, Y. Liu, M.-R. Alam, R. Barnas, N. C. Makris", title: "The evolution of air resonance power efficiency in the violin and its ancestors", year: 2015, doi: "10.1098/rspa.2014.0905", in: "Proc. R. Soc. A 471, 20140905" },
    "bellows-nakayama-2024": { kind: "literature", authors: "S. D. Bellows, D. Nakayama", title: "An investigation of the f-hole shape's influence on the modal response of the violin", year: 2024, doi: "10.1051/aacus/2024074", in: "Acta Acustica 8, 67" },
    "goldblatt-specs": { kind: "vernacular", who: "A. Goldblatt, luthier: his specification sheets for the violin, viola, cello and bass (4/4 violin and cello, a 16-16.5 in viola, a 3/4 bass)", url: "alangoldblatt.com/specs.html", accessed: "2026-10-17", saved: "research-downloads/strings/body-measurements/" },
    "vsl-academy-violin": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the violin's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/violin", accessed: "2026-10-29" },
    "vsl-academy-viola": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the viola's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/viola", accessed: "2026-10-29" },
    "vsl-academy-cello": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the cello's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/cello", accessed: "2026-10-29" },
    "vsl-academy-double-bass": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the double bass's page (its strings, compass and notation)", url: "https://www.vsl.co.at/academy/strings/double-bass", accessed: "2026-10-29" },
    "galluzzo-2004": { kind: "literature", authors: "P. M. Galluzzo", title: "On the playability of stringed instruments (PhD thesis, University of Cambridge)", year: 2004, doi: "10.17863/CAM.14046", saved: "research-downloads/strings/bowed-friction-papers/galluzzo-2004-thesis-playability.pdf", note: "a DataCite DOI, checked there: section 4.2.3, the waveform identification" },
    "lampis-2024": { kind: "literature", authors: "A. Lampis, A. Mayer, V. Chatziioannou", title: "An experimental approach for comparing the influence of cello string type on bowed attack response", year: 2024, doi: "10.1121/10.0034330", in: "JASA Express Letters 4, 113201", saved: "research-downloads/strings/lampis-2024-cello-string-attack-jasael.pdf" },
    "geringer-allen-2004": { kind: "literature", authors: "J. M. Geringer, M. L. Allen", title: "An Analysis of Vibrato among High School and University Violin and Cello Students", year: 2004, doi: "10.2307/3345438", in: "Journal of Research in Music Education 52(2), 167-178" },
    "allen-geringer-macleod-2009": { kind: "literature", authors: "M. L. Allen, J. M. Geringer, R. B. MacLeod", title: "Performance Practice of Violin Vibrato: An Artist-Level Case Study", year: 2009, doi: "10.1177/1948499209OS-400103", in: "String Research Journal os-4(1), 27-38" },
    "macleod-2008": { kind: "literature", authors: "R. B. MacLeod", title: "Influences of Dynamic Level and Pitch Register on the Vibrato Rates and Widths of Violin and Viola Players", year: 2008, doi: "10.1177/0022429408323070", in: "Journal of Research in Music Education 56(1), 43-54" },
    "geringer-allen-macleod-2005": { kind: "literature", authors: "J. M. Geringer, M. L. Allen, R. B. MacLeod", title: "Initial Movement and Continuity in Vibrato among High School and University String Players", year: 2005, doi: "10.1177/002242940505300306", in: "Journal of Research in Music Education 53(3), 248-259" },
    "mick-2024": { kind: "literature", authors: "J. P. Mick", title: "An Analysis of Double Bass Vibrato", year: 2024, doi: "10.1177/19484992241238989", in: "String Research Journal 15(1), 55-72" },
    "prame-1994": { kind: "literature", authors: "E. Prame", title: "Measurements of the vibrato rate of ten singers", year: 1994, doi: "10.1121/1.410141", in: "JASA 96(4), 1979-1984" },
    "prame-1997": { kind: "literature", authors: "E. Prame", title: "Vibrato extent and intonation in professional Western lyric singing", year: 1997, doi: "10.1121/1.419735", in: "JASA 102(1), 616-621", saved: "research-downloads/expression/from-owner-2026-10-25/616_1_online.pdf" },
    "mellody-wakefield-2000": { kind: "literature", authors: "M. Mellody, G. H. Wakefield", title: "The time-frequency characteristics of violin vibrato: Modal distribution analysis and synthesis", year: 2e3, doi: "10.1121/1.428326", in: "JASA 107(1), 598-611", saved: "research-downloads/expression/from-owner-2026-10-25/598_1_online.pdf" },
    "hu-2025": { kind: "literature", authors: "S. Hu, S. H. Kim, H. H. Kim, H. Mackay, E. J. Heller", title: "Influence of string register locations on vibratos among violoncellists", year: 2025, doi: "10.48550/arXiv.2512.18162", in: "arXiv:2512.18162 (a preprint; its data and code doi:10.5281/zenodo.17712642)" },
    "box-muller-1958": { kind: "literature", authors: "G. E. P. Box, M. E. Muller", title: "A Note on the Generation of Random Normal Deviates", year: 1958, doi: "10.1214/aoms/1177706645", in: "The Annals of Mathematical Statistics 29(2), 610-611" },
    "friberg-1991": { kind: "literature", authors: "A. Friberg", title: "Generative Rules for Music Performance: A Formal Description of a Rule System", year: 1991, doi: "10.2307/3680917", in: "Computer Music Journal 15(2), from p. 56" },
    "friberg-bresin-sundberg-2006": { kind: "literature", authors: "A. Friberg, R. Bresin, J. Sundberg", title: "Overview of the KTH rule system for musical performance", year: 2006, doi: "10.2478/v10053-008-0052-x", in: "Advances in Cognitive Psychology 2(2), 145-161" },
    "dannenberg-2006": { kind: "literature", authors: "R. B. Dannenberg", title: "The Interpretation of MIDI Velocity", year: 2006, in: "Proceedings of the International Computer Music Conference 2006 (New Orleans), 193-196", noDoi: "the ICMC's proceedings have none: the University of Michigan's Quod holds them, hdl:2027/spo.bbp2372.2006.042" },
    "brick-orchestration-notes": { kind: "vernacular", who: "A. Brick, composer and conductor: HMU 397A Orchestration, Class Notes 1a (Stevens Institute of Technology)", url: "https://personal.stevens.edu/~abrick/orchestration1/files/HMU397_notes_01a.html", accessed: "2026-10-29" },
    "musicaustria-atmospheres": { kind: "vernacular", who: "mica - music austria, its database's entry for Ligeti's Atmosphères (Universal Edition): its Orchestercode", url: "https://db.musicaustria.at/print/pdf/node/125570", accessed: "2026-10-29" },
    "boosey-pithoprakta": { kind: "vernacular", who: "Boosey & Hawkes, the publisher: its page for Xenakis's Pithoprakta, its scoring", url: "https://www.boosey.com/cr/music/Iannis-Xenakis-Pithoprakta/3078", accessed: "2026-10-29" },
    "pamies-vila-hofmann-chatziioannou-2018": { kind: "literature", authors: "M. Pàmies-Vilà, A. Hofmann, V. Chatziioannou", title: "Analysis of Tonguing and Blowing Actions During Clarinet Performance", year: 2018, doi: "10.3389/fpsyg.2018.00617", in: "Frontiers in Psychology 9, 617", saved: "research-downloads/winds/pamies-vila-2018-tonguing-blowing.pdf" },
    "fritz-wolfe-2005": { kind: "literature", authors: "C. Fritz, J. Wolfe", title: "How do clarinet players adjust the resonances of their vocal tracts for different playing effects?", year: 2005, doi: "10.1121/1.2041287", in: "The Journal of the Acoustical Society of America 118(5), 3306-3315", saved: "research-downloads/winds/vocal-tract/fritz-wolfe-2005-clarinet-vocal-tract.pdf" },
    "chen-smith-wolfe-2009": { kind: "literature", authors: "J.-M. Chen, J. Smith, J. Wolfe", title: "Pitch bending and glissandi on the clarinet: Roles of the vocal tract and partial tone hole closure", year: 2009, doi: "10.1121/1.3177269", in: "The Journal of the Acoustical Society of America 126(3), 1511-1520", saved: "research-downloads/winds/vocal-tract/chen-smith-wolfe-2009-clarinet-pitch-bending.pdf" },
    "wiertlewski-hayward-2012": { kind: "literature", authors: "M. Wiertlewski, V. Hayward", title: "Transducer for mechanical impedance testing over a wide frequency range through active feedback", year: 2012, doi: "10.1063/1.3683572", in: "Review of Scientific Instruments 83(2), 025001", saved: "research-downloads/strings/finger/wiertlewski-hayward-2012-transducer-impedance-rsi.pdf" },
    "hennig-2011": { kind: "literature", authors: "H. Hennig, R. Fleischmann, A. Fredebohm, Y. Hagmayer, J. Nagler, A. Witt, F. J. Theis, T. Geisel", title: "The Nature and Perception of Fluctuations in Human Musical Rhythms", year: 2011, doi: "10.1371/journal.pone.0026457", in: "PLoS ONE 6(10), e26457", saved: "research-downloads/performer-noise/hennig-2011-fluctuations-human-musical-rhythms.pdf" },
    "mcauley-marsden-2000": { kind: "literature", authors: "J. H. McAuley, C. D. Marsden", title: "Physiological and pathological tremors and rhythmic central motor control", year: 2e3, doi: "10.1093/brain/123.8.1545", in: "Brain 123(8), 1545-1567", read: "its abstract (PubMed 10908186)" }
  }
};

// registry/physics/constants.json
var constants_default = {
  schema: "musebots.registry-constants/1",
  about: "The physical constants and units the physics is computed with, each with its source (registry/README.md).",
  constants: {
    a4: { value: 440, unit: "Hz", kind: "literature", source: "iso-16-1975", note: "the standard tuning frequency, A above middle C: MIDI 69" },
    "t60-db": { value: 60, unit: "dB", kind: "literature", source: "iso-3382-1-2009", note: "a reverberation time's fall: the time a sound takes to decay by 60 dB" },
    milli: { value: 1e3, unit: "1", kind: "literature", source: "nist-sp811-2008", note: "SI's milli: thousandths in one (ms in a second)" },
    "pound-force": { value: 4.4482216152605, unit: "N/lbf", kind: "literature", source: "nist-sp811-2008", note: "one pound-force in newtons, exactly" },
    "steel-density": { value: 7850, range: [7600, 8e3], unit: "kg/m^3", kind: "vernacular", source: "physics-factbook-steel", note: "the handbooks' steels span the range; 7850 the value engineers take (490 lb/ft^3). A wound string's stiffness enters the models only as E d^4, so its d is taken as the steel cylinder of its density and E what gives its measured stiffness" }
  }
};

// registry/physics/equations.json
var equations_default = {
  schema: "musebots.registry-equations/1",
  about: "Every equation a registry value is derived or passed down by (registry/README.md): its formula, its inputs and output with their units, its source, and checks -- inputs and the value they give -- that both implementations (registry/equations.js, registry/equations.py) are tested on. A statistic over measurements (a median, a mean) is an equation too, its choice ours and said so.",
  equations: {
    "midi-hz": { formula: "f = a4 2^((midi - 69) / 12)", inputs: { midi: "MIDI note (semitones, fractional allowed)", a4: "Hz" }, unit: "Hz", source: "iso-16-1975", checks: [{ inputs: { midi: 69, a4: 440 }, value: 440 }, { inputs: { midi: 28, a4: 440 }, value: 41.20344461410875 }] },
    "pounds-newtons": { formula: "T = pounds pound-force", inputs: { pounds: "lbf", poundForce: "N/lbf" }, unit: "N", source: "nist-sp811-2008", checks: [{ inputs: { pounds: 70, poundForce: 4.4482216152605 }, value: 311.37551306823497 }] },
    "string-density": { formula: "mu = T / (2 L f0)^2 (Mersenne: f0 = sqrt(T / mu) / 2L)", inputs: { T: "N", L: "m", f0: "Hz" }, unit: "kg/m", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 311.37551306823497, L: 1.06, f0: 41.20344461410875 }, value: 0.04080803518983858 }] },
    "string-impedance": { formula: "Z0 = sqrt(T mu)", inputs: { T: "N", mu: "kg/m" }, unit: "kg/s", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 100, mu: 0.01 }, value: 1 }] },
    "inharmonicity-at-open": { formula: "B = median(takes) / 2^(2 stopped / 12): a stopped note's B read at the open string's length (B goes as 1/L^2)", inputs: { takes: "B of each take, at the note played", stopped: "semitones above the open string the takes were played at" }, unit: "1", source: "fletcher-1964", statistic: "the median of the takes: ours", checks: [{ inputs: { takes: [572e-7, 955e-7], stopped: 0 }, value: 7635e-8 }, { inputs: { takes: [208e-6, 207e-6], stopped: 1 }, value: 1848614840141204e-19 }] },
    "stiffness-from-inharmonicity": { formula: "EI = B T L^2 / pi^2 (B = pi^2 EI / (T L^2))", inputs: { B: "1", T: "N", L: "m" }, unit: "N m^2", source: "fletcher-1964", checks: [{ inputs: { B: 1e-4, T: 300, L: 1 }, value: 0.0030396355092701336 }] },
    "cylinder-diameter": { formula: "d = sqrt(4 mu / (pi rho))", inputs: { mu: "kg/m", rho: "kg/m^3" }, unit: "m", source: "fletcher-rossing-1998", checks: [{ inputs: { mu: 0.04080803518983858, rho: 7850 }, value: 0.002572723262777005 }] },
    "young-from-stiffness": { formula: "E = 64 EI / (pi d^4)", inputs: { EI: "N m^2", d: "m" }, unit: "Pa", source: "fletcher-rossing-1998", checks: [{ inputs: { EI: 1e-3, d: 1e-3 }, value: 203718327157626e-4 }] },
    mean: { formula: "the mean of its values", inputs: { values: "a list" }, unit: "as its values", source: null, statistic: "ours: each take weighed alike", checks: [{ inputs: { values: [1.42, 0.479] }, value: 0.9495 }] },
    same: { formula: "x = value: a value taken as another's", inputs: { value: "as the value" }, unit: "as its value", source: null, statistic: "an identity", checks: [{ inputs: { value: 1.06 }, value: 1.06 }] },
    "mersenne-f0": { formula: "f0 = sqrt(T / mu) / 2L", inputs: { T: "N", mu: "kg/m", L: "m" }, unit: "Hz", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 31.5, mu: 195e-5, L: 0.325 }, value: 195.53504901607462 }] },
    "cylinder-stiffness": { formula: "EI = E pi d^4 / 64", inputs: { E: "Pa", d: "m" }, unit: "N m^2", source: "fletcher-rossing-1998", checks: [{ inputs: { E: 2e9, d: 97e-5 }, value: 8691341838037078e-20 }] },
    "inharmonicity-of-stiffness": { formula: "B = pi^2 EI / (T L^2)", inputs: { EI: "N m^2", T: "N", L: "m" }, unit: "1", source: "fletcher-1964", checks: [{ inputs: { EI: 8691341838037078e-20, T: 31.5, L: 0.325 }, value: 2578156645997943e-19 }] },
    "elliptic-aperture-conductance": { formula: "C = 1 / (1 / (2 a AGM(1, b/a)) + t / (pi a b)): an elliptic aperture's conductance in a thin wall, semi-axes a over b (Rayleigh's pi a / K(e), K the complete elliptic integral of the first kind, pi / (2 AGM(1, b/a))), a wall of thickness t in series", inputs: { a: "m (or any length, alike)", b: "as a", t: "as a" }, unit: "as a", source: "rayleigh-1896", checks: [{ inputs: { a: 5, b: 5, t: 0 }, value: 10 }, { inputs: { a: 37.5, b: 3.25, t: 3 }, value: 24.747881684832045 }] },
    "f-holes-conductance": { formula: "K = 2 C(fLength / 2, fWidth / 2, fThickness): a body's two f-holes, each an elliptic aperture its length by its least width through the top about it", inputs: { fLength: "mm", fWidth: "mm", fThickness: "mm" }, unit: "mm", source: "nia-2015", checks: [{ inputs: { fLength: 75, fWidth: 6.5, fThickness: 3 }, value: 49.49576336966409 }] },
    "body-air-volume": { formula: "V = body (upper + middle + lower) / 3 (ribs + (archTop + archBack) / 2): the outline, its length by its three widths' mean, over the ribs' height and half of each arching, a dome's", inputs: { body: "mm", upper: "mm", middle: "mm", lower: "mm", ribs: "mm", archTop: "mm", archBack: "mm" }, unit: "mm^3", source: null, statistic: "ours: a body's shape as a box with domes, its walls, f-holes' wings and outline's shape left out alike", checks: [{ inputs: { body: 356, upper: 168, middle: 112, lower: 208, ribs: 30.75, archTop: 16, archBack: 15 }, value: 2678306666666667e-9 }] },
    "fingerboard-end-semitones": { formula: "12 log2(string / (string - fingerboard)): where the string meets the fingerboard's end, in semitones over the open string", inputs: { string: "mm", fingerboard: "mm" }, unit: "semitones", source: "fletcher-rossing-1998", checks: [{ inputs: { string: 328, fingerboard: 270 }, value: 29.99485211388614 }] },
    "helmholtz-ratio": { formula: "sqrt((K / V) / (K0 / V0)): a Helmholtz resonator's frequency over another's (f = c / 2pi sqrt(K / V)), each its conductance over its volume", inputs: { K: "conductance", V: "volume, in the conductance's length cubed", K0: "the other's conductance", V0: "the other's volume" }, unit: "1", source: "rayleigh-1896", checks: [{ inputs: { K: 4, V: 1, K0: 1, V0: 1 }, value: 2 }] },
    least: { formula: "the least of its values", inputs: { values: "a list" }, unit: "as its values", source: null, statistic: "an identity", checks: [{ inputs: { values: [3, 1, 2] }, value: 1 }] },
    ratio: { formula: "a / b", inputs: { a: "any", b: "as a" }, unit: "1", source: null, statistic: "an identity", checks: [{ inputs: { a: 102, b: 51 }, value: 2 }] },
    "lowest-hz": { formula: "f = a4 2^((min(tuning) - 69) / 12): an instrument's lowest open string's frequency", inputs: { tuning: "its open strings, MIDI", a4: "Hz" }, unit: "Hz", source: "iso-16-1975", checks: [{ inputs: { tuning: [43, 28, 33, 38], a4: 440 }, value: 41.20344461410875 }] },
    "loss-table": { formula: "each of a measured string's modes, its frequency n f0 sqrt(1 + B n^2) with its stiffness (B = pi^3 E d^4 / (64 T L^2)) and its measured decay, its first `modes` of them: a string's losses by frequency, read between their points", inputs: { decays: "1/s, each mode's", modes: "how many of them stand", f0: "Hz", E: "Pa", d: "m", T: "N", L: "m" }, unit: "[Hz, 1/s] pairs", source: "fletcher-1964", checks: [{ inputs: { decays: [0.5, 1, 2], modes: 2, f0: 100, E: 2e9, d: 1e-3, T: 50, L: 0.33 }, value: [[100.00889718130146, 0.5], [200.07116795461067, 1]] }] },
    "table-read": { formula: "y at x in a table of [x, y] points: its first y below its first point, read in a line between the points about x, and past its last two by their line", inputs: { table: "[x, y] pairs, x rising", x: "as the table's x" }, unit: "as the table's y", source: null, statistic: "ours: linear between measured points", checks: [{ inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 50 }, value: 1 }, { inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 150 }, value: 2 }, { inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 500 }, value: 4.5 }] },
    "string-loss-law": { formula: "r = r0 + r2 f^2: a string's mode's decay at its frequency", inputs: { r0: "1/s", r2: "s", f: "Hz" }, unit: "1/s", source: null, checks: [{ inputs: { r0: 1, r2: 1e-6, f: 100 }, value: 1.01 }], statistic: "ours: the form our fits gave the contrabass's losses (native/strings-model/string_tail.py --plucked)" },
    "scale-ratio": { formula: "a / a0: a quantity over the reference's", inputs: { a: "any", a0: "as a" }, unit: "1", source: null, statistic: "an identity", checks: [{ inputs: { a: 1.6, a0: 1 }, value: 1.6 }] },
    "least-force-scale": { formula: "scale Z[0]^2 / mean(c0^2, c1^2, c2^2): a bow's force scale passed from another instrument's by Schelleng's least force, which grows as a string's wave impedance squared -- its lowest string's against the reference's lowest strings', each of its versions", inputs: { scale: "the reference's force scale", Z: "its strings' impedances, lowest first, kg/s", c0: "the reference's lowest string's impedance, its version 0", c1: "its version 1", c2: "its version 2" }, unit: "1", source: "schelleng-1973", checks: [{ inputs: { scale: 1.6, Z: [3.565, 2.632], c0: 1.85, c1: 1.66, c2: 1.39 }, value: 7.52192054449952 }] },
    "periods-in": { formula: "n = seconds hz: how many periods of a frequency fit in a time", inputs: { seconds: "s", hz: "Hz" }, unit: "periods", source: null, statistic: "an identity", checks: [{ inputs: { seconds: 0.6, hz: 196 }, value: 117.6 }] },
    "seconds-for": { formula: "t = max(least, periods / hz): a note's time to hold so many periods of its frequency, never under the least", inputs: { periods: "periods", hz: "Hz", least: "s" }, unit: "s", source: null, statistic: "an identity", checks: [{ inputs: { periods: 117.6, hz: 41.2, least: 0.6 }, value: 2.8543689320388346 }, { inputs: { periods: 117.6, hz: 440, least: 0.6 }, value: 0.6 }] },
    "finger-place": { formula: "x = 1 - 2^(-semitones / 12): the share of a string from its nut a finger stops to sound so many semitones over its open pitch (an ideal string's frequency goes as one over its sounding length)", inputs: { semitones: "semitones over the open string" }, unit: "share of the string", source: "fletcher-rossing-1998", checks: [{ inputs: { semitones: 7 }, value: 0.3325800729149828 }, { inputs: { semitones: 12 }, value: 0.5 }] },
    "log-grid": { formula: "x_k = least span^(k / (count - 1)), k = 0 .. count - 1: so many values evenly spaced in their logarithm from the least to the least times the span", inputs: { least: "as its values", span: "1", count: "values" }, unit: "as least", source: null, statistic: "an identity", checks: [{ inputs: { least: 0.05, span: 250, count: 4 }, value: [0.05, 0.3149802624737183, 1.984251314960249, 12.5] }] },
    "semitones-ratio": { formula: "r = 2^(semitones / 12): the frequency ratio of an interval in equal-tempered semitones (fractional allowed)", inputs: { semitones: "semitones" }, unit: "1", source: null, statistic: "a definition (twelve equal semitones to the octave)", checks: [{ inputs: { semitones: 7 }, value: 1.4983070768766815 }, { inputs: { semitones: 12 }, value: 2 }] },
    "ratio-semitones": { formula: "s = 12 log2(r): an interval's size in equal-tempered semitones from its frequency ratio", inputs: { ratio: "1" }, unit: "semitones", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 1.5 }, value: 7.019550008653875 }, { inputs: { ratio: 2 }, value: 12 }] },
    "place-semitones": { formula: "s = -12 log2(1 - place): the semitones over its open pitch a finger sounds at this share of an ideal string from its nut (finger-place's inverse)", inputs: { place: "share of the string" }, unit: "semitones", source: "fletcher-rossing-1998", checks: [{ inputs: { place: 0.25 }, value: 4.980449991346125 }, { inputs: { place: 0.5 }, value: 12 }] },
    "cents-semitones": { formula: "s = cents / 100: cents as semitones", inputs: { cents: "cents" }, unit: "semitones", source: null, statistic: "a definition (a hundred cents to the equal-tempered semitone)", checks: [{ inputs: { cents: 50 }, value: 0.5 }] },
    "from-centi": { formula: "x = centi / 100: a quantity given in hundredths of its unit (cm, cm/s) in its unit", inputs: { centi: "hundredths of the unit" }, unit: "the unit", source: null, statistic: "a definition (SI's centi)", checks: [{ inputs: { centi: 250 }, value: 2.5 }] },
    "db-gain": { formula: "g = 10^(db / 20): an amplitude's ratio from its level's change in decibels", inputs: { db: "dB" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { db: 6 }, value: 1.9952623149688795 }, { inputs: { db: 20 }, value: 10 }] },
    "loss-ratio-for": { formula: "k = ln(10^(db / 20)) / (rate seconds): how many times its own loss rate (1/s) brings a decaying amplitude down db decibels in seconds", inputs: { db: "dB", rate: "1/s, its own", seconds: "s" }, unit: "1", source: null, statistic: "an identity (an exponential decay)", checks: [{ inputs: { db: 60, rate: 2, seconds: 0.5 }, value: 6.907755278982137 }] },
    "helmholtz-force-scale": { formula: "x = F beta / (2 Z v): a bow's force against the string's Helmholtz force at its contact and speed -- Schelleng's scale of bow force", inputs: { force: "N", contact: "share of the string from the bridge", Z: "kg/s, the string's characteristic impedance", speed: "m/s" }, unit: "1", source: "schelleng-1973", checks: [{ inputs: { force: 1, contact: 0.1, Z: 0.5, speed: 0.2 }, value: 0.5 }] },
    "amplitude-db": { formula: "L = 20 log10(ratio): a ratio of amplitudes in decibels", inputs: { ratio: "1, of amplitudes" }, unit: "dB", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 10 }, value: 20 }, { inputs: { ratio: 2 }, value: 6.020599913279624 }] },
    "likelihood-residual": { formula: "r = sqrt(max(0, -2 log p)): a probability's residual in a least-squares cost r^2 / 2, which is then its negative log-likelihood", inputs: { logp: "the probability's natural logarithm" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { logp: -2 }, value: 2 }, { inputs: { logp: 0 }, value: 0 }, { inputs: { logp: 1e-17 }, value: 0 }] },
    "power-db": { formula: "L = 10 log10(ratio): a ratio of powers in decibels", inputs: { ratio: "1, of powers" }, unit: "dB", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 100 }, value: 20 }, { inputs: { ratio: 2 }, value: 3.010299956639812 }] },
    "helmholtz-rise": { formula: "x = 2 Z v t / (beta T): the bridge force's rise under Helmholtz motion over a time t, its sawtooth climbing 2 Z v / beta each period T and falling as much at the flyback (t = T: the flyback's drop)", inputs: { Z: "kg/s, the string's characteristic impedance", speed: "m/s, the bow's", beta: "share of the string from the bridge", period: "s", t: "s" }, unit: "N", source: "galluzzo-2004", checks: [{ inputs: { Z: 1.09, speed: 0.1, beta: 0.1, period: 0.01, t: 0.01 }, value: 2.18 }, { inputs: { Z: 0.5, speed: 1, beta: 0.2, period: 4e-3, t: 1e-3 }, value: 1.25 }] },
    "semitones-octaves": { formula: "o = s / 12: an interval's octaves from its semitones", inputs: { semitones: "semitones" }, unit: "octaves", source: null, statistic: "a definition (the semitone a twelfth of an octave)", checks: [{ inputs: { semitones: 12 }, value: 1 }, { inputs: { semitones: 5.13 }, value: 0.4275 }] },
    "golden-section": { formula: "g = (sqrt(5) - 1) / 2: the golden ratio's inverse, the share of its interval a golden-section search keeps each step", inputs: {}, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: {}, value: 0.6180339887498949 }] },
    "parabola-peak": { formula: "d = (a - c) / (2 (a - 2 b + c)) where a - 2 b + c < 0, else 0: the peak of the parabola through three equally spaced values a, b, c, as its offset from the middle one in spacings (none where it does not peak)", inputs: { left: "1", middle: "1", right: "1" }, unit: "spacings", source: null, statistic: "an identity (a parabola's vertex)", checks: [{ inputs: { left: 0.5, middle: 1, right: 0.7 }, value: 0.12499999999999997 }, { inputs: { left: 1, middle: 0, right: 1 }, value: 0 }] },
    sawtooth: { formula: "x = 2 frac(f0 t) - 1: a sawtooth rising from -1 to 1 each period, falling back at once", inputs: { t: "s", f0: "Hz" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { t: 0.3, f0: 1 }, value: -0.4 }, { inputs: { t: 1.7, f0: 3 }, value: -0.8000000000000007 }] },
    "cents-ratio": { formula: "r = 2^(cents / 1200): the frequency ratio of an interval in cents", inputs: { cents: "cents" }, unit: "1", source: null, statistic: "a definition (twelve hundred cents to the octave)", checks: [{ inputs: { cents: 1200 }, value: 2 }, { inputs: { cents: -20 }, value: 0.9885140203528962 }] },
    "normal-deviate": { formula: "z = sqrt(-2 ln max(u, 1e-12)) cos(2 pi v): a standard normal deviate from two uniform ones in [0, 1) (u floored, so a draw of 0 gives a finite deviate)", inputs: { u: "1", v: "1" }, unit: "1", source: "box-muller-1958", statistic: "a transformation (Box & Muller)", checks: [{ inputs: { u: 0.5, v: 0 }, value: 1.1774100225154747 }, { inputs: { u: 0, v: 0.5 }, value: -7.4338443776996765 }] },
    "hz-midi": { formula: "midi = 69 + 12 log2(f / a4): a frequency as a MIDI note, midi-hz's inverse", inputs: { hz: "Hz", a4: "Hz" }, unit: "MIDI note (semitones, fractional)", source: "iso-16-1975", checks: [{ inputs: { hz: 440, a4: 440 }, value: 69 }, { inputs: { hz: 41.20344461410875, a4: 440 }, value: 28 }] }
  }
};

// registry/modules.json
var modules_default = {
  schema: "musebots.registry-modules/1",
  about: "The modules whose values are the registry's (registry/README.md): an owned module holds no number about an instrument, a player, the physics or a method -- the registry's test reads it -- and a pending one is still to move, listed in REGISTRY.md.",
  owned: ["public/shared/performers/contrabass.js", "public/shared/performers/string-bodies.js", "public/shared/performers/bowed-instruments.js", "public/shared/performers/physical-strings.js", "public/shared/performers/sound-power.js", "native/strings-model/engine.mjs", "public/shared/performers/bowed-line.js", "public/shared/performers/bow.js", "native/strings-model/attack_transient.py", "native/strings-model/probe.py", "native/strings-model/schelleng.py", "native/strings-model/noise_profile.py", "native/strings-model/regions.py", "native/strings-model/neutral.py", "native/strings-model/fit_bowing.py", "native/strings-model/fit_player.py", "native/strings-model/fit_loop.py", "native/strings-model/fit_onsets.py", "public/shared/float-wav.js", "public/bots/lib/modules/section-seat.js", "public/shared/performers/string-section.js", "public/shared/performers/personality.js", "public/shared/performers/turbulence.js"],
  pending: ["public/shared/performers/vibrato.js", "public/shared/performers/instrument-ranges.js"]
};

// registry/objects/bowed.json
var bowed_default = {
  schema: "musebots.registry-objects/1",
  about: "The bowed string instruments as a tree of types (registry/README.md): what is true of every bowed string at the top -- each string's pitch, density, impedance and stiffness from what was measured of it, by the physics' equations -- and below, each instrument's own. A value a node does not give is its parent's; `strings.*` a rule for each of a node's strings, read with that string's own values.",
  nodes: {
    instrument: {
      is: null,
      abstract: true,
      about: "Any instrument a player plays: the root of the tree, what every family shares."
    },
    "bowed-string-instrument": {
      is: "instrument",
      abstract: true,
      about: "An instrument whose strings are bowed: made of its strings (a set of strings, a part of its own), its body and its bow."
    },
    "violin-family": {
      is: "bowed-string-instrument",
      abstract: true,
      about: "The violin, viola, cello and contrabass, and an instrument made like them.",
      values: {
        tuning: { kind: "derived", derive: { equation: "same", inputs: { value: "strings.*.pitch" } }, unit: "MIDI", note: "its open strings, lowest first: its strings' pitches where it gives none" },
        lowestHz: { kind: "derived", derive: { equation: "lowest-hz", inputs: { tuning: "tuning", a4: "constant:a4" } }, unit: "Hz" },
        bow: {
          stringsAtOnce: { value: 2, unit: "strings", kind: "vernacular", source: "vsl-academy-violin", note: `the bridge's curvature and the bow's tension make it "not possible to sound more than two strings at the same time": a triple or quadruple stop arpeggiated (the violin's page; the family's bridges alike arched)` },
          hairWidth: { value: 0.01, unit: "m", kind: "unmeasured", reason: "the violin bow's measured width taken for every bow of the family: no viola, cello or bass bow's ribbon found measured (its rehairers set it by the bow's mortise and ferrule, bow by bow)", searched: [{ where: "web search", query: "bow hair ribbon width mm violin viola cello double bass", date: "2026-10-29", found: "retailers' bow lengths, weights and hair lengths; a museum bass bow's head 21.2 mm wide (University of Edinburgh MIMEd 17331); no ribbon width" }, { where: "web search", query: "bow ferrule width mm violin cello bass hair ribbon width rehair specification", date: "2026-10-29", found: "a violin ribbon 10 to 12 mm by its ferrule (violinist.com forum); Arcus's hair cross-sections by bow, mm2 (violin 5-8, cello 9-13, bass 11-16), not widths; no larger bow's ribbon width" }] }
        },
        engine: {
          solver: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "lowestHz", take: "@id" }, unit: "Artifastring instrument", note: "the bowed-string engine plays it on the solver and rates of the measured instrument whose lowest open string is nearest its own (itself where it is one)" },
          bodyFrom: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "body.airMode", take: "@id" }, unit: "Artifastring instrument", note: "the measured body nearest it in its lowest air mode (itself where it is one), stretched in time to its own: interim, until its own is fitted" },
          bodyRatio: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "body.airMode", take: { equation: "ratio", inputs: { a: "body.airMode" }, here: { b: "body.airMode" } } }, unit: "1", note: "how much longer in time the borrowed body's responses are played: its air mode over this one's" }
        }
      }
    },
    violin: {
      is: "violin-family",
      about: "The violin, 4/4: Artifastring's three (its constants' first sets), each a version a seat plays.",
      parts: {
        strings: "violin-strings",
        body: "violin-body"
      },
      values: {
        compass: { value: [55, 105], unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "stopped notes, sounding: G3 - A7" },
        harmonicCeiling: { value: 110, unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "the highest harmonic: harmonic D8" },
        register: { value: [60, 88], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-violin's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range G3 - A7 (harmonic D8): no register a line keeps to" }] },
        tuning: { value: [55, 62, 69, 76], unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 74.9, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size bow, 29.5 in" },
          hairWidth: { value: 0.01, unit: "m", kind: "literature", source: "schoonderwaldt-guettler-askenfelt-2003", note: "a violin bow's hair across the string, about 10 mm" },
          hairLength: { value: 0.65, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "violin.0": {
      is: "violin",
      about: "The violin a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.0"
      }
    },
    "violin.1": {
      is: "violin",
      about: "The violin a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.1"
      }
    },
    "violin.2": {
      is: "violin",
      about: "The violin a seat's version 2 plays: Artifastring's string set 2 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.2"
      }
    },
    viola: {
      is: "violin-family",
      about: "The viola, 16-16.5 in: Artifastring's three.",
      parts: {
        strings: "viola-strings",
        body: "viola-body"
      },
      values: {
        compass: { value: [48, 93], unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "stopped notes, sounding: C3 - A6" },
        harmonicCeiling: { value: 100, unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "the highest harmonic: harmonic E7" },
        register: { value: [53, 81], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-viola's page", query: "its range and where it is mainly played", date: "2026-10-29", found: `the page's range C3 - A6 (harmonic E7); "mainly between C3 and G5": no register a line keeps to but the viola's 'mainly'` }] },
        tuning: { value: [48, 55, 62, 69], unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 74.3, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size viola bow, 29.25 in (the chart rounds it to 75 cm)" },
          hairLength: { value: 0.66, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "viola.0": {
      is: "viola",
      about: "The viola a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.0"
      }
    },
    "viola.1": {
      is: "viola",
      about: "The viola a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.1"
      }
    },
    "viola.2": {
      is: "viola",
      about: "The viola a seat's version 2 plays: Artifastring's string set 0 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.0"
      }
    },
    cello: {
      is: "violin-family",
      about: "The cello, 4/4: Artifastring's three.",
      parts: {
        strings: "cello-strings",
        body: "cello-body"
      },
      values: {
        compass: { value: [36, 81], unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "stopped notes, sounding: C2 - A5" },
        harmonicCeiling: { value: 105, unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "the highest harmonic: harmonic A7" },
        register: { value: [41, 72], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-cello's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range C2 - A5 (harmonic A7): no register a line keeps to" }] },
        tuning: { value: [36, 43, 50, 57], unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 71.1, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size bow, 28 in" },
          hairLength: { value: 0.62, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "cello.0": {
      is: "cello",
      about: "The cello a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.0"
      }
    },
    "cello.1": {
      is: "cello",
      about: "The cello a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.1"
      }
    },
    "cello.2": {
      is: "cello",
      about: "The cello a seat's version 2 plays: Artifastring's string set 2 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.2"
      }
    },
    contrabass: {
      is: "violin-family",
      about: "The orchestral double bass, 3/4, tuned in fourths: its strings D'Addario's Helicore orchestral, its stiffness and losses read from another bass's recorded pizzicati (its strings not known to be Helicores).",
      parts: {
        strings: "contrabass-strings",
        body: "contrabass-body"
      },
      values: {
        compass: { value: [28, 67], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: "stopped notes, sounding: B0 - G4 sounding with five strings, from E1 with four" },
        harmonicCeiling: { value: 91, unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: "the highest harmonic: harmonic G6" },
        register: { value: [31, 55], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-double-bass's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range B0 - G4 sounding with five strings, from E1 with four (harmonic G6): no register a line keeps to" }] },
        writtenToSounding: { value: -12, unit: "semitones", kind: "vernacular", source: "vsl-academy-double-bass", note: '"written an octave higher than it sounds in bass clef"' },
        bow: {
          length: { value: 70, unit: "cm", kind: "vernacular", source: "simplyforstrings-bass-bows", note: "a French student bass bow, 70 cm (a German, 74)" },
          hairLength: { value: 0.575, unit: "m", kind: "vernacular", source: "thomann-rjb-bass-bow-review", note: "one player's 4/4 French bass bow, 72.5 cm long, its working hair 57.5 cm: no maker's or paper's found (the searches on the violin's)" }
        }
      }
    },
    "contrabass-five-string": {
      is: "contrabass",
      about: "The double bass with a fifth string a fourth under its four (VSL Academy): its compass and tuning its own; the rest the four-string's -- its body, its bow, its four upper strings, its register, its harmonics and its notation. Its low B string unmeasured; the engine plays only the four-string.",
      values: {
        compass: { value: [23, 67], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: 'stopped notes, sounding: "Range of the double-bass: B0 - G4 (harmonic G6)"' },
        tuning: { value: [23, 28, 33, 38, 43], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: '"On five-stringed instruments: B0 (C1), E1, A1, D2, G2": its lowest B0, as the compass' }
      }
    },
    "made-up-tenor": {
      is: "violin-family",
      fictional: true,
      about: "A made-up four-string instrument between the viola and the cello, tuned in fifths from F2: the pipeline's test, none of it any real instrument's (bowed-instruments.json).",
      parts: {
        strings: "made-up-tenor-strings",
        body: "made-up-tenor-body"
      }
    },
    "bowed-string-set": {
      is: null,
      abstract: true,
      about: "A set of strings for a bowed instrument: each string's pitch, impedance, stiffness and inharmonicity from its tension, density, length, modulus and diameter, by the physics' equations -- a rule for each of its strings, read with that string's own values.",
      values: {
        "*": {
          f0: { kind: "derived", derive: { equation: "mersenne-f0", inputs: { T: "{}.tension", mu: "{}.density", L: "{}.length" } }, unit: "Hz" },
          impedance: { kind: "derived", derive: { equation: "string-impedance", inputs: { T: "{}.tension", mu: "{}.density" } }, unit: "kg/s" },
          stiffness: { kind: "derived", derive: { equation: "cylinder-stiffness", inputs: { E: "{}.young", d: "{}.diameter" } }, unit: "N m^2" },
          inharmonicity: { kind: "derived", derive: { equation: "inharmonicity-of-stiffness", inputs: { EI: "{}.stiffness", T: "{}.tension", L: "{}.length" } }, unit: "1" }
        }
      }
    },
    "strings-by-pitch": {
      is: "bowed-string-set",
      abstract: true,
      about: "A set of strings given by their pitches, tensions and length (a maker's chart, a spec): each string's frequency from its pitch, its density from its tension, length and frequency, the steel cylinder of that density and the modulus that gives its stiffness.",
      values: {
        "*": {
          f0: { kind: "derived", derive: { equation: "midi-hz", inputs: { midi: "{}.pitch", a4: "constant:a4" } }, unit: "Hz" },
          length: { kind: "derived", derive: { equation: "same", inputs: { value: "length" } }, unit: "m" },
          density: { kind: "derived", derive: { equation: "string-density", inputs: { T: "{}.tension", L: "{}.length", f0: "{}.f0" } }, unit: "kg/m" },
          diameter: { kind: "derived", derive: { equation: "cylinder-diameter", inputs: { mu: "{}.density", rho: "constant:steel-density" } }, unit: "m", note: "the steel cylinder of the string's density, not a wound string's outer diameter: only E d^4 enters the model" },
          young: { kind: "derived", derive: { equation: "young-from-stiffness", inputs: { EI: "{}.stiffness", d: "{}.diameter" } }, unit: "Pa" }
        }
      }
    },
    "given-strings": {
      is: "strings-by-pitch",
      abstract: true,
      about: "A set of strings given as data, nobody's measured: each string's stiffness and losses like the measured string nearest its pitch.",
      values: {
        "*": {
          stiffness: { kind: "borrowed", like: { candidates: ["violin-strings.0", "viola-strings.0", "cello-strings.0"], keys: true, match: "{}.f0", take: "{}.stiffness" }, unit: "N m^2", note: "the measured string nearest its pitch (Artifastring's first sets), the same string at its own length and tension: its stiffness EI" },
          losses: { kind: "borrowed", like: { candidates: ["violin-strings.0", "viola-strings.0", "cello-strings.0"], keys: true, match: "{}.f0", take: { equation: "loss-table", inputs: { decays: "{}.decays", modes: "{}.modes", f0: "{}.f0", E: "{}.young", d: "{}.diameter", T: "{}.tension", L: "{}.length" } } }, unit: "[Hz, 1/s] pairs", note: "that string's measured decays by frequency, read between them at its own modes (the contrabass's law r0 + r2 f^2, fitted to them, had left the first mode decaying at 46 to 51 /s where the measured strings' decay at 0.4 to 2)" }
        }
      }
    },
    "contrabass-strings": {
      is: "strings-by-pitch",
      about: "The contrabass's strings, D'Addario Helicore orchestral 3/4 medium, as measured: their pitches, tensions and length from the maker's chart, their stiffness and losses fitted to another bass's recorded pizzicati -- and from those, by the equations, their density, inharmonicity, stiffness, the steel cylinder of their density and the modulus that gives that stiffness, and their losses' law r0 + r2 f^2.",
      values: {
        length: { value: 1.06, unit: "m", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "the chart's 3/4 playing length, 1060 mm" },
        "*": {
          tension: { kind: "derived", derive: { equation: "pounds-newtons", inputs: { pounds: "{}.tensionPounds", poundForce: "constant:pound-force" } }, unit: "N" },
          inharmonicity: { kind: "derived", derive: { equation: "inharmonicity-at-open", inputs: { takes: "{}.inharmonicityTakes.values", stopped: "{}.inharmonicityTakes.stopped" } }, unit: "1" },
          stiffness: { kind: "derived", derive: { equation: "stiffness-from-inharmonicity", inputs: { B: "{}.inharmonicity", T: "{}.tension", L: "{}.length" } }, unit: "N m^2" },
          lossR0: { kind: "derived", derive: { equation: "mean", inputs: { values: "{}.lossTakes.r0" } }, unit: "1/s" },
          lossR2: { kind: "derived", derive: { equation: "mean", inputs: { values: "{}.lossTakes.r2" } }, unit: "s" }
        },
        E1: {
          pitch: { value: 28, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, E1" },
          tensionPounds: { value: 70, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H614, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [572e-7, 955e-7], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 0, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the open E played", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [1.42, 0.479], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [277e-8, 603e-8], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        A1: {
          pitch: { value: 33, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, A1" },
          tensionPounds: { value: 69, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H613, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [405e-6, 189e-7, 503e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 1, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the A played a semitone up", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [0.877, 2.24], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [826e-8, 98e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        D2: {
          pitch: { value: 38, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, D2" },
          tensionPounds: { value: 65.9, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H612, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [308e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 0, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the open D played", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [0.56], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: its one standing take fitted r0 below zero, -0.366, its first partial's own decay 0.62/s: r0 that decay less r2 f0^2", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [103e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        G2: {
          pitch: { value: 43, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, G2" },
          tensionPounds: { value: 62, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H611, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [208e-6, 207e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 1, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the G played a semitone up", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [1.41, 1.7], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [603e-8, 66e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        }
      }
    },
    "bowed-body": {
      is: null,
      abstract: true,
      about: "A bowed instrument's body: its air as a Helmholtz resonator -- the air inside its outline and its two f-holes' conductance -- and where its fingerboard ends, from a luthier's measurements of it.",
      values: {
        volume: { kind: "derived", derive: { equation: "body-air-volume", inputs: { body: "body", upper: "upper", middle: "middle", lower: "lower", ribs: "ribs", archTop: "archTop", archBack: "archBack" } }, unit: "mm^3" },
        holes: { kind: "derived", derive: { equation: "f-holes-conductance", inputs: { fLength: "fLength", fWidth: "fWidth", fThickness: "fThickness" } }, unit: "mm" },
        fingerboardEnd: { kind: "derived", derive: { equation: "fingerboard-end-semitones", inputs: { string: "string", fingerboard: "fingerboard" } }, unit: "semitones" },
        airMode: { value: 280, unit: "Hz", kind: "literature", source: "bellows-nakayama-2024", note: "the violin's lowest air mode (A0), about 280 Hz; 270-290 Hz in J. Jackson's Strad3D survey (strad3d.org/st_5.html)", measuredOn: ["violin-body"], passes: { by: "helmholtz-ratio", inputs: { K: "holes", V: "volume" }, reference: "violin-body", searched: [{ where: "web search", query: "measured A0 air resonance frequency Hz viola cello double bass Helmholtz cavity mode measurement", date: "2026-10-29", found: "the violin's only (270-290 Hz); a patent places the bass's A0 below its B1 near 100 Hz, no number; leads in SOURCES_TO_FETCH.md" }] } }
      }
    },
    "violin-body": {
      is: "bowed-body",
      about: "The violin's body, 4/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 356, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 168, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 112, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 208, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 30.75, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 30-31.5, its middle" },
        archTop: { value: 16, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        archBack: { value: 15, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fLength: { value: 75, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 6.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 3, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 270, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 328, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "viola-body": {
      is: "bowed-body",
      about: "The viola's body, 16-16.5 in, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 415, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 193, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 130, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 238, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 39.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 38-41, its middle" },
        archTop: { value: 17.9, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 17.5-18.3, its middle" },
        archBack: { value: 17.15, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 16.5-17.8, its middle" },
        fLength: { value: 88, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 7, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 3.1, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 311, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 371.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 368-375, its middle" }
      }
    },
    "cello-body": {
      is: "bowed-body",
      about: "The cello's body, 4/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 745, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 340, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 240, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 440, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 117.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 115-120, its middle" },
        archTop: { value: 29, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        archBack: { value: 28, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fLength: { value: 140, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 11, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 5, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 580, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 690, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "contrabass-body": {
      is: "bowed-body",
      about: "The contrabass's body, 3/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 1110, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 501, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 384, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 674, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 183.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "its ribs taller at the saddle than at the neck: 122-185 at the neck, 200-227 at the saddle, the middles' mean" },
        archTop: { value: 43, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 35-51, its middle" },
        archBack: { value: 0, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: 'its back flat ("very low")' },
        fLength: { value: 219, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 17, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 7, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 850, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 1060, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "made-up-tenor-body": {
      is: "bowed-body",
      fictional: true,
      about: "The made-up tenor's body, as its spec gives it (fictional).",
      values: {
        body: { value: 560, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        upper: { value: 256, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        middle: { value: 177, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        lower: { value: 324, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        ribs: { value: 68, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        archTop: { value: 23, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        archBack: { value: 22, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fLength: { value: 111, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fWidth: { value: 8.8, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fThickness: { value: 3.9, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fingerboard: { value: 425, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        string: { value: 506, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" }
      }
    },
    "made-up-tenor-strings": {
      is: "given-strings",
      fictional: true,
      about: "The made-up tenor's strings, as its spec gives them (fictional).",
      values: {
        length: { value: 0.506, unit: "m", kind: "unmeasured", reason: "fictional: its spec" },
        F2: {
          pitch: { value: 41, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 90, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        C3: {
          pitch: { value: 48, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 80, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        G3: {
          pitch: { value: 55, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 72, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        D4: {
          pitch: { value: 62, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 85, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        }
      }
    },
    "lampis-2024-g-strings": {
      is: null,
      about: "The bowing robot's cello G strings (Lampis, Mayer & Chatziioannou 2024; their bowed responses, Zenodo 2025, doi:10.5281/zenodo.17749110, CC BY 4.0): each string type's transverse impedance as they measured it on their monochord -- the real strings the model's Schelleng diagrams are held to.",
      values: {
        A: {
          impedance: { value: 1.09, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "D'Addario Prelude" }
        },
        B: {
          impedance: { value: 1.12, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Helicore" }
        },
        C: {
          impedance: { value: 0.85, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Thomastik Dominant" }
        },
        D: {
          impedance: { value: 1.13, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Kaplan" }
        }
      }
    }
  }
};

// registry/objects/artifastring-strings.json
var artifastring_strings_default = {
  schema: "musebots.registry-objects/1",
  about: "Artifastring's strings (G. Percival), every set of each instrument's, made by registry/import/artifastring.mjs from the engine's constants: do not edit them here.",
  nodes: {
    "violin-strings": {
      is: "bowed-string-set",
      about: "The violin's strings as Artifastring measured them: every quantity's range across its 5 sets.",
      values: {
        G3: {
          tension: { range: [31.5, 60.9], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.32, 0.326], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [628e-6, 97e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [195e-5, 386e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [2e9, 216e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.63, 0.706], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.21, 0.334], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.085, 0.305], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [0.01424, 0.01487], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [56, 72], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        D4: {
          tension: { range: [41, 69.6], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.317, 0.325], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [668e-6, 88e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [118e-5, 193e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [437e7, 216e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.584, 0.718], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.202, 0.32], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.09, 0.299], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [1002e-6, 128e-5], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [48, 80], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        A4: {
          tension: { range: [49.5, 73.8], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.317, 0.326], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [573e-6, 748e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [602e-6, 905e-6], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [678e7, 239e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.594, 0.711], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.208, 0.338], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.084, 0.298], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [5882e-7, 7051e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [72, 80], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        E5: {
          tension: { range: [64.8, 107.4], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.319, 0.327], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [252e-6, 33e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [36e-5, 6e-4], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [92e9, 199e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.636, 0.677], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.214, 0.331], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.088, 0.293], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [2659e-7, 3436e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [104, 104], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        }
      }
    },
    "violin-strings.0": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 0.",
      values: {
        G3: {
          tension: { value: 31.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 97e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 195e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 2e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.654, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.301, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.305, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01487, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6849, 2.013, 2.047, 4.102, 6.38, 9.652, 10.02, 11.47, 16.27, 20.1, 24.39, 29.12, 34.3, 39.93, 46.02, 52.55, 59.54, 66.97, 74.86, 83.2, 91.98, 101.2, 110.9, 121.1, 131.6, 142.7, 154.2, 166.1, 178.5, 191.4, 204.7, 218.4, 232.6, 247.2, 262.3, 277.9, 293.9, 310.3, 327.2, 344.6, 362.4, 380.6, 399.3, 418.5, 438.1, 458.1, 478.7, 499.6, 521, 542.9, 565.2, 587.9, 611.1, 634.8, 658.9, 683.5, 708.5, 734, 759.9, 786.2, 813, 840.3, 868, 896.2, 924.8, 953.9, 983.4, 1013, 1044, 1075, 1106, 1138, 1170, 1203, 1236, 1269, 1303, 1338, 1373, 1408, 1444, 1480, 1517, 1554, 1592, 1630, 1668, 1707, 1747, 1787, 1827, 1868, 1909, 1951, 1993, 2035, 2079, 2122, 2166, 2210, 2255, 2300, 2346, 2392, 2439, 2486, 2534, 2582, 2630, 2679, 2728, 2778, 2828, 2879, 2930, 2982, 3034, 3086, 3139, 3193, 3247, 3301, 3356, 3411, 3467, 3523, 3579, 3636], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 56, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.319, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 88e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 161e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 437e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.707, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.317, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.299, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 128e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.687, 3.559, 6.104, 8.224, 10.32, 12.99, 13.99, 25.31, 18.52, 28.68, 34.38, 40.68, 47.58, 55.09, 63.19, 71.89, 81.19, 91.1, 101.6, 112.7, 124.4, 136.7, 149.6, 163.1, 177.2, 191.9, 207.2, 223.1, 239.6, 256.8, 274.5, 292.8, 311.7, 331.2, 351.3, 372, 393.3, 415.2, 437.7, 460.8, 484.5, 508.8, 533.7, 559.3, 585.4, 612.1, 639.4, 667.3, 695.8, 724.9, 754.6, 784.9, 815.8, 847.4, 879.5, 912.2, 945.5, 979.4, 1014, 1049, 1085, 1121, 1158, 1195, 1234, 1272, 1312, 1352, 1392, 1433, 1475, 1517, 1560, 1604, 1648, 1692, 1738, 1784, 1830, 1877, 1925, 1973, 2022, 2072, 2122, 2173, 2224, 2276, 2328, 2381, 2435, 2490, 2544, 2600, 2656, 2713, 2770, 2828, 2887, 2946, 3005, 3066, 3127, 3188, 3250, 3313, 3376, 3440, 3505, 3570, 3636, 3702, 3769, 3836, 3904, 3973, 4043, 4112, 4183, 4254, 4326, 4398, 4471, 4545, 4619, 4693, 4769, 4845], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 49.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 737e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 602e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 733e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.708, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.306, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.298, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6753e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.486, 4.502, 6.051, 7.485, 11.15, 13.44, 17.62, 16.47, 24.16, 29.35, 35.15, 41.56, 48.58, 56.22, 64.46, 73.32, 82.78, 92.86, 103.5, 114.8, 126.8, 139.3, 152.4, 166.1, 180.5, 195.5, 211, 227.2, 244, 261.4, 279.4, 298.1, 317.3, 337.1, 357.6, 378.7, 400.4, 422.6, 445.5, 469.1, 493.2, 517.9, 543.3, 569.2, 595.8, 623, 650.7, 679.1, 708.1, 737.8, 768, 798.8, 830.3, 862.4, 895, 928.3, 962.2, 996.7, 1032, 1068, 1104, 1141, 1178, 1217, 1255, 1295, 1335, 1375, 1417, 1458, 1501, 1544, 1588, 1632, 1677, 1722, 1768, 1815, 1862, 1910, 1959, 2008, 2058, 2108, 2159, 2211, 2263, 2316, 2369, 2423, 2478, 2533, 2589, 2646, 2703, 2760, 2819, 2878, 2937, 2997, 3058, 3120, 3182, 3244, 3307, 3371, 3436, 3501, 3566, 3633, 3699, 3767, 3835, 3904, 3973, 4043, 4113, 4185, 4256, 4329, 4402, 4475, 4550, 4624, 4700, 4776, 4852, 4930], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 107.4, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.319, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 33e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 6e-4, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 92e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.663, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.31, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.287, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2887e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [3.022, 3.076, 7.431, 5.859, 6.114, 8.878, 8.555, 12.29, 9.023, 11.4, 10.89, 11.56, 12.84, 18.65, 15.03, 16.32, 17.22, 21.88, 24.03, 24.98, 27.04, 29.21, 31.48, 33.86, 36.34, 38.93, 41.63, 44.43, 47.33, 50.35, 53.46, 56.69, 60.02, 63.45, 66.99, 70.64, 74.39, 78.25, 82.21, 86.28, 90.46, 94.74, 99.12, 103.6, 108.2, 112.9, 117.7, 122.6, 127.7, 132.8, 138, 143.4, 148.8, 154.3, 160, 165.8, 171.6, 177.6, 183.7, 189.9, 196.1, 202.5, 209, 215.6, 222.4, 229.2, 236.1, 243.1, 250.3, 257.5, 264.8, 272.3, 279.9, 287.5, 295.3, 303.2, 311.1, 319.2, 327.4, 335.7, 344.1, 352.6, 361.2, 370, 378.8, 387.7, 396.8, 405.9, 415.1, 424.5, 434, 443.5, 453.2, 463, 472.8, 482.8, 492.9, 503.1, 513.4, 523.8, 534.4, 545, 555.7, 566.5, 577.5, 588.5, 599.7, 610.9, 622.3, 633.8, 645.3, 657, 668.8, 680.7, 692.7, 704.8, 717, 729.3, 741.7, 754.3, 766.9, 779.6, 792.5, 805.4, 818.5, 831.6, 844.9, 858.3], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.1": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 1.",
      values: {
        G3: {
          tension: { value: 60.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.321, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 764e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 386e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 735e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.63, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.238, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.286, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01441, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6345, 0.9825, 2.794, 3.594, 4.288, 6.478, 8.492, 10.57, 13.06, 19.97, 22.3, 26.62, 31.48, 36.76, 42.47, 48.6, 55.15, 62.13, 69.53, 77.35, 85.59, 94.26, 103.3, 112.9, 122.8, 133.1, 143.9, 155.1, 166.8, 178.8, 191.3, 204.2, 217.5, 231.2, 245.4, 260, 275, 290.4, 306.3, 322.5, 339.2, 356.4, 373.9, 391.9, 410.2, 429.1, 448.3, 468, 488, 508.5, 529.5, 550.8, 572.6, 594.8, 617.4, 640.4, 663.9, 687.8, 712.1, 736.8, 762, 787.5, 813.5, 840, 866.8, 894.1, 921.8, 949.9, 978.4, 1007, 1037, 1067, 1097, 1127, 1158, 1190, 1222, 1254, 1287, 1320, 1354, 1388, 1422, 1457, 1492, 1528, 1564, 1601, 1638, 1675, 1713, 1751, 1790, 1829, 1869, 1909, 1949, 1990, 2031, 2073, 2115, 2157, 2200, 2243, 2287, 2331, 2376, 2421, 2466, 2512, 2559, 2605, 2652, 2700, 2748, 2796, 2845, 2894, 2944, 2994, 3045, 3096, 3147, 3199, 3251, 3304, 3357, 3410], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 69.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 781e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 193e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 145e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.584, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.292, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1002e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.189, 4.055, 3.506, 8.458, 8.761, 13.01, 11.47, 17.65, 22, 26.94, 32.45, 38.54, 45.22, 52.47, 60.3, 68.72, 77.71, 87.28, 97.44, 108.2, 119.5, 131.4, 143.9, 156.9, 170.6, 184.8, 199.6, 214.9, 230.9, 247.4, 264.6, 282.3, 300.5, 319.4, 338.8, 358.8, 379.4, 400.6, 422.4, 444.7, 467.6, 491.1, 515.2, 539.9, 565.1, 591, 617.4, 644.3, 671.9, 700, 728.8, 758.1, 788, 818.4, 849.5, 881.1, 913.3, 946.1, 979.4, 1013, 1048, 1083, 1119, 1155, 1192, 1229, 1267, 1306, 1345, 1385, 1425, 1466, 1507, 1550, 1592, 1635, 1679, 1724, 1769, 1814, 1860, 1907, 1954, 2002, 2051, 2100, 2149, 2199, 2250, 2302, 2354, 2406, 2459, 2513, 2567, 2622, 2677, 2733, 2790, 2847, 2905, 2963, 3022, 3081, 3142, 3202, 3263, 3325, 3388, 3451, 3514, 3578, 3643, 3708, 3774, 3840, 3907, 3975, 4043, 4112, 4181, 4251, 4322, 4393, 4465, 4537, 4610, 4683], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 52.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 573e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 661e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 22e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.594, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.231, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.298, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 7051e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.684, 4.791, 5.55, 8.577, 11.02, 8.052, 15.59, 20.81, 24.53, 30.04, 36.2, 43, 50.45, 58.55, 67.3, 76.69, 86.74, 97.43, 108.8, 120.8, 133.4, 146.7, 160.6, 175.2, 190.4, 206.3, 222.8, 240, 257.8, 276.3, 295.4, 315.1, 335.6, 356.6, 378.3, 400.7, 423.7, 447.3, 471.6, 496.6, 522.2, 548.4, 575.3, 602.8, 631, 659.9, 689.3, 719.5, 750.3, 781.7, 813.8, 846.5, 879.8, 913.9, 948.5, 983.8, 1020, 1056, 1094, 1132, 1170, 1209, 1249, 1290, 1331, 1373, 1415, 1458, 1502, 1546, 1591, 1637, 1683, 1730, 1778, 1826, 1875, 1925, 1975, 2026, 2077, 2129, 2182, 2236, 2290, 2345, 2400, 2456, 2513, 2570, 2628, 2687, 2746, 2806, 2866, 2928, 2990, 3052, 3115, 3179, 3244, 3309, 3374, 3441, 3508, 3576, 3644, 3713, 3783, 3853, 3924, 3996, 4068, 4141, 4214, 4288, 4363, 4439, 4515, 4592, 4669, 4747, 4826, 4905, 4985, 5066, 5147, 5229], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 75.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 252e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 418e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 199e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.636, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.293, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 3436e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.885, 3.903, 7.781, 6.143, 8.589, 11.88, 15, 13.63, 15.49, 15.28, 18.14, 17.92, 18.58, 28.67, 19.95, 25.04, 28.2, 30.87, 33.69, 36.66, 39.8, 43.1, 46.56, 50.18, 53.96, 57.9, 62, 66.27, 70.69, 75.28, 80.02, 84.93, 90, 95.23, 100.6, 106.2, 111.9, 117.7, 123.8, 130, 136.3, 142.8, 149.5, 156.4, 163.4, 170.5, 177.8, 185.3, 193, 200.8, 208.7, 216.9, 225.1, 233.6, 242.2, 251, 259.9, 269, 278.2, 287.6, 297.2, 307, 316.8, 326.9, 337.1, 347.5, 358, 368.7, 379.6, 390.6, 401.8, 413.1, 424.6, 436.3, 448.1, 460.1, 472.3, 484.6, 497, 509.7, 522.5, 535.4, 548.5, 561.8, 575.2, 588.8, 602.6, 616.5, 630.6, 644.8, 659.2, 673.8, 688.5, 703.4, 718.4, 733.6, 749, 764.5, 780.2, 796.1, 812.1, 828.2, 844.6, 861.1, 877.7, 894.5, 911.5, 928.6, 945.9, 963.4, 981, 998.8, 1017, 1035, 1053, 1071, 1090, 1109, 1128, 1147, 1166, 1185, 1205, 1225, 1245, 1265, 1285, 1305], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.2": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 2.",
      values: {
        G3: {
          tension: { value: 58.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.326, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 628e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 364e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 216e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.65, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.334, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.239, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01444, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.9782, 2.548, 2.956, 4.803, 5.441, 9.333, 13.87, 14.47, 20.05, 24.89, 30.3, 36.28, 42.84, 49.96, 57.65, 65.91, 74.74, 84.14, 94.11, 104.7, 115.8, 127.4, 139.7, 152.5, 165.9, 179.9, 194.4, 209.5, 225.2, 241.4, 258.2, 275.6, 293.5, 312, 331.1, 350.8, 371, 391.8, 413.2, 435.1, 457.6, 480.7, 504.3, 528.5, 553.3, 578.7, 604.6, 631.1, 658.2, 685.8, 714, 742.8, 772.1, 802, 832.5, 863.6, 895.2, 927.4, 960.1, 993.5, 1027, 1062, 1097, 1132, 1169, 1205, 1243, 1281, 1319, 1358, 1398, 1438, 1479, 1520, 1562, 1604, 1647, 1691, 1735, 1780, 1825, 1871, 1917, 1964, 2012, 2060, 2109, 2158, 2208, 2258, 2309, 2361, 2413, 2466, 2519, 2573, 2627, 2682, 2738, 2794, 2851, 2908, 2966, 3024, 3083, 3143, 3203, 3263, 3325, 3386, 3449, 3512, 3575, 3639, 3704, 3769, 3835, 3901, 3968, 4036, 4104, 4173, 4242, 4312, 4382, 4453, 4524, 4597], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 56.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 668e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 155e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 216e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.635, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.32, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1095e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.546, 3.423, 3.903, 4.561, 8.534, 11.2, 14.96, 22.76, 19.37, 28.34, 34.33, 40.95, 48.2, 56.08, 64.59, 73.73, 83.5, 93.9, 104.9, 116.6, 128.9, 141.8, 155.4, 169.5, 184.4, 199.8, 215.9, 232.6, 249.9, 267.9, 286.5, 305.7, 325.6, 346, 367.2, 388.9, 411.3, 434.3, 457.9, 482.2, 507.1, 532.6, 558.8, 585.6, 613, 641.1, 669.7, 699, 729, 759.6, 790.8, 822.6, 855.1, 888.2, 921.9, 956.2, 991.2, 1027, 1063, 1100, 1137, 1176, 1214, 1254, 1294, 1334, 1376, 1418, 1460, 1503, 1547, 1592, 1637, 1682, 1729, 1776, 1823, 1872, 1920, 1970, 2020, 2071, 2122, 2174, 2227, 2280, 2334, 2388, 2444, 2499, 2556, 2613, 2670, 2729, 2788, 2847, 2908, 2968, 3030, 3092, 3155, 3218, 3282, 3347, 3412, 3478, 3544, 3611, 3679, 3747, 3816, 3886, 3956, 4027, 4099, 4171, 4244, 4317, 4391, 4466, 4541, 4617, 4694, 4771, 4849, 4927, 5007, 5086], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 61.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.326, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 748e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 745e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 678e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.648, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.338, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.242, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6562e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.687, 3.803, 3.83, 6.116, 8.562, 10.34, 12.99, 15.81, 20.57, 25.21, 30.39, 12.61, 42.39, 49.21, 56.57, 64.48, 72.93, 81.93, 91.48, 101.6, 112.2, 123.4, 135.1, 147.4, 160.2, 173.6, 187.5, 201.9, 216.9, 232.5, 248.6, 265.2, 282.4, 300.1, 318.4, 337.2, 356.5, 376.4, 396.9, 417.9, 439.4, 461.5, 484.2, 507.3, 531.1, 555.3, 580.2, 605.5, 631.4, 657.9, 684.9, 712.4, 740.5, 769.1, 798.3, 828, 858.3, 889.1, 920.5, 952.4, 984.8, 1018, 1051, 1085, 1120, 1155, 1191, 1227, 1264, 1301, 1339, 1378, 1417, 1456, 1496, 1537, 1578, 1620, 1662, 1705, 1748, 1792, 1837, 1882, 1927, 1973, 2020, 2067, 2115, 2163, 2212, 2261, 2311, 2362, 2413, 2464, 2516, 2569, 2622, 2676, 2730, 2785, 2840, 2896, 2953, 3010, 3067, 3125, 3184, 3243, 3303, 3363, 3424, 3485, 3547, 3610, 3673, 3736, 3800, 3865, 3930, 3996, 4062, 4129, 4196, 4264, 4333, 4402], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 64.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 286e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 36e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 103e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.671, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.331, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 3094e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.873, 2.197, 6.681, 7.334, 6.024, 8.816, 11.58, 11.52, 10.65, 9.464, 8.924, 8.308, 7.252, 8.229, 8.838, 9.259, 10.22, 10.14, 12.61, 12.96, 12.74, 14.03, 13.71, 15.75, 14.99, 16.43, 19.62, 20.36, 19.32, 20.74, 21.73, 22.75, 23.81, 24.9, 26.02, 27.18, 28.37, 29.59, 30.85, 32.14, 33.47, 34.82, 36.22, 37.64, 39.1, 40.59, 42.12, 43.68, 45.27, 46.9, 48.56, 50.25, 51.98, 53.74, 55.53, 57.36, 59.22, 61.12, 63.04, 65.01, 67, 69.03, 71.09, 73.19, 75.32, 77.48, 79.68, 81.91, 84.17, 86.47, 88.8, 91.16, 93.56, 95.99, 98.46, 101, 103.5, 106.1, 108.7, 111.3, 114, 116.7, 119.4, 122.2, 125, 127.8, 130.7, 133.6, 136.5, 139.5, 142.5, 145.5, 148.6, 151.7, 154.8, 158, 161.2, 164.4, 167.7, 171, 174.3, 177.7, 181.1, 184.5, 188, 191.5, 195, 198.6, 202.2, 205.9, 209.5, 213.2, 217, 220.7, 224.6, 228.4, 232.3, 236.2, 240.1, 244.1, 248.1, 252.1, 256.2, 260.3, 264.5, 268.6, 272.8, 277.1], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.3": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 3.",
      values: {
        G3: {
          tension: { value: 36.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 824e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 228e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 371e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.706, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.21, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.239, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.0146, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.404, 2.075, 1.89, 2.459, 3.496, 4.931, 6.095, 7.994, 9.34, 9.149, 12.69, 15.02, 17.56, 20.33, 23.31, 26.52, 29.95, 33.6, 37.47, 41.57, 45.88, 50.42, 55.17, 60.15, 65.35, 70.77, 76.42, 82.28, 88.36, 94.67, 101.2, 107.9, 114.9, 122.1, 129.5, 137.2, 145, 153.1, 161.4, 169.9, 178.6, 187.6, 196.8, 206.2, 215.8, 225.7, 235.7, 246, 256.5, 267.3, 278.2, 289.4, 300.8, 312.4, 324.2, 336.3, 348.6, 361.1, 373.8, 386.7, 399.9, 413.3, 426.9, 440.7, 454.8, 469, 483.5, 498.2, 513.2, 528.3, 543.7, 559.3, 575.1, 591.2, 607.4, 623.9, 640.6, 657.5, 674.7, 692.1, 709.7, 727.5, 745.5, 763.8, 782.2, 800.9, 819.8, 839, 858.3, 877.9, 897.7, 917.7, 938, 958.5, 979.1, 1e3, 1021, 1043, 1064, 1086, 1108, 1130, 1153, 1175, 1198, 1221, 1245, 1268, 1292, 1316, 1340, 1365, 1389, 1414, 1439, 1465, 1490, 1516, 1542, 1568, 1595, 1621, 1648, 1675, 1703, 1730, 1758, 1786], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 41, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.317, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 69e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 118e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 139e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.718, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.202, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.248, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1177e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.253, 1.783, 4.113, 4.125, 7.918, 8.894, 16.72, 20.09, 15.35, 18.26, 15.77, 25.11, 29.05, 33.33, 37.95, 42.91, 48.22, 53.87, 59.86, 66.19, 72.87, 79.89, 87.25, 94.95, 103, 111.4, 120.1, 129.2, 138.6, 148.4, 158.5, 168.9, 179.7, 190.8, 202.3, 214.1, 226.2, 238.7, 251.6, 264.8, 278.3, 292.2, 306.4, 320.9, 335.8, 351, 366.6, 382.5, 398.8, 415.4, 432.3, 449.6, 467.3, 485.2, 503.6, 522.2, 541.2, 560.6, 580.2, 600.3, 620.6, 641.4, 662.4, 683.8, 705.6, 727.6, 750.1, 772.8, 795.9, 819.4, 843.2, 867.3, 891.8, 916.6, 941.8, 967.3, 993.1, 1019, 1046, 1073, 1100, 1128, 1155, 1184, 1212, 1241, 1270, 1300, 1330, 1360, 1391, 1422, 1453, 1485, 1517, 1549, 1582, 1615, 1648, 1682, 1716, 1751, 1785, 1820, 1856, 1892, 1928, 1964, 2001, 2038, 2076, 2114, 2152, 2190, 2229, 2268, 2308, 2348, 2388, 2428, 2469, 2511, 2552, 2594, 2636, 2679, 2722, 2765], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 50.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.317, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 627e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 645e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 171e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.711, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.208, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6648e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.511, 4.717, 5.046, 6.778, 8.088, 11.77, 13.81, 22.24, 27.47, 32.07, 39.51, 47.16, 55.54, 64.65, 74.48, 85.05, 96.34, 108.4, 121.1, 134.6, 148.8, 163.7, 179.4, 195.8, 212.9, 230.8, 249.3, 268.7, 288.7, 309.5, 330.9, 353.2, 376.1, 399.8, 424.2, 449.3, 475.2, 501.8, 529.1, 557.2, 585.9, 615.5, 645.7, 676.7, 708.4, 740.8, 773.9, 807.8, 842.4, 877.7, 913.8, 950.6, 988.1, 1026, 1065, 1105, 1146, 1187, 1229, 1271, 1315, 1359, 1403, 1449, 1495, 1542, 1590, 1638, 1688, 1737, 1788, 1839, 1892, 1944, 1998, 2052, 2107, 2163, 2219, 2277, 2335, 2393, 2453, 2513, 2574, 2635, 2697, 2760, 2824, 2889, 2954, 3020, 3086, 3154, 3222, 3291, 3360, 3431, 3502, 3574, 3646, 3719, 3793, 3868, 3943, 4019, 4096, 4174, 4252, 4331, 4411, 4492, 4573, 4655, 4737, 4821, 4905, 4990, 5075, 5162, 5249, 5337, 5425, 5514, 5604, 5695, 5787, 5879], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 89.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 319e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 485e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 938e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.677, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.214, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.229, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 341e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [3.666, 4.289, 5.901, 6.365, 7.94, 11.37, 8.586, 12.97, 11.36, 12.56, 14.57, 13.29, 14.53, 15.51, 15.95, 17.55, 19.45, 21.58, 25.39, 22.84, 28.04, 30.2, 32.48, 34.85, 37.34, 39.92, 42.62, 45.42, 48.32, 51.34, 54.45, 57.68, 61, 64.44, 67.98, 71.62, 75.37, 79.23, 83.19, 87.26, 91.44, 95.71, 100.1, 104.6, 109.2, 113.9, 118.7, 123.6, 128.6, 133.8, 139, 144.3, 149.8, 155.3, 161, 166.7, 172.6, 178.6, 184.6, 190.8, 197.1, 203.5, 210, 216.6, 223.3, 230.1, 237, 244.1, 251.2, 258.4, 265.8, 273.2, 280.8, 288.4, 296.2, 304.1, 312.1, 320.1, 328.3, 336.6, 345, 353.5, 362.1, 370.9, 379.7, 388.6, 397.6, 406.8, 416, 425.4, 434.8, 444.4, 454.1, 463.8, 473.7, 483.7, 493.8, 504, 514.3, 524.7, 535.2, 545.8, 556.6, 567.4, 578.3, 589.4, 600.5, 611.8, 623.1, 634.6, 646.2, 657.8, 669.6, 681.5, 693.5, 705.6, 717.8, 730.1, 742.5, 755.1, 767.7, 780.4, 793.3, 806.2, 819.2, 832.4, 845.7, 859], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.4": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 4.",
      values: {
        G3: {
          tension: { value: 35.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 676e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 226e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 133e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.659, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.226, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.085, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01424, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 56, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5548, 1.469, 1.644, 3.766, 5.85, 9.451, 12.4, 12.21, 17.35, 22.1, 26.96, 32.33, 38.21, 44.61, 51.51, 58.92, 66.85, 75.29, 84.24, 93.7, 103.7, 114.2, 125.1, 136.7, 148.7, 161.2, 174.2, 187.8, 201.9, 216.4, 231.5, 247.1, 263.2, 279.8, 297, 314.6, 332.8, 351.4, 370.6, 390.3, 410.5, 431.2, 452.4, 474.2, 496.4, 519.2, 542.4, 566.2, 590.5, 615.3, 640.6, 666.5, 692.8, 719.6, 747, 774.9, 803.2, 832.1, 861.5, 891.5, 921.9, 952.8, 984.3, 1016, 1049, 1082, 1115, 1149, 1184, 1219, 1254, 1290, 1327, 1364, 1402, 1440, 1478, 1517, 1557, 1597, 1638, 1679, 1721, 1763, 1806, 1849, 1893, 1937, 1981, 2027, 2073, 2119, 2166, 2213, 2261, 2309, 2358, 2407, 2457, 2507, 2558, 2610, 2662, 2714, 2767, 2820, 2874, 2929, 2984, 3039, 3095, 3152, 3209, 3266, 3324, 3383, 3442, 3502, 3562, 3622, 3683, 3745, 3807, 3870, 3933, 3997, 4061, 4125], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 46.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 762e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 128e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 136e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.636, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.227, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.09, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1224e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 48, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.049, 2.066, 3.62, 4.496, 9.116, 14.8, 20.2, 27.9, 36.67, 45.62, 56.13, 67.76, 80.49, 94.33, 109.3, 125.3, 142.5, 160.8, 180.1, 200.6, 222.2, 244.9, 268.7, 293.6, 319.6, 346.7, 375, 404.3, 434.8, 466.3, 499, 532.7, 567.6, 603.6, 640.7, 678.9, 718.2, 758.6, 800.1, 842.7, 886.5, 931.3, 977.2, 1024, 1072, 1122, 1172, 1224, 1276, 1330, 1385, 1441, 1498, 1556, 1615, 1675, 1737, 1799, 1863, 1928, 1994, 2061, 2129, 2198, 2268, 2340, 2412, 2486, 2560, 2636, 2713, 2791, 2870, 2951, 3032, 3115, 3198, 3283, 3369, 3455, 3544, 3633, 3723, 3814, 3907, 4e3, 4095, 4191, 4287, 4385, 4485, 4585, 4686, 4788, 4892, 4997, 5102, 5209, 5317, 5426, 5536, 5648, 5760, 5873, 5988, 6104, 6220, 6338, 6457, 6578, 6699, 6821, 6945, 7069, 7195, 7321, 7449, 7578, 7708, 7840, 7972, 8105, 8240, 8375, 8512, 8650, 8789, 8929], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 73.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 623e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 905e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 239e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.653, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.23, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.084, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 5882e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.065, 4.795, 4.751, 8.035, 10.53, 12.29, 19.78, 24.54, 31.06, 38.45, 46.71, 55.84, 65.84, 76.71, 88.45, 101.1, 114.5, 128.9, 144.1, 160.2, 177.1, 195, 213.7, 233.2, 253.6, 274.9, 297.1, 320.2, 344.1, 368.9, 394.5, 421, 448.4, 476.7, 505.8, 535.8, 566.7, 598.4, 631, 664.5, 698.8, 734, 770.1, 807.1, 844.9, 883.6, 923.1, 963.6, 1005, 1047, 1090, 1134, 1179, 1224, 1271, 1318, 1367, 1416, 1466, 1517, 1568, 1621, 1674, 1729, 1784, 1840, 1897, 1955, 2013, 2073, 2133, 2195, 2257, 2320, 2384, 2449, 2514, 2581, 2648, 2716, 2786, 2856, 2926, 2998, 3071, 3144, 3219, 3294, 3370, 3447, 3525, 3603, 3683, 3763, 3845, 3927, 4010, 4094, 4178, 4264, 4351, 4438, 4526, 4615, 4705, 4796, 4888, 4980, 5074, 5168, 5264, 5360, 5457, 5554, 5653, 5753, 5853, 5954, 6056, 6159, 6263, 6368, 6474, 6580, 6688, 6796, 6905, 7015], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 82.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.327, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 297e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 431e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 101e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.65, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.244, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.088, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2659e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.787, 2.56, 6.59, 4.055, 7.734, 10.79, 9.329, 7.968, 9.623, 11.74, 12.14, 12.23, 14.31, 14.21, 16.33, 19.02, 23.97, 23.57, 25.78, 28.12, 30.58, 33.17, 35.89, 38.73, 41.7, 44.8, 48.02, 51.37, 54.85, 58.45, 62.18, 66.04, 70.02, 74.12, 78.36, 82.72, 87.21, 91.82, 96.56, 101.4, 106.4, 111.5, 116.8, 122.2, 127.7, 133.3, 139, 144.9, 150.9, 157, 163.3, 169.7, 176.2, 182.8, 189.6, 196.5, 203.5, 210.6, 217.9, 225.3, 232.8, 240.5, 248.2, 256.1, 264.2, 272.3, 280.6, 289, 297.5, 306.2, 315, 323.9, 332.9, 342.1, 351.4, 360.8, 370.3, 380, 389.8, 399.7, 409.8, 419.9, 430.2, 440.7, 451.2, 461.9, 472.7, 483.6, 494.7, 505.9, 517.2, 528.6, 540.2, 551.9, 563.7, 575.7, 587.7, 599.9, 612.2, 624.7, 637.3, 650, 662.8, 675.8, 688.8, 702.1, 715.4, 728.8, 742.4, 756.1, 770, 784, 798, 812.3, 826.6, 841.1, 855.7, 870.4, 885.3, 900.2, 915.3, 930.6, 945.9, 961.4, 977, 992.8, 1009, 1025], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "viola-strings": {
      is: "bowed-string-set",
      about: "The viola's strings as Artifastring measured them: every quantity's range across its 2 sets.",
      values: {
        C3: {
          tension: { range: [46.2, 63.3], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.367, 0.369], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [715e-6, 902e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [502e-5, 693e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [462e7, 187e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.73, 0.96], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.213, 0.228], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.226, 0.273], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [0.02417, 0.02424], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [84, 84], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        G3: {
          tension: { range: [43.7, 64.6], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.364, 0.369], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [644e-6, 671e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [211e-5, 321e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [119e8, 123e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.718, 0.945], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.212, 0.231], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.224, 0.26], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [0.01184, 0.01407], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [64, 72], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        D4: {
          tension: { range: [42.6, 49.3], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.363, 0.373], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [288e-6, 438e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [935e-6, 103e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [414e8, 127e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.741, 0.924], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.215, 0.229], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.232, 0.285], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [2727e-6, 2842e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [80, 92], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        A4: {
          tension: { range: [100.2, 118.9], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.363, 0.373], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [313e-6, 352e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [977e-6, 11e-4], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [167e9, 219e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.762, 0.963], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.205, 0.225], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.222, 0.277], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [2016e-7, 2623e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [92, 100], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        }
      }
    },
    "viola-strings.0": {
      is: "viola-strings",
      about: "Artifastring's viola strings, its set 0.",
      values: {
        C3: {
          tension: { value: 46.2, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.369, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 715e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 502e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 187e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.73, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.228, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.273, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.02417, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 84, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6495, 1.771, 3.434, 4.209, 6.285, 8.386, 10.88, 10.11, 11.77, 11.49, 7.699, 14.37, 16.35, 18.5, 20.83, 23.32, 25.99, 28.83, 31.84, 35.03, 38.38, 41.91, 45.61, 49.48, 53.53, 57.75, 62.14, 66.7, 71.43, 76.34, 81.41, 86.66, 92.09, 97.68, 103.4, 109.4, 115.5, 121.8, 128.2, 134.9, 141.7, 148.6, 155.8, 163.1, 170.6, 178.2, 186.1, 194.1, 202.2, 210.6, 219.1, 227.8, 236.7, 245.7, 254.9, 264.3, 273.8, 283.6, 293.5, 303.5, 313.8, 324.2, 334.8, 345.5, 356.5, 367.6, 378.8, 390.3, 401.9, 413.7, 425.7, 437.8, 450.1, 462.6, 475.2, 488.1, 501, 514.2, 527.6, 541.1, 554.7, 568.6, 582.6, 596.8, 611.2, 625.7, 640.5, 655.4, 670.4, 685.6, 701.1, 716.6, 732.4, 748.3, 764.4, 780.7, 797.1, 813.7, 830.5, 847.4, 864.6, 881.9, 899.3, 917, 934.8, 952.8, 970.9, 989.3, 1008, 1026, 1045, 1064, 1084, 1103, 1122, 1142, 1162, 1182, 1202, 1223, 1243, 1264, 1285, 1306, 1327, 1349, 1370, 1392], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G3: {
          tension: { value: 64.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.364, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 671e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 321e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 123e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.718, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.231, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.26, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01184, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.412, 1.11, 3.256, 3.212, 3.891, 6.572, 7.844, 8.524, 10.5, 18.17, 14.56, 8.567, 23.76, 27.56, 31.66, 36.07, 40.78, 45.8, 51.12, 56.75, 62.68, 68.91, 75.45, 82.29, 89.43, 96.88, 104.6, 112.7, 121.1, 129.7, 138.7, 148, 157.5, 167.4, 177.6, 188.1, 198.9, 210, 221.4, 233.1, 245.1, 257.4, 270, 283, 296.2, 309.7, 323.6, 337.7, 352.1, 366.9, 381.9, 397.3, 412.9, 428.9, 445.2, 461.7, 478.6, 495.8, 513.3, 531.1, 549.2, 567.6, 586.3, 605.3, 624.6, 644.2, 664.1, 684.3, 704.8, 725.7, 746.8, 768.2, 790, 812, 834.4, 857, 880, 903.2, 926.8, 950.7, 974.8, 999.3, 1024, 1049, 1075, 1100, 1126, 1153, 1179, 1206, 1233, 1261, 1289, 1317, 1345, 1374, 1403, 1432, 1462, 1492, 1522, 1553, 1584, 1615, 1646, 1678, 1710, 1742, 1775, 1808, 1841, 1875, 1909, 1943, 1978, 2012, 2048, 2083, 2119, 2155, 2191, 2228, 2265, 2302, 2339, 2377, 2415, 2454], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 42.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.363, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 438e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 935e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 414e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.741, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.229, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.285, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2727e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.295, 4.237, 2.913, 4.48, 5.99, 9.201, 7.977, 12.31, 13.94, 17.5, 20.94, 24.75, 28.91, 33.44, 38.34, 43.59, 49.21, 55.19, 61.53, 68.23, 75.3, 82.73, 90.52, 98.68, 107.2, 116.1, 125.3, 134.9, 144.9, 155.2, 165.9, 177, 188.4, 200.1, 212.3, 224.8, 237.7, 250.9, 264.5, 278.4, 292.7, 307.4, 322.5, 337.9, 353.6, 369.8, 386.2, 403.1, 420.3, 437.9, 455.8, 474.1, 492.8, 511.8, 531.2, 551, 571.1, 591.5, 612.4, 633.6, 655.1, 677.1, 699.4, 722, 745, 768.4, 792.1, 816.2, 840.7, 865.5, 890.7, 916.3, 942.2, 968.4, 995.1, 1022, 1049, 1077, 1105, 1134, 1163, 1192, 1221, 1251, 1281, 1312, 1343, 1374, 1406, 1438, 1471, 1503, 1537, 1570, 1604, 1638, 1673, 1708, 1743, 1779, 1815, 1851, 1888, 1925, 1963, 2001, 2039, 2077, 2116, 2156, 2195, 2235, 2276, 2317, 2358, 2399, 2441, 2483, 2526, 2569, 2612, 2656, 2700, 2744, 2789, 2834, 2880, 2925], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 100.2, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.363, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 313e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 977e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 167e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.762, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.225, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.277, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2016e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 100, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.934, 3.088, 6.086, 8.279, 7.242, 8.148, 12.53, 12.31, 16.05, 21.64, 14.91, 17.73, 20.46, 21.89, 27.41, 28.36, 31.25, 35.72, 39.3, 43.07, 47.05, 51.24, 55.62, 60.22, 65.01, 70.01, 75.22, 80.63, 86.24, 92.06, 98.08, 104.3, 110.7, 117.4, 124.2, 131.2, 138.5, 145.9, 153.6, 161.5, 169.5, 177.8, 186.3, 194.9, 203.8, 212.9, 222.2, 231.7, 241.4, 251.3, 261.4, 271.7, 282.2, 292.9, 303.8, 314.9, 326.3, 337.8, 349.5, 361.5, 373.6, 386, 398.5, 411.3, 424.2, 437.4, 450.8, 464.3, 478.1, 492.1, 506.3, 520.7, 535.3, 550.1, 565.1, 580.3, 595.7, 611.3, 627.1, 643.1, 659.4, 675.8, 692.4, 709.3, 726.3, 743.6, 761, 778.7, 796.5, 814.6, 832.9, 851.3, 870, 888.9, 908, 927.3, 946.8, 966.4, 986.3, 1006, 1027, 1047, 1068, 1089, 1110, 1131, 1153, 1175, 1197, 1219, 1241, 1264, 1286, 1309, 1333, 1356, 1379, 1403, 1427, 1451, 1476, 1500, 1525, 1550, 1575, 1601, 1626, 1652], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "viola-strings.1": {
      is: "viola-strings",
      about: "Artifastring's viola strings, its set 1.",
      values: {
        C3: {
          tension: { value: 63.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.367, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 902e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 693e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 462e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.96, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.213, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.226, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.02424, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 84, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5617, 2.11, 1.256, 3.106, 3.474, 4.383, 5.912, 6.002, 7.16, 8.057, 9.817, 11.44, 13.56, 15.59, 17.78, 6.526, 22.66, 25.35, 28.19, 31.2, 34.38, 37.71, 41.21, 44.87, 48.69, 52.67, 56.82, 61.13, 65.61, 70.24, 75.04, 80, 85.12, 90.41, 95.86, 101.5, 107.2, 113.2, 119.3, 125.5, 132, 138.6, 145.3, 152.2, 159.3, 166.5, 173.9, 181.5, 189.2, 197.1, 205.2, 213.4, 221.8, 230.3, 239, 247.9, 256.9, 266.1, 275.4, 284.9, 294.6, 304.5, 314.5, 324.6, 335, 345.5, 356.1, 366.9, 377.9, 389, 400.4, 411.8, 423.5, 435.2, 447.2, 459.3, 471.6, 484, 496.6, 509.4, 522.3, 535.4, 548.7, 562.1, 575.7, 589.4, 603.3, 617.4, 631.7, 646, 660.6, 675.3, 690.2, 705.3, 720.5, 735.8, 751.4, 767.1, 782.9, 798.9, 815.1, 831.5, 848, 864.7, 881.5, 898.5, 915.7, 933, 950.5, 968.1, 985.9, 1004, 1022, 1040, 1059, 1077, 1096, 1115, 1134, 1154, 1173, 1193, 1212, 1232, 1252, 1273, 1293, 1314], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G3: {
          tension: { value: 43.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.369, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 644e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 211e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 119e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.945, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.212, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.224, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01407, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.8636, 0.7092, 1.408, 1.73, 3.162, 4.563, 5.447, 6.292, 8.316, 10.39, 17.49, 21.15, 21.65, 27.34, 30.86, 35.4, 40.26, 45.43, 50.91, 56.7, 62.81, 69.23, 75.97, 83.02, 90.38, 98.05, 106, 114.3, 123, 131.9, 141.1, 150.7, 160.5, 170.7, 181.2, 192, 203.1, 214.6, 226.3, 238.4, 250.8, 263.4, 276.4, 289.8, 303.4, 317.3, 331.6, 346.1, 361, 376.2, 391.7, 407.5, 423.7, 440.1, 456.9, 473.9, 491.3, 509, 527, 545.4, 564, 583, 602.2, 621.8, 641.7, 661.9, 682.4, 703.2, 724.4, 745.8, 767.6, 789.7, 812.1, 834.8, 857.8, 881.2, 904.8, 928.8, 953.1, 977.6, 1003, 1028, 1053, 1079, 1105, 1132, 1159, 1186, 1213, 1241, 1269, 1297, 1326, 1355, 1384, 1414, 1444, 1474, 1504, 1535, 1566, 1598, 1630, 1662, 1694, 1727, 1760, 1793, 1827, 1861, 1895, 1930, 1965, 2e3, 2036, 2071, 2108, 2144, 2181, 2218, 2256, 2293, 2331, 2370, 2408, 2447, 2487, 2526], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 49.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.373, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 288e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 103e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 127e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.924, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.215, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.232, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2842e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.9367, 2.883, 5.089, 4.529, 6.694, 7.078, 8.835, 10.05, 9.632, 12.09, 11.96, 26.44, 16.1, 19.29, 21.73, 24.35, 27.15, 30.13, 33.3, 36.64, 40.17, 43.87, 47.76, 51.82, 56.07, 60.5, 65.11, 69.9, 74.87, 80.02, 85.35, 90.86, 96.56, 102.4, 108.5, 114.7, 121.1, 127.7, 134.5, 141.5, 148.6, 155.9, 163.4, 171.1, 179, 187, 195.2, 203.6, 212.2, 221, 229.9, 239.1, 248.4, 257.9, 267.5, 277.4, 287.4, 297.6, 308, 318.6, 329.4, 340.3, 351.4, 362.7, 374.2, 385.8, 397.7, 409.7, 421.9, 434.3, 446.8, 459.6, 472.5, 485.6, 498.9, 512.4, 526, 539.8, 553.8, 568, 582.4, 596.9, 611.7, 626.6, 641.7, 656.9, 672.4, 688, 703.8, 719.8, 736, 752.4, 768.9, 785.6, 802.5, 819.6, 836.9, 854.3, 871.9, 889.7, 907.7, 925.9, 944.2, 962.8, 981.5, 1e3, 1019, 1039, 1058, 1078, 1098, 1117, 1138, 1158, 1178, 1199, 1220, 1241, 1262, 1284, 1305, 1327, 1349, 1371, 1394, 1416, 1439, 1462], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 118.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.373, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 352e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 11e-4, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 219e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.963, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.205, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.222, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2623e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.28, 2.336, 5.31, 4.746, 5.398, 10.06, 11.16, 11.81, 13.67, 15.66, 17.6, 19.69, 24.3, 27.82, 31.62, 35.7, 40.06, 44.7, 49.63, 54.83, 60.32, 66.09, 72.14, 78.47, 85.08, 91.98, 99.15, 106.6, 114.3, 122.4, 130.7, 139.2, 148.1, 157.3, 166.7, 176.4, 186.4, 196.7, 207.2, 218, 229.2, 240.5, 252.2, 264.2, 276.4, 288.9, 301.7, 314.8, 328.2, 341.8, 355.8, 370, 384.5, 399.2, 414.3, 429.6, 445.3, 461.2, 477.3, 493.8, 510.5, 527.6, 544.9, 562.5, 580.3, 598.5, 616.9, 635.6, 654.6, 673.9, 693.4, 713.3, 733.4, 753.8, 774.5, 795.4, 816.7, 838.2, 860, 882.1, 904.5, 927.1, 950.1, 973.3, 996.8, 1021, 1045, 1069, 1094, 1118, 1144, 1169, 1195, 1221, 1247, 1274, 1301, 1328, 1355, 1383, 1411, 1439, 1468, 1497, 1526, 1555, 1585, 1615, 1645, 1676, 1706, 1738, 1769, 1801, 1832, 1865, 1897, 1930, 1963, 1996, 2030, 2064, 2098, 2133, 2167, 2202, 2238, 2273], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings": {
      is: "bowed-string-set",
      about: "The cello's strings as Artifastring measured them: every quantity's range across its 3 sets.",
      values: {
        C2: {
          tension: { range: [123.5, 161.5], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.673, 0.689], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [146e-5, 154e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [0.0156, 0.0212], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [12e9, 206e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.823, 1.103], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.406, 0.427], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.133, 0.29], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [0.05783, 0.06328], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [96, 100], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        G2: {
          tension: { range: [116.6, 155.1], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.669, 0.686], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [103e-5, 11e-4], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [685e-5, 867e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [187e8, 24e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.836, 1.06], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.396, 0.421], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.133, 0.279], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [2597e-6, 2706e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [92, 96], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        D3: {
          tension: { range: [99.7, 137.3], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.66, 0.694], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [88e-5, 102e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [268e-5, 333e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [25e9, 25e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.827, 1.119], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.422, 0.433], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.139, 0.284], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [2688e-6, 2713e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [76, 88], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        A3: {
          tension: { range: [123.1, 147.6], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.658, 0.694], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [747e-6, 781e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [135e-5, 167e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [194e8, 25e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.873, 1.124], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.396, 0.428], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.126, 0.275], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [235e-5, 2525e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [92, 96], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        }
      }
    },
    "cello-strings.0": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 0.",
      values: {
        C2: {
          tension: { value: 161.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.673, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 146e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0212, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 206e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.823, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.427, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.29, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.06041, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3959, 2.221, 2.834, 2.681, 3.967, 6.563, 6.368, 9.47, 12.34, 15.31, 10.04, 17.44, 20.31, 23.44, 26.81, 30.43, 34.3, 38.42, 42.79, 47.42, 52.29, 57.41, 62.78, 68.4, 74.27, 80.39, 86.76, 93.38, 100.2, 107.4, 114.7, 122.4, 130.2, 138.3, 146.7, 155.3, 164.2, 173.3, 182.7, 192.3, 202.2, 212.3, 222.6, 233.3, 244.1, 255.2, 266.6, 278.2, 290.1, 302.2, 314.6, 327.2, 340, 353.2, 366.5, 380.1, 394, 408.1, 422.5, 437.1, 452, 467.1, 482.4, 498, 513.9, 530, 546.4, 563, 579.8, 597, 614.3, 631.9, 649.8, 667.9, 686.3, 704.9, 723.7, 742.8, 762.2, 781.8, 801.7, 821.8, 842.1, 862.7, 883.6, 904.7, 926.1, 947.7, 969.5, 991.6, 1014, 1037, 1059, 1083, 1106, 1130, 1153, 1177, 1202, 1226, 1251, 1276, 1302, 1327, 1353, 1379, 1406, 1432, 1459, 1486, 1514, 1541, 1569, 1597, 1625, 1654, 1683, 1712, 1741, 1771, 1801, 1831, 1861, 1892, 1923, 1954, 1985, 2017], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 116.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.669, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 103e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 685e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 187e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.836, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.415, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.279, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2706e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3421, 1.051, 1.521, 2.009, 1.26, 3.25, 4.144, 4.566, 5.29, 6.565, 8.002, 8.42, 7.944, 14.04, 19.47, 17.83, 20.2, 22.72, 25.39, 28.21, 31.19, 34.32, 37.6, 41.04, 44.63, 48.37, 52.26, 56.3, 60.5, 64.85, 69.36, 74.01, 78.82, 83.79, 88.9, 94.17, 99.59, 105.2, 110.9, 116.8, 122.8, 129, 135.3, 141.8, 148.4, 155.2, 162.2, 169.3, 176.5, 183.9, 191.5, 199.2, 207.1, 215.1, 223.3, 231.6, 240, 248.7, 257.4, 266.4, 275.5, 284.7, 294.1, 303.6, 313.3, 323.2, 333.2, 343.3, 353.6, 364.1, 374.7, 385.5, 396.4, 407.4, 418.7, 430, 441.6, 453.3, 465.1, 477.1, 489.2, 501.5, 513.9, 526.5, 539.3, 552.2, 565.2, 578.4, 591.8, 605.3, 619, 632.8, 646.8, 660.9, 675.2, 689.6, 704.2, 718.9, 733.8, 748.8, 764, 779.4, 794.9, 810.5, 826.3, 842.3, 858.4, 874.6, 891, 907.6, 924.3, 941.2, 958.2, 975.4, 992.7, 1010, 1028, 1046, 1064, 1082, 1100, 1118, 1137, 1156, 1174, 1193, 1213, 1232], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 99.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.66, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 88e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 268e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.827, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.423, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.284, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2713e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.8156, 1.836, 3.812, 4.117, 4.889, 5.872, 8.164, 12.8, 15.01, 17.84, 20.33, 25.99, 30.13, 35.04, 40.34, 46.04, 52.13, 58.61, 65.48, 72.75, 80.41, 88.47, 96.91, 105.8, 115, 124.6, 134.6, 145, 155.8, 167, 178.6, 190.6, 203, 215.8, 228.9, 242.5, 256.4, 270.8, 285.5, 300.6, 316.1, 332, 348.3, 365, 382.1, 399.6, 417.5, 435.8, 454.4, 473.5, 492.9, 512.8, 533, 553.6, 574.6, 596.1, 617.9, 640.1, 662.6, 685.6, 709, 732.8, 756.9, 781.5, 806.4, 831.8, 857.5, 883.6, 910.2, 937.1, 964.4, 992.1, 1020, 1049, 1078, 1107, 1136, 1166, 1197, 1228, 1259, 1291, 1323, 1355, 1388, 1421, 1455, 1489, 1523, 1558, 1593, 1629, 1664, 1701, 1738, 1775, 1812, 1850, 1888, 1927, 1966, 2006, 2046, 2086, 2126, 2168, 2209, 2251, 2293, 2336, 2379, 2422, 2466, 2510, 2555, 2600, 2645, 2691, 2737, 2784, 2830, 2878, 2926, 2974, 3022, 3071, 3120, 3170], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 139.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.658, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 747e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 167e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.873, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.428, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.275, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 235e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.481, 2.487, 4.71, 3.964, 6.756, 7.696, 9.814, 10.86, 13.02, 15.72, 20.05, 19.87, 20.36, 23.04, 28.85, 32.5, 36.41, 40.57, 44.98, 49.65, 54.56, 59.73, 65.15, 70.82, 76.75, 82.93, 89.36, 96.04, 103, 110.2, 117.6, 125.3, 133.2, 141.4, 149.9, 158.6, 167.5, 176.7, 186.2, 195.9, 205.8, 216, 226.5, 237.2, 248.2, 259.4, 270.9, 282.6, 294.6, 306.8, 319.3, 332, 345, 358.2, 371.7, 385.5, 399.5, 413.7, 428.2, 443, 458, 473.2, 488.7, 504.5, 520.5, 536.8, 553.3, 570, 587.1, 604.3, 621.8, 639.6, 657.6, 675.9, 694.5, 713.2, 732.3, 751.6, 771.1, 790.9, 810.9, 831.2, 851.8, 872.6, 893.6, 914.9, 936.5, 958.3, 980.4, 1003, 1025, 1048, 1071, 1094, 1118, 1142, 1166, 1190, 1215, 1240, 1265, 1290, 1316, 1342, 1368, 1394, 1421, 1447, 1475, 1502, 1529, 1557, 1585, 1614, 1642, 1671, 1700, 1730, 1759, 1789, 1819, 1850, 1880, 1911, 1942, 1974, 2006, 2037], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings.1": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 1.",
      values: {
        C2: {
          tension: { value: 148.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.689, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 154e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0186, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 152e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.103, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.406, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.133, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.05783, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3708, 1.256, 1.635, 2.688, 3.265, 4.88, 6.268, 7.56, 10.33, 16.23, 18.56, 21.71, 21.3, 30.11, 34.84, 39.92, 45.35, 51.14, 57.27, 63.75, 70.58, 77.76, 85.3, 93.18, 101.4, 110, 118.9, 128.2, 137.9, 147.8, 158.2, 168.9, 179.9, 191.3, 203, 215.1, 227.5, 240.3, 253.5, 267, 280.8, 295, 309.5, 324.4, 339.7, 355.2, 371.2, 387.5, 404.1, 421.1, 438.5, 456.2, 474.2, 492.6, 511.3, 530.4, 549.9, 569.7, 589.8, 610.3, 631.2, 652.4, 673.9, 695.8, 718, 740.6, 763.6, 786.9, 810.5, 834.5, 858.9, 883.6, 908.6, 934, 959.8, 985.9, 1012, 1039, 1066, 1094, 1122, 1150, 1178, 1207, 1237, 1266, 1296, 1326, 1357, 1388, 1419, 1451, 1483, 1516, 1548, 1582, 1615, 1649, 1683, 1717, 1752, 1788, 1823, 1859, 1895, 1932, 1969, 2006, 2044, 2082, 2120, 2159, 2198, 2237, 2277, 2317, 2358, 2399, 2440, 2481, 2523, 2565, 2608, 2651, 2694, 2738, 2782, 2826], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 155.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.686, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 11e-4, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 867e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 24e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.058, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.421, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.133, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 267e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5527, 2.439, 1.238, 1.801, 2.584, 2.923, 4.733, 4.94, 7.037, 7.619, 9.309, 11.88, 13.33, 15.56, 20.27, 25.3, 20.42, 26.96, 30.1, 33.41, 36.91, 40.58, 44.44, 48.47, 52.69, 57.08, 61.65, 66.4, 71.33, 76.44, 81.73, 87.2, 92.85, 98.68, 104.7, 110.9, 117.2, 123.8, 130.5, 137.4, 144.5, 151.8, 159.2, 166.8, 174.6, 182.6, 190.8, 199.1, 207.6, 216.3, 225.2, 234.2, 243.5, 252.9, 262.5, 272.2, 282.2, 292.3, 302.6, 313.1, 323.8, 334.6, 345.7, 356.9, 368.3, 379.8, 391.6, 403.5, 415.6, 427.9, 440.3, 453, 465.8, 478.8, 492, 505.3, 518.9, 532.6, 546.5, 560.6, 574.8, 589.2, 603.9, 618.7, 633.6, 648.8, 664.1, 679.6, 695.3, 711.2, 727.2, 743.4, 759.9, 776.4, 793.2, 810.1, 827.3, 844.6, 862.1, 879.7, 897.6, 915.6, 933.8, 952.2, 970.7, 989.5, 1008, 1027, 1047, 1066, 1086, 1106, 1126, 1146, 1166, 1187, 1207, 1228, 1249, 1271, 1292, 1314, 1335, 1357, 1380, 1402, 1424, 1447], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 115.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.677, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 102e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 295e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.119, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.422, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.139, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2688e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 88, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.299, 2.921, 4.22, 5, 7.733, 7.589, 10.12, 11.78, 12.34, 17.6, 12.93, 20.53, 23.72, 27.18, 30.92, 34.93, 39.22, 43.79, 48.64, 53.76, 59.16, 64.84, 70.79, 77.02, 83.53, 90.31, 97.38, 104.7, 112.3, 120.2, 128.4, 136.8, 145.6, 154.6, 163.8, 173.4, 183.2, 193.3, 203.7, 214.4, 225.3, 236.5, 248, 259.8, 271.8, 284.2, 296.8, 309.6, 322.8, 336.2, 349.9, 363.9, 378.2, 392.7, 407.5, 422.6, 438, 453.6, 469.5, 485.7, 502.2, 519, 536, 553.3, 570.9, 588.8, 606.9, 625.3, 644, 663, 682.2, 701.7, 721.5, 741.6, 762, 782.6, 803.5, 824.7, 846.2, 867.9, 889.9, 912.2, 934.8, 957.6, 980.7, 1004, 1028, 1052, 1076, 1100, 1125, 1150, 1176, 1201, 1227, 1253, 1280, 1307, 1334, 1361, 1388, 1416, 1444, 1473, 1501, 1530, 1559, 1589, 1619, 1649, 1679, 1710, 1741, 1772, 1803, 1835, 1867, 1899, 1932, 1964, 1998, 2031, 2065, 2098, 2133, 2167, 2202, 2237], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 123.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.687, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 77e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 135e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 194e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.124, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.396, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.126, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2525e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.618, 3.321, 2.822, 2.933, 3.106, 3.648, 4.439, 5.02, 6.789, 6.726, 8.701, 10.45, 11.01, 12.83, 13.96, 16.63, 17.77, 19.66, 22.11, 24.36, 26.74, 29.23, 31.85, 34.59, 37.46, 40.44, 43.55, 46.77, 50.12, 53.59, 57.19, 60.9, 64.74, 68.7, 72.78, 76.98, 81.3, 85.75, 90.32, 95.01, 99.82, 104.8, 109.8, 115, 120.3, 125.7, 131.2, 136.9, 142.7, 148.6, 154.6, 160.8, 167.1, 173.4, 180, 186.6, 193.4, 200.2, 207.2, 214.4, 221.6, 229, 236.5, 244.1, 251.8, 259.7, 267.7, 275.8, 284, 292.3, 300.8, 309.4, 318.1, 326.9, 335.9, 344.9, 354.1, 363.5, 372.9, 382.5, 392.1, 401.9, 411.9, 421.9, 432.1, 442.4, 452.8, 463.3, 474, 484.8, 495.7, 506.7, 517.8, 529.1, 540.5, 552, 563.6, 575.4, 587.3, 599.3, 611.4, 623.6, 636, 648.5, 661.1, 673.8, 686.7, 699.6, 712.7, 725.9, 739.3, 752.7, 766.3, 780, 793.8, 807.8, 821.9, 836, 850.4, 864.8, 879.3, 894, 908.8, 923.7, 938.8, 953.9, 969.2, 984.6], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings.2": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 2.",
      values: {
        C2: {
          tension: { value: 123.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.687, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 152e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0156, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 12e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.042, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.415, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.178, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.06328, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 100, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3541, 1.447, 1.343, 2.086, 3.091, 4.277, 4.652, 8.339, 7.746, 11.3, 9.523, 12.53, 13.15, 16.85, 19.29, 21.9, 24.69, 27.66, 30.81, 34.14, 37.65, 41.34, 45.21, 49.26, 53.49, 57.91, 62.5, 67.27, 72.22, 77.35, 82.66, 88.15, 93.82, 99.68, 105.7, 111.9, 118.3, 124.9, 131.6, 138.6, 145.7, 153, 160.4, 168.1, 175.9, 183.9, 192.1, 200.5, 209.1, 217.8, 226.7, 235.8, 245.1, 254.5, 264.1, 274, 284, 294.1, 304.5, 315, 325.7, 336.6, 347.7, 358.9, 370.4, 382, 393.8, 405.8, 417.9, 430.2, 442.8, 455.5, 468.3, 481.4, 494.6, 508, 521.6, 535.4, 549.3, 563.5, 577.8, 592.3, 607, 621.8, 636.8, 652.1, 667.5, 683, 698.8, 714.7, 730.8, 747.1, 763.6, 780.3, 797.1, 814.1, 831.3, 848.7, 866.2, 884, 901.9, 920, 938.2, 956.7, 975.3, 994.2, 1013, 1032, 1052, 1071, 1091, 1111, 1131, 1151, 1172, 1192, 1213, 1234, 1255, 1276, 1298, 1320, 1342, 1364, 1386, 1408, 1431, 1454], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 140.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.683, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 108e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 794e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 218e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.06, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.396, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.171, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2597e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5419, 2.061, 1.397, 2.238, 2.824, 4.662, 4.559, 6.249, 9.146, 7.518, 11.76, 15.44, 15.5, 18.84, 21.65, 24.66, 27.89, 31.32, 34.97, 38.82, 42.88, 47.14, 51.62, 56.3, 61.19, 66.29, 71.6, 77.11, 82.84, 88.77, 94.91, 101.3, 107.8, 114.6, 121.5, 128.7, 136.1, 143.7, 151.5, 159.5, 167.8, 176.2, 184.8, 193.7, 202.7, 212, 221.4, 231.1, 241, 251.1, 261.4, 271.9, 282.6, 293.6, 304.7, 316, 327.6, 339.4, 351.3, 363.5, 375.9, 388.5, 401.3, 414.3, 427.5, 440.9, 454.6, 468.4, 482.4, 496.7, 511.2, 525.8, 540.7, 555.8, 571.1, 586.6, 602.3, 618.2, 634.4, 650.7, 667.3, 684, 701, 718.1, 735.5, 753.1, 770.9, 788.9, 807.1, 825.5, 844.2, 863, 882, 901.3, 920.8, 940.4, 960.3, 980.4, 1001, 1021, 1042, 1063, 1084, 1105, 1127, 1149, 1171, 1193, 1215, 1238, 1260, 1283, 1307, 1330, 1354, 1377, 1402, 1426, 1450, 1475, 1500, 1525, 1550, 1576, 1601, 1627, 1653, 1680], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 137.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.694, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 913e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 333e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.034, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.433, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.17, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 269e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 88, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.806, 1.533, 3.357, 2.43, 2.866, 3.355, 4.746, 6.538, 6.758, 10.19, 10.16, 17.02, 12.49, 17.48, 20, 24.24, 25.58, 28.66, 31.92, 35.36, 38.99, 42.81, 46.81, 51, 55.38, 59.94, 64.69, 69.63, 74.75, 80.05, 85.55, 91.23, 97.09, 103.1, 109.4, 115.8, 122.4, 129.2, 136.2, 143.4, 150.7, 158.3, 166, 173.9, 182, 190.3, 198.8, 207.4, 216.3, 225.3, 234.5, 243.9, 253.5, 263.3, 273.3, 283.4, 293.7, 304.3, 315, 325.9, 336.9, 348.2, 359.7, 371.3, 383.1, 395.1, 407.3, 419.7, 432.3, 445.1, 458, 471.1, 484.4, 497.9, 511.6, 525.5, 539.6, 553.8, 568.2, 582.9, 597.7, 612.7, 627.8, 643.2, 658.7, 674.5, 690.4, 706.5, 722.8, 739.3, 755.9, 772.8, 789.8, 807.1, 824.5, 842.1, 859.9, 877.8, 896, 914.3, 932.9, 951.6, 970.5, 989.6, 1009, 1028, 1048, 1068, 1088, 1108, 1128, 1149, 1170, 1191, 1212, 1233, 1255, 1276, 1298, 1320, 1343, 1365, 1388, 1410, 1433, 1457, 1480, 1504], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 147.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.694, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 781e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 159e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 235e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.076, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.397, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.179, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2379e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.731, 2.427, 3.537, 3.893, 3.95, 5.767, 8.763, 7.577, 10.27, 8.258, 11.58, 14.45, 14.19, 19.72, 19.28, 23.65, 24.73, 28.67, 31.77, 35.05, 38.51, 42.15, 45.96, 49.95, 54.11, 58.46, 62.98, 67.67, 72.55, 77.6, 82.83, 88.24, 93.82, 99.59, 105.5, 111.6, 117.9, 124.4, 131.1, 137.9, 144.9, 152.1, 159.4, 167, 174.7, 182.6, 190.6, 198.9, 207.3, 215.9, 224.7, 233.6, 242.7, 252.1, 261.5, 271.2, 281, 291.1, 301.3, 311.6, 322.2, 332.9, 343.8, 354.9, 366.1, 377.6, 389.2, 401, 412.9, 425.1, 437.4, 449.9, 462.6, 475.4, 488.5, 501.7, 515.1, 528.6, 542.4, 556.3, 570.4, 584.6, 599.1, 613.7, 628.5, 643.5, 658.7, 674, 689.5, 705.2, 721.1, 737.1, 753.3, 769.7, 786.3, 803.1, 820, 837.1, 854.4, 871.9, 889.5, 907.3, 925.3, 943.5, 961.8, 980.4, 999.1, 1018, 1037, 1056, 1076, 1095, 1115, 1135, 1155, 1175, 1196, 1217, 1237, 1258, 1280, 1301, 1322, 1344, 1366, 1388, 1410, 1433], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    }
  }
};

// registry/players/bowed.json
var bowed_default2 = {
  schema: "musebots.registry-players/1",
  about: "What the players of the bowed strings do, on the objects' tree (registry/README.md): a node's values are its players'; one a node does not give, its parent's.",
  nodes: {
    instrument: {
      values: {
        legato: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note slurred to on recordings, or a change of bow, goes on from past the next recording's own measured attack, crossfaded over this, the pitch stepping, never sliding (a finger's change; a slide is a glissando's, asked for) -- every seat's, a string's as a wind's", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }] },
        vibrato: {
          spread: {
            rate: { value: 0.35, unit: "Hz, a normal deviate's scale", kind: "unmeasured", reason: "ours: how far a player's rate lies from their instrument's, between players (each seat drawn once): within the measured spreads, cellists' 0.28-0.42 Hz, singers' 0.4", searched: [{ where: "arXiv", query: "hu-2025: cellists' vibrato by string register", date: "2026-10-29", found: "cellists' depth (half the peak-to-peak) rising with the stopped note's place toward the bridge, fitted 63.8 (x - 0.054)^2 + 3.31 cents over x, its place as a share of the string from the nut (R^2 0.51, 94 excerpts); rates 5.26 Hz (s.d. 0.28, TinySOL's players) and 6.48 Hz (s.d. 0.42, three soloists' concerto recordings); no one width an instrument's" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }] },
            width: { value: 0.2, unit: "share of the width, a normal deviate's scale in its logarithm", kind: "unmeasured", reason: "ours: how far a player's width lies from their instrument's, between players: near singers' 0.13 between them and one violinist's 0.18 between notes", searched: [{ where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] }
          },
          ending: {
            seconds: { value: 0.8, unit: "s", kind: "unmeasured", reason: "ours: a note's rate rising over its last seconds this long, as singers' and a string player's rise toward a note's end", searched: [{ where: "web search", query: 'Prame 1994 "Measurements of the vibrato rate of ten singers" rate increases toward end of tone', date: "2026-10-29", found: "singers' rate rising over a long note's last few cycles (Prame 1994, by secondary accounts: 'a couple of Hz', 15%), not string players'; Desain, Honing, Aarts & Timmers 1999 show a string player's rate rising toward a note's end, its slope not tabulated" }] },
            share: { value: 0.05, unit: "share of its rate", kind: "unmeasured", reason: "ours: its rate this share faster at the note's end, under singers' 15%", searched: [{ where: "web search", query: 'Prame 1994 "Measurements of the vibrato rate of ten singers" rate increases toward end of tone', date: "2026-10-29", found: "singers' rate rising over a long note's last few cycles (Prame 1994, by secondary accounts: 'a couple of Hz', 15%), not string players'; Desain, Honing, Aarts & Timmers 1999 show a string player's rate rising toward a note's end, its slope not tabulated" }] }
          },
          drift: {
            rate: { value: 0.03, unit: "share of its rate", kind: "unmeasured", reason: "ours: a note's rate wandering slowly by this share", searched: [{ where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }] },
            width: { value: 0.1, unit: "share of its width", kind: "unmeasured", reason: "ours: its width wandering slowly by this share, under singers' 0.18 within a tone", searched: [{ where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }] },
            hertz: { value: 0.7, unit: "Hz", kind: "unmeasured", reason: "ours: how fast its rate and width wander", searched: [{ where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }] }
          },
          onset: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: its width growing over this once its vibrato begins, as singers' extent grows over a tone's beginning", searched: [{ where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }, { where: "registry sources", query: "geringer-allen-macleod-2005, allen-geringer-macleod-2009: vibrato's start", date: "2026-10-29", found: "a stretch without vibrato where a note changes, 0.42 s for university players, 0.33 s for an artist, and no consistent first direction; how fast its width grows once it starts not given" }] },
          scope: { value: 0.3333333333333333, unit: "share of the players' measured widths", kind: "unmeasured", reason: "ours: the scope of vibrato a piece gives an instrument, where its spec names none, drawn once a piece this wide about a centre anywhere from none to all -- the style a conductor brings to a piece", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }] },
          arc: {
            apex: { value: 0.4, unit: "weight", kind: "unmeasured", reason: "ours: a note's vibrato intensity in its phrase, this much for its nearness to the phrase's apex", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            length: { value: 0.35, unit: "weight", kind: "unmeasured", reason: "ours: this much for its length past its delay", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            accent: { value: 0.15, unit: "weight", kind: "unmeasured", reason: "ours: this much for its accent", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            base: { value: 0.25, unit: "1", kind: "unmeasured", reason: "ours: the intensity's floor", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            fullSeconds: { value: 1.2, unit: "s", kind: "unmeasured", reason: "ours: a note this long past its delay counts as long", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            sooner: { value: 0.5, unit: "share of its delay", kind: "unmeasured", reason: "ours: its delay shortened by this share at full intensity", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            deepen: {
              share: { value: 0.25, unit: "share of its width", kind: "unmeasured", reason: "ours: its width growing by this share through a long note", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
              seconds: { value: 1.5, unit: "s", kind: "unmeasured", reason: "ours: over these seconds", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
            },
            taper: {
              seconds: { value: 0.15, unit: "s", kind: "unmeasured", reason: "ours: its width narrowing over these last seconds into a change or an end", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
              share: { value: 0.2, unit: "share of the note", kind: "unmeasured", reason: "ours: at most this share of the note", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
            },
            quicker: { value: 0.06, unit: "share of its rate", kind: "unmeasured", reason: "ours: its rate this share faster at full intensity than at none", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            peak: { value: 0.6, unit: "share of its phrase", kind: "unmeasured", reason: "ours: where a caller names no apex, its phrase's taken this far through it", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            delay: { value: 0.35, unit: "s", kind: "unmeasured", reason: "ours: where a caller names no delay, this, within the measured 0.33-0.42 s", searched: [{ where: "registry sources", query: "geringer-allen-macleod-2005, allen-geringer-macleod-2009: vibrato's start", date: "2026-10-29", found: "a stretch without vibrato where a note changes, 0.42 s for university players, 0.33 s for an artist, and no consistent first direction; how fast its width grows once it starts not given" }] },
            fullAccent: { value: 6, unit: "dB", kind: "unmeasured", reason: "ours: an attack this many dB above its phrase's curve fully accented, for its vibrato's intensity", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
          }
        },
        phraseAttack: {
          metre: { value: 1.5, unit: "dB", kind: "unmeasured", reason: "ours: a note on the bar's strongest position this many dB louder than on its weakest (KTH's metrical accents, sized by us)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          crisper: { value: 0.3, unit: "share of its tonguing time", kind: "unmeasured", reason: "ours: tongued this share the quicker on the strongest position, gentler on the weakest", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          high: { value: 1, unit: "dB an octave", kind: "unmeasured", reason: "ours: an octave above its part's centre this many dB louder, below it softer -- a third of Friberg 1991's High Loud at k = 1 (3 dB an octave)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          cents: { value: 4, unit: "cents an octave, and at most", kind: "literature", source: "friberg-1991", note: "High Sharp: 'pitch is sharpened by 4 cents/octave relative to equal temperament' at k = 1; held to an octave's worth at most, ours" },
          softer: { value: 3, unit: "dB", kind: "unmeasured", reason: "ours: a wind's re-entry after a catch breath this many dB softer", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          gentler: { value: 2.5, unit: "times its tonguing time", kind: "unmeasured", reason: "ours: and tongued this many times as slowly", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          carry: { value: 0.6, unit: "share", kind: "unmeasured", reason: "ours: a new phrase's first attacks begun from its last phrase's last, this share of the difference (the owner, 2 October 2026: a hysteresis of attacks after a phrase's ending)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          settle: { value: 1, unit: "beats", kind: "unmeasured", reason: "ours: that share halving every this many beats into the new phrase", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] }
        },
        noise: {
          timing: {
            sd: { value: 0.012, unit: "s", kind: "literature", source: "hennig-2011", note: "the lowest standard deviation of a beat from a metronome, experienced musicians' ('s ≈ 12 ms'; the average 21 ms): a competent player's, at temperature 1" },
            beta: { value: 1, unit: "its power falling as 1/f^beta, f in cycles an event", kind: "literature", source: "hennig-2011", note: "drummers' deviations, in two songs' recordings (1.1, 0.8) and tapping with a stick (0.9, 1.0) (Table 1); voices' 0.2-0.5; across every task 0.2-1.3, no one exponent" },
            low: { value: 1e-3, unit: "cycles an event", kind: "unmeasured", reason: "ours: the deviations correlated over a piece's thousand notes, flat beyond", searched: [{ where: "registry sources", query: "hennig-2011: over what span of beats a player's deviations stay correlated", date: "2026-11-01", found: "power laws over each whole recording (its fluctuation functions, Fig. 2C), no corner found either way; exponents 0.2 to 1.3" }] },
            high: { value: 0.45, unit: "cycles an event", kind: "unmeasured", reason: "ours: to just under half the rate of notes, from one note to the next", searched: [{ where: "registry sources", query: "hennig-2011: over what span of beats a player's deviations stay correlated", date: "2026-11-01", found: "power laws over each whole recording (its fluctuation functions, Fig. 2C), no corner found either way; exponents 0.2 to 1.3" }] }
          },
          tremor: {
            hz: { value: 10, unit: "Hz", kind: "literature", source: "mcauley-marsden-2000", note: "physiological tremor's central part, the CNS's '10-Hz range oscillatory activity' (its abstract), one of its several origins" },
            q: { value: 2, unit: "its frequency over its bandwidth", kind: "unmeasured", reason: "ours: a resonance as broad as the 10-Hz range's, several origins' sum", searched: [{ where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] },
            share: { value: 0.2, unit: "of a continuous action's variance", kind: "unmeasured", reason: "ours: a part of the hand's and breath's fluctuation, heard as a slight shimmer, never a vibrato", searched: [{ where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] }
          },
          action: {
            beta: { value: 1, unit: "its power falling as 1/f^beta", kind: "unmeasured", reason: "ours: a continuous action's fluctuation taken as the timing's, a hand's or breath's as a beat's", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }, { where: "web search", query: "wind instrument player blowing pressure fluctuation steady tone measured variability percent clarinet saxophone", date: "2026-11-01", found: "Fuks & Sundberg: blowing pressure systematic with loudness and pitch in professional oboe, bassoon, clarinet and alto saxophone players; no fluctuation within a steady tone in what was found" }] },
            low: { value: 0.05, unit: "Hz", kind: "unmeasured", reason: "ours: drifts slower than a long note's twenty seconds flat", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            high: { value: 20, unit: "Hz", kind: "unmeasured", reason: "ours: a hand's or breath's control, to past its tremor", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }, { where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] }
          },
          bow: {
            force: { value: 0.03, unit: "a share of the force asked", kind: "unmeasured", reason: "ours: slight, a bow's weight held steady to a few per cent", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            speed: { value: 0.03, unit: "a share of the speed asked", kind: "unmeasured", reason: "ours: slight, as its force", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            contact: { value: 2e-3, unit: "a share of the string's length", kind: "unmeasured", reason: "ours: well under a millimetre on a violin's string, the bow's drift across it", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] }
          },
          finger: {
            pitch: { value: 1.5, unit: "cents", kind: "unmeasured", reason: "ours: under a steady tone's difference limen (2.5-2.8 cents), the stopping finger's roll", searched: [{ where: "web search", query: "violin intonation pitch fluctuation within sustained note without vibrato cents standard deviation measured", date: "2026-11-01", found: "no deviation in cents of a note held without vibrato; a steady tone's pitch difference limen 2.5-2.8 cents (Brown & Vaughn 1996); Ando & Yamaguchi (1993) measured C5's fluctuations on several instruments with and without vibrato, not read" }] }
          },
          breath: {
            pressure: { value: 0.015, unit: "a share of the pressure asked", kind: "unmeasured", reason: "ours: slight, a breath's support held to a per cent or two", searched: [{ where: "web search", query: "wind instrument player blowing pressure fluctuation steady tone measured variability percent clarinet saxophone", date: "2026-11-01", found: "Fuks & Sundberg: blowing pressure systematic with loudness and pitch in professional oboe, bassoon, clarinet and alto saxophone players; no fluctuation within a steady tone in what was found" }, { where: "KTH, L. Fuks's thesis page (speech.kth.se/music/publications/leofuks/thesis/summaries.html)", query: "Paper I, Blowing pressures in bassoon, clarinet, oboe and saxophone: its summary", date: "2026-11-01", found: "some players' vibrato, its pressure 1.5-3.0 cmH2O peak to peak; no fluctuation of a tone held without it" }] }
          },
          lips: {
            tension: { value: 0.01, unit: "a share of the tension asked", kind: "unmeasured", reason: "ours: slight, the embouchure held", searched: [{ where: "web search", query: "brass player lip tension embouchure fluctuation steady note pitch jitter measured trumpet", date: "2026-11-01", found: "embouchure muscles' activity rising with pitch and loudness (Watson & Price 2020, trumpeters' EMG; Hirano, horn players); jitter and shimmer larger with embouchure dystonia (Morris et al., an abstract); mouthpiece force against pitch, loudness and mouth pressure in 31 players (Amann et al., Forum Acusticum 2025, not read); no fluctuation of the lips' tension within a steady note" }] }
          },
          dither: {
            tuning: { value: 0.5, unit: "cents, a seat's for the piece", kind: "unmeasured", reason: "ours: enough that no two seats' partials stand exactly aligned, too little to be heard as out of tune", searched: [{ where: "web search", query: "violin intonation pitch fluctuation within sustained note without vibrato cents standard deviation measured", date: "2026-11-01", found: "no deviation in cents of a note held without vibrato; a steady tone's pitch difference limen 2.5-2.8 cents (Brown & Vaughn 1996); Ando & Yamaguchi (1993) measured C5's fluctuations on several instruments with and without vibrato, not read" }] },
            contact: { value: 1e-3, unit: "a share of the string's length, a seat's for the piece", kind: "unmeasured", reason: "ours: no two seats bowing at exactly one place", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] }
          }
        }
      }
    },
    "violin-family": {
      values: {
        contactSoft: { range: [0.15, 0.35], unit: "the bow's contact point, a share of the string's length from the bridge, at ppp", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contact about 0.3 at pp" },
        contactLoud: { range: [0.02, 0.06], unit: "the bow's contact point at fff", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contact about 0.03 at f" },
        contacts: { range: [0.03, 0.3], unit: "the bow's contact point, a share of the string's length from the bridge", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contacts as they bow ordinario, from near the bridge to over the fingerboard: 0.03-0.3 in all" },
        place: { range: [0.15, 0.85], unit: "a force's place in its note's window of Helmholtz motion, at ppp and at fff (0 its least edge, 1 its most)", kind: "unmeasured", reason: "a choice, not a measurement: anywhere in the window but its edges, where a seed's noise would leave it", searched: [{ where: "the bowing literature read for the strings' fits (research/STRINGS_FITTED_BOWING.md)", date: "2026-10-19", found: "players' forces measured against their windows nowhere" }] },
        stoppingFinger: {
          damping: { value: 0.7, unit: "N s/m", kind: "literature", source: "wiertlewski-hayward-2012", note: "a fingertip's mechanical impedance, its real part 0.6-0.8 N s/m from 100 to 500 Hz (read from its Fig. 11: one finger pressing 0.6 N, probed normal to the skin): the stopping finger's damping of the string under it, the engine's R_FINGER (Artifastring's own 30 kg/s, unmeasured, damped stopped notes dead in 0.2 s and made the high notes' sidebands, MODELING_GAPS.md). Not measured: a string moving along the fingerboard under the pad (a shear, not this push), at a player's force, past 500 Hz", measuredOn: ["fingertip"] },
          padStiffness: { value: 600, unit: "N/m", kind: "literature", source: "wiertlewski-hayward-2012", note: "the same fingertip's stiffness, from its impedance's imaginary part (its Fig. 11, k = -omega Im Z with its 0.2 g mass): about 500 N/m at 20 Hz and 640-660 at 50-100 Hz, where it acts as a spring, one finger pressing 0.6 N, probed normal to the skin. A light touch (a harmonic's, a multiphonic's) is this spring and `damping` together, a Kelvin element as measured; a touch lighter than this one, its stiffness and damping in proportion (ours: a smaller contact of the same pad, unmeasured); one pressing harder, its damping held at `damping` while the string is pressed to the fingerboard (how a pad's damping grows with force unmeasured, MODELING_GAPS.md)", measuredOn: ["fingertip"] },
          dampingArtifastring: { value: 30, unit: "N s/m", kind: "other", source: "artifastring", note: "Artifastring's own R_FINGER (its artifastring_constants.h), set by its author, not measured: the engine's finger before the measured one, kept so that a setting kept before is heard as it was then" }
        },
        mostForce: { value: 2.5, unit: "N", kind: "literature", source: "schoonderwaldt-2009", note: "observed maxima bow force 2.5 N, of violinists and violists", measuredOn: ["violin", "viola"], passes: { by: "scale-ratio", inputs: { a: "forceScale" }, reference: "violin", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] } },
        forceScale: { kind: "borrowed", derive: { equation: "least-force-scale", inputs: { scale: "player:cello:forceScale", Z: "object:strings.*.impedance", c0: "object:cello.0:strings.C2.impedance", c1: "object:cello.1:strings.C2.impedance", c2: "object:cello.2:strings.C2.impedance" } }, unit: "1", note: "an instrument with strings of its own: the cello's scale by its lowest string's impedance squared over the cello's C strings' (rounded to hundredths until 29 October 2026)", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        force: {
          ppp: { value: 0.16, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at ppp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          pp: { value: 0.25, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at pp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          p: { value: 0.4, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at p where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          mp: { value: 0.6, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at mp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          mf: { value: 0.8, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at mf where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          f: { value: 1.1, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at f where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          ff: { value: 1.4, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at ff where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          fff: { value: 1.8, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at fff where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] }
        },
        places: {
          ponticello: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: where a player bows sul ponticello, at the bridge, its bow moved toward it from ordinario as far as its contact asks (a stroke's contact -1)", searched: [{ where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013); no sul ponticello's or sul tasto's measured" }] },
          tasto: { value: 0.2, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: where a player bows sul tasto, over the fingerboard's end (a stroke's contact 1)", searched: [{ where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013); no sul ponticello's or sul tasto's measured" }] }
        },
        attack: {
          seconds: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: a stroke's attack where its stroke names none, never more than `share` of its note", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] },
          from: { value: 0.25, unit: "share of its force", kind: "unmeasured", reason: "ours: the force its bow is set on the string at, a share of its own, raised to its own over its attack, where neither its variant's attack model nor the calibration gives one", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] },
          share: { value: 0.5, unit: "share of its note", kind: "unmeasured", reason: "ours: an attack no longer than this share of its note (a pianissimo's quarter-second swell over a note of a tenth never reached its bow)", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] }
        },
        change: {
          reversal: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a change of bow's reversal, the bow through zero at the change's time", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
          tremoloReversal: { value: 0.3, unit: "share of its stroke", kind: "unmeasured", reason: "ours: a tremolo's strokes reverse at most over this share of each, none bitten (each stroke's accent had made its tremolo a rattle)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
          bite: {
            change: { value: 1.35, unit: "times its force", kind: "unmeasured", reason: "ours: the force raised by this as the bow takes the string again at a change of bow at a new note (a detache's)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
            held: { value: 1.12, unit: "times its force", kind: "unmeasured", reason: "ours: and by this at a change of bow inside a held note", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] }
          },
          planned: { value: 0.04, unit: "s", kind: "unmeasured", reason: "ours: how long a change of bow's direction takes as its bow is planned (bow.js BOW.changeSeconds), a change inside a held note included -- the compiler draws it over `reversal`, 0.05 s: two values for one change (MODELING_GAPS)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bow change's or retake's duration" }] },
          biteFor: { value: 0.03, unit: "s", kind: "unmeasured", reason: "ours: the force back to its own this long after the reversal", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] }
        },
        release: { value: [0.12, 0.32], unit: "s", kind: "unmeasured", reason: "ours: a release's force eased to nothing over a span between these, each note's its player's own, the bow still moving, the string left to ring (a section's sixty bows leaving the string at one instant had clicked, Op. 3.5)", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "spiccato's tails (Guettler & Askenfelt); a violin offset detector's envelopes (ISMIR 2015); no player's release measured" }] },
        onset: {
          force: { value: 0.7, unit: "times its noise", kind: "unmeasured", reason: "ours: a stroke with an articulation's point pressed heavier by this times its noise, past what its speed takes cleanly (the pre-Helmholtz transient's prolonged periods, Guettler 2002): half the change of bow's bite at a noise of half; to be replaced by the strings' articulation fit", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] }
        },
        lifted: { value: 0.03, unit: "s", kind: "unmeasured", reason: "ours: a stroke ended with its bow stopped on the string lifted this long before the next stroke at the latest", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "spiccato's tails (Guettler & Askenfelt); a violin offset detector's envelopes (ISMIR 2015); no player's release measured" }] },
        slur: { value: 0.012, unit: "s", kind: "unmeasured", reason: "ours: a slur's finger change", searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] },
        loure: {
          within: { value: 0.1, unit: "semitones", kind: "unmeasured", reason: "ours: a pitch slurred to again within this of the one before is loure, one bow, each note marked by the bow slowed on the string", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          seconds: { value: 0.08, unit: "s", kind: "unmeasured", reason: "ours: its slowing over this round the note's time (the bow's following at least)", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          speed: { value: 0.2, unit: "share of its speed", kind: "unmeasured", reason: "ours: the bow slowed to this share of its speed (at 0.35 at its full weight a cello's string ground on, its dip 1.7 dB)", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          force: { value: 0.35, unit: "share of its force", kind: "unmeasured", reason: "ours: and lightened to this share of its weight (Schelleng's most force falls with the bow's speed): the legato test's phrases dipping 12-13 dB on the violin, 5-6.5 the viola, 4.5-6.4 the cello, 8-15 the contrabass, each under its change of bow's", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] }
        },
        follow: {
          periods: { value: 10, unit: "periods", kind: "unmeasured", reason: "ours: a bow slowed over this many of its note's periods at least -- a string's motion follows its bow's speed only as fast as its corner goes round, once a period (a bow slowed in 25 ms had left a cello's D string ringing)", searched: [{ where: "web search", query: "Helmholtz motion response to bow velocity change number of periods transient Guettler Woodhouse bowed string", date: "2026-10-29", found: "attack transients' durations by bow force and acceleration (the Guettler diagram); no count of the periods a string's motion takes to follow its bow's change of speed" }] },
          share: { value: 0.3, unit: "share of its note", kind: "unmeasured", reason: "ours: and over no more than this share of the note it slows in", searched: [{ where: "web search", query: "Helmholtz motion response to bow velocity change number of periods transient Guettler Woodhouse bowed string", date: "2026-10-29", found: "attack transients' durations by bow force and acceleration (the Guettler diagram); no count of the periods a string's motion takes to follow its bow's change of speed" }] }
        },
        draw: {
          start: { value: 0.12, unit: "share of the bow from the frog", kind: "unmeasured", reason: "ours: a stroke from silence begun down-bow this far from the frog, up-bow as far from the tip", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          frog: { value: 0.1, unit: "share of its force", kind: "unmeasured", reason: "ours: its weight this much heavier at the frog, where the bow's own bears on the string, eased to nothing by the middle (Mizuho & Sugiura 2025: experienced violinists' down-bows heavier at the frog than in the middle)", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          middle: { value: 0.5, unit: "share of the bow from the frog", kind: "unmeasured", reason: "ours: the bow's middle, from which on its own weight adds nothing; its weight on the whole about its own", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          coupled: { value: 0.5, unit: "1", kind: "unmeasured", reason: "ours: its speed wandering this share of the way with its weight -- players draw faster as they press harder, to keep from roughness (Blanco et al. 2021, as Mizuho and Sugiura cite it); wandering apart, a contrabass's and a cello's re-bowed notes left Helmholtz motion", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          drift: {
            pressure: { value: 0.05, unit: "share of its force", kind: "unmeasured", reason: "ours: its weight wandering slowly by this share", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
            speed: { value: 0.02, unit: "share of its speed", kind: "unmeasured", reason: "ours: its speed by this share on its own", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
            contact: { value: 0.04, unit: "share of its contact", kind: "unmeasured", reason: "ours: its place by this share on its own", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] }
          },
          slow: { value: [2.3, 0.9, 0.45], unit: "s", kind: "unmeasured", reason: "ours: the periods of the slow sines its wandering sums", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          tremor: { value: 0.01, unit: "share", kind: "unmeasured", reason: "ours: its hand's small tremor, a share of each", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          tremorHz: { value: [5.5, 8.5], unit: "Hz", kind: "unmeasured", reason: "ours: its tremor's rate, each player's own between these", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          settle: { value: 0.2, unit: "s", kind: "unmeasured", reason: "ours: its wandering grown in over this once its attack has taken the string (begun at once, a violin's first note spoke 95 ms later for being begun 36 ms earlier)", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] }
        },
        pluck: {
          position: { value: 0.2, unit: "share of the string", kind: "unmeasured", reason: "ours: where a string is plucked where the calibration has no place for it", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
          pull: {
            ppp: { value: 0.03, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at ppp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            pp: { value: 0.05, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at pp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            p: { value: 0.1, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at p where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            mp: { value: 0.15, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at mp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            mf: { value: 0.3, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at mf where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            f: { value: 0.5, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at f where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            ff: { value: 0.6, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at ff where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            fff: { value: 0.75, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at fff where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] }
          }
        },
        damp: {
          stopped: { value: 0.12, unit: "s", kind: "unmeasured", reason: `ours: a pluck stopped at its note's end, its fundamental down 60 dB in this, a stopped note's finger eased off the string it holds (the owner, 5 October 2026: "The default is that pizz is damped")`, searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] },
          open: { value: 0.3, unit: "s", kind: "unmeasured", reason: "ours: an open string's later and less at once, a free finger of either hand brought to it", searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] }
        },
        pressure: {
          flautando: {
            speed: { value: 1.6, unit: "times its speed", kind: "unmeasured", reason: "ours: at flautando the bow drawn this many times faster", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            contact: { value: 0.2, unit: "share of the string", kind: "unmeasured", reason: "ours: its place no nearer the bridge than this", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            force: { value: 0.35, unit: "times its force", kind: "unmeasured", reason: "ours: and lightened to this, the string still in Helmholtz motion; each instrument's replaced by its measured (CALIBRATION.pressure)", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          },
          overpressure: {
            speed: { value: 0.6, unit: "times its speed", kind: "unmeasured", reason: "ours: at overpressure the bow drawn this much slower", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            force: { value: 4, unit: "times its force", kind: "unmeasured", reason: "ours: and this much heavier, past Schelleng's most at its place", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          }
        },
        beyond: {
          quiet: { value: [0.6, 0.4, 0.28, 0.2, 0.15], unit: "times its force", kind: "unmeasured", reason: "ours: each mark beyond ppp its ppp bow's force times these, lighter and lighter toward a string that hardly speaks (the owner's uncomfortable range), where its instrument's fitted multiples are not known", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
          loud: { value: [1.6, 2.4, 3.2, 4, 4.8], unit: "times its force", kind: "unmeasured", reason: "ours: each mark beyond fff its fff bow's force times these, heavier and heavier past Schelleng's most", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
          speed: {
            quiet: { value: [1, 1, 1, 1, 1], unit: "times its speed", kind: "unmeasured", reason: "ours: its speed unchanged beyond ppp where its instrument's fitted multiples are not known", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            loud: { value: [1, 1, 1, 1, 1], unit: "times its speed", kind: "unmeasured", reason: "ours: and beyond fff", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          }
        },
        speed: {
          ppp: { value: 5, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at ppp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          pp: { value: 6, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at pp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          p: { value: 10, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at p, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          mp: { value: 14, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at mp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          mf: { value: 20, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at mf, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          f: { value: 30, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at f, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          ff: { value: 40, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at ff, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          fff: { value: 50, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at fff, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] }
        },
        retake: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: a retake -- the bow lifted and set back at the frog or the tip -- takes this, a silence of its own", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bow change's or retake's duration" }] },
        stroke: {
          entry: {
            ppp: { value: 0.3, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at ppp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            pp: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at pp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            p: { value: 0.15, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at p, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            mp: { value: 0.1, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at mp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            mf: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at mf, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            f: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at f, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            ff: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at ff, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            fff: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at fff, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] }
          },
          lift: {
            least: { value: 0.2, unit: "s", kind: "unmeasured", reason: "ours: a note let go as a bow lifted from a ringing string over this at its loudest, where a new phrase's formation begins while it still sounds (articulation.js's bowed release, the same)", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "no player's release measured" }] },
            soft: { value: 0.18, unit: "s", kind: "unmeasured", reason: "ours: and this much longer at the softest", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "no player's release measured" }] }
          },
          bite: {
            ppp: { value: 0, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at ppp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            pp: { value: 0, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at pp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            p: { value: 0.01, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at p, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            mp: { value: 0.02, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at mp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            mf: { value: 0.035, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at mf, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            f: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at f, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            ff: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at ff, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            fff: { value: 0.09, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at fff, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] }
          },
          biteSpread: { value: 0.4, unit: "share of its bite", kind: "unmeasured", reason: "ours: each player's bite drawn its own within this share either side, so a section's re-attacks are a spread of its players', not one instant (the owner, 2 October 2026, of Op. 3.5)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
          biteLate: { value: [0.2, 0.5], unit: "share of its bite", kind: "unmeasured", reason: "ours: the share of each bite that is the new note's own lateness, drawn between these, the rest taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
          biteShare: { value: 0.25, unit: "share of the note it ends", kind: "unmeasured", reason: "ours: a bite never more than this share of the note it ends -- a stopped bow ends a note, it is not the note (a 95 ms note at ff had been bitten to 2 ms, a click)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] }
        },
        section: {
          deskApart: { value: 0.15, unit: "share of phrases", kind: "unmeasured", reason: "ours: how often a desk's two players take a technique apart, each by its own draw, a phrase -- a conductor seating its techniques by desk most of the time", searched: [{ where: "web search", query: "orchestra string section desk partners divisi how often split by stand inside outside player practice", date: "2026-10-29", found: "divisi by desk the usual practice, the outside player the upper line, the section leader deciding (Wikipedia, String section; violinschool.com; Duke string school); no frequency of a desk taking a technique apart" }] },
          sizes: {
            chamber: { value: [6, 5, 4, 3, 2], unit: "players: violins I, II, violas, cellos, basses", kind: "unmeasured", reason: "ours: a chamber orchestra's strings, authored from common practice", searched: [{ where: "web search", query: "string section sizes orchestra 16-14-12-10-8 10-8-6-5-4 6-5-4-3-2 typical numbers of players", date: "2026-10-29", found: "Brick's orchestration notes: 16-14-12-10-8, two fewer each section, a small orchestra 8-12 first violins so, two-player sections avoided; Wikipedia's String section: sizes vary widely (Die Walküre 16-16-12-12-8); no source for 10-8-6-5-4 or 6-5-4-3-2" }] },
            classical: { value: [10, 8, 6, 5, 4], unit: "players: violins I, II, violas, cellos, basses", kind: "unmeasured", reason: "ours: a classical orchestra's strings, authored from common practice", searched: [{ where: "web search", query: "string section sizes orchestra 16-14-12-10-8 10-8-6-5-4 6-5-4-3-2 typical numbers of players", date: "2026-10-29", found: "Brick's orchestration notes: 16-14-12-10-8, two fewer each section, a small orchestra 8-12 first violins so, two-player sections avoided; Wikipedia's String section: sizes vary widely (Die Walküre 16-16-12-12-8); no source for 10-8-6-5-4 or 6-5-4-3-2" }] },
            full: { value: [16, 14, 12, 10, 8], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "brick-orchestration-notes", note: '"if an orchestra has 16 1st Violins it will likely have 14 2nd violins, 12 Violas, 10 Celli, and 8 Basses"' },
            atmospheres: { value: [14, 14, 10, 10, 8], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "musicaustria-atmospheres", note: `Ligeti's Atmosphères (1961): "Orchestercode: 4 (4 Picc)/4/4 (Es)/3, KFag - 6/4 (C)/4/1 - Pf - 14/14/10/10/8", every player a part` },
            pithoprakta: { value: [12, 12, 8, 8, 6], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "boosey-pithoprakta", note: `Xenakis's Pithoprakta (1955-56): "2trbn-perc:xyl/wdbl-strings(12.12.8.8.6)", every player a part` }
          },
          specification: {
            moves: {
              stay: { value: 0.2, unit: "share of phrases", kind: "unmeasured", reason: "ours: from phrase to phrase, the same formation again this share of the time", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              between: { value: 0.35, unit: "share of phrases", kind: "unmeasured", reason: "ours: part of the way to a new one (a tenth drawn) this share; the rest a new one", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            groupings: {
              sections: { value: 5, unit: "weight", kind: "unmeasured", reason: "ours: each instrument its own pool, weighed so among the groupings", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              choirs: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: the choirs (violins, violas with cellos, basses), weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              all: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: the whole section one pool, weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            splits: {
              tutti: {
                range: { value: [0, 0], unit: "split", kind: "unmeasured", reason: "ours: tutti: one part a pool", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: tutti weighed so among the splits", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              divisi: {
                range: { value: [0.1, 0.5], unit: "split", kind: "unmeasured", reason: "ours: divisi, drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 3.5, unit: "weight", kind: "unmeasured", reason: "ours: divisi weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              most: {
                range: { value: [0.6, 0.95], unit: "split", kind: "unmeasured", reason: "ours: most players their own part, drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: most players their own weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              each: {
                range: { value: [1, 1], unit: "split", kind: "unmeasured", reason: "ours: every player their own part, as Atmosphères'", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: every player their own weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              }
            },
            textures: {
              one: {
                parts: { value: [1, 1], unit: "parts", kind: "unmeasured", reason: "ours: a pool of one part", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  line: { value: 3, unit: "weight", kind: "unmeasured", reason: "ours: one part a line above all", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: or a chord", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  figuration: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: or a figuration", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              },
              few: {
                parts: { value: [2, 6], unit: "parts", kind: "unmeasured", reason: "ours: a pool of a few parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  counterpoint: { value: 4, unit: "weight", kind: "unmeasured", reason: "ours: a few parts voices in counterpoint above all (the owner, 3 October 2026: textures primarily as counterpoint)", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: then chords", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  figuration: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: figurations", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  micropolyphony: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: a canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  cluster: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: a cluster", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  line: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom a line", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  pizzicati: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom pizzicati", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              },
              many: {
                parts: { value: [7, null], unit: "parts, most any", kind: "unmeasured", reason: "ours: a pool of many parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  micropolyphony: { value: 3, unit: "weight", kind: "unmeasured", reason: "ours: many parts the masses: micropolyphony", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  cluster: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: clusters", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  glissandi: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: glissandi", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  pizzicati: { value: 2, unit: "weight", kind: "unmeasured", reason: "ours: pizzicati clouds", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  counterpoint: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: counterpoint still", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom chords", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              }
            },
            pool: {
              centre: { value: [0.3, 0.7], unit: "share of its seats' compass", kind: "unmeasured", reason: "ours: a pool's centre drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              width: { value: [4, 12], unit: "semitones", kind: "unmeasured", reason: "ours: a pool's band drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              cluster: {
                base: { value: 1, unit: "semitones", kind: "unmeasured", reason: "ours: a cluster's band at least this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                perPart: { value: [0.25, 0.75], unit: "semitones a part", kind: "unmeasured", reason: "ours: and so much wider a part", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                mostParts: { value: 24, unit: "parts", kind: "unmeasured", reason: "ours: over this many parts at most", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              density: { value: [0.3, 1.5], unit: "onsets a second a part", kind: "unmeasured", reason: "ours: a cloud's density drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              level: { value: [0, 1], unit: "level, pp to ff", kind: "unmeasured", reason: "ours: a pool's level anywhere from pp to ff: the conductor's constraints say where a section is", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              tremolo: { value: [0, 0], unit: "share of tremolo", kind: "unmeasured", reason: "ours: none drawn (the owner, 3 October 2026: no tremolos inserted at random): a tremolo only where a spec or a conductor asks", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              contact: {
                share: { value: 0.3, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase's contact away from ordinario this share, a colour meant (the owner, 3 October 2026: sul tasto and sul ponticello to be heard)", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.4, unit: "of the way to the bridge or the fingerboard", kind: "unmeasured", reason: "ours: each that far at least, several just-noticeable differences", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                loud: { value: 0.4, unit: "of its reach", kind: "unmeasured", reason: "ours: its reach at its loudest this much of all the way, a loud phrase bowing near ordinario (the owner, 4 October 2026: too much extreme ponticello and tasto)", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 2, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              pressure: {
                share: { value: 0.2, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase pressed or lightened this share, flautando toward its softest, overpressure toward its loudest", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.35, unit: "of its reach", kind: "unmeasured", reason: "ours: each from this far", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              articulation: {
                share: { value: 0.4, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase given one articulation together this share; the rest its players' own attacks", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.15, unit: "along the named attacks", kind: "unmeasured", reason: "ours: as marked as this at least", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              technique: {
                share: { value: 0, unit: "share of phrases", kind: "unmeasured", reason: "ours: a wind's extended technique: none for strings, a wind section's spec gives its share", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.4, unit: "of its reach", kind: "unmeasured", reason: "ours: where a wind's spec gives a share, from this far", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              mute: {
                share: { value: 0, unit: "share of phrases", kind: "unmeasured", reason: "ours: a mute: none for strings, their mutes not modelled", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              harmonic: {
                share: { value: 0.12, unit: "share of phrases", kind: "unmeasured", reason: "ours: natural harmonics, a soft colour, this share of phrases", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                most: { value: 0.3, unit: "level", kind: "unmeasured", reason: "ours: only where its level is under this", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              multiphonic: {
                share: { value: 0.06, unit: "share of phrases", kind: "unmeasured", reason: "ours: the measured multiphonics that fit its harmony, a rarer colour at any level", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              players: { value: [1, 1], unit: "share of its players", kind: "unmeasured", reason: "ours: all play where no conductor above narrows it: the orchestra's conductor plans its breadth", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            rest: {
              from: { value: 0, unit: "share of the band's draw", kind: "unmeasured", reason: "ours: rests by the band's shared draw none, where no spec says", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              to: { value: 0, unit: "share of the band's draw", kind: "unmeasured", reason: "ours: and to none", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              ask: { value: 0.1, unit: "chance a phrase", kind: "unmeasured", reason: "ours: it asks its conductor to rest a phrase this seldom: strings rest seldom", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            solo: {
              ask: { value: 0.08, unit: "chance a phrase", kind: "unmeasured", reason: "ours: it asks to solo this seldom: a concertmaster's or a principal cellist's", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            parameters: {
              micropolyphony: {
                divisions: { value: [0, 1], unit: "share of its playable divisions", kind: "unmeasured", reason: "ours: each part's grid a share of this, spread over its parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                drift: { value: [0.03, 0.09], unit: "share slower a part", kind: "unmeasured", reason: "ours: each part this much slower than the last, the canon thickening", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                cantusNotes: { value: [12, 20], unit: "notes", kind: "unmeasured", reason: "ours: the cantus's length", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              glissandi: {
                spread: { value: [2, 4], unit: "semitones a second", kind: "unmeasured", reason: "ours: the speeds' spread, Xenakis's normal law (Pithoprakta), its size ours", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }] },
                seconds: { value: [0.8, 3.5], unit: "s", kind: "unmeasured", reason: "ours: a glissando's length", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }, { where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] },
                hold: { value: [0, 0.8], unit: "share of its note", kind: "unmeasured", reason: "ours: how much holds its first pitch before it slides, a pool's own, most nearer the top (the owner, 2 October 2026: fewer attacks straight into glissandi)", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
              },
              pizzicati: {
                seconds: { value: [0.12, 0.2], unit: "s", kind: "unmeasured", reason: "ours: a pluck held this long", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                pulse: { value: [0, 1], unit: "0 free, 1 on the meter's positions", kind: "unmeasured", reason: "ours: a cloud's pulse drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              chord: {
                pulse: { value: [0, 1], unit: "0 held, 1 every subdivision", kind: "unmeasured", reason: "ours: a chord's pulse drawn within this, most near its low end", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                gate: { value: [0.35, 1], unit: "share of the time to its next stroke", kind: "unmeasured", reason: "ours: a pulsed chord sounding this much", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              counterpoint: {
                pulse: { value: [0.35, 0.95], unit: "0 held, 1 every subdivision", kind: "unmeasured", reason: "ours: its parts' pulses spread over this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                rigor: { value: [0.4, 1], unit: "share", kind: "unmeasured", reason: "ours: its rule sets' rigour", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                imitation: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how often its lower parts imitate its top", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                prolation: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how often its imitation is a converging tempo canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              line: {
                rubato: { value: [0, 2e-3], unit: "share of its phrase", kind: "unmeasured", reason: "ours: a line's own lean over its conductor's beat at most this (the owner, 5 October 2026: no part wanting to drift; a 3% share had led an oboe a third of a second ahead)", searched: [{ where: "web search", query: "measured soloist melody leads or lags accompaniment ensemble asynchrony milliseconds expressive rubato melody over steady accompaniment", date: "2026-10-29", found: "a piano melody's lead, 20-50 ms (Goebl 2001, about 30 ms, mostly its louder attack's); professional ensembles' onsets tens of ms apart; no orchestral line's own rubato over its conductor's beat" }] },
                density: { value: [0, 1], unit: "share of the planner's range", kind: "unmeasured", reason: "ours: every density a line may take", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                planing: { value: [0, 0.5], unit: "share of entries", kind: "unmeasured", reason: "ours: a line shared by sections entering at an interval not an octave", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                canon: { value: [0, 0.25], unit: "share of entries", kind: "unmeasured", reason: "ours: and entering late, a canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              figuration: {
                tones: { value: [1, 5], unit: "tones", kind: "unmeasured", reason: "ours: its walk over so many of the harmony's tones", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                direction: { value: [-1, 1], unit: "down to up", kind: "unmeasured", reason: "ours: which way", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                turn: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how often it turns", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                anchor: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how surely its lowest tone takes the strong positions", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                rate: { value: [0.25, 0.8], unit: "share of its players' quickest", kind: "unmeasured", reason: "ours: its rate", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              }
            },
            players: {
              cents: { value: 6, unit: "cents at most", kind: "unmeasured", reason: "ours: each player's own inflection of their part's pitch, drawn once from their seat: a section, not a copy", searched: [{ where: "web search", query: "measured onset asynchrony intonation spread among players of an orchestral string section unison study", date: "2026-10-29", found: "none within a section: 20-50 ms between an ensemble's players, about 30 ms either way for a string ensemble's bowing onsets (a ViennaTalk 2015 paper's citation, its source not read); quartets' phase correction (Wing et al. 2014); violin duets' intonation adjusting to each other (DAFx 2011); no scatter in cents" }] },
              seconds: { value: 5e-3, unit: "s at most", kind: "unmeasured", reason: "ours: each player this late at most, a few ms, never heard as raggedness (the owner, 10 October 2026, of Op. 3.37: 18 ms too ragged, reined in)", searched: [{ where: "web search", query: "measured onset asynchrony intonation spread among players of an orchestral string section unison study", date: "2026-10-29", found: "none within a section: 20-50 ms between an ensemble's players, about 30 ms either way for a string ensemble's bowing onsets (a ViennaTalk 2015 paper's citation, its source not read); quartets' phase correction (Wing et al. 2014); violin duets' intonation adjusting to each other (DAFx 2011); no scatter in cents" }] }
            }
          },
          desks: {
            from: { value: 0.5, unit: "level", kind: "unmeasured", reason: "ours: every desk plays from this level up (the tutti from mf); a player's own pp to ff some 11 dB (Clark & Luce 1965), an orchestra's range as much from how many play", searched: [{ where: "web search", query: 'orchestral dynamics number of string players desks playing pianissimo "half section" doubling players loudness 3 dB measured', date: "2026-10-29", found: "none measured: a section's size changing its tone as well as its loudness (orchestration writing); whole orchestras' sound power 3-4 dB apart in halls (Kahle 1995); equal uncorrelated sources adding 3 dB a doubling, the physics" }] },
            doublings: { value: 3, unit: "halvings", kind: "unmeasured", reason: "ours: below it the desks playing halved this many times toward silence, each doubling of players some 3 dB", searched: [{ where: "web search", query: 'orchestral dynamics number of string players desks playing pianissimo "half section" doubling players loudness 3 dB measured', date: "2026-10-29", found: "none measured: a section's size changing its tone as well as its loudness (orchestration writing); whole orchestras' sound power 3-4 dB apart in halls (Kahle 1995); equal uncorrelated sources adding 3 dB a doubling, the physics" }] }
          },
          glissando: {
            spread: { value: 3, unit: "semitones a second", kind: "unmeasured", reason: "ours: a part's glissandi's speeds normal about none with this spread (Xenakis's Gaussian law, Pithoprakta), its size ours", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }] }
          },
          lineBand: { value: 7, unit: "semitones", kind: "unmeasured", reason: "ours: a line shared by sections planed within its centre's band at least this either way", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
          tremoloSkew: { value: 3, unit: "power of its draw", kind: "unmeasured", reason: "ours: a pool's tremolo the cube of a uniform draw over its range, most pools near its low end", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
        },
        line: {
          contact: {
            ppp: { value: 0.35, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at ppp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            pp: { value: 0.3, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at pp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            p: { value: 0.18, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at p, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            mp: { value: 0.1, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at mp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            mf: { value: 0.06, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at mf, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            f: { value: 0.03, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at f, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            ff: { value: 0.025, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at ff, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            fff: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at fff, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] }
          },
          nearestContact: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: the nearest the bridge a line's contact comes, by which its slowest bow at a dynamic is its speed times this over its usual contact", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
          slowestBow: { value: 5, unit: "cm/s", kind: "unmeasured", reason: "ours: never slower than a tone holds at (each instrument's fitted slowest supersedes it in the strings model: physical-strings.js slowestBowOf)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] },
          fastestShare: { value: 1.6, unit: "times its dynamic's speed", kind: "unmeasured", reason: "ours: how much faster than its dynamic's speed a note may be drawn, toward the fingerboard", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] },
          easeMost: { value: 1, unit: "dynamics", kind: "unmeasured", reason: "ours: the most a single note too long for its bow is eased before it changes bow inside itself -- one, so that a loud note stays loud, its bow changed where one bow cannot hold it", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] }
        },
        attackLimits: {
          raucous: { value: 50, unit: "ms", kind: "literature", source: "guettler-askenfelt-1997", note: "the longest a note's prolonged periods (schelleng.py 'raucous') before Helmholtz motion that listeners accepted" },
          multiple: { value: 90, unit: "ms", kind: "literature", source: "guettler-askenfelt-1997", note: "the longest its multiple flyback ('multiple') that listeners accepted" }
        },
        vibrato: {
          register: {
            rate: { value: 0.32, unit: "Hz faster, from an instrument's lowest pitch to its highest", kind: "literature", source: "macleod-2008", note: "high pitches 0.32 Hz faster than low ones (violinists and violists)" },
            width: { value: 26, unit: "cents wider, peak to peak, from an instrument's lowest pitch to its highest", kind: "literature", source: "macleod-2008", note: "high pitches about 26 cents wider than low ones (violinists and violists)" }
          },
          forte: { value: 4, unit: "cents wider at forte than at piano, peak to peak", kind: "literature", source: "macleod-2008", note: "forte about 4 cents wider than piano (violinists and violists)" },
          delay: {
            least: { value: 0.33, unit: "s without vibrato as a note begins", kind: "literature", source: "allen-geringer-macleod-2009", note: "an artist's stretch without vibrato where a note changes" },
            most: { value: 0.42, unit: "s without vibrato as a note begins", kind: "literature", source: "geringer-allen-macleod-2005", note: "university players' stretch without vibrato where a note changes" }
          }
        },
        slide: {
          holdMost: { value: 0.95, unit: "share of its note", kind: "unmeasured", reason: "ours: a glissando's held first pitch at most this share of its note, so it always slides", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] },
          least: { value: 0.05, unit: "semitones", kind: "unmeasured", reason: "ours: a slide narrower than this (5 cents) none, taken as near the least change of pitch heard", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }, { where: "web search", query: "frequency difference limen pure tone 1 kHz percent cents just noticeable difference pitch musicians Wier Jesteadt Green 1977", date: "2026-10-29", found: "Wier, Jesteadt & Green 1977 (JASA 61, 178-184) measured pure tones' frequency difference limens by frequency and level, their values not reached in what was read; no slide's least width measured" }] }
        }
      }
    },
    violin: {
      values: {
        forceScale: { value: 1, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 40, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "literature", source: "geringer-allen-2004", note: "violinists' and cellists' about 5.5 Hz, neither instrument nor experience differing (high school and university players)" },
          width: { value: 40, unit: "cents, peak to peak", kind: "literature", source: "allen-geringer-macleod-2009", note: "an artist's about 40 cents in first position" }
        }
      }
    },
    viola: {
      values: {
        forceScale: { value: 1.2, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 36, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "unmeasured", reason: "ours: the violinists' and cellists' rate, measured alike (Geringer & Allen 2004), taken for the viola between them", searched: [{ where: "web search", query: "MacLeod 2008 vibrato rates widths violin viola players dynamic level pitch register results viola width cents", date: "2026-10-29", found: "MacLeod 2008 (walled: SOURCES_TO_FETCH) measured violists with violinists, its tables not reached; no account gives a viola's rate or width" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] },
          width: { value: 36, unit: "cents, peak to peak", kind: "unmeasured", reason: "ours: between the violin's and the cello's", searched: [{ where: "web search", query: "MacLeod 2008 vibrato rates widths violin viola players dynamic level pitch register results viola width cents", date: "2026-10-29", found: "MacLeod 2008 (walled: SOURCES_TO_FETCH) measured violists with violinists, its tables not reached; no account gives a viola's rate or width" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] }
        }
      }
    },
    cello: {
      values: {
        forceScale: { value: 1.6, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 30, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "literature", source: "geringer-allen-2004", note: "violinists' and cellists' about 5.5 Hz, neither instrument nor experience differing (high school and university players)" },
          width: { value: 30, unit: "cents, peak to peak", kind: "unmeasured", reason: "ours: narrower than the violin's, as Geringer & Allen 2004 measured, how much authored", searched: [{ where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }, { where: "arXiv", query: "hu-2025: cellists' vibrato by string register", date: "2026-10-29", found: "cellists' depth (half the peak-to-peak) rising with the stopped note's place toward the bridge, fitted 63.8 (x - 0.054)^2 + 3.31 cents over x, its place as a share of the string from the nut (R^2 0.51, 94 excerpts); rates 5.26 Hz (s.d. 0.28, TinySOL's players) and 6.48 Hz (s.d. 0.42, three soloists' concerto recordings); no one width an instrument's" }] }
        }
      }
    },
    contrabass: {
      values: {
        slide: {
          most: { value: 24, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.17, unit: "Hz", kind: "literature", source: "mick-2024", note: "double bassists' mean, 40 players" },
          width: { value: 19, unit: "cents, peak to peak", kind: "literature", source: "mick-2024", note: "double bassists' mean, 40 players" }
        }
      }
    }
  }
};

// registry/objects/winds.json
var winds_default = {
  schema: "musebots.registry-objects/1",
  about: "The winds, woodwinds and brass, as a tree of types (registry/README.md), begun with what their players share: a vocal tract upstream of the reed (players/winds.json), one model whose values are its players' -- measured of clarinettists, every reed player's until their own are measured. Their bodies are still render/synthesis/geometry's (research/REGISTRY_PLAN.md, the woodwinds' step).",
  nodes: {
    "reed-woodwind": {
      is: "instrument",
      abstract: true,
      about: "A woodwind sounded by a reed in the player's mouth: what the reed is driven by is the mouth's pressure less the tract's answer to the flow through it (native/openwind src/tract.rs)."
    },
    clarinet: {
      is: "reed-woodwind",
      about: "The B-flat clarinet, whose players' tracts were measured as they played (Fritz & Wolfe 2005; Chen, Smith & Wolfe 2009)."
    },
    "e-flat-clarinet": {
      is: "reed-woodwind",
      about: "The E-flat clarinet: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    "bass-clarinet": {
      is: "reed-woodwind",
      about: "The bass clarinet: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    oboe: {
      is: "reed-woodwind",
      about: "The oboe, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    "english-horn": {
      is: "reed-woodwind",
      about: "The English horn, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    bassoon: {
      is: "reed-woodwind",
      about: "The bassoon, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    contrabassoon: {
      is: "reed-woodwind",
      about: "The contrabassoon, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    "soprano-saxophone": {
      is: "reed-woodwind",
      about: "The soprano saxophone: its players' tract the reed woodwinds' (the clarinettists' measured) until saxophonists' own are registered."
    },
    "alto-saxophone": {
      is: "reed-woodwind",
      about: "The alto saxophone: its players' tract the reed woodwinds' (the clarinettists' measured) until saxophonists' own are registered."
    },
    "tenor-saxophone": {
      is: "reed-woodwind",
      about: "The tenor saxophone: its players' tract the reed woodwinds' (the clarinettists' measured) until saxophonists' own are registered."
    },
    "baritone-saxophone": {
      is: "reed-woodwind",
      about: "The baritone saxophone: its players' tract the reed woodwinds' (the clarinettists' measured) until saxophonists' own are registered."
    },
    "jet-woodwind": {
      is: "instrument",
      abstract: true,
      about: "A woodwind sounded by its player's jet across an edge: its blowing pressure follows the note's frequency as flutists were measured blowing it (players/winds.json; Fletcher 1975)."
    },
    flute: {
      is: "jet-woodwind",
      about: "The concert flute in C."
    },
    "alto-flute": {
      is: "jet-woodwind",
      about: "The alto flute in G, the flute scaled to its bore (tools/design_openwind_woodwind.py flute_like): its players' law the flutists' until its own is measured."
    },
    piccolo: {
      is: "jet-woodwind",
      about: "The piccolo in C, the flute scaled to its bore: its players' law the flutists' until its own is measured."
    },
    "lip-reed": {
      is: "instrument",
      abstract: true,
      about: "A brass instrument, sounded by its player's lips buzzing into its mouthpiece: the flow between them the reed's, its lips opening outward (native/openwind src/kernel.rs T_REED, T_LIPS). Its bodies are render/synthesis/geometry's (tools/save_brass_body.py)."
    },
    trumpet: {
      is: "lip-reed",
      about: "The B-flat trumpet."
    },
    trombone: {
      is: "lip-reed",
      about: "The tenor trombone, its slide moving."
    },
    horn: {
      is: "lip-reed",
      about: "The French horn, its bore a horn in F (Kemp 2002)."
    },
    tuba: {
      is: "lip-reed",
      about: "The tuba in C (an Alexander CC, Campbell et al. 2021)."
    }
  }
};

// registry/players/winds.json
var winds_default2 = {
  schema: "musebots.registry-players/1",
  about: "What the players of the winds do, the woodwinds' and the brass's, on the objects' tree (registry/README.md): a node's values are its players'; one a node does not give, its parent's.",
  nodes: {
    "reed-woodwind": {
      values: {
        tract: {
          resonances: { value: [300, 1300, 2300], unit: "Hz", kind: "literature", source: "fritz-wolfe-2005", at: "II.D", note: "usually three resonances of the tract from 0.1 to 3 kHz, typically at 0.3, 1.3 and 2.3 kHz, varying among players and playing conditions" },
          first: {
            frequency: { range: [200, 300], unit: "Hz", kind: "literature", source: "fritz-wolfe-2005", at: "III; Table I", note: "its first peak present for every player, hardly varied with how they played: 200-300 Hz (220-280 in Table I)" },
            peak: { range: [18e5, 56e5], unit: "Pa s/m^3", kind: "literature", source: "fritz-wolfe-2005", at: "III; Table I", note: "1.8-5.6 MPa s/m^3 for most players (to 18 in Table I), a tenth of the bore's" },
            q: { value: 4, unit: "", kind: "unmeasured", reason: "ours: a start for the player's ear (native/openwind/live.mjs) and the fit; its width is drawn in the measured spectra but nowhere given", searched: [{ where: "registry sources", query: "fritz-wolfe-2005: the tract's impedance in clarinettists' mouths as they played", date: "2026-10-30", found: "each resonance's frequency and its peak's magnitude (Table I; Figs. 5-8), drawn but not given as a width or Q; its waveguide model's losses (wall r = 408 rad/s, w/2pi 15 Hz; q 4 rad/s; 1.5 MPa s/m^3 at the glottis), not a resonance's width" }, { where: "registry sources", query: "chen-smith-wolfe-2009: the impedance in the mouth during normal playing, bends and glissandi", date: "2026-10-30", found: "each resonance's frequency and magnitude (Fig. 7), no width" }] }
          },
          normal: {
            above: { value: 600, unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "above about 600 Hz in normal playing the resonance in the mouth follows the note; below, the tract kept as it is" },
            offset: { value: 150, unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "the resonance in the mouth about 150 Hz above the sounding pitch, on average, in normal playing above 600 Hz" },
            peak: { value: 9e6, unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "about 9 MPa s/m^3 on average in normal playing, against the operating bore peak's 40-90: little effect on the sounding frequency" },
            q: { value: 8, unit: "", kind: "unmeasured", reason: "ours: a start for the player's ear (native/openwind/live.mjs) and the fit; its width is drawn in the measured spectra but nowhere given", searched: [{ where: "registry sources", query: "fritz-wolfe-2005: the tract's impedance in clarinettists' mouths as they played", date: "2026-10-30", found: "each resonance's frequency and its peak's magnitude (Table I; Figs. 5-8), drawn but not given as a width or Q; its waveguide model's losses (wall r = 408 rad/s, w/2pi 15 Hz; q 4 rad/s; 1.5 MPa s/m^3 at the glottis), not a resonance's width" }, { where: "registry sources", query: "chen-smith-wolfe-2009: the impedance in the mouth during normal playing, bends and glissandi", date: "2026-10-30", found: "each resonance's frequency and magnitude (Fig. 7), no width" }] }
          },
          bend: {
            peak: { range: [2e7, 6e7], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.B", note: "pitch bending and glissandi in the second register and above: as high as 60 MPa s/m^3, comparable with the bore's; 32 at 705 Hz bent a note 190 cents" }
          }
        },
        tongue: {
          portato: {
            contact: { value: 0.037, sd: 0.014, unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.1; Table 1", note: "the tongue's contact with the reed between portato notes, clarinettists playing eighths at 60 and 120 bpm, piano and forte: invariant with tempo and dynamic (37 ms, sd 14)" }
          },
          staccato: {
            contact: { value: [[0.25, 0.115], [0.5, 0.347]], unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.2; Table 1", note: "[the notes' inter-onset interval, the tongue's contact with the reed]: clarinettists' staccato eighths at 120 and 60 bpm, the note stopped by the tongue (their technique I); sd 31 and 27 ms" },
            silence: { value: [[0.25, 0.084], [0.5, 0.302]], unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.2; Table 1", note: "[the notes' inter-onset interval, the silence between notes]: the same staccato eighths at 120 and 60 bpm, stopped by the tongue (technique I); sd 37 and 43 ms" }
          }
        },
        flow: {
          turbulence: { value: 0, unit: "1/sqrt(Hz)", kind: "unmeasured", reason: `ours, to be fitted: the flow through the reed's channel turbulent, its fluctuation a share of the flow per root hertz, white to the engine's own rate (native/openwind src/stream.rs turbulence, the slit's coefficient moved by it each step, and the offline renders' openwind_compiled.py alike; public/shared/performers/turbulence.js turbulenceOf); none until fitted to players' held notes, the noise between their harmonics on the anechoic recordings (Weinzierl et al. 2017; research/MODELING_GAPS.md, "No turbulent noise in the reed's or the lips' flow")`, searched: [{ where: "the web", query: "turbulent noise in a clarinet's reed channel's flow, its level measured", date: "2026-11-03", found: "none measured: J. O. Smith, Physical Audio Signal Processing, 'Single-Reed Theory' -- synthesis models' noise modulated by the reed 'despite a lack of firm basis in acoustic measurements to date', turbulence near the reed's closing the basic model's chief omission; a reed channel's flow laminar-like below a Reynolds number of about 4000, seldom reached in saxophones and clarinets (TU Delft repository); a synthesis patent's noise following the breath, its level unmeasured" }] }
        }
      }
    },
    "lip-reed": {
      values: {
        flow: {
          turbulence: { value: 0, unit: "1/sqrt(Hz)", kind: "unmeasured", reason: `ours, to be fitted: the flow between the lips turbulent, its fluctuation a share of the flow per root hertz, white to the engine's own rate (native/openwind src/stream.rs turbulence, the lips' slit's coefficient moved by it each step, and the offline renders' openwind_compiled.py alike; public/shared/performers/turbulence.js turbulenceOf); none until fitted to players' held notes, the noise between their harmonics on the anechoic recordings (Weinzierl et al. 2017's trumpet; research/MODELING_GAPS.md, "No turbulent noise in the reed's or the lips' flow")`, searched: [{ where: "the web", query: "turbulent noise in a brass player's lips' flow, its level measured or modelled", date: "2026-11-03", found: "none measured: C. Vergez & X. Rodet's trumpet model (ICMC 2001), the jet out of the lips losing its energy to turbulence in the mouthpiece's cup, no noise level; Adachi & Sato's lips, and Giordano's (ISMA 2017) Navier-Stokes flow over them, no level given" }] }
        }
      }
    },
    "jet-woodwind": {
      values: {
        breath: {
          perHz: { value: 0.8, unit: "Pa/Hz", kind: "literature", source: "fletcher-1975", at: '"p = 0.008 v" mbar at a note of v Hz', note: "four flutists' blowing pressure rising with the note's frequency, its jet's speed sqrt(2p/rho): 20 m/s at D4, 40 at D6 (the same number as render/synthesis/workers/openwind_worker.py WOODWINDS jet pressure, the worker's own until it reads the registry)" },
          ffOverPp: { range: [1, 2], unit: "", kind: "literature", source: "fletcher-1975", note: "two of his four flutists raising their pressure about twice from pp to ff, two holding it" }
        }
      }
    }
  }
};

// registry/stimuli/stimuli.json
var stimuli_default = {
  schema: "musebots.registry-stimuli/1",
  about: "The MIDI 2.0 files tests and trials play (registry/README.md): each with what it plays and tests, how it was made (a script and its seed, a bot, or by hand), its checksum, and the tests and trials that play it.",
  stimuli: {}
};

// registry/method/strings.json
var strings_default = {
  schema: "musebots.registry-methods/1",
  about: "The bowed strings' methods (registry/README.md): what each does, and its settings, each with why that value and what it answers to.",
  methods: {
    "strings-neutral": {
      about: "The strings' neutral note at each string and stop, the first stage of the player's fit by decomposition (native/strings-model/neutral.py; the owner, 27 October 2026): each string at ordinario, at each stop and dynamic, every force of a grid from silence with no attack curve on every seed, its window the longest run that holds Helmholtz motion, its neutral note that window's middle among the forces players bow; then held from it at mf, the levels against the measured instruments', the dynamics' rounds by speed and force until they hold, the law and its check through the compiler, and adoption where every note was heard.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3f)",
      settings: {
        ratio: { value: 1.189207115002721, unit: "1", kind: "setting", reason: "the force grid's step: a quarter of an octave of force, finer than the windows' own structure (the viola's run at 1.05 N between 0.75 and 1.48), 27 forces on the viola from 0.12 N to 10" },
        stopStep: { value: 1.5, unit: "semitones", kind: "setting", reason: "its stops from the law's lowest to its highest about this many semitones apart, none of them twelve-tone, so that a law read between them is checked between them" },
        near: { value: 3, unit: "grid steps", kind: "setting", reason: "a round after the first maps each note's forces this many grid steps either side of the one its law predicts" },
        reach: { value: 4, unit: "1", kind: "setting", reason: "the grid extended past its top, a step at a time, while a note's window from silence still holds there, at most to this many times its top: the viola's map of 27 October had 58 of its 384 notes' windows cut by its top, their neutral notes the middle of a window that went on" },
        holds: { value: 1, unit: "dB", kind: "setting", reason: "the dynamics' rounds are done where no note's correction is over this" },
        rounds: { value: 4, unit: "rounds", kind: "setting", reason: "the dynamics' rounds at most" },
        listenGap: { value: 0.25, unit: "s", kind: "setting", reason: "the silence between the neutral notes rendered to hear" },
        check: { value: 1, unit: "s", kind: "setting", reason: "how long each note the check compiles is held, at the violin's lowest pitch and above (a lower one as many periods: notePeriods)" },
        notePeriods: { kind: "setting", derive: { equation: "periods-in", inputs: { seconds: "setting:strings-regions:note", hz: "object:violin:lowestHz" } }, unit: "periods", reason: "each test note held as many periods as the violin's lowest note gets in regions.py's note (0.6 s at 196 Hz, about 118): a low string's start measured as long, in its own periods, as a high one's -- some contrabass notes settle past 0.6 s (the owner, 28 October 2026: 'it's possible that some double-bass notes will need it'); its settling still judged against Guettler & Askenfelt's limits, so a slow note is measured, never passed", answersTo: "players: violin-family attackLimits" },
        offsetRead: { value: 0.04, unit: "s", kind: "setting", reason: "a heard note's offset read over its render's first this long, before its bow" },
        listenPeakDb: { value: -3, unit: "dBFS", kind: "setting", reason: "the neutral notes rendered to hear brought together to this peak" },
        peakFloor: { value: 1e-12, unit: "1", kind: "setting", reason: "a silent render's peak taken as this, so it is never divided by zero" },
        levelFloor: { value: 1e-24, unit: "1, of power", kind: "setting", reason: "a note's mean square floored here, so a silent note's level is finite" },
        lineNotes: { value: 3, unit: "notes", kind: "setting", reason: "a string's level errors corrected by a line through its stops where it has this many notes at a dynamic, else by their mean" }
      }
    },
    "strings-regions": {
      about: "Each string's windows of Helmholtz motion over contact and force, from silence and held (native/strings-model/regions.py), and the attacks measured on them: the reference notes every bowed fit plays.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        forces: { value: 10, unit: "forces", kind: "setting", reason: "each window's coarse grid: this many forces log-spaced from the robot's least force to WIDEN past the players' most" },
        contacts: { value: 12, unit: "contacts", kind: "setting", reason: "this many contacts log-spaced from the bridge's mechanical limit to the midpoint" },
        edgeRatio: { value: 1.05, unit: "1", kind: "setting", reason: "each window's edge found to within this ratio of force" },
        widen: { value: 2, unit: "1", kind: "setting", reason: "the grid's top this many times the players' most" },
        widenings: { value: 12, unit: "widenings", kind: "setting", reason: "a bracket widened at most this many times" },
        robotLeast: { kind: "setting", derive: { equation: "least", inputs: { values: "setting:schelleng-map:forces" } }, unit: "N", reason: "the grid's bottom: the bowing robot's least force (its grid's, schelleng-map forces), times the instrument's force scale" },
        midpoint: { value: 0.5, unit: "share of the string", kind: "setting", reason: "the contact axis's tasto end, the vibrating length's midpoint (the owner, 19 October 2026: extreme sul tasto is 0.5 of the string)" },
        ramp: { value: 0.05, unit: "s", kind: "setting", reason: "a reference note's bow brought up to speed in this (noise_profile.actions')" },
        note: { value: 0.6, unit: "s", kind: "setting", reason: "a reference note held this long and classified on its last half, at the violin's lowest pitch (a lower one longer: strings-neutral notePeriods)" },
        gap: { value: 0.2, unit: "s", kind: "setting", reason: "its string damped over this before the next note" },
        slide: { value: 0.6, unit: "s", kind: "setting", reason: "a sustained note's finger slid and its bow brought to its speed over this (glide.py's, which held)" },
        glide: { value: 0.3, unit: "s", kind: "setting", reason: "then glided to its contact and force over this" },
        attackSeconds: { value: [0.02, 0.05, 0.12, 0.3, 0.75], unit: "s", kind: "setting", reason: "each attack measured at these attack times (a stroke's, MIDI 2.0 RPNC #73; under 0.02 s the compiler sets its bow down at its whole force at once, and past the last an attack takes the last's)" },
        froms: { value: 10, unit: "shares", kind: "setting", reason: "its starting force a share of its held force on a grid of this many" },
        fromRange: { value: [0.02, 4], unit: "shares", kind: "setting", reason: "from this range" },
        reaches: { value: [0.5, 1, 2, 4], unit: "attack times", kind: "setting", reason: "its force brought to its own over each of these times its attack time" },
        held: { value: 0.8, unit: "s", kind: "setting", reason: "each attack's note twice its attack and this much more long (the compiler's attack at most half its note, its release after)" },
        attackTimes: { value: 2, unit: "times its attack", kind: "setting", reason: "each attack's note this many times its attack long, and HELD more: the compiler's attack at most half its note" },
        nearFastest: { value: 0.1, unit: "share of the fastest", kind: "setting", reason: "an endpoint's curves near its fastest: settling within a period or this share of the fastest of it" },
        perUnknown: { value: 2, unit: "endpoints", kind: "setting", reason: "the attack model's features fewer where its endpoints are under this many an unknown, the last dropped first" },
        agreeAbsolute: { value: 15e-4, unit: "as compiled", kind: "setting", reason: "the compiler and the model agreeing within this and agreeRelative: a force to the gram, a time to a tenth of a millisecond, as the compiler rounds them" },
        agreeRelative: { value: 1e-4, unit: "share", kind: "setting", reason: "and within this share of the value" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two stops or contacts the same within this: a float's rounding" },
        keyDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "a render's key, its actions' hash, this long" },
        engineDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "an engine build's stamp, its binary's hash, this long" },
        classifierDigits: { value: 12, unit: "hex digits", kind: "setting", reason: "the classifier's stamp, its source's and its settings' hash, this long" },
        jobs: { value: 3, unit: "processes", kind: "setting", reason: "renders at once: three, the trunk's share for a strings fit" }
      }
    },
    "strings-compiler": {
      about: "The bowed strings' compiler (public/shared/performers/physical-strings.js): how it writes a part's notes as the strings engine's actions, which every fit, render and the band play.",
      source: "ours",
      settings: {
        versions: { value: 3, unit: "versions", kind: "setting", reason: "how many versions of each instrument the engine holds, a seat taking one by its chair (physical-strings.js MODEL.variants): a section's seats not all one instrument -- the violin's, viola's and cello's each one of Artifastring's string sets (objects: violin.0 to cello.2)" },
        forceWritten: { value: 1e-3, unit: "N", kind: "setting", reason: "the least step of force the compiler writes (physical-strings.js toFixed(3)): a bracket never under it, a cost's noise measured at least this far apart" },
        contactWritten: { value: 1e-5, unit: "share of the string", kind: "setting", reason: "the least step of contact the compiler writes (physical-strings.js share, to five places): a span's far end where no measurement bounds it" },
        tuneWritten: { value: 1e-7, unit: "1", kind: "setting", reason: "a string's tension ratio written to seven places: a change under this not written" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two values the same within this: a float's rounding, never a choice of the music's" },
        instant: { value: 1e-4, unit: "s", kind: "setting", reason: "a time under this is none: a bite or a stop shorter is no stop, and a stroke's bows end this inside its limit" },
        leastAccelerating: { value: 2e-3, unit: "s", kind: "setting", reason: "a bow's acceleration figured over this at least: a speed reached over less, taken as reached over this" },
        leastAttack: { value: 0.01, unit: "s", kind: "setting", reason: "a stroke's attack never shorter than this" },
        readyBefore: { value: 5e-3, unit: "s", kind: "setting", reason: "a stroke's or a pluck's finger readied to be there this long before it" },
        dampBefore: { value: 6e-3, unit: "s", kind: "setting", reason: "a string's losses set back this long before its stroke, before its finger is readied" },
        releaseAfter: { value: 0.02, unit: "s", kind: "setting", reason: "a release begun no sooner than this after its stroke begins (or half its note, the shorter)" },
        tail: { value: 3, unit: "s", kind: "setting", reason: "a part's end this long after its last change, where its driver does not ring it down: its strings turned off where they fell quiet" },
        pitchWithin: { value: 0.05, unit: "semitones", kind: "setting", reason: "a pitch sounds as asked within this: a stroke whose path begins further off its pitch glides into it, a multiphonic asked further from its own is said to sound at its own" },
        strings: { value: 4, unit: "strings", kind: "setting", reason: "every instrument the engine plays has four strings (Artifastring's)" },
        fingerPasses: { value: 4, unit: "passes", kind: "setting", reason: "a finger placed again for the cents its geometry sounds off (the calibration's) at most this many times" },
        fingerOutlier: { value: 60, unit: "cents", kind: "setting", reason: "a finger's measured correction further than this from its string's reliable centre taken for one that failed (a note that did not speak, or read at another partial: violin variant 2's E string read -198 and +677 cents where its others read +27, Op. 3.9's first render), read between its reliable neighbours instead -- a finger the model places by geometry is never a semitone out; its reliable corrections lie within some 30 cents of each other" },
        moved: { value: { f: 2, h: 3, b: 4, a: 5, t: 2, d: 3, u: 4, p: 3 }, unit: "values", kind: "setting", reason: "the driver's lines whose change is moved over time (native/strings-model/musebots-strings.cpp), by kind, and how many values each takes before its span: the driver's protocol" },
        contactHeld: { value: [0.06, 0.2], unit: "share of the string", kind: "setting", reason: "a contact neither given nor measured -- the measured players' by dynamic (bowed-line.js BOWED_LINE.contact) -- held within this: beyond it the model leaves Helmholtz motion and squeaks or whistles" },
        leastFinger: { value: 0.045, unit: "share of the string", kind: "setting", reason: "the least a finger stops a string: nearer the nut the model's finger, a stiff spring on a piece of string that hardly moves, overshoots until its numbers overflow (Op. 3.5's second violins at 0.006; violin variant 2's E string at 0.03, Op. 3.9's first renders); at 0.045, its next stop measured, it plays. A pitch nearer its open string keeps its finger there, its string's tension lowered so the two sound it" },
        openWithin: { value: 0.01, unit: "semitones", kind: "setting", reason: "a note within this of its open string is the open string" },
        retuneSemitones: { value: 1, unit: "semitones", kind: "setting", reason: "a string's tension never raised past this, which only a failed correction could ask: a finger that reaches the pitch by its geometry stops it there instead" },
        mostRetune: { kind: "setting", derive: { equation: "semitones-ratio", inputs: { semitones: "setting:strings-compiler:retuneSemitones" } }, unit: "1", reason: "retuneSemitones as a ratio of the string's tension's pitch" },
        pluckLead: { value: 0.1, unit: "s", kind: "setting", reason: "the model pulls a plucked string this long before it lets go (its driver's PLUCK_SECONDS), so a pluck is asked that much early" },
        step: { value: 0.01, unit: "s", kind: "setting", reason: "a finger's path -- a vibrato, a slide -- written a straight segment this long at a time" },
        joined: { value: 0.06, unit: "s", kind: "setting", reason: "a stroke joined to the one before where it begins within this of that one's end (a change of bow's bite counted in)" },
        drawStep: { value: 0.02, unit: "s", kind: "setting", reason: "a drawn bow's wandering written a straight segment this long at a time" },
        drawnLeast: { value: 0.15, unit: "s", kind: "setting", reason: "a stroke drawn with its bow's wandering where it is held this long or longer -- never a multiphonic's, bowed as it was measured, nor a tremolo's" }
      }
    },
    "strings-bowing-law": {
      about: "The bowed strings' bowing law fitted (native/strings-model/fit_bowing.py; research/STRINGS_FITTED_BOWING.md): each instrument's windows of Helmholtz motion mapped over contact and force as a seat plays them, then the law's four values -- its contact at ppp and fff, its place in each window at ppp and fff -- fitted by descent through the physics, never by draws: least squares by a trust region tolerant of the cost's noise (trust_region.py: Sun & Nocedal 2023), the cost's noise measured at its start (ECnoise: More & Wild 2011) and each value's difference step from the cost's curvature (More & Wild 2012); its residuals each note's levels against the measured instruments', how its spectrum changes from pp to ff against the recordings', and each value's distance from its measured range's middle.",
      source: "ours (research/STRINGS_FITTED_BOWING.md)",
      settings: {
        betaRange: { value: [0.02, 0.35], unit: "share of the string", kind: "setting", reason: "the windows' grid of bow-bridge distances, log-spaced over this: from near the bridge to over the fingerboard's end, the measured players' 0.03-0.3 and beyond" },
        forceRange: { value: [0.02, 4], unit: "N", kind: "setting", reason: "the windows' grid of forces, log-spaced over this, the violin's (an instrument's times its force scale): from a light touch to past the heaviest measured, 2.5 N" },
        seeds: { value: 5, unit: "seeds", kind: "setting", reason: "each point's and note's attack played under the driver's seeds 1 to this, stopping at the first that leaves Helmholtz motion: a bow is in its window only where every attack of it settles there. At the calibration's mezzo-forte on a violin's E string (vn1.2, note 81), 15 of 32 attacks on the ramped driver settled 6 dB softer, their fundamental 1 dB over their octave against 13 dB (claude-scratch/strings-ramps/logs/reattack-seeds-1.log), and the classifier finds each of those 16 notes' 8 soft ones in multiple slip, two slips a period, the 8 others in Helmholtz motion (classify-reattack-3.log): one seed had judged that bow by chance. A bow whose attacks fail one time in two is found failing under five seeds 31 times in 32" },
        scored: { value: ["pp", "mf", "ff"], unit: "dynamics", kind: "setting", reason: "the law's notes played at these dynamics: each note's pp and mf level judged under its ff, its spectrum's change from pp to ff" },
        steps: { value: [0.27, 5.13, 12.41], unit: "semitones", kind: "setting", reason: "each string's notes a quarter tone over its open pitch, a fourth up and an octave up, microtonal: none on a twelve-tone step" },
        noteSeconds: { value: 1.2, unit: "s", kind: "setting", reason: "each note the compiler plays for the windows and the law held this long, its attack's held part (half its note to its release) classified" },
        compared: { value: 12, unit: "harmonics", kind: "setting", reason: "each note's spectrum's change from pp to ff compared over its first this many harmonics, dB under its loudest" },
        most: { value: 40, unit: "evaluations", kind: "setting", reason: "the descent's evaluations at most (fit_string.py's)" },
        points: { value: 8, unit: "steps", kind: "setting", reason: "the cost's noise measured from this many plus one laws (More & Wild's own driver's m, ECNdriver.m), first one written step of the lightest force apart (strings-compiler forceWritten)" },
        margin: { value: 1e-6, unit: "share of the string", kind: "setting", reason: "a law's contacts kept this far inside their windows' edges: the bound solver's tolerance" },
        betas: { value: 12, unit: "distances", kind: "setting", reason: "the windows' grid this many bow-bridge distances where none are asked (--betas), log-spaced over betaRange: neighbours 30% apart" },
        forces: { value: 20, unit: "forces", kind: "setting", reason: "the windows' grid this many forces where none are asked (--forces), log-spaced over forceRange: neighbours 32% apart" },
        lawDigits: { value: 8, unit: "hex digits", kind: "setting", reason: "a law's folder named by this many hex digits of its values' hash, so a run resumed reuses only the same law's notes" },
        changeWithin: { value: 2, unit: "semitones", kind: "setting", reason: "a note's change from pp to ff compared with the recorded note nearest its pitch only where that one lies within this: the recordings' notes are a semitone apart (render/synthesis/harmonic-spectra), so this admits a note at most two semitones past their compass" },
        ordinarioPoints: { value: 400, unit: "contacts", kind: "setting", reason: "ordinario sought among this many contacts log-spaced over the measured players' (0.03-0.3: a step of 0.6% of contact)" }
      }
    },
    "strings-player": {
      about: "The strings' player fitted to whatever instrument the engine builds, every playing value in one descent (native/strings-model/fit_player.py): its contacts and places in each string's windows by dynamic, the force's and the bow speed's multiples at the marks past ppp and fff, the onset curve, the change of bow -- the instrument held as built, the player fitted to it.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        upsample: { value: 8, unit: "1", kind: "setting", reason: "a bridge force interpolated, band-limited, to this many times its rate before its flybacks are timed (its jitter)" },
        jitterPeriods: { value: 3, unit: "periods", kind: "setting", reason: "a jitter read only where this many flyback-to-flyback periods or more were timed: ours, a spread of fewer says little" },
        centroidHarmonics: { value: 20, unit: "harmonics", kind: "setting", reason: "a held part's brightness its first this many harmonics' centroid: ours" },
        centroidBand: { value: 8, unit: "1", kind: "setting", reason: "each harmonic's magnitude its spectrum's peak within f0 over this of it: ours, an eighth of the spacing between harmonics" },
        startWithin: { value: 1e-12, unit: "as its values", kind: "setting", reason: "a start's value taken as within its range, and its bounds, to this: a logarithm's and its exponential's rounding, never moved for it" },
        compilerDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "the compiler's stamp, its sources' hash, this long" },
        compileDigits: { value: 20, unit: "hex digits", kind: "setting", reason: "a compile kept by its job's and the compiler's hash, this long" },
        most: { value: 200, unit: "evaluations", kind: "setting", reason: "the descent's evaluations at most, a guard: it ends where its steps promise no more than the noise or change no note" }
      }
    },
    "strings-loop": {
      about: "The strings' fit as one loop that runs to its end unattended (native/strings-model/fit_loop.py): its stages in order, each kept by what it measured, and the band its adoption is heard in before and after.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md, requirement 8 and stage 3e)",
      settings: {
        band: { value: "string-quintet", unit: "band", kind: "setting", reason: "the band an instrument's adoption is heard in, rendered as it plays before and after, every note against its stem: ours, the strings' realtime objective (17 October 2026)" },
        bandSeconds: { value: 30, unit: "s", kind: "setting", reason: "the band rendered this long: ours" },
        bandSeed: { value: 20261019, unit: "seed", kind: "setting", reason: "the band rendered at this seed, fixed so before and after play the same piece (the owner, 1 October 2026: a fixed default seed is ok): the date the loop was written" },
        calibrationDigits: { value: 12, unit: "hex digits", kind: "setting", reason: "the band's check kept by its calibration's and onsets' files' hash, this long" }
      }
    },
    "strings-onsets": {
      about: "An attack's onset read from its sound (native/strings-model/fit_onsets.py accent, the player's fit's too): its level frame by frame from its stroke to its release, the loudest frame of its onset against the median of its held part's.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3c)",
      settings: {
        accentFrame: { value: 0.01, unit: "s", kind: "setting", reason: "its level read in frames this long: ours" },
        accentAttack: { value: 0.07, unit: "s", kind: "setting", reason: "its onset read from its stroke over this, then its articulation's decay (bowed-articulation.js), then accentAfter: ours, written with the onsets' fit (19 October 2026) with no reason recorded" },
        accentAfter: { value: 0.03, unit: "s", kind: "setting", reason: "and this past its decay: ours, written with the onsets' fit with no reason recorded" },
        changeBefore: { value: 0.6, unit: "s", kind: "setting", reason: "an attack at a change of bow follows a note held this long on the same string: ours" },
        note: { value: 1, unit: "s", kind: "setting", reason: "each attack's note held this long, its held part the later half of its frames: ours" },
        periodsScale: { value: 2, unit: "periods", kind: "setting", reason: "the onsets' fit's transient residual in this many periods: about the reading's own step (one period, a window a period apart, over four): ours" },
        accentScale: { value: 1, unit: "dB", kind: "setting", reason: "its accent residual in this many dB: about a level's just-noticeable difference: ours" },
        ranges: { value: { speed: [0.05, 6], force: [0.05, 4] }, unit: "times the held bow's", kind: "setting", reason: "the onset's speed and force multiples (physical-strings.js onsetOf) sought within these: ours, no measurement bounding them" },
        noiseSpacing: { value: 1.01, unit: "1", kind: "setting", reason: "the onsets' fit's cost's noise first measured over steps of this ratio in each value (ECnoise's spacing, moved as it advises): ours" },
        noiseTries: { value: 8, unit: "spacings", kind: "setting", reason: "its spacing moved at most this many times before the noise is said not found" },
        most: { value: 30, unit: "evaluations", kind: "setting", reason: "the onsets' fit's evaluations at most" }
      }
    },
    "strings-engine": {
      about: "The one bowed-string engine as Musebots build it (native/strings-model/engine.mjs): Artifastring patched, with one body for every program -- its tables baked from the measured bodies' corrections and their radiation, the contrabass's the cello's stretched to its size.",
      source: "ours",
      settings: {
        dcBlockHz: { value: 10, unit: "Hz", kind: "setting", reason: "the offset from zero the bow's friction leaves in Artifastring's sound blocked under this, first order, from silence" },
        kaiserBeta: { value: 8, unit: "1", kind: "setting", reason: "a body's impulse response stretched in time read between its samples by a Kaiser-windowed sinc of this beta: a stretch only narrows the band, so nothing folds back" },
        sincHalf: { value: 32, unit: "samples", kind: "setting", reason: "that sinc this many samples either side" },
        scaledBins: { value: 32768, unit: "bins", kind: "setting", reason: "a minimum-phase body filter scaled to a body's size read and remade at this many frequency bins" }
      }
    },
    "bow-planner": {
      about: "A bowed string's bow planned through the performer contract's solver (public/shared/performers/bow.js planBowing): where the bow is, which way it moves, how much of it each note spends, where it may change direction -- the reference the tests hold a bowed line to, never called while playing.",
      source: "ours (the general performer-instrument report, sections 5.4 and C03)",
      settings: {
        together: { value: 5e-3, unit: "s", kind: "setting", reason: "notes starting within this of each other one group" },
        positionGrain: { value: 0.5, unit: "cm", kind: "setting", reason: "bow positions within this one state" },
        setDown: { value: [0, 0.25, 0.5, 0.75, 1], unit: "shares of the bow from the frog", kind: "setting", reason: "where a stroke may be set down to begin, a phrase's first or after a retake" },
        costChange: { value: 0.1, unit: "1", kind: "setting", reason: "a direction change's cost" },
        costRetake: { value: 1, unit: "1", kind: "setting", reason: "a retake's" },
        costHidden: { value: 3, unit: "1", kind: "setting", reason: "a change inside a held note's: an articulation changed" },
        maxStates: { value: 4096, unit: "states", kind: "setting", reason: "the search's states at most" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two pitches or places the same within this: a float's rounding" }
      }
    },
    "bowed-line": {
      about: "A bowed string's phrase planned with its bow (public/shared/performers/bowed-line.js planPhrase): the shared line (line.js) carried to the instrument, its bowing, and its bow distributed stroke by stroke by construction -- each stroke at its dynamic's speed where the bow has room, slower where it hasn't, set back in a silence long enough for a retake, a slur the slowest bow cannot draw divided.",
      source: "ours",
      settings: {
        density: { value: 0.4, unit: "0 to 1", kind: "setting", reason: "a phrase planned without its arc's density given plays at this (its caller's own given otherwise)" },
        loudness: { value: 0.5, unit: "0 to 1", kind: "setting", reason: "and without its loudness given, at this" },
        joinWithin: { value: 1e-6, unit: "s", kind: "setting", reason: "a slurred note sounding into the next within this joins its stroke" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two places or times the same within this: a float's rounding" },
        marginGrains: { value: 2, unit: "grains", kind: "setting", reason: "the bow kept this many grains of its position (bow.js positionGrain) from either end" },
        bisections: { value: 48, unit: "halvings", kind: "setting", reason: "a stroke's one share of its notes' speeds found by halving its interval this many times: to a double's precision" },
        repairsPerNote: { value: 4, unit: "repairs", kind: "setting", reason: "a phrase whose stroke can't be drawn repaired at most this many times a note" },
        repairsMore: { value: 8, unit: "repairs", kind: "setting", reason: "and this many more" }
      }
    },
    "strings-harmonics": {
      about: "The strings' natural harmonics as the model was qualified to sound them (public/shared/performers/physical-harmonics-calibration.json: one probe per instrument, variant, string and partial at mf, accepted where its partial holds; research/physical-neural-synthesis): a light contact at a node, and the bow it was probed with.",
      source: "ours (research/physical-neural-synthesis/harmonics-qualified.json)",
      settings: {
        partials: { value: [2, 3], unit: "partials", kind: "setting", reason: "the harmonics qualified: the first two above the fundamental, light contact keeping the full string; higher partials and a second stopping finger not yet qualified" },
        firmness: { value: 1e-3, unit: "1", kind: "setting", reason: "the light contact's firmness, Artifastring's Kf multiplier, as probed (its method: Kf=0.001)" },
        contact: { value: 0.07, unit: "share of the string", kind: "setting", reason: "the bow's contact, on the whole string, as probed" },
        force: { value: 0.15, unit: "N", kind: "setting", reason: "its force at mf's speed, as probed (scaled with its speed)" },
        speed: { value: 0.1, unit: "m/s", kind: "setting", reason: "its speed at mf, as probed (scaled with the dynamic's)" },
        velocityWithin: { value: 0.02, unit: "velocity", kind: "setting", reason: "a harmonic played further than this from the probe's velocity (mf) is said to lie outside what was measured" }
      }
    },
    "regions-selftest": {
      about: "regions.py's selftest: the edge search on windows known in advance, no engine -- Schelleng's shape (the least force growing faster than the most as the bow nears the bridge), a window wider than the grid each way, one none of the grid's forces is in, one narrower than a grid step.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        shape: { value: [0.02, 0.2], unit: "N times the contact", kind: "setting", reason: "Schelleng's shape: a window's least and most force each this over its contact" },
        contacts: { value: [0.03, 0.06, 0.12, 0.25], unit: "share of the string", kind: "setting", reason: "at these contacts" },
        wide: { value: [1e-4, 1e3], unit: "N", kind: "setting", reason: "a window wider than the grid each way" },
        beyond: { value: [40, 50], unit: "N", kind: "setting", reason: "a window above every grid force" },
        narrow: { value: [0.5, 0.55], unit: "N", kind: "setting", reason: "a window narrower than a grid step" },
        grid: { value: [0.1, 5], unit: "N", kind: "setting", reason: "the grid's least and most force, log-spaced over strings-regions' forces" }
      }
    },
    "strings-noise-profile": {
      about: "A bowed note's regime read from its sound alone (native/strings-model/noise_profile.py; STRINGS_ARTICULATION_FIT_PLAN 3a): the model's notes over a coarse grid of contact, force and speed, each rendered as its bridge force and its sound, the force's regime labelling the sound's features; two judgements, each a logistic regression of the standardized features fitted by Newton's method on its convex likelihood (deterministic, no draws), per instrument -- scratch (too heavy for its bow) and clean (Helmholtz motion) -- accepted only where it agrees with the bridge force at bow places it was not fitted on and where recorded players' clean notes read clean.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3a)",
      settings: {
        betas: { value: [0.02, 0.04, 0.07, 0.1, 0.14, 0.2], unit: "share of the vibrating string", kind: "setting", reason: "the coarse grid's bow-bridge distances, across the robot's 0.02 to 0.2 (schelleng-map betas)" },
        leastForce: { value: 0.05, unit: "N", kind: "setting", reason: "the grid's least force, the violin's (an instrument's times its force scale): under the robot's least (0.1 N)" },
        forceSpan: { value: 250, unit: "1", kind: "setting", reason: "the grid's forces up to this many times its least (12.5 N for the violin), past the players' most (2.5 N)" },
        forceCount: { value: 14, unit: "forces", kind: "setting", reason: "this many forces, log-spaced (physics: log-grid)" },
        forceDigits: { value: 4, unit: "decimal places", kind: "setting", reason: "each force written to a tenth of a millinewton, as the driver's actions carry it" },
        speeds: { value: [0.1, 0.25], unit: "m/s", kind: "setting", reason: "the grid's bow speeds" },
        highestStop: { value: 7, unit: "semitones", kind: "setting", reason: "each instrument's lowest string bowed open and its highest stopped a fifth up: both ends of its strings and a stopped string's shorter length" },
        note: { value: 0.8, unit: "s", kind: "setting", reason: "each grid note held this long, its features read over its last half" },
        gap: { value: 0.3, unit: "s", kind: "setting", reason: "then lifted and its string damped over this before the next" },
        seed: { value: 7, unit: "1", kind: "setting", reason: "the engine's seed for every grid render: its bridge force and its sound the same motion" },
        window: { value: 4, unit: "periods", kind: "setting", reason: "each window of a note's sound read for its features this many periods long (its jitter how far its period wanders from one window to the next)" },
        types: { value: [0, 1, 2, 3], unit: "engine instruments", kind: "setting", reason: "the grid's instruments where none are asked: the violin, viola, cello and contrabass (bowed-instruments.js BOWED's order), the made-up tenor apart" },
        jobs: { value: 3, unit: "processes", kind: "setting", reason: "renders at once: three, the trunk's share for a strings fit" },
        shownEvery: { value: 12, unit: "files", kind: "setting", reason: "its progress shown every this many files" },
        lead: { value: 0.05, unit: "s", kind: "setting", reason: "a grid file's first note this long in" },
        dampBefore: { value: 0.06, unit: "s", kind: "setting", reason: "each note's string given back its own losses this long before its stroke" },
        fingerBefore: { value: 0.04, unit: "s", kind: "setting", reason: "its finger set this long before its stroke" },
        ramp: { value: 0.01, unit: "s", kind: "setting", reason: "its finger, its bow's start and each change of its losses made over this, a finger's least: a finger set at once on a ringing string had clicked" },
        accelerating: { value: 0.05, unit: "s", kind: "setting", reason: "its bow's speed reached over this from rest" },
        lift: { value: 0.02, unit: "s", kind: "setting", reason: "its bow lifted over this at its note's end" },
        dampAfter: { value: 0.03, unit: "s", kind: "setting", reason: "its string damped this long after its bow's lift" },
        damped: { value: 30, unit: "times its losses", kind: "setting", reason: "its string's losses this many times its own between notes, so each note begins from silence" },
        leastLag: { value: 2, unit: "samples", kind: "setting", reason: "a period sought no shorter than this: the shortest a sampled sound holds (the Nyquist frequency's)" },
        lagSpan: { value: [0.97, 1.03], unit: "share of the period", kind: "setting", reason: "its period sought within 3% of f0's" },
        lagMargin: { value: 1, unit: "samples", kind: "setting", reason: "and to a sample past the span's top, its truncation" },
        leastPeriods: { value: 4, unit: "periods", kind: "setting", reason: "a window read only where it holds this many periods past its longest lag" },
        lagSteps: { value: 24, unit: "steps", kind: "setting", reason: "its fractional lag found by this many golden-section steps, deterministic: to 0.618^24, about 1e-5, of a sample's search" },
        repeats: { value: [2, 3], unit: "periods", kind: "setting", reason: "a motion repeating every two or three periods (raucous): how alike it is there, and its energy at its harmonics' halves and thirds" },
        flown: { value: [2, 3], unit: "harmonics", kind: "setting", reason: "a string flown to its octave or its twelfth (multiple slipping) sounds only its even harmonics or its thirds" },
        mostHarmonics: { value: 40, unit: "harmonics", kind: "setting", reason: "its harmonics read up to the fortieth" },
        nyquistShare: { value: 0.9, unit: "share of the Nyquist frequency", kind: "setting", reason: "and below this share of the highest frequency its rate holds" },
        harmonicBand: { value: 10, unit: "1, f0 over it", kind: "setting", reason: "each harmonic read within f0 over this either side of it" },
        noiseFrom: { value: 0.2, unit: "share of f0", kind: "setting", reason: "its noise and subharmonics read from this share of f0 up" },
        dividedHarmonics: { value: 12, unit: "harmonics", kind: "setting", reason: "how divided its harmonics are read on its first twelve" },
        fundamentalHarmonics: { value: 8, unit: "harmonics", kind: "setting", reason: "its fundamental's share read of its first eight harmonics' energy" },
        jitterWindows: { value: 3, unit: "windows", kind: "setting", reason: "its jitter read only where this many windows' periods were found" },
        jitterFloor: { value: 1e-4, unit: "share of the period", kind: "setting", reason: "its jitter's logarithm floored here: a period steadier than a ten-thousandth of itself reads as that" },
        ridge: { value: 1e-3, unit: "1", kind: "setting", reason: "each judgement's logistic regression penalized this much (ridge, its bias apart), so separable notes still give finite weights" },
        tolerance: { value: 1e-10, unit: "1", kind: "setting", reason: "Newton's method stopped where no weight moves more than this" },
        most: { value: 100, unit: "steps", kind: "setting", reason: "or after this many steps" },
        scaleFloor: { value: 1e-12, unit: "1", kind: "setting", reason: "a feature's spread floored here, so a feature that never changes standardizes to zero" },
        decision: { value: 0.5, unit: "share", kind: "setting", reason: "a judgement says yes at even odds or over" },
        banks: { value: ["iowa-mis-still", "vsco2-ce"], unit: "banks", kind: "setting", reason: "the recorded players' notes read where none are asked: the vendored banks with bowed sustains (Iowa MIS, VSCO 2 CE)" },
        attackUnmeasured: { value: 0.1, unit: "s", kind: "setting", reason: "a recording whose attack was not measured taken as attacking over this" },
        pastAttack: { value: 0.15, unit: "s", kind: "setting", reason: "a recording's steady part read from this long past its attack" },
        beforeRelease: { value: 0.1, unit: "s", kind: "setting", reason: "to this long before its release" },
        leastSteady: { value: 0.3, unit: "s", kind: "setting", reason: "a recording read only where its steady part is this long" },
        mostSteady: { value: 1, unit: "s", kind: "setting", reason: "and read for this long at most" }
      }
    },
    "noise-profile-selftest": {
      about: "noise_profile.py's selftest: the features of made sounds -- a sawtooth like a bowed string's, periodic, clean, its fundamental strong; the same with a subharmonic, repeating every second period; noise -- each told apart.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3a)",
      settings: {
        rate: { value: 44100, unit: "Hz", kind: "setting", reason: "its sounds made at this rate, the banks'" },
        f0: { value: 196, unit: "Hz", kind: "setting", reason: "at the violin's G" },
        seconds: { value: 0.5, unit: "s", kind: "setting", reason: "each this long" },
        subharmonic: { value: 0.4, unit: "share of the sawtooth's peak", kind: "setting", reason: "the subharmonic a half-period motion adds this large" },
        seed: { value: 1, unit: "1", kind: "setting", reason: "its noise's seed" },
        periodic: { value: 0.98, unit: "1", kind: "setting", reason: "the sawtooth read periodic over this" },
        quietDb: { value: -30, unit: "dB", kind: "setting", reason: "its noise and subharmonics under this" },
        apartDb: { value: 20, unit: "dB", kind: "setting", reason: "the subharmonic's and the noise's own levels this much over the sawtooth's" },
        unperiodic: { value: 0.5, unit: "1", kind: "setting", reason: "noise read periodic under this" }
      }
    },
    "schelleng-regime": {
      about: "Which regime a steady bowed bridge force is in -- Helmholtz, multiple, raucous, slipping or silent -- by P. M. Galluzzo's waveform identification (2004, section 4.2.3, after Woodhouse; the algorithm the robot's own authors used): the bridge force scaled by 1/v_b, the rise a sticking string makes taken from it, averaged over beta T, and its levels' histogram read, each stair a peak, the spacing between peaks a flyback (native/strings-model/schelleng.py). Galluzzo gives the criterion, not its numbers: they are set where its selftest classifies synthetic bridge forces of each regime every one as made.",
      source: "galluzzo-2004",
      settings: {
        periodic: { value: 0.9, unit: "1", kind: "setting", reason: "a sound is heard as a note where its periodicity at the period its finger stops is at least this (the strings' check's 'heard')" },
        slip: { value: 0.5, unit: "1", kind: "setting", reason: "a fall in the force: a run of steps over this share of the period's steepest, dropping the force at least this share of its largest fall" },
        quiet: { value: 0.05, unit: "1", kind: "setting", reason: "silent under this share of the string's Helmholtz amplitude at that bow (no motion kept)" },
        stair: { value: 0.3, unit: "1", kind: "setting", reason: "its peaks' spacings within this of 2 Z / beta, and its stairs' share within this: Galluzzo's tolerance, set where the selftest classifies every synthetic regime as made" },
        peak: { value: 0.25, unit: "1", kind: "setting", reason: "a stair's peak stands over this share of the histogram's tallest bin: set where the selftest classifies every synthetic regime as made" },
        steady: { value: 0.05, unit: "1", kind: "setting", reason: "a robot measurement's steady part: its bow's speed within this of its plateau's, the later half of that" },
        robotRate: { value: 5e4, unit: "Hz", kind: "setting", reason: "the robot's recordings' rate (Lampis et al.'s whole_N.csv at 50 kHz)" },
        speedFloor: { value: 1e-6, unit: "m/s", kind: "setting", reason: "a bow's speed never under this as the force is read against it: a stopped bow divides nothing" },
        stairWidth: { value: 20, unit: "stairs", kind: "setting", reason: "a level on a stair within a step over this of a peak's" },
        leastBins: { value: 8, unit: "bins", kind: "setting", reason: "the staircase's histogram at least this many bins" },
        slippingSlips: { value: 2, unit: "slips", kind: "setting", reason: "a staircase flat for less than all but this many slips' share of a period (each beta T), less its tolerance, is no staircase: the string slipping" },
        lagSpan: { value: [0.9, 1.1], unit: "periods", kind: "setting", reason: "its periodicity read at lags across this span of the period its finger stops" },
        subharmonicBand: { value: [0.15, 0.85], unit: "shares of f0", kind: "setting", reason: "its subharmonic: the loudest component in this band under its fundamental" },
        noSubharmonicDb: { value: -120, unit: "dB", kind: "setting", reason: "its subharmonic where the band holds no component" },
        floor: { value: 1e-30, unit: "1", kind: "setting", reason: "a ratio's least before its logarithm: nothing, where it is none" },
        robotHeld: { value: 0.25, unit: "s", kind: "setting", reason: "a robot measurement taken only where its bow held its plateau's speed this long or longer" },
        robotTop: { value: 90, unit: "percentile", kind: "setting", reason: "its plateau's speed: this percentile of its bow's speeds" },
        robotBand: { value: [60, 140], unit: "Hz", kind: "setting", reason: "the robot's G2 strings' fundamental found in this band" }
      }
    },
    "schelleng-map": {
      about: "A string's Schelleng diagram mapped on the model as the robot's was on real strings (schelleng.py model): every force and bow-bridge distance of the robot's grid classified.",
      source: "lampis-2024",
      settings: {
        betas: { value: [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.14, 0.17, 0.2], unit: "share of the string", kind: "setting", reason: "the robot's grid, Schoonderwaldt et al.'s before it: relative bow-bridge distances 0.02 to 0.2" },
        type: { value: 2, unit: "Artifastring instrument", kind: "setting", reason: "a model map where no instrument is asked: the cello, the robot's instrument (Lampis, Mayer & Chatziioannou 2024)" },
        string: { value: 1, unit: "string", kind: "setting", reason: "its G string, the robot's" },
        seconds: { value: 1, unit: "s", kind: "setting", reason: "each point held this long, read over its second half" },
        speeds: { value: [0.05, 0.1, 0.2], unit: "m/s", kind: "setting", reason: "a model map's bow speeds where none are asked: three a factor of two apart from 0.05 m/s, a speed the robot bowed (27 October 2026, claude-scratch/strings-neutral/robot-both.json)" },
        forces: { value: [0.1, 0.117, 0.138, 0.162, 0.19, 0.223, 0.262, 0.307, 0.361, 0.424, 0.497, 0.584, 0.685, 0.804, 0.944, 1.109, 1.302, 1.528, 1.794, 2.106, 2.472, 2.902, 3.407, 4], unit: "N", kind: "setting", reason: "the robot's forces, 0.1 to 4 N, 24 log-spaced, to the millinewton" }
      }
    },
    "schelleng-selftest": {
      about: "The classifier's selftest (native/strings-model/schelleng.py selftest): synthetic bridge forces of each regime, made as the physics makes them -- a sawtooth rising 2 Z v / beta a period with Schelleng's ripples and noise, two flybacks a period, flybacks only every few periods, a small sinusoid, noise -- across bow-bridge distances, both bow directions and seeds; each must be classified as made.",
      source: "galluzzo-2004",
      settings: {
        f0: { value: 98, unit: "Hz", kind: "setting", reason: "the synthetic string's fundamental: the robot's G2" },
        impedance: { kind: "setting", derive: { equation: "same", inputs: { value: "object:lampis-2024-g-strings:A.impedance" } }, unit: "kg/s", reason: "its impedance: the robot's A-type G string's measured" },
        beta: { value: 0.1, unit: "share of the string", kind: "setting", reason: "its bow-bridge distance where none is given" },
        speed: { value: 0.1, unit: "m/s", kind: "setting", reason: "its bow's speed where none is given" },
        seconds: { value: 1, unit: "s", kind: "setting", reason: "each signal this long" },
        ripple: { value: 0.08, unit: "share of the drop", kind: "setting", reason: "Schelleng's ripples, period beta T, this large" },
        noise: { value: 0.02, unit: "share of the drop", kind: "setting", reason: "its noise this large" },
        slippingSize: { value: 0.3, unit: "share of the drop", kind: "setting", reason: "a slipping string's sinusoid this large" },
        secondFlyback: { value: 0.45, unit: "share of a period", kind: "setting", reason: "a multiple flyback's second slip this far into each period" },
        raucousEvery: { value: [2, 5], unit: "periods", kind: "setting", reason: "a raucous string's flybacks every 2 to 4 periods, drawn (the upper end exclusive)" },
        betas: { value: [0.03, 0.06, 0.1, 0.2], unit: "share of the string", kind: "setting", reason: "the selftest's bow-bridge distances" },
        speeds: { value: [0.1, -0.1], unit: "m/s", kind: "setting", reason: "its bow's speeds, both directions" },
        seeds: { value: 3, unit: "seeds", kind: "setting", reason: "its seeds for each" }
      }
    },
    "attack-transient": {
      about: "How long a bowed note takes to reach Helmholtz motion, and what it does meanwhile (native/strings-model/attack_transient.py): each note found in the bridge force, then the regime read on a window of periods stepped a period at a time, judged against the limits listeners accept.",
      source: "guettler-askenfelt-1997",
      settings: {
        window: { value: 4, unit: "periods", kind: "setting", reason: "a window of periods each regime is read on" },
        onset: { value: 0.02, unit: "1", kind: "setting", reason: "a note begins where its envelope (a period's mean |x|) stands over this share of the file's greatest" },
        leastPeriods: { value: 10, unit: "periods", kind: "setting", reason: "a note found only where its envelope stands over its onset for more than this many periods" },
        shownRuns: { value: 12, unit: "runs", kind: "setting", reason: "each note's first this many runs of regimes printed" }
      }
    },
    "strings-probe": {
      about: "The strings engine's driver as the fits play it (native/strings-model/probe.py): its rate, and how a note heard is ended.",
      source: null,
      settings: {
        rate: { value: 44100, unit: "Hz", kind: "setting", reason: "the engine's rate: Artifastring's instrument sample rate (public/shared/float-wav.js's, where a file names none)" },
        lift: { value: 0.2, unit: "s", kind: "setting", reason: "the bow lifted over this after a note heard" },
        silent: { value: 11920928955078125e-23, unit: "1", kind: "setting", reason: "the string rung down by the driver to under a 24-bit file's smallest step at its own level: a render kept for the owner ends in silence, never cut" },
        wavHeader: { value: 44, unit: "bytes", kind: "setting", reason: "the driver's output a 32-bit float mono WAV after a 44-byte header (calibrate-strings-model.mjs readFloatWav)" },
        fullScale: { value: 4, unit: "1", kind: "setting", reason: "a driver's sample past this (or not finite) is one the model could not compute, silenced as a render's stem silences it (public/shared/float-wav.js floatWav reads it too): one such sample poisons a mix's every return after it" },
        reach: { value: 0.08, unit: "s", kind: "setting", reason: "the probe's note: its bow brought to its speed over this from silence (the actions calibrate-strings-model.mjs note writes)" },
        seconds: { value: 2, unit: "s", kind: "setting", reason: "a probe's note held this long where none is asked" },
        heard: { value: 0.4, unit: "s", kind: "setting", reason: "a note heard over this much of its steady part, from the middle of its second half" },
        bins: { value: 131072, unit: "bins", kind: "setting", reason: "its spectrum read at this many points" },
        search: { value: 1.5, unit: "semitones", kind: "setting", reason: "its fundamental found within this of the pitch it is near" },
        bottom: { value: 40, unit: "Hz", kind: "setting", reason: "its band from this" },
        top: { value: 2e4, unit: "Hz", kind: "setting", reason: "to this, its harmonics counted to here" },
        harmonicHz: { value: 6, unit: "Hz", kind: "setting", reason: "a component counts as a harmonic within this of one" },
        harmonicShare: { value: 6e-3, unit: "share of its frequency", kind: "setting", reason: "or within this share of it, the wider" },
        fractions: { value: [0.2, 0.25, 0.3333333333333333, 0.4, 0.5, 0.6, 0.6666666666666666, 0.75, 0.8], unit: "shares of f0", kind: "setting", reason: "a motion repeating every few periods looked for at these fractions of its fundamental" },
        fractionHz: { value: 3, unit: "Hz", kind: "setting", reason: "each fraction read within this" },
        highs: { value: [8e3, 18e3], unit: "Hz", kind: "setting", reason: "its highs: this band against the whole" },
        shownDb: { value: 60, unit: "dB", kind: "setting", reason: "a fraction printed where it stands within this of the loudest" },
        floor: { value: 1e-30, unit: "1", kind: "setting", reason: "a ratio's least before its logarithm: nothing, where it is none" }
      }
    },
    "strings-seat": {
      about: "A bowed string's seat in a section (public/bots/lib/modules/section-seat.js): its draws' streams, how far ahead it looks, and the tolerances it compares times and pitches within.",
      settings: {
        arrivalMost: { value: 0.1, unit: "s", kind: "setting", reason: "a seat's sound reaching the listener later than its section's nearest by under this is its seating's (seating.js), a later one refused as no seat's: about 34 m of air, past any stage's depth" },
        saltBow: { value: 2826, unit: "1", kind: "setting", reason: "its bow's draws one stream of its seat's (0xb0a): a name, any other distinct from its other streams' as good" },
        saltTake: { value: 31310, unit: "1", kind: "setting", reason: "its take's draw another stream (0x7a4e): a name" },
        saltBite: { value: 45438, unit: "1", kind: "setting", reason: "each note's bite another stream (0xb17e): a name" },
        saltPace: { value: 2019, unit: "1", kind: "setting", reason: "its tremolo's pace another stream (0x7e3): a name" },
        takes: { value: 1024, unit: "takes", kind: "setting", reason: "a seat's first take of a pitch drawn among this many, far more than any bank records of one pitch, each change of bow the next (audio.js reads it modulo the bank's own)" },
        least: { value: 1e-6, unit: "as divided", kind: "setting", reason: "a phrase's share left or its length in s never taken under this as a divisor: at its end, or of no length, divided by this, not by zero" },
        ahead: { value: 8, unit: "ticks", kind: "setting", reason: "a line told rubato by its conductor (part-rubato.js) looked into this many ticks ahead, as far as its arch is taken to move a note earlier: ours, the told arch bounded nowhere" },
        same: { value: 1e-9, unit: "s", kind: "setting", reason: "two times the same instant within this: a float's rounding" },
        quickWithin: { value: 1e-6, unit: "s", kind: "setting", reason: "a note quicker than its beat by more than this a quick one, slurred in a line's groups: a float's rounding of a written length" },
        endWithin: { value: 1e-3, unit: "s", kind: "setting", reason: "a note reaching the piece's end within this held open to the cutoff: a millisecond, under any written length" },
        leastSlide: { value: 1e-3, unit: "s", kind: "setting", reason: "a glissando's slide never shorter than this, a divisor: a millisecond" },
        samePitch: { value: 0.25, unit: "semitones", kind: "setting", reason: "a pitch within this of the one held the same, repeated (never slurred to): a quarter of a semitone, wider than any player's own few cents or a microtonal tuning's retuning of one note" },
        onGrid: { value: 0.125, unit: "beats", kind: "setting", reason: "a note within this of a position of its metre's grid on it, weighed as it (else the grid's least): an eighth of a beat" }
      }
    },
    "strings-section": {
      about: "A bowed string section's seats, sizes and draws (public/shared/performers/string-section.js): the bounds it checks a size within, its seeds' span, a player's own stream, and its tolerance.",
      settings: {
        mostSeats: { value: 64, unit: "players a section", kind: "setting", reason: "a section's size refused past this many players: past any orchestra's (the full one's 16 first violins four times over), a typing slip's guard" },
        seedSpan: { value: 2147483648, unit: "seeds", kind: "setting", reason: "a pool's seed a whole number under this (2^31), a non-negative 32-bit integer as every seeded source takes it" },
        saltPlayer: { value: 20983, unit: "1", kind: "setting", reason: "a player's own inflection one stream of its seat's (0x51f7): a name, any other distinct from its other streams' as good" },
        same: { value: 1e-9, unit: "share", kind: "setting", reason: "a share of desks rounded up but for a float's rounding within this" },
        seatsPerBot: { value: 8, unit: "seats", kind: "setting", reason: "the most seats one bot plays: the kit's Surge XT patches voice eight notes at once (mass_clodbot MASS.lines, Surge's polylimit in the kit's patches)" }
      }
    }
  }
};

// registry/method/levels.json
var levels_default = {
  schema: "musebots.registry-methods/1",
  about: "How loud each part is rendered (registry/README.md): every modelled instrument's audio set from its measured sound power, so that the parts stand to one another as the instruments do.",
  methods: {
    "stem-level": {
      about: "A modelled part's audio level from its instrument's sound power (public/shared/performers/sound-power.js stemLevelDb; sound-power.json, TU Berlin's anechoic database, Weinzierl et al. 2017): its held notes' RMS, dBFS, as it enters its player's channel, its sound power level in dB re 1 pW plus the reference.",
      source: "ours",
      settings: {
        reference: { value: -130, unit: "dB", kind: "setting", reason: "the loudest instrument measured, the tuba, at its ff (112.3 dB at its median pitch) 18 dB under full scale, so that a section of brass at ff stays under each player's limiter (audio.js BOT_LIMITER, past its channel's +3.7 dB) and its fff high in its compass reaches it; the bowed strings' violin at ff then 5 dB under where its model stood before (8 October 2026: -37.54 dBFS, its stem gain matched to its recordings)" }
      }
    },
    "velocity-law": {
      about: "How a velocity, 0 to 1, is heard as an amplitude within a family's dynamic range (audio.js familyVelocityGain, planned-dynamics.js velocityAtDb): its amplitude a power of a line from the range's floor to full scale.",
      settings: {
        exponent: { value: 2, unit: "1", kind: "setting", reason: "a velocity's amplitude rising as the square of a line through the family's range where its family names no other (Dannenberg 2006's square law, which matches commercial synthesizers' velocity curves within a chosen range in dB)" }
      }
    }
  }
};

// registry/method/personality.json
var personality_default = {
  schema: "musebots.registry-methods/1",
  about: "A player's personality (public/shared/performers/personality.js; docs/PLAYER_PERSONALITY.md): how far it pushes its instrument's idiom and what lines it prefers, each lever a draw from its seed within the range here, or given (a spec's, an LLM's later). Every range holds the line planner's own value (line.js LINE, wind-line.js WIND_LINE, flute_clodbot.js FLUTE), so that a personality is a place among the planner's settings, never outside them.",
  methods: {
    personality: {
      about: "The levers, each a share 0 to 1 drawn from the player's seed (its ensemble's seed, its identity and its instrument), read across its range here; daring is the one that reaches toward the instrument's limits (its facts, instrument-facts.js), tone the one from a clean tone to its extremes -- its techniques, its rhythmic grammars and its ranges in its tone's parameters -- the rest its style.",
      source: "ours",
      settings: {
        dynamicSteps: { value: 2, unit: "marks", kind: "setting", reason: "how many dynamic marks the most daring player goes past the dynamics comfortable in a register (wind-line.js WIND_LINE lowMost f and highLeast p): to fff low and ppp high, the scale's ends (dynamics.js)" },
        shortest: { range: [0.08, 0.12], unit: "s", kind: "setting", reason: "its quickest note, the most daring's the planner's own (line.js LINE.shortest: a wind's double tonguing near it), the least daring's a single-tongued note's at some 8 notes a second (Bertsch & Hoole 2014, players-ranges.mjs repeatRate)" },
        phraseRange: { range: [12, 18], unit: "semitones", kind: "setting", reason: "a phrase's widest range, about the planner's 14 (line.js LINE.phraseRange)" },
        density: { range: [0.25, 0.5], unit: "share", kind: "setting", reason: "its density among equals, about the flute's 0.35 (flute_clodbot.js FLUTE)" },
        loudness: { range: [0.4, 0.6], unit: "share", kind: "setting", reason: "its loudness among equals, about the flute's 0.5" },
        fioriture: { range: [0.2, 0.55], unit: "share", kind: "setting", reason: "its fioriture as a soloist, about the flute's 0.35" },
        leap: { range: [0.08, 0.32], unit: "share", kind: "setting", reason: "a leap's chance in its motif, about the planner's 0.18 (line.js LINE.leap)" },
        slurs: { range: [2, 6], unit: "notes", kind: "setting", reason: "its longest slur of quick notes, about the planner's 4 (LINE.slurMost)" },
        motifFewest: { range: [3, 4], unit: "notes", kind: "setting", reason: "its motif's fewest notes, with motifMost on the one draw motifLength: the planner's 3 to 6 (LINE.motifNotes) among them" },
        motifMost: { range: [5, 7], unit: "notes", kind: "setting", reason: "its motif's most notes, on motifLength's draw with motifFewest" },
        runs: { range: [3, 6], unit: "steps", kind: "setting", reason: "a run's most steps one way outside an ornament, about the planner's 4 (LINE.runMost)" },
        rests: { range: [0.3, 0.7], unit: "share", kind: "setting", reason: "the silence after its cadence, a share of the bar's last group, about the planner's 0.5 (LINE.restShare)" },
        commas: { range: [0.1, 0.3], unit: "share", kind: "setting", reason: "the comma after its idea, a share of its last note, about the planner's 0.2 (LINE.commaShare)" },
        landing: { range: [0.4, 1], unit: "share", kind: "setting", reason: "how high above its floor a cadence may land, a share of its span, about the planner's 0.75 (LINE.landing's upper end)" },
        grammarLeast: { value: 0.15, unit: "share", kind: "setting", reason: "the least weight a motif's grammar is given, against the most preferred's 1, so that every grammar stays open to it (line.js chooseMotif)" },
        quoting: { range: [0.5, 1], unit: "share", kind: "setting", reason: "how often, where it was given motifs, its motif is one of them rather than its own: given them, it prefers them more often than not" },
        techniques: { range: [0, 0.6], unit: "share of its phrases", kind: "setting", reason: "its tone: how often a phrase of its takes an extended technique its instrument sounds (techniques.js: a hum, a growl, a flutter, a harmonic, a multiphonic; a mute as often), from the cleanest tone's none -- the planner's own, a soloist having played none -- to the most extreme's three phrases in five, each still the instrument's own" },
        toneWidth: { range: [0.1, 1], unit: "share of a parameter's span", kind: "setting", reason: "its tone: how wide its range in each of its tone's parameters (personality.js TONE_RANGES) -- its vibrato's width, a technique's depth, its bow's pressure and contact -- from the cleanest tone's tenth of the span about the ordinary to the most extreme's whole span, at its tone times a share each range draws its own (personality.js drawPersonality: of two extreme characters, one may range over every vibrato and the other keep to one)" },
        vibratoMost: { value: 3, unit: "times its players' measured width", kind: "setting", reason: `its tone: the widest vibrato a character's range reaches (the owner, 3 November 2026: "some performer characters might allow huge vibrato ranges; others not"), three times its players' measured width (vibrato.js): on the violin's 40 c, 120 c peak to peak, as wide as professional lyric singers' mean extent of +-71 c (Prame 1997, doi:10.1121/1.419735); its share 1/3 its players' own, the ordinary a clean tone keeps about` },
        harmonicPartials: { range: [2, 3], unit: "partial", kind: "setting", reason: "its tone: the natural harmonic a phrase of a bowed string takes, its partial by its technique's depth -- the octave at a shallow one, the twelfth at a deep one: the string touched at its half or its third, the two natural harmonics a string player most plays and the surest to speak" },
        rhythmicGrammars: { range: [-0.5, 0.5], unit: "share of the way", kind: "setting", reason: "its tone: how far its motifs' rhythmic grammars' shares are drawn toward 1 -- a rhythm on a repeated tone, unequal durations, a rest inside it (line.js LINE.grammars) -- and the others' toward 0, from the cleanest tone's -1/2 (the rhythmic ones halfway to 0, the others halfway to 1) to the most extreme's 1/2: the planner's own, none, at the middle" }
      }
    }
  }
};

// registry/equations.js
var aperture = (a, b, t) => {
  let x2 = 1, y2 = b / a;
  for (let i = 0; i < 64 && Math.abs(x2 - y2) > 1e-15 * x2; i++) [x2, y2] = [(x2 + y2) / 2, Math.sqrt(x2 * y2)];
  return 1 / (1 / (2 * a * x2) + t / (Math.PI * a * b));
};
var median = (values) => {
  const v = [...values].sort((a, b) => a - b), m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
var EQUATION = Object.freeze({
  "midi-hz": ({ midi, a4 }) => a4 * 2 ** ((midi - 69) / 12),
  "hz-midi": ({ hz, a4 }) => 69 + 12 * Math.log2(hz / a4),
  "pounds-newtons": ({ pounds, poundForce }) => pounds * poundForce,
  "string-density": ({ T, L, f0 }) => T / (2 * L * f0) ** 2,
  "string-impedance": ({ T, mu }) => Math.sqrt(T * mu),
  "inharmonicity-at-open": ({ takes, stopped }) => median(takes) / 2 ** (2 * stopped / 12),
  "stiffness-from-inharmonicity": ({ B, T, L }) => B * T * L * L / Math.PI ** 2,
  "cylinder-diameter": ({ mu, rho }) => Math.sqrt(4 * mu / (Math.PI * rho)),
  "young-from-stiffness": ({ EI, d }) => 64 * EI / (Math.PI * d ** 4),
  "mean": ({ values }) => values.reduce((a, b) => a + b, 0) / values.length,
  "same": ({ value: value3 }) => value3,
  "periods-in": ({ seconds, hz }) => seconds * hz,
  "seconds-for": ({ periods, hz, least }) => Math.max(least, periods / hz),
  "scale-ratio": ({ a, a0 }) => a / a0,
  "least-force-scale": ({ scale, Z: Z2, c0, c1, c2 }) => scale * Z2[0] ** 2 / ((c0 ** 2 + c1 ** 2 + c2 ** 2) / 3),
  "table-read": ({ table, x: x2 }) => {
    if (x2 <= table[0][0]) return table[0][1];
    for (let k = 1; k < table.length; k++) if (x2 <= table[k][0]) return table[k - 1][1] + (table[k][1] - table[k - 1][1]) * (x2 - table[k - 1][0]) / (table[k][0] - table[k - 1][0]);
    const [a, b] = table.slice(-2);
    return b[1] + (b[1] - a[1]) * (x2 - b[0]) / (b[0] - a[0]);
  },
  "string-loss-law": ({ r0, r2, f }) => r0 + r2 * f * f,
  "least": ({ values }) => Math.min(...values),
  "ratio": ({ a, b }) => a / b,
  "lowest-hz": ({ tuning, a4 }) => a4 * 2 ** ((Math.min(...tuning) - 69) / 12),
  "loss-table": ({ decays, modes, f0, E, d, T, L }) => {
    const B = Math.PI ** 3 * E * d ** 4 / (64 * T * L * L);
    return decays.slice(0, modes).map((r, k) => [(k + 1) * f0 * Math.sqrt(1 + B * (k + 1) ** 2), r]);
  },
  "mersenne-f0": ({ T, mu, L }) => Math.sqrt(T / mu) / (2 * L),
  "cylinder-stiffness": ({ E, d }) => E * Math.PI * d ** 4 / 64,
  "elliptic-aperture-conductance": ({ a, b, t }) => aperture(a, b, t),
  "f-holes-conductance": ({ fLength, fWidth, fThickness }) => 2 * aperture(fLength / 2, fWidth / 2, fThickness),
  "body-air-volume": ({ body, upper, middle, lower, ribs, archTop, archBack }) => body * (upper + middle + lower) / 3 * (ribs + (archTop + archBack) / 2),
  "helmholtz-ratio": ({ K, V: V2, K0, V0 }) => Math.sqrt(K / V2 / (K0 / V0)),
  "fingerboard-end-semitones": ({ string, fingerboard: fingerboard2 }) => 12 * Math.log2(string / (string - fingerboard2)),
  "inharmonicity-of-stiffness": ({ EI, T, L }) => Math.PI ** 2 * EI / (T * L * L),
  "finger-place": ({ semitones }) => 1 - 2 ** (-semitones / 12),
  "log-grid": ({ least, span, count }) => Array.from({ length: count }, (_, k) => least * span ** (k / (count - 1))),
  "semitones-ratio": ({ semitones }) => 2 ** (semitones / 12),
  "ratio-semitones": ({ ratio: ratio2 }) => 12 * Math.log2(ratio2),
  "place-semitones": ({ place }) => -12 * Math.log2(1 - place),
  "cents-semitones": ({ cents }) => cents / 100,
  "from-centi": ({ centi }) => centi / 100,
  "db-gain": ({ db }) => 10 ** (db / 20),
  "loss-ratio-for": ({ db, rate, seconds }) => Math.log(10 ** (db / 20)) / (rate * seconds),
  "helmholtz-force-scale": ({ force, contact, Z: Z2, speed }) => force * contact / (2 * Z2 * speed),
  "amplitude-db": ({ ratio: ratio2 }) => 20 * Math.log10(ratio2),
  "likelihood-residual": ({ logp }) => Math.sqrt(Math.max(0, -2 * logp)),
  "power-db": ({ ratio: ratio2 }) => 10 * Math.log10(ratio2),
  "helmholtz-rise": ({ Z: Z2, speed, beta, period, t }) => 2 * Z2 * speed * t / (beta * period),
  "semitones-octaves": ({ semitones }) => semitones / 12,
  "golden-section": () => (Math.sqrt(5) - 1) / 2,
  "parabola-peak": ({ left, middle, right }) => {
    const curve = left - 2 * middle + right;
    return curve < 0 ? 0.5 * (left - right) / curve : 0;
  },
  "sawtooth": ({ t, f0 }) => 2 * (t * f0 - Math.floor(t * f0)) - 1,
  "cents-ratio": ({ cents }) => 2 ** (cents / 1200),
  "normal-deviate": ({ u, v }) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u))) * Math.cos(2 * Math.PI * v)
});

// registry/registry.js
var FILES = Object.freeze({
  "sources.json": sources_default,
  "physics/constants.json": constants_default,
  "physics/equations.json": equations_default,
  "modules.json": modules_default,
  "objects/bowed.json": bowed_default,
  "objects/artifastring-strings.json": artifastring_strings_default,
  "players/bowed.json": bowed_default2,
  "objects/winds.json": winds_default,
  "players/winds.json": winds_default2,
  "stimuli/stimuli.json": stimuli_default,
  "method/strings.json": strings_default,
  "method/levels.json": levels_default,
  "method/personality.json": personality_default
});
var KINDS = Object.freeze(["literature", "vernacular", "other", "fit", "derived", "borrowed", "unmeasured", "setting"]);
var within = (folder, key) => Object.freeze(Object.assign({}, ...Object.entries(FILES).filter(([path]) => path.startsWith(`${folder}/`)).map(([, file]) => file[key] ?? {})));
var OBJECTS = within("objects", "nodes");
var PLAYERS = within("players", "nodes");
var METHODS = within("method", "methods");
var isLeaf = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v) && typeof v.kind === "string";
var tableOf = (of) => {
  if (of === "objects") return OBJECTS;
  if (of === "players") return PLAYERS;
  throw new Error(`registry: no tree ${of}`);
};
function lineage(id) {
  const out = [];
  for (let at = id; at != null; at = OBJECTS[at].is) {
    if (!Object.hasOwn(OBJECTS, at)) throw new Error(`registry: no object ${at}${at === id ? "" : ` (an ancestor of ${id})`}`);
    if (out.includes(at)) throw new Error(`registry: ${id}'s tree runs in a circle at ${at}`);
    out.push(at);
  }
  return out;
}
function dig(values, path) {
  const go = (at, keys3, captures) => {
    if (!keys3.length) return isLeaf(at) ? { leaf: at, captures } : null;
    if (!at || typeof at !== "object" || isLeaf(at) || Array.isArray(at)) return null;
    const [key, ...rest3] = keys3;
    return (Object.hasOwn(at, key) ? go(at[key], rest3, captures) : null) ?? (Object.hasOwn(at, "*") ? go(at["*"], rest3, [...captures, key]) : null);
  };
  return go(values, path.split("."), []);
}
var fill = (path, captures) => {
  let k = 0;
  return path.replace(/\{\}/g, () => captures[k++]);
};
function locate(of, id, path) {
  const [first, ...rest3] = path.split(".");
  for (const at of lineage(id)) {
    const node = tableOf(of)[at] ?? {}, hit = dig(node.values, path);
    if (hit) return { ...hit, at, part: null };
    const part = of === "objects" ? OBJECTS[at].parts?.[first] : null;
    if (part && rest3.length) return { at, part, rest: rest3.join(".") };
  }
  return null;
}
function resolve(of, id, path, stack) {
  const found = locate(of, id, path);
  if (!found) throw new Error(`registry: ${id} has no ${of === "players" ? "player value" : "value"} ${path} (its tree: ${lineage(id).join(" < ")})`);
  if (found.part) {
    const inner = resolve(of, found.part, found.rest, stack);
    return Object.freeze({ ...inner, id, path, inherited: found.at !== id || inner.inherited, part: found.part });
  }
  const { leaf, at, captures } = found, key = `${of}:${id}:${path}`, inherited = at !== id;
  if (stack.includes(key)) throw new Error(`registry: ${path} of ${id} is derived from itself (${stack.join(" <- ")})`);
  if (inherited && leaf.passes === false) throw new Error(`registry: ${path} is ${at}'s own, and ${id} gives none`);
  let ranged = leaf.value === void 0 && Array.isArray(leaf.range) && !leaf.derive && !leaf.like;
  const read2 = (node, p, caps, tree = of) => {
    if (p.startsWith("constant:")) return constant(p.slice("constant:".length));
    if (p.startsWith("setting:")) return settingEntry(...p.slice("setting:".length).split(":"), [...stack, key]).value;
    const cross2 = /^(object|player):(?:([^:]+):)?(.+)$/.exec(p);
    if (cross2) {
      const [, t, n, rest3] = cross2;
      return readIn(t === "object" ? "objects" : "players", n ?? node, rest3, caps);
    }
    if (tree !== of) return readIn(tree, node, p, caps);
    const full = fill(p, caps);
    if (full.includes("*")) {
      const [before, after] = full.split("*");
      return keysOf(node, before.replace(/\.$/, ""), of).map((k) => read2(node, `${before}${k}${after}`, []));
    }
    const e = resolve(of, node, full, [...stack, key]);
    if (e.ranged) ranged = true;
    return e.value;
  };
  const readIn = (tree, node, p, caps) => {
    const full = fill(p, caps);
    if (full.includes("*")) {
      const [before, after] = full.split("*");
      return keysOf(node, before.replace(/\.$/, ""), tree).map((k) => readIn(tree, node, `${before}${k}${after}`, []));
    }
    const e = resolve(tree, node, full, [...stack, key]);
    if (e.ranged) ranged = true;
    return e.value;
  };
  const compute = (node, spec, caps) => typeof spec === "string" ? read2(node, spec, caps) : equation(spec.equation, {
    ...Object.fromEntries(Object.entries(spec.inputs ?? {}).map(([name2, p]) => [name2, read2(node, p, caps)])),
    ...Object.fromEntries(Object.entries(spec.here ?? {}).map(([name2, p]) => [name2, read2(id, p, captures)]))
  });
  let value3 = leaf.value ?? leaf.range ?? leaf.file ?? null, kind = leaf.kind, borrowedFrom = null;
  if ((leaf.derive || leaf.like) && OBJECTS[id]?.abstract) return Object.freeze({ ...leaf, id, path, at, inherited, kind, value: null, template: true });
  if (leaf.derive) {
    const inputs = Object.fromEntries(Object.entries(leaf.derive.inputs).map(([name2, p]) => [name2, read2(id, p, captures)]));
    value3 = ranged ? null : equation(leaf.derive.equation, inputs);
  }
  if (leaf.like) {
    const L = leaf.like, target = compute(id, L.here ?? L.match, captures);
    const options = L.keys ? L.candidates.flatMap((c) => keysOf(c, "", of).map((k) => ({ node: c, caps: [k] }))) : L.candidates.map((c) => ({ node: c, caps: [] }));
    let best = null, score = Infinity;
    for (const o of options) {
      const d = Math.abs(Math.log(compute(o.node, L.match, o.caps) / target));
      if (d < score) {
        best = o;
        score = d;
      }
    }
    value3 = L.take === "@id" ? best.node : compute(best.node, L.take, best.caps);
    borrowedFrom = [best.node, ...best.caps].join(" ");
  }
  if (inherited && leaf.passes?.by && !(leaf.measuredOn ?? []).includes(id) && !ranged) {
    const at2 = (node, suffix) => Object.fromEntries(Object.entries(leaf.passes.inputs).map(([name2, p]) => [name2 + suffix, read2(node, p, [])]));
    value3 = value3 * equation(leaf.passes.by, { ...at2(id, ""), ...at2(leaf.passes.reference, "0") });
    kind = "borrowed";
    borrowedFrom = leaf.passes.reference;
  }
  return Object.freeze({ ...leaf, id, path, at, inherited, kind, value: value3, ...ranged ? { ranged } : {}, ...borrowedFrom ? { borrowedFrom } : {} });
}
var playerEntry = (id, path) => resolve("players", id, path, []);
var player = (id, path) => playerEntry(id, path).value;
function keysOf(id, path, of = "objects") {
  const out = [], parts = path === "" ? [] : path.split(".");
  const add = (keys3) => {
    for (const k of keys3) if (k !== "*" && !out.includes(k)) out.push(k);
  };
  for (const at of lineage(id)) {
    let group = tableOf(of)[at]?.values;
    for (const key of parts) group = group && typeof group === "object" && !isLeaf(group) ? group[key] : void 0;
    if (group && typeof group === "object" && !isLeaf(group)) add(Object.keys(group).filter((k) => !isLeaf(group[k])));
    const part = parts.length && of === "objects" ? OBJECTS[at].parts?.[parts[0]] : null;
    if (part) add(keysOf(part, parts.slice(1).join("."), of));
    if (!parts.length && of === "objects") add(Object.keys(OBJECTS[at].parts ?? {}));
  }
  return out;
}
function equationOf(name2) {
  if (!Object.hasOwn(EQUATION, name2) || !Object.hasOwn(equations_default.equations, name2)) throw new Error(`registry: no equation ${name2}`);
  return EQUATION[name2];
}
var equation = (name2, inputs) => equationOf(name2)(inputs);
function constant(name2) {
  if (!Object.hasOwn(constants_default.constants, name2)) throw new Error(`registry: no constant ${name2}`);
  return constants_default.constants[name2].value;
}
function settingEntry(method, name2, stack = []) {
  const m = METHODS[method];
  if (!m || !Object.hasOwn(m.settings ?? {}, name2)) throw new Error(`registry: method ${method} has no setting ${name2}`);
  const leaf = m.settings[name2], key = `setting:${method}:${name2}`;
  if (stack.includes(key)) throw new Error(`registry: setting ${method} ${name2} is derived from itself`);
  const input = (p) => {
    const [kind, ...rest3] = p.split(":");
    if (kind === "constant") return constant(rest3.join(":"));
    if (kind === "setting") return settingEntry(rest3[0], rest3[1], [...stack, key]).value;
    if (kind === "object") return resolve("objects", rest3[0], rest3.slice(1).join(":"), [...stack, key]).value;
    if (kind === "player") return resolve("players", rest3[0], rest3.slice(1).join(":"), [...stack, key]).value;
    throw new Error(`registry: setting ${method} ${name2}: no input ${p}`);
  };
  const value3 = leaf.derive ? equation(leaf.derive.equation, Object.fromEntries(Object.entries(leaf.derive.inputs).map(([k, p]) => [k, input(p)]))) : leaf.value ?? leaf.range ?? null;
  return Object.freeze({ ...leaf, method, name: name2, value: value3 });
}

// public/shared/performers/vocal-tract.js
var VocalTract = class _VocalTract {
  constructor(resonances = []) {
    this.resonances = resonances.map((r) => ({ frequency: r.frequency, q: r.q, peak: r.peak }));
  }
  // The tract as the instrument's players keep it in normal playing at a note sounding at `hz`: its first resonance
  // within its measured range (the geometric middle of each), and above the note's following frequency the resonance
  // that follows it, as measured (its offset above the note, its peak, on average).
  static normal(instrument2, hz) {
    const middle = ([a, b]) => Math.sqrt(a * b), at = (path) => playerEntry(instrument2, `tract.${path}`);
    const resonances = [{ frequency: middle(at("first.frequency").range), q: player(instrument2, "tract.first.q"), peak: middle(at("first.peak").range) }];
    if (hz >= player(instrument2, "tract.normal.above"))
      resonances.push({ frequency: hz + player(instrument2, "tract.normal.offset"), q: player(instrument2, "tract.normal.q"), peak: player(instrument2, "tract.normal.peak") });
    return new _VocalTract(resonances);
  }
  // Its impedance at `hz` (complex, Pa s/m^3): what the reed meets upstream, in series with the bore's.
  impedance(hz) {
    let re = 0, im = 0;
    for (const { frequency, q, peak } of this.resonances) {
      const x2 = q * (hz / frequency - frequency / hz), d = 1 + x2 * x2;
      re += peak / d;
      im -= peak * x2 / d;
    }
    return { re, im };
  }
  magnitude(hz) {
    const { re, im } = this.impedance(hz);
    return Math.hypot(re, im);
  }
  // As the engine's streaming player is told it (stream.rs TractLine): moved to over `seconds`.
  line(seconds) {
    return { resonances: this.resonances, seconds };
  }
};

// public/shared/estimation/yin-correlation.js
var plans = /* @__PURE__ */ new Map();
function plan(size) {
  if (plans.has(size)) return plans.get(size);
  const bits = Math.log2(size), reverse2 = new Uint32Array(size), cos = new Float64Array(size / 2), sin = new Float64Array(size / 2);
  for (let i = 0; i < size; i++) {
    let v = i, r = 0;
    for (let j = 0; j < bits; j++) {
      r = r << 1 | v & 1;
      v >>>= 1;
    }
    reverse2[i] = r;
  }
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos(2 * Math.PI * i / size);
    sin[i] = Math.sin(2 * Math.PI * i / size);
  }
  const answer = { size, reverse: reverse2, cos, sin };
  if (plans.size >= 4) plans.delete(plans.keys().next().value);
  plans.set(size, answer);
  return answer;
}
function fft(real, imag, p, inverse = false) {
  const n = p.size;
  for (let i = 0; i < n; i++) {
    const j = p.reverse[i];
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let span = 2; span <= n; span *= 2) {
    const half = span / 2, step = n / span;
    for (let start = 0; start < n; start += span) for (let j = 0; j < half; j++) {
      const c = p.cos[j * step], s2 = (inverse ? 1 : -1) * p.sin[j * step], a = start + j, b = a + half, r = c * real[b] - s2 * imag[b], im = s2 * real[b] + c * imag[b];
      real[b] = real[a] - r;
      imag[b] = imag[a] - im;
      real[a] += r;
      imag[a] += im;
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    real[i] /= n;
    imag[i] /= n;
  }
}
function yinFixedDifferences(samples, width, maxLag, { maxTransform = 131072 } = {}) {
  if (!samples || !Number.isSafeInteger(samples.length) || !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(maxLag) || maxLag < 0 || width + maxLag > samples.length || !Number.isSafeInteger(maxTransform) || maxTransform < 2 || maxTransform > 262144) throw new RangeError("Invalid YIN correlation support/budget");
  let size = 2;
  while (size < width + samples.length - 1) {
    size *= 2;
    if (size > maxTransform) throw new RangeError("YIN transform budget exceeded");
  }
  if (Array.from(samples).some((x2) => !Number.isFinite(x2))) throw new TypeError("Finite YIN samples required");
  const p = plan(size), a = new Float64Array(size), ai = new Float64Array(size), b = new Float64Array(size), bi = new Float64Array(size), prefix = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) {
    b[i] = samples[i];
    prefix[i + 1] = prefix[i] + samples[i] * samples[i];
    if (i < width) a[width - 1 - i] = samples[i];
  }
  if (!Number.isFinite(prefix.at(-1))) throw new RangeError("YIN sample energy overflow");
  fft(a, ai, p);
  fft(b, bi, p);
  for (let i = 0; i < size; i++) {
    const r = a[i] * b[i] - ai[i] * bi[i];
    ai[i] = a[i] * bi[i] + ai[i] * b[i];
    a[i] = r;
  }
  fft(a, ai, p, true);
  const differences = new Float64Array(maxLag + 1);
  let directFallbacks = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    const scale = prefix[width] + prefix[width + lag] - prefix[lag];
    let value3 = scale - 2 * a[width - 1 + lag];
    if (value3 <= 1e-10 * scale) {
      value3 = 0;
      for (let j = 0; j < width; j++) {
        const d = samples[j] - samples[j + lag];
        value3 += d * d;
      }
      directFallbacks++;
    }
    if (!Number.isFinite(value3)) throw new RangeError("Nonfinite YIN transform result");
    differences[lag] = value3;
  }
  return { differences, transformSize: size, directFallbacks, kind: "floating-point-approximation" };
}

// public/shared/estimation/pitch-yin.js
var YIN_DEFAULTS = Object.freeze({ minHz: 60, maxHz: 1200, threshold: 0.15, decimate: 4, silenceRms: 2e-3 });
function yinPitch(samples, sampleRate, options = {}) {
  const { minHz, maxHz, threshold, decimate, silenceRms } = { ...YIN_DEFAULTS, ...options };
  const d = Math.max(1, Math.floor(decimate)), n = Math.floor(samples.length / d), x2 = new Float32Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < d; k++) sum += samples[i * d + k];
    x2[i] = sum / d;
    energy += x2[i] * x2[i];
  }
  const rms = Math.sqrt(energy / Math.max(1, n)), rate = sampleRate / d;
  if (!(rms > silenceRms)) return { hz: null, midi: null, clarity: 0, rms };
  const tauMin = Math.max(2, Math.floor(rate / maxHz)), tauMax = Math.min(Math.floor(n / 2) - 1, Math.ceil(rate / minHz)), width = n - tauMax - 1;
  if (tauMax <= tauMin + 2 || width < tauMax / 2) return { hz: null, midi: null, clarity: 0, rms };
  const method = options.differenceMethod ?? "direct";
  if (!["direct", "fft"].includes(method)) throw new TypeError("Unknown YIN difference method");
  const differences = method === "fft" ? yinFixedDifferences(x2, width, tauMax + 1, { maxTransform: options.maxTransform }).differences : null;
  const normalized = new Float64Array(tauMax + 2);
  normalized[0] = 1;
  let running = 0;
  for (let tau2 = 1; tau2 <= tauMax + 1; tau2++) {
    let sum = differences?.[tau2] ?? 0;
    if (!differences) for (let j = 0; j < width; j++) {
      const v = x2[j] - x2[j + tau2];
      sum += v * v;
    }
    running += sum;
    normalized[tau2] = running > 0 ? sum * tau2 / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) if (normalized[t] < threshold) {
    while (t + 1 <= tauMax && normalized[t + 1] < normalized[t]) t++;
    tau = t;
    break;
  }
  if (tau < 0) {
    tau = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (normalized[t] < normalized[tau]) tau = t;
  }
  const a = normalized[tau - 1], b = normalized[tau], c = normalized[tau + 1] ?? b, den = a - 2 * b + c, shift = den > 0 ? Math.max(-1, Math.min(1, 0.5 * (a - c) / den)) : 0;
  const hz = rate / (tau + shift);
  return { hz, midi: 69 + 12 * Math.log2(hz / 440), clarity: Math.max(0, Math.min(1, 1 - b)), rms };
}
var NOTE_DEFAULTS = Object.freeze({ clarity: 0.8, stableFrames: 2, releaseFrames: 2, changeSemitones: 0.6 });

// public/shared/performers/fingering-diagrams.json
var fingering_diagrams_default = { about: "Each woodwind's fingering diagram as GNU LilyPond draws it (GNU LilyPond 2.26.0 (running Guile 3.0), scm/lily/define-woodwind-diagrams.scm; LilyPond is under the GPL v3 or later), taken apart key by key by scripts/make-fingering-diagrams.mjs, and each charted woodwind's keywork as its design tools hold it (render/synthesis/tools/export_keywork.py): what public/shared/performers/fingering-diagrams.js draws a fingering from.", lilypond: "GNU LilyPond 2.26.0 (running Guile 3.0)", families: { piccolo: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:oneR": { add: [[17.0717, 7.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:twoR": { add: [[17.0717, 10.2406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:threeR": { add: [[17.0717, 12.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:fourR": { add: [[17.0717, 16.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:fiveR": { add: [[17.0717, 18.9906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:sixR": { add: [[17.0717, 21.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "lh:bes": { add: [[16.0717, 5.9406, '<path d="M0 0L0.0000 -1.6900C0.0000 -2.1125 -0.2500 -2.2750 -0.5000 -2.2750C-1.1000 -2.2750 -1.1000 -1.2350 -0.5000 -0.9100C0.0000 -0.5200 0.0000 -0.1625 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [15.5717, 7.7406, '<path d="M0 0L0 -2.0150C0 -2.5188 -0.2500 -2.7125 -0.5000 -2.7125C-1.1000 -2.7125 -1.1000 -1.4725 -0.5000 -1.0850C0 -0.6200 0 -0.1938 0 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:b": { add: [[16.0717, 5.9406, '<path d="M0 0L0.0000 -1.6900C0.0000 -2.1125 -0.2500 -2.2750 -0.5000 -2.2750C-1.1000 -2.2750 -1.1000 -1.2350 -0.5000 -0.9100C0.0000 -0.5200 0.0000 -0.1625 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.5717, 7.7406, '<path d="M0 0L0 -2.0150C0 -2.5188 -0.2500 -2.7125 -0.5000 -2.7125C-1.1000 -2.7125 -1.1000 -1.4725 -0.5000 -1.0850C0 -0.6200 0 -0.1938 0 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[18.0717, 13.9906, '<path d="M0 0C0.1000 -0.1000 0.2000 -0.4000 0.3000 -0.6000C0.3000 -1.0000 0.8000 -1.0000 0.8000 -0.7000C0.8000 -0.3000 0.5000 -0.3000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:bes": { add: [[15.3217, 16.3656, '<path d="M0 0C0.1000 -0.1000 0.2000 -0.4000 0.3000 -0.6000C0.3000 -1.0000 0.8000 -1.0000 0.8000 -0.7000C0.8000 -0.3000 0.5000 -0.3000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:d": { add: [[16.0717, 17.7406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:dis": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:x": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.6217, 26.5406, '<text font-family="serif" font-size="1.7999" text-anchor="start" fill="currentColor">\n<tspan>X</tspan>\n</text>']], drop: [] } }, pairs: {}, whole: {}, box: [14.1217, 3.3156, 5.3, 24.525] }, flute: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:oneR": { add: [[17.0717, 7.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:twoR": { add: [[17.0717, 10.2406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:threeR": { add: [[17.0717, 12.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:fourR": { add: [[17.0717, 16.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:fiveR": { add: [[17.0717, 18.9906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:sixR": { add: [[17.0717, 21.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "lh:bes": { add: [[16.0717, 5.9406, '<path d="M0 0L0.0000 -1.6900C0.0000 -2.1125 -0.2500 -2.2750 -0.5000 -2.2750C-1.1000 -2.2750 -1.1000 -1.2350 -0.5000 -0.9100C0.0000 -0.5200 0.0000 -0.1625 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [15.5717, 7.7406, '<path d="M0 0L0 -2.0150C0 -2.5188 -0.2500 -2.7125 -0.5000 -2.7125C-1.1000 -2.7125 -1.1000 -1.4725 -0.5000 -1.0850C0 -0.6200 0 -0.1938 0 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:b": { add: [[16.0717, 5.9406, '<path d="M0 0L0.0000 -1.6900C0.0000 -2.1125 -0.2500 -2.2750 -0.5000 -2.2750C-1.1000 -2.2750 -1.1000 -1.2350 -0.5000 -0.9100C0.0000 -0.5200 0.0000 -0.1625 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.5717, 7.7406, '<path d="M0 0L0 -2.0150C0 -2.5188 -0.2500 -2.7125 -0.5000 -2.7125C-1.1000 -2.7125 -1.1000 -1.4725 -0.5000 -1.0850C0 -0.6200 0 -0.1938 0 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[18.0717, 13.9906, '<path d="M0 0C0.1000 -0.1000 0.2000 -0.4000 0.3000 -0.6000C0.3000 -1.0000 0.8000 -1.0000 0.8000 -0.7000C0.8000 -0.3000 0.5000 -0.3000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:bes": { add: [[15.3217, 16.3656, '<path d="M0 0C0.1000 -0.1000 0.2000 -0.4000 0.3000 -0.6000C0.3000 -1.0000 0.8000 -1.0000 0.8000 -0.7000C0.8000 -0.3000 0.5000 -0.3000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:d": { add: [[16.0717, 17.7406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:dis": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 25.4906, '<path d="M0 0L0.0000 -1.0500C-1.1200 -1.0500 -1.1200 -0.0000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.3717, 25.4906, '<path d="M0 0L0.0000 -1.0500L0.5600 -1.0500L0.5600 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:cis": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.0717, 25.4906, '<path d="M0 0L0.0000 -1.0500C-1.1200 -1.0500 -1.1200 -0.0000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.3717, 25.4906, '<path d="M0 0L0.0000 -1.0500L0.5600 -1.0500L0.5600 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:c": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.0717, 25.4906, '<path d="M0 0L0.0000 -1.0500C-1.1200 -1.0500 -1.1200 -0.0000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.3717, 25.4906, '<path d="M0 0L0.0000 -1.0500L0.5600 -1.0500L0.5600 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:gz": { add: [[18.5717, 24.1906, '<path d="M0 0L-1.9040 -0.0000C-2.6180 -0.0000 -2.6180 -1.0500 -1.6660 -1.0500L-1.1900 -1.0500C-0.3570 -1.0500 -0.2380 -0.2800 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.0717, 25.4906, '<path d="M0 0L0.0000 -1.0500C-1.1200 -1.0500 -1.1200 -0.0000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.3717, 25.4906, '<path d="M0 0L0.0000 -1.0500L0.5600 -1.0500L0.5600 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.0717, 26.6906, '<path d="M0 0C0.1400 -0.1400 0.5600 -0.2800 0.8400 -0.4200C1.4000 -0.4200 1.4000 -1.1200 0.9800 -1.1200C0.4200 -1.1200 0.4200 -0.7000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] } }, pairs: {}, whole: {}, box: [14.1217, 3.3156, 5.3, 23.725] }, oboe: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:oneR": { add: [[17.0717, 7.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:twoR": { add: [[17.0717, 10.2406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:threeR": { add: [[17.0717, 12.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:fourR": { add: [[17.0717, 16.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:fiveR": { add: [[17.0717, 18.9906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:sixR": { add: [[17.0717, 21.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:h": { add: [[17.0717, 8.3656, '<ellipse fill="currentColor" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "lh:I": { add: [[14.5717, 7.7406, '<path d="M0 0C-0.8000 -0.0000 -0.8000 -2.0000 -0.2000 -2.0000L-0.2000 -2.4000L0.2000 -2.4000L0.2000 -2.0000C0.8000 -2.0000 0.8000 -0.0000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:III": { add: [[14.5717, 7.7406, '<path d="M0 0C-0.8000 -0.0000 -0.8000 -2.0000 -0.2000 -2.0000L-0.2000 -2.4000L0.2000 -2.4000L0.2000 -2.0000C0.8000 -2.0000 0.8000 -0.0000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.1406, '<path d="M0 0C-0.8000 -0.0000 -0.8000 -2.0000 -0.2000 -2.0000L-0.2000 -2.8000L0.2000 -2.8000L0.2000 -2.0000C0.8000 -2.0000 0.8000 -0.0000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:II": { add: [[19.5717, 8.9906, '<path d="M0 0C-0.8000 -0.0000 -0.8000 -2.0000 -0.2000 -2.0000L-0.2000 -2.4000L0.2000 -2.4000L0.2000 -2.0000C0.8000 -2.0000 0.8000 -0.0000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:b": { add: [[15.7217, 8.9906, '<ellipse fill="currentColor" rx="0.6000" ry="0.8000" stroke-width="0.1000"/>']], drop: [] }, "lh:d": { add: [[18.0717, 8.9906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[18.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:low-b": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:bes": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="currentColor" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:f": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.2217, 18.0906, '<ellipse fill="currentColor" rx="0.5000" ry="1.0000" stroke-width="0.1000"/>']], drop: [] }, "rh:a": { add: [[15.0717, 14.0406, '<ellipse fill="currentColor" rx="1.0000" ry="0.4500" stroke-width="0.1000"/>'], [13.5717, 15.2406, '<ellipse fill="none" rx="0.4500" ry="1.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[15.0717, 14.0406, '<ellipse fill="none" rx="1.0000" ry="0.4500" stroke-width="0.1000"/>'], [13.5717, 15.2406, '<ellipse fill="currentColor" rx="0.4500" ry="1.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:d": { add: [[18.0717, 17.7406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:banana": { add: [[18.7717, 21.4906, '<ellipse fill="currentColor" rx="0.4500" ry="1.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:c": { add: [[13.6717, 23.2406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.4717, 23.8406, '<path d="M0 0C-0.5400 -0.0000 -0.5400 -0.5000 -1.1250 -0.5000C-2.0250 -0.5000 -2.0250 0.4000 -1.1250 0.4000C-0.5400 0.4000 -0.5400 -0.0000 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.6717, 25.0406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:cis": { add: [[13.6717, 23.2406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.4717, 23.8406, '<path d="M0 0C-0.5400 -0.0000 -0.5400 -0.5000 -1.1250 -0.5000C-2.0250 -0.5000 -2.0250 0.4000 -1.1250 0.4000C-0.5400 0.4000 -0.5400 -0.0000 -0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.6717, 25.0406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[13.6717, 23.2406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="none" stroke-width="0.1000"/>'], [17.4717, 23.8406, '<path d="M0 0C-0.5400 -0.0000 -0.5400 -0.5000 -1.1250 -0.5000C-2.0250 -0.5000 -2.0250 0.4000 -1.1250 0.4000C-0.5400 0.4000 -0.5400 -0.0000 -0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.6717, 25.0406, '<path d="M0 0C2.0000 -0.0000 2.0000 -0.9800 3.0000 -0.9800C4.5000 -0.9800 4.5000 0.5600 3.0000 0.5600C2.0000 0.5600 2.0000 -0.0000 0.0000 -0.0000L-0.3000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] } }, pairs: { "cc:h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h+cc:oneR": { remove: ['17.0717,7.7406|<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>', '17.0717,7.7406|<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']] }, "cc:h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] } }, whole: {}, box: [12.7717, 1.9906, 8.6748, 23.96] }, clarinet: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:h": { add: [[17.0717, 8.3656, '<ellipse fill="currentColor" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 0.2294A0.4000 0.4000 0 0 0 0.3277 0.2294L-0.3277,0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1h": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.4000 -0.0000A0.4000 0.4000 0 1 0 0.4000 -0.0000L-0.4000,-0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h3q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 -0.2294A0.4000 0.4000 0 1 0 0.3277 -0.2294L-0.3277,-0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "lh:thumb": { add: [[14.5717, 7.7406, '<ellipse fill="currentColor" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>']], drop: [] }, "lh:R": { add: [[14.5717, 7.7406, '<ellipse fill="none" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>'], [15.5717, 5.2406, '<path d="M0 0C0.0000 1.2000 -1.8000 1.2000 -1.8000 -0.0000C-1.3500 -1.3172 -1.1250 -1.9758 -0.9000 -2.6343C-0.6750 -1.9758 -0.4500 -1.3172 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:a": { add: [[17.0717, 5.2406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[17.0717, 5.2406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[18.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:f": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:e": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="currentColor" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:fis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:one": { add: [[15.8217, 13.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:two": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:three": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:four": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:b": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:e": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] } }, pairs: { "cc:h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h3q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] } }, whole: {}, box: [12.7217, 2.2563, 8.7248, 24.0193] }, "bass-clarinet": { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:h": { add: [[17.0717, 8.3656, '<ellipse fill="currentColor" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 0.2294A0.4000 0.4000 0 0 0 0.3277 0.2294L-0.3277,0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1h": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.4000 -0.0000A0.4000 0.4000 0 1 0 0.4000 -0.0000L-0.4000,-0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h3q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 -0.2294A0.4000 0.4000 0 1 0 0.3277 -0.2294L-0.3277,-0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "lh:thumb": { add: [[14.5717, 7.7406, '<ellipse fill="currentColor" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>']], drop: [] }, "lh:R": { add: [[14.5717, 7.7406, '<ellipse fill="none" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>'], [15.5717, 5.2406, '<path d="M0 0C0.0000 1.2000 -1.8000 1.2000 -1.8000 -0.0000C-1.3500 -1.3172 -1.1250 -1.9758 -0.9000 -2.6343C-0.6750 -1.9758 -0.4500 -1.3172 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:a": { add: [[17.0717, 5.2406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[17.0717, 5.2406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[18.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:f": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:e": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="currentColor" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:fis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:one": { add: [[15.8217, 13.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:two": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:three": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:four": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:b": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 -0.4500 0.6750 -0.6750 1.3500 -0.6750C1.3500 -0.2250 2.0250 0.0000 2.7000 0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 -0.4500 0.6750 -0.6750 1.3500 -0.6750C1.3500 -0.2250 2.0250 0.0000 2.7000 0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:e": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 -0.4500 0.6750 -0.6750 1.3500 -0.6750C1.3500 -0.2250 2.0250 0.0000 2.7000 0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 -0.4500 0.6750 -0.6750 1.3500 -0.6750C1.3500 -0.2250 2.0250 0.0000 2.7000 0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 -0.4500 0.6750 -0.6750 1.3500 -0.6750C1.3500 -0.2250 2.0250 0.0000 2.7000 0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] } }, pairs: { "cc:h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h3q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] } }, whole: {}, box: [12.7217, 2.2563, 8.7248, 24.8593] }, "low-bass-clarinet": { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [6] }, "cc:h": { add: [[17.0717, 8.3656, '<ellipse fill="currentColor" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 0.2294A0.4000 0.4000 0 0 0 0.3277 0.2294L-0.3277,0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h1h": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.4000 -0.0000A0.4000 0.4000 0 1 0 0.4000 -0.0000L-0.4000,-0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:h3q": { add: [[17.0717, 8.3656, '<ellipse cx="0" cy="0" fill="none" rx="0.4000" ry="0.4000" stroke-width="0.1000"/>'], [17.0717, 8.3656, '<path d="M-0.3277 -0.2294A0.4000 0.4000 0 1 0 0.3277 -0.2294L-0.3277,-0.2294" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "lh:thumb": { add: [[14.5717, 7.7406, '<ellipse fill="currentColor" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>']], drop: [] }, "lh:R": { add: [[14.5717, 7.7406, '<ellipse fill="none" rx="0.9000" ry="0.9000" stroke-width="0.1000"/>'], [15.5717, 5.2406, '<path d="M0 0C0.0000 1.2000 -1.8000 1.2000 -1.8000 -0.0000C-1.3500 -1.3172 -1.1250 -1.9758 -0.9000 -2.6343C-0.6750 -1.9758 -0.4500 -1.3172 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:a": { add: [[17.0717, 5.2406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:gis": { add: [[17.0717, 5.2406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 4.4906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 4.2406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[18.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:f": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:e": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="currentColor" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:fis": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:d": { add: [[16.2217, 14.0406, '<path d="M0 0C0.4250 0.3400 1.2750 0.3400 1.7000 -0.0000C1.1690 -0.4248 2.4434 -2.0178 2.9744 -1.5930C3.5054 -1.1682 2.2310 0.4248 1.7000 -0.0000C1.2750 0.3400 0.4250 0.3400 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 13.7406, '<path d="M0 0C0.4248 0.3398 -0.3059 1.4273 -0.8870 1.6312L-1.3967 1.2234C-1.3254 0.6117 -0.4248 -0.3398 -0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [19.1217, 17.8906, '<path d="M0 0L0.0000 -2.7000C0.0000 -2.9250 -0.2250 -3.1500 -0.4500 -3.1500C-0.9000 -3.1500 -0.9000 -1.4688 -0.4500 -0.9000C0.0000 -0.4500 0.0000 -0.2250 0.0000 -0.0000L0.0000 1.0800" fill="none" stroke-width="0.1000"/>'], [19.3217, 18.3906, '<path d="M0 0L-0.0000 -2.7000C-0.0000 -2.9250 0.2250 -3.1500 0.4500 -3.1500C0.9000 -3.1500 0.9000 -1.4688 0.4500 -0.9000C-0.0000 -0.4500 -0.0000 -0.2250 -0.0000 -0.0000L-0.0000 0.5400" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:one": { add: [[15.8217, 13.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:two": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:three": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:four": { add: [[15.8217, 13.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.3656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 14.8656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.8217, 15.3656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']], drop: [] }, "rh:b": { add: [[16.0717, 20.2406, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:e": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:d": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:low-cis": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:low-d": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:low-c": { add: [[15.7717, 13.9906, '<path d="M0 0L0.0000 -1.2000C0.0000 -2.0000 -0.8000 -2.0000 -0.8000 -0.6000C-0.8000 -0.0800 0.0000 -0.2000 0.0000 -0.2400L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [15.7717, 12.5906, '<path d="M0 0L0.0000 -0.9360C0.0000 -1.3360 -0.8000 -1.3360 -0.8000 -0.7360C-0.8000 -0.3760 0.0000 -0.4160 0.0000 -0.4960L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 22.5056, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C2.7000 -0.9000 0.0000 -0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 24.1856, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 25.8656, '<path d="M0 0C0.0000 0.4500 0.6750 0.6750 1.3500 0.6750C1.3500 0.2250 2.0250 -0.0000 2.7000 -0.0000C1.8000 -0.0000 1.3500 -0.3375 1.3500 -0.6750C0.4500 -0.6750 0.0000 -0.3375 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 23.3456, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 25.0256, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.6617, 26.7056, '<path d="M0 0C0.0000 -0.9000 2.7000 -0.9000 2.7000 -0.0000C2.7000 0.9000 0.0000 0.9000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] } }, pairs: { "cc:h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one1h": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+cc:one3q": { remove: ['17.0717,7.7406|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,7.7406|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,6.9406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.9406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 6.9406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h1h+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h1h+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:h3q+lh:a": { remove: ['17.0717,5.2406|<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="currentColor" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "cc:h3q+lh:gis": { remove: ['17.0717,5.2406|<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>', '17.0717,4.4906|<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>', '17.8717,4.2406|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[17.0717, 4.4406, '<ellipse fill="none" rx="0.4000" ry="0.7500" stroke-width="0.1000"/>'], [17.0717, 3.6906, '<line stroke-width="0.1000" x1="0" x2="0" y1="0" y2="-0.4500"/>'], [17.8717, 3.4406, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "rh:low-cis+rh:one": { remove: ['15.8217,13.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-d+rh:one": { remove: ['15.8217,13.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-c+rh:one": { remove: ['15.8217,13.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-cis+rh:two": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-d+rh:two": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-c+rh:two": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-cis+rh:three": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-d+rh:three": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:low-c+rh:three": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:four+rh:low-cis": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:four+rh:low-d": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] }, "rh:four+rh:low-c": { remove: ['15.8217,13.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.3656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,14.8656|<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>', '15.8217,15.3656|<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], add: [[15.3217, 14.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.0656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 15.5656, '<ellipse fill="none" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>'], [15.3217, 16.0656, '<ellipse fill="currentColor" rx="0.5000" ry="0.2500" stroke-width="0.1000"/>']] } }, whole: {}, box: [12.7217, 2.2563, 8.7248, 25.6993] }, saxophone: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [6] }, "lh:T": { add: [[14.8717, 7.7406, '<ellipse fill="currentColor" rx="0.7500" ry="0.7500" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[18.9717, 5.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.0717, 6.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.5717, 6.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:d": { add: [[18.9717, 5.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.0717, 6.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [18.5717, 6.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:f": { add: [[18.9717, 5.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.0717, 6.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.5717, 6.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "lh:front-f": { add: [[17.0717, 5.6156, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>']], drop: [] }, "lh:bes": { add: [[17.0717, 6.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 8.4906, '<ellipse fill="currentColor" rx="0.5000" ry="0.5000" stroke-width="0.1000"/>']], drop: [1] }, "lh:gis": { add: [[18.2717, 14.1406, '<path d="M0 0L0.0000 -0.3200C0.0000 -0.6400 2.4000 -0.6400 2.4000 -0.3200L2.4000 -0.0000C2.4000 0.3200 0.0000 0.3200 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.6717, 15.2406, '<path d="M0 0L-0.0000 -0.8000C-0.3200 -0.8000 -0.6400 -0.7200 -1.0800 -0.6400L-1.0800 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.2406, '<path d="M0 0L0.0000 -0.8000C0.3200 -0.8000 0.6400 -0.7200 1.0800 -0.6400L1.0800 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.4406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[18.2717, 14.1406, '<path d="M0 0L0.0000 -0.3200C0.0000 -0.6400 2.4000 -0.6400 2.4000 -0.3200L2.4000 -0.0000C2.4000 0.3200 0.0000 0.3200 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 15.2406, '<path d="M0 0L-0.0000 -0.8000C-0.3200 -0.8000 -0.6400 -0.7200 -1.0800 -0.6400L-1.0800 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [18.2717, 15.2406, '<path d="M0 0L0.0000 -0.8000C0.3200 -0.8000 0.6400 -0.7200 1.0800 -0.6400L1.0800 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.4406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:b": { add: [[18.2717, 14.1406, '<path d="M0 0L0.0000 -0.3200C0.0000 -0.6400 2.4000 -0.6400 2.4000 -0.3200L2.4000 -0.0000C2.4000 0.3200 0.0000 0.3200 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 15.2406, '<path d="M0 0L-0.0000 -0.8000C-0.3200 -0.8000 -0.6400 -0.7200 -1.0800 -0.6400L-1.0800 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.2406, '<path d="M0 0L0.0000 -0.8000C0.3200 -0.8000 0.6400 -0.7200 1.0800 -0.6400L1.0800 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [18.2717, 15.4406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "lh:low-bes": { add: [[18.2717, 14.1406, '<path d="M0 0L0.0000 -0.3200C0.0000 -0.6400 2.4000 -0.6400 2.4000 -0.3200L2.4000 -0.0000C2.4000 0.3200 0.0000 0.3200 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.6717, 15.2406, '<path d="M0 0L-0.0000 -0.8000C-0.3200 -0.8000 -0.6400 -0.7200 -1.0800 -0.6400L-1.0800 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.2406, '<path d="M0 0L0.0000 -0.8000C0.3200 -0.8000 0.6400 -0.7200 1.0800 -0.6400L1.0800 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.2717, 15.4406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:e": { add: [[14.7717, 13.4906, '<path d="M0 0L0.0000 -1.2000C0.0500 -1.2500 0.1000 -1.3000 0.1500 -1.3500L0.7500 -1.3500C0.8000 -1.3000 0.8500 -1.2500 0.9000 -1.2000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.7717, 14.5906, '<path d="M0 0L0.0000 -0.6000C0.0500 -0.6500 0.1000 -0.7000 0.1500 -0.7500L0.7500 -0.7500C0.8000 -0.7000 0.8500 -0.6500 0.9000 -0.6000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.7717, 15.4906, '<path d="M0 0L0.0000 -0.4500C0.0500 -0.5000 0.1000 -0.5500 0.1500 -0.6000L0.7500 -0.6000C0.8000 -0.5500 0.8500 -0.5000 0.9000 -0.4500L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:c": { add: [[14.7717, 13.4906, '<path d="M0 0L0.0000 -1.2000C0.0500 -1.2500 0.1000 -1.3000 0.1500 -1.3500L0.7500 -1.3500C0.8000 -1.3000 0.8500 -1.2500 0.9000 -1.2000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.7717, 14.5906, '<path d="M0 0L0.0000 -0.6000C0.0500 -0.6500 0.1000 -0.7000 0.1500 -0.7500L0.7500 -0.7500C0.8000 -0.7000 0.8500 -0.6500 0.9000 -0.6000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.7717, 15.4906, '<path d="M0 0L0.0000 -0.4500C0.0500 -0.5000 0.1000 -0.5500 0.1500 -0.6000L0.7500 -0.6000C0.8000 -0.5500 0.8500 -0.5000 0.9000 -0.4500L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:bes": { add: [[14.7717, 13.4906, '<path d="M0 0L0.0000 -1.2000C0.0500 -1.2500 0.1000 -1.3000 0.1500 -1.3500L0.7500 -1.3500C0.8000 -1.3000 0.8500 -1.2500 0.9000 -1.2000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.7717, 14.5906, '<path d="M0 0L0.0000 -0.6000C0.0500 -0.6500 0.1000 -0.7000 0.1500 -0.7500L0.7500 -0.7500C0.8000 -0.7000 0.8500 -0.6500 0.9000 -0.6000L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [14.7717, 15.4906, '<path d="M0 0L0.0000 -0.4500C0.0500 -0.5000 0.1000 -0.5500 0.1500 -0.6000L0.7500 -0.6000C0.8000 -0.5500 0.8500 -0.5000 0.9000 -0.4500L0.9000 -0.0000C0.8500 0.0500 0.8000 0.1000 0.7500 0.1500L0.1500 0.1500C0.1000 0.1000 0.0500 0.0500 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:high-fis": { add: [[15.2717, 17.7406, '<path d="M0 0L0.0000 -0.7500C0.0000 -1.0500 0.4500 -1.0500 0.4500 -0.7500L0.4500 -0.0000C0.4500 0.1178 0.4486 0.1230 0.3897 0.2250L0.0147 0.8745C-0.1353 1.1343 -0.5250 0.9093 -0.3750 0.6495L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[15.5717, 20.2406, '<ellipse fill="currentColor" rx="1.0000" ry="0.5000" stroke-width="0.1000"/>']], drop: [] }, "rh:ees": { add: [[15.0717, 22.5406, '<ellipse fill="currentColor" rx="1.2000" ry="0.5000" stroke-width="0.1000"/>'], [13.8717, 23.3406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:low-c": { add: [[15.0717, 22.5406, '<ellipse fill="none" rx="1.2000" ry="0.5000" stroke-width="0.1000"/>'], [13.8717, 23.3406, '<path d="M0 0L2.4000 -0.0000C2.4000 1.2000 0.0000 1.2000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] } }, pairs: { "cc:one+lh:bes": { remove: ['17.0717,7.7406|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,6.7406|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 6.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "lh:T+lh:bes": { remove: ['14.8717,7.7406|<ellipse fill="currentColor" rx="0.7500" ry="0.7500" stroke-width="0.1000"/>'], add: [[14.8717, 6.7406, '<ellipse fill="currentColor" rx="0.7500" ry="0.7500" stroke-width="0.1000"/>']] }, "lh:bes+lh:ees": { remove: ['18.9717,5.3906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '20.0717,6.4906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '18.5717,6.9906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[18.9717, 4.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.0717, 5.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.5717, 5.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "lh:bes+lh:d": { remove: ['18.9717,5.3906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '20.0717,6.4906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '18.5717,6.9906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[18.9717, 4.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.0717, 5.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [18.5717, 5.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "lh:bes+lh:f": { remove: ['18.9717,5.3906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '20.0717,6.4906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '18.5717,6.9906|<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[18.9717, 4.3906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.0717, 5.4906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [18.5717, 5.9906, '<path d="M0 0C0.8500 0.3500 1.2400 1.9500 0.5900 1.9500C0.2000 1.9500 0.2000 0.3500 0.3300 0.1500C0.2000 0.0500 0.1000 0.0250 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "lh:bes+lh:front-f": { remove: ['17.0717,5.6156|<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], add: [[17.0717, 4.6156, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>']] } }, whole: {}, box: [13.5217, 3.5656, 8.14, 21.325] }, bassoon: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:twoR": { add: [[17.0717, 10.2406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:threeR": { add: [[17.0717, 12.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:fourR": { add: [[17.0717, 16.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:fiveR": { add: [[17.0717, 18.9906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:sixR": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "lh:a": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:w": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:high-e": { add: [[16.0717, 6.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:high-ees": { add: [[16.0717, 8.9906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:lh-ees": { add: [[16.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[19.0717, 13.6156, '<ellipse fill="currentColor" rx="1.2000" ry="0.6000" stroke-width="0.1000"/>'], [20.0717, 14.6156, '<ellipse fill="none" rx="1.0000" ry="0.5000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[19.0717, 13.6156, '<ellipse fill="none" rx="1.2000" ry="0.6000" stroke-width="0.1000"/>'], [20.0717, 14.6156, '<ellipse fill="currentColor" rx="1.0000" ry="0.5000" stroke-width="0.1000"/>']], drop: [] }, "lh:low-bes": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-b": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-c": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="currentColor" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-d": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:d": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:c": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:thumb-cis": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [14.5717, 5.5406, '<path d="M0 0L-0.0000 3.0000C-0.0000 3.1500 -0.0450 3.3000 -0.1215 3.4365L-0.4215 3.9718C-1.2965 5.5331 -1.7357 4.8148 -0.8607 3.2535L-0.5607 2.7183C-0.5225 2.6500 -0.5000 2.5750 -0.5000 2.5000L-0.5000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 12.8406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [0] }, "rh:cis": { add: [[14.7717, 16.8406, '<path d="M0 0L0.0000 -1.3000C0.0000 -1.7500 0.4050 -2.2000 0.8505 -2.2855L1.0005 -2.3143C1.8755 -2.4822 1.9502 -1.2395 1.0752 -1.0715L0.9252 -1.0428C0.7025 -1.0000 0.5000 -0.7750 0.5000 -0.5500L0.5000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [17.0717, 17.3906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 19.8906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 22.3906, '<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [4, 5, 6] }, "rh:thumb-gis": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 23.9906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "rh:bes": { add: [[18.0717, 20.2906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:thumb-bes": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 23.9906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "rh:thumb-e": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 23.9906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "rh:thumb-fis": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 23.9906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [0] } }, pairs: { "cc:four+rh:cis": { remove: ['17.0717,16.4906|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,17.3906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 17.3906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:fourR+rh:cis": { remove: ['17.0717,16.4906|<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>', '17.0717,16.4906|<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>'], add: [[17.0717, 17.3906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 17.3906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']] }, "cc:four1q+rh:cis": { remove: ['17.0717,16.4906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,16.4906|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,17.3906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 17.3906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 17.3906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:four1h+rh:cis": { remove: ['17.0717,16.4906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,16.4906|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,17.3906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 17.3906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 17.3906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:four3q+rh:cis": { remove: ['17.0717,16.4906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,16.4906|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,17.3906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 17.3906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 17.3906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:five+rh:cis": { remove: ['17.0717,18.9906|<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,19.8906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 19.8906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']] }, "cc:fiveR+rh:cis": { remove: ['17.0717,18.9906|<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>', '17.0717,18.9906|<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>'], add: [[17.0717, 19.8906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 19.8906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']] }, "cc:five1q+rh:cis": { remove: ['17.0717,18.9906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,18.9906|<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,19.8906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 19.8906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 19.8906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:five1h+rh:cis": { remove: ['17.0717,18.9906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,18.9906|<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>', '17.0717,19.8906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 19.8906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 19.8906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:five3q+rh:cis": { remove: ['17.0717,18.9906|<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>', '17.0717,18.9906|<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>', '17.0717,19.8906|<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], add: [[17.0717, 19.8906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 19.8906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']] }, "cc:six+rh:cis": { remove: ['17.0717,21.4906|<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>', '17.0717,22.3906|<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>'], add: [[17.0717, 22.3906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']] }, "cc:sixR+rh:cis": { remove: ['17.0717,21.4906|<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>', '17.0717,22.3906|<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>'], add: [[17.0717, 22.3906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']] }, "cc:six1q+rh:cis": { remove: ['17.0717,21.4906|<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>', '17.0717,22.3906|<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>'], add: [[17.0717, 22.3906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']] }, "cc:six1h+rh:cis": { remove: ['17.0717,21.4906|<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>', '17.0717,22.3906|<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>'], add: [[17.0717, 22.3906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']] }, "cc:six3q+rh:cis": { remove: ['17.0717,21.4906|<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>', '17.0717,22.3906|<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>'], add: [[17.0717, 22.3906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']] }, "rh:cis+rh:thumb-gis": { remove: ['10.8517,18.7406|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '12.6017,18.3406|<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>', '12.0717,23.9906|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '11.0717,22.3906|<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[10.8517, 19.6406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 19.2406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 24.8906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [11.0717, 23.2906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "rh:bes+rh:cis": { remove: ['18.0717,20.2906|<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>'], add: [[18.0717, 21.1906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']] }, "rh:cis+rh:f": { remove: ['19.0717,27.2656|<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '16.8717,22.7656|<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '20.5717,26.1156|<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[19.0717, 28.1656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 23.6656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.5717, 27.0156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "rh:cis+rh:fis": { remove: ['19.0717,27.2656|<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '16.8717,22.7656|<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '20.5717,26.1156|<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[19.0717, 28.1656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 23.6656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 27.0156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] }, "rh:cis+rh:gis": { remove: ['19.0717,27.2656|<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '16.8717,22.7656|<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '20.5717,26.1156|<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[19.0717, 28.1656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [16.8717, 23.6656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 27.0156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "rh:cis+rh:thumb-bes": { remove: ['10.8517,18.7406|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>', '12.6017,18.3406|<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>', '12.0717,23.9906|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '11.0717,22.3906|<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[10.8517, 19.6406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [12.6017, 19.2406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 24.8906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 23.2906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "rh:cis+rh:thumb-e": { remove: ['10.8517,18.7406|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '12.6017,18.3406|<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>', '12.0717,23.9906|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '11.0717,22.3906|<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], add: [[10.8517, 19.6406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 19.2406, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 24.8906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 23.2906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']] }, "rh:cis+rh:thumb-fis": { remove: ['10.8517,18.7406|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '12.6017,18.3406|<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>', '12.0717,23.9906|<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>', '11.0717,22.3906|<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], add: [[10.8517, 19.6406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 19.2406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [12.0717, 24.8906, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.4707 -2.8334C2.6957 -3.0685 2.8003 -1.8187 1.5753 -1.5836L1.2953 -1.5299C0.9835 -1.4700 0.7000 -1.1550 0.7000 -0.8400L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [11.0717, 23.2906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']] } }, whole: {}, box: [8.2217, 2.8906, 13.2, 25.625] }, contrabassoon: { base: [[17.0717, 14.6156, '<line stroke-width="0.2000" x1="-0.8000" x2="0.8000" y1="0" y2="0"/>'], [17.0717, 7.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 21.4906, '<ellipse fill="none" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], keys: { "cc:one": { add: [[17.0717, 7.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one1h": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:one3q": { add: [[17.0717, 7.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 7.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [1] }, "cc:two": { add: [[17.0717, 10.2406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [2] }, "cc:twoR": { add: [[17.0717, 10.2406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 10.2406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:two1q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two1h": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:two3q": { add: [[17.0717, 10.2406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 10.2406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [2] }, "cc:three": { add: [[17.0717, 12.7406, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [3] }, "cc:threeR": { add: [[17.0717, 12.7406, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 12.7406, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:three1q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three1h": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:three3q": { add: [[17.0717, 12.7406, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 12.7406, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [3] }, "cc:four": { add: [[17.0717, 16.4906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [4] }, "cc:fourR": { add: [[17.0717, 16.4906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 16.4906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:four1q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four1h": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:four3q": { add: [[17.0717, 16.4906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 16.4906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [4] }, "cc:five": { add: [[17.0717, 18.9906, '<ellipse fill="currentColor" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>']], drop: [5] }, "cc:fiveR": { add: [[17.0717, 18.9906, '<ellipse fill="none" rx="0.8500" ry="0.8500" stroke-width="0.4000"/>'], [17.0717, 18.9906, '<ellipse fill="none" rx="0.6500" ry="0.6500" stroke-width="0.1000"/>']], drop: [] }, "cc:five1q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 0.5736A1.0000 1.0000 0 0 0 0.8192 0.5736L-0.8192,0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five1h": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-1.0000 -0.0000A1.0000 1.0000 0 1 0 1.0000 -0.0000L-1.0000,-0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:five3q": { add: [[17.0717, 18.9906, '<ellipse cx="0" cy="0" fill="none" rx="1.0000" ry="1.0000" stroke-width="0.1000"/>'], [17.0717, 18.9906, '<path d="M-0.8192 -0.5736A1.0000 1.0000 0 1 0 0.8192 -0.5736L-0.8192,-0.5736" fill="currentColor" stroke-width="0.1000"/>']], drop: [5] }, "cc:six": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:sixR": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1q": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six1h": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "cc:six3q": { add: [[17.0717, 21.4906, '<ellipse fill="currentColor" rx="1.5000" ry="0.8000" stroke-width="0.1000"/>']], drop: [6] }, "lh:high-e": { add: [[16.0717, 6.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:high-ees": { add: [[16.0717, 8.9906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:lh-ees": { add: [[16.0717, 11.4906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "lh:ees": { add: [[19.0717, 13.6156, '<ellipse fill="currentColor" rx="1.2000" ry="0.6000" stroke-width="0.1000"/>'], [20.0717, 14.6156, '<ellipse fill="none" rx="1.0000" ry="0.5000" stroke-width="0.1000"/>']], drop: [] }, "lh:cis": { add: [[19.0717, 13.6156, '<ellipse fill="none" rx="1.2000" ry="0.6000" stroke-width="0.1000"/>'], [20.0717, 14.6156, '<ellipse fill="currentColor" rx="1.0000" ry="0.5000" stroke-width="0.1000"/>']], drop: [] }, "lh:low-bes": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-b": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-c": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="currentColor" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:low-d": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:d": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:c": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="currentColor" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "lh:thumb-cis": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [8.5717, 3.9406, '<path d="M0 0L0.0000 1.5000C0.0000 2.0400 0.4860 2.5800 1.0206 2.6826L1.7406 2.8208C2.7906 3.0223 2.8803 2.1310 1.8303 1.9295L1.1103 1.7913C0.8430 1.7400 0.6000 1.4700 0.6000 1.2000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [9.5717, 3.2406, '<path d="M0 0L0.0000 0.9000C0.0000 1.3200 0.2940 1.7400 0.6762 1.9542L0.9762 2.1223C2.0262 2.7108 2.2881 1.8837 1.2381 1.2952L0.9381 1.1271C0.7470 1.0200 0.6000 0.8100 0.6000 0.6000L0.6000 0.0000L0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.0717, 3.2406, '<path d="M0 0L-0.0000 3.0000C-0.2000 4.6000 -0.8000 4.8000 -1.0000 4.8000C-1.4000 4.8000 -1.9000 4.3000 -1.9000 4.0000C-1.9000 3.7000 -1.0000 3.4000 -0.8000 3.3000C-0.6000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [13.7717, 4.1406, '<path d="M0 0L-0.0000 3.0000C-0.0000 4.6000 -0.4000 4.8000 -0.5000 4.8000C-0.7000 4.8000 -0.9000 4.3000 -0.9000 4.0000C-0.9000 3.5000 -0.7000 3.4000 -0.6000 3.3000C-0.5000 3.2000 -0.4000 3.1000 -0.4000 2.9000L-0.4000 0.0000L-0.0000 0.0000" fill="none" stroke-width="0.1000"/>'], [10.5717, 7.7406, '<path d="M-0.7071 -0.7071A1.0000 1.0000 0 0 0 0.7071 0.7071L-0.7071,-0.7071" fill="none" stroke-width="0.1000"/>'], [10.5717, 12.1406, '<path d="M0 0C-0.8000 -4.0000 1.4000 -4.0000 0.6000 -0.0000C0.5000 0.5000 0.5000 0.8000 0.6000 1.0000C0.7000 1.2000 0.8000 1.3000 0.8000 1.8000L0.5000 1.8000C0.5000 1.4000 0.4000 1.2000 0.3000 1.1000C0.2000 1.0000 0.1000 0.5000 0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [15.0717, 13.8406, '<path d="M0 0L-0.0000 -1.8000C-0.0000 -2.1600 -0.2160 -2.5200 -0.5184 -2.7504L-0.8784 -3.0247C-1.9284 -3.8247 -2.2692 -2.4495 -1.2192 -1.6495L-0.8592 -1.3752C-0.7080 -1.2600 -0.6000 -1.0800 -0.6000 -0.9000L-0.6000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [0] }, "rh:bes": { add: [[18.0717, 20.2906, '<ellipse fill="currentColor" rx="0.7500" ry="0.2000" stroke-width="0.1000"/>']], drop: [] }, "rh:f": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:fis": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [] }, "rh:gis": { add: [[19.0717, 27.2656, '<path d="M0 0L-0.0000 -0.9100C-0.0000 -1.4700 -0.4480 -2.0300 -0.9856 -2.2316L-1.6856 -2.4941C-2.9106 -2.9535 -3.1178 -1.5927 -1.8928 -1.1333L-1.1928 -0.8708C-0.9240 -0.7700 -0.7000 -0.4900 -0.7000 -0.2100L-0.7000 -0.0000L-0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [16.8717, 22.7656, '<path d="M0 0L-1.0500 -0.3938C-2.2750 -0.8531 -2.4822 0.5077 -1.2572 0.9670L-0.2072 1.3608L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [20.5717, 26.1156, '<path d="M0 0L-0.0000 -1.0500C-0.0000 -1.6100 -0.4480 -2.1700 -0.9856 -2.3716L-2.0356 -2.7654L-3.2606 -3.2247L-3.4678 -1.8639L-2.2428 -1.4046L-1.1928 -1.0108C-0.9240 -0.9100 -0.7000 -0.6300 -0.7000 -0.3500L-0.7000 -0.0000L-0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [] }, "rh:thumb-bes": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "rh:thumb-e": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="currentColor" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>']], drop: [0] }, "rh:thumb-fis": { add: [[17.0717, 14.4906, '<line stroke-width="0.2000" x1="-5.7500" x2="0.7500" y1="0" y2="0"/>'], [10.8517, 18.7406, '<path d="M0 0L0.0000 -1.4000C0.0000 -2.0300 0.5670 -2.6600 1.1907 -2.7797L1.8907 -2.9140C3.1157 -3.1491 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="none" stroke-width="0.1000"/>'], [12.6017, 18.3406, '<ellipse fill="none" rx="0.7000" ry="0.7000" stroke-width="0.1000"/>'], [11.0717, 22.3906, '<path d="M0 0L0.0000 -1.5400C0.0000 -2.1700 0.5670 -2.8000 1.1907 -2.9197L1.8907 -3.0540C3.1157 -3.2891 3.2203 -1.7593 1.9953 -1.5242L1.2953 -1.3899C0.9835 -1.3300 0.7000 -1.0150 0.7000 -0.7000L0.7000 -0.0000L0.0000 -0.0000" fill="currentColor" stroke-width="0.1000"/>']], drop: [0] } }, pairs: {}, whole: {}, box: [8.2217, 2.8906, 13.2, 24.725] } }, instruments: { "alto-flute": { diagram: "flute", holes: ["h_C_sharp5", "h_C5", "h_B4", "h_A_sharp4", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4"], standing: ["h_D_sharp4", "h_G_sharp4"], keys: { "cc:one": [["h_C_sharp5"], [], "h_C_sharp5"], "lh:b": [["h_C5"], [], null], "lh:bes": [["h_C5", "h_B4"], [], null], "cc:two": [["h_B4", "h_A_sharp4"], [], "h_A_sharp4"], "cc:three": [["h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4"], [], "h_E4"], "rh:bes": [["h_B4"], [], null], "rh:d": [[], ["h_trill-1"], null], "rh:dis": [[], ["h_trill-2"], null], "rh:ees": [[], ["h_D_sharp4"], null], "rh:cis": [["h_D4"], [], null], "rh:c": [["h_D4", "h_C_sharp4"], [], null], "rh:b": [["h_D4", "h_C_sharp4"], [], null], "rh:gz": [[], [], null] }, switch: {}, charted: [["0 1 14 3 4 6 7 8", "T 123|123 C"], ["0 1 13 3 4 6 7 8", "T 123|123 C#"], ["0 1 3 4 6 7 8", "T 123|123"], ["0 1 12 3 4 6 7 8", "T 123|123 Eb"], ["0 1 12 3 4 6 7", "T 123|12- Eb"], ["0 1 12 3 4 6", "T 123|1-- Eb"], ["0 1 12 3 4 8", "T 123|--3 Eb"], ["0 1 12 3 4 7", "T 123|-2- Eb"], ["0 1 12 3 4", "T 123|--- Eb"], ["1 14 3 4 6 7 8", "T -23|123 C"], ["0 1 12 3 4 5", "T 123 G# |--- Eb"], ["1 13 3 4 6 7 8", "T -23|123 C#"], ["0 1 12 3", "T 12-|--- Eb"], ["0 1 12 3 5 6", "T 12- G# |1-- Eb"], ["0 1 3 6 7 8", "T 12-|123"], ["0 1 12 3 6 7 8", "T 12-|123 Eb"], ["0 1 12 3 6 7", "T 12-|12- Eb"], ["0 1 12 3 6", "T 12-|1-- Eb"], ["0 1 12 3 8", "T 12-|--3 Eb"], ["0 1 12 3 7", "T 12-|-2- Eb"], ["0 1 12 3 4 5 6 7 8", "T 123 G# |123 Eb"], ["0 1 12 13 3 4 5 6 7 8", "T 123 G# |123 Eb C#"], ["0 1 16 3 4 5 6 7 8", "T 123 G# |123 ß"], ["0 1 12 6", "T 1--|1-- Eb"], ["0 12 2", "Bb 1--|--- Eb"], ["0 1 6 7 8", "T 1--|123"], ["0 1 12 6 7 8", "T 1--|123 Eb"], ["0 1 12 6 7", "T 1--|12- Eb"], ["0 12 2 8", "Bb 1--|--3 Eb"], ["0 12 2 7", "Bb 1--|-2- Eb"], ["0 1 3 6 7", "T 12-|12-"], ["0 1 12", "B 1--|--- Eb"], ["0 1 12 8", "B 1--|--3 Eb"], ["0 1 12 7", "B 1--|-2- Eb"], ["0 1 12 4 6", "T 1-3|1-- Eb"], ["0 1 12 4 6 8", "T 1-3|1-3 Eb"], ["0 1 12 13 4 6 8", "T 1-3|1-3 Eb C#"], ["0 12", "1--|--- Eb"], ["0 14 3 4 6 7 8", "123|123 C"], ["0 6 7 8", "1--|123"], ["0 12 6 7 8", "1--|123 Eb"], ["0 12 6 7", "1--|12- Eb"], ["0 12 6", "1--|1-- Eb"], ["0 12 8", "1--|--3 Eb"], ["0 12 7", "1--|-2- Eb"], ["1 12 3 4 7 8", "T -23|-23 Eb"], ["1 12 3 4 7", "T -23|-2- Eb"], ["0 1 4 7 8", "B 1-3|-23"], ["12", "---|--- Eb"], ["13 3 4 6 7 8", "-23|123 C#"], ["14 3 4 6 7 8", "-23|123 C"], ["3 4 6 7 8", "-23|123"], ["6 7 8", "---|123"], ["12 3 4 6 7 8", "-23|123 Eb"], ["12 6 7 8", "---|123 Eb"], ["12 6 7", "---|12- Eb"], ["12 6", "---|1-- Eb"], ["12 8", "---|--3 Eb"], ["12 7", "---|-2- Eb"], ["12 7 8", "---|-23 Eb"], ["12 4 5 7 8", "--3 G# |-23 Eb"], ["0 12 3 8", "12-|--3 Eb"], ["0 14 3 6 7", "12-|12- C"], ["0 12 4 6 7 8", "1-3|123 Eb"], ["1 3 4 6 7 8", "T -23|123"], ["12 3 4 5 6 7 8", "-23 G# |123 Eb"], ["3 4 5 6", "-23 G# |1--"], ["12 3 4 5 7 8", "-23 G# |-23 Eb"], ["1 12 3 4 6 7 8", "T -23|123 Eb"], ["1 12 3 4 6 7", "T -23|12- Eb"], ["0 12 3 4 6 7 8", "123|123 Eb"], ["0 1 13 3 4 5 6 7 8", "T 123 G# |123 C#"], ["0 1 12 5 7 9", "T 1-- G# | Bb -2- Eb"], ["0 1 12 4 6 7 8", "T 1-3|123 Eb"], ["0 1 12 4 6 7", "T 1-3|12- Eb"], ["1 12 3 4 5 6", "T -23 G# |1-- Eb"], ["1 12 3 6", "T -2-|1-- Eb"], ["0 13 3 4 5 6 7 8", "123 G# |123 C#"], ["0 16 3 4 5 6 7 8", "123 G# |123 ß"], ["1 12 3 4", "T -23|--- Eb"], ["12 3 4 5", "-23 G# |--- Eb"], ["1 12 3 4 5", "T -23 G# |--- Eb"], ["1 3 4 5 6 7 8", "T -23 G# |123"], ["1 12 3", "T -2-|--- Eb"], ["0 1 3 4 5 6", "T 123 G# |1--"], ["0 1 12 4 6 7:0.5", "T 1-3|1½- Eb"], ["0 1 13 4 6 8", "T 1-3|1-3 C#"], ["0 1 12 4 8", "B 1-3|--3 Eb"], ["0 1 12 4 7", "B 1-3|-2- Eb"], ["0 1 13 4 8", "B 1-3|--3 C#"], ["0 1 13 4 7", "B 1-3|-2- C#"], ["0 1 12 4 7 8", "B 1-3|-23 Eb"], ["0 12 3 4", "123|--- Eb"], ["0 13 3 4", "123|--- C#"], ["0 1 12 15 4 6 8", "T 1-3|1-3 Eb B"], ["1 12 4 6 7", "T --3|12- Eb"], ["1 12 3 4 5 6 7", "T -23 G# |12- Eb"], ["1 13 4", "B --3|--- C#"], ["1 13 3 6 8", "T -2-|1-3 C#"], ["1 12 3 6 7:0.5", "T –2–|1½- Eb"], ["14 3 6 8", "-2-|1-3 C"], ["2", "Bb ---|---"], ["0 1 13 5 6", "T 1-- G# |1-- C#"], ["1 15 3 4 5 7 8", "T -23 G# |-23 B"], ["0 16 3 4 5 6", "123 G# |1-- ß"], ["0 16 3 4 5 6 8", "123 G# |1-3 ß"], ["0 14 3 4 5 6", "123 G# |1-- C"], ["0 16 3 4 5 6 7", "123 G# |12- ß"], ["0 12 3 4 5 6 7 8", "123 G# |123 Eb"], ["0 3 4 5 6 7:0.5", "123 G# |1½–"]] }, "alto-saxophone": { diagram: "saxophone", holes: ["h_octave-high", "h_octave-low", "h_F_sharp5", "h_F5", "h_E5", "h_D_sharp5", "h_D5", "h_C_sharp5", "h_C5", "h_side-C", "h_B4", "h_A_sharp4", "h_side-A_sharp", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_side-F_sharp", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_C_sharp4", "h_D5", "h_D_sharp4", "h_D_sharp5", "h_E5", "h_F5", "h_F_sharp5", "h_G_sharp4", "h_octave-high", "h_octave-low", "h_side-A_sharp", "h_side-C", "h_side-F_sharp"], keys: { "lh:T": [[], [], null], "cc:one": [["h_C_sharp5", "h_C5"], [], "h_C5"], "cc:two": [["h_C_sharp5", "h_B4", "h_A_sharp4"], [], "h_B4"], "lh:bes": [["h_B4"], [], null], "cc:three": [["h_C_sharp5", "h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4", "h_G_sharp4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4", "h_B4", "h_G_sharp4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4", "h_B4", "h_G_sharp4"], [], "h_E4"], "rh:ees": [[], ["h_D_sharp4"], null], "rh:low-c": [["h_D4"], [], null], "lh:cis": [["h_D4"], ["h_C_sharp4"], null], "lh:b": [["h_D4", "h_C4"], [], null], "lh:low-bes": [["h_D4", "h_C4", "h_B3"], [], null], "lh:d": [[], ["h_D5"], null], "lh:ees": [[], ["h_D_sharp5"], null], "rh:e": [[], ["h_E5"], null], "lh:f": [[], ["h_F5"], null], "lh:front-f": [[], ["h_F5"], null], "rh:high-fis": [[], ["h_F_sharp5"], null], "rh:c": [[], ["h_side-C"], null], "rh:bes": [[], ["h_side-A_sharp"], null], "rh:fis": [[], ["h_side-F_sharp"], null] }, switch: { "lh:T": ["cc:three", "h_octave-low", "h_octave-high"] }, charted: [["1 10 13 2 4 6 7 8", "123 Bb |123 C"], ["1 10 12 2 4 6 7 8", "123 B |123 C"], ["1 13 2 4 6 7 8", null], ["1 10 2 4 6 7 8", "123|123 C"], ["0 1 13 2 4 6 7 8", "T 123 Bb |123"], ["1 12 2 4 6 7 8", null], ["1 10 11 2 4 6 7 8", "123 C# |123 C"], ["0 1 12 2 4 6 7 8", "T 123 B |123"], ["1 2 4 6 7 8", "123|123"], ["0 1 10 2 4 6 7 8", "T 123|123 C"], ["0 1 11 2 4 6 7 8", null], ["1 2 4 6 7 8 9", "123|123 Eb"], ["1 2 4 6 7", "123|12–"], ["0 1 2 4 6 7 8", "T 123|123"], ["1 2 4 6", "123|1––"], ["0 1 2 4 6 7 8 9", "T 123|123 Eb"], ["0 1 2 4 6 7", "T 123|12–"], ["1 2 4 7", "123|–2–"], ["1 10 13 2 4 7 8", "123 Bb |–23 C"], ["1 2 4", "123|–––"], ["1 13 2 4", "123 Bb |–––"], ["1 12 2 4", "123 B |–––"], ["1 11 2 4", "123 C# |–––"], ["1 2 4 5", "123 G# |–––"], ["0 1 13 2 4", "T 123 Bb |–––"], ["0 1 12 2 4", "T 123 B |–––"], ["0 1 11 2 4", "T 123 C# |–––"], ["1 2", "12–|–––"], ["0 1 2 4 5", "T 123 G# |–––"], ["0 1 2 4", "T 123|–––"], ["1 3", "1 Bb ––|–––"], ["1 6", "1––|1––"], ["1 7", "1––|–2–"], ["1 8", "1––|––3"], ["1 4", "1–3|–––"], ["0 1 4 6 7", null], ["0 10 2 4 6 7 8", null], ["0 1 11 4 6 8", null], ["1", "1––|–––"], ["0 1 4", "T 1–3|–––"], ["2", "–2–|–––"], ["2 4 5", "–23 G# |–––"], ["0 10 13 2 4 6 7 8", null], ["6 7 8", "–––|123"], ["6 7 8 9", "–––|123 Eb"], ["0 1 10 11 2 4 6 7 8", "T 123 C# |123 C"], ["0 4 6 7 8", "T ––3|123"], ["0 4", "T ––3|–––"], ["0 4 5", "T ––3 G# |–––"], ["6 7", "–––|12–"], ["6", "–––|1––"], ["7", "–––|–2–"], ["1 11 2 4 6 7 8", null], ["0 1 3", "T 1 Bb ––|–––"], ["0 2 6 7", null], ["0 2 6 7 9", null], ["0", "T –––|–––"], ["0 6 8 9", null], ["0 1 2 4 6", "T 123|1––"], ["0 1 2 4 7", "T 123|–2–"], ["0 1 2 4 8", "T 123|––3"], ["0 1 2 6 7", null], ["0 1 2 6 7 9", null], ["0 1 13 2 6 7", null], ["0 1 2", "T 12–|–––"], ["0 1 2 7", "T 12–|–2–"], ["0 1 4 7 8", null], ["0 1 4 8", null], ["0 1 4 8 9", null], ["0 1 6", "T 1––|1––"], ["0 1 7", "T 1––|–2–"], ["0 1 8", "T 1––|––3"], ["0 1", "T 1––|–––"], ["0 2", "T –2–|–––"], ["0 2 4 5", "T –23 G# |–––"], ["0 6 7 8", "T –––|123"], ["0 2 4 7", null]] }, "baritone-saxophone": { diagram: "saxophone", holes: ["h_octave-high", "h_octave-low", "h_F_sharp5", "h_F5", "h_E5", "h_D_sharp5", "h_D5", "h_C_sharp5", "h_C5", "h_side-C", "h_B4", "h_A_sharp4", "h_side-A_sharp", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_side-F_sharp", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_C_sharp4", "h_D5", "h_D_sharp4", "h_D_sharp5", "h_E5", "h_F5", "h_F_sharp5", "h_G_sharp4", "h_octave-high", "h_octave-low", "h_side-A_sharp", "h_side-C", "h_side-F_sharp"], keys: { "lh:T": [[], [], null], "cc:one": [["h_C_sharp5", "h_C5"], [], "h_C5"], "cc:two": [["h_C_sharp5", "h_B4", "h_A_sharp4"], [], "h_B4"], "lh:bes": [["h_B4"], [], null], "cc:three": [["h_C_sharp5", "h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4", "h_G_sharp4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4", "h_B4", "h_G_sharp4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4", "h_B4", "h_G_sharp4"], [], "h_E4"], "rh:ees": [[], ["h_D_sharp4"], null], "rh:low-c": [["h_D4"], [], null], "lh:cis": [["h_D4"], ["h_C_sharp4"], null], "lh:b": [["h_D4", "h_C4"], [], null], "lh:low-bes": [["h_D4", "h_C4", "h_B3"], [], null], "lh:d": [[], ["h_D5"], null], "lh:ees": [[], ["h_D_sharp5"], null], "rh:e": [[], ["h_E5"], null], "lh:f": [[], ["h_F5"], null], "lh:front-f": [[], ["h_F5"], null], "rh:high-fis": [[], ["h_F_sharp5"], null], "rh:c": [[], ["h_side-C"], null], "rh:bes": [[], ["h_side-A_sharp"], null], "rh:fis": [[], ["h_side-F_sharp"], null] }, switch: { "lh:T": ["cc:three", "h_octave-low", "h_octave-high"] }, charted: [["1 10 13 2 4 6 7 8", "123 Bb |123 C"], ["1 10 12 2 4 6 7 8", "123 B |123 C"], ["1 10 2 4 6 7 8", "123|123 C"], ["1 10 11 2 4 6 7 8", "123 C# |123 C"], ["0 1 13 2 4 6 7 8", "T 123 Bb |123"], ["1 2 4 6 7 8", "123|123"], ["0 1 12 2 4 6 7 8", "T 123 B |123"], ["1 2 4 6 7 8 9", "123|123 Eb"], ["0 1 10 2 4 6 7 8", "T 123|123 C"], ["1 2 4 6 7", "123|12–"], ["1 2 4 6", "123|1––"], ["1 10 13 2 4 7 8", "123 Bb |–23 C"], ["0 1 11 2 4 6 7 8", null], ["0 1 2 4 6 7 8", "T 123|123"], ["1 2 4 7", "123|–2–"], ["1 2 4", "123|–––"], ["1 11 2 4", "123 C# |–––"], ["1 12 2 4", "123 B |–––"], ["1 13 2 4", "123 Bb |–––"], ["1 2 4 5", "123 G# |–––"], ["0 1 2 4 6 7", "T 123|12–"], ["0 1 2 4 6", "T 123|1––"], ["1 2", "12–|–––"], ["0 10 2 4 6 7 8", null], ["0 1 2 4 7", "T 123|–2–"], ["1 3", "1 Bb ––|–––"], ["1 6", "1––|1––"], ["1 7", "1––|–2–"], ["1 8", "1––|––3"], ["1 4", "1–3|–––"], ["0 1 2 4 8", "T 123|––3"], ["1", "1––|–––"], ["0 1 13 2 6 7", null], ["0 1 2 4 5", "T 123 G# |–––"], ["2", "–2–|–––"], ["2 4 5", "–23 G# |–––"], ["2 4", null], ["0 1 4 6 7", null], ["0 1 10 11 2 4 6 7 8", "T 123 C# |123 C"], ["0 4 6 7 8", "T ––3|123"], ["0 4", "T ––3|–––"], ["0 4 5", "T ––3 G# |–––"], ["6 7 8", "–––|123"], ["6 7 8 9", "–––|123 Eb"], ["6 7", "–––|12–"], ["6", "–––|1––"], ["7", "–––|–2–"], ["", null], ["0 2 4 6 7 8 9", null], ["0 1 2 4 6 7 8 9", "T 123|123 Eb"], ["0 2 4 6 7 8", null], ["0 2", "T –2–|–––"], ["0", "T –––|–––"], ["0 6 8 9", null], ["0 2 4 6 7", null], ["0 1 2 4", "T 123|–––"], ["0 1 11 2 4", "T 123 C# |–––"], ["0 1 12 2 4", "T 123 B |–––"], ["0 1 13 2 4", "T 123 Bb |–––"], ["0 1 2", "T 12–|–––"], ["0 1 2 7", "T 12–|–2–"], ["0 1 2 6 7 9", null], ["0 1 3", "T 1 Bb ––|–––"], ["0 1 6", "T 1––|1––"], ["0 1 7", "T 1––|–2–"], ["0 1 8", "T 1––|––3"], ["0 1 4", "T 1–3|–––"], ["0 1 2 6", null], ["0 1", "T 1––|–––"], ["0 2 4 5", "T –23 G# |–––"], ["0 1 6 7", null], ["0 6 7 8", "T –––|123"], ["0 2 7 9", null], ["0 2 6 7 9", null], ["0 4 6 7", null], ["0 10 13 2 4 6 7 8", null]] }, "bass-clarinet": { diagram: "bass-clarinet", holes: ["h081", "h093", "h119", "h130", "h139", "h157", "h166", "h168", "h178", "h197", "h211", "h213", "h216", "h235", "h246", "h276", "h291", "h297", "h318", "h340", "h373", "h401", "h432", "h470"], standing: ["h081", "h093", "h119", "h130", "h139", "h168", "h213", "h216", "h246", "h297", "h373", "h432"], keys: { "lh:R": [[], ["h081"], null], "lh:thumb": [["h157", "h166"], [], "h166"], "lh:a": [[], ["h130", "h139"], null], "lh:gis": [[], ["h139"], null], "cc:one": [["h157", "h178"], [], "h178"], "cc:two": [["h197", "h211"], [], "h211"], "lh:ees": [[], ["h213"], null], "cc:three": [["h235"], [], "h235"], "lh:cis": [[], ["h246"], null], "lh:f": [["h401"], [], null], "lh:fis": [["h401"], ["h432"], null], "lh:e": [["h401", "h470"], [], null], "rh:one": [[], ["h093"], null], "rh:two": [[], ["h119"], null], "rh:three": [[], ["h168"], null], "rh:four": [[], ["h216"], null], "cc:four": [["h197", "h276", "h291"], [], "h291"], "cc:five": [["h197", "h276", "h318"], [], "h318"], "rh:b": [[], ["h297"], null], "cc:six": [["h197", "h276", "h340"], [], "h340"], "rh:fis": [["h401"], ["h432"], null], "rh:gis": [[], ["h373"], null], "rh:e": [["h401", "h470"], [], null], "rh:f": [["h401"], [], null] }, switch: {}, charted: [["1 11 16 17 19 4 5 7", "T 123 E |123"], ["1 16 17 19 23 4 5 7", "T 123|123 F"], ["1 10 16 17 19 4 5 7", "T 123 F# |123"], ["1 16 17 19 4 5 7", "T 123|123"], ["1 16 17 19 21 4 5 7", "T 123|123 G#"], ["0 1 11 16 17 19 4 5 7", "RT 123 E |123"], ["1 16 17 4 5 7", "T 123|12-"], ["0 1 16 17 19 23 4 5 7", "RT 123|123 F"], ["0 1 10 16 17 19 4 5 7", "RT 123 F# |123"], ["1 16 4 5 7", "T 123|1--"], ["0 1 16 17 19 4 5 7", "RT 123|123"], ["0 1 16 17 19 21 4 5 7 9", null], ["1 17 4 5 7", "T 123|-2-"], ["1 16 18 4 5 7", "T 123|1- B -"], ["0 1 16 17 19 21 4 5 7", "RT 123|123 G#"], ["0 1 16 17 22 4 5 7", null], ["1 4 5 7", "T 123|---"], ["0 1 16 17 4 5 7", "RT 123|12-"], ["0 1 16 17 19 23 4 5 7 8", null], ["1 4 5 7 8", "T 123 C# |---"], ["0 1 16 4 5 7", "RT 123|1--"], ["0 1 16 17 19 4 5 7 8", "RT 123 C# |123"], ["0 1 16 17 19 23 5 7", "RT -23|123 F"], ["1 4 5", "T 12-|---"], ["0 1 16 18 4 5 7", "RT 123|1- B -"], ["0 1 10 16 17 19 5 7", "RT –23 F# |123"], ["0 1 16 17 19 5 7", "RT –23|123"], ["1 15 4 5", "T 12-| 4 ---"], ["1 4 5 6", "T 12 Eb -|---"], ["1 16 4", "T 1--|1--"], ["1 17 4", "T 1--|-2-"], ["1 4 7", "T 1-3|---"], ["0 1 10 16 19 5 7", null], ["0 1 16 17 19 21 4 5", "RT 12-|123 G#"], ["0 1 16 17 19 21 3 4 5 7 9", null], ["1 4", "T 1--|---"], ["1 15 19 23 4 6", "T 1- Eb -| 4 --3 F"], ["1 15 16 17 19 23 4 6 8", "T 1- Eb - C# | 4 123 F"], ["0 1 17 23 5 7", null], ["0 1 17 19 21 5 7", "RT –23|–23 G#"], ["0 1 17 5 7", null], ["1", "T ---|---"], ["16 17 19 4", "1--| 123"], ["0 1 4 5 6", "RT 12 Eb -|---"], ["0 1 15 21 4 5", "RT 12-| 4 --- G#"], ["4", "1--|---"], ["1 14 15", "T ---| 34 ---"], ["1 14 15 16 17 19", "T ---| 34 123"], ["0 1 10 16 17 21 3 4 5", null], ["0 21 4 5 7", "R 123|--- G#"], ["0 1 16 17 3 4 5", null], ["16 17 19", "---| 123"], ["", null], ["5", null], ["1 13 4", "T 1––| 2 –––"], ["3", "G# ---|---"], ["1 14 15 3", "T G# ---| 34 ---"], ["15 16 3 5 7", "G# -23| 4 1--"], ["16 17 19 3", "G# ---| 123"], ["1 14 15 16 17 19 3", "T G# ---| 34 123"], ["0 1 3", "RT G# ---|---"], ["0 5", null], ["17 19 2 23 5 7", "A-23|-23 F"], ["2", "A---|---"], ["17 19 2 23", "A---|-23 F"], ["16 17 19 2", "A---| 123"], ["0 1 2 21", "RT A---|--- G#"], ["0 1 13 14 15 16 23 4", null], ["0 3", null], ["0 2", "R A---|---"], ["13 2", "A---| 2 ---"], ["0 16 19 2 23 7", "R A--3|1-3 F"], ["0 16 17 19 2", "R A---| 123"], ["13 16 17 19 2", "A---| 2 123"], ["0 17 19 2 4 5 7", "R A123|-23"], ["0 17 19 2 23 5 7", "R A-23|-23 F"], ["0 19 2 23 7", "R A--3|--3 F"], ["0 1 12 13 17 20 3 5 7", null], ["0 1 12 13 7 8", null], ["0 1 12 13 21 7 8", null], ["12 2", "A---| 1 ---"], ["0 13 2", "R A---| 2 ---"], ["0 1 11 16 17 19 2 4 5 7", "RT A123 E |123"], ["0 1 12 13 19 2 21 4", null], ["0 1 11 16 17 19 5 7", null], ["0 12 2", "R A---| 1 ---"], ["0 12 13 2", "R A---| 12 ---"], ["0 1 16 17 19 23 4 7", "RT 1–3|123 F"], ["0 1 16 17 19 23 5 7 8", null], ["0 1 16 19 5 7", null], ["0 1 16 17 19 4 5", null], ["0 1 16 17 19 21 4 5 7 8", null], ["0 1 17 19 21 4 5 7", "RT 123|-23 G#"], ["0 1 16 17 21 5 7", "RT -23|12- G#"], ["0 1 16 20 5 7", null], ["0 1 17 4 5 7", "RT 123|-2-"], ["0 1 19 4 5 7", "RT 123|--3"], ["0 1 16 17 4 5", "RT 12-|12-"], ["0 1 16 21 5 7", "RT -23|1-- G#"], ["0 1 16 17 21 5 7 8", "RT -23 C# |12- G#"], ["0 1 4 5 7", "RT 123|---"], ["0 1 16 18 21 5 7", "RT -23|1- B - G#"], ["0 1 16 21 7", null], ["0 17 21 4 5 7", "R 123|-2- G#"], ["0 1 4 5 7 8", "RT 123 C# |---"], ["0 1 13 21 4 5 7 8", "RT 123 C# | 2 --- G#"], ["0 1 4 5", "RT 12-|---"], ["0 1 21 3 5 7 8", "RT G# -23 C# |--- G#"], ["0 1 15 4 5", "RT 12-| 4 ---"], ["0 1 16 4", "RT 1--|1--"], ["0 1 17 4", "RT 1--|-2-"], ["0 1 5 7 8", "RT -23 C# |---"], ["0 1 4 7", "RT 1-3|---"], ["0 1 17 19 23 4", "RT 1--|-23 F"], ["0 1 11 17 21 5", null], ["0 1 21 4", "RT 1--|--- G#"], ["0 1 4", "RT 1--|---"], ["0 1 17 19 20 3 5 7 8", null], ["0 1", "RT ---|---"], ["0 1 15 16 17 19 7", "RT --3| 4 123"], ["0 1 16 17 19", "RT –––|123"], ["0 1 14 15 4 5 6", "RT 12 Eb –| 34 –––"], ["0 1 16 17 19 21 5 7", "RT –23|123 G#"], ["0 16 17 19 21 4 5 7", "R 123|123 G#"], ["0 1 16 17 19 21 3 4", null], ["0 1 16 19 21 5 7", null], ["0 1 16 17 5 7", "RT -23|12-"], ["0 1 14 15", "RT ---| 34 ---"], ["0 1 15 4", "RT 1--| 4 ---"], ["0 1 16 17 21 3 4 5 7", "RT G# 123|12- G#"], ["0 1 15 3", "RT G# ---| 4 ---"], ["0 16 17 21 4", null], ["0 1 13", "RT ---| 2 ---"], ["0 1 21", "RT ---|--- G#"], ["0 1 16 17 3 5 7", "RT G# -23|12-"], ["0 16 19 21 4 5 7", "R 123|1-3 G#"], ["0 1 11 16 17 19 5", null], ["0 1 19 21 5 7", "RT -23|--3 G#"], ["0 1 17 21 5 7", "RT -23|-2- G#"], ["0 1 21 5 7", "RT -23|--- G#"], ["0 1 3 5 7", "RT G# -23|---"], ["0 1 5 7", null], ["0 1 20 5 7", null], ["0 1 21 5 7 8", "RT -23 C# |--- G#"], ["0 1 2 4 5 7 8", "RT A123 C# |---"], ["0 1 18 21 5", "RT –2–|–– B – G#"], ["0 1 21 5", "RT -2-|--- G#"], ["0 1 17 20 5", "RT -2-|-2- F#"], ["0 1 12 21 4 5", "RT 12-| 1 --- G#"], ["0 1 14 21 5 7 8", "RT –23 C# | 3 -–– G#"], ["0 1 16 17 21 5", "RT -2-|12- G#"], ["0 1 16 17 21 4", "RT 1--|12- G#"], ["0 1 20 7 8", "RT --3 C# |--- F#"], ["0 1 15 21 5", "RT -2-| 4 --- G#"], ["0 1 16 21 4", "RT 1--|1-- G#"], ["0 1 16 20 4", "RT 1--|1-- F#"], ["0 1 16 19 21 5", "RT -2-|1-3 G#"], ["0 1 21 5 6", "RT -2 Eb -|--- G#"], ["0 1 15 18 5", "RT -2-| 4 -- B -"], ["0 1 21 7 8", "RT --3 C# |--- G#"], ["0 1 16 17 19 21 4", "RT 1--|123 G#"], ["0 1 14 21 5 8", "RT –2– C# | 3 -–– G#"]] }, bassoon: { diagram: "bassoon", holes: ["h_whisper", "h_F3", "h_E3", "h_D_sharp3", "h_D3", "h_C_sharp3", "h_C3", "h_B2", "h_A_sharp2", "h_A2", "h_G_sharp2", "h_G2", "h_F_sharp2", "h_F2", "h_E2", "h_D_sharp2", "h_D2", "h_C_sharp2", "h_C2", "h_B1"], standing: ["h_A_sharp2", "h_C_sharp3", "h_D_sharp3", "h_G_sharp2"], keys: { "lh:whisper": [["h_whisper"], [], null], "cc:one": [["h_F3"], [], "h_F3"], "cc:two": [["h_E3"], [], "h_E3"], "lh:ees": [[], ["h_D_sharp3"], null], "cc:three": [["h_D3"], [], "h_D3"], "lh:thumb-cis": [[], ["h_C_sharp3"], null], "cc:four": [["h_C3"], [], "h_C3"], "cc:five": [["h_B2"], [], "h_B2"], "rh:thumb-bes": [[], ["h_A_sharp2"], null], "cc:six": [["h_A2"], [], "h_A2"], "rh:gis": [[], ["h_G_sharp2"], null], "rh:thumb-fis": [["h_G2"], [], null], "rh:f": [["h_G2", "h_F_sharp2"], [], null], "rh:thumb-e": [["h_F2"], [], null], "lh:low-ees": [["h_E2"], [], null], "lh:low-d": [["h_D_sharp2"], [], null], "lh:low-cis": [["h_D2"], [], null], "lh:low-c": [["h_C_sharp2"], [], null], "lh:low-b": [["h_C2"], [], null], "lh:low-bes": [["h_B1"], [], null] }, switch: {}, charted: [["1 12 13 14 15 16 17 18 19 2 4 6 7 9", "Bb B C D 123|E 123 F"], ["0 1 12 13 14 15 16 17 18 2 4 6 7 9", null], ["0 1 12 13 14 15 16 17 18 19 2 4 6 7 9", null], ["1 12 13 14 15 16 17 18 2 4 6 7 9", "B C D 123|E 123 F"], ["0 1 12 13 14 15 16 17 2 4 6 7 9", null], ["1 12 13 14 15 16 17 2 4 6 7 9", "C D 123|E 123 F"], ["0 1 12 13 14 15 16 2 4 6 7 9", null], ["1 12 13 14 15 16 2 4 6 7 9", "C D 123 C# |E 123 F"], ["1 12 13 14 15 17 2 4 6 7 9", "D 123|E 123 F"], ["0 1 12 13 14 15 2 4 6 7 9", null], ["1 12 13 14 17 2 4 6 7 9", "D 123 Eb |E 123 F"], ["0 1 12 13 14 2 4 6 7 9", null], ["0 1 12 13 2 4 6 7 9", null], ["1 12 13 14 2 4 6 7 9", null], ["0 1 12 13 15 17 2 4 6 7 9", "W 123|E 123 F"], ["0 1 12 13 15 2 4 6 7 9", "W 123 C# |E 123 F"], ["0 1 12 2 4 6 7 9", null], ["1 12 13 2 4 6 7 9", null], ["0 1 12 15 17 2 4 6 7 9", "W 123|123 F"], ["0 1 11 2 4 6 7 9", null], ["1 11 15 17 2 4 6 7 9", "123|123 F F#"], ["0 1 11 15 17 2 4 6 7 9", "W 123|F# 123 F"], ["0 1 15 17 2 4 6 7 9", "W 123|123 F#"], ["0 1 2 4 6 7 9", null], ["1 11 2 4 6 7 9", null], ["0 1 10 2 4 6 7 9", null], ["0 1 10 15 17 2 4 6 7 9", "W 123|123 G#"], ["0 1 2 4 6 7", null], ["1 15 17 2 4 6 7", "123|12-"], ["0 1 15 17 2 4 6 7", "W 123|12-"], ["11 13 15 17 1:0.25 2 4 6 7 9", "¼23|E F# 123 F"], ["0 1 15 17 2 4 6 7 8", "W 123|Bb 12-"], ["1 15 17 2 4 6 7 8", "123|Bb 12-"], ["1 11 15 17 2 4 5 6 7 9", "C# 123|F# 123 F"], ["11 15 17 1:0.25 2 4 6 7 9", "¼23|123 F F#"], ["0 1 15 17 2 4 6", "W 123|1--"], ["1 15 17 2 4 6", "123|1--"], ["15 17 1:0.25 2 4 6 7 9", "¼23|F# 123"], ["1 10 15 17 2 4 5 6 7 9", "C# 123|F# 123 G#"], ["0 1 15 17 2 4", "W 123|---"], ["1 12 15 17 2 4 5 7 9", "C# 123|-23 F"], ["0 1 2 4", null], ["0 1 14 15 17 2 4 5", "D C# W 123|---"], ["0 1 15 17 2", "W 12-|---"], ["1 12 15 17 2 7 9", "12-|-23 F"], ["1 14 15 17 2 4 5", "D C# 123|---"], ["1 11 15 17 2 5 6 7 9", "C# 12-|F# 123 F"], ["1 15 17 2 9", "12-|--3"], ["1 15 17 2", "12-|---"], ["1 12 13 14 15 2 4 6 7 9", null], ["0 1 15 17 4", "W 1-3|---"], ["0 1 15 17 4 7 8", "W 1-3|Bb -2-"], ["0 1 17 4 7 8", "W 1-3 Eb |Bb -2-"], ["0 1 15 17 2 5", "C# W 12-|---"], ["0 1 17 4", "W 1-3 Eb | ---"], ["1 17 4 7 9", "1-3 Eb |-23"], ["15 17 2 6", "-2-|1--"], ["17 2 6 7 8", "-2- Eb |Bb 12-"], ["0 1 15 17", "W 1--|---"], ["0 1 12 13 15 17 9", "W 1--|E --3 F"], ["10 17 6 7", "--- Eb |G# 12-"], ["12 17 4 9", "--3 Eb |--3 F"], ["1 17", "1-- Eb |---"], ["0 15 17", "W ---|---"], ["13 14 15 16 17 18 19 6 9", "Bb B C D ---|E 1-3"], ["1 12 2 4 6 7 9", null], ["0 11 15 17 1:0.25 2 4 6 7 9", "W ¼23|F# 123 F"], ["0 15 17 1:0.25 2 4 6 7 9", "W ¼23|123 F#"], ["0 11 13 15 17 1:0.25 2 4 6 7 9", "W ¼23|E F# 123 F"], ["0 17 1:0.5 2 4 6 7 9", "W ½23 Eb |123"], ["0 10 15 17 1:0.5 2 4 6 7 9", "W ½23|123 G#"], ["10 15 17 1:0.5 2 4 6 7 9", "½23|123 G#"], ["0 10 15 17 1:0.75 2 4 6 7 9", "W ¾23|123 G#"], ["10 15 17 1:0.75 2 4 6 7 9", "¾23|123 G#"], ["1 17 4 6 7 9", "1-3 Eb |123"], ["1 17 2 6 7 9", "12- Eb |123"], ["0 1 12 13 17 2 4 5 6 7", "C# W 123 Eb |E 12- F"], ["1 2 4 6 7", null], ["0 1 12 13 17 2 4 5 7", "C# W 123 Eb |E -2- F"], ["1 15 17 2 7 9", "12-|-23"], ["1 2 4 6", null], ["1 15 17 2 4", "123|---"], ["0 15 17 1:0.5 2 4 9", "W ½23|--3"], ["0 17 1:0.5 2 4 9", "W ½23 Eb |--3"], ["0 17 1:0.75 2 4 9", "W ¾23 Eb |--3"], ["1 12 15 17 2 4 5 6 7 8 9", "C# 123|Bb 123 F"], ["1 15 17 2 6", "12–|1––"], ["1 2 4 5", null], ["0 1 12 17 2 4 5 7", "C# W 123 Eb |-2- F"], ["1 15 17 2 6 7 9", "12-|123"], ["1 15 17 2 6 9", "12-|1-3"], ["1 15 17 2 5", "C# 12-|---"], ["1 17 4", "1-3 Eb |---"], ["1 15 17", "1--|---"], ["1 17 4 6 7", "1-3 Eb |12-"], ["1 15 17 4 6 7", "1-3|12-"], ["17 2 4 6 7", "-23 Eb |12-"], ["15 17 2 4 6 7", "-23|12-"], ["1 15 17 6 7", "1--|12-"], ["0 15 17 1:0.5 2 4 6", "W ½23|1--"], ["0 17 1:0.5 2 4 6", "W ½23 Eb |1--"], ["17 2 4 6 7 8", "-23 Eb |Bb 12-"], ["12 17 2 4 6 7", "-23 Eb |12- F"], ["17 1:0.5 2 4 6", "½23 Eb |1--"], ["1 17 4 6 7 8", "1-3 Eb |Bb 12-"], ["1 15 17 4 6 7 8", "1-3|Bb 12-"], ["12 17 2 6 7", "-2- Eb |12- F"], ["10 17 7", "--- Eb |G# -2-"], ["0 12 17 1:0.5 2 4 6", "W ½23 Eb |1-- F"], ["0 12 15 17 1:0.5 2 4 6", "W ½23|1-- F"], ["0 10 17 1:0.5 2 4", "W ½23 Eb |--- G#"], ["0 10 15 17 1:0.5 2 4", "W ½23|--- G#"], ["0 17 1:0.5 2 4", "W ½23 Eb |---"], ["0 15 17 1:0.5 2 4", "W ½23|---"], ["1 2 4 6 7 9", null], ["0 12 17 1:0.5 2 4 8", "W ½23 Eb |Bb --- F"], ["0 17 1:0.5 2 4 7 8 9", "W ½23 Eb |Bb -23"], ["0 12 15 17 1:0.5 2 4 8", "W ½23|Bb --- F"], ["0 15 17 1:0.5 2 4 7 8 9", "W ½23|Bb -23"], ["1 10 2 4 6 7 9", null], ["1 2", null], ["", null], ["1", null], ["10 15 17 1:0.5 2 4 5", "C# ½23|--- G#"], ["15 17 2 4 5 7", "C# –23|–2– F#"], ["17 2 4 5 7", "C# –23 Eb |–2– F#"], ["10 12 15 17 1:0.5 2 4 5 6 7 9", "C# ½23|G# 123 F"], ["1 10 15 17 2 5 6 7 9", "C# 12-|F# 123 G#"]] }, clarinet: { diagram: "clarinet", holes: ["h081", "h093", "h119", "h130", "h139", "h157", "h166", "h168", "h178", "h197", "h211", "h213", "h216", "h235", "h246", "h276", "h291", "h297", "h318", "h340", "h373", "h401", "h432", "h470"], standing: ["h081", "h093", "h119", "h130", "h139", "h168", "h213", "h216", "h246", "h297", "h373", "h432"], keys: { "lh:R": [[], ["h081"], null], "lh:thumb": [["h157", "h166"], [], "h166"], "lh:a": [[], ["h130", "h139"], null], "lh:gis": [[], ["h139"], null], "cc:one": [["h157", "h178"], [], "h178"], "cc:two": [["h197", "h211"], [], "h211"], "lh:ees": [[], ["h213"], null], "cc:three": [["h235"], [], "h235"], "lh:cis": [[], ["h246"], null], "lh:f": [["h401"], [], null], "lh:fis": [["h401"], ["h432"], null], "lh:e": [["h401", "h470"], [], null], "rh:one": [[], ["h093"], null], "rh:two": [[], ["h119"], null], "rh:three": [[], ["h168"], null], "rh:four": [[], ["h216"], null], "cc:four": [["h197", "h276", "h291"], [], "h291"], "cc:five": [["h197", "h276", "h318"], [], "h318"], "rh:b": [[], ["h297"], null], "cc:six": [["h197", "h276", "h340"], [], "h340"], "rh:fis": [["h401"], ["h432"], null], "rh:gis": [[], ["h373"], null], "rh:e": [["h401", "h470"], [], null], "rh:f": [["h401"], [], null] }, switch: {}, charted: [["1 11 16 17 19 4 5 7", "T 123 E |123"], ["1 16 17 19 23 4 5 7", "T 123|123 F"], ["1 10 16 17 19 4 5 7", "T 123 F# |123"], ["1 16 17 19 4 5 7", "T 123|123"], ["1 16 17 19 21 4 5 7", "T 123|123 G#"], ["1 16 17 4 5 7", "T 123|12-"], ["0 1 11 16 17 19 4 5 7", "RT 123 E |123"], ["1 16 4 5 7", "T 123|1--"], ["0 1 16 17 19 23 4 5 7", "RT 123|123 F"], ["1 17 4 5 7", "T 123|-2-"], ["1 16 18 4 5 7", "T 123|1- B -"], ["0 1 10 16 17 19 4 5 7", "RT 123 F# |123"], ["1 4 5 7", "T 123|---"], ["1 4 5 7 8", "T 123 C# |---"], ["0 1 16 17 19 21 4 5 7 9", "RT 123 F |123 G#"], ["0 1 16 17 19 21 4 5 7", "RT 123|123 G#"], ["1 4 5", "T 12-|---"], ["0 1 16 17 22 4 5 7", null], ["0 1 16 17 4 5 7", "RT 123|12-"], ["1 15 4 5", "T 12-| 4 ---"], ["1 4 5 6", "T 12 Eb -|---"], ["1 16 4", "T 1--|1--"], ["1 17 4", "T 1--|-2-"], ["1 4 7", "T 1-3|---"], ["0 1 16 4 5 7", "RT 123|1--"], ["0 1 17 19 21 4 5 7", "RT 123|-23 G#"], ["1 4", "T 1--|---"], ["1 15 19 23 4 6", "T 1- Eb -| 4 --3 F"], ["1 15 16 17 19 23 4 6 8", "T 1- Eb - C# | 4 123 F"], ["1", "T ---|---"], ["4", "1--|---"], ["1 14 15", "T ---| 34 ---"], ["16 17 19 4", "1--| 123"], ["1 14 15 16 17 19", "T ---| 34 123"], ["16 21 4", "Better response than RT 1--|1-- G# ."], ["0 1 16 21 5 7", "RT -23|1-- G#"], ["0 1 16 5 7", null], ["16 17 19", "---| 123"], ["0 1 5 8", null], ["3", "G# ---|---"], ["1 14 15 3", "T G# ---| 34 ---"], ["15 16 3 5 7", "G# -23| 4 1--"], ["16 17 19 3", "G# ---| 123"], ["1 14 15 16 17 19 3", "T G# ---| 34 123"], ["1 13 4", "T 1––| 2 –––"], ["0 1 16 17 21 3 4 5 7", "RT G# 123|12- G#"], ["0 1 11 16 17 19 2 4 5 7", "RT A123 E |123"], ["", null], ["2", "A---|---"], ["17 19 2 23", "A---|-23 F"], ["17 19 2 23 5 7", "A-23|-23 F"], ["16 17 19 2", "A---| 123"], ["0 2", "R A---|---"], ["13 2", "A---| 2 ---"], ["0 16 19 2 23 7", "R A--3|1-3 F"], ["0 16 17 19 2", "R A---| 123"], ["13 16 17 19 2", "A---| 2 123"], ["0 17 19 2 4 5 7", "R A123|-23"], ["0 17 19 2 23 5 7", "R A-23|-23 F"], ["0 19 2 23 7", "R A--3|--3 F"], ["12 2", "A---| 1 ---"], ["0 13 2", "R A---| 2 ---"], ["0 12 2", "R A---| 1 ---"], ["0 12 13 2", "R A---| 12 ---"], ["0 1 16 17 19 23 5 7", "RT -23|123 F"], ["0 1 12 13 17 20 3 5 7", "RT G# -23| 12 -2- F#"], ["0 1 12 13 21 7 8", "RT --3 C# | 12 --- G#"], ["0 1 12 13 7 8", "RT --3 C# | 12 ---"], ["0 1 16 17 19 4 5 7", "RT 123|123"], ["0 1 10 16 17 19 5 7", "RT –23 F# |123"], ["0 1 16 17 19 23 4 5 7 8", "RT 123 C# |123 F"], ["0 1 16 17 19 21 3 4 5 7 9", "RT G# 123 F |123 G#"], ["0 16 17 19 21 4 5 7", "R 123|123 G#"], ["0 1 16 17 19 21 5 7", "RT –23|123 G#"], ["0 1 17 4 5 7", "RT 123|-2-"], ["0 1 16 18 4 5 7", "RT 123|1- B -"], ["0 1 19 4 5 7", "RT 123|--3"], ["0 1 16 17 19 4 5", null], ["0 1 16 17 19 4 5 7 8", "RT 123 C# |123"], ["0 1 4 5 7", "RT 123|---"], ["0 1 16 20 5 7", "RT -23|1-- F#"], ["0 1 4 5 7 8", "RT 123 C# |---"], ["0 1 16 17 4 5", "RT 12-|12-"], ["0 1 17 21 5 7", "RT -23|-2- G#"], ["0 1 17 19 21 5 7", "RT –23|–23 G#"], ["0 1 4 5", "RT 12-|---"], ["0 1 21 5 7", "RT -23|--- G#"], ["0 1 20 5 7", "RT -23|--- F#"], ["0 1 16 17 19 21 4", "RT 1--|123 G#"], ["0 1 15 4 5", "RT 12-| 4 ---"], ["0 1 4 5 6", "RT 12 Eb -|---"], ["0 1 16 4", "RT 1--|1--"], ["0 1 17 4", "RT 1--|-2-"], ["0 1 5 7 8", "RT -23 C# |---"], ["0 1 4 7", "RT 1-3|---"], ["0 1 16 17 19 23 4 7", "RT 1–3|123 F"], ["0 1 21 5 7 8", "RT -23 C# |--- G#"], ["0 1 16 21 4 8", "RT 1-- C# |1-- G#"], ["0 1 16 17 19 23 5 7 8", "RT -23 C# |123 F"], ["0 1 4", "RT 1--|---"], ["0 1 21 4", "RT 1--|--- G#"], ["0 1 15 20 5 7", "RT -23| 4 --- F#"], ["0 1 16 21", "RT ---|1-- G#"], ["0 1", "RT ---|---"], ["0 1 15 16 17 19 7", "RT --3| 4 123"], ["0 1 16 17 19", "RT –––|123"], ["0 1 14 15 4 5 6", "RT 12 Eb –| 34 –––"], ["0 1 16 17 19 5 7", "RT –23|123"], ["0 1 15 21", "RT ---| 4 --- G#"], ["0 1 21", "RT ---|--- G#"], ["0 1 21 7 8", "RT --3 C# |--- G#"], ["0 1 16 17 5 7", "RT -23|12-"], ["0 1 14 15", "RT ---| 34 ---"], ["0 1 15 4", "RT 1--| 4 ---"], ["0 1 14 15 5", "RT -2-| 34 ---"], ["0 1 16 19 5 7", null], ["0 1 15 3", "RT G# ---| 4 ---"], ["0 1 3", "RT G# ---|---"], ["0 1 13", "RT ---| 2 ---"], ["0 1 16 17 3 5 7", "RT G# -23|12-"], ["0 16 19 21 4 5 7", "R 123|1-3 G#"], ["0", null], ["0 16 17 20", "R ---|12- F#"], ["0 1 16 18 21 5 7", "RT -23|1- B - G#"], ["0 1 19 21 5 7", "RT -23|--3 G#"], ["0 1 2 21", "RT A---|--- G#"], ["0 17 21 4 5 7", "R 123|-2- G#"], ["0 3", null], ["0 1 17 23 5 7", "RT -23|-2- F"], ["0 1 3 5 7", "RT G# -23|---"], ["0 21 4 5 7", "R 123|--- G#"], ["0 1 23 5 7", "RT -23|--- F"], ["0 1 13 21 4 5 7 8", "RT 123 C# | 2 --- G#"], ["0 1 2 4 5 7 8", "RT A123 C# |---"], ["0 1 21 3 5 7 8", "RT G# -23 C# |--- G#"], ["0 1 21 5", "RT -2-|--- G#"], ["0 1 15 21 4 5", "RT 12-| 4 --- G#"], ["0 1 16 17 19 21 4 5", "RT 12-|123 G#"], ["0 1 17 20 5", "RT -2-|-2- F#"], ["0 1 18 21 5", "RT –2–|–– B – G#"], ["0 1 12 21 4 5", "RT 12-| 1 --- G#"], ["0 1 17 19 23 4", "RT 1--|-23 F"], ["0 1 14 21 5 7 8", "RT –23 C# | 3 -–– G#"], ["0 1 16 17 19 21 4 5 7 8", "RT 123 C# |123 G#"], ["0 1 16 17 21 5", "RT -2-|12- G#"], ["0 1 16 17 21 4", "RT 1--|12- G#"], ["0 1 20 7 8", "RT --3 C# |--- F#"], ["0 1 15 21 5", "RT -2-| 4 --- G#"], ["0 1 16 21 4", "RT 1--|1-- G#"], ["0 1 16 20 4", "RT 1--|1-- F#"], ["0 1 16 17 21 5 7", "RT -23|12- G#"], ["0 1 16 17 21 5 7 8", "RT -23 C# |12- G#"], ["0 1 16 19 21 5", "RT -2-|1-3 G#"], ["0 1 21 5 6", "RT -2 Eb -|--- G#"], ["0 1 15 18 5", "RT -2-| 4 -- B -"], ["0 1 14 21 5 8", "RT –2– C# | 3 -–– G#"], ["0 1 16 17 19 21 3 4", null], ["0 1 16 19 21 5 7", null], ["0 1 10 16 17 21 5", "RT -2- F# |12- G#"], ["0 1 10 16 19 5 7", "RT -23 F# |1-3"], ["0 16 17 21 4", "R 1--|12- G#"], ["0 1 17 21 5", "RT -2-|-2- G#"], ["0 1 16 21 7", "RT --3|1-- G#"], ["0 1 16 20 7", "RT --3|1-- F#"], ["0 1 19 21 3 4", "RT G# 1--|--3 G#"], ["0 1 14 21 8", "RT ––– C# | 3 -–– G#"], ["0 1 19 21 7", null], ["0 1 17 19 20 3 5 7 8", "RT G# -23 C# |-23 F#"], ["0 16 19 20 5 7", "R -23|1-3 F#"], ["0 1 20 3 5 7 8", "RT G# -23 C# |--- F#"], ["0 1 20 3 5 7", "RT G# -23|--- F#"], ["0 1 14 15 3 5 7 8", "RT G# -23 C# | 34 ---"], ["5", "-2-|---"], ["0 5", "R -2-|---"], ["0 1 16 17 3 4 5", "RT G# 12-|12-"], ["0 1 16 17 20 4 5", "RT 12-|12- F#"], ["0 1 16 17 20 3 4 5", "RT G# 12-|12- F#"], ["0 1 10 16 17 21 3 4 5", "RT G# 12- F# |12- G#"], ["0 1 16 17 21 3 4 5 8", "RT G# 12- C# |12- G#"], ["0 1 16 20 3 4", "RT G# 1--|1-- F#"], ["0 1 16 3 4 8", "RT G# 1-- C# |1--"], ["0 1 16 21 3", "RT G# ---|1-- G#"], ["0 1 16 23 4", "RT 1--|1-- F"], ["0 1 16 20 4 9", "RT 1-- F |1-- F#"], ["0 1 16 18 21 4 6", "RT 1- Eb -|1- B - G#"], ["0 1 16 2 21 4", "RT A1--|1-- G#"], ["0 1 16 17 2 21 4", "RT A1--|12- G#"]] }, contrabassoon: { diagram: "bassoon", holes: ["h_whisper", "h_F3", "h_E3", "h_D_sharp3", "h_D3", "h_C_sharp3", "h_C3", "h_B2", "h_A_sharp2", "h_A2", "h_G_sharp2", "h_G2", "h_F_sharp2", "h_F2", "h_E2", "h_D_sharp2", "h_D2", "h_C_sharp2", "h_C2", "h_B1"], standing: ["h_A_sharp2", "h_C_sharp3", "h_D_sharp3", "h_G_sharp2"], keys: { "lh:whisper": [["h_whisper"], [], null], "cc:one": [["h_F3"], [], "h_F3"], "cc:two": [["h_E3"], [], "h_E3"], "lh:ees": [[], ["h_D_sharp3"], null], "cc:three": [["h_D3"], [], "h_D3"], "lh:thumb-cis": [[], ["h_C_sharp3"], null], "cc:four": [["h_C3"], [], "h_C3"], "cc:five": [["h_B2"], [], "h_B2"], "rh:thumb-bes": [[], ["h_A_sharp2"], null], "cc:six": [["h_A2"], [], "h_A2"], "rh:gis": [[], ["h_G_sharp2"], null], "rh:thumb-fis": [["h_G2"], [], null], "rh:f": [["h_G2", "h_F_sharp2"], [], null], "rh:thumb-e": [["h_F2"], [], null], "lh:low-ees": [["h_E2"], [], null], "lh:low-d": [["h_D_sharp2"], [], null], "lh:low-cis": [["h_D2"], [], null], "lh:low-c": [["h_C_sharp2"], [], null], "lh:low-b": [["h_C2"], [], null], "lh:low-bes": [["h_B1"], [], null] }, switch: {}, charted: [["1 12 13 14 15 16 17 18 19 2 4 6 7 9", "Bb B C D 123|E 123 F"], ["0 1 12 13 14 15 16 17 18 19 2 4 6 7 9", null], ["1 12 13 14 15 16 17 18 2 4 6 7 9", "B C D 123|E 123 F"], ["0 1 12 13 14 15 16 17 18 2 4 6 7 9", null], ["1 12 13 14 15 16 17 2 4 6 7 9", "C D 123|E 123 F"], ["0 1 12 13 14 15 16 17 2 4 6 7 9", null], ["1 12 13 14 15 16 2 4 6 7 9", "C D 123 C# |E 123 F"], ["0 1 12 13 14 15 16 2 4 6 7 9", null], ["1 12 13 14 15 17 2 4 6 7 9", "D 123|E 123 F"], ["0 1 12 13 14 15 2 4 6 7 9", null], ["1 12 13 14 15 2 4 6 7 9", null], ["1 12 13 14 17 2 4 6 7 9", "D 123 Eb |E 123 F"], ["0 1 12 13 14 2 4 6 7 9", null], ["0 1 12 13 15 17 2 4 6 7 9", "W 123|E 123 F"], ["0 1 12 13 15 2 4 6 7 9", "W 123 C# |E 123 F"], ["1 12 13 15 17 2 4 6 7 9", "123|E 123 F"], ["1 12 13 15 2 4 6 7 9", "123 C# |E 123 F"], ["0 1 12 13 2 4 6 7 9", null], ["1 12 13 14 2 4 6 7 9", null], ["0 1 12 15 17 2 4 6 7 9", "W 123|123 F"], ["1 12 14 15 17 2 4 6 7 9", "D 123|123 F"], ["0 1 12 2 4 6 7 9", null], ["0 1 11 15 17 2 4 6 7 9", "W 123|F# 123 F"], ["0 1 15 17 2 4 6 7 9", "W 123|123 F#"], ["1 11 15 17 2 4 6 7 9", "123|123 F F#"], ["1 11 14 15 17 2 4 6 7 9", "D 123|F# 123 F"], ["0 1 11 2 4 6 7 9", null], ["1 12 2 4 6 7 9", null], ["1 14 15 17 2 4 6 7 9", "D 123|123"], ["1 14 15 2 4 6 7 9", "D 123 C# |123"], ["0 1 2 4 6 7 9", null], ["0 1 10 15 17 2 4 6 7 9", "W 123|123 G#"], ["1 10 14 15 17 2 4 6 7 9", "D 123|123 G#"], ["0 1 10 2 4 6 7 9", null], ["0 1 15 17 2 4 6 7", "W 123|12-"], ["1 14 15 17 2 4 6 7", "D 123|12-"], ["0 1 2 4 6 7", null], ["1 10 2 4 6 7 9", null], ["0 1 15 17 2 4 6 7 8", "W 123|Bb 12-"], ["1 14 15 17 2 4 6 7 8", "D 123|Bb 12-"], ["0 1 2 4 6 7 8", null], ["1 15 17 2 4 6 7", "123|12-"], ["0 1 15 17 2 4 6", "W 123|1--"], ["1 14 15 17 2 4 6", "D 123|1--"], ["0 1 2 4 6", null], ["0 1 15 17 2 4", "W 123|---"], ["1 14 15 17 2 4", "D 123|---"], ["0 1 2 4", null], ["1 15 17 2 4 6 7 8", "123|Bb 12-"], ["0 1 14 15 17 2 4 5", "D C# W 123|---"], ["0 1 15 17 2", "W 12-|---"], ["1 14 15 17 2 4 5", "D C# 123|---"], ["0 1 2 4 5", null], ["1 15 17 2 4 6", "123|1--"], ["1 14 15 17 2", "D 12-|---"], ["0 1 2", null], ["1 12 15 17 2 4 5 6 7 8 9", "C# 123|Bb 123 F"], ["1 10 15 17 2 4 5 6 7 9", "C# 123|F# 123 G#"], ["0 1 15 17 4", "W 1-3|---"], ["0 1 15 17 4 7 8", "W 1-3|Bb -2-"], ["0 1 17 4 7 8", "W 1-3 Eb |Bb -2-"], ["0 1 15 17 2 5", "C# W 12-|---"], ["0 1 17 4", "W 1-3 Eb | ---"], ["1 14 17 4 7 8", "D 1-3 Eb |Bb -2-"], ["1 14 15 17 2 5", "D C# 12-|---"], ["1 14 15 17 4", "D 1-3|---"], ["1 14 15 17 4 7 8", "D 1-3|Bb -2-"], ["14 15 17 2", "D -2-|---"], ["0 1 2 3", null], ["1 17 2 6 7 9", "12- Eb |123"], ["1 15 17 2 6 7 9", "12-|123"], ["0 1 15 17", "W 1--|---"], ["0 1 12 13 15 17 9", "W 1--|E --3 F"], ["1 14 15 17", "D 1--|---"], ["0 1", null], ["10 15 17 1:0.75 2 4 6 7 9", "¾23|123 G#"], ["0 15 17", "W ---|---"], ["13 14 15 16 17 18 19 6 9", "Bb B C D ---|E 1-3"], ["14 15 17", "D ---|---"], ["14 15 17 5", "D C# ---|---"], ["0", null], ["15 17 2 4 6 7", "-23|12-"], ["17 2 4 6 7", "-23 Eb |12-"], ["0 11 15 17 1:0.25 2 4 6 7 9", "W ¼23|F# 123 F"], ["0 15 17 1:0.25 2 4 6 7 9", "W ¼23|123 F#"], ["0 11 13 15 17 1:0.25 2 4 6 7 9", "W ¼23|E F# 123 F"], ["15 17 1:0.25 2 4 6 7 9", "¼23|F# 123"], ["11 13 15 17 1:0.25 2 4 6 7 9", "¼23|E F# 123 F"], ["11 15 17 1:0.25 2 4 6 7 9", "¼23|123 F F#"], ["11 14 15 17 2 4 6 7 9", "D -23|F# 123 F"], ["1 15 17", "1--|---"], ["1 17", "1-- Eb |---"], ["0 17 1:0.5 2 4 6 7 9", "W ½23 Eb |123"], ["0 10 15 17 1:0.5 2 4 6 7 9", "W ½23|123 G#"], ["10 15 17 1:0.5 2 4 6 7 9", "½23|123 G#"], ["15 17 2 4 6 7 9", "-23|123"], ["10 17 6 7", "--- Eb |G# 12-"], ["10 17 7", "--- Eb |G# -2-"], ["0 10 15 17 1:0.75 2 4 6 7 9", "W ¾23|123 G#"], ["10 15 17 2 4 6 7 9", "-23|123 G#"], ["1 2 4 6 7 9", null], ["1 2 4 6 7", null], ["1 15 17 2 4", "123|---"], ["1 2 4 6", null], ["1 12 13 2 4 6 7 9", null], ["1 12 15 17 2 4 5 7 9", "C# 123|-23 F"], ["1 15 17 2 6", "12–|1––"], ["1 2 4", null], ["0 1 12 13 17 2 4 5 7", "C# W 123 Eb |E -2- F"], ["1 15 17 2", "12-|---"], ["1 12 15 17 2 7 9", "12-|-23 F"], ["1 15 4 6 7 9", "1–3 C# |123"], ["1 2 4 5", null], ["1 15 17 2 6 9", "12-|1-3"], ["1 15 17 2 7 9", "12-|-23"], ["1 15 17 2 9", "12-|--3"], ["1 15 17 2 5", "C# 12-|---"], ["1 17 4", "1-3 Eb |---"], ["1 2", null], ["1 17 4 6 7 9", "1-3 Eb |123"], ["1 17 4 7 9", "1-3 Eb |-23"], ["1 2 3", null], ["1 17 4 6 7", "1-3 Eb |12-"], ["1 15 17 4 6 7", "1-3|12-"], ["1 15 17 6 7", "1--|12-"], ["15 17 2 4 6 7 8", "-23|Bb 12-"], ["1", null], ["17 2 4 6 7 8", "-23 Eb |Bb 12-"], ["12 17 2 4 6 7", "-23 Eb |12- F"], ["0 15 17 1:0.5 2 4 6", "W ½23|1--"], ["17 1:0.5 2 4 6", "½23 Eb |1--"], ["0 17 1:0.5 2 4 6", "W ½23 Eb |1--"], ["17 2 6 7 8", "-2- Eb |Bb 12-"], ["1 17 4 6 7 8", "1-3 Eb |Bb 12-"], ["1 15 17 4 6 7 8", "1-3|Bb 12-"], ["12 17 2 6 7", "-2- Eb |12- F"], ["15 17 2 6", "-2-|1--"], ["", null], ["0 12 17 1:0.5 2 4 6", "W ½23 Eb |1-- F"], ["0 12 15 17 1:0.5 2 4 6", "W ½23|1-- F"], ["0 10 17 1:0.5 2 4", "W ½23 Eb |--- G#"], ["0 10 15 17 1:0.5 2 4", "W ½23|--- G#"], ["0 17 1:0.5 2 4", "W ½23 Eb |---"], ["0 15 17 1:0.5 2 4", "W ½23|---"], ["1 11 2 4 6 7 9", null], ["0 17 1:0.75 2 4 9", "W ¾23 Eb |--3"], ["0 17 1:0.5 2 4 9", "W ½23 Eb |--3"], ["0 12 17 1:0.5 2 4 8", "W ½23 Eb |Bb --- F"], ["0 17 1:0.5 2 4 7 8 9", "W ½23 Eb |Bb -23"], ["0 15 17 1:0.5 2 4 9", "W ½23|--3"], ["0 12 15 17 1:0.5 2 4 8", "W ½23|Bb --- F"], ["0 15 17 1:0.5 2 4 7 8 9", "W ½23|Bb -23"], ["0 1 12 17 2 4 5 7", "C# W 123 Eb |-2- F"], ["0 1 12 13 17 2 4 5 6 7", "C# W 123 Eb |E 12- F"], ["1 10 15 17 2 5 6 7 9", "C# 12-|F# 123 G#"]] }, "e-flat-clarinet": { diagram: "clarinet", holes: ["h081", "h093", "h119", "h130", "h139", "h157", "h166", "h168", "h178", "h197", "h211", "h213", "h216", "h235", "h246", "h276", "h291", "h297", "h318", "h340", "h373", "h401", "h432", "h470"], standing: ["h081", "h093", "h119", "h130", "h139", "h168", "h213", "h216", "h246", "h297", "h373", "h432"], keys: { "lh:R": [[], ["h081"], null], "lh:thumb": [["h157", "h166"], [], "h166"], "lh:a": [[], ["h130", "h139"], null], "lh:gis": [[], ["h139"], null], "cc:one": [["h157", "h178"], [], "h178"], "cc:two": [["h197", "h211"], [], "h211"], "lh:ees": [[], ["h213"], null], "cc:three": [["h235"], [], "h235"], "lh:cis": [[], ["h246"], null], "lh:f": [["h401"], [], null], "lh:fis": [["h401"], ["h432"], null], "lh:e": [["h401", "h470"], [], null], "rh:one": [[], ["h093"], null], "rh:two": [[], ["h119"], null], "rh:three": [[], ["h168"], null], "rh:four": [[], ["h216"], null], "cc:four": [["h197", "h276", "h291"], [], "h291"], "cc:five": [["h197", "h276", "h318"], [], "h318"], "rh:b": [[], ["h297"], null], "cc:six": [["h197", "h276", "h340"], [], "h340"], "rh:fis": [["h401"], ["h432"], null], "rh:gis": [[], ["h373"], null], "rh:e": [["h401", "h470"], [], null], "rh:f": [["h401"], [], null] }, switch: {}, charted: [["1 11 16 17 19 4 5 7", "T 123 E |123"], ["1 16 17 19 23 4 5 7", "T 123|123 F"], ["1 10 16 17 19 4 5 7", "T 123 F# |123"], ["1 16 17 19 4 5 7", "T 123|123"], ["1 16 17 19 21 4 5 7", "T 123|123 G#"], ["1 16 17 4 5 7", "T 123|12-"], ["0 1 11 16 17 19 4 5 7", "RT 123 E |123"], ["1 16 4 5 7", "T 123|1--"], ["0 1 16 17 19 23 4 5 7", "RT 123|123 F"], ["1 17 4 5 7", "T 123|-2-"], ["1 16 18 4 5 7", "T 123|1- B -"], ["0 1 10 16 17 19 4 5 7", "RT 123 F# |123"], ["0 1 16 17 19 4 5 7", "RT 123|123"], ["1 4 5 7", "T 123|---"], ["0 1 16 17 19 21 4 5 7 9", "RT 123 F |123 G#"], ["0 1 16 17 19 21 4 5 7", "RT 123|123 G#"], ["1 4 5 7 8", "T 123 C# |---"], ["0 1 16 17 4 5 7", "RT 123|12-"], ["0 1 16 17 22 4 5 7", "RT 123|12- E"], ["1 4 5", "T 12-|---"], ["0 1 16 4 5 7", "RT 123|1--"], ["0 1 16 17 19 23 4 5 7 8", "RT 123 C# |123 F"], ["0 1 17 19 21 4 5 7", "RT 123|-23 G#"], ["1 15 4 5", "T 12-| 4 ---"], ["1 4 5 6", "T 12 Eb -|---"], ["1 16 4", "T 1--|1--"], ["1 17 4", "T 1--|-2-"], ["1 4 7", "T 1-3|---"], ["0 1 16 17 19 21 4 5 7 8", "RT 123 C# |123 G#"], ["0 1 4 5 7", "RT 123|---"], ["0 1 16 17 19 4 5 7 8", "RT 123 C# |123"], ["1 4", "T 1--|---"], ["1 15 19 23 4 6", "T 1- Eb -| 4 --3 F"], ["1 15 16 17 19 23 4 6 8", "T 1- Eb - C# | 4 123 F"], ["0 1 4 5 7 8", "RT 123 C# |---"], ["0 1 16 17 19 4 5", "RT 12-|123"], ["1", "T ---|---"], ["0 1 10 16 19 5 7", "RT -23 F# |1-3"], ["0 1 16 19 5 7", "RT -23|1-3"], ["0 1 16 17 21 5 7", "RT -23|12- G#"], ["4", "1--|---"], ["1 14 15", "T ---| 34 ---"], ["16 17 19 4", "1--| 123"], ["1 14 15 16 17 19", "T ---| 34 123"], ["16 21 4", "Better response than RT 1--|1-- G# ."], ["0 1 16 17 21 5", "RT -2-|12- G#"], ["0 1 10 16 17 21 5", "RT -2- F# |12- G#"], ["16 17 19", "---| 123"], ["", "---|---"], ["5", "-2-|---"], ["0 1 11 16 17 19 2 4 5 7", "RT A123 E |123"], ["3", "G# ---|---"], ["1 14 15 3", "T G# ---| 34 ---"], ["15 16 3 5 7", "G# -23| 4 1--"], ["16 17 19 3", "G# ---| 123"], ["1 14 15 16 17 19 3", "T G# ---| 34 123"], ["1 13 4", "T 1––| 2 –––"], ["0 16 19 20 5 7", "R -23|1-3 F#"], ["0 1 20 3 5 7 8", "RT G# -23 C# |--- F#"], ["0 1 21 3 5 7 8", "RT G# -23 C# |--- G#"], ["2", "A---|---"], ["17 19 2 23", "A---|-23 F"], ["17 19 2 23 5 7", "A-23|-23 F"], ["16 17 19 2", "A---| 123"], ["0 1 2 4 5 7 8", "RT A123 C# |---"], ["0 3", null], ["0 1 14 15 3 5 7 8", "RT G# -23 C# | 34 ---"], ["0 2", "R A---|---"], ["13 2", "A---| 2 ---"], ["0 16 19 2 23 7", "R A--3|1-3 F"], ["0 16 17 19 2", "R A---| 123"], ["13 16 17 19 2", "A---| 2 123"], ["0 17 19 2 4 5 7", "R A123|-23"], ["0 17 19 2 23 5 7", "R A-23|-23 F"], ["0 19 2 23 7", "R A--3|--3 F"], ["0 1 13 14 15 16 20 3 4", "RT G# 1--| 234 1-- F#"], ["0 1 12 21 4 5", "RT 12-| 1 --- G#"], ["0 1 13 14 15 16 23 4", "RT 1--| 234 1-- F"], ["12 2", "A---| 1 ---"], ["0 13 2", "R A---| 2 ---"], ["0 1 11 16 17 19 5 7", null], ["0 1 12 13 7 8", "RT --3 C# | 12 ---"], ["0 12 2", "R A---| 1 ---"], ["0 12 13 2", "R A---| 12 ---"], ["0 1 12 13 19 2 21 4", "RT A1--| 12 --3 G#"], ["0 1 12 13 17 20 3 5 7", "RT G# -23| 12 -2- F#"], ["0 1 16 17 19 23 4 7", "RT 1–3|123 F"], ["0 1 16 17 19 21 3 4 5 7 9", "RT G# 123 F |123 G#"], ["0 1 16 17 19 21 5 7", "RT –23|123 G#"], ["0 1 17 4 5 7", "RT 123|-2-"], ["0 1 16 18 4 5 7", "RT 123|1- B -"], ["0 1 19 4 5 7", "RT 123|--3"], ["0 1 16 19 21 5 7", "RT -23|1-3 G#"], ["0 1 16 20 5 7", "RT -23|1-- F#"], ["0 1 16 17 20 4 5", "RT 12-|12- F#"], ["0 1 17 19 21 5 7", "RT –23|–23 G#"], ["0 1 16 17 4 5", "RT 12-|12-"], ["0 1 16 17 19 21 4", "RT 1--|123 G#"], ["0 1 16 18 21 5 7", "RT -23|1- B - G#"], ["0 1 19 21 5 7", "RT -23|--3 G#"], ["0 1 4 5", "RT 12-|---"], ["0 1 16 17 21 4", "RT 1--|12- G#"], ["0 1 16 23 4", "RT 1--|1-- F"], ["0 1 15 4 5", "RT 12-| 4 ---"], ["0 1 4 5 6", "RT 12 Eb -|---"], ["0 1 16 4", "RT 1--|1--"], ["0 1 17 4", "RT 1--|-2-"], ["0 1 5 7 8", "RT -23 C# |---"], ["0 1 4 7", "RT 1-3|---"], ["0 1 17 19 23 4", "RT 1--|-23 F"], ["0 1 17 21 5", "RT -2-|-2- G#"], ["0 1 16 17 19 23 5 7 8", "RT -23 C# |123 F"], ["0 1 4", "RT 1--|---"], ["0 1 10 16 17 19 5 7", "RT –23 F# |123"], ["0 1 15 4", "RT 1--| 4 ---"], ["0 1 15 21 5", "RT -2-| 4 --- G#"], ["0 1 15 18 5", "RT -2-| 4 -- B -"], ["0 1", "RT ---|---"], ["0 1 15 16 17 19 7", "RT --3| 4 123"], ["0 1 16 17 19", "RT –––|123"], ["0 1 14 15 4 5 6", "RT 12 Eb –| 34 –––"], ["0 1 16 17 19 5 7", "RT –23|123"], ["0 1 15 21", "RT ---| 4 --- G#"], ["0 1 21", "RT ---|--- G#"], ["0 1 16 17 5 7", "RT -23|12-"], ["0 1 14 15", "RT ---| 34 ---"], ["0 1 16 17 21 3 4 5 7", "RT G# 123|12- G#"], ["0 16 17 19 21 4 5 7", "R 123|123 G#"], ["0 1 14 15 7", "RT --3| 34 ---"], ["0 1 14 21 8", "RT ––– C# | 3 -–– G#"], ["0 1 16 21 5 7", "RT -23|1-- G#"], ["0 1 15 3", "RT G# ---| 4 ---"], ["0 1 3", "RT G# ---|---"], ["0 1 13", "RT ---| 2 ---"], ["0 1 16 17 3 5 7", "RT G# -23|12-"], ["0 16 19 21 4 5 7", "R 123|1-3 G#"], ["0", null], ["0 16 17 20", "R ---|12- F#"], ["0 1 17 21 5 7", "RT -23|-2- G#"], ["0 1 2 21", "RT A---|--- G#"], ["0 17 21 4 5 7", "R 123|-2- G#"], ["0 1 21 5 7", "RT -23|--- G#"], ["0 1 3 5 7", "RT G# -23|---"], ["0 21 4 5 7", "R 123|--- G#"], ["0 1 21 5 7 8", "RT -23 C# |--- G#"], ["0 1 13 21 4 5 7 8", "RT 123 C# | 2 --- G#"], ["0 1 21 5", "RT -2-|--- G#"], ["0 1 15 21 4 5", "RT 12-| 4 --- G#"], ["0 1 16 17 19 21 4 5", "RT 12-|123 G#"], ["0 1 17 20 5", "RT -2-|-2- F#"], ["0 1 18 21 5", "RT –2–|–– B – G#"], ["0 1 14 21 5 7 8", "RT –23 C# | 3 -–– G#"], ["0 1 20 7 8", "RT --3 C# |--- F#"], ["0 1 16 21 4", "RT 1--|1-- G#"], ["0 1 16 20 4", "RT 1--|1-- F#"], ["0 1 21 4", "RT 1--|--- G#"], ["0 1 16 17 21 5 7 8", "RT -23 C# |12- G#"], ["0 1 16 17 19 23 5 7", "RT -23|123 F"], ["0 1 16 19 21 5", "RT -2-|1-3 G#"], ["0 1 21 5 6", "RT -2 Eb -|--- G#"], ["0 1 21 7 8", "RT --3 C# |--- G#"], ["0 1 14 21 5 8", "RT –2– C# | 3 -–– G#"]] }, "english-horn": { diagram: "oboe", holes: ["h_octave-2", "h_octave", "h_trill-D", "h_trill-C_sharp", "h_C_sharp5", "h_C5", "h_B4", "h_A_sharp4", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_fork-F", "h_F4", "h_E4", "h_F-resonance", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_A_sharp4", "h_C5", "h_C_sharp4", "h_D_sharp4", "h_F-resonance", "h_F4", "h_G_sharp4", "h_octave", "h_octave-2", "h_trill-C_sharp", "h_trill-D"], keys: { "lh:II": [["h_octave"], ["h_octave-2"], null], "lh:I": [[], ["h_octave"], null], "lh:d": [[], ["h_trill-D"], null], "rh:d": [[], ["h_trill-D"], null], "lh:cis": [[], ["h_trill-C_sharp"], null], "lh:b": [["h_C5"], [], null], "cc:one": [["h_C_sharp5"], [], "h_C_sharp5"], "cc:two": [["h_B4", "h_C5"], [], "h_B4"], "cc:three": [["h_A4", "h_A_sharp4", "h_C5"], [], "h_A4"], "lh:gis": [["h_B4", "h_C5"], ["h_G_sharp4"], null], "rh:gis": [["h_B4", "h_C5"], ["h_G_sharp4"], null], "rh:a": [["h_A4", "h_A_sharp4", "h_C5"], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_G_sharp4"], ["h_A_sharp4", "h_C5"], "h_G4"], "cc:five": [["h_fork-F", "h_F_sharp4", "h_F-resonance"], [], "h_fork-F"], "cc:six": [["h_E4", "h_F_sharp4"], ["h_F-resonance"], "h_E4"], "rh:f": [[], ["h_F4"], null], "lh:f": [[], ["h_F4"], null], "rh:ees": [[], ["h_D_sharp4"], null], "lh:ees": [["h_E4"], ["h_D_sharp4"], null], "rh:c": [["h_D4"], [], null], "rh:banana": [["h_D4"], [], null], "rh:cis": [["h_D4", "h_fork-F", "h_F_sharp4", "h_D_sharp4", "h_E4"], ["h_C_sharp4"], null], "lh:low-b": [["h_C4", "h_C_sharp4", "h_D4"], [], null], "lh:bes": [["h_B3", "h_C4", "h_C_sharp4", "h_D4"], [], null] }, switch: {}, charted: [["12 13 14 19 6 7 8", "123 Bb |123 C"], ["12 13 14 19 23 6 7 8", null], ["12 13 14 19 22 6 7 8", null], ["1 12 13 14 19 23 6 7 8", null], ["12 13 14 21 6 7 8", "123|123 C#"], ["1 12 13 14 19 22 6 7 8", null], ["12 13 14 6 7 8", "123|123"], ["1 12 13 14 19 6 7 8", null], ["12 13 14 17 6 7 8", "123|123 Eb"], ["1 12 13 14 21 6 7 8", null], ["12 13 6 7 8", "123|12-"], ["1 12 13 14 6 7 8", null], ["12 14 6 7 8", "123|1-3"], ["12 14 17 6 7 8", "123|1-3 Eb"], ["12 13 15 6 7 8", null], ["1 12 13 14 17 6 7 8", null], ["12 6 7 8", "123|1--"], ["1 12 13 6 7 8", null], ["6 7 8", "123|---"], ["1 12 13 15 6 7 8", null], ["6 7 8 9", "123 G# |---"], ["12 13 14 19 6:0.5 7 8", "023|123 C"], ["1 12 6 7 8", null], ["12 13 14 19 6 8", "1-3 Bb |123 C"], ["6 7", "12-|---"], ["12 13 14 21 6:0.5 7 8", "023|123 C#"], ["12 13 14 21 6 8", "1-3|123 C#"], ["12 6 7", "12-|1--"], ["6 8 9", "1-3 G# |---"], ["12 13 14 6 7", "12-|123"], ["12 13 14 21 6 7", "12-|123 C#"], ["12 13 14 17 6 7", "12-|123 Eb"], ["12 19 6 7", "I 12-|1-- C"], ["12 14 6 7", "I 12-|1-3"], ["12 13 14 6:0.5 7 8", "023|123"], ["6", "1--|---"], ["12 13 14 19 6 7", "12- B |123 C"], ["12 14 21 6:0.5 7 8", "023|1-3 C#"], ["12 13 14 17 6:0.5 7 8", "023|123 Eb"], ["12 13 19 7 8", "-23|12- C"], ["12 6", "1--|1--"], ["7", "-2-|---"], ["12 13 14 6", "1--|123"], ["12 13 14 21 6", "1--|123 C#"], ["12 13 14 17 6", "1--|123 Eb"], ["12 13 14 19 6 7:0.5 8 9", "103 G# |123 C"], ["12 19 6", null], ["19 7 8", "-23|--- C"], ["7 8", "-23|---"], ["12 13 14 21 7 8", "-23|123 C#"], ["12", "---|1--"], ["13 14 17 8", null], ["13 14 8", null], ["12 13 14 7 8", "-23|123"], ["12 13 7 8", "-23|12-"], ["1 6 7 8", null], ["1 6 7 8 9", null], ["1 6 7", null], ["13 17 19 6:0.5 7 8", "023 Eb |-2- C"], ["1 12 6 7", null], ["6:0.5 7 8", "I 023|---"], ["14 19 6 8", null], ["1 6", null], ["6:0.5 7", "I 02-|---"], ["12 19 7 8", "-23|1-- C"], ["12 6:0.5 7 8", "023|1--"], ["1 12 6", null], ["12 13 6:0.5 7", null], ["19 6:0.5 7 8", "023|-–- C"], ["13 19 6:0.5 7 8", "023|-2- C"], ["14 21 6:0.5 7 8", "023|--3 C#"], ["13 19 7 8", "-23|-2- C"], ["13 14 6:0.5 7 8", "023 B |-23"], ["13 14 17 6:0.5 7 8", "023|-23 Eb"], ["19 6:0.5 7 8 9", "023 G# |--- C"], ["6:0.5 7 8 9", "023| G# ---"], ["13 19 6:0.5 7 8 9", "023| G# -2- C"], ["13 19 7 8 9", "-23| G# -2- C"], ["13 17 19 6:0.5 7 8 9", "023 G# Eb |-2- C"], ["13 14 17 6:0.5 7 8 9", "I 023 G# Eb |-23"], ["13 14 17 6:0.5 7 9", "I 02- G# Eb |-23"], ["6:0.5 7 9", "I 02- G# |---"], ["12 19 6:0.5 7", "I 02-|1-- C"], ["12 17 6:0.5 9", "I 0-- G# Eb |1--"], ["12 14 6:0.5 7", "I 02-|1-3"], ["12 6 8", "I 1-3|1--"], ["12 17 19 6:0.5 9", "I 0-- G# Eb |1-- C"], ["12 6:0.5 7", "I 02-|1--"]] }, flute: { diagram: "flute", holes: ["h_C_sharp5", "h_C5", "h_B4", "h_A_sharp4", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4"], standing: ["h_D_sharp4", "h_G_sharp4"], keys: { "cc:one": [["h_C_sharp5"], [], "h_C_sharp5"], "lh:b": [["h_C5"], [], null], "lh:bes": [["h_C5", "h_B4"], [], null], "cc:two": [["h_B4", "h_A_sharp4"], [], "h_A_sharp4"], "cc:three": [["h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4"], [], "h_E4"], "rh:bes": [["h_B4"], [], null], "rh:d": [[], ["h_trill-1"], null], "rh:dis": [[], ["h_trill-2"], null], "rh:ees": [[], ["h_D_sharp4"], null], "rh:cis": [["h_D4"], [], null], "rh:c": [["h_D4", "h_C_sharp4"], [], null], "rh:b": [["h_D4", "h_C_sharp4", "h_C4"], [], null], "rh:gz": [["h_C4"], [], null] }, switch: {}, charted: [["0 1 15 3 4 6 7 8", "T 123|123 B"], ["0 1 14 3 4 6 7 8", "T 123|123 C"], ["0 1 13 3 4 6 7 8", "T 123|123 C#"], ["0 1 3 4 6 7 8", "T 123|123"], ["0 1 12 3 4 6 7 8", "T 123|123 Eb"], ["0 1 12 3 4 6 7", "T 123|12- Eb"], ["0 1 12 3 4 6", "T 123|1-- Eb"], ["0 1 12 3 4 8", "T 123|--3 Eb"], ["0 1 12 3 4", "T 123|--- Eb"], ["0 1 16 3 4 5 6 7 8", "T 123 G# |123 ß"], ["0 1 12 3 4 5", "T 123 G# |--- Eb"], ["0 1 12 3", "T 12-|--- Eb"], ["0 1 12 15 4 6 8", "T 1-3|1-3 Eb B"], ["0 12 2", "Bb 1--|--- Eb"], ["0 1 12", "B 1--|--- Eb"], ["0 16 3 4 5 6 7 8", "123 G# |123 ß"], ["0 16 3 4 5 6 7", "123 G# |12- ß"], ["0 16 3 4 5 6 8", "123 G# |1-3 ß"], ["0 12", "1--|--- Eb"], ["1 15 3 4 5 7 8", "T -23 G# |-23 B"], ["15 2 8", "Bb ---|--3 B"], ["12", "---|--- Eb"], ["16 3 6", "-2-|1-- ß"], ["0 10 15 2 6", "Bb 1––|1 D –– B"], ["0 11 15 2 4", "Bb 1–3|–– D# – B"], ["1 10 15 3 4 5 7", "T -23 G# |- D 2- B"], ["1 10 15 3 4 5 7 8", "T -23 G# |- D 23 B"], ["1 11 12 15 4 6 8", "T --3|1- D# 3 Eb B"], ["1 10 15 3 4 5 6:0.5 7 8", null], ["0 16 3 4 5 6", "123 G# |1-- ß"]] }, oboe: { diagram: "oboe", holes: ["h_octave-2", "h_octave", "h_trill-D", "h_trill-C_sharp", "h_C_sharp5", "h_C5", "h_B4", "h_A_sharp4", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_fork-F", "h_F4", "h_E4", "h_F-resonance", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_A_sharp4", "h_C5", "h_C_sharp4", "h_D_sharp4", "h_F-resonance", "h_F4", "h_G_sharp4", "h_octave", "h_octave-2", "h_trill-C_sharp", "h_trill-D"], keys: { "lh:II": [["h_octave"], ["h_octave-2"], null], "lh:I": [[], ["h_octave"], null], "lh:d": [[], ["h_trill-D"], null], "rh:d": [[], ["h_trill-D"], null], "lh:cis": [[], ["h_trill-C_sharp"], null], "lh:b": [["h_C5"], [], null], "cc:one": [["h_C_sharp5"], [], "h_C_sharp5"], "cc:two": [["h_B4", "h_C5"], [], "h_B4"], "cc:three": [["h_A4", "h_A_sharp4", "h_C5"], [], "h_A4"], "lh:gis": [["h_B4", "h_C5"], ["h_G_sharp4"], null], "rh:gis": [["h_B4", "h_C5"], ["h_G_sharp4"], null], "rh:a": [["h_A4", "h_A_sharp4", "h_C5"], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_G_sharp4"], ["h_A_sharp4", "h_C5"], "h_G4"], "cc:five": [["h_fork-F", "h_F_sharp4", "h_F-resonance"], [], "h_fork-F"], "cc:six": [["h_E4", "h_F_sharp4"], ["h_F-resonance"], "h_E4"], "rh:f": [[], ["h_F4"], null], "lh:f": [[], ["h_F4"], null], "rh:ees": [[], ["h_D_sharp4"], null], "lh:ees": [["h_E4"], ["h_D_sharp4"], null], "rh:c": [["h_D4"], [], null], "rh:banana": [["h_D4"], [], null], "rh:cis": [["h_D4", "h_fork-F", "h_F_sharp4", "h_D_sharp4", "h_E4"], ["h_C_sharp4"], null], "lh:low-b": [["h_C4", "h_C_sharp4", "h_D4"], [], null], "lh:bes": [["h_B3", "h_C4", "h_C_sharp4", "h_D4"], [], null] }, switch: {}, charted: [["12 13 14 19 6 7 8", "123 Bb |123 C"], ["12 13 14 19 23 6 7 8", null], ["1 12 13 14 19 23 6 7 8", null], ["12 13 14 19 22 6 7 8", null], ["1 12 13 14 19 22 6 7 8", null], ["1 12 13 14 19 6 7 8", null], ["12 13 14 21 6 7 8", "123|123 C#"], ["1 12 13 14 21 6 7 8", null], ["12 13 14 6 7 8", "123|123"], ["1 12 13 14 6 7 8", null], ["12 13 14 17 6 7 8", "123|123 Eb"], ["1 12 13 14 17 6 7 8", null], ["12 13 6 7 8", "123|12-"], ["1 12 13 6 7 8", null], ["12 14 6 7 8", "123|1-3"], ["12 14 17 6 7 8", "123|1-3 Eb"], ["12 13 15 6 7 8", null], ["1 12 13 15 6 7 8", null], ["12 6 7 8", "123|1--"], ["1 12 6 7 8", null], ["6 7 8", "123|---"], ["1 6 7 8", null], ["6 7 8 9", "123 G# |---"], ["12 13 14 19 6:0.5 7 8", "023|123 C"], ["1 6 7 8 9", null], ["6 7", "12-|---"], ["12 13 14 21 6:0.5 7 8", "023|123 C#"], ["12 13 14 19 6 8", "1-3 Bb |123 C"], ["12 13 14 21 7 8", "-23|123 C#"], ["12 6 7", "12-|1--"], ["6 8 9", "1-3 G# |---"], ["12 13 14 6 7", "12-|123"], ["12 13 14 21 6 7", "12-|123 C#"], ["12 13 14 17 6 7", "12-|123 Eb"], ["12 13 14 19 6 7", "12- B |123 C"], ["12 13 14 21 6 8", "1-3|123 C#"], ["12 14 6 7", "I 12-|1-3"], ["6", "1--|---"], ["13 14 6 8", "I 1-3 B |-23"], ["14 19 6 8", "I 1-3|--3 C"], ["12 6 8", "I 1-3|1--"], ["12 6", "1--|1--"], ["7", "-2-|---"], ["12 13 14 6", "1--|123"], ["12 13 14 21 6", "1--|123 C#"], ["12 13 14 17 6", "1--|123 Eb"], ["12 13 14 19 6 7:0.5 8 9", "103 G# |123 C"], ["12 13 7 8", "-23|12-"], ["12 13 19 7 8", "-23|12- C"], ["12 6:0.5 7 8", "023|1--"], ["12", "---|1--"], ["12 17 6:0.5 9", "I 0-- G# Eb |1--"], ["12 17 19 6:0.5 9", "I 0-- G# Eb |1-- C"], ["12 6:0.5 7", "I 02-|1--"], ["12 13 14 6:0.5 7 8", "023|123"], ["12 13 14 7 8", "-23|123"], ["12 13 14 17 6:0.5 7 8", "023|123 Eb"], ["12 14 21 6:0.5 7 8", "023|1-3 C#"], ["1 6 7", null], ["1 12 6 7", null], ["12 19 6 7", "I 12-|1-- C"], ["1 6", null], ["13 14 17 6:0.5 7 8 9", "I 023 G# Eb |-23"], ["13 14 6:0.5 8", "I 0-3 B |-23"], ["13 17 19 6:0.5 7 8", "023 Eb |-2- C"], ["12 19 7 8", "-23|1-- C"], ["19 6:0.5 7 8", "023|-–- C"], ["13 19 6:0.5 7 8", "023|-2- C"], ["14 21 6:0.5 7 8", "023|--3 C#"], ["7 8", "-23|---"], ["19 7 8", "-23|--- C"], ["13 19 7 8", "-23|-2- C"], ["13 17 7 8 9", null], ["13 14 6:0.5 7 8", "023 B |-23"], ["13 14 17 6:0.5 7 8", "023|-23 Eb"], ["19 6:0.5 7 8 9", "023 G# |--- C"], ["6:0.5 7 8 9", "023| G# ---"], ["13 19 6:0.5 7 8 9", "023| G# -2- C"], ["13 19 7 8 9", "-23| G# -2- C"], ["13 17 19 6:0.5 7 8 9", "023 G# Eb |-2- C"], ["6:0.5 7 8", "I 023|---"], ["6:0.5 7", "I 02-|---"], ["6:0.5 7 9", "I 02- G# |---"], ["13 17 7 9", null], ["13 14 17 6:0.5 7 9", "I 02- G# Eb |-23"], ["12 13 6:0.5 7", null], ["12 14 6:0.5 7", "I 02-|1-3"], ["12 19 6:0.5 7", "I 02-|1-- C"], ["12 19 6", "I 1--|1-- C"], ["14 17 6:0.5 8 9", "I 0-3 G# |--3 Eb"], ["13 6:0.5 8", "I 0-3|-2-"], ["13 14 8", "I --3|-23"], ["13 14 17 8", "I --3 B |-23 Eb"], ["14 6:0.5 8 9", "I 0-3 B | G# --3"], ["13 14 17 6:0.5 8 9", "I 0-3 B | G# -23 Eb"], ["13 7 8", "I -23|-2-"]] }, piccolo: { diagram: "flute", holes: ["h_C_sharp5", "h_C5", "h_B4", "h_A_sharp4", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_F4", "h_E4", "h_D_sharp4"], standing: ["h_D_sharp4", "h_G_sharp4"], keys: { "cc:one": [["h_C_sharp5"], [], "h_C_sharp5"], "lh:b": [["h_C5"], [], null], "lh:bes": [["h_C5", "h_B4"], [], null], "cc:two": [["h_B4", "h_A_sharp4"], [], "h_A_sharp4"], "cc:three": [["h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4"], [], "h_E4"], "rh:bes": [["h_B4"], [], null], "rh:d": [[], ["h_trill-1"], null], "rh:dis": [[], ["h_trill-2"], null], "rh:ees": [[], ["h_D_sharp4"], null], "rh:cis": [[], [], null], "rh:c": [[], [], null], "rh:b": [[], [], null], "rh:gz": [[], [], null] }, switch: {}, charted: [["0 1 3 4 6 7 8", "T 123|123"], ["0 1 12 3 4 6 7", "T 123|12- Eb"], ["0 1 12 3 4 6 7 8", "T 123|123 Eb"], ["0 1 12 3 4 6", "T 123|1-- Eb"], ["0 1 12 3 4 7", "T 123|-2- Eb"], ["0 1 12 3 4 8", "T 123|--3 Eb"], ["0 1 12 3 4", "T 123|--- Eb"], ["0 1 12 3 4 5 6 7 8", "T 123 G# |123 Eb"], ["0 1 12 3 4 5", "T 123 G# |--- Eb"], ["0 1 3 6 7", "T 12-|12-"], ["0 1 12 3 6 7", "T 12-|12- Eb"], ["0 1 12 3", "T 12-|--- Eb"], ["1 3 4 6 7 8", "T -23|123"], ["0 3 4 6 7 8", "123|123"], ["0 1 12 4 6 8", "T 1-3|1-3 Eb"], ["0 1 12 3 5 6", "T 12- G# |1-- Eb"], ["1 12 3 4 6 7 8", "T -23|123 Eb"], ["0 3 4 6 8", "123|1–3"], ["0 12 3 4", "123|--- Eb"], ["0 12 2", "Bb 1--|--- Eb"], ["0 1 12 6", "T 1--|1-- Eb"], ["1 12 3 4 7 8", "T -23|-23 Eb"], ["1 12 3 4 7", "T -23|-2- Eb"], ["1 12 3 4", "T -23|--- Eb"], ["0 1 12", "B 1--|--- Eb"], ["1 4 6 7", null], ["1 12 4 6 7", null], ["12 2 8", null], ["0 12", "1--|--- Eb"], ["12", "---|--- Eb"], ["12 6 7 8", "---|123 Eb"], ["1 12 3 4 5 6", "T -23 G# |1-- Eb"], ["0 1 4 7 8", "T 1–3|–23"], ["0 1 12 4 7 8", "T 1-3|-23 Eb"], ["0 1 12 8", "B 1--|--3 Eb"], ["3 4 5 6", null], ["0 12 8", "1--|--3 Eb"], ["3 5 6", null], ["12 3 5 6 8", null], ["12 3 4 7 8", "-23|-23 Eb"], ["1 3 6 8", "T -2-|1-3"], ["1 12 3 4 5 7", "T -23 G# |-2- Eb"], ["0 3 4 5 6 7", "123 G# |12-"], ["0 1 12 4 6", "T 1-3|1-- Eb"], ["0 1 12 4 8", "T 1–3|––3 Eb"], ["0 1 12 4 7", "T 1-3|-2- Eb"], ["0 1 4 8", "T 1-3|--3"], ["0 3 4 5 6", "123 G# |1--"], ["12 3 4 5 7 8", "-23 G# |-23 Eb"], ["12 3 4 5", "-23 G# |--- Eb"], ["1 12 3 6", "T -2-|1-- Eb"], ["1 3 6", "T -2-|1--"]] }, "soprano-saxophone": { diagram: "saxophone", holes: ["h_octave-high", "h_octave-low", "h_F_sharp5", "h_F5", "h_E5", "h_D_sharp5", "h_D5", "h_C_sharp5", "h_C5", "h_side-C", "h_B4", "h_A_sharp4", "h_side-A_sharp", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_side-F_sharp", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_C_sharp4", "h_D5", "h_D_sharp4", "h_D_sharp5", "h_E5", "h_F5", "h_F_sharp5", "h_G_sharp4", "h_octave-high", "h_octave-low", "h_side-A_sharp", "h_side-C", "h_side-F_sharp"], keys: { "lh:T": [[], [], null], "cc:one": [["h_C_sharp5", "h_C5"], [], "h_C5"], "cc:two": [["h_C_sharp5", "h_B4", "h_A_sharp4"], [], "h_B4"], "lh:bes": [["h_B4"], [], null], "cc:three": [["h_C_sharp5", "h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4", "h_G_sharp4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4", "h_B4", "h_G_sharp4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4", "h_B4", "h_G_sharp4"], [], "h_E4"], "rh:ees": [[], ["h_D_sharp4"], null], "rh:low-c": [["h_D4"], [], null], "lh:cis": [["h_D4"], ["h_C_sharp4"], null], "lh:b": [["h_D4", "h_C4"], [], null], "lh:low-bes": [["h_D4", "h_C4", "h_B3"], [], null], "lh:d": [[], ["h_D5"], null], "lh:ees": [[], ["h_D_sharp5"], null], "rh:e": [[], ["h_E5"], null], "lh:f": [[], ["h_F5"], null], "lh:front-f": [[], ["h_F5"], null], "rh:high-fis": [[], ["h_F_sharp5"], null], "rh:c": [[], ["h_side-C"], null], "rh:bes": [[], ["h_side-A_sharp"], null], "rh:fis": [[], ["h_side-F_sharp"], null] }, switch: { "lh:T": ["cc:three", "h_octave-low", "h_octave-high"] }, charted: [["1 10 13 2 4 6 7 8", "123 Bb |123 C"], ["1 10 12 2 4 6 7 8", "123 B |123 C"], ["1 13 2 4 6 7 8", null], ["1 10 2 4 6 7 8", "123|123 C"], ["1 12 2 4 6 7 8", null], ["0 1 13 2 4 6 7 8", "T 123 Bb |123"], ["1 10 11 2 4 6 7 8", "123 C# |123 C"], ["0 1 12 2 4 6 7 8", "T 123 B |123"], ["1 2 4 6 7 8", "123|123"], ["0 1 10 2 4 6 7 8", "T 123|123 C"], ["1 11 2 4 6 7 8", null], ["1 2 4 6 7 8 9", "123|123 Eb"], ["0 1 11 2 4 6 7 8", null], ["1 2 4 6 7", "123|12–"], ["0 1 2 4 6 7 8", "T 123|123"], ["0 1 2 4 6 7 8 9", "T 123|123 Eb"], ["1 2 4 6", "123|1––"], ["0 1 2 4 6 7", "T 123|12–"], ["1 2 4 7", "123|–2–"], ["1 10 13 2 4 7 8", "123 Bb |–23 C"], ["1 2 4", "123|–––"], ["1 13 2 4", "123 Bb |–––"], ["1 12 2 4", "123 B |–––"], ["1 11 2 4", "123 C# |–––"], ["1 2 4 5", "123 G# |–––"], ["0 1 13 2 4", "T 123 Bb |–––"], ["0 1 12 2 4", "T 123 B |–––"], ["0 1 11 2 4", "T 123 C# |–––"], ["1 2", "12–|–––"], ["0 1 2 4 5", "T 123 G# |–––"], ["1 6", "1––|1––"], ["1 7", "1––|–2–"], ["1 3", "1 Bb ––|–––"], ["1 8", "1––|––3"], ["1 4", "1–3|–––"], ["0 1 4 6 8", null], ["0 1 11 4 6 8", null], ["0 1 4 6 8 9", null], ["1", "1––|–––"], ["0 1 4", "T 1–3|–––"], ["2 4", null], ["2", "–2–|–––"], ["2 4 5", "–23 G# |–––"], ["6 7 8", "–––|123"], ["6 7 8 9", "–––|123 Eb"], ["6 7", "–––|12–"], ["0 1 10 11 2 4 6 7 8", "T 123 C# |123 C"], ["0 4 6 7 8", "T ––3|123"], ["0 4", "T ––3|–––"], ["0 4 5", "T ––3 G# |–––"], ["6", "–––|1––"], ["7", "–––|–2–"], ["0 6 7 8", "T –––|123"], ["0 6 8", null], ["0 6 8 9", null], ["0 2 4 6 7 8", null], ["0 1 2 4 6", "T 123|1––"], ["0 1 2 4 7", "T 123|–2–"], ["0 1 2 4 8", "T 123|––3"], ["0 1 2 4", "T 123|–––"], ["0 1 4 6 7", null], ["0 1 2 6", null], ["0 1 13 2 6 7", null], ["0 1 2 7", "T 12–|–2–"], ["0 1 2", "T 12–|–––"], ["0 1 4 8 9", null], ["0 1 6 7", null], ["0 1 4 8", null], ["0 1 3", "T 1 Bb ––|–––"], ["0 1 6", "T 1––|1––"], ["0 1 7", "T 1––|–2–"], ["0 1 8", "T 1––|––3"], ["0 1", "T 1––|–––"], ["0 2 4 7", null], ["0 2", "T –2–|–––"], ["0 2 4 5", "T –23 G# |–––"], ["0 2 7 9", null], ["0 2 7", null], ["0 2 4 6 7 8 9", null], ["0", "T –––|–––"], ["0 4 6", null]] }, "tenor-saxophone": { diagram: "saxophone", holes: ["h_octave-high", "h_octave-low", "h_F_sharp5", "h_F5", "h_E5", "h_D_sharp5", "h_D5", "h_C_sharp5", "h_C5", "h_side-C", "h_B4", "h_A_sharp4", "h_side-A_sharp", "h_A4", "h_G_sharp4", "h_G4", "h_F_sharp4", "h_side-F_sharp", "h_F4", "h_E4", "h_D_sharp4", "h_D4", "h_C_sharp4", "h_C4", "h_B3"], standing: ["h_C_sharp4", "h_D5", "h_D_sharp4", "h_D_sharp5", "h_E5", "h_F5", "h_F_sharp5", "h_G_sharp4", "h_octave-high", "h_octave-low", "h_side-A_sharp", "h_side-C", "h_side-F_sharp"], keys: { "lh:T": [[], [], null], "cc:one": [["h_C_sharp5", "h_C5"], [], "h_C5"], "cc:two": [["h_C_sharp5", "h_B4", "h_A_sharp4"], [], "h_B4"], "lh:bes": [["h_B4"], [], null], "cc:three": [["h_C_sharp5", "h_A4"], [], "h_A4"], "lh:gis": [[], ["h_G_sharp4"], null], "cc:four": [["h_G4", "h_F_sharp4", "h_B4", "h_G_sharp4"], [], "h_F_sharp4"], "cc:five": [["h_G4", "h_F4", "h_B4", "h_G_sharp4"], [], "h_F4"], "cc:six": [["h_G4", "h_E4", "h_B4", "h_G_sharp4"], [], "h_E4"], "rh:ees": [[], ["h_D_sharp4"], null], "rh:low-c": [["h_D4"], [], null], "lh:cis": [["h_D4"], ["h_C_sharp4"], null], "lh:b": [["h_D4", "h_C4"], [], null], "lh:low-bes": [["h_D4", "h_C4", "h_B3"], [], null], "lh:d": [[], ["h_D5"], null], "lh:ees": [[], ["h_D_sharp5"], null], "rh:e": [[], ["h_E5"], null], "lh:f": [[], ["h_F5"], null], "lh:front-f": [[], ["h_F5"], null], "rh:high-fis": [[], ["h_F_sharp5"], null], "rh:c": [[], ["h_side-C"], null], "rh:bes": [[], ["h_side-A_sharp"], null], "rh:fis": [[], ["h_side-F_sharp"], null] }, switch: { "lh:T": ["cc:three", "h_octave-low", "h_octave-high"] }, charted: [["1 10 13 2 4 6 7 8", "123 Bb |123 C"], ["1 12 2 4 6 7 8", null], ["0 1 13 2 4 6 7 8", "T 123 Bb |123"], ["1 10 12 2 4 6 7 8", "123 B |123 C"], ["1 10 2 4 6 7 8", "123|123 C"], ["0 1 12 2 4 6 7 8", "T 123 B |123"], ["1 11 2 4 6 7 8", null], ["0 1 10 2 4 6 7 8", "T 123|123 C"], ["1 10 11 2 4 6 7 8", "123 C# |123 C"], ["0 1 11 2 4 6 7 8", null], ["1 2 4 6 7 8", "123|123"], ["0 1 2 4 6 7 8", "T 123|123"], ["1 2 4 6 7 8 9", "123|123 Eb"], ["0 1 2 4 6 7 8 9", "T 123|123 Eb"], ["1 2 4 6 7", "123|12–"], ["0 1 2 4 6 7", "T 123|12–"], ["1 2 4 6", "123|1––"], ["1 10 13 2 4 7 8", "123 Bb |–23 C"], ["1 2 4 7", "123|–2–"], ["0 1 2 4 7", "T 123|–2–"], ["1 13 2 4", "123 Bb |–––"], ["1 12 2 4", "123 B |–––"], ["1 2 4", "123|–––"], ["1 11 2 4", "123 C# |–––"], ["1 2 4 5", "123 G# |–––"], ["0 1 2 4 5", "T 123 G# |–––"], ["1 2", "12–|–––"], ["0 1 2 4", "T 123|–––"], ["1 6", "1––|1––"], ["1 7", "1––|–2–"], ["1 8", "1––|––3"], ["1 3", "1 Bb ––|–––"], ["1 4", "1–3|–––"], ["1 13 2 4 6 7 8", null], ["1", "1––|–––"], ["0 10 2 4 6 7 8", null], ["2 4", null], ["2 4 5", "–23 G# |–––"], ["2", "–2–|–––"], ["6 7 8", "–––|123"], ["6 7 8 9", "–––|123 Eb"], ["6 7", "–––|12–"], ["0 1 10 11 2 4 6 7 8", "T 123 C# |123 C"], ["0 4 6 7 8", "T ––3|123"], ["0 4", "T ––3|–––"], ["0 4 5", "T ––3 G# |–––"], ["6", "–––|1––"], ["7", "–––|–2–"], ["0 2 6 7", null], ["0 2 6 7 9", null], ["0 2 6", null], ["0", "T –––|–––"], ["0 6 8 9", null], ["0 6 8", null], ["0 1 2 4 6", "T 123|1––"], ["0 1 2 4 8", "T 123|––3"], ["0 1 12 2 4", "T 123 B |–––"], ["0 1 11 2 4", "T 123 C# |–––"], ["0 1 11 4 6 8", null], ["0 1 13 2 4", "T 123 Bb |–––"], ["0 1 2 7", "T 12–|–2–"], ["0 1 4 6 8 9", null], ["0 1 2 6", null], ["0 1 2", "T 12–|–––"], ["0 1 6 7 9", null], ["0 1 6 7", null], ["0 1 6", "T 1––|1––"], ["0 1 3", "T 1 Bb ––|–––"], ["0 1 7", "T 1––|–2–"], ["0 1 8", "T 1––|––3"], ["0 1 4", "T 1–3|–––"], ["0 1", "T 1––|–––"], ["0 2 4 7", null], ["0 2 4", null], ["0 2", "T –2–|–––"], ["0 2 4 5", "T –23 G# |–––"], ["0 2 4 6", null], ["0 6 7 8", "T –––|123"], ["0 1 4 8 9", null], ["0 1 2 6 7 9", null]] } } };

// public/shared/performers/fingering-diagrams.js
var PARTS = Object.freeze(["R", "1q", "1h", "3q"]);
var PART_COVERED = [[0, "R"], [0.25, "1q"], [0.5, "1h"], [0.75, "3q"]];
var elementKey = ([x2, y2, mark]) => `${x2},${y2}|${mark}`;
var keyId = (keys3) => ["cc", "lh", "rh"].map((g) => `${g}:${[...keys3[g] ?? []].sort().join(",")}`).join("|");
function twinFilled(marks) {
  const filled = new Set(marks.filter((m) => m[2].includes('fill="currentColor"')).map((m) => elementKey([m[0], m[1], m[2].replace('fill="currentColor"', 'fill="none"')])));
  const seen = /* @__PURE__ */ new Set();
  return marks.filter((m) => {
    const k = elementKey(m);
    if (seen.has(k) || filled.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function composeDiagram(entry, keys3) {
  const whole = entry.whole?.[keyId(keys3)];
  if (whole) return { marks: twinFilled(whole), box: entry.box };
  const drop = /* @__PURE__ */ new Set(), add = [], ids = [];
  for (const g of ["cc", "lh", "rh"]) for (const name2 of keys3[g] ?? []) {
    const piece = entry.keys[`${g}:${name2}`];
    if (!piece) continue;
    ids.push(`${g}:${name2}`);
    for (const i of piece.drop) drop.add(i);
    add.push(...piece.add);
  }
  let marks = twinFilled([...entry.base.filter((m, i) => !drop.has(i)), ...add]);
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => entry.pairs?.[[a, b].sort().join("+")])).filter(Boolean);
  if (pairs.length) {
    const gone = new Set(pairs.flatMap((p) => p.remove));
    marks = twinFilled([...marks.filter((m) => !gone.has(elementKey(m))), ...pairs.flatMap((p) => p.add)]);
  }
  return { marks, box: entry.box };
}
var outlines = /* @__PURE__ */ new Map();
function outlineOf(entry) {
  if (!outlines.has(entry)) {
    const marks = [];
    for (const [id, piece] of Object.entries(entry.keys)) {
      const [g, name2] = id.split(":"), part = PARTS.find((p) => name2.endsWith(p) && name2 !== p);
      if (g === "cc" || part && entry.keys[`${g}:${name2.slice(0, -part.length)}`]) continue;
      marks.push(...piece.add.map(([x2, y2, m]) => [x2, y2, m.replace('fill="currentColor"', 'fill="none"')]));
    }
    outlines.set(entry, twinFilled(marks));
  }
  return outlines.get(entry);
}
var svgOf = (box, inner, label3) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(" ")}" role="img" aria-label="${label3.replace(/[<>&"]/g, "")}"><title>${label3.replace(/[<>&]/g, "")}</title>${inner}</svg>`;
var marksSvg = (marks) => marks.map(([x2, y2, m]) => `<g transform="translate(${x2} ${y2})">${m}</g>`).join("");
var drawings = 0;
function diagramSvg(family3, keys3, label3 = "Fingering", { whole = false, parts = {}, faint = {} } = {}) {
  const entry = fingering_diagrams_default.families[family3];
  if (!entry) return null;
  const rings = Object.keys(parts).filter((id2) => entry.keys[`${id2}R`]).map((id2) => id2.split(":"));
  const all = rings.length ? Object.fromEntries(["cc", "lh", "rh"].map((g) => [g, [...keys3[g] ?? [], ...rings.filter(([r]) => r === g).map(([, n]) => `${n}R`)]])) : keys3;
  const drawn = composeDiagram(entry, all), box = drawn.box, marks = whole ? twinFilled([...drawn.marks, ...outlineOf(entry)]) : drawn.marks;
  const id = `fingered${++drawings}`, shown4 = [...Object.entries(parts).filter(([, a]) => a < 1).map(([key, a]) => [key, a, 1]), ...Object.entries(faint).map(([key, a]) => [key, a, 0.35])].filter(([key, a]) => entry.keys[key] && a > 0);
  const clips = shown4.map(([, a], n) => `<clipPath id="${id}-${n}" clipPathUnits="objectBoundingBox"><rect x="-0.1" y="${+(1 - Math.min(1, a)).toFixed(4)}" width="1.2" height="${+(Math.min(1, a) + 0.1).toFixed(4)}"/></clipPath>`);
  const filled = shown4.map(([key, , opacity], n) => `<g clip-path="url(#${id}-${n})"${opacity < 1 ? ` opacity="${opacity}"` : ""}>${marksSvg(entry.keys[key].add.filter((m) => m[2].includes('fill="currentColor"')))}</g>`);
  return svgOf(box, `${clips.length ? `<defs>${clips.join("")}</defs>` : ""}<g stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">${marksSvg(marks)}${filled.join("")}</g>`, label3);
}
var keywork = (model2) => fingering_diagrams_default.instruments[model2] ?? null;
function openingsOf(model2, pressed) {
  const w = keywork(model2), state2 = Object.fromEntries(w.holes.map((h) => [h, w.standing.includes(h) ? 0 : 1]));
  for (const key of Object.keys(pressed)) for (const h of w.keys[key]?.[1] ?? []) state2[h] = 1;
  for (const [key, [other, down, up]] of Object.entries(w.switch)) if (key in pressed) state2[other in pressed ? down : up] = 1;
  for (const [key, amount] of Object.entries(pressed)) {
    const [closes = [], , own2 = null] = w.keys[key] ?? [];
    for (const h of closes) state2[h] = Math.min(state2[h], h === own2 ? 1 - amount : 0);
  }
  return state2;
}
function diagramKeys(pressed) {
  const out = { cc: [], lh: [], rh: [] };
  for (const [id, amount] of Object.entries(pressed)) {
    const [g, k] = id.split(":");
    out[g].push(amount >= 1 ? k : k + PART_COVERED.reduce((a, b) => Math.abs(b[0] - amount) < Math.abs(a[0] - amount) ? b : a)[1]);
  }
  return out;
}
var decoded = /* @__PURE__ */ new Map();
function chartedOf(model2) {
  if (!decoded.has(model2)) {
    const w = keywork(model2), names = Object.keys(w.keys);
    decoded.set(model2, w.charted.map(([code, documented]) => ({ pressed: Object.fromEntries(code.split(" ").filter(Boolean).map((p) => {
      const [k, a] = p.split(":");
      return [names[+k], a == null ? 1 : +a];
    })), documented })));
  }
  return decoded.get(model2);
}
var HELD = 0.02;
function fingeringOf(model2, open, { from = null } = {}) {
  const w = keywork(model2);
  if (!w) return null;
  const holes = w.holes.filter((h) => Number.isFinite(open[h]));
  const cost = (pressed2) => {
    const o2 = openingsOf(model2, pressed2);
    return holes.reduce((s2, h) => s2 + Math.abs(o2[h] - open[h]), 0);
  };
  let best = from ? { pressed: from, documented: null, e: cost(from) } : null;
  if (!from) for (const c of chartedOf(model2)) {
    const e2 = cost(c.pressed);
    if (!best || e2 < best.e - 1e-9 || e2 <= best.e + 1e-9 && c.documented && !best.documented) best = { ...c, e: e2 };
  }
  let pressed = { ...best?.pressed ?? {} }, e = best?.e ?? cost({}), documented = best && best.e <= HELD ? best.documented : null;
  const keys3 = Object.keys(w.keys), flipped = (trial, key) => {
    if (key in trial) delete trial[key];
    else trial[key] = 1;
    return trial;
  };
  for (let pass = 0; pass < 8 && e > HELD; pass++) {
    let moved = false;
    for (const [key, [, , own2]] of Object.entries(w.keys)) {
      const shares = [0, 1, ...own2 && open[own2] > 0 && open[own2] < 1 ? [1 - open[own2]] : []];
      for (const a of shares) {
        const trial = { ...pressed };
        if (a === 0) delete trial[key];
        else trial[key] = a;
        const t = cost(trial);
        if (t < e - 1e-9) {
          pressed = trial;
          e = t;
          moved = true;
        }
      }
    }
    if (!moved) for (let i = 0; i < keys3.length && !moved; i++) for (let j = i + 1; j < keys3.length && !moved; j++) {
      const trial = flipped(flipped({ ...pressed }, keys3[i]), keys3[j]), t = cost(trial);
      if (t < e - 1e-9) {
        pressed = trial;
        e = t;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const o = openingsOf(model2, pressed);
  return { pressed, keys: diagramKeys(pressed), documented, off: holes.filter((h) => Math.abs(o[h] - open[h]) > HELD) };
}
function heldFingering(model2, open) {
  const f = fingeringOf(model2, open);
  if (!f) return null;
  const w = keywork(model2), holes = w.holes.filter((h) => Number.isFinite(open[h])), pressed = { ...f.pressed }, pads = {};
  const finger2 = Object.fromEntries(Object.entries(w.keys).filter(([, k]) => k[2]).map(([key, k]) => [k[2], key]));
  const held2 = (whole, part) => {
    const o2 = openingsOf(model2, whole);
    for (const [key, s2] of Object.entries(part)) {
      const on = openingsOf(model2, { ...whole, [key]: 1 }), out = { ...whole };
      delete out[key];
      const b = openingsOf(model2, out);
      for (const x2 of holes) if (on[x2] !== b[x2]) o2[x2] = b[x2] + s2 * (on[x2] - b[x2]);
    }
    return o2;
  };
  const missed = (o2) => holes.reduce((s2, x2) => s2 + Math.abs(o2[x2] - open[x2]), 0), names = Object.keys(w.keys);
  const movers = (h) => names.filter((k) => {
    const [c = [], o2 = []] = w.keys[k];
    return c.includes(h) || o2.includes(h) || Object.entries(w.switch).some(([a, [b, d, u]]) => (a === k || b === k) && (d === h || u === h));
  });
  for (const h of f.off) {
    if (finger2[h]) {
      const trial = { ...pressed }, a = 1 - open[h];
      if (a <= 0) delete trial[finger2[h]];
      else trial[finger2[h]] = a;
      if (Math.abs(held2(trial, pads)[h] - open[h]) < Math.abs(held2(pressed, pads)[h] - open[h]) - 1e-9) {
        Object.assign(pressed, trial);
        if (a <= 0) delete pressed[finger2[h]];
        continue;
      }
    }
    const moving = movers(h), bases = [pressed, ...Object.keys(pressed).filter((k) => moving.includes(k)).flatMap((k) => names.filter((j) => !(j in pressed)).map((j) => {
      const b = { ...pressed, [j]: 1 };
      delete b[k];
      return b;
    }))];
    let best = { e: missed(held2(pressed, pads)) - 1e-9 };
    for (const base of bases) for (const key of moving) {
      const s2 = held2(base, { ...pads, [key]: 0 }), t = held2(base, { ...pads, [key]: 1 });
      if (Math.abs(t[h] - s2[h]) < 1e-9) continue;
      const share = Math.max(0, Math.min(1, (open[h] - s2[h]) / (t[h] - s2[h]))), e = missed(held2(base, { ...pads, [key]: share }));
      if (e < best.e) best = { base, key, share, e };
    }
    if (best.key) {
      const base = { ...best.base };
      Object.keys(pressed).forEach((k) => delete pressed[k]);
      Object.assign(pressed, base);
      pads[best.key] = best.share;
    }
  }
  const o = held2(pressed, pads), keys3 = { cc: [], lh: [], rh: [] }, parts = {}, faint = {};
  for (const [key, a] of Object.entries({ ...pressed, ...pads })) {
    const [g, k] = key.split(":");
    if (a >= 1) keys3[g].push(k);
    else if (a > 0) parts[key] = a;
  }
  const off = holes.filter((x2) => Math.abs(o[x2] - open[x2]) > HELD);
  for (const h of off) {
    if (finger2[h]) continue;
    let best = null;
    for (const key of movers(h)) {
      if (key in faint) continue;
      const s2 = held2(pressed, { ...pads, [key]: 0 }), t = held2(pressed, { ...pads, [key]: 1 });
      if (Math.abs(t[h] - s2[h]) < 1e-9) continue;
      const moves = holes.filter((x2) => x2 !== h && Math.abs(t[x2] - s2[x2]) > 1e-9), spill = moves.reduce((q, x2) => q + Math.abs(t[x2] - s2[x2]), 0);
      if (!best || spill < best.spill - 1e-9) best = { key, spill, moves, share: Math.max(0, Math.min(1, (open[h] - s2[h]) / (t[h] - s2[h]))) };
    }
    if (best && best.share > 0 && !(pressed[best.key] >= 1)) faint[best.key] = { share: best.share, hole: h, moves: best.moves };
  }
  return { pressed: f.pressed, keys: keys3, parts, documented: f.documented, off, faint };
}
function woodwindDiagram(model2, keys3, label3, { whole = false, parts = {}, faint = {} } = {}) {
  const w = keywork(model2);
  if (!w) return null;
  const family3 = fingering_diagrams_default.families[w.diagram], undrawn = [];
  const drawn = Object.fromEntries(["cc", "lh", "rh"].map((g) => [g, (keys3[g] ?? []).filter((name2) => {
    const ok = Boolean(family3.keys[`${g}:${name2}`]);
    if (!ok) undrawn.push(`${g}:${name2}`);
    return ok;
  })]));
  const placed2 = (shares) => Object.fromEntries(Object.entries(shares).filter(([key]) => {
    const ok = Boolean(family3.keys[key]);
    if (!ok) undrawn.push(key);
    return ok;
  }));
  return { svg: diagramSvg(w.diagram, drawn, label3, { whole, parts: placed2(parts), faint: placed2(faint) }), undrawn };
}
function valvesSvg(pressed, label3 = "Valves") {
  const r = 1, gap = 0.6, step = 2 * r + gap, w = pressed.length * step - gap + 0.4, h = 2 * r + 1.8;
  const circles = pressed.map((p, k) => {
    const x2 = 0.2 + r + k * step, y2 = 0.2 + r, f = Math.max(0, Math.min(1, p)), top = y2 + r - 2 * r * f;
    return `<clipPath id="v${k}"><rect x="${x2 - r}" y="${top}" width="${2 * r}" height="${2 * r * f}"/></clipPath><circle cx="${x2}" cy="${y2}" r="${r}" fill="currentColor" clip-path="url(#v${k})"/><circle cx="${x2}" cy="${y2}" r="${r}" fill="none" stroke="currentColor" stroke-width=".1"/><text x="${x2}" y="${y2 + r + 1.4}" font-size="1.1" text-anchor="middle" fill="currentColor">${k + 1}</text>`;
  });
  return svgOf([0, 0, +w.toFixed(3), h], circles.join(""), label3);
}
function slideSvg(position, most = 7, label3 = "Slide") {
  const end = Math.max(7, most), x2 = (p) => 1 + (p - 1) * (18 / (end - 1)), at = Math.max(1, Math.min(end, position));
  const marks = Array.from({ length: 7 }, (_, k) => `<line x1="${x2(k + 1)}" y1="2.6" x2="${x2(k + 1)}" y2="3.6" stroke="currentColor" stroke-width=".1"/><text x="${x2(k + 1)}" y="5" font-size="1.1" text-anchor="middle" fill="currentColor">${k + 1}</text>`);
  return svgOf([0, 0, 21, 5.6], `<rect x="${x2(1) - 0.4}" y=".6" width="${x2(at) - x2(1) + 0.8}" height="1.2" rx=".3" fill="currentColor" opacity=".35"/><line x1="${x2(1)}" y1="2.6" x2="${x2(end)}" y2="2.6" stroke="currentColor" stroke-width=".1"/>${marks.join("")}<line x1="${x2(at)}" y1=".2" x2="${x2(at)}" y2="3.8" stroke="currentColor" stroke-width=".25"/>`, label3);
}

// native/live/winds.js
var $2 = (id) => document.getElementById(`w-${id}`);
var NAMES2 = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
var noteName = (m) => `${NAMES2[(m % 12 + 12) % 12]}${Math.floor(m / 12) - 1}`;
var etName = (p) => {
  const m = Math.round(p), c = Math.round(100 * (p - m));
  return `${noteName(m)}${c ? ` ${c > 0 ? "+" : ""}${c} ¢` : ""}`;
};
var valvesName = (f) => [...f].map((v, k) => v === "1" ? k + 1 : null).filter(Boolean).join("+") || "open";
var label = (m) => m.replace(/-/g, " ");
var slideAt = (v, from, to) => {
  const ps = S.slide.positions, k = Math.max(0, Math.min(ps.length - 2, ps.findLastIndex((p) => p[from] <= v)));
  return ps[k][to] + (v - ps[k][from]) * (ps[k + 1][to] - ps[k][to]) / (ps[k + 1][from] - ps[k][from]);
};
var positionOf = (out) => slideAt(out, "out", "position");
var outOf = (position) => slideAt(position, "position", "out");
var hzOf = (m) => 440 * 2 ** ((m - 69) / 12);
var S = null;
var V = null;
var P = null;
var active = false;
var status = null;
var say = (text) => {
  $2("said").textContent = text ?? "";
};
async function post(path, value3 = {}) {
  const r = await fetch(`/winds${path}`, { method: "POST", body: JSON.stringify({ ...value3, version: V }) });
  const got = await r.json();
  if (r.status === 409) {
    poll();
    return {};
  }
  return got;
}
function sender(path) {
  let flying = false, next = null;
  return async (value3) => {
    next = value3;
    if (flying) return;
    flying = true;
    try {
      while (next) {
        const asked2 = next;
        next = null;
        const r = await post(path, asked2);
        if (r.error) {
          say(r.error);
          break;
        }
        if (r.pitch !== void 0) took(r);
      }
    } finally {
      flying = false;
    }
  };
}
var took = (r) => {
  P = r;
  say("");
  refresh();
};
var busy = true;
var what = "";
var blocks = () => document.querySelectorAll(".w-controls");
var polling = null;
async function poll() {
  clearTimeout(polling);
  if (!active) return;
  let s2;
  try {
    s2 = await (await fetch("/winds/state", { cache: "no-store" })).json();
  } catch {
    polling = setTimeout(poll, 1500);
    return;
  }
  if (!active) return;
  S = s2;
  if (s2.model && s2.version !== V) build(s2);
  shown2(s2);
  soloShown2(s2);
  if (s2.soloist?.playing && s2.version === V && s2.played?.pitch != null) {
    P = s2.played;
    refresh();
  } else if (P?.blowing && s2.version === V && s2.played?.lungs && P.breathing && S.lungs) {
    P.lungs = s2.played.lungs;
    lungsSaid();
  }
  if (s2.model && s2.impedance && !impedance && !fetchingImpedance) {
    fetchingImpedance = true;
    const asked2 = V;
    fetch("/winds/impedance").then((r) => r.json()).then((z) => {
      if (asked2 === V) {
        impedance = z;
        legend();
        draw();
      }
    }).finally(() => {
      fetchingImpedance = false;
    });
  }
  polling = setTimeout(poll, s2.loading || s2.muting || s2.soloist?.playing ? 500 : P?.blowing ? 1e3 : !s2.model || !s2.impedance ? 2e3 : 5e3);
}
function shown2(s2) {
  status.classList.toggle("failed", Boolean(s2.failed && !s2.loading));
  const breathSaid = (n) => n.breathTimes && n.breathTimes !== 1 ? `, its breath ${n.breathTimes} times its players' law's, where it sounds` : "";
  const neutral2 = s2.neutral ? `, on its neutral note (${etName(s2.notes[s2.neutral.note])} at ${s2.neutral.dynamic}${breathSaid(s2.neutral)})` : s2.model ? `, on the middle of its charted notes: no neutral note found on its body yet (Commands/Make Dial Bodies.command finds it)` : "";
  status.textContent = s2.loading ? `Making the ${label(s2.loading.model)}: ${s2.loading.step} (${Math.round(s2.loading.seconds)} s)${s2.model ? `. The ${label(s2.model)} is silent until it is ready.` : "."}` : s2.failed ? `The ${label(s2.failed.model)} could not be taken up: ${s2.failed.error}${s2.model ? `. The ${label(s2.model)} still plays.` : ""}` : s2.model ? `The ${label(s2.model)}, ready${neutral2}${s2.threads > 1 ? `; its engine on ${s2.threads} cores` : ""}.` : "Starting ...";
  busy = Boolean(s2.loading) || !s2.model;
  for (const b of blocks()) b.disabled = busy;
  for (const id of ["blow", "reset", "neutral"]) $2(id).disabled = busy;
  $2("tongueNow").disabled = busy || !P?.blowing;
}
var MEANING = {
  gamma: ["breath", "mouth pressure over the closing pressure"],
  zeta: ["embouchure", "the reed's opening and width under the lips, scaled"],
  kappa: ["reed flow", "the flow the reed itself moves, scaled"],
  qfactor: ["reed damping (Q)", "the lips' damping of the reed"],
  pulsation: ["reed resonance, Hz", "its frequency"],
  contact_stifness: ["lay contact", "the stiffness of the reed against the lay"],
  contact_exponent: ["contact exponent", "how the contact stiffens, three either side"],
  closing_pressure: ["closing pressure, kPa", "the pressure that shuts the reed"]
};
var LIPS = {
  gamma: ["breath", "mouth pressure over the closing pressure"],
  zeta: ["lip opening", "the lips' opening and width, scaled"],
  kappa: ["lip flow", "the flow the lips themselves move, scaled"],
  qfactor: ["lips' damping (Q)", "their outward mode's quality"],
  pulsation: ["lip frequency", "their outward resonance, dialled by itself: the pitch asked and its breath kept, their other values their register's there; the bore picks the partial"],
  contact_stifness: ["contact", "none: lips have no lay"],
  contact_exponent: ["contact exponent", "none: lips have no lay"],
  closing_pressure: ["closing pressure, kPa", "the pressure that shuts the lips"],
  inward_ratio: ["inward resonance", "the inward mode's over the outward's"],
  inward_qfactor: ["inward damping (Q)", "the inward mode's quality"],
  inward_coupling: ["inward coupling", "the outward mass over the inward's"]
};
var JET = {
  Uj: ["breath", "the jet's speed at the flue, m/s"],
  noise: ["turbulence", "the jet's noise, its level"],
  window: ["window", "the share of the embouchure hole the lip leaves"],
  Ascale: ["jet amplification", "its disturbance's growth over its length"],
  Gj: ["jet drive", "the jet's push on the air at the edge"],
  Gl: ["edge losses", "the flow's losses at the edge (vena contracta)"],
  C: ["jet delay", "its length over its disturbance's speed: the time it takes to cross"],
  y0: ["jet offset", "its centre from the edge, in its width: one either side"],
  span: ["dipole span", "the spread of its push about the edge"]
};
var meaningOf = (name2) => (S.kind === "lips" ? LIPS[name2] : S.kind === "air" ? JET[name2] : null) ?? MEANING[name2] ?? [name2, ""];
var GROUP = {
  reed: { gamma: "Player", zeta: "Player", qfactor: "Player", kappa: "Instrument", pulsation: "Instrument", contact_stifness: "Instrument", closing_pressure: "Instrument", contact_exponent: "Physics" },
  lips: { contact_stifness: "Physics", contact_exponent: "Physics" },
  air: { Uj: "Player", window: "Player", C: "Player", y0: "Player", noise: "Physics", Ascale: "Physics", Gj: "Physics", Gl: "Physics", span: "Physics" }
};
var groupOf = (name2) => GROUP[S.kind]?.[name2] ?? "Player";
var col = (k) => S.columns[k][2];
var ADDITIVE = { contact_exponent: 3, y0: 1 };
var fixed = (k) => S.kind === "lips" && col(k) === "contact_exponent" || !(col(k) in ADDITIVE) && !(P.rules[k] > 0);
var valueOf = (k, x2) => col(k) in ADDITIVE ? P.rules[k] + ADDITIVE[col(k)] * x2 : P.rules[k] * S.reach ** x2;
var placeOf = (k, v) => col(k) in ADDITIVE ? (v - P.rules[k]) / ADDITIVE[col(k)] : Math.log(v / P.rules[k]) / Math.log(S.reach);
var unit = { pulsation: [(v) => v / 2 / Math.PI, (v) => 2 * Math.PI * v], closing_pressure: [(v) => v / 1e3, (v) => 1e3 * v] };
var shownValue = (name2, v) => {
  const u = unit[name2] ? unit[name2][0](v) : v;
  return Math.abs(u) >= 1e4 || Math.abs(u) < 0.01 && u !== 0 ? u.toExponential(3) : (+u.toPrecision(5)).toString();
};
var controls = {};
function row(box, id, text, { min, max, to = (v) => v, from = (x2) => x2, step = "any", format = (v) => +(+v).toPrecision(4), change, note }) {
  const r = document.createElement("div");
  r.className = "row";
  r.innerHTML = `<label for="w-${id}"></label><input type="range" id="w-${id}" step="any"><input type="number" id="w-${id}N" step="${step}">`;
  r.querySelector("label").textContent = text;
  box.append(r);
  let n = null;
  if (note !== void 0) {
    n = document.createElement("div");
    n.className = "note";
    n.textContent = note;
    box.append(n);
  }
  const range = r.querySelector("input[type=range]"), number = r.querySelector("input[type=number]");
  range.min = to(min);
  range.max = to(max);
  const set = (v) => {
    if (held !== range) range.value = to(Math.min(max, Math.max(min, v)));
    if (document.activeElement !== number) number.value = format(v);
  };
  range.oninput = () => {
    const v = from(+range.value);
    number.value = format(v);
    change(v);
  };
  number.onchange = () => {
    const v = +number.value;
    if (Number.isFinite(v) && v >= min && v <= max) change(v);
    else refresh();
  };
  return controls[id] = { set, range, number, note: n, band: playersBand(range), place: (v) => (to(v) - to(min)) / (to(max) - to(min)) };
}
var held = null;
addEventListener("pointerdown", (e) => {
  if (e.target.type === "range") held = e.target;
});
addEventListener("pointerup", () => {
  held = null;
});
var sendDial = sender("/dial");
var sendHole = sender("/hole");
var sendPitch = sender("/pitch");
var sendLip = sender("/lip");
var sendArticulation = sender("/articulation");
var sendRepeat = sender("/repeat");
var sendVibrato = sender("/vibrato");
var sendTract = sender("/tract");
var sendSlide = sender("/slide");
var sendAttack = sender("/attack");
var sendBreathing = sender("/breathing");
var sendFlutter = sender("/flutter");
var sendHum = sender("/hum");
var sendGrowl = sender("/growl");
var sendNoise = sender("/noise");
var sendMute = sender("/mute");
var NOISE_LABEL = { breath: "The breath's pressure", lips: "The lips' tension" };
var noiseId2 = (what2) => `noise${what2[0].toUpperCase()}${what2.slice(1)}`;
var RISEN = [[0, 0], [0.05, 1]];
var attack = curveEditor($2("attack"), { kind: attackKind({ from: 0, straight: false }), label: "Breath at a note's start", change: (points) => {
  if (!S?.model || busy) {
    if (P?.breathAttack) attack.set(P.breathAttack);
    return;
  }
  const [low, high] = S.limits.rise, rise = points[1][0];
  sendAttack({ points: rise < low || rise > high ? firstEndingAt(points, Math.min(high, Math.max(low, rise))) : points });
} });
$2("plainRise").onclick = () => {
  if (S?.model && !busy) sendAttack({ points: firstEndingAt(RISEN, P?.rise ?? RISEN[1][0]) });
};
function build(s2) {
  V = s2.version;
  P = s2.played;
  impedance = null;
  for (const box of ["tongue", "repeat", "lungs", "vibrato", "noise", "flutter", "hum", "growl", "excitorPlayer", "excitorInstrument", "excitorPhysics", "holes", "slideBox", "diagram"]) $2(box).replaceChildren();
  drawnFor = null;
  $2("diagramNote").textContent = "";
  for (const k in controls) delete controls[k];
  const kind = s2.kind, brass = kind === "lips";
  what = `The ${label(s2.model)} on OpenWInD's engine, heard through this page: its player's ${brass ? "lips" : kind === "air" ? "air and fingers" : "reed and fingers"}, tongue, vibrato${kind === "air" ? "" : " and vocal tract"} dialled by ear.`;
  document.getElementById("what").textContent = what;
  const noteText = (m2, k) => !brass ? `${noteName(m2)} (${m2})` : `${etName(m2)} (${s2.fingerings ? `${valvesName(s2.fingerings[k])}, ` : ""}${s2.positions ? `position ${s2.positions[k]}${s2.alternates[k] ? ", alternate" : ""}, ` : ""}partial ${s2.partials[k]})`;
  $2("note").replaceChildren(...s2.notes.map((m2, k) => new Option(noteText(m2, k) + (s2.neutral?.note === k ? " · neutral" : ""), k)));
  if (!$2("dynamic").options.length) for (const d of s2.dynamics) $2("dynamic").add(new Option(d, d));
  const [low, high] = [Math.min(...s2.notes), Math.max(...s2.notes)];
  for (const el of [$2("pitch"), $2("pitchN")]) {
    el.min = low;
    el.max = high;
  }
  const t = s2.tongue, m = t.measured, ms2 = (v) => Math.round(1e3 * v), L = s2.limits;
  $2("articulationNote").textContent = `A slurred note on the same pitch (within ${t.samePitch} ¢) is legato-tongued, a half attack.`;
  row($2("tongue"), "stroke", "Tongued stroke, ms", {
    min: ms2(L.stroke[0]),
    max: ms2(L.stroke[1]),
    step: 1,
    format: Math.round,
    change: (v) => sendArticulation({ stroke: v / 1e3 }),
    note: `The air ${kind === "reed" ? "shut by the tongue on the reed" : "stopped"} that long before a tongued note. Measured: clarinettists' portato ${ms2(m.portato[0])} ms (sd ${ms2(m.portato[1])}), their staccato ${ms2(m.staccato[0][1])} ms at four notes a second and ${ms2(m.staccato[1][1])} at two (Pàmies-Vilà, Hofmann & Chatziioannou 2018); saxophonists' ${(1e3 * m.saxophone).toFixed(1)} ms (Hofmann & Goebl 2014).`
  });
  row($2("tongue"), "softSeconds", "Legato tongue, ms", {
    min: ms2(L.softSeconds[0]),
    max: ms2(L.softSeconds[1]),
    step: 1,
    format: Math.round,
    change: (v) => sendArticulation({ softSeconds: v / 1e3 }),
    note: kind === "reed" ? `The tongue touching the reed to ${Math.round(100 * t.soft)} % of its opening that long: a half attack.` : `The air dipped to ${Math.round(100 * t.dip)} % of itself that long: a half attack.`
  });
  row($2("tongue"), "rise", "Breath rise from rest, ms", {
    min: ms2(L.rise[0]),
    max: ms2(L.rise[1]),
    step: 1,
    format: Math.round,
    change: (v) => sendArticulation({ rise: v / 1e3 }),
    note: kind === "reed" ? "A note from rest: the tongue on the reed as the breath rises, let go as it has risen." : brass ? "A note from rest: the air let go into the lips, attacked as their attack was measured on the engine." : "A note from rest: the air let go into its rise."
  });
  row($2("repeat"), "repeatRate", "Notes a second", {
    min: L.repeat[0],
    max: L.repeat[1],
    to: Math.log,
    from: Math.exp,
    step: 0.1,
    format: (v) => v.toFixed(1),
    change: (v) => sendRepeat({ rate: v }),
    note: `Each a stroke as the articulation says. Measured on brass: single tonguing to some ${m.single} notes a second, double some ${m.double} (Bertsch & Hoole 2014).`
  });
  if (s2.lungs) {
    const n = s2.lungs;
    row($2("lungs"), "litres", "Breath taken, L", {
      min: L.litres[0],
      max: L.litres[1],
      step: 0.05,
      format: (v) => v.toFixed(2),
      change: (v) => sendBreathing({ litres: v }),
      note: `Wind players' vital capacity ${n.capacity.litres} L (sd ${n.capacity.sd}; Bouros, Protogerou, Castana & Vasilopoulos 2018), ${Math.round(100 * n.spent.share)} % of it spent in a breath (Cossette, Sliwinski & Macklem 2000): ${n.breath} L.`
    });
    row($2("lungs"), "inhale", "Breath in, ms", {
      min: ms2(L.inhale[0]),
      max: ms2(L.inhale[1]),
      step: 10,
      format: Math.round,
      change: (v) => sendBreathing({ inhale: v / 1e3 }),
      note: `Fast and deep (Bouhuys 1964), reed players' fastest some 300 ms (Fuks & Sundberg 1998); by default a singer's full breath, ${ms2(n.inhale.seconds)} ms (Salomoni, van den Hoorn & Hodges 2016), until wind players' own is measured.`
    });
    if (P.breathing && $2("breathing").checked !== P.breathing.on) sendBreathing({ on: $2("breathing").checked });
  }
  const own2 = s2.vibratoOwn;
  $2("vibratoNote").textContent = `${own2.width > 0 ? `the ${label(s2.model)} players' own: ${own2.width} ¢ at ${own2.rate} Hz` : `the ${label(s2.model)} is played without one${own2.reach ? `; ${own2.reach} ¢ where a style asks` : ""}`}; ${brass ? "the whole embouchure swayed, as the mouthpiece is pressed into the lips and eased, as deep as the note is heard so wide" : "in the breath"}`;
  row($2("vibrato"), "vibratoWidth", "Width, cents", { min: L.width[0], max: L.width[1], step: 1, format: Math.round, change: (v) => sendVibrato({ width: v }) });
  row($2("vibrato"), "vibratoRate", "Rate, Hz", { min: L.rate[0], max: L.rate[1], step: 0.1, format: (v) => v.toFixed(1), change: (v) => sendVibrato({ rate: v }) });
  if (s2.noise) {
    const { profile: f, most } = s2.noise, dial2 = { min: 0, max: most, step: 0.05, format: (v) => v.toFixed(2) };
    row($2("noise"), "noisePlayer", "The player's temperature", {
      ...dial2,
      change: (v) => sendNoise({ player: v }),
      note: `Each kind's under it. Its power falling as 1/f^${f.beta} from ${f.low} to ${f.high} Hz, a ${f.tremor.hz} Hz tremor ${Math.round(100 * f.tremor.share)} % of it.`
    });
    for (const { what: what2, sd } of s2.noise.kinds) row($2("noise"), noiseId2(what2), NOISE_LABEL[what2], {
      ...dial2,
      change: (v) => sendNoise({ [what2]: v }),
      note: `At 1, ${+(100 * sd).toPrecision(2)} % of the ${what2 === "breath" ? "pressure" : "tension"} asked.`
    });
  }
  if (L.flutterHz) {
    row($2("flutter"), "flutterHz", "Turns a second", {
      min: L.flutterHz[0],
      max: L.flutterHz[1],
      step: 0.5,
      format: (v) => v.toFixed(1),
      change: (v) => sendFlutter({ hz: v }),
      note: "The middle of the renders' flutters by default: 28 to 33 a second, as speakers' voiceless tongue-tip trills were measured (Elie & Laprie 2017); no wind player's measured."
    });
    row($2("flutter"), "flutterDepth", "Breath closed off", {
      min: L.flutterDepth[0],
      max: L.flutterDepth[1],
      step: 0.01,
      format: (v) => v.toFixed(2),
      change: (v) => sendFlutter({ depth: v }),
      note: "At each turn this share of the breath closed off and let go, its curve squared as the renders' is, on whatever moves under it: an attack, a stroke, a breath."
    });
    row($2("hum"), "humInterval", "Hummed, semitones from the note", {
      min: L.humInterval[0],
      max: L.humInterval[1],
      step: 0.01,
      format: (v) => v.toFixed(2),
      change: (v) => sendHum({ interval: v }),
      note: "Folded into the player's voice (the registry's low and high breath-model voices), as the renders' hummers are; an octave under by default, the middle of what they draw."
    });
    row($2("hum"), "humLevel", "Level, × the breath", {
      min: L.humLevel[0],
      max: L.humLevel[1],
      step: 0.01,
      format: (v) => v.toFixed(2),
      change: (v) => sendHum({ level: v }),
      note: "Its breath swung this much of itself by the voice, its partials falling as the square of their number: the renders' 0.2 by default."
    });
    if (L.growlInterval) {
      row($2("growl"), "growlInterval", "Growled, semitones from the note", {
        min: L.growlInterval[0],
        max: L.growlInterval[1],
        step: 0.01,
        format: (v) => v.toFixed(2),
        change: (v) => sendGrowl({ interval: v }),
        note: "Folded into the player's voice as the hum is; an octave under by default, the middle of what the renders' growlers draw."
      });
      row($2("growl"), "growlLevel", "Level, × the breath", {
        min: L.growlLevel[0],
        max: L.growlLevel[1],
        step: 0.01,
        format: (v) => v.toFixed(2),
        change: (v) => sendGrowl({ level: v }),
        note: "Its breath swung this much of itself by the rough voice."
      });
      row($2("growl"), "growlRough", "Roughness", {
        min: L.growlRough[0],
        max: L.growlRough[1],
        step: 0.01,
        format: (v) => v.toFixed(2),
        change: (v) => sendGrowl({ rough: v }),
        note: "Its voice's period doubled, every other pulse this much weaker, with breath noise this rough: 0.3 to 0.9 in the renders."
      });
      $2("techniqueNote").textContent = "Played by the engine as the renders play them. A growl and a hum both on: the growl.";
    } else $2("techniqueNote").textContent = "This dial was started before its growl: Commands/Start Live Dial.command again brings it.";
  } else $2("techniqueNote").textContent = "This dial was started before its flutter and hum: Commands/Start Live Dial.command again brings them.";
  const reach = s2.reach === 4 ? "a quarter to four" : `1/${s2.reach} to ${s2.reach}`, between = `each ${reach} times the rules' value at the pitch and dynamic; the box, its value.`;
  $2("playerLegend").textContent = brass ? "Lips and breath" : kind === "air" ? "Breath and jet" : "Breath and embouchure";
  $2("excitorNote").textContent = `The player's columns of the engine, ${between}` + (brass ? " The lips' frequency in Hz, over their reach." : "");
  $2("instrumentLegend").textContent = "Reed";
  $2("instrumentNote").textContent = `The reed's own columns, ${between}`;
  $2("physicsLegend").textContent = brass ? "The lips' contact" : kind === "air" ? "The jet's model" : "The reed's contact";
  $2("physicsNote").textContent = `The model's constants for the ${brass ? "lips" : kind === "air" ? "jet" : "reed"}, ${between}`;
  const boxOf = { Player: $2("excitorPlayer"), Instrument: $2("excitorInstrument"), Physics: $2("excitorPhysics") };
  for (const k of s2.dials) {
    const name2 = col(k), [text, about] = meaningOf(name2), box = boxOf[groupOf(name2)];
    if (brass && name2 === "pulsation") {
      const [lo, hi] = s2.lipReach;
      Object.assign(row(box, `lip${k}`, `${text}, Hz`, { min: lo, max: hi, to: Math.log, from: Math.exp, step: 0.1, format: (v) => v.toFixed(1), change: (v) => sendLip({ lip: v }), note: about }), { lip: true });
      continue;
    }
    const c = row(box, `col${k}`, text, { min: -1, max: 1, change: (x2) => sendDial({ column: k, x: x2 }), note: about });
    c.range.oninput = () => {
      const x2 = +c.range.value;
      c.number.value = shownValue(name2, valueOf(k, x2));
      sendDial({ column: k, x: x2 });
    };
    c.number.onchange = () => {
      const v = +c.number.value, x2 = placeOf(k, unit[name2] ? unit[name2][1](v) : v);
      if (Number.isFinite(x2) && x2 >= -1 && x2 <= 1) sendDial({ column: k, x: x2 });
      else refresh();
    };
    Object.assign(c, { k, name: name2 });
  }
  $2("instrumentSet").hidden = !$2("excitorInstrument").children.length;
  $2("physicsSet").hidden = !$2("excitorPhysics").children.length;
  $2("fingerSet").hidden = brass && !s2.valves && !s2.slide;
  $2("fingerLegend").textContent = brass ? s2.slide ? "Slide" : "Valves" : "Fingers";
  $2("muteSet").hidden = !s2.mutes?.length;
  $2("mute").replaceChildren(new Option("none", ""), ...(s2.mutes ?? []).map((m2) => new Option(MUTE_NAME[m2] ?? m2, m2)));
  $2("fingerNote").textContent = s2.slide ? "The slide, at a position from 1 (in) to 7 and past: the note's, its players' chart's, placed where its partial plays it in tune; a pitch between them on the partial played there, glided to. Drawn here by itself, its lips held: the bore gives the pitch." : brass ? "Each valve, 0 pressed to 1 raised -- a half-valve between: the note's fingering, its players' chart's, until the pitch moves." : "Each hole's opening, 0 closed to 1 open: the pitch's, until the pitch moves.";
  if (s2.slide) {
    const c = row($2("slideBox"), "slide", "Slide position", {
      min: 1,
      max: positionOf(s2.slide.most),
      to: outOf,
      from: positionOf,
      step: 0.01,
      format: (v) => v.toFixed(2),
      change: (v) => sendSlide({ out: Math.min(Math.max(outOf(v), 0), s2.slide.most) }),
      note: ""
    });
    c.note.style.minHeight = "2.9em";
    const marks = document.createElement("datalist");
    marks.id = "w-slideMarks";
    marks.append(...s2.slide.positions.map((p) => new Option(String(p.position), p.out)));
    $2("slideBox").append(marks);
    c.range.setAttribute("list", "w-slideMarks");
  }
  s2.columns.forEach((c, k) => {
    if (c[0] !== "opening" || brass && !s2.valves.some(([first]) => first === k)) return;
    const box = document.createElement("div");
    box.innerHTML = `<label><span></span><b></b></label><input type="range" min="0" max="1" step="0.01">`;
    box.querySelector("span").textContent = brass ? `Valve ${c[1] + 1}` : s2.holes?.[c[1]] ?? c[2] ?? c[1];
    const slider = box.querySelector("input"), value3 = box.querySelector("b");
    slider.oninput = () => {
      value3.textContent = (+slider.value).toFixed(2);
      sendHole({ column: k, value: +slider.value });
    };
    controls[`hole${k}`] = { set: (v) => {
      if (held !== slider) slider.value = v;
      value3.textContent = v.toFixed(2);
    }, hole: k };
    $2("holes").append(box);
  });
  $2("tractLegend").textContent = brass ? "Vocal tract, upstream of the lips" : kind === "air" ? "The bore, as the jet meets it" : "Vocal tract, upstream of the reed";
  tract = new VocalTract(P.tract);
  const range = (path) => playerEntry(s2.model, `tract.${path}`);
  MEASURED = s2.tractMeasured ? {
    first: { f: range("first.frequency").range, p: range("first.peak").range },
    above: player(s2.model, "tract.normal.above"),
    offset: player(s2.model, "tract.normal.offset"),
    normal: player(s2.model, "tract.normal.peak"),
    bend: range("bend.peak").range
  } : null;
  $2("normal").hidden = $2("none").hidden = $2("tractHow").hidden = kind === "air";
  $2("normal").disabled = !s2.tractMeasured;
  $2("normal").title = s2.tractMeasured ? "" : `no ${label(s2.model)} players' tract measured yet`;
  const rows = (id, pairs) => {
    $2(id).replaceChildren(...pairs.filter(([, v]) => v != null && v !== "").map(([a, b]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td>";
      tr.cells[0].textContent = a;
      tr.cells[1].textContent = b;
      tr.cells[1].title = b;
      return tr;
    }));
  };
  const holes = s2.columns.filter((c) => c[0] === "opening").length;
  rows("body", [
    ["Instrument", label(s2.model)],
    ["Compass", `${etName(low)} to ${etName(high)}, ${s2.notes.length} ${brass ? "partials and fingerings" : "charted notes"}`],
    ["Holes", brass ? null : `${new Set(s2.columns.filter((c) => c[0] === "opening").map((c) => c[1])).size} (${holes} columns)`],
    ["Valves", s2.valves ? `${s2.valves.length}, each its deviation pipe and two switches` : null],
    ["Slide", s2.slide ? `${(1e3 * s2.slide.most).toFixed(0)} mm of tube past first position, ${s2.slide.positions.length} positions` : null],
    ["Neutral note", s2.neutral ? `${etName(s2.notes[s2.neutral.note])} at ${s2.neutral.dynamic}${s2.neutral.breathTimes !== 1 ? `, its breath ${s2.neutral.breathTimes} times its players' law's` : ""}, heard ${s2.neutral.cents} ¢ from its pitch (found ${new Date(s2.neutral.found).toLocaleDateString()})` : "not found on this body yet: Commands/Make Dial Bodies.command finds it"],
    ["Its body", s2.layout?.madeFrom ? `made from ${s2.layout.madeFrom.slice(0, 12)}` : null]
  ]);
  const lay = s2.layout ?? {};
  rows("engineTable", [
    ["Losses", lay.losses],
    ["Mesh", lay.mesh],
    ["Elements", lay.order != null ? `order ${lay.order}` : null],
    ["Precision", lay.single == null ? null : lay.single ? "single" : "double"],
    ["Rate", lay.rate ? `${lay.rate} Hz${lay.ratio ? `, stepped ${lay.ratio} times a sample` : ""}` : null],
    ["Unknowns", lay.unknowns ? `${lay.unknowns} (${lay.entries} entries)` : null],
    ["Cores", String(s2.threads)],
    ["Dials' reach", `1/${s2.reach} to ${s2.reach} times the rules' value`]
  ]);
  for (const b of blocks()) b.hidden = false;
  refresh();
  legend();
  draw();
}
function refresh() {
  if (!P || !S?.model) return;
  $2("blow").textContent = P.blowing ? "Blowing" : "Blow";
  $2("blow").classList.toggle("on", P.blowing);
  $2("tongueNow").disabled = !P.blowing || busy;
  if (document.activeElement !== $2("note")) $2("note").value = String(P.note ?? S.notes.indexOf(P.midi));
  if (document.activeElement !== $2("dynamic")) $2("dynamic").value = P.dynamic;
  if (held !== $2("pitch")) $2("pitch").value = P.pitch;
  if (document.activeElement !== $2("pitchN")) $2("pitchN").value = P.pitch.toFixed(2);
  for (const r of document.querySelectorAll("input[name=w-articulation]")) r.checked = r.value === P.articulation;
  controls.stroke.set(1e3 * P.stroke);
  controls.softSeconds.set(1e3 * P.softSeconds);
  controls.rise.set(1e3 * P.rise);
  if (P.breathAttack) {
    attack.set(P.breathAttack);
    const [t, y2] = peakOf(P.breathAttack);
    $2("attackNote").textContent = (y2 > 1 ? `Its peak ${y2.toFixed(2)} times the breath dialled, ${Math.round(1e3 * t)} ms in, settled at ${Math.round(1e3 * P.breathAttack.at(-1)[0])} ms. ` : "A plain rise: the breath brought up to what is dialled and held. ") + `Played from rest and after every tongued stroke${S.kind === "reed" ? " (the tongue let go of the reed as the first segment ends)" : ""}. Press anywhere on the plot to put a point there and drag it -- above the dashed line, a peak over the breath dialled; drag a point; select one to set it as numbers; double-click it, or press Delete, to take it away. Its first rise is the breath's rise (above); each segment is eased, as the engine moves.`;
  }
  $2("repeating").checked = P.repeat.on;
  controls.repeatRate.set(P.repeat.rate);
  if (P.breathing && S.lungs) {
    $2("breathing").checked = P.breathing.on;
    controls.litres.set(P.breathing.litres);
    controls.inhale.set(1e3 * P.breathing.inhale);
    lungsSaid();
  }
  $2("vibrating").checked = P.vibrato.on;
  controls.vibratoWidth.set(P.vibrato.width);
  controls.vibratoRate.set(P.vibrato.rate);
  if (P.noise && controls.noisePlayer) {
    controls.noisePlayer.set(P.noise.player);
    for (const { what: what2 } of S.noise.kinds) controls[noiseId2(what2)].set(P.noise[what2]);
  }
  if (P.flutter && controls.flutterHz) {
    $2("fluttering").checked = P.flutter.on;
    controls.flutterHz.set(P.flutter.hz);
    controls.flutterDepth.set(P.flutter.depth);
    $2("humming").checked = P.hum.on;
    controls.humInterval.set(P.hum.interval);
    controls.humLevel.set(P.hum.level);
    if (P.growl && controls.growlInterval) {
      $2("growling").checked = P.growl.on;
      controls.growlInterval.set(P.growl.interval);
      controls.growlLevel.set(P.growl.level);
      controls.growlRough.set(P.growl.rough);
    }
    const growling = P.growl?.on && P.growled != null, h = growling ? P.growled : P.hummed, f = hzOf(P.pitch);
    $2("humNote").textContent = h == null ? "" : `${growling ? "Growled" : "Hummed"} at ${h.toFixed(1)} Hz (${etName(12 * Math.log2(h / 440) + 69)}); with the note's ${f.toFixed(1)} Hz, its difference tone ${Math.abs(f - h).toFixed(1)} Hz and its sum ${(f + h).toFixed(1)} Hz.`;
  }
  if (controls.slide && P.slide != null) {
    controls.slide.set(positionOf(P.slide));
    controls.slide.note.textContent = `${Math.round(1e3 * P.slide)} mm of tube past first position, the hand ${Math.round(500 * P.slide)} mm out; moved as its players move it, over ${Math.round(1e3 * S.slide.least)} ms or at some ${S.slide.speed} m/s.`;
  }
  muteSaid();
  fingered();
  for (const c of Object.values(controls)) {
    if (c.hole !== void 0) c.set(P.row[c.hole]);
    if (c.lip && P.lip != null) c.set(P.lip);
    if (c.k === void 0) continue;
    const off = fixed(c.k);
    c.range.disabled = c.number.disabled = off;
    if (held !== c.range) c.range.value = P.x[c.k] ?? 0;
    if (document.activeElement !== c.number) c.number.value = shownValue(c.name, P.row[c.k]);
    if (c.name === "gamma" && c.note) {
      const at = S.columns.findIndex((q) => q[0] === "reed" && q[2] === "closing_pressure");
      if (at >= 0) c.note.textContent = `${meaningOf("gamma")[1]}: ${(P.row[c.k] * P.row[at] / 1e3).toFixed(2)} kPa`;
    }
  }
  drawPlayers2();
  said();
}
function lungsSaid() {
  const f = P.lungs.flow, players = P.lungs.players, src = S.lungs.airflow, b = S.breath, dialled = P.rules[b] > 0 && Math.abs(P.row[b] / P.rules[b] - 1) > 5e-3;
  $2("lungsNote").textContent = `${f > 0 ? `As it was last blown its model let ${f.toFixed(3)} L a second into its bore (its engine's own flow)` : "Its model's flow is measured as it is blown"}; at ${P.dynamic} on ${etName(P.pitch)}${dialled ? ", at the breath dialled," : ""} its players spend ${players.toFixed(2)} L a second (` + (src.evidence === "measured" ? `measured of ${label(S.model)} players: Bouhuys 1965` : `borrowed from ${src.from.map(label).join(", ")} players' measured flows, Bouhuys 1965: none measured on the ${label(S.model)}`) + `). ${P.breathing.on ? `${f > 0 ? `A breath of ${P.breathing.litres.toFixed(2)} L lasts it ${(P.breathing.litres / f).toFixed(1)} s` : `A breath of ${P.breathing.litres.toFixed(2)} L spent`}, then the note is let go, a breath taken in over ${Math.round(1e3 * P.breathing.inhale)} ms and the note attacked again as from rest -- as the strings' bow turns.` : "Unbreathing, it blows one breath without end."}`;
}
var kPa = (v) => `${(v / 1e3).toFixed(1)} kPa`;
var msOf = (v) => `${Math.round(v)} ms`;
var shortly = (v) => String(+(+v).toPrecision(2));
var WRITTEN = { pulsation: (v) => `${Math.round(v / 2 / Math.PI)} Hz`, closing_pressure: kPa, qfactor: shortly };
var OWN = {
  stroke: [1e3, msOf],
  softSeconds: [1e3, msOf],
  rise: [1e3, msOf],
  inhale: [1e3, msOf],
  repeatRate: [1, (v) => `${v} a second`],
  litres: [1, (v) => `${v.toFixed(1)} L`],
  vibratoWidth: [1, (v) => `${Math.round(v)} ¢`],
  vibratoRate: [1, (v) => `${shortly(v)} Hz`]
};
var pitchBand = null;
function drawPlayers2() {
  const R = S.players;
  if (!R) return;
  pitchBand ??= playersBand($2("pitch"));
  const low = +$2("pitch").min, high = +$2("pitch").max;
  pitchBand(R.pitch, (m) => (m - low) / (high - low), (m) => noteName(Math.round(m)));
  const shut = S.columns.findIndex((q) => q[0] === "reed" && q[2] === "closing_pressure"), blown = atPitch(R.breath, P.pitch);
  for (const [id, c] of Object.entries(controls)) {
    if (!c.band) continue;
    const x2 = (v) => (placeOf(c.k, v) + 1) / 2;
    if (c.name === "gamma") c.band(shut >= 0 ? blown : null, (p) => x2(p / P.row[shut]), kPa);
    else if (c.k !== void 0) c.band(R.columns[c.name] ?? null, x2, WRITTEN[c.name] ?? shortly);
    else {
      const [scale, written] = OWN[id] ?? [1, shortly];
      c.band(R[id] ?? null, (v) => c.place(scale * v), (v) => written(scale * v));
    }
  }
}
var drawnFor = null;
function fingered() {
  const brass = S.kind === "lips", holes = S.columns.map((c, k) => [c, k]).filter(([c]) => c[0] === "opening");
  let svg = "", note = "", key;
  if (brass && S.slide && P.slide != null) {
    key = `slide ${P.slide.toFixed(4)}`;
    if (key === drawnFor) return;
    const at = positionOf(P.slide);
    svg = slideSvg(at, positionOf(S.slide.most), `Slide at position ${at.toFixed(2)}`);
  } else if (brass && S.valves) {
    const down = S.valves.map(([first]) => 1 - P.row[first]);
    key = `valves ${down.map((d) => d.toFixed(3))}`;
    if (key === drawnFor) return;
    svg = valvesSvg(down, `Valves: ${valvesName(down.map((d) => d >= 0.5 ? "1" : "0").join(""))}`);
    note = down.some((d) => d > 0.01 && d < 0.99) ? `Half-valved: ${down.map((d, k) => d > 0.01 && d < 0.99 ? `valve ${k + 1} ${Math.round(100 * d)} % down` : null).filter(Boolean).join(", ")}.` : "";
  } else if (!brass && keywork(S.model)) {
    const open = Object.fromEntries(holes.map(([c, k]) => [S.holes[c[1]], P.row[k]]));
    key = `holes ${holes.map(([, k]) => P.row[k].toFixed(3))}`;
    if (key === drawnFor) return;
    const f = heldFingering(S.model, open), w = keywork(S.model), faint = Object.entries(f.faint), parts = Object.entries(f.parts);
    const d = woodwindDiagram(S.model, f.keys, `Fingering${f.documented ? ` ${f.documented}` : ""}`, { whole: true, parts: f.parts, faint: Object.fromEntries(faint.map(([key2, v]) => [key2, v.share])) });
    const unkeyed = holes.filter(([c, k]) => !w.holes.includes(S.holes[c[1]]) && Math.abs(P.row[k] - P.rules[k]) > 5e-3).map(([c, k]) => `${S.holes[c[1]]} at ${P.row[k].toFixed(2)}`);
    const pct = (a) => `${Math.round(100 * a)} %`, shown4 = new Set(faint.map(([, v]) => v.hole)), off = f.off.filter((h) => !shown4.has(h));
    svg = d.svg;
    note = (f.documented ? `${f.documented}, as its players' guide writes it.` : f.off.length ? "No fingering of its keys leaves its holes so: the keys nearest them." : "Its keys for the holes as they stand: no charted fingering.") + (parts.length ? ` Pressed part way: ${parts.map(([key2, a]) => `${key2} ${pct(a)}`).join(", ")}.` : "") + (faint.length ? ` Drawn faint: ${faint.map(([key2, v]) => `${key2} ${pct(v.share)} for ${v.hole} (${open[v.hole].toFixed(2)} open), which it moves only with ${v.moves.join(", ")}`).join("; ")}.` : "") + (off.length ? ` Left otherwise than they stand: ${off.map((h) => `${h} (${open[h].toFixed(2)} open)`).join(", ")}.` : "") + (d.undrawn.length ? ` Also pressed, with no place in LilyPond's ${w.diagram} diagram: ${d.undrawn.join(", ")}.` : "") + (unkeyed.length ? ` Dialled, with no key on its diagram: ${unkeyed.join(", ")}.` : "");
  }
  drawnFor = key;
  $2("diagram").classList.toggle("brass", brass);
  $2("diagram").innerHTML = svg ?? "";
  $2("diagramNote").textContent = note;
}
var MUTE_NAME = { straight: "straight mute", cup: "cup mute", "harmon-stem-out": "harmon, stem out", "harmon-stem-in": "harmon, stem in", stopped: "stopped, the hand in the bell" };
function muteSaid() {
  if (!S.mutes?.length) return;
  const m = S.muting, name2 = (k) => k ? MUTE_NAME[k] ?? k : "no mute";
  if (document.activeElement !== $2("mute")) $2("mute").value = (m ? m.mute : S.mute) ?? "";
  $2("muteNote").textContent = m?.error ? `The ${name2(m.mute)}'s body could not be made: ${m.error}. Still played with ${name2(S.mute)}.` : m ? `${name2(m.mute)[0].toUpperCase() + name2(m.mute).slice(1)} asked: ${m.ready ? "put in as soon as the breath is let go and the bell has rung down" : `its body being made: ${m.step} (${Math.round(m.seconds)} s)`}. Played with ${name2(S.mute)} until then.` : S.mute ? `Played with its ${name2(S.mute)} in: its body's bore the mute's ring, its hollow a closed branch at its tip.` : "Played open.";
}
function said() {
  const b = P.between, partialOf = (m) => {
    const k = S.notes.indexOf(m);
    return S.partials?.[k] + (S.fingerings ? ` (${valvesName(S.fingerings[k])})` : "") + (S.positions ? ` (position ${S.positions[k]})` : "");
  };
  if (S.kind === "lips") {
    const k = P.note ?? S.notes.indexOf(P.midi), none = S.unattacked?.[k] ?? [], a = P.attack;
    $2("pitchSaid").textContent = P.lip == null ? "" : (P.slideDialled ? "The slide drawn by itself: the bore gives the pitch. " : "") + `Lips at ${P.lip.toFixed(1)} Hz: ` + (P.lipDialled ? "dialled by themselves; the bore picks the partial" : !b || b.share === 0 && b.low === b.high ? `partial ${partialOf(P.midi)}, as its lips sound it` : `between partial ${partialOf(b.low)}'s lips and ${partialOf(b.high)}'s, ${Math.round(100 * b.share)} % of the way; the bore picks the partial`) + (!a ? `. Blown from rest at ${P.dynamic}, no attack found it.` : a.share === 1 ? "." : `. Blown from rest: attacked from lips ${Math.abs(100 * (1 - a.share)).toFixed(0)} % ${a.share < 1 ? "lower" : "higher"}, settled after ${Math.round(1e3 * a.settleAfter)} ms.`) + (none.length ? ` Partial ${partialOf(P.midi)}'s attack finds it at no lips at ${none.join(", ")}.` : "") + (P.vibrato.on && P.vibrato.width > 0 ? P.vibratoHeard == null ? " Its vibrato's swing is not measured on this body." : P.vibratoHeard < P.vibrato.width - 0.05 ? ` Its vibrato heard ${P.vibratoHeard.toFixed(1)} ¢ wide, the widest its partial holds.` : "" : "");
    return;
  }
  $2("pitchSaid").textContent = !b ? "" : b.sounds == null ? `${etName(P.pitch)}: the charted note, as the rules play it.` : `${b.share > 0 && b.share < 1 ? `Between the charted ${noteName(b.low)} and ${noteName(b.high)}, ${Math.round(100 * b.share)} % of the way` : `The charted ${noteName(b.share < 1 ? b.low : b.high)}`}${Math.abs(b.sounds - P.pitch) > 5e-3 ? `; the nearest it reaches, ${etName(b.sounds)}.` : "."}`;
}
var pitchSlow = null;
var toPitch = (pitch, charted = false, dynamic = $2("dynamic").value, note = null) => {
  clearTimeout(pitchSlow);
  pitchSlow = setTimeout(() => {
    $2("pitchSaid").textContent = `Measuring the glides near ${etName(pitch)} ...`;
  }, 300);
  return sendPitch({ pitch: Math.min(Math.max(pitch, +$2("pitch").min), +$2("pitch").max), dynamic, charted, ...note != null ? { note } : {} }).finally(() => {
    clearTimeout(pitchSlow);
    if (P) said();
  });
};
$2("pitch").oninput = () => {
  $2("pitchN").value = (+$2("pitch").value).toFixed(2);
  toPitch(+$2("pitch").value);
};
$2("pitchN").onchange = () => toPitch(+$2("pitchN").value);
$2("note").onchange = () => toPitch(S.notes[+$2("note").value], true, void 0, +$2("note").value);
$2("dynamic").onchange = () => {
  const charted = P.between?.sounds == null && S.notes.includes(P.pitch);
  toPitch(P.pitch, charted, void 0, charted ? P.note : null);
};
$2("reset").onclick = async () => {
  const r = await post("/reset");
  r.error ? say(r.error) : r.pitch !== void 0 && took(r);
};
$2("neutral").onclick = async () => {
  const r = await post("/neutral");
  if (r.error) return say(r.error);
  S = await (await fetch("/winds/state", { cache: "no-store" })).json();
  shown2(S);
  if (r.pitch !== void 0) took(r);
  const k = S.neutral ? S.neutral.note : Math.floor(S.notes.length / 2);
  if (S.kind !== "air" && S.tractMeasured) setTract(VocalTract.normal(S.model, hzOf(S.notes[k])).resonances);
};
for (const r of document.querySelectorAll("input[name=w-articulation]")) r.onchange = () => sendArticulation({ articulation: r.value });
$2("repeating").onchange = () => sendRepeat({ on: $2("repeating").checked });
$2("breathing").onchange = () => {
  if (S?.model && !busy && P?.breathing) sendBreathing({ on: $2("breathing").checked });
};
$2("vibrating").onchange = () => sendVibrato({ on: $2("vibrating").checked });
$2("fluttering").onchange = () => sendFlutter({ on: $2("fluttering").checked });
$2("humming").onchange = () => sendHum({ on: $2("humming").checked });
$2("growling").onchange = () => sendGrowl({ on: $2("growling").checked });
$2("mute").onchange = () => {
  if (S?.model && !busy) sendMute({ mute: $2("mute").value || null }).finally(poll);
};
var blow = async () => {
  if (!S?.model || busy) return;
  sound2();
  const r = await post("/blow", { on: !P.blowing });
  r.error ? say(r.error) : r.pitch !== void 0 && took(r);
  if (P?.blowing) {
    clearTimeout(polling);
    polling = setTimeout(poll, 1e3);
  }
};
var tongueNow = async () => {
  if (!P?.blowing || busy) return;
  const r = await post("/tongue");
  if (r.error) say(r.error);
};
$2("blow").onclick = blow;
$2("tongueNow").onclick = tongueNow;
$2("soloSeed").value = DEFAULT_SEED;
var musebot2 = musebotControls({ box: $2("personality"), seed: $2("soloSeed"), seconds: $2("soloSeconds") });
$2("solo").onclick = async () => {
  if (!S?.model || busy) return;
  const on = !S.soloist?.playing;
  if (on) {
    sound2();
    $2("soloSaid").textContent = "Its band composes the piece ...";
  }
  const r = await post("/soloist", on ? { on, ...musebot2.given() } : { on });
  if (r.error) {
    $2("soloSaid").textContent = r.error;
    return;
  }
  if (r.pitch !== void 0) took(r);
  if (r.soloist !== void 0) {
    S = { ...S, soloist: r.soloist };
    soloShown2(S);
  }
  poll();
};
var clock = (x2) => `${Math.floor(x2 / 60)}:${String(Math.floor(x2 % 60)).padStart(2, "0")}`;
function soloShown2(s2) {
  const playing = Boolean(s2.soloist?.playing), said2 = s2.soloist?.said;
  $2("solo").textContent = playing ? "■ Stop the musebot" : "▶ A musebot plays";
  $2("solo").classList.toggle("on", playing);
  $2("solo").disabled = busy;
  musebot2.show(s2.player, said2?.personality);
  if (!said2) return;
  $2("soloSaid").textContent = `${said2.player} on the ${label(s2.model ?? said2.instrument)}, seed ${said2.seed}: ${playing ? "" : "played "}${clock(Math.min(said2.at, said2.seconds))} of ${clock(said2.seconds)}, ${said2.notes} notes` + (said2.unplayed.length ? `; ${said2.unplayed.length} not played here (${said2.unplayed[0].why})` : "") + (said2.late ? `; ${said2.late} came late` : "") + (said2.refused.length ? `; ${said2.refused.length} refused (${said2.refused.at(-1).error})` : "") + (said2.personality ? `; its register ${etName(said2.personality.register[0])} to ${etName(said2.personality.register[1])}, its motif ${said2.personality.motif}` : "") + ".";
}
$2("keep").onclick = async () => {
  const r = await post("/keep", { words: $2("words").value });
  $2("kept").textContent = r.kept ? "kept" : r.error ?? "";
  if (r.kept) $2("words").value = "";
};
var tract = new VocalTract([]);
var MEASURED = null;
var impedance = null;
var fetchingImpedance = false;
var setTract = (resonances) => {
  tract = new VocalTract(resonances);
  draw();
  sendTract({ resonances: tract.resonances });
};
$2("normal").onclick = () => setTract(VocalTract.normal(S.model, heard ?? hzOf(P.pitch)).resonances);
$2("none").onclick = () => setTract([]);
var canvas = $2("plot");
var F = [50, 6e3];
var Z = [1e5, 3e8];
var css = (name2) => getComputedStyle(document.documentElement).getPropertyValue(name2).trim();
var W2 = 0;
var H2 = 0;
var ratio = 1;
var x = (f) => W2 * Math.log(f / F[0]) / Math.log(F[1] / F[0]);
var y = (p) => H2 - H2 * Math.log(Math.max(p, Z[0]) / Z[0]) / Math.log(Z[1] / Z[0]);
var fx = (px) => F[0] * (F[1] / F[0]) ** (px / W2);
var py = (v) => Z[0] * (Z[1] / Z[0]) ** ((H2 - v) / H2);
new ResizeObserver(() => {
  const w = canvas.clientWidth, h = canvas.clientHeight, r = devicePixelRatio || 1;
  if (w === W2 && h === H2 && r === ratio) return;
  W2 = w;
  H2 = h;
  ratio = r;
  canvas.width = Math.round(W2 * ratio);
  canvas.height = Math.round(H2 * ratio);
  draw();
}).observe(canvas);
var heard = null;
var lungsHeard = null;
function draw() {
  if (!W2 || !S?.model || !P) return;
  const g = canvas.getContext("2d");
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, W2, H2);
  g.font = "11px system-ui";
  if (MEASURED) {
    g.fillStyle = css("--band");
    g.fillRect(x(MEASURED.first.f[0]), y(MEASURED.first.p[1]), x(MEASURED.first.f[1]) - x(MEASURED.first.f[0]), y(MEASURED.first.p[0]) - y(MEASURED.first.p[1]));
    g.fillStyle = css("--bend");
    g.fillRect(x(MEASURED.above), y(MEASURED.bend[1]), W2 - x(MEASURED.above), y(MEASURED.bend[0]) - y(MEASURED.bend[1]));
  }
  g.strokeStyle = css("--line");
  g.fillStyle = css("--muted");
  g.lineWidth = 1;
  for (const f of [100, 200, 500, 1e3, 2e3, 5e3]) {
    g.beginPath();
    g.moveTo(x(f), 0);
    g.lineTo(x(f), H2);
    g.stroke();
    g.fillText(f >= 1e3 ? `${f / 1e3} kHz` : `${f} Hz`, x(f) + 3, H2 - 4);
  }
  for (const p of [1e6, 1e7, 1e8]) {
    g.beginPath();
    g.moveTo(0, y(p));
    g.lineTo(W2, y(p));
    g.stroke();
    g.fillText(`${p / 1e6} MPa s/m³`, 3, y(p) - 3);
  }
  const f0 = heard ?? hzOf(P.pitch);
  g.strokeStyle = css("--harm");
  for (let h = 1; h * f0 < F[1]; h++) {
    g.lineWidth = h === 1 ? 2 : 1;
    g.beginPath();
    g.moveTo(x(h * f0), 0);
    g.lineTo(x(h * f0), H2);
    g.stroke();
  }
  if (MEASURED && f0 >= MEASURED.above) {
    g.fillStyle = css("--accent");
    g.beginPath();
    g.arc(x(f0 + MEASURED.offset), y(MEASURED.normal), 3, 0, 7);
    g.fill();
  }
  const line2 = (fn, color, width, dash = []) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash);
    g.beginPath();
    for (let px = 0; px <= W2; px += 2) {
      const v = fn(fx(px));
      px ? g.lineTo(px, y(v)) : g.moveTo(px, y(v));
    }
    g.stroke();
    g.setLineDash([]);
  };
  const bore = impedance?.notes?.[P.midi] ?? impedance?.fingerings?.[P.fingering] ?? (P.position != null ? impedance?.positions?.[String(Math.min(7, Math.max(1, Math.round(P.position))))] : null) ?? impedance?.bore;
  if (bore) {
    const at = (f) => {
      const fs = impedance.freqs;
      let lo = 0, hi = fs.length - 1;
      if (f <= fs[0]) return 0;
      if (f >= fs[hi]) return hi;
      while (hi - lo > 1) {
        const m = lo + hi >> 1;
        fs[m] <= f ? lo = m : hi = m;
      }
      return lo;
    };
    line2((f) => {
      const k = at(f);
      return Math.hypot(bore.re[k], bore.im[k]);
    }, css("--bore"), 1.5);
    if (tract.resonances.length) line2((f) => {
      const k = at(f), t = tract.impedance(f);
      return Math.hypot(bore.re[k] + t.re, bore.im[k] + t.im);
    }, css("--sum"), 1, [5, 4]);
  }
  if (tract.resonances.length) line2((f) => tract.magnitude(f), css("--accent"), 2.5);
  g.fillStyle = css("--accent");
  tract.resonances.forEach((r) => {
    g.beginPath();
    g.arc(x(r.frequency), y(r.peak), 7, 0, 7);
    g.fill();
    g.fillText(`${r.frequency.toFixed(0)} Hz, Q ${r.q.toFixed(1)}, ${(r.peak / 1e6).toFixed(1)} MPa s/m³`, x(r.frequency) + 10, y(r.peak) - 8);
  });
}
function legend() {
  const brass = S.kind === "lips", air = S.kind === "air";
  $2("legend").textContent = `Grey: the bore's input impedance ${brass ? S.slide ? "at its slide's nearest position" : S.valves ? "at its fingering, as its valves stand (each pressed past half way)" : "(its one fingering, open)" : "for the nearest charted fingering"}${impedance ? "" : " (being computed: a minute or two, the first time)"}. ` + (air ? "The jet is blown from the mouth's pressure: no tract stands before it in the engine. " : `Red: the tract's impedance; dashed: the two in series, what the ${brass ? "lips meet" : "reed meets"}. `) + "Blue lines: the pitch heard and its harmonics. " + (MEASURED ? `Shaded: measured -- clarinettists' first resonance (Fritz & Wolfe 2005), and above ${MEASURED.above} Hz the peaks of bends and glissandi (Chen, Smith & Wolfe 2009); the dot, where their tract sits in normal playing, ${MEASURED.offset} Hz above the note.` : air ? "" : `No ${label(S.model)} players' tract is measured yet: double-click to add a resonance.`);
}
var dragging = -1;
var near = (e) => {
  const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, pyy = e.clientY - r.top;
  return { px, pyy, k: tract.resonances.findIndex((q) => Math.hypot(x(q.frequency) - px, y(q.peak) - pyy) < 12) };
};
var tractOn = () => S?.model && S.kind !== "air" && !busy;
canvas.onpointerdown = (e) => {
  if (!tractOn()) return;
  const { k } = near(e);
  if (k >= 0) {
    dragging = k;
    canvas.setPointerCapture(e.pointerId);
  }
};
canvas.onpointermove = (e) => {
  if (dragging < 0) return;
  const { px, pyy } = near(e), r = [...tract.resonances];
  r[dragging] = { ...r[dragging], frequency: fx(Math.min(Math.max(px, 0), W2)), peak: py(Math.min(Math.max(pyy, 0), H2)) };
  setTract(r);
};
canvas.onpointerup = () => {
  dragging = -1;
};
canvas.onwheel = (e) => {
  if (!tractOn()) return;
  const { k } = near(e);
  if (k < 0) return;
  e.preventDefault();
  const r = [...tract.resonances];
  r[k] = { ...r[k], q: Math.min(Math.max(r[k].q * 1.08 ** -Math.sign(e.deltaY), 0.5), 60) };
  setTract(r);
};
canvas.ondblclick = (e) => {
  if (!tractOn()) return;
  const { px, pyy, k } = near(e), r = [...tract.resonances];
  if (k >= 0) r.splice(k, 1);
  else r.push({ frequency: fx(px), q: 8, peak: py(pyy) });
  setTract(r);
};
var RATE = 48e3;
var RING2 = `class Ring extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(${RATE * 2});this.r=0;this.w=0;this.n=0;this.under=0;this.t=0;
this.port.onmessage=({data})=>{this.s=1;for(let i=0;i<data.length&&this.n<this.b.length;i++){this.b[this.w]=data[i];this.w=(this.w+1)%this.b.length;this.n++}}}
process(_,outs){const o=outs[0];for(let i=0;i<o[0].length;i++){let v=0;if(this.n>0){v=this.b[this.r];this.r=(this.r+1)%this.b.length;this.n--}else if(this.s)this.under++;for(const c of o)c[i]=v}
if(++this.t%4===0)this.port.postMessage({n:this.n,under:this.under});return true}}registerProcessor('ring',Ring);`;
var AHEAD = Math.round(RATE * 0.12);
var BLOCK = 2048;
var recent = new Float32Array(4096);
var SHORT_SECONDS = 5;
var started2 = null;
var context2 = null;
var pulling = false;
var buffered = 0;
var under = 0;
var pace = null;
var shorts = [];
function sound2() {
  if (started2) {
    if (context2?.state === "suspended") context2.resume();
    return;
  }
  started2 = (async () => {
    context2 = new AudioContext({ sampleRate: RATE });
    await context2.audioWorklet.addModule(URL.createObjectURL(new Blob([RING2], { type: "text/javascript" })));
    const node = new AudioWorkletNode(context2, "ring", { numberOfInputs: 0, outputChannelCount: [2] });
    node.connect(context2.destination);
    const pull = async () => {
      if (pulling || buffered >= AHEAD || !active) return;
      pulling = true;
      try {
        const r = await fetch(`/winds/audio?frames=${BLOCK}`);
        pace = Number(r.headers.get("x-pace")) || pace;
        lungsHeard = r.headers.get("x-lungs");
        if (r.headers.get("x-model") && r.headers.get("x-version") !== String(V)) poll();
        const samples = new Float32Array(await r.arrayBuffer());
        buffered += samples.length;
        node.port.postMessage(samples);
        recent.copyWithin(0, samples.length);
        recent.set(samples, recent.length - samples.length);
      } finally {
        pulling = false;
      }
      pull();
    };
    node.port.onmessage = ({ data }) => {
      buffered = data.n;
      under = data.under;
      pull();
    };
    pull();
  })();
}
setInterval(() => {
  if (!active || !started2 || !S?.model || !P) return;
  const p = yinPitch(recent, RATE, { maxHz: 2500 }), rms = Math.sqrt(recent.reduce((a, v) => a + v * v, 0) / recent.length);
  heard = p.hz && p.clarity > 0.8 ? p.hz : null;
  $2("heard").textContent = heard ? `${heard.toFixed(1)} Hz = ${etName(69 + 12 * Math.log2(heard / 440))}, ${(1200 * Math.log2(heard / hzOf(P.pitch))).toFixed(0)} ¢ from the pitch asked` : P.blowing && pace != null && !(rms > 1e-5) ? `blown, but no tone: the ${label(S.model)}'s model does not sound this note here` : "--";
  const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  $2("level").textContent = db > -120 ? `${db.toFixed(1)} dBFS` : "silent";
  $2("meter").style.width = `${Math.max(0, Math.min(100, (db + 60) / 60 * 100))}%`;
  if (lungsHeard && P.breathing) {
    const [air, taking2] = lungsHeard.split(" ").map(Number), share = Math.max(0, Math.min(1, air / P.breathing.litres));
    $2("air").style.width = `${100 * share}%`;
    $2("airN").textContent = taking2 ? "breathing in" : !P.breathing.on ? "unbreathing" : `${Math.max(0, air).toFixed(2)} L`;
  }
  const now = performance.now() / 1e3;
  shorts.push([now, under]);
  while (shorts[0][0] < now - SHORT_SECONDS) shorts.shift();
  const short = (under - shorts[0][1]) / RATE * 1e3;
  $2("engine").textContent = `${pace ? `${Math.round(100 * pace)} % of real time` : "--"}${S.threads > 1 ? ` on ${S.threads} cores` : ""}; ${(buffered / RATE * 1e3).toFixed(0)} ms ahead${short > 0 ? `, ${short.toFixed(0)} ms short in the last ${SHORT_SECONDS} s` : ""}`;
  draw();
}, 150);
async function settings2() {
  const r = await fetch("/winds/settings", { cache: "no-store" }), got = await r.json();
  if (!r.ok) throw new Error(got.error);
  return {
    model: got.model,
    settings: got,
    words: $2("words").value,
    heard: { hz: heard, level: $2("level").textContent, heardAs: $2("heard").textContent, blowing: Boolean(P?.blowing), pace, threads: S?.threads ?? null }
  };
}
async function load2(file, { wait = 120 } = {}) {
  for (let k = 0; k < wait * 4 && !(S?.model === file.model && !busy && !S.loading && !S.muting && V === S.version); k++) await new Promise((go) => setTimeout(go, 250));
  if (S?.model !== file.model || busy) throw new Error(`the ${label(file.model)} was not taken up`);
  const r = await post("/settings", { settings: file.settings });
  if (r.error) throw new Error(r.error);
  if (r.pitch !== void 0) took(r);
  if (file.words) $2("words").value = file.words;
  if (r.player) S = { ...S, player: r.player };
  poll();
  return r.loaded;
}
async function take2(model2, { status: el }) {
  status = el;
  active = true;
  if (started2 && context2?.state === "suspended") context2.resume();
  if (S?.model === model2 && what) document.getElementById("what").textContent = what;
  let s2;
  try {
    s2 = await (await fetch("/winds/state", { cache: "no-store" })).json();
  } catch (error) {
    el.classList.add("failed");
    el.textContent = `The winds' dial did not answer: ${error.message}`;
    return;
  }
  if (s2.model !== model2 && (s2.loading?.model ?? s2.wanted) !== model2) {
    const r = await (await fetch("/winds/instrument", { method: "POST", body: JSON.stringify({ model: model2 }) })).json();
    if (r.error) say(r.error);
  }
  poll();
}
function rest2() {
  if (!active) return;
  if (P?.blowing && !busy) post("/blow", { on: false }).then((r) => {
    if (r.pitch !== void 0) P = r;
  });
  active = false;
  clearTimeout(polling);
  if (context2?.state === "running") context2.suspend();
}
function keys2(e) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) && !["range", "radio", "checkbox"].includes(e.target.type)) return;
  if (e.code === "Space") {
    e.preventDefault();
    blow();
  } else if (e.key === "t") tongueNow();
}

// public/shared/dial-settings.js
var SETTINGS_FORMAT = "musebots-live-dial-settings";
var SETTINGS_VERSION = 1;
var FAMILIES = ["strings", "winds"];
function settingsFile({ family: family3, model: model2, settings: settings3, words: words2 = "", heard: heard2 = null, page = null, at = /* @__PURE__ */ new Date() }) {
  if (!FAMILIES.includes(family3) || typeof model2 !== "string" || !settings3 || typeof settings3 !== "object") throw new Error("a family, its instrument and its settings");
  return `${JSON.stringify({ format: SETTINGS_FORMAT, version: SETTINGS_VERSION, saved: at.toISOString(), family: family3, model: model2, words: words2, heard: heard2, page, settings: settings3 }, null, 1)}
`;
}
var settingsFileName = (model2, at = /* @__PURE__ */ new Date()) => `${model2} ${at.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "")} settings.json`;
function readSettingsFile(text) {
  let got;
  try {
    got = JSON.parse(text);
  } catch {
    throw new Error("not a settings file: not JSON");
  }
  if (got?.format !== SETTINGS_FORMAT) throw new Error(`not a settings file (its format not "${SETTINGS_FORMAT}")`);
  if (!(got.version >= 1 && got.version <= SETTINGS_VERSION)) throw new Error(`a settings file of version ${got.version}: this page reads to ${SETTINGS_VERSION}`);
  if (!FAMILIES.includes(got.family) || typeof got.model !== "string" || !got.settings || typeof got.settings !== "object") throw new Error("a settings file with no family, instrument or settings");
  return got;
}

// native/live/live.html
var $3 = (id) => document.getElementById(id);
var label2 = (m) => m.replace(/-/g, " ");
var DIALS = { strings: strings_exports, winds: winds_exports };
var families2 = null;
var family2 = null;
var model = null;
function shown3(next) {
  for (const el of document.querySelectorAll("[data-family]")) el.hidden = el.dataset.family !== next;
}
var shownAs = (next) => {
  model = next;
  $3("instrument").value = next;
  history.replaceState(null, "", `?instrument=${encodeURIComponent(next)}`);
};
async function choose(next) {
  const to = families2.strings.instruments.includes(next) ? "strings" : "winds";
  shownAs(next);
  if (family2 && family2 !== to) DIALS[family2].rest();
  family2 = to;
  shown3(to);
  if (!families2[to].running) {
    $3("status").classList.remove("failed");
    $3("status").textContent = `Starting the ${to}' dial for the ${label2(next)} ...`;
    const r = await fetch(`/start?family=${to}&model=${encodeURIComponent(next)}`, { method: "POST" });
    const got = await r.json();
    if (!r.ok) {
      $3("status").classList.add("failed");
      $3("status").textContent = `The ${to}' dial did not start: ${got.error}`;
      return;
    }
    families2 = got;
  }
  if (model !== next) return;
  await DIALS[to].take(next, { status: $3("status"), choose: shownAs });
}
async function main() {
  families2 = await (await fetch("/families", { cache: "no-store" })).json();
  const select = $3("instrument"), group = (name2, models) => {
    const g = document.createElement("optgroup");
    g.label = name2;
    g.append(...models.map((m) => new Option(label2(m), m)));
    select.append(g);
  };
  group("Strings", families2.strings.instruments);
  group("Woodwinds", families2.winds.instruments.filter((i) => i.kind !== "lips").map((i) => i.model));
  group("Brass", families2.winds.instruments.filter((i) => i.kind === "lips").map((i) => i.model));
  select.onchange = () => {
    choose(select.value);
    select.blur();
  };
  addEventListener("keydown", (e) => family2 && DIALS[family2].keys(e));
  const asked2 = new URLSearchParams(location.search).get("instrument");
  const all = [...families2.strings.instruments, ...families2.winds.instruments.map((i) => i.model)];
  choose(all.includes(asked2) ? asked2 : families2.first);
}
var settingsSaid = (text) => {
  $3("settingsSaid").textContent = text;
};
async function saveSettings() {
  if (!family2) throw new Error("no instrument yet");
  const at = /* @__PURE__ */ new Date(), { model: m, settings: settings3, words: words2, heard: heard2 } = await DIALS[family2].settings();
  const text = settingsFile({ family: family2, model: m, settings: settings3, words: words2, heard: heard2, page: location.href, at });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = settingsFileName(m, at);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  return { text, name: a.download };
}
async function loadSettings(text) {
  const file = readSettingsFile(text);
  if (file.model !== model) {
    settingsSaid(`Taking up the ${label2(file.model)} ...`);
    await choose(file.model);
  }
  settingsSaid(`Making its settings, saved ${new Date(file.saved).toLocaleString()} ...`);
  const { made, refused } = await DIALS[file.family].load(file);
  return { file, made, refused };
}
$3("saveSettings").onclick = () => saveSettings().then(({ name: name2 }) => settingsSaid(`Saved as ${name2}.`), (error) => settingsSaid(`Not saved: ${error.message}`));
$3("loadSettings").onclick = () => $3("settingsFile").click();
$3("settingsFile").onchange = async () => {
  const chosen2 = $3("settingsFile").files[0];
  $3("settingsFile").value = "";
  if (!chosen2) return;
  try {
    const { file, made, refused } = await loadSettings(await chosen2.text());
    settingsSaid(`${chosen2.name}: the ${label2(file.model)}'s settings made (${made})${refused.length ? `; ${refused.length} refused: ${refused.map((r) => `${r.path} (${r.error})`).join("; ")}` : ""}${file.words ? ` -- "${file.words}"` : ""}.`);
  } catch (error) {
    settingsSaid(`${chosen2.name} not loaded: ${error.message}`);
  }
};
window.live = { strings: strings_exports, winds: winds_exports, choose, saveSettings, loadSettings };
main();
