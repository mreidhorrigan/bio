// @ts-check
"use strict";
/* ============================================================================
   slime-widget.js — the shared "hero slime" corner companion.
   ----------------------------------------------------------------------------
   A fixed, bottom-anchored slime whose single eye's pupil follows the pointer
   (mouse on desktop, touch on mobile), breathing (squash) like the walkable
   world's avatar. Matches brand/favicon-slime.svg + engine.js defPaintAvatar,
   in the brand violet. A mini version shows on small/touch screens.

   ONE source for every page: include it with
       <script src="slime-widget.js" defer></script>
   on about.html and the tool pages. Editing this file updates the slime everywhere.

   Inline SVG only — no canvas, no libraries, no network. pointer-events:none so it
   never blocks clicks or taps.
   ========================================================================== */
(function () {
  if (window.__heroSlime) return;        // guard against a double include on one page
  window.__heroSlime = true;

  const CSS = `
  .hero-slime{ position:fixed; right:18px; bottom:0; width:96px; height:84px; z-index:40;
    pointer-events:none; filter:drop-shadow(0 6px 7px rgba(0,0,0,0.18)); }
  .hero-slime svg{ width:100%; height:100%; display:block; overflow:visible; }
  /* breathing/squash, planted on its flat base (origin = bottom centre) */
  .hero-slime .slime-dome{ transform-box:fill-box; transform-origin:50% 100%;
    animation:heroSlimePulse 3s ease-in-out infinite; }
  @keyframes heroSlimePulse{ 0%,100%{ transform:scale(1,1); } 50%{ transform:scale(1.05,0.93); } }
  /* mini version on small / touch screens (the eye follows touch instead of a cursor) */
  @media (max-width:700px){ .hero-slime{ width:64px; height:56px; right:10px; } }
  @media (prefers-reduced-motion:reduce){ .hero-slime .slime-dome{ animation:none; } }`;

  // viewBox cropped to 0 0 32 28 so the flat base sits flush with the bottom edge.
  const SVG = `<svg viewBox="0 0 32 28" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="heroGel" gradientUnits="userSpaceOnUse" cx="16" cy="20" r="16" fx="12" fy="9">
        <stop offset="0" stop-color="#b294d6"/>
        <stop offset="0.5" stop-color="#5b2a86"/>
        <stop offset="1" stop-color="#3d1a5c"/>
      </radialGradient>
    </defs>
    <g class="slime-dome">
      <path d="M 3 27 C 3 15 7 8 16 8 C 25 8 29 15 29 27 Z"
            fill="url(#heroGel)" stroke="#261139" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="10.5" cy="12" rx="2.1" ry="2.9" fill="#ffffff" opacity="0.32" transform="rotate(-30 10.5 12)"/>
      <g stroke="#261139" stroke-linecap="round">
        <circle id="heroEyeWhite" cx="16" cy="15.5" r="5.5" fill="#ffffff" stroke-width="1.3"/>
        <g id="heroPupil">
          <circle cx="16" cy="15.5" r="2.75" fill="#261139" stroke="none"/>
          <circle cx="15" cy="14.5" r="1" fill="#ffffff" stroke="none"/>
        </g>
      </g>
    </g>
  </svg>`;

  function mount() {
    if (document.querySelector(".hero-slime")) return;
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    const box = document.createElement("div"); box.className = "hero-slime"; box.setAttribute("aria-hidden", "true");
    box.innerHTML = SVG; document.body.appendChild(box);

    const white = box.querySelector("#heroEyeWhite"), pupil = box.querySelector("#heroPupil");
    if (!white || !pupil) return;
    const MAX = 2.3;            // max pupil travel in SVG user units (white r5.5 - pupil r2.75 - margin)
    const SAT = 90;             // px distance at which the gaze reaches full travel
    const EASE = 0.2;           // rAF lerp factor (smoothing)
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    function aim(px, py) {
      const r = white.getBoundingClientRect();
      if (!r.width) return;                          // hidden -> nothing to do
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = px - ex, dy = py - ey, dist = Math.hypot(dx, dy) || 1;
      const mag = MAX * Math.min(1, dist / SAT);     // proportional up to SAT, then saturate
      tx = (dx / dist) * mag; ty = (dy / dist) * mag;
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function tick() {
      cx += (tx - cx) * EASE; cy += (ty - cy) * EASE;
      const done = Math.abs(tx - cx) < 0.01 && Math.abs(ty - cy) < 0.01;
      if (done) { cx = tx; cy = ty; }
      pupil.setAttribute("transform", "translate(" + cx.toFixed(3) + "," + cy.toFixed(3) + ")");
      raf = done ? null : requestAnimationFrame(tick);
    }
    window.addEventListener("mousemove", (e) => aim(e.clientX, e.clientY), { passive: true });
    window.addEventListener("touchmove", (e) => { const t = e.touches && e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
