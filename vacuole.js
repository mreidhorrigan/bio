// @ts-check
"use strict";
/* ============================================================================
   vacuole.js  ·  MH_VACUOLE  ·  the balloon a sign floats on
   ----------------------------------------------------------------------------
   In the slimeverse nothing is built to hold a sign up, so each sign hangs from
   a vacuole: a gel bubble of the world's own stuff, full of something lighter
   than air, tethered to the sign by two threads. The iso skins (their
   kioskSign) and the 3D views (verse3d.js) both draw it from here, so a sign
   floats the same way in every view.

   MH_VACUOLE.draw(g, cx, boardTop, bw, bh, style, t)
     cx, boardTop   the middle of the sign's top edge, in canvas pixels
     bw, bh         the sign board's width and height, in canvas pixels
     style          "gel" (the slime skins by day), "night" (gloomthmaxx: dim and
                    unlit, a shape in the dark), "plain" (bureaucore: a flat white
                    balloon with a black edge, as plain as the skin)
     t              seconds, for the bob and the drift inside; 0 holds it still
   Draw it before the board, so the board covers the threads' ends.
   ========================================================================== */
(function () {
  const TAU = Math.PI * 2;
  const STYLES = {
    gel:   { fill: "rgba(200,245,225,0.34)", rim: "rgba(63,125,94,0.8)", thread: "rgba(38,58,40,0.7)", sheen: "rgba(255,255,255,0.55)", organelle: "rgba(79,163,115,0.5)" },
    night: { fill: "rgba(40,48,44,0.28)", rim: "rgba(92,104,96,0.5)", thread: "rgba(92,104,96,0.45)", sheen: "rgba(150,160,155,0.12)", organelle: "rgba(70,82,76,0.4)" },
    plain: { fill: "#ffffff", rim: "#111111", thread: "#111111", sheen: null, organelle: null },
  };
  /** The balloon's size for a board: quite small, a float rather than a canopy,
   *  so it hides next to nothing of what stands behind (about half the board's
   *  height across, all told). */
  function sizeFor(bw, bh) {
    const rx = Math.max(bh * 0.2, Math.min(bw * 0.07, bh * 0.28));
    return { rx, ry: rx * 1.1, gap: bh * 0.2 };
  }
  function draw(g, cx, boardTop, bw, bh, style, t) {
    const S = STYLES[style] || STYLES.gel, { rx, ry, gap } = sizeFor(bw, bh);
    const bob = t ? Math.sin(t * 1.3 + cx * 0.01) * bh * 0.05 : 0;
    const by = boardTop - gap - ry + bob;                      // the balloon's middle
    const lw = Math.max(0.6, bh * 0.03);
    g.save();
    g.lineCap = "round"; g.lineJoin = "round";
    // two threads, from the board's top edge to the balloon's knot
    const kx = cx, ky = by + ry;
    g.strokeStyle = S.thread; g.lineWidth = Math.max(0.6, lw * 0.6);
    g.beginPath(); g.moveTo(cx - bw * 0.26, boardTop + lw * 0.5); g.quadraticCurveTo(cx - bw * 0.1, ky + gap * 0.5, kx, ky + lw * 0.8);
    g.moveTo(cx + bw * 0.26, boardTop + lw * 0.5); g.quadraticCurveTo(cx + bw * 0.1, ky + gap * 0.5, kx, ky + lw * 0.8); g.stroke();
    // the membrane
    g.beginPath(); g.ellipse(cx, by, rx, ry, 0, 0, TAU);
    g.fillStyle = S.fill; g.fill();
    g.lineWidth = style === "plain" ? Math.max(1.5, lw * 1.2) : lw; g.strokeStyle = S.rim; g.stroke();
    // its knot
    g.beginPath(); g.moveTo(kx - lw * 1.4, ky + lw * 1.6); g.lineTo(kx + lw * 1.4, ky + lw * 1.6); g.lineTo(kx, ky - lw * 0.2); g.closePath();
    g.fillStyle = S.rim; g.fill();
    if (S.organelle) {                                         // a few organelles drifting inside, as in any cell
      g.fillStyle = S.organelle;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + (t || 0) * 0.35, r = rx * (0.35 + 0.12 * i);
        g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.8, by + Math.sin(a * 1.3) * r * 0.6, Math.max(0.8, rx * (0.09 + 0.03 * i)), 0, TAU); g.fill();
      }
    }
    if (S.sheen) {                                             // the gel sheen, top left, as every gel thing on the site wears
      g.fillStyle = S.sheen; g.beginPath(); g.ellipse(cx - rx * 0.38, by - ry * 0.42, rx * 0.26, ry * 0.15, -0.6, 0, TAU); g.fill();
    }
    g.restore();
  }
  window.MH_VACUOLE = { draw, sizeFor, STYLES };
})();
