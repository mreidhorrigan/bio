// public/studio/engines/openwind-stream.js
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var textAt = (buffer, at, length) => decoder.decode(new Uint8Array(buffer, at, length).slice());
function wasiImports(memory, { said = (text) => console.error(text) } = {}) {
  const view = () => new DataView(memory.buffer), BAD = 8;
  let line = "";
  return {
    clock_time_get(id, precision, out) {
      view().setBigUint64(out, BigInt(Math.round(id === 0 ? Date.now() * 1e6 : (performance.timeOrigin + performance.now()) * 1e6)), true);
      return 0;
    },
    random_get(at, length) {
      for (let k = 0; k < length; k += 65536) {
        const n = Math.min(65536, length - k), bytes = crypto.getRandomValues(new Uint8Array(n));
        new Uint8Array(memory.buffer, at + k, n).set(bytes);
      }
      return 0;
    },
    environ_sizes_get(count, size) {
      view().setUint32(count, 0, true);
      view().setUint32(size, 0, true);
      return 0;
    },
    environ_get() {
      return 0;
    },
    fd_write(fd, iovs, n, written) {
      let total = 0;
      for (let k = 0; k < n; k++) {
        const at = view().getUint32(iovs + 8 * k, true), length = view().getUint32(iovs + 8 * k + 4, true);
        line += textAt(memory.buffer, at, length);
        total += length;
      }
      for (let newline; (newline = line.indexOf("\n")) >= 0; line = line.slice(newline + 1)) if (fd === 1 || fd === 2) said(line.slice(0, newline));
      view().setUint32(written, total, true);
      return 0;
    },
    fd_close: () => BAD,
    fd_fdstat_get: () => BAD,
    fd_filestat_get: () => BAD,
    fd_prestat_get: () => BAD,
    fd_prestat_dir_name: () => BAD,
    fd_read: () => BAD,
    path_open: () => BAD,
    proc_exit(code) {
      throw new Error(`the winds' engine exited (${code})`);
    },
    sched_yield: () => 0
  };
}
var SLOT = 4;
var IDLE = 0;
var ASKED = 1;
var RUNNING = 2;
var END = 3;
var CLAIMED = 4;
var THREAD_STATES = Object.freeze({ SLOT, IDLE, ASKED, RUNNING, END, CLAIMED });
var SILENT = 2 ** -23;

// public/studio/engines/openwind-thread.js
var { IDLE: IDLE2, ASKED: ASKED2, RUNNING: RUNNING2, END: END2 } = THREAD_STATES;
self.onmessage = async ({ data: { module, memory, control, slot, SLOT: SLOT2 } }) => {
  let instance;
  try {
    instance = await WebAssembly.instantiate(module, {
      env: { memory },
      wasi_snapshot_preview1: wasiImports(memory, { said: (text) => self.postMessage({ said: text }) }),
      // (A thread spawns none of its own: the engine's main thread spawns them all.)
      wasi: { "thread-spawn": () => -1 }
    });
  } catch (error) {
    self.postMessage({ error: error.message });
    return;
  }
  self.postMessage("ready");
  const at = slot * SLOT2;
  for (; ; ) {
    const state = Atomics.load(control, at);
    if (state === END2) break;
    if (state !== ASKED2) {
      Atomics.wait(control, at, state);
      continue;
    }
    Atomics.store(control, at, RUNNING2);
    try {
      instance.exports.wasi_thread_start(Atomics.load(control, at + 1), Atomics.load(control, at + 2));
    } catch (error) {
      self.postMessage({ said: `a core of the winds' engine stopped: ${error.message}` });
    }
    Atomics.compareExchange(control, at, RUNNING2, IDLE2);
  }
  self.close?.();
};
