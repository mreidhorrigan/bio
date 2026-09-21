// @ts-check
"use strict";
/* assets.js — a harness that displays every drawn asset of the iso world.
 *
 * Unlike isometric.js and widget.js (which COPY their painter so the view is
 * self-contained), this file copies nothing that draws. It stubs the small
 * environment the painters expect — window.MH_ISO.util, .reduced, .biome,
 * .register — and then assets.html loads the CANONICAL sources by relative
 * path:
 *
 *     ../../theme-technocute.js    kiosks, monument, signposts, ground (bureaucore)
 *     ../../theme-technurture.js   the same, plus flora, for the daylight slimeworld
 *     ../../theme-technoscure.js   the same, after nightfall
 *     ../../buildings.js           houses, alien growths, signal towers
 *     ../../ecology.js             motes, fireflies, grazers, predators
 *
 * So the gallery cannot drift from the site: it IS the site's code, drawn on
 * small canvases instead of one big one. Only the harness below is a copy, and
 * only of engine.js's toolbox (hash01, noise01, shade, mix, mixHex, accentFill,
 * hexA, poly, roundRect, diamond, shadow, label, clamp, wrap, wrapDelta, tr) and its biome
 * field. Keep those in step with engine.js if they ever change.
 *
 * Two couplings worth knowing, both mirrored faithfully here:
 *   • engine.js's roundRect ignores its context argument and draws to the
 *     engine's own canvas. The harness binds it to whichever panel is painting.
 *   • diamond() uses the tile size, which every skin sets to 96×48.
 */
