# Codex repository guide

This is Matt Horrigan's static, GitHub Pages website. Its homepage is a Canvas 2D isometric world with optional ecology and a generated Musebots/Signal Towers audio bundle. Preserve appearance, navigation, accessibility, input, simulation, and musical behaviour.

- Migration plan: `storage/Codex Plan — WASM Migration of matthorrigan.com.md`
- Decisions and progress: `docs/architecture.md`, `docs/wasm-migration.md`, `docs/wasm-progress.md`
- Serve locally: `python3 -m http.server 8000`, then open `http://localhost:8000/`
- Build WASM: `./scripts/build-wasm.sh`
- Tests: `node --test *.test.mjs` and `cargo test --manifest-path rust/Cargo.toml`
- Benchmarks: open `/?perf=1`; use `window.MH_PERF.report()` in the console.

Do not edit `signal-towers.js` or files under `wasm/` as canonical source: they are generated. Signal Towers source is in the sibling `web-musebots` repository. Minimize JS/WASM crossings and prefer packed/reused buffers. Keep DOM, Canvas painting, input, and browser Web APIs in JavaScript unless measurements justify moving them.
