// @ts-check
"use strict";
/* cave-proposals-page.js — the grid for cave-proposals.html.
 *
 * Same shape as the other sheets: one labelled canvas per cell, all on one
 * clock, painted only when scrolled into view, and any painter that throws is
 * reported at the top of the page rather than failing silently.
 */
(function () {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const panels = [], errors = [];
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function panel(grid, title, note, w, h, draw) {
    const fig = document.createElement("figure");
    fig.className = "panel";
    const cv = document.createElement("canvas");
    cv.width = w * DPR; cv.height = h * DPR;
    cv.style.width = w + "px"; cv.style.height = h + "px";
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

  function build() {
    const P = window.MH_CAVE_PROPOSALS;
    if (!P) { errors.push("cave-proposals.js did not load"); return; }

    for (const o of P.options) {
      const grid = section(o.name, o.note);
      panel(grid, "Glossary", "his own coinages, in the near half", 330, 230, o.near);
      panel(grid, "Antiglossary", "the machine's words, in the far half", 330, 230, o.far);
    }

    const grid = section("The way in",
      "The Glossary house on the Public Writing road. Today it is an ordinary slime dwelling, "
      + "which says nothing about what is under it. Each of these is a door in the ground instead.");
    for (const d of P.doors) panel(grid, d.name, d.note, 216, 216, d.draw);
  }

  function paintPanel(p, t) {
    p.ctx.save(); p.ctx.clearRect(0, 0, p.w, p.h);
    try { p.draw(p.ctx, p.w, p.h, t); }
    catch (e) { errors.push(p.name + ": " + (e && e.message ? e.message : e)); }
    p.ctx.restore();
  }

  function loop() {
    const t = reduce ? 0 : performance.now() / 1000;
    for (const p of panels) {
      const r = p.canvas.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      paintPanel(p, t);
    }
    if (!reduce) requestAnimationFrame(loop);
  }

  function report() {
    if (!errors.length) return;
    const box = document.createElement("p");
    box.className = "warn";
    box.textContent = "Painters that failed: " + Array.from(new Set(errors)).join(" | ");
    document.querySelector("main").prepend(box);
  }

  window.MH_CAVE_PAGE = {
    boot() {
      build();
      if (reduce) { for (const p of panels) paintPanel(p, 0); } else requestAnimationFrame(loop);
      setTimeout(report, 400);
    },
    panels: () => panels,
    errors: () => errors,
  };
  document.addEventListener("DOMContentLoaded", () => window.MH_CAVE_PAGE.boot());
})();
