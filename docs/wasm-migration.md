# WASM migration design

The browser remains the shell. Rust/WASM is reserved for computational kernels that benefit from predictable data layout, reduced allocation, or execution away from the main thread.

Feature selection is independent. The Rust World Worker defaults on; `?wasmWorld=0` forces legacy ecology for comparison. WASM audio is lazy-loaded after the normal user gesture and defaults on; `?wasmAudio=0` forces native fallback. A failed fetch, compile, Worker, or worklet initialization records a diagnostic and leaves the site and legacy path usable.

Generated browser artifacts live under `wasm/world/` and `wasm/audio/`. Handwritten Rust lives under `rust/`; handwritten integration code lives outside generated directories. The build uses `wasm32-unknown-unknown`, `wasm-bindgen`, browser-native ES modules, and no application bundler.

The world boundary is one coarse `step` request and one packed snapshot. Entity records are ten `f32` values: `x, y, vx, vy, energy, kind, phase, rest, dormant, eat`. Transfer buffers are returned to the Worker for reuse; flora is sent less often.

The audio boundary is a batch of timed control events. One multi-output worklet supplies up to 24 independently spatialized tower buses. Rust preallocates 128 voices, 512 queued events, output storage, sine tables, and 32 spectra of up to 100 partials per engine. Spectrum configuration occurs in the message handler, never in `process()`.

Player collision, browser input, deterministic Canvas-facing generation, visibility transforms, depth sorting with non-ecology actors, DOM, Canvas calls, and native master/spatial/sample nodes stay in JavaScript. Benchmarks showed the simulation is no longer the main-thread bottleneck; further ordinary rendering ports stop here unless new evidence justifies a different graphics architecture.
