# Handoff: the website

Written 2026-09-24, at the end of a long session of website work, so another
session can pick it up. Read `AGENTS.md` first; this adds what the session
learned and what is left.

## Where things are

- The site is this repository, served by GitHub Pages from `main`
  (github.com/mreidhorrigan/bio → matthorrigan.com). A push to `main` deploys
  in a minute or two; `gh run list --limit 1` shows the build.
- Push only when M. says so, one batch at a time, and say what went live.
- The homepage is the isometric village (`index.html`, `engine.js`, the three
  `theme-*.js` skins, `content.js` for the houses). The 3D village is
  `slimeverse3d.html` + `slimeverse3d-page.js` on `verse3d.js`,
  `verse3d-scenes.js` and `engine-3d.js`. The glossary is `glossary.html` +
  `glossary-world.js` on `engine-side.js`; its words come from
  `brand/backstage/glossary-entries.md` through
  `brand/backstage/build-glossary-data.py` (which writes `glossary-data.js` and
  the lists in `glossary.html` between their markers).
- Rules for anything drawn in a world: `brand/backstage/world-style.md`. Page
  style: `brand/backstage/house-style.md`, tokens in `brand/brand.css`.
- Every world sound is a recipe in `sounds.js`; `sounds.test.mjs` guards it.
- French: `i18n-fr.js` holds every French word (`docs/i18n.md`). English is the
  source and is never rewritten.
- Accessibility: `docs/accessibility.md` (what was found, what was done, what
  is left).

## How M. wants the work done

- Instructions to the visitor are the slime's own first-person speech bubbles
  ("I can walk: the arrow keys, or WASD."), with the same words in a hidden
  element for a screen reader. No separate instruction panels.
- Space goes to the next stop in every world view: the next house in the iso
  and 3D villages (its page opens), the next word in the glossary picture. A
  focused button keeps Enter and Space. Tab moves between controls.
- The site must work opened from files (`file://`). Never blame `file://` or
  "no web origin" for a bug; find the code that fails and give it a fallback.
- Pages of this site open in the same tab; other sites in a new one.
- Use M.'s own sentences for anything about them; never leave `[YOU: …]`, TODO
  or TBD in a document; no eyebrow labels, badges, stat tiles or tinted cards.
- Don't read PNG screenshots into the conversation; check pictures by sampling
  pixels in a probe, or with the accessibility tree.
- Keep the CPU down: one headless browser at a time, at background priority,
  muted. No subagents unless M. asks.
- Hidden for now, restore only on M.'s word: the Criticism house and the Store
  kiosk (commented out in `content.js`), and the Autofac links (`menubar.js`,
  `content.js`, `i18n-fr.js`).

## Checking a change

All of these run at low priority; run them one at a time.

```
node --test *.test.mjs                              # sounds, the slime's tips, world maths, signal-tower wiring
node storage/selftest.js                            # the iso engine in every skin
node tools/probe-runner.mjs __keys-a11y.html ...    # probes, by name (brand/backstage/probes)
taskpolicy -b nice -n 15 python3 tools/i18n-check.py glossary.html   # the French, a page at a time
node tools/a11y-audit.mjs [page.html]               # what a keyboard and a screen reader meet
node tools/switch-sound.mjs [--file]                # real-input audio across the iso/3D switch
```

Probes by area: the keys and accessibility `__keys-a11y`; the homepage
`__tabs`, `__tips`, `__iso-sound`; the 3D village `__slimeverse3d`,
`__verse3d`, `__verse3d-keys`, `__card-away`, `__cave-exits`,
`__verse3d-cavewater`, `__verse3d-voices`, `__views-switch`; the glossary
`__glossary`, `__glossary-bar`, `__glossary-signs`, `__glossary-phone`,
`__glossary-small`, `__glossary-live`, `__glossary-keys`, `__glossary-fr*`.
A probe's line with NO, MISSING, EXCEPTION or FAIL fails it.

The probe runner, the audit and the switch-sound tool now close their Chrome
however they end. Still, after a run, `ps -Ao pid,ppid,etime,pcpu,command | grep -- --headless`
should show nothing: a stray headless Chrome once ran for 19 hours at 200% CPU.

Headless Chrome will not start audio without a real gesture, so a probe cannot
measure sound; the audit (real CDP key presses) and `switch-sound.mjs` can.

## What the last sessions did (2026-09-23 and 24)

In order, by commit:

- Same-tab pages; Research goes to Google Scholar; the Glossary on the ring; a
  Musebots page with the Vimeo demo; the 3D village unmirrored, at the iso pace.
