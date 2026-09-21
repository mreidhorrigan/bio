// @ts-check
"use strict";
/* shoggoth-proposals.js — a monster for the walkable world, proposed six ways.
 *
 * The world already has one citizen made of gel: a slime with a single eye,
 * an ink outline and a lit interior. A shoggoth is what that is when there is
 * far too much of it. Lovecraft's description gives the constant across all
 * six designs: a protoplasmic mass that forms and reabsorbs organs at will,
 * so eyes open on its surface, hold a moment, and sink back in.
 *
 * Every design is built from the world's existing vocabulary, so it reads as
 * native rather than imported: gel gradients, a 2px ink silhouette, glowing
 * beads and spores, a slow wobble, and per-instance variation from hash01 so
 * the same shoggoth always looks like itself. Each carries a skirt of tapered
 * tentacles, half of them behind the mass and half in front, and they are the
 * only limb: an earlier pseudopod curved across the body and its outline read
 * as a mouth. There are no apertures at all. Eyes and tentacles carry the
 * creature, so nothing on it can be mistaken for a face.
 *
 * Painters take the (C, b) context buildings.js builds, so an adopted design
 * drops in beside drawHouse and drawTree. C.state is "dormant" | "roused" |
 * "moving"; C.pal is the skin's palette, below.
 *
 *   MH_SHOGGOTH.variants — the six designs
 *   MH_SHOGGOTH.palettes — day and night
 */
