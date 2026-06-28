// @ts-check
"use strict";
/* ============================================================================
   MH-ISO  ·  a walkable isometric website engine  ·  vanilla JS + Canvas  ·  0 deps
   ----------------------------------------------------------------------------
   A visitor walks an avatar (WASD / arrows / tap) around a hub "plaza" of
   KIOSKS. Each kiosk opens one card of the site's content (about, research,
   teaching, CV…). Beyond the plaza the world is generated procedurally and
   extends forever — but it is a TORUS (everything repeats on a period), so
   wandering in any direction eventually loops you back to the plaza. Roads
   radiate from the plaza along the world axes; because the world wraps, every
   road leads to a plaza. That is the primary wayfinding. A HUD compass and
   wooden signposts are OPTIONAL extras a theme can switch on.

   This file is the presentation-agnostic SHELL. The look lives entirely in a
   THEME object (palette + canvas painters + CSS) and the words in a CONTENT
   object (the kiosks). One engine, many skins:  MH_ISO.start(theme, content).

   ARCHITECTURE
     1 DEFAULTS   2 STATE   3 DOM        4 AUDIO     5 WORLD (torus + zones)
     6 HUB        7 INPUT   8 UPDATE     9 RENDER    10 MODAL
     11 DEFAULT PAINTERS    12 HELPERS

   THEME CONTRACT (every field optional except id/name — engine has defaults):
     id, name, tagline                         strings
     tileW, tileH                              iso tile size (2:1 looks classic)
     worldPeriod                               torus size in tiles (loop length)
     hubRadius, ringRadius                     plaza platform / kiosk ring radii
     speed, interact, obstacle                 movement tuning (tiles)
     propDensity                               0..1 scenery frequency in the field
     wayfinding { compass, roads, signposts, recall, beacon }   booleans
     avatarColors []                           swatches for the avatar picker
     accents []                                kiosk accent colours (round-robin)
     audio { root, scale[], type }             SFX pitch set + waveform
     bgCss                                     page backdrop (behind the canvas)
     css                                       injected skin CSS (modal/HUD/intro)
     paintBackground(ctx, env)                 full-screen backdrop each frame
     groundType(tx, ty, n) -> string           name a field tile from noise n (0..1)
     paintGround(ctx, sx, sy, info)            one floor diamond (zone+type aware)
     propAt(tx, ty) -> id|null                 scenery on a FIELD tile (or null)
     paintProp(ctx, sx, sy, id, info)          draw that scenery (has height)
     paintMonument(ctx, sx, sy, env)           the tall plaza landmark / beacon
     paintKiosk(ctx, sx, sy, ex, active, env)  one kiosk
     paintAvatar(ctx, sx, sy, face, env)       the player token
     paintSignpost(ctx, sx, sy, dir, dist, env)road signpost (if wayfinding.signposts)
   `env`/`info` carry { t, dpr, ... } plus tile data; see callers below.
   No build step. Edit, save, refresh.  See README.md for the extension recipes.
   ========================================================================== */

