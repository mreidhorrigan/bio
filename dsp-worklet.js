class MhDspProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions || {};
    try {
      initSync({ module: config.module });
      this.engines = Array.from({ length: config.busCount || 1 }, (_, bus) =>
        new DspEngine(sampleRate, config.maxVoices || 16, (config.seed || 1) + bus));
      this.spectrumSlots = this.engines.map(() => new Map());
      this.nextSpectrumSlot = new Uint8Array(this.engines.length);
      this.port.postMessage({ type: "ready", abi: 1 });
    } catch (error) {
      this.engines = [];
      this.port.postMessage({ type: "error", message: String(error && error.stack || error) });
    }
    this.port.onmessage = ({ data }) => {
      const engine = this.engines[data.bus || 0];
      if (data.type === "events" && engine) {
        for (const event of data.events) {
          let paramA = event.paramA || 0;
          if (event.model === 2 && event.ratios?.length && event.gains?.length) {
            const key = `${event.ratios.join(",")}|${event.gains.join(",")}`;
            let slot = this.spectrumSlots[data.bus || 0].get(key);
            if (slot === undefined) {
              slot = this.nextSpectrumSlot[data.bus || 0]++ % 32;
              engine.set_spectrum(slot, new Float32Array(event.ratios), new Float32Array(event.gains));
              this.spectrumSlots[data.bus || 0].set(key, slot);
            }
            paramA = slot;
          }
          const target = engine.current_frame() + Math.max(0, Number(event.offsetSeconds) || 0) * sampleRate;
          engine.enqueue_note(target, event.model || 0, event.frequency, event.velocity ?? 0.7, event.duration ?? 0.25, paramA, event.paramB || 0);
        }
      } else if (data.type === "voices" && engine) {
        engine.set_max_voices(data.count);
      } else if (data.type === "diagnostics" && engine) {
        this.port.postMessage({ type: "diagnostics", requestId: data.requestId, bus: data.bus || 0, activeVoices: engine.active_voices(), queuedEvents: engine.queued_events(), currentFrame: engine.current_frame() });
      } else if (data.type === "render-probe" && engine) {
        const peak = engine.probe_peak();
        this.port.postMessage({ type: "render-probe", requestId: data.requestId, bus: data.bus || 0, peak, activeVoices: engine.active_voices() });
      }
    };
    this.port.start();
  }

  process(_inputs, outputs) {
    for (let bus = 0; bus < outputs.length; bus++) {
      const output = outputs[bus];
      if (!output || !output.length) continue;
      const mono = output[0];
      const engine = this.engines[bus];
      if (engine) engine.process(mono.length, mono); else mono.fill(0);
      for (let channel = 1; channel < output.length; channel++) output[channel].set(mono);
    }
    return true;
  }
}

registerProcessor("mh-rust-dsp", MhDspProcessor);
