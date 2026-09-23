// @ts-check
"use strict";
/* slime-2d.js — the slime as a body, for flat 2D situations.
 *
 * A proposal, not an extraction: the site's avatar (engine.js defPaintAvatar,
 * copied into isometric.js) is a squashing ellipse that always stands on a flat
 * tile. This paints the same creature as something with a skin and a volume,
 * so it can fall, land, and sit on ground that is not flat.
 *
 * The rules it follows:
 *   • In a vacuum it is a circle, eye in the middle. Nothing is pulling on it.
 *   • Falling, it tapers upward into a slight teardrop, the more the faster.
 *   • Landing, it squashes wide and recovers.
 *   • On ground, its underside takes the shape of what it is lying on, and its
 *     top stays a smooth dome. It flows into wide dips and bridges narrow ones,
 *     because a skin under tension cannot turn a sharp corner.
 *   • Climbing or descending, it leans into the slope and its base shears to
 *     match, so it never floats above a hill or cuts into it.
 *
 * The underside is a rolling-disc envelope, which is what gives the bridging
 * for free: roll a disc of radius TENSION along the ground, and the curve its
 * belly traces is the shape a taut skin takes. A small disc creeps into every
 * crack, a large one spans them. That single number is the slime's surface
 * tension, and it is the only knob worth turning.
 *
 *   MH_SLIME2D.paint(g, { x, y, r, ground, fall, squash, lean, contact, gaze, ... })
 *   MH_SLIME2D.grounds — the named test surfaces the sheet uses
 *
 * No dependencies. Colours follow the brand slime: engine.js's avatar green and
 * ink, the favicon's gel gradient.
 */