(function () {

/* ----------------------------------------------------------------------------
   1. DEFAULTS  — a theme overrides any of these
   -------------------------------------------------------------------------- */

const DEFAULTS = {
  id: "base", name: "Untitled", tagline: "A walkable site.",
  tileW: 96, tileH: 48,
  worldPeriod: 56,          // loop length: walk this many tiles and the plaza returns
  hubRadius: 3.1,           // plaza platform radius (tiles)
  ringRadius: 3.5,          // kiosk ring radius (tiles)
  speed: 5.2,               // tiles / second
  interact: 1.95,           // open-range to a kiosk (tiles)
  obstacle: 0.85,           // kiosks softly block within this radius (tiles)
  propDensity: 0.14,        // chance a field tile carries scenery
  signSpacing: 7,           // tiles between signposts along a road
  fogColor: "8,6,16",       // "r,g,b" of the distance vignette that closes in as you wander
  wayfinding: { compass: false, roads: true, signposts: true, recall: true, beacon: true, fog: true },
  navbar: true,             // HUD quick-nav of the kiosks, shown when you wander out of sight of them
  edgeMarkers: true,        // off-screen kiosks get clamped edge arrows while none are on screen
  kioskGlow: true,          // a pulsing accent pool under each kiosk so they read as interactive
  avatarColors: ["#5b2a86", "#f28b46", "#2a8186", "#862a4a"],
  accents: ["#5b2a86", "#f28b46", "#2a8186", "#862a4a", "#287e2c", "#ba962c"],
  audio: { root: 261.63, scale: [0, 2, 4, 7, 9], type: "sine" },
  bgCss: "#0e0a1f",
  css: "",
};

/* ----------------------------------------------------------------------------
   2. STATE
   -------------------------------------------------------------------------- */

let T = DEFAULTS, CONTENT = null;
let TILE_W = 96, TILE_H = 48, P = 56;

/** @type {HTMLCanvasElement} */ let canvas;
/** @type {CanvasRenderingContext2D} */ let ctx;
let W = 0, H = 0, dpr = 1;
let originX = 0, originY = 0;          // camera offset (per frame)
let tnow = 0, last = 0, frameMs = 16, perfSkip = 0;

/** @type {"intro"|"walking"|"card"} */ let mode = "intro";

let HX = 0, HY = 0;                     // hub centre (canonical tile, in [0,P))
/** @typedef {{tx:number, ty:number, title:string, accent:string, slot:number, visited:boolean}} Exhibit */
/** @type {Exhibit[]} */ let EXHIBITS = [];
const SPUR_TILES = new Set();          // wrapped "tx,ty" keys paved as the Music/Games house-roads (slimeverse only)
let activeIndex = -1, prevActive = -1, currentTarget = -1, openIndex = -1;
let avatarIndex = 0;

const player = { x: 0, y: 0, fx: 0, fy: 1, moving: false };
const keys = { up: false, down: false, left: false, right: false };
// auto-walk: goal>=0 → a kiosk image (opens on arrival); goal<0 → a free point
const auto = { active: false, goal: -1, tx: 0, ty: 0, lastDist: Infinity, stuck: 0, warp: false };

let toastText = "", toastUntil = 0;
let inHub = true;                       // is the player on/over the plaza platform?
let kiosksOut = false;                  // are ALL kiosks currently off-screen? (→ show nav-bar + edge markers)
let reduce = false;                     // prefers-reduced-motion: themes gate flicker/glitch on this
const REGISTRY = new Map();             // id -> raw theme, for the live skin-switcher
let started = false, switcherEl = null;
// build mode (AoE2 / Frostpunk-ish): rearrange the buildings, add decorative ones
let buildMode = false, buildTool = "move", drag = null, buildbarEl = null, buildToggleEl = null, menuOpen = false;
/** @type {{tx:number, ty:number, type:string}[]} decorative buildings the visitor places */
const BUILDINGS = [];

// DOM refs (filled in buildDOM)
let introEl, cardEl, cardTitleEl, cardBodyEl, hudEl, hintEl, compassEl, compassArrowEl,
    compassDistEl, progressEl, startBtn, pickerEl, navbarEl;
let lastHint = "";

/* ----------------------------------------------------------------------------
   3. DOM  — the engine builds its own canvas / HUD / intro / modal, so a themed
   page is a thin loader. Structural CSS here; skin CSS comes from the theme.
   -------------------------------------------------------------------------- */

function buildDOM() {
  document.documentElement.style.background = T.bgCss;
  document.body.style.background = T.bgCss;

  const base = document.createElement("style");
  base.id = "mh-base";
  base.textContent = BASE_CSS;
  document.head.appendChild(base);

  const skin = document.createElement("style");
  skin.id = "mh-theme";
  skin.textContent = T.css || "";
  document.head.appendChild(skin);

  const root = document.createElement("div");
  root.id = "mh-root";
  root.innerHTML = `
    <canvas id="mh-game"></canvas>
    <a id="mh-back" href="index.html" title="Back to the design gallery">‹ designs</a>
    <nav id="mh-navbar" class="mh-navbar mh-faded" aria-label="Jump to a section"></nav>
    <div id="mh-switcher" class="mh-switcher mh-faded" role="group" aria-label="Choose a skin"></div>
    <div id="mh-mark" title="matthorrigan.com — same place, different light"><span>MH</span></div>
    <div id="mh-buildbar" class="mh-buildbar mh-faded" role="toolbar" aria-label="Build tools">
      <button class="mh-tool mh-cur" type="button" data-tool="move"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:4px" aria-hidden="true"><path d="M12 4V20M4 12H20M12 4l-2.5 2.5M12 4l2.5 2.5M12 20l-2.5-2.5M12 20l2.5-2.5M4 12l2.5-2.5M4 12l2.5 2.5M20 12l-2.5-2.5M20 12l-2.5 2.5"/></svg>Move</button>
      <button class="mh-tool" type="button" data-tool="house">Plant a house.</button>
      <button class="mh-tool" type="button" data-tool="tree">Build a tree.</button>
      <button class="mh-tool" type="button" data-tool="delete">✕ Remove</button>
      <button class="mh-tool mh-tool-done" type="button" data-tool="done">Done</button>
    </div>

    <div id="mh-intro" class="mh-overlay">
      <div class="mh-panel">
        <div class="mh-kicker" id="mh-themechip"></div>
        <h1 id="mh-title">Matt Horrigan</h1>
        <p class="mh-tagline" id="mh-tagline"></p>
        <button id="mh-start" class="mh-btn">Enter ›</button>
        <div class="mh-legend" id="mh-legend">
          <span><b>WASD</b> / arrows move</span>
          <span><b>tap</b> a kiosk to open it</span>
          <span><b>E</b> open · <b>Space</b> next</span>
          <span><b>G</b> back to the plaza</span>
        </div>
        <div class="mh-pickwrap">
          <div class="mh-picklabel">Choose your colour</div>
          <div id="mh-picker" class="mh-picker"></div>
        </div>
        <a id="mh-plain" class="mh-plain" href="../../index.html">Prefer to read it as a plain page? ›</a>
      </div>
    </div>

    <div id="mh-card" class="mh-overlay mh-hidden">
      <div class="mh-card" id="mh-cardInner" tabindex="-1">
        <div class="mh-card-head">
          <button id="mh-cardBack" class="mh-back-btn mh-hidden" type="button" title="Back to the menu">‹ Menu</button>
          <h2 id="mh-cardTitle">Title</h2>
          <button id="mh-cardClose" class="mh-x" title="Close (E / Esc)">✕</button>
        </div>
        <div class="mh-card-body mh-prose" id="mh-cardBody"></div>
        <div class="mh-card-foot">
          <span><b>E</b> / <b>Esc</b> close</span><span class="mh-sep">·</span>
          <span><b>‹ ›</b> browse</span><span class="mh-sep">·</span>
          <span><b>Space</b> next kiosk</span>
        </div>
      </div>
    </div>

    <div id="mh-hud" class="mh-hidden">
      <div class="mh-hint" id="mh-hint"></div>
      <div class="mh-hud-right">
        <button id="mh-menu" class="mh-hudbtn" type="button" title="Building menu — jump to a building">☰ Menu</button>
        <button id="mh-buildtoggle" class="mh-hudbtn" type="button" title="Rearrange the buildings (B)">✎ Build</button>
        <button id="mh-compass" class="mh-compass mh-hidden" title="Walk back to the plaza (G)">
          <span class="mh-needle" id="mh-needle">›</span>
          <span class="mh-cdist" id="mh-cdist"></span>
        </button>
        <div class="mh-progress" id="mh-progress"></div>
      </div>
    </div>`;
  document.body.appendChild(root);

  canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("mh-game"));
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  introEl = byId("mh-intro");
  cardEl = byId("mh-card");
  cardTitleEl = byId("mh-cardTitle");
  cardBodyEl = byId("mh-cardBody");
  hudEl = byId("mh-hud");
  hintEl = byId("mh-hint");
  compassEl = byId("mh-compass");
  compassArrowEl = byId("mh-needle");
  compassDistEl = byId("mh-cdist");
  progressEl = byId("mh-progress");
  startBtn = /** @type {HTMLButtonElement} */ (byId("mh-start"));
  pickerEl = byId("mh-picker");
  navbarEl = byId("mh-navbar");
  buildbarEl = byId("mh-buildbar");
  buildToggleEl = byId("mh-buildtoggle");

  byId("mh-themechip").textContent = T.name;
  byId("mh-tagline").textContent = T.tagline;
  byId("mh-title").textContent = (CONTENT && CONTENT.title) || "Matt Horrigan";
  document.title = ((CONTENT && CONTENT.title) || "Matt Horrigan") + " · " + T.name;
  if (!T.wayfinding.recall) byId("mh-legend").lastElementChild.remove();

  // base-aware chrome links (see window.MH_SITE; defaults keep dev paths working)
  const SITE = window.MH_SITE || {};
  const baseRoot = SITE.base != null ? SITE.base : "../../";
  const backHref = SITE.back != null ? SITE.back : "index.html";
  const plainHref = SITE.plain != null ? SITE.plain : (baseRoot + "index.html");
  const backEl = byId("mh-back");
  if (backHref) backEl.setAttribute("href", backHref); else backEl.remove();
  byId("mh-plain").setAttribute("href", plainHref);
}

const BASE_CSS = `
  #mh-game{ display:block; position:fixed; inset:0; touch-action:none; }
  .mh-hidden{ display:none !important; }
  #mh-back{ position:fixed; top:12px; left:14px; z-index:8; font:600 13px/1 var(--mh-ui,system-ui,sans-serif);
    text-decoration:none; padding:7px 11px; border-radius:8px; opacity:.82; }
  #mh-back:hover{ opacity:1; }
  .mh-overlay{ position:fixed; inset:0; z-index:10; display:flex; align-items:center; justify-content:center; padding:18px; }
  .mh-panel{ width:min(520px,94vw); text-align:center; }
  .mh-kicker{ font:700 12px/1 var(--mh-ui,system-ui,sans-serif); letter-spacing:.16em; text-transform:uppercase; margin-bottom:10px; }
  #mh-title{ font:800 clamp(34px,7vw,52px)/1.04 var(--mh-display,var(--mh-ui,system-ui,sans-serif)); margin:0 0 8px; }
  .mh-tagline{ font:400 16px/1.5 var(--mh-body,Georgia,serif); margin:0 auto 22px; max-width:38ch; }
  .mh-btn{ appearance:none; border:0; cursor:pointer; font:700 16px var(--mh-ui,system-ui,sans-serif); padding:13px 30px; }
  .mh-btn:disabled{ opacity:.55; cursor:default; }
  .mh-legend{ display:flex; flex-wrap:wrap; gap:8px 16px; justify-content:center; margin:22px auto 6px; max-width:42ch;
    font:400 13px/1.4 var(--mh-ui,system-ui,sans-serif); opacity:.85; }
  .mh-legend b{ font-weight:800; }
  .mh-pickwrap{ margin-top:18px; }
  .mh-picklabel{ font:700 11px/1 var(--mh-ui,system-ui,sans-serif); letter-spacing:.12em; text-transform:uppercase; opacity:.7; margin-bottom:9px; }
  .mh-picker{ display:flex; gap:10px; justify-content:center; }
  .mh-swatch{ width:34px; height:34px; cursor:pointer; border:0; padding:0; }
  .mh-plain{ display:inline-block; margin-top:20px; font:400 13px var(--mh-ui,system-ui,sans-serif); opacity:.62; text-decoration:underline; }
  .mh-plain:hover{ opacity:.9; }
  /* card modal */
  .mh-card{ width:min(680px,94vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; position:relative; }
  .mh-card:focus{ outline:none; }
  .mh-card-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; }
  .mh-card-head h2{ margin:0; font:800 22px var(--mh-display,var(--mh-ui,system-ui,sans-serif)); }
  .mh-x{ appearance:none; cursor:pointer; width:30px; height:30px; font-size:14px; line-height:1; position:absolute; top:12px; right:14px; z-index:6; }   /* always top-right, every kiosk */
  .mh-card-body{ padding:0 22px 6px; overflow:auto; font:400 16px/1.62 var(--mh-body,Georgia,serif); }
  .mh-prose p{ margin:0 0 13px; } .mh-prose a{ font-weight:700; }
  .mh-prose ul{ margin:0 0 13px; padding-left:1.1em; } .mh-prose li{ margin:4px 0; }
  .mh-prose .mh-big{ font:800 30px var(--mh-display,var(--mh-ui,system-ui,sans-serif)); display:block; margin:2px 0 6px; }
  /* large page sub-window: a big centred panel showing a REAL site page in an iframe
     (the CV, the homepage sections, or a picked tool/game). Reuses .mh-card + .mh-overlay
     so every theme's palette carries over; only the size + a flush iframe are new. */
  .mh-card.mh-card--page{ width:94vw; max-width:none; height:92vh; max-height:92vh; position:relative; }
  /* a real page keeps its OWN menubar — so drop our card chrome and float only the controls */
  .mh-card--page .mh-card-head{ position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between; align-items:flex-start; background:transparent; border:none; padding:7px 9px; z-index:5; pointer-events:none; }
  .mh-card--page .mh-card-head > button{ pointer-events:auto; }
  .mh-card--page #mh-cardTitle{ display:none; }
  .mh-card--page .mh-card-foot{ display:none; }
  .mh-card--page .mh-card-body{ flex:1 1 auto; padding:0; overflow:hidden; display:flex; }
  /* TOC card: drop the kiosk-title bar + the key-hint footer entirely — just the dropdown + the floating close */
  .mh-card.mh-card--clean{ background:transparent; border:none; box-shadow:none; width:auto; max-width:min(380px,94vw); overflow:visible; }
  .mh-card--clean #mh-cardTitle, .mh-card--clean .mh-card-foot{ display:none; }
  .mh-card--clean .mh-card-head{ background:transparent; border:none; min-height:0; padding:0; }
  .mh-card--clean .mh-card-body{ padding:0; overflow:visible; }
  .mh-card--clean .mh-toc{ margin:0; max-width:none; }       /* the dropdown IS the card now — no extra themed frame */
  .mh-card--clean .mh-x{ top:-12px; right:-12px; }            /* just overlay the close at the corner */
  .mh-pageframe{ flex:1 1 auto; width:100%; height:100%; border:0; display:block; background:#fff; }
  /* "‹ Menu" back button in the card head — only shown when a TOC item is open in the frame */
  .mh-back-btn{ appearance:none; cursor:pointer; font:700 12px var(--mh-ui,system-ui,sans-serif); line-height:1;
    padding:6px 11px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; color:#fff;
    background:var(--mh-card-accent,rgba(20,20,28,.72)); border:1px solid rgba(255,255,255,.25); }
  .mh-back-btn:hover{ filter:brightness(1.12); }
  .mh-back-btn:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff; }
  /* table-of-contents (Toolbox / Music / Games): the site menubar's DROPDOWN, verbatim — a
     white leaf-cornered panel, soft-grey embossed sans items, brand-cyan fill + glow on hover. */
  .mh-prose .mh-toc{ display:flex; flex-direction:column; gap:2px; margin:10px auto 14px; padding:6px; max-width:min(340px,86vw);
    background:#fff; border:1px solid #d9d9d9; border-radius:22px 6px 22px 6px / 10px 3px 10px 3px; box-shadow:0 6px 18px rgba(0,0,0,.12); }
  .mh-prose .mh-toc-link{ display:block; text-decoration:none; white-space:normal; line-height:1.3; color:#595959; text-transform:none;
    font:500 13px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Helvetica,Arial,sans-serif;
    padding:5.5px 13px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; border:0; background:none;
    box-shadow:-1px -1px 0 rgba(255,255,255,.7), 1px 1px 2px rgba(0,0,0,.10);
    transition:box-shadow .15s ease, background-color .15s ease; }
  .mh-prose .mh-toc-link:hover, .mh-prose .mh-toc-link:focus-visible{ color:#000; background:#c3f0ff; outline:none;
    filter:drop-shadow(0 0 5px #c3f0ff); box-shadow:inset 1px 1px 2px rgba(0,0,0,.16), inset -1px -1px 1px rgba(255,255,255,.55); }
  @media (max-width:600px){ .mh-card.mh-card--page{ width:96vw; height:90vh; max-height:90vh; } }
  .mh-card-foot{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:center; padding:11px;
    font:400 12px var(--mh-ui,system-ui,sans-serif); opacity:.7; }
  .mh-card-foot b{ font-weight:800; } .mh-sep{ opacity:.4; }
  /* HUD */
  #mh-hud{ position:fixed; left:0; right:0; bottom:0; z-index:5; pointer-events:none;
    display:flex; align-items:center; justify-content:space-between; gap:14px; padding:13px 16px; }
  .mh-hint{ font:500 14px/1.35 var(--mh-ui,system-ui,sans-serif); text-shadow:0 1px 4px rgba(0,0,0,.55); }
  .mh-hud-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .mh-hudbtn{ pointer-events:auto; appearance:none; cursor:pointer; font:700 12px var(--mh-ui,system-ui,sans-serif);
    padding:6px 10px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; color:#fff; background:rgba(20,20,28,.7); border:1px solid rgba(255,255,255,.18); line-height:1; white-space:nowrap; }
  .mh-hudbtn:hover{ filter:brightness(1.15); } .mh-hudbtn.mh-on{ background:#fff; color:#111; }
  .mh-hudbtn:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff; }
  .mh-progress{ font:700 12px var(--mh-ui,system-ui,sans-serif); padding:6px 11px; border-radius:999px; }
  .mh-compass{ pointer-events:auto; appearance:none; cursor:pointer; display:flex; align-items:center; gap:7px;
    padding:6px 11px 6px 9px; border-radius:999px; font:700 12px var(--mh-ui,system-ui,sans-serif); }
  .mh-needle{ display:inline-block; font-size:15px; line-height:1; transform-origin:50% 50%; }
  /* HUD nav-bar — fades in when you wander out of sight of the kiosks */
  .mh-navbar{ position:fixed; top:50px; left:50%; transform:translateX(-50%); z-index:6;
    display:flex; flex-wrap:wrap; gap:7px; justify-content:center; max-width:94vw; padding:7px 9px;
    transition:opacity .28s ease, transform .28s ease; }
  .mh-navbar.mh-faded{ opacity:0; pointer-events:none; transform:translate(-50%,-10px); }
  .mh-navchip{ appearance:none; cursor:pointer; font:700 12px var(--mh-ui,system-ui,sans-serif);
    padding:6px 11px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; white-space:nowrap; line-height:1; color:#fff;
    background:rgba(20,20,28,.86); border:1px solid rgba(255,255,255,.16); }
  .mh-navchip:hover{ filter:brightness(1.12); }
  .mh-navchip:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff; }
  /* live skin-switcher (the cohesion centerpiece: one place, many lenses) */
  .mh-switcher{ position:fixed; left:50%; bottom:52px; transform:translateX(-50%); z-index:6;
    display:flex; flex-wrap:wrap; gap:5px; justify-content:center; max-width:96vw; padding:5px; }
  .mh-switcher.mh-faded{ display:none !important; }
  .mh-skin{ appearance:none; cursor:pointer; font:600 11px var(--mh-ui,system-ui,sans-serif);
    padding:5px 9px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; color:#fff; background:rgba(18,18,26,.72); border:1px solid rgba(255,255,255,.15); line-height:1; }
  .mh-skin:hover{ filter:brightness(1.16); }
  .mh-skin.mh-cur{ background:#fff; color:#111; border-color:#fff; }
  .mh-skin:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff; }
  /* the CONSTANT mark — identical under every skin (the cohesion anchor): the house
     leaf corner + the cyan→violet pentad. Theme CSS never restyles it. */
  #mh-mark{ position:fixed; top:12px; right:14px; z-index:8; width:30px; height:30px;
    display:flex; align-items:center; justify-content:center;
    border-radius:16px 4px 16px 4px / 7px 2px 7px 2px;
    background:linear-gradient(135deg,#c3f0ff 0%,#5b2a86 100%); box-shadow:0 2px 8px rgba(0,0,0,.35); }
  #mh-mark span{ font:800 11px/1 system-ui,sans-serif; color:#fff; letter-spacing:.02em; text-shadow:0 1px 1px rgba(0,0,0,.4); }
  /* build mode (rearrange / add buildings) */
  .mh-buildtoggle{ position:fixed; top:48px; right:14px; z-index:8; width:30px; height:30px; cursor:pointer;
    border-radius:8px; border:1px solid rgba(255,255,255,.22); background:rgba(20,20,28,.7); color:#fff; font-size:15px; line-height:1; }
  .mh-buildtoggle.mh-on{ background:#fff; color:#111; }
  .mh-buildbar{ position:fixed; top:48px; left:50%; transform:translateX(-50%); z-index:7; display:flex; gap:5px;
    flex-wrap:wrap; justify-content:center; max-width:92vw; padding:5px; transition:opacity .2s; }
  .mh-buildbar.mh-faded{ opacity:0; pointer-events:none; }
  .mh-tool{ appearance:none; cursor:pointer; font:700 12px var(--mh-ui,system-ui,sans-serif); padding:6px 10px;
    border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; color:#fff; background:rgba(20,20,28,.86); border:1px solid rgba(255,255,255,.16); line-height:1; }
  .mh-tool.mh-cur{ background:#fff; color:#111; } .mh-tool:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff; }
  ::view-transition-old(root),::view-transition-new(root){ animation-duration:.34s; }
  /* phones: keep every menu compact and tucked to the edges so nothing blocks the
     play area. top: back + mark + nav-bar; bottom: switcher + hint/progress. */
  @media (max-width:600px){
    .mh-legend{ display:none; }
    .mh-hint, #mh-themechip, #mh-menu{ display:none; }   /* declutter the phone HUD: drop the wander-hint, the redundant style label, and the menu button */
    #mh-hud{ padding:9px 9px; align-items:flex-end; }
    .mh-progress{ font-size:11px; padding:5px 8px; }
    .mh-navbar{ top:42px; gap:4px; padding:4px 6px; max-width:96vw; }
    .mh-navchip{ font-size:10.5px; padding:5px 8px; }
    .mh-switcher{ bottom:44px; gap:4px; padding:3px; }
    .mh-skin{ font-size:10.5px; padding:4px 8px; }
    #mh-back{ font-size:11px; padding:5px 8px; }
    .mh-hudbtn{ font-size:11px; padding:5px 8px; }
    #mh-mark{ width:26px; height:26px; top:8px; right:10px; }
    #mh-mark span{ font-size:10px; }
    .mh-card{ width:96vw; max-height:88vh; }
    .mh-card-body{ font-size:15px; padding:0 16px 6px; }
  }
  @media (max-width:600px) and (pointer:coarse){ .mh-card-foot{ display:none; } }
  @media (prefers-reduced-motion: reduce){ *{ animation-duration:.001ms!important; transition-duration:.001ms!important; } }
`;

function buildPicker() {
  pickerEl.innerHTML = "";
  T.avatarColors.forEach((col, i) => {
    const b = document.createElement("button");
    b.className = "mh-swatch" + (i === avatarIndex ? " mh-sel" : "");
    b.style.background = col;
    b.title = "Colour " + (i + 1);
    b.addEventListener("click", () => {
      avatarIndex = i; sfx.pick();
      Array.from(pickerEl.children).forEach((el, k) => el.classList.toggle("mh-sel", k === i));
    });
    pickerEl.appendChild(b);
  });
}

/** Build the HUD nav-bar chips (one per kiosk + a Plaza recall). Called after the
 *  hub exists. Hidden until you wander out of sight of the kiosks (see updateHUD). */
function buildNavbar() {
  if (!T.navbar) { navbarEl.remove(); navbarEl = null; return; }
  navbarEl.innerHTML = "";
  const home = document.createElement("button");
  home.type = "button"; home.className = "mh-navchip mh-navhome"; home.textContent = "◇ Plaza";
  home.addEventListener("click", () => { if (mode === "walking") recallHome(); });
  navbarEl.appendChild(home);
  EXHIBITS.forEach((ex, i) => {
    if (ex.satellite) return;                  // road-houses are walk-up only, not plaza nav chips
    const b = document.createElement("button");
    b.type = "button"; b.className = "mh-navchip"; b.textContent = (i + 1) + ". " + ex.title;
    b.style.setProperty("--chip", ex.accent);
    b.addEventListener("click", () => navTo(i));
    navbarEl.appendChild(b);
  });
}
/** Quick-nav from the building menu: WARP fast to kiosk i (almost teleporting) and open
 *  it on arrival. @param {number} i */
function navTo(i) {
  if (mode !== "walking") return;
  audio.ensure(); audio.resume();
  menuOpen = false; const m = document.getElementById("mh-menu"); if (m) m.classList.remove("mh-on");
  auto.active = true; auto.goal = i; auto.warp = true; auto.lastDist = Infinity; auto.stuck = 0;
}

/** @param {string} id */
function byId(id) { const el = document.getElementById(id); if (!el) throw new Error("missing #" + id); return el; }

/* ----------------------------------------------------------------------------
   4. AUDIO  — sine/tri SFX over a theme-chosen scale (ported from the proven kit)
   -------------------------------------------------------------------------- */

const audio = {
  /** @type {AudioContext|null} */ ctx: null, /** @type {GainNode|null} */ master: null, muted: false,
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  setMuted(m) { this.muted = m; if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02); },
  /** @param {number} f @param {{delay?:number,dur?:number,gain?:number,type?:OscillatorType}} [o] */
  tone(f, o) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + (o?.delay ?? 0), dur = o?.dur ?? 0.15, peak = o?.gain ?? 0.2;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.value = f;                  // brief, gentle sine cues in every world
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.014);        // a soft attack (no click)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + 0.03);
  },
};
/** @param {number} degree */
function noteFreq(degree) {
  const sc = T.audio.scale, n = sc.length, oct = Math.floor(degree / n);
  const semi = sc[((degree % n) + n) % n] + 12 * oct;
  return T.audio.root * Math.pow(2, semi / 12);
}
const sfx = {
  open(d) { audio.tone(noteFreq(d), { gain: 0.15, dur: 0.16 }); audio.tone(noteFreq(d + 2), { delay: 0.08, gain: 0.11, dur: 0.14 }); },
  near(d) { audio.tone(noteFreq(d), { gain: 0.055, dur: 0.08 }); },
  close() { audio.tone(noteFreq(1), { gain: 0.07, dur: 0.11 }); audio.tone(noteFreq(0), { delay: 0.07, gain: 0.055, dur: 0.12 }); },
  nav() { audio.tone(noteFreq(2), { gain: 0.045, dur: 0.05 }); },
  pick() { audio.tone(noteFreq(4), { gain: 0.085, dur: 0.09 }); },
  step() { audio.tone(noteFreq(0), { gain: 0.02, dur: 0.05 }); },
};

