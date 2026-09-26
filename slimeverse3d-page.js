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

  const used = {};                                             // what the visitor has done (the slime's tips skip it)
  /* ── the card a house opens ───────────────────────────────────────────── */
  const card = document.getElementById("card"), cardTitle = document.getElementById("card-title"), cardBody = document.getElementById("card-body");
  let cardReturn = null;                                       // where focus was when the card opened: it goes back there
  const close = () => {
    if (card) card.hidden = true;
    const back = cardReturn; cardReturn = null;
    if (back && back !== document.body && back.isConnected && back.getClientRects().length) back.focus({ preventScroll: true });
    else cv.focus({ preventScroll: true });
  };
  if (card) {
    // a modal: Tab and Shift-Tab go round the card's own controls, not out behind it
    card.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || card.hidden) return;
      const all = Array.from(card.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((el) => el.getClientRects().length);
      if (!all.length) return;
      const first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    card.addEventListener("click", (e) => {
      const el = /** @type {HTMLElement} */ (e.target), a = el.closest("a");
      if (a && !a.getAttribute("target")) { reflect(true); rememberReturn(); }   // leaving for a page of the site: the address keeps the spot, for Back
      if (e.target === card || el.closest(".close")) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !card.hidden) close(); });
  }
  const href = (url) => (I18N && I18N.href ? I18N.href(url) : url);     // the French page in French mode, as the iso world opens it
  /** Note this village's address (with the slime's spot) for the tab, so a page opened from it can send the visitor back. */
  const rememberReturn = () => { try { if (window.sessionStorage) sessionStorage.setItem("mh-return", location.href); } catch (e) { /* private: fine */ } };
  const sameSite = (url) => { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } };
  /** Open a page as the iso village does: one of this site's in this tab (the address
   *  brought up to the slime's spot first, so Back returns to it), another site's in a new tab. */
  function openPage(url) {
    if (sameSite(url)) { reflect(true); rememberReturn(); location.href = href(url); return; }
    try { const w = window.open(href(url), "_blank"); if (w) w.opener = null; } catch (e) { /* blocked: the card's link still works */ }
  }
  const away = (url) => (sameSite(url) ? "" : ' target="_blank" rel="noopener" aria-describedby="mh-newtab"');
  // Where the slime stood when the card opened (noted on the next frame): walking
  // AWAY from there, or into another place, closes it, as walking does in the iso village.
  let cardAt = null;
  const AWAY = 4;
  function showCard(title, html) {
    if (!card || !cardTitle || !cardBody) return;
    if (card.hidden) cardReturn = /** @type {HTMLElement} */ (document.activeElement);
    cardTitle.textContent = title; cardBody.innerHTML = html; card.hidden = false; cardAt = null;
    const first = cardBody.querySelector("a,button"); if (first) /** @type {HTMLElement} */ (first).focus();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const linkCard = (title, url) => showCard(title, (sameSite(url) ? "" : '<p>' + esc(t("slimeverse3d.opensIn", "This opens in a new tab.")) + '</p>')
    + '<a class="go" href="' + esc(href(url)) + '"' + away(url) + '>' + esc(t("slimeverse3d.open", "Open {title}", { title })) + "</a>");

  /** What a house opens, as the iso village opens it (engine.js openCard). */
  function onOpen(item, how) {
    if (!item) return;
    used.open = true;
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

  /* ── the signal towers raised in the iso world ─────────────────────────
     They ride in the address (?signals=, written by the Musebots bundle), so the
     switch carries them both ways. Here they stand in the village, each lit by its
     Musebot and playing, as in the iso world: the bundle (signal-towers.js, loaded
     only when there are towers) restores them into TOWERS. It asks its host page
     for an audio context (MH_ISO.sharedAudioContext, as engine.js gives it): this
     page's has a speaker gain for a destination, so the Mute silences them too. */
  const TOWERS = [];
  let towerCtx = null, towerSpeaker = null, towersMuted = false;
  if (q.get("signals")) {
    // @ts-ignore: the bundle's host hooks, the two it uses of the iso world's
    window.MH_ISO = window.MH_ISO || {
      sharedAudioContext() {
        if (towerCtx) return towerCtx;
        const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        towerCtx = new AC({ latencyHint: "interactive" });
        try {
          const real = towerCtx.destination;
          towerSpeaker = towerCtx.createGain(); towerSpeaker.gain.value = towersMuted ? 0 : 1; towerSpeaker.connect(real);
          Object.defineProperty(towerCtx, "destination", { configurable: true, get: () => towerSpeaker });
        } catch (e) { towerSpeaker = null; }
        return towerCtx;
      },
      setMusebotAudioActive() { /* the iso world's cue levels: nothing to lift here */ },
    };
    const ready = () => { const M = window.MH_MUSEBOTS; if (M && M.restore) M.restore(TOWERS); };
    window.addEventListener("mh-musebots-ready", ready, { once: true });
    const unlock = () => { const M = window.MH_MUSEBOTS; if (M && M.unlock && !towersMuted) M.unlock(); };
    for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, unlock, { passive: true });
    window.addEventListener("load", () => {
      const s = document.createElement("script");
      s.src = "signal-towers.js?v=20260826-wasm-dsp-2"; s.async = true;   // the iso world's version, so a file:// Chrome shares its cache
      document.body.appendChild(s);
    }, { once: true });
  }
  const towerState = (uid) => (window.MH_MUSEBOTS ? window.MH_MUSEBOTS.stateFor(uid) : { state: "unassigned", beat: 0 });

  /* ── the view ─────────────────────────────────────────────────────────── */
  const W = V.create(cv, {
    skin, doors: "menus", onOpen, towers: () => TOWERS, towerState,
    onScene() { reflect(true); },
    onFrame() {
      if (!card || card.hidden) { cardAt = null; return; }
      const here = { x: W.me.x, z: W.me.z, scene: W.scene() };
      if (!cardAt) cardAt = here;
      else if (here.scene !== cardAt.scene || Math.hypot(here.x - cardAt.x, here.z - cardAt.z) > AWAY) close();
    },
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
  // The towers are heard from where the slime stands in the village, in iso tiles as
  // the iso world tells the bundle; in the house or the cave, from the house's door.
  // The ring's size, in tiles, is the village's (a skin's own), noted when there.
  let towerPeriod = 0;
  setInterval(() => {
    const M = window.MH_MUSEBOTS, S = W.S();
    if (!M || !M.updateListener || !TOWERS.length || !S) return;
    const out = W.scene().startsWith("outdoors") && S.tileOf;
    if (out && S.period) towerPeriod = S.period / V.ISO.tile;
    const at = out ? S.tileOf(W.me.x, W.me.z) : homeTile;
    if (at && towerPeriod) M.updateListener(at[0], at[1], towerPeriod, TOWERS);
  }, 250);

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
  /* ── Space: the next house ─────────────────────────────────────────────
     As in the iso village: the slime goes to the front of the next house on the
     menu (after the one it stands at, or went to last; from anywhere else, the
     first), and the house opens its page, as its chip in the menu does. Coming back,
     the address puts the slime there, so Space goes on to the one after. A focused
     button keeps Space for itself (it presses it), and a field for typing. */
  let lastStop = -1;
  function stopAt() {                                          // the house the slime stands at, if any
    if (!C || !W.scene().startsWith("outdoors")) return -1;
    let best = -1, bd = 16;
    C.kiosks.forEach((k, i) => { const q = doorOf(k); if (q) { const d = Math.hypot(W.me.x - q.x, W.me.z - q.z); if (d < bd) { bd = d; best = i; } } });
    return best;
  }
  function doorOf(k) { const S = W.S(); return (S.portals || []).find((p) => p.open && p.open.kind === "kiosk" && p.open.title === k.title) || null; }
  function nextStop() {
    if (!C || !C.kiosks.length) return;
    const at = stopAt() >= 0 ? stopAt() : lastStop;
    const i = at < 0 ? (C.home || 0) : (at + 1) % C.kiosks.length, k = C.kiosks[i];
    lastStop = i; used.next = true;
    if (card && !card.hidden) { card.hidden = true; cardReturn = null; }
    if (!W.scene().startsWith("outdoors")) W.load("outdoors", "start");
    const q = doorOf(k), S = W.S();
    if (q) {
      // eight units out from its door, facing it: a house's own way out if it has one, else away from the plaza's middle
      const outs = Object.keys(S.entries || {}).filter((n) => /^house\d+$/.test(n)).map((n) => S.entries[n]);
      let spot = outs.reduce((b, e) => (!b || Math.hypot(e.x - q.x, e.z - q.z) < Math.hypot(b.x - q.x, b.z - q.z) ? e : b), null);
      if (!spot || Math.hypot(spot.x - q.x, spot.z - q.z) > 12) {
        const st = S.entries.start, dx = st.x - q.x, dz = st.z - q.z, d = Math.hypot(dx, dz) || 1;
        spot = { x: q.x + (dx / d) * (q.r + 4), z: q.z + (dz / d) * (q.r + 4) };
      }
      W.load("outdoors", { x: spot.x, z: spot.z, yaw: Math.atan2(q.x - spot.x, q.z - spot.z) });
    }
    onOpen({ kind: "kiosk", title: k.title, kiosk: k }, { click: true });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const el = /** @type {HTMLElement} */ (e.target), tag = ((el && el.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || (el && el.isContentEditable)) return;
    if (el && el.closest && el.closest("button, summary, [role=button]")) return;
    e.preventDefault(); nextStop();
  });
  // A button pressed with a mouse or a finger gives focus back to the world, so Space goes on
  // to the next house instead of pressing that button again (from the keyboard, e.detail is 0).
  document.addEventListener("click", (e) => {
    const b = e.target && /** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest(".hudbtn, .navchip, .skin");
    if (b && e.detail > 0 && document.activeElement === b) cv.focus({ preventScroll: true });
  });

  /* ── the zoom: + and − (buttons and keys), as well as the wheel and a pinch ── */
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
  // and the keys + and − (= and -, their unshifted keys, and the number pad's), as the
  // slime's tip says; with Cmd or Ctrl they stay the browser's own zoom of the page
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    const f = e.key === "+" || e.key === "=" ? 1 / 1.25 : e.key === "-" || e.key === "_" || e.key === "\u2212" ? 1.25 : 0;
    if (!f) return;
    e.preventDefault(); W.controls.zoom(f); keep();
  });
  cv.addEventListener("wheel", () => setTimeout(keep, 0), { passive: true });
  cv.addEventListener("pointerup", () => setTimeout(keep, 0));
  // Sound off and on: the button, or M, as in the iso village; kept for the visit, in both views
  const muteBtn = document.getElementById("mute");
  const setMute = (m) => {
    W.setMuted(!!m);
    towersMuted = !!m;
    if (towerCtx && towerSpeaker) towerSpeaker.gain.setTargetAtTime(m ? 0 : 1, towerCtx.currentTime, 0.02);
    try { if (window.sessionStorage) sessionStorage.setItem("mh-muted", m ? "1" : "0"); } catch (e) { /* private: this page only */ }
    if (muteBtn) muteBtn.setAttribute("aria-pressed", String(!!m));
  };
  try { if (window.sessionStorage && sessionStorage.getItem("mh-muted") === "1") setMute(true); } catch (e) { /* private: sound on */ }
  if (muteBtn) muteBtn.addEventListener("click", () => setMute(!W.muted()));
  document.addEventListener("keydown", (e) => {
    if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) setMute(!W.muted());
  });

  /* ── the slime says what it can do ──────────────────────────────────────
     In the first person, briefly, in a bubble over the slime; a phone gets its
     own. When, is tips.js (MH_TIPS), as in the other views: each place's
     introduction ("intro") first, a moment after the slime arrives there and a
     quiet spell apart; the rest only in a long lull; each skipped once the visitor
     has done it, and said once, remembered in this browser (so neither the next
     visit nor the iso view says the same words again). The same words stand in the
     page (#tips, out of sight) for a screen reader, in the reader's language. */
  const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const TIPS = touch ? [
    ["tap", "slimeverse3d.tip.tap", "I can go where you tap.", "intro"],
    ["turn", "slimeverse3d.tip.turn", "I can turn: drag sideways."],
    ["zoom", "slimeverse3d.tip.pinch", "I can come nearer: pinch, or + and −."],
    ["open", "slimeverse3d.tip.openTap", "I can open a house: walk me in, or tap its door.", "intro"],
    ["light", "slimeverse3d.tip.lightTap", "I can climb out: tap the light.", "intro"],
  ] : [
    ["walk", "slimeverse3d.tip.walk", "I can walk: the arrow keys, or WASD.", "intro"],
    ["hurry", "slimeverse3d.tip.hurry", "I can hurry: hold shift."],
    ["tap", "slimeverse3d.tip.click", "I can go where you click."],
    ["turn", "slimeverse3d.tip.look", "I can look around: drag."],
    ["zoom", "slimeverse3d.tip.zoom", "I can come nearer: scroll, or + and −."],
    ["open", "slimeverse3d.tip.open", "I can open a house: walk me in, or click its door.", "intro"],
    ["mute", "slimeverse3d.tip.mute", "I can go quiet: press M."],
    ["next", "slimeverse3d.tip.next", "I can visit the next house: press Space.", "intro"],
    ["light", "slimeverse3d.tip.light", "I can climb out: click the light.", "intro"],
  ];
  const tipsEl = document.getElementById("tips");
  const writeTips = () => { if (tipsEl) tipsEl.textContent = TIPS.map(([, key, en]) => t(key, en)).join(" "); };
  writeTips(); document.addEventListener("mh:lang", writeTips);
  // A tip waits for a place where it holds: the houses are opened from the village;
  // in the house the walls keep the camera as near as it can come, so "I can come
  // nearer" is told outdoors or in the cave; the way out through the light is the cave's.
  const where = () => W.scene().split("@")[0];
  const holds = { open: () => where() === "outdoors", zoom: () => where() !== "indoors", light: () => where() === "cave" };
  const tips = window.MH_TIPS && window.MH_TIPS.start({
    tips: TIPS.map(([what, key, en, intro]) => ({ en, intro: intro === "intro", text: () => t(key, en), holds: holds[what], done: () => !!used[what] })),
    say: (text) => W.say(text, 3.4),
    saying: () => W.saying(),
    busy: () => !!(card && !card.hidden) || !!W.me.launch || W.fading(),
    area: where,
  });
  // what the visitor has done already, so the slime does not tell them
  const zoom0 = W.controls.pref;
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "z", "q"].includes(k)) used.walk = true;
    if (k === "shift") used.hurry = true;
    if (k === "m") used.mute = true;
  });
  const watch = setInterval(() => {
    if (!tips || !tips.left()) { clearInterval(watch); return; }  // nothing left to tell
    const C = W.controls;
    if (W.me.goal) used.tap = true;
    if (C.look || C.tilt || C.turn) used.turn = true;
    if (Math.abs(C.pref - zoom0) > 1e-6) used.zoom = true;
    if (W.me.launch) used.light = true;
  }, 200);
})();
