// tips.test.mjs: the slime speaks seldom, and says each thing once.
//
//   node --test tips.test.mjs
//
// tips.js (MH_TIPS) decides when the slime tells the visitor what it can do, in the
// iso village (engine.js), the 3D village (slimeverse3d-page.js) and the glossary
// (glossary-world.js): an area's introduction a moment after the slime arrives and
// a quiet spell apart, the rest only in a long lull, and each tip once, remembered
// in the browser, or in the page where the browser refuses (a private window, a
// file:// page, blocked site data). These checks keep it so: the pacing on a clock
// the test drives, the memory over stores that work and stores that refuse, and
// the views wired through it with no pacing or memory of their own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("./" + f, import.meta.url), "utf8");
const SRC = read("tips.js");

/** A store as a browser keeps one. */
function store() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
/** A store that refuses everything, as a private window or blocked site data may. */
const refusing = () => ({ getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); }, removeItem() { throw new Error("SecurityError"); } });

/** tips.js, loaded into a window (with whatever stores it has) and a document. */
function load(win = {}, doc = { hidden: false }) {
  new Function("window", "document", SRC)(win, doc);
  return win.MH_TIPS;
}

/** A view on a clock the test drives: its tips, its bubble (3.4 s), and what it said when. */
function view(M, tips, more = {}) {
  let i = 0, bubble = null;
  const now = () => i / 4, said = [];
  const p = M.pace(Object.assign({
    tips: tips.map((x) => (typeof x === "string" ? { en: x, intro: true } : x)),
    say(text) { said.push({ at: now(), text }); bubble = { text, until: now() + 3.4 }; },
    saying: () => (bubble && now() < bubble.until ? bubble.text : ""),
  }, more));
  return {
    said, p, now,
    /** Run the clock to `to` seconds; the visitor does something every `every` seconds (0: never). */
    run(to, every = 0) { for (; now() < to; i++) { if (every && i % Math.round(every * 4) === 0) p.input(now()); p.tick(now()); } },
    input() { p.input(now()); },
    bubble(text, secs) { bubble = { text, until: now() + secs }; },
  };
}

const WALK = "I can walk: the arrow keys, or WASD.", OPEN = "I can open a house: press E beside it, or click it.",
  NEXT = "I can visit the next house: press Space.", MUTE = "I can go quiet: press M.", PLAZA = "I can go back to the plaza: press G.";

test("an area's introduction: one tip at a time, a moment after the start, a quiet spell apart", () => {
  const M = load({ localStorage: store() }), { first, quiet } = M.timing;
  const v = view(M, [WALK, OPEN, NEXT]);
  v.run(60, 2);                                                // the visitor busy all along: the introduction still comes
  assert.deepEqual(v.said.map((s) => s.text), [WALK, OPEN, NEXT], "the three essentials, in order");
  assert.ok(v.said[0].at >= first && v.said[0].at < first + 1, "the first a moment after the start (" + v.said[0].at + " s)");
  for (let k = 1; k < v.said.length; k++) {
    const gap = v.said[k].at - v.said[k - 1].at;                 // (less a tick: the quiet counts from the last tick the bubble was up)
    assert.ok(gap >= 3.4 + quiet - 0.25, "a quiet spell of " + quiet + " s after each bubble ends (" + gap + " s between starts)");
  }
  assert.ok(quiet >= 5, "the quiet spell is long enough to be quiet (" + quiet + " s; it was 0.7 s)");
});

