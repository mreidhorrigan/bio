// @ts-check
"use strict";
/* The avatar painter below is extracted from ../../engine.js defPaintAvatar.
   The surrounding loop only supplies the same inputs that the world supplies. */
(function () {
  const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#slime"));
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const keys = new Set();
  let pointer = false, pointerX = canvas.width / 2, pointerY = canvas.height / 2;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (f - r) * p); gg = Math.round(gg + (f - gg) * p); b = Math.round(b + (f - b) * p);
    return `rgb(${r},${gg},${b})`;
  }
  function shadow(ctx, cx, cy, rx) { ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

  function paintAvatar(ctx, sx, sy, a) {
    const baseY = sy + 6, r = 13, ink = a.ink || shade(a.color, -0.5);
    const land = a.moving && !a.wave && !reduce;
    let rx, ry, lean = 0, swell = 0;
    if (land) {
      const lp = a.t * 5.6, sw = Math.sin(lp);
      rx = r * (1 + 0.13 * sw); ry = r * (1 - 0.1 * sw);
      lean = r * 0.5 * a.dx * sw;
      swell = rx * 0.28 * a.dx * Math.cos(lp);
    } else {
      const amp = a.wave ? 0.16 : 0.09, p = reduce ? 0 : Math.sin(a.t * (a.wave ? 4.4 : 3.2)) * amp;
      rx = r * (1 + p); ry = r * (1 - p * 0.7);
    }
    if (a.glow && !reduce && !a.beam) {
      ctx.save(); ctx.shadowColor = a.glow; ctx.shadowBlur = 18; ctx.fillStyle = a.glow;
      ctx.beginPath(); ctx.ellipse(sx, baseY - ry * 0.4, rx * 0.95, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (a.wave && !reduce) {
      ctx.save(); ctx.strokeStyle = "rgba(191,232,255,0.4)"; ctx.lineWidth = 1.3; const ph = (a.t * 1.4) % 1;
      ctx.beginPath(); ctx.ellipse(sx, baseY + 2, 9 + ph * 9, 4 + ph * 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    let grad;
    if (a.gel) {
      grad = ctx.createRadialGradient(sx - rx * 0.3, baseY - ry * 0.95, 1, sx, baseY - ry * 0.35, rx * 1.25);
      grad.addColorStop(0, shade(a.color, 0.55)); grad.addColorStop(0.5, a.color); grad.addColorStop(1, shade(a.color, -0.26));
    } else {
      grad = ctx.createLinearGradient(0, baseY - ry, 0, baseY);
      grad.addColorStop(0, shade(a.color, 0.3)); grad.addColorStop(1, a.color);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (land) {
      const ty = baseY - ry, ax = sx + lean + swell;
      ctx.moveTo(sx - rx, baseY); ctx.quadraticCurveTo(sx - rx + lean, ty, ax, ty); ctx.quadraticCurveTo(sx + rx + lean, ty, sx + rx, baseY); ctx.closePath();
    } else { ctx.moveTo(sx - rx, baseY); ctx.ellipse(sx, baseY, rx, ry, 0, Math.PI, 0, false); ctx.closePath(); }
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.lineJoin = "round"; ctx.stroke();
    if (a.gel) { ctx.fillStyle = "rgba(255,255,255,0.32)"; ctx.beginPath(); ctx.ellipse(sx - rx * 0.32 + lean * 0.6, baseY - ry * 0.95, rx * 0.22, ry * 0.16, -0.5, 0, Math.PI * 2); ctx.fill(); }
    const ex = sx + a.dx * 4 + lean * 0.6, ey = baseY - ry * 0.6 + a.dy * 2.5;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex + a.dx * 1.7, ey + a.dy * 1.7, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  function localPoint(e) { const r = canvas.getBoundingClientRect(); pointerX = (e.clientX - r.left) * canvas.width / r.width; pointerY = (e.clientY - r.top) * canvas.height / r.height; }
  canvas.addEventListener("pointerdown", (e) => { pointer = true; canvas.setPointerCapture(e.pointerId); localPoint(e); });
  canvas.addEventListener("pointermove", (e) => { if (pointer) localPoint(e); });
  canvas.addEventListener("pointerup", () => { pointer = false; });
  canvas.addEventListener("pointercancel", () => { pointer = false; });
  window.addEventListener("keydown", (e) => { if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"].includes(e.key)) { keys.add(e.key); e.preventDefault(); } });
  window.addEventListener("keyup", (e) => keys.delete(e.key));

  function frame(ms) {
    const cx = canvas.width / 2, groundY = canvas.height / 2 + 35;
    let dx = 0, dy = 1, moving = pointer || keys.size > 0;
    if (pointer) { dx = pointerX - cx; dy = pointerY - groundY; }
    else if (keys.size) {
      dx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
      dy = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    }
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save(); g.translate(cx, groundY); g.scale(5, 5); g.translate(-cx, -groundY);
    shadow(g, cx, groundY, 15);
    paintAvatar(g, cx, groundY - 8, { dx, dy, color: "#4FA373", ink: "#1f3a1a", gel: true, glow: null, beam: false, wave: false, t: ms / 1000, moving });
    g.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
