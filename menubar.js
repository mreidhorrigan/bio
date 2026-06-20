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
    ["Produce exam versions.", "MCQer.html"],
    ["Make a seating plan from a Canvas gradebook.", "SeatPlanner.html"],
    ["Run a fullscreen exam timer.", "ExamTimer.html"]
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
    /* The bar owns its box model and base look so a host page's resets can't
       reshape it: index.html has no box-sizing (content-box) while the CV/tools
       set border-box, which is exactly what made the index bar render taller. */
    "#mh-menubar, .mh-nav, .mh-nav *{ box-sizing:border-box; }",
    /* the 'opens another website' underline (used via mask): a mostly-flat line
       that sweeps up at the bottom-right, echoing the leaf highlight's bottom
       edge (border-radius:25% 5% 25% 5% -> big curve only at the bottom-right).
       preserveAspectRatio='none' lets the flat run stretch to the label width
       while the sweep keeps its place at the right, like the highlight's corner. */
    ".mh-nav{ display:flex; align-items:center; flex-wrap:wrap; gap:2px 4px; min-width:0;",
    "  --mh-arc:url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%2010'%20preserveAspectRatio='none'%3E%3Cpath%20d='M2,8L70,8Q89,8,98,3.2'%20fill='none'%20stroke='%23000'%20stroke-width='2'%20stroke-linecap='round'/%3E%3C/svg%3E\"); }",
    ".mh-nav a, .mh-nav summary{",
    "  font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Helvetica, Arial, sans-serif;",
    "  font-size:13px; font-weight:600; line-height:1.1;",
    "  color:#595959; text-decoration:none; cursor:pointer; white-space:nowrap;",
    "  padding:5.5px 13px; border-radius:25% 5% 25% 5%;",
    /* reset border/margin/background so a host's global a{} can't bleed in
       (e.g. the CV's a{border-bottom:1px} was drawing a stray underline here) */
    "  position:relative; border:0; margin:0; background:none;",
    "}",
    ".mh-nav a:hover, .mh-nav summary:hover, .mh-nav a[aria-current='page'], .mh-nav summary[aria-current='page'], .mh-dd[open] summary{",
    "  color:#000; background:var(--mh-blue); text-decoration:none;",
    "  filter:drop-shadow(0 0 5px var(--mh-blue));",
    "}",
    /* external-link cue: a faint curved underline on items that open another
       website; it brightens to cyan on hover and never shows on internal pages */
    ".mh-nav a.mh-ext::after{",
    "  content:''; position:absolute; left:13px; right:13px; bottom:2px; height:7px;",
    "  background-color:#9aa0a6; pointer-events:none; transition:background-color .15s ease;",
    "  -webkit-mask:var(--mh-arc) center/100% 100% no-repeat;",
    "          mask:var(--mh-arc) center/100% 100% no-repeat;",
    "}",
    ".mh-nav a.mh-ext:hover::after{ background-color:#17a3d6; }",
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

  // off-site if it resolves to a different origin (works on the live domain and
  // in a local file:// preview, where same-site relative links share the origin)
  function isExternal(href) {
    try {
      var u = new URL(href, location.href);
      return /^https?:$/.test(u.protocol) && u.origin !== location.origin;
    } catch (e) { return false; }
  }

  function link(label, href) {
    var a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    var here = location.pathname.split("/").pop() || "index.html";
    if (href === here) a.setAttribute("aria-current", "page");
    if (isExternal(href)) a.className = "mh-ext";
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
