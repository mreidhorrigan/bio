/* tslint:disable */
/* eslint-disable */

/**
 * Small deterministic generator for fixtures and procedural systems. Production
 * callers choose their own seed; this does not replace the site's normal entropy.
 */
export class SeededRng {
    free(): void;
    [Symbol.dispose](): void;
    constructor(seed: number);
    next_f64(): number;
    next_u32(): number;
}

export function abi_version(): number;

export function circles_overlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number, period: number): boolean;

export function smoke_add(left: number, right: number): number;

export function wrap(value: number, period: number): number;

export function wrapped_delta(delta: number, period: number): number;

export function wrapped_distance(ax: number, ay: number, bx: number, by: number, period: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_seededrng_free: (a: number, b: number) => void;
    readonly abi_version: () => number;
    readonly circles_overlap: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly seededrng_new: (a: number) => number;
    readonly seededrng_next_f64: (a: number) => number;
    readonly seededrng_next_u32: (a: number) => number;
    readonly smoke_add: (a: number, b: number) => number;
    readonly wrap: (a: number, b: number) => number;
    readonly wrapped_delta: (a: number, b: number) => number;
    readonly wrapped_distance: (a: number, b: number, c: number, d: number, e: number) => number;
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
