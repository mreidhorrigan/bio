/* @ts-self-types="./dsp_core.d.ts" */

export class DspEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DspEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_dspengine_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    active_voices() {
        const ret = wasm.dspengine_active_voices(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    current_frame() {
        const ret = wasm.dspengine_current_frame(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} target_frame
     * @param {number} identity
     * @param {number} action
     * @param {number} value
     * @returns {boolean}
     */
    enqueue_control(target_frame, identity, action, value) {
        const ret = wasm.dspengine_enqueue_control(this.__wbg_ptr, target_frame, identity, action, value);
        return ret !== 0;
    }
    /**
     * @param {number} target_frame
     * @param {number} model
     * @param {number} frequency
     * @param {number} velocity
     * @param {number} duration_seconds
     * @param {number} param_a
     * @param {number} param_b
     * @returns {boolean}
     */
    enqueue_note(target_frame, model, frequency, velocity, duration_seconds, param_a, param_b) {
        const ret = wasm.dspengine_enqueue_note(this.__wbg_ptr, target_frame, model, frequency, velocity, duration_seconds, param_a, param_b);
        return ret !== 0;
    }
    /**
     * @param {number} target_frame
     * @param {number} identity
     * @param {number} model
     * @param {number} frequency
     * @param {number} velocity
     * @param {number} duration_seconds
     * @param {number} param_a
     * @param {number} param_b
     * @param {number} attack_seconds
     * @param {number} release_seconds
     * @param {number} vibrato_depth
     * @param {number} vibrato_rate
     * @returns {boolean}
     */
    enqueue_voice(target_frame, identity, model, frequency, velocity, duration_seconds, param_a, param_b, attack_seconds, release_seconds, vibrato_depth, vibrato_rate) {
        const ret = wasm.dspengine_enqueue_voice(this.__wbg_ptr, target_frame, identity, model, frequency, velocity, duration_seconds, param_a, param_b, attack_seconds, release_seconds, vibrato_depth, vibrato_rate);
        return ret !== 0;
    }
    /**
     * @param {number} sample_rate
     * @param {number} max_voices
     * @param {number} seed
     */
    constructor(sample_rate, max_voices, seed) {
        const ret = wasm.dspengine_new(sample_rate, max_voices, seed);
        this.__wbg_ptr = ret;
        DspEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Runs a short deterministic note for browser smoke tests. This is never
     * called from the normal realtime path.
     * @returns {number}
     */
    probe_peak() {
        const ret = wasm.dspengine_probe_peak(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} frames
     * @param {Float32Array} destination
     */
    process(frames, destination) {
        wasm.dspengine_process(this.__wbg_ptr, frames, destination);
    }
    /**
     * @returns {number}
     */
    queued_events() {
        const ret = wasm.dspengine_queued_events(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} count
     */
    set_max_voices(count) {
        wasm.dspengine_set_max_voices(this.__wbg_ptr, count);
    }
    /**
     * @param {number} seed
     */
    set_seed(seed) {
        wasm.dspengine_set_seed(this.__wbg_ptr, seed);
    }
    /**
     * @param {number} slot
     * @param {Float32Array} ratios
     * @param {Float32Array} gains
     */
    set_spectrum(slot, ratios, gains) {
        wasm.dspengine_set_spectrum(this.__wbg_ptr, slot, ratios, gains);
    }
    silence() {
        wasm.dspengine_silence(this.__wbg_ptr);
    }
}
if (Symbol.dispose) DspEngine.prototype[Symbol.dispose] = DspEngine.prototype.free;

/**
 * @returns {number}
 */
export function abi_version() {
    const ret = wasm.abi_version();
    return ret >>> 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_get_index_80f1c5f53c2f2974: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_length_1009454859bb3e03: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_set_577f5f7485b6744e: function(arg0, arg1, arg2) {
            arg0.set(getArrayF32FromWasm0(arg1, arg2));
        },
        __wbg_subarray_095365bb46f94afd: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
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
        "./dsp_core_bg.js": import0,
    };
}

const DspEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_dspengine_free(ptr, 1));

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
        module_or_path = new URL('dsp_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