(function () {
  const GREEN = "#4FA373", INK = "#1f3a1a", LIGHT = "#B0D6C0", DARK = "#3A7955";
  const N = 72;                                  // samples across the footprint

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /** The locus a disc of radius p can reach rolling ON TOP of ground g. */
  function discCentres(gy, xs, p, dx) {
    const span = Math.max(1, Math.round(p / dx)), out = new Float64Array(gy.length);
    for (let i = 0; i < gy.length; i++) {
      let lo = Infinity;
      for (let k = -span; k <= span; k++) {
        const j = clamp(i + k, 0, gy.length - 1), o = k * dx;
        const h = Math.sqrt(Math.max(0, p * p - o * o));
        const v = gy[j] - h;
        if (v < lo) lo = v;
      }
      out[i] = lo;
    }
    return out;
  }

  /** The underside that disc traces: bridges anything narrower than it. */
  function rolledUnderside(gy, p, dx) {
    const c = discCentres(gy, null, p, dx), span = Math.max(1, Math.round(p / dx));
    const out = new Float64Array(gy.length);
    for (let i = 0; i < gy.length; i++) {
      let hi = -Infinity;
      for (let k = -span; k <= span; k++) {
        const j = clamp(i + k, 0, gy.length - 1), o = k * dx;
        const h = Math.sqrt(Math.max(0, p * p - o * o));
        const v = c[j] + h;
        if (v > hi) hi = v;
      }
      out[i] = Math.min(gy[i], hi);            // never below the ground it rests on
    }
    return out;
  }

  /** Build the closed outline.
   *
   *  On flat ground this reproduces the site's avatar exactly: engine.js draws
   *  it as the UPPER HALF of an ellipse sitting on a flat base, rx = r(1+p),
   *  ry = r(1 - 0.7p), where p is the idle breath. So the ellipse centre is put
   *  on the contact line, and everything else is a departure from that: free of
   *  the ground it closes into a circle, and on rough ground its base follows
   *  what it is lying on while the dome above stays the avatar's dome. */
  function shape(o) {
    const r = o.r, fall = clamp(o.fall || 0, 0, 1), squash = clamp(o.squash || 0, -0.5, 0.8);
    const lean = o.lean || 0;
    const rx = r * (1 + squash), ry = r * (1 - squash * 0.7) * (1 + fall * 0.34);
    const x0 = o.x - rx, x1 = o.x + rx, dx = (x1 - x0) / (N - 1);
    const xs = new Float64Array(N), top = new Float64Array(N), bot = new Float64Array(N);
    for (let i = 0; i < N; i++) xs[i] = x0 + i * dx;

    let floor = null, baseY = o.y, lost = 0;
    if (o.ground) {
      // Sample WIDER than the body. The rolling disc needs ground beyond the
      // footprint to roll on; without it, a boulder crossing the edge arrives
      // as a step and the whole body flinches as it walks.
      const p = (o.tension == null ? 0.55 : o.tension) * r, padN = Math.ceil(p / dx) + 2, M = N + 2 * padN;
      const gy = new Float64Array(M);
      for (let i = 0; i < M; i++) gy[i] = o.ground(x0 + (i - padN) * dx);
      const wide = rolledUnderside(gy, p, dx);
      floor = new Float64Array(N);
      for (let i = 0; i < N; i++) floor[i] = wide[i + padN];
      const f = clamp((o.x - x0) / dx, 0, N - 1), i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1);
      baseY = floor[i0] + (floor[i1] - floor[i0]) * (f - i0);   // interpolated, so walking does not step
    }
    // contact: 0 the moment it touches, its base on the ground and still round;
    // 1 settled, centre on the contact line, which is the avatar's flat-based dome.
    const contact = o.ground ? clamp(o.contact == null ? 1 : o.contact, 0, 1) : 1;
    const cy = baseY - ry * (1 - contact);

    for (let i = 0; i < N; i++) {
      const u = clamp((xs[i] - o.x) / rx, -1, 1), h = Math.sqrt(Math.max(0, 1 - u * u));
      top[i] = cy - ry * h;
      const round = cy + ry * h;                                 // the free body's own underside
      bot[i] = floor ? (round * (1 - contact) + cy * contact) : round;
      if (floor) {
        if (floor[i] < bot[i]) { lost += (bot[i] - floor[i]) * dx; bot[i] = floor[i]; }   // the ground pushes the base up
        else bot[i] = Math.min(round, floor[i]);                                          // a dip: it sags in as far as it reaches
      }
    }
    if (fall > 0.01) {                          // falling: the apex draws up into a teardrop
      for (let i = 0; i < N; i++) {
        const climb = clamp((cy - top[i]) / (ry * 2 || 1), 0, 1);
        top[i] -= fall * ry * 0.42 * climb * climb;
      }
    }
    // Where the ground pushes the base up, the body above it has to go somewhere:
    // part of it shows through locally as a bulge, and the rest raises the dome.
    // Without this the base can rise ABOVE the dome near the rim, the outline
    // crosses itself, and the silhouette spikes as the body walks over rubble.
    const lift = lost > 0 ? lost / (2 * rx) : 0;
    for (let i = 0; i < N; i++) {
      if (lift) top[i] -= lift * 0.5;
      const rise = Math.max(0, cy - bot[i]);
      if (rise > 0) top[i] -= rise * 0.6;
      if (top[i] > bot[i] - 0.6) top[i] = bot[i] - 0.6;   // never let the two swap
    }

    const shear = lean ? lean * r * 0.28 : 0;
    const hOf = (y) => clamp((cy - y) / (ry || 1), 0, 1.4);   // 0 at the base, 1 at the apex
    const pts = [];
    for (let i = 0; i < N; i++) pts.push([xs[i] + shear * hOf(bot[i]), bot[i]]);
    for (let i = N - 1; i >= 0; i--) pts.push([xs[i] + shear * hOf(top[i]), top[i]]);
    return { pts, cx: o.x + shear * 0.5, cy, rx, ry, bot, top, xs, baseY, grounded: !!floor, contact, lift };
  }

  /** Trace a closed path smoothly through the points (quadratics via midpoints). */
  function trace(g, pts) {
    const n = pts.length;
    g.beginPath();
    g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }

  function paint(g, o) {
    const s = shape(o), r = o.r;
    const reduce = !!o.reduce;
    const rx = s.rx, ry = s.ry;

    if (o.ground && !reduce) {                  // contact shadow: a band lying ON the ground under the footprint
      g.save(); g.globalAlpha = 0.22; g.fillStyle = "#000";
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < s.xs.length; i++) if (Math.abs(s.bot[i] - o.ground(s.xs[i])) < 1.2) { lo = Math.min(lo, s.xs[i]); hi = Math.max(hi, s.xs[i]); }
      if (hi > lo) {
        // It follows the ground rather than sitting at one height: an ellipse
        // placed at the ground under the body's middle fell into every dip the
        // body bridged and floated there, detached, below it.
        const a = lo - 2, b = hi + 2, M = 14;
        g.beginPath();
        for (let i = 0; i <= M; i++) { const x = a + (b - a) * (i / M), y = o.ground(x) + 1; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        for (let i = M; i >= 0; i--) { const x = a + (b - a) * (i / M), u = (i / M) * 2 - 1; g.lineTo(x, o.ground(x) + 1 + 2.6 * Math.sqrt(Math.max(0, 1 - u * u))); }
        g.closePath(); g.fill();
      }
      g.restore();
    }

    trace(g, s.pts);
    // engine.js's gel avatar: a radial light from the upper left, same stops
    const grad = g.createRadialGradient(s.cx - rx * 0.3, s.baseY - ry * 0.95, 1, s.cx, s.baseY - ry * 0.35, rx * 1.25);
    grad.addColorStop(0, o.light || LIGHT); grad.addColorStop(0.5, o.color || GREEN); grad.addColorStop(1, o.dark || DARK);
    g.fillStyle = grad; g.fill();
    g.lineWidth = o.lineWidth || Math.max(2, r * 0.085); g.lineJoin = "round"; g.strokeStyle = o.ink || INK; g.stroke();

    g.save(); g.globalAlpha = 0.32; g.fillStyle = "#fff";   // the avatar's gel sheen, same offsets
    g.beginPath(); g.ellipse(s.cx - rx * 0.32, s.baseY - ry * 0.95 - s.lift, rx * 0.22, ry * 0.16, -0.5, 0, Math.PI * 2); g.fill(); g.restore();

    // the eye, at the avatar's proportions: 3.5/13 of the body radius, sat at
    // 0.6 of the dome height. Free of the ground it returns to the middle.
    const gx = o.gaze ? clamp(o.gaze[0], -1, 1) : 0, gy2 = o.gaze ? clamp(o.gaze[1], -1, 1) : 0;
    const er = r * (3.5 / 13), pr = r * (1.8 / 13), k = r / 13;
    const ex = s.cx + gx * 4 * k + (o.eyeDx || 0) * r;
    const settled = s.grounded ? (s.baseY - ry * 0.6 - s.lift) : s.cy;
    const ey = (s.grounded ? s.cy * (1 - s.contact) + settled * s.contact : s.cy) + gy2 * 2.5 * k + (o.eyeDy || 0) * r;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(1, 1.3 * k); g.strokeStyle = o.ink || INK; g.stroke();
    g.fillStyle = o.ink || INK; g.beginPath(); g.arc(ex + gx * 1.7 * k, ey + gy2 * 1.7 * k, pr, 0, Math.PI * 2); g.fill();
    return s;
  }

  /* ---- the surfaces the sheet tests against ------------------------------ */
  const grounds = {
    flat: (base) => (x) => base,
    slope: (base, m) => (x) => base + (x - 60) * m,
    rock: (base, cx, w, h) => (x) => base - h * Math.exp(-((x - cx) ** 2) / (2 * w * w)),
    twoRocks: (base, a, b, w, h) => (x) => base - h * (Math.exp(-((x - a) ** 2) / (2 * w * w)) + Math.exp(-((x - b) ** 2) / (2 * w * w))),
    crack: (base, cx, w, d) => (x) => base + (Math.abs(x - cx) < w ? d : 0),
    bowl: (base, cx, w, d) => (x) => base + d * Math.exp(-((x - cx) ** 2) / (2 * w * w)),
    stairs: (base, step, rise) => (x) => base - Math.floor(x / step) * rise,
    rubble: (base, seed) => (x) => base
      - 7 * Math.sin(x * 0.11 + seed) - 4 * Math.sin(x * 0.27 + seed * 2.1)
      - 2.5 * Math.sin(x * 0.63 + seed * 3.7) - 1.4 * Math.sin(x * 1.21 + seed * 5.3),
  };

  /** Draw a ground profile as solid rock, so the panels read as places. */
  function paintGround(g, ground, x0, x1, bottom, fill, ink) {
    g.beginPath(); g.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 2) g.lineTo(x, ground(x));
    g.lineTo(x1, bottom); g.closePath();
    g.fillStyle = fill || "#6b6257"; g.fill();
    g.strokeStyle = ink || "rgba(20,26,18,0.8)"; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath(); g.moveTo(x0, ground(x0));
    for (let x = x0; x <= x1; x += 2) g.lineTo(x, ground(x));
    g.stroke();
  }

  /** The height the body's underside will come to rest at over x: the molded
   *  floor, which sits above the raw ground wherever the skin bridges. A fall
   *  should aim at this, not at ground(x), or the body lands too low and pops. */
  function restHeight(x, r, ground, tension) {
    return shape({ x, y: ground(x), r, ground, tension, contact: 0 }).baseY;
  }

  window.MH_SLIME2D = { paint, shape, grounds, paintGround, restHeight, GREEN, INK };
})();
