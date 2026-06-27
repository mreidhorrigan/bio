/* buildings.js — procedural SLIME-WORLD dwellings & growths for the MH iso world.
 *
 *   window.MH_BUILD.paint(g, sx, sy, b, env)
 *
 * A re-skin of the old architectural generator (boxes/roofs/window-grids, archived
 * verbatim in detritus/buildings-architectural.js) into an alien GEL / OOZE / SLIME
 * aesthetic that matches the slime KIOSKS and FLORA the themes already draw
 * (paintKiosk / paintProp in theme-technurture.js & theme-technoscure.js): bulbous
 * translucent mounds with a vertical lit gradient, a soft inner glow, a round ooze-
 * doorway, glowing windows, ooze drips, a gel sheen, spore-vents and mould patches.
 *
 * (sx,sy) is the FRONT-BOTTOM screen point of the tile; we grow the body UPWARD from
 * there (smaller y = up). Everything is a pure, deterministic function of (b.tx,b.ty)
 * via env.util.hash01 — the same tile always renders the same dwelling, so nothing
 * flickers. env.t drives only a gentle, small-amplitude gel wobble / ooze sway.
 *
 *   "house" → a bulbous gel mound / cluster (1–3 lobes).
 *   "tree"  → an alien gel GROWTH: a leaning stalk with glowing spore-caps & tendrils.
 *
 * env.util.shade/mix return rgb() (not re-shadeable) and env.util.hexA needs a hex
 * input, so the colour math here is local + hex-native, exactly as the archived
 * version did. No Math.random / Date.now anywhere — only env.util.hash01.
 */