/* ----------------------------------------------------------------------------
   5. WORLD  — a torus of period P. Terrain/props/roads are pure functions of the
   WRAPPED tile, so the field repeats every P tiles in x and y: wander far enough
   and the very same plaza comes round again. Zones: HUB (plaza platform), ROAD
   (radials along the world axes through the hub — every road leads to a plaza),
   else FIELD.
   -------------------------------------------------------------------------- */

/** wrap a value into [0,P) */ function wrap(v) { return ((v % P) + P) % P; }
/** signed shortest delta on the torus (−P/2 .. P/2] */
function wrapDelta(d) { d = ((d % P) + P) % P; return d > P / 2 ? d - P : d; }
/** the image of canonical coord c nearest to unbounded p */
function nearImg(c, p) { return c + Math.round((p - c) / P) * P; }

/** deterministic hash → 0..1 for (a,b). Cheap integer scramble, stable per tile. */
function hash01(a, b) {
  let h = (wrap(a) * 374761393 + wrap(b) * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}
/** value-noise-ish smooth field 0..1 (bilinear over hashed lattice). @param {number} freq */
function noise01(tx, ty, freq) {
  const fx = tx / freq, fy = ty / freq;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), rx = fx - x0, ry = fy - y0;
  const s = (t) => t * t * (3 - 2 * t);
  const ux = s(rx), uy = s(ry);
  const n00 = hash01(x0, y0), n10 = hash01(x0 + 1, y0), n01 = hash01(x0, y0 + 1), n11 = hash01(x0 + 1, y0 + 1);
  return (n00 * (1 - ux) + n10 * ux) * (1 - uy) + (n01 * (1 - ux) + n11 * ux) * uy;
}

/** A coarse biome for a tile from elevation + moisture noise (only computed when a
 *  theme sets T.biomes). water | sand | dry | grass | forest | stone | snow. */
function biomeAt(tx, ty) {
  const e = noise01(tx + 7, ty + 7, 12), m = noise01(tx + 313, ty - 211, 9);
  if (e < 0.30) return "water";
  if (e < 0.37) return "sand";
  if (e > 0.76) return m > 0.5 ? "snow" : "stone";
  if (m > 0.66) return "forest";
  if (m < 0.30) return "dry";
  return "grass";
}

/** Classify a tile. @returns {{zone:string, n:number}} */
function zoneAt(tx, ty) {
  const dx = wrapDelta(tx - HX), dy = wrapDelta(ty - HY);
  const dist = Math.hypot(dx, dy);
  if (dist <= T.hubRadius) return { zone: "hub", n: noise01(tx, ty, 5) };
  if (T.wayfinding.roads && (wrap(tx - HX) === 0 || wrap(ty - HY) === 0)) return { zone: "road", n: noise01(tx, ty, 5) };
  if (T.spurRoads && SPUR_TILES.has(wrap(tx) + "," + wrap(ty))) return { zone: "road", n: noise01(tx, ty, 5) };  // Music/Games spurs
  return { zone: "field", n: noise01(tx, ty, 6.5) };
}

/** Is the slime in open water? Wading is slow (the menu warp ignores it). */
function onWater(x, y) {
  const tx = Math.round(x), ty = Math.round(y);
  return T.biomes && zoneAt(tx, ty).zone === "field" && biomeAt(tx, ty) === "water";
}
/** True if a placed building sits on tile (tx,ty), torus-wrapped. */
function buildingAt(tx, ty) {
  const wx = wrap(tx), wy = wrap(ty);
  for (let i = 0; i < BUILDINGS.length; i++) if (wrap(BUILDINGS[i].tx) === wx && wrap(BUILDINGS[i].ty) === wy) return true;
  return false;
}

/* ----------------------------------------------------------------------------
   6. HUB  — place the kiosks on a ring around the hub centre.
   -------------------------------------------------------------------------- */

function buildHub() {
  P = T.worldPeriod;
  HX = Math.round(P / 2); HY = Math.round(P / 2);    // plaza sits at the wrap-centre
  const items = CONTENT.kiosks, n = items.length;
  EXHIBITS = items.map((it, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n; // first kiosk at top, clockwise
    return {
      tx: HX + T.ringRadius * Math.cos(ang),
      ty: HY + T.ringRadius * Math.sin(ang),
      title: it.title, accent: T.accents[i % T.accents.length], slot: i, visited: false,
    };
  });
  player.x = HX; player.y = HY + 1.8; player.fx = 0; player.fy = 1;   // spawn on the plaza, clear of the central beacon
  activeIndex = prevActive = currentTarget = -1;
  // build-mode is a per-session sandbox: placed buildings do NOT persist across a refresh,
  // and the kiosks always return to their even ring. Clear any saved layout on load.
  BUILDINGS.length = 0;
  try { if (window.localStorage) window.localStorage.removeItem("mh-layout"); } catch (e) { /* fine */ }
  rebuildSpurs();
}

/** World-aware: in the slimeverse, each kiosk that carries a `satellites` list grows a
 *  ROAD off the plaza with one walk-up HOUSE per item (Music, Games). The gateway kiosk
 *  stays on the ring; the houses march straight outward from it, and the spur between is
 *  paved as road. The flatverse has no spurs (it stays a direct, efficient menu). Idempotent
 *  and rebuilt on every world-switch, so the houses appear and vanish with the world. */
function rebuildSpurs() {
  if (EXHIBITS.length > CONTENT.kiosks.length) EXHIBITS.length = CONTENT.kiosks.length;  // drop any houses from a previous world
  SPUR_TILES.clear();
  if (!T.spurRoads) return;
  const items = CONTENT.kiosks, step = 2.5;
  for (let s = 0; s < items.length; s++) {
    const sats = items[s].satellites, gate = EXHIBITS[s];
    if (!sats || !sats.length || !gate) continue;
    const ang = Math.atan2(gate.ty - HY, gate.tx - HX);          // straight out from the plaza, through the gateway kiosk
    for (let j = 0; j < sats.length; j++) {
      const r = T.ringRadius + step * (j + 1);
      EXHIBITS.push({
        tx: HX + r * Math.cos(ang), ty: HY + r * Math.sin(ang),
        title: sats[j].title, accent: gate.accent, slot: 90 + s * 13 + j * 7,   // slot is only a visual seed for houses
        url: sats[j].url, satellite: true, visited: false,
      });
    }
    const rEnd = T.ringRadius + step * sats.length + 0.7;        // pave the spur from the hub edge out to the last house
    for (let r = T.hubRadius - 0.3; r <= rEnd; r += 0.33)
      SPUR_TILES.add(wrap(Math.round(HX + r * Math.cos(ang))) + "," + wrap(Math.round(HY + r * Math.sin(ang))));
  }
}

/* ----------------------------------------------------------------------------
   7. INPUT
   -------------------------------------------------------------------------- */

function wireInput() {
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { keys.up = keys.down = keys.left = keys.right = false; });
  canvas.addEventListener("pointerdown", onPointer);
  canvas.tabIndex = -1;
  startBtn.addEventListener("click", startGame);
  byId("mh-cardClose").addEventListener("click", closeCard);
  byId("mh-cardBack").addEventListener("click", () => { if (openIndex >= 0) renderCard(openIndex); });
  cardEl.addEventListener("click", (e) => { if (e.target === cardEl) closeCard(); });
  compassEl.addEventListener("click", recallHome);
  byId("mh-menu").addEventListener("click", toggleMenu);
  buildToggleEl.addEventListener("click", toggleBuild);
  buildbarEl.addEventListener("click", onBuildTool);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

