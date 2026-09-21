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

/**
 * Authoritative, allocation-bounded ecology state. Browser input enters once per
 * step and render state leaves as one packed Float32Array-compatible buffer.
 */
export class WorldCore {
    free(): void;
    [Symbol.dispose](): void;
    configure(grazer_cap: number, predator_cap: number, predator_dormant: boolean, mote_speed: number, grazer_speed: number, predator_speed: number, firefly_speed: number, turn: number, curiosity: number, hub_x: number, hub_y: number, village_radius: number): void;
    entity_count(): number;
    flora_len(): number;
    flora_ptr(): number;
    flora_snapshot(): Float32Array;
    constructor(period: number, seed: number, motes: number, grazers: number, predators: number, fireflies: number);
    population(kind: number): number;
    render_len(): number;
    render_ptr(): number;
    render_snapshot(): Float32Array;
    /**
     * One byte per tile of the P x P torus, 1 where a tile is open water.
     * The engine computes it with the same test the player wades by, so a
     * grazer slows down exactly where the player's slime does.
     */
    set_water(mask: Uint8Array): void;
    step(dt: number, player_x: number, player_y: number): void;
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
    readonly __wbg_worldcore_free: (a: number, b: number) => void;
    readonly abi_version: () => number;
    readonly circles_overlap: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly seededrng_new: (a: number) => number;
    readonly seededrng_next_f64: (a: number) => number;
    readonly seededrng_next_u32: (a: number) => number;
    readonly smoke_add: (a: number, b: number) => number;
    readonly worldcore_configure: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly worldcore_entity_count: (a: number) => number;
    readonly worldcore_flora_len: (a: number) => number;
    readonly worldcore_flora_ptr: (a: number) => number;
    readonly worldcore_flora_snapshot: (a: number) => [number, number];
    readonly worldcore_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly worldcore_population: (a: number, b: number) => number;
    readonly worldcore_render_len: (a: number) => number;
    readonly worldcore_render_ptr: (a: number) => number;
    readonly worldcore_render_snapshot: (a: number) => [number, number];
    readonly worldcore_set_water: (a: number, b: number, c: number) => void;
    readonly worldcore_step: (a: number, b: number, c: number, d: number) => void;
    readonly wrap: (a: number, b: number) => number;
    readonly wrapped_delta: (a: number, b: number) => number;
    readonly wrapped_distance: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
