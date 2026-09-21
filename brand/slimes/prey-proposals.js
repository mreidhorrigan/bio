// @ts-check
"use strict";
/* prey-proposals.js — what the shoggoths hunt, proposed six ways.
 *
 * The predator is now a shoggoth, so the prey should answer it: something the
 * same imagination would put in the same landscape. Each design is a direct
 * reference to a creature from public-domain science fiction, drawn in this
 * world's vocabulary (gel body, 2px ink silhouette, glowing beads, per-beast
 * variation from a hash) rather than in its original illustrator's.
 *
 * On the sources, because the site ships CC BY-SA and the distinction is not
 * decorative:
 *   • Wells, THE FIRST MEN IN THE MOON (1901), and Burroughs, A PRINCESS OF
 *     MARS (1912), are unambiguously public domain in the US: published before
 *     1929. The mooncalf, the Selenite and the thoat come from those.
 *   • Lovecraft's creatures are the complicated ones. AT THE MOUNTAINS OF
 *     MADNESS (Astounding, 1936) and THE DREAM-QUEST OF UNKNOWN KADATH (1943)
 *     fall in the 1930–1963 window where US copyright had to be renewed, and
 *     the Mythos is treated as public domain in practice, but that rests on
 *     non-renewal rather than on age. Check before shipping the Elder Thing,
 *     the ghast or the zoog, or prefer the three above, which need no check.
 *
 * Painters take the same (C, b) context the rest of the world's painters take,
 * plus C.state ("grazing" | "alert" | "fleeing") and C.pal.
 *
 *   MH_PREY.variants — the six designs
 *   MH_PREY.palettes — day and night
 */
