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
/** What the slime is saying (a tip, in the first person), and where it stands on screen. */
let slimeSay = null, avatarAt = { x: 0, y: 0 };
const used = {};                        // what the visitor has done: the slime's tips skip it
let inHub = true;                       // is the player on/over the plaza platform?
let kiosksOut = false;                  // are ALL kiosks currently off-screen? (→ show nav-bar + edge markers)
let reduce = false;                     // prefers-reduced-motion: themes gate flicker/glitch on this
const REGISTRY = new Map();             // id -> raw theme, for the live skin-switcher
let lastPlayerShareAt = 0;              // throttle URL updates while the slime is moving
let strideWas = 0;                      // which crest of the walking beat was last passed (one step per stride)
let playerWasMoving = false;
let started = false, switcherEl = null;
// build mode (AoE2 / Frostpunk-ish): rearrange the buildings, add decorative ones
let buildMode = false, buildTool = "move", drag = null, buildbarEl = null, buildToggleEl = null, menuOpen = false, tapDown = null;
/** @type {{tx:number, ty:number, type:string, uid?:string, botToken?:string}[]} decorative buildings the visitor places */
const BUILDINGS = [];

// DOM refs (filled in buildDOM)
let introEl, cardEl, cardTitleEl, cardBodyEl, hudEl, compassEl, compassArrowEl,
    compassDistEl, progressEl, startBtn, pickerEl, navbarEl;

/* ----------------------------------------------------------------------------
   2a. REGISTRIES — the two places a fork adds a kind of thing to the world.

   STRUCTURES are how a kiosk that is not a dwelling is drawn. content.js names
   one per satellite or kiosk (structure: "wellhead"); the render pass looks the name up
   here and falls back to the skin's paintKiosk. Add one with
   MH_ISO.registerStructure(name, painter(g, sx, sy, ex, active, env)).

   BUILD_TOOLS are what the ✎ Build bar offers: one button, one cursor glyph,
   one hit-box, and the hooks a type needs when it is placed, tapped or removed.
   The painter for a type lives in buildings.js (MH_BUILD.register). Add one
   with MH_ISO.registerBuildTool({ id, label, glyph, hitTop, place, tap, remove }).
   -------------------------------------------------------------------------- */

/** @type {Map<string, (g:CanvasRenderingContext2D, sx:number, sy:number, ex:any, active:boolean, env:any) => void>} */
const STRUCTURES = new Map();
function registerStructure(name, painter) { STRUCTURES.set(name, painter); }

/** @typedef {{id:string, label:string, glyph:string, hitTop?:number, place?:(b:any)=>void, placed?:(b:any)=>void, tap?:(b:any)=>boolean, remove?:(b:any)=>void}} BuildTool */
/** @type {BuildTool[]} */
const BUILD_TOOLS = [
  { id: "house", label: "Plant a house.", hitTop: 44,
    glyph: '<path d="M8 13l7-6 7 6v9H8z" fill="#ffd37a"/><path d="M6 14l9-8 9 8" fill="none" stroke="#17202a" stroke-width="2"/>' },
  { id: "tree", label: "Build a tree.", hitTop: 44,
    glyph: '<path d="M15 11v12" stroke="#17202a" stroke-width="3"/><circle cx="15" cy="9" r="6" fill="#73d98b" stroke="#17202a" stroke-width="1.5"/>' },
  { id: "signal", label: "Raise a signal tower.", hitTop: 96,
    glyph: '<path d="M15 7v17M10 24h10M11 13h8M12 18h6" stroke="#17202a" stroke-width="2"/><circle cx="15" cy="6" r="3" fill="#7afcff" stroke="#17202a"/>',
    // a tower is a Musebot: it needs an id, opens its selector when placed or tapped, and tells the bundle when it goes
    place(b) { if (window.MH_MUSEBOTS) b.uid = window.MH_MUSEBOTS.nextUid(BUILDINGS); },
    placed(b) { if (window.MH_MUSEBOTS) window.MH_MUSEBOTS.openSelector(b, BUILDINGS); },
    tap(b) { if (!window.MH_MUSEBOTS) return false; window.MH_MUSEBOTS.openSelector(b, BUILDINGS); return true; },
    remove(b) { if (window.MH_MUSEBOTS) window.MH_MUSEBOTS.remove(b); } },
];
const toolOf = (id) => BUILD_TOOLS.find((t) => t.id === id) || null;
function registerBuildTool(def) {
  if (!def || !def.id || toolOf(def.id)) return;
  BUILD_TOOLS.push(def);
  if (buildbarEl) {                                  // the bar exists: grow it in place, before Remove
    const b = document.createElement("button");
    b.className = "mh-tool"; b.type = "button"; b.dataset.tool = def.id; b.textContent = def.label;
    const remove = buildbarEl.querySelector('[data-tool="delete"]');
    if (remove) buildbarEl.insertBefore(b, remove); else buildbarEl.appendChild(b);
  }
}

/* ----------------------------------------------------------------------------
   2b. WORDS — the engine is written in English and stays that way. i18n.js, when
   the page loads it, hands back the visitor's language for a given key; with no
   i18n.js (a fork that took the engine and not the switch) every call returns the
   English text it was given, so the world behaves exactly as it always has.
   -------------------------------------------------------------------------- */

/** @param {string} key @param {string} english @param {Object} [vars] */
function tr(key, english, vars) {
  if (window.MH_I18N) return window.MH_I18N.t(key, english, vars);
  if (!vars) return english;
  return String(english).replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole);
}

/** A kiosk's name in the visitor's language, keyed by its English one. Names of
 *  works (No Phenomenon, Autofac) have no entry, so they come back unchanged. */
function kioskTitle(english) { return tr("kiosk." + english + ".title", english); }

