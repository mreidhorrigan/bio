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
    title: "M. Reid Horrigan",
    // The home kiosk. The engine sends the slime here on Space / Enter.
    home: 0,
    kiosks: [
      {
        title: "About",
        page: { url: `${B}about.html` },                       // the About page (menubar and all). NOT index.html: index IS this world (would recurse).
        satellites: [   // the CV is a house on the About road: it is about me, not a place of its own
          { title: "CV", url: `${B}Horrigan_CV.html` },
        ],
        html: `
          <p><span class="mh-big">How do you work?</span></p>
          <p>Hi. I'm M. Reid Horrigan, researcher of media production cultures.</p>
          <p>I teach critical writing and theory along with communication skills in media
          that include podcasting, games, video, and music. Working with more than two
          thousand postsecondary students since 2016, I've developed new methods to
          promote academic integrity, effective and accountable use of artificial
          intelligence, and creative ideation.</p>
          <p>In addition to teaching, I'm currently working on three major research
          projects: a monograph on <em>Voiceshifting</em>, the technical and aesthetic
          process of changing voices electronically to communicate characters and
          personae; a monograph adapting my ethnographic dissertation on Vancouver's
          motion picture production cultures; and the Musebots, a multi-agent music
          generation system whose origins predate the GPT revolution.</p>
          <p>The full record, with degrees, publications, talks, and teaching, is in
          the <a href="${B}Horrigan_CV.html"${ext}>CV</a>, which also stands as a house
          along this road. There is a <a href="${B}Horrigan_CV.pdf"${ext}>PDF</a>.</p>`,
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
        title: "Research",
        page: { url: `${B}research.html` },                    // summaries of the publications
        html: `
          <p>Short summaries of what I have published and what I am writing, in
          plain terms.</p>
          <p>Read the <a href="${B}research.html"${ext}>summaries</a>, or the full
          record in the <a href="${B}Horrigan_CV.html"${ext}>CV</a>.</p>`,
      },
      {
        title: "Public Writing",
        satellites: [   // the two kinds, each its own house along the road
          // { title: "Criticism", url: `${B}criticism.html` },   // its house is off the village for now (2026-09-22); the page and its links stay
          // not a dwelling: the glossary is underground, so its house is the
          // shaft you go down. engine.js draws it with drawWellhead().
          { title: "Glossary", url: `${B}glossary.html`, structure: "wellhead" },
        ],
        html: `
          <p>Writing for readers outside the academy:</p>
          <ul>
            <li><a href="${B}criticism.html"${ext}>Criticism</a>: reviews of art, performance, games, and sound.</li>
            <li><a href="${B}glossary.html"${ext}>Glossary</a>: the terms I keep using, defined, with an antiglossary of everything they leave out.</li>
          </ul>`,
      },
      /* The Store is off the village for now (2026-09-22), until there are things
         to sell: the user will say when it goes back. Uncomment to restore.
      {
        title: "Store",
        underConstruction: true,     // the engine bands the kiosk and says so on the sign
        html: `
          <p><strong>Under construction.</strong> There is no store yet.</p>
          <p>When there is one, it will sell the things this site already gives away:
          the tools, the games, and the music. Until then, everything is free where
          it stands.</p>`,
      },
      */
      {
        title: "Music",
        page: { url: `${B}about.html?menu=Music` },            // open the About page with the Music dropdown deployed (new tab)
        satellites: [   // slimeverse: each specific-project house opens that project's OWN page/splash (the "Music" gateway opens the menu)
          { title: "SoundCloud", url: "https://soundcloud.com/matt_horrigan" },
          { title: "No Phenomenon", url: "https://nophenomenon.bandcamp.com/" },   // the road's end: the Musebots house meets it
        ],
        html: `
          <p>In an earlier artistic career I was a sound designer and programmer, writing
          code for art installations and musical performances.</p>
          <p>Hear it: <a href="https://nophenomenon.bandcamp.com/"${ext}>No Phenomenon</a>
          on Bandcamp, and more on
          <a href="https://soundcloud.com/matt_horrigan"${ext}>SoundCloud</a>.</p>`,
      },
      {
        title: "Games",
        page: { url: `${B}about.html?menu=Games` },            // open the About page with the Games dropdown deployed (new tab)
        satellites: [   // slimeverse: each specific-project house opens that project's OWN page/splash (the "Games" gateway opens the menu)
          { title: "Rock Walls & Damp", url: `${B}Rock_Walls_and_Damp.html` },
          // { title: "Autofac", url: `${B}autofac.html` },   // off the site for now: still an experiment (2026-09-22)
          { title: "Clod Bathos", url: "https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/" },
          { title: "Audiogames (CGSA)", url: "https://cgsa2026-audio-presentation.onrender.com" },
          { title: "Slimeverse 3D", url: `${B}slimeverse3d.html` },   // this village, walkable in three dimensions: the house leads into it
        ],

        html: `
          <p>Games and interactive pieces:</p>
          <ul>
            <li><a href="${B}Rock_Walls_and_Damp.html"${ext}>Rock Walls and Damp</a>:a hypertext piece.</li>
            <!-- Autofac: Rad Shipping (autofac.html) is off the site for now: still an experiment -->
            <li><a href="https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/"${ext}>Clod Bathos, Superior Machine</a>.</li>
            <li><a href="https://cgsa2026-audio-presentation.onrender.com"${ext}>Appraising the Pedagogical Value of Audiogames</a> (CGSA 2026).</li>
            <li><a href="${B}slimeverse3d.html"${ext}>Slimeverse 3D</a>: this village, walkable in three dimensions.</li>
          </ul>`,
      },
    ],

    // Where two paths MEET. A junction grows a house on the bisector between two
    // gateway kiosks, with a short paved link from the end of each of their roads,
    // so the walk out along either one arrives at the same door. `between` names
    // the gateways by their English titles.
    junctions: [
      {
        title: "Musebots",
        between: ["Music", "Games"],
        url: "https://vimeo.com/1228633944",   // Musebots Connectivity Demo: LAN, WAN, browser, DAW
      },
    ],
  };
})();
