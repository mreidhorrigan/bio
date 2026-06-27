// @ts-check
"use strict";
/* ============================================================================
   content.js: the WORDS of the walkable site, as a set of kiosks.
   ----------------------------------------------------------------------------
   Presentation-agnostic: the same content drives all skins. The engine lays the
   kiosks out on a ring and opens each in a themed card. A kiosk's `page` says how:
     • { url }  → a large sub-window showing the real original-site page (iframe).
     • { toc }  → a small table-of-contents menu (styled like the original site).
   `html` is the plain-prose fallback (used if `page` is dropped), styled by .mh-prose.

   PATHS ARE BASE-AWARE. Set window.MH_SITE = { base: "..." } BEFORE this script
   to point the CV / tool links at the site root from wherever the page lives:
     • dev (storage/alternates/…)  → base defaults to "../../"  (reaches site root)
     • promoted to the site root   → set base to ""             (CV is right here)

   House style: plain, active, concrete. No spaced em dashes. (brand/house-style.md)
   ========================================================================== */

(function () {
  const B = (window.MH_SITE && window.MH_SITE.base != null) ? window.MH_SITE.base : "../../";
  const ext = ` target="_blank" rel="noopener"`;

  window.MH_CONTENT = {
    title: "Matt Horrigan",
    // The home kiosk. The engine sends the slime here on Space / Enter.
    home: 0,
    kiosks: [
      {
        title: "About",
        page: { url: `${B}classic.html` },                     // the archived classic homepage (menubar and all). NOT index.html: once promoted, index IS this world (would recurse).
        html: `
          <p><span class="mh-big">How do you work? Can I see?</span></p>
          <p>Hi. I'm Matthew Horrigan, a communication scholar. I research media
          production cultures: how the work of making the images and sounds that
          fill public life gets organised, managed, and felt by the people who do it.</p>
          <p>I teach writing, podcasting, and video alongside theories of labour and
          management, and I came to it from an earlier career in sound design and code.</p>`,
      },
      {
        title: "Toolbox",
        page: { url: `${B}toolbox.html` },                     // a tool-themed splash (flatverse: efficiency and utility)
        html: `
          <p>Small, free tools I built for teaching:</p>
          <ul>
            <li><a href="${B}MCQer.html"${ext}>MCQer</a>:write and mark multiple-choice questions.</li>
            <li><a href="${B}SeatPlanner.html"${ext}>SeatPlanner</a>: seating plans for a class.</li>
            <li><a href="${B}ExamTimer.html"${ext}>ExamTimer</a>:a clear, calm clock for exams.</li>
            <li><a href="${B}Nameplates.html"${ext}>Nameplates</a>:printable desk name cards.</li>
          </ul>`,
      },
      {
        title: "CV",
        page: { url: `${B}Horrigan_CV.html` },                 // the real CV page
        html: `
          <p>The full record: degrees, publications, talks, and teaching.</p>
          <p>Read the <a href="${B}Horrigan_CV.html"${ext}>CV in your browser</a>, or
          download the <a href="${B}Horrigan_CV.pdf"${ext}>PDF</a>.</p>`,
      },
      {
        title: "Music",
        page: {
          title: "Music",
          toc: [   // labels match the site menubar's "Music" dropdown verbatim
            { label: "No Phenomenon", url: "https://nophenomenon.bandcamp.com/" },
            { label: "SoundCloud", url: "https://soundcloud.com/matt_horrigan" },
          ],
        },
        html: `
          <p>In an earlier artistic career I was a sound designer and programmer, writing
          code for art installations and musical performances.</p>
          <p>Hear it: <a href="https://nophenomenon.bandcamp.com/"${ext}>No Phenomenon</a>
          on Bandcamp, and more on
          <a href="https://soundcloud.com/matt_horrigan"${ext}>SoundCloud</a>.</p>`,
      },
      {
        title: "Games",
        page: {
          title: "Games",
          toc: [   // labels match the site menubar's "Games" dropdown verbatim
            { label: "Rock walls and damp—these match our dream; but, Rector, the cold is new.", url: `${B}Rock_Walls_and_Damp.html` },
            { label: "Autofac: Rad Shipping", url: `${B}autofac.html` },
            { label: "Clod Bathos, Superior Machine", url: "https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/" },
            { label: "Appraising the Pedagogical Value of Audiogames (CGSA 2026)", url: "https://cgsa2026-audio-presentation.onrender.com" },
          ],
        },
        html: `
          <p>Games and interactive pieces:</p>
          <ul>
            <li><a href="${B}Rock_Walls_and_Damp.html"${ext}>Rock Walls and Damp</a>:a hypertext piece.</li>
            <li><a href="${B}autofac.html"${ext}>Autofac: Rad Shipping</a>.</li>
            <li><a href="https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/"${ext}>Clod Bathos, Superior Machine</a>.</li>
            <li><a href="https://cgsa2026-audio-presentation.onrender.com"${ext}>Appraising the Pedagogical Value of Audiogames</a> (CGSA 2026).</li>
          </ul>`,
      },
    ],
  };
})();