(function () {
  const U = () => window.MH_ISO.util;
  const RM = () => window.MH_ISO.reduced();

  // Prey read pale against the shoggoths' near-black, which is how the world
  // already tells its grazers from its hunters.
  const palettes = {
    technurture: { body: "#d9c79a", deep: "#a8916a", pale: "#f2e7c8", ink: "#2a2118", wet: "#9fe6c0", eye: "#2a2118" },
    technoscure: { body: "#8f8a72", deep: "#4a4636", pale: "#c3bb9a", ink: "#0a0e0a", wet: "#5fe0c8", eye: "#e8dfc0" },
  };

  function gait(state) {
    if (state === "alert") return { lift: 1, speed: 0.8, stride: 0, tense: 1 };
    if (state === "fleeing") return { lift: 0.5, speed: 2.4, stride: 1, tense: 1.3 };
    return { lift: 0, speed: 0.5, stride: 0.25, tense: 0.4 };        // grazing
  }

  function pool(g, cx, cy, rx, p) {
    g.save(); g.globalAlpha = 0.26; g.fillStyle = "#000";
    g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.3, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function inked(g, p, w) { g.lineWidth = w == null ? 2 : w; g.lineJoin = "round"; g.strokeStyle = p.ink; g.stroke(); }
  function bead(g, x, y, r, col) {
    g.save(); if (!RM()) { g.shadowColor = col; g.shadowBlur = 7; }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
  }

  /* ====================================================================== */

  /** A. Mooncalf. Wells, The First Men in the Moon (1901): the vast pale
   *  slug-like cattle the Selenites herd through the lunar fungus. Literally
   *  livestock in a fungal landscape, which is the landscape we have. */
  function mooncalf(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed, len = R * 2.2;
    pool(g, sx, sy, R * 1.25, p);
    g.beginPath();                                     // a long sausage with peristalsis running down it
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, a = Math.PI * u;
      const ripple = 1 + 0.08 * Math.sin(u * 9 - t * 3);
      g.lineTo(sx - len / 2 + len * u, sy - R * 0.42 * Math.sin(a) * ripple * (1.1 - 0.3 * u) - R * 0.1);
    }
    for (let i = 28; i >= 0; i--) {
      const u = i / 28;
      g.lineTo(sx - len / 2 + len * u, sy - R * 0.06 * Math.sin(Math.PI * u));
    }
    g.closePath();
    const grd = g.createLinearGradient(0, sy - R * 0.7, 0, sy);
    grd.addColorStop(0, p.pale); grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill(); inked(g, p);
    const hx = sx + len / 2 - R * 0.1, hy = sy - R * 0.2 - v.lift * R * 0.55;   // the blunt head, up or buried
    g.fillStyle = p.body; g.beginPath(); g.ellipse(hx, hy, R * 0.34, R * 0.28, 0, 0, Math.PI * 2); g.fill(); inked(g, p, 1.8);
    g.strokeStyle = p.ink; g.lineWidth = 1.4;          // the feeding slit: a seam, not a face
    g.beginPath(); g.moveTo(hx + R * 0.12, hy + R * 0.12); g.lineTo(hx + R * 0.3, hy + R * 0.16); g.stroke();
    if (C.state === "grazing") bead(g, hx + R * 0.2, hy + R * 0.3, 1.5, p.wet);
  }

  /** B. Elder Thing. Lovecraft, At the Mountains of Madness (1936): the
   *  barrel-bodied five-fold beings who built the shoggoths. Making them the
   *  prey puts the whole revolt on the lawn, and their radial symmetry means
   *  the design cannot accidentally acquire a face. */
  function elderThing(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed, cy = sy - R * 0.95;
    pool(g, sx, sy, R * 0.95, p);
    for (let i = 0; i < 5; i++) {                      // five tube-feet below
      const a = -Math.PI + (i / 4) * Math.PI, fx = sx + Math.cos(a) * R * 0.5;
      g.strokeStyle = p.deep; g.lineCap = "round"; g.lineWidth = R * 0.12;
      g.beginPath(); g.moveTo(fx, cy + R * 0.5); g.lineTo(fx + Math.cos(a) * R * 0.22, sy - 1); g.stroke();
    }
    g.beginPath(); g.ellipse(sx, cy, R * 0.52, R * 0.82, 0, 0, Math.PI * 2);   // the barrel
    const grd = g.createLinearGradient(sx - R * 0.5, 0, sx + R * 0.5, 0);
    grd.addColorStop(0, p.deep); grd.addColorStop(0.5, p.body); grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill(); inked(g, p);
    g.strokeStyle = U().hexA(p.ink, 0.45); g.lineWidth = 1.2;                  // its five vertical ridges
    for (let i = 0; i < 5; i++) {
      const u = -0.8 + i * 0.4, x = sx + u * R * 0.42;
      g.beginPath(); g.moveTo(x, cy - R * 0.74); g.lineTo(x, cy + R * 0.74); g.stroke();
    }
    for (let i = 0; i < 5; i++) {                      // folded fan-wings around the waist
      const a = (i / 5) * Math.PI * 2 + 0.3, fl = R * (0.34 + 0.2 * v.tense);
      g.save(); g.globalAlpha = 0.75; g.fillStyle = p.pale;
      g.beginPath(); g.ellipse(sx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.2, fl, R * 0.13, a * 0.4, 0, Math.PI * 2);
      g.fill(); inked(g, p, 1.2); g.restore();
    }
    const hy = cy - R * (0.95 + v.lift * 0.12);        // the starfish head, five arms, an eye on each
    g.fillStyle = p.body; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, rr = (i % 2 ? R * 0.16 : R * 0.42);
      g.lineTo(sx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.72);
    }
    g.closePath(); g.fill(); inked(g, p, 1.6);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + Math.sin(t * 0.7) * 0.05;
      const ex = sx + Math.cos(a) * R * 0.34, ey = hy + Math.sin(a) * R * 0.25;
      g.fillStyle = p.pale; g.beginPath(); g.arc(ex, ey, R * 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.eye; g.beginPath(); g.arc(ex, ey, R * 0.05, 0, Math.PI * 2); g.fill();
    }
  }

  /** C. Ghast. Lovecraft, The Dream-Quest of Unknown Kadath: the kangaroo-
   *  gaited things of the lightless vaults, which the gugs hunt. Prey by
   *  canon, and faceless, which suits a world where nothing has a face. */
  function ghast(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed;
    const bound = v.stride ? Math.abs(Math.sin(t * 2)) : 0, lift = bound * R * 0.5;
    const cy = sy - R * 0.72 - lift;
    pool(g, sx, sy, R * (0.9 - bound * 0.3), p);
    g.strokeStyle = p.deep; g.lineCap = "round"; g.lineWidth = R * 0.16;       // heavy haunches and hooves
    for (const d of [-1, 1]) {
      const kx = sx + d * R * 0.3, ky = cy + R * 0.5;
      g.beginPath(); g.moveTo(kx, ky);
      g.quadraticCurveTo(kx + d * R * 0.42, ky + R * 0.3 - lift * 0.4, kx + d * R * 0.2, sy - 1 - lift * 0.8);
      g.stroke();
    }
    g.beginPath(); g.ellipse(sx, cy, R * 0.52, R * 0.62, -0.15, 0, Math.PI * 2);
    const grd = g.createLinearGradient(0, cy - R * 0.6, 0, cy + R * 0.6);
    grd.addColorStop(0, p.pale); grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill(); inked(g, p);
    g.strokeStyle = p.deep; g.lineWidth = R * 0.1;                             // small forelimbs, held up
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(sx + d * R * 0.24, cy + R * 0.05); g.lineTo(sx + d * R * 0.42, cy + R * 0.3 - v.tense * R * 0.1); g.stroke(); }
    const hx = sx + R * 0.36, hy = cy - R * (0.5 + v.lift * 0.22);             // a blank sloped head, no eyes
    g.fillStyle = p.body; g.beginPath();
    g.moveTo(hx - R * 0.3, hy + R * 0.2); g.quadraticCurveTo(hx + R * 0.36, hy - R * 0.12, hx + R * 0.24, hy + R * 0.28);
    g.closePath(); g.fill(); inked(g, p, 1.6);
    g.strokeStyle = p.ink; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(hx - R * 0.02, hy + R * 0.2); g.lineTo(hx + R * 0.22, hy + R * 0.24); g.stroke();
  }

  /** D. Thoat. Burroughs, A Princess of Mars (1912): the eight-legged herd
   *  beast of the dead sea bottoms. The one design here that reads as cattle
   *  from any distance, which is what a grazer has to do. */
  function thoat(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed, cy = sy - R * 0.66;
    pool(g, sx, sy, R * 1.1, p);
    g.strokeStyle = p.deep; g.lineCap = "round"; g.lineWidth = R * 0.1;        // eight legs, in two banks of four
    for (let i = 0; i < 8; i++) {
      const d = i < 4 ? -1 : 1, j = i % 4;
      const lx = sx - R * 0.6 + j * R * 0.4 + d * R * 0.06;
      const swing = v.stride ? Math.sin(t * 3 + i * 1.4) * R * 0.16 : 0;
      g.beginPath(); g.moveTo(lx, cy + R * 0.3); g.lineTo(lx + swing, sy - 1); g.stroke();
    }
    g.beginPath(); g.ellipse(sx, cy, R * 0.82, R * 0.38, 0, 0, Math.PI * 2);   // a broad slate body
    const grd = g.createLinearGradient(0, cy - R * 0.4, 0, cy + R * 0.4);
    grd.addColorStop(0, p.pale); grd.addColorStop(1, p.deep);
    g.fillStyle = grd; g.fill(); inked(g, p);
    g.fillStyle = p.deep; g.beginPath();                                       // the flat tail
    g.moveTo(sx - R * 0.78, cy); g.quadraticCurveTo(sx - R * 1.3, cy - R * 0.1, sx - R * 1.15, cy + R * 0.22);
    g.quadraticCurveTo(sx - R * 0.95, cy + R * 0.16, sx - R * 0.78, cy + R * 0.12); g.closePath(); g.fill(); inked(g, p, 1.4);
    const hx = sx + R * 0.86, hy = cy - R * (0.1 + v.lift * 0.4);              // a small head, down in the flora or up
    g.fillStyle = p.body; g.beginPath(); g.ellipse(hx, hy, R * 0.26, R * 0.2, 0.2, 0, Math.PI * 2); g.fill(); inked(g, p, 1.5);
    g.fillStyle = p.eye; g.beginPath(); g.arc(hx + R * 0.06, hy - R * 0.06, R * 0.05, 0, Math.PI * 2); g.fill();
    if (C.state === "grazing") bead(g, hx + R * 0.18, hy + R * 0.16, 1.4, p.wet);
  }

  /** E. Zoog. Lovecraft, The Dream-Quest of Unknown Kadath: the small furtive
   *  things of the enchanted wood, all eyes and no shape, that swarm and
   *  vanish. Drawn as a knot of three, because one zoog is never one zoog.
   *  They sit ON the ground: the body's base is the ground line, and the only
   *  time one leaves it is mid-bound, when its shadow tightens under it. */
  function zoogs(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed;
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * R * 0.62, scat = v.stride ? Math.sin(t * 2 + k * 2.1) * R * 0.3 : 0;
      const hop = v.stride ? Math.max(0, Math.sin(t * 4 + k * 2.1)) * R * 0.22 : 0;   // bounding: it comes back down
      const bx = sx + off + scat, by = sy - hop;        // the base IS the ground line
      const size = 0.9 + (k === 1 ? 0.18 : 0);
      pool(g, bx, sy, R * 0.34 * (1 - hop / (R * 0.5)), p);
      g.beginPath();                                    // a low furtive tuft, flat on the ground
      for (let i = 0; i <= 18; i++) {
        const a = Math.PI + (i / 18) * Math.PI, rr = R * 0.36 * size * (1 + 0.16 * Math.sin(i * 2.3 + k));
        g.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.9);
      }
      g.closePath();
      g.fillStyle = k === 1 ? p.body : p.deep; g.fill(); inked(g, p, 1.6);
      g.strokeStyle = U().hexA(p.ink, 0.35); g.lineWidth = 1;        // a few tufts of fur at the hem
      for (let i = -2; i <= 2; i++) {
        const fx = bx + i * R * 0.11;
        g.beginPath(); g.moveTo(fx, by); g.lineTo(fx + i * 0.6, by - R * 0.07); g.stroke();
      }
      const eyes = 3 + (k % 2);                         // a ring of small eyes in the fur
      for (let i = 0; i < eyes; i++) {
        const a = Math.PI * (0.25 + (i / (eyes - 1 || 1)) * 0.5);
        const ex = bx + Math.cos(a + Math.PI) * R * 0.18, ey = by - R * 0.2 + Math.sin(a) * R * 0.04;
        if (Math.sin(t * 3 + i * 2 + k * 5) <= -0.7) continue;       // they blink out of step
        g.fillStyle = p.pale; g.beginPath(); g.arc(ex, ey, R * 0.07, 0, Math.PI * 2); g.fill();
        g.fillStyle = p.eye; g.beginPath(); g.arc(ex, ey, R * 0.035, 0, Math.PI * 2); g.fill();
      }
    }
  }

  /** F. Selenite. Wells, The First Men in the Moon (1901): the insectoid
   *  moon-dwellers who herd the mooncalves. Not prey exactly: a herder, which
   *  gives the flock a reason to be a flock and the shoggoth something to
   *  interrupt. */
  function selenite(C) {
    const g = C.g, sx = C.sx, sy = C.sy, R = C.R0 || 18, p = C.pal, v = gait(C.state);
    const t = RM() ? 0 : C.t * v.speed, cy = sy - R * 0.95;
    pool(g, sx, sy, R * 0.6, p);
    g.strokeStyle = p.deep; g.lineCap = "round"; g.lineWidth = R * 0.075;      // thin insect limbs
    for (let i = 0; i < 4; i++) {
      const d = i < 2 ? -1 : 1, j = i % 2;
      const swing = v.stride ? Math.sin(t * 3 + i) * R * 0.12 : 0;
      g.beginPath(); g.moveTo(sx + d * R * 0.12, cy + R * 0.42);
      g.quadraticCurveTo(sx + d * R * (0.4 + j * 0.1), cy + R * 0.6, sx + d * R * 0.3 + swing, sy - 1); g.stroke();
    }
    g.beginPath(); g.ellipse(sx, cy + R * 0.12, R * 0.3, R * 0.46, 0, 0, Math.PI * 2);   // a narrow carapace
    g.fillStyle = p.deep; g.fill(); inked(g, p, 1.8);
    g.beginPath(); g.ellipse(sx, cy - R * (0.5 + v.lift * 0.1), R * 0.36, R * 0.32, 0, 0, Math.PI * 2);   // the great glassy helm
    g.fillStyle = U().hexA(p.pale, 0.85); g.fill(); inked(g, p, 1.8);
    g.save(); g.globalAlpha = 0.5; g.fillStyle = "#fff";
    g.beginPath(); g.ellipse(sx - R * 0.12, cy - R * 0.6, R * 0.1, R * 0.06, -0.5, 0, Math.PI * 2); g.fill(); g.restore();
    for (let i = -1; i <= 1; i += 2) bead(g, sx + i * R * 0.13, cy - R * 0.5, R * 0.05, p.wet);
    g.strokeStyle = p.ink; g.lineWidth = R * 0.07;     // the goad it drives the flock with
    g.beginPath(); g.moveTo(sx + R * 0.26, cy + R * 0.5); g.lineTo(sx + R * 0.62, cy - R * 0.5 - v.lift * R * 0.2); g.stroke();
    bead(g, sx + R * 0.62, cy - R * 0.5 - v.lift * R * 0.2, R * 0.07, p.wet);
  }

  window.MH_PREY = {
    palettes, gait,
    variants: [
      { id: "mooncalf", label: "A. Mooncalf", source: "Wells, 1901", note: "lunar cattle, grazing the fungus", draw: mooncalf },
      { id: "elder", label: "B. Elder Thing", source: "Lovecraft, 1936", note: "the shoggoths' makers, now the hunted", draw: elderThing },
      { id: "ghast", label: "C. Ghast", source: "Lovecraft, Dream-Quest", note: "kangaroo-gaited, faceless, prey by canon", draw: ghast },
      { id: "thoat", label: "D. Thoat", source: "Burroughs, 1912", note: "eight-legged herd beast; reads as cattle at any size", draw: thoat },
      { id: "zoog", label: "E. Zoogs", source: "Lovecraft, Dream-Quest", note: "all eyes and no shape; never just one. Adopted", draw: zoogs },
      { id: "selenite", label: "F. Selenite", source: "Wells, 1901", note: "a herder, not prey: it gives the flock a reason", draw: selenite },
    ],
  };
})();
