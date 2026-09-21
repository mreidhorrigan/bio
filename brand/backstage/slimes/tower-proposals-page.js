// @ts-check
"use strict";
/* tower-proposals-page.js — the grid for tower-proposals.html.
 *
 * Same shape as assets.js's gallery: one labelled canvas per cell, all on one
 * clock, painted only when scrolled into view. assets.js has already installed
 * the engine stub and the canonical theme and buildings files have loaded, so
 * the "Live" row is the shipped tower from buildings.js and every other row is
 * a painter from tower-proposals.js.
 */
(function () {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const STATES = ["unassigned", "ready", "playing", "error"];
  const panels = [];
  const errors = [];
  let target = null;

  /** A live-ish state object, so playing actually beats. */
  function stateFor(name, t) {
    const beat = name === "playing" ? Math.max(0, 1 - ((t * 2) % 1)) : 0;
    return { state: name, beat };
  }
  // the canonical tower reads its state through MH_MUSEBOTS; answer for the bundle
  window.MH_MUSEBOTS = {
    stateFor(uid) { return window.__towerState || { state: "unassigned", beat: 0 }; },
  };

  function panel(grid, title, note, w, h, bg, draw) {
    const fig = document.createElement("figure");
    fig.className = "panel";
    const cv = document.createElement("canvas");
    cv.width = w * DPR; cv.height = h * DPR;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.style.background = bg;
    const cap = document.createElement("figcaption");
    cap.innerHTML = "<strong>" + title + "</strong>" + (note ? "<span>" + note + "</span>" : "");
    fig.append(cv, cap); grid.append(fig);
    const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d"));
    g.scale(DPR, DPR);
    panels.push({ canvas: cv, ctx: g, w, h, draw, name: title + (note ? ": " + note : "") });
  }

  function section(title, blurb) {
    const s = document.createElement("section");
    s.innerHTML = "<h2>" + title + "</h2>" + (blurb ? "<p>" + blurb + "</p>" : "");
    const grid = document.createElement("div");
    grid.className = "grid"; s.append(grid);
    document.querySelector("main").append(s);
    return grid;
  }

  /** The per-call context buildings.js builds, so a painter lifts out unchanged. */
  function ctxFor(g, sx, sy, t, state, tx, ty) {
    const u = window.MH_ISO.util;
    const C = {
      g, u, ink: "#16261c", t, biome: "grass", tx, ty, sx, sy, state,
      R(salt) { return u.hash01((tx * 101 + salt * 131) | 0, (ty * 97 + salt * 167) | 0); },
    };
    C.pick = (arr, salt) => arr[Math.floor(C.R(salt) * arr.length)];
    return C;
  }

  function build() {
    const T = window.MH_TOWERS, themes = { technurture: null, technoscure: null };
    for (const t of [window.MH_ISO.themes()]) { /* names only; grab the objects below */ }
    // MH_ISO.register kept the objects in assets.js's registry; reach them through a probe
    const reg = window.MH_ASSETS && window.MH_ASSETS.themes ? window.MH_ASSETS.themes() : new Map();
    themes.technurture = reg.get("technurture");
    themes.technoscure = reg.get("technoscure");

    for (const skinId of ["technurture", "technoscure"]) {
      const theme = themes[skinId];
      if (!theme) continue;
      const bg = theme.bgCss;
      const grid = section(
        skinId === "technurture" ? "Daylight slimeworld (technurture)" : "After dark (technoscure)",
        skinId === "technurture"
          ? "The old tower put the only cold blue in a warm palette, and its idle violet was the same violet as the sporecaps. A is now the live painter."
          : "The engine multiplies this skin toward night, so the old steel all but vanished and left a floating beacon. A-night is now the live painter."
      );
      const variants = T.variants.filter((v) => v.skin === "both" || v.skin === skinId);
      for (const v of variants) {
        for (const st of STATES) {
          panel(grid, v.label, st, 150, 190, bg, (g, w, h, t) => {
            const sx = w / 2, sy = h * 0.82;
            if (theme.paintGround) {                                   // a tile of ground for context
              target = g;
              theme.paintGround(g, sx, sy, { zone: "field", n: 0.5, tx: 4, ty: 6, t, biome: "grass" });
            }
            const state = stateFor(st, t);
            if (v.canonical) {
              window.__towerState = state;
              window.MH_BUILD.paint(g, sx, sy, { tx: 4, ty: 6, type: "signal", uid: "u" },
                { t, util: window.MH_ISO.util, biome: "grass", theme: skinId, ink: theme.avatarInk || "#16261c" });
            } else {
              v.draw(ctxFor(g, sx, sy, t, state, 4, 6), { tx: 4, ty: 6, type: "signal" });
            }
          });
        }
      }
    }
  }

  function paintPanel(p, t) {
    p.ctx.save(); p.ctx.clearRect(0, 0, p.w, p.h); target = p.ctx;
    try { p.draw(p.ctx, p.w, p.h, t); } catch (e) { errors.push(p.name + ": " + (e && e.message ? e.message : e)); }
    p.ctx.restore();
  }
  function loop() {
    const t = performance.now() / 1000;
    for (const p of panels) {
      const r = p.canvas.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      paintPanel(p, t);
    }
    requestAnimationFrame(loop);
  }

  window.MH_TOWER_PAGE = {
    boot() { build(); requestAnimationFrame(loop); },
    redraw(t) { const now = t == null ? performance.now() / 1000 : t; for (const p of panels) paintPanel(p, now); },
    errors,
    panels: () => panels.map((p) => p.name),
  };
})();