/** @param {KeyboardEvent} e */
function onKeyDown(e) {
  const k = e.key.toLowerCase();
  audio.resume();
  if (mode === "intro") {
    if (!startBtn.disabled && ["enter", " ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); startGame(); }
    return;
  }
  if (mode === "card") {
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault(); closeCard(); auto.active = false;
      if (k === "w" || k === "arrowup") keys.up = true;
      else if (k === "s" || k === "arrowdown") keys.down = true;
      else if (k === "a" || k === "arrowleft") keys.left = true;
      else if (k === "d" || k === "arrowright") keys.right = true;
      return;
    }
    if (k === "e" || k === "escape") { e.preventDefault(); closeCard(); }
    else if (k === " " || k === "enter") { e.preventDefault(); closeCard(); navTo((CONTENT && CONTENT.home) || 0); }
    else if (k === "," || k === "<") { e.preventDefault(); browse(-1); }
    else if (k === "." || k === ">") { e.preventDefault(); browse(1); }
    return;
  }
  // walking
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k === " ") { navTo((CONTENT && CONTENT.home) || 0); return; }   // Space → the About kiosk
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) auto.active = false;
  if (k === "w" || k === "arrowup") keys.up = true;
  else if (k === "s" || k === "arrowdown") keys.down = true;
  else if (k === "a" || k === "arrowleft") keys.left = true;
  else if (k === "d" || k === "arrowright") keys.right = true;
  else if (k === "e") { if (activeIndex >= 0) openCard(activeIndex); }
  else if (k === "enter") { navTo((CONTENT && CONTENT.home) || 0); }   // Enter → the About kiosk
  else if (k === "g" || k === "h") { if (T.wayfinding.recall) recallHome(); }
  else if (k === "c") { avatarIndex = (avatarIndex + 1) % T.avatarColors.length; sfx.pick(); toast("Colour " + (avatarIndex + 1)); }
  else if (k === "m") { audio.setMuted(!audio.muted); toast(audio.muted ? "Sound off" : "Sound on"); }
  else if (k === "t") { cycleSkin(); }   // cycle to the next skin (live)
  else if (k === "b") { toggleBuild(); } // build mode (rearrange / add buildings)
}

/** @param {KeyboardEvent} e */
function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") keys.up = false;
  else if (k === "s" || k === "arrowdown") keys.down = false;
  else if (k === "a" || k === "arrowleft") keys.left = false;
  else if (k === "d" || k === "arrowright") keys.right = false;
}

/** @param {PointerEvent} e */
function onPointer(e) {
  if (mode !== "walking") return;
  if (e.pointerType === "mouse" && e.button > 0) return;
  e.preventDefault(); audio.ensure(); audio.resume();
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (buildMode) { buildPointerDown(sx, sy); return; }           // build mode: edit buildings, don't walk
  const ki = kioskAtScreen(sx, sy);
  if (ki >= 0) { auto.active = false; openCard(ki); return; }    // a click on a kiosk opens it straight away
  if (decorAtScreen(sx, sy) >= 0) { toast("Press B (✎ Build) to move or remove buildings"); return; }
  const w = screenToWorld(sx, sy); auto.active = true; auto.goal = -1; auto.warp = false; auto.tx = w.x; auto.ty = w.y; auto.lastDist = Infinity; auto.stuck = 0;
}

/** Auto-walk to the next unvisited kiosk (wraps). */
function autoNext() {
  if (!EXHIBITS.length) return;
  let t = currentTarget < 0 ? 0 : currentTarget + 1;
  if (t >= EXHIBITS.length) t = 0;
  auto.active = true; auto.goal = t; auto.warp = false; auto.lastDist = Infinity; auto.stuck = 0;
}
/** Auto-walk back to the plaza centre. */
function recallHome() {
  auto.active = true; auto.goal = -1; auto.warp = false;
  auto.tx = nearImg(HX, player.x); auto.ty = nearImg(HY, player.y);
  auto.lastDist = Infinity; auto.stuck = 0;
  toast("Heading back to the plaza");
}

function startGame() {
  audio.ensure(); audio.resume(); sfx.open(2);
  introEl.classList.add("mh-hidden"); hudEl.classList.remove("mh-hidden");
  mode = "walking"; last = performance.now();
}

/** Toggle the building menu (the nav-bar of buildings) open — reachable any time,
 *  which is how you navigate on a phone without having to wander off-screen. */
function toggleMenu() { menuOpen = !menuOpen; const el = document.getElementById("mh-menu"); if (el) el.classList.toggle("mh-on", menuOpen); sfx.nav(); }

/* --- build mode: rearrange the buildings + add decorative ones (persisted) --- */
function toggleBuild() {
  buildMode = !buildMode; buildTool = "move"; drag = null;
  if (buildbarEl) buildbarEl.classList.toggle("mh-faded", !buildMode);
  if (buildToggleEl) buildToggleEl.classList.toggle("mh-on", buildMode);
  refreshBuildTools();
  toast(buildMode ? "Build mode — drag to move; pick a tool to add or remove" : "Build mode off");
}
function onBuildTool(e) {
  const b = e.target && e.target.closest && e.target.closest(".mh-tool"); if (!b) return;
  if (b.dataset.tool === "done") { toggleBuild(); return; }
  buildTool = b.dataset.tool; refreshBuildTools();
}
function refreshBuildTools() {
  if (!buildbarEl || !buildbarEl.querySelectorAll) return;
  Array.from(buildbarEl.querySelectorAll(".mh-tool")).forEach((el) => el.classList.toggle("mh-cur", el.dataset.tool === buildTool));
  updateBuildCursor();
}
/** Show the move/drag affordance on the CURSOR (not an icon): the Move tool gives the canvas a
 *  grab cursor, grabbing while a building is held; other tools / build-off restore the default. */
