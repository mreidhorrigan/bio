# WASM migration ledger

## Phase 0 — audit and baseline instrumentation (complete)

- Confirmed `signal-towers.js` is generated from the Git-tracked `web-musebots` source repository.
- Mapped the animation/update/render loop, toroidal world math, ecology scheduling/storage/spatial hash, player collision, procedural generation, and Signal Towers audio ownership.
- Added architecture, migration, performance-baseline, and repository guidance documents.
- Added development-only frame/update/ecology/render-preparation/Canvas/actor/long-task/heap instrumentation behind `?perf=1`.
- Existing unrelated worktree changes were identified and left untouched.

Scaling measurements remain a required gate before removing any fallback and will be recorded alongside each migrated subsystem.

## Phase 1 — toolchain (complete)

- Added separate `world-core` and `dsp-core` Rust crates and browser artifact directories.
- Added a single build command and optional browser smoke loader with legacy-safe failure handling.

- Installed Rust 1.98.0, `wasm32-unknown-unknown`, and `wasm-bindgen-cli` 0.2.127.
- `cargo test`, Clippy with warnings denied, formatting checks, and the static build pass.
- Chrome loaded the homepage through HTTP with Canvas and `world-core` ready; ABI/addition calls passed and an intentionally missing module was caught.
- Initial release artifacts: world WASM about 18 KiB, DSP WASM about 18 KiB (uncompressed).

## Phase 2 — pure world primitives (complete)

- Added matching JS/Rust wrapping, wrapped delta/distance, toroidal circle overlap, and seeded xorshift fixtures.
- Production nondeterminism remains unchanged.
- Rust and Node fixture tests pass. The runtime exposes the loaded module only after its ABI smoke check succeeds.

## Phases 3–7 — ecology, render preparation, and Worker (complete for local review)

- Added authoritative Rust ecology state, deterministic seeded initialization, contiguous entity storage, movement/steering, grazing/flora, predator/prey interaction, mortality/reproduction, population caps, dormant predators, and reusable scratch buffers.
- Added a ten-float packed render contract and low-rate flora snapshots. The Worker copies directly from linear memory into recycled transferable buffers; no per-entity messages or JSON state cross the boundary.
- Retained `ecology.js` as fallback. The Worker defaults on and `?wasmWorld=0` enables legacy comparison; Worker failure disables itself and records a diagnostic without blanking the site.
- Added Chrome and Firefox Worker smoke automation. Both load the real homepage and verify Canvas, WASM, Worker, entity/flora snapshots, and no recorded errors.
- Benchmarked default/2×/5×/10×. At 10×, legacy main-thread ecology p99 was 1.6 ms versus about 0.1 ms of main-thread Worker orchestration. Worker compute p99 was 1.3 ms in the later parity run.
- Evaluated player collision, procedural tile/biome generation, and remaining render sorting. They stay in JS: player work is tiny and latency-sensitive; generation/painting is browser-facing and per-tile WASM calls would be too fine-grained; Canvas is now the dominant measured cost. This is the plan's evidence-based stop condition.

## Audio A1–A5 — persistent Rust DSP (complete for local review)

- Added one persistent multi-output AudioWorklet per shared `AudioContext`, with independent buses preserving tower spatialization.
- Added fixed 128-voice pools, 512-event queues, oldest-voice stealing, arbitrary render-quantum handling, procedural filtered white/pink/brown noise, exact fixed-capacity additive spectra (100 partials), and genuine sample-rate FM/PM.
- Fixed two validation-discovered defects: zero-attack samples incorrectly killed new voices, and voice stealing selected the newest voice.
- Kept ordinary expressive oscillators, samples, master/limiter/analyser, and spatial Web Audio nodes native. High-cost noise/resynthesis/FM paths use WASM; `?wasmAudio=0` forces legacy behavior.
- The canonical `web-musebots` repository was verified Git-tracked before edits. Its dependency-injected audio seam, bundle build, diagnostics, and browser test scripts were updated; `signal-towers.js` was regenerated rather than hand-edited.
- Full Musebots suite passes: 259/259. Chrome and Firefox pass user-gesture AudioWorklet/WASM and nonzero-render tests. The 18-second Chrome lifecycle test passes at 50 ms monitoring resolution.
- DSP stress results for 16/32/64/128 sine voices: 0.51/0.71/1.39/2.73% realtime. Sixteen simultaneous 5/20/50/100-partial banks: 0.71/1.70/3.44/6.38% realtime.

## Cleanup, deployment, and remaining review gate

- Generated release artifacts remain compatible with the existing static Pages deployment; no framework, cross-origin isolation, threads, deployment workflow, push, or public deployment was introduced.
- Documentation and README now describe build, feature flags, memory/event contracts, benchmarks, and stop decisions.
- Chrome and Firefox automation is complete. Matt manually opened `index.html` in Safari on 2026-08-26 and reported that it seemed solid, closing the Safari/local-review gate without enabling persistent remote automation.
- The legacy paths remain intentionally present as explicit comparison and failure fallbacks. After local Safari review and the release checks below passed, the migration was published on 2026-08-26.
- The canonical Musebots pipeline now verifies two byte-identical Rust/WASM builds and two byte-identical signal-tower bundle builds, rejects missing or stale deployment artifacts, and retains the native audio fallback in the bundle loaded asynchronously after the page `load` event.
- The signal-tower selector now exposes a prominent **Done building** action that closes the selector and build mode together, eliminating the hidden-toolbar workaround.

## 2026-09-21 — audit pass

- `WorldCore::retune` (added 2026-09-21 for skin switches that keep the creatures in place) needed the same `too_many_arguments` allowance as `configure`; Clippy with denied warnings and `cargo fmt --check` pass again.
- The shipped `wasm/world/world_core_bg.wasm` differed from a rebuild of the current source in 48 bytes of one constant table (same size, identical glue and typings), so it was rebuilt and replaced. `cargo test` passes.
- `ecology.js` now indexes the packed record's `kind` through one `KINDS` table (painter, body radius, whether it wades); adding a creature is one row there plus one arm in the Rust `think()` and `speed()`.
- The JS fallback and the Rust core have drifted in detail (the fallback herds and copies neighbours' rests, the core does not; the core keeps predators out of the village by clamping, the fallback by a push). Both are bounded and stable; the fallback remains a comparison path, not a mirror.
- Found and fixed through the headless checks: the night skin's darkness pass blurred each lit sign live (`shadowBlur` under a `lighter` composite on the dark map), and a software canvas pays that blur over the whole frame per sign per frame. Headless Chrome needed over 400 s of wall time for 300 ms of the night skin; with the reveals baked once per sign size into cached sprites (`revealSprite` in `engine.js`), 3000 ms takes about 1 s, the same as the day skins. Any visitor whose browser draws the canvas in software gets the same relief. `tools/console-sweep.py` keeps a short cut for those pages as a safety net.
- The 3D cave's reflections are drawn into one offscreen layer and laid on through the pools' rings once per frame, rather than clipping each mirrored item; measured from outside (`__slime3d-cost.html`), a frame with a pool in view costs about 25 ms in software rendering.
