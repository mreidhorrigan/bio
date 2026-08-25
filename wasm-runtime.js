(function () {
  "use strict";
  const state = { world: "idle", audio: "idle", errors: [] };
  const flags = { world: false, worldWorker: false, audio: false };

  async function loadWorld() {
    if (state.world === "ready") return true;
    state.world = "loading";
    try {
      const module = await import("./wasm/world/world_core.js");
      await module.default();
      if (module.abi_version() !== 1 || module.smoke_add(20, 22) !== 42) throw new Error("world-core ABI smoke check failed");
      state.world = "ready";
      window.MH_WASM.world = module;
      window.dispatchEvent(new CustomEvent("mh-wasm-ready", { detail: { core: "world" } }));
      return true;
    } catch (error) {
      state.world = "fallback";
      state.errors.push({ core: "world", message: String(error && error.message || error) });
      return false;
    }
  }

  window.MH_WASM = { flags, state, loadWorld };
  const query = new URLSearchParams(location.search);
  if (query.get("wasm") === "1") { flags.world = true; loadWorld(); }
})();