function updateBuildCursor() {
  if (!canvas || !canvas.style) return;
  canvas.style.cursor = (buildMode && buildTool === "move") ? (drag ? "grabbing" : "grab") : "";
}
function buildPointerDown(sx, sy) {
  if (buildTool === "move") {
    const k = kioskAtScreen(sx, sy); if (k >= 0) { drag = { kind: "kiosk", i: k }; updateBuildCursor(); return; }
    const d = decorAtScreen(sx, sy); if (d >= 0) { drag = { kind: "decor", i: d }; updateBuildCursor(); }
  } else if (buildTool === "house" || buildTool === "tree") {
    const w = screenToWorld(sx, sy), tx = wrap(Math.round(w.x)), ty = wrap(Math.round(w.y));
    if (buildingAt(tx, ty) || EXHIBITS.some((e) => wrap(e.tx) === tx && wrap(e.ty) === ty)) { toast("Something is already built here"); return; }   // one structure per tile
    BUILDINGS.push({ tx, ty, type: buildTool }); saveLayout(); sfx.pick();
  } else if (buildTool === "delete") {
    const d = decorAtScreen(sx, sy); if (d >= 0) { BUILDINGS.splice(d, 1); saveLayout(); sfx.close(); }
  }
}
function onPointerMove(e) {
  if (!buildMode || !drag) return;
  const r = canvas.getBoundingClientRect(), w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  if (drag.kind === "kiosk") { const ex = EXHIBITS[drag.i]; if (ex) { ex.tx = w.x; ex.ty = w.y; } }
  else { const b = BUILDINGS[drag.i]; if (b) { b.tx = w.x; b.ty = w.y; } }
}
function onPointerUp() {
  if (!buildMode || !drag) return;
  if (drag.kind === "kiosk") { const ex = EXHIBITS[drag.i]; if (ex) { ex.tx = wrap(Math.round(ex.tx)); ex.ty = wrap(Math.round(ex.ty)); } }
  else { const b = BUILDINGS[drag.i]; if (b) { b.tx = wrap(Math.round(b.tx)); b.ty = wrap(Math.round(b.ty)); } }
  drag = null; saveLayout(); updateBuildCursor();
}
/** which decorative building (if any) is under a screen point */
function decorAtScreen(sx, sy) {
  let pick = -1, best = -Infinity;
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i], c = toScreen(nearImg(b.tx, player.x), nearImg(b.ty, player.y));
    if (sx >= c.x - 24 && sx <= c.x + 24 && sy >= c.y - 44 && sy <= c.y + 12) { const d = b.tx + b.ty; if (d > best) { best = d; pick = i; } }
  }
  return pick;
}
function saveLayout() {
  try { if (window.localStorage) window.localStorage.setItem("mh-layout", JSON.stringify({ kiosks: EXHIBITS.map((e) => ({ tx: e.tx, ty: e.ty })), buildings: BUILDINGS })); } catch (e) { /* fine */ }
}
function loadLayout() {
  try { if (!window.localStorage) return null; const s = window.localStorage.getItem("mh-layout"); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/* ----------------------------------------------------------------------------
   8. UPDATE
   -------------------------------------------------------------------------- */

/** @param {number} dt */
function update(dt) {
  let dx = 0, dy = 0;
  if (auto.active) {
    const toKiosk = auto.goal >= 0 && auto.goal < EXHIBITS.length;
    let gx, gy;
    if (toKiosk) { const e = EXHIBITS[auto.goal]; gx = nearImg(e.tx, player.x) - player.x; gy = nearImg(e.ty, player.y) - player.y; }
    else { gx = auto.tx - player.x; gy = auto.ty - player.y; }
    const d = Math.hypot(gx, gy);
    const arrive = toKiosk ? T.interact * 0.9 : 0.3;
    if (d <= arrive) { auto.active = false; if (toKiosk) { openCard(auto.goal); return; } }
    else {
      if (d > auto.lastDist - 1e-3) auto.stuck += dt; else auto.stuck = 0;
      auto.lastDist = d;
      if (auto.stuck > 0.7) auto.active = false; else { dx = gx; dy = gy; }
    }
  }
  if (!auto.active) {
    if (keys.up) { dx -= 1; dy -= 1; }
    if (keys.down) { dx += 1; dy += 1; }
    if (keys.left) { dx -= 1; dy += 1; }
    if (keys.right) { dx += 1; dy -= 1; }
  }

  player.moving = (dx !== 0 || dy !== 0);
  if (player.moving) {
    const m = Math.hypot(dx, dy); dx /= m; dy /= m;
    player.fx = dx; player.fy = dy;
    const onW = !auto.warp && onWater(player.x, player.y);
    const spd = (auto.active && auto.warp) ? 34 : (onW ? T.speed * 0.5 : T.speed);   // wading is slow; the menu warp is fast
    let nx = player.x + dx * spd * dt, ny = player.y + dy * spd * dt;
    for (const ex of EXHIBITS) {                          // soft circular collision with kiosks (nearest image)
      const exX = nearImg(ex.tx, nx), exY = nearImg(ex.ty, ny);
      let ox = nx - exX, oy = ny - exY; const d = Math.hypot(ox, oy);
      if (d < T.obstacle) { if (d < 1e-4) { ox = 1; oy = 0; } nx = exX + (ox / (d || 1)) * T.obstacle; ny = exY + (oy / (d || 1)) * T.obstacle; }
    }
    if (T.monument !== false && !auto.warp) {             // the central beacon is solid (warp ignores it)
      const mx = nearImg(HX, nx), my = nearImg(HY, ny);
      let ox = nx - mx, oy = ny - my; const md = Math.hypot(ox, oy);
      if (md < 0.7) { if (md < 1e-4) { ox = 0; oy = 1; } nx = mx + (ox / (md || 1)) * 0.7; ny = my + (oy / (md || 1)) * 0.7; }
    }
    if (!auto.warp) {                                     // can't walk through plants or placed buildings (warp ignores)
      const cx = Math.round(nx), cy = Math.round(ny);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const ttx = cx + ox, tty = cy + oy;
        if (zoneAt(ttx, tty).zone !== "field") continue;
        const isB = buildingAt(ttx, tty), isP = !isB && !!(T.propAt || defPropAt)(ttx, tty);
        if (!isB && !isP) continue;
        const rad = isB ? 0.8 : 0.45;                     // buildings are big solid obstacles; plants are small
        let px = nx - ttx, py = ny - tty; const dd = Math.hypot(px, py);
        if (dd < rad) { if (dd < 1e-4) { px = 1; py = 0; } nx = ttx + (px / (dd || 1)) * rad; ny = tty + (py / (dd || 1)) * rad; }
      }
    }
    player.x = nx; player.y = ny;
    if (player.moving && Math.sin(tnow * 12) > 0.93) sfx.step();
  }

  // nearest kiosk in range (using nearest images)
  activeIndex = -1; let best = T.interact;
  for (let i = 0; i < EXHIBITS.length; i++) {
    const d = Math.hypot(player.x - nearImg(EXHIBITS[i].tx, player.x), player.y - nearImg(EXHIBITS[i].ty, player.y));
    if (d < best) { best = d; activeIndex = i; }
  }
  if (activeIndex !== prevActive) { if (activeIndex >= 0) sfx.near(activeIndex); prevActive = activeIndex; }

  const hd = Math.hypot(player.x - nearImg(HX, player.x), player.y - nearImg(HY, player.y));
  inHub = hd <= T.hubRadius + T.ringRadius + 1.2;

  if (ecoActive() && window.MH_ECO.update) window.MH_ECO.update(dt, ECO_API);
}

/* ----------------------------------------------------------------------------
   9. RENDER
   -------------------------------------------------------------------------- */

function loop(ts) {
  let dt = (ts - last) / 1000; if (dt > 0.05) dt = 0.05;
  last = ts; tnow = ts / 1000;
  frameMs += ((dt * 1000) - frameMs) * 0.1;                 // smoothed frame time (no effect on capable machines)
  // Adaptive scenery degrade WITH HYSTERESIS: step the skip UP only when clearly slow and DOWN only
  // when clearly recovered, with a wide dead-band between. A plain threshold (frameMs>46?2:>31?1:0)
  // toggled every frame when the frame time sat near a cutoff, flipping props on/off — the "flickering
  // plants" (and it persisted across a theme switch because perfSkip is global). One step per frame.
  if (perfSkip < 2 && frameMs > (perfSkip === 0 ? 33 : 48)) perfSkip++;
  else if (perfSkip > 0 && frameMs < (perfSkip === 2 ? 38 : 24)) perfSkip--;
  if (mode === "walking") update(dt);
  render(); updateHUD();
  requestAnimationFrame(loop);
}

function render() {
  const env = { t: tnow, dpr, W, H, reduce };
  const ecoOn = ecoActive();
  (T.paintBackground || defPaintBackground)(ctx, env);

  const ps = isoToScreen(player.x, player.y);
  originX = W / 2 - ps.x; originY = H / 2 - ps.y - 26;

  // ---- visible tile bounding box (world space) from the four screen corners ----
  const corners = [screenToWorld(0, 0), screenToWorld(W, 0), screenToWorld(0, H), screenToWorld(W, H)];
  let txMin = Infinity, txMax = -Infinity, tyMin = Infinity, tyMax = -Infinity;
  for (const c of corners) { txMin = Math.min(txMin, c.x); txMax = Math.max(txMax, c.x); tyMin = Math.min(tyMin, c.y); tyMax = Math.max(tyMax, c.y); }
  txMin = Math.floor(txMin) - 2; tyMin = Math.floor(tyMin) - 2;
  txMax = Math.ceil(txMax) + 3; tyMax = Math.ceil(tyMax) + 5;     // +down for prop/kiosk height

  // ---- ground pass: back-to-front by (tx+ty) ----
  const sMin = txMin + tyMin, sMax = txMax + tyMax;
  for (let s = sMin; s <= sMax; s++) {
    const a = Math.max(txMin, s - tyMax), b = Math.min(txMax, s - tyMin);
    for (let tx = a; tx <= b; tx++) {
      const ty = s - tx;
      const c = toScreen(tx, ty);
      if (c.x < -TILE_W || c.x > W + TILE_W || c.y < -TILE_H * 2 || c.y > H + TILE_H * 2) continue;
      const z = zoneAt(tx, ty);
      (T.paintGround || defPaintGround)(ctx, c.x, c.y, { zone: z.zone, n: z.n, tx, ty, t: tnow, biome: T.biomes ? biomeAt(tx, ty) : null });
      if (ecoOn && window.MH_ECO.groundTint) { const ti = window.MH_ECO.groundTint(tx, ty); if (ti) diamond(ctx, c.x, c.y, ti, null); }
    }
  }

  if (T.fluidGround) drawFluidZones();           // smooth plaza + roads over the blobby field (no grid)

  // ---- actor pass: props + signposts + monument + kiosks + player, depth-sorted ----
  /** @type {{depth:number, draw:()=>void}[]} */ const actors = [];
  for (let s = sMin; s <= sMax; s++) {
    const a = Math.max(txMin, s - tyMax), b = Math.min(txMax, s - tyMin);
    for (let tx = a; tx <= b; tx++) {
      const ty = s - tx;
      const c = toScreen(tx, ty);
      if (c.x < -TILE_W * 2 || c.x > W + TILE_W * 2 || c.y < -TILE_H * 4 || c.y > H + TILE_H * 2) continue;
      const z = zoneAt(tx, ty);
      if (z.zone === "field") {
        if (!(perfSkip && (((tx * 31 + ty * 17) & 3) < perfSkip))) {   // when struggling, thin the scenery (stable per tile, so no flicker)
          const pid = (T.propAt || defPropAt)(tx, ty);
          if (pid) actors.push({ depth: tx + ty - 0.05, draw: () => (T.paintProp || defPaintProp)(ctx, c.x, c.y, pid, { tx, ty, n: z.n, t: tnow }) });
        }
      } else if (z.zone === "road" && T.wayfinding.signposts) {
        const sp = signpostHere(tx, ty);
        if (sp) actors.push({ depth: tx + ty - 0.04, draw: () => (T.paintSignpost || defPaintSignpost)(ctx, c.x, c.y, sp.dir, sp.dist, { tx, ty, t: tnow }) });
      }
    }
  }
  // central beacon at the hub (skipped when a theme sets monument:false)
  if (T.monument !== false) {
    const mx = nearImg(HX, player.x), my = nearImg(HY, player.y), c = toScreen(mx, my);
    actors.push({ depth: mx + my - 0.5, draw: () => (T.paintMonument || defPaintMonument)(ctx, c.x, c.y, { t: tnow }) });
  }
  // decorative buildings the visitor placed in build mode
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i], bx = nearImg(b.tx, player.x), by = nearImg(b.ty, player.y), c = toScreen(bx, by);
    actors.push({ depth: bx + by - 0.02, draw: () => (T.paintBuilding || defPaintBuilding)(ctx, c.x, c.y, b, { t: tnow, biome: T.biomes ? biomeAt(Math.round(b.tx), Math.round(b.ty)) : null }) });
  }
  // kiosks (nearest image each) — an accent glow under each marks it as interactive
  for (let i = 0; i < EXHIBITS.length; i++) {
    const ex = EXHIBITS[i], kx = nearImg(ex.tx, player.x), ky = nearImg(ex.ty, player.y), c = toScreen(kx, ky);
    const active = i === activeIndex;
    const biome = T.biomes ? biomeAt(Math.round(ex.tx), Math.round(ex.ty)) : null;
    actors.push({ depth: kx + ky, draw: () => { if (T.kioskGlow !== false) drawKioskGlow(c.x, c.y, ex, active); (T.paintKiosk || defPaintKiosk)(ctx, c.x, c.y, ex, active, { t: tnow, index: i, biome }); } });
  }
  // player
  {
    const c = toScreen(player.x, player.y);
    actors.push({ depth: player.x + player.y, draw: () => drawAvatar(c.x, c.y) });
  }
  // ecology entities (optional layer; see ecology.js / window.MH_ECO)
  if (ecoOn && window.MH_ECO.actors) window.MH_ECO.actors((depth, drawFn) => actors.push({ depth, draw: () => drawFn(ctx) }), ECO_API);
  actors.sort((p, q) => p.depth - q.depth);
  for (const a of actors) a.draw();

  if (T.darkness) {                                     // gloom: ONE multiply by a dark MAP, bright inside the slime's view-cone AND at each bauble, so the
    ensureDarkCv();                                     // cone REVEALS the true scene (no glare) and the labels stay readable — cheap: no second pass over the world
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = "source-over";
    dctx.fillStyle = "#242424"; dctx.fillRect(0, 0, darkCv.width, darkCv.height);   // deep dark, but a touch of bioluminescence still reads through
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0); dctx.globalCompositeOperation = "lighter";
    for (const ex of EXHIBITS) {                        // keep each kiosk's BAUBLE legible even when the slime isn't looking at it
      const c = toScreen(nearImg(ex.tx, player.x), nearImg(ex.ty, player.y));
      if (c.x < -90 || c.x > W + 90 || c.y < -160 || c.y > H + 90) continue;
      const sr = ex.signRect;
      if (sr) {                                         // reveal a patch the SHAPE of the sign (a soft rounded-rect), not a round halo
        dctx.save(); dctx.shadowColor = "rgba(255,255,255,0.85)"; dctx.shadowBlur = 26; dctx.fillStyle = "rgba(255,255,255,0.9)";
        const x = sr.x - 4, y = sr.y - 4, w = sr.w + 8, h = sr.h + 8, r = 8;
        dctx.beginPath(); dctx.moveTo(x + r, y); dctx.arcTo(x + w, y, x + w, y + h, r); dctx.arcTo(x + w, y + h, x, y + h, r); dctx.arcTo(x, y + h, x, y, r); dctx.arcTo(x, y, x + w, y, r); dctx.closePath(); dctx.fill();
        dctx.restore();
      } else {                                          // fallback (no stashed sign rect): a soft round pool above the kiosk
        const by = c.y - 100, sp = dctx.createRadialGradient(c.x, by, 2, c.x, by, 55);
        sp.addColorStop(0, "rgba(255,255,255,0.92)"); sp.addColorStop(0.6, "rgba(255,255,255,0.5)"); sp.addColorStop(1, "rgba(255,255,255,0)");
        dctx.fillStyle = sp; dctx.beginPath(); dctx.ellipse(c.x, by, 55, 40, 0, 0, Math.PI * 2); dctx.fill();
      }
    }
    if (ecoOn && window.MH_ECO && window.MH_ECO.fireflies && window.MH_ECO.fireflies.length) {   // fireflies are emissive → let each one's light punch through the gloom
      const ff = window.MH_ECO.fireflies, sprite = fireflyGlow(), R = 19, now = window.MH_ECO.now || 0;
      for (const f of ff) {
        const p = ECO_API.place(f.x, f.y);
        if (p.x < -24 || p.x > W + 24 || p.y < -28 || p.y > H + 24) continue;
        const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 4 + (f.phase || 0)));
        dctx.globalAlpha = blink; dctx.drawImage(sprite, p.x - R, p.y - 6 - R, R * 2, R * 2);
      }
      dctx.globalAlpha = 1;
    }
    if (T.avatarBeam && beamState) paintSlimeBeam(dctx, beamState.sx, beamState.baseY, beamState.a);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "multiply"; ctx.drawImage(darkCv, 0, 0); ctx.restore();
  }

  kiosksOut = !anyKioskOnScreen();
  drawVignette();
  if (mode === "walking" && kiosksOut && T.edgeMarkers) drawEdgeMarkers();
  if (mode === "walking" && inHub && activeIndex < 0 && !auto.active) drawKioskArrow();
  drawToast();
}

/** True if at least one kiosk's nearest image sits within the viewport. */
function anyKioskOnScreen() {
  for (const ex of EXHIBITS) {
    const c = toScreen(nearImg(ex.tx, player.x), nearImg(ex.ty, player.y));
    if (c.x >= -16 && c.x <= W + 16 && c.y >= -48 && c.y <= H + 24) return true;
  }
  return false;
}

/** Off-screen kiosk markers: clamp each kiosk's direction to a screen-edge inset and
 *  draw an accent chip with its number + an outward arrow (a "quest marker"). */
function drawEdgeMarkers() {
  const cx = W / 2, cy = H / 2, m = 30, ix = cx - m, iy = cy - m;
  for (let i = 0; i < EXHIBITS.length; i++) {
    const ex = EXHIBITS[i], c = toScreen(nearImg(ex.tx, player.x), nearImg(ex.ty, player.y));
    if (c.x >= 0 && c.x <= W && c.y >= 0 && c.y <= H) continue;       // on screen → no marker
    const a = Math.atan2(c.y - cy, c.x - cx), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(Math.abs(dx) > 1e-4 ? ix / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-4 ? iy / Math.abs(dy) : Infinity);
    const x = cx + dx * t, y = cy + dy * t;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);                              // arrow points outward, toward the kiosk
    ctx.fillStyle = hexA(ex.accent, 0.96);
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    roundRect(x - 12, y - 11, 24, 22, 8, hexA(ex.accent, 0.96), "rgba(0,0,0,0.35)");
    label(ctx, String(i + 1), x, y + 4, 12, "#ffffff");
  }
}

/** Distance "fog": a vignette whose clear centre shrinks the farther you roam from
 *  the plaza, so the world quietly closes in and nudges you back — diegetic
 *  wayfinding that needs no compass. Off on the plaza; theme-tinted via fogColor. */
function drawVignette() {
  if (!T.wayfinding.fog) return;
  const dist = Math.hypot(wrapDelta(HX - player.x), wrapDelta(HY - player.y));
  const far = clamp((dist - (T.hubRadius + T.ringRadius)) / (P * 0.32), 0, 1);
  if (far <= 0.002) return;
  const cx = W / 2, cy = H / 2;
  const inner = Math.max(40, (0.5 - 0.34 * far) * Math.min(W, H));
  const outer = Math.hypot(W, H) * 0.62;
  const grd = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grd.addColorStop(0, `rgba(${T.fogColor},0)`);
  grd.addColorStop(1, `rgba(${T.fogColor},${0.62 * far})`);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
}

