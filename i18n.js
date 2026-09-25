// @ts-check
"use strict";
/* ============================================================================
   i18n.js: the site-wide English/French switch for matthorrigan.com.
   ----------------------------------------------------------------------------
   English is the source language and is never rewritten. Every page ships its
   English words in the markup exactly as before; this file only OVERLAYS French
   on top when a visitor asks for it, and switching back restores the original
   nodes from a snapshot. The English site is the untouched site.

   Load it before menubar.js (which injects it for any page that forgets):

       <script src="i18n.js" defer></script>
       <script src="i18n-fr.js" defer></script>

   Nothing in here knows any French. All the French words live in one file,
   i18n-fr.js, so they can be read, revised, or handed to a translator on their
   own. Another language is one more i18n-<code>.js calling MH_I18N.register().

   CHOOSING A LANGUAGE
     ?lang=fr in the URL wins, so a French link is shareable, then the choice the
     visitor made earlier in THIS visit, then English. The site's default is
     English every time somebody arrives: the switch is remembered for the visit
     (sessionStorage), not for ever. A browser set to French is not enough on its
     own either: nobody is moved off the English site without asking.

   FOR PAGE CODE
     MH_I18N.t(key, english, vars)         one string, now
     MH_I18N.live(el, key, english, vars)  a string that re-translates on a switch
     MH_I18N.href(url)                     a same-site link carrying the language
     MH_I18N.apply()                       re-run the overlay over new DOM
     document.addEventListener("mh:lang", fn)   re-render anything else

   See docs/i18n.md for the dictionary format and how to add a string.
   ========================================================================== */