- The gloomthmaxx neon glow softened in 3D; the iso sounds after switching from
  3D, even from files; one step sound in both views.
- The slime gives the instructions itself; "I can come nearer" works (+ and −).
- Cave light exits in both caves (click the daylight: the slime bounces out);
  glossary signs at both ends of both halves; cave water cheaper and wavier;
  "petit espace quelconque" archived (`brand/backstage/glossary-archive.md`);
  every sound in `sounds.js`; blooloo two steady notes, high then low; the
  shoggoths' clucks low again; a house's card closes when the slime walks away.
- Keyboard and screen-reader access across the site (see
  `docs/accessibility.md`): Space to the next stop; skip links and main
  landmarks; named canvases; modal cards; keyboard uploads in the teaching
  tools; build mode by keys (arrows move a tile, Enter builds, picks up, puts
  down or removes, Escape puts back); a Mute button in both villages that also
  silences the Musebots (one page-wide speaker gain, `installSpeaker` in
  `engine.js`); the faint grey darkened to `#6b6b6b`; focus rings that show.
- The glossary on phones: `viewport-fit=cover` with safe-area insets (the edge
  bars), the menubar as a card matching the word card (dark in the
  antiglossary).
- The glossary without its footer, its progress strip (archived in
  `brand/backstage/glossary-trail-archive.md`) or the outline round the
  picture; the slime's bubbles say what they did.

## To do: a repository of M.'s recent LLM chats

M. wants the site to hold a repository of their recent chats with language
models, as documentation to go with things such as job applications (showing
how they work with these tools). It needs serious design for safety before any
of it is built, and M. decides each of the questions below; nothing goes online
until they have.

What makes it hard:

- **Everything on this site is public and permanent.** GitHub Pages has no
  access control, a push is in the repository's history for good (removing a
  file later does not remove it from history or from caches and search
  indexes), and the repository itself is public. So the first decision is
  where the chats live: on the public site, behind real access control
  somewhere else, or published only as chosen excerpts.
- **What the chats contain.** Transcripts from working sessions hold things
  that must never be published: credentials, tokens and file paths; other
  people's names, emails and words (family members, colleagues, students,
  employers); students' data from the teaching tools (Canvas gradebooks,
  seating plans, rosters); job-search material (salaries, contacts, drafts);
  health or personal matters; and anything under an employer's or a
  publisher's confidentiality.
- **Consent.** People who appear in a chat have not agreed to be published;
  a chat that quotes an email or a message carries its author's words.
- **What an employer reads.** A chat shows mistakes, dead ends and retractions
  as well as good work; M. chooses what represents them, and says so on the
  page.

What a design would need, at least:

- An allowlist, not a blocklist: nothing is published unless M. picked it,
  chat by chat, after reading the redacted version.
- A redaction step that runs locally, before anything enters this repository:
  secrets and paths, emails and phone numbers, names other than M.'s (replaced
  by roles, as in "a family member"), student and applicant data; with a
  report of every change for M. to check.
- A staging place outside the site's repository (under `storage/`, which git
  ignores), so an unreviewed chat can never be pushed by accident; and a check
  in the build that refuses a chat with no review mark.
- A page design that reads as documentation (dates, the tool, what the task
  was, what came of it), in the house style, accessible like the rest of the
  site, with English and French for the page's own words (the chats stay in
  the language they were held in).
- A way to take one down quickly, knowing that history and caches keep it.

## Left, or offered and not yet asked for

- A pass with VoiceOver on a Mac and an iPhone; the checks so far read the
  accessibility tree, not a screen reader.
- Offered to M., not requested: the iso kiosks' chimes in 3D; the visitor's
  Musebots signal towers standing and playing in 3D; an opt-in model download
  for Clod Bathos on phones.
- Clod Bathos (its own repository,
  `~/Documents/GamesDevelopment/StateMachineDrivenLLMTemplate`): the fix that
  makes `tests/first-load.mjs` always close its Chrome is uncommitted there.
  Deploy that site with `python3 deploy_pages.py`.
- The Musebots picker lives in the sibling `web-musebots` repository;
  `signal-towers.js` here is generated and not edited.
- The CV is generated by the CV builder (`storage/DOSSIER_TOOLS`, not in git);
  its headings and reading order come from there.
- The Rock Walls page takes its window title from its Twine story name;
  renaming the story would lose visitors' saved games.
- From the June performance audit, still open: the per-tile ground blobs, the
  per-tile props and the ecology actors in the biome skins.
- `tools/console-sweep.py` (a headless console and 404 sweep of every page) was
  written on 2026-09-21 and never run to the end.
