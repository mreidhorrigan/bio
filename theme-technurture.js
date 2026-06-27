// @ts-check
"use strict";
/* ============================================================================
   THEME · TECHNURTURE  (nth nature)  — the elaborate, naturalistic skin.
   ----------------------------------------------------------------------------
   A sunlit, overgrown world in the AoE2 / Minecraft key: the ground reads as
   BIOMES (grass, forest, sand, dry, stone, snow, water) and the buildings change
   with the biome they sit in — vines overrun the woodland ones, adobe in the
   sands, snow on the roofs, stilts by the water. The most beautiful skin; the
   ecology leans into FLORA. Avatar: a mossy slime. Sources:
   research/iso-variant-aesthetics.md (Solarpunk), research/ecology-systems.md.
   ========================================================================== */

(function () {
  const U = window.MH_ISO.util, RM = window.MH_ISO.reduced;
  const GOLD = "#E9B949", GOLD2 = "#F2C14E", TERRA = "#C97B4A", CREAM = "#F3ECD8", IRON = "#2f2a22", INK = "#26321f";
  const CRIM = "#9e2b25", TEAL = "#2a8186", PURP = "#6a3a8c", GRN = "#4FA373";

  /** per-biome materials: wall, roof, vine-density, ground colour, extras */
  // ALIEN SLIMEWORLD ground palette: wet biomes in teal/jade/viridian, barren biomes in
  // aubergine/mauve/sickly-ochre, snow a pale lilac crust, water a strange cyan pool.
  const BIO = {
    grass:  { wall: "#c2a065", roof: "#7a5a35", vine: 0.8, ground: "#3f7d5e" },   // jade viridian
    forest: { wall: "#9c7a48", roof: "#4f6b30", vine: 1.0, ground: "#214a3e" },   // deep ink-teal
    sand:   { wall: "#e2c990", roof: "#c98a4a", vine: 0.1, ground: "#b8ad73" },   // sickly chartreuse-ochre flat
    dry:    { wall: "#cdb285", roof: "#a9763f", vine: 0.2, ground: "#94727a" },   // dusty magenta-ash
    stone:  { wall: "#9a948a", roof: "#6a6258", vine: 0.3, ground: "#5a5170" },   // slate aubergine
    snow:   { wall: "#c9b893", roof: "#eaf1f6", vine: 0.05, ground: "#cfd2de", snow: true },   // pale lilac crust
    water:  { wall: "#b89a6a", roof: "#5a7a8c", vine: 0.4, ground: "#2f8a98", stilt: true },   // strange cyan-teal pool
  };
  const bio = (b) => BIO[b] || BIO.grass;
  // an OPAQUE organic ground blob (~one tile, seeded shape). The engine draws tiles
  // back-to-front, so overlaps are simply COVERED by the front blob: fluid arbitrary
  // shapes, no grid, no hard centre-patches (it never reaches a neighbour's centre), no blur.
  // Hot path (one per visible field tile per frame): precomputed unit cos/sin + a reused
  // point buffer, so there is no per-tile trig and no per-tile array allocation.
  const _BC = [], _BS = [], _BX = [], _BY = [];
  for (let i = 0; i < 8; i++) { _BC.push(Math.cos(i / 8 * Math.PI * 2)); _BS.push(Math.sin(i / 8 * Math.PI * 2)); }
  function groundBlob(g, sx, sy, col, tx, ty) {
    const N = 8;
    for (let i = 0; i < N; i++) { const j = 0.86 + U.hash01(tx * 7 + i * 3, ty * 5 + i * 2) * 0.3; _BX[i] = sx + _BC[i] * 53 * j; _BY[i] = sy + _BS[i] * 29 * j; }
    g.fillStyle = col; g.beginPath();
    g.moveTo((_BX[N - 1] + _BX[0]) / 2, (_BY[N - 1] + _BY[0]) / 2);
    for (let i = 0; i < N; i++) { const n = (i + 1) % N; g.quadraticCurveTo(_BX[i], _BY[i], (_BX[i] + _BX[n]) / 2, (_BY[i] + _BY[n]) / 2); }
    g.closePath(); g.fill();
  }

  function glow(g, x, y, r, col, blur) { g.save(); if (!RM()) { g.shadowColor = col; g.shadowBlur = blur; } g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); }
  function bevel(g, sx, sy) {
    g.strokeStyle = "rgba(255,250,225,0.13)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sx - 48, sy); g.lineTo(sx, sy - 24); g.lineTo(sx + 48, sy); g.stroke();
    g.strokeStyle = "rgba(15,40,20,0.18)";
    g.beginPath(); g.moveTo(sx - 48, sy); g.lineTo(sx, sy + 24); g.lineTo(sx + 48, sy); g.stroke();
  }
  /** vines: a few climbing strokes + leaves, scaled by density */
  function vines(g, sx, sy0, sy1, dens, t, slot) {
    const n = Math.round(dens * 4); if (n <= 0) return;
    g.strokeStyle = "#3f7a3a"; g.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const x = sx - 12 + i * (24 / Math.max(1, n - 1)), sway = RM() ? 0 : Math.sin(t * 1.3 + i + slot) * 1.4;
      g.beginPath(); g.moveTo(x, sy1);
      for (let k = 1; k <= 4; k++) g.quadraticCurveTo(x + (k % 2 ? 3 : -3) + sway, sy1 - (sy1 - sy0) * (k - 0.5) / 4, x + sway * 0.5, sy1 - (sy1 - sy0) * k / 4);
      g.stroke();
      g.fillStyle = "#56a04e"; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x + sway, sy1 - (sy1 - sy0) * k / 4, 2.1, 0, Math.PI * 2); g.fill(); }
    }
  }

  const theme = {
    id: "technurture",
    name: "technurture / nth nature",
    tagline: "A green, overgrown world. The land is many biomes, and every building wears the place it stands in. Step into one.",
    tileW: 96, tileH: 48,
    worldPeriod: 58,
    speed: 4.9,
    propDensity: 0.2,
    fogColor: "232,224,196",
    biomes: true,
    spurRoads: true,   // slimeverse: Music & Games grow a road of houses (exploration); the flatverse stays a direct menu
    biomeColor: (b) => (BIO[b] || BIO.grass).ground,             // engine draws a smooth blended biome ground (no tiles)
    wayfinding: { compass: false, roads: true, signposts: false, recall: true, fog: true },
    avatarColors: [GRN, GOLD, TERRA, TEAL], avatarInk: "#1f3a1a", avatarGel: true,   // gel inner texture, keep outline
    accents: ["#f0b62a", "#f28b46", "#d24f86", "#8a52d0", "#36b9d6", "#e0613a"],   // saturated, warm-leaning → baubles pop off the cool alien ground
    audio: { root: 261.63, scale: [0, 2, 4, 7, 9, 11], type: "triangle" },
    bgCss: "#cfe4d6",
    ecology: { enabled: true, showFlora: false, cfg: { motes: 46, grazerStart: 30, predatorStart: 0, fireflies: 0, moteSpeed: 1.3, grazerSpeed: 0.95 } },
    fluidGround: true, plazaColor: "#e7cf94", roadColor: "#d95f93",   // saturated rose-pink road + warm plaza mark the village

    css: `
      :root{
        --mh-ui:-apple-system,"Segoe UI",Roboto,Helvetica,sans-serif;
        --mh-display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
        --mh-body:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
      }
      body{ color:#2a3a2e; }
      #mh-back{ color:#2a3a2e; border:1px solid ${GOLD}; background:rgba(243,236,216,.82); }
      .mh-kicker{ color:${TEAL}; letter-spacing:.2em; }
      #mh-title{ color:${TEAL}; text-shadow:0 1px 0 #fff; }
      .mh-tagline{ color:#3f5346; }
      .mh-btn{ color:#2a1c0e; background:linear-gradient(180deg,${GOLD2},${GOLD}); border:1px solid #b98a2a; border-radius:6px 14px 6px 14px / 5px 8px 5px 8px; box-shadow:0 6px 16px rgba(20,80,63,.25); }
      .mh-btn:hover{ filter:brightness(1.05); }
      .mh-picklabel{ color:${TEAL}; }
      .mh-swatch{ border:2px solid ${CREAM}; border-radius:50%; box-shadow:0 0 0 2px ${GOLD}, 0 3px 8px rgba(0,0,0,.25); }
      .mh-swatch.mh-sel{ box-shadow:0 0 0 3px ${TEAL}, 0 0 10px ${GOLD}; }
      .mh-overlay{ background:rgba(28,40,30,.5); }
      .mh-panel{ background:radial-gradient(120% 100% at 30% 0%, #fbf6e6, ${CREAM} 60%, #e7dcbd); border:2px solid ${GOLD}; border-radius:24px 8px 24px 8px / 14px 5px 14px 5px; box-shadow:0 18px 50px rgba(20,50,40,.4), inset 0 0 30px rgba(233,185,73,.12); color:#2a3a2e; padding:30px; }
      .mh-card{ background:radial-gradient(130% 100% at 25% 0%, #fbf6e6, ${CREAM} 60%, #e7dcbd); border:2px solid ${GOLD}; border-radius:24px 8px 24px 8px / 14px 5px 14px 5px; box-shadow:0 24px 60px rgba(20,50,40,.45); color:#2a3a2e; }
      .mh-card-head{ border-bottom:2px solid ${GOLD}; }
      .mh-card-head h2{ color:var(--mh-card-accent,${TEAL}); }
      .mh-x{ color:${TEAL}; background:rgba(255,255,255,.4); border:1px solid #b98a2a; border-radius:50%; }
      .mh-x:hover{ background:${GOLD}; color:#fff; }
      .mh-card-body{ color:#2a3a2e; } .mh-prose a{ color:${TERRA}; text-decoration:underline; text-decoration-color:${GOLD}; }
      .mh-prose a:hover{ color:#9c4a22; } .mh-prose .mh-big{ color:${TEAL}; }
      .mh-card-foot{ border-top:2px solid ${GOLD}; color:#3f5346; }
      .mh-hint{ color:#1f3a22; text-shadow:0 1px 3px rgba(255,255,255,.5); }
      .mh-progress{ color:#2a1c0e; background:linear-gradient(180deg,${GOLD2},${GOLD}); border-radius:999px; }
      .mh-navbar{ background:transparent; border:none; }   /* no glass panel; let the chips stand alone (like bureaucore) */
      .mh-navchip{ background:rgba(255,250,235,.94); color:#2a3a2e; border:2.5px solid #b98a2a; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; }
      .mh-navchip:hover{ filter:brightness(1.04); border-color:${TEAL}; }
      .mh-navhome{ background:linear-gradient(180deg,#fff3cf,${GOLD2}) !important; }
      .mh-skin{ background:rgba(255,250,235,.9); color:#2a3a2e; border:2px solid #b98a2a; }
      .mh-skin.mh-cur{ background:${GOLD2}; color:#2a1c0e; }
      .mh-plain{ color:${TEAL}; }
    `,

    paintBackground(g, env) {
      const sky = g.createLinearGradient(0, 0, 0, env.H);
      sky.addColorStop(0, "#bfe3db"); sky.addColorStop(.55, "#d8ecd2"); sky.addColorStop(1, "#efe7cf");
      g.fillStyle = sky; g.fillRect(0, 0, env.W, env.H);
    },

    paintGround(g, sx, sy, info) {
      if (info.zone !== "field") return;                          // engine draws the fluid plaza + garden paths
      const b = bio(info.biome);
      groundBlob(g, sx, sy, b.ground, info.tx, info.ty);          // opaque organic blob; overlaps are covered (no grid, no blur)
      if ((info.biome === "grass" || info.biome === "forest") && U.hash01(info.ty, info.tx) > 0.85) { g.strokeStyle = U.shade(b.ground, 0.22); g.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(sx + i * 5, sy + 3); g.lineTo(sx + i * 5 - 1, sy - 3); g.stroke(); } }
      else if (info.biome === "water" && !RM()) { g.strokeStyle = "rgba(206,236,255,0.3)"; g.lineWidth = 1; const w = Math.sin(info.t * 1.4 + info.tx + info.ty) * 3; g.beginPath(); g.moveTo(sx - 12 + w, sy); g.lineTo(sx + 12 + w, sy); g.stroke(); }
    },

    // SLIMEWORLD flora — a world a slime lives in: moulds, gels, oozes, spore-caps. No trees.
    propAt(tx, ty) { if (U.hash01(tx, ty) > 0.22) return null; if (window.MH_ISO.biome(tx, ty) === "water") return "lily"; const r = U.hash01(ty, tx); return r < 0.34 ? "slimemould" : r < 0.62 ? "gelpod" : r < 0.84 ? "sporecap" : "tendril"; },
    paintProp(g, sx, sy, id, info) {
      const t = info.t, sway = RM() ? 0 : Math.sin(t * 1.6 + info.tx) * 1.6, wob = RM() ? 0 : Math.sin(t * 2.4 + info.ty);
      const base = id === "sporecap" ? 1.15 : id === "tendril" ? 1.0 : id === "slimemould" ? 0.95 : 0.9;   // per-type base size
      const sz = base * (0.72 + U.hash01(info.tx * 3 + 1, info.ty * 7 + 2) * 0.7);   // and each plant a different size
      g.save(); g.translate(sx, sy); g.scale(sz, sz); g.translate(-sx, -sy);
      U.shadow(g, sx, sy, id === "sporecap" ? 9 : 11);
      if (id === "lily") {                                        // aquatic: a floating gel lily-pad with a glowing bud
        g.fillStyle = U.hexA("#3fa37a", 0.88); g.beginPath(); g.ellipse(sx, sy, 13, 6.5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = U.hexA("#0c2e22", 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(sx + 2, sy); g.lineTo(sx + 12, sy - 1); g.stroke();
        glow(g, sx - 3, sy - 4, 2.4, "#ffe06a", 9); g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(sx - 3, sy - 4, 2.4, 0, Math.PI * 2); g.fill();
      } else if (id === "slimemould") {                           // a spreading network with little yellow fruiting bodies
        g.fillStyle = U.hexA("#3aa882", 0.85); g.beginPath(); g.ellipse(sx, sy - 1, 14, 7, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#6fe0b0"; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(sx, sy - 1); g.lineTo(sx + Math.cos(a) * 12, sy - 1 + Math.sin(a) * 6); g.stroke(); }
        for (const o of [[-7, 0], [5, 1], [0, -2], [9, -1]]) { const fx = sx + o[0], fy = sy - 1 + o[1]; g.strokeStyle = "#cfe0b0"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 5); g.stroke(); g.fillStyle = "#ffe06a"; g.beginPath(); g.arc(fx, fy - 6, 2, 0, Math.PI * 2); g.fill(); }
      } else if (id === "gelpod") {                               // a glossy translucent gel blob with a glowing core
        const r = 11 + wob * 1.2;
        g.fillStyle = U.hexA("#5fd0c0", 0.6); g.beginPath(); g.ellipse(sx, sy - r * 0.6, r, r * 0.82, 0, 0, Math.PI * 2); g.fill();
        glow(g, sx, sy - r * 0.6, 3, "#aaffe6", 14);
        g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(sx - r * 0.32, sy - r * 0.95, 2.6, 1.8, 0, 0, Math.PI * 2); g.fill();
      } else if (id === "sporecap") {                             // alien mushroom: a stalk + a glowing gel cap
        g.strokeStyle = "#d8d0be"; g.lineWidth = 3.5; g.lineCap = "round"; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + sway * 0.4, sy - 18); g.stroke();
        g.save(); g.shadowColor = "rgba(200,120,255,0.8)"; g.shadowBlur = 12; g.fillStyle = "#b06ad0"; g.beginPath(); g.ellipse(sx + sway * 0.4, sy - 19, 9, 6, 0, Math.PI, 0); g.fill(); g.restore();
        for (let i = -1; i <= 1; i++) glow(g, sx + sway * 0.4 + i * 4, sy - 24 - (i & 1) * 2, 1.2, "#e6b0ff", 6);
      } else {                                                    // gooey tendrils rising, each with a glowing drip
        g.strokeStyle = "#4fb07a"; g.lineWidth = 2.4; g.lineCap = "round";
        for (let i = -1; i <= 1; i++) { const x = sx + i * 5; g.beginPath(); g.moveTo(x, sy); g.quadraticCurveTo(x + sway + i * 3, sy - 13, x + sway, sy - 22); g.stroke(); glow(g, x + sway, sy - 22, 2, "#9fe6c0", 8); }
      }
      g.restore();
    },

    paintMonument(g, sx, sy, env) {                              // a colossal slime organism, the heart of slimeworld
      const t = env.t, pulse = RM() ? 0.7 : 0.5 + 0.5 * Math.sin(t * 1.3), wob = RM() ? 0 : Math.sin(t * 1.8) * 2;
      U.shadow(g, sx, sy, 28);
      g.fillStyle = U.hexA("#3a8a6a", 0.92);                     // a bulbous translucent gel stalk
      g.beginPath(); g.moveTo(sx - 7, sy); g.quadraticCurveTo(sx - 16 + wob, sy - 38, sx - 5, sy - 72); g.lineTo(sx + 5, sy - 72); g.quadraticCurveTo(sx + 16 + wob, sy - 38, sx + 7, sy); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.ellipse(sx - 4, sy - 40, 3, 22, 0, 0, Math.PI * 2); g.fill();   // gloss
      for (let i = 0; i < 4; i++) { const yy = sy - 16 - i * 15; glow(g, sx + (i % 2 ? 6 : -6) + wob * 0.5, yy, 5 - i * 0.4, "#7fe6c0", 12); }   // glowing nodes
      glow(g, sx, sy - 80, 7 + pulse * 2, "#aaffe6", 22);        // crown of glowing spore-pods
      glow(g, sx - 9, sy - 72, 3.5, "#c0a0ff", 12); glow(g, sx + 10, sy - 68, 3.5, "#ffd06a", 12);
      g.fillStyle = "#eaffff"; g.beginPath(); g.arc(sx, sy - 80, 3, 0, Math.PI * 2); g.fill();
    },

    /** each kiosk is a BUILDING that wears its biome — vines, adobe, snow, stilts. */
    paintKiosk(g, sx, sy, ex, active, env) {
      const t = env.t, b = bio(env.biome), slot = ex.slot, dy = active ? -2 : 0;
      const s1 = U.hash01(slot * 13 + 3, slot * 7 + 5), s2 = U.hash01(slot * 5 + 9, slot * 11 + 2);
      U.shadow(g, sx, sy, 34);
      const baseY = sy + dy, ww = 27 + Math.floor(s1 * 9), hh = 48 + Math.floor(s2 * 18);   // a BIG bulbous slime-dwelling
      const topY = baseY - hh, wob = RM() ? 0 : Math.sin(t * 1.6 + slot) * 1.6;
      if (b.stilt) { g.strokeStyle = "#5a4a32"; g.lineWidth = 3; for (const s of [-ww * 0.5, ww * 0.5]) { g.beginPath(); g.moveTo(sx + s, baseY + 8); g.lineTo(sx + s, baseY - 6); g.stroke(); } }
      // the body: a fat translucent gel mound, lit top-left, glowing from within
      const grad = g.createLinearGradient(0, topY, 0, baseY);
      grad.addColorStop(0, U.shade(b.wall, 0.28)); grad.addColorStop(1, U.shade(b.wall, -0.16));
      g.fillStyle = grad; g.beginPath();
      g.moveTo(sx - ww, baseY);
      g.bezierCurveTo(sx - ww * 1.12, baseY - hh * 0.55, sx - ww * 0.7 + wob, topY, sx + wob, topY);
      g.bezierCurveTo(sx + ww * 0.7 + wob, topY, sx + ww * 1.12, baseY - hh * 0.55, sx + ww, baseY);
      g.quadraticCurveTo(sx, baseY + 8, sx - ww, baseY);
      g.closePath(); g.fill();
      g.lineWidth = 2; g.strokeStyle = U.shade(b.wall, -0.42); g.stroke();
      if (!RM()) { g.save(); g.globalAlpha = 0.42; glow(g, sx, baseY - hh * 0.42, hh * 0.32, "#9fe6c0", 18); g.restore(); }
      g.fillStyle = "rgba(255,255,255,0.24)"; g.beginPath(); g.ellipse(sx - ww * 0.34, topY + hh * 0.26, ww * 0.24, hh * 0.16, -0.5, 0, Math.PI * 2); g.fill();   // gel sheen
      g.fillStyle = "rgba(18,30,22,0.7)"; g.beginPath(); g.ellipse(sx, baseY - hh * 0.13, ww * 0.3, hh * 0.2, 0, Math.PI, 0); g.closePath(); g.fill();   // round ooze-doorway
      g.save(); g.shadowColor = "#bfffe0"; g.shadowBlur = active ? 16 : 9; g.fillStyle = U.hexA(GOLD2, active ? 0.95 : 0.72); g.beginPath(); g.ellipse(sx + ww * 0.42, baseY - hh * 0.52, ww * 0.15, hh * 0.12, 0, 0, Math.PI * 2); g.fill(); g.restore();   // glowing window
      g.fillStyle = U.shade(b.wall, -0.12);
      for (const ddx of [-ww * 0.62, -ww * 0.05, ww * 0.5]) { g.beginPath(); g.moveTo(sx + ddx - 2.5, baseY - 1); g.quadraticCurveTo(sx + ddx, baseY + 9, sx + ddx + 2.5, baseY - 1); g.lineTo(sx + ddx + 2.5, baseY - 6); g.lineTo(sx + ddx - 2.5, baseY - 6); g.closePath(); g.fill(); }   // ooze drips
      if (b.snow) { g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(sx + wob, topY + 4, ww * 0.5, 6, 0, Math.PI, 0); g.fill(); }
      // THE menu item — ONE clean pill sign, joined to the house by a connector in a single
      // SPECIAL colour (so it never reads as part of the map). No overlaid shapes, no halo.
      const sway = RM() ? 0 : Math.sin(t * 1.2 + slot) * 6, CONN = "#ff6e8c";
      g.font = "700 16px 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"; const label = ex.title;   // the theme's usual display serif (Comic Sans clashed)
      const bw = Math.max(48, g.measureText(label).width + 26), bh = 30, rr = bh / 2;
      const bcx = sx + sway, bcy = topY - 48, x0 = bcx - bw / 2, y0 = bcy - bh / 2;
      g.save(); if (!RM()) { g.shadowColor = CONN; g.shadowBlur = 5; } g.strokeStyle = CONN; g.lineWidth = 4; g.lineCap = "round";   // the special connector
      g.beginPath(); g.moveTo(sx, topY - 4); g.quadraticCurveTo(sx + sway * 0.5, bcy + bh * 0.4, bcx, y0 + bh - 1); g.stroke(); g.restore();
      g.save(); if (!RM()) { g.shadowColor = U.hexA(ex.accent, 0.85); g.shadowBlur = active ? 14 : 8; }   // the pill's OWN soft aura (not a separate shape)
      const bg = g.createLinearGradient(0, y0, 0, y0 + bh);
      bg.addColorStop(0, U.shade(ex.accent, 0.32)); bg.addColorStop(1, U.shade(ex.accent, -0.18));
      g.fillStyle = bg; g.beginPath(); g.moveTo(x0 + rr, y0); g.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, rr); g.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, rr); g.arcTo(x0, y0 + bh, x0, y0, rr); g.arcTo(x0, y0, x0 + bw, y0, rr); g.closePath(); g.fill();
      g.shadowBlur = 0; g.lineWidth = active ? 2.6 : 1.8; g.strokeStyle = U.hexA(GOLD, active ? 1 : 0.82); g.lineJoin = "round"; g.stroke(); g.restore();
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = 3.5; g.strokeStyle = "rgba(12,30,18,0.9)"; g.strokeText(label, bcx, bcy);   // dark outline → readable on any accent
      g.fillStyle = "#fff"; g.fillText(label, bcx, bcy);
      if (ex.visited) glow(g, sx + ww * 0.6, baseY - hh * 0.55, 3.5, GOLD2, 8);
      if (active) {
        const f = RM() ? 0.8 : 0.6 + 0.4 * Math.sin(t * 8);
        glow(g, sx - ww - 4, baseY - 8, 3 + f * 1.4, GOLD2, 12); glow(g, sx + ww + 4, baseY - 8, 3 + f * 1.4, GOLD2, 12);
      }
    },

    paintSignpost(g, sx, sy, dir, dist, info) {
      g.strokeStyle = IRON; g.lineWidth = 2.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 26); g.stroke();
      const w = 40, h = 15, bx = dir > 0 ? sx - 6 : sx - w + 6, by = sy - 30;
      U.roundRect(bx, by, w, h, 4, CREAM, "#b98a2a");
      g.fillStyle = TEAL; g.font = "700 11px var(--mh-display)"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText((dir > 0 ? "→ " : "← ") + dist, bx + w / 2, by + h / 2);
      glow(g, sx + (dir > 0 ? -6 : 6), sy - 22, 2.4, GOLD2, 8);
    },
  };

  window.MH_ISO.register(theme);
})();
