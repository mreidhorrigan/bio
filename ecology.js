// @ts-check
"use strict";
/* ============================================================================
   ecology.js  —  an optional, computationally-bounded ARTIFICIAL-LIFE layer for
   the iso world. Sets window.MH_ECO; the engine drives it through three hooks
   (update / groundTint / actors) only when present + enabled, so it costs nothing
   on the plain skins.

   THE MODEL  (local rules → emergence, bounded so it never overloads):
     • FLORA — a Float32Array(P×P) density field. Regrows logistically and SPREADS
       from vegetated neighbours; grazers eat it. This is the substrate that
       gradually changes the world (lush ↔ bare, like desire paths/grazing scars).
     • MOTES — flocking boids (separation / alignment / cohesion + wander). Pure
       emergent motion (murmurations). They don't touch the world.
     • GRAZERS — herbivores: climb the flora gradient, eat, gain energy, breed when
       fed, starve when not, flee predators. Their numbers track the flora.
     • PREDATORS — chase grazers, breed, starve. Predator+grazer+flora close a
       Lotka-Volterra-ish loop: populations rise and fall in waves.
   A thin "immigration" trickle keeps any population from hitting absolute zero, so
   the cycles persist instead of flat-lining.

   PERFORMANCE  (the brief: change the world without overloading it):
     • Brains + flock + spatial-hash rebuild run at a low SIM tick (~6 Hz); the
       flora cellular pass even lower (~3 Hz). Only POSITION integration runs every
       frame, so motion stays smooth while thinking stays cheap.
     • Neighbour queries use a wrapped spatial-hash grid (toroidal), not O(n²).
     • Hard population caps + object pooling (no per-spawn allocation, low GC).
     • Rendering is culled to the viewport. Totals stay in the low hundreds, and a
       P≈54 flora field is ~3k floats — microseconds per tick.

   Tunable: edit MH_ECO.cfg before the first frame (the experiment pages do this to
   stage boids → grazers → predator-prey → full). See ecology/ + ecology/NOTES.md.
   ========================================================================== */