test("the rest wait for a long lull, one tip a lull", () => {
  const M = load({ localStorage: store() }), { idle } = M.timing;
  assert.ok(idle >= 20, "a lull is a long while (" + idle + " s)");
  const v = view(M, [WALK, { en: MUTE }, { en: PLAZA }]);
  v.run(120, 5);                                               // the visitor keeps doing things for two minutes
  assert.deepEqual(v.said.map((s) => s.text), [WALK], "only the introduction while the visitor is busy");
  v.run(300);                                                  // then stands still
  assert.equal(v.said.length, 2, "one more tip in the lull, not two");
  assert.equal(v.said[1].text, MUTE);
  assert.ok(v.said[1].at >= 120 + idle - 5, "told only after " + idle + " s of stillness (" + v.said[1].at + " s)");
  v.input(); v.run(310);
  assert.equal(v.said.length, 2, "the visitor moves: nothing at once");
  v.run(400);
  assert.equal(v.said.length, 3, "the next lull, the next tip");
  v.run(1000);
  assert.equal(v.said.length, 3, "and then nothing: each is said once");
});

test("each tip once: not again on the next visit, nor in another view with the same words", () => {
  const local = store(), M = load({ localStorage: local, sessionStorage: store() });
  const iso = view(M, [WALK, OPEN]);
  iso.run(30);
  assert.deepEqual(iso.said.map((s) => s.text), [WALK, OPEN]);
  const again = view(M, [WALK, OPEN]);                          // the same page, opened again
  again.run(600);
  assert.equal(again.said.length, 0, "nothing said twice");
  const M2 = load({ localStorage: local, sessionStorage: store() });   // the next visit: a new page, the same browser
  const v3d = view(M2, [WALK, "I can open a house: walk me in, or click its door."]);
  v3d.run(60);
  assert.deepEqual(v3d.said.map((s) => s.text), ["I can open a house: walk me in, or click its door."], "the 3D view says only its own words");
});

test("what the visitor has done is never said, and stays done", () => {
  const local = store(), M = load({ localStorage: local });
  const used = { walk: true };
  const v = view(M, [{ en: WALK, intro: true, done: () => !!used.walk }, { en: OPEN, intro: true, done: () => !!used.open }]);
  v.run(4);
  assert.deepEqual(v.said.map((s) => s.text), [OPEN], "the walk tip skipped: the visitor walked");
  const later = view(load({ localStorage: local }), [WALK]);
  later.run(60);
  assert.equal(later.said.length, 0, "and remembered: the next visit does not say it either");
});

test("busy, or a hidden tab: a tip waits for its moment, it is not lost", () => {
  const doc = { hidden: false }, M = load({ localStorage: store() }, doc);
  let busy = true;
  const v = view(M, [WALK], { busy: () => busy });
  v.run(20);
  assert.equal(v.said.length, 0, "nothing over a card or in build mode");
  busy = false; v.run(20.25); v.run(21);
  assert.equal(v.said.length, 0, "a moment after the view is free again, not at once");
  v.run(24);
  assert.equal(v.said.length, 1, "then the tip");
  const w = view(M, [OPEN]);
  doc.hidden = true; w.run(60);
  assert.equal(w.said.length, 0, "not to a hidden tab");
  doc.hidden = false; w.run(63);
  assert.equal(w.said.length, 1, "told when the visitor is back");
});

test("a tip waits for the place where it holds, and is told a moment after the slime arrives", () => {
  const M = load({ localStorage: store() }), { first } = M.timing;
  let where = "indoors";
  const LIGHT = "I can climb out: click the light.";
  const v = view(M, [{ en: LIGHT, intro: true, holds: () => where === "cave" }], { area: () => where });
  v.run(40);
  assert.equal(v.said.length, 0, "not in the house");
  where = "cave"; v.run(40 + first - 0.25);
  assert.equal(v.said.length, 0, "not the instant it lands");
  v.run(45);
  assert.deepEqual(v.said.map((s) => s.text), [LIGHT], "in the cave, a moment after arriving");
  where = "indoors"; v.run(80); where = "cave"; v.run(120);
  assert.equal(v.said.length, 1, "and not again on the next visit to the cave");
});