(function () {
  var SOURCE = "en";                  // the language the site is written in
  var STORE = "mh-lang";              // localStorage key for the remembered choice

  var dicts = Object.create(null);    // code -> dictionary, from register()
  var want = SOURCE;                  // the language asked for
  var live = [];                      // {el,…} records whose text comes from t()
  var snaps = new WeakMap();          // element -> its English values
  var touched = [];                   // the elements snaps holds, so we can restore
  var button = null;                  // the one switch, wherever it is mounted
  var ready = false;                  // has the first apply() run
  var pageLang = document.documentElement.getAttribute("lang") || "en";

  /* ── which language ──────────────────────────────────────────────────── */

  function param() {
    try {
      var v = new URLSearchParams(location.search).get("lang");
      return v ? v.trim().toLowerCase().slice(0, 2) : null;
    } catch (e) { return null; }      // no URLSearchParams: fall through to storage
  }
  // The choice lasts for the visit, not for ever: sessionStorage, so the site's
  // default is English every time somebody arrives, and a reader who switched to
  // French keeps it while they browse. A shared ?lang=fr link still works.
  function remembered() {
    try { return sessionStorage.getItem(STORE); } catch (e) { return null; }
  }
  function remember(code) {
    try { sessionStorage.setItem(STORE, code); } catch (e) { /* private mode: fine */ }
    try { localStorage.removeItem(STORE); } catch (e) { /* clear the old sticky one */ }
  }
  /** The language actually in force: what was asked for, if we can speak it. */
  function current() { return (want === SOURCE || dicts[want]) ? want : SOURCE; }
  /** The language the switch offers next. Two languages, so: the other one. */
  function other() {
    if (current() !== SOURCE) return SOURCE;
    for (var code in dicts) if (code !== SOURCE) return code;
    return "fr";                      // the dictionary has not loaded yet
  }
  /** The page's own file name, the key a dictionary files its rules under. */
  function page() {
    var name = location.pathname.split("/").pop();
    return name || "index.html";
  }

  /* ── strings ─────────────────────────────────────────────────────────── */

  /** Fill {name} placeholders from vars, in either language. */
  function fill(text, vars) {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole;
    });
  }

  /**
   * One translated string. `english` is the authored text and the fallback, so a
   * missing translation degrades to the English the page always had.
   * @param {string} key @param {string} [english] @param {Object} [vars]
   */
  function t(key, english, vars) {
    var dict = dicts[current()];
    var found = dict && dict.strings ? dict.strings[key] : null;
    return fill(found == null ? (english == null ? key : english) : found, vars);
  }

  /**
   * Set an element's text from t() AND remember how, so a language switch
   * re-renders it without the page having to redraw itself. Use it for anything
   * a script writes: status lines, counts, notices.
   * @param {Element|null} el @param {string} key @param {string} [english]
   * @param {Object} [vars] @param {{html?:boolean, attr?:string}} [opts]
   */
  function liveSet(el, key, english, vars, opts) {
    if (!el) return el;
    opts = opts || {};
    var rec = { el: el, key: key, en: english, vars: vars || null,
                html: !!opts.html, attr: opts.attr || null };
    for (var i = 0; i < live.length; i++) {        // one record per element+slot
      if (live[i].el === el && live[i].attr === rec.attr) { live[i] = rec; paint(rec); return el; }
    }
    live.push(rec);
    paint(rec);
    return el;
  }

  function paint(rec) {
    var text = t(rec.key, rec.en, rec.vars);
    if (rec.attr) rec.el.setAttribute(rec.attr, text);
    else if (rec.html) rec.el.innerHTML = text;
    else rec.el.textContent = text;
  }

  function paintLive() {
    live = live.filter(function (rec) { return rec.el.isConnected !== false; });
    live.forEach(paint);
  }

  /* ── links carry the language ────────────────────────────────────────── */

  /**
   * A same-site page link with ?lang=<code> added while a translation is on, so
   * the next page opens in the same language whatever the browser does with
   * storage (Safari keeps a separate store per file:// document). English mode
   * returns the link untouched. External, mailto, anchor, and non-page links
   * are left alone.
   * @param {string} href
   */
  function localizedHref(href) {
    var code = current();
    if (code === SOURCE || !href) return href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.charAt(0) === "#" || href.charAt(0) === "/") return href;
    var hashAt = href.indexOf("#"), hash = hashAt >= 0 ? href.slice(hashAt) : "";
    var rest = hashAt >= 0 ? href.slice(0, hashAt) : href;
    var qAt = rest.indexOf("?"), path = qAt >= 0 ? rest.slice(0, qAt) : rest;
    if (path && !/\.html?$/i.test(path)) return href;   // a PDF, an image: not a page
    try {
      var params = new URLSearchParams(qAt >= 0 ? rest.slice(qAt + 1) : "");
      params.set("lang", code);
      return path + "?" + params.toString() + hash;
    } catch (e) { return href; }
  }

  /** Rewrite every internal page link under root; restore() undoes it. */
  function localizeLinks(root) {
    var links = (root || document).querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a === button || a.classList.contains("mh-langbtn")) continue;
      var href = a.getAttribute("href"), next = localizedHref(href);
      if (next !== href) { keep(a, "attr", "href"); a.setAttribute("href", next); }
    }
  }

  /* ── markup already on the page ──────────────────────────────────────── */

  function keep(el, kind, name) {
    var s = snaps.get(el);
    if (!s) { s = { has: {}, attrs: null }; snaps.set(el, s); touched.push(el); }
    if (kind === "attr") {
      s.attrs = s.attrs || {};
      if (!(name in s.attrs)) s.attrs[name] = el.getAttribute(name);
    } else if (kind === "textNode") {
      var node = firstText(el);
      if (node && !s.has.textNode) { s.has.textNode = true; s.textNode = node.data; }
    } else if (!s.has[kind]) {
      s.has[kind] = true;
      s[kind] = kind === "html" ? el.innerHTML : el.textContent;
    }
  }

  /** The element's first non-blank text node: the words beside a control. */
  function firstText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling)
      if (c.nodeType === 3 && c.data.trim()) return c;
    return null;
  }

  /** Put every element this file has rewritten back to its English original. */
  function restore() {
    for (var i = 0; i < touched.length; i++) {
      var el = touched[i], s = snaps.get(el);
      if (!s) continue;
      if (s.has.html) el.innerHTML = s.html;
      else if (s.has.text) el.textContent = s.text;
      else if (s.has.textNode) { var tn = firstText(el); if (tn) tn.data = s.textNode; }
      if (s.attrs) for (var name in s.attrs) {
        if (s.attrs[name] == null) el.removeAttribute(name);
        else el.setAttribute(name, s.attrs[name]);
      }
      snaps.delete(el);
    }
    touched.length = 0;
  }

  function rulesFor(code) {
    var dict = dicts[code];
    if (!dict || !dict.dom) return [];
    return (dict.dom["*"] || []).concat(dict.dom[page()] || []);
  }

  /** The same rules, each tagged with the section it came from. */
  function scopedRules(code) {
    var dict = dicts[code], here = page(), out = [];
    if (!dict || !dict.dom) return out;
    (dict.dom["*"] || []).forEach(function (rule) { out.push({ scope: "*", rule: rule }); });
    (dict.dom[here] || []).forEach(function (rule) { out.push({ scope: here, rule: rule }); });
    return out;
  }

  /**
   * One dictionary rule. `sel` picks the elements; then exactly one of:
   *   text     replace the text of every match
   *   html     replace the markup of every match (for prose with links in it)
   *   attr     {name: value} attributes to set on every match
   *   each     an array: match 1 gets item 1, match 2 item 2 … (null skips one)
   *   eachHtml the same, as markup
   *   textNode replace only the element's first text node, leaving its child
   *            elements (an <input> inside a <label>) untouched
   * plus, optionally, late: true for chrome a script builds on demand, so that
   * check() does not report the rule as stale while the chrome is absent.
   */
  function applyRule(rule, root) {
    var nodes;
    try { nodes = (root || document).querySelectorAll(rule.sel); } catch (e) { return 0; }
    var list = rule.each || rule.eachHtml;
    var asHtml = rule.html != null || !!rule.eachHtml;
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (rule.attr) {
        for (var name in rule.attr) { keep(el, "attr", name); el.setAttribute(name, rule.attr[name]); }
        n++;
      }
      if (rule.textNode != null) {
        var tn = firstText(el);
        if (tn) { keep(el, "textNode", null); tn.data = rule.textNode; n++; }
        continue;
      }
      var value = list ? list[i] : (asHtml ? rule.html : rule.text);
      if (value == null) continue;                 // a gap in `each`: leave it alone
      if (asHtml) { keep(el, "html", null); el.innerHTML = value; }
      else { keep(el, "text", null); el.textContent = value; }
      n++;
    }
    return n;
  }

  /* ── the switch itself ───────────────────────────────────────────────── */

  var PILL_CSS = [
    /* Only for a page with no menubar to sit in: the walkable world. Styled like
       the world's own HUD buttons (dark pill, white text, the leaf corner) so it
       reads as chrome under every skin, light or dark. Above the intro overlay
       (z-index 10) so the switch is there before you enter the world too. */
    "#mh-lang{ position:fixed; top:max(12px, env(safe-area-inset-top)); right:calc(52px + env(safe-area-inset-right)); z-index:12; appearance:none; cursor:pointer;",
    "  font:700 12px/1 var(--mh-ui,system-ui,-apple-system,'Segoe UI',sans-serif); text-decoration:none;",
    "  padding:6px 10px; border-radius:16px 4px 16px 4px / 7px 2px 7px 2px; white-space:nowrap;",
    "  color:#fff; background:rgba(20,20,28,.7); border:1px solid rgba(255,255,255,.18); }",
    "#mh-lang:hover{ filter:brightness(1.15); }",
    "#mh-lang:focus-visible{ outline:none; box-shadow:0 0 0 2px #fff, 0 0 0 4px #111; }",
    "@media (max-width:600px){ #mh-lang{ top:max(8px, env(safe-area-inset-top)); right:calc(42px + env(safe-area-inset-right)); font-size:11px; padding:5px 8px; } }"
  ].join("\n");

  function pillCss() {
    if (document.getElementById("mh-lang-css")) return;
    var style = document.createElement("style");
    style.id = "mh-lang-css";
    style.textContent = PILL_CSS;
    document.head.appendChild(style);
  }

  /** Where the switch lives on this page: the shared menubar if there is one. */
  function host() { return document.querySelector(".mh-nav"); }

  function label(el) {
    var next = other(), dict = dicts[next];
    // The switch is written in the language it leads to: a French speaker looks
    // for "Français", not for "French". lang= tells a screen reader to say it so.
    el.textContent = (dict && dict.label) || (next === SOURCE ? "English" : next.toUpperCase());
    el.setAttribute("lang", next);
    el.setAttribute("hreflang", next);
    el.setAttribute("aria-label", (dict && dict.switchLabel) || ("Switch to " + el.textContent));
    el.setAttribute("title", el.getAttribute("aria-label"));
    try {
      var url = new URL(location.href);
      url.searchParams.set("lang", next);
      el.setAttribute("href", url.pathname.split("/").pop() + url.search + url.hash);
    } catch (e) { el.setAttribute("href", "?lang=" + next); }
  }

  function mount() {
    var nav = host();
    if (button && button.parentNode === (nav || document.body)) { label(button); return; }
    if (button && button.parentNode) button.parentNode.removeChild(button);

    button = document.createElement("a");
    button.className = "mh-langbtn";
    button.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // let a new tab happen
      e.preventDefault();
      set(other());
    });
    if (nav) {
      nav.appendChild(button);                       // inherits the menubar's pill styling
    } else {
      button.id = "mh-lang";
      pillCss();
      document.body.appendChild(button);
    }
    label(button);
  }

  /** Switch language: rewrite the page, remember the choice, update the URL. */
  function set(code) {
    code = (code || SOURCE).toLowerCase();
    if (code !== SOURCE && !dicts[code]) return;     // we do not speak it
    want = code;
    remember(code);
    try {
      var url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) { /* file:// or no history API: the language still switches */ }
    apply();
    document.dispatchEvent(new CustomEvent("mh:lang", { detail: { lang: current() } }));
  }

  /* ── running it ──────────────────────────────────────────────────────── */

  /** Re-run the overlay: English first, then this language over it. */
  function apply(root) {
    ready = true;
    restore();                                        // always back to the English page
    var code = current();
    var root = document.documentElement;
    root.setAttribute("lang", code === SOURCE ? pageLang : code);
    if (root.hasAttribute("xml:lang"))                 // the CV builder emits one
      root.setAttribute("xml:lang", code === SOURCE ? pageLang : code);
    if (code !== SOURCE) {
      rulesFor(code).forEach(function (rule) { applyRule(rule, root); });
      localizeLinks(root);
    }
    paintLive();
    if (button) label(button);
    watch(code !== SOURCE);
  }

  /* Some chrome is built long after load: the Musebot selector appears the first
     time a signal tower is placed. Watch the body for new top-level elements and
     translate inside each one as it lands. Shallow (childList only), so it costs
     nothing per frame, and switched off in English. */
  var observer = null;
  function watch(on) {
    if (!on) { if (observer) observer.disconnect(); observer = null; return; }
    if (observer || !window.MutationObserver || !document.body) return;
    observer = new MutationObserver(function (records) {
      var code = current();
      if (code === SOURCE) return;
      records.forEach(function (rec) {
        for (var i = 0; i < rec.addedNodes.length; i++) {
          var node = rec.addedNodes[i];
          if (node.nodeType !== 1 || node === button) continue;
          rulesFor(code).forEach(function (rule) { applyRule(rule, node); });
          localizeLinks(node);
        }
      });
      paintLive();
    });
    observer.observe(document.body, { childList: true });
  }

  /** A dictionary announces itself here. Order of script tags does not matter. */
  function register(code, dict) {
    dicts[code] = dict || {};
    if (ready) apply();
    if (button) label(button);
  }

  /**
   * Report dictionary rules that match nothing on this page: translations that
   * have drifted away from the markup. Run MH_I18N.check() in the console after
   * editing a page. Each entry is {sel, scope}; a "*" scope only means the rule
   * is for some other page's chrome, which is normal. A stale rule scoped to
   * THIS page is the one to fix. Returns the list and logs it.
   */
  function check(code) {
    code = code || other();
    var here = page();
    var stale = scopedRules(code).filter(function (entry) {
      if (entry.rule.late) return false;             // built on demand (a dialog): absent by design
      try { return document.querySelectorAll(entry.rule.sel).length === 0; } catch (e) { return true; }
    }).map(function (entry) { return { sel: entry.rule.sel, scope: entry.scope }; });
    var mine = stale.filter(function (e) { return e.scope === here; });
    if (mine.length) console.warn("[i18n] " + here + ": " + mine.length + " rule(s) match nothing:", mine.map(function (e) { return e.sel; }));
    else console.info("[i18n] " + here + ": every " + code + " rule for this page matches.");
    return stale;
  }

  window.MH_I18N = {
    get lang() { return current(); },
    source: SOURCE,
    t: t,
    href: localizedHref,
    live: liveSet,
    apply: apply,
    set: set,
    register: register,
    mount: mount,
    check: check,
    page: page
  };

  // A dictionary that managed to load first left itself here.
  (window.MH_I18N_QUEUE || []).forEach(function (pair) { dicts[pair[0]] = pair[1] || {}; });
  window.MH_I18N_QUEUE = { push: function (pair) { register(pair[0], pair[1]); } };

  // The asked-for language, settled before anything paints: the URL, then the
  // visitor's remembered choice. Never the browser's own setting.
  want = param() || remembered() || SOURCE;

  function start() {
    apply();
    // If this page loads the shared menubar, the switch belongs in it: wait for
    // the bar rather than flashing a floating pill that then moves.
    if (host() || !document.querySelector('script[src*="menubar.js"]')) mount();
    // The menubar builds its links after us, so translate them when it says so.
    document.addEventListener("mh:menubar", function () { apply(); mount(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
