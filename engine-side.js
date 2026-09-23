// @ts-check
"use strict";
/* ============================================================================
   engine-side.js  ·  MH_SIDE  ·  a sidescrolling world for the site's slime
   ----------------------------------------------------------------------------
   The second of the site's three engines (engine.js is the isometric one,
   engine-3d.js the third-person one). A world here is a closed circuit: one
   axis, worldW long, wrapping, with a floor the world describes as a function
   ground(x). This file owns everything that is the same for any such world:

     the circuit    wrap(x), rd(d) the shorter way round, every(aim) a spacing
                    that divides the circuit exactly so scenery repeats seamlessly
     the camera     cam, the world point at the centre of the view, easing after
                    the body; sx(x, depth) puts a world x on screen with a
                    centre-anchored parallax for anything set back
     the frame      zoom (a bigger window shows a bigger world, not a wider one),
                    base (the floor line, leaving room under it), DPR, the loop,
                    pausing when the canvas leaves the viewport
     the body       slime-2d.js's slime, walking, falling, landing, wading, leaning
                    into slopes, with its underside taking the floor's shape
     the water      standing water in the floor's dips: a one-dimensional height
                    field stepped by the wave equation, damped, sprung back to
                    level, disturbed by wading (the lizard world's surface water)
     the input      arrows or A and D to walk, shift to hurry, click or drag to
                    send the body somewhere; the keys stay quiet in a text field
                    and go silent on blur

   The world file (glossary-world.js is the first) supplies ground(), draws
   everything in draw(g), and reacts in onStep(dt) and onSize(). It reaches
   the engine's state through the object create() returns.

     const S = MH_SIDE.create(canvas, { worldW, ground, draw, onStep, onSize, keys });
   ========================================================================== */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  /** Blend two #rrggbb by t, as rgb(). */
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," + Math.round(A[1] + (B[1] - A[1]) * t)
      + "," + Math.round(A[2] + (B[2] - A[2]) * t) + ")";
  }
  function rgba(h, a) { const c = hex(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function create(canvas, o) {
    const S2 = window.MH_SLIME2D;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    const worldW = o.worldW;
    const body = Object.assign({ r: 15, tension: 0.55, walk: 168, run: 340, gravity: 900 }, o.body || {});
    // line: the waterline, a screen y; or flood: the share of the floor to put under it
    const water = Object.assign({ c: 16, damp: 2.2, k: 7, max: 12, line: null, flood: 0.2, minWidth: 40, step: 5 }, o.water || {});
    const fit = Object.assign({ h: 300, w: 560, max: 2, baseFrac: 0.30, baseMin: 84 }, o.fit || {});
    const S = {
      g, canvas, worldW, W: 0, H: 0, base: 0, zoom: 1,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      reduce: !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      cam: 0, target: /** @type {number|null} */ (null), dragging: false,
      keys: { left: false, right: false, shift: false },
      /** @type {any[]} */ pools: [],
      me: { x: 0, vx: 0, face: 1, t: 0, airY: -60, vy: 0, flying: true, contact: 1, squash: 0, pop: 0, wob: 0, amp: 0 },
      body, water,
    };
    const me = S.me, keys = S.keys;
    const wrap = (x) => ((x % worldW) + worldW) % worldW;
    function rd(d) { d = ((d % worldW) + worldW) % worldW; return d > worldW / 2 ? d - worldW : d; }
    const every = (aim) => worldW / Math.max(1, Math.round(worldW / aim));
    S.wrap = wrap; S.rd = rd; S.every = every;
    /** Where world x lands on screen. `depth` under 1 sets it back: parallax
     *  about the centre, so a thing set back is in front of the body exactly
     *  when it shares the body's world x. */
    S.sx = (x, depth) => S.W / 2 + rd(x - S.cam) * (depth == null ? 1 : depth);
    const ground = (x) => o.ground(x);
    S.ground = ground;

    /* ── standing water ───────────────────────────────────────────────── */
    /** ONE waterline for the whole world. The world gives it as water.line (a
     *  screen y), or the engine chooses it so that `flood` of the floor lies
     *  under it. Every stretch of floor below the line is a pool, each with its
     *  own height field, and a stretch that runs through the seam is one pool.
     *  Other lines, if a world ever wants a perched pool, are exceptions to be
     *  added on top of this, not a second rule. */
    S.findPools = () => {
      const P = S.pools; P.length = 0;
      const STEP = water.step, N = Math.ceil(worldW / STEP);
      let line = water.line;
      if (line == null) {                                    // the (1 - flood) quantile of the floor: deeper is larger y
        const ys = new Float64Array(N);
        for (let i = 0; i < N; i++) ys[i] = ground(i * STEP);
        ys.sort();
        line = ys[Math.min(N - 1, Math.floor((1 - clamp(water.flood, 0.01, 0.99)) * N))];
      }
      S.level = line;
      const wetAt = (x) => ground(x) > line;
      let x0 = 0;                                            // start the scan on dry floor, so a run through the seam is whole
      while (x0 < worldW && wetAt(x0)) x0 += STEP;
      if (x0 >= worldW) x0 = 0;                              // everything is under water: one pool round the world
      /** The shore between a dry x and a wet x, by bisection. */
      const shore = (dry, wet) => { for (let k = 0; k < 8; k++) { const m = (dry + wet) / 2; if (wetAt(m)) wet = m; else dry = m; } return (dry + wet) / 2; };
      let x = x0;
      while (x < x0 + worldW) {
        if (!wetAt(x)) { x += STEP; continue; }
        let lo = x, deepest = x, deep = ground(x);
        while (x < x0 + worldW && wetAt(x)) { const gy = ground(x); if (gy > deep) { deep = gy; deepest = x; } x += STEP; }
        const hi = x;                                        // first dry sample past the run
        const a = lo === x0 && wetAt(x0) ? lo : shore(lo - STEP, lo), b = x >= x0 + worldW ? hi : shore(hi, hi - STEP);
        const width = b - a;
        if (width < water.minWidth) continue;
        const n = clamp(Math.round(width / 7), 6, 160);
        P.push({ x: deepest, lo: a, hi: b, width, n, dx: width / (n - 1), level: line,
          h: new Float64Array(n), v: new Float64Array(n), next: new Float64Array(n), amp: 4.5 });
        if (P.length >= water.max) break;
      }
    };
    /** Is any of this pool within a screen of the view? */
    const near = (q) => { const d = rd(S.cam - q.lo); return d > -S.W && d < q.width + S.W; };
    /** How far into a pool x is, wrapped: 0..width inside it. */
    const along = (q, x) => rd(x - q.lo);
    /** Where a pool's surface stands at x, ripples included. */
    S.surfaceAt = (q, x) => {
      const u = clamp(along(q, x) / q.dx, 0, q.n - 1), i = Math.floor(u), j = Math.min(q.n - 1, i + 1);
      return q.level + lerp(q.h[i], q.h[j], u - i);
    };
    /** The pool the body is standing in, if any: over a pool's run, with the floor under the line. */
    S.poolAt = (x) => {
      for (const q of S.pools) { const d = along(q, x); if (d >= 0 && d <= q.width && ground(x) > q.level) return q; }
      return null;
    };
    S.disturb = (q, x, impulse) => {
      const rad = Math.max(q.dx * 1.6, Math.min(q.width * 0.16, 60)), idx = along(q, x) / q.dx;
      for (let i = 0; i < q.n; i++) {
        const d = Math.abs(i - idx) * q.dx;
        if (d > rad) continue;
        q.v[i] += clamp(impulse, -60, 60) * (0.5 + 0.5 * Math.cos(Math.PI * d / rad));
      }
    };
    S.stepWater = (dt) => {
      const c2 = water.c * water.c;
      for (const q of S.pools) {
        if (!near(q)) continue;                              // only what is on screen moves
        const dx2 = q.dx * q.dx;
        for (let i = 0; i < q.n; i++) {
          const l = i === 0 ? q.h[1] : q.h[i - 1], r = i === q.n - 1 ? q.h[q.n - 2] : q.h[i + 1];
          // waves, damping, and a spring back to level. The spring matters: the
          // Laplacian of a flat displacement is zero, so a pool pushed up all
          // over would otherwise never come back down.
          q.v[i] += (c2 * (l - 2 * q.h[i] + r) / dx2 - water.damp * q.v[i] - water.k * q.h[i]) * dt;
          q.next[i] = clamp(q.h[i] + q.v[i] * dt, -q.amp, q.amp);
          if (q.next[i] === q.amp || q.next[i] === -q.amp) q.v[i] = 0;
        }
        q.h.set(q.next);
      }
    };
    /** Draw every pool on screen: fillFor(q, top, bottom) and strokeFor(q) give
     *  the colours, so the world decides how its water looks. The water is drawn
     *  in WET RUNS, where the floor lies under the surface. Where the floor comes
     *  up through the water (a plinth under a word, a bump in the basin) that is
     *  an island: the water laps its sides, ending exactly where floor meets
     *  surface. One polygon for the whole pool inverted there and left a hole
     *  with vertical walls. under(g, q, x0, x1, top, bottom), if given, paints
     *  inside each run before its fill (a texture seen through the water). */
    S.drawWater = (fillFor, strokeFor, under) => {
      for (const q of S.pools) {
        if (!near(q)) continue;
        const wx = (i) => q.lo + i * q.dx, surf = (i) => q.level + q.h[i];
        const wet = (i) => ground(wx(i)) > surf(i);           // screen y grows downward: under the surface
        /** The shoreline between wet sample w and dry sample d, by interpolation. */
        const shore = (w, d) => {
          if (d < 0 || d >= q.n) return [wx(w), surf(w)];
          const fw = ground(wx(w)) - surf(w), fd = ground(wx(d)) - surf(d), t = fw / (fw - fd || 1);
          return [wx(w) + (wx(d) - wx(w)) * t, surf(w) + (surf(d) - surf(w)) * t];
        };
        const fill = fillFor(q, q.level - 6, q.level + 16), stroke = strokeFor(q);
        let i = 0;
        while (i < q.n) {
          while (i < q.n && !wet(i)) i++;
          if (i >= q.n) break;
          let j = i;
          while (j + 1 < q.n && wet(j + 1)) j++;
          const a = shore(i, i - 1), b = shore(j, j + 1);
          g.beginPath();
          g.moveTo(S.sx(a[0]), a[1]);
          for (let k = i; k <= j; k++) g.lineTo(S.sx(wx(k)), surf(k));
          g.lineTo(S.sx(b[0]), b[1]);
          for (let k = j; k >= i; k--) g.lineTo(S.sx(wx(k)), ground(wx(k)) + 1);
          g.closePath();
          if (under) {
            let deep = -Infinity;
            for (let k = i; k <= j; k++) deep = Math.max(deep, ground(wx(k)));
            g.save(); g.clip(); under(g, q, S.sx(a[0]), S.sx(b[0]), q.level, deep); g.restore();
            g.beginPath();                                   // the run again, for the fill
            g.moveTo(S.sx(a[0]), a[1]);
            for (let k = i; k <= j; k++) g.lineTo(S.sx(wx(k)), surf(k));
            g.lineTo(S.sx(b[0]), b[1]);
            for (let k = j; k >= i; k--) g.lineTo(S.sx(wx(k)), ground(wx(k)) + 1);
            g.closePath();
          }
          g.fillStyle = fill; g.fill();
          g.strokeStyle = stroke; g.lineWidth = 1.8;
          g.beginPath();
          g.moveTo(S.sx(a[0]), a[1]);
          for (let k = i; k <= j; k++) g.lineTo(S.sx(wx(k)), surf(k));
          g.lineTo(S.sx(b[0]), b[1]);
          g.stroke();
          i = j + 1;
        }
      }
    };
    /** How many separate runs of water a pool shows: 1 for an open pool, more
     *  where islands break it. For the probes. */
    S.wetRuns = (q) => {
      let runs = 0, inRun = false;
      for (let i = 0; i < q.n; i++) {
        const w = ground(q.lo + i * q.dx) > q.level + q.h[i];
        if (w && !inRun) runs++;
        inRun = w;
      }
      return runs;
    };

    /* ── the body ─────────────────────────────────────────────────────── */
    /** Hitting the ground: squash, rebound, settle. */
    S.land = (amp) => { me.wob = 0.0001; me.amp = amp; };
    S.leanAt = (x) => clamp(-(ground(x + 8) - ground(x - 8)) / 16 * 1.1, -0.55, 0.55);
    /** Paint the body where it stands, gazing where the world says. Drawn in
     *  world coordinates, shifted so it lands on screen: the painter samples
     *  the floor across its own footprint and ground() wraps, so this is right
     *  even standing on the seam. */
    S.paintBody = (gaze, extra) => {
      g.save(); g.translate(S.sx(me.x) - me.x, 0);
      if (me.flying) {
        S2.paint(g, Object.assign({ x: me.x, y: me.airY, r: body.r, fall: clamp(me.vy / 520, 0, 1), gaze }, extra || {}));
      } else {
        S2.paint(g, Object.assign({
          x: me.x, y: ground(me.x), r: body.r, ground, tension: body.tension,
          contact: me.contact, squash: me.squash, lean: S.leanAt(me.x), gaze, reduce: S.reduce,
        }, extra || {}));
      }
      g.restore();
    };
    /** Send the body to x. Anything within a few screens it walks to, so the
     *  ground it crosses is seen; from the far side of the circuit it is simply
     *  there, because a click should not cost half a minute. */
    S.go = (x, far) => {
      x = wrap(x);
      if (S.reduce || Math.abs(rd(x - me.x)) > (far == null ? 900 : far)) {
        me.x = x; S.cam = x; S.target = null; me.flying = false; S.land(0.2);
        if (o.onStep) o.onStep(0);
      } else S.target = x;
    };
    /** Put the body down at x at once, no fall and no walk (arriving by address). */
    S.place = (x) => { me.x = wrap(x); S.cam = me.x; me.flying = false; S.target = null; };

    S.step = (dt) => {
      me.t += dt;
      if (me.flying) {
        me.vy += body.gravity * dt; me.airY += me.vy * dt;
        const rest = S2.restHeight(me.x, body.r, ground, body.tension);
        if (me.airY >= rest) {
          me.flying = false; me.contact = 0; S.land(0.34);
          const q = S.poolAt(me.x);
          if (q) S.disturb(q, me.x, 26);                     // it lands in the water with a wave
        }
      } else {
        me.contact = Math.min(1, me.contact + dt * 6);
        const breath = S.reduce ? 0 : Math.sin(me.t * 3.2) * 0.09;
        const stride = S.reduce || !me.vx ? 0 : Math.sin(me.t * 9) * 0.05;
        if (me.wob > 0) {                                    // a landing rings out and settles
          me.wob += dt;
          const fade = Math.exp(-me.wob * 5.4);
          me.pop = me.amp * fade * Math.cos(me.wob * 21);
          if (fade < 0.02) { me.wob = 0; me.pop = 0; }
        } else me.pop = 0;
        me.squash = me.pop + breath + stride;
      }
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) S.target = null;
      if (dir) me.vx = dir * (keys.shift ? body.run : body.walk);
      else if (S.target != null) {
        const d = rd(S.target - me.x);                       // always the shorter way round
        if (Math.abs(d) < 2.5) { me.x = S.target; S.target = null; me.vx = 0; }
        else me.vx = Math.sign(d) * clamp(Math.abs(d) * 2.4, 90, 380);
      } else me.vx = 0;
      const wading = S.poolAt(me.x);
      if (wading) {
        me.vx *= 0.5;                                        // water slows it, as everywhere on the site
        if (Math.abs(me.vx) > 8) S.disturb(wading, me.x, me.vx * 0.035);
      }
      if (me.vx) { me.x = wrap(me.x + me.vx * dt); me.face = Math.sign(me.vx); }
      S.stepWater(dt);
      S.cam = wrap(S.cam + rd(me.x - S.cam) * Math.min(1, dt * (S.reduce ? 60 : 6)));
      if (o.onStep) o.onStep(dt);
    };

    /* ── size, and the loop ───────────────────────────────────────────── */
    S.size = () => {
      const r = canvas.getBoundingClientRect();
      const cw = Math.max(280, Math.round(r.width)), ch = Math.max(240, Math.round(r.height));
      // Height decides how big the world can be, width decides how much of it
      // has to fit: on a phone the second one wins, or you see one word at a time.
      S.zoom = clamp(Math.min(ch / fit.h, cw / fit.w), 1, fit.max);
      S.W = cw / S.zoom; S.H = ch / S.zoom;
      canvas.width = Math.round(cw * S.dpr); canvas.height = Math.round(ch * S.dpr);
      g.setTransform(S.dpr * S.zoom, 0, 0, S.dpr * S.zoom, 0, 0);
      S.base = Math.round(S.H - Math.max(fit.baseMin, S.H * fit.baseFrac));   // room under the floor line
      if (o.onSize) o.onSize();
      S.findPools();                                         // the floor moved, so the water does
    };
    let last = 0, running = false, frozen = false;
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      S.step(dt); o.draw(g);
      requestAnimationFrame(frame);
    }
    S.start = () => { if (running || frozen) return; running = true; last = 0; requestAnimationFrame(frame); };
    S.stop = () => { running = false; };
    /** Hold still, for a harness taking a picture. */
    S.pause = () => { frozen = true; S.stop(); };
    S.resume = () => { frozen = false; S.start(); };
    /** One synchronous frame, for probes: headless Chrome does not run
     *  requestAnimationFrame in a backgrounded frame. */
    S.tick = (dt) => { S.step(dt == null ? 0.016 : dt); o.draw(g); };
    S.draw = () => o.draw(g);
    /** Run while the canvas is in view, and rest when it scrolls away. */
    S.observe = () => {
      if (window.IntersectionObserver) {
        new IntersectionObserver((es) => { es[0].isIntersecting ? S.start() : S.stop(); },
          { rootMargin: "120px" }).observe(canvas);
      } else S.start();
    };
    window.addEventListener("resize", () => { S.size(); o.draw(g); });

    /* ── input ────────────────────────────────────────────────────────── */
    function aim(ev) {
      const r = canvas.getBoundingClientRect();
      S.target = wrap(S.cam + (ev.clientX - r.left) * (S.W / r.width) - S.W / 2);
      if (S.reduce) { me.x = S.target; S.target = null; S.cam = me.x; }
    }
    canvas.addEventListener("pointerdown", (ev) => {
      canvas.focus(); S.dragging = true;
      try { canvas.setPointerCapture(ev.pointerId); } catch (err) { /* older Safari */ }
      aim(ev); ev.preventDefault();
    });
    canvas.addEventListener("pointermove", (ev) => { if (S.dragging) aim(ev); });
    window.addEventListener("pointerup", () => { S.dragging = false; });
    // arrows or A and D, and Q for an AZERTY keyboard
    const KEY = { ArrowLeft: "left", a: "left", A: "left", q: "left", Q: "left", ArrowRight: "right", d: "right", D: "right" };
    /** Is this keystroke ours? It is, unless the reader is typing into something.
     *  A button or a link has no use for an arrow key, so clicking one, or
     *  clicking away from a menu, must not leave the body stuck. */
    function mine(ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return false;
      const el = ev.target;
      if (!el || el === canvas || el === document.body || el === document.documentElement) return true;
      const tag = (el.tagName || "").toLowerCase();
      return !(tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable);
    }
    const onKeyDown = (ev) => {
      if (ev.key === "Shift") { keys.shift = true; return; }
      if (KEY[ev.key]) { keys[KEY[ev.key]] = true; ev.preventDefault(); return; }
      const extra = o.keys && o.keys[ev.key];
      if (extra) { extra(ev); ev.preventDefault(); }
    };
    const onKeyUp = (ev) => {
      if (ev.key === "Shift") keys.shift = false;
      if (KEY[ev.key]) keys[KEY[ev.key]] = false;
    };
    document.addEventListener("keydown", (ev) => { if (mine(ev)) onKeyDown(ev); });
    document.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("keydown", onKeyDown);            // and when it does have focus
    canvas.addEventListener("keyup", onKeyUp);
    const drop = () => { keys.left = keys.right = keys.shift = false; };
    canvas.addEventListener("blur", drop);
    window.addEventListener("blur", drop);

    return S;
  }

  window.MH_SIDE = { create, clamp, lerp, smooth, mix, rgba, roundRect, TAU };
})();