(function () {
  const U = () => window.MH_ISO.util;
  const RM = () => window.MH_ISO.reduced();

  const palettes = {
    technurture: {                                    // daylight: the gel is alive and wet
      body: "#3f7f6a", deep: "#1f4a40", sheen: "#9fe6c0", rim: "#5ec4a6",
      ink: "#12281e", glow: "#aaffe6", mouth: "#10221a", spark: "#c890ff", lit: "#ffd86a",
    },
    technoscure: {                                    // after dark: oil, with something burning inside
      body: "#23332c", deep: "#0e1a16", sheen: "#5fe0c8", rim: "#2f6a58",
      ink: "#050a08", glow: "#7fffc0", mouth: "#000000", spark: "#9a63c8", lit: "#ffb24a",
    },
  };

  /** How lively the thing is, per state. */
  function vigour(state) {
    if (state === "roused") return { eyes: 11, speed: 1.0, wob: 1.0 };
    if (state === "moving") return { eyes: 7, speed: 1.35, wob: 1.25 };
    return { eyes: 3, speed: 0.4, wob: 0.5 };                        // dormant
  }

  /** The silhouette: a radius that wanders with angle and time. */
  function blobPath(g, cx, cy, R, C, v, squat) {
    const t = RM() ? 0 : C.t * v.speed, N = 64;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const k = 1
        + 0.13 * v.wob * Math.sin(a * 3 + t * 0.7 + C.R(1) * 6)
        + 0.09 * v.wob * Math.sin(a * 5 - t * 0.5 + C.R(2) * 6)
        + 0.06 * v.wob * Math.sin(a * 8 + t * 0.9 + C.R(3) * 6);
      const x = cx + Math.cos(a) * R * k;
      const y = cy + Math.sin(a) * R * k * (squat == null ? 0.72 : squat);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }

  /** Fill a traced silhouette with the skin's gel, then outline it in ink. */
  function gel(g, C, cx, cy, R) {
    const p = C.pal;
    const grd = g.createRadialGradient(cx - R * 0.35, cy - R * 0.5, R * 0.1, cx, cy, R * 1.3);
    grd.addColorStop(0, p.rim); grd.addColorStop(0.55, p.body); grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill();
    g.lineWidth = 2.2; g.lineJoin = "round"; g.strokeStyle = p.ink; g.stroke();
  }

  /** An eye that opens on the surface, holds, and sinks back in. */
  function eye(g, C, x, y, r, phase, p) {
    const life = ((C.t * 0.33 + phase) % 1);
    const open = life < 0.12 ? life / 0.12 : life > 0.72 ? Math.max(0, (0.92 - life) / 0.2) : 1;
    if (open <= 0.02) return;
    const rr = r * open;
    g.save();
    g.fillStyle = "#f2fbf6"; g.beginPath(); g.ellipse(x, y, rr, rr * (0.55 + 0.45 * open), 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = Math.max(0.8, rr * 0.22); g.strokeStyle = p.ink; g.stroke();
    const gx = Math.cos(C.t * 0.7 + phase * 9) * rr * 0.3, gy = Math.sin(C.t * 0.5 + phase * 5) * rr * 0.22;
    g.fillStyle = p.ink; g.beginPath(); g.arc(x + gx, y + gy, rr * 0.45 * open, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  /** Eyes scattered over the mass, each on its own clock. */
  function eyes(g, C, cx, cy, R, n, squat) {
    const p = C.pal;
    for (let i = 0; i < n; i++) {
      const a = C.R(20 + i) * Math.PI * 2, d = 0.25 + C.R(40 + i) * 0.6;
      const x = cx + Math.cos(a) * R * d, y = cy + Math.sin(a) * R * d * (squat || 0.72);
      eye(g, C, x, y, 3 + C.R(60 + i) * 4.5, C.R(80 + i), p);
    }
  }

  /** A tentacle: a tapered arm of the same gel, curling on its own clock.
   *
   *  Drawn as a run of round-capped segments rather than as one polygon. A
   *  polygon has to close across its base, which left a flat cut and two hard
   *  corners where the limb met the body; round caps give a rounded root and a
   *  rounded tip for nothing, and the segments blend into each other. Ink first
   *  at a wider stroke, then the gel on top, which is how the rest of the world
   *  gets its silhouette. */
  function tentacle(g, C, bx, by, ang, len, wide, phase, p, glowTip) {
    const t = RM() ? 0 : C.t, M = 14;
    const curl = Math.sin(t * 1.1 + phase * 6) * 0.5 + Math.sin(t * 0.6 + phase * 11) * 0.3;
    const mid = [];
    let x = bx, y = by;
    for (let i = 0; i <= M; i++) {
      mid.push([x, y]);
      const u = i / M;
      const a = ang + curl * u * 1.6 + Math.sin(t * 1.7 + phase * 8 + u * 3.2) * 0.26 * u;
      const step = (len / M) * (1 - u * 0.2);
      x += Math.cos(a) * step; y += Math.sin(a) * step;
    }
    const halfWidth = (u) => wide * Math.pow(1 - u, 0.75) + 0.7;
    g.save();
    g.lineCap = "round"; g.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {              // 0 = ink silhouette, 1 = the gel
      for (let i = 0; i < M; i++) {
        const u = i / M, w = halfWidth(u) * 2;
        g.beginPath(); g.moveTo(mid[i][0], mid[i][1]); g.lineTo(mid[i + 1][0], mid[i + 1][1]);
        if (pass === 0) { g.strokeStyle = p.ink; g.lineWidth = w + 3.2; }
        else { g.strokeStyle = U().mixHex ? U().mixHex(p.body, p.deep, u) : p.body; g.lineWidth = w; }
        g.stroke();
      }
    }
    g.restore();
    if (glowTip) glow2(g, mid[M][0], mid[M][1], 2, p.glow, 8, 0.7);
  }

  function glow2(g, x, y, r, col, blur, alpha) {
    g.save(); g.globalAlpha = alpha; if (!RM()) { g.shadowColor = col; g.shadowBlur = blur; }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
  }

  /** A skirt of tentacles around the mass: some behind it, some in front. */
  function tentacles(g, C, cx, cy, R, v, p, behind) {
    const n = C.state === "dormant" ? 4 : C.state === "moving" ? 7 : 6;
    for (let i = 0; i < n; i++) {
      if (((i % 2) === 0) !== !!behind) continue;
      const spread = -0.15 + (i / Math.max(1, n - 1)) * 1.3;          // fanned around the base
      const ang = Math.PI * spread;
      const reach = C.state === "dormant" ? 0.45 : C.state === "moving" ? 1.05 : 0.8;
      const len = R * (0.75 + C.R(400 + i) * 0.5) * reach;
      const bx = cx + Math.cos(ang) * R * 0.58, by = cy + R * 0.3 + Math.sin(ang) * R * 0.1;   // inside the silhouette: the join is hidden
      tentacle(g, C, bx, by, ang * 0.55 + (ang > Math.PI / 2 ? 0.5 : -0.5) * 0.3 + 0.35,
               len, R * 0.13, C.R(420 + i), p, C.state !== "dormant");
    }
  }

  function pool(g, cx, cy, rx, p) {
    g.save(); g.globalAlpha = 0.3; g.fillStyle = p.deep;
    g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.3, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }

  /* ====================================================================== */

  /** A. Congeries: the canonical shoggoth. Bubbles rise through it and burst
   *  into eyes, which sink back in. Nothing about it is stable. */
  function congeries(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 34, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.8;
    pool(g, sx, sy, R * 1.15, p); tentacles(g, C, sx, cy, R, v, p, true);
    blobPath(g, sx, cy, R, C, v); gel(g, C, sx, cy, R);
    for (let i = 0; i < 9; i++) {                      // protoplasmic bubbles, rising and reabsorbed
      const ph = (C.t * 0.22 * (0.6 + C.R(100 + i)) + C.R(120 + i)) % 1;
      const a = C.R(140 + i) * Math.PI * 2;
      const x = sx + Math.cos(a) * R * 0.55, y = cy + R * 0.5 - ph * R * 1.1;
      const rr = (2 + C.R(160 + i) * 5) * Math.sin(ph * Math.PI);
      if (rr <= 0.4) continue;
      g.fillStyle = U().hexA(p.sheen, 0.28); g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = U().hexA(p.sheen, 0.5); g.lineWidth = 0.9; g.stroke();
    }
    eyes(g, C, sx, cy, R, v.eyes);
    tentacles(g, C, sx, cy, R, v, p, false);
  }

  /** B. Fused choir: many of the world's slimes pressed into one body, each
   *  keeping its own eye. The silhouette is a crowd. */
  function choir(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 34, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.8, n = 7;
    pool(g, sx, sy, R * 1.2, p); tentacles(g, C, sx, cy, R, v, p, true);
    g.save();
    blobPath(g, sx, cy, R * 0.98, C, v); g.clip();      // the crowd cannot spill past the mass
    blobPath(g, sx, cy, R, C, v); gel(g, C, sx, cy, R);
    const awake = C.state === "dormant" ? 2 : C.state === "moving" ? 5 : n;   // how many of the crowd are looking
    for (let i = 0; i < n; i++) {                       // each member still has a body and an eye
      const a = C.R(10 + i) * Math.PI * 2, d = 0.15 + C.R(30 + i) * 0.62;
      const x = sx + Math.cos(a) * R * d, y = cy + Math.sin(a) * R * d * 0.7;
      const rr = R * (0.22 + C.R(50 + i) * 0.14) * (1 + (RM() ? 0 : 0.05 * Math.sin(C.t * v.speed + i)));
      const grd = g.createRadialGradient(x - rr * 0.3, y - rr * 0.4, rr * 0.1, x, y, rr * 1.2);
      grd.addColorStop(0, p.rim); grd.addColorStop(1, p.deep);
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rr, rr * 0.86, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = U().hexA(p.ink, 0.55); g.lineWidth = 1.2; g.stroke();
      if (i < awake) eye(g, C, x, y - rr * 0.1, rr * 0.5, C.R(70 + i), p);
      else { g.strokeStyle = U().hexA(p.ink, 0.5); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - rr * 0.4, y); g.lineTo(x + rr * 0.4, y); g.stroke(); }   // shut
    }
    g.restore();
    blobPath(g, sx, cy, R, C, v); g.lineWidth = 2.4; g.strokeStyle = p.ink; g.stroke();
    tentacles(g, C, sx, cy, R, v, p, false);
  }

  /** C. Iridescent bulk: Lovecraft's oily black, done as the world does gloss.
   *  The sheen travels over it, so the colour is never twice the same. */
  function iridescent(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 34, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.8, t = RM() ? 0 : C.t;
    pool(g, sx, sy, R * 1.2, p); tentacles(g, C, sx, cy, R, v, p, true);
    blobPath(g, sx, cy, R, C, v);
    const grd = g.createLinearGradient(sx - R, cy - R, sx + R, cy + R);
    const shift = (Math.sin(t * 0.4) + 1) / 2;
    grd.addColorStop(0, p.deep);
    grd.addColorStop(Math.max(0.05, 0.25 + shift * 0.2), p.spark);
    grd.addColorStop(Math.min(0.95, 0.55 + shift * 0.2), p.body);
    grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill();
    g.lineWidth = 2.2; g.lineJoin = "round"; g.strokeStyle = p.ink; g.stroke();
    g.save();                                           // an oil-slick band sliding across the skin
    blobPath(g, sx, cy, R, C, v); g.clip();
    g.globalAlpha = 0.34; g.strokeStyle = p.sheen; g.lineWidth = R * 0.3;
    const off = ((t * 0.25) % 2 - 0.5) * R * 2;
    g.beginPath(); g.moveTo(sx - R + off, cy - R); g.lineTo(sx + off, cy + R); g.stroke();
    g.restore();
    eyes(g, C, sx, cy, R, v.eyes);
    tentacles(g, C, sx, cy, R, v, p, false);
  }

  /** D. Tekeli-li: the shoggoth as a chorus. It swells on the beat the signal
   *  towers keep, and the cry leaves it as rings. */
  function chorus(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 34, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.8, beat = RM() ? 0.5 : Math.max(0, Math.sin(C.t * 2.4)) ** 2;
    pool(g, sx, sy, R * 1.15, p); tentacles(g, C, sx, cy, R, v, p, true);
    blobPath(g, sx, cy, R * (1 + beat * 0.04), C, v); gel(g, C, sx, cy, R);
    eyes(g, C, sx, cy, R, Math.max(2, v.eyes - 4));
    tentacles(g, C, sx, cy, R, v, p, false);
    if (beat > 0.15 && !RM()) {                         // the cry
      g.save(); g.globalAlpha = 0.5 * (1 - beat); g.strokeStyle = p.glow; g.lineWidth = 2;
      for (const k of [1, 1.6]) { g.beginPath(); g.ellipse(sx, cy - R * 0.2, R * (1.1 + (1 - beat) * k), R * (0.7 + (1 - beat) * k * 0.6), 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
  }

  /** E. Grown predator: the ecology's hunter, scaled past what its shape can
   *  hold. The jagged crown and eyestalks survive; the body has gone to jelly. */
  function grown(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 34, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.85, t = RM() ? 0 : C.t, N = 13;
    pool(g, sx, sy, R * 1.1, p); tentacles(g, C, sx, cy, R, v, p, true);
    g.beginPath();                                      // the predator's jagged silhouette, swollen
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const jag = 1 + (i & 1 ? -0.22 : 0.14) + 0.1 * Math.cos(i * 1.7 + C.R(5) * 6 + t * 0.6);
      const x = sx + Math.cos(a) * R * jag;
      const y = cy + Math.sin(a) * (Math.sin(a) < 0 ? R * 0.86 : R * 0.55) * jag;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); gel(g, C, sx, cy, R);
    for (let i = -1; i <= 1; i++) {                     // eyestalks, the one organ it keeps
      const sway = RM() ? 0 : Math.sin(t * 1.4 + i) * 3;
      const bx = sx + i * R * 0.34, by = cy - R * 0.55, tx = bx + sway + i * 5, ty = by - R * (0.4 + 0.12 * i * i);
      g.strokeStyle = p.body; g.lineWidth = 4.4; g.lineCap = "round";
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sway, (by + ty) / 2, tx, ty); g.stroke();
      g.strokeStyle = p.ink; g.lineWidth = 1.4; g.stroke();
      eye(g, C, tx, ty, 4.4, C.R(300 + i + 1), p);
    }
    eyes(g, C, sx, cy, R * 0.8, Math.max(1, v.eyes - 5), 0.6);
    tentacles(g, C, sx, cy, R, v, p, false);
  }

  /** F. Housewrecker: it has eaten one of the dwellings and not finished. The
   *  windows are still lit inside the mass, which is the horror of it. */
  function housewrecker(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 36, p = C.pal, v = vigour(C.state);
    const cy = sy - R * 0.85;
    pool(g, sx, sy, R * 1.25, p); tentacles(g, C, sx, cy, R, v, p, true);
    blobPath(g, sx, cy, R, C, v); gel(g, C, sx, cy, R);
    g.save();
    blobPath(g, sx, cy, R * 0.99, C, v); g.clip();
    g.save(); g.globalAlpha = 0.55;                     // the swallowed dwelling, still in there
    g.fillStyle = p.deep;
    g.beginPath();
    g.moveTo(sx - R * 0.5, cy + R * 0.45);
    g.bezierCurveTo(sx - R * 0.56, cy - R * 0.1, sx - R * 0.3, cy - R * 0.5, sx, cy - R * 0.5);
    g.bezierCurveTo(sx + R * 0.3, cy - R * 0.5, sx + R * 0.56, cy - R * 0.1, sx + R * 0.5, cy + R * 0.45);
    g.closePath(); g.fill();
    g.strokeStyle = U().hexA(p.ink, 0.7); g.lineWidth = 1.6; g.stroke();
    g.restore();
    for (const o of [[-0.24, -0.1], [0.22, -0.16], [0.02, 0.12]]) {   // its windows, still burning
      const wx = sx + o[0] * R, wy = cy + o[1] * R;
      g.save(); if (!RM()) { g.shadowColor = p.lit; g.shadowBlur = 12; }
      g.fillStyle = U().hexA(p.lit, 0.8); g.beginPath(); g.ellipse(wx, wy, R * 0.09, R * 0.075, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.restore();
    blobPath(g, sx, cy, R, C, v); g.lineWidth = 2.4; g.strokeStyle = p.ink; g.stroke();
    eyes(g, C, sx, cy, R, v.eyes);
    tentacles(g, C, sx, cy, R, v, p, false);
  }

  window.MH_SHOGGOTH = {
    palettes, vigour,
    variants: [
      { id: "congeries", label: "A. Congeries", note: "bubbles rise through it and open as eyes", draw: congeries },
      { id: "choir", label: "B. Fused choir", note: "the world's own slimes, pressed into one body", draw: choir },
      { id: "iridescent", label: "C. Iridescent bulk", note: "Lovecraft's oily black, as this world does gloss", draw: iridescent },
      { id: "chorus", label: "D. Tekeli-li", note: "it swells on the towers' beat; the cry leaves as rings", draw: chorus },
      { id: "grown", label: "E. Grown predator", note: "the ecology's hunter, swollen past its own shape", draw: grown },
      { id: "housewrecker", label: "F. Housewrecker", note: "it ate a dwelling and the windows are still lit", draw: housewrecker },
    ],
  };
})();
