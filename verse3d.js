// @ts-check
"use strict";
/* ============================================================================
   verse3d.js  ·  MH_VERSE3D  ·  the slimeverse in three dimensions: a runtime
   ----------------------------------------------------------------------------
   engine-3d.js (MH_3D) is the renderer; slimeverse3d.html is the site's page for it;
   slime3d.js is its first world, one cave. This file is what several worlds
   share, so a scene only has to say where its ground is and what stands on it:

     the slime      the brand body over whose shoulder the camera rides: its
                    dome takes the ground's shape, its eye faces where it goes,
                    it wades, it is mirrored by any pool it stands over
     the camera     E.follow, kept out of rock and out of anything tall
     solids         everything that stands up: the scene's solids, sign posts,
                    and every creature, solid to each other and to the slime
     water          pools in the scene's basins: a height field the slime and
                    the creatures stir, a sheet bounded by the marched
                    shoreline, glints, and reflections (E.mirror)
     shoggoths      design C of shoggoth-proposals, the iridescent bulk: a
                    protoplasmic mass whose eyes open and sink back in, an
                    oil-slick sheen, tentacles and no mouth. They hunt zoogs.
                    Where a scene roots one (dormant) it anchors and half-lids.
     zoogs          design E of prey-proposals: low furtive tufts, three or four
                    eyes, in knots. They graze, bound, and flee a shoggoth or
                    the slime; one that is caught comes back later elsewhere.
     motes          drifting lights, where a scene is dark
     portals        a door or a well: walk into it and the next scene loads,
                    through a short fade, at the entry it names; or, with
                    `open`, the host page's onOpen(open) shows a menu or a page. A way with
                    `back` is remembered, so the next place's way out (entry
                    "back") returns to that very door
     the torus      a scene with `period` repeats, as the iso world does
     open water     a scene with `sea: { level }` has lakes wherever its
                    ground lies under that level
     signs          a plaque in the skins' sign format on a post

   A SCENE is registered with defineScene(id, { name, setup(ctx) }) and setup
   returns: floorAt(x, z), ceilAt (or null, under the sky), pal(x, z) (keys
   air, ink, water, shallow, deep, glint), walkable(x, z), bound(body),
   open(x, y, z) (where a camera may stand), seen (how far it draws), build()
   (its ground and props, every frame), sky(g), and optionally fog(p, depth),
   pools [{ x, z, rx, rz, depth }], solids [{ x, z, r, h, dome, radAt(up) }], entries
   { name: { x, z, yaw } }, portals [{ x, z, r, to, entry }], signs, life
   { zoogs, shoggoths, dormant, spot(rand), night(x, z), motes }, and camera
   { dist, height(x, z) }, fogFrom (where the fog starts; it is whole at
   0.94 of seen), pal().sky for water open to the sky, and waterPhoto
   { tint, over } to lay the water photo under its deep pools. ctx carries the engine, the slime, the hashes, and
   helpers for distance, detail and the water.

   One scene runs at a time, and a scene that is not showing costs nothing:
   its creatures and water wait where they were until it is entered again.
   ========================================================================== */