/** Redraw every word the engine itself put on the screen, after a switch. */
function relabel() {
  EXHIBITS.forEach((ex) => { if (ex.titleEn) ex.title = kioskTitle(ex.titleEn); });
  if (navbarEl) buildNavbar();
  const chip = document.getElementById("mh-tagline");
  if (chip && T) chip.textContent = tr("theme." + T.id + ".tagline", T.tagline);
  if (mode === "card" && openIndex >= 0) renderCard(openIndex);   // the open card too
  buildPicker();                                                  // colour tooltips
  updateHUD();                                                    // the "n / m seen" counter, now rather than next frame
}

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
    <div id="mh-mark" title="matthorrigan.com: same place, different light"><span>MH</span></div>
    <div id="mh-buildbar" class="mh-buildbar mh-faded" role="toolbar" aria-label="Build tools">
      <button class="mh-tool mh-cur" type="button" data-tool="move"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:4px" aria-hidden="true"><path d="M12 4V20M4 12H20M12 4l-2.5 2.5M12 4l2.5 2.5M12 20l-2.5-2.5M12 20l2.5-2.5M4 12l2.5-2.5M4 12l2.5 2.5M20 12l-2.5-2.5M20 12l-2.5 2.5"/></svg><span class="mh-tool-label">Move</span></button>
      ${BUILD_TOOLS.map((t) => `<button class="mh-tool" type="button" data-tool="${t.id}">${t.label}</button>`).join("\n      ")}
      <button class="mh-tool" type="button" data-tool="delete">✕ Remove</button>
      <button class="mh-tool mh-tool-done" type="button" data-tool="done">Done</button>
    </div>

    <div id="mh-intro" class="mh-overlay">
      <div class="mh-panel">
        <div class="mh-kicker" id="mh-themechip"></div>
        <h1 id="mh-title">M. Reid Horrigan</h1>
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
      <p id="mh-tips" class="mh-sr"></p>
      <div class="mh-hud-right">
        <button id="mh-view3d" class="mh-hudbtn mh-hidden" type="button" title="See this spot in 3D">3D</button>
        <button id="mh-menu" class="mh-hudbtn" type="button" title="Building menu: jump to a building">☰ Menu</button>
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
  compassEl = byId("mh-compass");
  compassArrowEl = byId("mh-needle");
  compassDistEl = byId("mh-cdist");
  progressEl = byId("mh-progress");
  startBtn = /** @type {HTMLButtonElement} */ (byId("mh-start"));
  pickerEl = byId("mh-picker");
  navbarEl = byId("mh-navbar");
  buildbarEl = byId("mh-buildbar");
  buildToggleEl = byId("mh-buildtoggle");

  byId("mh-themechip").textContent = T.name;                       // the skin's own coined name: never translated
  byId("mh-tagline").textContent = tr("theme." + T.id + ".tagline", T.tagline);
  byId("mh-title").textContent = (CONTENT && CONTENT.title) || "M. Reid Horrigan";
  document.title = ((CONTENT && CONTENT.title) || "M. Reid Horrigan") + " · " + T.name;
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
  .mh-hud-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .mh-hudbtn{ pointer-events:auto; appearance:none; cursor:pointer; font:700 12px var(--mh-ui,system-ui,sans-serif);
    padding:6px 10px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; color:#fff; background:rgba(20,20,28,.7); border:1px solid rgba(255,255,255,.18); line-height:1; white-space:nowrap; }
  .mh-hudbtn:hover{ filter:brightness(1.15); } .mh-hudbtn.mh-on{ background:#fff; color:#111; }
  /* out of sight: the slime says these tips itself; they stay here for a screen reader */
  .mh-sr{ position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
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
    #mh-themechip, #mh-menu{ display:none; }   /* declutter the phone HUD: drop the redundant style label and the menu button */
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
  /* phone landscape: the viewport is wide but very short — and a landscape phone is
     usually WIDER than 600px, so the max-width:600px phone rules above never kick in.
     Spread the building menu across the full width as one top-hugging row (scroll if it
     ever overflows) instead of a centred block that wraps down over the slime; tuck the
     skin switcher to the bottom edge. Both hug an edge, leaving the centre clear. */
  @media (orientation:landscape) and (max-height:500px){
    .mh-navbar{ top:6px; left:8px; right:8px; transform:none; max-width:none;
      flex-wrap:nowrap; gap:5px; padding:4px 6px; overflow-x:auto;
      -webkit-overflow-scrolling:touch; scrollbar-width:none; }
    .mh-navbar::-webkit-scrollbar{ display:none; }
    .mh-navbar.mh-faded{ transform:translateY(-12px); }
    .mh-navchip{ font-size:10.5px; padding:5px 9px; flex:0 0 auto; }
    .mh-switcher{ bottom:6px; gap:4px; padding:3px; }
    .mh-skin{ font-size:10.5px; padding:4px 8px; }
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
    b.title = tr("world.colour", "Colour {n}", { n: i + 1 });
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
  home.type = "button"; home.className = "mh-navchip mh-navhome"; home.textContent = tr("world.plaza", "◇ Plaza");
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
  if (!opensAsCard(i)) { warpAndOpen(i); return; }   // a kiosk with a page → warp the slime there AND open the page in THIS gesture (another site's new tab is popup-safe only here)
  auto.active = true; auto.goal = i; auto.warp = true; auto.lastDist = Infinity; auto.stuck = 0;
}
/** Send the slime WARPING toward kiosk i — as a POSITION target (auto.goal = -1), so its arrival
 *  won't try to re-open it (a deferred new tab would be popup-blocked) — and open the kiosk's page
 *  in THIS user gesture. */
function warpAndOpen(i) {
  const ex = EXHIBITS[i]; if (!ex) return;
  const dx = nearImg(ex.tx, player.x) - player.x, dy = nearImg(ex.ty, player.y) - player.y;
  const d = Math.hypot(dx, dy) || 1, stop = Math.max(0, d - (T.interact || 1.2));   // pull up just in front of the building, not on top of it
  // Move BEFORE the card opens, not after. This used to queue an animated warp
  // and open the card in the same breath, but update() only runs while walking,
  // so the warp sat pending behind the card and fired the moment it closed: the
  // camera lurched across the world at warp speed, which reads as the screen
  // shaking. The slide was never visible from here anyway.
  player.x = wrap(player.x + (dx / d) * stop);
  player.y = wrap(player.y + (dy / d) * stop);
  player.fx = dx / d; player.fy = dy / d;                    // and face what you came to read
  auto.active = false; auto.warp = false; auto.goal = -1;
  openCard(i);
}

/** @param {string} id */
function byId(id) { const el = document.getElementById(id); if (!el) throw new Error("missing #" + id); return el; }

/* ----------------------------------------------------------------------------
   4. AUDIO  — sine/tri SFX over a theme-chosen scale (ported from the proven kit)
   -------------------------------------------------------------------------- */

const audio = {
  /** @type {AudioContext|null} */ ctx: null, /** @type {GainNode|null} */ master: null, muted: false,
  /** @type {BiquadFilterNode|null} */ soft: null,              // a low-pass into the master, for the step's rounded squelch
  musebotsActive: false,
  ensure(sharedContext) {
    if (sharedContext && this.ctx !== sharedContext) {
      if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
      this.ctx = sharedContext; this.master = null;
    }
    if (this.ctx && this.master) return;
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!this.ctx && !AC) return;
    this.ctx ||= new AC(); this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : (this.musebotsActive ? 0.9 : 0.5); this.master.connect(this.ctx.destination);
    this.soft = null;
    if (this.ctx.createBiquadFilter) {                        // (a context without filters: the step goes to the master)
      this.soft = this.ctx.createBiquadFilter(); this.soft.type = "lowpass"; this.soft.frequency.value = 900; this.soft.Q.value = 0.5; this.soft.connect(this.master);
    }
  },
  resume() {
    if (this.ctx && this.ctx.state !== "running" && this.ctx.state !== "closed")
      this.ctx.resume().catch(() => {});
  },
  setMuted(m) { this.muted = m; if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : (this.musebotsActive ? 0.9 : 0.5), this.ctx.currentTime, 0.02); },
  // (the tones themselves are recipes in sounds.js, the one place the worlds' sounds are defined)
};
/** Play one of the worlds' sounds, by name (sounds.js is the one place they are
 *  defined, shared with the 3D village, so the two views cannot drift apart), in
 *  this skin's key and scale, at the level it is designed for through this master
 *  (0.5). Under Musebots the master rises and the cues get a small lift. */
function cue(name, degree) {
  if (!audio.ctx || !audio.master || audio.muted || !window.MH_SOUNDS) return;
  window.MH_SOUNDS.play(name, audio.ctx, { out: audio.master, soft: audio.soft, level: 0.5, root: T.audio.root, scale: T.audio.scale,
    degree: degree || 0, boost: audio.musebotsActive ? 1.65 : 1 });
}
const sfx = {
  open(d) { cue("open", d); },
  near(d) { cue("near", d); },
  close() { cue("close"); },
  nav() { cue("nav"); },
  pick() { cue("pick"); },
  step() { cue("step"); },                              // once a stride (update): the same squelch as the 3D village's
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
      titleEn: it.title, title: kioskTitle(it.title),
      accent: T.accents[i % T.accents.length], slot: i, visited: false,
      underConstruction: !!it.underConstruction,
      structure: it.structure || null,                  // a kiosk that is not a dwelling (the Glossary's wellhead)
    };
  });
  player.x = HX; player.y = HY + 1.8; player.fx = 0; player.fy = 1;   // spawn on the plaza, clear of the central beacon
  restorePlayerFromURL();
  activeIndex = prevActive = currentTarget = -1;
  // build-mode is a per-session sandbox: placed buildings do NOT persist across a refresh,
  // and the kiosks always return to their even ring. Older builds saved a layout; drop it.
  BUILDINGS.length = 0;
  try { if (window.localStorage) window.localStorage.removeItem("mh-layout"); } catch (e) { /* fine */ }
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.restore) window.MH_MUSEBOTS.restore(BUILDINGS);
  rebuildSpurs();
}

/** World-aware: in the slimeverse, each kiosk that carries a `satellites` list grows a
 *  ROAD off the plaza with one walk-up HOUSE per item (Music, Games). The gateway kiosk
 *  stays on the ring; the houses march straight outward from it, and the spur between is
 *  paved as road. Gated on T.spurRoads (now on for every skin), so the same house geometry
 *  appears in all worlds. Idempotent and rebuilt on every world-switch. */
const SPUR_SIDE = 1;                                  // tiles a road-house stands off its road's middle (verse3d.js ISO.side)
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
      // the houses stand beside the road, alternate houses on alternate sides:
      // in a line down its middle, a road running up the screen stacked each
      // house and its sign onto the one behind it
      const r = T.ringRadius + step * (j + 1), side = (j % 2 ? -1 : 1) * SPUR_SIDE;
      EXHIBITS.push({
        tx: HX + r * Math.cos(ang) - side * Math.sin(ang), ty: HY + r * Math.sin(ang) + side * Math.cos(ang),
        titleEn: sats[j].title, title: kioskTitle(sats[j].title),   // a work's own name: the dictionary leaves it alone
        accent: gate.accent, slot: 90 + s * 13 + j * 7,   // slot is only a visual seed for houses
        url: sats[j].url, satellite: true, visited: false,
        structure: sats[j].structure || null,   // "wellhead" for a page that is underground
      });
    }
    const rEnd = T.ringRadius + step * sats.length + 0.7;        // pave the spur from the hub edge out to the last house
    for (let r = T.hubRadius - 0.3; r <= rEnd; r += 0.33)
      SPUR_TILES.add(wrap(Math.round(HX + r * Math.cos(ang))) + "," + wrap(Math.round(HY + r * Math.sin(ang))));
  }
  buildJunctions(step);
}

/** Pave a straight line between two world points, a tile every third of a step. */
function paveLine(x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.33));
  for (let i = 0; i <= n; i++)
    SPUR_TILES.add(wrap(Math.round(x0 + ((x1 - x0) * i) / n)) + "," + wrap(Math.round(y0 + ((y1 - y0) * i) / n)));
}

/** A junction is a house two roads share: it sits on the bisector between two
 *  gateway kiosks, and a short paved link runs to it from the end of each of
 *  their spurs, so walking out along either road arrives at the same door.
 *  See CONTENT.junctions. Called from rebuildSpurs, after the spurs exist. */
