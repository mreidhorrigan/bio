/* menubar.js — the ONE site-wide menubar for matthorrigan.com.
 *
 * Include on any page with:   <script src="menubar.js" defer></script>
 *
 * Two modes:
 *  - Standalone pages (index.html, …): injects a fixed top bar.
 *  - The CV page (which already has #cv-menubar from the CV builder): splices
 *    the site nav into that bar's left slot (replacing the document title) and
 *    keeps its Web / Print-PDF / Download controls on the right.
 *
 * Design: derived from the CV builder's menubar (fixed white bar, soft drop
 * shadow — no bottom border, small bold sans, pill-ish items) with the site's
 * blue soft-edged highlight (cyan + glow, asymmetric corners) for hover/current.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * EDIT THE LINKS HERE ↓ (new games go in GAMES, new tools in TOOLS —
 * the dropdowns grow themselves)
 * ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var GAMES = [
    ["Rock walls and damp—these match our dream; but, Rector, the cold is new.",
     "Rock_Walls_and_Damp.html"],
    ["Autofac: Rad Shipping", "autofac.html"],
    ["Clod Bathos, Superior Machine",
     "https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/"],
    ["Appraising the Pedagogical Value of Audiogames (CGSA 2026)",
     "https://cgsa2026-audio-presentation.onrender.com"]
    // next: ["<itch.io game>", "https://…itch.io/…"],
  ];

  var TOOLS = [
    ["Produce exam versions.", "MCQer.html"],
    ["Make a seating plan from a Canvas gradebook.", "SeatPlanner.html"],
    ["Run a fullscreen exam timer.", "ExamTimer.html"],
    ["Print nameplates from a Canvas gradebook.", "Nameplates.html"]
    // next: ["<tool name>", "<Tool>.html"],
  ];

  var LINKS_BEFORE_DROPDOWNS = [
    ["Home", "index.html"],          // the walkable slimeverse homepage
    ["About", "classic.html"],       // the bio page (reachable directly now that Home lands in the world)
    ["CV", "Horrigan_CV.html"]
  ];
  var MUSIC = [
    ["No Phenomenon", "https://nophenomenon.bandcamp.com/"],
    ["SoundCloud", "https://soundcloud.com/matt_horrigan"]
  ];
  var LINKS_AFTER_DROPDOWNS = [
    ["Research", "https://scholar.google.ca/citations?user=g8USNu8AAAAJ&hl=en"]
  ];

  /* All menubar metrics are pinned in px ON PURPOSE: pages set different root font
   * sizes (CV: html{font-size:14px}; index/MCQer: 16px default) and different
   * --sans-font stacks, so rem/var-based sizing rendered a different bar on every
   * page. px + a fixed family = pixel-identical menubar site-wide.
   * (13px / 5.5px 13px ≈ the old .82rem / .34rem .8rem at a 16px root.) */
  var CSS = [
    /* Brand corner — the asymmetric 'leaf': a gentle sweep at the top-left and
       bottom-right, near-square at the other two. FIXED elliptical radii (not %)
       so the corner arc is identical on every box, wide or narrow. With % the
       sweep flattened as items got wider, so a wide dropdown pill read flatter
       than a narrow nav pill; fixed radii make them match exactly. ~16x7 at the
       leaf corners echoes the original nav-pill look. See brand/house-style.md. */
    ":root{ --mh-blue:#c3f0ff;",
    "  --mh-leaf:16px 4px 16px 4px / 7px 2px 7px 2px;",        /* item-size: hovers/pills */
    "  --mh-leaf-box:22px 6px 22px 6px / 10px 3px 10px 3px;",  /* the dropdown panel (same angle) */
    "  --mh-leaf-bar:34px 16px;", /* the bar's bottom-right sweep (h v) */
    "}",
    /* The bar owns its box model and base look so a host page's resets can't
       reshape it: index.html has no box-sizing (content-box) while the CV/tools
       set border-box, which is exactly what made the index bar render taller. */
    "#mh-menubar, .mh-nav, .mh-nav *{ box-sizing:border-box; }",
    /* When items wrap to multiple rows on narrow/phone widths, pack the rows
       tightly and EVENLY: align-content:center keeps only the row-gap between
       rows (no leftover vertical space distributed between them, which is what
       made the wrapped row spacing look random against the bar's min-height).
       gap is row-gap col-gap = a uniform 6px between every wrapped row. */
    ".mh-nav{ display:flex; align-items:center; align-content:center; flex-wrap:wrap; gap:6px; min-width:0;",
    "}",
    ".mh-nav a, .mh-nav summary{",
    "  font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Helvetica, Arial, sans-serif;",
    "  font-size:13px; font-weight:600; line-height:1.1;",
    "  color:#595959; text-decoration:none; cursor:pointer; white-space:nowrap;",
    "  padding:5.5px 13px; border-radius:var(--mh-leaf);",
    /* reset border/margin/background so a host's global a{} can't bleed in
       (e.g. the CV's a{border-bottom:1px} was drawing a stray underline here) */
    "  position:relative; border:0; margin:0; background:none;",
    /* ── emboss/deboss experiment (menubar) ─────────────────────────────────
       Available items read as gently EMBOSSED (raised, inviting a press): a
       light highlight on the top-left rim, a soft shadow at the bottom-right,
       so the bevel agrees with the brand's top-left light source. Alphas are
       deliberately tiny on the white bar. To dial intensity, change the two
       alphas below (.7 highlight / .10 shadow); to tilt the bevel, change the
       1px offsets. Set both to 'none' to revert this line only. */
    "  box-shadow: var(--emboss-raised, -1px -1px 0 rgba(255,255,255,.7), 1px 1px 2px rgba(0,0,0,.10));",
    /* a soft transition so the press (deboss) feels physical, not abrupt */
    "  transition: box-shadow .15s ease, background-color .15s ease;",
    "}",
    ".mh-nav a:hover, .mh-nav summary:hover, .mh-nav a[aria-current='page'], .mh-nav summary[aria-current='page'], .mh-dd[open] summary{",
    "  color:#000; background:var(--mh-blue); text-decoration:none;",
    "  filter:drop-shadow(0 0 5px var(--mh-blue));",
    /* ── emboss/deboss experiment (menubar, pressed state) ──────────────────
       The current/hover item flips to DEBOSSED (pressed in): inset shadows
       reverse the bevel — a soft dark inset at the top-left, a light inset at
       the bottom-right — so a hovered/selected item looks pushed below the
       surface while still carrying the cyan fill + glow above. The cyan glow
       lives in `filter` (untouched); these inset shadows layer alongside it.
       To soften the press, lower the .16 / .55 alphas; revert by removing this
       box-shadow line. */
    "  box-shadow: var(--emboss-pressed, inset 1px 1px 2px rgba(0,0,0,.16), inset -1px -1px 1px rgba(255,255,255,.55));",
    "}",
    /* Dropdowns (a <details>, so they work keyboard + touch, no framework) */
    ".mh-dd{ position:relative; }",
    ".mh-dd summary{ list-style:none; display:inline-block; }",
    ".mh-dd summary::-webkit-details-marker{ display:none; }",
    ".mh-dd summary::after{ content:' \\25BE'; font-size:.75em; }",
    ".mh-dd-menu{",
    "  position:absolute; left:0; top:calc(100% + 8px); min-width:min(260px,calc(100vw - 16px)); max-width:min(340px,calc(100vw - 16px));",
    "  display:flex; flex-direction:column; gap:2px; padding:6px; z-index:1001;",
    "  background:#fff; border:1px solid #d9d9d9; border-radius:var(--mh-leaf-box);",
    "  box-shadow:0 6px 18px rgba(0,0,0,.12);",
    "}",
    ".mh-dd-menu a{ white-space:normal; border-radius:var(--mh-leaf); font-weight:500; line-height:1.3; }",
    /* standalone bar (pages without the CV builder's #cv-menubar) */
    "#mh-menubar{",
    "  position:fixed; inset:0 0 auto 0; min-height:46px;",
    "  display:flex; align-items:center; gap:16px; padding:4px clamp(12px,4vw,28px);",
    "  background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.05);",
    "  z-index:1000; border-bottom-right-radius:var(--mh-leaf-bar);",
    "}",
    /* when spliced into the CV bar: let it wrap instead of clipping; pin the same gap */
    "#cv-menubar{ height:auto !important; min-height:46px; flex-wrap:wrap; padding-top:4px; padding-bottom:4px; gap:16px;",
    "  border-bottom-right-radius:var(--mh-leaf-bar); }",
    "#cv-menubar .mh-nav{ flex:1 1 auto; }"
  ].join("\n");

  function link(label, href) {
    var a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    var here = location.pathname.split("/").pop() || "index.html";
    if (href === here) a.setAttribute("aria-current", "page");
    return a;
  }

  function dropdown(label, items) {
    var dd = document.createElement("details");
    dd.className = "mh-dd";
    var sum = document.createElement("summary");
    sum.textContent = label;
    dd.appendChild(sum);
    var menu = document.createElement("div");
    menu.className = "mh-dd-menu";
    items.forEach(function (l) { menu.appendChild(link(l[0], l[1])); });
    dd.appendChild(menu);
    // highlight the closed dropdown when one of its pages is the current page
    if (menu.querySelector("a[aria-current='page']")) sum.setAttribute("aria-current", "page");
    return dd;
  }

  function buildNav() {
    var nav = document.createElement("nav");
    nav.className = "mh-nav";
    nav.setAttribute("aria-label", "Site");
    LINKS_BEFORE_DROPDOWNS.forEach(function (l) { nav.appendChild(link(l[0], l[1])); });
    nav.appendChild(dropdown("Games", GAMES));
    nav.appendChild(dropdown("Tools", TOOLS));
    nav.appendChild(dropdown("Music", MUSIC));
    LINKS_AFTER_DROPDOWNS.forEach(function (l) { nav.appendChild(link(l[0], l[1])); });
    return nav;
  }

  function mount() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = buildNav(), bar, standalone;
    var cvBar = document.getElementById("cv-menubar");
    if (cvBar) {                                  // CV page: splice into its bar
      var title = cvBar.querySelector(".cv-mb-title");
      if (title) title.replaceWith(nav);
      else cvBar.insertBefore(nav, cvBar.firstChild);
      bar = cvBar; standalone = false;
    } else {                                      // any other page: own fixed bar
      bar = document.createElement("header");
      bar.id = "mh-menubar";
      bar.appendChild(nav);
      document.body.insertBefore(bar, document.body.firstChild);
      standalone = true;
    }

    // keep content clear of the (possibly wrapped) bar, on load and on resize
    function syncPad() {
      var h = bar.offsetHeight;
      if (standalone) document.body.style.paddingTop = (h + 10) + "px";
      else document.documentElement.style.setProperty("--cv-mb-h", h + "px");
    }
    syncPad();
    var padPend = false;
    window.addEventListener("resize", function () {           // coalesce resize → one sync per frame (no layout thrash)
      if (padPend) return; padPend = true;
      requestAnimationFrame(function () { padPend = false; syncPad(); });
    });

    // keep an opened dropdown inside the viewport: if its panel would spill past the right
    // edge (narrow phones), flip it to right-anchored so it can never force a sideways scroll.
    function fitMenu(dd) {
      var menu = dd.querySelector(".mh-dd-menu"); if (!menu || !menu.getBoundingClientRect) return;
      menu.style.left = ""; menu.style.right = "";
      if (dd.open && menu.getBoundingClientRect().right > window.innerWidth - 8) { menu.style.left = "auto"; menu.style.right = "0"; }
    }
    Array.prototype.forEach.call(bar.querySelectorAll(".mh-dd"), function (dd) {
      dd.addEventListener("toggle", function () { fitMenu(dd); });
    });

    // a page can request a dropdown be open on load, e.g. classic.html?menu=Music — the walkable
    // site's Music/Games houses link here so About opens with that category's dropdown deployed.
    try {
      var wantMenu = new URLSearchParams(location.search).get("menu");
      if (wantMenu) Array.prototype.forEach.call(bar.querySelectorAll(".mh-dd"), function (dd) {
        var s = dd.querySelector("summary");
        if (s && s.textContent.trim().toLowerCase() === wantMenu.trim().toLowerCase()) { dd.setAttribute("open", ""); fitMenu(dd); }
      });
    } catch (e) { /* no URLSearchParams / blocked: fine */ }

    // dropdown closes on outside click / Escape
    document.addEventListener("click", function (e) {
      Array.prototype.forEach.call(document.querySelectorAll(".mh-dd[open]"), function (d) {
        if (!d.contains(e.target)) d.removeAttribute("open");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape")
        Array.prototype.forEach.call(document.querySelectorAll(".mh-dd[open]"), function (d) {
          d.removeAttribute("open");
        });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
