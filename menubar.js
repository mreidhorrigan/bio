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
 * Design: derived from the CV builder's menubar (fixed white bar, hairline
 * bottom border, soft shadow, small bold sans, pill-ish items) with the site's
 * blue soft-edged highlight (cyan + glow, asymmetric corners) for hover/current.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * EDIT THE LINKS HERE ↓ (new games go in GAMES, new tools in TOOLS —
 * the dropdowns grow themselves)
 * ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var GAMES = [
    ["Autofac: Rad Shipping", "autofac.html"],
    ["Rock walls and damp—these match our dream; but, Rector, the cold is new.",
     "Rock_Walls_and_Damp.html"],
    ["Clod Bathos, Superior Machine",
     "https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/"],
    ["Appraising the Pedagogical Value of Audiogames (CGSA 2026)",
     "https://cgsa2026-audio-presentation.onrender.com"]
    // next: ["<itch.io game>", "https://…itch.io/…"],
  ];

  var TOOLS = [
    ["MCQer — exam version production", "MCQer.html"],
    ["Seat Planner — classroom seating charts", "SeatPlanner.html"],
    ["Exam Timer — invigilation countdown", "ExamTimer.html"]
    // next: ["<tool name>", "<Tool>.html"],
  ];

  var LINKS_BEFORE_DROPDOWNS = [
    ["Home", "index.html"],
    ["CV", "Horrigan_CV.html"]
  ];
  var LINKS_AFTER_DROPDOWNS = [
    ["Music", "https://soundcloud.com/matt_horrigan"],
    ["Research", "https://scholar.google.ca/citations?user=g8USNu8AAAAJ&hl=en"]
  ];

  /* All menubar metrics are pinned in px ON PURPOSE: pages set different root font
   * sizes (CV: html{font-size:14px}; index/MCQer: 16px default) and different
   * --sans-font stacks, so rem/var-based sizing rendered a different bar on every
   * page. px + a fixed family = pixel-identical menubar site-wide.
   * (13px / 5.5px 13px ≈ the old .82rem / .34rem .8rem at a 16px root.) */
  var CSS = [
    ":root{ --mh-blue:#c3f0ff; }",
    ".mh-nav{ display:flex; align-items:center; flex-wrap:wrap; gap:2px 4px; min-width:0; }",
    ".mh-nav a, .mh-nav summary{",
    "  font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Helvetica, Arial, sans-serif;",
    "  font-size:13px; font-weight:600; line-height:1.1;",
    "  color:#595959; text-decoration:none; cursor:pointer; white-space:nowrap;",
    "  padding:5.5px 13px; border-radius:25% 5% 25% 5%;",
    "}",
    ".mh-nav a:hover, .mh-nav summary:hover, .mh-nav a[aria-current='page'], .mh-nav summary[aria-current='page'], .mh-dd[open] summary{",
    "  color:#000; background:var(--mh-blue);",
    "  filter:drop-shadow(0 0 5px var(--mh-blue));",
    "}",
    /* Dropdowns (a <details>, so they work keyboard + touch, no framework) */
    ".mh-dd{ position:relative; }",
    ".mh-dd summary{ list-style:none; display:inline-block; }",
    ".mh-dd summary::-webkit-details-marker{ display:none; }",
    ".mh-dd summary::after{ content:' \\25BE'; font-size:.75em; }",
    ".mh-dd-menu{",
    "  position:absolute; left:0; top:calc(100% + 8px); min-width:260px; max-width:min(340px,86vw);",
    "  display:flex; flex-direction:column; gap:2px; padding:6px; z-index:1001;",
    "  background:#fff; border:1px solid #d9d9d9; border-radius:12px;",
    "  box-shadow:0 6px 18px rgba(0,0,0,.12);",
    "}",
    ".mh-dd-menu a{ white-space:normal; border-radius:10px; font-weight:500; line-height:1.3; }",
    /* standalone bar (pages without the CV builder's #cv-menubar) */
    "#mh-menubar{",
    "  position:fixed; inset:0 0 auto 0; min-height:46px;",
    "  display:flex; align-items:center; gap:16px; padding:4px clamp(12px,4vw,28px);",
    "  background:#fff; border-bottom:1px solid #d9d9d9; box-shadow:0 1px 4px rgba(0,0,0,.05);",
    "  z-index:1000;",
    "}",
    /* when spliced into the CV bar: let it wrap instead of clipping; pin the same gap */
    "#cv-menubar{ height:auto !important; min-height:46px; flex-wrap:wrap; padding-top:4px; padding-bottom:4px; gap:16px; }",
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
    window.addEventListener("resize", syncPad);

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
