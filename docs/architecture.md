# Current architecture

## Runtime and lifecycle

`index.html` loads the handwritten world scripts with `defer`, starts the selected theme after `DOMContentLoaded`, and lazy-loads the generated `signal-towers.js` bundle after `load`. `engine.js` owns DOM creation, input, world/player state, the animation loop, Canvas 2D rendering, and native browser audio effects. Themes register configuration and painter functions through `window.MH_ISO`. Ordinary content remains accessible through `about.html` when JavaScript is unavailable.

The `requestAnimationFrame` loop clamps elapsed time to 50 ms, updates only while walking, renders, updates the HUD, and schedules the next frame. World topology is a torus of period `P`: `wrap`, `wrapDelta`, and nearest-image calculations are used for generation, movement, collision, interaction, and audio distance.

## World and rendering

`engine.js` deterministically generates zones and scenery from integer-coordinate hashes/noise. It owns player movement and collision with exhibits, the monument, buildings, and plants. Rendering calculates a visible tile rectangle, paints ground back-to-front, prepares a depth-ordered actor list, then invokes Canvas painter functions. Canvas calls and DOM work must remain on the main thread.

`ecology.js` is an optional bounded artificial-life layer. It stores flora/fear as reusable `Float32Array` fields and creatures as pooled JavaScript objects. Positions integrate every frame; brains and the wrapped spatial hash run near 6 Hz; cellular fields run near 3 Hz. Population caps, pooling, viewport culling, and a toroidal grid prevent unbounded work. Random spawning, wander, reproduction, rest, and immigration currently use `Math.random`.

## Signal Towers and audio

`signal-towers.js` is generated output, not canonical source. Its entry point is `web-musebots/integrations/bio-signal-towers.js`; `web-musebots/scripts/build-bio-signal-towers.mjs` bundles it with esbuild. The bundle exposes `window.MH_MUSEBOTS`, while the world reports listener position and tower layout through coarse calls.

The current `AudioEngine` creates a native Web Audio master/limiter/spatial-filter graph. Musical events frequently create transient oscillators, gains, filters, buffer sources, and generated noise buffers. Additive/resynthesis and FM-like textures are implemented in the Musebots source modules and bundled into the site. The later DSP migration will keep browser orchestration and efficient native nodes while moving suitable persistent synthesis into an AudioWorklet-hosted Rust/WASM core.

## Migration seams

- `wasm-runtime.js` owns optional WASM initialization and feature status.
- `world-core` will own coarse-grained world computation and eventually run in a Worker.
- `dsp-core` will own allocation-free realtime synthesis and eventually run in an AudioWorklet.
- JavaScript fallbacks remain authoritative until parity, benchmarks, and browser tests prove replacements stable.
- Packed typed arrays or reusable transferable buffers will cross the world boundary; full-world JSON and per-entity calls are prohibited.

## Deterministic test strategy

Production remains nondeterministic. Tests will inject a seeded PRNG into pure fixtures and ecology initialization without changing the default `Math.random` path. Shared fixtures will cover wrapping, wrapped distance, collision, spawning/caps, movement bounds, reproduction/mortality, predator/prey outcomes, spatial-neighbour queries, biome/placement decisions, and player collision. Floating-point comparisons use tolerances. JS and Rust implementations remain side-by-side until fixture parity is demonstrated.
