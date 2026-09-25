# Codex repository guide

This is M. Reid Horrigan's static, GitHub Pages website. Its homepage is a Canvas 2D isometric world with optional ecology and a generated Musebots/Signal Towers audio bundle. Preserve appearance, navigation, accessibility, input, simulation, and musical behaviour.

- World art (iso village, sidescroller, 3D): `brand/backstage/world-style.md`.
  Read it before adding anything drawn in a world: outlines, inks, sizes,
  the iso-to-3D mapping. Page style is `brand/backstage/house-style.md`.
- Sounds: every sound in the worlds is a recipe in `sounds.js`, played by name
  from `engine.js` and `verse3d.js`; change sounds only there, and run
  `node --test sounds.test.mjs`.
- Starting a new session: `docs/handoff.md` (where things are, how M. wants the
  work done, how to check a change, what is left).
- Accessibility: `docs/accessibility.md` (what a keyboard and a screen reader
  meet, and the rules the pages keep). Audit with `node tools/a11y-audit.mjs`;
  `brand/backstage/probes/__keys-a11y.html` guards the keys (Space: the next stop).
- English/French: `docs/i18n.md`. English is the source language and is never
  rewritten; `i18n-fr.js` holds every French word. Check with
  `python3 tools/i18n-check.py`.
- Migration plan: `storage/Codex Plan — WASM Migration of matthorrigan.com.md`
- Decisions and progress: `docs/architecture.md`, `docs/wasm-migration.md`, `docs/wasm-progress.md`
- Serve locally: `python3 -m http.server 8000`, then open `http://localhost:8000/`
- Build WASM: `./scripts/build-wasm.sh`
- Tests: `node --test *.test.mjs` and `cargo test --manifest-path rust/Cargo.toml`
- Benchmarks: open `/?perf=1`; use `window.MH_PERF.report()` in the console.

Do not edit `signal-towers.js` or files under `wasm/` as canonical source: they are generated. Signal Towers source is in the sibling `web-musebots` repository. Minimize JS/WASM crossings and prefer packed/reused buffers. Keep DOM, Canvas painting, input, and browser Web APIs in JavaScript unless measurements justify moving them.
