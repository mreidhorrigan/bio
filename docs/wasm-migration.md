# WASM migration design

The browser remains the shell. Rust/WASM is reserved for computational kernels that benefit from predictable data layout, reduced allocation, or execution away from the main thread.

Feature selection is independent: `world`, `worldWorker`, and `audio` flags default off until their phases reach parity. A failed fetch, compile, or initialization records a diagnostic and leaves the legacy JavaScript path running. No WASM failure may prevent content, navigation, Canvas, or existing audio from loading.

Generated browser artifacts live under `wasm/world/` and `wasm/audio/`. Handwritten Rust lives under `rust/`; handwritten integration code lives outside generated directories. The build uses `wasm32-unknown-unknown`, `wasm-bindgen`, browser-native ES modules, and no application bundler.

The initial smoke export returns a stable ABI version and performs integer addition. It proves static hosting, JS-to-Rust calls, returned data, and caught failure without moving runtime behaviour.
