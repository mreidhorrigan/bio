// @ts-check
"use strict";
/* tower-proposals.js — proposed signal-tower styles for the two slime skins.
 *
 * The signal tower is the only structure with no per-theme painter: one routine
 * in buildings.js (drawSignalTower) draws the same steel mast in every skin,
 * while houses, growths, kiosks, props, monuments, signposts and ground all
 * change with the skin. These are candidate replacements, drawn beside the
 * current tower so they can be compared before anything reaches the world.
 *
 * The page loads the same way assets.html does: assets.js installs the engine
 * stub, then the canonical ../../theme-*.js and ../../buildings.js load in
 * place. The CURRENT row is therefore the live tower, not a copy of it. Only
 * the proposals below are new code, and they are written to drop into
 * buildings.js unchanged: each takes the same (C, b) context that
 * drawSignalTower takes, and uses the same local helpers.
 *
 * Wiring, if one is adopted: add `theme: T.id` to the env that defPaintBuilding
 * passes (engine.js, in the MH_BUILD.paint call) and branch on it inside
 * drawSignalTower. A theme-supplied paintBuilding would also work, but then
 * each theme has to re-delegate houses and trees back to MH_BUILD.paint.
 */
(function () {
  const RM = () => window.MH_ISO.reduced();

  /* ---- buildings.js helpers, same shapes, so a painter lifts out cleanly --- */
  function _p(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function _c(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 255 : v; }
  function _hex(r, g, b) { return "#" + ((1 << 24) + (_c(r) << 16) + (_c(g) << 8) + _c(b)).toString(16).slice(1); }
  function shd(h, a) { const c = _p(h), f = a < 0 ? 0 : 255, p = a < 0 ? -a : a; return _hex(c[0] + (f - c[0]) * p, c[1] + (f - c[1]) * p, c[2] + (f - c[2]) * p); }
  function rgba(h, al) { const c = _p(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + al + ")"; }
  function glow(g, x, y, r, col, blur, alpha) {
    g.save();
    if (alpha != null) g.globalAlpha = alpha;
    if (!RM()) { g.shadowColor = col; g.shadowBlur = blur; }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    g.restore();
  }
  function shadowPool(g, cx, cy, rx) {
    g.save(); g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.42, 0, 0, 6.2832); g.fill(); g.restore();
  }

  /* ---- the proposed state vocabulary -------------------------------------
     Today: unassigned is violet #c890ff, which is exactly the SPORES violet in
     both slime skins, so an idle tower reads as a large sporecap. These four
     read apart at a glance, and none of them relies on colour alone.
       unassigned  an unlit fixture: dark, no glow. Also invites the click.
       ready       steady cyan, no pulse.
       playing     cyan plus the beat ring.
       error       red, blinking slowly.                                      */
  function lamp(state, t) {
    const s = state.state, beat = Math.max(0, Math.min(1, state.beat || 0));
    if (s === "error") return { col: "#ff6b78", lit: true, beat: 0, dim: RM() ? 1 : 0.45 + 0.55 * (Math.sin(t * 3.4) > 0 ? 1 : 0.15) };
    if (s === "playing") return { col: "#7afcff", lit: true, beat, dim: 1 };
    if (s === "ready") return { col: "#7afcff", lit: true, beat: 0, dim: 1 };
    return { col: "#5d6f66", lit: false, beat: 0, dim: 1 };                    // unassigned
  }

  /** The lamp on top of a mast: the state's light, or none at all when
   *  unassigned, which is the whole point of the vocabulary. No housing: the
   *  bulb sits straight on the mast, so nothing hard-angled interrupts it. */
  function fixture(C, x, y, L) {
    const g = C.g;
    if (!L.lit) {                                                              // unlit: a dark bulb, still legible as a fixture
      g.fillStyle = "#3d5248"; g.beginPath(); g.arc(x, y - 2, 3.6, 0, 6.2832); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1; g.stroke();
      return;
    }
    glow(C.g, x, y - 2, 5 + L.beat * 4, L.col, 18 + L.beat * 12, 0.92 * L.dim);
    g.strokeStyle = rgba(L.col, 0.45 * L.dim); g.lineWidth = 1.4;              // the broadcast arcs, as today
    for (let r = 12; r <= 22; r += 10) { g.beginPath(); g.arc(x, y - 2, r, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); }
    if (L.beat > 0 && !RM()) {
      g.save(); g.globalAlpha = L.beat; g.strokeStyle = L.col; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y - 2, 11 + (1 - L.beat) * 16, 0, 6.2832); g.stroke(); g.restore();
    }
  }

  /* ======================================================================
     technurture proposals
     ====================================================================== */

  /** A. Colonised mast: the steel stays and the world climbs it. */
  function towerColonised(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    shadowPool(g, sx, sy, 18);
    g.fillStyle = rgba("#3fa882", 0.9);                                        // a gel footing, not blue steel
    g.beginPath(); g.ellipse(sx, sy, 16, 7.5, 0, 0, 6.2832); g.fill();
    g.fillStyle = rgba("#2f8a68", 0.9);                                        // ooze creeping up the feet
    for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(sx + i * 7, sy - 2, 4.5, 3, 0, 0, 6.2832); g.fill(); }
    g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx, sy - 68); g.stroke();
    g.strokeStyle = "#8fc4b4"; g.lineWidth = 2;
    for (let y = sy - 12; y >= sy - 60; y -= 12) { g.beginPath(); g.moveTo(sx - 9, y); g.lineTo(sx + 9, y); g.stroke(); }
    for (let i = 0; i < 3; i++) {                                              // vines up the lower two thirds
      const x0 = sx - 7 + i * 7, sway = RM() ? 0 : Math.sin(t * 1.3 + i * 1.7) * 1.5, top = sy - 30 - i * 9;
      g.strokeStyle = "#3f7a3a"; g.lineWidth = 1.7; g.beginPath(); g.moveTo(x0, sy - 2);
      for (let k = 1; k <= 4; k++) g.quadraticCurveTo(x0 + (k % 2 ? 3.4 : -3.4) + sway, sy - (sy - top) * (k - 0.5) / 4, x0 + sway * 0.5, sy - (sy - top) * k / 4);
      g.stroke();
      g.fillStyle = "#56a04e";
      for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x0 + sway, sy - (sy - top) * k / 4, 2.1, 0, 6.2832); g.fill(); }
    }
    fixture(C, sx, sy - 70, L);
  }

  /** B. Bioantenna: no steel at all, a grown stalk with a spore-cap beacon. */
  function towerBioantenna(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    const lean = (C.R(11) - 0.5) * 10, sway = RM() ? 0 : Math.sin(t * 1.1) * 2;
    const topX = sx + lean + sway, topY = sy - 72;
    shadowPool(g, sx, sy, 17);
    g.fillStyle = rgba("#3a9c86", 0.92);                                       // a swollen holdfast
    g.beginPath(); g.ellipse(sx, sy - 2, 14, 8, 0, 0, 6.2832); g.fill();
    const grd = g.createLinearGradient(sx, sy, topX, topY);                    // the stalk, lit from above
    grd.addColorStop(0, "#2f7f68"); grd.addColorStop(1, "#5ec4a6");
    g.strokeStyle = grd; g.lineCap = "round";
    g.lineWidth = 8; g.beginPath(); g.moveTo(sx, sy - 4); g.quadraticCurveTo(sx + lean * 0.3, sy - 40, topX, topY); g.stroke();
    g.strokeStyle = rgba("#aaffe6", 0.5); g.lineWidth = 2;                     // a gel highlight down one side
    g.beginPath(); g.moveTo(sx - 2, sy - 6); g.quadraticCurveTo(sx + lean * 0.3 - 2, sy - 40, topX - 2, topY + 4); g.stroke();
    for (let i = 0; i < 3; i++) {                                              // tendril whorls where the rungs were
      const y = sy - 18 - i * 16, x = sx + lean * ((sy - y) / 72) * 0.3;
      g.strokeStyle = "#4fb07a"; g.lineWidth = 2; g.lineCap = "round";
      for (const d of [-1, 1]) {
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + d * 9, y - 2, x + d * 11 + (RM() ? 0 : Math.sin(t * 1.9 + i) * 1.5), y - 8);
        g.stroke();
      }
    }
    const swell = L.beat * 2.2;                                                // the cap inflates on the beat
    g.fillStyle = L.lit ? rgba("#b06ad0", 0.95) : rgba("#4a5e52", 0.95);
    g.beginPath(); g.ellipse(topX, topY, 11 + swell, 7.5 + swell * 0.7, 0, Math.PI, 0); g.fill();
    g.fillStyle = rgba("#2a4a3a", 0.85);
    g.beginPath(); g.ellipse(topX, topY, 11 + swell, 2.6, 0, 0, 6.2832); g.fill();
    if (L.lit) {
      glow(g, topX, topY - 3, 4 + L.beat * 3, L.col, 18 + L.beat * 12, 0.9 * L.dim);
      for (let i = -1; i <= 1; i++) glow(g, topX + i * 5, topY - 8 - (i & 1) * 2, 1.3, L.col, 7, 0.7 * L.dim);
    }
  }

  /** C. Resonator lily: an upturned dish, beats rippling across it. */
  function towerLily(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    const dy = sy - 62;
    shadowPool(g, sx, sy, 18);
    g.fillStyle = rgba("#3fa882", 0.9); g.beginPath(); g.ellipse(sx, sy, 15, 7, 0, 0, 6.2832); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx, dy); g.stroke();
    g.strokeStyle = "#8fc4b4"; g.lineWidth = 2;
    for (let y = sy - 14; y >= dy + 10; y -= 14) { g.beginPath(); g.moveTo(sx - 7, y); g.lineTo(sx + 7, y); g.stroke(); }
    g.fillStyle = rgba("#3fa37a", 0.92);                                       // the pad, tilted to the sky
    g.beginPath(); g.ellipse(sx, dy, 24, 9.5, 0, 0, 6.2832); g.fill();
    g.strokeStyle = rgba("#0c2e22", 0.55); g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = rgba("#aaffe6", 0.45); g.lineWidth = 1;                    // radial veins
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(sx, dy); g.lineTo(sx + Math.cos(a) * 22, dy + Math.sin(a) * 8.5); g.stroke(); }
    if (L.lit) {                                                               // the rim carries the state: a small bud cannot
      g.strokeStyle = rgba(L.col, 0.85 * L.dim); g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(sx, dy, 24, 9.5, 0, 0, 6.2832); g.stroke();
      if (!RM()) {
        g.save(); g.shadowColor = L.col; g.shadowBlur = 14; g.strokeStyle = rgba(L.col, 0.5 * L.dim); g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(sx, dy + 1, 24, 9.5, 0, 0, 6.2832); g.stroke(); g.restore();
      }
    }
    if (L.lit && L.beat > 0 && !RM()) {                                        // a ripple crossing the dish
      g.strokeStyle = rgba(L.col, 0.75 * (1 - L.beat)); g.lineWidth = 2;
      const r = 4 + (1 - L.beat) * 20;
      g.beginPath(); g.ellipse(sx, dy, r, r * 0.4, 0, 0, 6.2832); g.stroke();
    }
    if (L.lit) glow(g, sx, dy - 4, 4 + L.beat * 2.5, L.col, 16, 0.92 * L.dim);
    else { g.fillStyle = "#3d5248"; g.beginPath(); g.arc(sx, dy - 4, 3.4, 0, 6.2832); g.fill(); g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1; g.stroke(); }
  }


  /** A-night. Colonised pylon: the same idea after dark. The steel survives as
   *  iron, the rungs go to bone so the silhouette reads through the night
   *  multiply, and the growth on it is drained and faintly luminous rather
   *  than green. */
  function towerColonisedNight(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    shadowPool(g, sx, sy, 18);
    g.fillStyle = rgba("#1c4738", 0.92);                                       // the gel footing, drained
    g.beginPath(); g.ellipse(sx, sy, 16, 7.5, 0, 0, 6.2832); g.fill();
    g.fillStyle = rgba("#14342a", 0.92);
    for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(sx + i * 7, sy - 2, 4.5, 3, 0, 0, 6.2832); g.fill(); }
    glow(g, sx - 6, sy - 2, 1.4, "#5fe0c8", 8, 0.5);                           // one cold bead in the ooze
    g.strokeStyle = "#14160f"; g.lineWidth = 3.5;                              // iron, not ink
    g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx, sy - 68); g.stroke();
    for (let i = 0, y = sy - 12; y >= sy - 60; y -= 12, i++) {
      g.strokeStyle = "#cdbf9a"; g.lineWidth = 2;                              // bone rungs carry the shape at night
      g.beginPath(); g.moveTo(sx - 9, y); g.lineTo(sx + 9, y); g.stroke();
      if (C.R(40 + i) > 0.55) {                                                // rust bleeding from a joint
        g.strokeStyle = rgba("#7a2e2e", 0.7); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(sx - 1.5, y + 1); g.lineTo(sx - 1.5, y + 5 + C.R(50 + i) * 4); g.stroke();
      }
    }
    for (let i = 0; i < 3; i++) {                                              // the same vines, gone dark
      const x0 = sx - 7 + i * 7, sway = RM() ? 0 : Math.sin(t * 1.1 + i * 1.7) * 1.4, top = sy - 30 - i * 9;
      g.strokeStyle = "#1f5a3a"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x0, sy - 2);
      for (let k = 1; k <= 4; k++) g.quadraticCurveTo(x0 + (k % 2 ? 3.4 : -3.4) + sway, sy - (sy - top) * (k - 0.5) / 4, x0 + sway * 0.5, sy - (sy - top) * k / 4);
      g.stroke();
      for (let k = 1; k < 4; k++) {                                            // buds that hold a little light
        const bx = x0 + sway, by = sy - (sy - top) * k / 4;
        g.fillStyle = "#26533c"; g.beginPath(); g.arc(bx, by, 2.2, 0, 6.2832); g.fill();
        if ((i + k) % 2 === 0) glow(g, bx, by, 1.2, "#7fffc0", 7, 0.55);
      }
    }
    if (L.lit && !RM()) {                                                      // the lamp reaches the ground here
      const cone = g.createLinearGradient(sx, sy - 70, sx, sy);
      cone.addColorStop(0, rgba(L.col, 0.26 * L.dim)); cone.addColorStop(1, rgba(L.col, 0));
      g.fillStyle = cone;
      g.beginPath(); g.moveTo(sx - 5, sy - 69); g.lineTo(sx + 5, sy - 69); g.lineTo(sx + 21, sy + 2); g.lineTo(sx - 21, sy + 2); g.closePath(); g.fill();
    }
    fixture(C, sx, sy - 70, L);
  }

  /* ======================================================================
     technoscure proposals
     ====================================================================== */

  const IRON = "#14160f", BONE = "#cdbf9a", CR = "#7a2e2e";

  /** Shared body for D/E/F: rusted iron mast, bone rungs, lamp housing. */
  function pylonBody(C, sx, sy, L, opts) {
    const g = C.g, t = C.t, missing = opts && opts.missingRung;
    g.fillStyle = rgba("#1a1c16", 0.92); g.beginPath(); g.ellipse(sx, sy, 15, 7, 0, 0, 6.2832); g.fill();
    g.strokeStyle = IRON; g.lineWidth = 3.5; g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx, sy - 68); g.stroke();
    let i = 0;
    for (let y = sy - 12; y >= sy - 60; y -= 12, i++) {
      if (missing != null && i === missing) continue;                          // a rung gone to rust
      g.strokeStyle = BONE; g.lineWidth = 2;                                   // bone reads through the night multiply
      g.beginPath(); g.moveTo(sx - 9, y); g.lineTo(sx + 9, y); g.stroke();
      if (C.R(40 + i) > 0.55) {                                                // rust bleeding from the joint
        g.strokeStyle = rgba(CR, 0.75); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(sx - 1.5, y + 1); g.lineTo(sx - 1.5, y + 5 + C.R(50 + i) * 4); g.stroke();
      }
    }
    g.fillStyle = IRON;                                                        // the lamp housing
    g.beginPath(); g.moveTo(sx - 7, sy - 68); g.lineTo(sx + 7, sy - 68); g.lineTo(sx + 4, sy - 76); g.lineTo(sx - 4, sy - 76); g.closePath(); g.fill();
    if (L.lit && !RM()) {                                                      // a light cone onto the ground
      const cone = g.createLinearGradient(sx, sy - 70, sx, sy);
      cone.addColorStop(0, rgba(L.col, 0.30 * L.dim)); cone.addColorStop(1, rgba(L.col, 0));
      g.fillStyle = cone;
      g.beginPath(); g.moveTo(sx - 5, sy - 69); g.lineTo(sx + 5, sy - 69); g.lineTo(sx + 21, sy + 2); g.lineTo(sx - 21, sy + 2); g.closePath(); g.fill();
    }
    if (L.lit) glow(g, sx, sy - 72, 5 + L.beat * 4, L.col, 18 + L.beat * 12, 0.95 * L.dim);
    else { g.fillStyle = "#2b322c"; g.beginPath(); g.arc(sx, sy - 72, 4, 0, 6.2832); g.fill(); g.strokeStyle = rgba(BONE, 0.4); g.lineWidth = 1; g.stroke(); }
  }

  /** D. Rusted pylon. */
  function towerPylon(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy;
    shadowPool(g, sx, sy, 18);
    pylonBody(C, sx, sy, lamp(C.state, C.t), null);
  }

  /** E. Moth tower: D, with the skin's fireflies drawn to the lamp. */
  function towerMoth(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    shadowPool(g, sx, sy, 18);
    pylonBody(C, sx, sy, L, null);
    if (!L.lit || RM()) return;
    const cx = sx, cy = sy - 72;
    for (let i = 0; i < 5; i++) {                                              // orbiting, and flung wider on the beat
      const a = t * (0.7 + i * 0.13) + i * 1.9, r = 9 + (i % 3) * 4 + L.beat * 7;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.55;
      const blink = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4 + i * 2.1));
      glow(g, x, y, 1.9, "#ffe79a", 10, blink * 0.9);
    }
  }

  /** F. Broadcast ruin: leaning, a rung gone, guyed, still transmitting. */
  function towerRuin(C, b) {
    const g = C.g, sx = C.sx, sy = C.sy, t = C.t, L = lamp(C.state, t);
    const lean = (C.R(7) - 0.5) * 0.16;                                        // stable per tile, about 4 degrees
    shadowPool(g, sx, sy, 19);
    g.save();
    g.translate(sx, sy); g.rotate(lean); g.translate(-sx, -sy);
    pylonBody(C, sx, sy, L, { missingRung: 1 + Math.floor(C.R(9) * 3) });
    g.restore();
    const tx = sx + Math.sin(lean) * -68, ty = sy - 68 * Math.cos(lean);       // guy-wires, from the leaned top
    g.strokeStyle = rgba(BONE, 0.45); g.lineWidth = 1.2;
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(tx, ty + 4); g.lineTo(sx + d * 20, sy + 1); g.stroke(); }
    g.fillStyle = rgba(CR, 0.5);                                               // a wreath of rust at the foot
    g.beginPath(); g.ellipse(sx, sy + 1, 17, 5, 0, 0, 6.2832); g.fill();
  }

  window.MH_TOWERS = {
    lamp,
    variants: [
      { id: "current",    skin: "both",         label: "Live", note: "what buildings.js draws today: the colonised mast, adopted from A", canonical: true },
      { id: "colonised",  skin: "technurture",  label: "A. Colonised mast", note: "the steel stays, the world climbs it", draw: towerColonised },
      { id: "bioantenna", skin: "technurture",  label: "B. Bioantenna", note: "grown, not built: a gel stalk with a spore-cap beacon", draw: towerBioantenna },
      { id: "lily",       skin: "technurture",  label: "C. Resonator lily", note: "an upturned dish; beats ripple across it", draw: towerLily },
      { id: "colonised-night", skin: "technoscure", label: "A-night. Colonised pylon", note: "the same mast after dark: iron, bone rungs, drained vines with faint buds", draw: towerColonisedNight },
      { id: "pylon",      skin: "technoscure",  label: "D. Rusted pylon", note: "iron and bone, with a light cone onto the ground", draw: towerPylon },
      { id: "moth",       skin: "technoscure",  label: "E. Moth tower", note: "D, with fireflies drawn to the lamp", draw: towerMoth },
      { id: "ruin",       skin: "technoscure",  label: "F. Broadcast ruin", note: "leaning, a rung gone, guyed, still transmitting", draw: towerRuin },
    ],
  };
})();
