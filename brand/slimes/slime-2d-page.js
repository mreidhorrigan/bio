// @ts-check
"use strict";
/* slime-2d-page.js — the sheet for slime-2d.html: the slime in a variety of
 * flat 2D situations, in the same panel format as the other sheets. */
(function () {
  const S = window.MH_SLIME2D, DPR = Math.min(window.devicePixelRatio || 1, 2);
  const panels = [], errors = [];
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ROCK = "#6b6257", SKY = "#cfe4d6", VOID = "#0b1016";

  function panel(grid, title, note, w, h, bg, draw) {
    const fig = document.createElement("figure");
    fig.className = "panel";
    const cv = document.createElement("canvas");
    cv.width = w * DPR; cv.height = h * DPR;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.style.background = bg;
    const cap = document.createElement("figcaption");
    cap.innerHTML = "<strong>" + title + "</strong>" + (note ? "<span>" + note + "</span>" : "");
    fig.append(cv, cap); grid.append(fig);
    const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
    g.scale(DPR, DPR);
    panels.push({ canvas: cv, ctx: g, w, h, draw, name: title + (note ? ": " + note : "") });
  }

  function section(title, blurb) {
    const s = document.createElement("section");
    s.innerHTML = "<h2>" + title + "</h2>" + (blurb ? "<p>" + blurb + "</p>" : "");
    const grid = document.createElement("div");
    grid.className = "grid"; s.append(grid);
    document.querySelector("main").append(s);
    return grid;
  }

  /** The avatar's idle breath, exactly as engine.js drives it: p = 0.09 sin(3.2t),
   *  which the painter turns into rx = r(1+p), ry = r(1 - 0.7p). */
  function breath(t) { return reduce ? 0 : Math.sin(t * 3.2) * 0.09; }

  /** A panel that draws a ground profile with the slime resting on it. */
  function resting(grid, title, note, ground, opts) {
    panel(grid, title, note, 190, 150, SKY, (g, w, h, t) => {
      S.paintGround(g, ground, 0, w, h, ROCK);
      const x = (opts && opts.x) || w / 2, r = (opts && opts.r) || 26;
      S.paint(g, Object.assign({
        x, y: ground(x), r, ground, reduce,
        squash: breath(t), gaze: [0.1, 0],
      }, opts && opts.slime));
    });
  }

  function build() {
    {
      const grid = section("Free", "Nothing is touching it, so nothing deforms it.");
      panel(grid, "In a vacuum", "a circle, eye in the middle", 190, 150, VOID, (g, w, h, t) => {
        const drift = reduce ? 0 : Math.sin(t * 0.8) * 3;
        S.paint(g, { x: w / 2, y: h / 2 + drift, r: 30, reduce, gaze: [Math.sin(t * 0.5) * 0.4, Math.cos(t * 0.37) * 0.3] });
      });
      for (const [i, f] of [0.2, 0.55, 0.95].entries()) {
        panel(grid, "Falling", "teardrop, " + Math.round(f * 100) + "% of terminal", 150, 190, SKY, (g, w, h) => {
          S.paint(g, { x: w / 2, y: h / 2, r: 27, fall: f, reduce, gaze: [0, 0.55] });
          g.strokeStyle = "rgba(40,70,50,0.25)"; g.lineWidth = 1.5;   // the air it is falling through
          for (let k = 0; k < 3; k++) { const x = w / 2 - 22 + k * 22; g.beginPath(); g.moveTo(x, 18 + k * 6); g.lineTo(x, 40 + k * 6); g.stroke(); }
        });
      }
      panel(grid, "Impact", "the frame it lands on", 190, 150, SKY, (g, w, h) => {
        const ground = S.grounds.flat(h - 26);
        S.paintGround(g, ground, 0, w, h, ROCK);
        S.paint(g, { x: w / 2, y: ground(w / 2), r: 28, ground, squash: 0.45, reduce, gaze: [0, 0.2] });
      });
    }

    {
      const grid = section("Resting", "The underside takes the shape of what it lies on. The top stays a dome, because that is what a skin under tension does.");
      resting(grid, "Flat", "the avatar's own shape: a dome on a flat base", S.grounds.flat(120));
      resting(grid, "One rock", "it drapes", S.grounds.rock(124, 95, 16, 22));
      resting(grid, "Two rocks", "a gap narrower than the skin can span: bridged", S.grounds.twoRocks(132, 80, 110, 5, 26));
      resting(grid, "Two rocks, further apart", "too wide to span, so it settles in", S.grounds.twoRocks(132, 66, 124, 5, 26));
      resting(grid, "A narrow crack", "too tight for the skin to enter", S.grounds.crack(120, 95, 5, 26));
      resting(grid, "A wide dip", "wide enough to flow into", S.grounds.bowl(104, 95, 26, 26));
      resting(grid, "Rubble", "every lump accounted for", S.grounds.rubble(118, 1.7));
    }

    {
      const grid = section("Slopes and steps", "Climbing or descending, it leans into the hill and its base shears to match.");
      resting(grid, "Climbing", "leaning uphill", S.grounds.slope(120, -0.33), { x: 86, slime: { lean: 0.45, gaze: [0.5, -0.1], squash: 0.22 } });
      resting(grid, "Descending", "leaning back", S.grounds.slope(120, 0.33), { x: 96, slime: { lean: -0.4, gaze: [0.5, 0.35], squash: 0.2 } });
      resting(grid, "A step up", "half on, half off", S.grounds.stairs(150, 46, 17), { x: 88 });
      resting(grid, "Stairs", "sitting in the corner", S.grounds.stairs(156, 34, 15), { x: 104 });
    }

    {
      const grid = section("Surface tension", "One number sets how taut the skin is: the radius of the disc rolled along the ground to find the underside. A small disc creeps into every crack; a large one spans them.");
      for (const [label, tension] of [["Slack (0.25)", 0.25], ["House (0.55)", 0.55], ["Taut (1.1)", 1.1]]) {
        resting(grid, label, "same ground, different skin", S.grounds.rubble(120, 4.2), { slime: { tension } });
      }
      resting(grid, "Slack, over a gap", "a loose skin drops into what a taut one spans", S.grounds.twoRocks(132, 80, 110, 5, 26), { slime: { tension: 0.25 } });
      resting(grid, "Taut, over a gap", "the same gap, spanned", S.grounds.twoRocks(132, 80, 110, 5, 26), { slime: { tension: 1.1 } });
    }

    {
      const grid = section("Walking", "The same body, moving. It never floats above the ground and never cuts into it.");
      panel(grid, "Across a boulder field", "live", 620, 190, SKY, (g, w, h, t) => {
        const ground = (x) => S.grounds.rubble(140, 2.3)(x) - 6 * Math.sin(x * 0.045);
        S.paintGround(g, ground, 0, w, h, ROCK);
        const speed = reduce ? 0 : 42;
        const x = reduce ? w / 2 : 40 + ((t * speed) % (w - 80));
        const r = 26, ahead = ground(x + 6) - ground(x - 6);
        const bob = reduce ? 0 : Math.sin(t * 5.6) * 0.05;   // the avatar's walking squash
        S.paint(g, {
          x, y: ground(x), r, ground, reduce,
          squash: breath(t) + bob, lean: -ahead * 0.06,
          gaze: [0.55, 0.2 + ahead * 0.02],
        });
      });
      panel(grid, "Dropping onto rubble", "live", 300, 230, SKY, (g, w, h, t) => {
        const ground = S.grounds.rubble(180, 6.1);
        S.paintGround(g, ground, 0, w, h, ROCK);
        const r = 26, x = w / 2, gy = ground(x);
        const restY = S.restHeight(x, r, ground);        // what it will actually rest on: the molded
        const FALL = 1.5, SETTLE = 0.9;                  // floor, which is above the raw rock in the dips
        const cycle = reduce ? FALL + SETTLE + 0.4 : (t * 0.6) % 3.4;

        if (cycle < FALL) {
          // Airborne. What meets the rock is the UNDERSIDE, not the centre, so
          // the fall ends with the centre one radius above the resting line.
          const k = cycle / FALL, fall = Math.min(1, k * 1.35);
          const ry = r * (1 + fall * 0.34);
          const y0 = 18, y1 = restY - ry;
          S.paint(g, { x, y: y0 + (y1 - y0) * k * k, r, fall, reduce, gaze: [0, 0.6] });
          return;
        }
        // Down. contact runs 0 to 1: at 0 the body is still round with its base
        // on the rock, at 1 it has settled into the avatar's flat-based dome.
        // The teardrop relaxes over the same moment, so nothing jumps.
        const k = Math.min(1, (cycle - FALL) / SETTLE);
        const contact = Math.min(1, k / 0.35);
        const impact = Math.sin(Math.min(1, k / 0.5) * Math.PI) * 0.4;
        S.paint(g, {
          x, y: gy, r, ground, reduce, contact,
          fall: Math.max(0, 1 - k / 0.3),
          squash: impact + breath(t) * k,
          gaze: [0, 0.25],
        });
      });
    }
  }

  function paintPanel(p, t) {
    p.ctx.save(); p.ctx.clearRect(0, 0, p.w, p.h);
    try { p.draw(p.ctx, p.w, p.h, t); } catch (e) { errors.push(p.name + ": " + (e && e.message ? e.message : e)); }
    p.ctx.restore();
  }
  function loop() {
    const t = performance.now() / 1000;
    for (const p of panels) {
      const r = p.canvas.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      paintPanel(p, t);
    }
    requestAnimationFrame(loop);
  }

  window.MH_SLIME2D_PAGE = {
    boot() { build(); requestAnimationFrame(loop); },
    redraw(t) { const now = t == null ? performance.now() / 1000 : t; for (const p of panels) paintPanel(p, now); },
    errors,
    panels: () => panels.map((p) => p.name),
  };
})();