function buildJunctions(step) {
  const js = CONTENT.junctions;
  if (!js || !js.length) return;
  for (let k = 0; k < js.length; k++) {
    const j = js[k];
    const gates = (j.between || []).map((name) => {
      const i = CONTENT.kiosks.findIndex((it) => it.title === name);
      return i < 0 ? null : { i, ex: EXHIBITS[i], sats: (CONTENT.kiosks[i].satellites || []).length };
    }).filter(Boolean);
    if (gates.length < 2) continue;                              // needs two roads to join

    // The house sits at the MIDPOINT OF THE ENDS of the two roads: the mean of
    // their last houses' positions, which is equidistant from both by
    // construction. (A bisector at some radius is not: the two roads are
    // different lengths, so the same angle sits nearer the shorter one.)
    let jx = 0, jy = 0;
    for (const g of gates) {
      const a = Math.atan2(g.ex.ty - HY, g.ex.tx - HX), re = T.ringRadius + step * g.sats;
      jx += HX + re * Math.cos(a); jy += HY + re * Math.sin(a);
    }
    jx /= gates.length; jy /= gates.length;
    if (T.biomes) {                                              // keep the house out of the water: nudge to the nearest dry tile
      outer:
      for (const rad of [0, 0.9, 1.8, 2.7]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const x = jx + rad * Math.cos(a), y = jy + rad * Math.sin(a);
          if (biomeAt(Math.round(x), Math.round(y)) !== "water") { jx = x; jy = y; break outer; }
        }
      }
    }

    EXHIBITS.push({
      tx: jx, ty: jy,
      titleEn: j.title, title: kioskTitle(j.title),
      accent: j.accent || mixHex(gates[0].ex.accent, gates[1].ex.accent, 0.5),   // one colour, for painters that need one
      accentA: gates[0].ex.accent, accentB: gates[1].ex.accent,                   // the two ends, for the sign's gradient
      slot: 900 + k * 11,
      url: j.url, satellite: true, junction: true, visited: false,
    });

    for (const g of gates) {                                     // link each road's end to the shared house
      const a = Math.atan2(g.ex.ty - HY, g.ex.tx - HX), re = T.ringRadius + step * g.sats;
      paveLine(HX + re * Math.cos(a), HY + re * Math.sin(a), jx, jy);
    }
  }
}

/* ----------------------------------------------------------------------------
   7. INPUT
   -------------------------------------------------------------------------- */

function wireInput() {
  window.addEventListener("resize", scheduleResize);
  window.addEventListener("orientationchange", scheduleResize);
  if (window.visualViewport && window.visualViewport.addEventListener) window.visualViewport.addEventListener("resize", scheduleResize);
  canvas.addEventListener("pointerup", onCanvasPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { keys.up = keys.down = keys.left = keys.right = false; });
  canvas.addEventListener("pointerdown", onPointer);
  canvas.tabIndex = -1;
  startBtn.addEventListener("click", () => startGame(true));
  byId("mh-cardClose").addEventListener("click", closeCard);
  byId("mh-cardBack").addEventListener("click", () => { if (openIndex >= 0) renderCard(openIndex); });
  cardEl.addEventListener("click", (e) => { if (e.target === cardEl) closeCard(); });
  compassEl.addEventListener("click", recallHome);
  byId("mh-menu").addEventListener("click", toggleMenu);
  if (CONTENT && CONTENT.view3d) { const v = byId("mh-view3d"); v.classList.remove("mh-hidden"); v.addEventListener("click", openView3d); }
  buildToggleEl.addEventListener("click", toggleBuild);
  buildbarEl.addEventListener("click", onBuildTool);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  // any click or tap's end is a gesture a browser lets start sound (iOS Safari wants one of these)
  for (const ev of ["click", "touchend"]) window.addEventListener(ev, () => { audio.ensure(); audio.resume(); }, { passive: true });
  window.addEventListener("mh-musebots-ready", () => {
    if (!window.MH_MUSEBOTS) return;
    window.MH_MUSEBOTS.restore(BUILDINGS);
    window.MH_MUSEBOTS.updateListener?.(player.x, player.y, P, BUILDINGS);
  });
  // The Musebot picker covers the build toolbar while it is open. Its explicit
  // “Done building” action closes that modal and exits build mode in one step.
  window.addEventListener("mh-signal-finish-build", () => {
    if (buildMode) toggleBuild();
  });
}

/** @param {KeyboardEvent} e */
function onKeyDown(e) {
  const k = e.key.toLowerCase();
  audio.ensure(); audio.resume();                   // a key is a gesture: sound may start now
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.unlock) window.MH_MUSEBOTS.unlock();
  if (mode === "intro") {
    if (!startBtn.disabled && ["enter", " ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); startGame(true); }
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
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) used.walk = true;
  if (k === " ") used.next = true;
  if (k === "g" || k === "h") used.plaza = true;
  if (k === "m") used.mute = true;
  if (k === " ") { navTo((CONTENT && CONTENT.home) || 0); return; }   // Space → the About kiosk
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) auto.active = false;
  if (k === "w" || k === "arrowup") keys.up = true;
  else if (k === "s" || k === "arrowdown") keys.down = true;
  else if (k === "a" || k === "arrowleft") keys.left = true;
  else if (k === "d" || k === "arrowright") keys.right = true;
  else if (k === "e") { if (activeIndex >= 0) openCard(activeIndex); }
  else if (k === "enter") { navTo((CONTENT && CONTENT.home) || 0); }   // Enter → the About kiosk
  else if (k === "g" || k === "h") { if (T.wayfinding.recall) recallHome(); }
  else if (k === "c") { avatarIndex = (avatarIndex + 1) % T.avatarColors.length; sfx.pick(); toast(tr("world.colour", "Colour {n}", { n: avatarIndex + 1 })); }
  else if (k === "m") { audio.setMuted(!audio.muted); toast(audio.muted ? tr("world.soundOff", "Sound off") : tr("world.soundOn", "Sound on")); }
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
  e.preventDefault();
  audio.ensure(); audio.resume();
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.unlock) window.MH_MUSEBOTS.unlock();
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (buildMode) { buildPointerDown(sx, sy); return; }           // build mode: edit buildings, don't walk
  const ki = kioskAtScreen(sx, sy);
  if (ki >= 0) { tapDown = { sx, sy, ki }; return; }             // a kiosk: OPEN on pointerUP (browsers allow another site's new tab from pointerup/click, NOT pointerdown — fixes the iOS/Firefox block)
  tapDown = null;
  const decor = decorAtScreen(sx, sy);
  if (decor >= 0) {
    const building = BUILDINGS[decor], tool = building && toolOf(building.type);
    if (tool && tool.tap && tool.tap(building)) return;
    say(tr("world.tip.build", "I can move that: press B, for Build."), 3.4); return;
  }
  const w = screenToWorld(sx, sy); auto.active = true; auto.goal = -1; auto.warp = false; auto.tx = w.x; auto.ty = w.y; auto.lastDist = Infinity; auto.stuck = 0;
  used.tap = true;
}
/** Canvas pointer-UP: open a tapped kiosk HERE. iOS Safari & Firefox only honour window.open from a
 *  pointerup/click/touchend gesture, not pointerdown, so another site's new tab must open on release. */
function onCanvasPointerUp(e) {
  audio.ensure(); audio.resume();                   // iOS Safari starts audio on a tap's release, not its touch-down
  if (buildMode || mode !== "walking") { tapDown = null; return; }
  const td = tapDown; tapDown = null;
  if (!td || td.ki < 0) return;
  let moved = 0;
  try { const r = canvas.getBoundingClientRect(); moved = Math.hypot((e.clientX - r.left) - td.sx, (e.clientY - r.top) - td.sy); } catch (_) { /* ignore */ }
  if (moved < 18) warpAndOpen(td.ki);                            // a tap (not a drag) on a kiosk → warp the slime there + open it (in this pointerup gesture)
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
  toast(tr("world.heading", "Heading back to the plaza"));
}

/** Land in the world. Sound is only started from a gesture (the Enter button or
 *  a key): browsers refuse an AudioContext made before one and say so in the
 *  console on every load, and the site lands straight in the world without any. */
function startGame(gesture) {
  if (gesture) { audio.ensure(); audio.resume(); sfx.open(2); }
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.unlock) window.MH_MUSEBOTS.unlock();
  introEl.classList.add("mh-hidden"); hudEl.classList.remove("mh-hidden");
  mode = "walking"; last = performance.now();
  startTips();
}

/** Toggle the building menu (the nav-bar of buildings) open — reachable any time,
 *  which is how you navigate on a phone without having to wander off-screen. */
function toggleMenu() { menuOpen = !menuOpen; const el = document.getElementById("mh-menu"); if (el) el.classList.toggle("mh-on", menuOpen); sfx.nav(); }

