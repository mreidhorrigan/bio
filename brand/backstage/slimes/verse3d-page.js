// @ts-check
"use strict";
/* verse3d-page.js: the page round verse3d.html's one view.
 *
 * One canvas, one place at a time. The tabs load a place at its first entry,
 * the address keeps the place (#indoors), the readout says where the slime
 * is and how the hunt is going, and the view stops drawing while it is
 * scrolled out of sight.
 */
(function () {
  const V = window.MH_VERSE3D;
  const cv = /** @type {HTMLCanvasElement|null} */ (document.getElementById("view"));
  const fail = document.getElementById("fail");
  if (!V || !cv) { if (fail) { fail.hidden = false; fail.textContent = "The 3D engine did not load, so there is nothing to show."; } return; }
  const where = document.getElementById("where"), life = document.getElementById("life");
  const hud = /[?&]debug=1/.test(location.search) ? document.getElementById("hud") : null;
  const hudEl = document.getElementById("hud");
  if (hudEl && !hud) hudEl.hidden = true;
  const tabs = Array.from(document.querySelectorAll("[data-scene]"));
  const skinTabs = Array.from(document.querySelectorAll("[data-skin]"));
  const SKINS = ["technurture", "technoscure", "technocute"];
  // the skin: from the address (?skin=), else the one last chosen in the iso world, else by day
  let skin = new URLSearchParams(location.search).get("skin");
  if (!SKINS.includes(skin || "")) { try { skin = window.localStorage && window.localStorage.getItem("mh-skin"); } catch (e) { skin = null; } }
  if (!SKINS.includes(skin || "")) skin = "technurture";
  const showSkin = (k) => { for (const b of skinTabs) b.setAttribute("aria-pressed", String(b.getAttribute("data-skin") === k)); };
  let visible = true;

  const W = V.create(cv, {
    skin,
    // ?distance=mist shows the distance as a haze (the earlier way) instead of out of focus
    distance: new URLSearchParams(location.search).get("distance") === "mist" ? "mist" : "focus",
    hud,
    keysWhen: () => visible,
    onScene(id) {
      const base = id.split("@")[0];
      for (const b of tabs) b.setAttribute("aria-pressed", String(b.getAttribute("data-scene") === base));
      const S = W && W.S ? W.S() : null;
      if (where) where.textContent = S ? S.name : id;
      const q = new URLSearchParams(location.search); q.set("skin", W.skin());
      try { history.replaceState(null, "", "?" + q.toString() + "#" + base); } catch (e) { /* a file: page may refuse */ }
    },
  });
  // @ts-ignore: for probes and the console
  window.MH_V3D = W;

  for (const b of tabs) b.addEventListener("click", () => { W.load(String(b.getAttribute("data-scene"))); cv.focus({ preventScroll: true }); });
  for (const b of skinTabs) b.addEventListener("click", () => { const k = String(b.getAttribute("data-skin")); W.setSkin(k); showSkin(k); cv.focus({ preventScroll: true }); });
  showSkin(skin);
  const soundBtn = document.getElementById("sound");
  if (soundBtn) soundBtn.addEventListener("click", () => {
    const on = W.muted();                                      // it was off: turn it on
    W.setMuted(!on); soundBtn.setAttribute("aria-pressed", String(on)); soundBtn.textContent = on ? "Sound on" : "Sound off";
  });
  const first = (location.hash || "").slice(1);
  W.load(V.scenes[first] || V.scenes[first + "@" + skin] ? first : "outdoors");
  W.run();

  // the hunt, in a line: who is about, and how many zoogs have been caught
  let lastLife = "";
  setInterval(() => {
    if (!life) return;
    const z = W.zoogs().filter((q) => q.alive).length, s = W.shoggoths().length;
    const text = !z && !s ? "no creatures in this skin" : z + " zoogs · " + s + (s === 1 ? " shoggoth" : " shoggoths") + " · " + W.stats.eaten + " caught";
    if (text !== lastLife) { life.textContent = text; lastLife = text; }
  }, 500);

  // draw only while the view is on screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      for (const e of es) {
        visible = e.isIntersecting;
        if (visible) W.resume(); else W.pause();
      }
    }, { threshold: 0.05 }).observe(cv);
  }
})();
