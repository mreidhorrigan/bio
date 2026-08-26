(function () {
  "use strict";
  const wasm = window.MH_WASM;
  if (!wasm) return;
  const query = new URLSearchParams(location.search);
  const enabled = query.get("worker") !== "0" && query.get("wasmWorld") !== "0";
  let worker = null, signature = "", inFlight = false, recycle = null;
  const bridge = {
    enabled, ready: false, failed: false, snapshot: null, flora: null, populations: [0, 0, 0, 0], workerStepMs: 0, snapshots: 0,
    ensure(period, cfg, hub, villageRadius) {
      if (!this.enabled || this.failed) return;
      const nextSignature = [period, cfg.motes, cfg.grazerStart, cfg.grazerCap, cfg.predatorStart, cfg.predatorCap, cfg.predatorDormant, cfg.fireflies || 0, cfg.moteSpeed, cfg.grazerSpeed, cfg.predatorSpeed, cfg.fireflySpeed, cfg.turn, cfg.curiosity, hub.x, hub.y, villageRadius].join(":");
      if (worker && signature === nextSignature) return;
      if (worker) worker.terminate();
      signature = nextSignature; this.ready = false; this.snapshot = null; this.flora = null; inFlight = false; recycle = null;
      worker = new Worker("world-worker.js", { type: "module", name: "mh-world" });
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
      worker.postMessage({ type: "init", period, seed, motes: cfg.motes, grazers: cfg.grazerStart, grazerCap: cfg.grazerCap, predators: cfg.predatorStart, predatorCap: cfg.predatorCap, predatorDormant: !!cfg.predatorDormant, fireflies: cfg.fireflies || 0, moteSpeed: cfg.moteSpeed, grazerSpeed: cfg.grazerSpeed, predatorSpeed: cfg.predatorSpeed, fireflySpeed: cfg.fireflySpeed, turn: cfg.turn, curiosity: cfg.curiosity, hubX: hub.x, hubY: hub.y, villageRadius });
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
