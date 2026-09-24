// @ts-check
"use strict";
/* ============================================================================
   slimeverse3d-page.js  ·  the page round the 3D slimeverse (slimeverse3d.html)
   ----------------------------------------------------------------------------
   The iso village's Slimeverse 3D house (content.js, Games) opens this page,
   and the page starts inside that house. From there the whole village can be
   walked in 3D, the same village as the isometric one. As in the iso village:

     a house          opens its menu or its page when walked into or clicked:
                      a road-house or a page kiosk its link (a page of this
                      site in this tab, another site in a new tab), the
                      Music and Games kiosks their menus, a prose kiosk its
                      words; only the Slimeverse 3D house leads inside
     the wellhead     opens the Glossary
     the hatch        in the Slimeverse 3D house, down to the cave, where the
                      slime drops in under the shaft and lands; the rope there
                      climbs back up into the house, beside the hatch

   THE ADDRESS speaks the iso world's language, so the two views agree:
     ?theme=technurture|gloomthmaxx|bureaucore   (or a registry id; ?skin= too)
     ?slime=x,y       where the slime stands: in the village, iso tiles (the
                      iso world's own ?slime=); in the house or the cave, that
                      place's own units
     ?facing=fx,fy    in the village, the way it faces, as an iso direction
                      (with none, up the iso screen, the way the iso view looks)
     ?place=village|house|cave                 (a missing place is the house)
   With no theme in the address, the skin is the one last chosen in the iso
   world (localStorage mh-skin), or the one it would pick by the time of day.
   Choosing a skin here is remembered the same way, and keeps the slime where
   it stands, as the iso world does.

   THE SWITCH between the views: in the village, "Isometric" opens the iso
   world on the slime's spot, facing its way, and the iso world's "3D" button
   comes back the same way. Inside, "‹ Village" returns to the house's door.
   ========================================================================== */
