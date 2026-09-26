// @ts-check
"use strict";
/* ============================================================================
   wayfinding.js  ·  MH_WAYFINDING  ·  which way the village's houses are
   ----------------------------------------------------------------------------
   Walked out of sight of the village, the visitor sees a marker for each house of
   the menu at the edge of the frame: a chip in the house's colour with its number
   (as the menu numbers it) and an arrow pointing its way. The same marker in
   every view that has a village outdoors; each view says when, and where on the
   edge it goes:

     the iso village (engine.js drawEdgeMarkers)
         when   no house on screen (and the menu of houses fades in with them)
         where  edge(): on the frame's edge, on the line from the middle of the
                frame to the house, pointing at it
     the 3D village, outdoors (slimeverse3d-page.js edgeMarkers)
         when   no house in sight: none in the frame nearer than SIGHT (the
                menu of houses fades in with them); not in the house or the cave
         where  sides(): at the left edge or the right, the side the house lies
                on from the way the camera looks; high for a house ahead, low for
                one behind; a few apart where they would overlap

   MH_WAYFINDING.edge(W, H, points)      [{ x, y }] (screen, off it) → [{ x, y, a }]
   MH_WAYFINDING.sides(W, H, bearings)   [radians: 0 ahead, + to the right, ±π
                                         behind] → [{ x, y, a }]
   MH_WAYFINDING.mark(g, x, y, a, colour, label, font)   draws one marker
   MH_WAYFINDING.MARGIN, GAP, SIGHT      30 px in from the edge, 26 px apart,
                                         110 world units (the 3D village's sight)
   wayfinding.test.mjs checks the placing.
   ========================================================================== */
(function () {
  const MARGIN = 30, GAP = 26, SIGHT = 110;

  /** On the edge of a W×H frame, toward each point from the middle (a MARGIN in). */
  function edge(W, H, points) {
    const cx = W / 2, cy = H / 2, ix = cx - MARGIN, iy = cy - MARGIN;
    return points.map((p) => {
      const a = Math.atan2(p.y - cy, p.x - cx), dx = Math.cos(a), dy = Math.sin(a);
      const t = Math.min(Math.abs(dx) > 1e-4 ? ix / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-4 ? iy / Math.abs(dy) : Infinity);
      return { x: cx + dx * t, y: cy + dy * t, a };
    });
  }

  /** At the left or right edge, by each bearing's side; ahead high, behind low; spread GAP apart. */
  function sides(W, H, bearings) {
    const top = MARGIN, bottom = H - MARGIN;
    const out = bearings.map((b) => {
      const right = b >= 0, f = Math.min(1, Math.abs(b) / Math.PI);    // 0 ahead, 1 behind
      const t = (f - 0.5) * 1.2;                                        // the arrow: up and out ahead, down and out behind
      return { x: right ? W - MARGIN : MARGIN, y: top + f * (bottom - top), a: right ? t : Math.PI - t };
    });
    for (const right of [false, true]) {                                // each side's markers kept GAP apart, inside the frame
      const col = out.filter((m) => (m.x > W / 2) === right).sort((p, q) => p.y - q.y);
      for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + GAP);
      if (col.length && col[col.length - 1].y > bottom) {
        col[col.length - 1].y = bottom;
        for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - GAP);
      }
    }
    return out;
  }

  /** One marker: the arrow out toward the house, then its numbered chip over it. */
  function mark(g, x, y, a, colour, label, font) {
    g.save();
    g.translate(x, y); g.rotate(a);
    g.globalAlpha = 0.96; g.fillStyle = colour;
    g.beginPath(); g.moveTo(17, 0); g.lineTo(8, -6); g.lineTo(8, 6); g.closePath(); g.fill();
    g.restore();
    g.save();
    g.globalAlpha = 0.96; g.fillStyle = colour; g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 2;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - 12, y - 11, 24, 22, 8); else g.rect(x - 12, y - 11, 24, 22);
    g.fill(); g.stroke();
    g.globalAlpha = 1; g.font = font || "700 12px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "alphabetic";             // the number, edged dark, as the iso labels are
    g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.6)"; g.strokeText(String(label), x, y + 4);
    g.fillStyle = "#ffffff"; g.fillText(String(label), x, y + 4);
    g.restore();
  }

  window.MH_WAYFINDING = { edge, sides, mark, MARGIN, GAP, SIGHT };
})();
