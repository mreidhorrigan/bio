#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import init, { DspEngine } from "../wasm/audio/dsp_core.js";

const bytes = await readFile(new URL("../wasm/audio/dsp_core_bg.wasm", import.meta.url));
await init({ module_or_path: bytes });
const sampleRate = 48000, block = 128, blocks = Math.ceil(sampleRate / block);

function run({ voices, model = 0, partials = 1 }) {
  const engine = new DspEngine(sampleRate, voices, 7);
  if (model === 2) {
    const ratios = Float32Array.from({ length: partials }, (_, index) => index + 1);
    const gains = Float32Array.from({ length: partials }, (_, index) => 1 / (index + 1) ** 1.15);
    engine.set_spectrum(0, ratios, gains);
  }
  for (let voice = 0; voice < voices; voice++)
    engine.enqueue_note(0, model, 55 * 2 ** ((voice % 48) / 12), 0.35, 1, model === 2 ? 0 : partials, 1.15);
  const output = new Float32Array(block);
  const started = performance.now();
  for (let index = 0; index < blocks; index++) engine.process(block, output);
  const elapsedMs = performance.now() - started;
  return { voices, model, partials, renderedSeconds: 1, elapsedMs, realtimeLoadPercent: elapsedMs / 10 };
}

const results = [];
for (const voices of [16, 32, 64, 128]) results.push(run({ voices }));
for (const partials of [5, 20, 50, 100]) results.push(run({ voices: 16, model: 2, partials }));
console.log(JSON.stringify({ runtime: process.version, platform: `${process.platform}-${process.arch}`, results }, null, 2));
