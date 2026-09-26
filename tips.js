// @ts-check
"use strict";
/* ============================================================================
   tips.js  ·  MH_TIPS  ·  when the slime says what it can do, in every world
   ----------------------------------------------------------------------------
   In the iso village (engine.js), the 3D village (slimeverse3d-page.js) and the
   glossary (glossary-world.js) the slime tells the visitor what it can do, in the
   first person, in a bubble over it ("I can walk: the arrow keys, or WASD.").
   Each view keeps its own words. WHEN the slime says them is decided here, the
   same way in every view, so the views cannot drift apart:

     an area's introduction   its essential tips (intro), one at a time: the
                              first a moment after the slime arrives (first),
                              each after a quiet spell since the last bubble
                              ended, whoever said it (quiet)
     the rest                 only in a lull: the visitor still, and the slime
                              quiet, for a long while (idle); one tip a lull
     once                     each tip is said once. What the slime has said,
                              or seen the visitor do, is remembered in this
                              browser by its English words (localStorage, else
                              sessionStorage, else this page's own memory), so
                              it is not said again on the next visit, nor in
                              another view that has the same words
     never over anything      not while the view is busy (a card open, build
                              mode, a way between places) or the tab hidden: a
                              tip waits for its moment, it is not lost

   MH_TIPS.start(o)  paces a view's tips on its own clock (a page):
     o.tips       [{ en, text(), intro, holds(), done() }]: the English words
                  (the memory's key), the words in the reader's language, whether
                  it is one of the area's essentials, where it holds (optional:
                  a tip waits for a place where it is true), and whether the
                  visitor has done it already (optional)
     o.say(text)  show the bubble
     o.saying()   the words in a bubble now, or "" (any bubble: the quiet
                  spell starts when it ends)
     o.busy()     true while no tip may start (optional)
     o.area()     where the slime is (optional): arriving somewhere new waits
                  a moment again, then says what holds there
     returns { tick, input, left, stop }
   MH_TIPS.pace(o)          the same without a clock: tick(now), input(now),
                            left() (tips.test.mjs drives it)
   MH_TIPS.tell(en, speak)  a tip said in answer to the visitor (build mode):
                            speak() once, and never again
   MH_TIPS.settle(en)       remember a tip as said without saying it (needless)
   MH_TIPS.memory           has(en), add(en), forget(): what has been said
   MH_TIPS.timing           { first, quiet, idle } in seconds, read on every tick
   ========================================================================== */
(function () {
  const KEY = "mh-told";
  const timing = { first: 2, quiet: 6, idle: 25 };
  const TICK_MS = 250;

  /** The browser's stores that can be reached. A private window, blocked site data
   *  or a sandboxed frame may refuse either, reading or writing; whatever is left,
   *  the page's own memory still holds for as long as the page is open. */
  function reachable() {
    const out = [];
    for (const name of ["localStorage", "sessionStorage"]) {
      try { const s = window[name]; if (s && typeof s.getItem === "function") out.push(s); } catch (e) { /* refused: the next */ }
    }
    return out;
  }

  /** What has been said, kept in each of these stores that works. @param {Storage[]} stores */
  function memoryIn(stores) {
    /** @type {Record<string, 1>} */ const seen = Object.create(null);
    const load = () => {
      for (const s of stores) {
        try {
          const v = JSON.parse(s.getItem(KEY) || "{}");
          if (v && typeof v === "object") for (const k of Object.keys(v)) seen[k] = 1;
        } catch (e) { /* unreadable or refused: the others, or the page's own */ }
      }
    };
    load();
    return {
      load,
      /** @param {string} en */
      has: (en) => !!seen[en],
      /** @param {string} en */
      add(en) {
        if (!en || seen[en]) return;
        load();                                        // another view or tab may have said some since
        seen[en] = 1;
        const text = JSON.stringify(seen);
        for (const s of stores) { try { s.setItem(KEY, text); } catch (e) { /* full or refused: the page remembers */ } }
      },
      forget() {
        for (const k of Object.keys(seen)) delete seen[k];
        for (const s of stores) { try { s.removeItem(KEY); } catch (e) { /* fine */ } }
      },
    };
  }
  const memory = memoryIn(reachable());
  try {
    // back to a page kept in the back-forward cache, or another tab: catch up with what was said there
    window.addEventListener("pageshow", () => memory.load());
    window.addEventListener("storage", (e) => { if (!e || e.key === KEY || e.key == null) memory.load(); });
  } catch (e) { /* no window events (a test): fine */ }

  const hidden = () => typeof document !== "undefined" && !!document.hidden;

  /** A view's tips, paced. Pure: the caller brings the clock (seconds). */
  function pace(o) {
    const M = o.memory || memory;
    const tips = (o.tips || []).filter((t) => t && t.en);
    let here = "", since = /** @type {number|null} */ (null), quiet = -Infinity, still = /** @type {number|null} */ (null), lulled = false;
    const api = {
      /** @param {number} now */
      tick(now) {
        for (const t of tips) if (t.done && !M.has(t.en) && t.done()) M.add(t.en);   // the visitor has done it: no need to say it
        if (o.saying && o.saying()) { quiet = now; return; }                        // a bubble up: the quiet starts when it ends
        if ((o.busy && o.busy()) || hidden()) { since = null; return; }            // busy: wait, and arrive again after
        const at = o.area ? String(o.area()) : "";
        if (since == null || at !== here) { here = at; since = now; }
        if (still == null) still = now;
        if (now - since < timing.first || now - quiet < timing.quiet) return;
        const left = tips.filter((t) => !M.has(t.en) && (!t.holds || t.holds()));
        if (!left.length) return;
        let tip = left.find((t) => t.intro);
        if (!tip) {                                                                   // the rest: one in a long lull
          if (lulled || now - still < timing.idle || now - quiet < timing.idle) return;
          tip = left[0]; lulled = true;
        }
        M.add(tip.en); quiet = now;
        o.say(tip.text ? tip.text() : tip.en);
      },
      /** The visitor did something: a lull starts again from now. @param {number} now */
      input(now) { still = now; lulled = false; },
      /** How many of the view's tips are still to say. */
      left: () => tips.filter((t) => !M.has(t.en)).length,
      stop() { /* start() gives it a clock to stop */ },
    };
    return api;
  }

  /** A view's tips, paced on the page's own clock and the visitor's input. */
  function start(o) {
    const p = pace(o), now = () => performance.now() / 1000;
    const heard = () => p.input(now());
    const EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"], opts = { capture: true, passive: true };
    for (const e of EVENTS) document.addEventListener(e, heard, opts);
    const timer = setInterval(() => { p.tick(now()); if (!p.left()) p.stop(); }, TICK_MS);
    p.stop = () => { clearInterval(timer); for (const e of EVENTS) document.removeEventListener(e, heard, opts); };
    return p;
  }

  /** Said in answer to the visitor: once, and never again. @param {string} en @param {() => void} speak */
  function tell(en, speak) {
    if (!en || memory.has(en)) return false;
    memory.add(en); speak();
    return true;
  }

  window.MH_TIPS = { timing, memory, memoryIn, pace, start, tell, settle: (en) => memory.add(en), KEY };
})();