(function () {
  const U = window.MH_ISO.util;
  const INK = "#0a0e0a";   // near-black ink — matches the avatar slime's outline (engine.js defPaintAvatar)

  const ECO = {
    enabled: true,
    showFlora: true,                 // draw the grazed/lush ground wash
    cfg: {
      motes: 70, moteCap: 100,
      grazerStart: 24, grazerCap: 70,
      predatorStart: 5, predatorCap: 14,
      simHz: 6, floraHz: 3, hashCell: 3,
      moteSpeed: 1.5, grazerSpeed: 1.0, predatorSpeed: 1.25,   // slow + calm, not distracting
      turn: 0.16,                                              // steering inertia (lower = calmer, more glide)
      sight: 7, sep: 1.3,
      restChance: 0.18, herd: 0.12,                            // rest/activity budget + loose herding (not tight flocking)
      fearAvoid: 2.2, fearDecay: 0.8,                          // landscape of fear: avoid risky PLACES, not chase
      seedFrac: 0.4, seedDrop: 0.16,                           // plant-animal mutualism: creatures re-seed as they roam
      curiosity: 0.8,                                          // prey + motes drift toward the player a bit more (parts when you get close)
      fireflies: 0, fireflySpeed: 0.6,                         // firefly-like glowing drifters (technoscure)
      floraRegrow: 0.9, floraSpread: 0.6, floraBase: 0.12,
      grazeRate: 0.9, grazeGain: 1.4, grazerMeta: 0.16, grazerBreed: 1.7, grazerStartE: 1.0,
      predGain: 2.2, predMeta: 0.14, predBreed: 2.6, predStartE: 1.4, predCatch: 0.16,   // must fully mask the prey (absorb) before eating
      predatorDormant: false,                                  // technurture sets true: predators become rooted, inert "scary plants" (no move/hunt/breed/flee/collide/immigrate)
    },
    // state (filled by init)
    P: 0, flora: null, floraNext: null, fear: null, fearNext: null, inited: false, now: 0,
    motes: [], grazers: [], predators: [], fireflies: [], pools: { m: [], g: [], p: [], f: [] },
    acc: 0, facc: 0, grid: new Map(), ncells: 1,
    stats: { grazers: 0, predators: 0, flora: 0 },
  };

  /* --- helpers ------------------------------------------------------------- */
  const wi = (v) => { const P = ECO.P; v = Math.floor(v) % P; return v < 0 ? v + P : v; };
  const fidx = (x, y) => wi(y) * ECO.P + wi(x);
  const wd = (d) => { const P = ECO.P; d = ((d % P) + P) % P; return d > P / 2 ? d - P : d; };
  const wpos = (v) => { const P = ECO.P; v %= P; return v < 0 ? v + P : v; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function take(pool) { return pool.pop() || { x: 0, y: 0, vx: 0, vy: 0, e: 1, alive: true }; }
  function put(pool, e) { e.alive = false; pool.push(e); }

  function spawn(arr, pool, x, y, e) {
    const o = take(pool); o.x = wpos(x); o.y = wpos(y);
    const a = rnd(0, Math.PI * 2); o.vx = Math.cos(a); o.vy = Math.sin(a); o.e = e; o.alive = true;
    o.seed = 0; o.rest = 0; o.eat = 0; o.prey = null; o.phase = Math.random() * 6.283;
    o.dormant = (pool === ECO.pools.p) && !!ECO.cfg.predatorDormant;   // stable per-beast: a predator born under a dormant cfg stays a "plant" for its life
    arr.push(o); return o;
  }

  function init(P) {
    ECO.P = P;
    ECO.flora = new Float32Array(P * P); ECO.floraNext = new Float32Array(P * P);
    ECO.fear = new Float32Array(P * P); ECO.fearNext = new Float32Array(P * P);
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) ECO.flora[y * P + x] = Math.min(1, 0.25 + 0.75 * U.noise01(x, y, 6.5));
    ECO.motes.length = ECO.grazers.length = ECO.predators.length = ECO.fireflies.length = 0;
    const c = ECO.cfg;
    // anchor wildlife near the plaza so the player actually MEETS it (predators were spawning across the torus + kept out of the village → never on-screen)
    const hx = ECO.hub ? ECO.hub.x : P / 2, hy = ECO.hub ? ECO.hub.y : P / 2, vR = ECO.villageR || 5.5;
    const ring = (lo, hi) => { const a = rnd(0, 6.283), d = rnd(lo, hi); return [wpos(hx + Math.cos(a) * d), wpos(hy + Math.sin(a) * d)]; };
    for (let i = 0; i < c.motes; i++) spawn(ECO.motes, ECO.pools.m, rnd(0, P), rnd(0, P), 1);
    for (let i = 0; i < (c.fireflies || 0); i++) spawn(ECO.fireflies, ECO.pools.f, rnd(0, P), rnd(0, P), 1);
    for (let i = 0; i < c.grazerStart; i++) { const p = (i & 1) ? ring(vR, vR + 12) : [rnd(0, P), rnd(0, P)]; spawn(ECO.grazers, ECO.pools.g, p[0], p[1], c.grazerStartE); }   // ~half ring the plaza → prey for predators to hunt where the player roams
    for (let i = 0; i < c.predatorStart; i++) { const p = ring(vR + 1, vR + 9); spawn(ECO.predators, ECO.pools.p, p[0], p[1], c.predStartE); }   // just outside the keep-out, in view (dormant ones simply stay rooted here)
    ECO.ncells = Math.max(1, Math.ceil(P / c.hashCell));
    ECO.inited = true;
  }

  /* --- spatial hash (toroidal) --------------------------------------------- */
  const cellOf = (v) => ((Math.floor(v / ECO.cfg.hashCell) % ECO.ncells) + ECO.ncells) % ECO.ncells;
  function rebuildGrid() {
    const g = ECO.grid; g.clear();
    const add = (e, tag) => { const k = cellOf(e.x) * 4096 + cellOf(e.y); let b = g.get(k); if (!b) g.set(k, b = []); b.push(e); e.tag = tag; };
    for (const e of ECO.motes) add(e, 0);
    for (const e of ECO.grazers) add(e, 1);
    for (const e of ECO.predators) add(e, 2);
  }
  /** call fn(other) for entities within ~r tiles of (x,y) (3×3 cell scan, wrapped) */
  function near(x, y, r, fn) {
    const cx = cellOf(x), cy = cellOf(y), nc = ECO.ncells;
    for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
      const k = (((cx + ix) % nc + nc) % nc) * 4096 + (((cy + iy) % nc + nc) % nc);
      const b = ECO.grid.get(k); if (!b) continue;
      for (const o of b) fn(o);
    }
  }

  /* --- steering ------------------------------------------------------------ */
  // ease velocity toward the desired heading (inertia) — gliding, not snapping
  function setVel(e, dx, dy, spd) { const m = Math.hypot(dx, dy) || 1, t = ECO.cfg.turn; e.vx += ((dx / m) * spd - e.vx) * t; e.vy += ((dy / m) * spd - e.vy) * t; }

  function thinkMote(e, c, px, py) {
    let sx = 0, sy = 0, ax = 0, ay = 0, cxs = 0, cys = 0, n = 0;
    near(e.x, e.y, 3, (o) => {
      if (o === e || o.tag !== 0) return;
      const dx = wd(o.x - e.x), dy = wd(o.y - e.y), d = Math.hypot(dx, dy);
      if (d > 3) return;
      if (d < c.sep) { sx -= dx / (d || 1); sy -= dy / (d || 1); }   // separation
      ax += o.vx; ay += o.vy; cxs += dx; cys += dy; n++;              // alignment + cohesion (rel.)
    });
    let dx = e.vx, dy = e.vy;
    if (n) { dx += sx * 1.6 + (ax / n) * 0.6 + (cxs / n) * 0.25; dy += sy * 1.6 + (ay / n) * 0.6 + (cys / n) * 0.25; }
    dx += rnd(-0.22, 0.22); dy += rnd(-0.22, 0.22);                   // gentle wander
    const pdx = wd(px - e.x), pdy = wd(py - e.y), pd = Math.hypot(pdx, pdy) || 1;   // curious: drift toward you, part when close
    if (pd < 1.5) { dx -= pdx / pd; dy -= pdy / pd; }
    else if (pd < 7) { dx += (pdx / pd) * 0.5 * c.curiosity; dy += (pdy / pd) * 0.5 * c.curiosity; }
    setVel(e, dx, dy, c.moteSpeed);
  }

  function thinkFirefly(e, c, px, py) {                               // gentle drift + a soft pull toward the player
    let dx = e.vx + rnd(-0.4, 0.4), dy = e.vy + rnd(-0.4, 0.4);
    const pdx = wd(px - e.x), pdy = wd(py - e.y), pd = Math.hypot(pdx, pdy) || 1;
    if (pd < 6) { dx += (pdx / pd) * 0.3 * c.curiosity; dy += (pdy / pd) * 0.3 * c.curiosity; }
    setVel(e, dx, dy, c.fireflySpeed);
  }

  function thinkGrazer(e, c, dtS, px, py) {
    if (e.rest > 0) { e.rest -= dtS; setVel(e, 0, 0, 0); }             // resting: ease to a stop (still browses below)
    else {
      const fi = fidx(e.x, e.y), hereF = ECO.flora[fi], hereFear = ECO.fear[fi];
      let dx = 0, dy = 0;
      for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {            // climb the flora gradient, descend the fear gradient
        const j = fidx(e.x + o[0] * 1.5, e.y + o[1] * 1.5);
        dx += o[0] * ((ECO.flora[j] - hereF) - (ECO.fear[j] - hereFear) * c.fearAvoid);
        dy += o[1] * ((ECO.flora[j] - hereF) - (ECO.fear[j] - hereFear) * c.fearAvoid);
      }
      let cxs = 0, cys = 0, n = 0, restingN = 0;                       // loose herd + separation + flee + copy-neighbours' rest
      near(e.x, e.y, c.sight, (o) => {
        if (o === e) return;
        const ddx = wd(o.x - e.x), ddy = wd(o.y - e.y), d = Math.hypot(ddx, ddy) || 1;
        if (o.tag === 1) { if (d < c.sep) { dx -= ddx / d; dy -= ddy / d; } cxs += ddx; cys += ddy; n++; if (o.rest > 0) restingN++; }
        else if (o.tag === 2 && !o.dormant && d < 2.2) { dx -= (ddx / d) * (2.4 / d); dy -= (ddy / d) * (2.4 / d); }   // dormant "plant" predators are inert scenery — no fleeing them
      });
      if (n) { dx += (cxs / n) * c.herd; dy += (cys / n) * c.herd; }
      const pdx = wd(px - e.x), pdy = wd(py - e.y), pd = Math.hypot(pdx, pdy) || 1;   // curious: drift toward you, part when very close
      if (pd < 1.6) { dx -= pdx / pd; dy -= pdy / pd; }
      else if (pd < c.sight) { dx += (pdx / pd) * 0.5 * c.curiosity; dy += (pdy / pd) * 0.5 * c.curiosity; }
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) { dx = e.vx; dy = e.vy; }
      setVel(e, dx, dy, c.grazerSpeed);
      if (Math.random() < c.restChance * (1 + 2 * (restingN / Math.max(1, n))) * dtS) e.rest = rnd(1.5, 4);   // settle together
    }
    // browse + re-seed as it roams (mutualism) + metabolise + breed / starve
    const fi2 = fidx(e.x, e.y), eaten = Math.min(ECO.flora[fi2], c.grazeRate * dtS);
    ECO.flora[fi2] -= eaten; e.e += eaten * c.grazeGain - c.grazerMeta * dtS;
    e.seed += eaten * c.seedFrac;
    const drop = Math.min(e.seed, c.seedDrop * dtS); ECO.flora[fi2] = Math.min(1, ECO.flora[fi2] + drop); e.seed -= drop;
    if (e.e > c.grazerBreed && ECO.grazers.length < c.grazerCap) { e.e *= 0.5; spawn(ECO.grazers, ECO.pools.g, e.x, e.y, e.e); }   // fission: splits from the exact same spot
    if (e.e <= 0) e.alive = false;
  }

  function thinkPredator(e, c, dtS) {
    if (e.dormant) return;                                             // rooted "plant" predator: no scent, no hunt, no breed, no move — just stands there
    ECO.fear[fidx(e.x, e.y)] = 1;                                      // leaves a "fear" scent where it prowls (the herd reads it)
    e.prey = null;                                                     // recomputed below; while resting it collides with every prey
    if (e.eat > 0) e.eat -= dtS;                                       // eat-pulse decay
    if (e.rest > 0) { e.rest -= dtS; setVel(e, 0, 0, 0); }
    else {
      let tgt = null, td = c.sight;
      near(e.x, e.y, c.sight, (o) => { if (o.tag !== 1 || !o.alive) return; const d = Math.hypot(wd(o.x - e.x), wd(o.y - e.y)); if (d < td) { td = d; tgt = o; } });
      e.prey = tgt;                                                    // the one prey it's engulfing — exempt from body collision so the strike can land
      if (tgt) { const lunge = td < 0.55 ? 1.5 : 1; setVel(e, wd(tgt.x - e.x), wd(tgt.y - e.y), c.predatorSpeed * lunge); if (td < c.predCatch) { tgt.alive = false; e.e += c.predGain; e.eat = 0.4; } }   // lunge to mask, then absorb (eat-pulse)
      else { setVel(e, e.vx + rnd(-0.3, 0.3), e.vy + rnd(-0.3, 0.3), c.predatorSpeed * 0.65); if (Math.random() < c.restChance * 0.4 * dtS) e.rest = rnd(2, 5); }
    }
    // keep predators apart (separation) and OUT of the central village
    let ax = 0, ay = 0;
    for (const o of ECO.predators) { if (o === e || !o.alive) continue; const ox = wd(e.x - o.x), oy = wd(e.y - o.y), od = Math.hypot(ox, oy); if (od > 1e-3 && od < 3.2) { ax += ox / (od * od); ay += oy / (od * od); } }
    if (ECO.hub) {
      const hx = wd(e.x - ECO.hub.x), hy = wd(e.y - ECO.hub.y), hd = Math.hypot(hx, hy);
      if (hd < ECO.villageR && hd > 1e-3) { const f = (ECO.villageR - hd) / ECO.villageR; ax += hx / hd * f * 7; ay += hy / hd * f * 7; e.x = wpos(ECO.hub.x + hx / hd * ECO.villageR); e.y = wpos(ECO.hub.y + hy / hd * ECO.villageR); }   // hard keep-out
    }
    if (ax || ay) { e.vx += ax * c.predatorSpeed * 0.5; e.vy += ay * c.predatorSpeed * 0.5; const sp = Math.hypot(e.vx, e.vy), mx = c.predatorSpeed * 1.6; if (sp > mx) { e.vx = e.vx / sp * mx; e.vy = e.vy / sp * mx; } }
    e.e -= c.predMeta * dtS;
    if (e.e > c.predBreed && ECO.predators.length < c.predatorCap) { e.e *= 0.5; spawn(ECO.predators, ECO.pools.p, e.x, e.y, e.e); }   // fission from the exact same spot
    if (e.e <= 0) e.alive = false;
  }

  // physical bodies: predators can't phase through prey (or each other). Runs on the
  // SIM tick while the hash is fresh; squared-distance, no per-frame draw-loop work.
  const R_PRED = 0.4, R_PREY = 0.18, R_PP = R_PRED + R_PRED;          // collision radii in tiles (predator markedly larger)
  function collide() {
    const ps = R_PRED + R_PREY, ps2 = ps * ps, wPrey = R_PRED / ps, wPred = R_PREY / ps;   // smaller body yields more
    for (const e of ECO.predators) {
      if (!e.alive || e.dormant) continue;                            // dormant "plant" predators don't push anything
      near(e.x, e.y, 1, (o) => {                                       // predator ↔ prey: bump everything except the one it's engulfing
        if (o.tag !== 1 || !o.alive || o === e.prey) return;
        const dx = wd(o.x - e.x), dy = wd(o.y - e.y), d2 = dx * dx + dy * dy;
        if (d2 >= ps2 || d2 < 1e-6) return;
        const d = Math.sqrt(d2), ov = ps - d, nx = dx / d, ny = dy / d;
        e.x = wpos(e.x - nx * ov * wPred); e.y = wpos(e.y - ny * ov * wPred);
        o.x = wpos(o.x + nx * ov * wPrey); o.y = wpos(o.y + ny * ov * wPrey);
      });
    }
    const pp2 = R_PP * R_PP;                                           // predator ↔ predator: keep their bodies apart too (split the push)
    const arr = ECO.predators;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i]; if (!e.alive || e.dormant) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const o = arr[j]; if (!o.alive || o.dormant) continue;
        const dx = wd(o.x - e.x), dy = wd(o.y - e.y), d2 = dx * dx + dy * dy;
        if (d2 >= pp2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), ov = (R_PP - d) * 0.5, nx = dx / d, ny = dy / d;
        e.x = wpos(e.x - nx * ov); e.y = wpos(e.y - ny * ov);
        o.x = wpos(o.x + nx * ov); o.y = wpos(o.y + ny * ov);
      }
    }
  }

  function reap(arr, pool) { for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].alive) { put(pool, arr[i]); arr.splice(i, 1); } }

  function fieldsStep(dtF) {
    const P = ECO.P, f = ECO.flora, nf = ECO.floraNext, fr = ECO.fear, nr = ECO.fearNext, c = ECO.cfg;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const i = y * P + x, up = wi(y - 1) * P + x, dn = wi(y + 1) * P + x, lf = y * P + wi(x - 1), rt = y * P + wi(x + 1);
      const fnb = (f[up] + f[dn] + f[lf] + f[rt]) * 0.25;
      let v = f[i] + dtF * c.floraRegrow * (1 - f[i]) * (c.floraBase + c.floraSpread * fnb);
      nf[i] = v > 1 ? 1 : v < 0 ? 0 : v;
      const rnb = (fr[up] + fr[dn] + fr[lf] + fr[rt]) * 0.25;          // fear decays + slightly diffuses
      nr[i] = fr[i] * c.fearDecay + rnb * 0.06;
    }
    ECO.flora = nf; ECO.floraNext = f; ECO.fear = nr; ECO.fearNext = fr;
  }

  function immigrate(px, py) {                          // keep cycles alive — but only OFFSCREEN, never popping in onscreen
    const c = ECO.cfg;
    const off = (lo, hi) => { const a = Math.random() * Math.PI * 2, d = lo + Math.random() * (hi - lo); return [wpos(px + Math.cos(a) * d), wpos(py + Math.sin(a) * d)]; };
    if (ECO.grazers.length < Math.max(2, c.grazerStart * 0.12) && Math.random() < 0.5) { const p = off(22, 31); spawn(ECO.grazers, ECO.pools.g, p[0], p[1], c.grazerStartE); }
    // predators trickle back JUST offscreen (≈16–22 tiles), not across the map, so they reach the play area before starving — never while dormant
    if (c.predatorStart > 0 && !c.predatorDormant && ECO.predators.length < Math.max(2, c.predatorStart * 0.5) && Math.random() < 0.4) { const p = off(16, 22); spawn(ECO.predators, ECO.pools.p, p[0], p[1], c.predStartE); }
  }

  /* --- engine hooks -------------------------------------------------------- */
  ECO.update = function (dt, api) {
    ECO.hub = api.hub; ECO.villageR = api.villageR;                   // set BEFORE init so spawns can anchor to the plaza
    if (!ECO.inited) init(api.P);
    ECO.now = api.t;
    const c = ECO.cfg, P = ECO.P;
    // integrate every frame (smooth motion), wrap onto the torus — dormant "plant" predators never move
    const step = (arr) => { for (const e of arr) { if (e.dormant) continue; e.x = wpos(e.x + e.vx * dt); e.y = wpos(e.y + e.vy * dt); } };
    step(ECO.motes); step(ECO.fireflies); step(ECO.grazers); step(ECO.predators);

    ECO.acc += dt;
    const simDt = 1 / c.simHz;
    let guard = 4;
    while (ECO.acc >= simDt && guard-- > 0) {                         // low-Hz brains
      ECO.acc -= simDt;
      rebuildGrid();
      const px = api.player.x, py = api.player.y;
      for (const e of ECO.motes) thinkMote(e, c, px, py);
      for (const e of ECO.fireflies) thinkFirefly(e, c, px, py);
      for (const e of ECO.grazers) thinkGrazer(e, c, simDt, px, py);
      for (const e of ECO.predators) thinkPredator(e, c, simDt);
      collide();                                                       // resolve predator↔prey and predator↔predator overlaps (grid still fresh)
      reap(ECO.grazers, ECO.pools.g); reap(ECO.predators, ECO.pools.p);
      immigrate(px, py);
    }
    ECO.facc += dt;
    const floraDt = 1 / c.floraHz;
    let fg = 3;
    while (ECO.facc >= floraDt && fg-- > 0) { ECO.facc -= floraDt; fieldsStep(floraDt); }

    ECO.stats.grazers = ECO.grazers.length; ECO.stats.predators = ECO.predators.length;
  };

  ECO.groundTint = function (tx, ty) {
    if (!ECO.inited || !ECO.showFlora) return null;
    const f = ECO.flora[fidx(tx, ty)];
    if (f < 0.3) return "rgba(86,66,42," + ((0.3 - f) * 0.9).toFixed(3) + ")";       // grazed / bare
    if (f > 0.74) return "rgba(72,150,70," + ((f - 0.74) * 0.7).toFixed(3) + ")";    // lush
    return null;
  };

  ECO.actors = function (push, api) {
    if (!ECO.inited) return;
    const W = api.W, H = api.H;
    const vis = (e, fn) => { const p = api.place(e.x, e.y); if (p.x < -24 || p.x > W + 24 || p.y < -26 || p.y > H + 18) return; push(p.depth, (g) => fn(g, p.x, p.y, e)); };
    for (const e of ECO.motes) vis(e, drawMote);
    for (const e of ECO.grazers) vis(e, drawGrazer);
    for (const e of ECO.predators) vis(e, drawPredator);
    for (const e of ECO.fireflies) vis(e, drawFirefly);
  };

  /* --- entity sprites (theme-agnostic, legible on any skin) ---------------- */
  function heading(e) { const m = Math.hypot(e.vx, e.vy) || 1; return { hx: (e.vx - e.vy) / m, hy: (e.vx + e.vy) / (2 * m) }; }
  function drawMote(g, x, y) {
    g.save(); g.globalAlpha = 0.85; g.shadowColor = "rgba(150,235,255,0.9)"; g.shadowBlur = 6;
    g.fillStyle = "#eaffff"; g.beginPath(); g.arc(x, y - 6, 2, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawFirefly(g, x, y, e) {
    const blink = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(ECO.now * 4 + (e.phase || 0)));
    g.save(); g.globalAlpha = blink; g.shadowColor = "rgba(255,225,120,0.95)"; g.shadowBlur = 11;
    g.fillStyle = "#ffe79a"; g.beginPath(); g.arc(x, y - 6, 2.1, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawGrazer(g, x, y, e) {
    U.shadow(g, x, y, 6);
    const h = heading(e);
    g.lineJoin = "round";
    g.fillStyle = "#d9c79a"; g.beginPath(); g.ellipse(x, y - 5, 6, 4.2, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();              // dark-ink outline, like the avatar slime (scaled down)
    g.fillStyle = "#b9a578"; g.beginPath(); g.ellipse(x - h.hx * 2, y - 6.5, 3.4, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.3; g.strokeStyle = INK; g.stroke();
    g.fillStyle = "#2a2118"; g.beginPath(); g.arc(x + h.hx * 4, y - 6 + h.hy * 2, 1.1, 0, Math.PI * 2); g.fill();
  }
  // A hunched, jagged dark mass with slug-mould EYESTALKS — markedly larger than its prey, no snout.
  // Silhouette is drawn vertex-by-vertex (no array alloc) and shaped by stable per-beast state (e.phase) + heading.
  // When dormant (technurture) it's a rooted, inert "scary plant": frozen (no gulp pulse), calmer body, dim half-lidded eyes, anchor roots.
  function drawPredator(g, x, y, e) {
    const dorm = e.dormant;
    const k = (!dorm && e.eat > 0) ? 1 + 0.22 * Math.sin((1 - e.eat / 0.4) * Math.PI) : 1;   // gulp/pulse as it absorbs prey (frozen when dormant)
    U.shadow(g, x, y, 16);
    const h = heading(e), ph = e.phase || 0, cy = y - 12, R = 16 * k, N = 11;
    if (dorm) {                                                       // anchor roots splaying into the ground (under the body)
      g.strokeStyle = INK; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 2.3;
      for (let r = -1; r <= 1; r++) { g.beginPath(); g.moveTo(x + r * 2.5, y - 5); g.quadraticCurveTo(x + r * 6, y - 1, x + r * 9, y + 3); g.stroke(); }
    }
    g.beginPath();
    for (let i = 0; i < N; i++) {                                    // jagged, asymmetric, hunched outline
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const jag = 1 + (i & 1 ? -0.28 : 0.16) + 0.13 * Math.cos(i * 1.7 + ph);     // alternating spikes + per-beast jitter
      const vx = x + ca * R * jag * (1 + 0.18 * h.hx * ca);                        // lean toward heading
      const vy = cy + sa * (sa < 0 ? R * 0.78 : R * 0.5) * jag;                    // tall hunched crown, flatter belly
      i === 0 ? g.moveTo(vx, vy) : g.lineTo(vx, vy);
    }
    g.closePath();
    g.fillStyle = dorm ? "#46303a" : "#5e1a24"; g.fill();                          // dormant: a muted, drained, planty tone
    g.lineWidth = 2; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke();        // dark-ink outline, like the avatar slime
    g.fillStyle = "#350c14"; g.beginPath(); g.ellipse(x - h.hx * 2, cy + R * 0.22, R * 0.55, R * 0.25, 0, 0, Math.PI * 2); g.fill();   // belly shadow (interior form)
    // slug-mould EYESTALKS: a fan of curved tendrils rising forward from the hunch, each tipped with an eye (no idle motion)
    const nx = -h.hy, ny = h.hx;                                     // body-perpendicular (iso "shoulders")
    const stalks = 2 + (((e.phase * 997) | 0) % 3);                  // 2..4 eyestalks, stable per beast (from e.phase, not per-frame rng)
    const bx0 = x + h.hx * 3.5, by0 = cy - R * 0.48 + h.hy * 1.5, half = (stalks - 1) / 2;
    g.lineCap = "round"; g.lineJoin = "round";
    for (let j = 0; j < stalks; j++) {
      const t = j - half, wob = Math.cos(j * 1.9 + ph), side = t > 0 ? 1 : t < 0 ? -1 : 0;
      const bx = bx0 + nx * t * 2.4, by = by0 + ny * t * 2.4;        // fanned root on the crown
      const len = 10.5 + 1.6 * wob;
      const tx = bx + h.hx * 4 + nx * t * 1.6, ty = by - len + h.hy * 3;            // tip leans forward + outward, and up
      const mx = (bx + tx) / 2 + side * (2.2 + 0.6 * wob), my = (by + ty) / 2 - 1.2;   // bowed sideways → slug-eyestalk curve
      g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();   // dark-ink outer (avatar shape family)
      g.strokeStyle = "#4a131d"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();   // dark-red core
      if (dorm) {                                                   // dim, half-lidded eye — asleep but watching
        g.fillStyle = "#7c5f2c"; g.beginPath(); g.arc(tx, ty, 1.7, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();         // ink outline (shape family)
        g.lineWidth = 1.4; g.strokeStyle = INK; g.beginPath(); g.moveTo(tx - 1.9, ty - 0.2); g.lineTo(tx + 1.9, ty - 0.2); g.stroke();   // heavy lid across the eye
      } else {
        g.fillStyle = "#ffcf3a"; g.beginPath(); g.arc(tx, ty, 2.0, 0, Math.PI * 2); g.fill();   // amber eye at the tip
        g.lineWidth = 1.3; g.strokeStyle = INK; g.stroke();         // ink outline on the eye (shape family)
        g.fillStyle = "#160806"; g.beginPath(); g.arc(tx + h.hx * 0.7, ty + h.hy * 0.7, 0.9, 0, Math.PI * 2); g.fill();   // pupil looks toward heading
      }
    }
  }

  ECO.reset = function () { ECO.inited = false; };   // re-init with the current cfg (used on theme switch)

  window.MH_ECO = ECO;
})();