// the slime's directional light (ambient pool + view-cone). In gloom modes it's drawn
// POST-darkness so the deep multiply can't dim it. Cone apex at the base, clipped to the
// base line (never spills below the slime) — except when pointing downward (forward IS below).
function paintSlimeBeam(g, sx, baseY, a) {   // WHITE reveal-mask: a view-cone + an ambient pool, with the slime's
  const cy = baseY - 4, ang = Math.atan2(a.dy, a.dx);   // footprint PUNCHED out of the cone so the triangle reads as BEHIND
  const apexX = sx + a.dx * 13, apexY = baseY;          // the slime (no bright wedge over the body when walking toward it, e.g. up)
  g.save();
  // 1) the directional view-cone, drawn FIRST so the slime can sit in front of it
  g.globalCompositeOperation = "lighter";
  const reach = 196, half = 0.8;
  for (let i = 0; i < 5; i++) {                                      // feathered overlapping wedges (wide+faint → narrow+bright): soft sides
    const tt = i / 4, hw = half * (1 - tt * 0.62), al = 0.1 + tt * 0.12;
    const cone = g.createRadialGradient(apexX, apexY, 6, apexX, apexY, reach);
    cone.addColorStop(0, "rgba(255,255,255," + al + ")"); cone.addColorStop(0.5, "rgba(255,255,255," + (al * 0.55) + ")"); cone.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = cone; g.beginPath(); g.moveTo(apexX, apexY); g.arc(apexX, apexY, reach, ang - hw, ang + hw); g.closePath(); g.fill();
  }
  // 2) punch the slime's footprint OUT of the cone (feathered) — the wedge no longer paints over the body
  g.globalCompositeOperation = "destination-out";
  const hole = g.createRadialGradient(sx, cy, 4, sx, cy, 22);
  hole.addColorStop(0, "rgba(0,0,0,1)"); hole.addColorStop(0.72, "rgba(0,0,0,0.92)"); hole.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hole; g.beginPath(); g.arc(sx, cy, 22, 0, Math.PI * 2); g.fill();
  // 3) the ambient pool RELIGHTS the slime (its own soft glow, not the cone wedge) so it stays visible
  g.globalCompositeOperation = "lighter";
  const amb = g.createRadialGradient(sx, cy, 2, sx, cy, 48);        // a GENTLE glow — enough to see the slime, not so bright it washes it out
  amb.addColorStop(0, "rgba(255,255,255,0.6)"); amb.addColorStop(0.55, "rgba(255,255,255,0.3)"); amb.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = amb; g.beginPath(); g.arc(sx, cy, 48, 0, Math.PI * 2); g.fill();
  g.restore();
}
let fireflyGlowCv = null;
/** a baked amber firefly-glow sprite (built once), drawImaged into the gloom-reveal so each
 *  firefly's light shines THROUGH the dark multiply — cheap, no per-firefly gradient. */
function fireflyGlow() {
  if (fireflyGlowCv) return fireflyGlowCv;
  const s = 40, cv = document.createElement("canvas"); cv.width = s; cv.height = s;
  const g = cv.getContext("2d"), r = s / 2;
  const grad = g.createRadialGradient(r, r, 1, r, r, r);
  grad.addColorStop(0, "rgba(255,240,176,0.95)"); grad.addColorStop(0.45, "rgba(255,226,140,0.4)"); grad.addColorStop(1, "rgba(255,226,140,0)");
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  fireflyGlowCv = cv; return cv;
}
let darkCv = null, dctx = null;
function ensureDarkCv() {
  if (!darkCv) { darkCv = document.createElement("canvas"); dctx = darkCv.getContext("2d"); }
  if (darkCv.width !== canvas.width || darkCv.height !== canvas.height) { darkCv.width = canvas.width; darkCv.height = canvas.height; }
}
let beamState = null;
function drawAvatar(sx, sy) {
  let dx = player.fx - player.fy, dy = (player.fx + player.fy) * 0.5;
  const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  const ptx = Math.round(player.x), pty = Math.round(player.y);
  const inWater = T.biomes && zoneAt(ptx, pty).zone === "field" && biomeAt(ptx, pty) === "water";
  shadow(ctx, sx, sy, 15);                                // no hover — the slime sits on the ground and pulsates
  const a = { dx, dy, color: T.avatarColors[avatarIndex], ink: T.avatarInk, gel: T.avatarGel, glow: T.avatarGlow, beam: T.avatarBeam, wave: inWater, t: tnow, moving: player.moving };
  (T.paintAvatar || defPaintAvatar)(ctx, sx, sy - 8, a);
  beamState = (T.avatarBeam && !reduce) ? { sx, baseY: sy - 2, a } : null;   // engine relights it after the darkness pass
}

/** A soft pulsing pool of the kiosk's accent on the ground beneath it, drawn under
 *  every kiosk on every skin, so they obviously read as items of interest (colour =
 *  "click me"). Brighter when you're next to one. */
function drawKioskGlow(sx, sy, ex, active) {
  const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(tnow * 2.6 + ex.slot * 1.3);
  ctx.save();
  ctx.translate(sx, sy); ctx.scale(1, TILE_H / TILE_W);
  const r = TILE_W * (0.52 + 0.08 * pulse);
  const grad = ctx.createRadialGradient(0, 0, 3, 0, 0, r);
  grad.addColorStop(0, hexA(ex.accent, active ? 0.6 : 0.34 + 0.14 * pulse));
  grad.addColorStop(0.55, hexA(ex.accent, active ? 0.24 : 0.13));
  grad.addColorStop(1, hexA(ex.accent, 0));
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** The fluid alternative to per-tile hub/road diamonds: smooth road ribbons along the
 *  world axes through the plaza (and the nearest torus repeats), then a soft-edged
 *  plaza disc. Drawn in screen space so the plaza reads as one shape, not a grid. */
// one opaque organic ground blob (~a tile), seeded; matches the themes' field blobs
function groundBlob(g, sx, sy, col, tx, ty) {
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, j = 0.86 + hash01(tx * 7 + i * 3, ty * 5 + i * 2) * 0.3; pts.push([sx + Math.cos(a) * 53 * j, sy + Math.sin(a) * 29 * j]); }
  g.fillStyle = col; g.beginPath();
  g.moveTo((pts[N - 1][0] + pts[0][0]) / 2, (pts[N - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < N; i++) { const n = (i + 1) % N; g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[n][0]) / 2, (pts[i][1] + pts[n][1]) / 2); }
  g.closePath(); g.fill();
}
// biome worlds: draw the plaza + roads as opaque blobs ON TOP of the field, so they're the
// same fluid shapes as the ground and nothing shows through underneath them.
function drawZoneBlobs() {
  const c0 = screenToWorld(0, 0), c1 = screenToWorld(W, 0), c2 = screenToWorld(0, H), c3 = screenToWorld(W, H);
  const txMin = Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - 1, txMax = Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + 1;
  const tyMin = Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - 1, tyMax = Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + 1;
  for (let ty = tyMin; ty <= tyMax; ty++) for (let tx = txMin; tx <= txMax; tx++) {
    const z = zoneAt(tx, ty);
    if (z.zone === "field") continue;
    const col = z.zone === "hub" ? T.plazaColor : T.roadColor;
    if (!col) continue;
    const c = toScreen(tx, ty);
    if (c.x < -64 || c.x > W + 64 || c.y < -40 || c.y > H + 40) continue;
    groundBlob(ctx, c.x, c.y, col, tx, ty);
  }
}

