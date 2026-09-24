(function () {
  "use strict";
  const wasm = window.MH_WASM;
  if (!wasm) return;
  const query = new URLSearchParams(location.search);
  const enabled = query.get("worker") !== "0" && query.get("wasmWorld") !== "0";
  let worker = null, signature = "", inFlight = false, recycle = null, lastPeriod = 0;
  const bridge = {
    enabled, ready: false, failed: false, snapshot: null, flora: null, populations: [0, 0, 0, 0], workerStepMs: 0, snapshots: 0,
    /** One byte per tile, 1 where a body cannot go: a dwelling, a growth or a
     *  kiosk. Unlike the water mask this changes while the visitor builds, so
     *  it can be re-sent on its own with sendSolid(). */
    solidMask(period) {
      const test = window.MH_ISO && window.MH_ISO.solidAt;
      if (!test) return null;
      const mask = new Uint8Array(period * period);
      let any = 0;
      for (let ty = 0; ty < period; ty++)
        for (let tx = 0; tx < period; tx++)
          if (test(tx, ty)) { mask[ty * period + tx] = 1; any++; }
      return any ? mask : null;
    },
    /** Hand the running world a new skin's tunables. No re-init, no respawn. */
    reconfigure(cfg, hub, villageRadius) {
      if (!worker || !this.ready) return;
      worker.postMessage({ type: "configure",
        grazerCap: cfg.grazerCap, predatorCap: cfg.predatorCap, predatorDormant: !!cfg.predatorDormant,
        moteSpeed: cfg.moteSpeed, grazerSpeed: cfg.grazerSpeed, predatorSpeed: cfg.predatorSpeed,
        fireflySpeed: cfg.fireflySpeed, turn: cfg.turn, curiosity: cfg.curiosity,
        hubX: (hub && hub.x) || 0, hubY: (hub && hub.y) || 0, villageRadius: villageRadius || 0,
        motes: cfg.motes | 0, fireflies: (cfg.fireflies || 0) | 0 });
    },
    sendSolid() {
      if (!worker || !this.ready || !lastPeriod) return;
      const mask = this.solidMask(lastPeriod);
      worker.postMessage({ type: "solid", mask: mask ? mask.buffer : null });
    },
    /** One byte per tile, 1 where the engine says a tile is open water. The
     *  world is deterministic, so this is built once per configuration. */
    waterMask(period) {
      // the same test the ripple uses, so a zoog never wades without splashing
      const test = window.MH_ISO && (window.MH_ISO.inWaterDeep || window.MH_ISO.onWater);
      if (!test) return null;
      const mask = new Uint8Array(period * period);
      let any = 0;
      for (let ty = 0; ty < period; ty++)
        for (let tx = 0; tx < period; tx++)
          if (test(tx, ty)) { mask[ty * period + tx] = 1; any++; }
      return any ? mask : null;
    },
    ensure(period, cfg, hub, villageRadius) {
      if (!this.enabled || this.failed) return;
      // Only the WORLD's shape rebuilds it. The skin's tunables (speeds, caps,
      // dormancy, atmosphere) are sent to the running world instead, so a change
      // of skin finds the same creatures standing where they stood.
      const nextSignature = String(period);
      if (worker && signature === nextSignature) return;
      if (worker) worker.terminate();
      signature = nextSignature; this.ready = false; this.snapshot = null; this.flora = null; inFlight = false; recycle = null;
      // A browser that will not start the worker (a page opened from a file, say) throws
      // here. Unguarded, that broke every frame of the world, its sound with it; now the
      // world falls back to the JS ecology (ecology.js), as for any other worker failure.
      try { worker = new Worker("world-worker.js", { type: "module", name: "mh-world" }); }
      catch (e) { worker = null; fail((e && e.message) || "world worker could not start"); return; }
      worker.onmessage = ({ data }) => {
        if (data.type === "ready") { this.ready = true; wasm.state.world = "ready"; }
        else if (data.type === "snapshot") {
          if (this.snapshot && this.snapshot.byteLength) recycle = this.snapshot.buffer;
          this.snapshot = new Float32Array(data.entities);
          if (data.flora) this.flora = new Float32Array(data.flora);
          this.populations = data.populations; inFlight = false;
          this.workerStepMs = data.stepMs || 0; this.snapshots++;
          if (window.MH_PERF) window.MH_PERF.mark("worker", this.workerStepMs);
        } else if (data.type === "error") fail(data.message);
      };
      worker.onerror = (event) => fail(event.message || "world worker failed");
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      lastPeriod = period;
      const water = this.waterMask(period);
      const solid = this.solidMask(period);
      worker.postMessage({ type: "init", period, seed, water: water ? water.buffer : null, solid: solid ? solid.buffer : null, motes: cfg.motes, grazers: cfg.grazerStart, grazerCap: cfg.grazerCap, predators: cfg.predatorStart, predatorCap: cfg.predatorCap, predatorDormant: !!cfg.predatorDormant, fireflies: cfg.fireflies || 0, moteSpeed: cfg.moteSpeed, grazerSpeed: cfg.grazerSpeed, predatorSpeed: cfg.predatorSpeed, fireflySpeed: cfg.fireflySpeed, turn: cfg.turn, curiosity: cfg.curiosity, hubX: hub.x, hubY: hub.y, villageRadius });
    },
    step(dt, player) {
      if (!worker || !this.ready || inFlight) return;
      inFlight = true;
      const message = { type: "step", dt, playerX: player.x, playerY: player.y };
      if (recycle) { message.recycle = recycle; worker.postMessage(message, [recycle]); recycle = null; }
      else worker.postMessage(message);
    },
    reset() {
      signature = "";
      if (worker) { worker.terminate(); worker = null; }
      this.ready = false; this.snapshot = null; this.flora = null; inFlight = false; recycle = null;
    },
  };
  function fail(message) {
    bridge.failed = true; bridge.ready = false; bridge.enabled = false; inFlight = false;
    if (worker) { worker.terminate(); worker = null; }
    wasm.state.world = "fallback";
    wasm.state.errors.push({ core: "world-worker", message: String(message) });
  }
  wasm.worldBridge = bridge;
})();
