# Current architecture

## Runtime and lifecycle

`index.html` loads the handwritten world scripts with `defer`, starts the selected theme after `DOMContentLoaded`, and lazy-loads the generated `signal-towers.js` bundle after `load`. `engine.js` owns DOM creation, input, world/player state, the animation loop, Canvas 2D rendering, and native browser audio effects. Themes register configuration and painter functions through `window.MH_ISO`. Ordinary content remains accessible through `about.html` when JavaScript is unavailable.

The `requestAnimationFrame` loop clamps elapsed time to 50 ms, updates only while walking, renders, updates the HUD, and schedules the next frame. World topology is a torus of period `P`: `wrap`, `wrapDelta`, and nearest-image calculations are used for generation, movement, collision, interaction, and audio distance.

## World and rendering

`engine.js` deterministically generates zones and scenery from integer-coordinate hashes/noise. It owns player movement and collision with exhibits, the monument, buildings, and plants. Rendering calculates a visible tile rectangle, paints ground back-to-front, prepares a depth-ordered actor list, then invokes Canvas painter functions. Canvas calls and DOM work must remain on the main thread.

`ecology.js` retains the original bounded artificial-life implementation as a fallback. By default, `world-bridge.js` starts `world-worker.js`, which owns the authoritative Rust `WorldCore`: seeded spawning, packed entity state, movement, steering, flora, grazing, predator/prey interaction, mortality, reproduction, caps, and dormant-predator state. One step message enters and one packed transfer buffer leaves; entity buffers are recycled between the main thread and Worker. Flora transfers at 3 Hz. Canvas culling and painting stay on the main thread.

Player input/collision and deterministic tile/biome generation remain in `engine.js`. Profiling showed these short browser-facing calculations were not bottlenecks: at 10× ecology, Canvas averaged about 0.85 ms while main-thread Worker orchestration averaged about 0.02 ms. Moving player response through an asynchronous Worker would add control latency, and calling WASM once per visible tile would create the fine-grained boundary pattern prohibited by the migration plan. These phases were evaluated and intentionally stopped rather than ported for source-percentage alone.

## Signal Towers and audio

`signal-towers.js` is generated output, not canonical source. Its entry point is `web-musebots/integrations/bio-signal-towers.js`; `web-musebots/scripts/build-bio-signal-towers.mjs` bundles it with esbuild. The bundle exposes `window.MH_MUSEBOTS`, while the world reports listener position and tower layout through coarse calls.

The canonical Musebots `AudioEngine` still owns native master, limiter, analyser, per-tower spatial gain/filter, expressive ordinary oscillators, decoded samples, and browser lifecycle. Suitable custom synthesis routes to one persistent multi-output `AudioWorkletNode` per shared `AudioContext`. Each tower receives an independent output bus, preserving spatialization. The worklet hosts fixed-capacity Rust `DspEngine` instances with scheduled event queues, explicit oldest-voice stealing, procedural filtered noise, exact ratio/gain spectra up to 100 partials, true sample-rate FM/PM, and reusable output storage. `?wasmAudio=0` forces the native fallback.

## Migration seams

- `wasm-runtime.js`, `world-bridge.js`, and `wasm-audio.js` own feature status, lazy initialization, and fallback diagnostics.
- `world-core` runs in a Worker and communicates through 10-float entity records plus recycled transferable buffers.
- `dsp-core` runs in a persistent AudioWorklet; high-level agents send event batches, never PCM.
- JavaScript fallbacks remain present during local review and cross-browser qualification.
- Generated glue and binaries under `wasm/` are rebuilt by `./scripts/build-wasm.sh` and never edited directly.

## Deterministic test strategy

Production seeds use `crypto.getRandomValues`; fixed-seed Rust and shared JS fixtures cover wrapping, wrapped distance, collision primitives, RNG bounds, packed record width, movement/flora bounds, caps, voice/event capacity, oldest-voice stealing, dormant predators, and nonzero DSP output. Floating-point comparisons use tolerances. The fallback remains available for behavioural comparison.