test("a bubble the view says itself keeps the quiet too", () => {
  const M = load({ localStorage: store() }), { quiet } = M.timing;
  const v = view(M, [WALK, OPEN]);
  v.run(3);
  assert.equal(v.said.length, 1);
  v.run(8); v.bubble("I can take your keys now: the arrows walk me, Space goes to the next word.", 3.8);   // the glossary's own, as the keyboard arrives
  v.run(8 + 3.8 + quiet - 0.25);
  assert.equal(v.said.length, 1, "no tip until a quiet spell after it");
  v.run(8 + 3.8 + quiet + 0.5);
  assert.equal(v.said.length, 2);
});

test("the browser's stores refused, or missing: the page's own memory, and no error", () => {
  const unreachable = {};
  Object.defineProperty(unreachable, "localStorage", { get() { throw new Error("SecurityError"); } });
  Object.defineProperty(unreachable, "sessionStorage", { get() { throw new Error("SecurityError"); } });
  for (const [name, win] of [["unreachable", unreachable], ["refusing", { localStorage: refusing(), sessionStorage: refusing() }], ["missing", {}]]) {
    const M = load(win);
    const v = view(M, [WALK, OPEN]);
    v.run(40);
    assert.deepEqual(v.said.map((s) => s.text), [WALK, OPEN], name + ": the tips are still told");
    const again = view(M, [WALK, OPEN]);
    again.run(200);
    assert.equal(again.said.length, 0, name + ": and remembered for as long as the page is open");
    let spoke = 0;
    assert.equal(M.tell("I can build: drag a building to move it, or pick a tool.", () => spoke++), true);
    assert.equal(M.tell("I can build: drag a building to move it, or pick a tool.", () => spoke++), false);
    assert.equal(spoke, 1, name + ": a build tip once");
  }
  // localStorage refused but sessionStorage working: remembered for the visit
  const session = store();
  load({ localStorage: refusing(), sessionStorage: session }).memory.add(WALK);
  assert.equal(load({ localStorage: refusing(), sessionStorage: session }).memory.has(WALK), true, "sessionStorage keeps it for the visit");
  // a store holding something unreadable: ignored, not thrown
  const bad = store(); bad.setItem("mh-told", "{not json");
  const M = load({ localStorage: bad });
  assert.equal(M.memory.has(WALK), false);
  M.memory.add(WALK);
  assert.equal(load({ localStorage: bad }).memory.has(WALK), true, "and written over with good");
});

test("the views pace their tips through tips.js, with no clock or memory of their own", () => {
  const files = { "engine.js": "index.html", "slimeverse3d-page.js": "slimeverse3d.html", "glossary-world.js": "glossary.html" };
  for (const [js, html] of Object.entries(files)) {
    const src = read(js), page = read(html);
    assert.ok(/window\.MH_TIPS/.test(src) && /\.start\(\{\s*tips:/.test(src), js + " paces its tips with MH_TIPS.start");
    assert.ok(!/mh-tips-(iso|3d|glossary)/.test(src), js + " keeps no once-a-visit flag of its own");
    assert.ok(!/setTimeout\((next|nextTip), \d+\)/.test(src), js + " has no tip clock of its own");
    const at = (f) => page.indexOf('src="' + f + '"');
    assert.ok(at("tips.js") > 0 && at("tips.js") < at(js), html + " loads tips.js before " + js);
    const intro = [...src.matchAll(/\[\s*"\w+",\s*"[\w.]+",\s*"[^"]+",\s*"intro"\s*\]/g)].length;
    assert.ok(intro >= 2, js + " marks its essentials \"intro\" (" + intro + ")");
  }
  // the iso build tips are said once, through tellTip, never straight to the bubble
  const iso = read("engine.js");
  assert.ok(!/\bsay\(tr\("world\.tip\./.test(iso), "engine.js says no tip straight to the bubble");
  assert.ok(/tellTip\(BUILD_TIPS\.build/.test(iso), "build mode is introduced once");
  assert.ok(/tellTip\(BUILD_TIPS\.move/.test(iso), "the tip on a click on something built is said once");
});
