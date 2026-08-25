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

Next: move authoritative ecology state and batched render data into `world-core`, retaining `ecology.js` as fallback.
