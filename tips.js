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
                              ended, whoever said it (quiet). Said the first time
                              the slime comes to each view in a visit, whatever
                              another view has said: each view's essentials are
                              remembered for the visit only, and by that view
                              (sessionStorage, by the page's path), so entering
                              the 3D village for the first time says how to walk
                              there even after the iso village did
     the rest                 only in a lull: the visitor still, and the slime
                              quiet, for a long while (idle); one tip a lull
     the rest, once a day     each other tip is said once, then not again for a while
                              (forget: 12 hours). What the slime has said, or
                              seen the visitor do, is remembered in this browser
                              by its English words and the time (localStorage,
                              else sessionStorage, else this page's own memory),
                              so it is not said again that day, nor in another
                              view that has the same words; a visitor back the
                              next day hears the essentials again. (Remembered
                              for good, the tips were soon never heard at all:
                              26 Sept 2026.)
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
   MH_TIPS.memory           has(en), add(en), forget(): what has been said lately
   MH_TIPS.visit            the same for each view's essentials this visit (view|en)
   MH_TIPS.timing           { first, quiet, idle, forget } in seconds, read on every tick
   ========================================================================== */
(function () {
  const KEY = "mh-told", VISIT_KEY = "mh-told-visit";
  const timing = { first: 2, quiet: 6, idle: 25, forget: 12 * 3600 };
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

  /** What has been said lately, kept in each of these stores that works: each tip's
   *  English words and when (ms). Older than timing.forget, it may be said again (a
   *  word kept before times were, as 1, is long past). @param {Storage[]} stores
   *  @param {() => number} [clock] milliseconds (a test brings its own) */
  function memoryIn(stores, clock = () => Date.now(), key = KEY, forget = () => timing.forget) {
    /** @type {Record<string, number>} */ const seen = Object.create(null);
    const load = () => {
      for (const s of stores) {
        try {
          const v = JSON.parse(s.getItem(key) || "{}");
          if (v && typeof v === "object") for (const k of Object.keys(v)) seen[k] = Math.max(seen[k] || 0, Number(v[k]) || 0);
        } catch (e) { /* unreadable or refused: the others, or the page's own */ }
      }
    };
    const lately = (en) => !!seen[en] && clock() - seen[en] < forget() * 1000;
    load();
    return {
      load,
      /** @param {string} en */
      has: lately,
      /** @param {string} en */
      add(en) {
        if (!en || lately(en)) return;
        load();                                        // another view or tab may have said some since
        seen[en] = clock();
        const text = JSON.stringify(seen);
        for (const s of stores) { try { s.setItem(key, text); } catch (e) { /* full or refused: the page remembers */ } }
      },
      forget() {
        for (const k of Object.keys(seen)) delete seen[k];
        for (const s of stores) { try { s.removeItem(key); } catch (e) { /* fine */ } }
      },
    };
  }
  const memory = memoryIn(reachable());
  /** Each view's essentials said this visit: sessionStorage only (else the page), for good within it. */
  const visitMemory = (stores) => memoryIn(stores.filter((s) => { try { return s === window.sessionStorage; } catch (e) { return false; } }), undefined, VISIT_KEY, () => Infinity);
  const visit = visitMemory(reachable());
  /** The view a page is: its path (the iso village at / and at /index.html is one view). */
  const viewPath = () => { try { return String(location.pathname || "page").replace(/\/$/, "/index.html"); } catch (e) { return "page"; } };
  try {
    // back to a page kept in the back-forward cache, or another tab: catch up with what was said there
    window.addEventListener("pageshow", () => memory.load());
    window.addEventListener("storage", (e) => { if (!e || e.key === KEY || e.key == null) memory.load(); });
  } catch (e) { /* no window events (a test): fine */ }

  const hidden = () => typeof document !== "undefined" && !!document.hidden;

  /** A view's tips, paced. Pure: the caller brings the clock (seconds). */
  function pace(o) {
    const M = o.memory || memory, V = o.visit || visit, view = o.view || viewPath();
    const tips = (o.tips || []).filter((t) => t && t.en);
    // an essential is remembered by this view for the visit; the rest by its words for a while
    const said = (t) => (t.intro ? V.has(view + "|" + t.en) : M.has(t.en));
    const mark = (t) => { if (t.intro) V.add(view + "|" + t.en); M.add(t.en); };
    let here = "", since = /** @type {number|null} */ (null), quiet = -Infinity, still = /** @type {number|null} */ (null), lulled = false;
    const api = {
      /** @param {number} now */
      tick(now) {
        for (const t of tips) if (t.done && !said(t) && t.done()) mark(t);           // the visitor has done it: no need to say it
        if (o.saying && o.saying()) { quiet = now; return; }                        // a bubble up: the quiet starts when it ends
        if ((o.busy && o.busy()) || hidden()) { since = null; return; }            // busy: wait, and arrive again after
        const at = o.area ? String(o.area()) : "";
        if (since == null || at !== here) { here = at; since = now; }
        if (still == null) still = now;
        if (now - since < timing.first || now - quiet < timing.quiet) return;
        const left = tips.filter((t) => !said(t) && (!t.holds || t.holds()));
        if (!left.length) return;
        let tip = left.find((t) => t.intro);
        if (!tip) {                                                                   // the rest: one in a long lull
          if (lulled || now - still < timing.idle || now - quiet < timing.idle) return;
          tip = left[0]; lulled = true;
        }
        mark(tip); quiet = now;
        o.say(tip.text ? tip.text() : tip.en);
      },
      /** The visitor did something: a lull starts again from now. @param {number} now */
      input(now) { still = now; lulled = false; },
      /** How many of the view's tips are still to say. */
      left: () => tips.filter((t) => !said(t)).length,
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

  /** Remember a tip as said without saying it, here and in this view's visit (needless). @param {string} en */
  function settle(en) { memory.add(en); visit.add(viewPath() + "|" + en); }

  window.MH_TIPS = { timing, memory, visit, memoryIn, visitMemory, pace, start, tell, settle, KEY, VISIT_KEY };
})();
