// @ts-check
"use strict";
/* ============================================================================
   THEME · TECHNOSCURE  (gloomthmaxx)  — the dark, emotionally heavy skin.
   ----------------------------------------------------------------------------
   Technurture after dark: the same biome-built world, drained to night. A heavy
   vignette closes around the edges (horror, not menus), windows glow sickly-warm,
   and the ecology turns toward PREDATORS and firefly-like lights in the gloom.
   Avatar: a pale, cold slime. Based on Technurture; ecology adds predators +
   fireflies. Sources: research/iso-variant-aesthetics.md, ecology-systems.md.
   ========================================================================== */

(function () {
  const u = window.MH_ISO.util, RM = window.MH_ISO.reduced;
  const GOLD = "#caa24a", TEAL = "#3a8a82", IRON = "#14160f", BONE = "#cdbf9a", CR = "#7a2e2e";
  // sickly neon tube colours for the damaged-marquee baubles (hoisted: no per-frame alloc).
  // cyan, carnival-magenta, ember-orange, cold mint — each sign picks one, seeded by slot.
  const NEONS = ["#36a89a", "#c64a8a", "#d6553e", "#4fd6c0"];

  // ALIEN SLIMEWORLD after dark: the technurture hues drained to near-night (the engine
  // self-multiplies the scene, so only these dark alien tints + the glows survive).
  const BIO = {
    grass:  { wall: "#2e3a26", roof: "#1c2716", ground: "#1a3a2c", vine: 0.9 },   // dark viridian
    forest: { wall: "#283324", roof: "#152212", ground: "#10271f", vine: 1.0 },   // deep ink-teal
    sand:   { wall: "#56492f", roof: "#352a1a", ground: "#3a351f", vine: 0.1 },   // dark sickly ochre
    dry:    { wall: "#473d2c", roof: "#2f261a", ground: "#2c2024", vine: 0.2 },   // dark magenta-ash
    stone:  { wall: "#37372f", roof: "#23231b", ground: "#221f2e", vine: 0.3 },   // dark slate aubergine
    snow:   { wall: "#39414a", roof: "#5b6672", ground: "#353a47", vine: 0.05, snow: true },   // dark lilac crust
    water:  { wall: "#283640", roof: "#1c2c36", ground: "#103a42", vine: 0.4, stilt: true },   // deep cyan-teal pool
  };
  const bio = (b) => BIO[b] || BIO.grass;
  // an OPAQUE organic ground blob (~one tile, seeded). Engine draws back-to-front, so
  // overlaps are covered by the front blob: fluid arbitrary shapes, no grid, no blur.
  // Hot path: precomputed unit cos/sin + a reused point buffer (no per-tile trig/alloc).
  const _BC = [], _BS = [], _BX = [], _BY = [];
  for (let i = 0; i < 8; i++) { _BC.push(Math.cos(i / 8 * Math.PI * 2)); _BS.push(Math.sin(i / 8 * Math.PI * 2)); }
  function groundBlob(g, sx, sy, col, tx, ty) {
    const N = 8;
    for (let i = 0; i < N; i++) { const j = 0.86 + u.hash01(tx * 7 + i * 3, ty * 5 + i * 2) * 0.3; _BX[i] = sx + _BC[i] * 53 * j; _BY[i] = sy + _BS[i] * 29 * j; }
    g.fillStyle = col; g.beginPath();
    g.moveTo((_BX[N - 1] + _BX[0]) / 2, (_BY[N - 1] + _BY[0]) / 2);
    for (let i = 0; i < N; i++) { const n = (i + 1) % N; g.quadraticCurveTo(_BX[i], _BY[i], (_BX[i] + _BX[n]) / 2, (_BY[i] + _BY[n]) / 2); }
    g.closePath(); g.fill();
  }
  function glow(g, x, y, r, col, blur) { g.save(); if (!RM()) { g.shadowColor = col; g.shadowBlur = blur; } g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); }
  function bevel(g, sx, sy) {
    g.strokeStyle = "rgba(180,200,170,0.06)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx - 48, sy); g.lineTo(sx, sy - 24); g.lineTo(sx + 48, sy); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.moveTo(sx - 48, sy); g.lineTo(sx, sy + 24); g.lineTo(sx + 48, sy); g.stroke();
  }

  const theme = {
    id: "technoscure",
    name: "technoscure/gloomthmaxx",
    tagline: "The same world after dark. Keep to the light. Something moves in the gloom, and the windows are still warm.",
    tileW: 96, tileH: 48,
    worldPeriod: 58,
    speed: 4.9,
    propDensity: 0.2,
    fogColor: "3,5,4",
    biomes: true,
    spurRoads: true,   // slimeverse: Music & Games grow a road of houses (exploration); the flatverse stays a direct menu
    biomeColor: (b) => (BIO[b] || BIO.grass).ground,             // engine draws a smooth blended biome ground (no tiles)
    wayfinding: { compass: false, roads: true, signposts: false, recall: true, fog: true },
    avatarColors: ["#8fbcb2", "#a99fc0", "#bca96a", "#7fa07f"], avatarInk: "#0a0e0a", avatarGel: true,
    avatarGlow: "#cfeee0", avatarBeam: true, darkness: true,      // a Darkwood-style directional light; the unlit, non-luminous world sinks to black
    accents: ["#e0b340", "#d6553e", "#36a89a", "#8fb43e", "#9a63c8", "#d68a3e"],   // brighter/saturated so the baubles survive the gloom-multiply
    audio: { root: 196.0, scale: [0, 2, 3, 5, 7, 8, 10], type: "sine" },   // minor, low + uneasy
    bgCss: "#070b08",
    ecology: { enabled: true, showFlora: false, cfg: { motes: 0, fireflies: 42, grazerStart: 20, predatorStart: 9, moteSpeed: 1.0, grazerSpeed: 0.9, predatorSpeed: 1.15 } },
    fluidGround: true, plazaColor: "#2a2c24", roadColor: "#34281c",

    css: `
      :root{
        --mh-ui:"Courier New",Courier,"SF Mono",ui-monospace,monospace;   /* a tech/terminal feel for the gloom */
        --mh-display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
        --mh-body:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
      }
      body{ color:#c7d2c0; }
      /* the horror vignette: a HEAVY dark closing in around every edge, always on (two
         layered radials so the gloom bites early and the corners go near-black) */
      body::after{ content:""; position:fixed; inset:0; pointer-events:none; z-index:4;
        background:
          radial-gradient(98% 98% at 50% 47%, rgba(0,0,0,0) 12%, rgba(2,4,3,.82) 52%, rgba(0,1,0,.995) 100%),
          radial-gradient(150% 130% at 50% 44%, rgba(0,0,0,0) 36%, rgba(0,1,0,.55) 100%); }
      #mh-back{ color:#c7d2c0; border:1px solid ${TEAL}; background:rgba(8,14,10,.78); }
      .mh-kicker{ color:${GOLD}; letter-spacing:.2em; text-shadow:0 0 8px rgba(202,162,74,.5); }
      #mh-title{ color:#e6ecdf; text-shadow:0 0 16px rgba(58,138,130,.4); }
      .mh-tagline{ color:#8a978a; }
      .mh-btn{ color:#0a0e0a; background:linear-gradient(180deg,${GOLD},#9a7a30); border:0; border-radius:6px 14px 6px 14px / 5px 8px 5px 8px; box-shadow:0 0 22px rgba(202,162,74,.3); letter-spacing:.05em; }
      .mh-btn:hover{ filter:brightness(1.08); }
      .mh-picklabel{ color:${GOLD}; }
      .mh-swatch{ border:2px solid #1a221a; border-radius:50%; box-shadow:0 0 0 2px ${TEAL}, 0 0 12px rgba(58,138,130,.4); }
      .mh-swatch.mh-sel{ box-shadow:0 0 0 3px ${GOLD}, 0 0 14px ${GOLD}; }
      .mh-overlay{ background:rgba(4,8,5,.78); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }
      .mh-panel{ background:linear-gradient(160deg,#11180f,#0a0f0a); border:1px solid ${TEAL}; border-radius:24px 8px 24px 8px / 14px 5px 14px 5px; box-shadow:0 0 0 1px rgba(58,138,130,.2), 0 0 50px rgba(58,138,130,.12), 0 24px 60px rgba(0,0,0,.7); color:#c7d2c0; padding:30px; }
      .mh-card{ background:linear-gradient(160deg,#11180f,#090e09); border:1px solid ${TEAL}; border-radius:24px 8px 24px 8px / 14px 5px 14px 5px; box-shadow:0 0 0 1px rgba(58,138,130,.22), 0 0 40px rgba(58,138,130,.12), 0 24px 60px rgba(0,0,0,.7); color:#c7d2c0; }
      .mh-card-head{ border-bottom:1px solid rgba(58,138,130,.3); }
      .mh-card-head h2{ color:var(--mh-card-accent,${GOLD}); text-shadow:0 0 12px currentColor; }
      .mh-x{ color:#9fb4a8; background:transparent; border:1px solid ${TEAL}; border-radius:50%; }
      .mh-x:hover{ color:#fff; background:${CR}; }
      .mh-card-body{ color:#bcc8b8; } .mh-prose a{ color:${GOLD}; text-decoration:underline; }
      .mh-prose a:hover{ color:#e6c878; } .mh-prose .mh-big{ color:#e6ecdf; text-shadow:0 0 14px rgba(58,138,130,.4); }
      .mh-card-foot{ border-top:1px solid rgba(58,138,130,.25); color:#7f8c7f; }
      .mh-hint{ color:#cdd8c8; text-shadow:0 1px 4px rgba(0,0,0,.8); }
      .mh-progress{ color:#0a0e0a; background:${GOLD}; border-radius:999px; box-shadow:0 0 12px rgba(202,162,74,.4); }
      .mh-navbar{ background:transparent; border:none; }   /* no glass panel; let the chips stand alone (like bureaucore) */
      .mh-navchip, .mh-skin, .mh-hudbtn, .mh-progress, .mh-hint, #mh-back, .mh-toast, .mh-tool{ text-transform:lowercase; }   /* all the courier HUD text reads lowercase */
      .mh-navchip{ background:rgba(10,16,11,.92); color:#c7d2c0; border:2.5px solid var(--chip,${TEAL}); }
      .mh-navchip:hover{ color:#fff; box-shadow:0 0 10px var(--chip,${TEAL}); }
      .mh-navhome{ border-color:${GOLD} !important; color:${GOLD}; }
      .mh-skin{ background:rgba(10,16,11,.9); color:#c7d2c0; border:2px solid ${TEAL}; }
      .mh-skin.mh-cur{ background:${GOLD}; color:#0a0e0a; }
      .mh-plain{ color:#7f8c7f; }
    `,

    paintBackground(g, env) {
      const sky = g.createLinearGradient(0, 0, 0, env.H);
      sky.addColorStop(0, "#0a120c"); sky.addColorStop(1, "#050806");
      g.fillStyle = sky; g.fillRect(0, 0, env.W, env.H);
    },

    paintGround(g, sx, sy, info) {
      if (info.zone !== "field") return;                          // engine draws the fluid plaza + paths
      const b = bio(info.biome);
      groundBlob(g, sx, sy, b.ground, info.tx, info.ty);          // opaque organic blob; overlaps are covered (no grid, no blur)
      if (info.biome === "water" && !RM()) { g.strokeStyle = "rgba(120,180,200,0.14)"; g.lineWidth = 1; const w = Math.sin(info.t * 1.2 + info.tx + info.ty) * 3; g.beginPath(); g.moveTo(sx - 12 + w, sy); g.lineTo(sx + 12 + w, sy); g.stroke(); }
    },

    // SLIMEWORLD flora, after dark: dim moulds, gels, oozes, spore-caps with a sickly glow
    propAt(tx, ty) { if (u.hash01(tx, ty) > 0.22) return null; if (window.MH_ISO.biome(tx, ty) === "water") return "lily"; const r = u.hash01(ty, tx); return r < 0.34 ? "slimemould" : r < 0.6 ? "gelpod" : r < 0.84 ? "sporecap" : "tendril"; },
    paintProp(g, sx, sy, id, info) {
      const t = info.t, sway = RM() ? 0 : Math.sin(t * 1.5 + info.tx) * 1.4, wob = RM() ? 0 : Math.sin(t * 2.2 + info.ty);
      const base = id === "sporecap" ? 1.15 : id === "tendril" ? 1.0 : id === "slimemould" ? 0.95 : 0.9;   // per-type base size
      const sz = base * (0.72 + u.hash01(info.tx * 3 + 1, info.ty * 7 + 2) * 0.7);   // and each plant a different size
      g.save(); g.translate(sx, sy); g.scale(sz, sz); g.translate(-sx, -sy);
      u.shadow(g, sx, sy, id === "sporecap" ? 9 : 11);
      if (id === "lily") {                                        // aquatic: a dark floating pad with a faint glow
        g.fillStyle = u.hexA("#1c4738", 0.88); g.beginPath(); g.ellipse(sx, sy, 13, 6.5, 0, 0, Math.PI * 2); g.fill();
        glow(g, sx - 3, sy - 4, 2.2, "#5fe0c8", 8);
      } else if (id === "slimemould") {
        g.fillStyle = u.hexA("#1f5a44", 0.85); g.beginPath(); g.ellipse(sx, sy - 1, 13, 6.5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#2f7a5a"; g.lineWidth = 1.3; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(sx, sy - 1); g.lineTo(sx + Math.cos(a) * 11, sy - 1 + Math.sin(a) * 5.5); g.stroke(); }
        for (const o of [[-6, 0], [5, 1], [0, -2]]) glow(g, sx + o[0], sy - 6 + o[1], 1.3, "#7fffc0", 7);
      } else if (id === "gelpod") {
        const r = 10 + wob;
        g.fillStyle = u.hexA("#1f4a44", 0.6); g.beginPath(); g.ellipse(sx, sy - r * 0.6, r, r * 0.82, 0, 0, Math.PI * 2); g.fill();
        glow(g, sx, sy - r * 0.6, 2.6, "#5fe0c8", 14);
      } else if (id === "sporecap") {
        g.strokeStyle = "#6a6258"; g.lineWidth = 3.2; g.lineCap = "round"; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + sway * 0.4, sy - 17); g.stroke();
        g.save(); g.shadowColor = "rgba(150,90,210,0.9)"; g.shadowBlur = 13; g.fillStyle = "#5a3a7a"; g.beginPath(); g.ellipse(sx + sway * 0.4, sy - 18, 8.5, 5.5, 0, Math.PI, 0); g.fill(); g.restore();
        glow(g, sx + sway * 0.4, sy - 21, 1.4, "#c890ff", 8);
      } else {
        g.strokeStyle = "#1f5a3a"; g.lineWidth = 2.2; g.lineCap = "round";
        for (let i = -1; i <= 1; i++) { const x = sx + i * 5; g.beginPath(); g.moveTo(x, sy); g.quadraticCurveTo(x + sway + i * 3, sy - 12, x + sway, sy - 20); g.stroke(); glow(g, x + sway, sy - 20, 1.8, "#5fe0a0", 8); }
      }
      g.restore();
    },

    paintMonument(g, sx, sy, env) {                              // a colossal slime organism, drained to night
      const t = env.t, pulse = RM() ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.1), wob = RM() ? 0 : Math.sin(t * 1.6) * 2;
      u.shadow(g, sx, sy, 26);
      g.fillStyle = u.hexA("#173f30", 0.95); g.beginPath(); g.moveTo(sx - 7, sy); g.quadraticCurveTo(sx - 15 + wob, sy - 36, sx - 5, sy - 70); g.lineTo(sx + 5, sy - 70); g.quadraticCurveTo(sx + 15 + wob, sy - 36, sx + 7, sy); g.closePath(); g.fill();
      for (let i = 0; i < 4; i++) { const yy = sy - 15 - i * 14; glow(g, sx + (i % 2 ? 5 : -5) + wob * 0.5, yy, 4 - i * 0.3, "#3fd0a0", 11); }
      glow(g, sx, sy - 78, 7 + pulse * 3, "#5fe0c8", 22 + pulse * 13);
      g.fillStyle = "#dffff6"; g.beginPath(); g.arc(sx, sy - 78, 3, 0, Math.PI * 2); g.fill();
    },

    paintKiosk(g, sx, sy, ex, active, env) {
      const t = env.t, b = bio(env.biome), slot = ex.slot, dy = active ? -2 : 0;
      const s1 = u.hash01(slot * 13 + 3, slot * 7 + 5), s2 = u.hash01(slot * 5 + 9, slot * 11 + 2);
      u.shadow(g, sx, sy, 26);
      u.shadow(g, sx, sy, 34);
      const baseY = sy + dy, ww = 27 + Math.floor(s1 * 9), hh = 48 + Math.floor(s2 * 18);   // a BIG bulbous slime-dwelling, after dark
      const topY = baseY - hh, wob = RM() ? 0 : Math.sin(t * 1.5 + slot) * 1.5;
      if (b.stilt) { g.strokeStyle = "#120e08"; g.lineWidth = 3; for (const s of [-ww * 0.5, ww * 0.5]) { g.beginPath(); g.moveTo(sx + s, baseY + 8); g.lineTo(sx + s, baseY - 6); g.stroke(); } }
      const grad = g.createLinearGradient(0, topY, 0, baseY);
      grad.addColorStop(0, u.shade(b.wall, 0.2)); grad.addColorStop(1, u.shade(b.wall, -0.22));
      g.fillStyle = grad; g.beginPath();
      g.moveTo(sx - ww, baseY);
      g.bezierCurveTo(sx - ww * 1.12, baseY - hh * 0.55, sx - ww * 0.7 + wob, topY, sx + wob, topY);
      g.bezierCurveTo(sx + ww * 0.7 + wob, topY, sx + ww * 1.12, baseY - hh * 0.55, sx + ww, baseY);
      g.quadraticCurveTo(sx, baseY + 8, sx - ww, baseY);
      g.closePath(); g.fill();
      g.lineWidth = 2; g.strokeStyle = "rgba(0,0,0,0.55)"; g.stroke();
      if (!RM()) { g.save(); g.globalAlpha = 0.3; glow(g, sx, baseY - hh * 0.42, hh * 0.3, "#3fd0a0", 16); g.restore(); }   // dim inner glow
      g.fillStyle = "rgba(180,220,200,0.1)"; g.beginPath(); g.ellipse(sx - ww * 0.34, topY + hh * 0.26, ww * 0.22, hh * 0.15, -0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(0,0,0,0.72)"; g.beginPath(); g.ellipse(sx, baseY - hh * 0.13, ww * 0.3, hh * 0.2, 0, Math.PI, 0); g.closePath(); g.fill();   // ooze-doorway
      // the warm glowing window (the only comfort)
      const lit = active ? 1 : 0.6 + (RM() ? 0 : 0.18 * Math.sin(t * 2 + slot));
      g.save(); g.shadowColor = "rgba(255,180,80,0.9)"; g.shadowBlur = active ? 16 : 10; g.fillStyle = u.hexA("#ffb24a", lit); g.beginPath(); g.ellipse(sx + ww * 0.42, baseY - hh * 0.5, ww * 0.15, hh * 0.12, 0, 0, Math.PI * 2); g.fill(); g.restore();
      g.fillStyle = u.shade(b.wall, -0.18);
      for (const ddx of [-ww * 0.62, -ww * 0.05, ww * 0.5]) { g.beginPath(); g.moveTo(sx + ddx - 2.5, baseY - 1); g.quadraticCurveTo(sx + ddx, baseY + 9, sx + ddx + 2.5, baseY - 1); g.lineTo(sx + ddx + 2.5, baseY - 6); g.lineTo(sx + ddx - 2.5, baseY - 6); g.closePath(); g.fill(); }
      if (b.snow) { g.fillStyle = "rgba(200,214,224,0.45)"; g.beginPath(); g.ellipse(sx + wob, topY + 4, ww * 0.5, 6, 0, Math.PI, 0); g.fill(); }
      // THE menu item — a DAMAGED NEON MARQUEE salvaged from an abandoned amusement park:
      // a rusted, chipped backing board ringed by half-dead bulbs, with the label burning in
      // glass neon TUBES (a couple of letters dead, one flickering). The whole sign buzzes and
      // browns-out. Each sign is broken in its OWN way — seeded by slot, so it stays consistent.
      const sway = RM() ? 0 : Math.sin(t * 1.2 + slot) * 6, near = active ? 1.35 : 1;
      const NEON = NEONS[(u.hash01(slot * 3 + 1, 7) * NEONS.length) | 0];   // this sign's tube colour
      g.font = "800 16px 'Arial Narrow','Helvetica Neue',Impact,sans-serif";   // condensed display = marquee tubes
      const label = ex.title.toUpperCase(), n = label.length, GAP = 2;
      let tw = 0; for (let i = 0; i < n; i++) tw += g.measureText(label[i]).width + GAP; tw = Math.max(0, tw - GAP);   // tube-gap layout, no array
      const bw = Math.max(58, tw + 30), bh = 34, rr = 5;
      const bcx = sx + sway, bcy = topY - 50, x0 = bcx - bw / 2, y0 = bcy - bh / 2;
      // BUZZ: a mains hum with occasional brown-out dropouts. Fixed "lit" when motion is reduced.
      let buzz = 1;
      if (!RM()) { const ft = t * 7.3 + slot * 2.1, w = Math.sin(ft) + 0.7 * Math.sin(ft * 2.7 + 1.3); buzz = w < -1.15 ? 0.1 : 0.66 + 0.34 * Math.sin(ft * 4.1); }

      // 1) connector — a rusted pole from house to board, faintly neon-lit at the seam
      g.save(); g.lineCap = "round"; g.strokeStyle = "#1b160e"; g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(sx, topY - 3); g.quadraticCurveTo(sx + sway * 0.5, bcy + bh * 0.55, bcx, y0 + bh); g.stroke();
      g.strokeStyle = u.hexA(NEON, 0.35); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(sx, topY - 3); g.quadraticCurveTo(sx + sway * 0.5, bcy + bh * 0.55, bcx, y0 + bh); g.stroke(); g.restore();

      // 2) rusted backing board — dark, grimy, chipped; the neon must pop against this
      const bg = g.createLinearGradient(0, y0, 0, y0 + bh);
      bg.addColorStop(0, "#231b12"); bg.addColorStop(0.55, "#15100a"); bg.addColorStop(1, "#0b0805");
      g.fillStyle = bg; g.beginPath();
      g.moveTo(x0 + rr, y0); g.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, rr); g.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, rr); g.arcTo(x0, y0 + bh, x0, y0, rr); g.arcTo(x0, y0, x0 + bw, y0, rr); g.closePath(); g.fill();
      g.fillStyle = "rgba(74,52,30,0.16)"; for (let i = 0; i < 3; i++) { const rx = x0 + 6 + u.hash01(slot + i, 11) * (bw - 12); g.fillRect(rx, y0 + 2, 1.5, bh - 4); }   // rust streaks
      g.lineWidth = 1.4; g.strokeStyle = u.hexA(BONE, 0.16); g.beginPath();   // pitted metal frame
      g.moveTo(x0 + rr, y0); g.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, rr); g.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, rr); g.arcTo(x0, y0 + bh, x0, y0, rr); g.arcTo(x0, y0, x0 + bw, y0, rr); g.closePath(); g.stroke();
      const chipX = x0 + 10 + u.hash01(slot, 19) * (bw - 28);   // a bitten-out chunk of the top edge (cuts the frame)
      g.fillStyle = "#0b0805"; g.beginPath(); g.moveTo(chipX, y0 - 1); g.lineTo(chipX + 10, y0 - 1); g.lineTo(chipX + 5, y0 + 5); g.closePath(); g.fill();
      const cyk = y0 + 5 + u.hash01(slot, 37) * (bh - 12);   // a hairline crack
      g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0 + 4, cyk); g.lineTo(x0 + bw * 0.42, cyk + 3); g.lineTo(x0 + bw * 0.58, cyk - 2); g.stroke();

      // 3) marquee BULBS ringing top & bottom — some warm-lit, most burnt out, a few flicker
      const per = Math.max(4, Math.round((bw - 10) / 11));
      for (let i = 0; i <= per; i++) {
        const fx = x0 + 5 + (i / per) * (bw - 10);
        for (let row = 0; row < 2; row++) {
          const fy = row ? y0 + bh - 3.5 : y0 + 3.5, h = u.hash01(slot * 5 + i * 2 + row, 41);
          let on = h > 0.42;   // most bulbs are dead
          if (on && !RM() && u.hash01(slot + i + row, 53) < 0.22) on = Math.sin(t * 11 + i + slot + row * 2) > -0.3;   // a few flicker
          if (on) { const c = h > 0.7 ? "#ffcf6a" : NEON; g.save(); g.shadowColor = c; g.shadowBlur = (RM() ? 6 : 4 + buzz * 5) * near; g.fillStyle = c; g.beginPath(); g.arc(fx, fy, 1.7, 0, Math.PI * 2); g.fill(); g.restore(); }
          else { g.fillStyle = "#191510"; g.beginPath(); g.arc(fx, fy, 1.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(120,110,90,0.18)"; g.lineWidth = 0.7; g.stroke(); }   // a dead socket
        }
      }

      // 4) the neon-TUBE label: lit letters glow as glass tubes; a couple are dead, one flickers.
      //    Dead/flickered letters still leave faint cold glass so the word stays navigable.
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineCap = "round";
      const deadA = (u.hash01(slot * 7 + 2, 29) * n) | 0, deadB = (u.hash01(slot * 11 + 5, 31) * n) | 0;
      const flickI = (u.hash01(slot * 13 + 1, 23) * n) | 0;
      let cx = bcx - tw / 2;
      for (let i = 0; i < n; i++) {
        const ch = label[i], cw = g.measureText(ch).width, gx = cx + cw / 2;
        const dead = n >= 3 && (i === deadA || i === deadB);
        let lit = dead ? 0 : 1;
        if (!RM() && !dead && n >= 2 && i === flickI) lit = Math.sin(t * 17 + slot) > -0.2 ? 1 : 0.14;   // the flickering letter
        if (lit > 0.05) {
          const gl = buzz * lit;
          g.save();
          g.shadowColor = NEON; g.shadowBlur = (RM() ? 9 : 4 + gl * 10) * near;
          g.lineWidth = 3.4; g.strokeStyle = u.hexA(NEON, 0.45 + 0.5 * gl); g.strokeText(ch, gx, bcy);   // outer glass-tube glow
          g.shadowBlur = (RM() ? 4 : gl * 5) * near;
          g.lineWidth = 1.3; g.strokeStyle = u.hexA("#f6fffb", 0.6 + 0.4 * gl); g.strokeText(ch, gx, bcy);   // hot inner filament
          g.restore();
        } else { g.lineWidth = 2; g.strokeStyle = "rgba(150,160,152,0.26)"; g.strokeText(ch, gx, bcy); }   // burnt-out: cold dead glass
        cx += cw + GAP;
      }
      if (ex.visited) glow(g, x0 + bw - 2, y0 - 2, 3, "#5fe0c8", 8);
    },

    paintSignpost(g, sx, sy, dir, dist, info) {
      g.strokeStyle = "#1a140c"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 26); g.stroke();
      const w = 40, h = 15, bx = dir > 0 ? sx - 6 : sx - w + 6, by = sy - 30;
      u.roundRect(bx, by, w, h, 4, "#11180f", TEAL);
      g.fillStyle = GOLD; g.font = "700 11px var(--mh-display)"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText((dir > 0 ? "→ " : "← ") + dist, bx + w / 2, by + h / 2);
      glow(g, sx + (dir > 0 ? -6 : 6), sy - 22, 2, GOLD, 8);
    },
  };

  window.MH_ISO.register(theme);
})();
