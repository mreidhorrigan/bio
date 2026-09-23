// @ts-check
"use strict";
/* ============================================================================
   verse3d-scenes.js  ·  three places in the slimeverse, for verse3d.js
   ----------------------------------------------------------------------------
   outdoors   the village by day: rolling ground in technurture's alien
              biomes, the plaza and its monument, gel dwellings, a colonised
              signal tower, a pond, flora, the Glossary's wellhead, a knot of
              zoogs grazing, and shoggoths hunting them
   indoors    inside one dwelling: a gel dome lit from within, a skylight,
              shelves, a table, lamps, a gel bath, a hatch down to the cave,
              pet zoogs, and a shoggoth rooted in a pot like a houseplant
   cave       slime3d.js's corridor, shorter: the living half and the dark
              half, with zoogs in the green and shoggoths in the dark

   The ways between them: the dwelling's door (outdoors to indoors and back),
   the wellhead and the hatch (down to the cave), and the rope under the shaft
   (back up to the wellhead).

   Every surface is an analytic function of position, and every prop is placed
   by a hash of its index, so each scene is the same on every visit and
   nothing is stored.
   ========================================================================== */
(function () {
  const V = window.MH_VERSE3D, M3 = window.MH_3D;
  if (!V || !M3) return;
  const { clamp, lerp, smooth, TAU, mix, rgba, shade } = M3;
  const { hash, hash2 } = V;

  /** A gradient down a body's box: lit top, shaded foot. */
  /** Lit top, shaded foot: a gradient the engine makes once per colour pair. */
  const vgrad = (hi, lo) => ({ vgrad: [hi, lo] });
  const sheen = (alpha) => (g, ring, bb) => {
    g.save(); M3.traceRing(g, ring); g.clip();
    g.globalAlpha = alpha; g.fillStyle = "#fff";
    g.beginPath(); g.ellipse(bb.x + bb.w * 0.34, bb.y + bb.h * 0.24, bb.w * 0.2, bb.h * 0.12, -0.5, 0, TAU); g.fill();
    g.restore();
  };
  /** A soft halo round a body: a gradient, never a blur. */
  const halo = (colour, reach) => (g, ring, bb) => {
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, r = Math.max(bb.w, bb.h) * (reach || 1.6);
    const gr = g.createRadialGradient(cx, cy, bb.w * 0.3, cx, cy, r);
    gr.addColorStop(0, rgba(colour, 0.35)); gr.addColorStop(1, rgba(colour, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  };
  /** A light on the far side of the room seen through the air: a billboard glow. */
  function glowAt(E, p, colour, size, o) {
    E.billboard(p, (g, sx, sy, k, e) => {
      const r = Math.max(2, size * k), a = 1 - (e.fog ? e.fog.t : 0);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, rgba(colour, 0.55 * a)); gr.addColorStop(1, rgba(colour, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
    }, Object.assign({ layer: 2 }, o || {}));
  }

  /** The dwelling with the lit doorway, one size inside and out, and the
   *  shape the iso skins draw (theme-technurture.js paintKiosk): a gel mound
   *  that bulges past its base and closes to a crown. Its size comes from the
   *  shared table (MH_VERSE3D.SIZES.dwelling, enterable); the door and window
   *  sit where the iso drawing puts them: the door 0.3 of the base half-width
   *  wide each side and a third of the height tall, a window 0.42 of the
   *  half-width round from it, 0.52 of the way up.                          */
  const DW = V.size("dwelling");
  const HOUSE = { r: DW.w, h: DW.h, doorW: Math.asin(0.3), doorH: DW.h * 0.13, arch: DW.h * 0.2,
    winA: Math.asin(0.42), winY: DW.h * 0.52, winRy: DW.h * 0.12, winRx: DW.w * 0.15 };
  /** The Glossary's well: one mouth, seen from the village and from the cave
   *  under it; the iso wellhead's shaft, 30 px across its half, in world units. */
  const WELL_R = 30 * V.UNIT / 13;
  /** A dwelling's radius at height hy above its foot. */
  const houseRad = (q, hy) => q.r * V.DWELL(hy / q.h);

  /* ═══════════════════════════════ THE CAVE ═══════════════════════════════ */
  V.defineScene("cave", { name: "The cave", setup(ctx) {
    const { E, me } = ctx, M = M3;
    const SHAFT = { kind: "shaft" }, UNIT_H = V.size("slime").h * 2;
    const ROPE = 11;                                           // the rope's offset from the middle, under the shaft's rim
    /* The cave is a ring, as the glossary's cave is a circuit: walk on past the
       dark half and it brings you back round to the lit half and the shaft.
       Every wave along it is a whole number of turns of the ring (K), so it
       joins itself without a seam, and the runtime wraps it (period END). */
    const END = 1504, DARK_FROM = 700, SEEN = 200, STEP = 7;
    const K = (n) => (TAU * n) / END;                            // n waves to one round of the ring
    const ringZ = (z) => z - END * Math.floor(z / END);           // where along the ring, 0 to END
    const centre = (z) => 16 * Math.sin(z * K(3)) + 6 * Math.sin(z * K(7) + 1.2);
    const halfWidth = (z) => 26 + 6 * Math.sin(z * K(5) + 0.6);
    // dark from DARK_FROM, and lit again before the ring closes, so the shaft stands in the light
    const darkAt = (z) => { const r = ringZ(z); return smooth((r - DARK_FROM) / 90) * smooth((END - 60 - r) / 90); };
    function floorAt(x, z) {
      const off = x - centre(z);
      return -5 * Math.sin(z * K(5)) - 2.4 * Math.sin(z * K(11) + 1.7)
        - 1.2 * Math.sin(z * K(26) + 0.3) - 1.1 * Math.sin(off * 0.17 + z * K(5))
        + 0.06 * off * off / halfWidth(z);
    }
    /** The shaft: over the first stretch the roof opens up toward the well. */
    const shaft = (x, z) => { const dz = z - 10 - END * Math.round((z - 10) / END), d = Math.hypot(x - centre(10), dz); return d < 12 ? 26 * smooth(1 - d / 12) : 0; };
    function roofAt(x, z) {
      const head = lerp(30, 19, darkAt(z));
      return floorAt(x, z) + head + 2.2 * Math.sin(z * K(14) + 2.1) + 1.4 * Math.sin(x * 0.2) + shaft(x, z);
    }
    const headroom = (z) => roofAt(centre(z), z) - floorAt(centre(z), z);
    /* The cave is round-edged: across it, the floor curves up into each wall
       and the wall curves over into the roof, a quarter-circle of radius
       RC(z) at each corner. profile(side, z, f) walks that section from where
       the floor starts to curve (f = 0) round to where the roof ends (f = 1)
       and returns [x, y] and the inward normal. */
    const RC = (z) => Math.min(7, headroom(z) * 0.3);
    function profile(side, z, f) {
      const c = centre(z), w = halfWidth(z), r = RC(z), xc = c + side * (w - r);
      const fy = floorAt(xc, z) + r, ry = roofAt(xc, z) - r, straight = Math.max(0, ry - fy);
      const arc = (Math.PI / 2) * r, L = 2 * arc + straight;
      let t = f * L;
      if (t < arc) { const a = t / r; return [xc + side * Math.sin(a) * r, fy - Math.cos(a) * r, -side * Math.sin(a), Math.cos(a)]; }
      t -= arc;
      if (t < straight) return [xc + side * r, fy + t, -side, 0];
      const a = Math.min(Math.PI / 2, (t - straight) / r);
      return [xc + side * Math.cos(a) * r, ry + Math.sin(a) * r, -side * Math.cos(a), -Math.sin(a)];
    }
    /** Inside the rounded section, with a margin: where a camera may stand. */
    function inTube(x, y, z, m) {
      const c = centre(z), w = halfWidth(z), off = Math.abs(x - c), r = RC(z);
      if (off > w - m) return false;
      const fl = floorAt(x, z), rf = roofAt(x, z);
      if (y < fl + m || y > rf - m) return false;
      if (off <= w - r) return true;
      const dx = off - (w - r), xc = c + Math.sign(x - c) * (w - r);
      const fy = floorAt(xc, z) + r, ry = roofAt(xc, z) - r;
      if (y < fy) return Math.hypot(dx, fy - y) < r - m;
      if (y > ry) return Math.hypot(dx, y - ry) < r - m;
      return true;
    }
    const LIT = { rock: "#5b5343", rockLo: "#3f3a2e", wall: "#4a4436", roof: "#332f26",
      air: "#25382c", airFar: "#1a2a20", ink: "rgba(12,18,12,0.85)", moss: "#5d9152",
      vine: "#4f7d4a", leaf: "#7fb46a", gel: "#7fb46a", gelLo: "#3c6438", glow: "#cfeeb6",
      water: "rgba(120,220,200,0.42)", shallow: "#7adcc8", deep: "#1a4a48", glint: "rgba(225,255,250,0.9)",
      board: "#f6f4ee", boardInk: "rgba(12,18,12,0.9)", text: "#1a1a1a" };
    const DARK = { rock: "#23261c", rockLo: "#14160f", wall: "#1f2319", roof: "#14160f",
      air: "#0d120e", airFar: "#070b08", ink: "rgba(190,208,226,0.45)", moss: "#2a3128",
      vine: "#5c5a46", leaf: "#4a6a4e", gel: "#3a6a5e", gelLo: "#1c3a34", glow: "#3a8a82",
      water: "rgba(58,138,130,0.36)", shallow: "#3a8a82", deep: "#06181a", glint: "rgba(160,225,215,0.75)",
      board: "#11180f", boardInk: "#3a8a82", text: "#caa24a" };
    const palCache = new Map();
    function palZ(z) {
      const band = Math.round(ringZ(z) / 6);
      let P = palCache.get(band);
      if (P) return P;
      const t = darkAt(band * 6);
      P = { t };
      for (const k in LIT) P[k] = mix(LIT[k], DARK[k], t);
      P.floorSteps = []; P.wallHi = []; P.roofSteps = [];
      for (let i = 0; i < 8; i++) {
        P.floorSteps.push(mix(P.rockLo, P.rock, 0.3 + 0.7 * i / 7));
        P.wallHi.push(shade(P.wall, 0.08 + 0.1 * i / 7));
        P.roofSteps.push(mix(P.roof, P.rock, 0.15 + 0.35 * i / 7));
      }
      P.wallLo = shade(P.wall, -0.16); P.rockHi = shade(P.rock, 0.16);
      palCache.set(band, P);
      return P;
    }
    const pal = (x, z) => palZ(z);

    // basins along the corridor, found once from the floor itself
    const pools = [];
    for (let z = 60; z < END - 40 && pools.length < 5; z += 6) {
      const y = floorAt(centre(z), z);
      if (floorAt(centre(z - 6), z - 6) <= y || floorAt(centre(z + 6), z + 6) <= y) continue;
      let lo = z, hi = z;
      while (hi - lo < 130 && (floorAt(centre(lo), lo) - y < 2.6 || floorAt(centre(hi), hi) - y < 2.6)) {
        if (floorAt(centre(lo), lo) - y < 2.6) lo -= 6;
        if (floorAt(centre(hi), hi) - y < 2.6) hi += 6;
      }
      if (hi - lo < 24 || hi - lo >= 130 || pools.some((p) => Math.abs(p.z - z) < 150)) continue;
      pools.push({ x: centre(z), z, rx: halfWidth(z) - 2, rz: Math.max(z - lo, hi - z) + 4, depth: 1.6 });
    }
    const wetZ = (z) => pools.some((p) => Math.abs(z - p.z) < p.rz);

    // what stands in the cave: slime3d.js's five kinds
    const PROPS = [], solids = [];
    for (let i = 0; i < 150; i++) {
      const z = 40 + i * 10 + hash(i) * 8;
      if (z > END - 20) break;
      if (wetZ(z)) continue;
      const w = halfWidth(z), c = centre(z), dark = darkAt(z);
      const r = [hash(i * 3 + 1), hash(i * 3 + 2), hash(i * 3 + 3)];
      const x = c + (r[0] * 2 - 1) * (w - 4 - RC(z) * 0.5), edge = Math.abs(x - c) / w;
      const roll = r[1];
      // growth at every scale: mostly small, some large, now and then a giant
      const g = hash(i * 7 + 5), big = g < 0.08 ? 2.2 : g < 0.3 ? 1.4 : 0.6 + g * 0.6;
      if (roll < 0.28 && edge > 0.42) { const q = { kind: "boulder", x, z, r: (1.6 + r[2] * 2.6) * Math.sqrt(big), s: 0.5 + r[0] * 0.5 }; PROPS.push(q); solids.push({ x, z, r: q.r, h: q.r * q.s * 1.8 }); }
      else if (roll < 0.44 && edge > 0.5 && dark < 0.5) { const q = { kind: "mound", x, z, r: (1.7 + r[2] * 1.6) * big, h: (2.4 + r[0] * 3.4) * big }; PROPS.push(q); solids.push({ x, z, r: q.r * 0.95, h: q.h }); }
      else if (roll < 0.54 && edge > 0.45) { PROPS.push({ kind: "bulb", x, z, r: (0.5 + r[2] * 0.5) * big, up: (1.4 + r[0] * 2.2) * big * big, lean: (r[1] - 0.5) * 0.8 * big }); solids.push({ x, z, r: 0.45 * big }); }
      else if (roll < 0.72 && edge > 0.3 && dark < 0.72) PROPS.push({ kind: "moss", x, z, r: (2.4 + r[2] * 3.2) * big, k: r[0] });
      else if (roll < 0.92 && dark < 0.92) { const room = roofAt(x, z) - floorAt(x, z), drop = Math.min(room - 1.2, (4 + r[2] * 8) * big);
        PROPS.push({ kind: "vine", x, z, drop, k: r[0], leaves: 2 + Math.floor(r[1] * 2 * big) });
        if (room - drop < UNIT_H) solids.push({ x, z, r: 0.5 }); }        // a vine that reaches down to the slime's height is in its way
    }

    const view = { z0: 0, z1: 0 };
    function viewRange() {
      const f = Math.cos(E.cam.yaw);
      const ahead = 30 + (SEEN - 30) * Math.max(0, f), behind = 30 + (SEEN - 30) * Math.max(0, -f);
      view.z0 = Math.min(me.z - 12, E.cam.z - behind);           // no ends: the ring goes on
      view.z1 = Math.max(me.z + 12, E.cam.z + ahead);
    }
    const span = (step) => [Math.floor(view.z0 / step) * step, view.z1];
    const detailAt = (z) => { const far = Math.abs(z - E.cam.z); return far > 130 ? 0 : far > 70 ? 1 : 2; };
    const inkFade = (z) => clamp((110 - Math.abs(z - E.cam.z)) / 60, 0, 1);

    function buildFloor() {
      const [z0, z1] = span(STEP);
      for (let z = z0; z < z1; z += STEP) {
        const P = palZ(z + STEP / 2), pts = [];
        const cA = centre(z), cB = centre(z + STEP), wA = halfWidth(z) - RC(z) + 0.6, wB = halfWidth(z + STEP) - RC(z + STEP) + 0.6;
        for (let k = 0; k <= 4; k++) { const x = cA - wA + (2 * wA * k) / 4; pts.push([x, floorAt(x, z) - 0.3, z]); }
        for (let k = 4; k >= 0; k--) { const x = cB - wB + (2 * wB * k) / 4; pts.push([x, floorAt(x, z + STEP) - 0.3, z + STEP]); }
        E.face(pts, P.rockLo, null, 0, { layer: -1 });
      }
      const [b0, b1] = span(4);
      for (let z = b0; z < b1; z += 4) {
        const P = palZ(z), w = halfWidth(z), c = centre(z), lod = detailAt(z), n = 4 + ((z / 4) & 1), fade = inkFade(z);
        for (let i = 0; i < n; i++) {
          const k = hash2(z, i), k2 = hash2(z, i + 9), k3 = hash2(z, i + 17);
          const u = -0.92 + (1.84 * (i + 0.5)) / n + (k - 0.5) * 0.3;
          const x = c + u * (w - RC(z) * 0.7), zz = z + (k2 - 0.5) * 3.5, r = 2.6 + k3 * 2.2;
          const pts = M.shapes.disc(x, zz, r, [6, 8, 10][lod], (px, pz) => floorAt(px, pz) + 0.06, (j) => 0.16 * Math.sin(j * 2.1 + k * 9));
          E.organic(pts, P.floorSteps[Math.floor(k * 7.99)], fade > 0.02 ? rgba(P.ink, 0.3 * fade) : null, 0.7, { layer: 0, stable: true, bias: k * 0.4, inkPx: 9 });
        }
      }
    }
    function buildWalls() {
      // the rounded section, laid as bands along the cave: SEGS per side, fewer far off
      const [z0, z1] = span(STEP);
      for (let z = z0; z < z1; z += STEP) {
        const P = palZ(z + STEP / 2), lod = detailAt(z), segs = [3, 5, 6][lod], z2 = z + STEP + 0.35;   // each band runs a little into the next strip
        for (const side of [-1, 1]) {
          let pa = profile(side, z, 0), pb = profile(side, z2, 0);
          for (let k = 1; k <= segs; k++) {
            // and a little into the next band up: overlapping, the bands leave no
            // seam between them, which stroking every band to seal it had cost
            const f = Math.min(1, (k + 0.12) / segs), qa = profile(side, z, f), qb = profile(side, z2, f);
            // the colour turns smoothly from floor to wall to roof, band by band,
            // and each band is sealed in its own colour so no seam shows between
            const up = (qa[3] + pa[3]) / 2, col = up >= 0 ? mix(P.wall, P.rockLo, up) : mix(P.wall, P.roof, -up);
            E.face([[pa[0], pa[1], z], [qa[0], qa[1], z], [qb[0], qb[1], z2], [pb[0], pb[1], z2]], col, null, 0, { layer: up > 0.55 ? -1 : 2, bias: -STEP });
            pa = profile(side, z, k / segs); pb = profile(side, z2, k / segs);
          }
        }
      }
      // the end walls: the cave closes behind the shaft and at its far end, in the section's own round shape
      for (const zc of []) {                                    // (a ring has no end walls)
        if (zc < view.z0 - 10 || zc > view.z1 + 10) continue;
        const P = palZ(zc), pts = [];
        for (let k = 0; k <= 12; k++) { const q = profile(-1, zc, k / 12); pts.push([q[0], q[1], zc]); }
        for (let k = 12; k >= 0; k--) { const q = profile(1, zc, k / 12); pts.push([q[0], q[1], zc]); }
        E.face(pts, P.wall, null, 0, { layer: 2, bias: -STEP * 2 });
      }
      const [l0, l1] = span(5);
      for (let z = l0; z < l1; z += 5) {
        const P = palZ(z), lod = detailAt(z);
        for (const side of [-1, 1]) {
          for (let row = 0; row < 3; row++) {
            const k = hash2(z * side + 3, row), k2 = hash2(z * side + 3, row + 5);
            const zz = z + (k - 0.5) * 3, q = profile(side, zz, 0.2 + 0.3 * row + (k2 - 0.5) * 0.08);
            if (Math.abs(zz - 10 - END * Math.round((zz - 10) / END)) < 14 && q[3] < -0.3) continue;   // not across the open shaft
            const rz = 2.6 + k * 2.4, ry = 2.2 + k2 * 2.2, rx = 1.2 + k * 1.4, d = [[2, 5], [3, 6], [4, 8]][lod];
            // a fixed order among neighbours (row, then alternate columns): by depth alone, stacked lobes swapped and flickered
            E.organic(M.shapes.ball(q[0] + q[2] * rx * 0.55, q[1] + q[3] * ry * 0.45, zz, rx, ry, rz, d[0], d[1], false), vgrad(P.wallHi[Math.floor(k2 * 7.99)], P.wallLo), P.ink, 0.8, { layer: 2, inkPx: 7, bias: row * 0.6 + ((z / 5) & 1) * 0.3 });
          }
        }
      }
    }
    function buildRoof() {
      const [z0, z1] = span(STEP);
      for (let z = z0; z < z1; z += STEP) {
        const P = palZ(z + STEP / 2), pts = [];
        const cA = centre(z), cB = centre(z + STEP), wA = halfWidth(z) - RC(z) + 0.6, wB = halfWidth(z + STEP) - RC(z + STEP) + 0.6;
        for (let k = 0; k <= 4; k++) { const x = cA - wA + (2 * wA * k) / 4; pts.push([x, roofAt(x, z) + 0.3, z]); }
        for (let k = 4; k >= 0; k--) { const x = cB - wB + (2 * wB * k) / 4; pts.push([x, roofAt(x, z + STEP) + 0.3, z + STEP]); }
        E.face(pts, P.roof, null, 0, { layer: 2, bias: -STEP });
      }
      const [l0, l1] = span(6);
      for (let z = l0; z < l1; z += 6) {
        if (Math.abs(z - 10 - END * Math.round((z - 10) / END)) < 14) continue;   // the shaft is open rock, not hanging lobes
        const P = palZ(z), lod = detailAt(z), w = halfWidth(z), c = centre(z);
        for (let i = 0; i < 2; i++) {
          const k = hash2(z + 11, i), k2 = hash2(z + 11, i + 4);
          const x = c + (-0.45 + 0.9 * i + (k - 0.5) * 0.4) * (w - RC(z)), zz = z + (k2 - 0.5) * 4;
          const top = roofAt(x, zz), rx = 2.5 + k * 2, ry = 1.8 + k2 * 1.4, rz = 2.5 + k2 * 2, d = [[2, 5], [3, 6], [3, 7]][lod];
          E.organic(M.shapes.ball(x, top + ry * 0.45, zz, rx, ry, rz, d[0], d[1], false), P.roofSteps[Math.floor(k * 7.99)], P.ink, 0.7, { layer: 2, inkPx: 7, bias: i * 0.4 + ((z / 6) & 1) * 0.2 });
        }
        const k3 = hash2(z + 29, 1);
        if (k3 < 0.55) {
          const x = c + (k3 * 2 - 0.55) * (w - RC(z) - 1), zz = z + 2, top = roofAt(x, zz);
          E.organic(M.shapes.drip(x, top + 0.2, zz, 0.6 + k3 * 0.8, 2 + hash2(z + 29, 2) * 4.5, lod ? 7 : 5), P.rock, P.ink, 1, { layer: 2, inkPx: 4 });
        }
      }
    }
    /** No creases: a round cave has none, and a line drawn along the foot of
     *  the wall read as a crack in the corner. */
    function buildCreases() {}
    function buildProps() {
      for (const q0 of PROPS) {
        const qz = q0.z + END * Math.round((E.cam.z - q0.z) / END);   // its copy nearest the camera, round the ring
        if (qz < view.z0 || qz > view.z1) continue;
        const q = qz === q0.z ? q0 : Object.assign({}, q0, { z: qz });
        const P = palZ(q.z), lod = detailAt(q.z), y = floorAt(q.x, q.z);
        if (q.kind === "boulder") {
          const d = [[3, 6], [4, 8], [5, 10]][lod];
          E.organic(M.shapes.ball(q.x, y + q.r * q.s * 0.9, q.z, q.r, q.r * q.s, q.r * 0.92, d[0], d[1], false), vgrad(P.rockHi, P.rockLo), P.ink, 1, { layer: 2 });
        } else if (q.kind === "mound") {
          const d = [[3, 7], [4, 9], [6, 12]][lod];
          E.organic(M.shapes.ball(q.x, y, q.z, q.r, q.h, q.r, d[0], d[1], true), vgrad(P.gel, P.gelLo), P.ink, 1.2, { layer: 2, after: sheen(0.26) });
        } else if (q.kind === "bulb") {
          const top = y + q.up, tx = q.x + q.lean;
          E.line([[q.x, y, q.z], [q.x + q.lean * 0.3, y + q.up * 0.5, q.z], [tx, top, q.z]], P.vine, 0.26, { layer: 2, world: true });
          E.organic(M.shapes.ball(tx, top + q.r, q.z, q.r, q.r, q.r, 3, 6, false), P.glow, rgba(P.ink, 0.7), 1, { layer: 2, inkPx: 3, after: halo(P.glow) });
        } else if (q.kind === "moss") {
          E.organic(M.shapes.disc(q.x, q.z, q.r, [6, 9, 12][lod], (px, pz) => floorAt(px, pz) + 0.12, (j) => 0.25 * Math.sin(j * 2.3 + q.k * 7)), P.moss, P.ink, 0.8, { layer: 0, stable: true, bias: 1, inkPx: 6 });
        } else if (q.kind === "vine") {
          const top = roofAt(q.x, q.z), sway = ctx.reduce ? 0 : Math.sin(E.t * 0.7 + q.z * 0.1) * 0.7, pts = [];
          for (let i = 0; i <= 4; i++) { const f = i / 4; pts.push([q.x + sway * f * f + Math.sin(f * 5 + q.k * 6) * 0.3, top - q.drop * f, q.z]); }
          E.line(pts, P.vine, 0.3, { layer: 2, world: true });
          if (P.t < 0.85) for (let i = 1; i <= q.leaves; i++) {
            const f = i / (q.leaves + 1), p = pts[Math.min(4, Math.floor(f * 4))], lx = p[0] + 0.8, ly = top - q.drop * f;
            E.organic([[lx - 0.7, ly + 0.2, q.z], [lx + 0.6, ly + 0.5, q.z + 0.3], [lx + 1.3, ly - 0.1, q.z], [lx + 0.5, ly - 0.55, q.z - 0.3]], P.leaf, rgba(P.ink, 0.6), 0.8, { layer: 2, inkPx: 3, minPx: 1 });
          }
        }
      }
    }
    /** Under the well: daylight falling down the shaft, and the rope back up. */
    function buildShaft() {
      const z = 10 + END * Math.round((E.cam.z - 10) / END);     // the shaft's copy nearest the camera
      if (z < view.z0 - 20 || z > view.z1 + 20) return;
      const x = centre(10), fl = floorAt(x, z), top = roofAt(x, z);
      // the daylight falls through the well's own mouth, so its pool of light is the mouth's size
      E.organic(M.shapes.disc(x, z, WELL_R, 16, (px, pz) => floorAt(px, pz) + 0.1), "rgba(236,248,220,0.3)", null, 0, { layer: 0, stable: true, bias: 3, inkPx: 1e9, tag: SHAFT });
      E.organic(M.shapes.disc(x, z, WELL_R * 1.8, 16, (px, pz) => floorAt(px, pz) + 0.09), "rgba(236,248,220,0.1)", null, 0, { layer: 0, stable: true, bias: 2.9, inkPx: 1e9 });
      for (let i = 0; i < 3; i++) glowAt(E, [x + (i - 1) * 2, lerp(fl, top, 0.3 + i * 0.22), z], "#eaf6d8", 7 + i * 2);
      const sway = ctx.reduce ? 0 : Math.sin(E.t * 0.8) * 0.4;
      // the rope hangs at the side of the shaft, so walking on round the ring passes it by
      const rx = x + ROPE, rfl = floorAt(rx, z);
      E.line([[rx, top, z], [rx + sway * 0.5, rfl + 9, z], [rx + sway, rfl + 3.2, z]], "#8a6a3e", 0.22, { layer: 2, world: true });
      E.organic(M.shapes.ball(rx + sway, rfl + 2.4, z, 1.1, 1, 1.1, 3, 8, false), vgrad("#b98a52", "#6a4a2a"), "rgba(20,14,8,0.85)", 1, { layer: 2, inkPx: 3 });
    }

    const lim = (b, z) => halfWidth(z) - 3.4 - (b.R || 3.1);
    return {
      name: "The cave", seen: SEEN, floorAt, ceilAt: roofAt, pal, pools, solids,
      waterPhoto: { tint: "rgba(6,24,26,0.5)", over: 0.45 },   // the same photo, in the dark of a cave
      period: END,                                             // a ring: the runtime wraps it
      centre,                                                  // for probes: the ring's middle line
      walkable: (x, z) => Math.abs(x - centre(z)) < halfWidth(z),
      bound(b) {
        const l = lim(b, b.z), off = b.x - centre(b.z);
        if (Math.abs(off) > l) b.x = centre(b.z) + Math.sign(off) * l;
      },
      open: (x, y, z) => inTube(x, y, z, 1.5),
      entries: { well: { x: centre(24), z: 24, yaw: 0 }, start: { x: centre(24), z: 24, yaw: 0 } },
      portals: [{ x: centre(10) + ROPE, z: 10, r: 3.4, to: "outdoors", entry: "well" }],   // up the rope
      life: {
        zoogs: 10, shoggoths: 3, greet: true,
        spot: (rnd) => { const z = 90 + rnd() * (DARK_FROM - 200); return [centre(z) + (rnd() - 0.5) * 20, z]; },
        shogSpot: (rnd) => { const z = DARK_FROM + 60 + rnd() * (END - DARK_FROM - 140); return [centre(z) + (rnd() - 0.5) * 16, z]; },
        night: (x, z) => darkAt(z) > 0.5,
        motes: { n: 30, glow: "#3a8a82", core: "#e8fff6", spot: (rnd) => { const z = DARK_FROM - 40 + rnd() * (END - DARK_FROM); return [centre(z) + (rnd() - 0.5) * 30, z, 0.25 + rnd() * 0.5]; } },
      },
      camera: { dist: 58, height: (dist, x, z) => Math.min(dist * 0.3, headroom(z) * 0.45) },
      sky(g) {
        const P = palZ(me.z + 30), gr = g.createLinearGradient(0, 0, 0, E.H);
        gr.addColorStop(0, P.airFar); gr.addColorStop(1, P.air);
        g.fillStyle = gr; g.fillRect(0, 0, E.W, E.H);
      },
      build() { viewRange(); buildFloor(); buildWalls(); buildRoof(); buildCreases(); buildProps(); buildShaft(); },
    };
  } });

  /* ══════════════════════════════ INDOORS ══════════════════════════════════
     Inside the dwelling with the lit doorway, at the size it has outside
     (HOUSE, below): a drum of wall eight units high under a dome. The iso
     skins draw a dwelling as a fat translucent mound lit from within, so
     inside it is warm: the wall is lobes of lit gel, the dome closes to a
     skylight, and the door shows the day beyond it. No shoggoth comes in.   */
  function interior(NIGHT) { return { name: "Indoors", setup(ctx) {
    const { E } = ctx, M = M3;
    // the room is the dwelling's own outline, less a wall's thickness
    const R0 = HOUSE.r - 0.8, TOP = HOUSE.h - 0.8, SEEN = 64, SEG = 36;
    const DOOR_A = -Math.PI / 2, DOOR_W = HOUSE.doorW, K = R0 / 19.2;   // K: the furniture was laid out for a room of 19.2
    // laid out round a clear way in: from the door straight across the room
    // nothing stands within a slime's width of the middle line
    const BATH = { x: -6.5, z: 1, r: 4.6 * K }, HATCH = { x: 8, z: -2.5, r: Math.max(2.1, 2.4 * K) }, TABLE = { x: 6, z: 6, r: 3 * K };
    const POT = { x: -7.6, z: -5.5 };
    const ROOM = { kind: "room" };
    /** The inside of the shell at height hy: the outline, in by the wall. */
    const wallAt = (hy) => R0 * V.DWELL(hy / TOP);
    /** How high the shell stands over a point: the outline's upper side, solved once into a table. */
    const CEIL = [];
    for (let i = 0; i <= 64; i++) { const r = i / 64; let f = 1; while (f > 0 && V.DWELL(f) < r) f -= 0.005; CEIL.push(Math.max(0, f) * TOP); }
    const dist = (x, z) => Math.hypot(x, z);
    function floorAt(x, z) {
      const d = dist(x, z), db = Math.hypot(x - BATH.x, z - BATH.z);
      const dip = db < BATH.r ? 2.2 * (1 - (db / BATH.r) ** 2) ** 2 : 0;
      return 0.8 * (d / R0) ** 2 - dip;
    }
    const ceilAt = (x, z) => { const r = clamp(dist(x, z) / R0, 0, 1) * 64, i = Math.floor(r); return lerp(CEIL[i], CEIL[Math.min(64, i + 1)], r - i); };
    const P = NIGHT ? {                                        // the same room after dark: its lamps and its panes are the light
      air: "#0c0906", airFar: "#050403", ink: "rgba(0,0,0,0.7)", rock: "#3a2e1e", rockLo: "#241c12",
      wall: "#5a4a30", roof: "#3a2e1c", gel: "#3f8a68", gelLo: "#1c3a2c", moss: "#1f3a22", glow: "#ffb24a",
      water: "rgba(40,90,90,0.45)", shallow: "#2a6a66", deep: "#0a2424", glint: "rgba(255,210,150,0.7)",
      board: "#f6f4ee", boardInk: "rgba(40,26,12,0.9)", text: "#1a1a1a",
    } : {
      air: "#4a3a26", airFar: "#2c2217", ink: "rgba(40,26,12,0.8)", rock: "#8a6a44", rockLo: "#5c452c",
      wall: "#c9a66a", roof: "#a9844c", gel: "#9fe6c0", gelLo: "#3c8a68", moss: "#5d9152", glow: "#ffd98a",
      water: "rgba(120,220,200,0.42)", shallow: "#7adcc8", deep: "#1a4a48", glint: "rgba(255,250,230,0.9)",
      board: "#f6f4ee", boardInk: "rgba(40,26,12,0.9)", text: "#1a1a1a",
    };
    P.floorSteps = []; P.wallHi = []; P.roofSteps = [];
    for (let i = 0; i < 8; i++) {
      P.floorSteps.push(mix(P.rockLo, P.rock, 0.25 + 0.75 * i / 7));
      P.wallHi.push(shade(P.wall, 0.12 + 0.14 * i / 7));
      P.roofSteps.push(mix(P.roof, P.wall, 0.2 + 0.5 * i / 7));
    }
    P.wallLo = shade(P.wall, -0.2);
    const pal = () => P;
    const angleOff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d); };
    // One pane, the one the house shows outside (the iso dwelling's window, a
    // little round from the door). Outside it sits at the door's heading plus
    // winA; seen from inside, with the door on the -z wall, that is here.
    const WINDOWS = [DOOR_A - HOUSE.winA];
    const nearWindow = (a) => WINDOWS.some((w) => angleOff(a, w) < 0.2);
    const SHELF = { a0: 0.62, a1: 1.12, rows: [2.2, 4.3, 6.4] };
    const BOOK = ["#f0b62a", "#f28b46", "#d24f86", "#8a52d0", "#36b9d6", "#e0613a", "#6fae5a", "#e9dcb8"];
    const LAMPS = [[-9.5, 6], [10, 1], [-4.2, 8.6], [5.5, -10.5]];
    const WX = HATCH.r + 0.3;                                 // the windlass posts stand on the hatch's rim, inside its solid                                            // the windlass posts either side of the hatch

    // what is solid: furniture, the hatch and its posts, the pot, lamps, the bath's stones
    const solids = [
      { x: TABLE.x, z: TABLE.z, r: TABLE.r, h: 4 },
      { x: HATCH.x, z: HATCH.z, r: HATCH.r + 0.7, h: 1.2 },
      { x: POT.x, z: POT.z, r: 1.8, h: 5 },
    ];
    for (const [x, z] of LAMPS) solids.push({ x, z, r: 0.5, h: 6 });
    const toRoom = Math.atan2(-BATH.z, -BATH.x);               // the bath's rim opens toward the room
    const STONES = [];
    for (let j = 0; j < 12; j++) {
      const a = TAU * (j / 12) + 0.13;
      if (angleOff(a, toRoom) < 0.5) continue;                  // a way in
      const r = BATH.r + 0.5, x = BATH.x + Math.cos(a) * r, z = BATH.z + Math.sin(a) * r, k = hash2(j, 41);
      STONES.push({ x, z, k });
      solids.push({ x, z, r: 0.8 + k * 0.3, h: 1.2 });
    }

    function buildFloor() {
      const base = [];
      for (let k = 0; k < SEG; k++) { const a = TAU * (k / SEG); base.push([Math.cos(a) * (R0 + 0.6), floorAt(Math.cos(a) * R0, Math.sin(a) * R0) - 0.3, Math.sin(a) * (R0 + 0.6)]); }
      E.face(base, P.rockLo, null, 0, { layer: -1 });
      for (let gx = -R0; gx <= R0; gx += 3.4) for (let gz = -R0; gz <= R0; gz += 3.4) {
        const k = hash2(gx * 3 + 1, gz), k2 = hash2(gx, gz * 3 + 7);
        const x = gx + (k - 0.5) * 1.6, z = gz + (k2 - 0.5) * 1.6;
        if (dist(x, z) > R0 - 1 || !ctx.ahead(x, z, 4)) continue;
        if (Math.hypot(x - BATH.x, z - BATH.z) < BATH.r - 0.6) continue;
        const lod = ctx.lod(x, z), fade = ctx.inkFade(x, z), r = 1.7 + hash2(gx + 5, gz) * 1.2;
        const pts = M.shapes.disc(x, z, r, [6, 8, 10][lod], (px, pz) => floorAt(px, pz) + 0.06, (j) => 0.16 * Math.sin(j * 2.1 + k * 9));
        E.organic(pts, P.floorSteps[Math.floor(k * 7.99)], fade > 0.02 ? rgba(P.ink, 0.28 * fade) : null, 0.7, { layer: 0, stable: true, bias: k * 0.4, inkPx: 9 });
      }
      // a rug of moss under the table
      E.organic(M.shapes.disc(TABLE.x, TABLE.z, TABLE.r * 1.6, 16, (px, pz) => floorAt(px, pz) + 0.14, (j) => 0.08 * Math.sin(j * 1.7)), P.moss, P.ink, 0.8, { layer: 0, stable: true, bias: 2, inkPx: 6, rough: { tufts: 22, depth: 0.04, seed: 3 } });
    }
    function buildWalls() {
      // the shell, in rows up the outline: out past the floor's edge where the
      // mound bulges, then in to the skylight
      const SKY = 3.2, FS = [0, 0.18, 0.34, 0.48, 0.6, 0.7, 0.79, 0.87, 0.93];
      for (let k = 0; k < SEG; k++) {
        const a = TAU * (k / SEG), b = TAU * ((k + 1) / SEG), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        if (!ctx.ahead(ca * R0, sa * R0, 10)) continue;
        for (let i = 0; i < FS.length - 1; i++) {
          const h0 = FS[i] * TOP, h1 = FS[i + 1] * TOP, r0 = Math.max(SKY, wallAt(h0)), r1 = Math.max(SKY, wallAt(h1));
          const y0 = i === 0 ? floorAt(ca * R0, sa * R0) - 0.3 : h0;
          const col = i < 3 ? P.wall : i < 6 ? P.roof : P.roofSteps[5];
          E.face([[ca * r0, y0, sa * r0], [ca * r1, h1 + 0.3, sa * r1], [cb * r1, h1 + 0.3, sb * r1], [cb * r0, y0, sb * r0]], col, null, 0, { layer: 2, bias: -8, tag: ROOM });
        }
      }
      // lobes of lit gel, three rows up the wall, none across the door, the panes or the shelves
      for (let k = 0; k < SEG * 2; k++) {
        const a = TAU * (k / (SEG * 2));
        if (angleOff(a, DOOR_A) < DOOR_W + 0.1 || nearWindow(a)) continue;
        const x0 = Math.cos(a) * R0, z0 = Math.sin(a) * R0;
        if (!ctx.ahead(x0, z0, 6)) continue;
        const lod = ctx.lod(x0, z0);
        for (let row = 0; row < 4; row++) {
          const kk = hash2(k + 3, row), k2 = hash2(k + 3, row + 5);
          const ry = 1.3 + k2 * 0.9, rx = 0.7 + kk * 0.6, rt = 1.4 + kk * 0.8, h = lerp(floorAt(x0, z0), TOP * 0.6, (row + 0.5) / 4), Rw = wallAt(h);
          const ca = Math.cos(a), sa = Math.sin(a), d = [[2, 5], [3, 6], [4, 8]][lod];
          // a ball squashed against the wall: its thin axis points at the centre
          const pts = M.shapes.ball(0, 0, 0, rt, ry, rx, d[0], d[1], false).map((p) => [
            (Rw - rx * 0.55) * ca + p[0] * -sa + p[2] * ca, h + p[1], (Rw - rx * 0.55) * sa + p[0] * ca + p[2] * sa]);
          // a fixed order among neighbours: upper rows over lower, odd columns over
          // even. Stacked lobes lie at almost the same depth, and sorting them by
          // depth alone swapped them as the camera moved: their edges flickered
          E.organic(pts, vgrad(P.wallHi[Math.floor(k2 * 7.99)], P.wallLo), P.ink, 0.8, { layer: 2, inkPx: 7, bias: row * 0.6 + (k & 1) * 0.3 });
        }
      }
      // the panes: lit gel set into the wall at the height of the windows outside
      for (const w of WINDOWS) {
        const h = HOUSE.winY, Rw = wallAt(h) - 0.3, ca = Math.cos(w), sa = Math.sin(w), x0 = ca * Rw, z0 = sa * Rw;
        if (!ctx.ahead(x0, z0, 4)) continue;
        const pts = [];
        for (let j = 0; j < 14; j++) { const t = TAU * (j / 14); pts.push([x0 + -sa * Math.cos(t) * HOUSE.winRx, h + Math.sin(t) * HOUSE.winRy, z0 + ca * Math.cos(t) * HOUSE.winRx]); }
        // from inside, the pane shows the outside: the day's pale sky, or the night (the warm
        // yellow is the window seen from outside, lit from within, not the view out of it)
        E.organic(pts, NIGHT ? vgrad("#16261e", "#070b08") : vgrad("#bfe3db", "#d8ecd2"), P.ink, 1, { layer: 2, bias: 1, inkPx: 4, lit: !NIGHT, after: NIGHT ? null : halo("#eaf6d8", 1.3) });
      }
      // the door: the day outside, the same arch as the doorway seen from the plaza
      {
        const pts = [], y0 = floorAt(0, -R0);
        for (let j = 0; j <= 10; j++) {
          const t = j / 10, a = DOOR_A - DOOR_W + 2 * DOOR_W * t, hy = HOUSE.doorH + Math.sin(Math.PI * t) * HOUSE.arch, d = wallAt(hy) - 0.2;
          pts.push([Math.cos(a) * d, y0 + hy, Math.sin(a) * d]);
        }
        pts.push([Math.cos(DOOR_A + DOOR_W) * (R0 - 0.2), y0 - 0.2, Math.sin(DOOR_A + DOOR_W) * (R0 - 0.2)]);
        pts.push([Math.cos(DOOR_A - DOOR_W) * (R0 - 0.2), y0 - 0.2, Math.sin(DOOR_A - DOOR_W) * (R0 - 0.2)]);
        if (ctx.ahead(0, -R0, 8)) E.custom(pts, (g, sp) => {
          g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]); g.closePath();
          let top = Infinity, bot = -Infinity; for (const q of sp) { top = Math.min(top, q[1]); bot = Math.max(bot, q[1]); }
          const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, NIGHT ? "#0a120c" : "#bfe3db"); gr.addColorStop(0.7, NIGHT ? "#050806" : "#d8ecd2"); gr.addColorStop(1, NIGHT ? "#10271f" : "#6f9e88");
          g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
        }, { layer: 2, bias: 1 });
      }
      // the crown of the dome
      {
        const pts = [];
        for (let j = 0; j < 18; j++) { const t = TAU * (j / 18); pts.push([Math.cos(t) * 3.2, ceilAt(Math.cos(t) * 3.2, Math.sin(t) * 3.2) + 0.2, Math.sin(t) * 3.2]); }
        // the crown closes over: no skylight, as none shows on the dwelling outside
        E.face(pts, P.roofSteps[6], null, 0, { layer: 2, bias: -4, tag: ROOM });
      }
    }
    /* ── archived (2026-09-22, at the user's request) ──────────────────────
       The shelves of books and the windlass over the hatch are out of the
       room for now. They are kept here, unchanged, so either can come back:
       call archivedShelves() from buildFurniture, or archivedWindlass(y)
       inside its hatch block (y is the floor at the hatch). */
    // eslint-disable-next-line no-unused-vars
    function archivedShelves() {
      const fl = (x, z) => floorAt(x, z);
      // shelves along the wall, with books
      for (const h of SHELF.rows) {
        const plank = [];
        for (let j = 0; j <= 6; j++) { const a = lerp(SHELF.a0, SHELF.a1, j / 6); plank.push([Math.cos(a) * (R0 - 0.3), fl(Math.cos(a) * R0, Math.sin(a) * R0) + h, Math.sin(a) * (R0 - 0.3)]); }
        for (let j = 6; j >= 0; j--) { const a = lerp(SHELF.a0, SHELF.a1, j / 6); plank.push([Math.cos(a) * (R0 - 1.8), fl(Math.cos(a) * R0, Math.sin(a) * R0) + h, Math.sin(a) * (R0 - 1.8)]); }
        if (!ctx.ahead(plank[3][0], plank[3][2], 6)) continue;
        E.face(plank, "#7a5a35", P.ink, 1, { layer: 2, bias: -2 });
        for (let j = 0; j < 12; j++) {
          const a0 = lerp(SHELF.a0, SHELF.a1, (j + 0.1) / 12), a1 = lerp(SHELF.a0, SHELF.a1, (j + 0.85) / 12), kk = hash2(h * 7, j);
          if (kk < 0.12) continue;                               // a gap on the shelf
          const tall = 1.2 + kk * 0.7, d = R0 - 1, y = fl(Math.cos(a0) * R0, Math.sin(a0) * R0) + h;
          E.face([[Math.cos(a0) * d, y, Math.sin(a0) * d], [Math.cos(a1) * d, y, Math.sin(a1) * d], [Math.cos(a1) * d, y + tall, Math.sin(a1) * d], [Math.cos(a0) * d, y + tall, Math.sin(a0) * d]],
            BOOK[Math.floor(kk * 7.99)], P.ink, 0.8, { layer: 2, bias: -1 });
        }
      }
    }
    // eslint-disable-next-line no-unused-vars
    function archivedWindlass(y) {
        const top = y + 5, crank = ctx.reduce ? 0 : E.t * 0.8;
        for (const s of [-1, 1]) E.line([[HATCH.x + s * WX, y, HATCH.z], [HATCH.x + s * WX, top, HATCH.z]], "#6a4a2a", 0.3, { layer: 2, world: true });
        E.line([[HATCH.x - WX, top - 0.5, HATCH.z], [HATCH.x + WX + 0.8, top - 0.5, HATCH.z]], "#8a6a3e", 0.26, { layer: 2, world: true });
        E.line([[HATCH.x + WX + 0.8, top - 0.5, HATCH.z], [HATCH.x + WX + 0.8, top - 0.5 + Math.sin(crank) * 1, HATCH.z + Math.cos(crank) * 1]], "#6a4a2a", 0.18, { layer: 2, world: true });
        E.line([[HATCH.x, top - 0.5, HATCH.z], [HATCH.x, y - 1, HATCH.z]], "#b98a52", 0.1, { layer: 2, bias: 2, world: true });
    }

    function buildFurniture() {
      const fl = (x, z) => floorAt(x, z);
      // the table: a gel mushroom, a book open on it and a lamp
      if (ctx.ahead(TABLE.x, TABLE.z, 6)) {
        const y = fl(TABLE.x, TABLE.z);
        E.organic(M.shapes.ball(TABLE.x, y + 1.3, TABLE.z, 0.9, 1.4, 0.9, 3, 8, false), vgrad("#8fd8b8", "#3c8a68"), P.ink, 1, { layer: 2, inkPx: 4 });
        E.organic(M.shapes.ball(TABLE.x, y + 2.8, TABLE.z, TABLE.r, 0.55, TABLE.r * 0.8, 4, 14, false), vgrad("#b8ecd2", "#4f9a78"), P.ink, 1.1, { layer: 2, bias: 0.5, after: sheen(0.3) });
        // (the open book that lay here is gone, at the user's request)
        E.organic(M.shapes.ball(TABLE.x + 1.6, y + 3.9, TABLE.z + 0.6, 0.55, 0.6, 0.55, 3, 8, false), "#ffe6a0", rgba(P.ink, 0.6), 1, { layer: 2, bias: 3, inkPx: 3, after: halo("#ffd98a", 2) });
      }
      // lamps on stalks
      for (const [x, z] of LAMPS) {
        if (!ctx.ahead(x, z, 4)) continue;
        const y = fl(x, z), top = y + 4.2 + hash2(x, z) * 1.4;
        E.line([[x, y, z], [x + 0.2, (y + top) / 2, z], [x, top, z]], "#4f7d4a", 0.2, { layer: 2, world: true });
        E.organic(M.shapes.ball(x, top + 0.6, z, 0.6, 0.6, 0.6, 3, 8, false), "#ffe6a0", rgba(P.ink, 0.6), 1, { layer: 2, inkPx: 3, lit: true, after: halo("#ffd98a", NIGHT ? 2.4 : 2.2) });
      }
      // the bath's rim of stones, open on the room's side
      if (ctx.ahead(BATH.x, BATH.z, 8)) for (const q of STONES) {
        E.organic(M.shapes.ball(q.x, fl(q.x, q.z) + 0.35, q.z, 0.8 + q.k * 0.3, 0.6 + q.k * 0.25, 0.8 + q.k * 0.3, 3, 7, false), vgrad("#a89878", "#5c4f3c"), P.ink, 0.9, { layer: 2, inkPx: 4 });
      }
      // the hatch down: a ring of stones round a dark shaft, and a windlass over it
      if (ctx.ahead(HATCH.x, HATCH.z, 8)) {
        const y = fl(HATCH.x, HATCH.z);
        E.organic(M.shapes.disc(HATCH.x, HATCH.z, HATCH.r, 16, () => y + 0.4), "#070a08", null, 0, { layer: 1, bias: 10, inkPx: 1e9 });
        for (let j = 0; j < 9; j++) {
          const a = TAU * (j / 9), x = HATCH.x + Math.cos(a) * (HATCH.r + 0.4), z = HATCH.z + Math.sin(a) * (HATCH.r + 0.4), k = hash2(j, 17);
          E.organic(M.shapes.ball(x, y + 0.5, z, 0.85, 0.7 + k * 0.3, 0.85, 3, 7, false), vgrad("#9a948a", "#4a4640"), P.ink, 0.9, { layer: 2, inkPx: 4 });
        }
      }
      // a spore-cap grown in a pot, where a houseplant would stand
      if (ctx.ahead(POT.x, POT.z, 6)) {
        const y = fl(POT.x, POT.z), sway = ctx.reduce ? 0 : Math.sin(E.t * 1.1) * 0.15;
        E.organic(M.shapes.ball(POT.x, y + 1.1, POT.z, 1.6, 1.2, 1.6, 3, 10, false), vgrad("#d08a5a", "#8a4a2a"), P.ink, 1, { layer: 2, inkPx: 4 });
        E.organic(M.shapes.disc(POT.x, POT.z, 1.35, 12, () => y + 2.2), "#3f2a18", null, 0, { layer: 2, bias: 0.3, inkPx: 1e9 });
        E.line([[POT.x, y + 2.2, POT.z], [POT.x + sway, y + 4.2, POT.z]], "#d8d0be", 0.22, { layer: 2, bias: 0.5, world: true });
        E.organic(M.shapes.ball(POT.x + sway, y + 4.3, POT.z, 1.3, 0.8, 1.3, 3, 10, true), vgrad("#c88ae6", "#8a4aa8"), "rgba(50,20,60,0.8)", 1, { layer: 2, bias: 0.6, inkPx: 4, after: halo("#e6b0ff", 1.5) });
      }
    }

    const zoogSpot = (rnd) => { for (let n = 0; n < 200; n++) { const a = rnd() * TAU, r = 2 + rnd() * (R0 - 5), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - BATH.x, z - BATH.z) > BATH.r + 1.5 && Math.hypot(x - HATCH.x, z - HATCH.z) > 4 && Math.hypot(x - TABLE.x, z - TABLE.z) > TABLE.r + 1.5 && Math.hypot(x - POT.x, z - POT.z) > 3) return [x, z]; } return [0, -4]; };
    const lim = (b) => R0 - 1.4 - (b.R || 3.1) * 0.8;
    return {
      name: "Indoors", seen: SEEN, floorAt, ceilAt, pal, solids,
      panes: WINDOWS.map((a) => [Math.cos(a), Math.sin(a)]), doorDir: [Math.cos(DOOR_A), Math.sin(DOOR_A)],   // for probes: the room's pane and door
      pools: [{ x: BATH.x, z: BATH.z, rx: BATH.r, rz: BATH.r, depth: 1.5 }],
      mirrorAlpha: 0.42, mirrorPad: 10,                           // a small room: the bath need only look nearby
      walkable: (x, z) => dist(x, z) < R0 - 1,
      bound(b) { const d = dist(b.x, b.z), l = lim(b); if (d > l) { b.x *= l / d; b.z *= l / d; } },
      open: (x, y, z) => y > floorAt(x, z) + 1.2 && y < TOP - 1.5 && dist(x, z) < wallAt(y) - 1.2,
      entries: { door: { x: 0, z: -R0 + 8.5, yaw: 0 }, start: { x: 0, z: -R0 + 8.5, yaw: 0 } },
      // ways out fire on touch: the door where the slime reaches the wall, the
      // hatch where it meets the rim, never from across the room
      portals: [{ x: 0, z: -R0 + 1.5, r: 3.6, to: "outdoors", entry: "back" }, { x: HATCH.x, z: HATCH.z, r: HATCH.r + 0.7 + V.UNIT * 0.8 + 0.4, to: "cave", entry: "well" }],   // the hatch is reached by touching its rim
      life: {
        zoogs: 2, shoggoths: 0, greet: true, spot: zoogSpot, night: () => false,   // two pets: room to roam without knotting
        motes: { n: 8, glow: "#ffd98a", core: "#fff8e0", spot: (rnd) => { const p = zoogSpot(rnd); return [p[0], p[1], 0.3 + rnd() * 0.5]; } },
      },
      fog: NIGHT ? (p, d, o) => {                              // dark but where a lamp, a pane or the slime lights it
        let L = clamp(1.1 - Math.hypot(p[0] - ctx.me.x, p[2] - ctx.me.z) / 12, 0, 1);
        for (const [x, z] of LAMPS) L = Math.max(L, 1 - Math.hypot(p[0] - x, p[2] - z) / 9);
        L = Math.max(L, 1 - Math.hypot(p[0] - TABLE.x, p[2] - TABLE.z) / 8);
        return { t: o && o.lit ? 0 : Math.max(smooth((d - 30) / (SEEN - 30)) * 0.6, 0.8 * (1 - L)), colour: P.air };
      } : (p, d) => ({ t: smooth((d - 30) / (SEEN - 30)) * 0.45, colour: P.air }),
      night: NIGHT, signStyle: NIGHT ? "neon" : "leaf", slime: NIGHT ? V.SKINS && V.SKINS.technoscure.slime : null, audio: { root: NIGHT ? 196.0 : 261.63 },
      camera: { dist: 18, height: (dist) => Math.min(dist * 0.36, 7) },
      sky(g) { const gr = g.createLinearGradient(0, 0, 0, E.H); gr.addColorStop(0, NIGHT ? "#1a140c" : "#8a6a40"); gr.addColorStop(1, P.air); g.fillStyle = gr; g.fillRect(0, 0, E.W, E.H); },
      build() { buildFloor(); buildWalls(); buildFurniture(); },
    };
  } }; }
  V.defineScene("indoors", interior(false));
  V.defineScene("indoors@technoscure", interior(true));

  /* ── bureaucore's inside: the block's own box ────────────────────────────
     A block in bureaucore (see BLOCK below) is a tall narrow box, so its
     inside is a tall narrow office: paper walls with fat black edges, a desk
     and a filing cabinet in the house violet, the door back out. Nothing
     else, as the skin has nothing else. */
  V.defineScene("indoors@technocute", { name: "Indoors", setup(ctx) {
    /* ── bureaucore's inside: the block's own box ────────────────────────
       A block (BLOCK, below) is a tall narrow box, so its inside is a tall
       narrow room: paper walls with fat black edges, and one way out, a door
       framed in black with an EXIT plate over it, as plain as the skin. */
    const { E } = ctx;
    const H = BLOCK.half - 0.4, TOP = BLOCK.h - 0.4, BLK = "#111111", PAPER = "#f4f0e6", PAPER2 = "#ece5d4";
    const floorAt = () => 0, ceilAt = () => TOP, pal = () => ({ air: PAPER, ink: BLK, board: "#fff", boardInk: BLK, text: BLK, glint: "#fff", shallow: "#c3f0ff", deep: "#8ab" });
    const DW = 2.2, DH = 8;                                    // the doorway, half its width and its height
    function build() {
      E.face([[-H - 0.4, 0, -H - 0.4], [H + 0.4, 0, -H - 0.4], [H + 0.4, 0, H + 0.4], [-H - 0.4, 0, H + 0.4]], PAPER2, null, 0, { layer: -1 });
      const cs = [[-H, -H], [H, -H], [H, H], [-H, H]];
      for (let k = 0; k < 4; k++) {                            // the walls, and the ceiling
        const p = cs[k], q = cs[(k + 1) % 4];
        E.face([[p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], TOP, q[1]], [p[0], TOP, p[1]]], k & 1 ? PAPER : M3.shade(PAPER, -0.05), BLK, 0.14, { layer: 2, bias: -6, world: true, maxPx: 3, tag: ROOMB });
      }
      E.face(cs.map((c) => [c[0], TOP, c[1]]), M3.shade(PAPER, -0.08), BLK, 0.14, { layer: 2, bias: -6, world: true, maxPx: 3, tag: ROOMB });
      const z = -H + 0.05;                                     // the way out: a dark doorway in a black frame, and its plate
      E.face([[-DW - 0.35, 0, z], [DW + 0.35, 0, z], [DW + 0.35, DH + 0.35, z], [-DW - 0.35, DH + 0.35, z]], BLK, null, 0, { layer: 2, bias: -5.5 });
      E.face([[-DW, 0, z + 0.02], [DW, 0, z + 0.02], [DW, DH, z + 0.02], [-DW, DH, z + 0.02]], "#2a2a2a", null, 0, { layer: 2, bias: -5 });
    }
    const ROOMB = { kind: "room" };
    const lim = (b) => H - 0.3 - (b.R || 3.1) * 0.8;
    return {
      name: "Indoors", seen: 60, floorAt, ceilAt, pal, pools: [], signStyle: "plate", slime: V.SKINS.technocute.slime, audio: { root: 277.18 },
      solids: [],
      signs: [{ x: 0, z: -H + 0.4, y: DH + 1.6, text: "Exit", post: false }],
      walkable: (x, z) => Math.abs(x) < H && Math.abs(z) < H,
      bound(b) { const l = lim(b); b.x = clamp(b.x, -l, l); b.z = clamp(b.z, -l, l); },
      open: (x, y, z) => Math.abs(x) < H - 0.8 && Math.abs(z) < H - 0.8 && y > 1 && y < TOP - 1,
      // you come in facing the room, the door behind you; turn round and walk to it
      entries: { door: { x: 0, z: 0.8, yaw: 0 }, start: { x: 0, z: 0.8, yaw: 0 } },
      // the way out fires as the slime reaches the door's wall: the room is too small for one that reaches further
      portals: [{ x: 0, z: -H + 1.2, r: 2.6, to: "outdoors", entry: "back" }],
      life: {},
      fog: () => ({ t: 0, colour: PAPER }),
      camera: { dist: 14, height: (dist) => Math.min(dist * 0.42, 8) },
      sky(g) { g.fillStyle = PAPER; g.fillRect(0, 0, E.W, E.H); },
      build,
    };
  } });

  /* ══════════════════════════ THE SKINS OF THE ISO WORLD ══════════════════════
     Each skin of the iso world has its 3D version, built by isoWorld below from
     that skin's own settings (theme-*.js): its torus, whether its land has
     biomes, its colours, its buildings, its plants and its creatures. Nothing is
     added that the skin does not have, and nothing it has is left out.

       technurture   the slime world by day: biomes, lakes, gel dwellings,
                     flora, zoogs and shoggoths (outdoors)
       technoscure   the same world after dark (gloomthmaxx): the same land in
                     its night tints, sunk in darkness except where there is
                     light (the slime's beam, the warm windows, the monument,
                     the neon marquees, the fireflies); more shoggoths, fewer
                     zoogs, as its ecology sets them (outdoors@technoscure)
       technocute    bureaucore: a flat paper board of solid black-edged blocks
                     with number plates, a cyan cone at the plaza, and nothing
                     else: no biomes, no plants, no creatures
                     (outdoors@technocute)
     An iso pixel is ISO_PX world units: the slime's 13 px radius is UNIT, and
     the tile's 67.9 px run along the ground is 16 units, the same ratio. */
  const ISO_PX = V.UNIT / 13;
  const SKINS = {
    technurture: {
      id: "technurture", period: 58, audio: { root: 261.63 }, biomes: true, flora: true, relief: 1, grain: 0.06, night: false,
      ground: { grass: "#3f7d5e", forest: "#214a3e", sand: "#b8ad73", dry: "#94727a", stone: "#5a5170", snow: "#cfd2de", water: "#2f8a98" },
      walls: { grass: "#c2a065", forest: "#9c7a48", sand: "#e2c990", dry: "#cdb285", stone: "#9a948a", snow: "#c9b893", water: "#b89a6a" },
      plaza: "#e7cf94", road: "#d95f93", air: "#c4dccb", sky: ["#bfe3db", "#d8ecd2"], water: "#2f8a98", shallow: "#6fd0d6",
      house: "dwelling", monument: "stalk", sign: "leaf",
      accents: ["#f0b62a", "#f28b46", "#d24f86", "#8a52d0", "#36b9d6", "#e0613a"],
      slime: { light: "#B0D6C0", mid: "#4FA373", dark: "#3A7955", ink: "#1f3a1a" },
      life: { zoogs: 28, shoggoths: 5, fireflies: 0, dormant: true },   // by day they are rooted (technurture predatorDormant), and mutter
      plants: { lily: "rgba(63,163,122,0.9)", bud: "#ffd84a", mould: "#3aa882", fruit: "#f2d86a", gel: "rgba(95,208,192,0.62)", core: "rgba(220,255,240,0.9)",
        stalk: "#d8d0be", cap: ["#c88ae6", "#8a4aa8"], capGlow: "#e6b0ff", tendril: "#4fb07a", drip: "#9fe6c0", reed: ["#6f9a4a", "#557f3a"], head: "#7a5230" },
    },
    technoscure: {
      id: "technoscure", period: 58, audio: { root: 196.0 }, biomes: true, flora: true, relief: 1, grain: 0.05, night: true,
      ground: { grass: "#1a3a2c", forest: "#10271f", sand: "#3a351f", dry: "#2c2024", stone: "#221f2e", snow: "#353a47", water: "#103a42" },
      walls: { grass: "#2e3a26", forest: "#283324", sand: "#56492f", dry: "#473d2c", stone: "#37372f", snow: "#39414a", water: "#283640" },
      plaza: "#2a2c24", road: "#34281c", air: "#050806", sky: ["#0a120c", "#050806"], water: "#103a42", shallow: "#1f5a58",
      house: "dwelling", monument: "stalk", sign: "neon",
      accents: ["#e0b340", "#d6553e", "#36a89a", "#8fb43e", "#9a63c8", "#d68a3e"],
      slime: { light: "#cfeee0", mid: "#8fbcb2", dark: "#5f8a80", ink: "#0a0e0a" },
      life: { zoogs: 20, shoggoths: 9, fireflies: 42 },   // after dark they roam, as the iso night skin has them
      plants: { lily: "rgba(28,71,56,0.88)", bud: "#5fe0c8", mould: "#1f5a44", fruit: "#7fffc0", gel: "rgba(31,74,68,0.6)", core: "rgba(95,224,200,0.9)",
        stalk: "#6a6258", cap: ["#5a3a7a", "#3a2450"], capGlow: "#c890ff", tendril: "#1f5a3a", drip: "#5fe0a0", reed: ["#2f4a2a", "#243a20"], head: "#3a2818" },
    },
    technocute: {
      id: "technocute", period: 52, audio: { root: 277.18 }, biomes: false, flora: false, relief: 0, grain: 0, night: false,
      ground: null, walls: null, paper: "#f4f0e6",
      plaza: "#dcf3ff", road: "#8a5cc0", air: "#f4f0e6", sky: ["#f4f0e6", "#f4f0e6"],
      house: "block", monument: "cone", sign: "plate",
      accents: ["#5b2a86", "#f28b46", "#cb4d79", "#4dcb53", "#2a8186", "#ba962c"],
      slime: { light: "#8a5cc0", mid: "#5b2a86", dark: "#3f1c5e", ink: "#111111" },
      life: { zoogs: 0, shoggoths: 0, fireflies: 0 },
    },
  };
  /** Bureaucore's block, from its iso painter (theme-technocute.js box): a square
   *  22 px of the tile's 48 across its half, 46 px tall; enterable, so ENTER
   *  times that. Its half-side and height in world units. */
  const BLOCK = { half: (22 / 48) * V.ISO.tile / 2 * V.ENTER, h: 46 * ISO_PX * V.ENTER };
  /** The iso wellhead (engine.js drawWellhead), in world units. */
  const WELLHEAD = { mouth: 30 * ISO_PX, collar: 33 * ISO_PX, lobe: 8 * ISO_PX, post: 24 * ISO_PX, postH: 56 * ISO_PX, capR: 30 * ISO_PX, capTop: 69 * ISO_PX, capBase: 54 * ISO_PX, windlass: 47 * ISO_PX };

  function isoWorld(SK) { return { name: "Outdoors", setup(ctx) {
    const { E, me } = ctx, M = M3;
    const ISO = V.ISO, TILE = ISO.tile, NT = SK.period, PER = NT * TILE, HX = Math.round(NT / 2), SEEN = 240, LEVEL = 0;
    const NIGHT = SK.night, FLAT = !SK.biomes;
    const wrapT = (v) => ((v % NT) + NT) % NT;
    const wD = (d) => d - PER * Math.round(d / PER);
    /* the iso world's own noise (engine.js hash01, noise01, biomeAt), on this skin's torus */
    function hash01(a, b) {
      let h = (wrapT(a) * 374761393 + wrapT(b) * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
      h = h ^ (h >>> 16);
      return ((h >>> 0) % 100000) / 100000;
    }
    function noise01(tx, ty, freq) {
      const fx = tx / freq, fy = ty / freq, x0 = Math.floor(fx), y0 = Math.floor(fy), rx = fx - x0, ry = fy - y0;
      const ux = rx * rx * (3 - 2 * rx), uy = ry * ry * (3 - 2 * ry);
      const n00 = hash01(x0, y0), n10 = hash01(x0 + 1, y0), n01 = hash01(x0, y0 + 1), n11 = hash01(x0 + 1, y0 + 1);
      return (n00 * (1 - ux) + n10 * ux) * (1 - uy) + (n01 * (1 - ux) + n11 * ux) * uy;
    }
    function biomeAt(tx, ty) {
      if (FLAT) return null;                                   // bureaucore: a board, not land
      const e = noise01(tx + 7, ty + 7, 12), m = noise01(tx + 313, ty - 211, 9);
      if (e < 0.30) return "water";
      if (e < 0.37) return "sand";
      if (e > 0.76) return m > 0.5 ? "snow" : "stone";
      if (m > 0.66) return "forest";
      if (m < 0.30) return "dry";
      return "grass";
    }
    const tileX = (x) => x / TILE + HX, tileZ = (z) => z / TILE + HX;
    const toWorld = (t) => (t - HX) * TILE;
    const P = { air: SK.air, sky: SK.sky[1], ink: NIGHT ? "rgba(0,0,0,0.6)" : FLAT ? "#111111" : "rgba(20,40,28,0.8)",
      water: NIGHT ? "rgba(16,58,66,0.5)" : "rgba(47,138,152,0.4)", shallow: SK.shallow || "#6fd0d6", deep: SK.water || "#1c5a66",
      glint: NIGHT ? "rgba(160,225,215,0.6)" : "rgba(255,255,250,0.95)", board: "#f3ecd8", boardInk: "#b98a2a", text: "#2a8186", plaza: SK.plaza, road: SK.road };
    const pal = () => P;
    const rgbOf = (c) => M.rgbOf(c);

    /* ── the village: content.js laid out as the iso engine lays it ─────── */
    const C = window.MH_CONTENT || { kiosks: ["About", "Toolbox", "Research", "Public Writing", "Store", "Music", "Games"].map((title) => ({ title })), junctions: [] };
    const kiosks = C.kiosks, n = kiosks.length;
    const HOUSES = [], SPURS = [], gates = [];
    let wellAt = null;
    kiosks.forEach((k, i) => {
      const ang = -Math.PI / 2 + (i * TAU) / n, accent = SK.accents[i % SK.accents.length];
      const g = { title: k.title, ang, x: Math.cos(ang) * ISO.ring * TILE, z: Math.sin(ang) * ISO.ring * TILE, sats: (k.satellites || []).length, accent };
      gates.push(g);
      HOUSES.push({ title: k.title, x: g.x, z: g.z, gate: true, slot: i, accent, item: { kind: "kiosk", title: k.title, kiosk: k } });
      (k.satellites || []).forEach((sat, j) => {
        const r = (ISO.ring + ISO.spur * (j + 1)) * TILE, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (sat.structure === "wellhead") wellAt = { x, z, title: sat.title, accent, item: { kind: "link", title: sat.title, url: sat.url } };
        else HOUSES.push({ title: sat.title, x, z, satellite: true, slot: 90 + i * 13 + j * 7, accent, item: { kind: "link", title: sat.title, url: sat.url } });
      });
      if (k.satellites && k.satellites.length) {
        const rEnd = (ISO.ring + ISO.spur * k.satellites.length) * TILE;
        SPURS.push([[Math.cos(ang) * (ISO.hub - 0.3) * TILE, Math.sin(ang) * (ISO.hub - 0.3) * TILE], [Math.cos(ang) * rEnd, Math.sin(ang) * rEnd]]);
      }
    });
    for (const j of C.junctions || []) {                     // a house two roads share: at the mean of their ends
      const gs = (j.between || []).map((t) => gates.find((g) => g.title === t)).filter(Boolean);
      if (gs.length < 2) continue;
      let jx = 0, jz = 0;
      const ends = gs.map((g) => { const r = (ISO.ring + ISO.spur * g.sats) * TILE; return [Math.cos(g.ang) * r, Math.sin(g.ang) * r]; });
      for (const e of ends) { jx += e[0]; jz += e[1]; }
      jx /= ends.length; jz /= ends.length;
      HOUSES.push({ title: j.title, x: jx, z: jz, junction: true, slot: 900, accent: mix(gs[0].accent, gs[1].accent, 0.5), item: { kind: "link", title: j.title, url: j.url } });
      for (const e of ends) SPURS.push([e, [jx, jz]]);
    }
    if (!wellAt) wellAt = { x: -3 * TILE, z: 6 * TILE, title: "Glossary", accent: SK.accents[0] };

    /* ── the land ─────────────────────────────────────────────────────── */
    const segDist = (x, z, a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1);
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    };
    function roadness(x, z) {
      const hw = TILE * 0.42;
      let d = Math.min(Math.abs(wD(x)), Math.abs(wD(z)));
      const lx = wD(x), lz = wD(z);
      for (const s of SPURS) d = Math.min(d, segDist(lx, lz, s[0], s[1]));
      return clamp(1 - (d - hw) / 3, 0, 1);
    }
    function rawHeight(x, z) {
      if (FLAT) return 0.6;                                    // a board is flat
      const tx = tileX(x), tz = tileZ(z), e = noise01(tx + 7, tz + 7, 12);
      const land = clamp((e - 0.30) / 0.06, 0, 1);
      let h = (e - 0.30) * 10;
      h += SK.relief * land * ((noise01(tx * 1.7 + 101, tz * 1.7 - 55, 2.2) - 0.5) * 2.2 + (noise01(tx * 3.1 - 31, tz * 3.1 + 17, 2.4) - 0.5) * 0.9);
      const d = Math.hypot(wD(x), wD(z));
      h = lerp(h, 0.8, 1 - clamp((d - ISO.hub * TILE) / 20, 0, 1));
      const r = roadness(x, z);
      if (r > 0) h = lerp(h, Math.max(h, 0.45), r);
      return h;
    }
    const HG = 4, HN = PER / HG, HGT = new Float32Array(HN * HN);
    for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) HGT[j * HN + i] = rawHeight(i * HG - PER / 2, j * HG - PER / 2);
    if (!FLAT) for (const q of HOUSES.concat([wellAt])) {       // each building on a level pad
      const base = Math.max(0.6, rawHeight(q.x, q.z)), R = 26;
      for (let j = -R / HG; j <= R / HG; j++) for (let i = -R / HG; i <= R / HG; i++) {
        const gx = Math.round((q.x + PER / 2) / HG) + i, gz = Math.round((q.z + PER / 2) / HG) + j, d = Math.hypot(i, j) * HG;
        const k = ((gz % HN) + HN) % HN * HN + ((gx % HN) + HN) % HN;
        HGT[k] = lerp(base, HGT[k], clamp((d - 16) / 10, 0, 1));
      }
    }
    function heightAt(x, z) {
      let u = (x + PER / 2) / HG, v = (z + PER / 2) / HG;
      u -= HN * Math.floor(u / HN); v -= HN * Math.floor(v / HN);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i2 = (i + 1) % HN, j2 = (j + 1) % HN;
      const a = HGT[j * HN + i] + (HGT[j * HN + i2] - HGT[j * HN + i]) * fu, b = HGT[j2 * HN + i] + (HGT[j2 * HN + i2] - HGT[j2 * HN + i]) * fu;
      return a + (b - a) * fv;
    }
    const floorAt = heightAt;

    /* ── the ground's colour, baked with its light ─────────────────────── */
    const BIOME = [];
    for (let ty = 0; ty < NT; ty++) for (let tx = 0; tx < NT; tx++) BIOME.push(biomeAt(tx, ty));
    const GC = {}; if (SK.ground) for (const k in SK.ground) GC[k] = rgbOf(SK.ground[k]);
    const paperC = SK.paper ? rgbOf(SK.paper) : null;
    const TX = 2, TN = PER / TX, SUN = [-0.45, 0.8, -0.4], SM = Math.hypot(SUN[0], SUN[1], SUN[2]);
    const MIPS = [new Uint8ClampedArray(TN * TN * 3)];
    (function bake() {
      const T0 = MIPS[0], plazaC = rgbOf(P.plaza), roadC = rgbOf(P.road);
      for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
        const x = i * TX - PER / 2 + TX / 2, z = j * TX - PER / 2 + TX / 2;
        let r, g, b;
        if (FLAT) { r = paperC[0]; g = paperC[1]; b = paperC[2]; }
        else {                                                 // the biome colour, blended between the four nearest tile centres
          const fx = tileX(x) - 0.5, fz = tileZ(z) - 0.5, ix = Math.floor(fx), iz = Math.floor(fz);
          let ux = fx - ix, uz = fz - iz; ux = ux * ux * (3 - 2 * ux); uz = uz * uz * (3 - 2 * uz);
          r = 0; g = 0; b = 0;
          for (const [ox, oz, w] of [[0, 0, (1 - ux) * (1 - uz)], [1, 0, ux * (1 - uz)], [0, 1, (1 - ux) * uz], [1, 1, ux * uz]]) {
            const c = GC[BIOME[wrapT(iz + oz) * NT + wrapT(ix + ox)]];
            r += c[0] * w; g += c[1] * w; b += c[2] * w;
          }
        }
        const d = Math.hypot(wD(x), wD(z));
        const pz = clamp((ISO.hub * TILE - d) / 3 + 0.5, 0, 1);
        if (pz > 0) { r = lerp(r, plazaC[0], pz); g = lerp(g, plazaC[1], pz); b = lerp(b, plazaC[2], pz); }
        const rd = roadness(x, z) * (1 - pz);
        if (rd > 0) { r = lerp(r, roadC[0], rd); g = lerp(g, roadC[1], rd); b = lerp(b, roadC[2], rd); }
        let k = 1;
        if (!FLAT) {
          const e = 3, sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
          const lit = (-sx * SUN[0] + SUN[1] - sz * SUN[2]) / (SM * Math.hypot(sx, 1, sz));
          k = clamp(0.62 + 0.46 * lit + (ctx.hash2(i * 0.37, j * 0.61) - 0.5) * SK.grain, 0.55, 1.18);
        }
        const o = (j * TN + i) * 3;
        T0[o] = r * k; T0[o + 1] = g * k; T0[o + 2] = b * k;
      }
      for (let l = 1; l < 4; l++) {
        const src = MIPS[l - 1], sn = TN >> (l - 1), dn = sn >> 1, dst = new Uint8ClampedArray(dn * dn * 3);
        for (let j = 0; j < dn; j++) for (let i = 0; i < dn; i++) for (let c = 0; c < 3; c++) {
          const a = ((2 * j) * sn + 2 * i) * 3 + c;
          dst[(j * dn + i) * 3 + c] = (src[a] + src[a + 3] + src[a + sn * 3] + src[a + sn * 3 + 3]) / 4;
        }
        MIPS.push(dst);
      }
    })();
    const sampleRGB = (lvl, x, z, out) => {
      const N = TN >> lvl, T = MIPS[lvl], s = TX << lvl;
      let u = (x + PER / 2) / s - 0.5, v = (z + PER / 2) / s - 0.5;
      u -= N * Math.floor(u / N); v -= N * Math.floor(v / N);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i2 = (i + 1) % N, j2 = (j + 1) % N;
      const a = (j * N + i) * 3, b = (j * N + i2) * 3, c = (j2 * N + i) * 3, d = (j2 * N + i2) * 3;
      for (let k = 0; k < 3; k++) out[k] = (T[a + k] * (1 - fu) + T[b + k] * fu) * (1 - fv) + (T[c + k] * (1 - fu) + T[d + k] * fu) * fv;
    };

    /* ── the dark (technoscure): where there is light ─────────────────────
       The iso night multiplies the world by a dark map, lit inside the
       slime's beam, at each sign and at each firefly. Here the same: light
       is the slime's own glow and the beam ahead of it, the warm window of
       each house near the camera, and the monument; everywhere else sinks to
       a seventh of its colour. Signs and fireflies are their own light.   */
    const lamps = [];                                        // this frame's houses and monument near the camera
    function gatherLamps() {
      lamps.length = 0;
      // only what can light what is drawn: within the haze's reach of the camera
      const fx = Math.sin(E.cam.yaw), fz = Math.cos(E.cam.yaw);
      for (const q of HOUSES) {
        const dx = wD(q.x - E.cam.x), dz = wD(q.z - E.cam.z);
        if (dx * fx + dz * fz < -(q.r + 30)) continue;         // behind the camera it lights nothing on screen
        if (dx * dx + dz * dz < (FOG1 + 30) * (FOG1 + 30)) lamps.push({ x: E.cam.x + dx, z: E.cam.z + dz, r: q.r || BLOCK.half, k: 0.7 });
      }
      { const dx = wD(-E.cam.x), dz = wD(-E.cam.z); lamps.push({ x: E.cam.x + dx, z: E.cam.z + dz, r: 4, k: 0.8 }); }
      if (ctx.towers) for (const tw of ctx.towers()) {           // a lit tower's lamp reaches the ground round it
        const st = ctx.towerState(tw.uid) || {};
        if (st.state !== "playing" && st.state !== "ready" && st.state !== "error") continue;
        const dx = wD(toWorld(tw.tx) - E.cam.x), dz = wD(toWorld(tw.ty) - E.cam.z);
        if (dx * dx + dz * dz < (FOG1 + 30) * (FOG1 + 30)) lamps.push({ x: E.cam.x + dx, z: E.cam.z + dz, r: 3, k: 0.6 });
      }
    }
    let LB = 0, LW = 0;                                      // the last lightAt's parts: the slime's pale light, the windows' warm one
    function lightAt(x, z) {
      const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
      let L = clamp(1.15 - d / 16, 0, 1);                     // the slime's own glow
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw), f = dx * sy + dz * cy;
      if (f > 0 && f < 90) {                                   // its beam: a cone ahead, fading with distance
        const side = Math.abs(dx * cy - dz * sy), w = 3 + f * 0.42;
        if (side < w) L = Math.max(L, (1 - f / 90) * Math.sqrt(1 - side / w) * 1.1);
      }
      LB = L > 1 ? 1 : L;
      let W = 0;
      for (const q of lamps) {
        const ex = x - q.x, ez = z - q.z, reach = q.r + 18;
        if (ex > reach || ex < -reach || ez > reach || ez < -reach) continue;   // cheap test first: most samples are far from any house
        const e = Math.sqrt(ex * ex + ez * ez) - q.r;
        if (e < 18) W = Math.max(W, q.k * (1 - Math.max(0, e) / 18));
      }
      LW = W;
      L = Math.max(L, W);
      return L > 1 ? 1 : L;
    }
    const beamC = rgbOf("#cfeee0"), warmC = rgbOf("#ffb24a");   // the iso slime's avatarGlow, and the windows' warm light
    const DARK = 0.86;                                       // how far toward the dark an unlit thing goes (the iso map's #242424)

    /* ── water: the iso lakes' photo, under the lakes ─────────────────── */
    let PH = null;
    const photoPixels = () => {
      if (PH) return PH;
      const img = V.PHOTO.img;
      if (!V.PHOTO.ready || !img) return null;
      try {
        const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
        const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d")); g.drawImage(img, 0, 0);
        PH = { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
      } catch (e) { PH = { w: 0 }; }
      return PH;
    };
    const PHOTO_W = 30, airC = rgbOf(P.air), skyC = rgbOf(P.sky), deepC = rgbOf(SK.water || "#2f8a98"), shallowC = rgbOf(P.shallow);
    const col = [0, 0, 0], bed = [0, 0, 0];
    // Two ways to show the distance, kept both. "focus" (the default): the haze
    // only closes off the far edge, and things come into view out of focus.
    // "mist" (the earlier way, kept for places or moods that want it): a haze
    // that starts nearer, with everything sharp.
    const MIST = ctx.distance === "mist";
    const FOG0 = MIST ? (FLAT ? 150 : NIGHT ? 90 : 120) : (FLAT ? 185 : NIGHT ? 90 : 175), FOG1 = SEEN * 0.94;
    function groundShade(x, z, hh, t, dy) {
      // the ground a sample covers: across, t * 4 / fov; along the ray, that over the ray's slope, which
      // near the horizon is many times more. Detail is read for the larger, or far roads and shores alias and swim.
      const fp = (t * 4) / E.fov / Math.max(0.03, -dy);
      // past the focus the ground is read from a smaller copy: soft, as the things standing on it are
      const lvl = Math.min(3, (fp < 3 ? 0 : fp < 6 ? 1 : fp < 12 ? 2 : 3) + (!MIST && t > 130 ? 1 : 0));
      const ground = hh > LEVEL + 0.001 || FLAT ? hh : heightAt(x, z);
      sampleRGB(lvl, x, z, col);
      if (!FLAT && ground < LEVEL) {
        const depth = LEVEL - ground, ph = photoPixels();
        for (let k = 0; k < 3; k++) bed[k] = col[k];
        let pr = deepC[0], pg = deepC[1], pb = deepC[2];
        if (ph && ph.w) {
          const tt = ctx.reduce ? 0 : E.t;
          let u = (x / PHOTO_W) * ph.w + Math.sin(z * 0.21 + tt * 1.3) * 2.2, v = (z / PHOTO_W) * ph.w + Math.sin(x * 0.17 + tt) * 1.6;
          u -= ph.w * Math.floor(u / ph.w); v -= ph.h * Math.floor(v / ph.h);
          const o = ((v | 0) * ph.w + (u | 0)) * 4, pk = NIGHT ? 0.35 : 0.62;
          pr = ph.d[o] * pk + deepC[0] * (1 - pk); pg = ph.d[o + 1] * pk + deepC[1] * (1 - pk); pb = ph.d[o + 2] * pk + deepC[2] * (1 - pk);
        }
        const w = clamp(depth / 1.6, 0, 1), s = 1 - w;
        col[0] = (bed[0] * 0.45 + shallowC[0] * 0.55) * s + pr * w;
        col[1] = (bed[1] * 0.45 + shallowC[1] * 0.55) * s + pg * w;
        col[2] = (bed[2] * 0.45 + shallowC[2] * 0.55) * s + pb * w;
        const fr = Math.pow(1 - Math.min(1, -dy * 2.4), 3) * 0.7;
        for (let k = 0; k < 3; k++) col[k] += (skyC[k] - col[k]) * fr;
        const edge = clamp(depth / (0.15 + fp * 0.05), 0, 1);   // far off, a sample covers much ground: a soft shore, not one flipping between water and land
        if (edge < 1) { sampleRGB(lvl, x, z, bed); for (let k = 0; k < 3; k++) col[k] = bed[k] + (col[k] - bed[k]) * edge; }
      }
      let f = (t - FOG0) / (FOG1 - FOG0); f = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
      if (NIGHT && f < 1) {                                    // the haze already took it: no light to look for
        f = Math.max(f, DARK * (1 - lightAt(x, z)));
        // and the light itself shows on the ground, as the iso beam is drawn over the dark
        const b = LB * 0.34 * (1 - f * 0.5), w = LW * 0.26;
        col[0] += beamC[0] * b + warmC[0] * w; col[1] += beamC[1] * b + warmC[1] * w; col[2] += beamC[2] * b + warmC[2] * w;
      }
      const r = col[0] + (airC[0] - col[0]) * f, g = col[1] + (airC[1] - col[1]) * f, b = col[2] + (airC[2] - col[2]) * f;
      return (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
    }

    /* ── the houses ─────────────────────────────────────────────────────── */
    for (const q of HOUSES) {
      const tb = biomeAt(Math.round(tileX(q.x)), Math.round(tileZ(q.z)));
      q.kind = "dwelling";
      q.door = Math.atan2(-q.x, -q.z);                         // toward the plaza
      if (SK.house === "dwelling") Object.assign(q, { r: HOUSE.r, h: HOUSE.h, colour: SK.walls[tb] || SK.walls.grass, win: q.door + HOUSE.winA });
      else {                                                   // a block: its door on the side that faces the plaza most
        const sides = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        let best = 0; for (const a of sides) if (Math.cos(a - q.door) > Math.cos(best - q.door)) best = a;
        Object.assign(q, { r: BLOCK.half, h: BLOCK.h, door: best, block: true });
      }
    }
    if (HOUSES[0]) HOUSES[0].home = true;
    const solids = HOUSES.map((q) => q.block ? { x: q.x, z: q.z, r: q.r * 1.15, h: q.h } : { x: q.x, z: q.z, r: q.r * 1.06, h: q.h, dome: true, radAt: (up) => houseRad(q, up) });
    solids.push({ x: wellAt.x, z: wellAt.z, r: WELLHEAD.collar + WELLHEAD.lobe, h: WELLHEAD.capTop });
    solids.push(SK.monument === "cone" ? { x: 0, z: 0, r: 22 / 67.9 * TILE, h: 84 * ISO_PX } : { x: 0, z: 0, r: 2.4, h: 20 });
    const doorAt = (q, back) => [q.x + Math.sin(q.door) * (q.r + (back || 0)), q.z + Math.cos(q.door) * (q.r + (back || 0))];
    const WELL_TAG = { kind: "well" };
    const taken = (x, z, pad) => Math.hypot(wD(x), wD(z)) < ISO.hub * TILE + pad || roadness(x, z) > 0 && pad >= 0 ||
      solids.some((s) => Math.hypot(wD(x - s.x), wD(z - s.z)) < s.r + pad);

    /* ── the plants, on the tiles where the iso world grows them ─────────── */
    const PL = SK.plants;
    const plantFoot = (f) => f.kind === "mould" ? [1.1 * f.s, 1.3 * f.s] : f.kind === "gelpod" ? [1.4 * f.s, 1.6 * f.s]
      : f.kind === "sporecap" ? [f.s < 1.5 ? 1.3 * f.s : 0.45 * f.s + 0.2, 3.4 * f.s]
      : f.kind === "reed" ? [0.5 * f.s, 3.6 * f.s] : f.kind === "lily" ? [0, 0] : [0.9 * f.s, 3 * f.s];
    const FLORA = [];
    const KINDS = ["mould", "gelpod", "sporecap", "tendril"];
    if (SK.flora) for (let ty = 0; ty < NT; ty++) for (let tx = 0; tx < NT; tx++) {
      const b = BIOME[ty * NT + tx], cx = toWorld(tx), cz = toWorld(ty), hsh = hash01(tx, ty);
      if (hsh <= 0.22) {                                       // the iso world's own plant on this tile (propAt)
        const x = cx + (hash01(tx * 3 + 1, ty) - 0.5) * TILE * 0.6, z = cz + (hash01(tx, ty * 3 + 1) - 0.5) * TILE * 0.6;
        if (b === "water") { if (heightAt(x, z) < LEVEL - 0.3) FLORA.push({ kind: "lily", x, z, s: 1, r: 0.9 + hash01(ty, tx) * 2.8, bud: hash01(tx + 5, ty) < 0.5 }); }
        else {
          const r = hash01(ty, tx), g = hash01(tx * 7 + 3, ty * 5 + 1);
          // every size, from knee-high to towering: now and then a giant, up to nine times the ordinary
          const s = g < 0.05 ? 4 + hash01(tx + 9, ty) * 5 : g < 0.12 ? 2.4 + hash01(tx + 9, ty) * 1.6 : g < 0.32 ? 1.4 + hash01(tx, ty + 9) * 0.9 : 0.8 + hash01(tx + 3, ty + 3) * 0.6;
          const kind = SK.id === "technoscure" ? (r < 0.34 ? "mould" : r < 0.6 ? "gelpod" : r < 0.84 ? "sporecap" : "tendril")   // the night skin's own split
            : (r < 0.34 ? "mould" : r < 0.62 ? "gelpod" : r < 0.84 ? "sporecap" : "tendril");
          const f = { kind, x, z, s, ph: hsh * 40 };
          if (!taken(x, z, 2 + plantFoot(f)[0])) FLORA.push(f);
        }
      }
      const many = b === "forest" ? 4 : b === "grass" ? 3 : b === "dry" ? 2 : b === "stone" || b === "sand" ? 1 : 0;
      for (let k = 0; k < many; k++) {
        const x = cx + (hash01(tx * 5 + k, ty * 3 + 7) - 0.5) * TILE, z = cz + (hash01(tx * 3 + 11, ty * 5 + k) - 0.5) * TILE;
        if (taken(x, z, 1) || heightAt(x, z) < LEVEL + 0.2) continue;
        const r = hash01(tx + k * 13, ty + 29);
        FLORA.push({ kind: KINDS[Math.floor(r * 3.99)], x, z, s: 0.3 + hash01(tx + 31, ty + k * 7) * 0.45, ph: r * 40, small: true });
      }
      if (b !== "water" && b !== "snow") {
        const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([ox, oz]) => BIOME[wrapT(ty + oz) * NT + wrapT(tx + ox)] === "water");
        if (wet) for (let k = 0; k < 3; k++) {
          const x = cx + wet[0] * TILE * 0.45 + (hash01(tx + k, ty * 7) - 0.5) * TILE * 0.8, z = cz + wet[1] * TILE * 0.45 + (hash01(tx * 7, ty + k) - 0.5) * TILE * 0.8;
          const h0 = heightAt(x, z);
          if (h0 < LEVEL - 0.5 || h0 > LEVEL + 1.2 || taken(x, z, 1)) continue;
          FLORA.push({ kind: "reed", x, z, s: 0.6 + hash01(tx + k * 3, ty + 1) * hash01(tx, ty + k) * 1.6, ph: hash01(ty, tx + k) * 40, n: 3 + Math.floor(hash01(tx + k, ty + k) * 4) });
        }
      }
    }
    for (const f of FLORA) { const [r, h] = plantFoot(f); if (r > 0 && h > V.UNIT * 0.8) solids.push({ x: f.x, z: f.z, r, h }); }

    /* ── drawing ─────────────────────────────────────────────────────────── */
    // at night a glow is its own light: it keeps its brightness in the dark
    const glowAlpha = (e) => (NIGHT ? 1 : 1 - (e.fog ? e.fog.t : 0));
    function domePatch(q, x0, z0, a, w, y0, y1, arch) {
      const pts = [], y = floorAt(x0, z0);
      const at = (az, hy) => { const f = houseRad(q, hy) * 1.01; return [x0 + Math.sin(az) * f, y + hy, z0 + Math.cos(az) * f]; };
      for (let j = 0; j <= 8; j++) { const t = j / 8; pts.push(at(a - w + 2 * w * t, y1 + (arch ? Math.sin(Math.PI * t) * arch : 0))); }
      pts.push(at(a + w, y0)); pts.push(at(a - w, y0));
      return pts;
    }
    const facing = (x, z, a) => Math.sin(a) * (E.cam.x - x) + Math.cos(a) * (E.cam.z - z) > 0;
    const polyFill = (fill, ink, lw) => (g, sp) => {
      g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]); g.closePath();
      g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = lw || 1.4; g.strokeStyle = ink; g.stroke(); }
    };
    /** A gel dwelling, as the iso skins draw one: the mound, lit from within, a
     *  dark ooze doorway toward the plaza, and one warm window beside it. */
    function dwelling(q, x0, z0, y, lod) {
      const d = [[4, 9], [5, 12], [6, 16]][lod];
      E.organic(M.shapes.disc(x0, z0, q.r * 1.2, 14, (px, pz) => floorAt(px, pz) + 0.08), "rgba(0,0,0,0.18)", null, 0, { layer: 0, stable: true, bias: 6, inkPx: 1e9 });
      const hi = M3.shade(q.colour, NIGHT ? 0.2 : 0.28), lo = M3.shade(q.colour, NIGHT ? -0.22 : -0.16), ink = NIGHT ? "rgba(0,0,0,0.55)" : M3.shade(q.colour, -0.42);
      const shell = [];
      for (const f of [0, 0.2, 0.4, 0.55, 0.7, 0.82, 0.92, 0.98, 1]) {
        const rr = houseRad(q, f * q.h), nn = f === 1 ? 1 : d[1];
        for (let j = 0; j < nn; j++) { const t = TAU * (j / d[1]); shell.push([x0 + Math.cos(t) * rr, y - 0.3 + f * q.h, z0 + Math.sin(t) * rr]); }
      }
      const inner = NIGHT ? "rgba(63,208,160,0.22)" : "rgba(159,230,192,0.32)";
      E.organic(shell, vgrad(hi, lo), ink, 1.3, { layer: 2, tag: q, fade: true, after: (g, ring, bb) => {
        g.save(); M.traceRing(g, ring); g.clip();
        const gr = g.createRadialGradient(bb.x + bb.w / 2, bb.y + bb.h * 0.62, 0, bb.x + bb.w / 2, bb.y + bb.h * 0.62, bb.w * 0.5);
        gr.addColorStop(0, inner); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(bb.x, bb.y, bb.w, bb.h);
        g.globalAlpha = NIGHT ? 0.1 : 0.24; g.fillStyle = "#fff";
        g.beginPath(); g.ellipse(bb.x + bb.w * 0.34, bb.y + bb.h * 0.26, bb.w * 0.2, bb.h * 0.14, -0.5, 0, TAU); g.fill();
        g.restore();
      } });
      if (facing(x0, z0, q.door))                               // the iso "ooze doorway": dark
        E.custom(domePatch(q, x0, z0, q.door, HOUSE.doorW, 0, HOUSE.doorH, HOUSE.arch), polyFill(NIGHT ? "rgba(0,0,0,0.72)" : "rgba(18,30,22,0.78)", ink), { layer: 2, bias: q.r * 0.3, fade: true });
      if (facing(x0, z0, q.win)) {                              // the warm window: at night the only comfort, and its own light
        const pts = [];
        for (let j = 0; j < 12; j++) {
          const t = TAU * (j / 12), hy = HOUSE.winY + Math.sin(t) * HOUSE.winRy, rr = houseRad(q, hy) * 1.01, az = q.win + Math.cos(t) * (HOUSE.winRx / rr);
          pts.push([x0 + Math.sin(az) * rr, y + hy, z0 + Math.cos(az) * rr]);
        }
        const warm = NIGHT ? "#ffb24a" : "rgba(242,193,78,0.85)";
        E.custom(pts, (g, sp) => {
          if (NIGHT) {                                          // a halo round it: a gradient, never a blur
            let cx = 0, cy = 0, w = 0; for (const s of sp) { cx += s[0]; cy += s[1]; } cx /= sp.length; cy /= sp.length;
            for (const s of sp) w = Math.max(w, Math.hypot(s[0] - cx, s[1] - cy));
            const gr = g.createRadialGradient(cx, cy, w * 0.4, cx, cy, w * 3.2); gr.addColorStop(0, "rgba(255,180,80,0.45)"); gr.addColorStop(1, "rgba(255,180,80,0)");
            g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, w * 3.2, 0, TAU); g.fill();
          }
          polyFill(warm, ink, 1)(g, sp);
        }, { layer: 2, bias: q.r * 0.3, lit: true, fade: true });
      }
      if (lod) for (let v = 0; v < 3; v++) {
        const a = q.door + 0.9 + v * 1.7, pts = [];
        for (let s = 0; s <= 5; s++) { const hy = (s / 5) * q.h * 0.7, f = houseRad(q, hy) * 1.02, aa = a + Math.sin(s * 1.3 + v) * 0.08; pts.push([x0 + Math.sin(aa) * f, y + hy, z0 + Math.cos(aa) * f]); }
        E.line(pts, NIGHT ? "#243a20" : "#3f7a3a", 0.28, { layer: 2, world: true, maxPx: 4 });
      }
    }
    /** A bureaucore block, as theme-technocute.js boxes one: a solid in its
     *  accent colour, the top lit and the sides shaded, fat black edges; its
     *  number on a white plate (plaza kiosks only), and a door to go in by. */
    function block(q, x0, z0, y) {
      const hw = q.r, top = y + q.h, BLK = "#111111";
      E.organic(M.shapes.disc(x0 + 2, z0 + 2, hw * 1.35, 8, () => y + 0.06), "rgba(17,17,17,0.85)", null, 0, { layer: 0, stable: true, bias: 6, inkPx: 1e9 });
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x0 + a * hw, z0 + b * hw]);
      const sideCol = [M3.shade(q.accent, -0.34), M3.shade(q.accent, -0.16), M3.shade(q.accent, -0.34), M3.shade(q.accent, -0.16)];
      for (let k = 0; k < 4; k++) {
        const a = cs[k], b = cs[(k + 1) % 4];
        E.face([[a[0], y, a[1]], [b[0], y, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]], sideCol[k], BLK, 0.22, { layer: 2, world: true, maxPx: 3, tag: k === 0 ? q : undefined, fade: true });
      }
      E.face(cs.map((c) => [c[0], top, c[1]]), q.accent, BLK, 0.22, { layer: 2, bias: 0.5, world: true, maxPx: 3, tag: q, fade: true });
      // the door face: a dark doorway, and the kiosk's number on a white plate above it
      const nx = Math.sin(q.door), nz = Math.cos(q.door), tx = nz, tz = -nx, fx = x0 + nx * (hw + 0.05), fz = z0 + nz * (hw + 0.05);
      if (facing(fx, fz, q.door)) {
        const dw = hw * 0.34, dh = q.h * 0.36;
        E.face([[fx - tx * dw, y, fz - tz * dw], [fx + tx * dw, y, fz + tz * dw], [fx + tx * dw, y + dh, fz + tz * dw], [fx - tx * dw, y + dh, fz - tz * dw]], "#1b1b1b", BLK, 0.18, { layer: 2, bias: hw, world: true, maxPx: 3, fade: true });
        if (q.gate) {
          const pw = hw * 0.5, py = y + q.h * 0.62;
          E.custom([[fx - tx * pw, py - pw, fz - tz * pw], [fx + tx * pw, py - pw, fz + tz * pw], [fx + tx * pw, py + pw, fz + tz * pw], [fx - tx * pw, py + pw, fz - tz * pw]], (g, sp, e) => {
            polyFill("#fff", BLK, Math.max(1.5, 0.25 * E.fov / e.depth))(g, sp);
            let cx = 0, cy = 0, hgt = 0; for (const s of sp) { cx += s[0]; cy += s[1]; } cx /= 4; cy /= 4; hgt = Math.abs(sp[2][1] - sp[0][1]);
            g.fillStyle = BLK; g.font = "900 " + Math.max(6, hgt * 0.72).toFixed(1) + "px 'Arial Black','Helvetica Neue',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(String(q.slot + 1), cx, cy + hgt * 0.04);
          }, { layer: 2, bias: hw + 0.2, fade: true });
        }
      }
    }
    function buildHouses() {
      for (const q of HOUSES) {
        if (!ctx.ahead(q.x, q.z, q.r + 6)) continue;
        const [x0, z0] = ctx.at(q.x, q.z), y = floorAt(x0, z0), lod = ctx.lod(q.x, q.z);
        if (q.block) block(q, x0, z0, y); else dwelling(q, x0, z0, y, lod);
      }
    }
    /** The Glossary's wellhead, as engine.js draws it in every skin: a dark
     *  shaft, a collar of gel lobes in its road's colour, two bowed posts, a
     *  domed cap, a windlass, and the rope down the shaft. */
    function wellhead() {
      const W = WELLHEAD, [wx, wz] = ctx.at(wellAt.x, wellAt.z), y = floorAt(wx, wz), gel = wellAt.accent || "#4FA373";
      const ink = FLAT ? "#111111" : NIGHT ? "#0a0e0a" : SK.slime.ink, t = ctx.reduce ? 0 : E.t, sway = Math.sin(t * 0.9) * 0.5;
      E.organic(M.shapes.disc(wx, wz, W.mouth, 18, () => y + 0.9), "#050806", null, 0, { layer: 1, bias: 10, inkPx: 1e9, tag: WELL_TAG });
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU, lx = wx + Math.cos(a) * W.collar, lz = wz + Math.sin(a) * W.collar;
        E.organic(M.shapes.ball(lx, y + W.lobe * 0.55, lz, W.lobe * 0.9, W.lobe * 0.75, W.lobe * 0.9, 3, 8, false), vgrad(M3.shade(gel, 0.24), M3.shade(gel, -0.26)), ink, 1, { layer: 2, inkPx: 4 });
      }
      for (const side of [-1, 1]) {                            // two bowed posts
        const bx = wx + side * W.post;
        E.line([[bx, y + 1.5, wz], [bx + side * 0.7, y + W.postH * 0.55, wz], [bx - side * 1.0, y + W.postH, wz]], ink, 1.3, { layer: 2, world: true, maxPx: 9 });
        E.line([[bx, y + 1.5, wz], [bx + side * 0.7, y + W.postH * 0.55, wz], [bx - side * 1.0, y + W.postH, wz]], M3.shade(gel, -0.1), 0.75, { layer: 2, bias: 0.1, world: true, maxPx: 6 });
      }
      const cap = [];                                          // the domed cap
      for (let i = 0; i <= 3; i++) { const f = i / 3, rr = W.capR * Math.sqrt(1 - f * f) || 0.3; for (let j = 0; j < 12; j++) { const a = TAU * (j / 12); cap.push([wx + Math.cos(a) * rr, y + W.capBase + f * (W.capTop - W.capBase), wz + Math.sin(a) * rr * 0.5]); } }
      E.organic(cap, vgrad(M3.shade(gel, 0.3), M3.shade(gel, -0.22)), ink, 1.2, { layer: 2, bias: 0.3, fade: true });
      E.line([[wx - W.post * 0.87, y + W.windlass, wz], [wx + W.post * 0.87, y + W.windlass, wz]], ink, 1.1, { layer: 2, bias: 0.2, world: true, maxPx: 7 });
      E.line([[wx, y + W.windlass - 0.3, wz], [wx + sway * 0.5, y + W.windlass * 0.5, wz], [wx + sway * 0.3, y + 1, wz]], "#d8cfa8", 0.45, { layer: 2, bias: 0.25, world: true, maxPx: 3 });
    }
    function monument() {
      const [mx, mz] = ctx.at(0, 0), y = floorAt(mx, mz);
      if (SK.monument === "cone") {                            // bureaucore: a plain tall cone, cyan, an orange tip
        const h = 84 * ISO_PX, r = (22 / 67.9) * TILE, pts = [];
        for (let j = 0; j < 12; j++) { const a = TAU * (j / 12); pts.push([mx + Math.cos(a) * r, y, mz + Math.sin(a) * r]); }
        pts.push([mx, y + h, mz]);
        E.organic(pts, { vgrad: ["#c3f0ff", "#a6d4e4"] }, "#111111", 1.6, { layer: 2, world: false, inkPx: 2 });
        E.organic(M.shapes.ball(mx, y + h, mz, 4.5 * ISO_PX, 4.5 * ISO_PX, 4.5 * ISO_PX, 3, 8, false), "#f28b46", "#111111", 1.4, { layer: 2, bias: 0.5, inkPx: 2 });
        return;
      }
      const pts = [], wob = ctx.reduce ? 0 : Math.sin(E.t * (NIGHT ? 1.6 : 1.8)) * 0.4;   // the slime organism: a gel stalk, nodes, a crown
      for (let i = 0; i <= 6; i++) { const f = i / 6, hy = f * 18, r = 1.9 - 0.9 * f + 0.45 * Math.sin(f * 7); for (let j = 0; j < 8; j++) { const t = TAU * (j / 8); pts.push([mx + Math.cos(t) * r + wob * f, y + hy, mz + Math.sin(t) * r]); } }
      E.organic(pts, NIGHT ? vgrad("#1f5a44", "#0d2a20") : vgrad("#5fb892", "#2f6f55"), "rgba(20,50,36,0.85)", 1.2, { layer: 2, after: sheen(NIGHT ? 0.08 : 0.2) });
      const node = NIGHT ? "#3fd0a0" : "#7fe6c0", crown = NIGHT ? "#5fe0c8" : "#aaffe6";
      for (let i = 0; i < 4; i++) { const hy = 3 + i * 3.6; E.organic(M.shapes.ball(mx + (i % 2 ? 1.2 : -1.2) + wob * (hy / 18), y + hy, mz + 0.9, 0.6, 0.6, 0.6, 2, 6, false), NIGHT ? "#9fffd8" : "#bfffe6", rgba(P.ink, 0.5), 1, { layer: 2, bias: 2, inkPx: 3, lit: true, after: halo(node, 2) }); }
      E.organic(M.shapes.ball(mx + wob, y + 19.4, mz, 1.4, 1.2, 1.4, 3, 8, false), NIGHT ? "#dffff6" : "#eaffff", rgba(P.ink, 0.5), 1, { layer: 2, inkPx: 3, lit: true, after: halo(crown, NIGHT ? 3.4 : 2.4) });
    }
    /* ── signal towers the visitor raised in the iso world ───────────────
       Read live from the host page (ctx.towers, iso tiles), each stood at its
       tile as the iso painter draws it (buildings.js drawSignalTower): in the
       slime skins the colonised mast, a gel footing, rungs, vines up its lower
       part and a bare lamp lit by its Musebot's state (unlit unassigned, cyan
       ready or playing, pulsing on the beat, red and blinking on an error); in
       bureaucore the plain mast on its blue base. Its lamp is a light at night. */
    const TW = { mast: 68 * ISO_PX, lamp: 70 * ISO_PX, rung: 9 * ISO_PX, foot: 16 * ISO_PX };
    const TSK = { technurture: { foot: "#3fa882", mast: "#1f3a1a", rung: "#8fc4b4", vine: "#3f7a3a", bud: "#56a04e" },
      technoscure: { foot: "#1c4738", mast: "#14160f", rung: "#cdbf9a", vine: "#1f5a3a", bud: "#26533c" },
      technocute: { foot: "#26344a", mast: "#111111", rung: "#79a9a1", vine: null, bud: null } }[SK.id];
    const dynSolids = [];
    function buildTowers() {
      dynSolids.length = 0;
      const list = ctx.towers ? ctx.towers() : [];
      for (const tw of list) {
        const wx = toWorld(tw.tx), wz = toWorld(tw.ty);
        dynSolids.push({ x: wx, z: wz, r: TW.foot * 0.6 });
        if (!ctx.ahead(wx, wz, 8)) continue;
        const [x, z] = ctx.at(wx, wz), y = floorAt(x, z), st = ctx.towerState(tw.uid) || {}, t = ctx.reduce ? 0 : E.t;
        const beat = Math.max(0, Math.min(1, st.beat || 0)), lit = st.state === "playing" || st.state === "ready" || st.state === "error";
        const blink = st.state === "error" ? (Math.sin(t * 3.4) > 0 ? 1 : 0.15) : 1, col = st.state === "error" ? "#ff6b78" : "#7afcff";
        E.organic(M.shapes.disc(x, z, TW.foot, 14, (px, pz) => floorAt(px, pz) + 0.1, null), rgba(TSK.foot, 0.9), null, 0, { layer: 0, stable: true, bias: 4, inkPx: 1e9 });
        E.line([[x, y, z], [x, y + TW.mast, z]], TSK.mast, 0.8, { layer: 2, world: true, maxPx: 7, fade: true });
        for (let h = 12; h <= 60; h += 12) E.line([[x - TW.rung, y + h * ISO_PX, z], [x + TW.rung, y + h * ISO_PX, z]], TSK.rung, 0.45, { layer: 2, bias: 0.1, world: true, maxPx: 4 });
        if (TSK.vine) for (let i = 0; i < 3; i++) {                  // vines up the lower two thirds
          const x0 = x + (-7 + i * 7) * ISO_PX, top = (30 + i * 9) * ISO_PX, sway = Math.sin(t * 1.2 + i * 1.7) * 0.35, pts = [];
          for (let k = 0; k <= 4; k++) pts.push([x0 + (k % 2 ? 0.8 : -0.8) + sway * (k / 4), y + top * (k / 4), z + 0.2]);
          E.line(pts, TSK.vine, 0.4, { layer: 2, bias: 0.2, world: true, maxPx: 4 });
        }
        const ly = y + TW.lamp;
        if (!lit) E.organic(M.shapes.ball(x, ly, z, 0.85, 0.85, 0.85, 3, 8, false), "#3d5248", "rgba(255,255,255,0.22)", 1, { layer: 2, inkPx: 3 });
        else E.organic(M.shapes.ball(x, ly, z, 1.1 + beat * 0.8, 1.1 + beat * 0.8, 1.1 + beat * 0.8, 3, 8, false), col, null, 0, { layer: 2, inkPx: 1e9, lit: true, alpha: blink,
          after: (g, ring, bb) => {                              // its glow, and the ring the beat throws off
            const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, r = bb.w * (2.4 + beat * 1.2);
            const gr = g.createRadialGradient(cx, cy, bb.w * 0.2, cx, cy, r); gr.addColorStop(0, rgba(col, 0.5 * blink)); gr.addColorStop(1, rgba(col, 0));
            g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
            if (beat > 0) { g.globalAlpha = beat; g.strokeStyle = col; g.lineWidth = Math.max(1, bb.w * 0.12); g.beginPath(); g.arc(cx, cy, bb.w * (1.2 + (1 - beat) * 2.2), 0, TAU); g.stroke(); g.globalAlpha = 1; }
          } });
      }
    }
    function buildLandmarks() {
      buildTowers();
      if (ctx.ahead(0, 0, 10)) monument();
      if (ctx.ahead(wellAt.x, wellAt.z, 14)) wellhead();
    }
    function buildFlora() {
      if (!PL) return;
      for (const f0 of FLORA) {
        if (!ctx.ahead(f0.x, f0.z, 3 + f0.s * 3)) continue;
        const dCam = Math.hypot(ctx.wrapD(f0.x - E.cam.x), ctx.wrapD(f0.z - E.cam.z));
        if (f0.small && dCam > 95) continue;
        const [x0, z0] = ctx.at(f0.x, f0.z), f = { kind: f0.kind, x: x0, z: z0, s: f0.s, ph: f0.ph, n: f0.n, r: f0.r, bud: f0.bud };
        const y = floorAt(f.x, f.z), s = f.s, lod = ctx.lod(f0.x, f0.z), sway = ctx.reduce ? 0 : Math.sin(E.t * 1.6 + f.ph) * 0.25;
        if (f.kind === "lily") {
          const pts = M.shapes.disc(f.x, f.z, f.r, f.r > 2 ? 16 : 10, () => LEVEL + 0.03, (j) => (j === 0 ? -0.4 : 0));
          E.organic(pts, PL.lily, "rgba(12,46,34,0.6)", 0.8, { layer: 1, bias: 1500, inkPx: 5 });
          if (f.bud) E.organic(M.shapes.ball(f.x - 0.3, LEVEL + 0.45, f.z, 0.35, 0.35, 0.35, 2, 6, false), PL.bud, null, 0, { layer: 1, bias: 1600, inkPx: 1e9, lit: true, after: halo(PL.bud, 2) });
        } else if (f.kind === "mould") {
          E.organic(M.shapes.disc(f.x, f.z, 2.4 * s, [6, 8, 10][lod], (px, pz) => floorAt(px, pz) + 0.14, (j) => 0.2 * Math.sin(j * 2.7 + f.ph)), PL.mould, P.ink, 0.8, { layer: 0, stable: true, bias: 1, inkPx: 6, rough: { tufts: 12, depth: 0.08, seed: f.ph, round: true } });
          if (lod) for (let j = 0; j < 3; j++) {
            const a = f.ph + j * 2.1, x = f.x + Math.cos(a) * s, z = f.z + Math.sin(a) * s;
            E.line([[x, y, z], [x, y + 1.1 * s, z]], NIGHT ? "#2f7a5a" : "#cfe0b0", 0.12 * Math.max(1, s * 0.5), { layer: 2, world: true });
            E.organic(M.shapes.ball(x, y + 1.2 * s, z, 0.28 * Math.max(1, s * 0.5), 0.28 * Math.max(1, s * 0.5), 0.28 * Math.max(1, s * 0.5), 2, 5, false), PL.fruit, null, 0, { layer: 2, inkPx: 1e9, minPx: 0.5, lit: NIGHT });
          }
        } else if (f.kind === "gelpod") {
          const r = 1.5 * s;
          E.organic(M.shapes.ball(f.x, y + r * 0.7, f.z, r, r * 0.82, r, 3, [6, 8, 10][lod], false), PL.gel, "rgba(20,70,60,0.7)", 1, { layer: 2, inkPx: 4, fade: s > 1.4, after: (g, ring, bb, sp, e) => {
            const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, gr = g.createRadialGradient(cx, cy, 0, cx, cy, bb.w * 0.35);
            gr.addColorStop(0, PL.core); gr.addColorStop(1, "rgba(170,255,230,0)");
            g.globalAlpha = glowAlpha(e); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, bb.w * 0.35, 0, TAU); g.fill(); g.globalAlpha = 1;
            if (!NIGHT) { g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(bb.x + bb.w * 0.3, bb.y + bb.h * 0.22, bb.w * 0.12, bb.h * 0.08, 0, 0, TAU); g.fill(); }
          } });
        } else if (f.kind === "reed") {
          for (let j = 0; j < f.n; j++) {
            const a = f.ph + j * 2.4, off = 0.35 * s * Math.sqrt(j), x = f.x + Math.cos(a) * off, z = f.z + Math.sin(a) * off;
            const h = (2.4 + 1.4 * ctx.hash(f.ph * 13 + j)) * s, lean = sway * (0.6 + j * 0.2) + (ctx.hash(f.ph + j) - 0.5) * 0.5 * s;
            const top = [x + lean, y + h, z];
            E.line([[x, y - 0.2, z], [x + lean * 0.3, y + h * 0.55, z], top], PL.reed[j & 1], 0.14 + 0.05 * s, { layer: 2, world: true, maxPx: 4 });
            if (j === 0 && lod) E.organic(M.shapes.ball(top[0], top[1] - 0.5 * s, z, 0.22 * s + 0.08, 0.6 * s, 0.22 * s + 0.08, 2, 6, false), PL.head, "rgba(30,20,10,0.8)", 1, { layer: 2, inkPx: 3, minPx: 0.8 });
          }
        } else if (f.kind === "sporecap") {
          const h = 2.6 * s;
          // the stalk as thick as the iso one is to its cap (3.5 px to a 9 px cap): no screen cap on its width, or a giant's went thread-thin
          E.line([[f.x, y, f.z], [f.x + sway * 0.4, y + h, f.z]], PL.stalk, 0.5 * s, { layer: 2, world: true, maxPx: 400, fade: s > 1.4 });
          E.organic(M.shapes.ball(f.x + sway * 0.4, y + h, f.z, 1.3 * s, 0.85 * s, 1.3 * s, 3, [6, 8, 10][lod], true), vgrad(PL.cap[0], PL.cap[1]), "rgba(50,20,60,0.8)", 1, { layer: 2, inkPx: 4, fade: s > 1.4, after: halo(PL.capGlow, 1.5) });
        } else {
          for (let j = -1; j <= 1; j++) {
            const x = f.x + j * 0.7 * s, h = (2.6 + (j & 1) * 0.6) * s;
            E.line([[x, y, f.z], [x + sway + j * 0.4, y + h * 0.55, f.z], [x + sway, y + h, f.z]], PL.tendril, 0.28 * Math.max(0.6, s), { layer: 2, world: true, maxPx: 200 });
            if (lod && !f0.small) E.billboard([x + sway, y + h, f.z], (g, sx, sy, k, e) => {
              const r = Math.max(1, 0.3 * k * Math.max(1, s * 0.5)), a = glowAlpha(e);
              g.fillStyle = rgba(PL.drip, 0.35 * a); g.beginPath(); g.arc(sx, sy, r * 2.4, 0, TAU); g.fill();
              g.fillStyle = rgba("#e8fff4", a); g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
            }, { layer: 2, lit: true });
          }
        }
      }
    }

    function sky(g) {
      const W = E.W, H = E.H, horizon = H / 2 + E.fov * Math.tan(E.cam.pitch);
      if (NIGHT) gatherLamps();
      const gr = g.createLinearGradient(0, Math.min(0, horizon - H), 0, Math.max(1, horizon));
      gr.addColorStop(0, SK.sky[0]); gr.addColorStop(0.75, SK.sky[1]); gr.addColorStop(1, P.air);
      g.fillStyle = gr; g.fillRect(0, 0, W, Math.max(0, horizon) + 1);
      g.fillStyle = P.air; g.fillRect(0, Math.max(0, horizon), W, H);
      if (!FLAT) for (const [c, amp, f, off] of NIGHT ? [] : [[mix(P.air, "#9cc2ae", 0.35), 0.016, 3, 1], [mix(P.air, "#8fb8a2", 0.5), 0.01, 5, 2.3]]) {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
        for (let sx = 0; sx <= W; sx += 12) {
          const th = E.cam.yaw + Math.atan((sx - W / 2) / E.fov);
          g.lineTo(sx, horizon - E.fov * amp * (0.55 + 0.45 * Math.sin(th * f + off) + 0.25 * Math.sin(th * f * 2.7 + off * 2)));
        }
        g.lineTo(W, H); g.closePath(); g.fill();
      }
      // past the haze's end the ground is the air itself: one steady colour, nothing to swim
      const airPacked = (255 << 24) | ((airC[2] & 255) << 16) | ((airC[1] & 255) << 8) | (airC[0] & 255);
      E.heightfield({ res: 4, base: 0.5, far: FOG1, farColour: airPacked, height: FLAT ? () => 0.6 : (x, z) => Math.max(LEVEL, heightAt(x, z)), shade: groundShade });
    }
    /** Night: the fog is the dark, and it lifts where there is light. By day and
     *  on the board it is the haze, from FOG0 out. */
    function fog(p, d, o) {
      const c = E.cam, dist = Math.hypot(p[0] - c.x, p[1] - c.y, p[2] - c.z);
      let t = M.smooth((dist - FOG0) / (FOG1 - FOG0));
      if (NIGHT && !(o && o.lit)) t = Math.max(t, DARK * (1 - lightAt(p[0], p[2])));
      return { t, colour: P.air };
    }

    const spot = (rnd) => { for (let k = 0; k < 400; k++) { const x = (rnd() - 0.5) * PER, z = (rnd() - 0.5) * PER; if (heightAt(x, z) > LEVEL + 0.3 && !taken(x, z, 6)) return [x, z]; } return [0, -80]; };
    const villageR = (ISO.ring + 2) * TILE;
    const entries = { start: { x: 0, z: -ISO.hub * TILE * 0.55, yaw: 0 } };
    const portals = [];
    // A house's door: into its room (the proposal), or, as in the iso village,
    // its menu or its page; only the house whose link is the 3D view itself
    // (the Slimeverse 3D house) leads inside, since that is where the view lives.
    const menus = ctx.doors === "menus", isHome = (q) => q.item && q.item.url && /slimeverse3d\.html/.test(q.item.url);
    HOUSES.forEach((q, i) => {
      const out = doorAt(q, 8);
      entries["house" + i] = { x: out[0], z: out[1], yaw: q.door };
      const d = doorAt(q);
      if (!menus || isHome(q)) portals.push({ x: d[0], z: d[1], r: 4.6, to: "indoors", entry: "door", back: entries["house" + i] });
      else portals.push({ x: d[0], z: d[1], r: 4.6, open: q.item });
      if (isHome(q)) entries.home = entries["house" + i];
    });
    { const a = Math.atan2(-wellAt.x, -wellAt.z), r = WELLHEAD.collar + 12;
      entries.well = { x: wellAt.x + Math.sin(a) * r, z: wellAt.z + Math.cos(a) * r, yaw: a };
      const reach = WELLHEAD.collar + WELLHEAD.lobe + V.UNIT * 0.8 + 1.5;
      // the wellhead: down to the cave (the proposal), or, as in the iso village, the Glossary's page
      if (menus && wellAt.item && wellAt.item.url) portals.push({ x: wellAt.x, z: wellAt.z, r: reach, open: wellAt.item });
      else portals.push({ x: wellAt.x, z: wellAt.z, r: reach, to: "cave", entry: "well" }); }
    const L = SK.life;
    return {
      name: "Outdoors", skin: SK.id, seen: SEEN, period: PER, sea: FLAT ? null : { level: LEVEL }, floorAt, ceilAt: null, pal, solids,
      pools: [], mirrorAlpha: NIGHT ? 0.25 : 0.4, fogFrom: FOG0, fog, night: NIGHT, slime: SK.slime, signStyle: SK.sign, audio: SK.audio, dynSolids,
      /** iso tiles to world units and back, for a host page syncing the two views */
      fromTile: (tx, ty) => [toWorld(tx), toWorld(ty)],
      // depth of field: sharp to 70 units, softening to 130, soft beyond
      // cruder and cheaper: no blur filter at all, only the distance drawn small and scaled up
      // at a quarter size far things hopped between 4-pixel blocks as they moved, and the distance swam
      focus: MIST ? null : { near: 70, far: 130, scale: [1 / 2, 1 / 1.4], blur: [0, 0] },
      biomeAt: (x, z) => biomeAt(Math.round(tileX(x)), Math.round(tileZ(z))), houses: HOUSES, well: wellAt, flora: FLORA,
      things: () => HOUSES.map((q) => ({ kind: "house", title: q.title, tx: tileX(q.x), ty: tileZ(q.z) }))
        .concat([{ kind: "wellhead", title: wellAt.title, tx: tileX(wellAt.x), ty: tileZ(wellAt.z) }]),
      tileOf: (x, z) => [tileX(x), tileZ(z)],
      // what a click opens, where the doors open menus: every house, and the wellhead
      clickables: () => (ctx.doors === "menus" ? HOUSES.map((q) => ({ x: q.x, z: q.z, r: q.block ? q.r * 1.2 : q.r * 1.06, h: q.h, radAt: q.block ? null : (up) => houseRad(q, up), item: q.item }))
        .concat(wellAt.item ? [{ x: wellAt.x, z: wellAt.z, r: WELLHEAD.collar + WELLHEAD.lobe, h: WELLHEAD.capTop, item: wellAt.item }] : []) : []),
      walkable: () => true,
      bound() {},
      open: (x, y, z) => y > floorAt(x, z) + 1.5 && y < 160,
      entries, portals,
      // the iso sign's own size and place, at the slime's ratio: letters 16 px (13 in bureaucore), the
      // board's middle 48 px over the roof (50 for the neon, 17 for the plate), floating on a vacuole
      signs: HOUSES.map((q) => ({ x: q.x, z: q.z, top: floorAt(q.x, q.z) + q.h, text: q.title, slot: q.slot, accent: q.accent }))
        .concat([{ x: wellAt.x, z: wellAt.z, top: floorAt(wellAt.x, wellAt.z) + WELLHEAD.capTop, text: wellAt.title, slot: 777, accent: wellAt.accent }])
        .map((s) => Object.assign(s, { post: false, float: true, tether: s.top,
          font: (SK.sign === "plate" ? 13 : 16) * ISO_PX, y: s.top + (SK.sign === "plate" ? 17 : SK.sign === "neon" ? 50 : 48) * ISO_PX })),
      life: {
        zoogs: L.zoogs, shoggoths: L.shoggoths, sense: 220, dormant: !!L.dormant,
        spot: (rnd) => (rnd() < 0.5 ? (() => { const a = rnd() * TAU, r = villageR + rnd() * 12 * TILE; const x = Math.cos(a) * r, z = Math.sin(a) * r; return taken(x, z, 4) || heightAt(x, z) < LEVEL ? spot(rnd) : [x, z]; })() : spot(rnd)),
        shogSpot: (rnd) => { for (let k = 0; k < 200; k++) { const a = rnd() * TAU, r = villageR + (1 + rnd() * 8) * TILE, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!taken(x, z, 6)) return [x, z]; } return spot(rnd); },
        avoid: (x, z) => { const lx = ctx.wrapD(x), lz = ctx.wrapD(z), d = Math.hypot(lx, lz) || 1; return d < villageR ? [(lx / d) * 3, (lz / d) * 3] : [0, 0]; },
        night: () => NIGHT,
        // the night skin's fireflies (its ecology's 42), drifting over the fields near the village
        motes: L.fireflies ? { n: L.fireflies, glow: "#e8d67a", core: "#fff7c8", lit: true, spot: (rnd) => { const a = rnd() * TAU, r = villageR * 0.8 + rnd() * 16 * TILE; return [Math.cos(a) * r, Math.sin(a) * r, 0.05 + rnd() * 0.25]; } } : null,
      },
      camera: { dist: 62, height: (dist) => Math.min(dist * 0.32, 22) },
      sky,
      build() { buildHouses(); buildLandmarks(); buildFlora(); },
    };
  } }; }
  V.defineScene("outdoors", isoWorld(SKINS.technurture));
  V.defineScene("outdoors@technoscure", isoWorld(SKINS.technoscure));
  V.defineScene("outdoors@technocute", isoWorld(SKINS.technocute));
  V.SKINS = SKINS;
})();
