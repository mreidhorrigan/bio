// @ts-check
"use strict";
/* ============================================================================
   slime3d.js  ·  a cave in three dimensions, over the slime's shoulder
   ----------------------------------------------------------------------------
   A prototype on its own page, not yet wired into the site. The renderer is
   engine-3d.js (MH_3D); this file is only the WORLD: where the rock is, what
   colour it is, what grows in it, who lives in it, and what is written on it.

   THE CAVE is a corridor along z whose centre wanders, whose width breathes and
   whose floor rolls. Every surface is an analytic function of position, so the
   cave is the same shape on every visit and nothing is stored. Halfway along
   it darkens into the second half, the way the glossary's cave does, and the
   two palettes are the glossary's.

   HOW IT IS DRAWN, in the site's idiom: nothing is outlined by its
   tessellation. The floor is laid as overlapping rounded blobs, the walls and
   roof are lobes of rock, and each of those is one smooth ink line round one
   fill, exactly the way the isometric skins lay their ground and the way the
   slime itself is drawn. Base strips underneath carry the colour where the
   blobs leave gaps. Fog is per surface, toward the air of the half it stands
   in.

   TO EXTEND
     A structure:  defineProp(name, { chance, edge, maxDark, make, build })
                   and it appears along the corridor; see the five below.
     A creature:   addCreature({ step(dt), build() }); the player is one, the
                   motes in the dark are another.
     Text:         addSign({ x, z, text, sub }) hangs a plaque of the skin's
                   sign format at that point; none are placed by default.
     A pass:       layers is the ordered list of build functions; push one.
   Everything is reachable at runtime through window.MH_SLIME3D.
   ========================================================================== */
