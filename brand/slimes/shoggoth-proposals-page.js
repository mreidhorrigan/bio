// @ts-check
"use strict";
/* shoggoth-proposals-page.js — the grid for shoggoth-proposals.html.
 * Same panel format as the other sheets. assets.js has installed the engine
 * stub, so the painters can use MH_ISO.util exactly as buildings.js does, and
 * the two slime themes supply the backgrounds their palettes were tuned to. */
(function () {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const STATES = ["dormant", "roused", "moving"];
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
      pal: window.MH_SHOGGOTH.palettes[skin], state, R0,
      R(salt) { return u.hash01((tx * 101 + salt * 131) | 0, (ty * 97 + salt * 167) | 0); },
    };
    C.pick = (arr, salt) => arr[Math.floor(C.R(salt) * arr.length)];
    return C;
  }

  function build() {
    const reg = window.MH_ASSETS.themes();
    const V = window.MH_SHOGGOTH.variants;

    for (const skin of ["technurture", "technoscure"]) {
      const theme = reg.get(skin); if (!theme) continue;
      const grid = section(
        skin === "technurture" ? "Daylight slimeworld (technurture)" : "After dark (technoscure)",
        skin === "technurture"
          ? "Six designs, each in the three states a creature needs: asleep, awake and watching, and on the move."
          : "The same six after dark, where the world multiplies toward black and only what glows survives."
      );
      for (const v of V) {
        for (const st of STATES) {
          panel(grid, v.label, st, 170, 180, theme.bgCss, (g, w, h, t) => {
            const C = ctxFor(g, w / 2, h * 0.86, t, skin, st, 4, 6, 34);
            if (theme.paintGround) theme.paintGround(g, w / 2, h * 0.88, { zone: "field", n: 0.5, tx: 4, ty: 6, t, biome: "grass" });
            v.draw(C);
          });
        }
      }
      // what it is next to, so the size means something
      panel(grid, "For scale", "beside a dwelling and a citizen", 330, 200, theme.bgCss, (g, w, h, t) => {
        if (theme.paintGround) theme.paintGround(g, w / 2, h * 0.9, { zone: "field", n: 0.5, tx: 4, ty: 6, t, biome: "grass" });
        window.MH_BUILD.paint(g, 62, h * 0.88, { tx: 3, ty: 5, type: "house" },
          { t, util: window.MH_ISO.util, biome: "grass", theme: skin, ink: theme.avatarInk || "#16261c" });
        const ex = { title: "", accent: (theme.accents || ["#888"])[0], slot: 3, visited: false, satellite: true };
        const C = ctxFor(g, 210, h * 0.9, t, skin, "roused", 4, 6, 44);
        V[0].draw(C);
        const a = { color: (theme.avatarColors && (theme.avatarColors[0] || theme.avatarColors.color)) || "#4FA373", ink: theme.avatarInk || "#1f3a1a", t, dx: 1, gel: true };
        g.fillStyle = a.color; g.strokeStyle = a.ink; g.lineWidth = 2;
        g.beginPath(); g.ellipse(300, h * 0.9 - 8, 12, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(300, h * 0.9 - 11, 5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = a.ink; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = a.ink; g.beginPath(); g.arc(301, h * 0.9 - 10, 2.4, 0, Math.PI * 2); g.fill();
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

  window.MH_SHOG_PAGE = {
    boot() { build(); requestAnimationFrame(loop); },
    redraw(t) { const now = t == null ? performance.now() / 1000 : t; for (const p of panels) paintPanel(p, now); },
    errors,
    panels: () => panels.map((p) => p.name),
  };
})();
