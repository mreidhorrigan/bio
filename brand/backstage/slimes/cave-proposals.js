// @ts-check
"use strict";
/* ============================================================================
   cave-proposals.js — the painters for cave-proposals.html.

   The whole glossary is underground. These are proposals for what the two
   halves of it look like: the near half, where M.'s own coinages stand, and the
   far half, where the machine's words hang. Each option paints both, so the
   pair can be judged as a pair.

   Nothing here is wired into the site. glossary-world.js still draws the world
   that ships; if an option is chosen, its painter moves there.

   The second set is the way in: the Glossary house on the Public Writing road,
   which today is an ordinary slime dwelling and should be a door in the ground.
   ========================================================================== */
(function () {
  const S2 = window.MH_SLIME2D;

  /* ---- small tools, local so nothing depends on the engine's quirks -------- */
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")";
  }
  function rgba(h, a) { const c = hex(h); return "rgba(" + c.join(",") + "," + a + ")"; }

  /** The floor of a cave, and its roof. Both are seeded wobbles, not noise, so
   *  a panel looks the same every time it is painted. */
  const floorAt = (x, base, amp, seed) => base
    - amp * (0.55 * Math.sin(x * 0.031 + seed) + 0.3 * Math.sin(x * 0.079 + seed * 2.1)
      + 0.16 * Math.sin(x * 0.17 + seed * 3.3));
  const roofAt = (x, base, amp, seed) => base
    + amp * (0.5 * Math.sin(x * 0.027 + seed * 1.7) + 0.32 * Math.sin(x * 0.066 + seed)
      + 0.18 * Math.sin(x * 0.15 + seed * 2.6));

  function fillFloor(g, w, h, base, amp, seed, fill, ink) {
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) g.lineTo(x, floorAt(x, base, amp, seed));
    g.lineTo(w, h); g.closePath(); g.fillStyle = fill; g.fill();
    g.strokeStyle = ink; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath();
    for (let x = 0; x <= w; x += 3) { const y = floorAt(x, base, amp, seed); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  function fillRoof(g, w, base, amp, seed, fill, ink) {
    g.beginPath(); g.moveTo(0, -20);
    for (let x = 0; x <= w; x += 3) g.lineTo(x, roofAt(x, base, amp, seed));
    g.lineTo(w, -20); g.closePath(); g.fillStyle = fill; g.fill();
    g.strokeStyle = ink; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath();
    for (let x = 0; x <= w; x += 3) { const y = roofAt(x, base, amp, seed); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }

  /** A word on a board, so each option shows what reading in it is like. */
  function board(g, x, y, label, o) {
    g.font = o.font; g.textAlign = "center"; g.textBaseline = "middle";
    const w = g.measureText(label).width + 20, hh = 30;
    if (o.post) {
      g.strokeStyle = o.ink; g.lineWidth = 4.5; g.lineCap = "round";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40); g.stroke();
      g.strokeStyle = o.postFill; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, y - 1); g.lineTo(x, y - 39); g.stroke();
    } else {
      g.save(); g.setLineDash([3, 5]); g.strokeStyle = o.postFill; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y - 40 - hh); g.lineTo(x, y - 40 - hh - 26); g.stroke(); g.restore();
    }
    const top = y - 40 - hh;
    rr(g, x - w / 2, top, w, hh, o.radius);
    g.fillStyle = o.board; g.fill();
    g.strokeStyle = o.rule; g.lineWidth = o.ruleWidth; g.stroke();
    if (o.glow) {
      g.save(); g.shadowColor = o.text; g.shadowBlur = 9;
      g.fillStyle = o.text; g.beginPath(); g.arc(x, top + 1, 1.8, 0, TAU); g.fill(); g.restore();
    }
    g.fillStyle = o.text; g.fillText(label, x, top + hh / 2 + 1);
  }

  /** The slime, standing on the floor it is given. */
  function slime(g, x, base, amp, seed, t) {
    if (!S2) return;
    const ground = (xx) => floorAt(xx, base, amp, seed);
    S2.paint(g, { x, y: ground(x), r: 14, ground, tension: 0.55, contact: 1,
      squash: Math.sin(t * 3.2) * 0.09, gaze: [0.5, -0.7] });
  }

  /* ---- decoration ---------------------------------------------------------- */

  /** A vine: hangs from the roof, and roots into the floor if it is long enough. */
  function vine(g, x, from, to, t, o) {
    const sway = Math.sin(t * 0.7 + x * 0.03) * o.sway;
    g.strokeStyle = o.cord; g.lineWidth = o.width; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, from);
    g.bezierCurveTo(x + sway, from + (to - from) * 0.4, x - sway, from + (to - from) * 0.75, x + sway * 0.4, to);
    g.stroke();
    if (o.leaf) {
      const n = Math.max(2, Math.round((to - from) / 26));
      for (let i = 1; i <= n; i++) {
        const u = i / (n + 1), y = from + (to - from) * u;
        const lx = x + sway * (u < 0.5 ? u * 2 : (1 - u) * 1.4) + (i % 2 ? 1 : -1) * 3;
        g.fillStyle = o.leaf;
        g.beginPath();
        g.ellipse(lx + (i % 2 ? 4 : -4), y, 5.2, 2.6, (i % 2 ? -0.5 : 0.5), 0, TAU);
        g.fill();
        g.strokeStyle = o.ink; g.lineWidth = 0.9; g.stroke();
      }
    }
  }

  /** Daylight coming down through a crack, and the bright patch it lands on. */
  function shaft(g, x, roofY, floorY, o) {
    const grad = g.createLinearGradient(0, roofY, 0, floorY);
    grad.addColorStop(0, rgba(o.light, 0.34)); grad.addColorStop(1, rgba(o.light, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - o.top, roofY); g.lineTo(x + o.top, roofY);
    g.lineTo(x + o.foot, floorY); g.lineTo(x - o.foot, floorY);
    g.closePath(); g.fill();
    g.fillStyle = rgba(o.light, 0.20);
    g.beginPath(); g.ellipse(x, floorY, o.foot, 3.4, 0, 0, TAU); g.fill();
  }

  function moss(g, x, y, r, a, b, ink) {
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const th = Math.PI + (i / 12) * Math.PI, rr2 = r * (1 + 0.18 * Math.sin(i * 2.7));
      const vx = x + Math.cos(th) * rr2, vy = y + Math.sin(th) * rr2 * 0.5;
      i ? g.lineTo(vx, vy) : g.moveTo(vx, vy);
    }
    g.closePath();
    const grad = g.createLinearGradient(0, y - r * 0.5, 0, y);
    grad.addColorStop(0, a); grad.addColorStop(1, b);
    g.fillStyle = grad; g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
  }

  function stalactite(g, x, y, len, fill, ink) {
    g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x, y + len); g.lineTo(x + 5, y - 1); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
  }

  function drip(g, x, roofY, floorY, t, phase, col) {
    const u = ((t * 0.55 + phase) % 1);
    const y = roofY + (floorY - roofY) * u * u;
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, 1.3, 2.6, 0, 0, TAU); g.fill();
    if (u > 0.94) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.arc(x, floorY, (u - 0.94) * 90, 0, Math.PI, true); g.stroke(); }
  }

  function prop(g, x, floorY, roofY, wood, ink) {         // a mine timber
    const top = roofY + 6;
    g.fillStyle = wood; g.strokeStyle = ink; g.lineWidth = 1.6;
    g.beginPath(); g.rect(x - 4, top, 8, floorY - top); g.fill(); g.stroke();
    g.beginPath(); g.rect(x - 16, top - 7, 32, 8); g.fill(); g.stroke();
    g.strokeStyle = rgba(ink, 0.5); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - 4, top + 14); g.lineTo(x + 4, floorY - 10); g.stroke();
  }

  function rails(g, w, floorAtFn, col, ink) {
    for (const off of [-5, 5]) {
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = floorAtFn(x) - 2 + off * 0.35; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = ink; g.lineWidth = 3;
    for (let x = 8; x < w; x += 22) {
      const y = floorAtFn(x) - 1;
      g.beginPath(); g.moveTo(x - 9, y + 2); g.lineTo(x + 9, y - 1); g.stroke();
    }
  }

  function lamp(g, x, y, col, ink) {
    g.strokeStyle = ink; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x, y - 12); g.stroke();
    g.save(); g.shadowColor = col; g.shadowBlur = 16;
    g.fillStyle = col; g.beginPath(); g.arc(x, y - 7, 4.4, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = ink; g.lineWidth = 1.4;
    g.beginPath(); g.arc(x, y - 7, 5.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }

  function shelf(g, x, y, r, a, ink) {                    // a fungal bracket on the wall
    g.beginPath(); g.ellipse(x, y, r, r * 0.42, -0.18, Math.PI, TAU); g.closePath();
    g.fillStyle = a; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
  }

  function pool(g, w, floorAtFn, level, col, ink) {
    g.beginPath(); g.moveTo(0, level);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, Math.max(level, floorAtFn(x)));
    g.lineTo(w, level); g.closePath();
    g.fillStyle = col; g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, level); g.lineTo(w, level); g.stroke();
  }

  /* ---- the three options, each in both halves ----------------------------- */

  const OPTIONS = [
    {
      key: "grown",
      name: "A. The grown cave and the dead cave",
      note: "One cave in two states. The far half is the near half after the life has left it: the same vines, dried to cordage, the same mounds gone to grit.",
      near(g, w, h, t) {
        const base = h * 0.80, amp = 16, roof = h * 0.20, ramp = 13;
        g.fillStyle = "#1d2a20"; g.fillRect(0, 0, w, h);
        const air = g.createLinearGradient(0, roof, 0, base);
        air.addColorStop(0, "#2c4633"); air.addColorStop(1, "#1b2a20");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        shaft(g, w * 0.26, roofAt(w * 0.26, roof, ramp, 1.2), floorAt(w * 0.26, base, amp, 2.4),
          { light: "#cfeeb6", top: 9, foot: 30 });
        fillRoof(g, w, roof, ramp, 1.2, "#3b3428", "rgba(12,18,12,0.85)");
        for (let i = 0; i < 7; i++) {
          const x = 18 + i * (w - 36) / 6;
          const from = roofAt(x, roof, ramp, 1.2), to = from + 40 + ((i * 37) % 60);
          vine(g, x, from, Math.min(to, floorAt(x, base, amp, 2.4) - 2), t,
            { cord: "#4f7d4a", leaf: "#7fb46a", ink: "rgba(12,18,12,0.7)", width: 2.4, sway: 5 });
        }
        fillFloor(g, w, h, base, amp, 2.4, "#4a4436", "rgba(12,18,12,0.85)");
        for (let i = 0; i < 4; i++) {
          const x = 26 + i * (w - 52) / 3;
          moss(g, x, floorAt(x, base, amp, 2.4) + 1, 22, "#5d9152", "#3c6438", "rgba(12,18,12,0.8)");
        }
        board(g, w * 0.56, floorAt(w * 0.56, base, amp, 2.4) - 6, "truins",
          { font: '600 12px Tahoma, Arial, sans-serif', board: "#f6f4ee", rule: "rgba(12,18,12,0.85)",
            ruleWidth: 1.6, text: "#1a1a1a", ink: "rgba(12,18,12,0.85)", postFill: "#8b8172", post: true, radius: 7 });
        slime(g, w * 0.30, base, amp, 2.4, t);
      },
      far(g, w, h, t) {
        const base = h * 0.80, amp = 16, roof = h * 0.20, ramp = 13;
        g.fillStyle = "#0b100c"; g.fillRect(0, 0, w, h);
        const air = g.createLinearGradient(0, roof, 0, base);
        air.addColorStop(0, "#161d16"); air.addColorStop(1, "#0a0e0a");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        fillRoof(g, w, roof, ramp, 1.2, "#23261c", "rgba(190,208,226,0.4)");
        for (let i = 0; i < 7; i++) {
          const x = 18 + i * (w - 36) / 6;
          const from = roofAt(x, roof, ramp, 1.2), to = from + 26 + ((i * 37) % 44);
          vine(g, x, from, to, t, { cord: "#5c5a46", leaf: null, ink: null, width: 1.6, sway: 2 });
        }
        fillFloor(g, w, h, base, amp, 2.4, "#23261c", "rgba(190,208,226,0.4)");
        for (let i = 0; i < 4; i++) {
          const x = 26 + i * (w - 52) / 3;
          moss(g, x, floorAt(x, base, amp, 2.4) + 1, 20, "#3a3b30", "#24261e", "rgba(190,208,226,0.35)");
        }
        board(g, w * 0.56, floorAt(w * 0.56, base, amp, 2.4) - 6, "Maintenance",
          { font: '700 12px "Iowan Old Style", Palatino, Georgia, serif', board: "#11180f", rule: "#3a8a82",
            ruleWidth: 1.6, text: "#caa24a", ink: "rgba(190,208,226,0.4)", postFill: "#3a8a82", post: false,
            radius: 4, glow: true });
        slime(g, w * 0.30, base, amp, 2.4, t);
      },
    },
    {
      key: "tended",
      name: "B. The greenhouse and the mine",
      note: "Two kinds of work rather than two conditions of one plant. The near half is cultivated, on a trellis under skylights; the far half is cut, propped and railed.",
      near(g, w, h, t) {
        const base = h * 0.80, amp = 12, roof = h * 0.22, ramp = 8;
        const air = g.createLinearGradient(0, 0, 0, h);
        air.addColorStop(0, "#d8ecd2"); air.addColorStop(1, "#2a3a2a");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        for (const fx of [0.2, 0.5, 0.8]) {
          shaft(g, w * fx, roofAt(w * fx, roof, ramp, 0.4), floorAt(w * fx, base, amp, 1.1),
            { light: "#ffffff", top: 11, foot: 26 });
        }
        fillRoof(g, w, roof, ramp, 0.4, "#4a4436", "rgba(12,18,12,0.85)");
        for (const fx of [0.2, 0.5, 0.8]) {                 // the skylights themselves
          const x = w * fx, y = roofAt(x, roof, ramp, 0.4);
          g.fillStyle = "#e9f6e4"; g.strokeStyle = "rgba(12,18,12,0.85)"; g.lineWidth = 2;
          rr(g, x - 13, y - 9, 26, 12, 4); g.fill(); g.stroke();
        }
        g.strokeStyle = "#6b6257"; g.lineWidth = 2;         // the trellis
        for (let x = 12; x < w; x += 24) {
          g.beginPath(); g.moveTo(x, roofAt(x, roof, ramp, 0.4) + 6);
          g.lineTo(x, floorAt(x, base, amp, 1.1) - 26); g.stroke();
        }
        for (let y = roof + 26; y < base - 24; y += 22) {
          g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke();
        }
        for (let i = 0; i < 6; i++) {                       // vines trained along it
          const x = 16 + i * (w - 32) / 5;
          vine(g, x, roofAt(x, roof, ramp, 0.4) + 8, floorAt(x, base, amp, 1.1) - 24, t,
            { cord: "#4f7d4a", leaf: "#8cc178", ink: "rgba(12,18,12,0.7)", width: 2.2, sway: 2.5 });
        }
        fillFloor(g, w, h, base, amp, 1.1, "#5b513f", "rgba(12,18,12,0.85)");
        for (let i = 0; i < 4; i++) {                       // kerbed beds
          const x = 24 + i * (w - 48) / 3, fy = floorAt(x, base, amp, 1.1);
          g.fillStyle = "#8b8172"; g.strokeStyle = "rgba(12,18,12,0.85)"; g.lineWidth = 1.5;
          rr(g, x - 20, fy - 7, 40, 8, 3); g.fill(); g.stroke();
          moss(g, x, fy - 6, 17, "#68a057", "#43704040", "rgba(12,18,12,0.8)");
        }
        board(g, w * 0.56, floorAt(w * 0.56, base, amp, 1.1) - 12, "truins",
          { font: '600 12px Tahoma, Arial, sans-serif', board: "#f6f4ee", rule: "rgba(12,18,12,0.85)",
            ruleWidth: 1.6, text: "#1a1a1a", ink: "rgba(12,18,12,0.85)", postFill: "#8b8172", post: true, radius: 7 });
        slime(g, w * 0.30, base, amp, 1.1, t);
      },
      far(g, w, h, t) {
        const base = h * 0.80, amp = 7, roof = h * 0.30, ramp = 4;
        g.fillStyle = "#0a0d0a"; g.fillRect(0, 0, w, h);
        const air = g.createLinearGradient(0, roof, 0, base);
        air.addColorStop(0, "#191d17"); air.addColorStop(1, "#0b0e0b");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        fillRoof(g, w, roof, ramp, 0.9, "#20241b", "rgba(190,208,226,0.4)");
        g.fillStyle = "#3a2f21"; g.strokeStyle = "rgba(190,208,226,0.35)"; g.lineWidth = 1.4;
        for (let x = 6; x < w; x += 26) {                    // the dropped ceiling
          const y = roofAt(x, roof, ramp, 0.9) + 5;
          g.beginPath(); g.rect(x - 11, y, 22, 6); g.fill(); g.stroke();
        }
        fillFloor(g, w, h, base, amp, 0.6, "#1f2319", "rgba(190,208,226,0.4)");
        rails(g, w, (x) => floorAt(x, base, amp, 0.6), "#7b8390", "rgba(190,208,226,0.45)");
        for (const fx of [0.13, 0.42, 0.72, 0.95]) {
          prop(g, w * fx, floorAt(w * fx, base, amp, 0.6), roofAt(w * fx, roof, ramp, 0.9), "#3a2f21", "rgba(190,208,226,0.4)");
        }
        lamp(g, w * 0.24, floorAt(w * 0.24, base, amp, 0.6) - 40, "#caa24a", "rgba(190,208,226,0.55)");
        board(g, w * 0.58, floorAt(w * 0.58, base, amp, 0.6) - 6, "Maintenance",
          { font: '700 12px "Iowan Old Style", Palatino, Georgia, serif', board: "#11180f", rule: "#3a8a82",
            ruleWidth: 1.6, text: "#caa24a", ink: "rgba(190,208,226,0.4)", postFill: "#3a8a82", post: false,
            radius: 4, glow: true });
        slime(g, w * 0.32, base, amp, 0.6, t);
      },
    },
    {
      key: "reef",
      name: "C. The reef and the deep",
      note: "Wet and crowded, then airless and still. The near half drips, grows shelves and holds a shallow pool the slime wades; the far half is the same cave with the water gone.",
      near(g, w, h, t) {
        const base = h * 0.82, amp = 14, roof = h * 0.18, ramp = 12;
        g.fillStyle = "#0e2a2c"; g.fillRect(0, 0, w, h);
        const air = g.createLinearGradient(0, roof, 0, base);
        air.addColorStop(0, "#1c4a48"); air.addColorStop(1, "#0d2427");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        shaft(g, w * 0.72, roofAt(w * 0.72, roof, ramp, 2.2), floorAt(w * 0.72, base, amp, 3.1),
          { light: "#9fe8d6", top: 8, foot: 26 });
        fillRoof(g, w, roof, ramp, 2.2, "#2d3a33", "rgba(8,20,20,0.85)");
        for (let i = 0; i < 9; i++) {
          const x = 14 + i * (w - 28) / 8;
          stalactite(g, x, roofAt(x, roof, ramp, 2.2), 7 + ((i * 29) % 13), "#2d3a33", "rgba(8,20,20,0.8)");
        }
        for (let i = 0; i < 5; i++) {
          const x = 22 + i * (w - 44) / 4;
          shelf(g, x, roofAt(x, roof, ramp, 2.2) + 26 + (i % 2) * 18, 13, "#5fbfa2", "rgba(8,20,20,0.8)");
        }
        fillFloor(g, w, h, base, amp, 3.1, "#3d4a42", "rgba(8,20,20,0.85)");
        pool(g, w, (x) => floorAt(x, base, amp, 3.1), base - 4, "rgba(110,220,200,0.36)", "rgba(180,255,240,0.6)");
        for (let i = 0; i < 5; i++) drip(g, 20 + i * (w - 40) / 4, roof + 14, base - 6, t, i * 0.21, "rgba(180,255,240,0.8)");
        board(g, w * 0.56, floorAt(w * 0.56, base, amp, 3.1) - 8, "truins",
          { font: '600 12px Tahoma, Arial, sans-serif', board: "#eef6f3", rule: "rgba(8,20,20,0.85)",
            ruleWidth: 1.6, text: "#123", ink: "rgba(8,20,20,0.85)", postFill: "#7fae9c", post: true, radius: 7 });
        slime(g, w * 0.30, base, amp, 3.1, t);
      },
      far(g, w, h, t) {
        const base = h * 0.82, amp = 14, roof = h * 0.18, ramp = 12;
        g.fillStyle = "#070b08"; g.fillRect(0, 0, w, h);
        const air = g.createLinearGradient(0, roof, 0, base);
        air.addColorStop(0, "#12160f"); air.addColorStop(1, "#080b08");
        g.fillStyle = air; g.fillRect(0, 0, w, h);
        fillRoof(g, w, roof, ramp, 2.2, "#23261c", "rgba(190,208,226,0.4)");
        for (let i = 0; i < 9; i++) {
          const x = 14 + i * (w - 28) / 8;
          stalactite(g, x, roofAt(x, roof, ramp, 2.2), 7 + ((i * 29) % 13), "#23261c", "rgba(190,208,226,0.35)");
        }
        for (let i = 0; i < 5; i++) {
          const x = 22 + i * (w - 44) / 4;
          shelf(g, x, roofAt(x, roof, ramp, 2.2) + 26 + (i % 2) * 18, 12, "#2a3128", "rgba(190,208,226,0.3)");
        }
        fillFloor(g, w, h, base, amp, 3.1, "#1f2319", "rgba(190,208,226,0.4)");
        g.fillStyle = "rgba(90,110,100,0.16)";               // the tidemark the water left
        g.beginPath(); g.moveTo(0, base - 4); g.lineTo(w, base - 4); g.lineTo(w, base - 1); g.lineTo(0, base - 1);
        g.closePath(); g.fill();
        board(g, w * 0.56, floorAt(w * 0.56, base, amp, 3.1) - 8, "Maintenance",
          { font: '700 12px "Iowan Old Style", Palatino, Georgia, serif', board: "#11180f", rule: "#3a8a82",
            ruleWidth: 1.6, text: "#caa24a", ink: "rgba(190,208,226,0.4)", postFill: "#3a8a82", post: false,
            radius: 4, glow: true });
        slime(g, w * 0.30, base, amp, 3.1, t);
      },
    },
  ];

  /* ---- the way in: the Glossary house, in the village's own projection ---- */

  const TW = 96, TH = 48;                                   // the engine's tile
  function tile(g, sx, sy, fill, ink) {
    g.beginPath();
    g.moveTo(sx, sy - TH / 2); g.lineTo(sx + TW / 2, sy); g.lineTo(sx, sy + TH / 2); g.lineTo(sx - TW / 2, sy);
    g.closePath(); g.fillStyle = fill; g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
  }
  /** the black of a hole, with a little depth to it */
  function hole(g, sx, sy, rx, ry) {
    const grad = g.createRadialGradient(sx, sy, 1, sx, sy, rx);
    grad.addColorStop(0, "#000"); grad.addColorStop(0.7, "#0a0f0b"); grad.addColorStop(1, "#1a2019");
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, TAU); g.fill();
  }

  /** The daylight the village is seen in, so a door panel is not a white void. */
  function village(g, w, h) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#dff0e6"); sky.addColorStop(1, "#bcd9c4");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#a9c8b6";                                // a far rise, for depth
    g.beginPath(); g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 6) g.lineTo(x, h * 0.62 - 9 * Math.sin(x * 0.02) - 4 * Math.sin(x * 0.05 + 1));
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  }

  const DOORS = [
    {
      key: "cellar",
      name: "A cellar door",
      note: "A low slab in a mound, its whole front a pair of doors lying almost flat, standing open onto black. The least new geometry, and the doors can tip open as the slime arrives.",
      draw(g, w, h, t) {
        const sx = w / 2, sy = h * 0.68;
        village(g, w, h);
        tile(g, sx, sy + 16, "#6f9a63", "rgba(22,38,28,0.8)");
        g.fillStyle = "#5d8a53"; g.strokeStyle = "rgba(22,38,28,0.85)"; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(sx, sy + 6, 46, 20, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
        hole(g, sx, sy - 2, 26, 11);
        const lift = 0.6 + 0.4 * Math.sin(t * 0.8);
        for (const side of [-1, 1]) {                       // the two leaves, tipped open
          g.save();
          g.translate(sx + side * 13, sy - 4);
          g.transform(1, 0, side * -0.55 * lift, 1, 0, 0);
          g.fillStyle = side < 0 ? "#6b5a3f" : "#7a6747";
          g.strokeStyle = "rgba(22,38,28,0.9)"; g.lineWidth = 1.8;
          g.beginPath(); g.rect(-13, -26 * lift, 26, 26 * lift); g.fill(); g.stroke();
          g.strokeStyle = "rgba(22,38,28,0.45)"; g.lineWidth = 1;
          for (let i = -8; i <= 8; i += 8) { g.beginPath(); g.moveTo(i, -26 * lift + 2); g.lineTo(i, -2); g.stroke(); }
          g.restore();
        }
        g.fillStyle = "#4f7d4a";                            // grass creeping over the lip
        for (let i = -3; i <= 3; i++) {
          g.beginPath(); g.ellipse(sx + i * 12, sy + 8, 5, 2.4, i * 0.2, 0, TAU); g.fill();
        }
        if (S2) S2.paint(g, { x: sx - 40, y: sy + 18, r: 12, contact: 1, squash: Math.sin(t * 3.2) * 0.09, gaze: [1, -0.3] });
      },
    },
    {
      key: "wellhead",
      name: "A wellhead (chosen, and now in the village)",
      note: "A gel collar of rounded lobes round a black shaft, a domed cap on two bowed posts, a windlass and a rope going down. Every shape is rounded, because nothing in the slimeverse has a corner. This is what engine.js now draws for the Glossary house.",
      draw(g, w, h, t) {
        const sx = w / 2, sy = h * 0.68, gel = "#4FA373", ink = "#16261c";
        const shd = (c, k) => {                              // lighten or darken a hex
          const n = parseInt(c.slice(1), 16), f = k < 0 ? 0 : 255, u = Math.abs(k);
          const r = Math.round(((n >> 16) - f) * (1 - u) + f), gg = Math.round((((n >> 8) & 255) - f) * (1 - u) + f);
          const bb = Math.round(((n & 255) - f) * (1 - u) + f);
          return "rgb(" + r + "," + gg + "," + bb + ")";
        };
        village(g, w, h);
        tile(g, sx, sy + 14, "#6f9a63", "rgba(22,38,28,0.8)");
        const hole = g.createRadialGradient(sx, sy - 6, 2, sx, sy - 6, 30);
        hole.addColorStop(0, "#050806"); hole.addColorStop(0.62, "#0b120d"); hole.addColorStop(1, shd(gel, -0.62));
        g.fillStyle = hole;
        g.beginPath(); g.ellipse(sx, sy - 6, 30, 13, 0, 0, TAU); g.fill();
        for (let i = 0; i < 11; i++) {                       // the collar, lobe by lobe
          const a2 = (i / 11) * TAU, lx = sx + Math.cos(a2) * 33, ly = sy - 6 + Math.sin(a2) * 14.5;
          const lg = g.createLinearGradient(0, ly - 7, 0, ly + 6);
          lg.addColorStop(0, shd(gel, 0.24)); lg.addColorStop(1, shd(gel, -0.26));
          g.fillStyle = lg;
          g.beginPath(); g.ellipse(lx, ly, 8, 6.2, a2, 0, TAU); g.fill();
          g.lineWidth = 1.6; g.strokeStyle = ink; g.stroke();
        }
        g.fillStyle = "rgba(255,255,255,0.3)";
        g.beginPath(); g.ellipse(sx - 12, sy + 4, 7, 2.6, -0.3, 0, TAU); g.fill();
        g.lineCap = "round"; g.lineJoin = "round";
        for (const side of [-1, 1]) {                        // bowed posts
          g.strokeStyle = ink; g.lineWidth = 6.5;
          g.beginPath(); g.moveTo(sx + side * 24, sy - 12);
          g.quadraticCurveTo(sx + side * 27, sy - 40, sx + side * 20, sy - 56); g.stroke();
          g.strokeStyle = shd(gel, -0.1); g.lineWidth = 3.6;
          g.beginPath(); g.moveTo(sx + side * 24, sy - 13);
          g.quadraticCurveTo(sx + side * 27, sy - 40, sx + side * 20, sy - 55); g.stroke();
        }
        const cap = g.createLinearGradient(0, sy - 82, 0, sy - 54);
        cap.addColorStop(0, shd(gel, 0.3)); cap.addColorStop(1, shd(gel, -0.22));
        g.fillStyle = cap;
        g.beginPath(); g.moveTo(sx - 30, sy - 54);
        g.quadraticCurveTo(sx, sy - 84, sx + 30, sy - 54);
        g.quadraticCurveTo(sx, sy - 46, sx - 30, sy - 54);
        g.closePath(); g.fill();
        g.lineWidth = 2; g.strokeStyle = ink; g.stroke();
        const sway = Math.sin(t * 0.9) * 2.2;
        g.strokeStyle = ink; g.lineWidth = 5;
        g.beginPath(); g.moveTo(sx - 21, sy - 47); g.lineTo(sx + 21, sy - 47); g.stroke();
        g.strokeStyle = shd(gel, 0.14); g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(sx - 20, sy - 47); g.lineTo(sx + 20, sy - 47); g.stroke();
        g.strokeStyle = ink; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx + 21, sy - 47); g.quadraticCurveTo(sx + 29, sy - 47 + sway, sx + 27, sy - 38 + sway); g.stroke();
        g.strokeStyle = "#d8cfa8"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx, sy - 45); g.quadraticCurveTo(sx + sway * 0.5, sy - 26, sx + sway * 0.3, sy - 8); g.stroke();
        g.fillStyle = shd(gel, -0.34);
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(sx + i * 17, sy + 9, 7, 3, i * 0.2, 0, TAU); g.fill(); }
        if (S2) S2.paint(g, { x: sx - 62, y: sy + 16, r: 12, contact: 1, squash: Math.sin(t * 3.2) * 0.09, gaze: [1, -0.5] });
      },
    },
    {
      key: "lintel",
      name: "A grown-over lintel",
      note: "A stone doorframe with no building behind it, half swallowed by the same vines that hang inside, so the house is the cave's own mouth pushing up through the road.",
      draw(g, w, h, t) {
        const sx = w / 2, sy = h * 0.72;
        village(g, w, h);
        tile(g, sx, sy + 12, "#6f9a63", "rgba(22,38,28,0.8)");
        hole(g, sx, sy - 6, 24, 26);
        g.fillStyle = "#9c9183"; g.strokeStyle = "rgba(22,38,28,0.9)"; g.lineWidth = 1.8;
        for (const side of [-1, 1]) {
          g.beginPath(); g.rect(sx + side * 26 - 7, sy - 44, 14, 50); g.fill(); g.stroke();
        }
        g.beginPath(); g.rect(sx - 38, sy - 54, 76, 14); g.fill(); g.stroke();
        g.fillStyle = "rgba(22,38,28,0.18)";                 // the shadow the lintel throws
        g.beginPath(); g.rect(sx - 24, sy - 40, 48, 6); g.fill();
        for (let i = 0; i < 6; i++) {                        // vines over the frame and down
          const x = sx - 30 + i * 12;
          vine(g, x, sy - 52, sy - 52 + 16 + ((i * 31) % 26), t,
            { cord: "#4f7d4a", leaf: "#7fb46a", ink: "rgba(22,38,28,0.7)", width: 2, sway: 3 });
        }
        g.fillStyle = "#4f7d4a";
        for (let i = -2; i <= 2; i++) {
          g.beginPath(); g.ellipse(sx + i * 15, sy + 8, 6, 2.6, i * 0.25, 0, TAU); g.fill();
        }
        if (S2) S2.paint(g, { x: sx - 52, y: sy + 14, r: 12, contact: 1, squash: Math.sin(t * 3.2) * 0.09, gaze: [1, -0.4] });
      },
    },
  ];

  window.MH_CAVE_PROPOSALS = { options: OPTIONS, doors: DOORS };
})();
