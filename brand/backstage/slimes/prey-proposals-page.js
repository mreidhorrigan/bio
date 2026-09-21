// @ts-check
"use strict";
/* prey-proposals-page.js — the grid for prey-proposals.html. Same panel format
 * as the other sheets: assets.js installs the engine stub, the two slime themes
 * supply the backgrounds, and each cell is one design in one state. */
(function () {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const STATES = ["grazing", "alert", "fleeing"];
  const panels = [], errors = [];

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

  /** The per-call context buildings.js builds, plus what a shoggoth needs. */
  function ctxFor(g, sx, sy, t, skin, state, tx, ty, R0) {
    const u = window.MH_ISO.util;
    const C = {
      g, u, ink: "#12281e", t, biome: "grass", tx, ty, sx, sy,
      pal: window.MH_PREY.palettes[skin], state, R0,
      R(salt) { return u.hash01((tx * 101 + salt * 131) | 0, (ty * 97 + salt * 167) | 0); },
    };
    C.pick = (arr, salt) => arr[Math.floor(C.R(salt) * arr.length)];
    return C;
  }

  function build() {
    const reg = window.MH_ASSETS.themes();
    const V = window.MH_PREY.variants;

    for (const skin of ["technurture", "technoscure"]) {
      const theme = reg.get(skin); if (!theme) continue;
      const grid = section(
        skin === "technurture" ? "Daylight slimeworld (technurture)" : "After dark (technoscure)",
        skin === "technurture"
          ? "Six designs, each in the three states a grazer needs: head down, head up, and running."
          : "The same six after dark, where the world multiplies toward black and only what glows survives."
      );
      for (const v of V) {
        for (const st of STATES) {
          panel(grid, v.label + " (" + v.source + ")", st, 170, 160, theme.bgCss, (g, w, h, t) => {
            const C = ctxFor(g, w / 2, h * 0.82, t, skin, st, 4, 6, 24);
            if (theme.paintGround) theme.paintGround(g, w / 2, h * 0.88, { zone: "field", n: 0.5, tx: 4, ty: 6, t, biome: "grass" });
            v.draw(C);
          });
        }
      }
      // what it is next to, so the size means something
      panel(grid, "For scale", "the flock, and what hunts it", 360, 200, theme.bgCss, (g, w, h, t) => {
        if (theme.paintGround) theme.paintGround(g, w / 2, h * 0.9, { zone: "field", n: 0.5, tx: 4, ty: 6, t, biome: "grass" });
        const mk = (x, R0, state) => ctxFor(g, x, h * 0.88, t, skin, state, 4, 6, R0);
        V[0].draw(mk(70, 22, "grazing"));            // a mooncalf, head down
        V[3].draw(mk(170, 20, "alert"));             // a thoat, head up
        V[5].draw(mk(250, 20, "alert"));             // the Selenite herding them
        if (window.MH_SHOGGOTH) {                    // and the shoggoth, at the size it actually is
          const S = window.MH_SHOGGOTH;
          const C = { g, u: window.MH_ISO.util, ink: "#12281e", t, biome: "grass", tx: 9, ty: 2,
                      sx: 320, sy: h * 0.88, pal: S.palettes[skin], state: "roused", R0: 30,
                      R(salt) { return window.MH_ISO.util.hash01((9 * 101 + salt * 131) | 0, (2 * 97 + salt * 167) | 0); } };
          C.pick = (arr, salt) => arr[Math.floor(C.R(salt) * arr.length)];
          S.variants.find((x) => x.id === "iridescent").draw(C);
        }
      });
    }
  }

  function paintPanel(p, t) {
    p.ctx.save(); p.ctx.clearRect(0, 0, p.w, p.h);
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

  window.MH_PREY_PAGE = {
    boot() { build(); requestAnimationFrame(loop); },
    redraw(t) { const now = t == null ? performance.now() / 1000 : t; for (const p of panels) paintPanel(p, now); },
    errors,
    panels: () => panels.map((p) => p.name),
  };
})();
