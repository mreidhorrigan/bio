/* tslint:disable */
/* eslint-disable */

export class DspEngine {
    free(): void;
    [Symbol.dispose](): void;
    active_voices(): number;
    current_frame(): number;
    enqueue_note(target_frame: number, model: number, frequency: number, velocity: number, duration_seconds: number, param_a: number, param_b: number): boolean;
    constructor(sample_rate: number, max_voices: number, seed: number);
    /**
     * Runs a short deterministic note for browser smoke tests. This is never
     * called from the normal realtime path.
     */
    probe_peak(): number;
    process(frames: number, destination: Float32Array): void;
    queued_events(): number;
    set_max_voices(count: number): void;
    set_spectrum(slot: number, ratios: Float32Array, gains: Float32Array): void;
}

export function abi_version(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_dspengine_free: (a: number, b: number) => void;
    readonly abi_version: () => number;
    readonly dspengine_active_voices: (a: number) => number;
    readonly dspengine_current_frame: (a: number) => number;
    readonly dspengine_enqueue_note: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly dspengine_new: (a: number, b: number, c: number) => number;
    readonly dspengine_probe_peak: (a: number) => number;
    readonly dspengine_process: (a: number, b: number, c: any) => void;
    readonly dspengine_queued_events: (a: number) => number;
    readonly dspengine_set_max_voices: (a: number, b: number) => void;
    readonly dspengine_set_spectrum: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
