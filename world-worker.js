import init, { WorldCore } from "./wasm/world/world_core.js";

let world = null;
let wasm = null;
let stepCount = 0;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      wasm = await init();
      world = new WorldCore(data.period, data.seed, data.motes, data.grazers, data.predators, data.fireflies);
      world.retune(data.grazerCap, data.predatorCap, data.predatorDormant,
        data.moteSpeed, data.grazerSpeed, data.predatorSpeed, data.fireflySpeed,
        data.turn, data.curiosity);        // retune, not configure: configure moves them
      if (data.water) world.set_water(new Uint8Array(data.water));   // where grazers have to wade
      if (data.solid) world.set_solid(new Uint8Array(data.solid));   // what every body has to go around
      stepCount = 0;
      self.postMessage({ type: "ready" });
      publish(true);
    } else if (data.type === "configure" && world) {
      world.retune(data.grazerCap, data.predatorCap, data.predatorDormant,
        data.moteSpeed, data.grazerSpeed, data.predatorSpeed, data.fireflySpeed,
        data.turn, data.curiosity);        // retune, not configure: configure moves them
      world.set_population(0, data.motes);            // the skin's atmosphere, counted up or down
      world.set_population(3, data.fireflies);        // the creatures keep their places
      publish(true);
    } else if (data.type === "solid" && world) {
      world.set_solid(data.mask ? new Uint8Array(data.mask) : new Uint8Array(0));   // the visitor built or cleared something
    } else if (data.type === "step" && world) {
      const started = performance.now();
      world.step(data.dt, data.playerX, data.playerY);
      publish((stepCount++ % 20) === 0, data.recycle, performance.now() - started);
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String(error && error.stack || error) });
  }
};

function publish(includeFlora, recycled, stepMs = 0) {
  const length = world.render_len();
  const byteLength = length * Float32Array.BYTES_PER_ELEMENT;
  const buffer = recycled && recycled.byteLength === byteLength ? recycled : new ArrayBuffer(byteLength);
  const entities = new Float32Array(buffer);
  entities.set(new Float32Array(wasm.memory.buffer, world.render_ptr(), length));
  const message = {
    type: "snapshot",
    entities: entities.buffer,
    populations: [world.population(0), world.population(1), world.population(2), world.population(3)],
    stepMs,
  };
  const transfers = [entities.buffer];
  if (includeFlora) {
    const flora = world.flora_snapshot();
    message.flora = flora.buffer;
    transfers.push(flora.buffer);
  }
  self.postMessage(message, transfers);
}
