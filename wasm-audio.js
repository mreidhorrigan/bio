(function () {
  "use strict";
  const wasm = window.MH_WASM;
  if (!wasm) return;
  const base = new URL(".", document.currentScript.src);
  const enabled = new URLSearchParams(location.search).get("wasmAudio") !== "0";
  let compiledModule = null;
  const registered = new WeakSet();
  const managers = new WeakMap();
  const BUS_COUNT = 24;

  async function compile() {
    if (compiledModule) return compiledModule;
    const response = await fetch(new URL("wasm/audio/dsp_core_bg.wasm", base));
    if (!response.ok) throw new Error(`DSP WASM HTTP ${response.status}`);
    compiledModule = await WebAssembly.compileStreaming(response.clone()).catch(async () => WebAssembly.compile(await response.arrayBuffer()));
    return compiledModule;
  }

  async function createManager(context, options) {
    const module = await compile();
    if (!registered.has(context)) {
      await context.audioWorklet.addModule(new URL("wasm/audio/dsp-worklet.js", base));
      registered.add(context);
    }
    const seed = options.seed || crypto.getRandomValues(new Uint32Array(1))[0];
    const node = new AudioWorkletNode(context, "mh-rust-dsp", {
      numberOfInputs: 0, numberOfOutputs: BUS_COUNT, outputChannelCount: Array(BUS_COUNT).fill(2),
      processorOptions: { module, busCount: BUS_COUNT, maxVoices: options.maxVoices || 16, seed },
    });
    // A worklet may not service its message port until it participates in the
    // render graph. It emits zeroes before initialization, so direct bootstrap
    // is silent and avoids browsers optimizing a zero-gain branch away.
    node.connect(context.destination);
    const ready = new Promise((resolve, reject) => {
      let progress = "processor did not construct";
      const timeout = setTimeout(() => reject(new Error(`DSP AudioWorklet initialization timed out (${progress})`)), 5000);
      const onMessage = ({ data }) => {
        if (data.type === "constructed") progress = "processor constructed";
        else if (data.type === "initializing") progress = "WASM initialization began";
        else if (data.type === "ready") { clearTimeout(timeout); node.port.removeEventListener("message", onMessage); resolve(node); }
        else if (data.type === "error") { clearTimeout(timeout); node.port.removeEventListener("message", onMessage); reject(new Error(data.message)); }
      };
      node.onprocessorerror = () => { clearTimeout(timeout); reject(new Error("DSP AudioWorklet processor crashed")); };
      node.port.addEventListener("message", onMessage); node.port.start();
    });
    if (context.state === "suspended") await context.resume();
    await ready;
    node.disconnect(context.destination);
    const request = (type, payload = {}) => new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const listener = ({ data }) => { if (data.type === type && data.requestId === requestId) { node.port.removeEventListener("message", listener); resolve(data); } };
      node.port.addEventListener("message", listener); node.port.postMessage({ type, requestId, ...payload });
    });
    wasm.state.audio = "ready";
    return { node, nextBus: 0, request };
  }

  async function createNode(context, options = {}) {
    if (!enabled) throw new Error("WASM audio disabled by query flag");
    let managerPromise = managers.get(context);
    if (!managerPromise) {
      managerPromise = createManager(context, options);
      managers.set(context, managerPromise);
    }
    const manager = await managerPromise;
    if (manager.nextBus >= BUS_COUNT) throw new Error(`DSP output bus limit (${BUS_COUNT}) exceeded`);
    const bus = manager.nextBus++;
    return {
      bus,
      connect(destination) { manager.node.connect(destination, bus, 0); return destination; },
      disconnect(destination) { destination ? manager.node.disconnect(destination, bus, 0) : manager.node.disconnect(bus); },
      schedule(events) { manager.node.port.postMessage({ type: "events", bus, events }); },
      diagnostics() { return manager.request("diagnostics", { bus }); },
      renderProbe() { return manager.request("render-probe", { bus }); },
    };
  }

  wasm.audio = { enabled, compile, createNode };
})();