/* --- build mode: rearrange the buildings + add decorative ones (persisted) --- */
function toggleBuild() {
  buildMode = !buildMode; buildTool = "move"; drag = null; tapDown = null;
  if (buildbarEl) buildbarEl.classList.toggle("mh-faded", !buildMode);
  if (buildToggleEl) buildToggleEl.classList.toggle("mh-on", buildMode);
  refreshBuildTools();
  if (buildMode) say(tr("world.tip.building", "I can build: drag a building to move it, or pick a tool."), 4);
  else toast(tr("world.buildOff", "Build mode off"));
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
let _eraserCursor = null;
const _buildCursors = {};
/** A pink-eraser cursor (data-URI SVG) for the Remove tool, built once. Falls back to crosshair
 *  where encodeURIComponent is unavailable (headless selftest). */
function eraserCursor() {
  if (_eraserCursor != null) return _eraserCursor;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><g transform="rotate(-40 13 13)"><rect x="4" y="10" width="17" height="9" rx="2.5" fill="#f3a6c1" stroke="#1b1b1b" stroke-width="1.7"/><path d="M13 10V19" stroke="#1b1b1b" stroke-width="1.5"/></g></svg>';
  _eraserCursor = (typeof encodeURIComponent === "function")
    ? "url('data:image/svg+xml," + encodeURIComponent(svg) + "') 6 19, crosshair"
    : "crosshair";
  return _eraserCursor;
}
/** Compact structure silhouette: clicking will place this tool. */
function placementCursor(tool) {
  if (_buildCursors[tool]) return _buildCursors[tool];
  const def = toolOf(tool), glyph = (def && def.glyph) || '<circle cx="15" cy="15" r="6" fill="#ffd37a" stroke="#17202a" stroke-width="2"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${glyph}</svg>`;
  return _buildCursors[tool] = typeof encodeURIComponent === "function"
    ? `url('data:image/svg+xml,${encodeURIComponent(svg)}') 15 28, pointer`
    : "pointer";
}
/** Show the active build tool on the CURSOR (not an icon): Move → grab/grabbing, Remove → an eraser;
 *  other tools and build-off restore the default. */
function updateBuildCursor() {
  if (!canvas || !canvas.style) return;
  let c = "";
  if (buildMode) {
    if (buildTool === "move") c = drag ? "grabbing" : "grab";
    else if (buildTool === "delete") c = eraserCursor();
    else if (toolOf(buildTool)) c = placementCursor(buildTool);
  }
  canvas.style.cursor = c;
}
function buildPointerDown(sx, sy) {
  if (buildTool === "move") {
    const k = kioskAtScreen(sx, sy); if (k >= 0) { drag = { kind: "kiosk", i: k }; updateBuildCursor(); return; }
    const d = decorAtScreen(sx, sy); if (d >= 0) { drag = { kind: "decor", i: d }; updateBuildCursor(); }
  } else if (toolOf(buildTool)) {
    const tool = toolOf(buildTool);
    const w = screenToWorld(sx, sy), tx = wrap(Math.round(w.x)), ty = wrap(Math.round(w.y));
    if (buildingAt(tx, ty) || EXHIBITS.some((e) => wrap(e.tx) === tx && wrap(e.ty) === ty)) { toast(tr("world.occupied", "Something is already built here")); return; }   // one structure per tile
    const building = { tx, ty, type: buildTool };
    if (tool.place) tool.place(building);
    BUILDINGS.push(building); saveLayout(); sfx.pick(); window.MH_ISO.refreshObstacles();
    if (tool.placed) tool.placed(building);
  } else if (buildTool === "delete") {
    const d = decorAtScreen(sx, sy); if (d >= 0) {
      const building = BUILDINGS[d], tool = building && toolOf(building.type);
      if (tool && tool.remove) tool.remove(building);
      BUILDINGS.splice(d, 1); saveLayout(); sfx.close(); window.MH_ISO.refreshObstacles();
    }
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
    const top = (toolOf(b.type) || {}).hitTop || 44;
    if (sx >= c.x - 28 && sx <= c.x + 28 && sy >= c.y - top && sy <= c.y + 12) { const d = b.tx + b.ty; if (d > best) { best = d; pick = i; } }
  }
  return pick;
}
/** The layout changed. It is a per-session sandbox (see buildHub), so nothing is
 *  written to storage; only the tower bundle, which encodes towers in the URL, is told. */
function saveLayout() {
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.reflect) window.MH_MUSEBOTS.reflect(BUILDINGS);
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
    if (!auto.warp && ecoActive() && window.MH_ECO.bodies) {   // creatures are solid: you cannot walk through a zoog
      window.MH_ECO.bodies((wx, wy, rad) => {
        const bx = nearImg(wx, nx), by = nearImg(wy, ny);
        let ox = nx - bx, oy = ny - by; const d = Math.hypot(ox, oy);
        if (d < rad) { if (d < 1e-4) { ox = 1; oy = 0; } nx = bx + (ox / (d || 1)) * rad; ny = by + (oy / (d || 1)) * rad; }
      });
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
    if (performance.now() - lastPlayerShareAt > 500) reflectPlayerInURL();
    // one step at each crest of the walking beat (sin(tnow * 12)), about twice a second: counted
    // by the beat's phase, so a slow frame that jumps over the crest still takes its step
    const stride = Math.floor((tnow * 12 - Math.PI / 2) / (2 * Math.PI));
    if (player.moving && stride !== strideWas) sfx.step();
    strideWas = stride;
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
  if (window.MH_MUSEBOTS && window.MH_MUSEBOTS.updateListener)
    window.MH_MUSEBOTS.updateListener(player.x, player.y, P, BUILDINGS);
  if (playerWasMoving && !player.moving) reflectPlayerInURL();
  playerWasMoving = player.moving;
}

/* ----------------------------------------------------------------------------
   9. RENDER
   -------------------------------------------------------------------------- */

function loop(ts) {
  let dt = (ts - last) / 1000; if (!(dt > 0)) dt = 0; else if (dt > 0.05) dt = 0.05;
  const perf = window.MH_PERF;
  if (perf) perf.mark("frame", ts - last);
  last = ts; tnow = ts / 1000;
  frameMs += ((dt * 1000) - frameMs) * 0.1;                 // smoothed frame time (no effect on capable machines)
  // Adaptive scenery degrade WITH HYSTERESIS: step the skip UP only when clearly slow and DOWN only
  // when clearly recovered, with a wide dead-band between. A plain threshold (frameMs>46?2:>31?1:0)
  // toggled every frame when the frame time sat near a cutoff, flipping props on/off — the "flickering
  // plants" (and it persisted across a theme switch because perfSkip is global). One step per frame.
  if (perfSkip < 2 && frameMs > (perfSkip === 0 ? 33 : 48)) perfSkip++;
  else if (perfSkip > 0 && frameMs < (perfSkip === 2 ? 38 : 24)) perfSkip--;
  const updateStart = perf ? performance.now() : 0;
  if (mode === "walking") update(dt);
  if (perf) perf.mark("update", performance.now() - updateStart);
  const renderStart = perf ? performance.now() : 0;
  render(); updateHUD();
  if (perf) perf.mark("canvas", performance.now() - renderStart);
  requestAnimationFrame(loop);
}

let waterImg = null, waterReady = false, waterFailed = false;
/** Slimeverse water zones reveal one stretched water photo (a screen-fixed backdrop). Loaded ONCE;
 *  guarded so the headless selftest (no Image) and a missing asset both fall back to the themed water. */
function ensureWaterImg() {
  if (waterImg || waterFailed || typeof Image === "undefined") return;
  waterImg = new Image();
  waterImg.onload = () => { waterReady = true; };
  waterImg.onerror = () => { waterFailed = true; };   // one-shot: never re-request a missing asset every frame
  waterImg.src = ((window.MH_SITE && window.MH_SITE.base) || "") + "water.webp";
}
let waterTex = null, waterPat = null, waterTexKey = "";
/** Pre-stretch the water photo (overscanning every edge) into a screen-sized offscreen ONCE per size,
 *  so per-frame we just FILL the pond blobs from it — no per-frame rescale, clip, or filter. */
function ensureWaterTex() {
  if (!waterReady || !waterImg || typeof document === "undefined" || !document.createElement) return null;
  const key = Math.round(W) + "x" + Math.round(H);
  if (waterTex && waterTexKey === key) return waterTex;
  if (!waterTex) waterTex = document.createElement("canvas");
  waterTex.width = Math.max(1, Math.round(W)); waterTex.height = Math.max(1, Math.round(H));
  const wc = waterTex.getContext("2d"), ox = W * 0.12, oy = H * 0.12;
  wc.clearRect(0, 0, waterTex.width, waterTex.height);
  wc.drawImage(waterImg, -ox, -oy, W + ox * 2, H + oy * 2);
  waterTexKey = key; waterPat = null;
  return waterTex;
}
function render() {
  ensureWaterImg();
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
  const photoWater = waterReady && waterImg && T.biomes;   // swap the themed water fill for the stretched photo
  let waterCells = null;
  for (let s = sMin; s <= sMax; s++) {
    const a = Math.max(txMin, s - tyMax), b = Math.min(txMax, s - tyMin);
    for (let tx = a; tx <= b; tx++) {
      const ty = s - tx;
      const c = toScreen(tx, ty);
      if (c.x < -TILE_W || c.x > W + TILE_W || c.y < -TILE_H * 2 || c.y > H + TILE_H * 2) continue;
      const z = zoneAt(tx, ty);
      const biome = T.biomes ? biomeAt(tx, ty) : null;
      const isPhotoWater = photoWater && z.zone === "field" && biome === "water";
      if (!isPhotoWater) (T.paintGround || defPaintGround)(ctx, c.x, c.y, { zone: z.zone, n: z.n, tx, ty, t: tnow, biome });
      else (waterCells || (waterCells = [])).push(c.x, c.y, tx, ty);   // skip the themed fill; revealed via the photo below
      if (ecoOn && window.MH_ECO.groundTint) { const ti = window.MH_ECO.groundTint(tx, ty); if (ti) diamond(ctx, c.x, c.y, ti, null); }
    }
  }
  // water zones reveal the water photo: FILL each pond with the SAME organic blob shape as the ground
  // (rounded edges, not hard diamonds) from the pre-stretched, overscanned offscreen — cheap, and it
  // carries the saturation pulse (periodically more vivid/blue, like the About portrait's filter).
  if (waterCells) {
    const tex = ensureWaterTex();
    if (tex) {
      if (!waterPat) waterPat = ctx.createPattern(tex, "repeat");
      ctx.save(); ctx.beginPath();
      for (let i = 0; i < waterCells.length; i += 4) blobPath(ctx, waterCells[i], waterCells[i + 1], waterCells[i + 2], waterCells[i + 3]);
      ctx.fillStyle = waterPat; ctx.fill();                                     // the photo: one cheap straight-copy fill
      const blue = 0.17 * (1 - Math.cos(tnow * (Math.PI * 2 / 30)));            // periodically MORE BLUE (0 ↔ 0.34 over 30s)
      ctx.fillStyle = "rgba(30,130,175," + blue.toFixed(3) + ")"; ctx.fill();   // a cheap wash REUSING the path — no ctx.filter, no rebake
      ctx.restore();
    }
  }

  if (T.fluidGround) drawFluidZones();           // smooth plaza + roads over the blobby field (no grid)

  // ---- actor pass: props + signposts + monument + kiosks + player, depth-sorted ----
  /** @type {{depth:number, draw:()=>void}[]} */ const actors = [];
  const prepareStart = window.MH_PERF ? performance.now() : 0;
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
    actors.push({ depth: kx + ky, draw: () => { if (T.kioskGlow !== false) drawKioskGlow(c.x, c.y, ex, active); const st = ex.structure && STRUCTURES.get(ex.structure); if (st) st(ctx, c.x, c.y, ex, active, { t: tnow, index: i, biome }); else (T.paintKiosk || defPaintKiosk)(ctx, c.x, c.y, ex, active, { t: tnow, index: i, biome }); if (ex.underConstruction) drawUnderConstruction(ctx, c.x, c.y, ex); } });
  }
  // player
  {
    const c = toScreen(player.x, player.y);
    actors.push({ depth: player.x + player.y, draw: () => drawAvatar(c.x, c.y) });
  }
  // ecology entities (optional layer; see ecology.js / window.MH_ECO)
  if (ecoOn && window.MH_ECO.actors) window.MH_ECO.actors((depth, drawFn) => actors.push({ depth, draw: () => drawFn(ctx) }), ECO_API);
  actors.sort((p, q) => p.depth - q.depth);
  if (window.MH_PERF) {
    window.MH_PERF.mark("prepare", performance.now() - prepareStart);
    window.MH_PERF.mark("actors", actors.length);
  }
  for (const a of actors) a.draw();

  if (T.darkness) {                                     // gloom: ONE multiply by a dark MAP, bright inside the slime's view-cone AND at each bauble, so the
    ensureDarkCv();                                     // cone REVEALS the true scene (no glare) and the labels stay readable — cheap: no second pass over the world
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = "source-over";
    dctx.fillStyle = "#242424"; dctx.fillRect(0, 0, darkCv.width, darkCv.height);   // deep dark, but a touch of bioluminescence still reads through
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0); dctx.globalCompositeOperation = "lighter";
    for (const ex of EXHIBITS) {                        // keep each kiosk's BAUBLE legible even when the slime isn't looking at it
      const c = toScreen(nearImg(ex.tx, player.x), nearImg(ex.ty, player.y));
      if (c.x < -90 || c.x > W + 90 || c.y < -160 || c.y > H + 90) continue;
      const tr2 = ex.tagRect;                           // the under-construction tag is a lit sign too
      if (tr2) {
        const sp = revealSprite(tr2.w + 6, tr2.h + 6, "tag");
        dctx.drawImage(sp.cv, tr2.x - 3 - sp.pad, tr2.y - 3 - sp.pad, sp.w, sp.h);
      }
      const sr = ex.signRect;
      if (sr) {                                         // reveal a patch the SHAPE of the sign (a soft rounded-rect), not a round halo
        const sp = revealSprite(sr.w + 8, sr.h + 8, "sign");
        dctx.drawImage(sp.cv, sr.x - 4 - sp.pad, sr.y - 4 - sp.pad, sp.w, sp.h);
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
  drawSlimeSay();
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
const _reveals = new Map();
/** A lit patch the shape of a sign, its blur baked ONCE per size. The darkness
 *  pass used to blur these live, under the "lighter" composite the dark map is
 *  built with, and a canvas without a GPU pays that blur over the whole frame
 *  for every sign, every frame: seconds a frame in headless Chrome, and a real
 *  cost on any machine drawing in software. A sprite is one drawImage. */
function revealSprite(w, h, kind) {
  const key = kind + ":" + Math.round(w) + "x" + Math.round(h) + "@" + dpr;
  let sp = _reveals.get(key);
  if (sp) return sp;
  const pad = kind === "tag" ? 26 : 32, W2 = Math.ceil(w + pad * 2), H2 = Math.ceil(h + pad * 2);
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(W2 * dpr); cv.height = Math.ceil(H2 * dpr);
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (kind === "tag") {
    c.shadowColor = "rgba(255,236,170,0.9)"; c.shadowBlur = 22; c.fillStyle = "rgba(255,240,190,0.92)";
    c.fillRect(pad, pad, w, h);
  } else {
    c.shadowColor = "rgba(255,255,255,0.85)"; c.shadowBlur = 26; c.fillStyle = "rgba(255,255,255,0.9)";
    const x = pad, y = pad, r = 8;
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  sp = { cv, pad, w: W2, h: H2 };
  if (_reveals.size > 80) _reveals.clear();              // sizes drift with the words; never let this grow
  _reveals.set(key, sp);
  return sp;
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
  avatarAt.x = sx; avatarAt.y = sy;
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
/** Append ONE organic tile-blob as a subpath (no begin/fill): the rounded shape the field, plaza,
 *  roads, AND the water ponds all share. Seeded by (tx,ty) so it's stable per tile (no flicker). */
function blobPath(g, sx, sy, tx, ty) {
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, j = 0.86 + hash01(tx * 7 + i * 3, ty * 5 + i * 2) * 0.3; pts.push([sx + Math.cos(a) * 53 * j, sy + Math.sin(a) * 29 * j]); }
  g.moveTo((pts[N - 1][0] + pts[0][0]) / 2, (pts[N - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < N; i++) { const n = (i + 1) % N; g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[n][0]) / 2, (pts[i][1] + pts[n][1]) / 2); }
  g.closePath();
}
function groundBlob(g, sx, sy, col, tx, ty) {
  g.fillStyle = col; g.beginPath(); blobPath(g, sx, sy, tx, ty); g.fill();
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

/** The slime's speech bubble, over its head, as the 3D village draws it (verse3d.js
 *  bubble): white, inked, rounded, with a tail, the words in as many lines as keep
 *  it inside the view. Drawn after the night's darkness, so it can be read. */
function drawSlimeSay() {
  if (!slimeSay || mode !== "walking") return;
  const age = tnow - slimeSay.t0, left = slimeSay.len - age;
  if (left <= 0) { slimeSay = null; return; }
  const a = Math.max(0, Math.min(1, age * 8, left * 4)), px = 15, hop = (1 - Math.min(1, age * 6)) * px * 0.4;
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = "700 " + px + "px 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
  const maxW = Math.min(W * 0.86, 440), lines = [];
  let line = "";
  for (const word of slimeSay.text.split(" ")) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > maxW - px * 1.1) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  const lh = px * 1.22, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + px * 1.1, h = lh * lines.length + px * 0.38;
  const sx = avatarAt.x, py = avatarAt.y - 34, x0 = Math.max(6, Math.min(W - w - 6, sx - w / 2)), y0 = py - h - px * 0.6 - hop;
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#111111"; ctx.lineWidth = Math.max(1.2, px * 0.1);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, Math.min(h * 0.45, px * 0.72)) : ctx.rect(x0, y0, w, h);
  ctx.moveTo(sx - px * 0.3, y0 + h); ctx.lineTo(sx - px * 0.05, y0 + h + px * 0.55); ctx.lineTo(sx + px * 0.25, y0 + h);   // its tail
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(sx - px * 0.25, y0 + h - ctx.lineWidth, px * 0.46, ctx.lineWidth * 1.5);   // open the bubble into its tail
  ctx.fillStyle = "#111111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x0 + w / 2, y0 + px * 0.19 + lh * (i + 0.5)));
  ctx.restore();
}
/** The slime says something, in the first person, for secs seconds. */
function say(text, secs) { slimeSay = { text: String(text), t0: tnow, len: secs || 3.4 }; }

/* The slime says what it can do: brief tips in the first person, one at a time from
   a moment after the world opens, each skipped once the visitor has done it; a phone
   gets its own. Once a visit (sessionStorage), so switching views does not repeat
   them. The same words stand in the HUD (#mh-tips, out of sight) for a screen reader. */
function tipList() {
  const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  if (touch) return [
    ["tap", "world.tip.tap", "I can go where you tap."],
    ["open", "world.tip.openTap", "I can open a house: tap it."],
  ];
  return [
    ["walk", "world.tip.walk", "I can walk: the arrow keys, or WASD."],
    ["tap", "world.tip.click", "I can go where you click."],
    ["open", "world.tip.open", "I can open a house: press E beside it, or click it."],
    ["next", "world.tip.next", "I can visit the next house: press Space."],
  ].concat(T.wayfinding.recall ? [["plaza", "world.tip.plaza", "I can go back to the plaza: press G."]] : [])
   .concat([["mute", "world.tip.mute", "I can go quiet: press M."]]);
}
function writeTips() { const el = document.getElementById("mh-tips"); if (el) el.textContent = tipList().map(([, key, en]) => tr(key, en)).join(" "); }
let tipsStarted = false;
function startTips() {
  if (tipsStarted) return; tipsStarted = true;
  writeTips(); document.addEventListener("mh:lang", writeTips);
  try { if (window.sessionStorage && sessionStorage.getItem("mh-tips-iso")) return; sessionStorage.setItem("mh-tips-iso", "1"); } catch (e) { /* private: tell them anyway */ }
  const tips = tipList();
  let i = 0;
  const next = () => {
    while (i < tips.length && used[tips[i][0]]) i++;
    if (i >= tips.length) return;
    const [, key, en] = tips[i++];
    if (mode === "walking" && !buildMode) say(tr(key, en), 3.4);
    setTimeout(next, 4100);
  };
  setTimeout(next, 1600);
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
  progressEl.textContent = tr("world.progress", "{v} / {n} seen", { v: v, n: EXHIBITS.length });

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
}

/* ----------------------------------------------------------------------------
   10. CARD MODAL  — themed content card (trusted inline HTML from content.js)
   -------------------------------------------------------------------------- */

let leaving = false;                    // a page of the site is about to open in this tab
/** Note this village's address (with the slime's spot) for the tab, so a page opened from it can send the visitor back. */
function rememberReturn() { try { if (window.sessionStorage) sessionStorage.setItem("mh-return", location.href); } catch (e) { /* private: they go to the plaza */ } }
/** Is this a page of the site itself (a relative link, or this origin)? @param {string} url */
function sameSite(url) { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } }
/** Open a page the house opens: About, the CV, the Toolbox, the Music/Games menus, the
 *  road-houses. A page of this site opens in THIS tab (the address is brought up to the
 *  slime's spot first, so Back returns to it); another site opens in a new tab. Nothing
 *  is shown in an in-world iframe. @param {string} url */
function openPage(url) {
  if (window.MH_I18N) url = window.MH_I18N.href(url);   // French mode opens the French page
  // (after a quarter second, so the house's opening chime is heard: going at once cut it off)
  // (the page it opens can send the visitor back here, to this spot: the Glossary's light does)
  if (sameSite(url)) { reflectPlayerInURL(); rememberReturn(); if (!leaving) { leaving = true; setTimeout(() => { location.href = url; leaving = false; }, 260); } return; }
  // a plain new TAB: no features string (a features string makes Safari treat it as a blockable
  // popup window). Must be called SYNCHRONOUSLY from a user gesture or iPad/iPhone will block it.
  try { const w = window.open(url, "_blank"); if (w) { try { w.opener = null; } catch (e) { /* _blank is noopener by default on modern browsers */ } } }
  catch (e) { /* headless / blocked: ignore */ }
}

/** @param {number} i exhibit index */
function openCard(i) {
  const ex = EXHIBITS[i];
  used.open = true;
  if (ex.satellite) {                              // a road-house opens its OWN link (no iframe)
    ex.visited = true; currentTarget = i; sfx.open(0);
    openPage(ex.url);
    return;
  }
  const k = CONTENT.kiosks[i], page = k && k.page;
  if (page && page.url) {                          // About / CV / Toolbox → open the real page, never framed
    ex.visited = true; currentTarget = i; sfx.open(i);
    openPage(page.url);
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
 *  kiosk (those open their page). The Music/Games TOC and any prose kiosk open as a
 *  card, so card-browse cycles only through those. @param {number} i */
function opensAsCard(i) {
  const ex = EXHIBITS[i]; if (!ex || ex.satellite) return false;
  const k = CONTENT.kiosks[i], page = k && k.page;
  return !(page && page.url);
}
function renderCard(i) {
  const k = CONTENT.kiosks[i];
  cardTitleEl.textContent = kioskTitle(k.title);
  byId("mh-cardInner").style.setProperty("--mh-card-accent", EXHIBITS[i].accent);  // accent → kiosk colour
  showCardBack(false);
  const page = k.page;
  if (page && page.toc) {                         // a table-of-contents kiosk → the dropdown menu (a site page in this tab, another site in a new one)
    setCardWide(false); setCardClean(true);
    renderToc(page);
  } else {                                        // the themed prose card
    setCardWide(false); setCardClean(false);
    cardBodyEl.innerHTML = tr("kiosk." + k.title + ".html", k.html || "");
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

/** Render a Music/Games table of contents as a clean link menu: a page of this site
 *  opens in this tab, another site in a new one (no in-world iframe). @param {{toc:any[]}} page */
function renderToc(page) {
  const rows = (page.toc || []).map((it) =>
    `<a class="mh-toc-link" href="${window.MH_I18N ? window.MH_I18N.href(it.url) : it.url}"${sameSite(it.url) ? "" : ' target="_blank" rel="noopener"'}>${it.label}</a>`   // bare link, like the site's menubar dropdown
  ).join("");
  cardBodyEl.innerHTML = `<div class="mh-toc">${rows}</div>`;
  cardBodyEl.scrollTop = 0;
}

function closeCard() {
  sfx.close(); cardEl.classList.add("mh-hidden"); mode = "walking"; last = performance.now();
  auto.active = false; auto.warp = false;              // never let a queued move fire on close
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
  if (active) { roundRect(sx - 44, by - 38, 88, 24, 12, hexA(ex.accent, 0.95), null); g.fillStyle = "#06121f"; g.font = "700 12px " + uiFont(); g.fillText(tr("world.pressE", "Press E"), sx, by - 26); }
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
    window.MH_BUILD.paint(g, sx, sy, b, { t: env.t, biome: env.biome, theme: T.id, ink: T.avatarInk || "#3a3a3a", util: window.MH_ISO.util });
    return;
  }
  const ink = T.avatarInk || "#3a3a3a", s1 = hash01((b.tx * 7 + 3) | 0, (b.ty * 5 + 1) | 0), s2 = hash01((b.ty * 3 + 2) | 0, (b.tx * 9 + 4) | 0);
  if (b.type === "signal") {
    const state = window.MH_MUSEBOTS ? window.MH_MUSEBOTS.stateFor(b.uid) : { state: "unassigned" };
    shadow(g, sx, sy, 18);
    poly(g, [[sx - 12, sy], [sx, sy + 6], [sx + 12, sy], [sx, sy - 6]], "#26344a");
    g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx, sy - 64); g.stroke();
    g.strokeStyle = "#8ba4bd"; g.lineWidth = 2;
    for (let y = sy - 12; y >= sy - 58; y -= 12) { g.beginPath(); g.moveTo(sx - 8, y); g.lineTo(sx + 8, y); g.stroke(); }
    const live = state.state === "playing" || state.state === "ready", pulse = Math.max(0, Math.min(1, state.beat || 0));
    g.fillStyle = live ? "#7afcff" : "#c890ff"; g.shadowColor = g.fillStyle; g.shadowBlur = live ? 18 : 8;
    g.beginPath(); g.arc(sx, sy - 70, 7 + pulse * 5, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    if (pulse > 0) { g.globalAlpha = pulse; g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy - 70, 12 + (1 - pulse) * 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
    return;
  }
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
/** The brand's leaf corner (brand/brand.css --leaf): a sweep top-left and
 *  bottom-right, near-square at the other two, as engine-3d.js draws it. `k`
 *  scales the corners (1: a board's, about half: a small tag's). Traces the
 *  path only; the caller fills and strokes. */
function leafPath(g, x, y, w, h, k = 1) {
  const Sx = Math.min(16 * k, w / 2), Sy = Math.min(7 * k, h / 2), sx = Math.min(4 * k, w / 2), sy = Math.min(2 * k, h / 2);
  const r = x + w, b = y + h;
  g.beginPath();
  g.moveTo(x + Sx, y);
  g.lineTo(r - sx, y); g.quadraticCurveTo(r, y, r, y + sy);
  g.lineTo(r, b - Sy); g.quadraticCurveTo(r, b, r - Sx, b);
  g.lineTo(x + sx, b); g.quadraticCurveTo(x, b, x, b - sy);
  g.lineTo(x, y + Sy); g.quadraticCurveTo(x, y, x + Sx, y);
  g.closePath();
}
function shadow(g, cx, cy, rx) { g.save(); g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
function label(g, text, x, y, size, color) {
  g.font = "700 " + size + "px " + uiFont(); g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.6)"; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
}
function toast(msg) { toastText = msg; toastUntil = tnow + 1.6; }
/* A canvas font string must be a REAL font shorthand: ctx.font = "13px var(--x)"
 * is invalid and is silently ignored, leaving whatever font was set last. So the
 * skins' display and UI faces are resolved here and handed to painters as plain
 * families. Cached per skin, since a painter asks every frame. */
let _fontCache = { key: "", ui: "", display: "" };
function _fonts() {
  const key = (T && T.id) || "";
  if (_fontCache.key !== key) {
    const cs = getComputedStyle(document.documentElement);
    _fontCache = {
      key,
      ui: cs.getPropertyValue("--mh-ui").trim() || "system-ui, sans-serif",
      display: cs.getPropertyValue("--mh-display").trim() || "",
    };
  }
  return _fontCache;
}
function uiFont() { return _fonts().ui; }
/** The skin's display face, for headings and kiosk numbers. Falls back to the UI face. */
function displayFont() { return _fonts().display || uiFont(); }

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
/** blend two #rrggbb by t, returning #rrggbb (mix() returns rgb(), which shade/hexA cannot re-read) */
function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
/** A kiosk that is not open yet says so on the map, not only in its card. Drawn
 *  over the skin's own kiosk so every world labels it identically: a hazard band
 *  and the words, at the foot of the sign. */
/** A WELLHEAD, for a kiosk whose page is underground: a gel collar round a black
 *  shaft, a domed cap on two bowed posts, a windlass, and a rope going down. It
 *  replaces the kiosk body rather than sitting on it, and every shape is rounded,
 *  because nothing in the slimeverse has a corner. Colours come from the
 *  exhibit's own accent and the skin's ink, so it suits all three skins. */
function drawWellhead(g, sx, sy, ex, active, env) {
  const ink = T.avatarInk || "#16261c", gel = ex.accent || "#4FA373";
  const t = (env && env.t) || 0, sway = reduce ? 0 : Math.sin(t * 0.9) * 2.2;
  shadow(g, sx, sy, 30);
  // the shaft: a hole, dark at its centre
  const hole = g.createRadialGradient(sx, sy - 6, 2, sx, sy - 6, 30);
  hole.addColorStop(0, "#050806"); hole.addColorStop(0.62, "#0b120d"); hole.addColorStop(1, shade(gel, -0.62));
  g.fillStyle = hole;
  g.beginPath(); g.ellipse(sx, sy - 6, 30, 13, 0, 0, Math.PI * 2); g.fill();
  // the collar: a gel ring of rounded lobes, lit from above
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, lx = sx + Math.cos(a) * 33, ly = sy - 6 + Math.sin(a) * 14.5;
    const lg = g.createLinearGradient(0, ly - 7, 0, ly + 6);
    lg.addColorStop(0, shade(gel, 0.24)); lg.addColorStop(1, shade(gel, -0.26));
    g.fillStyle = lg;
    g.beginPath(); g.ellipse(lx, ly, 8, 6.2, a, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.6; g.strokeStyle = ink; g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.3)";                          // a gel sheen on the near lobes
  g.beginPath(); g.ellipse(sx - 12, sy + 4, 7, 2.6, -0.3, 0, Math.PI * 2); g.fill();
  // two bowed posts and a domed cap
  g.lineCap = "round"; g.lineJoin = "round";
  for (const side of [-1, 1]) {
    g.strokeStyle = ink; g.lineWidth = 6.5;
    g.beginPath(); g.moveTo(sx + side * 24, sy - 12);
    g.quadraticCurveTo(sx + side * 27, sy - 40, sx + side * 20, sy - 56); g.stroke();
    g.strokeStyle = shade(gel, -0.1); g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(sx + side * 24, sy - 13);
    g.quadraticCurveTo(sx + side * 27, sy - 40, sx + side * 20, sy - 55); g.stroke();
  }
  const cap = g.createLinearGradient(0, sy - 82, 0, sy - 54);
  cap.addColorStop(0, shade(gel, 0.3)); cap.addColorStop(1, shade(gel, -0.22));
  g.fillStyle = cap;
  g.beginPath();
  g.moveTo(sx - 30, sy - 54);
  g.quadraticCurveTo(sx, sy - 84, sx + 30, sy - 54);
  g.quadraticCurveTo(sx, sy - 46, sx - 30, sy - 54);
  g.closePath(); g.fill();
  g.lineWidth = 2; g.strokeStyle = ink; g.stroke();
  // the windlass, and the rope down the shaft
  g.strokeStyle = ink; g.lineWidth = 5;
  g.beginPath(); g.moveTo(sx - 21, sy - 47); g.lineTo(sx + 21, sy - 47); g.stroke();
  g.strokeStyle = shade(gel, 0.14); g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(sx - 20, sy - 47); g.lineTo(sx + 20, sy - 47); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(sx + 21, sy - 47); g.quadraticCurveTo(sx + 29, sy - 47 + sway, sx + 27, sy - 38 + sway); g.stroke();
  g.strokeStyle = "#d8cfa8"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(sx, sy - 45);
  g.quadraticCurveTo(sx + sway * 0.5, sy - 26, sx + sway * 0.3, sy - 8); g.stroke();
  // a little growth round the rim, so it belongs to the ground it sits in
  g.fillStyle = shade(gel, -0.34);
  for (let i = -2; i <= 2; i++) {
    g.beginPath(); g.ellipse(sx + i * 17, sy + 9, 7, 3, i * 0.2, 0, Math.PI * 2); g.fill();
  }
  // The sign is the skin's own, the same one every other house wears: each theme
  // exposes paintKioskSign, so the wellhead is labelled in that skin's format
  // rather than in one invented here. topY is the top of the cap: the curve's
  // apex at 69 above the base, not its control point at 84, or the skin's
  // connector hangs in the air short of the roof.
  const CAP_TOP = sy - 69;
  if (T.paintKioskSign) T.paintKioskSign(g, sx, CAP_TOP, ex, active, env || { t: 0 });
  else label(g, ex.title, sx, CAP_TOP - 8, 14, "#eef2f7");
}

registerStructure("wellhead", drawWellhead);

function drawUnderConstruction(g, sx, sy, ex) {
  const label = tr("world.underConstruction", "UNDER CONSTRUCTION");
  g.save();
  g.font = "800 10px " + uiFont();
  const w = Math.max(96, g.measureText(label).width + 16), h = 15, x = sx - w / 2, y = sy - 4;
  g.fillStyle = "#1a1a1a"; g.fillRect(x - 2, y - 2, w + 4, h + 4);          // ink plate, so it reads on any ground
  g.save();                                                                 // hazard stripes, kept inside the plate
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = "#f0b62a"; g.fillRect(x, y, w, h);
  g.fillStyle = "#1a1a1a";
  for (let i = 0; i < Math.ceil(w / 10) + 1; i++) {
    g.beginPath();
    g.moveTo(x + i * 10, y + h); g.lineTo(x + i * 10 + 5, y);
    g.lineTo(x + i * 10 + 10, y); g.lineTo(x + i * 10 + 5, y + h);
    g.closePath(); g.fill();
  }
  g.restore();
  g.fillStyle = "#1a1a1a"; g.fillRect(x, y + h * 0.28, w, h * 0.44);
  g.fillStyle = "#ffe08a"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, sx, y + h / 2 + 0.5);
  g.restore();
  // After dark the engine multiplies the whole scene toward black, so a sign has
  // to be listed as lit or it disappears. Stash the rect the same way the night
  // skin's marquee does; the gloom pass reveals both.
  if (ex) {
    const r = ex.tagRect || (ex.tagRect = { x: 0, y: 0, w: 0, h: 0 });
    r.x = x - 2; r.y = y - 2; r.w = w + 4; r.h = h + 4;
  }
}

/** A sign's fill. Normally the exhibit's accent, shaded light to dark. Where a
 *  junction joins two roads, a gradient running from one road's accent to the
 *  other's, so the sign says which two paths meet there. */
function accentFill(g, ex, x0, y0, w, h, lo, hi) {
  lo = lo == null ? 0.32 : lo; hi = hi == null ? -0.18 : hi;
  if (!ex.accentB || !ex.accentA) {
    const v = g.createLinearGradient(0, y0, 0, y0 + h);
    v.addColorStop(0, shade(ex.accent, lo)); v.addColorStop(1, shade(ex.accent, hi));
    return v;
  }
  const d = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
  d.addColorStop(0, shade(ex.accentA, lo));
  d.addColorStop(0.5, mixHex(ex.accentA, ex.accentB, 0.5));
  d.addColorStop(1, shade(ex.accentB, hi));
  return d;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function resize() {
  const ndpr = Math.min(window.devicePixelRatio || 1, 2);
  const nW = window.innerWidth, nH = window.innerHeight;
  if (nW === W && nH === H && ndpr === dpr) return;   // unchanged → skip the costly canvas-buffer realloc
  dpr = ndpr; W = nW; H = nH;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
/** On a phone the resize/orientationchange event fires before the viewport finishes rotating, so a
 *  single resize() can leave half the canvas unrendered. Re-measure now and again after it settles. */
function scheduleResize() { resize(); setTimeout(resize, 120); setTimeout(resize, 400); }

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
    // The world's chrome exists now: let i18n.js translate it, and redraw the
    // engine's own words whenever the visitor uses the switch.
    if (window.MH_I18N) {
      window.MH_I18N.apply();
      document.addEventListener("mh:lang", relabel);
    }
    startGame();          // no "enter" page — land straight in the world (audio wakes on first input)
    last = performance.now(); requestAnimationFrame(loop);
  }
}

/** Wrap a live swap in a View Transitions crossfade when available (and motion is
 *  allowed), so a skin change reads as the same object seen in different light. */
function requestSwitch(id) {
  if (!started || !REGISTRY.has(id) || id === (T && T.id)) return;
  const towersPlaying = !!(window.MH_MUSEBOTS && window.MH_MUSEBOTS.hasSounding && window.MH_MUSEBOTS.hasSounding());
  // Full-canvas View Transition snapshots can briefly starve real-time audio on
  // mobile, so switch immediately while Musebots are active.
  if (!towersPlaying && !reduce && document.startViewTransition) document.startViewTransition(() => switchTheme(id));
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
  _fontCache.key = "";                               // the new skin brings its own faces
  document.documentElement.style.background = T.bgCss; document.body.style.background = T.bgCss;
  EXHIBITS.forEach((ex, i) => { ex.accent = T.accents[i % T.accents.length]; });
  rebuildSpurs();                                  // grow or clear the Music/Games house-roads for the new world
  avatarIndex = avatarIndex % T.avatarColors.length;
  buildPicker(); if (navbarEl) buildNavbar(); refreshSwitcher();
  document.title = ((CONTENT && CONTENT.title) || "M. Reid Horrigan") + " · " + T.name;
  persistSkin(id); reflectSkinInURL(id); applyEcology();
  sfx.pick();
  toast(T.name);
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

/** Give real-time Musebots exclusive ownership of browser audio hardware. */
function setMusebotAudioActive(active, sharedContext) {
  const changed = audio.musebotsActive !== !!active;
  audio.musebotsActive = !!active;
  if (active && sharedContext) audio.ensure(sharedContext);
  if (changed && audio.master && audio.ctx)
    audio.master.gain.setTargetAtTime(audio.muted ? 0 : (active ? 0.9 : 0.5), audio.ctx.currentTime, 0.025);
}

/** Return the world's one AudioContext so optional audio systems can join it
 * without opening a competing context and interrupting sounds already playing. */
function sharedAudioContext() {
  audio.ensure();
  return audio.ctx;
}

/** Share the slime's unwrapped world position without disturbing theme or towers. */
function reflectPlayerInURL() {
  lastPlayerShareAt = performance.now();
  try {
    const u = new URL(location.href);
    u.searchParams.set("slime", `${Number(player.x.toFixed(3))},${Number(player.y.toFixed(3))}`);
    history.replaceState(history.state, "", u.href);
  } catch (_) { /* file URL or restricted history */ }
}

/** Old links have no slime parameter and retain the ordinary plaza spawn. A
 *  view handing the walk over (the 3D village) adds the way it faced, ?facing=fx,fy. */
function restorePlayerFromURL() {
  try {
    const q = new URL(location.href).searchParams, value = q.get("slime");
    if (!value) return;
    const [x, y] = value.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) {
      player.x = x; player.y = y;
    }
    const [fx, fy] = (q.get("facing") || "").split(",").map(Number), m = Math.hypot(fx, fy);
    if (m > 1e-6) { player.fx = fx / m; player.fy = fy / m; }
  } catch (_) { /* malformed or unavailable URL */ }
}

/** The same village in 3D (CONTENT.view3d), in this tab: the slime on the same
 *  spot, facing the same way, in this skin, as the 3D view's own switch comes back.
 *  The rest of the address rides along (the signal towers raised here, the
 *  language), so the way back finds them. */
function openView3d() {
  let q;
  try { q = new URL(location.href).searchParams; } catch (_) { q = new URLSearchParams(); }
  q.set("theme", SKIN_SHARE[T.id] || T.id); q.set("place", "village");
  q.set("slime", Number(player.x.toFixed(3)) + "," + Number(player.y.toFixed(3)));
  q.set("facing", Number(player.fx.toFixed(3)) + "," + Number(player.fy.toFixed(3)));
  const url = CONTENT.view3d + "?" + q.toString();
  location.href = window.MH_I18N && window.MH_I18N.href ? window.MH_I18N.href(url) : url;
}

/* Shareable theme links. Friendly public names (the ones the site uses out loud) map to the
   engine ids, so ?skin=gloomthmaxx / ?skin=bureaucore / ?skin=technurture all work. */
const SKIN_ALIAS = { bureaucore: "technocute", gloomthmaxx: "technoscure" };   // ?skin input → registry id
const SKIN_SHARE = { technocute: "bureaucore", technoscure: "gloomthmaxx" };   // registry id → friendly name shown in the URL
/** Resolve a skin id OR a friendly alias to a real registry id. @param {string} s */
function resolveSkin(s) { s = String(s == null ? "" : s).toLowerCase(); return SKIN_ALIAS[s] || s; }
/** Reflect the active skin in the address bar so the current theme is shareable by copying the URL.
   Only fires on a live switch (switchTheme), so a fresh time-of-day landing keeps a clean URL. */
function reflectSkinInURL(id) {
  try { const u = new URL(location.href); u.searchParams.set("theme", SKIN_SHARE[id] || id); history.replaceState(history.state, "", u.href); }
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
  // Reconfigure, do not reset: a change of skin should find the same creatures
  // standing where they stood. Only the skin's own atmosphere (fireflies, motes)
  // is brought to its new count.
  if (E.reconfigure) E.reconfigure();
  else if (E.reset) E.reset();
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
  get theme() { return T.id; },               // which skin is painting (the predator picks its palette)
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
  registerStructure, registerBuildTool,           // see 2a. REGISTRIES
  buildTools: () => BUILD_TOOLS.map((t) => t.id),
  setMusebotAudioActive,
  sharedAudioContext,
  siteAudioDiagnostics: () => ({
    contextState: audio.ctx?.state || "not-created",
    masterGain: Number(audio.master?.gain.value || 0),
    musebotsActive: audio.musebotsActive,
    muted: audio.muted,
  }),
  themes: () => [...REGISTRY.values()].map((t) => ({ id: t.id, name: t.name })),
  /** a read-only snapshot of what the world has placed: kiosks, their road-houses,
   *  and any junction house two roads share (see CONTENT.junctions) */
  /** a read-only snapshot of what visitors have built (signal towers and the rest):
   *  the 3D view stands the same things at the same tiles */
  buildings: () => BUILDINGS.map((b) => ({ type: b.type, uid: b.uid || null, tx: b.tx, ty: b.ty, botToken: b.botToken || "" })),
  /** the skin in use, by id */
  skin: () => T.id,
  /** Put the slime at a tile, facing (fx, fy): another view of the same world
   *  hands the walk back here, at the spot it reached. */
  placePlayer(x, y, fx, fy) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = wrap(x); player.y = wrap(y);
    const m = Math.hypot(fx || 0, fy || 0);
    if (m > 1e-6) { player.fx = fx / m; player.fy = fy / m; }
    // (the address catches up on the engine's own schedule: a view syncing every frame must not rewrite it every frame)
  },
  exhibits: () => EXHIBITS.map((e) => ({
    title: e.titleEn, tx: +e.tx.toFixed(2), ty: +e.ty.toFixed(2),
    satellite: !!e.satellite, junction: !!e.junction, url: e.url || null, structure: e.structure || null,
    underConstruction: !!e.underConstruction,
    signRect: e.signRect ? { x: e.signRect.x, y: e.signRect.y, w: e.signRect.w, h: e.signRect.h } : null,   // the board as last drawn, in CSS pixels
  })),
  pavedTiles: () => SPUR_TILES.size,
  player: () => ({ x: player.x, y: player.y, fx: player.fx, fy: player.fy }),   // read-only: where the slime is standing, and which way it faces
  saying: () => (slimeSay && tnow - slimeSay.t0 < slimeSay.len ? slimeSay.text : ""),   // read-only: the slime's words just now (its tips)
  reduced: () => reduce,
  hub: () => ({ x: HX, y: HY, period: P }),   // plaza centre (canonical tile) + torus period
  biome: biomeAt,                              // coarse biome for a canonical tile
  onWater,                                     // the same wading test the player uses
  /** Water under a BODY, not under a tile centre. onWater rounds to the nearest
   *  tile, so a creature at the rim of a pond tests wet while it stands on the
   *  grass that is drawn over that tile's edge: it splashed on dry ground. A
   *  body counts as in the water only when its footprint is inside one. */
  inWaterDeep: (x, y) => {
    if (!T.biomes) return false;
    const r = 0.38;
    return onWater(x, y) && onWater(x + r, y + r) && onWater(x - r, y - r)
        && onWater(x + r, y - r) && onWater(x - r, y + r);
  },
  /** A tile a body cannot walk into: a placed dwelling or growth, or a kiosk.
   *  The world's creatures slide along these; see world-bridge.js. */
  solidAt: (tx, ty) => buildingAt(tx, ty) || EXHIBITS.some((e) => wrap(Math.round(e.tx)) === wrap(tx) && wrap(Math.round(e.ty)) === wrap(ty)),
  /** Re-send the solid mask after the visitor builds or clears something. */
  refreshObstacles: () => { const b = window.MH_WASM && window.MH_WASM.worldBridge; if (b && b.sendSolid) b.sendSolid(); },
  util: { diamond, poly, roundRect, leafPath, shadow, label, shade, mix, mixHex, accentFill, hexA, clamp, hash01, noise01, wrap, wrapDelta, tr, uiFont, displayFont },
  get TILE() { return { W: TILE_W, H: TILE_H }; },
};

})();