(function () {
  const M = window.MH_3D;
  if (!M) return;
  const { clamp, lerp, TAU, mix, rgba } = M;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hash2 = (a, b) => hash(a * 7.13 + b * 131.7);
  const SCENES = {};
  function defineScene(id, def) { SCENES[id] = def; }

  /* the palettes the creatures keep wherever they are: the brand slime, and
     the day and night colours ecology.js gives the zoogs and the shoggoths */
  const GEL = { light: "#B0D6C0", mid: "#4FA373", dark: "#3A7955", ink: "#1f3a1a" };
  const ZOOG = {
    day: { body: "#d9c79a", deep: "#a8916a", pale: "#f2e7c8", eye: "#2a2118", ink: "#26321f" },
    night: { body: "#8f8a72", deep: "#4a4636", pale: "#c3bb9a", eye: "#e8dfc0", ink: "#14160f" },
  };
  const SHOG = {
    day: { body: "#2b2a34", deep: "#141318", sheen: "#c890ff", eye: "#ffcf3a" },
    night: { body: "#1d2228", deep: "#0a0d10", sheen: "#5fe0c8", eye: "#ffb24a" },
    dormant: { body: "#46303a", deep: "#2a1c22", sheen: null, eye: "#7c5f2c" },
  };
  const SHOG_INK = "#141217";

  /* ── the one photograph ──────────────────────────────────────────────────
     The iso lakes are filled with a photo of real water (water.webp at the
     site root, engine.js ensureWaterImg). Deep water here shows the same
     photo under its colour, so the three views share it, and so the water
     reads as something seen rather than drawn. Used sparingly: deep pools
     only, never the ground or the creatures. A page that cannot load it gets
     the drawn water it had before.                                          */
  const PHOTO = { img: /** @type {HTMLImageElement|null} */ (null), ready: false, patCtx: /** @type {any} */ (null),
    mips: /** @type {HTMLCanvasElement[]|null} */ (null), pats: /** @type {any[]} */ ([]) };
  /** The photo at the size it is drawn: a pattern shrinks the full photo with no
   *  smaller copies to read from, and aliased into a fine hatch on the water. So
   *  the pattern is made from the copy (each half the last) nearest in size.
   *  Returns [pattern, that copy's width over the photo's]. */
  function photoPattern(g, shownW) {
    const img = /** @type {HTMLImageElement} */ (PHOTO.img);
    if (!PHOTO.mips) {
      PHOTO.mips = [];
      let src = /** @type {CanvasImageSource} */ (img), w = img.width, h = img.height;
      for (let L = 0; L < 6 && w >= 8; L++) {
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d")); c.imageSmoothingQuality = "high"; c.drawImage(src, 0, 0, w, h);
        PHOTO.mips.push(cv); src = cv; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
      }
    }
    if (PHOTO.patCtx !== g) { PHOTO.pats = []; PHOTO.patCtx = g; }
    let L = 0;
    while (L < PHOTO.mips.length - 1 && PHOTO.mips[L + 1].width >= shownW) L++;
    if (!PHOTO.pats[L]) PHOTO.pats[L] = g.createPattern(PHOTO.mips[L], "repeat");
    return [PHOTO.pats[L], PHOTO.mips[L].width / img.width];
  }
  const PHOTO_W = 26;                                          // world units one copy of the photo spans on the water
  (function loadPhoto() {
    if (typeof Image === "undefined") return;
    const here = (document.currentScript && document.currentScript.src) || location.href;
    const img = new Image();
    img.onload = () => { PHOTO.ready = true; };
    img.src = new URL("water.webp", here).href;             // beside this file, at the site root
    PHOTO.img = img;
  })();

  /* ── one size for each thing, in every view ─────────────────────────────
     The site draws the same world three ways: the isometric village
     (engine.js and the skins), the sidescroller, and these 3D places. So that
     a zoog or a dwelling is recognisably the same object in each, its size is
     kept here ONCE, in the unit every view already has: the slime's own radius
     (13 px in the iso world, UNIT world units here). Two numbers per thing:

       w   half-width, slime radii            h   height, slime radii

     The shape is the ratio h / w, and it must match the iso drawing closely.
     The scale is w, and it must match too, unless the entry says `enter`: a
     building the slime can walk into has to hold a room, so every enterable
     building is drawn ENTER times its iso size, all by the same factor, which
     keeps them in proportion to one another. The iso numbers were measured
     from the skins' own painters, and brand/backstage/probes/__scale.html
     measures them again, and what each 3D place actually draws, and fails
     when a drawing drifts from this table.                                  */
  const UNIT = 3.1;                                            // the slime's radius, in world units
  const ENTER = 1.9;                                           // how much bigger an enterable building is than its icon
  const SIZES = {
    slime:    { w: 1, h: 1, iso: "engine.js defPaintAvatar, r = 13 px" },
    zoog:     { w: 0.46, h: 0.46, iso: "ecology.js drawGrazer: the tuft and its eyes, 0.62 of R = 9 px" },
    shoggoth: { w: 1.27, h: 2.0, iso: "ecology.js drawPredator: the mass alone, R = 16 px, its middle 12 px up" },
    dwelling: { w: 2.4, h: 4.4, enter: true, iso: "theme-technurture.js paintKiosk: the gel mound, ww 27 to 36, hh 48 to 66 px" },
  };
  /** A size in world units: { w, h } half-width and height, with the
   *  enterable factor applied where it belongs. */
  /** The iso world's shape, for a place that is the iso world walked in 3D:
   *  its tile in world units (the iso tile is 5.2 slime radii across the
   *  ground; 16 units is 5.16), its torus in tiles (technurture's
   *  worldPeriod), and its plaza, kiosk ring and spur step in tiles, and how
   *  far a road-house stands to the side of its road, alternate houses on
   *  alternate sides (engine.js DEFAULTS, rebuildSpurs and SPUR_SIDE).
   *  probes/__scale.html checks them. */
  const ISO = { tile: 16, period: 58, hub: 3.1, ring: 3.5, spur: 2.5, side: 1 };
  const size = (name) => { const s = SIZES[name], k = UNIT * (s.enter ? ENTER : 1); return { w: s.w * k, h: s.h * k }; };
  /** The dwelling's outline, from the iso painter's own curve (paintKiosk):
   *  from the base at half-width 1 it bulges to 1.12 near half height and
   *  closes to the crown. Returns the half-width at height f (0 to 1) of its
   *  height, in units of the base half-width, on the side that faces out. */
  const DWELL = (() => {
    const rows = [];
    for (let i = 0; i <= 64; i++) {                            // the bezier (-1,0) (-1.12,0.55) (-0.7,1) (0,1), sampled
      const t = i / 64, u = 1 - t;
      rows.push([u * u * u * 1 + 3 * u * u * t * 1.12 + 3 * u * t * t * 0.7, 3 * u * u * t * 0.55 + 3 * u * t * t + t * t * t]);
    }
    return (f) => {
      if (f <= 0) return 1;
      for (let i = 1; i < rows.length; i++) if (rows[i][1] >= f) {
        const a = rows[i - 1], b = rows[i], k = (f - a[1]) / Math.max(1e-6, b[1] - a[1]);
        return a[0] + (b[0] - a[0]) * k;
      }
      return 0;
    };
  })();

  function create(canvas, opts) {
    opts = opts || {};
    // the lens: from the height, as the engine's own, unless the window is narrow
    // (a phone held upright), where the height's lens saw a sliver and the slime
    // filled the screen; there the width sets it too
    const E = M.create(canvas, { fov: (w, h) => Math.max(300, Math.min(h * 1.05, w * 1.2)) });
    const reduce = E.reduce;
    /** @type {any} */
    let S = null, id = "";
    let pools = [], zoogs = [], shogs = [], motes = [];
    const states = {};
    /** Where each place was last entered from by a remembered way: { scene: { at } }. */
    const backs = {};
    const stats = { eaten: 0 };
    const me = { kind: "slime", x: 0, z: 0, y: 0, yaw: 0, speed: 0, bob: 0, R: UNIT, pool: null, ripple: 0,
      goal: /** @type {null|{x:number,z:number}} */ (null), goalBest: Infinity, stuck: 0 };

    /* ── an endless world: the torus ─────────────────────────────────────
       A scene that sets `period` (world units) repeats every period in x and
       z, as the iso world does: walk far enough and the plaza comes round
       again. Everything fixed (ground, houses, plants, solids) lives once, in
       [-period/2, period/2); it is drawn at its copy nearest the camera
       (img), and distances are taken the short way round (wrapD). The slime
       and the camera are moved back a whole period when they cross the seam,
       and the creatures are kept at their copies nearest the slime.        */
    let PER = 0;
    const wrapD = (d) => (PER ? d - PER * Math.round(d / PER) : d);
    const img = (v, ref) => ref + wrapD(v - ref);
    /* ── what a scene is handed ──────────────────────────────────────── */
    const ctx = {
      E, M, me, hash, hash2, reduce, clamp, lerp, wrapD,
      /** Signal towers raised in the iso world, when a page hands them over:
       *  () => [{ uid, tx, ty }] in iso tiles, and a tower's Musebot state. */
      towers: opts.towers || null,
      /** What a house's door does: "rooms" (every house leads inside, the backstage
       *  proposal) or "menus" (as the iso village: a house opens its menu or page,
       *  and only a house whose link is this very 3D page leads inside). */
      doors: opts.doors || "rooms",
      towerState: opts.towerState || (() => ({ state: "unassigned", beat: 0 })),
      /** How a place shows its distance: "focus" (soft, as out of the eye's focus) or "mist" (a haze). */
      distance: opts.distance === "mist" ? "mist" : "focus",
      /** A fixed thing's position, at its copy nearest the camera: [x, z]. */
      at: (x, z) => [img(x, E.cam.x), img(z, E.cam.z)],
      /** Distance across the ground from the camera. */
      near: (x, z) => Math.hypot(x - E.cam.x, z - E.cam.z),
      /** In front of the camera (with pad of slack) and within the scene's reach. */
      /** True while a probe measures a whole place: then everything is built. */
      measuring: false,
      ahead(x, z, pad) {
        if (ctx.measuring) return true;
        const c = E.cam, dx = wrapD(x - c.x), dz = wrapD(z - c.z), p = pad || 0;
        return dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw) > -p - 8 && dx * dx + dz * dz < (S.seen + p) * (S.seen + p);
      },
      /** Detail by distance: fewer samples far off, never another colour. */
      lod(x, z) { const d = Math.hypot(wrapD(x - E.cam.x), wrapD(z - E.cam.z)); return d > 130 ? 0 : d > 70 ? 1 : 2; },
      /** How strongly a ground blob's outline shows: full near, gone by 110. */
      inkFade: (x, z) => clamp((110 - Math.hypot(wrapD(x - E.cam.x), wrapD(z - E.cam.z))) / 60, 0, 1),
      poolAt: (x, z) => poolAt(x, z),
      waterY: (p, x, z) => waterY(p, x, z),
      get t() { return E.t; },
    };

    /* ── water ─────────────────────────────────────────────────────────
       A pool carries a height field over its basin's box, stepped by the wave
       equation with damping and a spring back to level (slime3d.js's water on
       any ground). Its sheet is bounded by the SHORELINE, marched out from the
       centre along 28 headings to where the floor comes up through the level,
       so a pool is the basin's own shape.                                  */
    const WAVE_C = 9, WAVE_DAMP = 2.0, WAVE_K = 5.5, AMB = 0.045;
    function makePool(d) {
      const level = S.floorAt(d.x, d.z) + d.depth;
      const nx = clamp(Math.round((2 * d.rx) / 4), 6, 18), nz = clamp(Math.round((2 * d.rz) / 4), 6, 18);
      const p = { x: d.x, z: d.z, rx: d.rx, rz: d.rz, level, nx, nz, cx: (2 * d.rx) / (nx - 1), cz: (2 * d.rz) / (nz - 1),
        h: new Float64Array(nx * nz), v: new Float64Array(nx * nz), next: new Float64Array(nx * nz), amp: 0.9, shore: [], awake: 0 };
      const wet = (x, z) => S.floorAt(x, z) < level - 0.04;
      const N = 28;
      for (let k = 0; k < N; k++) {
        const a = TAU * (k / N), ca = Math.cos(a), sa = Math.sin(a);
        const lim = 1 / Math.sqrt((ca / d.rx) * (ca / d.rx) + (sa / d.rz) * (sa / d.rz));
        let r = 0;
        while (r < lim && wet(d.x + ca * r, d.z + sa * r)) r += 0.5;
        p.shore.push([ca, sa, Math.max(0.5, r)]);
      }
      return p;
    }
    /* Open water: a scene with `sea: { level }` has lakes wherever its ground
       lies under that level (the iso world's water biome). The ground renderer
       draws them; here they are water to wade in, with ripples, and no wave
       field (a lake is too big to simulate, and it is never still anyway). */
    let SEA = null;
    function inPool(p, x, z) {
      if (p.sea) return S.floorAt(x, z) < p.level - 0.04;
      const u = wrapD(x - p.x) / p.rx, v = wrapD(z - p.z) / p.rz;
      return u * u + v * v < 1 && S.floorAt(x, z) < p.level - 0.04;
    }
    function poolAt(x, z) { for (const p of pools) if (inPool(p, x, z)) return p; return SEA && inPool(SEA, x, z) ? SEA : null; }
    function fieldAt(p, x, z) {
      if (p.sea) return 0;
      const u = clamp((wrapD(x - p.x) + p.rx) / p.cx, 0, p.nx - 1), t = clamp((wrapD(z - p.z) + p.rz) / p.cz, 0, p.nz - 1);
      const i = Math.floor(u), j = Math.floor(t), i2 = Math.min(p.nx - 1, i + 1), j2 = Math.min(p.nz - 1, j + 1);
      const a = lerp(p.h[j * p.nx + i], p.h[j * p.nx + i2], u - i), b = lerp(p.h[j2 * p.nx + i], p.h[j2 * p.nx + i2], u - i);
      return lerp(a, b, t - j);
    }
    const ambient = (x, z) => (reduce ? 0 : AMB * (Math.sin(x * 0.9 + E.t * 1.7) + 0.8 * Math.sin(z * 0.7 - E.t * 1.3 + x * 0.5)));
    function waterY(p, x, z) { return p.level + fieldAt(p, x, z) + ambient(x, z); }
    function waterNormal(p, x, z) {
      const e = 0.6, dx = (waterY(p, x + e, z) - waterY(p, x - e, z)) / (2 * e), dz = (waterY(p, x, z + e) - waterY(p, x, z - e)) / (2 * e);
      const m = Math.hypot(dx, 1, dz);
      return [-dx / m, 1 / m, -dz / m];
    }
    function disturb(p, x, z, impulse) {
      if (p.sea) return;
      const ui = (wrapD(x - p.x) + p.rx) / p.cx, ti = (wrapD(z - p.z) + p.rz) / p.cz;
      for (let j = Math.max(0, Math.floor(ti - 3)); j <= Math.min(p.nz - 1, Math.ceil(ti + 3)); j++) {
        for (let i = Math.max(0, Math.floor(ui - 3)); i <= Math.min(p.nx - 1, Math.ceil(ui + 3)); i++) {
          const d = Math.hypot(i - ui, j - ti);
          if (d < 2.6) p.v[j * p.nx + i] += clamp(impulse, -9, 9) * (0.5 + 0.5 * Math.cos((Math.PI * d) / 2.6));
        }
      }
      p.awake = 4;                                               // seconds of stepping before it may sleep
    }
    function stepWater(dt) {
      const c2 = WAVE_C * WAVE_C;
      for (const p of pools) {
        if (p.awake <= 0) continue;                              // a still pool costs nothing: only the ambient waves move it
        p.awake -= dt;
        let e = 0;
        for (let j = 0; j < p.nz; j++) for (let i = 0; i < p.nx; i++) {
          const k = j * p.nx + i, hh = p.h[k];
          const l = p.h[j * p.nx + Math.max(0, i - 1)], r = p.h[j * p.nx + Math.min(p.nx - 1, i + 1)];
          const u = p.h[Math.max(0, j - 1) * p.nx + i], d = p.h[Math.min(p.nz - 1, j + 1) * p.nx + i];
          p.v[k] += (c2 * (l + r + u + d - 4 * hh) - WAVE_DAMP * p.v[k] - WAVE_K * hh) * dt;
          p.next[k] = clamp(hh + p.v[k] * dt, -p.amp, p.amp);
          if (p.next[k] === p.amp || p.next[k] === -p.amp) p.v[k] = 0;
          e += Math.abs(p.next[k]) + Math.abs(p.v[k]);
        }
        p.h.set(p.next);
        if (e < 1e-3 * p.h.length) p.awake = Math.min(p.awake, 0);   // settled
      }
    }
    /** Is this water point in view, or behind a rise of the floor? */
    function seenFrom(x, y, z) {
      const c = E.cam;
      for (let k = 1; k <= 8; k++) {
        const t = k / 9, sx = c.x + (x - c.x) * t, sy = c.y + (y - c.y) * t, sz = c.z + (z - c.z) * t;
        if (S.floorAt(sx, sz) > sy + 0.12) return false;
      }
      return true;
    }
    /* A lake has no ring of its own, so round the slime one is found each
       frame: from the nearest open water, the shore is marched out along 32
       headings (at most 80 units), and everything standing over that stretch
       of lake is mirrored in it, as a pool mirrors. The lake itself is drawn
       by the ground renderer. */
    function lakeMirror() {
      if (!SEA) return;
      let ox = null, oz = 0;
      if (inPool(SEA, me.x, me.z)) { ox = me.x; oz = me.z; }
      else {
        const fx = Math.sin(E.cam.yaw), fz = Math.cos(E.cam.yaw);
        search: for (let r = 6; r <= 60; r += 6) for (let k = -3; k <= 3; k++) {
          const a = Math.atan2(fx, fz) + k * 0.35, x = me.x + Math.sin(a) * r, z = me.z + Math.cos(a) * r;
          if (inPool(SEA, x, z)) { ox = x; oz = z; break search; }
        }
      }
      if (ox == null) return;
      const ring = [], L = SEA.level;
      for (let k = 0; k < 32; k++) {
        const a = TAU * (k / 32), ca = Math.cos(a), sa = Math.sin(a);
        let r = 0;
        while (r < 80 && S.floorAt(ox + ca * r, oz + sa * r) < L - 0.02) r += 1.5;
        ring.push([ox + ca * r, L, oz + sa * r]);
      }
      E.mirror(ring, { surface: (x, z) => L + ambient(x, z), level: L, alpha: S.mirrorAlpha || 0.36,
        x0: ox - 90, x1: ox + 90, z0: oz - 90, z1: oz + 90 });
    }
    function buildWater() {
      lakeMirror();
      const c = E.cam;
      for (const p0 of pools) {
        if (!ctx.ahead(p0.x, p0.z, Math.max(p0.rx, p0.rz) + 10)) continue;
        // at its copy nearest the camera (a ring cave, an endless world); the wave field reads the same either way
        const [px, pz] = ctx.at(p0.x, p0.z), p = px === p0.x && pz === p0.z ? p0 : Object.assign(Object.create(p0), { x: px, z: pz });
        const P = S.pal(p.x, p.z), ring = [];
        // A low camera sees a pool across its near rim. Each shoreline point the
        // floor hides is drawn in toward the centre until it can be seen, so the
        // sheet never paints over the rise in front of it.
        for (const [ca, sa, r] of p.shore) {
          let rr = r;
          for (let k = 0; k < 6; k++) {
            const x = p.x + ca * rr, z = p.z + sa * rr;
            if (seenFrom(x, p.level, z)) break;
            rr *= 0.72;
          }
          const x = p.x + ca * rr, z = p.z + sa * rr;
          ring.push([x, waterY(p, x, z), z]);
        }
        const pad = S.mirrorPad || 30;                          // how far round the pool things are looked for to reflect
        E.mirror(ring, { surface: (x, z) => waterY(p, x, z), level: p.level, alpha: S.mirrorAlpha || 0.36,
          x0: p.x - p.rx - pad, x1: p.x + p.rx + pad, z0: p.z - p.rz - pad, z1: p.z + p.rz + pad });
        const depth = clamp((p.level - S.floorAt(p.x, p.z)) / 2.4, 0, 1);
        // grazing water is a mirror: under the sky it shows the sky, in a cave the dark
        const far = P.sky ? rgba(mix(P.sky, P.shallow, 0.3), 0.9) : rgba(mix(P.deep, P.shallow, 0.18), 0.84), mid = rgba(mix(P.shallow, P.deep, 0.3 + 0.55 * depth), 0.6), near = rgba(P.shallow, 0.3);
        const photo = S.waterPhoto && PHOTO.ready && depth > 0.5 ? S.waterPhoto : null;
        const mid3 = photo ? E.project([p.x, p.level, p.z]) : null;
        E.custom(ring, (g, sp, e) => {
          let top = Infinity, bot = -Infinity, lf = Infinity, rt = -Infinity;
          for (const q of sp) { if (q[1] < top) top = q[1]; if (q[1] > bot) bot = q[1]; if (q[0] < lf) lf = q[0]; if (q[0] > rt) rt = q[0]; }
          M.traceRing(g, sp);
          if (photo && rt - lf > 6) {
            // the photo lies on the water at a fixed size (PHOTO_W world units
            // across), tiled, and squashed as the pool is squashed in view, so
            // it keeps its grain instead of being blown up over the whole pool
            const img = /** @type {HTMLImageElement} */ (PHOTO.img), w = rt - lf, h = Math.max(1, bot - top);
            const kx = (w / (2 * p.rx)) * (PHOTO_W / img.width), ky = kx * (h / w) * (p.rx / p.rz);
            const [pat, sc] = photoPattern(g, Math.min(kx, ky) * img.width * E.dpr);   // the copy for the smaller of the two squashes: the one that aliases
            g.save(); g.clip();
            if (pat && pat.setTransform) {
              pat.setTransform(new DOMMatrix([kx / sc, 0, 0, ky / sc, lf, top]));
              g.fillStyle = pat; g.fillRect(lf, top, w, h);
            } else g.drawImage(img, lf, top, w, h);
            if (photo.tint) { g.fillStyle = photo.tint; g.fillRect(lf, top, w, h); }
            // deep in the middle, so the photo shows there; the water's own colour toward the shore
            const cx = mid3 ? mid3[0] : (lf + rt) / 2, cy = mid3 ? mid3[1] : (top + bot) / 2;
            const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
            rg.addColorStop(0, rgba(P.shallow, 0)); rg.addColorStop(0.6, rgba(P.shallow, 0.05)); rg.addColorStop(1, rgba(P.shallow, 0.55));
            g.fillStyle = rg; g.fillRect(lf, top, w, h);
            g.restore();
            M.traceRing(g, sp);
            g.globalAlpha = photo.over == null ? 0.55 : photo.over;   // the drawn water, thinned over the photo
          }
          const gr = g.createLinearGradient(0, top, 0, Math.max(top + 1, bot));
          gr.addColorStop(0, far); gr.addColorStop(0.55, mid); gr.addColorStop(1, near);
          g.fillStyle = gr; g.fill();
          g.globalAlpha = 1;
          if (e.fog && e.fog.t > 0.015) { g.fillStyle = rgba(e.fog.colour, e.fog.t); g.fill(); }
        }, { layer: 1 });
        // glints: a light above and ahead, thrown back where a wave tilts to the eye
        const L = [Math.sin(c.yaw) * 0.55, 0.8, Math.cos(c.yaw) * 0.55], lm = Math.hypot(L[0], L[1], L[2]);
        for (let j = 0; j < p.nz; j += 2) for (let i = 0; i < p.nx; i += 1) {
          const x = p.x - p.rx + i * p.cx + Math.sin(i * 3.1 + j * 1.7) * 0.6, z = p.z - p.rz + j * p.cz;
          if (!inPool(p, x, z)) continue;
          const y = waterY(p, x, z), N = waterNormal(p, x, z);
          const V = [c.x - x, c.y - y, c.z - z], vm = Math.hypot(V[0], V[1], V[2]) || 1;
          const H = [V[0] / vm + L[0] / lm, V[1] / vm + L[1] / lm, V[2] / vm + L[2] / lm], hm = Math.hypot(H[0], H[1], H[2]) || 1;
          const spec = Math.pow(Math.max(0, (N[0] * H[0] + N[1] * H[1] + N[2] * H[2]) / hm), 90);
          if (spec < 0.08) continue;
          const len = 0.5 + spec * 1.2;
          E.line([[x - len, y + 0.03, z], [x + len, y + 0.03, z]], rgba(P.glint, Math.min(1, spec)), 0.045 + spec * 0.07, { layer: 1, bias: 2000, world: true });
        }
        const rim = ring.slice(); rim.push(ring[0]);           // where water meets ground: a hairline
        E.line(rim, rgba(P.glint, 0.4), 0.06, { layer: 1, bias: 2000, world: true });
      }
    }
    /** Rings spreading from whatever wades: they stop at the shore. */
    function ripples(p, x, z, R, phase, strength, glint) {
      for (const off of [0, 0.5]) {
        const f = (phase + off) % 1, rr = R * (1.1 + f * 2.2), a = (1 - f) * 0.5 * strength;
        let run = [];
        for (let j = 0; j <= 20; j++) {
          const t = TAU * (j / 20), px = x + Math.cos(t) * rr, pz = z + Math.sin(t) * rr;
          if (inPool(p, px, pz)) run.push([px, waterY(p, px, pz) + 0.03, pz]);
          else if (run.length) { if (run.length > 1) E.line(run, rgba(glint, a), 0.05, { layer: 1, bias: 2000, world: true }); run = []; }
        }
        if (run.length > 1) E.line(run, rgba(glint, a), 0.05, { layer: 1, bias: 2000, world: true });
      }
    }

    /* ── what is solid ─────────────────────────────────────────────────
       Everything that stands up is solid: the scene lists its solids (rocks,
       walls of houses, plants, posts), a sign's post is added for it, and the
       creatures are solid to each other and to the slime. The static solids
       sit in a grid of 16-unit cells, each listed in every cell it could
       touch, so a body only looks at what is near it.                      */
    const GRID = 16, REACH = 4;                                // REACH: the widest body's half-width, and a little more
    // on a torus the cells wrap too, so a solid by the seam is found from either side
    const cellWrap = (i) => (PER ? ((i % (PER / GRID)) + PER / GRID) % (PER / GRID) : i);
    const cellKey = (i, j) => cellWrap(i) * 73856093 ^ cellWrap(j) * 19349663;
    function buildGrid(solids) {
      const grid = new Map();
      for (const q of solids) {
        const r = q.r + REACH;
        for (let i = Math.floor((q.x - r) / GRID); i <= Math.floor((q.x + r) / GRID); i++) {
          for (let j = Math.floor((q.z - r) / GRID); j <= Math.floor((q.z + r) / GRID); j++) {
            const k = cellKey(i, j);
            let list = grid.get(k);
            if (!list) grid.set(k, (list = []));
            list.push(q);
          }
        }
      }
      return grid;
    }
    let grid = new Map();
    const EMPTY = [];
    const near = (x, z) => grid.get(cellKey(Math.floor(x / GRID), Math.floor(z / GRID))) || EMPTY;
    /** Push a body out of every static solid it overlaps. */
    function collide(b) {
      for (const q of near(b.x, b.z)) push(b, img(q.x, b.x), img(q.z, b.z), q.r + b.R * 0.8);
      if (S.dynSolids) for (const q of S.dynSolids) push(b, img(q.x, b.x), img(q.z, b.z), q.r + b.R * 0.8);   // things that come and go (towers raised in the iso world)
    }
    function push(b, x, z, r) {
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
      if (d >= r) return;
      if (d < 1e-4) { b.x = x + r; return; }
      b.x = x + (dx / d) * r; b.z = z + (dz / d) * r;
    }
    /** The creatures and the slime, solid to one another. An overlap is shared
     *  by weight, so a zoog gives way to the slime and the slime to a shoggoth,
     *  and a rooted shoggoth gives way to nothing. Three passes, each ending
     *  with the rock, settle a knot. */
    const bodies = [];
    const bodyR = (b) => (b === me ? me.R * 0.8 : b.kind === "zoog" ? b.R * 0.9 : b.R * 0.85);
    const weight = (b) => (b === me ? 3 : b.kind === "zoog" ? 1 : b.dormant ? 1e9 : 5);
    function resolveBodies() {
      bodies.length = 0;
      bodies.push(me);
      for (const s of shogs) bodies.push(s);
      for (const z of zoogs) if (z.alive) bodies.push(z);
      for (let pass = 0; pass < 3; pass++) {
        // each pass: bodies apart, then every body back out of the rock, so a
        // body pushed into a wall does not end the frame inside its neighbour
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i], ra = bodyR(a), wa = weight(a);
          for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j], r = ra + bodyR(b);
            const dx = wrapD(b.x - a.x), dz = wrapD(b.z - a.z);
            if (Math.abs(dx) >= r || Math.abs(dz) >= r) continue;
            let d = Math.hypot(dx, dz);
            if (d >= r) continue;
            let ux = dx, uz = dz;
            if (d < 1e-4) { ux = 1; uz = 0; d = 1; } else { ux /= d; uz /= d; }
            const over = r - (d < 1e-4 ? 0 : d), wb = weight(b), fa = wb / (wa + wb), fb = wa / (wa + wb);
            a.x -= ux * over * fa; a.z -= uz * over * fa;
            b.x += ux * over * fb; b.z += uz * over * fb;
          }
        }
        for (const b of bodies) {
          if (b.dormant) continue;
          S.bound(b); collide(b);
        }
      }
      for (const b of bodies) b.y = S.floorAt(b.x, b.z);
      // bumped by the slime, an awake shoggoth loses the thread: it lets its zoog
      // go and stands a moment before it hunts again (so the slime can rescue one)
      for (const s of shogs) {
        if (s.dormant) continue;
        if (Math.hypot(wrapD(s.x - me.x), wrapD(s.z - me.z)) < bodyR(s) + bodyR(me) + 0.4) {
          if (s.target) say(s, "teke?!", 1.0);
          s.target = null; s.rest = Math.max(s.rest, 2); s.think = 2;
        }
      }
    }
    /** Where the camera may stand: the scene's air, and not inside anything tall. */
    function camOpen(x, y, z) {
      if (!S.open(x, y, z)) return false;
      for (const q of near(x, z)) {
        if (!q.h) continue;
        const d = Math.hypot(wrapD(x - q.x), wrapD(z - q.z)), up = y - S.floorAt(q.x, q.z);
        if (up > q.h + 1 || d > q.r + 1) continue;
        // a dome narrows as it rises (by its own outline, radAt, if it has one); anything else stands straight
        const rr = q.radAt ? q.radAt(Math.max(0, up)) : q.r * Math.sqrt(Math.max(0, 1 - (up / (q.h + 1)) ** 2));
        if (!q.dome || d < rr + 1) return false;
      }
      return true;
    }

    /* ── the slime ─────────────────────────────────────────────────────── */
    /** The body's surface: a dome whose underside takes the ground's shape,
     *  squashed by the idle breath and drawn out when it hurries. */
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
          const base = S.floorAt(x, z) + 0.05;
          out.push([x, i === ROWS ? base : Math.max(base, me.y + me.bob + Math.cos(a) * ry), z]);
        }
      }
      return out;
    }
    /** The eye at the brand's proportions (slime-2d.js, engine.js's avatar):
     *  radius 3.5/13 of the body's, pupil 1.8/13, six tenths up the dome, on the
     *  front. In a pool it is flipped with the body's points, so a reflection
     *  shows it exactly when a mirror would. */
    function slimeEye(g, Mi, base) {
      // On the front, at the brand's six tenths up the dome: from behind, where the
      // camera rides, it is out of sight, as it should be; the pool shows it, and
      // so does the slime turning to face the camera (the user's call, 2026-09-22,
      // having tried it up near the crown). In the reflection the eye always
      // shows, foreshortened as it turns away: strictly, from behind, a mirror
      // under the slime shows its back too, but the reflection is where the
      // visitor looks for the eye.
      const R = me.R, EL = Math.acos(0.6);
      let nx = Math.sin(me.yaw) * Math.sin(EL), ny = Math.cos(EL), nz = Math.cos(me.yaw) * Math.sin(EL);
      let px = me.x + nx * R * 0.97, py = me.y + me.bob + ny * R * 0.97, pz = me.z + nz * R * 0.97;
      if (Mi) { py = E.mirrorPoint(Mi, [px, py, pz], base)[1]; ny = -ny; }
      const v = E.view([px, py, pz]);
      if (v[2] <= E.near) return;
      const tc = [E.cam.x - px, E.cam.y - py, E.cam.z - pz], tm = Math.hypot(tc[0], tc[1], tc[2]) || 1;
      const facing = (nx * tc[0] + ny * tc[1] + nz * tc[2]) / tm;
      if (facing < 0.02 && !Mi) return;
      const p = E.screen(v), k = E.fov / v[2];
      const r = R * (3.5 / 13) * k, squeeze = clamp(0.35 + Math.abs(facing) * 0.65, 0.35, 1);
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(p[0], p[1], r * squeeze, r * 0.96, 0, 0, TAU); g.fill();
      const ink = (S.slime || GEL).ink;
      g.lineWidth = Math.max(0.8, R * (1.3 / 13) * k); g.strokeStyle = ink; g.stroke();
      g.fillStyle = ink; g.beginPath(); g.ellipse(p[0], p[1] + r * 0.08, R * (1.8 / 13) * k * squeeze, R * (1.8 / 13) * k, 0, 0, TAU); g.fill();
    }
    function buildPlayer() {
      const pts = bodyPoints(), R = me.R;
      E.organic(M.shapes.disc(me.x, me.z, R * 1.05, 12, (x, z) => S.floorAt(x, z) + 0.08), "rgba(0,0,0,0.22)", null, 0, { layer: 0, stable: true, bias: 9, inkPx: 1e9 });
      if (me.pool && me.ripple > 0.02) ripples(me.pool, me.x, me.z, R, me.ripple, Math.min(1, me.ripple * 4), S.pal(me.x, me.z).glint);
      E.organic(pts, (g, bb) => {
        const G = S.slime || GEL;                                // each skin's slime (its iso avatarColors)
        const gr = g.createRadialGradient(bb.x + bb.w * 0.34, bb.y + bb.h * 0.22, 1, bb.x + bb.w * 0.5, bb.y + bb.h * 0.55, Math.max(bb.w, bb.h) * 0.78);
        gr.addColorStop(0, G.light); gr.addColorStop(0.5, G.mid); gr.addColorStop(1, G.dark);
        return gr;
      }, (S.slime || GEL).ink, 1.3, { layer: 2, bias: 1.5, inkPx: 2, tag: me, lit: true, after: (g, ring, bb, sp, e) => {
        const Mi = e && e.it.o && e.it.o.mirrorOf;
        g.save(); M.traceRing(g, ring); g.clip();
        g.globalAlpha = 0.34; g.fillStyle = "#fff";
        g.beginPath(); g.ellipse(bb.x + bb.w * 0.34, bb.y + bb.h * (Mi ? 0.8 : 0.2), bb.w * 0.2, bb.h * 0.12, Mi ? 0.5 : -0.5, 0, TAU); g.fill();
        g.restore();
        if (me.pool && !Mi) {                                   // the part under the waterline, seen through the water
          const lv = waterY(me.pool, me.x, me.z), wet = [];
          for (let i = 0; i < pts.length; i++) if (pts[i][1] <= lv + 0.15 && sp[i]) wet.push(sp[i]);
          const h = M.hull(wet);
          if (h.length > 2) { g.save(); M.traceRing(g, ring); g.clip(); M.traceRing(g, h); g.fillStyle = S.pal(me.x, me.z).water; g.fill(); g.restore(); }
        }
        slimeEye(g, Mi || null, Mi ? e.it.o.mirrorBase : 0);
      } });
    }

    /* ── zoogs ─────────────────────────────────────────────────────────── */
    const ZR = size("zoog").w, ZH = size("zoog").h;
    function spawnZoog(z, x0, z0, rnd) {
      const a = rnd() * TAU, d = rnd() * 6;
      z.x = x0 + Math.cos(a) * d; z.z = z0 + Math.sin(a) * d;
      S.bound(z); collide(z);
      z.alive = true; z.dead = 0; z.vx = 0; z.vz = 0; z.rest = rnd() * 3;
    }
    function makeZoogs(n, rnd) {
      const out = [], herds = Math.max(1, Math.round(n / 7));
      const homes = [];
      for (let h = 0; h < herds; h++) homes.push(S.life.spot(rnd));
      for (let i = 0; i < n; i++) {
        const home = homes[i % herds];
        const z = { kind: "zoog", herd: i % herds, x: 0, z: 0, y: 0, R: ZR, yaw: rnd() * TAU, vx: 0, vz: 0, wander: rnd() * TAU,
          ph: rnd(), eyes: 3 + (rnd() < 0.5 ? 1 : 0), alive: true, dead: 0, rest: 0, wet: null, ripple: 0 };
        spawnZoog(z, home[0], home[1], rnd);
        out.push(z);
      }
      return out;
    }
    function stepZoogs(dt) {
      const rnd = Math.random;
      for (const z of zoogs) {
        if (!z.alive) {                                          // eaten: back later, somewhere a knot of them is
          z.dead -= dt;
          if (z.dead <= 0) { const home = S.life.spot(rnd); spawnZoog(z, home[0], home[1], rnd); }
          continue;
        }
        let fx = 0, fz = 0, scared = 0;
        for (const s of shogs) {
          if (s.dormant) continue;
          const dx = z.x - s.x, dz = z.z - s.z, d = Math.hypot(dx, dz) || 1;
          if (d < 24) { const w = (24 - d) / 24; fx += (dx / d) * w * 2; fz += (dz / d) * w * 2; scared = Math.max(scared, w); }
        }
        // running from a shoggoth, now and then it cries out
        if (scared > 0.3 && !(z.say && z.say.t > 0) && Math.random() < dt * 0.9) say(z, Math.random() < 0.5 ? "Yikes!" : "Yeep!", 1.1);
        // a pet zoog (indoors, in the cave) greets the slime when it comes close
        else if (S.life.greet && !(z.say && z.say.t > 0) && Math.hypot(z.x - me.x, z.z - me.z) < 12 && Math.random() < dt * 0.35) say(z, "blooloo!", 1.2);
        // Curious as well as furtive: now and then, when nothing is chasing it, a
        // zoog comes up to the slime, stops a little short, and looks at it for a
        // while before it goes back to grazing. Otherwise the slime is big to a zoog.
        if (!z.curious && scared < 0.05 && Math.random() < dt * 0.04) z.curious = 4 + Math.random() * 4;
        if (z.curious) z.curious = Math.max(0, z.curious - dt);
        { const dx = z.x - me.x, dz = z.z - me.z, d = Math.hypot(dx, dz) || 1, shy = z.curious ? 5.5 : 11;
          if (z.curious && d > 8) { fx -= (dx / d) * 1.6; fz -= (dz / d) * 1.6; }   // drawn to it
          else if (z.curious) { z.rest = Math.max(z.rest, 0.5); z.yaw = Math.atan2(-dx, -dz); }   // close enough: it stops and looks
          if (d < shy) { const w = (shy - d) / shy; fx += (dx / d) * w * 1.5; fz += (dz / d) * w * 1.5; scared = Math.max(scared, w * 0.8); } }
        let cx = 0, cz = 0, n = 0;
        for (const o of zoogs) {
          if (o === z || !o.alive || o.herd !== z.herd) continue;
          const dx = o.x - z.x, dz = o.z - z.z, d = Math.hypot(dx, dz);
          if (d > 34) continue;
          cx += o.x; cz += o.z; n++;
          if (d < 3.2 && d > 1e-3) { fx -= (dx / d) * (3.2 - d) * 0.5; fz -= (dz / d) * (3.2 - d) * 0.5; }
        }
        if (n) { fx += (cx / n - z.x) * 0.03; fz += (cz / n - z.z) * 0.03; }
        z.wander += (hash(z.ph * 91 + Math.floor(E.t * 0.7)) - 0.5) * dt * 2.4;
        fx += Math.sin(z.wander) * 0.35; fz += Math.cos(z.wander) * 0.35;
        if (scared < 0.05) { z.rest -= dt; if (z.rest < -4 && rnd() < dt * 0.4) z.rest = 1 + rnd() * 3; } else z.rest = 0;
        const m = Math.hypot(fx, fz) || 1, top = scared > 0.05 ? 10 : z.rest > 0 ? 0 : 3.4;
        z.wet = poolAt(z.x, z.z);
        const slow = z.wet ? 0.55 : 1;                           // water slows it, as it slows the slime
        z.vx += ((fx / m) * top * slow - z.vx) * Math.min(1, dt * 3);
        z.vz += ((fz / m) * top * slow - z.vz) * Math.min(1, dt * 3);
        z.x += z.vx * dt; z.z += z.vz * dt;
        S.bound(z); collide(z);
        const sp = Math.hypot(z.vx, z.vz);
        if (sp > 0.4) z.yaw = Math.atan2(z.vx, z.vz);
        if (z.wet && sp > 2) { disturb(z.wet, z.x, z.z, sp * 0.02); z.ripple = (z.ripple + dt * 1.1) % 1; } else if (!z.wet) z.ripple = 0;
        z.speed = sp;
        z.y = S.floorAt(z.x, z.z);
      }
    }
    function buildZoogs() {
      for (const z of zoogs) {
        if (!z.alive || !ctx.ahead(z.x, z.z, 6)) continue;
        const night = S.life.night ? S.life.night(z.x, z.z) : false, p = night ? ZOOG.night : ZOOG.day;
        const hop = !z.wet && z.speed > 1.2 && !reduce ? Math.max(0, Math.sin(E.t * 7 + z.ph * 6)) * 0.9 : 0;
        const sink = z.wet ? 0.45 : 0, wob = z.wet && !reduce ? 1 + 0.12 * Math.sin(E.t * 4.4 + z.ph * 5) : 1;
        const R = ZR * wob, H = ZH * (z.wet ? 0.8 : 1), base = z.y + hop - sink;
        if (!z.wet) E.organic(M.shapes.disc(z.x, z.z, ZR * (1 - hop * 0.25), 8, (x, zz) => S.floorAt(x, zz) + 0.07), "rgba(0,0,0,0.2)", null, 0, { layer: 0, stable: true, bias: 8, inkPx: 1e9 });
        else if (z.ripple > 0.02) ripples(z.wet, z.x, z.z, ZR, z.ripple, 0.8, S.pal(z.x, z.z).glint);
        const lod = ctx.lod(z.x, z.z), cols = [7, 9, 11][lod], pts = [];
        for (let i = 0; i <= 3; i++) {                            // a low furtive tuft, flat on the ground
          const a = (Math.PI / 2) * (i / 3);
          for (let j = 0; j < cols; j++) {
            const t = TAU * (j / cols), lump = 1 + 0.2 * Math.sin(j * 2.3 + z.ph * 7) + 0.12 * Math.sin(j * 5.1 + i * 1.7 + z.ph * 3);
            pts.push([z.x + Math.sin(a) * Math.cos(t) * R * lump, Math.max(z.y + 0.04, base + Math.cos(a) * H), z.z + Math.sin(a) * Math.sin(t) * R * lump]);
          }
        }
        E.organic(pts, (g, bb) => { const gr = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h); gr.addColorStop(0, mix(p.body, p.pale, 0.35)); gr.addColorStop(0.6, p.body); gr.addColorStop(1, p.deep); return gr; },
          p.ink, 1.1, { layer: 2, inkPx: 3, tag: z,
          // fur: a ragged, tufted outline (far off, fewer and finer tufts)
          rough: { tufts: [11, 15, 19][lod], depth: 0.16, seed: z.ph * 97, flick: 0.6, sway: reduce ? 0 : E.t * 2 + z.ph * 9 },
          after: (g, ring, bb, sp, e) => {
            if (bb.w < 7) return;
            if (!e.it.o.mirrorOf && bb.w > 14) {                  // a few strands of fur across the pelt
              g.save(); M.traceRing(g, ring); g.clip();
              g.strokeStyle = rgba(p.deep, 0.7); g.lineWidth = Math.max(0.7, bb.w * 0.02); g.lineCap = "round";
              for (let f = 0; f < 7; f++) {
                const u = hash(z.ph * 31 + f), v = hash(z.ph * 17 + f * 3), fx = bb.x + bb.w * (0.15 + 0.7 * u), fy = bb.y + bb.h * (0.35 + 0.55 * v);
                g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + bb.w * 0.03, fy - bb.h * 0.08, fx + bb.w * (0.02 + 0.05 * (u - 0.5)), fy - bb.h * 0.16); g.stroke();
              }
              g.restore();
            }
            if (e.it.o.mirrorOf) return;                          // eyes are too small to matter in a pool
            const fade = 1 - (e.fog ? e.fog.t : 0);
            for (let i = 0; i < z.eyes; i++) {
              if (!reduce && Math.sin(E.t * 3 + i * 2 + z.ph * 11) <= -0.72) continue;   // blinking out of step
              const u = i / (z.eyes - 1) - 0.5, az = z.yaw + u * 1.3, el = 0.95 - Math.abs(u) * 0.2;
              const nx = Math.sin(az) * Math.sin(el), ny = Math.cos(el), nz = Math.cos(az) * Math.sin(el);
              const wp = [z.x + nx * R, base + ny * H, z.z + nz * R], v = E.view(wp);
              if (v[2] <= E.near) continue;
              const to = [E.cam.x - wp[0], E.cam.y - wp[1], E.cam.z - wp[2]], tm = Math.hypot(to[0], to[1], to[2]) || 1;
              if ((nx * to[0] + ny * to[1] + nz * to[2]) / tm < 0.05) continue;
              const s = E.screen(v), k = E.fov / v[2], r = Math.max(0.9, ZR * 0.17 * k);
              g.globalAlpha = fade;
              g.fillStyle = p.pale; g.beginPath(); g.arc(s[0], s[1], r, 0, TAU); g.fill();
              g.fillStyle = p.eye; g.beginPath(); g.arc(s[0] + Math.sin(z.yaw - E.cam.yaw) * r * 0.3, s[1] + r * 0.1, r * 0.5, 0, TAU); g.fill();
              g.globalAlpha = 1;
            }
          } });
      }
    }

    /* ── shoggoths ─────────────────────────────────────────────────────── */
    /* A shoggoth walks on its tentacles, the way the reacher in the lizard
       worlds climbs (more_procedurality, planetary_ecology: "several arms
       carry the body hand-over-hand while the remaining tentacles hang, curl,
       and probe"). On the ground: some of its nine arms grip the ground ahead,
       the body is pulled along among them and raised on them, the rearmost grip
       lets go as the body passes it and that arm reaches ahead again, and the
       free arms hang and curl. With fewer than two grips it cannot move. A
       planted tip that lands on a zoog has it. Rooted (dormant), every arm is
       a root, and none of them ever lets go.                               */
    const ARMS = 9;
    function makeShoggoths(n, rnd, dormant) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const home = S.life.shogSpot ? S.life.shogSpot(rnd, i) : S.life.spot(rnd);
        const s = { kind: "shoggoth", x: home[0], z: home[1], y: 0, R: size("shoggoth").w, yaw: rnd() * TAU, vx: 0, vz: 0, ph: rnd(), wander: rnd() * TAU,
          // eyes all over it: the iso shoggoth shows two to four on its one face; a
          // body seen from every side needs twice that so as many face the viewer
          eat: 0, rest: 0, target: null, think: 0, dormant: !!dormant, eyes: 6 + Math.floor(rnd() * 3), ripple: 0, wet: null, speed: 0,
          arms: [], regrip: 0, lastShift: 0, clock: rnd() * 10, lift: 0 };
        // long arms: each reaches two and a half to three and a quarter times the body's width
        // rooted, it puts down a few roots, as the iso dormant shoggoth does (three anchors), not nine arms
        const arms = dormant ? 4 : ARMS;
        for (let a = 0; a < arms; a++) s.arms.push({ base: (a / arms) * TAU + (rnd() - 0.5) * 0.3, reach: s.R * (2.5 + rnd() * 0.75), phase: rnd() * TAU, depth: rnd(), anchor: null, age: 0 });
        S.bound(s); collide(s);
        s.y = S.floorAt(s.x, s.z);
        if (s.dormant) for (const a of s.arms) {                  // roots: every arm planted round it, for good
          const ang = s.yaw + a.base, r = a.reach * 0.62;
          a.anchor = { x: s.x + Math.sin(ang) * r, z: s.z + Math.cos(ang) * r };
        }
        out.push(s);
      }
      return out;
    }
    /** A spot for an arm to grip: ahead in the direction h, spread by the arm's
     *  own side, clear of the other grips and of anything solid. */
    function chooseGrip(s, a, h, used) {
      for (let k = 0; k < 4; k++) {
        const side = Math.sin(a.base) * 0.9 + (hash(s.clock * 13 + a.phase + k) - 0.5) * 0.7;
        const ang = h + clamp(side, -1.2, 1.2), r = a.reach * (0.72 + 0.22 * hash(a.phase * 7 + s.clock + k));
        const x = s.x + Math.sin(ang) * r, z = s.z + Math.cos(ang) * r;
        if (used.some((u) => Math.hypot(u.x - x, u.z - z) < s.R * 0.8)) continue;
        if (near(x, z).some((q) => Math.hypot(wrapD(q.x - x), wrapD(q.z - z)) < q.r)) continue;
        return { x, z };
      }
      return null;
    }
    function stepShoggoths(dt) {
      for (const s of shogs) {
        s.eat = Math.max(0, s.eat - dt);
        s.clock += dt;
        if (s.dormant) {                                         // rooted: it stands where it grew, and still mutters now and then
          s.y = S.floorAt(s.x, s.z);
          if (!(s.say && s.say.t > 0) && Math.random() < dt * 0.05) say(s, "teketeke", 1.3);
          continue;
        }
        for (const a of s.arms) if (a.anchor) { a.anchor.x = img(a.anchor.x, s.x); a.anchor.z = img(a.anchor.z, s.z); a.age += dt; }
        s.think -= dt;
        if (s.think <= 0) {                                      // choose a zoog: the nearest in reach
          s.think = 0.5;
          const had = s.target && s.target.alive;
          s.target = null;
          let best = S.life.sense || 95;                         // a shoggoth senses a zoog a long way off
          for (const z of zoogs) { if (!z.alive) continue; const d = Math.hypot(wrapD(z.x - s.x), wrapD(z.z - s.z)); if (d < best) { best = d; s.target = z; } }
          if (s.target && !had) say(s, "lilililililili!", 1.6);   // it has found one, and gives chase
        }
        if (!(s.say && s.say.t > 0) && Math.random() < dt * 0.06) say(s, "teketeke", 1.3);   // and now and then, to itself
        let fx = 0, fz = 0, top = 2.6, mode = "wander";
        const t = s.target;
        if (t && t.alive && s.rest <= 0) {
          const dx = wrapD(t.x - s.x), dz = wrapD(t.z - s.z), d = Math.hypot(dx, dz) || 1;
          fx = dx / d; fz = dz / d;
          if (d < 12) { top = 13; mode = "lunge"; } else { top = 6.5; mode = "stalk"; }   // stalk, then lunge: a lunge outruns a zoog
          let caught = d < s.R * 0.85 + ZR + 0.8;               // against its body
          for (const a of s.arms) if (a.anchor && Math.hypot(wrapD(a.anchor.x - t.x), wrapD(a.anchor.z - t.z)) < ZR + 1) caught = true;   // under a planted tip
          if (caught) { t.alive = false; t.dead = 9; s.eat = 0.6; s.rest = 1.4; s.target = null; stats.eaten++; }
        } else {
          s.rest -= dt;
          s.wander += (hash(s.ph * 53 + Math.floor(E.t * 0.4)) - 0.5) * dt * 1.6;
          fx = Math.sin(s.wander); fz = Math.cos(s.wander);
          if (s.rest > 0) { top = 0; mode = "rest"; }
          if (S.life.avoid) { const v = S.life.avoid(s.x, s.z); fx += v[0]; fz += v[1]; }   // e.g. keep out of the village
        }
        for (const o of shogs) {                                 // keep their bodies apart
          if (o === s) continue;
          const dx = wrapD(s.x - o.x), dz = wrapD(s.z - o.z), d = Math.hypot(dx, dz);
          if (d > 1e-3 && d < s.R * 2.6) { fx += (dx / d) * 1.2; fz += (dz / d) * 1.2; }
        }
        const fm = Math.hypot(fx, fz) || 1, h = Math.atan2(fx, fz), hx = fx / fm, hz = fz / fm;
        // the grips: let go of what is behind or out of reach, and reach ahead
        const want = mode === "lunge" ? 5 : mode === "rest" ? 3 : 4, shiftEvery = mode === "lunge" ? 0.16 : mode === "stalk" ? 0.34 : 0.9;
        let held = s.arms.filter((a) => a.anchor);
        for (const a of held) {
          const ax = a.anchor.x - s.x, az = a.anchor.z - s.z, dist = Math.hypot(ax, az), fwd = ax * hx + az * hz;
          if (held.length > 2 && (dist > a.reach * 1.12 || fwd < -a.reach * 0.45)) { a.anchor = null; a.age = 0; }
        }
        held = s.arms.filter((a) => a.anchor);
        if (held.length >= want && s.clock - s.lastShift > shiftEvery && top > 0) {
          const rear = held.slice().sort((p, q) => ((p.anchor.x - s.x) * hx + (p.anchor.z - s.z) * hz) - ((q.anchor.x - s.x) * hx + (q.anchor.z - s.z) * hz))[0];
          if (rear.age > 0.2) { rear.anchor = null; rear.age = 0; s.lastShift = s.clock; }
        }
        s.regrip -= dt;
        held = s.arms.filter((a) => a.anchor);
        if (held.length < want && s.regrip <= 0) {
          const used = held.map((a) => a.anchor);
          const free = s.arms.filter((a) => !a.anchor).sort((p, q) => Math.abs(wrapA(s.yaw + p.base - h)) - Math.abs(wrapA(s.yaw + q.base - h)));
          for (const a of free) { const g = chooseGrip(s, a, h, used); if (g) { a.anchor = g; a.age = 0; s.regrip = mode === "lunge" ? 0.03 : 0.07; break; } }
        }
        held = s.arms.filter((a) => a.anchor);
        // the pull: along the heading as fast as the grips allow, and held among them
        s.wet = poolAt(s.x, s.z);
        const slow = s.wet ? 0.6 : 1, grip = clamp((held.length - 1) / 2, 0, 1);
        let cx = 0, cz = 0;
        for (const a of held) { cx += a.anchor.x; cz += a.anchor.z; }
        const pull = held.length ? [(cx / held.length - s.x) * 0.6, (cz / held.length - s.z) * 0.6] : [0, 0];
        const tvx = (hx * top * slow + pull[0]) * grip, tvz = (hz * top * slow + pull[1]) * grip;
        s.vx += (tvx - s.vx) * Math.min(1, dt * 3); s.vz += (tvz - s.vz) * Math.min(1, dt * 3);
        s.x += s.vx * dt; s.z += s.vz * dt;
        S.bound(s); collide(s);
        s.speed = Math.hypot(s.vx, s.vz);
        s.lift += (grip * s.R * 0.35 - s.lift) * Math.min(1, dt * 3);   // carried on its arms
        if (s.speed > 0.5) {
          const dy = wrapA(Math.atan2(s.vx, s.vz) - s.yaw);
          s.yaw += dy * Math.min(1, dt * 2.5);
        }
        if (s.wet && s.speed > 2) { disturb(s.wet, s.x, s.z, s.speed * 0.04); s.ripple = (s.ripple + dt * 0.8) % 1; } else if (!s.wet) s.ripple = 0;
        s.y = S.floorAt(s.x, s.z);
      }
    }
    const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
    /** One arm, as a tapered tube: ink, then the body's colour, then a thin
     *  sheen along it, drawn as one item. A planted arm arches up from the
     *  body's underside and lies flat for its last stretch on the ground; a
     *  free one hangs out from the body and curls. Widths are world units. */
    function arm(s, a, R, cy, pal) {
      const n = 8, pts = [], now = reduce ? 0 : s.clock;
      const out = s.yaw + a.base, ox = Math.sin(out), oz = Math.cos(out);
      const ax = s.x + ox * R * 0.55, az = s.z + oz * R * 0.55, ay = cy - R * 0.25;
      let ex, ez, ey;
      if (a.anchor) { ex = a.anchor.x; ez = a.anchor.z; ey = S.floorAt(ex, ez) + 0.15; }
      else {
        const hang = a.reach * (0.5 + 0.08 * Math.sin(now * 1.3 + a.phase));
        ex = s.x + ox * hang; ez = s.z + oz * hang; ey = Math.max(S.floorAt(ex, ez) + 0.3, ay - R * 0.4 + Math.sin(now * 1.1 + a.phase) * R * 0.2);
      }
      const sx = -oz, sz = ox;                                  // sideways, for the curl
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const arch = a.anchor ? Math.sin(Math.PI * Math.min(1, u * 1.25)) * R * 0.55 : Math.sin(Math.PI * u) * R * 0.2;
        const curl = Math.sin(now * (1.15 + a.depth * 0.7) + a.phase + u * 4.6) * R * (a.anchor ? 0.12 : 0.3) * (1 - u * 0.5);
        const x = lerp(ax, ex, u) + sx * curl, z = lerp(az, ez, u) + sz * curl;
        const y = Math.max(S.floorAt(x, z) + 0.12, lerp(ay, ey, u) + arch);
        pts.push([x, y, z]);
      }
      const body = mix(pal.body, pal.deep, 0.25 + a.depth * 0.35);
      E.custom(pts, (g, sp, e) => {
        const k = E.fov / Math.max(1, e.depth), fog = e.fog && e.fog.t > 0.015 ? e.fog : null;
        const col = fog ? mix(body, fog.colour, fog.t) : body, ink = fog ? rgba(SHOG_INK, 1 - fog.t) : SHOG_INK;
        g.lineCap = "round"; g.lineJoin = "round";
        for (let pass = 0; pass < 3; pass++) {
          if (pass === 2 && !pal.sheen) break;
          g.strokeStyle = pass === 0 ? ink : pass === 1 ? col : rgba(pal.sheen, 0.3 * (fog ? 1 - fog.t : 1));
          for (let i = 0; i < sp.length - 1; i++) {
            const w = (R * (0.24 * (1 - i / (n - 1)) + 0.05)) * 2 * k;
            g.lineWidth = Math.min(60, pass === 0 ? w + Math.max(1.6, 0.2 * k) : pass === 1 ? w : w * 0.3);
            g.beginPath(); g.moveTo(sp[i][0], sp[i][1] - (pass === 2 ? w * 0.2 : 0)); g.lineTo(sp[i + 1][0], sp[i + 1][1] - (pass === 2 ? w * 0.2 : 0)); g.stroke();
          }
        }
      }, { layer: 2, mirror: true });
    }
    function buildShoggoths() {
      for (const s of shogs) {
        if (!ctx.ahead(s.x, s.z, 12)) continue;
        const night = S.life.night ? S.life.night(s.x, s.z) : false;
        const pal = s.dormant ? SHOG.dormant : night ? SHOG.night : SHOG.day;
        const swell = s.eat > 0 ? 1 + 0.2 * Math.sin((1 - s.eat / 0.6) * Math.PI) : 1, R = s.R * swell, wob = s.dormant ? 0.4 : 1, now = reduce ? 0 : E.t;
        E.organic(M.shapes.disc(s.x, s.z, R * 1.15, 12, (x, z) => S.floorAt(x, z) + 0.08), "rgba(0,0,0,0.24)", null, 0, { layer: 0, stable: true, bias: 9, inkPx: 1e9 });
        if (s.wet && s.ripple > 0.02) ripples(s.wet, s.x, s.z, R, s.ripple, 0.9, S.pal(s.x, s.z).glint);
        const lod = ctx.lod(s.x, s.z), rows = [4, 6, 6][lod], cols = [9, 12, 14][lod], pts = [];
        const H = size("shoggoth").h * swell, cy = s.y + s.lift + H * 0.44, hx = Math.sin(s.yaw), hz = Math.cos(s.yaw);
        for (const a of s.arms) arm(s, a, R, cy, pal);        // the arms it walks on, and the free ones
        for (let i = 0; i <= rows; i++) {                        // the mass: a slow protoplasmic wander
          const a = Math.PI * (i / rows), sa = Math.sin(a), ca = Math.cos(a);
          for (let j = 0; j < cols; j++) {
            const t = TAU * (j / cols), ct = Math.cos(t), st = Math.sin(t);
            const kk = 1 + 0.13 * wob * Math.sin(t * 3 + now * 0.7 + s.ph * 6) + 0.08 * wob * Math.sin(t * 5 - now * 0.5 + s.ph * 12) + 0.05 * wob * Math.sin(a * 4 + now * 0.9);
            const lead = 1 + 0.16 * (ct * hx + st * hz) * sa;    // drawn out the way it goes
            const ry = ca > 0 ? H * 0.56 : H * 0.44;             // the iso mass: its crown is higher above its middle than its foot is below
            pts.push([s.x + ct * sa * R * kk * lead, Math.max(s.y + s.lift * 0.5 + 0.05, cy + ca * ry * kk), s.z + st * sa * R * kk * lead]);
          }
        }
        const shift = pal.sheen ? (Math.sin(now * 0.4 + s.ph * 18) + 1) / 2 : 0;
        E.organic(pts, (g, bb) => {
          const gr = g.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
          gr.addColorStop(0, pal.deep);
          if (pal.sheen) gr.addColorStop(Math.max(0.05, 0.25 + shift * 0.2), pal.sheen);
          gr.addColorStop(Math.min(0.95, 0.55 + shift * 0.2), pal.body);
          gr.addColorStop(1, pal.deep);
          return gr;
        }, SHOG_INK, 1.4, { layer: 2, inkPx: 3, tag: s,
          // a mass that never quite settles: knobs and swellings round its edge, slowly churning
          rough: { tufts: [9, 13, 17][lod], depth: 0.13, seed: s.ph * 71, round: true, sway: reduce ? 0 : E.t * 0.5 + s.ph * 5 },
          after: (g, ring, bb, sp, e) => {
          if (e.it.o.mirrorOf || bb.w < 10) return;
          // in the dark its eyes still show: they catch what light there is
          const fade = S.night ? Math.max(0.75, 1 - (e.fog ? e.fog.t : 0)) : 1 - (e.fog ? e.fog.t : 0);
          const look = s.target && s.target.alive ? E.project([s.target.x, s.target.y + 1, s.target.z]) : E.project([me.x, me.y + me.R, me.z]);
          for (let j = 0; j < s.eyes; j++) {                     // eyes open on its surface, hold, and sink back in
            const life = ((reduce ? 0.4 : E.t * 0.33) + s.ph + j * 0.37) % 1;
            const open = s.dormant ? 0.75 : life < 0.12 ? life / 0.12 : life > 0.72 ? Math.max(0, (0.92 - life) / 0.2) : 1;
            if (open <= 0.05) continue;
            const az = s.ph * TAU + j * 2.399, el = 0.45 + ((j * 0.37 + s.ph) % 0.85);   // spread round it by the golden angle
            const nx = Math.sin(el) * Math.sin(az), ny = Math.cos(el), nz = Math.sin(el) * Math.cos(az);
            const wp = [s.x + nx * R * 0.98, cy + ny * H * 0.54, s.z + nz * R * 0.98], v = E.view(wp);
            if (v[2] <= E.near) continue;
            const to = [E.cam.x - wp[0], E.cam.y - wp[1], E.cam.z - wp[2]], tm = Math.hypot(to[0], to[1], to[2]) || 1;
            const facing = (nx * to[0] + ny * to[1] + nz * to[2]) / tm;
            if (facing < 0.1) continue;
            const q = E.screen(v), k = E.fov / v[2], rr = (0.55 + (j % 2) * 0.18) * k * open;
            g.globalAlpha = fade;
            g.fillStyle = pal.eye; g.beginPath(); g.ellipse(q[0], q[1], rr * clamp(0.4 + facing, 0.4, 1), rr * (0.6 + 0.4 * open), 0, 0, TAU); g.fill();
            g.lineWidth = Math.max(0.8, 0.12 * k); g.strokeStyle = SHOG_INK; g.stroke();
            if (s.dormant) { g.beginPath(); g.moveTo(q[0] - rr * 1.1, q[1] - rr * 0.1); g.lineTo(q[0] + rr * 1.1, q[1] - rr * 0.1); g.stroke(); }
            else {
              let ux = 0, uy = 0;
              if (look) { const dx = look[0] - q[0], dy = look[1] - q[1], dm = Math.hypot(dx, dy) || 1; ux = dx / dm; uy = dy / dm; }
              g.fillStyle = SHOG_INK; g.beginPath(); g.arc(q[0] + ux * rr * 0.4, q[1] + uy * rr * 0.4, rr * 0.45, 0, TAU); g.fill();
            }
            g.globalAlpha = 1;
          }
        } });
      }
    }

    /* ── what the creatures say (3D only: the iso world draws no bubbles) ──
       A zoog running from a shoggoth cries "Yikes!" or "Yeep!"; a shoggoth
       mutters "teketeke" now and then, and "lilililililili!" when it finds a
       zoog to chase. Each in a speech bubble over the speaker, kept sharp and
       lit, so it reads at any distance and in the dark. */
    function say(who, text, secs) { who.say = { text, t: secs, len: secs }; }
    function buildBubbles() {
      for (const b of zoogs.concat(shogs)) {
        if (!b.say || b.say.t <= 0 || (b.kind === "zoog" && !b.alive)) continue;
        b.say.t -= E.dt;
        if (!ctx.ahead(b.x, b.z, 6)) continue;
        const top = b.kind === "zoog" ? b.y + ZH + 1.6 : b.y + (b.lift || 0) + size("shoggoth").h + 2.2, sy = b.say, lilt = b.kind === "zoog";
        E.billboard([b.x, top, b.z], (g, sx, py, k, e) => {
          const age = 1 - sy.t / sy.len, a = clamp(Math.min(age * 8, sy.t * 4), 0, 1);   // pops in, fades out
          const px = clamp(k * (lilt ? 0.9 : 1.1), 9, 22), hop = (1 - Math.min(1, age * 6)) * px * 0.4;
          g.font = (lilt ? "800 " : "700 italic ") + px.toFixed(1) + "px 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
          const w = g.measureText(sy.text).width + px * 1.1, h = px * 1.6, x0 = sx - w / 2, y0 = py - h - px * 0.6 - hop;
          g.globalAlpha = a;
          g.fillStyle = "#ffffff"; g.strokeStyle = "#111111"; g.lineWidth = Math.max(1.2, px * 0.1);
          g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, h * 0.45) : g.rect(x0, y0, w, h);
          g.moveTo(sx - px * 0.3, y0 + h); g.lineTo(sx - px * 0.05, y0 + h + px * 0.55); g.lineTo(sx + px * 0.25, y0 + h);   // its tail
          g.fill(); g.stroke();
          g.fillStyle = "#ffffff"; g.fillRect(sx - px * 0.25, y0 + h - g.lineWidth, px * 0.46, g.lineWidth * 1.5);   // open the bubble into its tail
          g.fillStyle = "#111111"; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(sy.text, sx, y0 + h / 2);
          g.globalAlpha = 1;
        }, { layer: 2, bias: 3, lit: true, sharp: true });
      }
    }

    /* ── motes: drifting lights where a scene is dark ─────────────────── */
    function makeMotes(def, rnd) {
      const out = [];
      if (!def) return out;
      for (let i = 0; i < def.n; i++) { const p = def.spot(rnd); out.push({ x: p[0], z: p[1], h: p[2], ph: rnd() * TAU }); }
      return out;
    }
    function buildMotes() {
      const def = S.life.motes;
      for (const m of motes) {
        const t = reduce ? 0 : E.t, [mx, mz] = ctx.at(m.x, m.z), z = mz + Math.sin(t * 0.23 + m.ph) * 3, x = mx + Math.sin(t * 0.31 + m.ph * 2) * 3;
        if (!ctx.ahead(x, z, 4)) continue;
        const fl = S.floorAt(x, z), top = S.ceilAt ? S.ceilAt(x, z) : fl + 22;
        const y = lerp(fl + 3, top - 3, m.h + Math.sin(t * 0.4 + m.ph) * 0.08);
        const pulse = reduce ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + m.ph * 3));
        E.billboard([x, y, z], (g, sx, sy, k, e) => {
          const a = pulse * (def.lit ? 1 : 1 - (e.fog ? e.fog.t : 0)), r = Math.max(1.2, 0.5 * k);   // a firefly is its own light
          g.fillStyle = rgba(def.glow, a * 0.3); g.beginPath(); g.arc(sx, sy, r * 3.2, 0, TAU); g.fill();
          g.fillStyle = rgba(def.core, a); g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
        }, { layer: 2 });
      }
    }

    /* ── signs ─────────────────────────────────────────────────────────── */
    const SIGN_FONT = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
    /* Signs wear their skin's format, as the iso kiosks do (theme-*.js
       kioskSign): the slime skins' leaf plaque; bureaucore's uppercase title
       on a white plate with a black border; gloomthmaxx's damaged neon
       marquee, a rusted board with neon letters, a couple dead and one
       flickering, that is its own light in the dark. */
    const NEONS = ["#36a89a", "#c64a8a", "#d6553e", "#4fd6c0"];
    const MARQUEE = "800 {px}px 'Arial Narrow','Helvetica Neue',Impact,sans-serif";
    // A sign's letters are s.font world units tall (the iso sign's own, at the
    // slime's ratio: 16 px is 3.8 units), so a sign is the size it is in the
    // iso world, nearer or further; without s.font, the old readable default.
    const fontPx = (s, k, dflt) => (s.font ? clamp(s.font * k, 4, 90) : clamp(k * 1.15, 7, 26));
    const vacuole = (g, s, sx, y0, w, h, style) => { if (s.float && window.MH_VACUOLE) window.MH_VACUOLE.draw(g, sx, y0, w, h, style, reduce ? 0 : E.t); };
    function signLeaf(g, s, P, sx, sy, k, e) {
      const px = fontPx(s, k);
      g.font = "700 " + px.toFixed(1) + "px " + SIGN_FONT;
      const tw = g.measureText(s.text).width, w = Math.max(px * 3, tw + px * 1.625), h = px * (s.sub ? 2.9 : 1.875);   // the iso pill: text + 26 px, 30 px tall
      const x0 = sx - w / 2, y0 = sy - h / 2;
      g.globalAlpha = 1 - (e.fog ? e.fog.t : 0);
      vacuole(g, s, sx, y0, w, h, "gel");
      M.leafPath(g, x0, y0, w, h); g.fillStyle = P.board || "#f6f4ee"; g.fill();
      g.lineWidth = Math.max(1, px * 0.1); g.strokeStyle = P.boardInk || P.ink; g.stroke();
      g.fillStyle = P.text || "#1a1a1a"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(s.text, sx, s.sub ? y0 + px * 1.05 : sy);
      if (s.sub) { g.font = "400 " + (px * 0.72).toFixed(1) + "px " + SIGN_FONT; g.fillText(s.sub, sx, y0 + px * 2.1); }
      g.globalAlpha = 1;
    }
    function signPlate(g, s, P, sx, sy, k, e) {
      const px = s.font ? clamp(s.font * k, 4, 90) : clamp(k * 1.05, 7, 24), label = s.text.toUpperCase();
      g.font = "800 " + px.toFixed(1) + "px 'Arial Black','Helvetica Neue',sans-serif";
      const w = g.measureText(label).width + px * 1.1, h = px * 1.45, x0 = sx - w / 2, y0 = sy - h / 2, bw = Math.max(1.5, px * 0.16);
      g.globalAlpha = 1 - (e.fog ? e.fog.t : 0);
      vacuole(g, s, sx, y0 - bw, w + 2 * bw, h + 2 * bw, "plain");
      const kL = clamp(h / 30, 0.3, 2);                                          // the brand leaf, as the iso plate wears it
      M.leafPath(g, x0 - bw, y0 - bw, w + 2 * bw, h + 2 * bw, kL); g.fillStyle = "#111111"; g.fill();
      const near = Math.hypot(wrapD(s.x - me.x), wrapD(s.z - me.z)) < 30;          // the plate lights cyan when the slime is near, as the active kiosk's does
      M.leafPath(g, x0, y0, w, h, kL); g.fillStyle = near ? "#c3f0ff" : "#ffffff"; g.fill();
      g.fillStyle = "#111111"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, sx, sy + px * 0.04);
      g.globalAlpha = 1;
    }
    function signNeon(g, s, P, sx, sy, k, e) {
      const px = s.font ? clamp(s.font * k, 4, 90) : clamp(k * 1.05, 7, 24), label = s.text.toUpperCase(), slot = s.slot || 0, t = reduce ? 0 : E.t;
      const neon = NEONS[Math.floor(hash(slot * 3 + 1) * NEONS.length)];
      let buzz = 1;
      if (!reduce) { const ft = t * 7.3 + slot * 2.1, w = Math.sin(ft) + 0.7 * Math.sin(ft * 2.7 + 1.3); buzz = w < -1.15 ? 0.1 : 0.66 + 0.34 * Math.sin(ft * 4.1); }
      g.font = MARQUEE.replace("{px}", px.toFixed(1));
      const n = label.length, gap = px * 0.12;
      let tw = 0; for (let i = 0; i < n; i++) tw += g.measureText(label[i]).width + gap;
      const bw = Math.max(px * 3.6, tw + px * 1.8), bh = px * 2.1, x0 = sx - bw / 2, y0 = sy - bh / 2;
      // distance takes it, the dark does not: a marquee is its own light
      const from = S.fogFrom || 90, fade = 1 - M.smooth(((e.depth || 0) - from) / (S.seen * 0.94 - from));
      g.globalAlpha = fade;
      vacuole(g, s, sx, y0, bw, bh, "night");
      const bloom = g.createRadialGradient(sx, sy, bh * 0.4, sx, sy, bw * 0.75);   // the board-shaped bloom, as a gradient
      bloom.addColorStop(0, rgba(neon, 0.28 + 0.3 * buzz)); bloom.addColorStop(1, rgba(neon, 0));
      g.fillStyle = bloom; g.beginPath(); g.ellipse(sx, sy, bw * 0.75, bh * 1.3, 0, 0, TAU); g.fill();
      const bg = g.createLinearGradient(0, y0, 0, y0 + bh);                         // the rusted backing board
      bg.addColorStop(0, "#231b12"); bg.addColorStop(0.55, "#15100a"); bg.addColorStop(1, "#0b0805");
      g.fillStyle = bg; M.leafPath(g, x0, y0, bw, bh); g.fill();
      g.lineWidth = Math.max(1, px * 0.07); g.strokeStyle = "rgba(205,191,154,0.18)"; g.stroke();
      const per = px < 9 ? -1 : Math.max(4, Math.round(bw / (px * 0.7)));          // bulbs: most dead, a few lit (too small to see far off: none)
      for (let i = 0; i <= per; i++) for (let row = 0; row < 2; row++) {
        const hb = hash(slot * 5 + i * 2 + row * 41), fx = x0 + px * 0.3 + (i / per) * (bw - px * 0.6), fy = row ? y0 + bh - px * 0.22 : y0 + px * 0.22;
        g.fillStyle = hb > 0.42 ? (hb > 0.7 ? "#ffcf6a" : neon) : "#191510";
        g.beginPath(); g.arc(fx, fy, Math.max(0.8, px * 0.11), 0, TAU); g.fill();
      }
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      const deadA = Math.floor(hash(slot * 7 + 2) * n), deadB = Math.floor(hash(slot * 11 + 5) * n), flick = Math.floor(hash(slot * 13 + 1) * n);
      let cx = sx - tw / 2 + gap / 2;
      for (let i = 0; i < n; i++) {
        const ch = label[i], cw = g.measureText(ch).width, gx = cx + cw / 2;
        let lit = n >= 3 && (i === deadA || i === deadB) ? 0 : 1;
        if (lit && !reduce && i === flick) lit = Math.sin(t * 17 + slot) > -0.2 ? 1 : 0.16;
        if (lit > 0.05) {
          g.lineWidth = Math.max(1.2, px * 0.2); g.strokeStyle = rgba(neon, 0.5 + 0.45 * buzz * lit); g.strokeText(ch, gx, sy);
          g.lineWidth = Math.max(0.6, px * 0.075); g.strokeStyle = rgba("#f6fffb", 0.55 + 0.4 * buzz * lit); g.strokeText(ch, gx, sy);
        } else { g.lineWidth = Math.max(0.8, px * 0.12); g.strokeStyle = "rgba(150,160,152,0.26)"; g.strokeText(ch, gx, sy); }
        cx += cw + gap;
      }
      g.globalAlpha = 1;
    }
    function buildSigns() {
      const style = S.signStyle === "plate" ? signPlate : S.signStyle === "neon" ? signNeon : signLeaf;
      for (const s0 of S.signs || []) {
        if (!ctx.ahead(s0.x, s0.z, 4)) continue;
        const [sx0, sz0] = ctx.at(s0.x, s0.z), s = Object.assign({}, s0, { x: sx0, z: sz0 });
        const P = S.pal(s.x, s.z), floor = S.floorAt(s.x, s.z), y = s.y == null ? floor + 6 : s.y;
        if (s.post !== false) E.line([[s.x, floor, s.z], [s.x, y - 0.6, s.z]], P.boardInk || P.ink, 0.24, { layer: 2, world: true });
        // A floating sign's tether runs from the roof up to the board, as the iso
        // connector does. It is drawn with the sign, from the roof's point on the
        // screen to the board's middle (the board covers the rest), so the two
        // always meet: a sign's size is capped on screen when near, and a tether
        // measured in the world fell short of it.
        const tetherCol = S.signStyle === "neon" ? "#1b160e" : S.signStyle === "plate" ? "#111111" : "#ff6e8c";
        const roof = s.tether != null ? [s.x, s.tether, s.z] : null;
        E.billboard([s.x, y, s.z], (g, sx, sy, k, e) => {
          if (roof) {
            const r = E.project(roof);
            if (r) {
              g.globalAlpha = S.signStyle === "neon" ? 1 : 1 - (e.fog ? e.fog.t : 0);
              g.strokeStyle = tetherCol; g.lineCap = "round"; g.lineWidth = Math.max(1, k * (S.signStyle === "plate" ? 0.14 : 0.24));
              g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(sx, sy); g.stroke();
              g.globalAlpha = 1;
            }
          }
          style(g, s, P, sx, sy, k, e);
        }, { layer: 2, bias: 2, lit: S.signStyle === "neon", sharp: true });   // a sign stays readable
      }
    }

    /* ── sound: the slime's step ────────────────────────────────────────
       The iso world's step (engine.js sfx.step) as it was before it was made
       subtler (see stepSound), about twice a second while the slime moves, in the skin's
       key (S.audio: root). No sound until the visitor's first key or click, as
       browsers require; W.setMuted turns it off. */
    const sound = { ctx: null, master: null, muted: !!opts.muted, lastPhase: 0 };
    function soundOn() {
      if (sound.ctx || sound.muted) { if (sound.ctx && sound.ctx.state === "suspended") sound.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AC) return;
      try {
        sound.ctx = new AC(); sound.master = sound.ctx.createGain(); sound.master.gain.value = 0.8;
        // a low-pass rounds off the triangle's buzz: the same squelch, less abrasive
        const soft = sound.ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 900; soft.Q.value = 0.5;
        sound.master.connect(soft); soft.connect(sound.ctx.destination);
      } catch (e) { sound.ctx = null; }
    }
    function tone(f, gain, dur, delay, type) {
      const c = sound.ctx;
      if (!c || !sound.master || sound.muted || c.state !== "running") return;
      const t = c.currentTime + (delay || 0), osc = c.createOscillator(), g = c.createGain();
      osc.type = type || "sine"; osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // a soft attack: no click
      osc.connect(g); g.connect(sound.master); osc.start(t); osc.stop(t + dur + 0.03);
    }
    /** One step at each crest of the iso world's walking beat (sin(t * 12) past 0.93). */
    function stepSound() {
      const moving = Math.abs(me.speed) > 1 && !fade, ph = Math.sin(E.t * 12) > 0.93;
      // a place with no key of its own (the cave, shared by every skin) takes the skin's (theme-*.js audio.root)
      if (moving && ph && !sound.lastPhase) sound.steps = (sound.steps || 0) + 1;
      // The site's earlier step, the slimy one (before the 12f64f8 "subtler sound"
      // change): a triangle, gain 0.03 through a 0.8 master, a 10 ms attack, and
      // fired on EVERY frame the beat stood past its crest, which at 60 frames a
      // second is four blips smeared into one wet "blorp". Scheduled four at 1/60 s
      // apart here, so it squelches the same whatever the frame rate.
      if (moving && ph && !sound.lastPhase) {
        const f = (S.audio && S.audio.root) || ({ technurture: 261.63, technoscure: 196.0, technocute: 277.18 })[skin] || 261.63;
        for (let i = 0; i < 4; i++) tone(f, 0.022, 0.06, i / 60, "triangle");   // a touch quieter and longer than the site's was: softer
      }
      sound.lastPhase = ph ? 1 : 0;
    }
    for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, soundOn, { passive: true });

    /* ── the walk, the camera, the portals ─────────────────────────────── */
    const C = E.controls(canvas, { dist: 58, minDist: 14, maxDist: 150, when: opts.keysWhen });
    /** Where a click sends the body: the first ground, wall or roof the ray
     *  through that point meets, kept walkable and out of anything solid. */
    function floorHit(sx, sy) {
      const [o, d] = E.ray(sx, sy);
      let hit = null;
      for (let t = 2; t < S.seen * 1.4; t += 1.5) {
        const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
        if (y <= S.floorAt(x, z) || (S.ceilAt && y >= S.ceilAt(x, z)) || !S.walkable(x, z)) { hit = { x, z }; break; }
      }
      if (!hit) {
        if (Math.hypot(d[0], d[2]) < 0.2) return null;
        hit = { x: o[0] + d[0] * 40, z: o[2] + d[2] * 40 };
      }
      const b = { x: hit.x, z: hit.z, R: me.R };
      S.bound(b); collide(b);
      return { x: b.x, z: b.z };
    }
    /* Clicking to walk. The camera holds the heading it has while the body
       walks to a click, so the view does not swing with every turn the body
       makes; when the walk ends it eases back behind the body, slowly. And a
       click is never a way to turn round: a goal that falls behind the body
       (a click low in the frame, on the ground between camera and slime) is
       moved to just ahead of it, keeping its sideways offset.               */
    const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
    let camLook = 0, viewYaw = 0;
    /** A click on a house (anything a place lists as clickable) opens it, as a
     *  click on an iso kiosk does: the ray is marched out until it enters one. */
    function clickHit(sx, sy) {
      const list = S.clickables ? S.clickables() : null;
      if (!list || !list.length || !opts.onOpen) return null;
      const [o, d] = E.ray(sx, sy);
      for (let t = 1; t < S.seen; t += 0.8) {
        const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
        if (y < S.floorAt(x, z) - 0.5) return null;              // into the ground first: the click is for walking
        for (const q of list) {
          const r = Math.hypot(wrapD(x - q.x), wrapD(z - q.z)), up = y - S.floorAt(q.x, q.z);
          if (up >= 0 && up <= q.h && r <= (q.radAt ? q.radAt(up) : q.r)) return q;
        }
      }
      return null;
    }
    C.onTap = (sx, sy) => {
      if (fade) return;
      const hit = clickHit(sx, sy);
      if (hit) { opts.onOpen(hit.item, { click: true }); return; }
      const h = floorHit(sx, sy);
      if (!h) return;
      const fx = Math.sin(E.cam.yaw), fz = Math.cos(E.cam.yaw);
      const along = (h.x - me.x) * fx + (h.z - me.z) * fz, AHEAD = 6;
      if (along < AHEAD) {
        h.x += fx * (AHEAD - along); h.z += fz * (AHEAD - along);
        const b = { x: h.x, z: h.z, R: me.R };
        S.bound(b); collide(b);
        h.x = b.x; h.z = b.z;
      }
      viewYaw = me.yaw + camLook - C.look;                    // the heading the camera keeps meanwhile
      me.goal = h; me.goalBest = Infinity; me.stuck = 0;
    };

    let boom = 0, snap = true, armed = false;
    /** @type {null | {t:number, to:string, entry:string, loaded:boolean}} */
    let fade = null;
    function step(dt) {
      const k = C.keys;
      let turn = (k.right ? 1 : 0) - (k.left ? 1 : 0), want = (k.fwd ? 1 : 0) - (k.back ? 1 : 0);
      if (fade) { turn = 0; want = 0; me.goal = null; }
      if (turn || want) me.goal = null;
      if (me.goal) {
        const dx = me.goal.x - me.x, dz = me.goal.z - me.z, dist = Math.hypot(dx, dz);
        if (dist < me.goalBest - 0.08) { me.goalBest = dist; me.stuck = 0; } else me.stuck += dt;
        if (dist < 2.2 || me.stuck > 1.2) me.goal = null;
        else {
          let dy = Math.atan2(dx, dz) - me.yaw;
          while (dy > Math.PI) dy -= TAU;
          while (dy < -Math.PI) dy += TAU;
          turn = clamp(dy * 3, -1, 1); want = Math.abs(dy) < 1.2 ? 1 : 0;
        }
      }
      me.yaw += turn * dt * 1.9;
      const top = k.fast ? 34 : 17;
      me.speed += (want * top - me.speed) * Math.min(1, dt * 6);
      me.pool = poolAt(me.x, me.z);
      if (Math.abs(me.speed) > 0.01) {
        const wet = me.pool ? 0.55 : 1;
        if (me.pool && Math.abs(me.speed) > 3) disturb(me.pool, me.x, me.z, me.speed * 0.05);
        if (me.pool) me.ripple = (me.ripple + dt * 0.9) % 1;
        me.x += Math.sin(me.yaw) * me.speed * dt * wet;
        me.z += Math.cos(me.yaw) * me.speed * dt * wet;
        collide(me);
        S.bound(me);
        me.bob = reduce ? 0 : Math.abs(Math.sin(E.t * 7)) * 0.3 * clamp(Math.abs(me.speed) / 17, 0, 1);
      } else { me.bob = 0; if (me.pool) me.ripple = me.ripple > 0.02 ? (me.ripple + dt * 0.9) % 1 : 0; }
      if (!me.pool) me.ripple = 0;
      me.y = S.floorAt(me.x, me.z);
      stepZoogs(dt); stepShoggoths(dt); resolveBodies(); stepWater(dt);
      stepSound();
      // portals: armed once the body has stepped clear of every one, so it
      // never arrives in a scene only to be sent straight back
      let inAny = null;
      for (const q of S.portals || []) if (Math.hypot(wrapD(me.x - q.x), wrapD(me.z - q.z)) < q.r) { inAny = q; break; }
      if (!inAny) armed = true;
      else if (armed && !fade) {
        if (inAny.open) {                                      // a door that opens a menu or a page, as the iso house does
          armed = false; me.speed = 0; me.goal = null;           // it fires once: step away and back to open it again
          if (opts.onOpen) opts.onOpen(inAny.open);
        } else {
          // a way with `back` (a house's door) is remembered under the place being
          // left, so the way back out of where it leads (entry "back") returns to that door
          if (inAny.back) backs[id] = { scene: id, at: inAny.back };
          fade = { t: 0, to: inAny.to, entry: inAny.entry, loaded: false };
        }
      }
      if (PER) {                                               // across the seam: everything moves back a whole period
        const sx = -PER * Math.round(me.x / PER), sz = -PER * Math.round(me.z / PER);
        if (sx || sz) {
          me.x += sx; me.z += sz; E.cam.x += sx; E.cam.z += sz;
          if (me.goal) { me.goal.x += sx; me.goal.z += sz; }
        }
        for (const b of zoogs) { b.x = img(b.x, me.x); b.z = img(b.z, me.z); }
        for (const b of shogs) {
          const ox = img(b.x, me.x) - b.x, oz = img(b.z, me.z) - b.z;
          b.x += ox; b.z += oz;
          for (const a of b.arms) if (a.anchor) { a.anchor.x += ox; a.anchor.z += oz; }
        }
      }
      const cam = S.camera || {};
      if (me.goal) camLook = wrap(viewYaw - me.yaw) + C.look;
      else camLook += (C.look - camLook) * Math.min(1, dt * (reduce ? 60 : 1.2));
      boom = E.follow(me, { dist: C.dist, height: cam.height ? cam.height(C.dist, me.x, me.z) : Math.min(C.dist * 0.3, 18), aim: 3.4,
        look: camLook, tilt: C.tilt, inside: camOpen, hard: (x, y, z) => S.open(x, y, z), ease: snap ? 1e6 : reduce ? 60 : 5, step: 2, minDist: 6 });
      snap = false;
    }

    /** One skin's creatures handed to another's: same places, the new skin's ways. */
    function carryOver(a, b) {
      for (let i = 0; i < Math.min(a.zoogs.length, b.zoogs.length); i++) {
        const o = a.zoogs[i], z = b.zoogs[i];
        Object.assign(z, { x: o.x, z: o.z, yaw: o.yaw, alive: o.alive, dead: o.dead, vx: 0, vz: 0 });
      }
      for (let i = 0; i < Math.min(a.shogs.length, b.shogs.length); i++) {
        const o = a.shogs[i], s = b.shogs[i];
        Object.assign(s, { x: o.x, z: o.z, yaw: o.yaw, vx: 0, vz: 0, target: null, lift: 0 });
        for (const arm of s.arms) {                             // rooted: its roots go down where it now stands; awake: it reaches out afresh
          arm.age = 0;
          if (s.dormant) { const ang = s.yaw + arm.base, r = arm.reach * 0.62; arm.anchor = { x: s.x + Math.sin(ang) * r, z: s.z + Math.cos(ang) * r }; }
          else arm.anchor = null;
        }
      }
    }
    /** Enter a scene at one of its entries. Its state is made once and kept. */
    /* Skins. A place may have a variant per skin of the iso world, registered
       as "name@skin" (outdoors@technoscure); load("outdoors") finds the one
       for the current skin, and falls back to the plain name. Ways between
       places name the plain place, so a house's door leads into that skin's
       interior. */
    let skin = opts.skin || "technurture";
    const resolve = (name) => (SCENES[name + "@" + skin] ? name + "@" + skin : name);
    function load(sceneId, entry) {
      sceneId = resolve(sceneId);
      const def = SCENES[sceneId];
      if (!def) return false;
      let st = states[sceneId];
      if (!st) {
        const prev = S, prevPer = PER;
        st = { S: def.setup(ctx) };
        S = st.S; PER = S.period || 0;
        let seed = 1;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        st.pools = (S.pools || []).map(makePool);
        pools = st.pools;
        const solids = (S.solids || []).slice();
        for (const sg of S.signs || []) if (sg.post !== false) solids.push({ x: sg.x, z: sg.z, r: 0.5, h: 7 });   // a sign's post
        st.grid = buildGrid(solids);
        grid = st.grid;
        const life = S.life || {};
        st.zoogs = life.zoogs ? makeZoogs(life.zoogs, rnd) : [];
        st.shogs = life.shoggoths ? makeShoggoths(life.shoggoths, rnd, life.dormant) : [];
        st.motes = makeMotes(life.motes, rnd);
        states[sceneId] = st;
        S = prev; PER = prevPer;
      }
      S = st.S; id = sceneId; pools = st.pools; grid = st.grid; zoogs = st.zoogs; shogs = st.shogs; motes = st.motes;
      PER = S.period || 0;
      SEA = S.sea ? { sea: true, level: S.sea.level, x: 0, z: 0 } : null;
      const back = entry === "back" && backs[sceneId] ? backs[sceneId].at : null;
      const at = back || (typeof entry === "object" && entry) || (S.entries && (S.entries[entry] || S.entries.start)) || { x: 0, z: 0, yaw: 0 };
      camLook = 0;
      me.x = at.x; me.z = at.z; me.yaw = at.yaw; me.speed = 0; me.goal = null; me.pool = null; me.ripple = 0;
      if (typeof entry === "object" && entry) { S.bound(me); collide(me); }   // a spot carried from elsewhere: kept inside this place
      me.y = S.floorAt(me.x, me.z);
      C.look = 0; C.tilt = 0;
      if (S.camera && S.camera.dist) C.dist = S.camera.dist;
      E.focus = S.focus || null;                               // depth of field, where the place asks for it
      // The fog reaches the air's full colour a little short of where the scene
      // stops drawing, measured as distance from the camera (not view depth, which
      // is shorter to the side), so nothing appears at the edge: it comes up out
      // of the air.
      const from = S.fogFrom == null ? 36 : S.fogFrom, to = S.seen * 0.94;
      E.fog = S.fog || ((p, d) => {
        const c = E.cam, dist = Math.hypot(p[0] - c.x, p[1] - c.y, p[2] - c.z);
        return { t: M.smooth((dist - from) / (to - from)), colour: S.pal(p[0], p[2]).air };
      });
      snap = true; armed = false; E.boomLen = null;
      if (opts.onScene) opts.onScene(id);
      return true;
    }

    const hud = opts.hud || null;
    let fps = 60, cost = 0;
    function frame(dt) {
      if (fade) {                                                // out, load the next scene, and back in
        fade.t += dt;
        if (!fade.loaded && fade.t >= 0.28) { load(fade.to, fade.entry); fade.loaded = true; }
        if (fade.t >= 0.62) fade = null;
      }
      const t0 = performance.now();
      step(dt);
      // floor blobs sort along the way the camera faces, snapped to eight headings
      const oct = Math.round(E.cam.yaw / (Math.PI / 4)) * (Math.PI / 4);
      E.stableAxis = [Math.sin(oct), Math.cos(oct)];
      E.begin();
      S.sky(E.g);
      S.build();
      E.see = [me.x, me.y + me.R, me.z];                      // what stands between it and the camera is drawn see-through
      buildWater(); buildZoogs(); buildShoggoths(); buildMotes(); buildPlayer(); buildSigns(); buildBubbles();
      E.paint();
      if (fade) {
        const a = fade.t < 0.28 ? fade.t / 0.28 : Math.max(0, 1 - (fade.t - 0.28) / 0.34);
        E.g.fillStyle = "rgba(6,10,8," + a.toFixed(3) + ")"; E.g.fillRect(0, 0, E.W, E.H);
      }
      if (opts.onFrame) opts.onFrame();                        // the host page's turn: syncing another view, say
      cost = cost * 0.9 + 0.1 * (performance.now() - t0);
      if (hud) {
        fps = fps * 0.92 + 0.08 / Math.max(0.001, dt);
        hud.textContent = Math.round(fps) + " fps · " + cost.toFixed(1) + " ms · " + E.tally.drawn + " drawn";
      }
    }

    const W = {
      engine: E, me, controls: C, ctx, stats,
      load, scene: () => id, S: () => S, scenes: () => Object.keys(SCENES),
      skin: () => skin,
      /** Say where a place's way back ("back") leads, for a page that starts
       *  inside: setBack("outdoors", "house5") returns to that house's door. */
      setBack(place, entryName) {
        const pid = resolve(place);
        if (!states[pid]) { const cur = id, at = { x: me.x, z: me.z, yaw: me.yaw }; load(place, "start"); if (cur) load(cur, at); }
        const S2 = states[pid] && states[pid].S, at2 = S2 && S2.entries && S2.entries[entryName];
        if (at2) backs[pid] = { scene: pid, at: at2 };
        return !!at2;
      },
      /** Change skin and stay where you are, in this skin's version of the same
       *  place, as the iso world keeps the slime's spot across skins. Outdoors the
       *  creatures carry across too: the zoogs where they were, and the
       *  shoggoths where they stood, rooting or waking as the new skin has them. */
      setSkin(k) {
        const base = id.split("@")[0], oldSt = states[id], at = { x: me.x, z: me.z, yaw: me.yaw };
        skin = k;
        const ok = load(base, at);
        const newSt = states[id];
        if (ok && oldSt && newSt && newSt !== oldSt && base === "outdoors") carryOver(oldSt, newSt);
        return ok;
      },
      pools: () => pools, zoogs: () => zoogs, shoggoths: () => shogs,
      floorHit, poolAt, waterY, inPool, collide, camOpen,
      tick: (dt) => { E.dt = dt || 0.016; E.t += E.dt; frame(E.dt); },
      run: () => E.run(frame), pause: E.pause, resume: () => E.run(frame),
      cost: () => cost, boom: () => boom, fading: () => !!fade,
      setMuted(m) { sound.muted = !!m; if (sound.master && sound.ctx) sound.master.gain.setTargetAtTime(m ? 0 : 0.8, sound.ctx.currentTime, 0.02); if (!m) soundOn(); },
      muted: () => sound.muted, audioContext: () => sound.ctx, steps: () => sound.steps || 0,   // steps sounded (or due, where audio is held)
    };
    return W;
  }

  window.MH_VERSE3D = { PHOTO, ISO, create, defineScene, scenes: SCENES, hash, hash2, GEL, ZOOG, SHOG, UNIT, ENTER, SIZES, size, DWELL };
})();
