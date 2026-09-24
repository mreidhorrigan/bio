// @ts-check
"use strict";
/* ============================================================================
   engine-3d.js  ·  MH_3D  ·  a third-person software renderer in the site's idiom
   ----------------------------------------------------------------------------
   The isometric world (engine.js) and the sidescroller (glossary-world.js)
   draw everything as a flat fill inside one ink outline, and this engine keeps
   that look in three dimensions without WebGL: every frame it collects items in
   world space, projects them through one camera, sorts them back to front, and
   fills and strokes each one on a 2D canvas. It knows nothing about caves,
   slimes or words. A world file (slime3d.js is the first) describes terrain,
   palettes, props, creatures and signs through the primitives below.

   ITEMS (all take world points as [x, y, z]; y is up, z is forward)
     face(pts, fill, ink, width, o)     a planar polygon: a floor strip, a plank
     line(pts, ink, width, o)           an open path: a crease, a strand, a ripple
     organic(pts, fill, ink, width, o)  a rounded body: its projected samples'
                                        (fill: a colour, a function, or
                                        { vgrad: [top, bottom] }, a cached
                                        gradient down the body)
                                        convex hull is filled and stroked as one
                                        smooth line. Boulders, lobes, the slime.
     custom(pts, draw, o)               anything else: draw(g, screenPts, info)
     billboard(p, draw, o)              a screen-aligned thing at a world point,
                                        scaled by depth: a glow, a plaque of text
   Every item takes o.layer (0 ground, 1 everything standing on it; lower
   layers always paint first), o.bias (added to its closeness, so a decal or a
   body paints after the surface it lies on), o.alpha, o.world (line widths
   given in world units rather than pixels), o.edge (a line outlined in that
   ink, as a body is: a stalk) and o.after (a hook drawn inside an
   organic body's outline, for a sheen or an eye). o.rough ({ tufts, depth,
   seed, flick, sway, round }) gives an organic body a tufted outline in place of the
   smooth one: fur, a tuft of moss, a torn leaf, or with round, a lumpy mass. A custom item is mirrored
   in a pool only when it asks, with o.mirror.

   MIRRORS: mirror(ring, o) declares a reflecting surface (a pool) by the ring
   of world points that bounds it, o.level (its still height) and o.surface(x,
   z), the height with the waves in it. Every face, body and billboard standing
   on or above it within o.z0..o.z1 (and o.x0..o.x1, if given) is drawn a second
   time, flipped through the level and clipped to the ring, at o.alpha. The
   waves are read where the eye's ray meets the water, so a reflection bobs and
   shivers with the surface but keeps its shape and its angle.

   FOG belongs to the world: set E.fog = (worldPoint, depth, o) => ({ t, colour })
   and each item is washed toward that colour by t after it is filled. The
   colour can depend on where the item IS (a dark half of a cave) and t on how
   far it is, so nothing flickers when the camera moves.

   CAMERA  E.cam = { x, y, z, yaw, pitch }; a positive yaw turns right and a
   NEGATIVE pitch looks down. E.follow(target, o) rides behind a moving body and
   shortens its boom wherever o.inside(x, y, z) says the camera would be in
   something, so a third-person view never leaves the room it is in. The
   boom's length eases (in fast, out slowly) so things passing do not make the
   view jump; o.hard(x, y, z), if given, is the part it must never enter even
   for a frame (rock, walls), where it moves at once.

   FOCUS: E.focus draws the distance soft, as an eye focused near sees it
   (see "depth of field" below).

   GROUND: E.heightfield draws a whole landscape as one smooth surface (see
   there), for open worlds whose ground would otherwise be tiles.

   COLOUR helpers read #rgb, #rrggbb, rgb() and rgba(), because the site's
   palettes mix colours and then mix the results again.
   ========================================================================== */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /* ── colour ─────────────────────────────────────────────────────────── */
  const rgbCache = new Map();
  /** [r, g, b, a] of any CSS colour this site writes. */
  function rgbOf(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (c[0] === "#") {
      v = c.length === 4
        ? [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16), 1]
        : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
           c.length === 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1];
    } else {
      const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(c);
      v = m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : [128, 128, 128, 1];
    }
    if (rgbCache.size > 20000) rgbCache.clear();
    rgbCache.set(c, v);
    return v;
  }
  const css = (v) => (v[3] >= 1 ? "rgb(" + Math.round(v[0]) + "," + Math.round(v[1]) + "," + Math.round(v[2]) + ")"
    : "rgba(" + Math.round(v[0]) + "," + Math.round(v[1]) + "," + Math.round(v[2]) + "," + v[3].toFixed(3) + ")");
  /* Colours made on the fly (a fog's wash, an outline fading with distance)
     are rounded to one of 64 steps and remembered, so a frame reuses the same
     few hundred strings instead of making thousands of new ones: a fresh
     string for every fade in every frame filled the colour cache, flushed it,
     and fed the collector, and the frame rate stuttered. */
  const made = new Map();
  const Q = 64;
  /** Blend a toward b by t. Alpha blends too, so a translucent surface stays translucent. */
  function mix(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const q = Math.round(t * Q), key = a + "|" + b + "|" + q;
    let out = made.get(key);
    if (out) return out;
    const A = rgbOf(a), B = rgbOf(b), u = q / Q;
    out = css([lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u), lerp(A[3], B[3], u)]);
    if (made.size > 20000) made.clear();
    made.set(key, out);
    return out;
  }
  /** The colour at a new alpha (multiplied into whatever alpha it had). */
  function rgba(c, alpha) {
    const q = Math.round(clamp(alpha, 0, 1) * Q), key = c + "@" + q;
    let out = made.get(key);
    if (out) return out;
    const v = rgbOf(c);
    out = css([v[0], v[1], v[2], v[3] * (q / Q)]);
    if (made.size > 20000) made.clear();
    made.set(key, out);
    return out;
  }
  /** Lighten (amt > 0) or darken (amt < 0). */
  function shade(c, amt) {
    const v = rgbOf(c), f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return css([v[0] + (f - v[0]) * p, v[1] + (f - v[1]) * p, v[2] + (f - v[2]) * p, v[3]]);
  }

  /* ── geometry ───────────────────────────────────────────────────────── */
  /** Andrew's monotone chain over screen points. Counter-clockwise. */
  function hull(pts) {
    const p = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  /** A closed ring traced through the midpoints, the way slime-2d.js and the
   *  skins trace every rounded thing, so the line reads as the same hand. */
  function traceRing(g, pts) {
    const n = pts.length;
    g.beginPath();
    g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }
  /** A rough outline round a convex ring: fur, a tuft, a torn edge. The ring
   *  is sampled at `tufts` fixed screen angles from its centre (so the tufts
   *  hold still as the body moves, rather than crawling round it with the
   *  hull's vertices), and every sample becomes a tip pushed out by `depth` of
   *  the body's size, varied by `seed`, between valleys drawn in a little.
   *  `flick` bends each tip sideways; `sway` (radians a second) moves them. */
  function roughRing(g, ring, bb, r) {
    const n = r.tufts || 16, depth = (r.depth == null ? 0.14 : r.depth) * Math.min(bb.w, bb.h);
    let cx = 0, cy = 0;
    for (const p of ring) { cx += p[0]; cy += p[1]; }
    cx /= ring.length; cy /= ring.length;
    const at = (th) => {                                     // the ring's radius along a ray from the centre
      const dx = Math.cos(th), dy = Math.sin(th);
      let best = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den;
        if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
      }
      return best;
    };
    const seed = r.seed || 0, sway = r.sway ? Math.sin(r.sway) : 0;
    if (r.round) {                                           // knobs, not tips: a lumpy mass
      const pts = [];
      for (let k = 0; k < n; k++) {
        const h = Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453, j = h - Math.floor(h);
        const th = (TAU * k) / n + sway * 0.04, rr = at(th) + depth * (j - 0.35);
        pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
      }
      traceRing(g, pts);
      return;
    }
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const h = Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453, j = h - Math.floor(h);
      const th = (TAU * k) / n, tv = th + Math.PI / n;
      const R = at(th), Rv = at(tv);
      const tip = R + depth * (0.45 + 0.9 * j), flick = ((r.flick || 0.35) + sway * 0.2) * (j - 0.3) * Math.PI / n;
      const vx = cx + Math.cos(tv) * (Rv - depth * 0.35), vy = cy + Math.sin(tv) * (Rv - depth * 0.35);
      const tx = cx + Math.cos(th + flick) * tip, ty = cy + Math.sin(th + flick) * tip;
      if (k === 0) g.moveTo(tx, ty); else g.quadraticCurveTo(cx + Math.cos(th) * R, cy + Math.sin(th) * R, tx, ty);
      g.lineTo(vx, vy);
    }
    g.closePath();
  }
  /** An open path traced smoothly, ending exactly on its last point. */
  function tracePath(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) { g.lineTo(pts[1][0], pts[1][1]); return; }
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  }
  /** The brand's leaf corner (brand/brand.css --leaf): a sweep top-left and
   *  bottom-right, near-square at the other two. For plaques and boards. `k`
   *  scales the corners with the board (engine.js util.leafPath is the same). */
  function leafPath(g, x, y, w, h, k = 1) {
    const Sx = Math.min(16 * k, w / 2), Sy = Math.min(7 * k, h / 2), sx = Math.min(4 * k, w / 2), sy = Math.min(2 * k, h / 2);
    const r = x + w, b = y + h;
    g.beginPath();
    g.moveTo(x + Sx, y);
    g.lineTo(r - sx, y); g.quadraticCurveTo(r, y, r, y + sy);
    g.lineTo(r, b - Sy); g.quadraticCurveTo(r, b, r - Sx, b);
    g.lineTo(x + sx, b); g.quadraticCurveTo(x, b, x, b - sy);
    g.lineTo(x, y + Sy); g.quadraticCurveTo(x, y, x + Sx, y);
    g.closePath();
  }

  /** A ring of n samples round a circle encloses less than the circle; scale
   *  its radius so the polygon has the circle's AREA, and a body keeps its
   *  apparent size whether it is sampled coarsely far off or finely up close. */
  const ringScale = (n) => Math.sqrt(Math.PI / ((n / 2) * Math.sin(TAU / n)));
  /** Sample generators: the point clouds a rounded body starts from. */
  const shapes = {
    /** An ellipsoid. `half` keeps the upper half only (a dome on a base). Rows
     *  are made even so the equator is always sampled: without it a body's
     *  widest ring was missing at some detail levels and it read narrower. */
    ball(cx, cy, cz, rx, ry, rz, rows, cols, half) {
      rows = half ? rows : rows + (rows & 1);
      const out = [], top = half ? Math.PI / 2 : Math.PI, f = ringScale(cols);
      for (let i = 0; i <= rows; i++) {
        const a = top * (i / rows), sa = Math.sin(a) * f, ca = Math.cos(a);
        for (let j = 0; j < cols; j++) {
          const t = TAU * (j / cols);
          out.push([cx + sa * Math.cos(t) * rx, cy + ca * ry, cz + sa * Math.sin(t) * rz]);
        }
      }
      return out;
    },
    /** A hanging drip: a tapered body from a rim at the top to a point below. */
    drip(cx, cy, cz, r, len, cols) {
      const out = [[cx, cy - len, cz]], f = ringScale(cols);
      for (const [k1, k] of [[1, 0], [0.82, 0.35], [0.5, 0.7]]) {
        for (let j = 0; j < cols; j++) {
          const t = TAU * (j / cols);
          out.push([cx + Math.cos(t) * r * k1 * f, cy - len * k, cz + Math.sin(t) * r * k1 * f]);
        }
      }
      return out;
    },
    /** A disc lying on a surface: n points round (cx, cz) at yFn(x, z). */
    disc(cx, cz, r, n, yFn, wobble) {
      const out = [], f = ringScale(n);
      for (let j = 0; j < n; j++) {
        const t = TAU * (j / n), rr = r * f * (wobble ? 1 + wobble(j) : 1);
        const x = cx + Math.cos(t) * rr, z = cz + Math.sin(t) * rr;
        out.push([x, yFn(x, z), z]);
      }
      return out;
    },
  };

  /* ── a renderer on one canvas ────────────────────────────────────────── */
  function create(canvas, opts) {
    opts = opts || {};
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    const E = {
      g, canvas, W: 0, H: 0, dpr: 1, fov: 520, near: opts.near || 1.2,
      cam: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      reduce: !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      /** @type {null | ((p:number[], depth:number) => {t:number, colour:string})} */
      fog: null,
      tally: { items: 0, drawn: 0, culled: 0, mirrored: 0 },
      dt: 0, t: 0,
    };
    let items = [], mirrors = [];
    const NEAR = () => E.near;

    E.begin = () => { items = []; mirrors = []; };
    /** A reflecting surface: see MIRRORS above. o: surface(x, z) → y, level
     *  (the still height; the ring's mean if left out), z0, z1, x0 and x1
     *  (optional), alpha (0.38), minLayer (2: nothing on the floor reflects), layer (1) and
     *  bias (1000) for where the reflections paint: after the water's own fill. */
    E.mirror = (ring, o) => { mirrors.push({ ring, surface: o.surface, level: o.level, z0: o.z0, z1: o.z1, x0: o.x0, x1: o.x1, alpha: o.alpha == null ? 0.38 : o.alpha,
      minLayer: o.minLayer == null ? 2 : o.minLayer, layer: o.layer == null ? 1 : o.layer, bias: o.bias == null ? 1000 : o.bias, path: null }); };
    E.face = (pts, fill, ink, w, o) => { items.push({ k: 1, pts, fill, ink, w: w || 1, o: o || 0 }); };
    E.line = (pts, ink, w, o) => { items.push({ k: 2, pts, ink, w: w || 1, o: o || 0 }); };
    E.organic = (pts, fill, ink, w, o) => { items.push({ k: 3, pts, fill, ink, w: w || 1, o: o || 0 }); };
    E.custom = (pts, draw, o) => { items.push({ k: 4, pts, draw, o: o || 0 }); };
    E.billboard = (p, draw, o) => { items.push({ k: 5, pts: [p], draw, o: o || 0 }); };

    /** World to view space. */
    E.view = (p) => {
      const c = E.cam, dx = p[0] - c.x, dy = p[1] - c.y, dz = p[2] - c.z;
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
      const vx = dx * cy - dz * sy;
      let vz = dx * sy + dz * cy;
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const vy = dy * cp - vz * sp;
      vz = dy * sp + vz * cp;
      return [vx, vy, vz];
    };
    E.screen = (v) => [E.W / 2 + v[0] * (E.fov / v[2]), E.H / 2 - v[1] * (E.fov / v[2])];
    /** [sx, sy, depth], or null behind the camera. */
    E.project = (p) => { const v = E.view(p); if (v[2] <= NEAR()) return null; const s = E.screen(v); return [s[0], s[1], v[2]]; };

    /** The world ray through a screen point: [origin, direction], the inverse of
     *  view() and screen(). For clicking on the floor. */
    E.ray = (sx, sy) => {
      const c = E.cam, vx = (sx - E.W / 2) / E.fov, vy = -(sy - E.H / 2) / E.fov, vz = 1;
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const dy = vy * cp + vz * sp, vz2 = -vy * sp + vz * cp;
      const cy = Math.cos(c.yaw), sy2 = Math.sin(c.yaw);
      const dx = vx * cy + vz2 * sy2, dz = -vx * sy2 + vz2 * cy;
      const m = Math.hypot(dx, dy, dz) || 1;
      return [[c.x, c.y, c.z], [dx / m, dy / m, dz / m]];
    };

    /** Sutherland-Hodgman against the near plane. */
    function clipNear(vs) {
      const out = [], n = NEAR();
      for (let i = 0; i < vs.length; i++) {
        const a = vs[i], b = vs[(i + 1) % vs.length];
        const ain = a[2] > n, bin = b[2] > n;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = (n - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]);
        }
      }
      return out;
    }
    E.clipNear = clipNear;

    /** A width in pixels: o.world widths are world units, scaled by depth and
     *  capped at o.maxPx (5), or a crease running past the camera swells into a
     *  band of ink. */
    function pxWidth(w, o, depth) {
      if (!(o && o.world)) return w;
      return Math.max(0.5, Math.min((o.maxPx == null ? 5 : o.maxPx), w * E.fov / depth));
    }
    function bounds(pts) {
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const p of pts) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
      return { x: a, y: c, w: b - a, h: d - c };
    }
    const offscreen = (bb) => bb.x + bb.w < -40 || bb.x > E.W + 40 || bb.y + bb.h < -40 || bb.y > E.H + 40;
    /** A reflection whose box on screen misses its mirror's box can never show (the
     *  mirror layer is clipped to the pool): it is not drawn. In the cave that was
     *  hundreds of walls and lobes a frame, drawn into the layer and clipped away. */
    const outsideMirror = (o, bb) => { const M = o && o.mirrorOf, b = M && M.box; return !!b && (bb.x + bb.w < b[0] - 2 || bb.x > b[1] + 2 || bb.y + bb.h < b[2] - 2 || bb.y > b[3] + 2); };

    /* Where a point shows in a mirror. A reflection is a flip through the
       water's mean LEVEL, never through the height under each point: the body
       stirs the water right where it stands, and flipping each of its points
       through the wave beneath it sheared the reflection off at an angle. The
       waves still move a reflection, as they do on a pond, but they are read
       where the eye's ray meets the water, once for the whole item (it bobs as
       one piece) and a little per point (its edge shivers). Whatever is under
       the water is not reflected: those points are lifted to the level first,
       so a body standing in a pool is mirrored from its waterline. */
    function wave(M, p) {                                    // the surface's offset where the ray to p meets it
      const c = E.cam, L = M.level, dy = c.y - p[1];
      if (c.y <= L || dy <= 1e-6) return 0;
      const t = (c.y - L) / dy;
      return M.surface(c.x + (p[0] - c.x) * t, c.z + (p[2] - c.z) * t) - L;
    }
    /** How a whole item bobs in M: the wave where the eye's ray meets the
     *  water on the way to the item's mirrored centre. */
    E.mirrorBase = (M, pts) => {
      let cx = 0, cy = 0, cz = 0;
      for (const p of pts) { cx += p[0]; cy += Math.max(p[1], M.level); cz += p[2]; }
      const n = pts.length;
      return 0.6 * wave(M, [cx / n, 2 * M.level - cy / n, cz / n]);
    };
    /** Mirror one world point through M; `base` is the item's own bob (from mirrorBase). */
    E.mirrorPoint = (M, p, base) => {
      const q = [p[0], 2 * M.level - Math.max(p[1], M.level), p[2]];
      const b = base || 0;
      q[1] += b + clamp(0.5 * (wave(M, q) - b), -0.32, 0.32);   // (a little more shiver than it had: the waves show in what the water holds)
      return q;
    };
    /** The reflections: for each mirror, a mirrored copy of every eligible item
     *  that stands over it, clipped to the mirror's ring on screen. */
    function reflect() {
      E.tally.mirrored = 0;
      for (const M of mirrors) {
        if (M.level == null) { let s = 0; for (const p of M.ring) s += p[1]; M.level = s / M.ring.length; }
        if (E.cam.y <= M.level) continue;                    // from under the surface there is nothing to see in it
        const vs = M.ring.map(E.view), c = clipNear(vs);
        if (c.length < 3) continue;
        const sp = c.map(E.screen), path = new Path2D(), n2 = sp.length;   // smooth, like the ring it clips
        path.moveTo((sp[n2 - 1][0] + sp[0][0]) / 2, (sp[n2 - 1][1] + sp[0][1]) / 2);
        for (let k = 0; k < n2; k++) { const a = sp[k], b = sp[(k + 1) % n2]; path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        path.closePath();
        M.path = path;
        const bb = bounds(sp);
        M.box = [bb.x, bb.x + bb.w, bb.y, bb.y + bb.h];
        const count = items.length;
        for (let i = 0; i < count; i++) {
          const it = items[i], o = it.o;
          if ((it.k !== 1 && it.k !== 3 && it.k !== 5 && !(it.k === 4 && o && o.mirror)) || (o && o.mirrorOf)) continue;
          if (((o && o.layer) | 0) < M.minLayer) continue;
          let z = 0;
          for (const p of it.pts) z += p[2];
          z /= it.pts.length;
          if (z < M.z0 || z > M.z1) continue;
          if (M.x0 != null) {                                // a mirror bounded across x too (a pond, not a corridor)
            let x = 0;
            for (const p of it.pts) x += p[0];
            x /= it.pts.length;
            if (x < M.x0 || x > M.x1) continue;
          }
          // First, cheaply, can its reflection land on the pool at all? Its middle and
          // reach, mirrored through the level and projected: a thing whose reflection
          // falls wholly off the pool's box on screen is not mirrored (working out each
          // point's wave for it was most of what the cave's water cost a frame).
          if (M.box && it.k !== 5) {
            let cx = 0, cy = 0, cz = 0, r = 0;
            const n = it.pts.length;
            for (const p of it.pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
            cx /= n; cy /= n; cz /= n;
            for (const p of it.pts) r = Math.max(r, Math.abs(p[0] - cx) + Math.abs(p[1] - cy) + Math.abs(p[2] - cz));
            const v = E.view([cx, 2 * M.level - Math.max(cy, M.level), cz]);
            if (v[2] > NEAR() + r) {
              const sp = E.screen(v), sr = (r * E.fov) / v[2] + 4;
              if (sp[0] + sr < M.box[0] || sp[0] - sr > M.box[1] || sp[1] + sr < M.box[2] || sp[1] - sr > M.box[3]) continue;
            }
          }
          const base = E.mirrorBase(M, it.pts);
          const pts = it.pts.map((p) => E.mirrorPoint(M, p, base));
          E.tally.mirrored++;
          items.push({ k: it.k, pts, fill: it.fill, ink: it.ink, w: it.w, draw: it.draw,
            o: Object.assign({}, o || {}, { layer: M.layer, bias: M.bias, mirrorOf: M, mirrorBase: base,   // the after hook runs too: it can read e.it.o.mirrorOf
              alpha: (o && o.alpha != null ? o.alpha : 1) * M.alpha }) });
        }
      }
    }

    /** Project, cull, sort and draw everything collected since begin(). */
    E.paint = () => {
      if (mirrors.length) reflect(); else E.tally.mirrored = 0;
      const n = NEAR(), ready = [];
      E.tally.items = items.length; E.tally.culled = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i], o = it.o, vs = [];
        let sum = 0, cnt = 0, wx = 0, wy = 0, wz = 0, anyFront = false;
        for (let k = 0; k < it.pts.length; k++) {
          const p = it.pts[k], v = E.view(p);
          vs.push(v); sum += v[2]; cnt++;
          wx += p[0]; wy += p[1]; wz += p[2];
          if (v[2] > n) anyFront = true;
        }
        if (!anyFront) { E.tally.culled++; continue; }
        const depth = sum / cnt, world = [wx / cnt, wy / cnt, wz / cnt];
        const fog = E.fog ? E.fog(world, depth, o) : null;   // o: a world's fog may spare what is its own light (o.lit)
        // o.stable sorts by world z along the camera's facing instead of by view
        // depth: things lying on one plane (floor blobs) have neighbours at almost
        // equal depth, and a depth sort flips them as the camera slides, so the
        // overlap changes shade and shadows seem to crawl. World z never flips.
        // E.stableAxis ([x, z], set by an open world) sorts them along whatever
        // way the camera faces, snapped to a few headings so a turn reorders them
        // only as it crosses from one heading to the next.
        const sa = E.stableAxis;
        const key = o && o.stable ? (sa ? world[0] * sa[0] + world[2] * sa[1] : world[2] * (E.stableSign || 1)) - (o.bias || 0) : depth - ((o && o.bias) || 0);
        const entry = { it, vs, depth, layer: (o && o.layer) | 0, key, fog, i };
        if (it.k === 1) {                                    // a polygon: clip it, then cull by its box
          const c = clipNear(vs);
          if (c.length < 3) { E.tally.culled++; continue; }
          entry.sp = c.map(E.screen);
          const b1 = bounds(entry.sp);
          if (offscreen(b1) || outsideMirror(o, b1)) { E.tally.culled++; continue; }
        } else if (it.k === 2) {                             // a path: cut where it passes the eye
          const runs = []; let run = [];
          for (const v of vs) { if (v[2] > n) run.push(E.screen(v)); else if (run.length) { runs.push(run); run = []; } }
          if (run.length) runs.push(run);
          entry.runs = runs.filter((r) => r.length > 1);
          if (!entry.runs.length) { E.tally.culled++; continue; }
        } else if (it.k === 4) {                             // a custom polygon: clipped like a face
          const c = clipNear(vs);
          if (c.length < 3) { E.tally.culled++; continue; }
          entry.sp = c.map(E.screen);
          const b4 = bounds(entry.sp);
          if (offscreen(b4) || outsideMirror(o, b4)) { E.tally.culled++; continue; }
        } else {                                             // a body
          if (it.k === 3) {
            // Samples behind the eye are dropped, not the body: a lobe or a blob
            // beside the camera used to vanish whole the moment one of its points
            // crossed the near plane. Only a body whose centre is behind us goes.
            const cz = E.view(world)[2];
            if (cz <= n) { E.tally.culled++; continue; }
            entry.sp = vs.map((v) => (v[2] > n ? E.screen(v) : null));
            const front = entry.sp.filter(Boolean);
            if (front.length < 3) { E.tally.culled++; continue; }
            entry.ring = hull(front);
            if (entry.ring.length < 3) { E.tally.culled++; continue; }
            entry.bb = bounds(entry.ring);
            if (offscreen(entry.bb) || outsideMirror(o, entry.bb) || entry.bb.w < ((o && o.minPx) || 1.2) && entry.bb.h < ((o && o.minPx) || 1.2)) { E.tally.culled++; continue; }
          } else if (it.k === 5) {
            if (vs[0][2] <= n) { E.tally.culled++; continue; }
            entry.sp = [E.screen(vs[0])];
            const s = entry.sp[0];
            if (s[0] < -200 || s[0] > E.W + 200 || s[1] < -200 || s[1] > E.H + 200) { E.tally.culled++; continue; }
          }
        }
        ready.push(entry);
      }
      // See-through: what stands nearer than E.see (the body the camera follows)
      // and covers it on screen is drawn faint, if it is marked o.fade
      if (E.see) {
        const sp = E.project(E.see);
        if (sp) for (const e of ready) {
          const o = e.it.o;
          if (!o || !o.fade || e.depth >= sp[2] - 1) { e.faded = 0; continue; }
          const b = e.bb || (e.sp ? bounds(e.sp) : null);
          e.faded = b && sp[0] > b.x && sp[0] < b.x + b.w && sp[1] > b.y && sp[1] < b.y + b.h ? 1 : 0;
        }
      }
      // Lower layers first; within a layer, far to near; equal depths keep their
      // order, or coplanar neighbours would swap from frame to frame and crawl.
      ready.sort((a, b) => (a.layer - b.layer) || (b.key - a.key) || (a.i - b.i));
      g.lineJoin = "round"; g.lineCap = "round";
      if (E.focus && !E.focus.off) paintInFocus(ready);
      else { for (const e of ready) draw(e); flushMirrors(); }   // (flush: if the frame ended inside a run of reflections)
      E.tally.drawn = ready.length;
      return ready.length;
    };

    /** One gradient from 0 to 1 down, per context and colour pair, kept. */
    const unitGrads = new Map();
    function unitGradient(c, hi, lo) {
      const key = hi + "|" + lo + (c === g ? "" : "|m");
      let gr = unitGrads.get(key);
      if (!gr) {
        if (unitGrads.size > 600) unitGrads.clear();
        gr = c.createLinearGradient(0, 0, 0, 1); gr.addColorStop(0, hi); gr.addColorStop(1, lo);
        unitGrads.set(key, gr);
      }
      return gr;
    }
    function wash(c, e) {                                    // the fog, laid over the shape just filled
      if (e.fog && e.fog.t > 0.015) { c.fillStyle = rgba(e.fog.colour, Math.min(1, e.fog.t)); c.fill(); }
    }
    function inkOf(e, ink) { return e.fog && e.fog.t > 0.015 ? rgba(ink, 1 - e.fog.t) : ink; }
    /* Reflections are drawn into one offscreen layer and laid onto the frame
       once through the mirrors' rings. Clipping each mirrored item on its own
       cost a full-frame mask per item on a software canvas. */
    let mcv = null, mctx = null, mirroring = false;
    let mbox = null;                                         // the mirrors' box on screen, in canvas pixels
    function mirrorLayer() {
      if (!mcv) { mcv = document.createElement("canvas"); mctx = mcv.getContext("2d"); }
      if (mcv.width !== canvas.width || mcv.height !== canvas.height) { mcv.width = canvas.width; mcv.height = canvas.height; }
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const M of mirrors) if (M.box) { a = Math.min(a, M.box[0]); b = Math.max(b, M.box[1]); c = Math.min(c, M.box[2]); d = Math.max(d, M.box[3]); }
      const k = E.dpr;
      mbox = [Math.max(0, Math.floor(a * k) - 2), Math.max(0, Math.floor(c * k) - 2),
        Math.min(mcv.width, Math.ceil(b * k) + 2), Math.min(mcv.height, Math.ceil(d * k) + 2)];
      mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(mbox[0], mbox[1], mbox[2] - mbox[0], mbox[3] - mbox[1]);
      mctx.setTransform(k, 0, 0, k, 0, 0); mctx.lineJoin = "round"; mctx.lineCap = "round";
      return mctx;
    }
    /* ── depth of field ──────────────────────────────────────────────────
       E.focus = { near, far, scale: [far, mid], blur: [far, mid] } draws what
       lies beyond `near` soft, and beyond `far` softer, as an eye focused on
       what is close sees the distance: those items are painted into canvases
       a fraction of the frame's size (scale), blurred there once each where
       the browser can (blur, in those canvases' pixels), and laid onto the
       frame scaled back up, smoothed. Far things come into focus as they come
       near, instead of out of a mist; and being painted small, they cost less.
       Bands are drawn far to near, each in its own depth order. Reflections,
       and anything with o.sharp (a plaque to be read), stay in focus. */
    let cur = g;                                               // the canvas items are painted into just now
    const bands = [null, null], soft = [null, null];
    const canBlur = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;
    function bandCanvas(i, s) {
      const w = Math.max(1, Math.ceil(canvas.width * s)), h = Math.max(1, Math.ceil(canvas.height * s));
      let b = bands[i];
      if (!b) { const cv = document.createElement("canvas"); b = bands[i] = { cv, cx: /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d")) }; }
      if (b.cv.width !== w || b.cv.height !== h) { b.cv.width = w; b.cv.height = h; }
      b.cx.setTransform(1, 0, 0, 1, 0, 0); b.cx.clearRect(0, 0, w, h);
      b.cx.setTransform(E.dpr * s, 0, 0, E.dpr * s, 0, 0); b.cx.lineJoin = "round"; b.cx.lineCap = "round";
      return b;
    }
    function layBand(i, b, blur) {
      let src = b.cv;
      if (blur > 0 && canBlur) {                               // one blur, at the band's own small size
        let t = soft[i];
        if (!t) { const cv = document.createElement("canvas"); t = soft[i] = { cv, cx: /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d")) }; }
        if (t.cv.width !== src.width || t.cv.height !== src.height) { t.cv.width = src.width; t.cv.height = src.height; }
        t.cx.setTransform(1, 0, 0, 1, 0, 0); t.cx.clearRect(0, 0, src.width, src.height);
        t.cx.filter = "blur(" + blur.toFixed(2) + "px)"; t.cx.drawImage(src, 0, 0); t.cx.filter = "none";
        src = t.cv;
      }
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "low";
      g.drawImage(src, 0, 0, src.width, src.height, 0, 0, canvas.width, canvas.height);
      g.restore();
    }
    function paintInFocus(ready) {
      const F = E.focus, scale = F.scale || [1 / 3, 1 / 1.7], blur = F.blur || [1.2, 0.6];
      const far = [], mid = [], near = [];
      for (const e of ready) {
        const o = e.it.o;
        if (o && (o.mirrorOf || o.sharp)) near.push(e);
        else if (e.depth > F.far) far.push(e);
        else if (e.depth > F.near) mid.push(e);
        else near.push(e);
      }
      [far, mid].forEach((list, i) => {
        if (!list.length) return;
        const b = bandCanvas(i, scale[i]);
        cur = b.cx;
        for (const e of list) draw(e);
        cur = g;
        layBand(i, b, blur[i]);
      });
      for (const e of near) draw(e);
      flushMirrors();
      E.tally.far = far.length; E.tally.mid = mid.length;
    }
    function flushMirrors() {
      if (!mirroring) return;
      mirroring = false;
      const path = new Path2D();
      for (const M of mirrors) if (M.path) path.addPath(M.path);
      const w = mbox[2] - mbox[0], h = mbox[3] - mbox[1];
      if (w <= 0 || h <= 0) return;
      g.save(); g.clip(path); g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(mcv, mbox[0], mbox[1], w, h, mbox[0], mbox[1], w, h);   // only the pools' box, not the frame
      g.restore();
    }
    function draw(e) {
      const it = e.it, o = it.o;
      const M = o && o.mirrorOf;
      if (M && !M.path) return;
      if (M && !mirroring) { mirrorLayer(); mirroring = true; }
      else if (!M) flushMirrors();
      const c = M ? mctx : cur;
      if (o && o.alpha != null) c.globalAlpha = o.alpha;
      if (e.faded) c.globalAlpha = (o && o.alpha != null ? o.alpha : 1) * 0.3;
      if (it.k === 1) {
        const sp = e.sp;
        c.beginPath(); c.moveTo(sp[0][0], sp[0][1]);
        for (let k = 1; k < sp.length; k++) c.lineTo(sp[k][0], sp[k][1]);
        c.closePath();
        if (it.fill) {
          c.fillStyle = it.fill; c.fill(); wash(c, e);
          // o.seal strokes the face in its own colour: neighbouring faces of one
          // surface then meet without the hairline of background that
          // antialiasing leaves between two fills
          if (o && o.seal && !it.ink) { c.strokeStyle = e.fog && e.fog.t > 0.015 ? mix(it.fill, e.fog.colour, Math.min(1, e.fog.t)) : it.fill; c.lineWidth = 1.2; c.stroke(); }
        }
        if (it.ink) { c.strokeStyle = inkOf(e, it.ink); c.lineWidth = pxWidth(it.w, o, e.depth); c.stroke(); }
      } else if (it.k === 2) {
        // o.edge (an ink colour) outlines a line as a body is outlined: a band
        // of that ink either side of the stroke, as heavy as a body's outline
        // (0.8 to 2.6 px), for a stalk that stands among bodies. The stroke is
        // then a fill, so the fog washes its colour as it washes a body's.
        const lw = pxWidth(it.w, o, e.depth), ew = o && o.edge ? Math.max(0.8, Math.min(2.6, lw * 0.25)) : 0;
        const body = ew ? (e.fog && e.fog.t > 0.015 ? mix(it.ink, e.fog.colour, Math.min(1, e.fog.t)) : it.ink) : inkOf(e, it.ink);
        for (const r of e.runs) {
          if (o && o.smooth === false) { c.beginPath(); c.moveTo(r[0][0], r[0][1]); for (let k = 1; k < r.length; k++) c.lineTo(r[k][0], r[k][1]); } else tracePath(c, r);
          if (ew) { c.strokeStyle = inkOf(e, o.edge); c.lineWidth = lw + ew * 2; c.stroke(); }
          c.strokeStyle = body; c.lineWidth = lw; c.stroke();
        }
      } else if (it.k === 3) {
        const ring = e.ring, bb = e.bb;
        if (o && o.rough) roughRing(c, ring, bb, o.rough); else traceRing(c, ring);
        if (it.fill && it.fill.vgrad) {
          // a vertical gradient over the body's box, from one gradient made once
          // per colour pair and stretched to the box by the transform: making a
          // new gradient for every body in every frame fed the collector and
          // made the frame rate stutter
          c.save(); c.transform(1, 0, 0, Math.max(0.01, bb.h), 0, bb.y);
          c.fillStyle = unitGradient(c, it.fill.vgrad[0], it.fill.vgrad[1]); c.fill(); c.restore();
        } else {
          c.fillStyle = typeof it.fill === "function" ? it.fill(c, bb, e) : it.fill;
          c.fill();
        }
        wash(c, e);
        if (it.ink && bb.w > ((o && o.inkPx) || 5)) {
          c.lineWidth = o && o.world ? pxWidth(it.w, o, e.depth) : Math.max(0.8, Math.min(2.6, bb.w * 0.045 * it.w));
          c.strokeStyle = inkOf(e, it.ink); c.stroke();
        }
        if (o && o.after) o.after(c, ring, bb, e.sp, e);
      } else if (it.k === 4) {
        it.draw(c, e.sp, e);
      } else if (it.k === 5) {
        const s = e.sp[0];
        it.draw(c, s[0], s[1], E.fov / e.vs[0][2], e);
      }
      if ((o && o.alpha != null) || e.faded) c.globalAlpha = 1;
    }

    /* ── a heightfield ground, as one continuous surface ─────────────────
       E.heightfield({ height(x, z), shade(x, z, h, dist, dirY), res, base })
       casts a ray through every res-th pixel below the horizon, finds where it
       meets the ground (a few damped fixed-point steps against height(x, z),
       enough for gentle land), asks shade() for the colour there as a packed
       0xAABBGGRR, and lays the result on the canvas smoothed. Nothing is
       tiled, so nothing has an edge to crawl, and shade() owns the fog, so the
       ground fades into the air of the sky behind it. Draw it after the sky
       and before paint(): everything else stands on it.                     */
    let hf = null;
    E.heightfield = (o) => {
      const k = o.res || 3, w = Math.max(1, Math.ceil(E.W / k)), h = Math.max(1, Math.ceil(E.H / k));
      if (!hf || hf.w !== w || hf.h !== h) {
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = /** @type {CanvasRenderingContext2D} */ (cv.getContext("2d")), img = cx.createImageData(w, h);
        hf = { cv, cx, img, buf: new Uint32Array(img.data.buffer), w, h };
      }
      const c = E.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
      const base = o.base || 0, far = o.far || 1e9, buf = hf.buf, height = o.height, shade = o.shade;
      let drawn = 0;
      for (let j = 0; j < h; j++) {
        const vy = -((j + 0.5) * k - E.H / 2) / E.fov;
        const dy0 = vy * cp + sp, vz2 = -vy * sp + cp;
        let tPrev = -1;                                          // the neighbour's answer: a near start, so fewer steps
        for (let i = 0; i < w; i++) {
          const vx = ((i + 0.5) * k - E.W / 2) / E.fov;
          const m = 1 / Math.sqrt(vx * vx + dy0 * dy0 + vz2 * vz2);
          const dy = dy0 * m;
          if (dy > -0.004) { buf[j * w + i] = 0; tPrev = -1; continue; }   // at or above the horizon: the sky shows
          const dx = (vx * cy + vz2 * sy) * m, dz = (-vx * sy + vz2 * cy) * m;
          let t = tPrev > 0 ? tPrev : (c.y - base) / -dy, x = 0, z = 0, hh = base;
          // grazing rays (near the horizon) converge slowly: more steps there, or far
          // roads and shores shift a little each frame and the distance swims
          for (let n = dy > -0.12 ? 6 : tPrev > 0 ? 2 : 5; n > 0; n--) {   // damped fixed point: t = (eye - ground there) / fall
            x = c.x + dx * t; z = c.z + dz * t; hh = height(x, z);
            const tn = (c.y - hh) / -dy;
            t += (tn - t) * 0.7;
            if (t < 0.5) t = 0.5;
          }
          if (t > far) { buf[j * w + i] = o.farColour != null ? o.farColour : shade(c.x + dx * far, c.z + dz * far, hh, far, dy); tPrev = far; continue; }   // past the haze: its colour, steady
          tPrev = t;
          buf[j * w + i] = shade(c.x + dx * t, c.z + dz * t, hh, t, dy);
          drawn++;
        }
      }
      hf.cx.putImageData(hf.img, 0, 0);
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "low";
      g.drawImage(hf.cv, 0, 0, w, h, 0, 0, w * k, h * k); g.restore();
      return drawn;
    };

    /* ── size, loop ───────────────────────────────────────────────────── */
    E.size = () => {
      const r = canvas.getBoundingClientRect();
      E.W = Math.max(280, Math.round(r.width)); E.H = Math.max(240, Math.round(r.height));
      // A software renderer pays for every pixel of every fill: cap the backing
      // resolution so the canvas never exceeds about 2.6 million pixels. A
      // laptop window at 2x still gets about 1.4x; a phone keeps its full 2x.
      E.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / (E.W * E.H))));
      canvas.width = Math.round(E.W * E.dpr); canvas.height = Math.round(E.H * E.dpr);
      g.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
      E.fov = opts.fov ? opts.fov(E.W, E.H) : Math.max(360, E.H * 1.05);
    };
    let last = 0, running = false, frameFn = null;
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now; E.dt = dt; E.t += dt;
      frameFn(dt);
      requestAnimationFrame(frame);
    }
    E.run = (fn) => { frameFn = fn; if (running) return; running = true; last = 0; requestAnimationFrame(frame); };
    E.pause = () => { running = false; };
    E.resume = () => { if (frameFn) E.run(frameFn); };
    /** One synchronous frame, for probes: no rAF, a fixed dt. */
    E.tick = (dt) => { E.dt = dt || 0.016; E.t += E.dt; if (frameFn) frameFn(E.dt); };
    window.addEventListener("resize", E.size);
    E.size();

    /* ── the camera behind a body ─────────────────────────────────────── */
    /** Ride behind `target` ({x, y, z, yaw}). o: dist, near (a share of the boom, for
     *  the visitor's zoom in; see below), height, aim (height of
     *  the point looked at, above target.y), look and tilt (the visitor's own
     *  turn and nod, radians), inside(x, y, z) → is this open air, ease (per
     *  second), step (units between boom samples). Returns the boom length. */
    E.follow = (t, o) => {
      const dist = o.dist, h = o.height, yaw = t.yaw + (o.look || 0);
      const ax = t.x, ay = t.y + (o.aim == null ? 0 : o.aim), az = t.z;
      const bx = -Math.sin(yaw), bz = -Math.cos(yaw);              // back along the body's heading
      /** The longest boom that test allows: every length is tried, the shortest
       *  too, or a body arriving with its back to a wall has its camera put in it. */
      const longest = (test) => {
        const step = o.step || 2, least = Math.min(dist, o.minDist || 4);
        let ok = Math.min(1.5, least);
        for (let d = ok; d <= dist; d += (d < least ? 0.75 : step)) {
          if (!test(ax + bx * d, ay + h * (d / dist), az + bz * d)) break;
          ok = d;
        }
        return ok;
      };
      // With o.hard, only the rock shortens the boom along its length; a house
      // or a plant between camera and body does not pull the camera in (that
      // yanked the view at every corner passed): it is drawn see-through
      // instead (o.fade, E.see). The camera still never stands INSIDE one: from
      // the rock's length it steps in until its own spot is clear.
      const sHard = o.hard ? longest(o.hard) : o.inside ? longest(o.inside) : dist;
      let s = sHard;
      if (o.hard && o.inside) while (s > 1.5 && !o.inside(ax + bx * s, ay + h * (s / dist), az + bz * s)) s -= 1;
      // o.near (below 1): the visitor's "nearer", as a share of the boom the camera can
      // have. Where walls already hold it close (a small room), asking for a shorter
      // distance than they allow changed nothing; this brings it nearer from there.
      if (o.near != null && o.near < 1) s = Math.max(Math.min(o.nearMin || 1.5, s), s * o.near);   // (never nearer than o.nearMin)
      // The boom's length eases too: in fast when something comes between the
      // camera and the body, back out slowly when it has passed. Set at once, a
      // house corner sliding across the boom made the view jump.
      const snapNow = o.ease == null || o.ease > 1e3;
      if (snapNow || E.boomLen == null) E.boomLen = s;
      else E.boomLen += (s - E.boomLen) * Math.min(1, E.dt * (s < E.boomLen ? 9 : 1.6));
      // but never into the hard shape of the place (o.hard: rock, walls), even
      // for a frame: there the boom is the tested length at once
      const hard = o.hard || o.inside;
      if (E.boomLen > sHard) E.boomLen = sHard;                    // never past the rock, even for a frame
      // and never standing inside a thing: easing is for things passing between the camera and the body
      if (o.inside && !o.inside(ax + bx * E.boomLen, ay + h * (E.boomLen / dist), az + bz * E.boomLen)) E.boomLen = s;
      const sl = E.boomLen;
      const f = sl / dist, tx = ax + bx * sl, ty = ay + h * f, tz = az + bz * sl;
      const k = o.ease == null ? 1 : Math.min(1, E.dt * o.ease);
      const c = E.cam;
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.z += (tz - c.z) * k;
      // Easing cuts corners: the boom's end is open air, but the path to it may
      // not be. If the eased camera would stand in the hard shape of the place,
      // it goes straight to the open spot instead. (Only the hard shape: a
      // house or a plant passing is eased past, not jumped.)
      const snapped = hard && !hard(c.x, c.y, c.z);
      if (snapped) { c.x = tx; c.y = ty; c.z = tz; }
      E.followInfo = { s, sHard, boom: sl, snapped: !!snapped };   // for probes: what the camera did this frame
      let dy = yaw - c.yaw;
      while (dy > Math.PI) dy -= TAU;
      while (dy < -Math.PI) dy += TAU;
      c.yaw += dy * k;
      // Aim at the body: standing above it means looking down, and in this
      // transform down is a NEGATIVE pitch.
      const back = Math.hypot(c.x - ax, c.z - az) || 0.001;
      c.pitch = clamp(-Math.atan2(c.y - ay, back) + (o.tilt || 0), -1.3, 0.8);
      return s;
    };

    /* ── input ────────────────────────────────────────────────────────── */
    /** Keys, a drag to look, a wheel to pull the camera in or out. The keys
     *  stay quiet while a text field has focus, and drop on blur so a body
     *  never runs on by itself. */
    E.controls = (el, o) => {
      o = o || {};
      // o.when() (optional) says whether the keys are the world's just now: a
      // world on a page that also scrolls takes them only while it is in view.
      const C = { keys: { fwd: false, back: false, left: false, right: false, fast: false },
        look: 0, tilt: 0, turn: 0, dist: o.dist || 50, min: o.minDist || 12, max: o.maxDist || 150, pref: 1 };
      /** Nearer (f < 1) or farther (f > 1), within the limits: the wheel, a pinch, a
       *  button. C.pref keeps the visitor's own zoom as a factor, so a world can give
       *  each place its own distance and still honour it. */
      C.zoom = (f) => { const d = clamp(C.dist * f, C.min, C.max); C.pref *= d / C.dist; C.dist = d; };
      // WASD, and ZQSD for an AZERTY keyboard, where those keys sit.
      const KEY = { ArrowUp: "fwd", w: "fwd", W: "fwd", z: "fwd", Z: "fwd", ArrowDown: "back", s: "back", S: "back",
        ArrowLeft: "left", a: "left", A: "left", q: "left", Q: "left", ArrowRight: "right", d: "right", D: "right" };
      function mine(ev) {
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return false;
        if (o.when && !o.when()) return false;
        const a = document.activeElement, tag = (a && a.tagName || "").toLowerCase();
        return !(tag === "input" || tag === "textarea" || tag === "select" || (a && a.isContentEditable));
      }
      const down = (ev) => {
        if (!mine(ev)) return;
        if (ev.key === "Shift") { C.keys.fast = true; return; }
        if (KEY[ev.key]) { C.keys[KEY[ev.key]] = true; ev.preventDefault(); }
      };
      const up = (ev) => { if (ev.key === "Shift") C.keys.fast = false; if (KEY[ev.key]) C.keys[KEY[ev.key]] = false; };
      const drop = () => { const k = C.keys; k.fwd = k.back = k.left = k.right = k.fast = false; };
      document.addEventListener("keydown", down);
      document.addEventListener("keyup", up);
      window.addEventListener("blur", drop);
      // A mouse drags to look about, the view swinging back behind the body after.
      // A finger, as touch games with a camera behind do, drags sideways to TURN
      // the body (C.turn, which the world takes each frame: there are no keys on
      // a phone, and a look that swung back left no way to face anywhere) and up
      // or down to tilt; two fingers pinch to zoom.
      let drag = null, pinch = null;
      const touches = new Map();
      const span = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
      const pd = (ev) => {
        if (ev.pointerType === "touch") {
          touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (touches.size === 2) { pinch = { span: span(), dist: C.dist }; if (drag) drag.moved = 99; }   // a pinch is never a tap
        }
        if (!drag) drag = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, look: C.look, tilt: C.tilt, moved: 0, t: performance.now(), touch: ev.pointerType === "touch" };
        try { el.setPointerCapture(ev.pointerId); } catch (e) { /* older Safari */ }
        ev.preventDefault();
      };
      const pm = (ev) => {
        if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pinch && touches.size >= 2) { C.zoom(clamp(pinch.dist * pinch.span / span(), C.min, C.max) / C.dist); return; }
        if (!drag) return;
        drag.moved = Math.max(drag.moved, Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y));
        if (drag.touch) { C.turn += (ev.clientX - drag.lx) * 0.009; drag.lx = ev.clientX; }
        else C.look = clamp(drag.look + (ev.clientX - drag.x) * 0.006, -1.1, 1.1);
        C.tilt = clamp(drag.tilt - (ev.clientY - drag.y) * 0.004, -0.5, 0.6);
      };
      // A press that did not move is a TAP: the world gets it as a point on the
      // canvas, in CSS pixels, and can send the body there.
      const pu = (ev) => {
        touches.delete(ev.pointerId);
        if (touches.size < 2) pinch = null;
        if (touches.size) return;                              // a finger still down: the gesture goes on
        if (drag && drag.moved < 6 && C.onTap) {               // however long it was held
          const r = el.getBoundingClientRect();
          C.onTap(ev.clientX - r.left, ev.clientY - r.top);
        }
        drag = null;
      };
      const wh = (ev) => { C.zoom(1 + Math.sign(ev.deltaY) * 0.12); ev.preventDefault(); };
      el.addEventListener("pointerdown", pd); el.addEventListener("pointermove", pm);
      window.addEventListener("pointerup", pu); window.addEventListener("pointercancel", pu); el.addEventListener("wheel", wh, { passive: false });
      C.dispose = () => {
        document.removeEventListener("keydown", down); document.removeEventListener("keyup", up);
        window.removeEventListener("blur", drop); el.removeEventListener("pointerdown", pd);
        el.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); window.removeEventListener("pointercancel", pu); el.removeEventListener("wheel", wh);
      };
      return C;
    };

    return E;
  }

  window.MH_3D = { create, hull, traceRing, roughRing, tracePath, leafPath, shapes, ringScale, rgbOf, mix, rgba, shade, clamp, lerp, smooth, TAU };
})();