(function () {
  "use strict";

  /* ---- hex colour math: chainable, returns #rrggbb / rgba() --------------- */
  function _p(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function _c(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 255 : v; }
  function _hex(r, g, b) { return "#" + ((1 << 24) + (_c(r) << 16) + (_c(g) << 8) + _c(b)).toString(16).slice(1); }
  /** lighten(amt>0) toward white / darken(amt<0) toward black, amt in ~[-1,1] */
  function shd(h, a) { var c = _p(h), f = a < 0 ? 0 : 255, p = a < 0 ? -a : a; return _hex(c[0] + (f - c[0]) * p, c[1] + (f - c[1]) * p, c[2] + (f - c[2]) * p); }
  function mx(h1, h2, t) { var a = _p(h1), b = _p(h2); return _hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
  function rgba(h, al) { var c = _p(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + al + ")"; }

  /* ---- slime palette: one species, many individuals ----------------------- */
  var GELS  = ["#3fa882", "#46b294", "#3a9c86", "#52ba9c", "#4aae8a", "#5ec4a6", "#3f9e94", "#58b884", "#43a87e", "#4cb0a0"]; // gel bodies (sea-green↔teal↔cyan)
  var GLOWS = ["#9fe6c0", "#aaffe6", "#86ecc6", "#b6ffd8", "#8ff0d6"];                                                       // inner/rim glow
  var WINS  = ["#ffd86a", "#ffcf5a", "#aaffe6", "#bfffd0", "#ffe06a"];                                                       // lit gel windows (mostly warm, some cyan)
  var SPORES = ["#c890ff", "#e6b0ff", "#ffe06a", "#9fe6ff", "#ffb0d8"];                                                      // spore-vents / buds / fruiting dots

  /** nudge a gel hue toward its biome's mood, but keep it legibly slime */
  function biomeGel(hue, biome) {
    switch (biome) {
      case "snow": return mx(hue, "#dff0ee", 0.30);
      case "sand": case "dry": return mx(hue, "#ccd07a", 0.20);
      case "stone": return mx(hue, "#90a298", 0.20);
      case "forest": return mx(hue, "#2f7a4a", 0.18);
      case "grass": return mx(hue, "#4f9a52", 0.12);
      case "water": return mx(hue, "#3fa6c0", 0.20);
      default: return hue;
    }
  }

  /* ---- tiny helpers ------------------------------------------------------- */
  /** a glowing blob: a filled arc wearing a soft shadow-blur halo */
  function glow(g, x, y, r, col, blur, alpha) {
    g.save();
    if (alpha != null) g.globalAlpha = alpha;
    g.shadowColor = col; g.shadowBlur = blur; g.fillStyle = col;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    g.restore();
  }
  function shadowPool(g, cx, cy, rx) {
    g.save(); g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.42, 0, 0, 6.2832); g.fill(); g.restore();
  }

  /** trace (don't fill) a bulbous gel-mound silhouette: bezier shoulders, a pinched
   *  neck/teardrop top, a sagging oozy belly. m carries the shape character. */
  function moundPath(g, cx, baseY, ww, hh, m) {
    var topY = baseY - hh, bulge = Math.min(9, ww * 0.26);
    g.beginPath();
    g.moveTo(cx - ww, baseY);
    g.bezierCurveTo(cx - ww * m.fat, baseY - hh * m.shoulder, cx - ww * m.neck + m.wob, topY, cx + m.wob * 0.6, topY);
    g.bezierCurveTo(cx + ww * m.neck + m.wob, topY, cx + ww * m.fat, baseY - hh * m.shoulder, cx + ww, baseY);
    g.quadraticCurveTo(cx, baseY + bulge, cx - ww, baseY);   // oozy belly across the base
    g.closePath();
  }

  /** one gel lobe: optional ground-ooze pool, vertical gel gradient body, dark ink
   *  silhouette, soft inner glow and an upper-left sheen. */
  function gelLobe(C, L, pool) {
    var g = C.g, hue = L.hue, topY = L.baseY - L.hh;
    if (pool) { g.fillStyle = rgba(shd(hue, -0.26), 0.42); g.beginPath(); g.ellipse(L.cx, L.baseY + 3, L.ww * 1.04, L.ww * 0.40, 0, 0, 6.2832); g.fill(); }
    var grad = g.createLinearGradient(0, topY, 0, L.baseY);
    grad.addColorStop(0, shd(hue, 0.28)); grad.addColorStop(0.5, hue); grad.addColorStop(1, shd(hue, -0.20));
    moundPath(g, L.cx, L.baseY, L.ww, L.hh, L);
    g.fillStyle = grad; g.fill();
    g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = C.ink; g.stroke();          // silhouette outline (env.ink)
    glow(g, L.cx, L.baseY - L.hh * 0.42, L.hh * 0.32, L.glow, 16, 0.40);               // soft inner glow
    g.fillStyle = "rgba(255,255,255,0.22)";                                            // gel sheen, upper-left
    g.beginPath(); g.ellipse(L.cx - L.ww * 0.34, topY + L.hh * 0.26, L.ww * 0.24, L.hh * 0.15, -0.5, 0, 6.2832); g.fill();
  }

  /** a round, dark ooze-doorway arched into the belly, with a faint inner light */
  function oozeDoor(C, L) {
    var g = C.g, dx = L.cx, dy = L.baseY - L.hh * 0.13, rx = L.ww * 0.30, ry = L.hh * 0.20;
    g.fillStyle = rgba(shd(L.hue, -0.62), 0.74);
    g.beginPath(); g.ellipse(dx, dy, rx, ry, 0, Math.PI, 0); g.closePath(); g.fill();
    glow(g, dx, dy - ry * 0.25, rx * 0.46, L.glow, 7, 0.22);
  }

  /** 0–2 glowing windows — lit gel patches with a brighter core */
  function windows(C, L, n) {
    var g = C.g, slots = [[-0.40, 0.52], [0.42, 0.50], [0.02, 0.66]];
    for (var i = 0; i < n; i++) {
      var s = slots[i], col = C.pick(WINS, 70 + i);
      var wx = L.cx + s[0] * L.ww, wy = L.baseY - s[1] * L.hh, wr = L.ww * 0.12;
      g.save(); g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = rgba(col, 0.85);
      g.beginPath(); g.ellipse(wx, wy, wr, wr * 0.86, 0, 0, 6.2832); g.fill(); g.restore();
      g.fillStyle = rgba(shd(col, 0.40), 0.92); g.beginPath(); g.arc(wx - wr * 0.2, wy - wr * 0.2, wr * 0.34, 0, 6.2832); g.fill();
    }
  }

  /** 2–4 ooze drips hanging off the rim, some tipped with a glowing bead */
  function drips(C, L, t) {
    var g = C.g, n = 2 + Math.floor(C.R(80) * 3);
    g.fillStyle = rgba(shd(L.hue, -0.14), 0.94);
    for (var i = 0; i < n; i++) {
      var ddx = L.cx + (C.R(81 + i * 3) - 0.5) * 1.4 * L.ww, ry = L.baseY - 1;
      var len = 5 + C.R(82 + i * 3) * 5 + Math.sin(t * 1.6 + i + L.phase) * 0.8;
      g.beginPath();
      g.moveTo(ddx - 2.4, ry); g.quadraticCurveTo(ddx, ry + len, ddx + 2.4, ry);
      g.lineTo(ddx + 2.4, ry - 5); g.lineTo(ddx - 2.4, ry - 5); g.closePath(); g.fill();
      if (C.R(90 + i) > 0.6) glow(g, ddx, ry + len - 1, 1.4, L.glow, 6, 0.7);
    }
  }

  /** a little spore-vent / bud rising on a short gel neck from the top of a lobe */
  function sporeVent(C, top) {
    var g = C.g, hue = top.hue, cx = top.cx + top.wob * 0.6, ty = top.baseY - top.hh;
    g.strokeStyle = shd(hue, -0.10); g.lineWidth = Math.max(2.4, top.ww * 0.10); g.lineCap = "round";
    g.beginPath(); g.moveTo(cx, ty + 2); g.lineTo(cx, ty - top.hh * 0.18 - 4); g.stroke();
    var bx = cx, by = ty - top.hh * 0.18 - 6, br = Math.max(3, top.ww * 0.18), sc = C.pick(SPORES, 95);
    glow(g, bx, by, br * 0.9, sc, 12, 0.85);
    g.fillStyle = rgba(shd(hue, 0.18), 0.92); g.beginPath(); g.ellipse(bx, by, br, br * 0.9, 0, 0, 6.2832); g.fill();
    g.lineWidth = 1.4; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(bx - br * 0.3, by - br * 0.32, br * 0.28, 0, 6.2832); g.fill();
    for (var i = -1; i <= 1; i++) glow(g, bx + i * br * 0.7, by - br - 2 - (i & 1) * 2, 1.1, sc, 6, 0.8);  // rising spores
  }

  /** an optional gel / mould patch blotch with a few fruiting dots */
  function mouldPatch(C, L) {
    var g = C.g, side = C.R(96) > 0.5 ? -1 : 1;
    var px = L.cx + side * L.ww * 0.42, py = L.baseY - L.hh * (0.30 + C.R(97) * 0.30), pr = L.ww * 0.18;
    var pc = C.R(98) > 0.5 ? shd(L.hue, 0.22) : shd(L.hue, -0.26);
    g.fillStyle = rgba(pc, 0.8); g.beginPath(); g.ellipse(px, py, pr, pr * 0.8, 0.4, 0, 6.2832); g.fill();
    var fc = C.pick(SPORES, 99);
    for (var i = 0; i < 3; i++) { var a = C.R(100 + i) * 6.2832, r = C.R(110 + i) * pr * 0.7; glow(g, px + Math.cos(a) * r, py + Math.sin(a) * r * 0.8, 1.1, fc, 5, 0.8); }
  }

  /* ---- a whole slime DWELLING --------------------------------------------- */
  function drawHouse(C) {
    var g = C.g, R = C.R, sx = C.sx, sy = C.sy;
    // palette: gel hue, biome-tinted, with a smooth seeded hue-nudge so neighbours differ
    var hue = biomeGel(C.pick(GELS, 1), C.biome);
    var nz = C.u.noise01 ? C.u.noise01(C.tx, C.ty, 5) : 0.5;
    hue = shd(hue, (nz - 0.5) * 0.12);
    if (C.biome === "snow") hue = mx(hue, "#eef6f4", 0.18);
    var glw = C.pick(GLOWS, 2);
    // form
    var ww = 22 + Math.floor(R(3) * 20);          // footprint half-width 22..41
    var hh = 34 + Math.floor(R(4) * 32);          // body height 34..65
    var lobes = 1 + Math.floor(R(5) * 3);         // 1..3 blobs
    var phase = R(6) * 6.2832, wob = Math.sin(C.t * 1.1 + phase) * 1.4;
    var main = {
      cx: sx, baseY: sy, ww: ww, hh: hh, hue: hue, glow: glw, phase: phase, wob: wob,
      fat: 1.04 + R(7) * 0.18, neck: 0.46 + R(8) * 0.38, shoulder: 0.46 + R(9) * 0.16
    };
    shadowPool(g, sx, sy, ww * 1.06);
    // cluster: main mound + smaller buds, each raised higher and offset
    var lob = [main];
    for (var i = 1; i < lobes; i++) {
      lob.push({
        cx: sx + (R(42 + i) - 0.5) * ww * 0.9, baseY: sy - hh * (0.50 + 0.22 * i),
        ww: ww * (0.40 + R(40 + i) * 0.22), hh: hh * (0.38 + R(41 + i) * 0.20),
        hue: shd(hue, (R(43 + i) - 0.5) * 0.12), glow: glw, phase: phase + i, wob: Math.sin(C.t * 1.1 + phase + i) * 1.2,
        fat: 1.02 + R(44 + i) * 0.16, neck: 0.50 + R(45 + i) * 0.30, shoulder: 0.46 + R(46 + i) * 0.14
      });
    }
    // draw back-to-front (higher / smaller-baseY first); ground pool only under the main
    lob.slice().sort(function (a, b) { return a.baseY - b.baseY; }).forEach(function (L) { gelLobe(C, L, L === main); });
    // openings & ornament on the front main mound
    oozeDoor(C, main);
    windows(C, main, Math.floor(R(11) * 2.6));    // 0..2
    drips(C, main, C.t);
    if (R(12) > 0.45) mouldPatch(C, main);
    // a spore-vent / bud on the highest lobe
    var top = lob.reduce(function (a, b) { return b.baseY < a.baseY ? b : a; }, main);
    if (R(13) > 0.40) sporeVent(C, top);
  }

  /* ---- an alien slime GROWTH (the "tree"): gel stalk + glowing caps -------- */
  function drawTree(C) {
    var g = C.g, R = C.R, sx = C.sx, sy = C.sy, t = C.t;
    var hue = biomeGel(C.pick(GELS, 21), C.biome);
    if (C.biome === "snow") hue = mx(hue, "#eef6f4", 0.16);
    var glw = C.pick(GLOWS, 22);
    var H = 24 + Math.floor(R(23) * 26);          // stalk height 24..49
    var lean = (R(24) - 0.5) * 8, phase = R(25) * 6.2832;
    var sway = Math.sin(t * 0.9 + phase) * 2.2;    // gentle alien sway
    var topx = sx + lean + sway, topy = sy - H, bw = 3.5 + R(26) * 2.5;
    shadowPool(g, sx, sy, 11);
    g.fillStyle = rgba(shd(hue, -0.24), 0.40);     // ground-ooze pool
    g.beginPath(); g.ellipse(sx, sy + 2, bw * 2.4, bw * 1.0, 0, 0, 6.2832); g.fill();
    // tapering bulbous gel stalk with a lit vertical gradient + ink outline
    var grad = g.createLinearGradient(0, topy, 0, sy);
    grad.addColorStop(0, shd(hue, 0.24)); grad.addColorStop(1, shd(hue, -0.18));
    g.beginPath();
    g.moveTo(sx - bw, sy);
    g.quadraticCurveTo(sx - bw * 1.3 + sway * 0.3, sy - H * 0.5, topx - bw * 0.5, topy);
    g.lineTo(topx + bw * 0.5, topy);
    g.quadraticCurveTo(sx + bw * 1.3 + sway * 0.3, sy - H * 0.5, sx + bw, sy);
    g.closePath();
    g.fillStyle = grad; g.fill();
    g.lineWidth = 1.8; g.lineJoin = "round"; g.strokeStyle = C.ink; g.stroke();
    // glowing nodes climbing the stalk
    var nodes = 2 + Math.floor(R(27) * 2);
    for (var k = 0; k < nodes; k++) { var f = (k + 1) / (nodes + 1); glow(g, sx + (topx - sx) * f + (k % 2 ? 2 : -2), sy - H * f, 2.4 - k * 0.2, glw, 10, 0.8); }
    // 1–3 glowing caps / pods crowning the stalk
    var caps = 1 + Math.floor(R(28) * 3), capStyle = R(29) > 0.5 ? "pod" : "cap";
    for (var c = 0; c < caps; c++) {
      var ca = R(30 + c) * 6.2832, crad = c === 0 ? 0 : 3 + R(33 + c) * 6;
      var cxp = topx + Math.cos(ca) * crad, cyp = topy - 3 - c * 3 + Math.sin(ca) * crad * 0.5, cr = 4 + R(36 + c) * 4;
      var cc = C.pick(SPORES, 37 + c);
      if (capStyle === "cap") {                    // alien mushroom cap (a glowing dome)
        glow(g, cxp, cyp, cr * 0.8, cc, 12, 0.7);
        g.fillStyle = rgba(shd(hue, 0.12), 0.92); g.beginPath(); g.ellipse(cxp, cyp, cr, cr * 0.7, 0, Math.PI, 0); g.closePath(); g.fill();
        g.lineWidth = 1.3; g.strokeStyle = C.ink; g.stroke();
      } else {                                     // glossy gel pod
        glow(g, cxp, cyp, cr * 0.9, cc, 12, 0.8);
        g.fillStyle = rgba(mx(hue, cc, 0.25), 0.90); g.beginPath(); g.ellipse(cxp, cyp, cr, cr * 0.92, 0, 0, 6.2832); g.fill();
        g.lineWidth = 1.3; g.strokeStyle = C.ink; g.stroke();
        g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(cxp - cr * 0.3, cyp - cr * 0.32, cr * 0.28, 0, 6.2832); g.fill();
      }
      if (R(40 + c) > 0.5) for (var s = -1; s <= 1; s++) glow(g, cxp + s * cr * 0.6, cyp - cr - 2, 1.1, cc, 6, 0.85);  // spores
    }
    // optional drippy tendrils sprouting from the base
    if (R(45) > 0.55) {
      g.strokeStyle = shd(hue, -0.04); g.lineWidth = 2.2; g.lineCap = "round";
      for (var i = -1; i <= 1; i++) { var x = sx + i * bw * 1.3; g.beginPath(); g.moveTo(x, sy - 2); g.quadraticCurveTo(x + sway + i * 3, sy - H * 0.45, x + sway * 0.6, sy - H * 0.62); g.stroke(); glow(g, x + sway * 0.6, sy - H * 0.62, 1.6, glw, 7, 0.8); }
    }
  }

  /* ---- entry: build the per-call context, dispatch by type ---------------- */
  function paint(g, sx, sy, b, env) {
    if (!g || !env || !env.util || !env.util.hash01) return;     // guard: no toolbox -> no-op
    var u = env.util;
    var tx = Math.round((b && b.tx) || 0), ty = Math.round((b && b.ty) || 0);
    var C = {
      g: g, u: u, ink: env.ink || "#16261c", t: env.t || 0, biome: env.biome || null, tx: tx, ty: ty, sx: sx, sy: sy,
      // deterministic per-tile rng: a distinct integer salt -> a stable value in [0,1)
      R: function (salt) { return u.hash01((tx * 101 + salt * 131) | 0, (ty * 97 + salt * 167) | 0); }
    };
    C.pick = function (arr, salt) { return arr[Math.floor(C.R(salt) * arr.length)]; };
    g.save();
    try { if (b && b.type === "tree") drawTree(C); else drawHouse(C); }  // unknown types -> a dwelling
    finally { g.restore(); }
  }

  var root = typeof window !== "undefined" ? window
    : typeof globalThis !== "undefined" ? globalThis : this;
  root.MH_BUILD = { paint: paint };
})();