function drawFluidZones() {
  if (T.biomes) { drawZoneBlobs(); return; }       // biome worlds use blobs for plaza + roads
  const hx = nearImg(HX, player.x), hy = nearImg(HY, player.y), c = toScreen(hx, hy);
  if (T.wayfinding.roads && T.roadColor) {
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = T.roadColor; ctx.lineWidth = TILE_H * 0.64;
    const SPAN = 46;
    for (const k of [-1, 0, 1]) {
      let a = toScreen(hx - SPAN, hy + k * P), b = toScreen(hx + SPAN, hy + k * P);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      a = toScreen(hx + k * P, hy - SPAN); b = toScreen(hx + k * P, hy + SPAN);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }
  if (T.plazaColor) {
    const rW = (T.hubRadius + 0.7) * TILE_W;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, TILE_H / TILE_W);
    const grd = ctx.createRadialGradient(0, 0, rW * 0.55, 0, 0, rW);
    grd.addColorStop(0, T.plazaColor); grd.addColorStop(1, hexA(T.plazaColor, 0));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, rW, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Chevron near the player toward the nearest unvisited kiosk (only on the plaza). */
function drawKioskArrow() {
  let best = Infinity, pick = null;
  for (const e of EXHIBITS) { if (e.visited) continue; const d = Math.hypot(player.x - nearImg(e.tx, player.x), player.y - nearImg(e.ty, player.y)); if (d < best) { best = d; pick = e; } }
  if (!pick) return;
  const c = toScreen(player.x, player.y), tgt = toScreen(nearImg(pick.tx, player.x), nearImg(pick.ty, player.y));
  const a = Math.atan2(tgt.y - c.y, tgt.x - c.x), r = 46, x = c.x + Math.cos(a) * r, y = c.y - 58 + Math.sin(a) * r * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = hexA(pick.accent, 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(tnow * 5)));
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawToast() {
  if (tnow > toastUntil) return;
  const a = Math.min(1, (toastUntil - tnow) / 0.4);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = "700 14px " + uiFont(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(toastText).width + 30;
  roundRect(W / 2 - w / 2, 18, w, 30, 15, "rgba(12,12,18,0.92)", "rgba(255,255,255,0.14)");
  ctx.fillStyle = "#fff"; ctx.fillText(toastText, W / 2, 34);
  ctx.restore();
}

function updateHUD() {
  const v = EXHIBITS.filter((e) => e.visited).length;
  progressEl.textContent = `${v} / ${EXHIBITS.length} seen`;

  // nav-bar shows when you wander out of sight OR when you open the ☰ menu (mobile-friendly)
  if (navbarEl) navbarEl.classList.toggle("mh-faded", !(mode === "walking" && (kiosksOut || menuOpen)));

  // compass (optional): show only off the plaza
  const showCompass = T.wayfinding.compass && mode === "walking" && !inHub;
  compassEl.classList.toggle("mh-hidden", !showCompass);
  if (showCompass) {
    const hx = nearImg(HX, player.x), hy = nearImg(HY, player.y);
    const c = toScreen(player.x, player.y), tgt = toScreen(hx, hy);
    const ang = Math.atan2(tgt.y - c.y, tgt.x - c.x) * 180 / Math.PI;
    compassArrowEl.style.transform = `rotate(${ang}deg)`;
    compassDistEl.textContent = Math.round(Math.hypot(wrapDelta(HX - player.x), wrapDelta(HY - player.y))) + "";
  }

  let hint;
  if (mode !== "walking") hint = lastHint;
  else if (auto.active && auto.goal >= 0) hint = `Walking to “${EXHIBITS[auto.goal].title}”…`;
  else if (auto.active) hint = `On my way…`;
  else if (activeIndex >= 0) hint = `Press E to open “${EXHIBITS[activeIndex].title}”  ·  Space / Enter → About`;
  else if (inHub) hint = `Space / Enter → About  ·  wander out, it all loops back`;
  else hint = T.wayfinding.recall ? `Wandering… follow a road back to the plaza, or press G to return` : `Wandering… follow a road and it loops back to the plaza`;
  if (hint !== lastHint) { hintEl.textContent = hint; lastHint = hint; }
}

/* ----------------------------------------------------------------------------
   10. CARD MODAL  — themed content card (trusted inline HTML from content.js)
   -------------------------------------------------------------------------- */

/** Open a URL in a new browser tab. Every page link in the world now opens this way —
 *  About, CV, the Toolbox, the Music/Games menus, and the road-houses — so nothing is
 *  shown in an in-world iframe any more. Local pages and external sites are treated the
 *  same. @param {string} url */
function openExternal(url) { try { window.open(url, "_blank", "noopener"); } catch (e) { /* popup blocked / headless: ignore */ } }

/** @param {number} i exhibit index */
function openCard(i) {
  const ex = EXHIBITS[i];
  if (ex.satellite) {                              // a road-house opens its OWN link in a NEW TAB (no iframe)
    ex.visited = true; currentTarget = i; sfx.open(0);
    openExternal(ex.url);
    return;
  }
  const k = CONTENT.kiosks[i], page = k && k.page;
  if (page && page.url) {                          // About / CV / Toolbox → open the real page in a NEW TAB, never framed
    ex.visited = true; currentTarget = i; sfx.open(i);
    openExternal(page.url);
    return;
  }
  openIndex = i;
  ex.visited = true; currentTarget = i;
  sfx.open(i);
  keys.up = keys.down = keys.left = keys.right = false;
  mode = "card";
  renderCard(i);
  cardEl.classList.remove("mh-hidden");
  byId("mh-cardInner").focus();
}
function browse(dir) {
  let ni = openIndex;
  for (let k = 0; k < EXHIBITS.length; k++) { ni = (ni + dir + EXHIBITS.length) % EXHIBITS.length; if (opensAsCard(ni)) break; }
  if (ni !== openIndex && opensAsCard(ni)) { sfx.nav(); openIndex = ni; EXHIBITS[ni].visited = true; currentTarget = ni; renderCard(ni); }
}
/** A kiosk shows an in-world card only when it is NOT a road-house and NOT a page.url
 *  kiosk (those open in a new tab). The Music/Games TOC and any prose kiosk open as a
 *  card, so card-browse cycles only through those. @param {number} i */
function opensAsCard(i) {
  const ex = EXHIBITS[i]; if (!ex || ex.satellite) return false;
  const k = CONTENT.kiosks[i], page = k && k.page;
  return !(page && page.url);
}
function renderCard(i) {
  const k = CONTENT.kiosks[i];
  cardTitleEl.textContent = k.title;
  byId("mh-cardInner").style.setProperty("--mh-card-accent", EXHIBITS[i].accent);  // accent → kiosk colour
  showCardBack(false);
  const page = k.page;
  if (page && page.toc) {                         // a table-of-contents kiosk → the dropdown menu (every link opens in a new tab)
    setCardWide(false); setCardClean(true);
    renderToc(page);
  } else {                                        // the themed prose card
    setCardWide(false); setCardClean(false);
    cardBodyEl.innerHTML = k.html || "";
    cardBodyEl.scrollTop = 0;
  }
}

/** Grow the card into the large page sub-window (~90vw×88vh), or shrink back to the
 *  normal prose/menu width. @param {boolean} on */
function setCardWide(on) {
  const inner = byId("mh-cardInner");
  if (inner && inner.classList) inner.classList.toggle("mh-card--page", !!on);
}
/** TOC/page cards drop the kiosk-title bar and the key-hint footer (just content + close). */
function setCardClean(on) {
  const inner = byId("mh-cardInner");
  if (inner && inner.classList) inner.classList.toggle("mh-card--clean", !!on);
}
/** Show or hide the "‹ Menu" back button in the card head. @param {boolean} on */
function showCardBack(on) {
  const b = document.getElementById("mh-cardBack");
  if (b && b.classList) b.classList.toggle("mh-hidden", !on);
}

/** Render a Music/Games table of contents as a clean link menu. Every entry — local
 *  page or external site — opens in a NEW TAB (no in-world iframe). @param {{toc:any[]}} page */
function renderToc(page) {
  const rows = (page.toc || []).map((it) =>
    `<a class="mh-toc-link" href="${it.url}" target="_blank" rel="noopener">${it.label}</a>`   // bare link, like the site's menubar dropdown
  ).join("");
  cardBodyEl.innerHTML = `<div class="mh-toc">${rows}</div>`;
  cardBodyEl.scrollTop = 0;
}

function closeCard() {
  sfx.close(); cardEl.classList.add("mh-hidden"); mode = "walking"; last = performance.now();
  if (cardBodyEl) cardBodyEl.innerHTML = "";        // unload any embedded page/iframe
  setCardWide(false); setCardClean(false); showCardBack(false);
  try { canvas.focus(); } catch (_) { /* ignore */ }
}

/* ----------------------------------------------------------------------------
   11. DEFAULT PAINTERS  — a plain-but-correct look; every theme overrides these.
   -------------------------------------------------------------------------- */

function defPaintBackground(g, env) {
  const grad = g.createLinearGradient(0, 0, 0, env.H);
  grad.addColorStop(0, "#0b1020"); grad.addColorStop(1, "#10162c");
  g.fillStyle = grad; g.fillRect(0, 0, env.W, env.H);
}
function defPaintGround(g, sx, sy, info) {
  const col = info.zone === "field" ? mix("#18203a", "#222d4d", info.n)
            : info.zone === "road" ? "#39426a" : "#2a3550";
  diamond(g, sx, sy, col, "rgba(255,255,255,0.04)");
}
function defPropAt(tx, ty) { return hash01(tx, ty) < T.propDensity ? (hash01(ty, tx) < 0.5 ? "a" : "b") : null; }
function defPaintProp(g, sx, sy, id, info) {
  const h = id === "a" ? 26 : 16;
  poly(g, [[sx - 6, sy], [sx + 6, sy], [sx + 5, sy - h], [sx - 5, sy - h]], "#2c3450");
  g.fillStyle = id === "a" ? "#3a4f7a" : "#4a3f6a";
  g.beginPath(); g.arc(sx, sy - h, 8, 0, Math.PI * 2); g.fill();
}
function defPaintMonument(g, sx, sy, env) {
  shadow(g, sx, sy, 26);
  poly(g, [[sx - 14, sy], [sx, sy + 7], [sx + 14, sy], [sx, sy - 7]], "#39456e");
  poly(g, [[sx - 9, sy - 2], [sx + 9, sy - 2], [sx + 6, sy - 64], [sx - 6, sy - 64]], "#5b2a86");
  g.fillStyle = "rgba(195,240,255,0.9)"; g.beginPath(); g.arc(sx, sy - 70, 7, 0, Math.PI * 2); g.fill();
}
function defPaintKiosk(g, sx, sy, ex, active, env) {
  shadow(g, sx, sy, 30);
  const fw = TILE_W * 0.28, ph = 22;
  poly(g, [[sx - fw, sy], [sx, sy + fw * 0.5], [sx, sy + fw * 0.5 - ph], [sx - fw, sy - ph]], shade(ex.accent, -0.4));
  poly(g, [[sx + fw, sy], [sx, sy + fw * 0.5], [sx, sy + fw * 0.5 - ph], [sx + fw, sy - ph]], shade(ex.accent, -0.2));
  const sw = 56, sh = 42, bx = sx - sw / 2, by = sy - ph - 28 - sh;
  roundRect(bx, by, sw, sh, 7, "#0d1424", hexA(ex.accent, active ? 0.95 : 0.5));
  g.fillStyle = hexA(ex.accent, active ? 1 : 0.8); g.font = "800 22px " + uiFont();
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(ex.slot + 1), sx, by + sh / 2);
  label(g, ex.title, sx, by - 10, 14, "#eef2f7");
  if (active) { roundRect(sx - 44, by - 38, 88, 24, 12, hexA(ex.accent, 0.95), null); g.fillStyle = "#06121f"; g.font = "700 12px " + uiFont(); g.fillText("Press E", sx, by - 26); }
  if (ex.visited) { g.fillStyle = "#4dcb53"; g.beginPath(); g.arc(bx + sw - 3, by + 3, 7, 0, Math.PI * 2); g.fill(); }
}
function defPaintAvatar(g, sx, sy, a) {
  // a Slime Volleyball slime: a coloured dome (flat base) with one eye looking where it walks.
  // It does NOT hover — it sits on the ground and PULSATES (squash/stretch) to show animacy.
  // a.wave (in water) widens the pulse into a gooey wobble.
  const baseY = sy + 6, r = 13, ink = a.ink || shade(a.color, -0.5);
  const land = a.moving && !a.wave && !reduce;                   // walking on solid ground → ooze along it, don't just breathe
  let rx, ry, lean = 0, swell = 0;
  if (land) {                                                    // a peristaltic "sliming" inch toward (a.dx,a.dy)
    const lp = a.t * 5.6, sw = Math.sin(lp);                     // the stroke: reach (sw>0) then the trailing edge pulls in (sw<0)
    rx = r * (1 + 0.13 * sw); ry = r * (1 - 0.1 * sw);           // elongate+flatten on the reach, bunch+rise on the pull (base unmoved)
    lean = r * 0.5 * a.dx * sw;                                  // crown shears toward heading; the flat base stays planted on baseY
    swell = rx * 0.28 * a.dx * Math.cos(lp);                     // a surface bulge that rolls fore↔aft along the crown
  } else {                                                       // idle breathing / in-water wobble (unchanged)
    const amp = a.wave ? 0.16 : 0.09, p = reduce ? 0 : Math.sin(a.t * (a.wave ? 4.4 : 3.2)) * amp;
    rx = r * (1 + p); ry = r * (1 - p * 0.7);
  }
  if (a.glow && !reduce && !a.beam) {                           // non-beam night glow (omni). Beam themes draw the cone POST-darkness for full brightness.
    g.save(); g.shadowColor = a.glow; g.shadowBlur = 18; g.fillStyle = hexA(a.glow, 0.45);
    g.beginPath(); g.ellipse(sx, baseY - ry * 0.4, rx * 0.95, ry * 0.85, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  if (a.wave && !reduce) {                                       // a ripple ring while wading
    g.save(); g.strokeStyle = hexA("#bfe8ff", 0.4); g.lineWidth = 1.3; const ph = (a.t * 1.4) % 1;
    g.beginPath(); g.ellipse(sx, baseY + 2, 9 + ph * 9, 4 + ph * 4, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  let grad;
  if (a.gel) {                                                  // gel inner texture: bright core → colour → darker rim
    grad = g.createRadialGradient(sx - rx * 0.3, baseY - ry * 0.95, 1, sx, baseY - ry * 0.35, rx * 1.25);
    grad.addColorStop(0, shade(a.color, 0.55)); grad.addColorStop(0.5, a.color); grad.addColorStop(1, shade(a.color, -0.26));
  } else {
    grad = g.createLinearGradient(0, baseY - ry, 0, baseY);
    grad.addColorStop(0, shade(a.color, 0.3)); grad.addColorStop(1, a.color);
  }
  g.fillStyle = grad;
  g.beginPath();
  if (land) {                                                   // flat base planted on the ground; the crown leans + the swell travels
    const ty = baseY - ry, ax = sx + lean + swell;
    g.moveTo(sx - rx, baseY); g.quadraticCurveTo(sx - rx + lean, ty, ax, ty); g.quadraticCurveTo(sx + rx + lean, ty, sx + rx, baseY); g.closePath();
  } else { g.moveTo(sx - rx, baseY); g.ellipse(sx, baseY, rx, ry, 0, Math.PI, 0, false); g.closePath(); }
  g.fill();
  g.lineWidth = 2; g.strokeStyle = ink; g.lineJoin = "round"; g.stroke();        // keep the outline in every mode
  if (a.gel) { g.fillStyle = "rgba(255,255,255,0.32)"; g.beginPath(); g.ellipse(sx - rx * 0.32 + lean * 0.6, baseY - ry * 0.95, rx * 0.22, ry * 0.16, -0.5, 0, Math.PI * 2); g.fill(); }   // gel sheen
  const ex = sx + a.dx * 4 + lean * 0.6, ey = baseY - ry * 0.6 + a.dy * 2.5;     // eye rides the leaning crown, still looking toward heading
  g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, 3.5, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.3; g.strokeStyle = ink; g.stroke();
  g.fillStyle = ink; g.beginPath(); g.arc(ex + a.dx * 1.7, ey + a.dy * 1.7, 1.8, 0, Math.PI * 2); g.fill();
}
/** decorative building (build mode): a simple iso house or tree, outlined in the
 *  theme's ink. A theme can override with paintBuilding for its own look. */
function defPaintBuilding(g, sx, sy, b, env) {
  if (window.MH_BUILD && window.MH_BUILD.paint) {                // procedural generator (buildings.js): each one different
    window.MH_BUILD.paint(g, sx, sy, b, { t: env.t, biome: env.biome, ink: T.avatarInk || "#3a3a3a", util: window.MH_ISO.util });
    return;
  }
  const ink = T.avatarInk || "#3a3a3a", s1 = hash01((b.tx * 7 + 3) | 0, (b.ty * 5 + 1) | 0), s2 = hash01((b.ty * 3 + 2) | 0, (b.tx * 9 + 4) | 0);
  if (b.type === "tree") {
    shadow(g, sx, sy, 11);
    poly(g, [[sx - 2.5, sy], [sx + 2.5, sy], [sx + 2, sy - 20], [sx - 2, sy - 20]], "#5a3c22");
    const r = 13 + Math.floor(s1 * 5);
    g.fillStyle = "#3f7a3a"; g.beginPath(); g.arc(sx, sy - 22, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = hexA(ink, 0.5); g.stroke();
    return;
  }
  shadow(g, sx, sy, 18);
  const ww = 17 + Math.floor(s1 * 7), wh = 22 + Math.floor(s2 * 14), ry = sy - wh - 7;   // bigger + procedural
  poly(g, [[sx - ww, sy - 4], [sx, sy + 4], [sx, sy - wh], [sx - ww, sy - wh - 7]], "#bda06e");
  poly(g, [[sx + ww, sy - 4], [sx, sy + 4], [sx, sy - wh], [sx + ww, sy - wh - 7]], "#9a7c50");
  poly(g, [[sx - ww - 3, ry + 3], [sx, ry - 11], [sx + ww + 3, ry + 3], [sx, ry + 8]], "#7a5a35");
  g.lineWidth = 1.6; g.strokeStyle = ink; g.lineJoin = "round";
  g.beginPath(); g.moveTo(sx, sy + 4); g.lineTo(sx, sy - wh); g.stroke();
  g.beginPath(); g.moveTo(sx - ww - 3, ry + 3); g.lineTo(sx, ry - 11); g.lineTo(sx + ww + 3, ry + 3); g.stroke();
}
function defPaintSignpost(g, sx, sy, dir, dist, info) {
  poly(g, [[sx - 2, sy], [sx + 2, sy], [sx + 2, sy - 22], [sx - 2, sy - 22]], "#6b4a2c");
  roundRect(sx - (dir > 0 ? 4 : 20), sy - 28, 24, 10, 2, "#8a6a3a", "#5a3f22");
  g.fillStyle = "#2a1c0e"; g.font = "700 8px " + uiFont(); g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText((dir > 0 ? "▶ " : "◀ ") + dist, sx + (dir > 0 ? 8 : -8), sy - 23);
}

/* ----------------------------------------------------------------------------
   12. HELPERS  — iso math, primitives, colour, signposts
   -------------------------------------------------------------------------- */

function isoToScreen(wx, wy) { return { x: (wx - wy) * (TILE_W / 2), y: (wx + wy) * (TILE_H / 2) }; }
function toScreen(wx, wy) { return { x: (wx - wy) * (TILE_W / 2) + originX, y: (wx + wy) * (TILE_H / 2) + originY }; }   // inlined: one object alloc, not two (hot path, ~thousands/frame)
function screenToWorld(sx, sy) { const ix = sx - originX, iy = sy - originY; return { x: ix / TILE_W + iy / TILE_H, y: iy / TILE_H - ix / TILE_W }; }

/** which kiosk (if any) sits under a screen point — a tall hit-box, front-most wins */
function kioskAtScreen(sx, sy) {
  let pick = -1, bestD = -Infinity;
  for (let i = 0; i < EXHIBITS.length; i++) {
    const ex = EXHIBITS[i], c = toScreen(nearImg(ex.tx, player.x), nearImg(ex.ty, player.y));
    if (sx >= c.x - 34 && sx <= c.x + 34 && sy >= c.y - 100 && sy <= c.y + 18) {
      const d = ex.tx + ex.ty; if (d > bestD) { bestD = d; pick = i; }
    }
  }
  return pick;
}

/** Is (tx,ty) a signpost tile? On a road, every signSpacing tiles out from the hub.
 *  @returns {{dir:number, dist:number}|null} dir: +1 toward hub is +index, used by painter */
function signpostHere(tx, ty) {
  const onX = wrap(tx - HX) === 0, onY = wrap(ty - HY) === 0;
  if (onX && onY) return null;                       // the crossroads itself: skip
  const sp = T.signSpacing;
  if (onX) {
    const d = wrapDelta(ty - HY); const ad = Math.abs(d);
    if (ad >= sp && ad % sp === 0 && ad <= P * 0.42) return { dir: d > 0 ? -1 : 1, dist: ad };
  } else if (onY) {
    const d = wrapDelta(tx - HX); const ad = Math.abs(d);
    if (ad >= sp && ad % sp === 0 && ad <= P * 0.42) return { dir: d > 0 ? -1 : 1, dist: ad };
  }
  return null;
}

function diamond(g, cx, cy, fill, stroke) {
  g.beginPath();
  g.moveTo(cx, cy - TILE_H / 2); g.lineTo(cx + TILE_W / 2, cy); g.lineTo(cx, cy + TILE_H / 2); g.lineTo(cx - TILE_W / 2, cy); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}
function poly(g, pts, fill) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } }
function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function shadow(g, cx, cy, rx) { g.save(); g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
function label(g, text, x, y, size, color) {
  g.font = "700 " + size + "px " + uiFont(); g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.6)"; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
}
function toast(msg) { toastText = msg; toastUntil = tnow + 1.6; }
function uiFont() { return getComputedStyle(document.documentElement).getPropertyValue("--mh-ui").trim() || "system-ui, sans-serif"; }

/** lighten(amt>0)/darken(amt<0) a #rrggbb */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (f - r) * p); gg = Math.round(gg + (f - gg) * p); b = Math.round(b + (f - b) * p);
  return `rgb(${r},${gg},${b})`;
}
/** blend two #rrggbb by t (0..1) → rgb() */
function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ----------------------------------------------------------------------------
   PUBLIC ENTRY
   -------------------------------------------------------------------------- */

/** Merge a raw theme over the defaults (deep-ish for the nested objects). */
function mergeTheme(theme) {
  const m = Object.assign({}, DEFAULTS, theme);
  m.wayfinding = Object.assign({}, DEFAULTS.wayfinding, theme.wayfinding || {});
  m.audio = Object.assign({}, DEFAULTS.audio, theme.audio || {});
  return m;
}

/** Register a skin. A standalone page that loads exactly one theme auto-starts it
 *  (back-compat); a multi-skin page lets the first one start and offers the rest in
 *  the live switcher. Opt out of autostart with window.MH_AUTOSTART = false (then
 *  call MH_ISO.start(id) yourself). @param {object} theme */
function register(theme) {
  if (!theme || !theme.id) throw new Error("MH_ISO.register: theme needs an id");
  REGISTRY.set(theme.id, theme);
  if (window.MH_AUTOSTART !== false && !started) start(theme.id);
  else if (started) refreshSwitcher();
}

/** Boot the engine on a skin, or — if already running — live-swap to it.
 *  @param {string|object} themeOrId @param {object} [content] */
function start(themeOrId, content) {
  const theme = typeof themeOrId === "string" ? REGISTRY.get(resolveSkin(themeOrId)) : themeOrId;
  if (!theme) throw new Error("MH_ISO.start: unknown skin " + themeOrId);
  if (typeof themeOrId !== "string") REGISTRY.set(theme.id, theme);
  if (started) { requestSwitch(theme.id); return; }
  started = true;
  T = mergeTheme(theme);
  CONTENT = content || window.MH_CONTENT;
  TILE_W = T.tileW; TILE_H = T.tileH;
  avatarIndex = 0;
  reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  persistSkin(theme.id);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  function boot() {
    buildDOM(); buildHub(); buildNavbar(); buildPicker(); refreshSwitcher(); wireInput(); resize();
    applyEcology();
    startGame();          // no "enter" page — land straight in the world (audio wakes on first input)
    last = performance.now(); requestAnimationFrame(loop);
  }
}

/** Wrap a live swap in a View Transitions crossfade when available (and motion is
 *  allowed), so a skin change reads as the same object seen in different light. */
function requestSwitch(id) {
  if (!started || !REGISTRY.has(id) || id === (T && T.id)) return;
  if (!reduce && document.startViewTransition) document.startViewTransition(() => switchTheme(id));
  else switchTheme(id);
}

/** Live-swap the active skin, keeping the SAME world + player state. Only the
 *  surface changes (palette, painters, CSS, audio); the plaza geometry and what
 *  you have visited persist — one place, many lenses. @param {string} id */
function switchTheme(id) {
  const theme = REGISTRY.get(id);
  if (!theme || !started) return;
  const liveP = P, liveHub = T.hubRadius, liveRing = T.ringRadius;   // realized geometry to preserve
  T = mergeTheme(theme);
  T.worldPeriod = liveP; T.hubRadius = liveHub; T.ringRadius = liveRing;
  TILE_W = T.tileW; TILE_H = T.tileH;                                 // (all skins share 96×48)
  const sk = document.getElementById("mh-theme"); if (sk) sk.textContent = T.css || "";
  document.documentElement.style.background = T.bgCss; document.body.style.background = T.bgCss;
  EXHIBITS.forEach((ex, i) => { ex.accent = T.accents[i % T.accents.length]; });
  rebuildSpurs();                                  // grow or clear the Music/Games house-roads for the new world
  avatarIndex = avatarIndex % T.avatarColors.length;
  buildPicker(); if (navbarEl) buildNavbar(); refreshSwitcher();
  document.title = ((CONTENT && CONTENT.title) || "Matt Horrigan") + " · " + T.name;
  persistSkin(id); reflectSkinInURL(id); applyEcology(); sfx.pick(); toast(T.name);
}

/** Cycle to the next registered skin (the T key). */
function cycleSkin() { const ids = [...REGISTRY.keys()]; if (ids.length < 2) return; start(ids[(ids.indexOf(T.id) + 1) % ids.length]); }

/** (Re)build the bottom skin-switcher from the registry; hidden until 2+ skins. */
function refreshSwitcher() {
  switcherEl = document.getElementById("mh-switcher");
  if (!switcherEl) return;
  switcherEl.innerHTML = "";
  if (REGISTRY.size <= 1) { switcherEl.classList.add("mh-faded"); return; }
  switcherEl.classList.remove("mh-faded");
  for (const [id, th] of REGISTRY) {
    const b = document.createElement("button"); b.type = "button";
    b.className = "mh-skin" + (T && id === T.id ? " mh-cur" : "");
    b.textContent = th.name; b.dataset.id = id;
    b.addEventListener("click", () => start(id));
    switcherEl.appendChild(b);
  }
}

function persistSkin(id) { try { if (window.localStorage) window.localStorage.setItem("mh-skin", id); } catch (e) { /* file:// or blocked: fine */ } }

/* Shareable theme links. Friendly public names (the ones the site uses out loud) map to the
   engine ids, so ?skin=gloomthmaxx / ?skin=bureaucore / ?skin=technurture all work. */
const SKIN_ALIAS = { bureaucore: "technocute", gloomthmaxx: "technoscure" };   // ?skin input → registry id
const SKIN_SHARE = { technocute: "bureaucore", technoscure: "gloomthmaxx" };   // registry id → friendly name shown in the URL
/** Resolve a skin id OR a friendly alias to a real registry id. @param {string} s */
function resolveSkin(s) { s = String(s == null ? "" : s).toLowerCase(); return SKIN_ALIAS[s] || s; }
/** Reflect the active skin in the address bar so the current theme is shareable by copying the URL.
   Only fires on a live switch (switchTheme), so a fresh time-of-day landing keeps a clean URL. */
function reflectSkinInURL(id) {
  try { const u = new URL(location.href); u.searchParams.set("skin", SKIN_SHARE[id] || id); history.replaceState(history.state, "", u.href); }
  catch (e) { /* file:// or blocked: fine */ }
}

/** The skin a FRESH visit lands on, chosen by the visitor's LOCAL time of day:
 *    weekday business hours (Mon–Fri, 9am–5pm) → technocute  (bureaucore)
 *    other daylight         (6am–8pm)          → technurture (the lush slimeworld)
 *    late night             (8pm–6am)          → technoscure (gloomthmaxx)
 *  A boot script uses this as the default landing skin; ?skin= still overrides it. Falls
 *  back to any registered id if the time-pick isn't loaded. */
function timeDefaultSkin() {
  let id = "technocute";
  try {
    const d = new Date(), h = d.getHours(), day = d.getDay();          // day: 0=Sun … 6=Sat
    if (day >= 1 && day <= 5 && h >= 9 && h < 17) id = "technocute";   // bureaucore: weekday business hours
    else if (h >= 6 && h < 20) id = "technurture";                     // daylight
    else id = "technoscure";                                           // gloomthmaxx: late night
  } catch (e) { /* no clock: fall through to the registry fallback */ }
  if (REGISTRY.has(id)) return id;
  const first = REGISTRY.keys().next();
  return first && !first.done ? first.value : id;
}

/** Apply the active theme's ecology config to the optional ecology layer (so the
 *  flora-only / predators+fireflies / off mix changes with the skin). */
function applyEcology() {
  const E = window.MH_ECO; if (!E) return;
  const cfg = T.ecology;
  E.enabled = !!(cfg && cfg.enabled);
  if (cfg && cfg.cfg) Object.assign(E.cfg, cfg.cfg);
  if (cfg && cfg.showFlora != null) E.showFlora = cfg.showFlora;
  if (E.reset) E.reset();
}

/* ----------------------------------------------------------------------------
   ECOLOGY HOOK  — an optional artificial-life layer (ecology.js sets window.MH_ECO).
   The engine drives it with three tiny calls (update / groundTint / actors) and a
   stable API; absent or disabled, it costs nothing. See ecology.js + ecology/.
   -------------------------------------------------------------------------- */
function ecoActive() { return !!(window.MH_ECO && window.MH_ECO.enabled); }
const ECO_API = {
  get player() { return player; },           // live {x,y} in canonical tiles
  get hub() { return { x: HX, y: HY }; },     // plaza centre
  get villageR() { return T.ringRadius + 2; }, // predators keep outside this radius of the hub
  get P() { return P; },                      // torus period
  get t() { return tnow; },
  get W() { return W; }, get H() { return H; },
  get ctx() { return ctx; },
  /** canonical world tile → screen at the nearest torus image of the player (+depth) */
  place(wx, wy) { const ix = nearImg(wx, player.x), iy = nearImg(wy, player.y); const s = toScreen(ix, iy); return { x: s.x, y: s.y, depth: ix + iy }; },
};

// expose helpers a theme may want to reuse (iso math, colour, primitives)
window.MH_ISO = {
  register, start, switchTheme: requestSwitch, cycle: cycleSkin, timeDefaultSkin, resolveSkin,
  themes: () => [...REGISTRY.values()].map((t) => ({ id: t.id, name: t.name })),
  reduced: () => reduce,
  hub: () => ({ x: HX, y: HY, period: P }),   // plaza centre (canonical tile) + torus period
  biome: biomeAt,                              // coarse biome for a canonical tile
  util: { diamond, poly, roundRect, shadow, label, shade, mix, hexA, clamp, hash01, noise01, wrap, wrapDelta },
  get TILE() { return { W: TILE_W, H: TILE_H }; },
};

})();
