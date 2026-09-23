# Browser liquid, fluid, and fog representations: implementation shortlist

Research snapshot: 21 September 2026. This is a source/documentation review, not a build or performance test. Runtime-cost rankings are engineering judgments, not comparable measured benchmarks.

## Recommended default

Use a coarse, gameplay-authoritative water/material model in Rust/WASM, with surface shading and decorative detail on the GPU. Start with heightfields for interactive water, inexpensive surface materials for distant water, and batched particles for spray, mist, and fire. Add full 3D fluid dynamics only where changing fluid topology is important to gameplay or presentation.

Do not conflate these tasks:

- **Simulation:** how water or gas moves and affects the game.
- **Representation:** heightfield, particles, scalar density, mesh, or screen-space surface.
- **Rendering:** normals, reflection, refraction, absorption, scattering, and foam.

A shader module need not become WASM to work with a WASM game. Conversely, a WASM fluid simulator does not automatically supply attractive rendering.

## Water and fluid shortlist

| Resource | Best role | Integration status | License/status checked |
|---|---|---|---|
| [Salva](https://github.com/dimforge/salva) | Localized 2D/3D particle-fluid dynamics, including optional Rapier coupling | Rust library explicitly supporting WASM; implement your own game-facing wrapper and renderer | Apache-2.0 |
| [Three.js Water](https://threejs.org/docs/pages/Water.html) | Basic flat reflective water | Importable WebGLRenderer addon; not a fluid solver | Three.js MIT |
| [Three.js Water2 source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2.js) | Flow-map/animated-normal water, reflection and refraction | Importable addon; exports `Water`, not `Water2`; not a wave geometry solver | Three.js MIT |
| [Three.js WaterMesh](https://threejs.org/docs/pages/WaterMesh.html) | Flat water with WebGPURenderer | Importable addon; distinct from the older WebGL classes | Three.js MIT |
| [Three.js GPGPU water](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html) | GPU heightfield ripples | Adaptable example, using texture-based GPU computation; not a standalone water package | Three.js MIT |
| [Ten Minute Physics #20](https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/20-heightFieldWater.html) | Compact heightfield simulation and solid/water interaction | Educational JavaScript source, suitable as a small Rust/WASM port reference; no prebuilt WASM claimed | Inspect source licensing before copying |
| [jeantimex/webgpu-water](https://github.com/jeantimex/webgpu-water) | Attractive pool-heightfield rendering reference | TypeScript/WGSL WebGPU demo; rendering contains specialized analytic pool/sphere assumptions | MIT |
| [Splash](https://github.com/matsuoka-601/Splash) | Free-surface 3D splashing fluid and smooth particle-surface rendering | WebGPU/WGSL project to adapt; not a WASM library or documented turnkey npm component | MIT |
| [Babylon FluidRenderer documentation](https://doc.babylonjs.com/features/featuresDeepDive/particles/fluid_renderer/) | Packaged screen-space rendering of particle fluids | Existing engine component; accepts custom particle buffers; simulation is separate | Use within the appropriate Babylon.js release |
| [Babylon FluidRenderer implementation](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Rendering/fluidRenderer/fluidRenderer.pure.ts) | Verify the custom-buffer and backend interfaces | `addCustomParticles` accepts position data; renderer contains GLSL/WGSL backend handling | API/version audit required before integrating |
| [Popov72/OceanDemo](https://github.com/Popov72/OceanDemo) | FFT ocean surface | Babylon.js WebGPU demo/project; not a ready WASM module | MIT |
| [dli/waves](https://github.com/dli/waves) | Older compact WebGL ocean implementation | Source reference; assess maintenance/integration yourself | MIT |
| [fast-surface-nets](https://github.com/bonsairobo/fast-surface-nets-rs) | World-space mesh extraction from a sampled scalar field | Rust crate; candidate for your own WASM build and exports, which were not tested here | MIT OR Apache-2.0 |
| [Three.js MarchingCubes](https://threejs.org/docs/pages/MarchingCubes.html) | Small metaball/slime mesh effects | Directly importable JavaScript addon, not WASM | Three.js MIT |

### Useful demonstrations

- Heightfield pool: https://jeantimex.github.io/webgpu-water/
- Interactive 3D splashes: https://splash-fluid.netlify.app/
- FFT ocean: https://popov72.github.io/OceanDemo/dist/index.html
- Older WebGL waves: https://david.li/waves/

### Algorithm-selection notes

**Gerstner waves:** a few analytic waves deform geometry; high-frequency texture normals supply detail. Good for convincing animated water without volume simulation. Water2 does not itself implement Gerstner geometry. Reference: [GPU Gems, Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models).

**Heightfields:** maintain a single water height over each horizontal location. Well suited to pools, ponds, ripples, and many shallow channels. A ripple equation does not automatically provide conservative drainage or flooding. For the latter, consider a conservative depth/flux model. [Lisyarus's virtual-pipes implementation explanation](https://lisyarus.github.io/blog/posts/simulating-water-over-terrain.html) is a compact source-level reference, not a prebuilt WASM library. Ordinary single-layer heightfields do not represent overturning waves or vertically separated water at the same horizontal position.

**Screen-space fluid rendering:** render particle depth and thickness, smooth the depth, reconstruct normals, and shade the apparent surface. This avoids rebuilding a world-space triangle mesh, but costs depend strongly on screen coverage and output resolution. It is not a mesh that can automatically be reused for collision, secondary views, or shadows. Splash uses a narrow-range depth filter; its simulation is MLS-MPM. Its single-substep tuning trades away some incompressibility and must be revalidated for a game. [Author's implementation article](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/).

**FFT ocean:** appropriate when a large visible sea justifies a richer wave spectrum. Not a replacement for terrain-aware draining/flooding or free 3D splashes. Note that `matsuoka-601/webgpu-ocean` is a particle-fluid project despite its name, whereas `Popov72/OceanDemo` is an FFT ocean.

**Surface Nets/Marching Cubes:** use when a real world-space mesh matters. Both extract surfaces; neither is a fluid-motion solver. Restrict extraction to small active regions and reuse buffers. Do not interpret native meshing benchmarks as WASM benchmarks.

## Fog, smoke, fire, clouds, and interacting materials

| Resource | Best role | Integration/status |
|---|---|---|
| [Three.js FogExp2](https://threejs.org/docs/pages/FogExp2.html) | Cheap scene-wide distance haze | Built-in; not localized swirling or illuminated volume |
| [three.quarks](https://github.com/Alchemist0823/three.quarks) | Batched billboard/mesh/trail effects: mist, spray, fire, rain, spores, debris | MIT npm package; main package is not a ready WASM fluid solver; experimental WebGPU work is separate |
| [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) | Animated 2D dye, smoke-like flow, magical currents | MIT WebGL source project; not a 3D liquid-surface solver |
| [Three.js VolumeNodeMaterial](https://threejs.org/docs/pages/VolumeNodeMaterial.html) | Local raymarched volumes | Node-material integration; select backend-specific examples |
| [Three.js WebGPU volume lighting](https://threejs.org/examples/webgpu_volume_lighting.html) | Lit local fog/volume reference | WebGPU example, adaptation needed |
| [Three.js WebGL volume-cloud source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_volume_cloud.html) | WebGL2 raymarched cloud/noise-volume reference | Source example, not a gas solver |
| [Takram three-geospatial](https://github.com/takram-design-engineering/three-geospatial) | High-quality expansive atmosphere and clouds | MIT modular packages; atmosphere/cloud packages marked beta, with active WebGPU/API transition |
| [Sandspiel](https://github.com/MaxBittker/sandspiel) | Interacting cellular materials in a 2D/layered ecology | MIT working Rust/WASM + WebGL application; adapt its simulation core rather than importing the entire site |
| [Ten Minute Physics #17 and #21](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) | Small educational Eulerian-fluid and fire solvers | JavaScript sources that can inform a compact custom CPU/WASM implementation |

For decorative fog, first try cheap depth/distance or height-dependent haze plus a bounded number of animated cards. For a flashlight revealing a dense moving volume, use localized raymarching. For gas that affects gameplay, maintain a coarse authoritative concentration/velocity field and treat visual wisps as secondary detail.

## Integration and validation

- Preserve one authoritative fluid/material state for collisions, immersion, currents, and object interaction. Drive visual water levels and large disturbances from it.
- Keep small visual ripples, spray, and mist on the GPU unless gameplay requires their individual state.
- Exchange contiguous arrays/textures and batch updates; avoid one JS/WASM call per particle.
- Do not move GPU particle data to the CPU each frame merely to construct a prettier surface. Use GPU surface reconstruction when the simulation already lives there.
- A native Rust/wgpu renderer should generally port the relevant algorithms/shaders, not introduce a second Three.js/Babylon renderer just for water.
- [wgpu](https://github.com/gfx-rs/wgpu) supports browser WebGPU and downlevel WebGL2, but WebGPU compute code does not automatically acquire a WebGL2 compute fallback. The [WebGL2 limits](https://docs.rs/wgpu/latest/wgpu/struct.Limits.html#method.downlevel_webgl2_defaults) have zero compute and storage-buffer limits.
- Feature-detect WebGPU and successful device creation. Maintain a separately designed fallback where broad device support matters.
- Starting experiments, not performance promises: 64×64 or 128×128 active basin fields; a few analytic large waves; bounded spray emitters; localized volume rendering at reduced resolution with a small sample budget.
- Test whole-game CPU/GPU frame time, high-percentile frame spikes, screen resolution, transparent overdraw, memory, shader compilation, context/device loss, and collision/visual agreement. A fluid-only demo's particle count is not a budget for the whole game.
