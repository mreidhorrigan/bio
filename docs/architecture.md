# Current architecture

## Runtime and lifecycle

`index.html` loads the handwritten world scripts with `defer`, starts the selected theme after `DOMContentLoaded`, and lazy-loads the generated `signal-towers.js` bundle after `load`. `engine.js` owns DOM creation, input, world/player state, the animation loop, Canvas 2D rendering, and native browser audio effects. Themes register configuration and painter functions through `window.MH_ISO`. Ordinary content remains accessible through `about.html` when JavaScript is unavailable.

The `requestAnimationFrame` loop clamps elapsed time to 50 ms, updates only while walking, renders, updates the HUD, and schedules the next frame. World topology is a torus of period `P`: `wrap`, `wrapDelta`, and nearest-image calculations are used for generation, movement, collision, interaction, and audio distance.

## World and rendering

`engine.js` deterministically generates zones and scenery from integer-coordinate hashes/noise. It owns player movement and collision with exhibits, the monument, buildings, and plants. Rendering calculates a visible tile rectangle, paints ground back-to-front, prepares a depth-ordered actor list, then invokes Canvas painter functions. Canvas calls and DOM work must remain on the main thread.

`ecology.js` retains the original bounded artificial-life implementation as a fallback. By default, `world-bridge.js` starts `world-worker.js`, which owns the authoritative Rust `WorldCore`: seeded spawning, packed entity state, movement, steering, flora, grazing, predator/prey interaction, mortality, reproduction, caps, and dormant-predator state. One step message enters and one packed transfer buffer leaves; entity buffers are recycled between the main thread and Worker. Flora transfers at 3 Hz. Canvas culling and painting stay on the main thread.

Player input/collision and deterministic tile/biome generation remain in `engine.js`. Profiling showed these short browser-facing calculations were not bottlenecks: at 10× ecology, Canvas averaged about 0.85 ms while main-thread Worker orchestration averaged about 0.02 ms. Moving player response through an asynchronous Worker would add control latency, and calling WASM once per visible tile would create the fine-grained boundary pattern prohibited by the migration plan. These phases were evaluated and intentionally stopped rather than ported for source-percentage alone.

## Registries

The world grows by registration rather than by editing condition chains. `engine.js` keeps `STRUCTURES` (how a kiosk that is not a dwelling is drawn; `content.js` names one with `structure:`) and `BUILD_TOOLS` (a button, cursor, hit-box and lifecycle hooks per placeable building type), exposed as `MH_ISO.registerStructure` and `MH_ISO.registerBuildTool`. `buildings.js` keeps the painters by type behind `MH_BUILD.register`. `ecology.js` keeps `KINDS`, the table the packed ten-float record's `kind` indexes into, with each kind's painter and body radius; the Rust `WorldCore` must carry a matching arm in `think()` and `speed()`.

## The three engines

The isometric engine (`engine.js`) is one of three, each kept apart from the words and geometry it shows so that it can be reused: the sidescroller `engine-side.js` behind `glossary.html` (its world is `glossary-world.js`, its body `slime-2d.js`), and the third-person software renderer `engine-3d.js`, whose first world is `slime3d.js`. The 3D engine draws on the same 2D canvas as the others: items are collected in world space, projected, sorted back to front within layers, fogged toward a colour the world chooses per point, and filled and stroked one at a time. Rounded bodies are the convex hull of a projected point cloud traced as one smooth line, which is what keeps the site's flat-fill-plus-ink look in three dimensions without a mesh outline. The boom camera shortens wherever the world's `inside()` says the camera would be in rock. A pool is a mirror: whatever stands over it is drawn again, flipped through the water's level, with the waves read where the eye's ray meets the surface, so a reflection bobs without leaning. The slimeverse's shared runtime, `verse3d.js`, and its places, `verse3d-scenes.js` (the village read from `content.js` in each skin, the slime's house, and the cave as a ring), run the site's `slimeverse3d.html`. The page is entered from the Slimeverse 3D house on the Games branch, and there every other house opens its menu or page as in the iso village. `brand/backstage/slimes/verse3d.html` is the workshop for the same places.

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