(function () {
  const TILE_W = 96, TILE_H = 48;   // all three skins: theme.tileW / theme.tileH
  const P = 56;                     // torus period, as engine.js
  const REGISTRY = new Map();
  let target = null;                // the context roundRect() draws into (see above)

  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---- engine.js toolbox, copied verbatim ------------------------------- */
  function wrap(v) { return ((v % P) + P) % P; }
  function wrapDelta(d) { d = ((d % P) + P) % P; return d > P / 2 ? d - P : d; }
  function hash01(a, b) {
    let h = (wrap(a) * 374761393 + wrap(b) * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  }
  function noise01(tx, ty, freq) {
    const fx = tx / freq, fy = ty / freq;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), rx = fx - x0, ry = fy - y0;
    const s = (t) => t * t * (3 - 2 * t);
    const ux = s(rx), uy = s(ry);
    const n00 = hash01(x0, y0), n10 = hash01(x0 + 1, y0), n01 = hash01(x0, y0 + 1), n11 = hash01(x0 + 1, y0 + 1);
    return (n00 * (1 - ux) + n10 * ux) * (1 - uy) + (n01 * (1 - ux) + n11 * ux) * uy;
  }
  function biomeAt(tx, ty) {
    const e = noise01(tx + 7, ty + 7, 12), m = noise01(tx + 313, ty - 211, 9);
    if (e < 0.30) return "water";
    if (e < 0.37) return "sand";
    if (e > 0.78) return m < 0.4 ? "stone" : "snow";
    if (m < 0.33) return "dry";
    if (m > 0.66) return "forest";
    return "grass";
  }
  function diamond(g, cx, cy, fill, stroke) {
    g.beginPath();
    g.moveTo(cx, cy - TILE_H / 2); g.lineTo(cx + TILE_W / 2, cy); g.lineTo(cx, cy + TILE_H / 2); g.lineTo(cx - TILE_W / 2, cy); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }
  function poly(g, pts, fill) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } }
  function roundRect(x, y, w, h, r, fill, stroke) {
    const c = target; if (!c) return;
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  function shadow(g, cx, cy, rx) { g.save(); g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  function uiFont() { return getComputedStyle(document.documentElement).getPropertyValue("--mh-ui").trim() || "system-ui, sans-serif"; }
  function label(g, text, x, y, size, color) {
    g.font = "700 " + size + "px " + uiFont(); g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.6)"; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (f - r) * p); gg = Math.round(gg + (f - gg) * p); b = Math.round(b + (f - b) * p);
    return `rgb(${r},${gg},${b})`;
  }
  function mix(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function mixHex(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
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
  function tr(key, english) { return english; }   // the gallery is English-only

  /* ---- the stub the canonical files load against ------------------------ */
  window.MH_ISO = {
    register(theme) { if (theme && theme.id) REGISTRY.set(theme.id, theme); },
    themes: () => [...REGISTRY.values()].map((t) => ({ id: t.id, name: t.name })),
    reduced: () => reduce,
    hub: () => ({ x: P / 2, y: P / 2, period: P }),
    biome: biomeAt,
    onWater: (x, y) => biomeAt(Math.round(x), Math.round(y)) === "water",   // engine.js also excludes the plaza; the gallery has none
    util: { diamond, poly, roundRect, shadow, label, shade, mix, mixHex, accentFill, hexA, clamp, hash01, noise01, wrap, wrapDelta, tr },
    get TILE() { return { W: TILE_W, H: TILE_H }; },
    // the site's engine also exposes start/switchTheme/audio; a gallery needs none of it
    start() {}, switchTheme() {}, cycle() {},
  };

  /* Signal towers ask MH_MUSEBOTS for their state. The real bundle is not
     loaded here, so the gallery answers for it: one tower per state. */
  window.MH_MUSEBOTS = {
    stateFor(uid) {
      if (uid === "gallery-playing") return { state: "playing", beat: 0.5 + 0.5 * Math.sin(performance.now() / 260) };
      if (uid === "gallery-ready") return { state: "ready", beat: 0 };
      if (uid === "gallery-error") return { state: "error", beat: 0 };
      return { state: "unassigned", beat: 0 };
    },
  };

  /* ---- the gallery ------------------------------------------------------ */
  const panels = [];   // {canvas, ctx, draw(g, w, h, t), theme}
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /** One labelled canvas in a section. `draw` gets (g, w, h, t). */
  function panel(section, title, note, w, h, bg, draw) {
    const fig = document.createElement("figure");
    fig.className = "panel";
    const cv = document.createElement("canvas");
    cv.width = w * DPR; cv.height = h * DPR;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.style.background = bg || "#cfe4d6";
    const cap = document.createElement("figcaption");
    cap.innerHTML = "<strong>" + title + "</strong>" + (note ? "<span>" + note + "</span>" : "");
    fig.append(cv, cap); section.append(fig);
    const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
    g.scale(DPR, DPR);
    panels.push({ canvas: cv, ctx: g, w, h, draw, name: title + (note ? ": " + note : "") });
    return fig;
  }

  function section(title, blurb) {
    const s = document.createElement("section");
    s.innerHTML = "<h2>" + title + "</h2>" + (blurb ? "<p>" + blurb + "</p>" : "");
    const grid = document.createElement("div");
    grid.className = "grid"; s.append(grid);
    document.querySelector("main").append(s);
    return grid;
  }

  /** env/info the theme painters read (engine.js builds the same shape). */
  function env(t, w, h, biome, tx, ty) {
    return { t, W: w, H: h, biome: biome || "grass", tx: tx || 0, ty: ty || 0, zone: "field", n: 0.5 };
  }

  function build() {
    const cute = REGISTRY.get("technocute"), nurt = REGISTRY.get("technurture"), scur = REGISTRY.get("technoscure");
    const skins = [
      { t: cute, label: "bureaucore", bg: cute && cute.bgCss },
      { t: nurt, label: "slimeworld, day", bg: nurt && nurt.bgCss },
      { t: scur, label: "gloomthmaxx", bg: scur && scur.bgCss },
    ].filter((s) => s.t);

    if (!skins.length) {
      document.querySelector("main").insertAdjacentHTML("beforeend",
        "<p class='warn'>No skins registered. This page loads ../../theme-*.js, ../../buildings.js and ../../ecology.js: open it from inside the repository so those relative paths resolve.</p>");
      return;
    }

    /* --- kiosks ---------------------------------------------------------- */
    {
      const grid = section("Kiosks", "The five destinations. A kiosk carries its exhibit's accent colour, and marks itself once visited.");
      for (const s of skins) {
        for (const state of [{ k: "unvisited", v: false, a: false }, { k: "visited", v: true, a: false }, { k: "active", v: false, a: true }]) {
          panel(grid, s.label, "kiosk, " + state.k, 150, 150, s.bg, (g, w, h, t) => {
            const ex = { title: "About", accent: (s.t.accents || ["#8a52d0"])[3], slot: 0, visited: state.v, signRect: null };
            (s.t.paintKiosk || (() => {}))(g, w / 2, h * 0.72, ex, state.a, env(t, w, h));
          });
        }
      }
    }

    /* --- buildings ------------------------------------------------------- */
    {
      const grid = section("Dwellings and growths", "buildings.js: deterministic per tile, so the same tile always grows the same thing. Houses are the road-side satellites; the alien growth is the slime world's tree.");
      const tiles = [[3, 5], [11, 2], [7, 9], [14, 6]];
      for (const s of skins.slice(1)) {
        tiles.forEach(([tx, ty], i) => {
          panel(grid, s.label, "house, tile " + tx + "," + ty, 150, 150, s.bg, (g, w, h, t) => {
            target = g;
            window.MH_BUILD.paint(g, w / 2, h * 0.78, { tx, ty, type: "house" }, { t, util: window.MH_ISO.util, biome: "grass", ink: "#16261c" });
          });
        });
        tiles.slice(0, 2).forEach(([tx, ty]) => {
          panel(grid, s.label, "growth, tile " + tx + "," + ty, 150, 150, s.bg, (g, w, h, t) => {
            target = g;
            window.MH_BUILD.paint(g, w / 2, h * 0.82, { tx, ty, type: "tree" }, { t, util: window.MH_ISO.util, biome: "forest", ink: "#16261c" });
          });
        });
      }
      for (const s of skins) {                                   // the tower is per-skin now: a colonised mast in the slime skins
        for (const uid of ["gallery-unassigned", "gallery-ready", "gallery-playing", "gallery-error"]) {
          panel(grid, s.label, "signal tower, " + uid.replace("gallery-", ""), 150, 175, s.bg, (g, w, h, t) => {
            target = g;
            window.MH_BUILD.paint(g, w / 2, h * 0.86, { tx: 4, ty: 4, type: "signal", uid },
              { t, util: window.MH_ISO.util, biome: "grass", theme: s.t.id, ink: s.t.avatarInk || "#16261c" });
          });
        }
      }
    }

    /* --- flora / props --------------------------------------------------- */
    {
      const grid = section("Flora", "The props scattered across the two slime skins. propAt() decides which grows on a tile; water tiles always grow a lily.");
      for (const s of skins.slice(1)) {
        for (const id of ["lily", "slimemould", "gelpod", "sporecap", "tendril"]) {
          panel(grid, s.label, id, 130, 130, s.bg, (g, w, h, t) => {
            (s.t.paintProp || (() => {}))(g, w / 2, h * 0.72, id, env(t, w, h, id === "lily" ? "water" : "grass", 3, 5));
          });
        }
      }
    }

    /* --- fauna ----------------------------------------------------------- */
    {
      const grid = section("Fauna", "ecology.js, running live: flocking motes, blinking fireflies, grazers that eat the flora field, and the predators that hunt them. In the daylight slime skin predators are dormant, rooted “scary plants”; after nightfall they roam.");
      const eco = window.MH_ECO;
      if (eco) {
        // one small world, drawn from the middle; the panel is its viewport
        const SP = 22;
        let last = performance.now() / 1000;
        const world = { x: SP / 2, y: SP / 2 };
        const api = (w, h, t) => ({
          player: world, hub: { x: SP / 2, y: SP / 2 }, villageR: 3, P: SP, t, W: w, H: h,
          place(wx, wy) {
            const dx = ((wx - world.x + SP * 1.5) % SP) - SP / 2, dy = ((wy - world.y + SP * 1.5) % SP) - SP / 2;
            return { x: w / 2 + (dx - dy) * (TILE_W / 2) * 0.34, y: h / 2 + (dx + dy) * (TILE_H / 2) * 0.34, depth: dx + dy };
          },
        });
        eco.cfg.motes = 26; eco.cfg.fireflies = 14; eco.cfg.grazerStart = 10; eco.cfg.predatorStart = 3;
        eco.cfg.moteCap = 40; eco.cfg.grazerCap = 18; eco.cfg.predatorCap = 6;
        panel(grid, "the whole layer", "motes, fireflies, grazers, predators", 470, 300, "#101a14", (g, w, h, t) => {
          const now = performance.now() / 1000, dt = Math.min(0.05, now - last); last = now;
          const a = api(w, h, t);
          if (eco.update) eco.update(dt, a);
          const list = [];
          if (eco.actors) eco.actors((depth, fn) => list.push({ depth, fn }), a);
          list.sort((p, q) => p.depth - q.depth).forEach((p) => p.fn(g));
        });
      }
    }

    /* --- monuments, signposts ------------------------------------------- */
    {
      const grid = section("Landmarks", "The monument at the centre of the plaza, and the signposts that point back to it.");
      for (const s of skins) {
        panel(grid, s.label, "monument", 190, 190, s.bg, (g, w, h, t) => {
          target = g;
          (s.t.paintMonument || (() => {}))(g, w / 2, h * 0.82, env(t, w, h));
        });
      }
      for (const s of skins) {
        for (const dir of [0, 1, 2, 3]) {
          panel(grid, s.label, "signpost, dir " + dir, 130, 130, s.bg, (g, w, h, t) => {
            target = g;
            (s.t.paintSignpost || (() => {}))(g, w / 2, h * 0.74, dir, 7, env(t, w, h));
          });
        }
      }
    }

    /* --- ground ---------------------------------------------------------- */
    {
      const grid = section("Ground", "One tile per biome, for the skins that have biomes. The engine blends these into a continuous field rather than drawing a visible grid. Bureaucore has no biomes and paints no tile: its ground is the flat paper field, over which the engine draws the plaza and the roads.");
      for (const s of skins) {
        if (!s.t.biomeColor) {                                   // bureaucore: a deliberate no-op painter
          panel(grid, s.label, "flat paper field", 110, 90, s.bg, (g, w, h) => {
            diamond(g, w / 2, h / 2, s.t.plazaColor || s.bg || "#dcf3ff", s.t.roadColor || null);
          });
          continue;
        }
        for (const biome of ["water", "sand", "dry", "grass", "forest", "stone", "snow"]) {
          panel(grid, s.label, biome, 110, 90, s.bg, (g, w, h, t) => {
            target = g;
            const col = s.t.biomeColor(biome);
            if (col) diamond(g, w / 2, h / 2, col, null);
            (s.t.paintGround || (() => {}))(g, w / 2, h / 2, { zone: "field", n: 0.5, tx: 3, ty: 4, t, biome });
          });
        }
      }
    }

    /* --- palettes -------------------------------------------------------- */
    {
      const grid = section("Palettes", "The colours each skin hands to the engine: kiosk accents, the plaza, the roads, the avatar, and the page background.");
      for (const s of skins) {
        const fig = document.createElement("figure");
        fig.className = "panel swatches";
        const rows = [];
        const add = (name, cols) => { if (cols && cols.length) rows.push("<tr><th>" + name + "</th><td>" + cols.map((c) => "<i style='background:" + c + "' title='" + c + "'></i>").join("") + "</td></tr>"); };
        add("accents", s.t.accents);
        add("plaza", s.t.plazaColor ? [s.t.plazaColor] : null);
        add("road", s.t.roadColor ? [s.t.roadColor] : null);
        add("avatar", s.t.avatarColors ? [].concat(s.t.avatarColors.color || s.t.avatarColors, s.t.avatarColors.ink || []) .filter((c) => typeof c === "string") : null);
        add("background", s.t.bgCss ? [s.t.bgCss] : null);
        add("fog", s.t.fogColor ? [s.t.fogColor] : null);
        fig.innerHTML = "<table>" + rows.join("") + "</table><figcaption><strong>" + s.label + "</strong><span>" + (s.t.tagline || s.t.name || "") + "</span></figcaption>";
        grid.append(fig);
      }
    }
  }

  /* ---- one clock for every panel; only paint what is on screen ---------- */
  const errors = [];   // a painter that throws is logged, not silenced

  function paintPanel(p, t) {
    p.ctx.save();
    p.ctx.clearRect(0, 0, p.w, p.h);
    target = p.ctx;
    try { p.draw(p.ctx, p.w, p.h, t); }
    catch (e) { errors.push((p.name || "panel") + ": " + (e && e.message ? e.message : e)); }  // one bad panel must not stop the page
    p.ctx.restore();
  }

  function loop() {
    const t = performance.now() / 1000;
    for (const p of panels) {
      const r = p.canvas.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;   // paint only what is on screen
      paintPanel(p, t);
    }
    requestAnimationFrame(loop);
  }

  window.MH_ASSETS = {
    boot() { build(); requestAnimationFrame(loop); },
    themes: () => REGISTRY,
    /** Paint every panel once, ignoring the viewport check (printing, screenshots, tests). */
    redraw(t) { const now = t == null ? performance.now() / 1000 : t; for (const p of panels) paintPanel(p, now); },
    /** Painter exceptions, newest last. Empty is the healthy state. */
    errors,
    panels: () => panels.map((p) => p.name),
  };
})();