(function () {
  const M = window.MH_3D;
  const cv = /** @type {HTMLCanvasElement|null} */ (document.getElementById("stage"));
  if (!M || !cv) return;
  const E = M.create(cv);
  const { clamp, lerp, smooth, TAU, mix, rgba, shade } = M;
  const reduce = E.reduce;
  const debug = /[?&]debug=1/.test(location.search);

  /* ── the corridor ────────────────────────────────────────────────────── */
  const END = 2600, DARK_FROM = 1150, SEEN = 200, BEHIND = 40, STEP = 7;
  const centre = (z) => 16 * Math.sin(z * 0.011) + 6 * Math.sin(z * 0.031 + 1.2);
  const halfWidth = (z) => 26 + 6 * Math.sin(z * 0.023 + 0.6);
  /** 0 in the living half, 1 in the dark one. */
  const darkAt = (z) => smooth((z - DARK_FROM) / 90);
  function floorAt(x, z) {
    const off = x - centre(z);
    return -5 * Math.sin(z * 0.019) - 2.4 * Math.sin(z * 0.047 + 1.7)
      - 1.2 * Math.sin(z * 0.11 + 0.3) - 1.1 * Math.sin(off * 0.17 + z * 0.02)
      + 0.06 * off * off / halfWidth(z);                    // the floor dishes toward the walls
  }
  function roofAt(x, z) {
    const head = lerp(30, 19, darkAt(z));
    return floorAt(x, z) + head + 2.2 * Math.sin(z * 0.06 + 2.1) + 1.4 * Math.sin(x * 0.2);
  }
  const headroom = (z) => roofAt(centre(z), z) - floorAt(centre(z), z);
  /** Open air with a margin: where a camera may stand. */
  const inside = (x, y, z) => Math.abs(x - centre(z)) < halfWidth(z) - 2.5
    && y > floorAt(x, z) + 1.5 && y < roofAt(x, z) - 1.5;

  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hash2 = (a, b) => hash(a * 7.13 + b * 131.7);

  /* ── the two palettes, the glossary cave's ───────────────────────────── */
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
  /** The palette at a point along the corridor, crossfaded through the turn. */
  function pal(z) {
    const band = Math.round(z / 6);
    let P = palCache.get(band);
    if (P) return P;
    const t = darkAt(band * 6);
    P = { t };
    for (const k in LIT) P[k] = mix(LIT[k], DARK[k], t);
    P.floorSteps = []; P.wallHi = []; P.roofSteps = [];
    for (let i = 0; i < 8; i++) {
      P.floorSteps.push(mix(P.rockLo, P.rock, 0.3 + 0.7 * i / 7));
      P.wallHi.push(shade(P.wall, 0.08 + 0.1 * i / 7));        // the lit top of a wall lobe
      P.roofSteps.push(mix(P.roof, P.rock, 0.15 + 0.35 * i / 7));
    }
    P.wallLo = shade(P.wall, -0.16);                            // and its shaded underside
    P.rockHi = shade(P.rock, 0.16);
    palCache.set(band, P);
    return P;
  }
  E.fog = (p, d) => ({ t: smooth((d - 36) / (SEEN - 36)) * 0.96, colour: pal(p[2]).air });

  /* ── the slime, and where it is ──────────────────────────────────────── */
  const me = { x: 0, z: 26, y: 0, yaw: 0, speed: 0, bob: 0, R: 3.1, pool: null, ripple: 0,
    goal: /** @type {null|{x:number,z:number}} */ (null), goalBest: Infinity, stuck: 0 };

  /* ── standing water, where the floor dips ───────────────────────────────
     A pool carries a height field across x and z, stepped by the wave
     equation with damping and a spring back to level (the 2D cave's water,
     across two axes). Wading drives it. The surface is drawn as a translucent
     sheet whose rim and ripples ride the field, so it moves in depth.        */
  const POOLS = [], WAVE_C = 9, WAVE_DAMP = 2.0, WAVE_K = 5.5;
  (function findPools() {
    for (let z = 40; z < END; z += 6) {
      const y = floorAt(centre(z), z);
      if (floorAt(centre(z - 6), z - 6) <= y || floorAt(centre(z + 6), z + 6) <= y) continue;
      let lo = z, hi = z;
      while (hi - lo < 130 && (floorAt(centre(lo), lo) - y < 2.6 || floorAt(centre(hi), hi) - y < 2.6)) {
        if (floorAt(centre(lo), lo) - y < 2.6) lo -= 6;
        if (floorAt(centre(hi), hi) - y < 2.6) hi += 6;
      }
      if (hi - lo < 24 || hi - lo >= 130) continue;
      if (POOLS.some((p) => Math.abs(p.z - z) < 150)) continue;
      const nz = clamp(Math.round((hi - lo) / 5), 6, 26), nx = 9;
      POOLS.push({ z, lo, hi, level: y + 1.6, nx, nz, dz: (hi - lo) / (nz - 1),
        h: new Float64Array(nx * nz), v: new Float64Array(nx * nz), next: new Float64Array(nx * nz), amp: 0.9 });
      if (POOLS.length >= 8) break;
    }
  })();
  const poolAt = (z) => POOLS.find((p) => z > p.lo && z < p.hi) || null;
  const poolHalf = (z) => halfWidth(z) - 3;
  /** The wading field, interpolated. */
  function fieldAt(p, x, z) {
    const w = poolHalf(z), c = centre(z);
    const u = clamp((x - (c - w)) / Math.max(0.001, 2 * w), 0, 1) * (p.nx - 1);
    const t = clamp((z - p.lo) / p.dz, 0, p.nz - 1);
    const i = Math.floor(u), j = Math.floor(t), i2 = Math.min(p.nx - 1, i + 1), j2 = Math.min(p.nz - 1, j + 1);
    const a = lerp(p.h[j * p.nx + i], p.h[j * p.nx + i2], u - i);
    const b = lerp(p.h[j2 * p.nx + i], p.h[j2 * p.nx + i2], u - i);
    return lerp(a, b, t - j);
  }
  /** Water is never dead flat: two small crossing waves ride the surface even
   *  when nothing has touched it (the analytic waves of the research note, at
   *  a pool's scale), so glints and reflections always move a little. */
  const AMB = 0.045;
  const ambient = (x, z) => (reduce ? 0 : AMB * (Math.sin(x * 0.9 + E.t * 1.7) + 0.8 * Math.sin(z * 0.7 - E.t * 1.3 + x * 0.5)));
  /** Where the surface stands at a point on the pool: level, waves, and ripples. */
  const waterY = (p, x, z) => p.level + fieldAt(p, x, z) + ambient(x, z);
  /** The surface normal there, from finite differences: what the light bounces off. */
  function waterNormal(p, x, z) {
    const e = 0.6;
    const dx = (waterY(p, x + e, z) - waterY(p, x - e, z)) / (2 * e);
    const dz = (waterY(p, x, z + e) - waterY(p, x, z - e)) / (2 * e);
    const m = Math.hypot(dx, 1, dz);
    return [-dx / m, 1 / m, -dz / m];
  }
  function disturb(p, x, z, impulse) {
    const w = poolHalf(z), c = centre(z);
    const ui = clamp((x - (c - w)) / Math.max(0.001, 2 * w), 0, 1) * (p.nx - 1);
    const ti = clamp((z - p.lo) / p.dz, 0, p.nz - 1);
    for (let j = 0; j < p.nz; j++) for (let i = 0; i < p.nx; i++) {
      const d = Math.hypot(i - ui, (j - ti) * 0.7);
      if (d > 2.6) continue;
      p.v[j * p.nx + i] += clamp(impulse, -9, 9) * (0.5 + 0.5 * Math.cos(Math.PI * d / 2.6));
    }
  }
  function stepWater(dt) {
    const c2 = WAVE_C * WAVE_C;
    for (const p of POOLS) {
      if (p.hi < backZ() || p.lo > frontZ()) continue;
      for (let j = 0; j < p.nz; j++) for (let i = 0; i < p.nx; i++) {
        const k = j * p.nx + i, hh = p.h[k];
        const l = p.h[j * p.nx + Math.max(0, i - 1)], r = p.h[j * p.nx + Math.min(p.nx - 1, i + 1)];
        const u = p.h[Math.max(0, j - 1) * p.nx + i], d = p.h[Math.min(p.nz - 1, j + 1) * p.nx + i];
        p.v[k] += (c2 * (l + r + u + d - 4 * hh) - WAVE_DAMP * p.v[k] - WAVE_K * hh) * dt;
        p.next[k] = clamp(hh + p.v[k] * dt, -p.amp, p.amp);
        if (p.next[k] === p.amp || p.next[k] === -p.amp) p.v[k] = 0;
      }
      p.h.set(p.next);
    }
  }
  /* How the water is drawn, following the research note's split: the height
     field is the simulation; one sheet per pool, bounded by its SHORELINE, is
     the representation; and what makes it read as water is the rendering, done
     here with what a 2D canvas has.
       shoreline   the sheet's edge is where the floor comes up through the
                   surface, marched from the basin's centre, so a pool is a
                   lens of the basin's own shape and never a slab across the cave
       depth       one gradient from the far shore to the near: reflective and
                   opaque where the eye grazes it, clear over the near shallows,
                   deepest in colour where the basin is deepest
       reflection  everything standing round the pool is mirrored into it, bent
                   by the waves (E.mirror)
       specular    where a wave tilts the surface so that it throws the light at
                   the eye, a glint: a bright dash that moves with the field   */
  /** The shoreline of a pool: for each of `rows` slices along it, how far the
   *  water reaches either side of the centre before the floor rises above the
   *  level. The floor and the level are fixed, so this is found once. */
  function shoreline(p) {
    if (p.shore) return p.shore;
    const wet = (x, z) => floorAt(x, z) < p.level - 0.04;
    let lo = p.lo, hi = p.hi;
    while (lo < hi && !wet(centre(lo), lo)) lo += 0.5;
    while (hi > lo && !wet(centre(hi), hi)) hi -= 0.5;
    const rows = 22, left = [], right = [];
    for (let j = 0; j <= rows; j++) {
      const z = lo + (hi - lo) * (j / rows), c = centre(z), wall = halfWidth(z) - 1.6;
      let a = 0, b = 0;
      while (a < wall && wet(c - a, z)) a += 0.5;
      while (b < wall && wet(c + b, z)) b += 0.5;
      left.push([c - a, z]); right.push([c + b, z]);
    }
    p.shore = { lo, hi, left, right };
    return p.shore;
  }
  const inPool = (p, x, z) => floorAt(x, z) < p.level - 0.04;
  function buildWater() {
    const c = E.cam;
    for (const p of POOLS) {
      if (p.hi < backZ() || p.lo > frontZ()) continue;
      const P = pal(p.z), sh = shoreline(p);
      if (sh.hi - sh.lo < 4) continue;
      // A low camera looks at a pool across its near rim, and the water just
      // beyond the rim is hidden by it. Rows whose middle the floor hides from
      // the eye are left out, so the sheet begins where the water can be seen
      // and never paints over the rise in front of it.
      const seen = (x, y, z) => {
        for (let k = 1; k <= 10; k++) {
          const t = k / 11, sx = c.x + (x - c.x) * t, sy = c.y + (y - c.y) * t, sz = c.z + (z - c.z) * t;
          if (floorAt(sx, sz) > sy + 0.12) return false;
        }
        return true;
      };
      let first = -1, last = -1;
      for (let j = 0; j < sh.left.length; j++) {
        const mx = (sh.left[j][0] + sh.right[j][0]) / 2, mz = sh.left[j][1];
        if (seen(mx, waterY(p, mx, mz), mz)) { if (first < 0) first = j; last = j; }
      }
      if (first < 0) continue;                                // all of it is behind the floor
      const ring = [];
      for (let j = first; j <= last; j++) { const q = sh.left[j]; ring.push([q[0], waterY(p, q[0], q[1]), q[1]]); }
      for (let j = last; j >= first; j--) { const q = sh.right[j]; ring.push([q[0], waterY(p, q[0], q[1]), q[1]]); }
      if (ring.length < 3) continue;
      E.mirror(ring, { surface: (x, z) => waterY(p, x, z), level: p.level, z0: sh.lo - 6, z1: sh.hi + 34, alpha: P.t < 0.5 ? 0.36 : 0.3 });
      const zm = (sh.lo + sh.hi) / 2, xm = centre(zm);
      const depth = clamp((p.level - floorAt(xm, zm)) / 2.4, 0, 1);              // how deep the basin goes
      const far = rgba(mix(P.deep, P.shallow, 0.18), 0.84);                      // grazing: a mirror
      const mid = rgba(mix(P.shallow, P.deep, 0.3 + 0.55 * depth), 0.6);         // the body of the water
      const near = rgba(P.shallow, 0.3);                                         // looking down through it
      E.custom(ring, (g, sp, e) => {
        let top = Infinity, bot = -Infinity;
        for (const q of sp) { if (q[1] < top) top = q[1]; if (q[1] > bot) bot = q[1]; }
        M.traceRing(g, sp);
        const gr = g.createLinearGradient(0, top, 0, Math.max(top + 1, bot));
        gr.addColorStop(0, far); gr.addColorStop(0.55, mid); gr.addColorStop(1, near);
        g.fillStyle = gr; g.fill();
        if (e.fog.t > 0.015) { g.fillStyle = rgba(P.air, e.fog.t); g.fill(); }
      }, { layer: 1 });
      // glints: a light above and ahead of the camera, thrown back by any cell
      // whose normal happens to bisect the light and the eye
      const fwd = [Math.sin(c.yaw), 0, Math.cos(c.yaw)];
      const L = [fwd[0] * 0.55, 0.8, fwd[2] * 0.55], lm = Math.hypot(L[0], L[1], L[2]);
      L[0] /= lm; L[1] /= lm; L[2] /= lm;
      for (let j = 0; j < p.nz; j += 2) {                     // every other row: enough to sparkle
        const z = p.lo + j * p.dz, w = poolHalf(z) - 0.8, cx = centre(z);
        for (let i = 0; i < p.nx; i++) {
          const x = cx + (-1 + (2 * i) / (p.nx - 1)) * w + Math.sin(i * 3.1 + j * 1.7) * 0.6;
          if (!inPool(p, x, z)) continue;
          const y = waterY(p, x, z), N = waterNormal(p, x, z);
          const V = [c.x - x, c.y - y, c.z - z], vm = Math.hypot(V[0], V[1], V[2]) || 1;
          const Hh = [V[0] / vm + L[0], V[1] / vm + L[1], V[2] / vm + L[2]], hm = Math.hypot(Hh[0], Hh[1], Hh[2]) || 1;
          const spec = Math.pow(Math.max(0, (N[0] * Hh[0] + N[1] * Hh[1] + N[2] * Hh[2]) / hm), 90);
          if (spec < 0.08) continue;
          const len = 0.5 + spec * 1.2;
          E.line([[x - len, y + 0.03, z], [x + len, y + 0.03, z]], rgba(P.glint, Math.min(1, spec)), 0.045 + spec * 0.07, { layer: 1, bias: 2000, world: true });
        }
      }
      ring.push(ring[0]);                                     // the shore, where water meets rock: a hairline
      E.line(ring, rgba(P.glint, 0.4), 0.06, { layer: 1, bias: 2000, world: true });
    }
  }

  /* ── the rock ────────────────────────────────────────────────────────── */
  /** The stretch of corridor built this frame. It follows the CAMERA and the way
   *  it faces: the full depth ahead, a little behind, and when the body turns
   *  round the camera swings and "ahead" becomes the other way along z, so the
   *  dark never stands close behind waiting to be turned into. */
  const view = { z0: 0, z1: 0 };
  function viewRange() {
    const f = Math.cos(E.cam.yaw);                             // 1 facing +z, -1 facing -z
    const ahead = 30 + (SEEN - 30) * Math.max(0, f), behind = 30 + (SEEN - 30) * Math.max(0, -f);
    view.z0 = Math.min(me.z - 12, E.cam.z - behind);
    view.z1 = Math.max(me.z + 12, E.cam.z + ahead);
  }
  const backZ = () => view.z0, frontZ = () => view.z1;
  const span = (step) => [Math.floor(view.z0 / step) * step, view.z1];
  /** Detail falls off with distance: fewer SAMPLES where a body is small. Never
   *  its colour, ink or sheen: a rock that changed fill at a fixed distance was
   *  seen to jump as the camera approached. */
  const detailAt = (z) => { const far = Math.abs(z - E.cam.z); return far > 130 ? 0 : far > 70 ? 1 : 2; };
  /** How strongly a floor blob's outline shows: full near, gone by 110 units, continuously. */
  const inkFade = (z) => clamp((110 - Math.abs(z - E.cam.z)) / 60, 0, 1);

  function buildFloor() {
    const [z0, z1] = span(STEP);
    for (let z = z0; z < z1; z += STEP) {                     // the base: one strip, following the dish
      const P = pal(z + STEP / 2), pts = [];
      const cA = centre(z), cB = centre(z + STEP), wA = halfWidth(z) + 1, wB = halfWidth(z + STEP) + 1;
      for (let k = 0; k <= 4; k++) { const x = cA - wA + (2 * wA * k) / 4; pts.push([x, floorAt(x, z) - 0.3, z]); }
      for (let k = 4; k >= 0; k--) { const x = cB - wB + (2 * wB * k) / 4; pts.push([x, floorAt(x, z + STEP) - 0.3, z + STEP]); }
      E.face(pts, P.rockLo, null, 0, { layer: -1 });
    }
    const [b0, b1] = span(4);
    for (let z = b0; z < b1; z += 4) {                        // the blobs the floor is made of
      const P = pal(z), w = halfWidth(z), c = centre(z), lod = detailAt(z);
      const n = 4 + ((z / 4) & 1);
      for (let i = 0; i < n; i++) {
        const k = hash2(z, i), k2 = hash2(z, i + 9), k3 = hash2(z, i + 17);
        const u = -0.92 + (1.84 * (i + 0.5)) / n + (k - 0.5) * 0.3;
        const x = c + u * w, zz = z + (k2 - 0.5) * 3.5, r = 2.6 + k3 * 2.2;
        const pts = M.shapes.disc(x, zz, r, [6, 8, 10][lod], (px, pz) => floorAt(px, pz) + 0.06, (j) => 0.16 * Math.sin(j * 2.1 + k * 9));
        const fade = inkFade(z);
        E.organic(pts, P.floorSteps[Math.floor(k * 7.99)], fade > 0.02 ? rgba(P.ink, 0.3 * fade) : null, 0.7, { layer: 0, stable: true, bias: k * 0.4, inkPx: 9 });
      }
    }
  }

  function buildWalls() {
    const [z0, z1] = span(STEP);
    for (let z = z0; z < z1; z += STEP) {                     // the base, painted first: bias sets it back a strip
      const P = pal(z + STEP / 2);
      for (const side of [-1, 1]) {
        const xa = centre(z) + side * halfWidth(z), xb = centre(z + STEP) + side * halfWidth(z + STEP);
        E.face([[xa, floorAt(xa, z) - 0.3, z], [xa, roofAt(xa, z) + 0.3, z],
                [xb, roofAt(xb, z + STEP) + 0.3, z + STEP], [xb, floorAt(xb, z + STEP) - 0.3, z + STEP]],
               P.wall, null, 0, { layer: 2, bias: -STEP });
      }
    }
    const [l0, l1] = span(5);
    for (let z = l0; z < l1; z += 5) {                        // lobes of rock, three rows up each wall
      const P = pal(z), lod = detailAt(z);
      for (const side of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
          const k = hash2(z * side + 3, row), k2 = hash2(z * side + 3, row + 5);
          const zz = z + (k - 0.5) * 3, wx = centre(zz) + side * halfWidth(zz);
          const fl = floorAt(wx, zz), rf = roofAt(wx, zz);
          const h = lerp(fl, rf, (row + 0.5) / 3 + (k2 - 0.5) * 0.18);
          const rz = 2.6 + k * 2.4, ry = 2.2 + k2 * 2.2, rx = 1.2 + k * 1.4;
          const d = [[2, 5], [3, 6], [4, 8]][lod];
          const hi = P.wallHi[Math.floor(k2 * 7.99)], lo = P.wallLo;
          const fill = (g, bb) => { const gr = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h); gr.addColorStop(0, hi); gr.addColorStop(1, lo); return gr; };
          // a fixed order among neighbours (row, then alternate columns): by depth alone, stacked lobes swapped and flickered
          E.organic(M.shapes.ball(wx - side * rx * 0.55, h, zz, rx, ry, rz, d[0], d[1], false), fill, P.ink, 0.8, { layer: 2, inkPx: 7, bias: row * 0.6 + ((z / 5) & 1) * 0.3 });
        }
      }
    }
  }

  function buildRoof() {
    const [z0, z1] = span(STEP);
    for (let z = z0; z < z1; z += STEP) {
      const P = pal(z + STEP / 2), pts = [];
      const cA = centre(z), cB = centre(z + STEP), wA = halfWidth(z) + 1, wB = halfWidth(z + STEP) + 1;
      for (let k = 0; k <= 4; k++) { const x = cA - wA + (2 * wA * k) / 4; pts.push([x, roofAt(x, z) + 0.3, z]); }
      for (let k = 4; k >= 0; k--) { const x = cB - wB + (2 * wB * k) / 4; pts.push([x, roofAt(x, z + STEP) + 0.3, z + STEP]); }
      E.face(pts, P.roof, null, 0, { layer: 2, bias: -STEP });
    }
    const [l0, l1] = span(6);
    for (let z = l0; z < l1; z += 6) {                        // hanging lobes, and drips of stone
      const P = pal(z), lod = detailAt(z), w = halfWidth(z), c = centre(z);
      for (let i = 0; i < 2; i++) {
        const k = hash2(z + 11, i), k2 = hash2(z + 11, i + 4);
        const x = c + (-0.45 + 0.9 * i + (k - 0.5) * 0.4) * w, zz = z + (k2 - 0.5) * 4;
        const top = roofAt(x, zz), rx = 2.5 + k * 2, ry = 1.8 + k2 * 1.4, rz = 2.5 + k2 * 2;
        const d = [[2, 5], [3, 6], [3, 7]][lod];
        E.organic(M.shapes.ball(x, top + ry * 0.45, zz, rx, ry, rz, d[0], d[1], false),
          P.roofSteps[Math.floor(k * 7.99)], P.ink, 0.7, { layer: 2, inkPx: 7 });
      }
      const k3 = hash2(z + 29, 1);
      if (k3 < 0.55) {
        const x = c + (k3 * 2 - 0.55) * (w - 3), zz = z + 2, top = roofAt(x, zz);
        E.organic(M.shapes.drip(x, top + 0.2, zz, 0.6 + k3 * 0.8, 2 + hash2(z + 29, 2) * 4.5, lod ? 7 : 5),
          P.rock, P.ink, 1, { layer: 2, inkPx: 4 });
      }
    }
  }

  /** The two real creases of the room, softly: where wall meets floor and roof. */
  function buildCreases() {
    const [z0, z1] = span(4), P = pal(me.z + 40);
    for (const side of [-1, 1]) {
      const foot = [], head = [];
      for (let z = z0; z < z1; z += 4) {
        const x = centre(z) + side * halfWidth(z);
        foot.push([x, floorAt(x, z) + 0.05, z]);
        head.push([x, roofAt(x, z) - 0.05, z]);
      }
      E.line(foot, rgba(P.ink, 0.6), 0.42, { layer: 2, world: true, maxPx: 3 });
      E.line(head, rgba(P.ink, 0.45), 0.34, { layer: 2, world: true, maxPx: 2.5 });
    }
  }

  /* ── what stands in the cave: a registry of props ────────────────────── */
  /** @type {Record<string, {chance:number, edge?:number, maxDark?:number, make:(x:number,z:number,r:number[])=>object, build:(q:any,P:any,lod:number)=>void}>} */
  const KINDS = {};
  const PROPS = [];
  /** Push the body out of anything solid it has walked into. Each kind gives
   *  the radius of what it stands on; a mound and a boulder hold the body off,
   *  moss and a vine do not. */
  function collide(b) {
    for (const q of PROPS) {
      const d = KINDS[q.kind];
      if (!d.solid || Math.abs(q.z - b.z) > 14) continue;
      const r = d.solid(q) + b.R * 0.8;
      const dx = b.x - q.x, dz = b.z - q.z, dist = Math.hypot(dx, dz);
      if (dist >= r) continue;
      if (dist < 1e-4) { b.x = q.x + r; continue; }
      b.x = q.x + (dx / dist) * r; b.z = q.z + (dz / dist) * r;
    }
  }
  function defineProp(name, def) { KINDS[name] = def; }
  /** Scatter the props once, from the index alone, so nothing ever moves. */
  function populate() {
    PROPS.length = 0;
    const names = Object.keys(KINDS);
    for (let i = 0; i < 260; i++) {
      const z = 30 + i * 10 + hash(i) * 8;
      if (z > END - 20) break;
      if (poolAt(z)) continue;                                // nothing stands in the water
      const w = halfWidth(z), c = centre(z), dark = darkAt(z);
      const r = [hash(i * 3 + 1), hash(i * 3 + 2), hash(i * 3 + 3)];
      const x = c + (r[0] * 2 - 1) * (w - 4), edge = Math.abs(x - c) / w;
      let acc = 0;
      for (const name of names) {
        const d = KINDS[name];
        if (r[1] >= acc && r[1] < acc + d.chance) {
          if ((d.edge == null || edge > d.edge) && (d.maxDark == null || dark < d.maxDark)) {
            PROPS.push(Object.assign({ kind: name, x, z }, d.make(x, z, r)));
          }
          break;
        }
        acc += d.chance;
      }
    }
  }
  function buildProps() {
    for (const q of PROPS) {
      if (q.z < backZ() || q.z > frontZ()) continue;
      KINDS[q.kind].build(q, pal(q.z), detailAt(q.z));
    }
  }
  const gelSheen = (g, ring, bb) => {                        // the gel sheen the dwellings wear
    g.save(); M.traceRing(g, ring); g.clip();
    g.globalAlpha = 0.26; g.fillStyle = "#fff";
    g.beginPath(); g.ellipse(bb.x + bb.w * 0.34, bb.y + bb.h * 0.24, bb.w * 0.2, bb.h * 0.12, -0.5, 0, TAU); g.fill();
    g.restore();
  };
  defineProp("boulder", { chance: 0.28, edge: 0.42, solid: (q) => q.r,
    make: (x, z, r) => ({ r: 1.6 + r[2] * 2.6, s: 0.5 + r[0] * 0.5 }),
    build(q, P, lod) {
      const y = floorAt(q.x, q.z), d = [[3, 6], [4, 8], [5, 10]][lod];
      E.organic(M.shapes.ball(q.x, y + q.r * q.s * 0.9, q.z, q.r, q.r * q.s, q.r * 0.92, d[0], d[1], false),
        (g, bb) => { const gr = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h); gr.addColorStop(0, P.rockHi); gr.addColorStop(1, P.rockLo); return gr; },
        P.ink, 1, { layer: 2 });
    } });
  defineProp("mound", { chance: 0.16, edge: 0.5, maxDark: 0.5, solid: (q) => q.r * 0.95,
    make: (x, z, r) => ({ r: 1.7 + r[2] * 1.6, h: 2.4 + r[0] * 3.4 }),
    build(q, P, lod) {
      const y = floorAt(q.x, q.z), d = [[3, 7], [4, 9], [6, 12]][lod];
      E.organic(M.shapes.ball(q.x, y, q.z, q.r, q.h, q.r, d[0], d[1], true),
        (g, bb) => { const gr = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h); gr.addColorStop(0, P.gel); gr.addColorStop(1, P.gelLo); return gr; },
        P.ink, 1.2, { layer: 2, after: gelSheen });
    } });
  defineProp("bulb", { chance: 0.1, edge: 0.45, solid: () => 0.45,
    make: (x, z, r) => ({ r: 0.5 + r[2] * 0.5, up: 1.4 + r[0] * 2.2, lean: (r[1] - 0.5) * 0.8 }),
    build(q, P, lod) {
      const y = floorAt(q.x, q.z), top = y + q.up, tx = q.x + q.lean;
      E.line([[q.x, y, q.z], [q.x + q.lean * 0.3, y + q.up * 0.5, q.z], [tx, top, q.z]], P.vine, 0.26, { layer: 2, world: true });
      E.organic(M.shapes.ball(tx, top + q.r, q.z, q.r, q.r, q.r, 3, 6, false), P.glow, rgba(P.ink, 0.7), 1,
        { layer: 2, inkPx: 3, after: (g, ring, bb) => {                      // a halo: a gradient, never a blur
          const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, r = Math.max(bb.w, bb.h) * 1.6;
          const gr = g.createRadialGradient(cx, cy, bb.w * 0.3, cx, cy, r);
          gr.addColorStop(0, rgba(P.glow, 0.35)); gr.addColorStop(1, rgba(P.glow, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
        } });
    } });
  defineProp("moss", { chance: 0.18, edge: 0.3, maxDark: 0.72,
    make: (x, z, r) => ({ r: 2.4 + r[2] * 3.2, k: r[0] }),
    build(q, P, lod) {
      E.organic(M.shapes.disc(q.x, q.z, q.r, [6, 9, 12][lod], (px, pz) => floorAt(px, pz) + 0.12, (j) => 0.25 * Math.sin(j * 2.3 + q.k * 7)),
        P.moss, P.ink, 0.8, { layer: 0, stable: true, bias: 1, inkPx: 6 });
    } });
  defineProp("vine", { chance: 0.2, maxDark: 0.92,
    make: (x, z, r) => ({ drop: 4 + r[2] * 8, k: r[0], leaves: 2 + Math.floor(r[1] * 2) }),
    build(q, P, lod) {
      const top = roofAt(q.x, q.z), sway = reduce ? 0 : Math.sin(E.t * 0.7 + q.z * 0.1) * 0.7;
      const pts = [];
      for (let i = 0; i <= 4; i++) { const f = i / 4; pts.push([q.x + sway * f * f + Math.sin(f * 5 + q.k * 6) * 0.3, top - q.drop * f, q.z]); }
      E.line(pts, P.vine, 0.3, { layer: 2, world: true });
      if (P.t < 0.85) {
        for (let i = 1; i <= q.leaves; i++) {
          const f = i / (q.leaves + 1), p = pts[Math.min(4, Math.floor(f * 4))];
          const lx = p[0] + 0.8, ly = top - q.drop * f;
          E.organic([[lx - 0.7, ly + 0.2, q.z], [lx + 0.6, ly + 0.5, q.z + 0.3], [lx + 1.3, ly - 0.1, q.z], [lx + 0.5, ly - 0.55, q.z - 0.3]], P.leaf, rgba(P.ink, 0.6), 0.8, { layer: 2, inkPx: 3, minPx: 1 });
        }
      }
    } });
  populate();

  /* ── who lives here ──────────────────────────────────────────────────── */
  /** @type {{step?:(dt:number)=>void, build:()=>void}[]} */
  const CREATURES = [];
  function addCreature(c) { CREATURES.push(c); return c; }

  const GEL = { light: "#B0D6C0", mid: "#4FA373", dark: "#3A7955", ink: "#1f3a1a" };   // the brand slime
  /** The body's surface, in the world: a dome whose underside takes the
   *  ground's shape, squashed by the idle breath and drawn out when it hurries. */
  function bodyPoints() {
    const R = me.R, sq = reduce ? 0 : Math.sin(E.t * 3.2) * 0.09;
    const rush = clamp(Math.abs(me.speed) / 34, 0, 1);
    const rx = R * (1 + sq), ry = R * (1 - sq * 0.7) * (1 + rush * 0.12);
    const out = [], ROWS = 8, COLS = 16;
    for (let i = 0; i <= ROWS; i++) {
      const a = (Math.PI / 2) * (i / ROWS), lean = Math.sin(a) * rush * 0.5;
      for (let j = 0; j < COLS; j++) {
        const t = TAU * (j / COLS);
        const x = me.x + Math.sin(a) * Math.cos(t) * rx - Math.sin(me.yaw) * lean;
        const z = me.z + Math.sin(a) * Math.sin(t) * rx - Math.cos(me.yaw) * lean;
        const base = floorAt(x, z) + 0.05;
        out.push([x, i === ROWS ? base : Math.max(base, me.y + me.bob + Math.cos(a) * ry), z]);
      }
    }
    return out;
  }
  /** The eye, at the brand's proportions (slime-2d.js, engine.js's avatar):
   *  radius 3.5/13 of the body's, pupil 1.8/13, sitting six tenths of the way
   *  up the dome, on the front. From behind it is out of sight, as it should
   *  be. In a reflection (M) it is flipped through the water with the body's
   *  points, so the pool shows it exactly when a mirror would. */
  function eye(g, bb, M, base) {
    const R = me.R, cy0 = me.y + me.bob;
    const EL = Math.acos(0.6);                                  // six tenths of the dome's height
    // The eye faces the way the body is heading, in the pool as on the body:
    // a reflection is the same eye flipped through the water, so from behind
    // the pool shows none, and it shows when the body turns toward the camera.
    const az = me.yaw;
    let nx = Math.sin(az) * Math.sin(EL), ny = Math.cos(EL), nz = Math.cos(az) * Math.sin(EL);
    let px = me.x + nx * R * 0.97, py = cy0 + ny * R * 0.97, pz = me.z + nz * R * 0.97;
    if (M) { py = E.mirrorPoint(M, [px, py, pz], base)[1]; ny = -ny; }   // the same flip the body's points get
    const v = E.view([px, py, pz]);
    if (v[2] <= E.near) return;
    const tc = [E.cam.x - px, E.cam.y - py, E.cam.z - pz], tm = Math.hypot(tc[0], tc[1], tc[2]) || 1;
    const facing = (nx * tc[0] + ny * tc[1] + nz * tc[2]) / tm;
    if (facing < 0.02) return;
    const p = E.screen(v), k = E.fov / v[2];                    // world units to pixels here
    const r = R * (3.5 / 13) * k, squeeze = clamp(0.35 + facing * 0.65, 0.35, 1);   // foreshortened at the edge
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(p[0], p[1], r * squeeze, r * 0.96, 0, 0, TAU); g.fill();
    g.lineWidth = Math.max(0.8, R * (1.3 / 13) * k); g.strokeStyle = GEL.ink; g.stroke();
    g.fillStyle = GEL.ink; g.beginPath(); g.ellipse(p[0], p[1] + r * 0.08, R * (1.8 / 13) * k * squeeze, R * (1.8 / 13) * k, 0, 0, TAU); g.fill();
  }
  function buildPlayer() {
    const pts = bodyPoints(), R = me.R;
    E.organic(M.shapes.disc(me.x, me.z, R * 1.05, 12, (x, z) => floorAt(x, z) + 0.08), "rgba(0,0,0,0.22)", null, 0, { layer: 0, stable: true, bias: 9, inkPx: 1e9 });
    if (me.pool && me.ripple > 0.02) {                        // ripples spreading from where it wades
      const lv = (x, z) => waterY(me.pool, x, z) + 0.03, glint = pal(me.z).glint;
      for (const off of [0, 0.5]) {
        const f = (me.ripple + off) % 1, rr = R * (1.1 + f * 2.2), a = (1 - f) * 0.5 * Math.min(1, me.ripple * 4);
        let run = [];                                         // only the arcs that lie on water: a ripple stops at the shore
        for (let j = 0; j <= 20; j++) {
          const t = TAU * (j / 20), x = me.x + Math.cos(t) * rr, z = me.z + Math.sin(t) * rr;
          if (inPool(me.pool, x, z)) run.push([x, lv(x, z), z]);
          else if (run.length) { if (run.length > 1) E.line(run, rgba(glint, a), 0.05, { layer: 1, bias: 2000, world: true }); run = []; }
        }
        if (run.length > 1) E.line(run, rgba(glint, a), 0.05, { layer: 1, bias: 2000, world: true });
      }
    }
    E.organic(pts, (g, bb) => {
      const gr = g.createRadialGradient(bb.x + bb.w * 0.34, bb.y + bb.h * 0.22, 1, bb.x + bb.w * 0.5, bb.y + bb.h * 0.55, Math.max(bb.w, bb.h) * 0.78);
      gr.addColorStop(0, GEL.light); gr.addColorStop(0.5, GEL.mid); gr.addColorStop(1, GEL.dark);
      return gr;
    }, GEL.ink, 1.3, { layer: 2, bias: 1.5, inkPx: 2, after: (g, ring, bb, sp, e) => {
      const mirror = e && e.it.o && e.it.o.mirrorOf;         // drawn again in a pool: mirrored
      g.save(); M.traceRing(g, ring); g.clip();                // the gel sheen, inside the outline
      g.globalAlpha = 0.34; g.fillStyle = "#fff";
      g.beginPath(); g.ellipse(bb.x + bb.w * 0.34, bb.y + bb.h * (mirror ? 0.8 : 0.2), bb.w * 0.2, bb.h * 0.12, mirror ? 0.5 : -0.5, 0, TAU); g.fill();
      g.restore();
      if (me.pool && !mirror) {                               // the part below the waterline, seen through the water
        const lv = waterY(me.pool, me.x, me.z), wet = [];
        for (let i = 0; i < pts.length; i++) if (pts[i][1] <= lv + 0.15 && sp[i]) wet.push(sp[i]);
        const h = M.hull(wet);
        if (h.length > 2) { g.save(); M.traceRing(g, ring); g.clip(); M.traceRing(g, h); g.fillStyle = pal(me.z).water; g.fill(); g.restore(); }
      }
      eye(g, bb, mirror || null, mirror ? e.it.o.mirrorBase : 0);
    } });
  }
  addCreature({ build: buildPlayer });

  /** Motes: the dark half's drifting lights, the fireflies of the night skin. */
  const MOTES = [];
  for (let i = 0; i < 36; i++) {
    const z = DARK_FROM - 40 + hash(i + 500) * (END - DARK_FROM);
    MOTES.push({ z, u: hash(i + 600) * 1.6 - 0.8, h: 0.25 + hash(i + 700) * 0.5, ph: hash(i + 800) * TAU });
  }
  addCreature({ build() {
    for (const m of MOTES) {
      if (m.z < backZ() || m.z > frontZ()) continue;
      const t = reduce ? 0 : E.t, z = m.z + Math.sin(t * 0.23 + m.ph) * 3;
      const x = centre(z) + (m.u + Math.sin(t * 0.31 + m.ph * 2) * 0.12) * halfWidth(z);
      const y = lerp(floorAt(x, z) + 3, roofAt(x, z) - 3, m.h + Math.sin(t * 0.4 + m.ph) * 0.08);
      const P = pal(z), pulse = reduce ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + m.ph * 3));
      E.billboard([x, y, z], (g, sx, sy, k, e) => {
        const a = pulse * (1 - e.fog.t), r = Math.max(1.2, 0.5 * k);
        g.fillStyle = rgba(P.glow, a * 0.3); g.beginPath(); g.arc(sx, sy, r * 3.2, 0, TAU); g.fill();
        g.fillStyle = rgba("#e8fff6", a); g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
      }, { layer: 2 });
    }
  } });
  function buildCreatures() { for (const c of CREATURES) c.build(); }

  /* ── words, if any: a plaque in the skins' sign format, on a post ────── */
  /** @type {{x:number, z:number, y?:number, text:string, sub?:string}[]} */
  const SIGNS = [];
  function addSign(s) { SIGNS.push(s); return s; }
  const SIGN_FONT = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
  function buildSigns() {
    for (const s of SIGNS) {
      if (s.z < backZ() || s.z > frontZ()) continue;
      const P = pal(s.z), floor = floorAt(s.x, s.z), y = s.y == null ? floor + 6 : s.y;
      E.line([[s.x, floor, s.z], [s.x, y - 0.6, s.z]], P.boardInk, 0.24, { layer: 2, world: true });
      E.billboard([s.x, y, s.z], (g, sx, sy, k, e) => {
        const px = clamp(k * 1.15, 7, 26);
        g.font = "700 " + px.toFixed(1) + "px " + SIGN_FONT;
        const tw = g.measureText(s.text).width, w = tw + px * 1.6, h = px * (s.sub ? 2.9 : 1.9);
        const x0 = sx - w / 2, y0 = sy - h / 2;
        g.globalAlpha = 1 - e.fog.t;
        M.leafPath(g, x0, y0, w, h); g.fillStyle = P.board; g.fill();
        g.lineWidth = Math.max(1, px * 0.1); g.strokeStyle = P.boardInk; g.stroke();
        g.fillStyle = P.text; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(s.text, sx, s.sub ? y0 + px * 1.05 : sy);
        if (s.sub) { g.font = "400 " + (px * 0.72).toFixed(1) + "px " + SIGN_FONT; g.fillText(s.sub, sx, y0 + px * 2.1); }
        g.globalAlpha = 1;
      }, { layer: 2, bias: 2 });
    }
  }

  /* ── the walk, and the camera behind it ──────────────────────────────── */
  const C = E.controls(cv, { dist: 58, minDist: 16, maxDist: 150 });
  /** Where a click sends the body. The ray through the screen point is
   *  marched to whatever it meets first, floor, wall or roof, and the place
   *  under that is the goal; a click into open air ahead means "that way". The
   *  goal is then kept inside the walkable band and pushed out of anything
   *  solid, so every click has somewhere reachable to go. */
  function floorHit(sx, sy) {
    const [o, d] = E.ray(sx, sy);
    let hit = null;
    for (let t = 2; t < 400; t += 1.5) {
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
      if (z < 6 || z > END - 10) break;
      if (y <= floorAt(x, z) || y >= roofAt(x, z) || Math.abs(x - centre(z)) > halfWidth(z)) { hit = { x, z }; break; }
    }
    if (!hit) {
      if (Math.hypot(d[0], d[2]) < 0.2) return null;           // straight up or down: nowhere
      const t = 40;
      hit = { x: o[0] + d[0] * t, z: clamp(o[2] + d[2] * t, 6, END - 10) };
    }
    const lim = halfWidth(hit.z) - 6.5;
    hit.x = centre(hit.z) + clamp(hit.x - centre(hit.z), -lim, lim);
    const body = { x: hit.x, z: hit.z, R: me.R };
    collide(body);                                            // not inside a rock
    return { x: body.x, z: body.z };
  }
  C.onTap = (sx, sy) => { const h = floorHit(sx, sy); if (h) { me.goal = h; me.goalBest = Infinity; me.stuck = 0; } };
  let boom = 0;
  function step(dt) {
    const k = C.keys;
    let turn = (k.right ? 1 : 0) - (k.left ? 1 : 0), want = (k.fwd ? 1 : 0) - (k.back ? 1 : 0);
    if (turn || want) me.goal = null;                          // the keys take over from a click
    if (me.goal) {                                             // walk to where the click landed
      const dx = me.goal.x - me.x, dz = me.goal.z - me.z, dist = Math.hypot(dx, dz);
      // arrived, or blocked: a goal that stops getting nearer is given up
      // rather than circled forever, which would look like a lost body
      if (dist < me.goalBest - 0.08) { me.goalBest = dist; me.stuck = 0; } else me.stuck += dt;   // creeping round a rock is not progress
      if (dist < 2.2 || me.stuck > 1.2) me.goal = null;
      else {
        let dy = Math.atan2(dx, dz) - me.yaw;
        while (dy > Math.PI) dy -= TAU;
        while (dy < -Math.PI) dy += TAU;
        turn = clamp(dy * 3, -1, 1);
        want = Math.abs(dy) < 1.2 ? 1 : 0;
      }
    }
    me.yaw += turn * dt * 1.9;
    const top = k.fast ? 34 : 17;
    me.speed += ((want * top) - me.speed) * Math.min(1, dt * 6);
    me.pool = poolAt(me.z);
    if (me.pool && !inPool(me.pool, me.x, me.z)) me.pool = null;   // in the basin but on its dry shoulder
    if (Math.abs(me.speed) > 0.01) {
      const wet = me.pool ? 0.55 : 1;                          // water slows it, as everywhere on the site
      if (me.pool && Math.abs(me.speed) > 3) disturb(me.pool, me.x, me.z, me.speed * 0.05);
      if (me.pool) me.ripple = (me.ripple + dt * 0.9) % 1;    // the rings spread while it wades
      me.x += Math.sin(me.yaw) * me.speed * dt * wet;
      me.z = clamp(me.z + Math.cos(me.yaw) * me.speed * dt * wet, 6, END - 10);
      collide(me);                                            // the rocks are solid
      const lim = halfWidth(me.z) - 6.5, off = me.x - centre(me.z);
      if (Math.abs(off) > lim) me.x = centre(me.z) + Math.sign(off) * lim;   // the walls hold it in
      me.bob = reduce ? 0 : Math.abs(Math.sin(E.t * 7)) * 0.3 * clamp(Math.abs(me.speed) / 17, 0, 1);
    } else { me.bob = 0; if (me.pool) me.ripple = me.ripple > 0.02 ? (me.ripple + dt * 0.9) % 1 : 0; }
    if (!me.pool) me.ripple = 0;
    me.y = floorAt(me.x, me.z);
    for (const c of CREATURES) if (c.step) c.step(dt);
    stepWater(dt);
    boom = E.follow(me, { dist: C.dist, height: Math.min(C.dist * 0.3, headroom(me.z) * 0.45), aim: 3.4,
      look: C.look, tilt: C.tilt, inside, ease: reduce ? 60 : 5, step: 2, minDist: 6 });
  }
  function sky() {
    const P = pal(me.z + 30), g = E.g, gr = g.createLinearGradient(0, 0, 0, E.H);
    gr.addColorStop(0, P.airFar); gr.addColorStop(1, P.air);
    g.fillStyle = gr; g.fillRect(0, 0, E.W, E.H);
  }
  const LAYERS = [buildFloor, buildWalls, buildRoof, buildCreases, buildWater, buildProps, buildCreatures, buildSigns];
  const hud = document.getElementById("hud");
  let fps = 60;
  E.run((dt) => {
    step(dt);
    E.stableSign = Math.cos(E.cam.yaw) >= 0 ? 1 : -1;        // which way along z is "far" for the floor's sort
    viewRange();
    E.begin(); sky();
    for (const L of LAYERS) L();
    E.paint();
    if (debug && hud) {
      fps = fps * 0.92 + 0.08 / Math.max(0.001, dt);
      hud.hidden = false;
      hud.textContent = Math.round(fps) + " fps · " + E.tally.drawn + " of " + E.tally.items + " drawn · boom " + boom.toFixed(0);
    }
  });

  /* ── for probes and for whatever page picks this up ──────────────────── */
  function bodyBox() {
    const sp = bodyPoints().map(E.project).filter(Boolean);
    if (!sp.length) return null;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const q of sp) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
    return { x: Math.round(a), y: Math.round(c), w: Math.round(b - a), h: Math.round(d - c), n: sp.length, W: E.W, H: E.H };
  }
  window.MH_SLIME3D = {
    me, cam: E.cam, engine: E, controls: C, pools: POOLS, end: END, darkFrom: DARK_FROM,
    floorAt, roofAt, centre, halfWidth, darkAt, headroom, inside, waterY, waterNormal, shoreline, inPool, pal, collide,
    dist: (v) => (v == null ? C.dist : (C.dist = v)), boom: () => boom, floorHit,
    tick: (dt) => E.tick(dt), pause: E.pause, resume: E.resume, bodyBox, tally: E.tally,
    props: () => PROPS.length, propList: PROPS, kinds: KINDS, defineProp, repopulate: populate,
    creatures: CREATURES, addCreature, signs: SIGNS, addSign, layers: LAYERS,
  };
})();