(function () {
  const V = window.MH_VERSE3D;
  const cv = /** @type {HTMLCanvasElement|null} */ (document.getElementById("stage"));
  if (!V || !cv) return;
  const I18N = window.MH_I18N;
  const t = (key, en, vars) => (I18N ? I18N.t(key, en, vars) : en);
  /** Words the page writes, kept in the reader's language: a switch re-renders them. */
  const say = (el, key, en, vars) => { if (!el) return; if (I18N && I18N.live) I18N.live(el, key, en, vars); else el.textContent = en; };
  const ALIAS = { bureaucore: "technocute", gloomthmaxx: "technoscure" }, SHARE = { technocute: "bureaucore", technoscure: "gloomthmaxx" };
  const SKINS = ["technurture", "technoscure", "technocute"];
  const PLACE = { village: "outdoors", house: "indoors", cave: "cave" }, PLACE_NAME = { outdoors: "village", indoors: "house", cave: "cave" };

  /** The skin a fresh visit lands on, as the iso world chooses it (engine.js timeDefaultSkin). */
  function timeDefaultSkin() {
    const d = new Date(), h = d.getHours(), day = d.getDay();
    if (day >= 1 && day <= 5 && h >= 9 && h < 17) return "technocute";
    if (h >= 6 && h < 20) return "technurture";
    return "technoscure";
  }
  const q = new URLSearchParams(location.search);
  const asked = (v) => { const id = ALIAS[v || ""] || v; return SKINS.includes(id || "") ? id : null; };
  let remembered = null;
  try { remembered = window.localStorage && window.localStorage.getItem("mh-skin"); } catch (e) { /* private or file: fine */ }
  const skin = asked(q.get("theme")) || asked(q.get("skin")) || asked(remembered) || timeDefaultSkin();

  /* ── the card a house opens ───────────────────────────────────────────── */
  const card = document.getElementById("card"), cardTitle = document.getElementById("card-title"), cardBody = document.getElementById("card-body");
  const close = () => { if (card) card.hidden = true; cv.focus({ preventScroll: true }); };
  if (card) {
    card.addEventListener("click", (e) => {
      const el = /** @type {HTMLElement} */ (e.target), a = el.closest("a");
      if (a && !a.getAttribute("target")) reflect(true);      // leaving for a page of the site: the address keeps the spot, for Back
      if (e.target === card || el.closest(".close")) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });
  }
  const href = (url) => (I18N && I18N.href ? I18N.href(url) : url);     // the French page in French mode, as the iso world opens it
  const sameSite = (url) => { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } };
  /** Open a page as the iso village does: one of this site's in this tab (the address
   *  brought up to the slime's spot first, so Back returns to it), another site's in a new tab. */
  function openPage(url) {
    if (sameSite(url)) { reflect(true); location.href = href(url); return; }
    try { const w = window.open(href(url), "_blank"); if (w) w.opener = null; } catch (e) { /* blocked: the card's link still works */ }
  }
  const away = (url) => (sameSite(url) ? "" : ' target="_blank" rel="noopener"');
  function showCard(title, html) {
    if (!card || !cardTitle || !cardBody) return;
    cardTitle.textContent = title; cardBody.innerHTML = html; card.hidden = false;
    const first = cardBody.querySelector("a,button"); if (first) /** @type {HTMLElement} */ (first).focus();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const linkCard = (title, url) => showCard(title, (sameSite(url) ? "" : '<p>' + esc(t("slimeverse3d.opensIn", "This opens in a new tab.")) + '</p>')
    + '<a class="go" href="' + esc(href(url)) + '"' + away(url) + '>' + esc(t("slimeverse3d.open", "Open {title}", { title })) + "</a>");

  /** What a house opens, as the iso village opens it (engine.js openCard). */
  function onOpen(item, how) {
    if (!item) return;
    const click = !!(how && how.click);
    if (item.url && /slimeverse3d\.html/.test(item.url)) { enterHouse(); return; }   // the house this page lives in: go inside
    if (item.kind === "link") { if (click) openPage(item.url); else linkCard(item.title, item.url); return; }
    const k = item.kiosk || {}, page = k.page;
    if (page && page.url) { if (click) openPage(page.url); else linkCard(item.title, page.url); return; }
    if (page && page.toc) {                                    // Music, Games: the menu of links
      showCard(item.title, '<div class="toc">' + page.toc.map((it) => '<a href="' + esc(href(it.url)) + '"' + away(it.url) + '>' + esc(it.label) + "</a>").join("") + "</div>");
      return;
    }
    showCard(item.title, t("kiosk." + k.title + ".html", k.html || ""));   // a prose kiosk: its words, in the reader's language
  }

  /* ── the view ─────────────────────────────────────────────────────────── */
  const W = V.create(cv, {
    skin, doors: "menus", onOpen,
    onScene() { reflect(true); },
  });
  // @ts-ignore: for probes and the console
  window.MH_SLIMEVERSE3D = W;

  /** Into the Slimeverse 3D house, its way out leading back to its own door. */
  function enterHouse() { W.setBack("outdoors", "home"); W.load("indoors", "door"); }

  /* ── the address ──────────────────────────────────────────────────────── */
  let lastShare = 0, lastAt = "";
  function reflect(now) {
    if (!now && performance.now() - lastShare < 500) return;
    lastShare = performance.now();
    const S = W.S(); if (!S) return;
    const base = W.scene().split("@")[0];
    let at;
    if (base === "outdoors" && S.tileOf) { const [tx, ty] = S.tileOf(W.me.x, W.me.z); at = tx.toFixed(3) + "," + ty.toFixed(3); }
    else at = W.me.x.toFixed(2) + "," + W.me.z.toFixed(2);
    const facing = base === "outdoors" && S.tileDir ? S.tileDir(W.me.yaw).map((v) => v.toFixed(2)).join(",") : "";
    const key = base + at + facing + W.skin();
    if (key === lastAt) return;
    lastAt = key;
    try {
      const u = new URL(location.href);
      u.searchParams.set("theme", SHARE[W.skin()] || W.skin());
      u.searchParams.delete("skin");
      u.searchParams.set("place", PLACE_NAME[base] || "house");
      u.searchParams.set("slime", at);
      if (facing) u.searchParams.set("facing", facing); else u.searchParams.delete("facing");
      history.replaceState(history.state, "", u.href);
    } catch (e) { /* file URL or restricted history */ }
    views(base === "outdoors");
  }
  let homeTile = null;
  /** The iso world at the spot the slime has reached: in the village, where it
   *  stands and the way it faces; inside, the house's door. In the skin in use,
   *  and with the rest of the address as it came (the iso world's signal towers). */
  function isoHref() {
    const S = W.S(), out = W.scene().startsWith("outdoors") && S && S.tileOf;
    const tile = out ? S.tileOf(W.me.x, W.me.z) : homeTile, dir = out && S.tileDir ? S.tileDir(W.me.yaw) : null;
    let p;
    try { p = new URL(location.href).searchParams; } catch (e) { p = new URLSearchParams(); }
    p.delete("place"); p.delete("skin"); p.set("theme", SHARE[W.skin()] || W.skin());
    if (tile) p.set("slime", tile[0].toFixed(3) + "," + tile[1].toFixed(3)); else p.delete("slime");
    if (dir) p.set("facing", dir[0].toFixed(3) + "," + dir[1].toFixed(3)); else p.delete("facing");
    return href("index.html?" + p.toString());
  }
  // the switch shows in the village, "‹ Village" inside (in the village it would do the same);
  // each link is brought up to the moment as it is followed, the slime having moved since
  const toIso = document.getElementById("view-iso"), back = document.getElementById("back");
  function views(out) {
    if (toIso) { toIso.hidden = !out; toIso.setAttribute("href", isoHref()); }
    if (back) { back.hidden = out; back.setAttribute("href", isoHref()); }
  }
  for (const a of [toIso, back]) if (a) a.addEventListener("click", () => a.setAttribute("href", isoHref()));

  /* ── the start: where the address says, or inside the house ────────── */
  const place = PLACE[q.get("place") || "house"] || "indoors";
  const at = (q.get("slime") || "").split(",").map(Number);
  W.load("outdoors");                                          // the village first, to know where the house stands
  {
    const O = W.S(), h = O.entries && O.entries.home;
    if (h && O.tileOf) homeTile = O.tileOf(h.x, h.z);
  }
  W.setBack("outdoors", "home");                               // the house's door leads out to its own door, however the house was reached (up the cave's rope, say)
  if (place === "outdoors") {
    if (at.length === 2 && at.every(Number.isFinite)) {
      const O = W.S(), p = O.fromTile(at[0], at[1]), f = (q.get("facing") || "").split(",").map(Number);
      const yaw = f.length === 2 && f.every(Number.isFinite) && Math.hypot(f[0], f[1]) > 1e-6 ? O.tileYaw(f[0], f[1]) : O.tileYaw(-1, -1);
      W.load("outdoors", { x: p[0], z: p[1], yaw });
    }
    else W.load("outdoors", "home");
  } else if (place === "cave") {
    W.load("cave", at.length === 2 && at.every(Number.isFinite) ? { x: at[0], z: at[1], yaw: 0 } : "start");
  } else {
    W.load("indoors", at.length === 2 && at.every(Number.isFinite) ? { x: at[0], z: at[1], yaw: 0 } : "door");
  }
  W.run();
  setInterval(() => reflect(false), 500);

  /* ── skins ────────────────────────────────────────────────────────────── */
  const chips = Array.from(document.querySelectorAll("[data-skin]"));
  const showSkin = (k) => { for (const b of chips) b.setAttribute("aria-pressed", String(b.getAttribute("data-skin") === k)); };
  showSkin(W.skin());
  for (const b of chips) b.addEventListener("click", () => {
    const k = String(b.getAttribute("data-skin"));
    W.setSkin(k); showSkin(k);                                  // the slime stays where it is
    try { window.localStorage && window.localStorage.setItem("mh-skin", k); } catch (e) { /* fine */ }   // the iso world remembers it too
    reflect(true);
    cv.focus({ preventScroll: true });
  });

  /* ── the menu: the buildings, as the iso village's Menu lists them ─── */
  const menuBtn = document.getElementById("menu"), navbar = document.getElementById("navbar");
  const C = window.MH_CONTENT;
  if (menuBtn && navbar && C) {
    const chip = (key, en, vars, go) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "navchip";
      say(b, key, en, vars); b.addEventListener("click", () => { showMenu(false); go(); }); navbar.appendChild(b);
    };
    chip("world.plaza", "◇ Plaza", null, () => W.load("outdoors", "start"));
    C.kiosks.forEach((k, i) => {
      const title = t("kiosk." + k.title + ".title", k.title);
      chip("slimeverse3d.navchip", "{n}. {title}", { n: i + 1, title }, () => onOpen({ kind: "kiosk", title: k.title, kiosk: k }, { click: true }));
    });
    const showMenu = (on) => { navbar.hidden = !on; menuBtn.setAttribute("aria-expanded", String(on)); };
    menuBtn.addEventListener("click", () => showMenu(navbar.hidden));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !navbar.hidden) showMenu(false); });
  }
  /* ── the zoom: + and −, as well as the wheel and a pinch ─────────────── */
  // A phone starts a little farther back: its screen is narrow, and the slime filled it.
  const ZOOM = "mh-3d-zoom";                                   // the visitor's zoom, as a factor on each place's own distance
  let saved = NaN;
  try { saved = Number(window.localStorage && window.localStorage.getItem(ZOOM)); } catch (e) { /* private: fine */ }
  W.controls.zoom(Number.isFinite(saved) && saved > 0.2 && saved < 5 ? saved : window.innerWidth < 620 ? 1.4 : 1);
  const keep = () => { try { window.localStorage && window.localStorage.setItem(ZOOM, W.controls.pref.toFixed(3)); } catch (e) { /* fine */ } };
  for (const [id, f] of [["zoom-in", 1 / 1.25], ["zoom-out", 1.25]]) {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", () => { W.controls.zoom(f); keep(); cv.focus({ preventScroll: true }); });
  }
  cv.addEventListener("wheel", () => setTimeout(keep, 0), { passive: true });
  cv.addEventListener("pointerup", () => setTimeout(keep, 0));
  // M mutes and unmutes, as in the iso village
  document.addEventListener("keydown", (e) => {
    if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) W.setMuted(!W.muted());
  });
  // the keys hint makes way once the visitor has moved
  const keys = document.querySelector(".keys");
  if (keys) { const hide = () => keys.classList.add("gone"); ["keydown", "pointerdown"].forEach((ev) => window.addEventListener(ev, hide, { once: true })); setTimeout(hide, 12000); }
})();
