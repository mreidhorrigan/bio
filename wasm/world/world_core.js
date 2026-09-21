/* @ts-self-types="./world_core.d.ts" */

/**
 * Small deterministic generator for fixtures and procedural systems. Production
 * callers choose their own seed; this does not replace the site's normal entropy.
 */
export class SeededRng {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SeededRngFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_seededrng_free(ptr, 0);
    }
    /**
     * @param {number} seed
     */
    constructor(seed) {
        const ret = wasm.seededrng_new(seed);
        this.__wbg_ptr = ret;
        SeededRngFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    next_f64() {
        const ret = wasm.seededrng_next_f64(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    next_u32() {
        const ret = wasm.seededrng_next_u32(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) SeededRng.prototype[Symbol.dispose] = SeededRng.prototype.free;

/**
 * Authoritative, allocation-bounded ecology state. Browser input enters once per
 * step and render state leaves as one packed Float32Array-compatible buffer.
 */
export class WorldCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WorldCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_worldcore_free(ptr, 0);
    }
    /**
     * @param {number} grazer_cap
     * @param {number} predator_cap
     * @param {boolean} predator_dormant
     * @param {number} mote_speed
     * @param {number} grazer_speed
     * @param {number} predator_speed
     * @param {number} firefly_speed
     * @param {number} turn
     * @param {number} curiosity
     * @param {number} hub_x
     * @param {number} hub_y
     * @param {number} village_radius
     */
    configure(grazer_cap, predator_cap, predator_dormant, mote_speed, grazer_speed, predator_speed, firefly_speed, turn, curiosity, hub_x, hub_y, village_radius) {
        wasm.worldcore_configure(this.__wbg_ptr, grazer_cap, predator_cap, predator_dormant, mote_speed, grazer_speed, predator_speed, firefly_speed, turn, curiosity, hub_x, hub_y, village_radius);
    }
    /**
     * @returns {number}
     */
    entity_count() {
        const ret = wasm.worldcore_entity_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    flora_len() {
        const ret = wasm.worldcore_flora_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    flora_ptr() {
        const ret = wasm.worldcore_flora_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Float32Array}
     */
    flora_snapshot() {
        const ret = wasm.worldcore_flora_snapshot(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} period
     * @param {number} seed
     * @param {number} motes
     * @param {number} grazers
     * @param {number} predators
     * @param {number} fireflies
     */
    constructor(period, seed, motes, grazers, predators, fireflies) {
        const ret = wasm.worldcore_new(period, seed, motes, grazers, predators, fireflies);
        this.__wbg_ptr = ret;
        WorldCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} kind
     * @returns {number}
     */
    population(kind) {
        const ret = wasm.worldcore_population(this.__wbg_ptr, kind);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    render_len() {
        const ret = wasm.worldcore_render_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    render_ptr() {
        const ret = wasm.worldcore_render_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Float32Array}
     */
    render_snapshot() {
        const ret = wasm.worldcore_render_snapshot(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * One byte per tile of the P x P torus, 1 where a tile is open water.
     * The engine computes it with the same test the player wades by, so a
     * grazer slows down exactly where the player's slime does.
     * @param {Uint8Array} mask
     */
    set_water(mask) {
        const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.worldcore_set_water(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} dt
     * @param {number} player_x
     * @param {number} player_y
     */
    step(dt, player_x, player_y) {
        wasm.worldcore_step(this.__wbg_ptr, dt, player_x, player_y);
    }
}
if (Symbol.dispose) WorldCore.prototype[Symbol.dispose] = WorldCore.prototype.free;

/**
 * @returns {number}
 */
export function abi_version() {
    const ret = wasm.abi_version();
    return ret >>> 0;
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} ar
 * @param {number} bx
 * @param {number} by
 * @param {number} br
 * @param {number} period
 * @returns {boolean}
 */
export function circles_overlap(ax, ay, ar, bx, by, br, period) {
    const ret = wasm.circles_overlap(ax, ay, ar, bx, by, br, period);
    return ret !== 0;
}

/**
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
export function smoke_add(left, right) {
    const ret = wasm.smoke_add(left, right);
    return ret;
}

/**
 * @param {number} value
 * @param {number} period
 * @returns {number}
 */
export function wrap(value, period) {
    const ret = wasm.wrap(value, period);
    return ret;
}

/**
 * @param {number} delta
 * @param {number} period
 * @returns {number}
 */
export function wrapped_delta(delta, period) {
    const ret = wasm.wrapped_delta(delta, period);
    return ret;
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} period
 * @returns {number}
 */
export function wrapped_distance(ax, ay, bx, by, period) {
    const ret = wasm.wrapped_distance(ax, ay, bx, by, period);
    return ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./world_core_bg.js": import0,
    };
}

const SeededRngFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_seededrng_free(ptr, 1));
const WorldCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_worldcore_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('world_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
