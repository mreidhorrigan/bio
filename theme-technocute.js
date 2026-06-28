// @ts-check
"use strict";
/* ============================================================================
   THEME · TECHNOCUTE  (a.k.a. bureaucore)  — the main, minimalist skin.
   ----------------------------------------------------------------------------
   Clean flat board, fat black outlines, the house PENTAD (cyan #c3f0ff as THE
   interaction highlight). Minimalist, with the toy-solid feel of desktop tower
   defence: each kiosk is a little BUILDING you can read at a glance. No
   gridlines. The avatar is the house slime. Light, calm, "cute bureaucracy".
   ========================================================================== */

(function () {
  const U = window.MH_ISO.util;
  const BLACK = "#111111", PAPER = "#f4f0e6", PAPER2 = "#ece5d4";
  const CYAN = "#c3f0ff", VIO = "#5b2a86", ORG = "#f28b46", ROSE = "#cb4d79", GRN = "#4dcb53", TEAL = "#2a8186", GOLD = "#ba962c";
  const LEAF = "16px 4px 16px 4px / 7px 2px 7px 2px", LEAF_LG = "22px 6px 22px 6px / 12px 4px 12px 4px", LEAF_SM = "8px 3px 8px 3px / 5px 2px 5px 2px";

  function bRect(g, x, y, w, h, fill, bw) { g.fillStyle = BLACK; g.fillRect(x - bw, y - bw, w + 2 * bw, h + 2 * bw); g.fillStyle = fill; g.fillRect(x, y, w, h); }
  /** a flat iso box (top + two side faces), black-edged. (sx,sy) = front-bottom point. */
  function box(g, sx, sy, hw, h, top) {
    const q = hw * 0.5;
    U.poly(g, [[sx - hw, sy - h], [sx, sy - h + q], [sx, sy + q], [sx - hw, sy]], U.shade(top, -0.16));   // left
    U.poly(g, [[sx + hw, sy - h], [sx, sy - h + q], [sx, sy + q], [sx + hw, sy]], U.shade(top, -0.34));   // right
    U.poly(g, [[sx, sy - h - q], [sx + hw, sy - h], [sx, sy - h + q], [sx - hw, sy - h]], top);            // top
    g.strokeStyle = BLACK; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath(); g.moveTo(sx - hw, sy - h); g.lineTo(sx, sy - h - q); g.lineTo(sx + hw, sy - h); g.lineTo(sx + hw, sy); g.lineTo(sx, sy + q); g.lineTo(sx - hw, sy); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(sx, sy - h + q); g.lineTo(sx, sy + q); g.moveTo(sx - hw, sy - h); g.lineTo(sx, sy - h + q); g.lineTo(sx + hw, sy - h); g.stroke();
  }

  const theme = {
    id: "technocute",
    name: "technocute/bureaucore",
    tagline: "A tidy, empty little board of buildings. Walk up and click one to step inside. The block tower marks the plaza.",
    tileW: 96, tileH: 48,
    worldPeriod: 52,
    speed: 5.0,
    propDensity: 0,
    wayfinding: { compass: false, roads: true, signposts: false, recall: true, fog: false },
    avatarColors: [VIO, ORG, ROSE, GRN], avatarInk: BLACK,
    accents: [VIO, ORG, ROSE, GRN, TEAL, GOLD],
    audio: { root: 277.18, scale: [0, 2, 4, 7, 9], type: "square" },
    bgCss: PAPER,
    ecology: { enabled: false },                                  // minimalist: a clean board
    // bureaucore is strictly functional: a fluid plaza + roads for orientation, buildings
    // for interaction, and NOTHING else — no beacon, no scenery, no grid.
    fluidGround: true, plazaColor: "#dcf3ff", roadColor: "#8a5cc0", monument: true,   // a plain tall cone marks the plaza (orientation only)
    spurRoads: true,   // grow the Music/Games roads of project houses here too — same world geometry as the slime skins

    css: `
      :root{
        --mh-ui:"Arial Black","Helvetica Neue",Helvetica,Arial,sans-serif;
        --mh-display:"Arial Black","Helvetica Neue",Helvetica,Arial,sans-serif;
        --mh-body:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
      }
      body{ color:${BLACK}; }
      #mh-back{ color:${BLACK}; background:#fff; border:3px solid ${BLACK}; border-radius:${LEAF}; box-shadow:4px 4px 0 ${BLACK}; opacity:1; font-weight:900; }
      #mh-back:hover{ background:${CYAN}; filter:drop-shadow(0 0 5px ${CYAN}); transform:translate(-1px,-1px); }
      .mh-overlay{ background:rgba(244,240,230,.82); }
      .mh-panel{ background:#fff; border:4px solid ${BLACK}; box-shadow:10px 10px 0 ${BLACK}; padding:30px 26px; border-radius:${LEAF_LG}; }
      .mh-kicker{ color:${BLACK}; background:${CYAN}; display:inline-block; padding:5px 11px; border:3px solid ${BLACK}; border-radius:${LEAF}; box-shadow:4px 4px 0 ${BLACK}; filter:drop-shadow(0 0 5px ${CYAN}); letter-spacing:.06em; }
      #mh-title{ color:${BLACK}; text-transform:uppercase; letter-spacing:-.01em; margin-top:16px; }
      #mh-title::first-letter{ background:${CYAN}; box-shadow:3px 3px 0 ${BLACK}; padding:0 .08em; filter:drop-shadow(0 0 5px ${CYAN}); }
      .mh-tagline{ color:#2a2a2a; }
      .mh-btn{ color:${BLACK}; background:${CYAN}; border:3px solid ${BLACK}; border-radius:${LEAF}; box-shadow:6px 6px 0 ${BLACK}; filter:drop-shadow(0 0 6px ${CYAN}); text-transform:uppercase; letter-spacing:.04em; }
      .mh-btn:hover{ transform:translate(-2px,-2px); box-shadow:8px 8px 0 ${BLACK}; }
      .mh-btn:active{ transform:translate(2px,2px); box-shadow:2px 2px 0 ${BLACK}; }
      .mh-picklabel{ color:${BLACK}; }
      .mh-swatch{ border:3px solid ${BLACK}; border-radius:${LEAF_SM}; box-shadow:4px 4px 0 ${BLACK}; }
      .mh-swatch.mh-sel{ transform:translate(-2px,-2px); box-shadow:6px 6px 0 ${BLACK}, 0 0 0 2px ${CYAN}; }
      .mh-card{ background:#fff; border:4px solid ${BLACK}; box-shadow:12px 12px 0 ${BLACK}; border-radius:${LEAF_LG}; }
      .mh-card-head{ border-bottom:4px solid ${BLACK}; background:var(--mh-card-accent,${ORG}); }
      .mh-card-head h2{ color:#fff; text-transform:uppercase; text-shadow:2px 2px 0 ${BLACK}; }
      .mh-x{ color:${BLACK}; background:#fff; border:3px solid ${BLACK}; border-radius:${LEAF_SM}; font-weight:900; }
      .mh-x:hover{ background:${CYAN}; filter:drop-shadow(0 0 5px ${CYAN}); }
      .mh-card-body{ color:${BLACK}; }
      .mh-prose a{ color:${BLACK}; background:${CYAN}; border-radius:${LEAF}; filter:drop-shadow(0 0 4px ${CYAN}); text-decoration:none; padding:0 .25em; font-weight:700; }
      .mh-prose a:hover{ background:${VIO}; color:#fff; filter:none; }
      .mh-prose .mh-big{ color:${BLACK}; text-transform:uppercase; }
      .mh-card-foot{ border-top:3px solid ${BLACK}; color:#333; }
      .mh-hint{ color:${BLACK}; background:#fff; border:3px solid ${BLACK}; box-shadow:4px 4px 0 ${BLACK}; padding:6px 11px; border-radius:${LEAF}; font-weight:700; }
      .mh-progress{ color:${BLACK}; background:${CYAN}; border:3px solid ${BLACK}; border-radius:${LEAF}; box-shadow:4px 4px 0 ${BLACK}; filter:drop-shadow(0 0 5px ${CYAN}); }
      .mh-navbar{ background:transparent; }
      .mh-navchip{ background:#fff; color:${BLACK}; border:2.5px solid ${BLACK}; border-radius:${LEAF}; box-shadow:3px 3px 0 ${BLACK}; text-transform:uppercase; }
      .mh-navchip:hover{ background:${CYAN}; filter:drop-shadow(0 0 5px ${CYAN}); transform:translate(-1px,-1px); }
      .mh-navhome{ background:${VIO} !important; color:#fff !important; }
      .mh-skin{ background:#fff; color:${BLACK}; border:2px solid ${BLACK}; box-shadow:2px 2px 0 ${BLACK}; }
      .mh-skin.mh-cur{ background:${CYAN}; color:${BLACK}; filter:drop-shadow(0 0 5px ${CYAN}); }
      .mh-plain{ color:${BLACK}; }
    `,

    paintBackground(g, env) { g.fillStyle = PAPER; g.fillRect(0, 0, env.W, env.H); },

    paintGround() { /* flat paper field; the engine draws the fluid plaza + roads */ },

    /** the plaza beacon: a simple tall cone (orientation only). */
    paintMonument(g, sx, sy, env) {
      U.poly(g, [[sx + 11, sy + 2], [sx + 30, sy + 11], [sx + 11, sy + 20], [sx - 12, sy + 11]], "rgba(17,17,17,0.85)");  // shadow
      const h = 84, w = 22;
      U.poly(g, [[sx, sy - h], [sx + w, sy], [sx, sy + 9], [sx - w, sy]], CYAN);              // cone (iso base)
      U.poly(g, [[sx, sy - h], [sx, sy + 9], [sx - w, sy]], U.shade(CYAN, -0.12));            // shaded side
      g.lineWidth = 2.5; g.strokeStyle = BLACK; g.lineJoin = "round";
      g.beginPath(); g.moveTo(sx, sy - h); g.lineTo(sx + w, sy); g.lineTo(sx, sy + 9); g.lineTo(sx - w, sy); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(sx, sy - h); g.lineTo(sx, sy + 9); g.stroke();                  // centre ridge
      g.fillStyle = ORG; g.beginPath(); g.arc(sx, sy - h, 4.5, 0, Math.PI * 2); g.fill();     // tip
      g.lineWidth = 2; g.strokeStyle = BLACK; g.stroke();
    },

    propAt() { return null; },                                   // maximally decluttered: no scenery at all

    /** each kiosk is a little building — a stacked tower with a coloured cap, a number
     *  plate, and a title banner. Height/cap vary by slot so they read as distinct. */
    paintKiosk(g, sx, sy, ex, active, env) {
      const dy = active ? -2 : 0, accent = ex.accent, slot = ex.slot, H = 46;
      U.poly(g, [[sx + 13, sy + 4], [sx + 34, sy + 15], [sx + 13, sy + 26], [sx - 15, sy + 15]], "rgba(17,17,17,0.85)");  // shadow
      box(g, sx, sy + dy, 22, H, accent);                        // ONE clean solid block — maximally simple
      // big number plate centred on the front face
      bRect(g, sx - 13, sy - 28 + dy, 26, 26, "#fff", 2.5);
      g.fillStyle = BLACK; g.font = "900 21px var(--mh-display)"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(slot + 1), sx, sy - 15 + dy);
      // title banner above the block
      g.font = "800 13px var(--mh-display)";
      const tw = g.measureText(ex.title.toUpperCase()).width + 14, by = sy - H + dy - 26;
      bRect(g, sx - tw / 2, by, tw, 18, active ? CYAN : "#fff", 2);
      g.fillStyle = BLACK; g.textBaseline = "middle"; g.fillText(ex.title.toUpperCase(), sx, by + 9);
      if (ex.visited) { bRect(g, sx + 16, sy - 10 + dy, 12, 12, GRN, 2); g.fillStyle = BLACK; g.font = "900 10px var(--mh-display)"; g.fillText("✓", sx + 22, sy - 3 + dy); }
      if (active) {
        g.save(); g.shadowColor = U.hexA(CYAN, 0.9); g.shadowBlur = 8;
        bRect(g, sx - 44, sy + 19, 88, 21, CYAN, 0); g.restore();
        g.strokeStyle = BLACK; g.lineWidth = 2.5; g.strokeRect(sx - 44, sy + 19, 88, 21);
        g.fillStyle = BLACK; g.font = "900 12px var(--mh-ui)"; g.fillText("ENTER →", sx, sy + 29.5);
      }
    },

    paintSignpost(g, sx, sy, dir, dist, info) {
      bRect(g, sx - 2, sy - 26, 4, 26, BLACK, 0);
      const w = 38, h = 16, bx = dir > 0 ? sx - 6 : sx - w + 6, by = sy - 30;
      g.fillStyle = BLACK; g.fillRect(bx + 4, by + 4, w, h);
      bRect(g, bx, by, w, h, CYAN, 2.5);
      g.fillStyle = BLACK; g.font = "900 11px var(--mh-ui)"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText((dir > 0 ? "▶ " : "◀ ") + dist, bx + w / 2, by + h / 2);
    },
  };

  window.MH_ISO.register(theme);
})();
