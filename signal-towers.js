(() => {
  // public/meter.js
  (function(root, factory) {
    root.MusebotMeter = factory();
  })(globalThis, () => {
    const integer = (value, fallback, min = 1, max = 4096) => {
      const number = Number(value);
      return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
    };
    function defaultGrouping2(n) {
      if (n === 1) return [1];
      const groups = [], threes = Math.floor(n / 3), remainder = n % 3;
      if (remainder === 1) {
        for (let i = 0; i < threes - 1; i++) groups.push(3);
        groups.push(2, 2);
      } else {
        for (let i = 0; i < threes; i++) groups.push(3);
        if (remainder === 2) groups.push(2);
      }
      return groups;
    }
    function normalizeRhythm(value, steps) {
      const source = value && typeof value === "object" ? value : {}, hits = source.hits === "" || source.hits == null ? null : integer(source.hits, null, 0, steps), rotation = Number.isInteger(Number(source.rotation)) ? Number(source.rotation) : 0, clave = Array.isArray(source.clave) ? [...new Set(source.clave.map(Number).filter(Number.isInteger).map((item) => (item % steps + steps) % steps))].sort((a, b) => a - b) : [];
      return { hits, rotation, clave };
    }
    function normalizeMeter(value = {}) {
      const numerator = integer(value.numerator, 4), denominator = integer(value.denominator, 4), subdivision = integer(value.subdivision, 4, 1, 96), phraseBars = integer(value.phraseBars, 4, 1, 1024);
      let groups = Array.isArray(value.groups) ? value.groups.map((item) => integer(item, 0)).filter(Boolean) : [];
      if (!groups.length || groups.reduce((sum, item) => sum + item, 0) !== numerator) groups = defaultGrouping2(numerator);
      const pulsesPerBar = numerator * subdivision;
      return { numerator, denominator, groups, subdivision, phraseBars, rhythm: normalizeRhythm(value.rhythm, pulsesPerBar), label: value.label || `${groups.join("+")}/${denominator}`, pulsesPerBar };
    }
    function parseMeter(signature, groups = "", subdivision = 4, phraseBars = 4) {
      const match = String(signature).trim().match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!match) throw new Error("Time signature must look like 7/8");
      const supplied = String(groups).trim(), parsed = supplied ? supplied.split(/[+,\s]+/).map(Number) : [];
      const meter = normalizeMeter({ numerator: Number(match[1]), denominator: Number(match[2]), groups: parsed, subdivision: Number(subdivision), phraseBars: Number(phraseBars) });
      if (supplied && meter.groups.join(",") !== parsed.join(",")) throw new Error("Positive additive groups must sum to the numerator");
      return meter;
    }
    function clockContext(state2) {
      const meter = state2.meter, tickInBar = state2.tickInBar, beat = Math.floor(tickInBar / meter.subdivision), groupStarts = [], groups = meter.groups;
      let total = 0;
      for (const size of groups) {
        groupStarts.push(total);
        total += size;
      }
      let group = 0;
      while (group + 1 < groupStarts.length && beat >= groupStarts[group + 1]) group++;
      return { tick: state2.tick, bpm: state2.bpm, meter, bar: state2.bar, phrase: Math.floor(state2.bar / meter.phraseBars), tickInBar, beat, subdivision: tickInBar % meter.subdivision, group, groupBeat: beat - groupStarts[group], barStart: tickInBar === 0, beatStart: tickInBar % meter.subdivision === 0, groupStart: tickInBar === groupStarts[group] * meter.subdivision, phraseStart: tickInBar === 0 && state2.bar % meter.phraseBars === 0 };
    }
    return { normalizeMeter, parseMeter, clockContext, defaultGrouping: defaultGrouping2 };
  });

  // public/random-source.js
  function hashSeed(value) {
    const text = String(value), numeric = Number(text);
    if (text.trim() !== "" && Number.isFinite(numeric)) return numeric >>> 0;
    let hash = 2166136261;
    for (const character of text) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function freshSeed() {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0];
    }
    return (Date.now() ^ Math.trunc(globalThis.performance?.now?.() || 0)) >>> 0;
  }
  var seed = freshSeed();
  var state = seed || 1831565813;
  function configureRandomSeed(value = freshSeed()) {
    seed = hashSeed(value);
    state = seed || 1831565813;
    return seed;
  }
  function random() {
    state = state + 1831565813 >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  // public/stochastic-algorithms.js
  var unitRandom = (rng = random) => Math.floor(rng() * 32768) / 32767;
  var decide = (rng = random) => unitRandom(rng) >= 0.5;
  function randomInt(max, rng = random) {
    return Math.min(max - 1, Math.floor(unitRandom(rng) * max));
  }
  function weightedChoice(values, weights, rng = random) {
    const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
    if (!values.length || values.length !== weights.length || sum <= 0) return values[0];
    let chosen = unitRandom(rng) * sum;
    for (let i = 0; i < values.length; i++) {
      chosen -= Math.max(0, weights[i]);
      if (chosen <= 0) return values[i];
    }
    return values.at(-1);
  }
  function boundedDrunk(value, range, step, rng = random) {
    const movement = randomInt(Math.abs(step) * 2 + 1, rng) - Math.abs(step);
    return Math.max(0, Math.min(range - 1, value + movement));
  }
  function scramble(values, rng = random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(i + 1, rng);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function additiveGroupStarts(groups, total) {
    const starts = [], limit = Math.max(1, Math.trunc(Number(total) || 1));
    let position = 0;
    for (const group of groups.map(Number).filter((value) => Number.isInteger(value) && value > 0)) {
      if (position >= limit) break;
      starts.push(position);
      position += group;
    }
    return position === limit ? starts : [];
  }
  function euclideanDistance(a, b) {
    const length = Math.min(a.length, b.length);
    if (!length) return Infinity;
    let sum = 0;
    for (let index = 0; index < length; index++) {
      const difference = Number(a[index]) - Number(b[index]);
      if (!Number.isFinite(difference)) return Infinity;
      sum += difference * difference;
    }
    return Math.sqrt(sum);
  }
  function nearestRecords(records, target, limit = 10, distance = euclideanDistance) {
    return records.map((record, index) => ({ index, record, distance: distance(record, target) })).filter((item) => Number.isFinite(item.distance)).sort((a, b) => a.distance - b.distance || a.index - b.index).slice(0, Math.max(0, Math.trunc(limit)));
  }
  function exponentialRankIndex(length, base = 20, rng = random) {
    const count = Math.max(1, Math.trunc(length)), unit = unitRandom(rng), curved = (Math.exp(unit * Math.log(base)) - 1) / (base - 1);
    return Math.min(count - 1, Math.floor(curved * count));
  }
  function randomDupleOnsets(steps, rng = random) {
    const limit = Math.max(1, Math.trunc(Number(steps) || 1)), onsets = [];
    let position = 0;
    while (position < limit) {
      position += decide(rng) ? 2 : 1;
      if (position < limit) onsets.push(position);
    }
    return scramble(onsets, rng);
  }
  function interpolateControlPoints(points, position, eased = true) {
    if (!points.length) return 0;
    if (points.length === 1) return Number(points[0]) || 0;
    const normalized = Math.max(0, Math.min(1, Number(position) || 0)), scaled = normalized * (points.length - 1), index = Math.min(points.length - 2, Math.floor(scaled)), fraction = scaled - index, mix = eased ? fraction * fraction * (3 - 2 * fraction) : fraction, a = Number(points[index]) || 0, b = Number(points[index + 1]) || 0;
    return a + (b - a) * mix;
  }
  function interpolateCurvePoints(points, position) {
    if (!points.length) return 0;
    const x = Math.max(0, Math.min(1, Number(position) || 0)), ordered = [...points].sort((a2, b2) => a2.x - b2.x);
    if (x <= ordered[0].x) return ordered[0].y;
    if (x >= ordered.at(-1).x) return ordered.at(-1).y;
    const right = ordered.findIndex((point) => point.x >= x), a = ordered[right - 1], b = ordered[right], fraction = (x - a.x) / Math.max(Number.EPSILON, b.x - a.x), mix = fraction * fraction * (3 - 2 * fraction);
    return a.y + (b.y - a.y) * mix;
  }
  function randomFivePointCurve({ xRanges = [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], terminalWeights = [0.8, 0.1, 0.1] } = {}, rng = random) {
    const terminal = weightedChoice(["random", "zero", "one"], terminalWeights, rng), xs = [0, ...xRanges.map(([low, high]) => low + rng() * (high - low)), 1], ys = Array.from({ length: 5 }, () => unitRandom(rng));
    if (terminal === "zero") ys[4] = 0;
    else if (terminal === "one") ys[4] = 1;
    return xs.map((x, index) => ({ x, y: ys[index] }));
  }
  function randomProductGate(value, leftRange = [500, 1e3], rightRange = [0, 500], rng = random) {
    const [a, b] = leftRange, [c, d] = rightRange, left = Math.floor(a + rng() * (b - a)), right = Math.floor(c + rng() * (d - c));
    return left * Number(value) > right;
  }
  function gaussianRandom(rng = random) {
    let u = 0, v = 0;
    while (u <= Number.EPSILON) u = rng();
    while (v <= Number.EPSILON) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function defaultGrouping(numerator) {
    const n = Math.max(1, Math.trunc(Number(numerator) || 1));
    if (n === 1) return [1];
    const groups = [], threes = Math.floor(n / 3), remainder = n % 3;
    if (remainder === 1) {
      for (let i = 0; i < threes - 1; i++) groups.push(3);
      groups.push(2, 2);
    } else {
      for (let i = 0; i < threes; i++) groups.push(3);
      if (remainder === 2) groups.push(2);
    }
    return groups;
  }
  function rotateCycle(values, rotation = 0) {
    const n = values.length;
    if (!n) return [];
    const shift = (Math.trunc(rotation) % n + n) % n;
    return values.map((_, index) => values[(index - shift + n) % n]);
  }
  function neighborEvolvedCycle(values, iterations = 1, rng = random) {
    const cycle = values.map((value) => value ? 1 : 0);
    if (!cycle.length) return cycle;
    for (let pass = 0; pass < Math.max(0, Math.trunc(iterations)); pass++) {
      const next = [...cycle];
      for (let index = 0; index < cycle.length; index++) {
        if (!cycle[index]) continue;
        const previous = (index - 1 + cycle.length) % cycle.length, following = (index + 1) % cycle.length, count = cycle[previous] + cycle[following];
        if (count === 2) next[index] = 0;
        else if (count === 0) next[rng() < 0.5 ? previous : following] = 1;
        else if (rng() < 0.5) next[cycle[previous] ? following : previous] = 1;
      }
      cycle.splice(0, cycle.length, ...next);
    }
    return cycle;
  }
  function euclideanRhythm(hits, steps, rotation = 0) {
    const n = Math.max(1, Math.trunc(Number(steps) || 1)), k = Math.max(0, Math.min(n, Math.trunc(Number(hits) || 0)));
    const cycle = Array.from({ length: n }, (_, index) => Math.floor((index + 1) * k / n) !== Math.floor(index * k / n) ? 1 : 0);
    const first = cycle.indexOf(1), aligned = first > 0 ? rotateCycle(cycle, -first) : cycle;
    return rotateCycle(aligned, rotation);
  }
  function normalizeClave(value, steps) {
    const n = Math.max(1, Math.trunc(Number(steps) || 1));
    if (!Array.isArray(value) || !value.length) return [];
    if (value.length === n && value.every((item) => Number(item) === 0 || Number(item) === 1)) return value.map(Number);
    const cycle = Array(n).fill(0);
    for (const item of value) {
      const onset = Number(item);
      if (Number.isInteger(onset)) cycle[(onset % n + n) % n] = 1;
    }
    return cycle;
  }
  function cyclicPattern({ steps, hits = 0, rotation = 0, clave = [] } = {}) {
    const explicit = normalizeClave(clave, steps);
    return explicit.length ? rotateCycle(explicit, rotation) : euclideanRhythm(hits, steps, rotation);
  }
  function metricWeights(groups = [4], subdivision = 4) {
    const valid = groups.map(Number).filter((item) => Number.isInteger(item) && item > 0), sub = Math.max(1, Math.trunc(Number(subdivision) || 1)), steps = valid.reduce((a, b) => a + b, 0) * sub, weights = Array(steps).fill(1);
    let beat = 0;
    for (const size of valid) {
      for (let local = 0; local < size; local++) {
        const pulse = (beat + local) * sub;
        weights[pulse] += 2;
        if (local === 0) weights[pulse] += 2;
      }
      beat += size;
    }
    if (weights.length) weights[0] += 2;
    return weights;
  }
  function clumpedRhythm(hits, groups = [4], subdivision = 4, rotation = 0) {
    const valid = groups.map(Number).filter((value) => Number.isInteger(value) && value > 0), sub = Math.max(1, Math.trunc(Number(subdivision) || 1)), steps = valid.reduce((sum, value) => sum + value, 0) * sub, count = Math.max(0, Math.min(steps, Math.trunc(Number(hits) || 0))), starts = [];
    let beat = 0;
    for (const size of valid) {
      starts.push(beat * sub);
      beat += size;
    }
    const circularDistance = (a, b) => Math.min((a - b + steps) % steps, (b - a + steps) % steps), ranked = Array.from({ length: steps }, (_, index) => ({ index, distance: Math.min(...starts.map((start) => circularDistance(index, start))), subdivision: index % sub })).sort((a, b) => a.distance - b.distance || a.subdivision - b.subdivision || a.index - b.index), cycle = Array(steps).fill(0);
    for (const { index } of ranked.slice(0, count)) cycle[index] = 1;
    return rotateCycle(cycle, rotation);
  }
  function randomAdditiveGrouping(total, allowed = [2, 3], rng = random) {
    const target = Math.max(1, Math.trunc(Number(total) || 1)), parts = [...new Set(allowed.map(Number).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b), possible = Array(target + 1).fill(false);
    possible[0] = true;
    for (let remainder = 1; remainder <= target; remainder++) possible[remainder] = parts.some((part) => remainder >= part && possible[remainder - part]);
    if (!possible[target]) return defaultGrouping(target);
    const groups = [];
    let remaining = target;
    while (remaining) {
      const choices = parts.filter((part) => remaining >= part && possible[remaining - part]);
      const choice = choices[Math.min(choices.length - 1, Math.floor(unitRandom(rng) * choices.length))];
      groups.push(choice);
      remaining -= choice;
    }
    return groups;
  }

  // public/shared/pitch.js
  var clampPitch = (value) => {
    const pitch = Number(value);
    return Number.isFinite(pitch) ? Math.max(0, Math.min(127, pitch)) : null;
  };
  var normalizePitchPool = (values) => values.map(clampPitch).filter((value) => value !== null);
  var pitchClass = (value) => {
    const pitch = Number(value);
    return Number.isFinite(pitch) ? (pitch % 12 + 12) % 12 : null;
  };
  function mpePitch(pitch, bendRange = 48) {
    const value = clampPitch(pitch);
    if (value === null) throw new Error("Pitch must be a finite MIDI-note number");
    const range = Math.max(0.01, Math.min(96, Number(bendRange) || 48));
    const note = Math.max(0, Math.min(127, Math.round(value)));
    const bend = Math.max(0, Math.min(16383, Math.round(8192 + (value - note) / range * 8192)));
    return { pitch: value, note, bend, lsb: bend & 127, msb: bend >> 7 & 127, bendRange: range };
  }
  function bendRangeMessages(channel, bendRange = 48) {
    const range = Math.max(0.01, Math.min(96, Number(bendRange) || 48)), semitones = Math.floor(range), cents = Math.round((range - semitones) * 100);
    return [
      [176 + channel, 101, 0],
      [176 + channel, 100, 0],
      [176 + channel, 6, semitones],
      [176 + channel, 38, cents],
      [176 + channel, 101, 127],
      [176 + channel, 100, 127]
    ];
  }
  function mpeZoneMessages(zone = "lower", members = 15) {
    const master = zone === "upper" ? 15 : 0, count = Math.max(1, Math.min(15, Math.round(Number(members) || 15)));
    return [
      [176 + master, 101, 0],
      [176 + master, 100, 6],
      [176 + master, 6, count],
      [176 + master, 38, 0],
      [176 + master, 101, 127],
      [176 + master, 100, 127]
    ];
  }
  var normalizedMidi7 = (value) => Math.max(0, Math.min(127, Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 127)));
  function mpeExpressionMessages(channel, { pressure, slide, brightness } = {}) {
    const messages = [];
    const timbre = Number.isFinite(Number(slide)) ? slide : brightness;
    if (Number.isFinite(Number(timbre))) messages.push([176 + (channel & 15), 74, normalizedMidi7(timbre)]);
    if (Number.isFinite(Number(pressure))) messages.push([208 + (channel & 15), normalizedMidi7(pressure)]);
    return messages;
  }
  var MidiRouteRegistry = class {
    constructor() {
      this.routes = /* @__PURE__ */ new Map();
    }
    claim(owner, port2, channels = []) {
      this.release(owner);
      const normalized = [...new Set(channels.map(Number).filter((channel) => Number.isInteger(channel) && channel >= 0 && channel < 16))], collisions = [];
      for (const route of this.routes.values()) if (route.port === port2) {
        const overlap = normalized.filter((channel) => route.channels.includes(channel));
        if (overlap.length) collisions.push({ owner: route.owner, port: port2, channels: overlap.map((channel) => channel + 1) });
      }
      this.routes.set(owner, { owner, port: port2, channels: normalized });
      return collisions;
    }
    release(owner) {
      this.routes.delete(owner);
    }
  };
  var MpeChannelAllocator = class {
    constructor(channels = Array.from({ length: 15 }, (_, index) => index + 1)) {
      this.setChannels(channels);
    }
    setChannels(channels) {
      this.channels = [...new Set(channels.map(Number).filter((channel) => Number.isInteger(channel) && channel >= 0 && channel < 16))];
      if (!this.channels.length) this.channels = [1];
      this.active = /* @__PURE__ */ new Map();
      this.cursor = 0;
    }
    acquire(releaseAt = Infinity, at = performance.now()) {
      this.releaseExpired(at);
      const channel = this.channels.find((candidate) => !this.active.has(candidate));
      if (channel == null) return null;
      this.active.set(channel, releaseAt);
      return channel;
    }
    release(channel) {
      this.active.delete(channel);
    }
    releaseExpired(now = performance.now()) {
      for (const [channel, releaseAt] of this.active) if (releaseAt <= now) this.active.delete(channel);
    }
  };

  // public/shared/protocol-contract.js
  var ADDRESS_PATTERN = /^\/(?:broadcast|system|agent)(?:\/[A-Za-z][A-Za-z0-9_-]*)+$/;
  var LEGACY_ADDRESS_ALIASES = Object.freeze({
    "/broadcast/harmRhythm": "/broadcast/harmrhythm",
    "/broadcast/harmonicrhythm": "/broadcast/harmrhythm",
    "/broadcast/intention": "/broadcast/intent",
    "/broadcast/pitchclassPool": "/broadcast/intent/pitchclassPool",
    "/broadcast/talaStructure": "/broadcast/intent/talaStructure",
    "/broadcast/coutourA": "/broadcast/intent/contourA"
  });
  function canonicalProtocolAddress(value, { broadcastName = false } = {}) {
    let address = String(value ?? "").trim();
    if (broadcastName && !address.startsWith("/")) address = `/broadcast/${address}`;
    address = LEGACY_ADDRESS_ALIASES[address] || address;
    if (!ADDRESS_PATTERN.test(address)) throw new TypeError(`Invalid Musebot Protocol address: ${value}`);
    return address;
  }
  function normalizeProtocolMessage(message) {
    if (!message || typeof message !== "object") throw new TypeError("Musebot Protocol message must be an object");
    return { ...message, address: canonicalProtocolAddress(message.address), args: Array.isArray(message.args) ? message.args.slice() : [] };
  }

  // public/shared/planning.js
  var DISPOSITIONS = /* @__PURE__ */ new Set(["accept", "transform", "counter", "defer", "decline", "abstain"]);
  var PLAN_KINDS = /* @__PURE__ */ new Set(["harmony", "rhythm", "motif", "tuning", "form", "texture", "dynamics", "orchestration", "lifecycle", "composite"]);
  var MAX_PARENTS = 16;
  var MAX_ANCESTRY_DEPTH = 8;
  var MAX_HORIZON = 4096;
  var MAX_PAYLOAD_DEPTH = 12;
  var MAX_PAYLOAD_ITEMS = 4096;
  var MAX_PAYLOAD_BYTES = 65536;
  var finiteInteger = (value, name, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < minimum || number > maximum) throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
    return number;
  };
  var boundedNumber = (value, name, minimum = 0, maximum = 1) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) throw new TypeError(`${name} must be between ${minimum} and ${maximum}`);
    return number;
  };
  var plainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  var validatePayload = (value, name = "payload") => {
    const seen = /* @__PURE__ */ new Set();
    let items = 0;
    const visit = (item, depth) => {
      if (++items > MAX_PAYLOAD_ITEMS) throw new TypeError(`${name} is too large`);
      if (depth > MAX_PAYLOAD_DEPTH) throw new TypeError(`${name} is too deeply nested`);
      if (item == null || typeof item === "string" || typeof item === "boolean") return;
      if (typeof item === "number") {
        if (!Number.isFinite(item)) throw new TypeError(`${name} contains a non-finite number`);
        return;
      }
      if (typeof item !== "object") throw new TypeError(`${name} contains an unsupported value`);
      if (seen.has(item)) throw new TypeError(`${name} cannot contain cycles`);
      seen.add(item);
      if (Array.isArray(item)) for (const child of item) visit(child, depth + 1);
      else {
        if (!plainObject(item)) throw new TypeError(`${name} must contain only plain objects`);
        for (const child of Object.values(item)) visit(child, depth + 1);
      }
      seen.delete(item);
    };
    visit(value, 0);
    if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_PAYLOAD_BYTES) throw new TypeError(`${name} exceeds ${MAX_PAYLOAD_BYTES} bytes`);
    return value;
  };
  function logicalPosition(value = {}, name = "position") {
    if (!plainObject(value)) throw new TypeError(`${name} must be an object`);
    return Object.freeze({
      bar: finiteInteger(value.bar ?? 0, `${name}.bar`),
      phrase: finiteInteger(value.phrase ?? 0, `${name}.phrase`),
      section: finiteInteger(value.section ?? 0, `${name}.section`)
    });
  }
  function compareLogicalPosition(left, right) {
    const a = logicalPosition(left), b = logicalPosition(right);
    if (a.bar !== b.bar) return a.bar - b.bar;
    if (a.bar !== 0) return 0;
    return a.phrase - b.phrase || a.section - b.section;
  }
  function validatePlan(value) {
    if (!plainObject(value)) throw new TypeError("Plan must be an object");
    const kind = String(value.kind || "");
    if (!PLAN_KINDS.has(kind)) throw new TypeError(`Unknown plan kind: ${kind}`);
    const author = String(value.author || "").trim();
    if (!author) throw new TypeError("Plan author is required");
    const revision = finiteInteger(value.revision, "plan.revision", { minimum: 1 });
    const planId = String(value.planId || "").trim();
    if (!planId) throw new TypeError("Plan ID is required");
    const parents = [...new Set((Array.isArray(value.parents) ? value.parents : []).map(String).filter(Boolean))];
    if (parents.length > MAX_PARENTS) throw new TypeError(`Plan has more than ${MAX_PARENTS} parents`);
    if (parents.includes(planId)) throw new TypeError("Plan cannot cite itself as a parent");
    const ancestryDepth = finiteInteger(value.ancestryDepth ?? 0, "plan.ancestryDepth", { maximum: MAX_ANCESTRY_DEPTH });
    const createdAt = logicalPosition(value.createdAt, "plan.createdAt"), appliesAt = logicalPosition(value.appliesAt ?? createdAt, "plan.appliesAt"), expiresAt = logicalPosition(value.expiresAt ?? { ...appliesAt, phrase: appliesAt.phrase + 1 }, "plan.expiresAt");
    if (compareLogicalPosition(appliesAt, createdAt) < 0) throw new TypeError("Plan cannot apply before it is created");
    if (compareLogicalPosition(expiresAt, appliesAt) < 0) throw new TypeError("Plan cannot expire before it applies");
    const horizon = finiteInteger(value.horizon ?? 1, "plan.horizon", { minimum: 1, maximum: MAX_HORIZON });
    if (!plainObject(value.payload)) throw new TypeError("Plan payload must be an object");
    validatePayload(value.payload, "plan.payload");
    return Object.freeze({
      version: 1,
      planId,
      author,
      revision,
      kind,
      createdAt,
      appliesAt,
      expiresAt,
      horizon,
      parents: Object.freeze(parents),
      ancestryDepth,
      payload: value.payload,
      confidence: boundedNumber(value.confidence ?? 0.5, "plan.confidence"),
      priority: boundedNumber(value.priority ?? 0.5, "plan.priority"),
      rationale: String(value.rationale ?? "").slice(0, 2048)
    });
  }
  function validatePlanResponse(value) {
    if (!plainObject(value)) throw new TypeError("Plan response must be an object");
    const planId = String(value.planId || "").trim(), responder = String(value.responder || "").trim(), disposition = String(value.disposition || "");
    if (!planId || !responder) throw new TypeError("Plan response requires planId and responder");
    if (!DISPOSITIONS.has(disposition)) throw new TypeError(`Unknown plan disposition: ${disposition}`);
    return Object.freeze({
      version: 1,
      responseId: String(value.responseId || `${planId}:${responder}:${finiteInteger(value.revision ?? 1, "response.revision", { minimum: 1 })}`),
      planId,
      planRevision: finiteInteger(value.planRevision ?? 1, "response.planRevision", { minimum: 1 }),
      responder,
      revision: finiteInteger(value.revision ?? 1, "response.revision", { minimum: 1 }),
      disposition,
      createdAt: logicalPosition(value.createdAt, "response.createdAt"),
      payload: plainObject(value.payload) ? validatePayload(value.payload, "response.payload") : {},
      rationale: String(value.rationale ?? "").slice(0, 2048)
    });
  }
  var PlanCoordinator = class {
    constructor(author = "local", { seenLimit = 512 } = {}) {
      this.author = String(author);
      this.seenLimit = Math.max(32, seenLimit);
      this.revisions = /* @__PURE__ */ new Map();
      this.responseRevisions = /* @__PURE__ */ new Map();
      this.seenPlans = /* @__PURE__ */ new Map();
      this.seenResponses = /* @__PURE__ */ new Map();
    }
    setAuthor(author) {
      this.author = String(author || this.author);
      return this.author;
    }
    nextRevision(kind) {
      const revision = (this.revisions.get(kind) || 0) + 1;
      this.revisions.set(kind, revision);
      return revision;
    }
    create(kind, payload, { createdAt = {}, appliesAt = createdAt, expiresAt, horizon = 1, parents = [], parentDepth = 0, confidence = 0.5, priority = 0.5, rationale = "" } = {}) {
      const revision = this.nextRevision(kind), author = this.author, planId = `${author}:${kind}:${revision}`;
      return validatePlan({ planId, author, revision, kind, createdAt, appliesAt, expiresAt: expiresAt ?? { ...logicalPosition(appliesAt), phrase: logicalPosition(appliesAt).phrase + horizon }, horizon, parents, ancestryDepth: parents.length ? parentDepth + 1 : 0, payload, confidence, priority, rationale });
    }
    revise(plan, payload = plan.payload, { createdAt = plan.createdAt, appliesAt = plan.appliesAt, expiresAt = plan.expiresAt, horizon = plan.horizon, parents = plan.parents, parentDepth = plan.ancestryDepth, confidence = plan.confidence, priority = plan.priority, rationale = plan.rationale } = {}) {
      const current = validatePlan(plan), revision = current.revision + 1;
      this.revisions.set(current.kind, Math.max(this.revisions.get(current.kind) || 0, revision));
      return validatePlan({ ...current, revision, payload, createdAt, appliesAt, expiresAt, horizon, parents, ancestryDepth: Math.min(MAX_ANCESTRY_DEPTH, parentDepth), confidence, priority, rationale });
    }
    response(plan, disposition, { createdAt = {}, payload = {}, rationale = "" } = {}) {
      const key = `${plan.planId}:${this.author}`, revision = (this.responseRevisions.get(key) || 0) + 1;
      this.responseRevisions.set(key, revision);
      return validatePlanResponse({ planId: plan.planId, planRevision: plan.revision, responder: this.author, revision, disposition, createdAt, payload, rationale });
    }
    remember(map, key, value) {
      map.set(key, value);
      while (map.size > this.seenLimit) map.delete(map.keys().next().value);
      return value;
    }
    ingest(message) {
      if (message?.address === "/broadcast/plan") {
        const plan = validatePlan(message.args?.[0]);
        if (plan.author === this.author) return { type: "self", plan };
        const key = `${plan.planId}@${plan.revision}`;
        if (this.seenPlans.has(key)) return { type: "duplicate", plan };
        this.remember(this.seenPlans, key, plan);
        return { type: "plan", plan };
      }
      if (message?.address === "/broadcast/plan/response") {
        const response = validatePlanResponse(message.args?.[0]);
        if (response.responder === this.author) return { type: "self-response", response };
        const key = `${response.responseId}@${response.revision}`;
        if (this.seenResponses.has(key)) return { type: "duplicate-response", response };
        this.remember(this.seenResponses, key, response);
        return { type: "response", response };
      }
      return null;
    }
  };
  var PLANNING_LIMITS = Object.freeze({ MAX_PARENTS, MAX_ANCESTRY_DEPTH, MAX_HORIZON, MAX_PAYLOAD_DEPTH, MAX_PAYLOAD_ITEMS, MAX_PAYLOAD_BYTES });

  // public/shared/tuning.js
  var EPSILON = 1e-9;
  var candidateCache = /* @__PURE__ */ new Map();
  var ratioToSemitones = (ratio) => 12 * Math.log2(Number(ratio));
  var octaveReduce = (value) => (Number(value) % 12 + 12) % 12;
  function primeFactors(value) {
    let number = Math.max(1, Math.trunc(value)), factor = 2, result = [];
    while (factor * factor <= number) {
      while (number % factor === 0) {
        result.push(factor);
        number /= factor;
      }
      factor++;
    }
    if (number > 1) result.push(number);
    return result;
  }
  function ratioCandidates({ oddLimit = 31 } = {}) {
    const limit = Math.max(3, Math.min(127, Math.trunc(oddLimit))), byPitch = /* @__PURE__ */ new Map();
    if (candidateCache.has(limit)) return candidateCache.get(limit);
    for (let numerator = 1; numerator <= limit; numerator++) for (let denominator = 1; denominator <= limit; denominator++) {
      let ratio = numerator / denominator;
      while (ratio < 1) ratio *= 2;
      while (ratio >= 2) ratio /= 2;
      const semitones = ratioToSemitones(ratio), key = ratio.toFixed(12);
      if (byPitch.has(key)) continue;
      const factors = [...primeFactors(numerator), ...primeFactors(denominator)], largestPrime = Math.max(1, ...factors);
      byPitch.set(key, { numerator, denominator, ratio, semitones, complexity: Math.log2(numerator * denominator), largestPrime });
    }
    const result = Object.freeze([...byPitch.values()].map(Object.freeze));
    candidateCache.set(limit, result);
    return result;
  }
  function rationalizeInterval(semitones, { purity = 1, complexity = 0.12, primeSoftness = 0.15, oddLimit = 31 } = {}) {
    const target = octaveReduce(semitones), candidates = ratioCandidates({ oddLimit });
    return candidates.reduce((best, candidate) => {
      const distance = Math.min(Math.abs(candidate.semitones - target), 12 - Math.abs(candidate.semitones - target));
      const cost = Math.max(EPSILON, purity) * distance ** 2 + Math.max(0, complexity) * candidate.complexity + Math.max(0, primeSoftness) * Math.log2(candidate.largestPrime);
      return !best || cost < best.cost ? { ...candidate, cost, distance } : best;
    }, null);
  }
  function tuningSystem({ divisions = 12, period = 12, purity = 1, complexity = 0.12, primeSoftness = 0.15, oddLimit = 31 } = {}) {
    const count = Math.max(1, Math.min(256, Math.trunc(divisions))), step = period / count;
    return Array.from({ length: count }, (_, degree) => {
      if (degree === 0) return 0;
      const nominal = degree * step, just = rationalizeInterval(nominal, { purity, complexity, primeSoftness, oddLimit });
      const attraction = Math.max(0, purity) / (Math.max(0, purity) + 1);
      return nominal + (just.semitones - nominal) * attraction;
    });
  }
  function solveSprings(notes, springs, grounding, iterations) {
    const values = notes.map((note) => note.nominal);
    for (let pass = 0; pass < iterations; pass++) for (let index = 0; index < notes.length; index++) {
      const ground = Math.max(EPSILON, grounding[notes[index].chord]), links = springs[index];
      let numerator = ground * notes[index].nominal, denominator = ground;
      for (const { other, target, weight } of links) {
        numerator += weight * (values[other] - target);
        denominator += weight;
      }
      values[index] = numerator / denominator;
    }
    return values;
  }
  function adaptiveJustIntonation(chords, { purity = 1, continuity = 0.6, grounding = 0.04, complexity = 0.12, primeSoftness = 0.15, oddLimit = 31, iterations = 240 } = {}) {
    const normalized = chords.map((chord) => (Array.isArray(chord) ? chord : []).map(Number).filter(Number.isFinite));
    const notes = [], rows = [];
    for (const [chord, row] of normalized.entries()) {
      const indices = [];
      for (const nominal of row) {
        indices.push(notes.length);
        notes.push({ nominal, chord, pitchClass: octaveReduce(nominal) });
      }
      rows.push(indices);
    }
    const springs = notes.map(() => []), vertical = Array.isArray(purity) ? purity : Array(normalized.length).fill(purity), grounds = Array.isArray(grounding) ? grounding : Array(normalized.length).fill(grounding), holds = Array.isArray(continuity) ? continuity : Array(Math.max(0, normalized.length - 1)).fill(continuity);
    if (vertical.length !== normalized.length || grounds.length !== normalized.length || holds.length !== Math.max(0, normalized.length - 1)) throw new TypeError("Tuning weight arrays must match chord/transition counts");
    for (const [chord, indices] of rows.entries()) {
      const root = notes[indices[0]]?.nominal ?? 0, targets = new Map(indices.map((index) => [index, rationalizeInterval(notes[index].nominal - root, { purity: vertical[chord], complexity, primeSoftness, oddLimit }).semitones]));
      for (const left of indices) for (const right of indices) if (left !== right) {
        let target = targets.get(right) - targets.get(left);
        const nominalDifference = notes[right].nominal - notes[left].nominal;
        target += 12 * Math.round((nominalDifference - target) / 12);
        springs[left].push({ other: right, target, weight: Math.max(EPSILON, vertical[chord]) });
      }
    }
    for (let chord = 1; chord < rows.length; chord++) for (const left of rows[chord - 1]) for (const right of rows[chord]) {
      const difference = octaveReduce(notes[left].pitchClass - notes[right].pitchClass);
      if (Math.min(difference, 12 - difference) < 0.01) {
        const target = notes[right].nominal - notes[left].nominal, weight = Math.max(0, holds[chord - 1]);
        springs[left].push({ other: right, target, weight });
        springs[right].push({ other: left, target: -target, weight });
      }
    }
    const solved = solveSprings(notes, springs, grounds.map((value) => Math.max(EPSILON, Number(value))), Math.max(1, Math.min(2e3, Math.trunc(iterations))));
    return rows.map((indices) => indices.map((index) => solved[index]));
  }
  function paletteRatio(interval, ratios) {
    const degree = Math.round(octaveReduce(interval)), pair = ratios?.[degree];
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((value) => Number.isFinite(Number(value)) && Number(value) > 0)) return null;
    return { numerator: Number(pair[0]), denominator: Number(pair[1]), ratio: Number(pair[0]) / Number(pair[1]), semitones: ratioToSemitones(Number(pair[0]) / Number(pair[1])) };
  }
  function exactChordJustIntonation(chords, { exactness = 1, complexity = 0.02, primeSoftness = 0.03, oddLimit = 15, ratios = null } = {}) {
    const blend = Math.max(0, Math.min(1, Number(exactness)));
    return chords.map((chord) => {
      const notes = (Array.isArray(chord) ? chord : []).map(Number).filter(Number.isFinite), root = notes[0] ?? 0;
      return notes.map((note) => {
        const nominal = note - root, target = (paletteRatio(nominal, ratios) || rationalizeInterval(nominal, { purity: 100, complexity, primeSoftness, oddLimit })).semitones;
        let octaveTarget = target + 12 * Math.round((nominal - target) / 12);
        return root + nominal + (octaveTarget - nominal) * blend;
      });
    });
  }
  function chordRatioProvenance(chords, { purity = 1, complexity = 0.12, primeSoftness = 0.15, oddLimit = 31, ratios = null } = {}) {
    return chords.map((chord) => {
      const notes = (Array.isArray(chord) ? chord : []).map(Number).filter(Number.isFinite), root = notes[0] ?? 0;
      return notes.map((note) => {
        const target = paletteRatio(note - root, ratios) || rationalizeInterval(note - root, { purity, complexity, primeSoftness, oddLimit });
        return Object.freeze({ numerator: target.numerator, denominator: target.denominator, ratio: target.ratio, offset: target.semitones });
      });
    });
  }
  function validateTuningPayload(value) {
    if (!value || typeof value !== "object") throw new TypeError("Tuning payload must be an object");
    const system = (Array.isArray(value.system) ? value.system : []).map(Number);
    if (!system.length || system.some((item) => !Number.isFinite(item))) throw new TypeError("Tuning payload requires a floating-point system array");
    const period = Number(value.period ?? 12);
    if (!Number.isFinite(period) || period <= 0) throw new TypeError("Tuning period must be positive");
    const chords = (Array.isArray(value.chords) ? value.chords : []).map((chord) => {
      if (!Array.isArray(chord)) throw new TypeError("Each tuned chord must be an array");
      return chord.map(Number);
    });
    if (chords.some((chord) => !chord.length || chord.some((item) => !Number.isFinite(item)))) throw new TypeError("Tuned chords must contain finite pitches");
    const nominalChords = (Array.isArray(value.nominalChords) ? value.nominalChords : []).map((chord) => {
      if (!Array.isArray(chord)) throw new TypeError("Each nominal chord must be an array");
      return chord.map(Number);
    });
    if (nominalChords.some((chord) => !chord.length || chord.some((item) => !Number.isFinite(item))) || nominalChords.length && nominalChords.length !== chords.length) throw new TypeError("Nominal and tuned chord lists must align");
    if (nominalChords.some((chord, index) => chord.length !== chords[index].length)) throw new TypeError("Each nominal and tuned chord must have the same voice count");
    const durations = (Array.isArray(value.durations) ? value.durations : []).map(Number);
    if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) throw new TypeError("Tuning chord durations must be positive");
    const chordReferencePitches = (Array.isArray(value.chordReferencePitches) ? value.chordReferencePitches : []).map(Number);
    if (chordReferencePitches.some((pitch) => !Number.isFinite(pitch)) || chordReferencePitches.length && chordReferencePitches.length !== chords.length) throw new TypeError("Chord reference pitches must align with tuned chords");
    return Object.freeze({ ...value, system: Object.freeze(system), period, chords: Object.freeze(chords.map(Object.freeze)), nominalChords: Object.freeze(nominalChords.map(Object.freeze)), durations: Object.freeze(durations), chordReferencePitches: Object.freeze(chordReferencePitches) });
  }
  function applyTuningSystem(pitch, payload, chordIndex = null) {
    const tuning = validateTuningPayload(payload), value = Number(pitch);
    if (!Number.isFinite(value)) return pitch;
    if (Number.isInteger(chordIndex) && tuning.nominalChords.length) {
      const nominal = tuning.nominalChords[(chordIndex % tuning.nominalChords.length + tuning.nominalChords.length) % tuning.nominalChords.length], realized = tuning.chords[(chordIndex % tuning.chords.length + tuning.chords.length) % tuning.chords.length];
      let best = null;
      for (let index = 0; index < nominal.length; index++) {
        const octave = Math.round((value - nominal[index]) / tuning.period), source = nominal[index] + octave * tuning.period, distance = Math.abs(value - source);
        if (!best || distance < best.distance) best = { distance, value: realized[index] + octave * tuning.period };
      }
      if (best && best.distance < 0.51) return best.value;
    }
    const reference = tuning.chordReferencePitches.length && Number.isInteger(chordIndex) ? tuning.chordReferencePitches[(chordIndex % tuning.chordReferencePitches.length + tuning.chordReferencePitches.length) % tuning.chordReferencePitches.length] : Number(tuning.referencePitch ?? 60), divisions = tuning.system.length, relative = value - reference, periods = Math.floor(relative / tuning.period), within = relative - periods * tuning.period, degree = Math.round(within / tuning.period * divisions) % divisions;
    return reference + periods * tuning.period + tuning.system[degree];
  }

  // public/shared/intentions.js
  var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function normalizeActivityMask(values, length = 16) {
    const input = Array.isArray(values) ? values : String(values ?? "").split("_");
    return Array.from({ length }, (_, index) => clamp(Number.isFinite(Number(input[index])) ? Math.round(Number(input[index])) : 0, 0, 9));
  }
  function complementaryActivityMask(masks, length = 16) {
    const cumulative = Array(length).fill(0);
    for (const mask of masks) {
      const normalized = normalizeActivityMask(mask, length);
      for (let index = 0; index < length; index++) cumulative[index] = clamp(cumulative[index] + normalized[index], 0, 9);
    }
    return cumulative.map((value) => 9 - value);
  }
  function residualActivityMask(desired, masks, length = 16) {
    const target = normalizeActivityMask(desired, length);
    if (!masks.length) return target;
    const normalized = masks.map((mask) => normalizeActivityMask(mask, length));
    return target.map((value, index) => clamp(Math.round(value - normalized.reduce((sum, mask) => sum + mask[index], 0) / normalized.length), 0, 9));
  }
  function normalizeRepetitionStructure(values, length = 4) {
    const input = Array.isArray(values) ? values : String(values ?? "").split("_");
    return Array.from({ length }, (_, index) => String(input[index] ?? String.fromCharCode(65 + index)).slice(0, 16));
  }
  function normalizeTalaStructure(values, total = null) {
    const input = (Array.isArray(values) ? values : String(values ?? "").split("_")).map(Number).filter((value) => Number.isInteger(value) && value > 0);
    return total == null || input.reduce((sum, value) => sum + value, 0) === total ? input : [];
  }
  function normalizePitchclassPool(values) {
    const input = Array.isArray(values) ? values : String(values ?? "").split("_");
    return [...new Set(input.map(pitchClass).filter((value) => value !== null))];
  }
  function normalizeContour(values, length = 8) {
    const input = Array.isArray(values) ? values : String(values ?? "").replace(/^"|"$/g, "").split("_");
    return Array.from({ length }, (_, index) => String(input[index] ?? (index < length / 2 ? "U" : "D")).toUpperCase() === "U" ? "U" : "D");
  }
  function parseCompoundIntent(message) {
    if (message?.address !== "/broadcast/intent") return null;
    const args = [...message.args || []];
    if (args[0] === "/intent") args.shift();
    const sender = String(args.shift() ?? ""), fields = {};
    for (const argument of args) {
      const [name, ...parts] = String(argument).split("=");
      if (name && parts.length) fields[name] = parts.join("=");
    }
    return { sender, fields, activityMask: fields.activityMask == null ? null : normalizeActivityMask(fields.activityMask), pitchclassPool: fields.pitchclassPool == null ? null : normalizePitchclassPool(fields.pitchclassPool), repetitionStructure: fields.repetitionStructure == null ? null : normalizeRepetitionStructure(fields.repetitionStructure), talaStructure: fields.talaStructure == null ? null : normalizeTalaStructure(fields.talaStructure), contourA: fields.contourA == null ? null : normalizeContour(fields.contourA), iFollow: fields.iFollow == null ? null : String(fields.iFollow), synchro: fields.synchro == null ? null : Number(fields.synchro) };
  }
  function serializeCompoundIntent(sender, activityMask, pitchclassPool) {
    return [sender, `activityMask=${normalizeActivityMask(activityMask).join("_")}`, `pitchclassPool=${normalizePitchclassPool(pitchclassPool).join("_")}`];
  }
  function serializeIntentFields(sender, fields) {
    return [sender, ...Object.entries(fields).filter(([, value]) => value != null).map(([name, value]) => `${name}=${(Array.isArray(value) ? value : [value]).join("_")}`)];
  }
  function cycleIndexAtPhrasePosition(clock, length = 16) {
    const beatsPerBar = clock.meter.numerator, bars = clock.meter.phraseBars || 4, beatProgress = clock.bar % bars * beatsPerBar + clock.beat + (clock.subdivision || 0) / clock.meter.subdivision, total = beatsPerBar * bars;
    return Math.max(0, Math.min(length - 1, Math.floor(beatProgress / total * length)));
  }

  // public/shared/motifs.js
  var MAX_EVENTS = 256;
  var MAX_MOTIFS = 256;
  var finite = (value) => Number.isFinite(Number(value));
  var round = (value, places = 6) => Number(Number(value).toFixed(places));
  function motifFingerprint(events) {
    const notes = events.flatMap((event) => Array.isArray(event.pitches) ? event.pitches : [event.pitch]).map(Number).filter(Number.isFinite), onsets = events.map((event) => Number(event.at)).filter(Number.isFinite), durations = events.map((event) => Number(event.duration) || 0);
    const intervals = notes.slice(1).map((note, index) => round(note - notes[index])), span = Math.max(1e-9, (onsets.at(-1) ?? 0) - (onsets[0] ?? 0));
    return { intervals, onsetRatios: onsets.map((onset) => round((onset - (onsets[0] ?? 0)) / span)), durationRatios: durations.map((duration) => round(duration / span)), contour: intervals.map((value) => Math.sign(value)) };
  }
  function validateMotif(value) {
    if (!value || typeof value !== "object" || !String(value.motifId || "")) throw new TypeError("Motif requires motifId");
    const events = (Array.isArray(value.events) ? value.events : []).slice(0, MAX_EVENTS).map((event) => {
      const pitches = (Array.isArray(event.pitches) ? event.pitches : [event.pitch]).map(Number).filter(Number.isFinite);
      if (!pitches.length || !finite(event.at)) throw new TypeError("Motif events require finite onset and pitch");
      return { at: Number(event.at), duration: Math.max(0, Number(event.duration) || 0), pitches, velocity: Math.max(0, Math.min(1, Number(event.velocity) || 0.65)) };
    });
    if (!events.length) throw new TypeError("Motif requires musical events");
    return Object.freeze({ ...value, events: Object.freeze(events.map(Object.freeze)), fingerprint: Object.freeze(value.fingerprint || motifFingerprint(events)) });
  }
  function transformMotif(motif, { transpose = 0, timeScale = 1, invert = false, retrograde = false } = {}) {
    const source = validateMotif(motif), anchor = source.events[0].pitches[0], end = Math.max(...source.events.map((event) => event.at)), events = source.events.map((event) => ({ ...event, at: (retrograde ? end - event.at : event.at) * timeScale, duration: event.duration * timeScale, pitches: event.pitches.map((pitch) => anchor + (invert ? anchor - pitch : pitch - anchor) + Number(transpose)) })).sort((a, b) => a.at - b.at);
    return { ...source, motifId: `${source.motifId}:development`, parentMotifId: source.motifId, events, fingerprint: motifFingerprint(events), transformation: { transpose, timeScale, invert, retrograde } };
  }
  var MotifMemory = class {
    constructor(limit = MAX_MOTIFS) {
      this.limit = Math.max(1, Math.trunc(limit));
      this.motifs = /* @__PURE__ */ new Map();
    }
    remember(value) {
      const motif = validateMotif(value);
      this.motifs.delete(motif.motifId);
      this.motifs.set(motif.motifId, motif);
      while (this.motifs.size > this.limit) this.motifs.delete(this.motifs.keys().next().value);
      return motif;
    }
    get(id) {
      return this.motifs.get(id);
    }
    recent(limit = 16) {
      return [...this.motifs.values()].slice(-limit);
    }
    matching({ intervals, contour } = {}) {
      return this.recent(this.limit).filter((motif) => (!intervals || JSON.stringify(motif.fingerprint.intervals) === JSON.stringify(intervals)) && (!contour || JSON.stringify(motif.fingerprint.contour) === JSON.stringify(contour)));
    }
  };
  function queryMotifs(memory, { motifId, author, tags, contour, intervals, limit = 8 } = {}) {
    const requestedTags = (Array.isArray(tags) ? tags : tags ? [tags] : []).map(String);
    return memory.recent(memory.limit).filter(
      (motif) => (!motifId || motif.motifId === String(motifId)) && (!author || motif.author === String(author)) && (!requestedTags.length || requestedTags.every((tag) => (motif.tags || []).includes(tag))) && (!contour || JSON.stringify(motif.fingerprint.contour) === JSON.stringify(contour)) && (!intervals || JSON.stringify(motif.fingerprint.intervals) === JSON.stringify(intervals))
    ).slice(-Math.max(1, Math.min(32, Math.trunc(Number(limit) || 8))));
  }

  // public/expression-config.js
  var EXPRESSION_CONFIG = Object.freeze({
    pressure: {
      base: 0.28,
      velocityScale: 0.5,
      attackRatio: 0.72,
      sustainGrowth: 0.2,
      releaseRatio: 0.78,
      longReleaseReduction: 0.18
    },
    slide: {
      base: 0.72,
      registerReduction: 0.3,
      velocityScale: 0.12,
      longRise: 0.12,
      highRegisterLongReduction: 0.2,
      longReleaseReduction: 0.1
    },
    vibrato: {
      depthBase: 0.025,
      pressureScale: 0.08,
      rateBase: 4.3,
      registerRateScale: 1.8,
      maximumDepth: 0.5,
      maximumRate: 12
    },
    pitchDrift: { rise: 0.018, fall: -0.012, maximumSemitones: 12 },
    envelope: {
      shortAttack: 6e-3,
      maximumAttack: 0.08,
      attackDurationScale: 0.025,
      softAttackScale: 0.06,
      shortRelease: 0.025,
      maximumRelease: 0.65,
      releaseDurationScale: 0.08,
      longReleaseScale: 0.18
    },
    sustained: { minimumSeconds: 0.45, fullExpressionSeconds: 3 },
    velocityVariation: {
      phraseFloor: 0.92,
      phraseArch: 0.12,
      phraseAccent: 1.1,
      barAccent: 1.06,
      groupAccent: 1.035,
      beatAccent: 1,
      subdivisionScale: 0.91,
      deterministicDepth: 0.075,
      minimum: 0.04
    },
    mixPlacement: {
      minimum: -1,
      maximum: 1,
      backgroundVelocityScale: 0.58,
      foregroundVelocityScale: 1.22
    },
    webAudio: {
      gainPressureFloor: 0.45,
      gainPressureScale: 0.75,
      filterBaseHz: 220,
      filterFundamentalFloor: 2.2,
      filterExpressionRange: 16,
      brightWaveQ: 1.1,
      softWaveQ: 0.55
    },
    // Profiles are continuous biases layered over each bot's own velocity and duration.
    // They never replace source articulation, quantize pitch, or create separate modes.
    profiles: {
      neutral: {
        velocityScale: 1,
        velocityBias: 0,
        pressureBias: 0,
        slideBias: 0,
        vibratoScale: 1,
        attackScale: 1,
        releaseScale: 1,
        motionScale: 1
      },
      bass: {
        velocityScale: 0.94,
        velocityBias: 0.04,
        pressureBias: 0.08,
        slideBias: -0.18,
        vibratoScale: 0.35,
        attackScale: 0.72,
        releaseScale: 0.68,
        motionScale: 0.45
      },
      pluck: {
        velocityScale: 1.04,
        velocityBias: 0.03,
        pressureBias: 0.08,
        slideBias: 0.08,
        vibratoScale: 0.18,
        attackScale: 0.42,
        releaseScale: 0.45,
        motionScale: 0.22
      },
      lead: {
        velocityScale: 1,
        velocityBias: 0.02,
        pressureBias: 0.06,
        slideBias: 0.04,
        vibratoScale: 0.9,
        attackScale: 0.8,
        releaseScale: 0.9,
        motionScale: 1.15
      },
      keys: {
        velocityScale: 0.96,
        velocityBias: 0.02,
        pressureBias: -0.02,
        slideBias: -0.05,
        vibratoScale: 0.35,
        attackScale: 0.62,
        releaseScale: 0.7,
        motionScale: 0.45
      },
      pad: {
        velocityScale: 0.82,
        velocityBias: 0.04,
        pressureBias: -0.05,
        slideBias: -0.12,
        vibratoScale: 0.72,
        attackScale: 1.8,
        releaseScale: 1.65,
        motionScale: 0.82
      },
      drone: {
        velocityScale: 0.72,
        velocityBias: 0.08,
        pressureBias: -0.08,
        slideBias: -0.18,
        vibratoScale: 0.75,
        attackScale: 2.5,
        releaseScale: 2.2,
        motionScale: 1.35
      },
      texture: {
        velocityScale: 0.76,
        velocityBias: 0.06,
        pressureBias: -0.04,
        slideBias: -0.08,
        vibratoScale: 0.7,
        attackScale: 1.7,
        releaseScale: 1.8,
        motionScale: 1.55
      }
    },
    noteDynamics: {
      metricScale: 0.12,
      subdivisionScale: 0.055,
      phraseArchScale: 0.045,
      leapScale: 0.04,
      voiceScale: 0.018,
      jitterScale: 0.035,
      inertia: 0.18,
      minimum: 0.08,
      maximum: 1
    },
    categoryProfiles: {
      bass: "bass",
      melody: "lead",
      harmony: "keys",
      "keys-pads": "pad",
      "texture-noise": "texture",
      texture: "texture",
      template: "lead",
      utility: "lead",
      composition: "neutral",
      beat: "pluck"
    }
  });

  // public/shared/expression.js
  var clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  var finite2 = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  var curve = (value, fallback) => Object.freeze(
    (Array.isArray(value) && value.length > 1 ? value : fallback).map(clamp01)
  );
  function metricalVelocity(velocity, clock = {}) {
    const config = EXPRESSION_CONFIG.velocityVariation, base = clamp01(finite2(velocity, 0.65));
    if (!Number.isFinite(Number(clock.tick))) return base;
    const phraseBars = Math.max(1, Number(clock.meter?.phraseBars) || 4), numerator = Math.max(1, Number(clock.meter?.numerator) || 4), phrasePosition2 = ((Number(clock.bar) || 0) % phraseBars + Math.max(0, Math.min(1, (Number(clock.beat) || 0) / numerator))) / phraseBars, phrase = config.phraseFloor + config.phraseArch * Math.sin(Math.PI * phrasePosition2), metric = clock.phraseStart ? config.phraseAccent : clock.barStart ? config.barAccent : clock.groupStart ? config.groupAccent : clock.beatStart ? config.beatAccent : config.subdivisionScale, tick = (Number(clock.tick) || 0) >>> 0, hash = Math.imul(tick + 1, 2654435761) >>> 0, variation = (hash / 4294967295 * 2 - 1) * config.deterministicDepth;
    return Math.max(config.minimum, Math.min(1, base * phrase * metric * (1 + variation)));
  }
  function placedVelocity(velocity, placement = 0) {
    const config = EXPRESSION_CONFIG.mixPlacement, position = Math.max(config.minimum, Math.min(config.maximum, finite2(placement, 0))), scale = position < 0 ? 1 + (1 - config.backgroundVelocityScale) * position : 1 + (config.foregroundVelocityScale - 1) * position;
    return Math.max(EXPRESSION_CONFIG.velocityVariation.minimum, Math.min(1, clamp01(velocity) * scale));
  }
  function expressivePerformance({
    note = 60,
    duration = 0.25,
    velocity = 0.65,
    profile = "neutral",
    pressure,
    slide,
    brightness,
    vibratoDepth,
    vibratoRate,
    pitchCurve,
    pressureCurve,
    slideCurve,
    releaseVelocity,
    attackSeconds,
    releaseSeconds
  } = {}) {
    const shape = EXPRESSION_CONFIG.profiles[profile] || EXPRESSION_CONFIG.profiles.neutral, length = Math.max(0.02, finite2(duration, 0.25)), attack = clamp01(
      finite2(velocity, 0.65) * shape.velocityScale + shape.velocityBias
    ), long = clamp01(
      (length - EXPRESSION_CONFIG.sustained.minimumSeconds) / EXPRESSION_CONFIG.sustained.fullExpressionSeconds
    ), register = clamp01((finite2(note, 60) - 36) / 60), basePressure = clamp01(
      finite2(
        pressure,
        EXPRESSION_CONFIG.pressure.base + EXPRESSION_CONFIG.pressure.velocityScale * attack + shape.pressureBias
      )
    ), baseSlide = clamp01(
      finite2(
        slide,
        finite2(
          brightness,
          EXPRESSION_CONFIG.slide.base - EXPRESSION_CONFIG.slide.registerReduction * register + EXPRESSION_CONFIG.slide.velocityScale * attack + shape.slideBias
        )
      )
    );
    return Object.freeze({
      profile,
      velocity: attack,
      pressure: basePressure,
      slide: baseSlide,
      brightness: baseSlide,
      releaseVelocity: clamp01(
        finite2(releaseVelocity, 0.18 + 0.35 * basePressure)
      ),
      vibratoDepth: Math.max(
        0,
        Math.min(
          EXPRESSION_CONFIG.vibrato.maximumDepth,
          finite2(
            vibratoDepth,
            long * (EXPRESSION_CONFIG.vibrato.depthBase + EXPRESSION_CONFIG.vibrato.pressureScale * basePressure) * shape.vibratoScale
          )
        )
      ),
      vibratoRate: Math.max(
        0.1,
        Math.min(
          EXPRESSION_CONFIG.vibrato.maximumRate,
          finite2(
            vibratoRate,
            EXPRESSION_CONFIG.vibrato.rateBase + EXPRESSION_CONFIG.vibrato.registerRateScale * register
          )
        )
      ),
      pitchCurve: Object.freeze(
        (Array.isArray(pitchCurve) && pitchCurve.length > 1 ? pitchCurve : [
          0,
          long * EXPRESSION_CONFIG.pitchDrift.rise * shape.motionScale,
          long * EXPRESSION_CONFIG.pitchDrift.fall * shape.motionScale,
          0
        ]).map(
          (value) => Math.max(
            -EXPRESSION_CONFIG.pitchDrift.maximumSemitones,
            Math.min(EXPRESSION_CONFIG.pitchDrift.maximumSemitones, finite2(value, 0))
          )
        )
      ),
      pressureCurve: curve(pressureCurve, [
        Math.max(0.05, basePressure * EXPRESSION_CONFIG.pressure.attackRatio),
        Math.min(1, basePressure * (1 + EXPRESSION_CONFIG.pressure.sustainGrowth * long)),
        Math.max(
          0.04,
          basePressure * (EXPRESSION_CONFIG.pressure.releaseRatio - EXPRESSION_CONFIG.pressure.longReleaseReduction * long)
        )
      ]),
      slideCurve: curve(slideCurve, [
        baseSlide,
        clamp01(
          baseSlide + (EXPRESSION_CONFIG.slide.longRise - EXPRESSION_CONFIG.slide.highRegisterLongReduction * register) * long
        ),
        clamp01(baseSlide - EXPRESSION_CONFIG.slide.longReleaseReduction * long)
      ]),
      attackSeconds: Math.max(
        1e-3,
        Math.min(
          length * 0.45,
          finite2(
            attackSeconds,
            Math.min(
              EXPRESSION_CONFIG.envelope.maximumAttack * shape.attackScale,
              Math.max(
                EXPRESSION_CONFIG.envelope.shortAttack,
                length * (EXPRESSION_CONFIG.envelope.attackDurationScale + EXPRESSION_CONFIG.envelope.softAttackScale * (1 - attack)) * shape.attackScale
              )
            )
          )
        )
      ),
      releaseSeconds: Math.max(
        1e-3,
        Math.min(
          length * 0.45,
          finite2(
            releaseSeconds,
            Math.min(
              EXPRESSION_CONFIG.envelope.maximumRelease * shape.releaseScale,
              Math.max(
                EXPRESSION_CONFIG.envelope.shortRelease,
                length * (EXPRESSION_CONFIG.envelope.releaseDurationScale + EXPRESSION_CONFIG.envelope.longReleaseScale * long) * shape.releaseScale
              )
            )
          )
        )
      ),
      sustained: long > 0
    });
  }
  function expressionCurveEvents(expression, duration, steps = 8) {
    const valueAt = (values, phase) => {
      const position = phase * (values.length - 1), left = Math.floor(position), right = Math.min(values.length - 1, left + 1), mix = position - left;
      return values[left] + (values[right] - values[left]) * mix;
    };
    return Array.from({ length: Math.max(2, Math.trunc(steps)) }, (_, index) => {
      const phase = index / (Math.max(2, Math.trunc(steps)) - 1);
      return {
        phase,
        at: phase * Math.max(0.02, Number(duration) || 0.25),
        pressure: valueAt(expression.pressureCurve, phase),
        slide: valueAt(expression.slideCurve, phase),
        pitch: valueAt(expression.pitchCurve, phase)
      };
    });
  }
  function musicalAccent({
    base = 0.65,
    clock = {},
    division = 0,
    divisions = 1,
    phrasePosition: phrasePosition2 = 0.5,
    note = 60,
    previousNote = note,
    previousVelocity = base,
    voice = 0,
    random: random2 = () => 0.5,
    amount = 1
  } = {}) {
    const config = EXPRESSION_CONFIG.noteDynamics;
    let metric = 0.46;
    if (clock.beatStart) metric = 0.68;
    if (clock.groupStart) metric = 0.84;
    if (clock.barStart || clock.phraseStart) metric = 1;
    let subdivision = 0.62;
    if (division % 2) subdivision = 0.48;
    if (division === 0) subdivision = 1;
    const arch = Math.sin(Math.PI * clamp01(phrasePosition2));
    const leap = clamp01(
      Math.abs(finite2(note, 60) - finite2(previousNote, note)) / 12
    );
    const voiceShape = Math.abs(Math.trunc(voice)) % 3 - 1;
    const jitter = (clamp01(random2()) - 0.5) * 2;
    const target = finite2(base, 0.65) + amount * (config.metricScale * (metric - 0.58) + config.subdivisionScale * (subdivision - 0.58) + config.phraseArchScale * (arch - 0.55) + config.leapScale * (leap - 0.2) + config.voiceScale * voiceShape + config.jitterScale * jitter);
    const smoothed = finite2(previousVelocity, base) * config.inertia + target * (1 - config.inertia);
    return Math.max(config.minimum, Math.min(config.maximum, smoothed));
  }

  // public/framework/agent.js
  var MAX_PLAN_HISTORY = 512;
  function boundMap(map, limit = MAX_PLAN_HISTORY) {
    while (map.size > limit) map.delete(map.keys().next().value);
  }
  function boundArray(array, limit = MAX_PLAN_HISTORY) {
    if (array.length > limit) array.splice(0, array.length - limit);
  }
  var Agent = class {
    constructor(send, audio) {
      this.send = send;
      this.audio = audio;
      this.notes = [60, 63, 67, 70];
      this.density = 0.65;
      this.tala = [3, 2, 2, 3];
      this.mixPlacement = 0;
      this.synchronizeTimeSignature = true;
      this.capabilities = { tuning: false, harmony: false, rhythm: false, motif: false, orchestration: false, form: false, lifecycle: false };
      this.plans = new PlanCoordinator("local");
      this.memoryResponses = [];
      this.receivedPlans = /* @__PURE__ */ new Map();
      this.planResponses = [];
      this.futurePlans = /* @__PURE__ */ new Map();
      this.tuningPlans = /* @__PURE__ */ new Map();
      this.appliedPlans = /* @__PURE__ */ new Set();
      this.activeTuningKey = null;
      const receive = this.onMessage.bind(this);
      this.onMessage = (message) => {
        this.ingestPlanning(message);
        this.ingestMemoryResponse(message);
        this.ingestDirectLifecycle(message);
        this.ingestMixPlacement(message);
        return receive(message);
      };
      const tick = this.onTick?.bind(this);
      if (tick) this.onTick = (number, clock) => {
        this.currentClock = clock || {};
        this.advancePlanning(clock);
        this.advanceDirectLifecycle(clock);
        this.advanceSpace(clock);
        if (this.ensembleStopped) return;
        return tick(number, clock);
      };
    }
    onMessage(message) {
      if (message.address === "/system/instance") this.setIdentity(message.args[0]);
      if (message.address.endsWith("/notepool")) {
        const notes = normalizePitchPool(message.args);
        if (notes.length) this.notes = notes;
      }
      if (message.address.endsWith("/hdensity")) {
        const density = Number(message.args.at(-1));
        if (Number.isFinite(density)) this.density = Math.max(0, Math.min(1, density));
      }
      if (message.address.endsWith("/tala")) this.tala = message.args.map(Number).filter((value) => Number.isInteger(value) && value > 0);
      if (message.address.endsWith("/timeSignature") && this.synchronizeTimeSignature) this.requestedMeter = message.args[0];
      if (message.address === "/agent/space" && this.targeted(message)) {
        const value = message.args?.[0] || {};
        this.spaceRequests || (this.spaceRequests = []);
        this.spaceRequests.push({ ...value, appliesAt: value.appliesAt || logicalPosition(this.currentClock || {}) });
        if (this.spaceRequests.length > 32) this.spaceRequests.shift();
      }
    }
    ingestPlanning(message) {
      let planning;
      try {
        planning = this.plans.ingest(message);
      } catch (error) {
        this.planningErrors || (this.planningErrors = []);
        this.planningErrors.push({ message, error: error.message });
        if (this.planningErrors.length > 32) this.planningErrors.shift();
        this.audio?.report?.("planning_message_rejected", { address: message?.address, error: error.message });
        return;
      }
      if (planning?.type === "plan") {
        this.receivedPlans.set(planning.plan.planId, planning.plan);
        boundMap(this.receivedPlans);
        this.onPlan(planning.plan, message);
      }
      if (planning?.type === "response") {
        this.planResponses.push(planning.response);
        boundArray(this.planResponses);
        this.onPlanResponse(planning.response, message);
      }
    }
    broadcast(name, args = []) {
      const address = canonicalProtocolAddress(name, { broadcastName: true }), values = Array.isArray(args) ? args : [args];
      this.send(address, values);
      if (address === "/broadcast/intent" && this.currentClock) {
        const intent = parseCompoundIntent({ address, args: values }), clock = this.currentClock, phraseBars = clock.meter?.phraseBars || 4, createdAt = { bar: clock.bar || 0, phrase: clock.phrase || 0, section: clock.section || 0 }, appliesAt = { bar: createdAt.bar + phraseBars, phrase: createdAt.phrase + 1, section: createdAt.section };
        this.publishPlan("rhythm", { schemaVersion: 1, intent, tala: intent?.talaStructure || [], activityMask: intent?.activityMask || [], pitchclassPool: intent?.pitchclassPool || [] }, { createdAt, appliesAt, expiresAt: { ...appliesAt, bar: appliesAt.bar + phraseBars, phrase: appliesAt.phrase + 1 }, horizon: 1, confidence: 0.62, priority: 0.5, rationale: "Atomic compatibility envelope for this bot\u2019s legacy next-phrase intention." });
      }
    }
    setIdentity(value) {
      this.instanceId = String(value || "local");
      this.plans.setAuthor(this.instanceId);
      let hash = 2166136261;
      for (const character of this.instanceId) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
      this.instanceHash = hash >>> 0;
      this.instancePhase = 1 + this.instanceHash % 11;
      this.instanceDensity = 0.9 + this.instanceHash % 21 / 100;
      this.rhythmKey = null;
    }
    observeClock(clock = {}) {
      this.currentClock = clock;
      this.advancePlanning(clock);
      this.advanceDirectLifecycle(clock);
      this.advanceSpace(clock);
    }
    setCapabilities(value = {}) {
      this.capabilities = { ...this.capabilities, ...value };
    }
    publishPlan(kind, payload, options = {}) {
      const plan = this.plans.create(kind, payload, options);
      this.broadcast("plan", [plan]);
      return plan;
    }
    respondToPlan(plan, disposition, options = {}) {
      const response = this.plans.response(plan, disposition, options);
      this.broadcast("plan/response", [response]);
      return response;
    }
    ingestMemoryResponse(message) {
      if (message?.address !== "/agent/memory/response" || !this.targeted(message)) return;
      const response = message.args?.[0] || {};
      this.memoryResponses.push(response);
      boundArray(this.memoryResponses, 128);
      if (response.operation === "store") {
        this.memoryDuplicateRun = response.stored === false ? (this.memoryDuplicateRun || 0) + 1 : 0;
        if (this.memoryDevelopmentEnabled && this.memoryDuplicateRun >= 3 && !this.memoryQueryPending) {
          this.memoryDuplicateRun = 0;
          this.memoryQueryPending = this.consultMemory({ limit: 12 }, { requestId: `${this.instanceId}:memory-development:${Date.now()}`, limit: 12 });
        }
      }
      if (response.operation === "query") {
        if (response.requestId === this.memoryQueryPending) this.memoryQueryPending = null;
        this.onMemoryRecall(response.motifs || [], response, message);
      }
      this.onMemoryResponse(response, message);
    }
    onMemoryResponse() {
    }
    onMemoryRecall() {
    }
    consultMemory(query = {}, options = {}) {
      const requestId = options.requestId || `${this.instanceId}:memory:${Date.now()}`;
      this.send("/agent/memory/query", [{ target: options.target || "memory", requester: this.instanceId, requestId, query: { ...query, limit: options.limit ?? query.limit ?? 8 } }]);
      return requestId;
    }
    publishMotif(events, options = {}) {
      const motif = validateMotif({ schemaVersion: 1, motifId: options.motifId || `${this.instanceId}:motif:${Date.now()}`, author: this.instanceId, createdAt: options.createdAt || logicalPosition(this.currentClock || {}), events, tags: options.tags || [], parents: options.parents || [] });
      this.send("/agent/memory/store", [{ target: options.target || "memory", requester: this.instanceId, requestId: options.requestId || `${motif.motifId}:store`, motif }]);
      return motif;
    }
    developMotif(source, transformation = {}) {
      if (typeof source === "string") {
        this.consultMemory({ motifId: source });
        return null;
      }
      let motif;
      try {
        motif = validateMotif(source);
      } catch {
        return null;
      }
      const developed = validateMotif({ ...transformMotif(motif, transformation), motifId: `${this.instanceId}:motif:${Date.now()}`, author: this.instanceId });
      this.send("/agent/memory/store", [{ target: "memory", requester: this.instanceId, requestId: `${developed.motifId}:store`, motif: developed }]);
      return developed;
    }
    targeted(message) {
      const target = message?.args?.[0]?.target ?? message?.args?.[0];
      return target === "*" || target === this.instanceId || target === this.definitionId;
    }
    ingestMixPlacement(message) {
      if (message?.address !== "/agent/mix" || !this.targeted(message)) return;
      const payload = message.args?.[0] || {}, placement = Number(payload.placement);
      if (!Number.isFinite(placement)) return;
      this.mixPlacement = Math.max(-1, Math.min(1, placement));
      this.mixRole = String(payload.role || "support");
      this.audio?.setMixPlacement?.(this.mixPlacement);
    }
    ingestDirectLifecycle(message) {
      if (!["/agent/invite", "/agent/start", "/agent/stop", "/agent/leave"].includes(message?.address) || !this.targeted(message)) return;
      const payload = message.args?.[0] || {}, action = message.address.split("/").at(-1), request = { action, payload, appliesAt: payload.appliesAt || logicalPosition(this.currentClock || {}) };
      if (action === "invite") this.audio?.lifecycle?.("invited", payload);
      else {
        if (!Array.isArray(this.directLifecycle)) this.directLifecycle = [];
        this.directLifecycle.push(request);
      }
    }
    advanceDirectLifecycle(clock = {}) {
      if (!Array.isArray(this.directLifecycle) || !this.directLifecycle.length) return;
      const now = logicalPosition(clock), due = this.directLifecycle.filter((request) => compareLogicalPosition(now, request.appliesAt) >= 0);
      this.directLifecycle = this.directLifecycle.filter((request) => compareLogicalPosition(now, request.appliesAt) < 0);
      for (const request of due.sort((left, right) => compareLogicalPosition(left.appliesAt, right.appliesAt))) this.audio?.lifecycle?.(request.action, request.payload);
    }
    advanceSpace(clock = {}) {
      if (!Array.isArray(this.spaceRequests) || !this.spaceRequests.length) return;
      const now = logicalPosition(clock), due = this.spaceRequests.filter((request) => compareLogicalPosition(now, request.appliesAt) >= 0);
      this.spaceRequests = this.spaceRequests.filter((request) => compareLogicalPosition(now, request.appliesAt) < 0);
      for (const value of due) {
        const density = Number(value.density);
        this.spacePolicy = { ...value };
        if (Number.isFinite(density)) this.density = Math.max(0, Math.min(1, density));
      }
    }
    onPlan(plan) {
      if (plan.kind === "tuning") {
        if (!this.capabilities.tuning) {
          this.respondToPlan(plan, "abstain", { createdAt: plan.createdAt, rationale: "This agent does not interpret pitched tuning plans." });
          return;
        }
        try {
          validateTuningPayload(plan.payload);
          this.tuningPlans.set(plan.planId, plan);
          this.respondToPlan(plan, "accept", { createdAt: plan.createdAt, rationale: "Will apply this tuning at its stated logical boundary." });
        } catch (error) {
          this.respondToPlan(plan, "decline", { createdAt: plan.createdAt, rationale: `Invalid tuning payload: ${error.message}` });
        }
        return;
      }
      const capability = plan.kind === "harmony" ? "harmony" : plan.kind === "rhythm" ? "rhythm" : plan.kind === "motif" ? "motif" : plan.kind === "orchestration" ? "orchestration" : plan.kind === "form" ? "form" : plan.kind === "lifecycle" ? "lifecycle" : null;
      if (!capability || !this.capabilities[capability]) {
        this.respondToPlan(plan, "abstain", { createdAt: plan.createdAt, rationale: `This agent has no ${plan.kind} interpretation policy.` });
        return;
      }
      if (plan.kind === "lifecycle" && !["proposal", "commitment"].includes(plan.payload.phase)) {
        this.respondToPlan(plan, "decline", { createdAt: plan.createdAt, rationale: "Lifecycle plans require a proposal or commitment phase." });
        return;
      }
      this.futurePlans.set(plan.planId, plan);
      const rationale = plan.kind === "lifecycle" && plan.payload.phase === "proposal" ? "Ready to stop at a complete logical boundary if the ensemble reaches quorum." : `Will interpret this ${plan.kind} plan at its stated logical boundary.`;
      this.respondToPlan(plan, "accept", { createdAt: plan.createdAt, payload: { readyAt: plan.appliesAt }, rationale });
    }
    onPlanResponse() {
    }
    advancePlanning(clock = {}) {
      const now = logicalPosition(clock), eligible = [];
      if (this.capabilities.tuning) {
        for (const [id, plan] of this.tuningPlans) {
          if (compareLogicalPosition(now, plan.expiresAt) >= 0) {
            this.tuningPlans.delete(id);
            this.receivedPlans.delete(id);
            this.appliedPlans.delete(id);
            continue;
          }
          if (compareLogicalPosition(now, plan.appliesAt) >= 0) eligible.push(plan);
        }
        eligible.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence || b.revision - a.revision);
        const chosen = eligible[0] || null, key = chosen ? `${chosen.planId}@${chosen.revision}` : null;
        if (key !== this.activeTuningKey) {
          this.activeTuningKey = key;
          this.audio?.setTuningPlan?.(chosen ? { ...chosen.payload, planId: chosen.planId, appliesAt: chosen.appliesAt } : null);
        }
        if (chosen) this.audio?.setTuningPosition?.(clock);
      }
      for (const [id, plan] of this.futurePlans) {
        if (compareLogicalPosition(now, plan.expiresAt) >= 0) {
          this.futurePlans.delete(id);
          this.receivedPlans.delete(id);
          this.appliedPlans.delete(id);
          continue;
        }
        if (compareLogicalPosition(now, plan.appliesAt) < 0 || this.appliedPlans.has(id)) continue;
        this.appliedPlans.add(id);
        if (plan.kind === "rhythm") {
          const tala = (plan.payload.tala || plan.payload.groups || []).map(Number).filter((value) => Number.isInteger(value) && value > 0);
          if (tala.length) this.tala = tala;
          const density = Number(plan.payload.density);
          if (Number.isFinite(density)) this.density = Math.max(0, Math.min(1, density));
          this.activeRhythmPlan = plan;
        }
        if (plan.kind === "harmony") {
          this.activeHarmonyPlan = plan;
          const first = plan.payload.chords?.[0];
          if (Array.isArray(first) && first.some(Number.isFinite)) this.notes = first.map(Number).filter(Number.isFinite);
        }
        if (plan.kind === "motif") {
          try {
            this.activeMotifPlan = { ...plan, payload: { ...plan.payload, motif: validateMotif(plan.payload.motif) } };
          } catch (error) {
            this.audio?.report?.("motif_plan_rejected", { error: error.message });
          }
        }
        if (plan.kind === "orchestration") this.activeOrchestrationPlan = plan;
        if (plan.kind === "form") this.activeFormPlan = plan;
        if (plan.kind === "lifecycle" && plan.payload.phase === "commitment" && plan.payload.action === "stop") {
          this.ensembleStopped = true;
          this.audio?.panicMidi?.();
        }
      }
    }
    instanceAllows(clock, salt = 0, probability = 0.75) {
      const value = Math.imul((this.instanceHash || 1) ^ (clock.bar + 1) * 2654435761 ^ (clock.group + 1 + salt) * 2246822519, 3266489917) >>> 0;
      return value / 4294967296 < probability;
    }
    shapeVelocity(base, note, { division = 0, divisions = 1, voice = 0, amount = 1, clock = this.currentClock || {} } = {}) {
      this.dynamicVelocityState || (this.dynamicVelocityState = /* @__PURE__ */ new Map());
      const previous = this.dynamicVelocityState.get(voice) || { note, velocity: base }, bars = clock.meter?.phraseBars || 4, phrasePosition2 = ((clock.bar || 0) % bars + Math.max(0, Math.min(1, (clock.beat || 0) / (clock.meter?.numerator || 4)))) / bars, value = musicalAccent({ base, clock, division, divisions, phrasePosition: phrasePosition2, note, previousNote: previous.note, previousVelocity: previous.velocity, voice, amount, random: unitRandom });
      this.dynamicVelocityState.set(voice, { note, velocity: value });
      return value;
    }
    interpretClock(clock) {
      const numerator = clock.meter.numerator, groups = this.tala.reduce((a, b) => a + b, 0) === numerator ? this.tala : clock.meter.groups;
      if (groups === clock.meter.groups) return clock;
      const beat = clock.beat, starts = [];
      let total = 0;
      for (const size of groups) {
        starts.push(total);
        total += size;
      }
      let group = 0;
      while (group + 1 < starts.length && beat >= starts[group + 1]) group++;
      return { ...clock, meter: { ...clock.meter, groups }, group, groupBeat: beat - starts[group], groupStart: clock.tickInBar === starts[group] * clock.meter.subdivision };
    }
    rhythm(clock, config, density = config.rhythmDensity) {
      const meter = clock.meter, steps = meter.pulsesPerBar || meter.groups.reduce((a, b) => a + b, 0) * meter.subdivision, proposal = config.acceptSharedRhythm === false ? {} : meter.rhythm || {}, range = config.sharedDensityRange || [0, 1], allocated = Number(this.spacePolicy?.density), localDensity = Number.isFinite(allocated) ? allocated : density, requested = (proposal.hits ?? Math.round(steps * localDensity)) / steps, interpreted = Math.max(range[0], Math.min(range[1], requested * (this.instanceDensity || 1))), hits = Math.max(0, Math.min(steps, Math.round(steps * interpreted))), phase = Number(this.spacePolicy?.phase), instanceRotation = config.preserveDownbeat ? 0 : this.instancePhase || 0, rotation = (proposal.rotation ?? config.rotation ?? 0) + instanceRotation + (Number.isFinite(phase) ? Math.round(phase * steps) : 0), clave = Array.isArray(proposal.clave) && proposal.clave.length <= Math.ceil(steps * range[1]) ? proposal.clave : [], key = JSON.stringify([steps, hits, rotation, clave]);
      if (key !== this.rhythmKey) {
        this.rhythmKey = key;
        this.rhythmCycle = cyclicPattern({ steps, hits, rotation, clave });
      }
      return this.rhythmCycle;
    }
    async start() {
    }
    stop() {
    }
  };

  // public/framework/bot-registry.js
  var STATUSES = /* @__PURE__ */ new Set(["native", "behavioural-port", "catalogued"]);
  var INCOMPLETE = /* @__PURE__ */ new Set(["effects", "blank", "templateBot"]);
  var POLYPHONIC = /* @__PURE__ */ new Set([
    "modal",
    "miles",
    "bowed",
    "pad",
    "papMelody",
    "dampPiano",
    "counterpoint",
    "multiSynth",
    "reichGuitar",
    "seasonsBrokenChord",
    "seasonsChord",
    "resynth",
    "bleep",
    "whiny",
    "groan",
    "wub",
    "atmosphere",
    "texture",
    "midiBot",
    "webBot",
    "xPad",
    "tangerineDream",
    "rhodes"
  ]);
  function performanceType(manifest) {
    if (INCOMPLETE.has(manifest.id) || manifest.status === "catalogued") return "incomplete";
    if (!(manifest.outputModes || []).length) return "silent";
    if (POLYPHONIC.has(manifest.id)) return "polyphonic";
    if (manifest.pitchContract === "fixed-percussion" || manifest.pitchContract === "hybrid-mpe-percussion" || manifest.pitchContract === "none" || manifest.category === "beat") return "percussive";
    return "monophonic";
  }
  function defineBot(manifest, create) {
    if (!manifest || typeof manifest.id !== "string" || !manifest.id) throw new Error("Bot manifest requires a stable id");
    if (typeof manifest.name !== "string" || !manifest.name) throw new Error(`Bot ${manifest.id} requires a name`);
    if (!STATUSES.has(manifest.status)) throw new Error(`Bot ${manifest.id} has invalid status`);
    if (typeof create !== "function" && manifest.status !== "catalogued") throw new Error(`Runnable bot ${manifest.id} requires a factory`);
    const audible = (manifest.outputModes || []).length > 0, utility = ["utility", "template"].includes(manifest.category), planningCapabilities = Object.freeze({
      tuning: manifest.pitchContract === "floating-mpe",
      harmony: manifest.pitchContract === "floating-mpe" || manifest.category === "harmony",
      rhythm: audible || ["beat", "composition", "conductor"].includes(manifest.category),
      motif: audible && manifest.pitchContract === "floating-mpe",
      orchestration: audible,
      form: !utility,
      lifecycle: audible || ["composition", "conductor"].includes(manifest.category),
      ...manifest.planningCapabilities || {}
    });
    const factory = typeof create === "function" ? ((...args) => {
      const bot = create(...args);
      if (bot) bot.definitionId = manifest.id;
      bot?.setCapabilities?.(planningCapabilities);
      return bot;
    }) : create;
    const midiPerformance = manifest.performanceType || performanceType(manifest);
    return Object.freeze({ ...manifest, performanceType: midiPerformance, polyphonic: midiPerformance === "polyphonic", outputModes: Object.freeze([...manifest.outputModes || []]), planningCapabilities, create: factory });
  }
  var BotRegistry = class {
    constructor() {
      this.entries = /* @__PURE__ */ new Map();
    }
    register(definition) {
      if (this.entries.has(definition.id)) throw new Error(`Duplicate bot id: ${definition.id}`);
      this.entries.set(definition.id, definition);
      return definition;
    }
    registerMany(definitions) {
      for (const definition of definitions) this.register(definition);
      return this;
    }
    runnable() {
      return [...this.entries.values()].filter((bot) => typeof bot.create === "function");
    }
    catalog() {
      return [...this.entries.values()];
    }
    object() {
      return Object.fromEntries(this.runnable().map((bot) => [bot.id, bot]));
    }
  };

  // public/stochastic-config.js
  var STOCHASTIC_CONFIG = {
    modal: { baseMidi: 60, modePitchClasses: [0, 2, 3, 5, 7, 8, 10], extensionSemitones: 10, chordProbabilities: [1, 0.72, 0.72, 0.72], chordDurationBeats: 1, chordCounts: [1, 2, 3, 4, 5, 6, 7, 8], chordCountWeights: [0.2, 0.8, 0.5, 0.7, 0.2, 0.15, 0.05, 0.15], sectionCapacity: 4, minimumPhrasesBetweenChanges: 4, newVersusRecallWeights: [0.5, 0.5] },
    swingChord: { initialPhraseBars: 8, harmonicRhythm: 4, allowedHarmonicRhythms: [1, 2, 4, 8], beatsPerAssumedBar: 4, baseMidi: 60, maximumChords: 128 },
    methenyChord: { initialPhraseBars: 8, harmonicRhythm: 4, allowedHarmonicRhythms: [1, 2, 4, 8], beatsPerAssumedBar: 4, baseMidi: 60, maximumChords: 128 },
    mozartChord: { initialPhraseBars: 8, harmonicRhythm: 4, allowedHarmonicRhythms: [1, 2, 4, 8], beatsPerAssumedBar: 4, baseMidi: 60, maximumChords: 128 },
    bowed: { phraseBars: 4, assumedBeatsPerBar: 4, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], minimumAttackProbability: 0.12, durationSecondsRange: [0.35, 0.95] },
    drone: { phraseBars: 8, assumedBeatsPerBar: 4, baseMidi: 72, range: [72, 91], minimumSeconds: 0.5 },
    pad: { phraseBars: 8, assumedBeatsPerBar: 4, baseMidi: 60, range: [60, 88], minimumSeconds: 0.5, filterStart: 0.08, filterEnd: 1 },
    newDrone: { sourceMasks: [[1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]], sourceMaskWeights: [1, 1], activeCells: 3, range: [84, 108], durationSecondsRange: [12, 30] },
    mhDrone: { activity: 0.65, controlSmoothing: 0.2, durationRandomPercentRange: [75, 125], playDurationScale: 20, breakDurationScale: 60, tremoloBaseRange: [0, 2], tremoloDensityRange: 7, octaves: [5, 6, 7] },
    sequencer: { stepsPerBeatChoices: [2, 4], stepsPerBeatWeights: [1, 1], patternLengthRange: [1, 60], defaultNotePool: [48, 60, 63, 67, 70], octaveOffsets: [-1, 0, 1], pitchRange: [36, 96], walkDeltas: [-2, -1, 0, 1, 2], walkWeights: [0.08, 0.24, 0.36, 0.24, 0.08], densityCurve: [0.4, 0.6, 0, 0.1], minimumGate: 0.1, noteDurationBeats: 0.42, velocityRange: [0.45, 0.9], phraseBars: 8 },
    papMelody2: { phraseLengths: [2, 3, 4, 5, 6, 7, 8, 9, 12, 16], notePoolSilenceBars: 5, densitySilenceBars: 4, modes: [[0, 2, 4, 6, 7, 9, 11], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 9, 10], [0, 2, 3, 5, 7, 8, 10]], tonicRange: [50, 65], tupletDivisions: [1, 2, 3, 4, 5, 6, 7], tupletBaseWeights: [1, 0.82, 0.62, 0.46, 0.28, 0.18, 0.1], tupletDensityPowers: [0, 1, 1.35, 1.7, 2.1, 2.5, 2.9], memberProbabilityFloor: 0.18, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], velocityRange: [0.42, 0.88], noteDurationFraction: 0.72 },
    laverne: { phraseLengths: [2, 3, 4, 5, 6, 7, 8, 9, 12, 16], notePoolSilenceBars: 5, densitySilenceBars: 4, modes: [[0, 2, 4, 6, 7, 9, 11], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 9, 10], [0, 2, 3, 5, 7, 8, 10]], tonicRange: [50, 65], tupletDivisions: [1, 2, 3, 4, 5, 6, 7], tupletBaseWeights: [1, 0.82, 0.62, 0.46, 0.28, 0.18, 0.1], tupletDensityPowers: [0, 1, 1.35, 1.7, 2.1, 2.5, 2.9], memberProbabilityFloor: 0.18, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], velocityRange: [110 / 127, 110 / 127], noteDurationFraction: 1, presets: [{ attack: 43, decay: 97, sustain: 100, release: 136, cutoff: 1250, resonance: 0.94, oscillators: [{ waveform: 2, level: 100, octave: -1, tune: 0 }, { waveform: 0, level: 14, octave: 1, tune: 21 }] }, { attack: 1, decay: 74, sustain: 58, release: 385, cutoff: 1950, resonance: 0.6, oscillators: [{ waveform: 0, level: 100, octave: -1, tune: 0 }, { waveform: 3, level: 100, octave: 5, tune: 8 }] }, { attack: 8, decay: 123, sustain: 39, release: 299, cutoff: 1820, resonance: 0.53, oscillators: [{ waveform: 1, level: 100, octave: 0, tune: 0 }, { waveform: 1, level: 100, octave: 0, tune: 689 }] }, { attack: 3, decay: 74, sustain: 100, release: 385, cutoff: 1950, resonance: 0.97, oscillators: [{ waveform: 0, level: 100, octave: 0, tune: 0 }, { waveform: 2, level: 100, octave: 0, tune: 8 }] }, { attack: 1, decay: 97, sustain: 0, release: 136, cutoff: 6e3, resonance: 0.92, oscillators: [{ waveform: 3, level: 54, octave: 0, tune: 0 }, { waveform: 1, level: 100, octave: 3, tune: 13 }] }] },
    papMelody: { voiceRanges: [[48, 84], [67, 84], [84, 96]], voicePlayProbability: 0.5, drunkDeltas: [-3, -2, -1, 0, 1, 2, 3], drunkWeights: [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05], legacyMeterMultiplier: 2, legacyMeterDenominator: 4 },
    papMelody4: { modulationProbability: 0.671397, modalChangeProbability: 0.350752, modulationSize: 7, tonic: 60, scaleKeys: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6], majorScales: [[0, 1, 3, 4, 6, 8, 10, 12], [0, 1, 3, 5, 6, 8, 10, 12], [0, 1, 3, 5, 7, 8, 10, 12], [0, 2, 3, 5, 7, 8, 10, 12], [0, 2, 3, 5, 7, 9, 10, 12], [0, 2, 4, 5, 7, 9, 10, 12], [0, 2, 4, 5, 7, 9, 11, 12], [0, 2, 4, 6, 7, 9, 11, 12], [1, 2, 4, 6, 7, 9, 11, 13], [1, 2, 4, 6, 8, 9, 11, 13], [1, 3, 4, 6, 8, 9, 11, 13], [1, 3, 4, 6, 8, 10, 11, 13], [1, 3, 5, 6, 8, 10, 11, 13]], majorModalInflections: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, -1, 0]], minorModalInflections: [[0, 0, -1, 0, 0, -1, -1, 0], [0, 0, -1, 0, 0, 0, -1, 0], [0, -1, -1, 0, 0, -1, -1, 0]], noteDurationFraction: 0.78 },
    dampPiano: { sectionCount: 15, phraseLengths: [2, 3, 4, 5, 6, 7, 8, 9, 12, 16], densitySilenceBars: 5, maxDensities: [2, 4, 2, 3, 2, 4, 5, 4, 2, 3, 1, 2, 4, 3, 5], partProbabilities: [0.7, 0.4, 0.5, 0.3, 0.4], tupletDivisions: [1, 2, 3, 4, 5, 6, 7], tupletBaseWeights: [1, 0.75, 0.54, 0.38, 0.24, 0.14, 0.08], tupletDensityPowers: [0, 1, 1.35, 1.7, 2.1, 2.5, 2.9], memberProbabilityFloor: 0.12, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], legacyMeterMultiplier: 2, legacyMeterDenominator: 4, registers: [{ name: "low", sampleSlots: ["Low1", "Low2", "Low3", "Low4", "Low5", "Low6", "Low7", "Low8", "Low9"], midi: [36, 38, 40, 41, 43, 45, 47, 48, 50] }, { name: "lowMid", sampleSlots: ["LowMid1", "LowMid2", "LowMid3", "LowMid4", "LowMid5", "LowMid6", "LowMid7", "LowMid8"], midi: [50, 52, 53, 55, 57, 59, 60, 62] }, { name: "highMid", sampleSlots: ["HiMid1", "HiMid2", "HiMid3", "HiMid4", "HiMid5", "HiMid6", "HiMid7", "HiMid8"], midi: [60, 62, 64, 65, 67, 69, 71, 72] }, { name: "high", sampleSlots: ["Hi1", "Hi2", "Hi3", "Hi4", "Hi5", "Hi6", "Hi7", "Hi8", "Hi9", "Hi10", "Hi11"], midi: [72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89] }] },
    counterpoint: { sectionCount: 15, phraseLengths: [2, 3, 4, 5, 6, 7, 8, 9, 12, 16], notePoolSilenceBars: 5, maxDensities: [2, 4, 5, 4, 5, 4, 5, 4, 2, 3, 5, 3, 4, 5, 4], partProbabilities: [0.7, 0.4, 0.5, 0.3, 0.4], tupletDivisions: [1, 2, 3, 4, 5, 6, 7], tupletBaseWeights: [1, 0.78, 0.58, 0.42, 0.27, 0.16, 0.09], tupletDensityPowers: [0, 1, 1.35, 1.7, 2.1, 2.5, 2.9], memberProbabilityFloor: 0.15, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], legacyMeterMultiplier: 2, legacyMeterDenominator: 4, defaultNotes: [60, 62, 63, 65, 67, 68, 69, 72], modes: [[0, 2, 4, 6, 7, 9, 11], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 9, 10], [0, 2, 3, 5, 7, 8, 10]], tonicRange: [50, 65], registers: [{ name: "bass", range: [36, 67], offset: -12 }, { name: "tenor", range: [55, 84], offset: 12 }, { name: "soprano", range: [84, 96], offset: 24 }, { name: "alto", range: [60, 88], offset: 0 }, { name: "upper", range: [67, 91], offset: 12 }] },
    ornament: { defaultNotes: [36, 39, 44, 48, 51, 56, 60, 63, 68], octaves: 3, baseMidi: 36, candidateOnsets: 50, onsetResolution: 100, sequenceLengthMaximum: 21, sequenceLengthScale: [18, 35], staleTimeoutRangeMs: [7500, 10001], changeDelayRangeMs: [1e3, 3001], durationMultiplierRange: [8, 33], durationRatios: [1, 3, 4, 5, 7, 8, 9, 11, 13, 15, 17], densityCurveLengthRange: [6, 19], phraseCurveLengthRange: [5, 10], pluckDurationRange: [0.08, 0.24], velocityRange: [0.35, 0.88] },
    msynth: { botName: "ae_MSynthBOT", defaultTala: [3, 3, 2, 2, 2], defaultPhraseBars: 1, maximumPhraseBars: 64, formPhraseRange: [6, 12], maximumPhrases: 128, activePhraseProbability: 0.65, nearestCorpusRecords: 10, midiRange: [48, 84], velocityCycle: [1, 0.66, 0.33, 1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66], durationGate: 0.82, minimumNoteSeconds: 0.04, synthPresetCount: 5, fallbackCorpus: { onsetDurations: [{ key: 0, values: [0.5, 0.5, 1, 1.5] }], firstBeatContours: [{ key: 0, values: [0, -2, 0, 3] }], continuationContours: [{ key: 0, values: [0, 1, 2, 3] }] } },
    rsynth: { botName: "ae_RSynthBOT", defaultTala: [2, 3, 3, 2, 2, 2, 2], defaultPhraseBars: 1, maximumPhraseBars: 64, formPhraseRange: [6, 12], maximumPhrases: 128, activePhraseProbability: 0.65, midiRange: [48, 84], velocityCycle: [1, 0.66, 1, 0.66, 0.33, 1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66], durationGate: 0.82, minimumNoteSeconds: 0.04, synthPresetCount: 5, fallbackCorpus: { onsetChains: [{ key: "0 0 0 0", choices: [{ value: "1 0 0 0", weight: 1 }] }], durationsByOnset: [], pitchChains: [{ key: "0", choices: [{ value: "0", weight: 1 }] }], pitchFirstBeats: [{ key: "0", choices: [{ value: "0", weight: 1 }] }] } },
    multiSynth: { botName: "ae_MultiSynthBOT", defaultTala: [3, 2, 2, 2, 2, 3], defaultPhraseBars: 16, maximumPhraseBars: 64, formPhraseRange: [6, 12], maximumPhrases: 128, voiceCount: 4, partProbabilities: [0.5, 1, 0.7, 0.5], densityLowRange: [0, 0.25], densityHighRange: [0.33, 0.6], onsetOrderingCount: 8, onsetOrderingThreshold: 0.7, onsetCandidatesPerPart: 5, phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.5, 0.5], voiceRanges: [[41, 65], [53, 77], [55, 79], [58, 82]], voiceTranspose: [0, 0, 0, 0], midiRange: [41, 82], metricVelocityCycle: [1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 0.33], velocityCycle: [1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 0.33], noteDurationQuarterBeats: 0.7, durationGate: 0.82, minimumNoteSeconds: 0.04, synthPresetCount: 5, fallbackCorpus: { onsetDurations: [{ key: 0, values: [0.5] }], firstBeatContours: [{ key: 0, values: [0] }], continuationContours: [{ key: 0, values: [0] }] } },
    reichGuitar: { botName: "ae_ReichGuitarBOT", defaultTala: [3, 2, 2, 2, 3, 3, 3, 3, 3], defaultPhraseBars: 4, maximumPhraseBars: 64, formPhraseRange: [6, 12], maximumPhrases: 128, voiceCount: 4, partProbabilities: [0.5, 1, 0.7, 0.5], initialCell: [0, 1, 0, 0], mutationsPerPhrase: 5, inheritShapeProbability: 0.5, phaseOffsets: [0, 1, 2, 3], gaussianInputRange: [-2, 2], gaussianDensityRange: [0.2, 1], sparseVoiceMultiplierRange: [1.5, 1], minimumDensity: 0.2, pitchMotives: [[0, 1, 2, 3, 5, 7, 10, 12], [0, 2, 4, 5, 7, 9, 10, 12], [0, 3, 5, 7, 9, 12, 15, 18, 21], [0, 4, 8, 10]], voiceRanges: [[46, 70], [52, 76], [58, 82], [65, 89]], midiRange: [46, 89], velocityCycle: [1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 0.33, 1, 0.66, 0.33, 1, 0.66, 0.33, 1, 0.66, 0.33, 1, 0.66, 0.33], noteDurationQuarterBeats: 0.63, durationGate: 0.82, minimumNoteSeconds: 0.04, synthPresetCount: 5, fallbackCorpus: { onsetDurations: [{ key: 0, values: [0.5] }], firstBeatContours: [{ key: 0, values: [0] }], continuationContours: [{ key: 0, values: [0] }] } },
    methenyMelody: { botName: "ae_MethenyMelodyBOT", defaultTala: [3, 2, 3, 2, 3, 3], defaultPhraseBars: 8, maximumPhraseBars: 64, formPhraseRange: [6, 12], maximumPhrases: 128, activePhraseProbability: 0.65, phraseLengths: [2, 4, 8, 16, 32], phraseLengthWeights: [0.1, 0.66, 1.5, 0.5, 0.15], phraseDensityRange: [0, 0.55], assumedBeatsPerBar: 4, harmonicRhythm: 4, maximumChords: 128, baseMidi: 60, defaultChords: [[60, 62, 65, 67, 69]], midiRange: [60, 95], nearestCorpusRecords: 10, velocityCycle: [1, 0.66, 0.33, 0.165], durationGate: 0.86, minimumNoteSeconds: 0.04, synthPresetCount: 3, fallbackCorpus: { onsetDurations: [{ key: 0, values: [0.5, 0.5, 1] }], firstBeatContours: [{ key: 0, values: [0, 2, 5] }], continuationContours: [{ key: 0, values: [0, -2, 3] }] } },
    seasonsArpy: { defaultNotes: [69, 72, 75, 79], defaultTala: [4, 4, 4, 4], defaultArousal: 0.5, defaultPhraseBars: 4, maximumPhraseBars: 128, orderModes: 3, additionalOnsetScale: 0.6, noteDurationSeconds: 0.158318, velocityCycle: [1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 0.33, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66, 1, 0.66] },
    seasonsBrokenChord: { defaultChords: [[51, 56, 72, 83]], defaultDurations: [16], defaultArousal: 0.5, fullPolyphonyArousal: 0.8, maximumVoices: 4, defaultPhraseBars: 4, maximumPhraseBars: 128, velocity: 0.55 },
    seasonsChord: { defaultChords: [[2, 5, 7, 11]], defaultDurations: [16], defaultTala: [2, 4, 2, 2, 4], defaultArousal: 0.5, defaultPhraseBars: 8, maximumPhraseBars: 128, articulationSeconds: 0.85, velocityContour: [1, 0.636429, 0.928571, 0.589286, 0.282857, 0.135536, 0.785714, 0.495, 0.714286, 0.447857, 0.642857, 0.400714, 0.188571, 0.088393] },
    seasonsDrone: { defaultChords: [[0, 3, 7, 10], [5, 9, 13, 15], [11, 15, 19, 21]], defaultDurations: [8, 16, 8], defaultTala: [2, 2, 2, 4, 2, 4, 4], defaultArousal: 0.5, defaultPhraseBars: 8, maximumPhraseBars: 128, octave: 7, velocity: 0.52 },
    seasonsSussy: { defaultChords: [[0, 3, 7, 10], [5, 9, 13, 15], [11, 15, 19, 21]], defaultDurations: [8, 16, 8], defaultTala: [2, 2, 2, 4, 2, 4, 4], defaultArousal: 0.5, defaultPhraseBars: 8, maximumPhraseBars: 128, octave: 4, velocity: 0.52 },
    walkingBass: { rhythmDensity: 0.125, rotation: 0, sharedDensityRange: [0.06, 0.3], minimumBeatsBetweenAttacks: 0.5, accentFloor: 0.25, range: [36, 72], stepWeights: [0.15, 0.7, 0.15], steps: [-1, 0, 1] },
    eBass: { rhythmDensity: 0.6, rotation: 1, sharedDensityRange: [0.2, 0.68], minimumBeatsBetweenAttacks: 0.25, accentFloor: 0.25, range: [36, 72], steps: [-1, 0, 1], stepWeights: [0.2, 0.6, 0.2] },
    snapBass: { rhythmDensity: 0.4, rotation: 0, sharedDensityRange: [0.1, 0.6], minimumBeatsBetweenAttacks: 0.25, range: [36, 59], velocityCycle: [1, 0.66, 0.33, 0.165], octaveCycle: [0, 12, 0, 0, 0, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 12] },
    synthBass: { rhythmDensity: 0.4, rotation: 0, sharedDensityRange: [0.1, 0.6], minimumBeatsBetweenAttacks: 0.25, range: [48, 71], pitchClassSelection: "first", velocityCycle: [1, 0.66, 0.33, 0.165], octaveCycle: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    splatterBass: { activityMask: [5, 5, 5, 5, 2, 2, 2, 2, 4, 4, 4, 4, 3, 3, 3, 3], pitchclassPool: [0, 3, 10], intentStep: 11, baseMidi: 24, filterValues: [17, 27, 37, 47, 57, 67, 77, 87, 97, 107], noteDurationBeats: 0.8 },
    cleanBeat: { rhythmDensity: 0.56, rotation: 0, sharedDensityRange: [0.12, 0.82], sourceTala: [3, 3, 3, 3, 2, 2, 2, 2], talaProbabilities: [0.888889, 0.396825, 0.761905, 0.507937, 1, 0.634921, 0.793651, 0.47619, 0.68254, 0.507937, 0.189655, 0.238095, 0.730159], phraseLengths: [2, 4, 8, 16, 32], phraseWeights: [0.01, 0.66, 1.5, 0.5, 0.15], formRandomRange: [6, 14], initialPartState: [1, 1, 1, 0, 0], densityProfile: [0.45, 0.62, 0.78, 0.54, 0.33, 0.7, 0.88, 0.58], percussionVoices: [{ density: 0.589379, rotation: 1 }, { density: 0.59655, rotation: 3 }, { density: 0.679684, rotation: 5 }, { density: 1, rotation: 7 }] },
    clumpyBeat: { rhythmDensity: 0.31, rotation: 0, sharedDensityRange: [0.1, 0.76], sourceTala: [3, 3, 2, 2, 2, 3, 2, 2, 3], talaProbabilities: [0.888889, 0.396825, 0.761905, 0.507937, 1, 0.634921, 0.793651, 0.47619, 0.68254, 0.507937, 0.189655, 0.238095, 0.730159], phraseLengths: [2, 4, 8, 16, 32], phraseWeights: [0.01, 0.66, 1.5, 0.5, 0.15], formRandomRange: [6, 14], initialPartState: [1, 0, 0, 0, 0], densityProfile: [0.31, 0.48, 0.67, 0.82, 0.56, 0.38, 0.72, 0.9], percussionVoices: [{ density: 0.55, rotation: 1 }, { density: 0.6, rotation: 2 }, { density: 0.65, rotation: 4 }, { density: 0.7, rotation: 7 }] },
    noiseBeat: { rhythmDensity: 0.54, rotation: 0, sharedDensityRange: [0.12, 0.82], sourceTala: [3, 3, 2, 2, 2, 2, 3, 2, 2, 3], talaProbabilities: [0.888889, 0.396825, 0.761905, 0.507937, 1, 0.634921, 0.793651, 0.47619, 0.68254, 0.507937, 0.189655, 0.238095, 0.730159], phraseLengths: [2, 4, 8, 16, 32], phraseWeights: [0.01, 0.66, 1.5, 0.5, 0.15], formRandomRange: [6, 14], initialPartState: [0, 0, 0, 0, 1], densityProfile: [0.54, 0.7, 0.86, 0.62, 0.42, 0.77, 0.92, 0.58], percussionVoices: [{ density: 0.52, rotation: 1 }, { density: 0.58, rotation: 3 }, { density: 0.66, rotation: 5 }, { density: 0.74, rotation: 7 }] },
    newBeat: { rhythmDensity: 0.5, rotation: 0, sharedDensityRange: [0.08, 0.72], phraseBars: 4, sourceTalaStructure: [3, 2, 2, 2, 2, 3, 2, 3, 2, 2, 2, 2, 3, 2, 3, 2, 2, 2, 2, 3, 2, 3, 2, 2, 2, 2, 3, 2], repetitionStructure: ["A", "B", "C", "D"], activityMask: [1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3], drumDensityRanges: [[0, 0.5], [0.25, 0.5], [0.33, 0.66]], percussionDensityRange: [0.3, 0.6], velocityScaling: [1, 0.66, 0.33], percussionVoices: [{ density: 0.413137, rotation: 1 }, { density: 0.211402, rotation: 3 }, { density: 0.043062, rotation: 5 }, { density: 0.169347, rotation: 7 }] },
    houseBeat: { sourceTala: [4, 4, 4, 4], phraseBars: 8, defaultSection: "C", sectionTargets: { A: [0.1, 0.1], B: [0.25, 0.25], C: [0.33, 0.66], D: [0.25, 0.25] }, nearestCount: 10, rankBase: 20, velocityCycle: [1, 0.66, 0.33, 0.165], fallbackBar: [8, 0, 2, 0, 0, 0, 10, 0, 0, 0, 2, 0, 2, 0, 0, 0] },
    percBeat: { rhythmDensity: 0.5, sharedDensityRange: [0, 0.5], phraseLengths: [2, 4, 8, 16, 32], phraseWeights: [0.1, 0.66, 1.5, 0.5, 0.15], formRandomRange: [6, 12], filterRange: [20, 4e3], delayGainRange: [0, 0.5], delayWalk: { range: 12, step: 2 }, amplitudeWalk: { range: 90, step: 5, output: [0.2, 1] }, densityMaskRange: [0.1, 0.6], voiceDensityScale: [0.72, 0.86, 1], voiceCutoffScale: [0.45, 0.7, 1], midiNotes: [60, 62, 64] },
    papPerc: { rhythmDensity: 0.5, silenceBars: 4, fallbackCurvePoints: 5, kickDensityBase: 20, kickProb: [1, 0, 0.30137, 0, 0.671233, 0, 0.315068, 0, 0.767123, 0, 0.260274, 0, 0.547945, 0, 0.424658, 0.150685], midProb: [0, 0, 0.260274, 0, 1, 0, 0.150685, 0, 0.273973, 0, 0, 0, 0.958904, 0, 0.356164, 0], noiseProb: [0.986301, 0.849315, 0.863014, 0.890411, 0.863014, 0.972603, 0.972603, 0.876712, 0.986301, 0.958904, 0.890411, 0.821918, 0.945205, 0.945205, 0.931507, 0.931507], midiNotes: [36, 45, 42], noiseBands: [7200, 3200, 900] },
    mhBeat: { rhythmDensity: 1, activity: 0.9, contourBars: 2, randomDurationRange: [0.5, 3.5], durationScaleSeconds: 10, kickContour: [56, 78, 87, 88, 87, 74, 69, 67, 65, 61, 60, 59, 48, 48, 55, 65, 70, 73, 75, 75, 75, 71, 71, 80, 84, 85, 85, 83, 82, 81, 82, 82], snareContour: [5, 5, 6, 7, 8, 10, 15, 19, 20, 21, 29, 35, 36, 37, 38, 39, 39, 39, 39, 38, 21, 17, 13, 13, 14, 15, 16, 18, 21, 25, 28, 37], cymbalContour: [90, 88, 85, 76, 68, 63, 55, 48, 46, 38, 31, 22, 14, 10, 15, 18, 24, 26, 34, 41, 44, 48, 54, 57, 61, 59, 51, 47, 42, 39, 32, 28], midiNotes: [36, 38, 42] },
    mhBeatsynth: { rhythmDensity: 0.5, staleValueMs: 3e3, sequenceUnitRange: [4, 13], generatedRowCount: 3, patternRows: [[[0, 2], null, null, [0]], [[1, 2], [0], null, [0]], [null, null, [0], [0]], [null, [0], [2], null]], gateLeftRange: [500, 1e3], gateRightRange: [0, 500], fallbackTargetRange: [0, 100], fallbackRampMsRange: [1e3, 5e3], bassFrequencyRange: [15, 26], cymbalFrequencies: [3e3, 3100, 3150, 3200, 3230, 3260, 3290, 3300], cymbalDetuneRange: [0.99, 1.02], midiNotes: [36, 38, 51] },
    sampleBeat: { sourceNumerator: 4, sourceDenominator: 4, sourceSteps: 16, sampleChangeBarsRange: [16, 32], defaultFileMetadata: { tempo: 103, beats: 4, label: "letterpress" }, initialNotePool: [63, 67, 70, 74], resonance: 100, resonatorPresetMs: 5e3, resonatorGainPresets: [[0.96875, 0.9375, 0.828125, 0.78125, 0.671875, 0.59375, 0.515625, 0.359375, 0.28125, 0.140625], [0.1875, 0.25, 0.25, 0.328125, 0.390625, 0.484375, 0.671875, 0.765625, 0.875, 1], [0.890625, 0.765625, 0.625, 0.5, 0.390625, 0.28125, 0.3125, 0.53125, 0.71875, 1], [0.21875, 0.34375, 0.5625, 0.65625, 0.78125, 1, 0.75, 0.484375, 0.328125, 0.234375], [0.359375, 0.359375, 0.390625, 0.421875, 0.46875, 0.515625, 0.75, 0.90625, 0.9375, 0.53125], [0.46875, 0.890625, 1, 1, 0.984375, 0.9375, 0.71875, 0.625, 0.546875, 0.484375], [0.734375, 0.796875, 0.796875, 0.875, 0.9375, 0.984375, 1, 0.921875, 0.859375, 0.796875], [0.46875, 0.421875, 0.4375, 0.5, 0.578125, 0.65625, 0.765625, 0.859375, 1, 0.890625], [0.6875, 0.578125, 0.515625, 0.5, 0.5, 0.625, 1, 0.84375, 0.75, 0.578125], [0.59375, 0.734375, 0.859375, 1, 0.8125, 0.65625, 0.578125, 0.578125, 0.46875, 0.4375]], monitorPattern: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, midiNotes: { kick: 36, snare: 38, hat: 42 } },
    autechre: { sourceSteps: 16, phraseBars: 4, additiveParts: [2, 3], initialSubdivision: 8, subdivisionChangeChance: 1 / 3, forceSixteenthsChance: 1 / 6, subdivisionDrunkRange: 16, subdivisionDrunkStep: 4, subdivisionOffset: 3, relatedDivisors: [1, 2, 3, 4], phraseCurveXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], phraseCurveTerminalWeights: [0.8, 0.1, 0.1], densityBroadcastResolution: 0.01, densityBroadcastMinMs: 1e3, voiceDensityKneeRanges: { kick: [0, 0.5], snare: [0.25, 0.5], hat: [0, 0.5] }, densityKneeOutputRange: [0.1, 0.6], densityCurveRange: [-0.75, 0.75], velocityScale: [1, 0.66, 0.5], degradeSampleRateRange: [0, 0.9], degradeBitsRange: [1, 24], delayWetRange: [0, 0.2], delaySixteenthMultiplier: 1, midiNotes: { kick: 36, snare: 38, hat: 42 } },
    prockRock: { phraseSteps: 256, activityMask: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9], repetitionStructure: ["A", "B", "C", "D"], talaStructure: [4, 4, 4, 4, 4, 4, 4, 4], contourA: ["U", "U", "U", "U", "D", "D", "D", "D"], synchro: 0.5, intentBar: 1, planBar: 3, followChance: 0.1, minimumFollowVotes: 4, midiNotes: [36, 38, 42, 46, 45, 47, 48, 50, 49, 51, 52, 53] },
    resynth: { phraseBars: 4, activityMasks: [[0, 0, 0, 0, 9, 9, 9, 9, 4, 4, 4, 4, 7, 7, 7, 7], [9, 9, 0, 0, 2, 2, 7, 7, 6, 6, 2, 2, 0, 0, 3, 3], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6], [0, 2, 4, 6, 8, 9, 7, 5, 3, 1, 4, 6, 8, 9, 9, 9]], pitchclassPools: [[0, 2, 3, 5, 7, 9, 10, 12], [0, 3, 10], [2, 5, 9, 10], [0, 7, 3, 10, 10, 5, 3, 0], [9, 0, 5, 2, 7, 7, 10, 0], [0, 0, 3, 0, 7, 0, 5, 10], [0, 10, 9, 5, 2, 0, 0, 3], [5, 0, 10, 0, 7, 5, 2, 0], [10, 0, 7, 9, 7, 0, 0, 0], [3, 10, 0, 3, 2, 0, 10, 0]], talaStructure: [2, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 2, 3, 2, 2, 3, 3, 2, 3, 2, 3, 3, 3, 2, 2, 3], contours: [["U", "U", "U", "U", "D", "D", "D", "D"], ["D", "D", "U", "U", "D", "U", "D", "U"], ["U", "D", "U", "D", "U", "D", "U", "D"]], registerRange: [48, 84], registerStep: 4, velocityVariation: 0.18, noteDurationBeats: [0.35, 1.4], spectralModels: [{ ratios: [1, 2.956, 4.932, 7.955, 9.89], gains: [1, 0.512, 0.36, 0.254, 0.202] }, { ratios: [1, 4.545, 5.825, 6.923, 8.284], gains: [1, 0.545, 0.526, 0.368, 0.36] }, { ratios: [1, 16.418, 18.363, 2.925, 14.493], gains: [1, 0.669, 0.253, 0.235, 0.17] }, { ratios: [1, 2.983, 14.902, 16.9, 4.962], gains: [1, 0.282, 0.214, 0.207, 0.201] }] },
    vinyl: { segmentBars: 4, bedGain: 0.022, rumbleGain: 0.018, crackleGain: 0.014, bedBandHz: 4200, rumbleBandHz: 72, crackleBandHz: 7800, crackleDensity: 0.035, resonatorCount: 10, resonance: 100, presetMorphMs: 5e3 },
    sweeper: { barsUntilSweepRange: [2, 16], durationMsRange: [1, 300], frequencyEnvelope: [100, 18e3, 100], amplitude: 0.7, resonance: 0.7, modulationHz: 2, modulationDepth: 25, modulationOffset: 50 },
    fmTexture: { phraseBars: 4, defaultActivityMask: [9, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9], defaultPitchclassPool: [3, 5, 7, 10], registerRange: [48, 84], registerWalkSize: 8, registerWalkStep: 2, velocityRange: [0.25, 1], noteDurationBeats: 4, timbreChangeScale: 1e4, carrierRatios: [0.5, 1, 2, 3], modulatorRatios: [0.25, 0.5, 1, 1.5, 2, 3, 4], modulationIndexRange: [0.15, 8], amDepthRange: [0, 0.85], rampBeatsRange: [2, 16] },
    tonic: { fallbackTimeoutMs: 1e4, defaultDensity: 0.5, defaultActivity: 0.5, progressions: [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 5, 7, 11], [0, 4, 7, 9, 10]], transposeRange: [0, 10], octaves: [5, 6, 7], breakBaseMs: 100, breakScaleMs: 500, noteChangeScale: 4, detuneSemitonesRange: [-0.7, 0.7], durationSecondsRange: [0.5, 4.5], velocity: 0.58 },
    wind: { defaultDensity: 0.5, centroidRange: [300, 15e3], frequencyScaleRange: [0.9, 1.2], randomRates: [10, 500], moduleFrequencies: [961.145264, 1485.437622, 1180.358276, 405.336955, 261.925158, 1544.734245, 1105.426773, 1074.929768, 922.801331, 912.058838, 779.974854, 1455.109497, 1380.774658, 1008.487122, 953.08, 797.835876, 731.783203, 496.44812, 268.993073, 1617.750854, 1369.07019], moduleGains: [1 / 3, 1 / 3, 1 / 3, 0.2, 0.2, 0.2, 0.2, 0.2, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7] },
    bleep: { defaultDensity: 0.5, defaultArousal: 0.5, pulseCountRange: [1, 8], rateRange: [6, 18], durationMsRange: [35, 180], velocityRange: [0.25, 0.9], octaveOffsets: [0, 12, 24], presets: [{ curve1: 0.92, curve2: 0.92, speedDivider: 2, fundamental: [200, 200], fm: [30, 34] }, { curve1: 0.3, curve2: 0.2, speedDivider: 11, fundamental: [200, 200], fm: [30, 34] }, { curve1: 0.92, curve2: 0.92, speedDivider: 4, fundamental: [20, 21], fm: [22, 24] }, { curve1: 0.92, curve2: 0.92, speedDivider: 4, fundamental: [5e3, 4500], fm: [200, 300] }] },
    whiny: { defaultDensity: 0.5, defaultArousal: 0.5, defaultValence: 0.5, partialCount: 20, partialJitter: [-0.03, 0.03], foldMaximumHz: 1e3, centsRange: 30, lowerBound: 800, upperBound: 1500, voiceCount: 4, partialsPerVoice: 5, durationSeconds: [0.3, 0.5], triggerProbabilityFloor: 0.18 },
    groan: { defaultArousal: 0.5, defaultValence: 0.5, initialNote: 28, transpositions: [1, 2, 3, 4, 5], transpositionWeights: [0.6, 0.75, 0.8, 0.92, 0.96], minimumDurationMs: [800, 50], transpositionMultiplier: [5, 4.5], noteJitter: [-0.25, 0.25], intervalRandomMs: 500, indexRandomMs: 150, slidePerSemitoneMs: 5, slideRandomMs: 20, voiceCount: 4, presets: [{ dry: 0, decay: 100 }, { dry: 1, decay: 50 }, { rotation: 0.7, fluctuation: 0.05 }, { rotation: 0.87, fluctuation: 0.87 }, { damping: 0.05, speed: 30 }, { damping: 0.95, speed: 500 }] },
    wub: { defaultDensity: 0.5, defaultArousal: 0.5, defaultValence: 0.5, voiceCount: 6, fundamentalBase: 24, fundamentalRandom: [27, 36], eventCountRange: [1, 6], durationRange: [0.18, 1.2], panningRange: [-1, 1], presets: [{ dry: 0, decay: 100 }, { dry: 1, decay: 50 }, { rotation: 0.7, fluctuation: 0.05 }, { rotation: 0.87, fluctuation: 0.87 }, { damping: 0.05, speed: 30 }, { damping: 0.95, speed: 500 }] },
    atmosphere: { defaultNote: 60, octaveOffset: 12, resonatorCount: 10, resonance: 100, presetMorphSeconds: 5, minimumSegmentSeconds: 6, resonatorGainPresets: [[0.96875, 0.9375, 0.828125, 0.78125, 0.671875, 0.59375, 0.515625, 0.359375, 0.28125, 0.140625], [0.1875, 0.25, 0.25, 0.328125, 0.390625, 0.484375, 0.671875, 0.765625, 0.875, 1], [0.890625, 0.765625, 0.625, 0.5, 0.390625, 0.28125, 0.3125, 0.53125, 0.71875, 1], [0.21875, 0.34375, 0.5625, 0.65625, 0.78125, 1, 0.75, 0.484375, 0.328125, 0.234375], [0.359375, 0.359375, 0.390625, 0.421875, 0.46875, 0.515625, 0.75, 0.90625, 0.9375, 0.53125], [0.46875, 0.890625, 1, 1, 0.984375, 0.9375, 0.71875, 0.625, 0.546875, 0.484375], [0.734375, 0.796875, 0.796875, 0.875, 0.9375, 0.984375, 1, 0.921875, 0.859375, 0.796875], [0.46875, 0.421875, 0.4375, 0.5, 0.578125, 0.65625, 0.765625, 0.859375, 1, 0.890625], [0.6875, 0.578125, 0.515625, 0.5, 0.5, 0.625, 1, 0.84375, 0.75, 0.578125], [0.59375, 0.734375, 0.859375, 1, 0.8125, 0.65625, 0.578125, 0.578125, 0.46875, 0.4375]] },
    texture: { voiceCount: 8, nearestTimbres: 10, holdBars: 4, minimumDurationSeconds: 3, meanDurationSeconds: 30, durationRangeSeconds: [3, 7], grainLengthMs: 40, grainRangeMs: 45, sampleOffsetRangeMs: 950, delayMs: 250, delayRangeMs: 350, gain: 0.7, gainVariation: 0.4, stretchRange: [1, 8] },
    granu: { voiceCount: 3, defaultArousal: 0.5, defaultValence: 0.5, paceRange: [0.05, 558], grainDurationRangeMs: [50, 300], grainDurationModulationHz: [10, 20], positionRangeMs: [100, 1e3], playbackRateRange: [0.4, 1.2], panningModulationHz: 25, centroidIntervalMs: 1e3, controlRandomRange: [-0.7, 0.7], fallbackControlMs: [7500, 1e4] },
    chichichi: { voiceCount: 16, patternLength: 16, cellProbability: 0.6, automaticChangeMs: 75e3, randomStateProbability: 0.25, delayMaximumMs: 2e3, delayMs: 2e3, highpassHz: 4e3, feedback: 0.9, ringBaseHz: 0.3, controlMetroMs: 27.99, stateNames: ["next", "previous", "any"], minimumHits: 1 },
    derivations: { pitchModel: [1, 4, 3e3], granular: [2, 500, 0, 2, 0, 0.239437, 0], phaseVocoder: [2, 500, 0, 2, 4, 0, 0.3], scrub: [128, 1], storageType: 3, interpolatePresets: 2, modelOutputType: 4, autopan: 1, pvocTransposeType: 0, attackThresholdDb: -26, releaseThresholdDb: -53, segmentType: 2, reverbLevel: 10, envelopeAttackMs: 1e3, envelopeReleaseMs: 1e3, transposeRange: 0.5, initialPreset: 1, densityRange: [0.6875, 1.479167], globalLengthFactor: 4, densityTrajectory: 0, descriptorFocus: 7, pitchModelChoiceType: 2, initialDensity: 0.819277, silenceThresholdMs: 1e3, shippedRecordings: 18 },
    decider: { numElements: 30, numStates: 6, numInputs: 8, sceneDivisions: 20, soundEvent: "BreathSoundEvent", polyphony: 10, triggerEveryCalls: 2, loopRangeMs: [600, 700], gainScale: 0.5, attackMs: 500, releaseMs: 1e3, filterQ: 8, filterRangeHz: [1e3, 11e3], rateRegions: [{ below: 50, rate: 0.5 }, { above: 150, rate: 2 }, { above: 140, rate: 3 }], featureInputs: ["unused0", "unused1", "spectralCentroidMidi/127", "frequencyMidi/127", "power*10", "mfcc0/4", "(mfcc7+.5)/4", "(mfcc14+.5)/4"], shippedBreathSamples: 7 },
    blank: { defaultNotes: [60, 62, 63, 65, 67], defaultDensity: 0.8, randomResolution: 10, drunkRange: 10, drunkStep: 3, attackMs: 10, decayMs: 10, sustain: 0.8, releaseMs: 100, noteDurationBeats: 1, velocity: 0.65 },
    valenceArousal: { initialArousal: 0.307087, initialValence: 0.188976, initialPhraseBars: 8, targetRange: [12, 115], targetDivisor: 127, walkStep: 5, changeThreshold: 0.05, changePoint: 0.9, meterCandidates: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], meterLowWeights: [0.89, 0, 0.52, 0, 1, 0, 0.7, 0, 0.3, 0, 0, 0, 0], meterHighWeights: [0, 0.6, 0.13, 0.73, 0.38, 0.83, 0.35, 0.95, 0.33, 0.81, 0.19, 0.51, 0.38], phraseCandidates: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], phraseWeights: [0.28, 0.48, 0.75, 0.85, 1, 0.9, 0.76, 0.55, 0.49, 0.3, 0.1, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0], groupChoices: [3, 4], smoothFactor: 0.04 },
    midiAnalyzer: { windowMs: 2e3, smoothingWindows: 5, pitchRange: [36, 96], mpeBendRange: 48, featureNames: ["meanPitch", "pitchDeviation", "meanIntervalSize", "meanVelocity", "velocityDeviation", "meanDuration", "durationDeviation", "meanInterOnset", "interOnsetDeviation", "meanConcurrentPitches"], defaultMappings: [{ feature: 7, address: "arousal" }, { feature: 1, address: "valence" }] },
    midiBot: { voiceCount: 16, defaultNotePool: [0, 4, 7], defaultDensity: 0.5, defaultActivity: 0.5, defaultValence: 0.5, defaultArousal: 0.5, activeVoiceRange: [3, 17], octaves: 8, baseOctave: 0, velocityRange: [10, 100], durationMsBase: [700, 800], durationMsArousalScale: 2e4, controlNumbers: [1, 2, 3, 4, 5, 6, 7, 8], controlLabels: ["brightness", "motion", "phasing", "vocality", "noisiness", "distortion", "echo", "distance"], broadcastIntervalMs: 400 },
    midiGuitarInput: { noteWindowMs: 1e3, densityDivisor: 8, activityInputRange: [0, 0.5], activitySmoothingSamples: 5, mpeBendRange: 48, defaultDensity: 0.5 },
    video: { frameSize: [32, 24], activitySmoothingFrames: 6, targetFps: 20, densityVelocityRange: [0, 500], activityScrollMs: [1e4, 450], activityBlurMs: [12e3, 200], saturationRange: [0, 1], blackoutThreshold: 0.7, blackoutMs: 3e3 },
    webBot: { partCount: 4, notesPerPhrase: 10, scale: [0, 2, 4, 5, 7, 9, 11], register: 48, durationMultipliers: [0.5, 2, 1], durationWeights: [2, 1.5, 1], baseDurationMs: 500, passageDurationFactor: [0.75, 1.25], ornamentTransposition: [-0.5, -0.25], resetDensityThresholdMs: 140, velocityRange: [20, 60] },
    xProducer: { phraseCount: 17, parts: ["ae_xDrumBOT", "ae_xBassBOT", "ae_xSequencerBOT", "ae_xPadBOT", "ae_xPercBOT"], sections: ["A", "B", "C", "D", "E"], sectionTransitions: { A: { values: ["A"], weights: [1] }, B: { values: ["A", "B", "D"], weights: [0.36, 0.56, 0.08] }, C: { values: ["B", "C", "D"], weights: [0.05, 0.77, 0.18] }, D: { values: ["A", "B", "C", "D"], weights: [0.05, 0.07, 0.29, 0.6] }, E: { values: ["C", "D", "E"], weights: [0.26, 0.01, 0.73] } }, formWeights: [0.01, 0.33, 1, 0.2, 0.05], densityPointXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], densityTerminalWeights: [0.5, 0.5], subpatterns: ["a a a a a a a b", "a a a a a a a a", "a a a a a b a a", "a b a b a b a b", "a a b b a a b c", "a b a b a b a c", "a b a c a c a c", "a b a c a c a d", "a b c d c d c e", "a a a a a a b c", "a a a b a a a c", "a b c c a b c d", "a b c c a b c c", "a a b b c c c d", "a b a c d d d b", "a b a c a b a d", "a b a c d d d e"], subpatternWeights: [257, 227, 5, 18, 2, 17, 4, 10, 3, 19, 3, 11, 1, 1, 3, 3, 7] },
    xChord: { initialPhraseBars: 8, harmonicRhythm: 4, allowedHarmonicRhythms: [1, 2, 4, 8, 16, 32], beatsPerAssumedBar: 4, baseMidi: 60, maximumChords: 128, chordCountRatios: { 2: [0.5, 1, 0.33, 0], 4: [0.33, 0.66, 0.5, 0.1], 8: [0.25, 0.5, 0.66, 0.75], 16: [0.1, 0.33, 0.66, 1], 32: [0.05, 0.2, 0.75, 1] } },
    xDrum: { sourceSteps: 16, additiveParts: [2, 3], defaultTala: [2, 2, 2, 2, 3, 2, 3], voiceDensityRange: [0.1, 0.6], densityCurveRange: [-0.75, 0.75], initialPatterns: { kick: [0], snare: [4], hihat: [0, 1, 3, 5, 6, 8, 9, 10, 12, 13, 14] }, midiNotes: { kick: 36, snare: 38, hihat: 42 } },
    xBass: { sourceSteps: 16, defaultTala: [2, 2, 3, 2, 3, 2, 2], baseMidi: 36, range: [36, 59], pitchRankWeights: [1, 0.2, 0.2], minimumOnsets: 1, densityOnsetRange: [0.1, 0.6], velocityWalk: { range: 90, step: 5, output: [0.3, 1] }, noteDurationBeats: 0.72 },
    xPad: { phraseBars: 8, assumedBeatsPerBar: 4, baseMidi: 48, range: [48, 88], minimumSeconds: 0.5, filterStart: 0, filterEnd: 1, defaultHarmonicRhythm: 4 },
    xPerc: { rhythmDensity: 0.5, sharedDensityRange: [0, 0.6], phraseLengths: [8], phraseWeights: [1], formRandomRange: [17, 18], filterRange: [20, 4e3], delayGainRange: [0, 0.5], delayWalk: { range: 12, step: 2 }, amplitudeWalk: { range: 90, step: 5, output: [0.3, 1] }, densityMaskRange: [0.1, 0.6], voiceDensityScale: [0.72, 0.86, 1], voiceCutoffScale: [0.45, 0.7, 1], midiNotes: [60, 62, 64], defaultSubpattern: ["a", "b", "a", "c", "d", "d", "d", "e"] },
    xSequencer: { stepsPerBeatChoices: [2, 4], stepsPerBeatWeights: [1, 1], patternLengthRange: [1, 60], defaultNotePool: [60, 63, 67, 70], octaveOffsets: [-1, 0, 1], pitchRange: [48, 84], walkDeltas: [-2, -1, 0, 1, 2], walkWeights: [0.08, 0.24, 0.36, 0.24, 0.08], densityCurve: [0.4, 0.6, 0, 0.1], minimumGate: 0.1, noteDurationBeats: 0.42, velocityRange: [0.45, 0.9], phraseBars: 8, presetCount: 5, cutoffProgressRange: [-6, 48] },
    tangerineDream: { phraseCountRange: [6, 14], phraseLengthCandidates: [2, 4, 8, 16, 32], phraseLengthWeights: [0.1, 0.8, 4, 2, 0.1], partNames: ["sequencer", "bass", "drums", "melody", "pad"], partProbabilities: [0.7, 0.4, 0.5, 0.3, 0.4], maximumActiveParts: [2, 4, 3, 4, 3, 4], defaultTala: [2, 4, 4, 2, 4], densityPointXRanges: [[0.05, 0.333], [0.35, 0.666], [0.7, 0.95]], densityTerminalWeights: [0.5, 0.5], harmonicRhythmChoices: [1, 2, 4, 8], harmonicRhythmWeights: [0.2, 0.5, 1, 0.33], chordCountRatios: { 2: [1, 0.5, 0, 0], 4: [1, 0.5, 0.25, 0], 8: [0.66, 1, 0.5, 0], 16: [0.5, 1, 0.66, 0.2], 32: [0.05, 0.5, 0.66, 1] }, baseMidi: 60, maximumChords: 16, sequencerStepsPerBeat: [2, 4], melodyProbabilityScale: 0.55, bassOctaveOffset: -24, padOctaveOffset: -12, drumNotes: { kick: 36, snare: 38, hat: 42 }, presetCount: 3 },
    rhodes: { rhythmDensity: 0.125, rotation: 0, preserveDownbeat: true, acceptSharedRhythm: false, minimumBeatsBetweenAttacks: 1, voicingOffsets: [[11, 2, 6, 9], [3, 0, 7, 9], [3, 12, 19, 21]] },
    beat: { rhythmDensity: 0.56, rotation: 0, sharedDensityRange: [0.12, 0.82], tala: [3, 2, 2, 2, 3, 3, 3], densityProfile: [0.888889, 0.396825, 0.761905, 0.507937, 1, 0.634921, 0.793651, 0.47619, 0.68254, 0.507937, 0.189655, 0.238095, 0.730159], phraseLengths: [4, 8, 16], phraseWeights: [0.66, 0.24, 0.1] },
    jazzBeat: { rhythmDensity: 0.5, rotation: 0, sharedDensityRange: [0.1, 0.62], tala: [3, 2, 2, 3, 2, 2, 2], densityProfile: [0.888889, 0.396825, 0.761905, 0.507937, 1, 0.634921, 0.793651, 0.47619, 0.68254, 0.507937, 0.189655, 0.238095, 0.730159], phraseLengths: [4, 8, 16], phraseWeights: [0.5, 0.4, 0.1] },
    plex: { formArchetypes: [{ name: "departure-return", weight: 0.32, roles: ["establish", "depart", "develop", "return"] }, { name: "contrast-return", weight: 0.24, roles: ["establish", "contrast", "return"] }, { name: "arch", weight: 0.24, roles: ["establish", "depart", "climax", "relax", "return"] }, { name: "progressive", weight: 0.12, roles: ["establish", "depart", "develop", "climax"] }, { name: "frame", weight: 0.08, roles: ["complex-frame", "stabilize", "complex-return"] }], sectionPhrases: [1, 2, 3, 4], sectionPhraseWeights: [0.15, 0.5, 0.25, 0.1], numerators: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], numeratorWeights: [0.15, 0.25, 0.5, 0.2, 0.8, 0.35, 0.55, 0.5, 0.9, 0.45, 0.65, 0.45, 0.4, 0.35, 0.5], stableNumerators: [3, 4, 6, 8, 12], denominators: [4, 8, 10, 12, 16], denominatorWeights: [0.2, 0.55, 0.1, 0.05, 0.1], subdivisions: [2, 3, 4, 5, 7], subdivisionWeights: [0.15, 0.25, 0.35, 0.18, 0.07], phraseBars: [2, 3, 4, 5, 7, 8], phraseBarWeights: [0.1, 0.15, 0.4, 0.12, 0.08, 0.15], hitDensities: [0.2, 0.333333, 0.4, 0.5, 0.6, 0.666667, 0.75], hitDensityWeights: [0.08, 0.16, 0.18, 0.25, 0.16, 0.1, 0.07], rotations: [-3, -2, -1, 0, 1, 2, 3], rotationWeights: [0.05, 0.1, 0.15, 0.4, 0.15, 0.1, 0.05], horizontalDensities: [0.25, 0.4, 0.55, 0.7, 0.85], verticalDensities: [0.2, 0.35, 0.5, 0.65, 0.8], baseTempos: [72, 84, 96, 108, 120, 132], baseTempoWeights: [0.08, 0.18, 0.25, 0.25, 0.16, 0.08], tempoShapes: ["easeInOut", "linear", "exponential"], tempoShapeWeights: [0.6, 0.25, 0.15], roleTempoMultiplier: { establish: 1, "complex-frame": 1.08, depart: 1.08, contrast: 0.92, develop: 1.14, climax: 1.24, relax: 0.88, stabilize: 0.82, return: 1, "complex-return": 1.08 }, roleComplexity: { establish: 0.35, "complex-frame": 0.8, depart: 0.58, contrast: 0.82, develop: 0.72, climax: 1, relax: 0.45, stabilize: 0.15, return: 0.35, "complex-return": 0.8 }, continuity: { establish: 1, "complex-frame": 1, depart: 0.7, contrast: 0.15, develop: 0.55, climax: 0.3, relax: 0.65, stabilize: 0.45, return: 1, "complex-return": 1 } },
    tune: { divisions: 12, period: 12, fallbackReferencePitch: 60, purity: 3.5, continuity: 0.75, grounding: 0.08, complexity: 0.11, primeSoftness: 0.12, oddLimit: 31, iterations: 360, chordExactness: 1, exactComplexity: 0.015, exactPrimeSoftness: 0.02, exactOddLimit: 15, exactRatios: [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [7, 5], [3, 2], [8, 5], [5, 3], [7, 4], [15, 8]], confidence: 0.82, priority: 0.68, fallbackChords: [[60, 64, 67], [62, 65, 69], [59, 62, 67], [60, 64, 67]] },
    formBot: { archetypes: [{ name: "departure-return", weight: 0.32, roles: ["establish", "depart", "develop", "return"] }, { name: "arch", weight: 0.3, roles: ["establish", "develop", "climax", "relax", "return"] }, { name: "contrast-return", weight: 0.22, roles: ["establish", "contrast", "return"] }, { name: "progressive-closure", weight: 0.16, roles: ["establish", "develop", "climax", "closure"] }], sectionPhrases: [1, 2, 3, 4], sectionPhraseWeights: [0.12, 0.48, 0.3, 0.1], roleTension: { establish: 0.2, depart: 0.45, contrast: 0.7, develop: 0.65, climax: 1, relax: 0.35, return: 0.12, closure: 0.05 }, roleClosure: { establish: 0.05, depart: 0.05, contrast: 0.08, develop: 0.1, climax: 0.15, relax: 0.55, return: 1, closure: 1 }, confidence: 0.8, priority: 0.72, stopPriority: 0.95, stopLeadPhrases: 2, quorum: 0.6, minimumVotes: 1, extensionPhrases: 2 },
    harmonyPulse: { rootCycle: [0, 5, 7, 2], qualities: [[0, 4, 7], [0, 3, 7], [0, 5, 9], [0, 4, 9]], durationBeats: [2, 2, 4, 2], maximumHoldBeats: 4, register: { low: 48, high: 76 } },
    contour: { maximumRepeats: 2, minimum: 52, maximum: 78, maximumLeap: 9, registerCenter: 64, edgePenalty: 0.62, history: 12, densityScale: 0.72 },
    space: { targetDensity: 0.58 },
    memory: { limit: 256, responseLimit: 32, deduplicationWindow: 32 },
    coord: { mix: { maximumForeground: 3, crowdingScale: 0.055 } },
    manage: { fadeBars: 1, targetSoundAgents: 6, maxEntrancesPerPhrase: 2, maxExitsPerPhrase: 2, rotationPhrases: 4, formTargets: [{ until: 0.15, count: 3 }, { until: 0.45, count: 6 }, { until: 0.75, count: 8 }, { until: 0.9, count: 5 }, { until: 1, count: 2 }], entranceRoster: { polyphonic: ["harmonyPulse", "modal", "rhodes", "pad"], monophonic: ["contour", "walkingBass", "ornament", "drone"], percussive: ["beat", "jazzBeat", "houseBeat", "perc", "clumpyBeat", "noiseBeat"] } },
    rungler: { pitchRange: [35, 71], waveformWeights: [0.5, 0.5] }
  };

  // public/shared/control-ownership.js
  var FallbackControlLease = class {
    constructor(silenceBoundaries = 4) {
      this.silenceBoundaries = Math.max(1, Math.trunc(Number(silenceBoundaries) || 1));
      this.missed = 0;
      this.received = false;
      this.ownsFallback = false;
      this.value = null;
    }
    receive(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return false;
      this.value = number;
      this.received = true;
      this.missed = 0;
      this.ownsFallback = false;
      return true;
    }
    advanceBoundary() {
      if (this.received) {
        this.received = false;
        this.missed = 0;
        this.ownsFallback = false;
      } else {
        this.missed++;
        if (this.missed >= this.silenceBoundaries) this.ownsFallback = true;
      }
      return this.ownsFallback;
    }
  };
  var BoundaryPresenceLease = class {
    constructor(silenceBoundaries = 4) {
      this.silenceBoundaries = Math.max(1, Math.trunc(Number(silenceBoundaries) || 1));
      this.missed = 0;
      this.received = false;
      this.ownsFallback = false;
    }
    receive() {
      this.received = true;
      this.missed = 0;
      this.ownsFallback = false;
    }
    advanceBoundary() {
      if (this.received) {
        this.received = false;
        this.missed = 0;
        this.ownsFallback = false;
      } else if (++this.missed >= this.silenceBoundaries) this.ownsFallback = true;
      return this.ownsFallback;
    }
  };
  var StaleValueLease = class {
    constructor(timeoutMs = 3e3, now = () => Date.now()) {
      this.timeoutMs = Math.max(1, Number(timeoutMs) || 3e3);
      this.now = now;
      this.value = null;
      this.lastChangeAt = this.now();
      this.ownsFallback = false;
    }
    receive(value, at = this.now()) {
      const number = Number(value);
      if (!Number.isFinite(number)) return false;
      const changed = !Object.is(number, this.value);
      this.value = number;
      if (changed) {
        this.lastChangeAt = at;
        this.ownsFallback = false;
      }
      return changed;
    }
    update(at = this.now()) {
      if (at - this.lastChangeAt >= this.timeoutMs) this.ownsFallback = true;
      return this.ownsFallback;
    }
  };
  var StalePresenceLease = class {
    constructor(timeoutMs = 3e3, now = () => Date.now()) {
      this.timeoutMs = Math.max(1, Number(timeoutMs) || 3e3);
      this.now = now;
      this.valueKey = null;
      this.lastChangeAt = this.now();
      this.ownsFallback = false;
    }
    receive(value, at = this.now()) {
      const key = JSON.stringify(value), changed = key !== this.valueKey;
      this.valueKey = key;
      if (changed) {
        this.lastChangeAt = at;
        this.ownsFallback = false;
      }
      return changed;
    }
    update(at = this.now()) {
      if (at - this.lastChangeAt >= this.timeoutMs) this.ownsFallback = true;
      return this.ownsFallback;
    }
  };

  // public/shared/harmony.js
  var chordIntervals = (shape) => String(shape).split("_").map(Number).filter(Number.isFinite);
  var transposeChord = (shape, root, base = 60) => chordIntervals(shape).map((interval) => base + root + interval);
  function weightedPitchClass(weights) {
    const values = Array.from({ length: 12 }, (_, index) => index), usable = values.map((index) => Math.max(0, Number(weights?.[index]) || 0));
    return usable.some(Boolean) ? weightedChoice(values, usable) : 0;
  }
  function corpusInitialShape(corpus) {
    const shapes = Object.keys(corpus || {}), weights = shapes.map((shape) => Math.max(0, Number(corpus[shape]?.initial) || 0));
    return shapes.length ? weights.some(Boolean) ? weightedChoice(shapes, weights) : shapes[0] : "0_3_7";
  }
  function harmonyTransitions(record = {}) {
    return Object.entries(record).filter(([key, value]) => key.endsWith(">") && !key.startsWith(">") && Array.isArray(value)).map(([key, weights]) => ({ shape: key.slice(0, -1), weights }));
  }
  function corpusNextChord(corpus, currentShape) {
    const transitions = harmonyTransitions(corpus?.[currentShape]), usable = transitions.filter((item) => item.weights.some((value) => Number(value) > 0));
    if (!usable.length) {
      const shape = corpusInitialShape(corpus);
      return { shape, root: weightedPitchClass(corpus?.[shape]?.initial) };
    }
    const totals = usable.map((item) => item.weights.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)), selected = weightedChoice(usable, totals);
    return { shape: selected.shape, root: weightedPitchClass(selected.weights) };
  }
  function observedDuration(record = {}, fallback = 1) {
    const raw = Array.isArray(record.duration) ? record.duration : record.duration == null ? [] : [record.duration], values = raw.map(Number).filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? weightedChoice([...new Set(values)], [...new Set(values)].map((value) => values.filter((item) => item === value).length)) : fallback;
  }
  function normalizeProbabilityVector(values, length = 12) {
    const vector = Array.from({ length }, (_, index) => Math.max(0, Number(values?.[index]) || 0)), maximum = Math.max(...vector, 0);
    return maximum ? vector.map((value) => value / maximum) : vector;
  }
  function parseChordPlan(values) {
    const input = Array.isArray(values) ? values : [values], groups = [];
    for (const value of input) {
      if (Array.isArray(value)) {
        const notes2 = value.map(Number).filter(Number.isFinite);
        if (notes2.length) groups.push(notes2);
        continue;
      }
      const notes = String(value ?? "").replace(/^"|"$/g, "").trim().split(/[ _]+/).map(Number).filter(Number.isFinite);
      if (notes.length) groups.push(notes);
    }
    return groups;
  }

  // public/shared/sequencing.js
  function sourceStep(clock, stepsPerBeat = 2) {
    const subdivision = Math.max(1, clock.meter?.subdivision || 4), steps = Math.max(1, Math.round(stepsPerBeat));
    return (clock.beat || 0) * steps + Math.min(steps - 1, Math.floor((clock.subdivision || 0) * steps / subdivision));
  }
  function octaveExpandedPool(notes, octaves = [-1, 0, 1], range = [36, 96]) {
    const values = notes.map(Number).filter(Number.isFinite), result = [];
    for (const note of values) for (const octave of octaves) {
      const value = note + octave * 12;
      if (value >= range[0] && value <= range[1]) result.push(value);
    }
    return [...new Set(result)].sort((a, b) => a - b);
  }
  function reflectedWalk(index, delta, length) {
    if (length <= 1) return 0;
    let value = index + delta;
    while (value < 0 || value >= length) value = value < 0 ? -value : value >= length ? 2 * (length - 1) - value : value;
    return value;
  }
  function densityWeightedTuplet(density, { divisions, baseWeights, densityPowers }) {
    const value = Math.max(0, Math.min(1, Number(density) || 0));
    return weightedChoice(divisions, baseWeights.map((weight, index) => weight * Math.pow(Math.max(1e-3, value), densityPowers[index])));
  }
  function filteredTupletMembers(divisions, density, floor = 0.18) {
    const count = Math.max(1, Math.trunc(divisions)), value = Math.max(0, Math.min(1, Number(density) || 0)), members = [0];
    for (let index = 1; index < count; index++) {
      const probability = Math.max(floor, value * (1 - index / (count * 2)));
      if (unitRandom() <= probability) members.push(index);
    }
    return members;
  }
  function expandPitchClasses(notes, { octaves = 3, base = 36 } = {}) {
    const pitchClasses = [...new Set(notes.map(pitchClass).filter((value) => value !== null))], expanded = [];
    for (let octave = 0; octave < octaves; octave++) for (const pitchClass2 of pitchClasses) expanded.push(base + octave * 12 + pitchClass2);
    return [...new Set(expanded)].sort((a, b) => a - b);
  }
  function randomNormalizedOnsets(count, { candidates = 50, resolution = 100 } = {}) {
    const target = Math.max(1, Math.trunc(count)), values = /* @__PURE__ */ new Set([0]);
    for (let index = 0; index < candidates && values.size < target; index++) values.add(Math.round(unitRandom() * resolution) / resolution);
    while (values.size < target) values.add(Math.min(1, values.size / target));
    return [...values].sort((a, b) => a - b).slice(0, target);
  }

  // public/shared/form.js
  function distinctBinaryForm(sectionCount, voiceCount, probabilities) {
    const form = [];
    let previous = null;
    for (let section = 0; section < sectionCount; section++) {
      let state2 = Array.from({ length: voiceCount }, (_, index) => unitRandom() < (probabilities[index] ?? 0.5) * (previous?.[index] === 0 ? 0.5 : 1) ? 1 : 0);
      if (!state2.some(Boolean)) state2[section % voiceCount] = 1;
      if (previous && state2.every((value, index) => value === previous[index])) state2[(section + 1) % voiceCount] ^= 1;
      if (!state2.some(Boolean)) state2[section % voiceCount] = 1;
      form.push(state2);
      previous = state2;
    }
    return form;
  }

  // public/shared/corpus.js
  var finitePositive = (values) => values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  function corpusDensity(record) {
    const values = finitePositive(record?.values || record || []), span = values.reduce((sum, value) => sum + value, 0);
    return span ? values.length / span : 0;
  }
  function nearestCorpusRecords(records, target, limit = 10, measure = corpusDensity) {
    return records.map((record) => ({ record, distance: Math.abs(measure(record) - target) })).sort((a, b) => a.distance - b.distance || a.record.key - b.record.key).slice(0, Math.max(1, limit)).map((item) => item.record);
  }
  function chooseCorpusRecord(records, target, limit = 10, measure = corpusDensity, random2 = unitRandom) {
    const nearest = nearestCorpusRecords(records, target, limit, measure);
    return nearest[Math.min(nearest.length - 1, Math.floor(random2() * nearest.length))];
  }
  function fitMidi(note, range = [48, 84]) {
    let value = Number(note);
    if (!Number.isFinite(value)) value = 60;
    while (value < range[0]) value += 12;
    while (value > range[1]) value -= 12;
    return Math.max(range[0], Math.min(range[1], value));
  }
  function nearestPitchClass(note, pool, range = [48, 84]) {
    const pitches = pool.map(Number).filter(Number.isFinite);
    if (!pitches.length) return fitMidi(note, range);
    let best = fitMidi(pitches[0], range), distance = Math.abs(best - note);
    for (const pitch of pitches) for (let octave = -8; octave <= 8; octave++) {
      const candidate = pitch + octave * 12;
      if (candidate < range[0] || candidate > range[1]) continue;
      const next = Math.abs(candidate - note);
      if (next < distance) {
        best = candidate;
        distance = next;
      }
    }
    return best;
  }
  function generateCorpusPhrase(corpus, { beats = 12, density = 0.55, notePool = [60, 63, 67, 70], range = [48, 84], nearest = 10, random: random2 = unitRandom } = {}) {
    const span = Math.max(0.0625, Number(beats) || 12), target = 0.3 + Math.max(0, Math.min(1, Number(density) || 0)) * 0.5, durations = chooseCorpusRecord(corpus.onsetDurations, target, nearest, corpusDensity, random2)?.values || [1], first = chooseCorpusRecord(corpus.firstBeatContours, target, nearest, (record) => (record.values?.length || 0) / Math.max(1, span), random2)?.values || [0], continuation = chooseCorpusRecord(corpus.continuationContours, target, nearest, (record) => (record.values?.length || 0) / Math.max(1, span), random2)?.values || [0], anchor = nearestPitchClass(60, notePool, range), events = [];
    let at = 0, index = 0;
    while (at < span && index < 4096) {
      const duration = Math.min(span - at, Math.max(0.0625, Number(durations[index % durations.length]) || 0.5)), contour = index < first.length ? first[index] : continuation[(index - first.length) % continuation.length], raw = anchor + (Number(contour) || 0), note = nearestPitchClass(raw, notePool, range);
      events.push({ at, duration, note, corpusDurationKey: durations.key });
      at += duration;
      index++;
    }
    return events;
  }
  function weightedCorpusChoice(choices, random2 = unitRandom) {
    const positive = choices.filter((choice) => choice.weight > 0), source = positive.length ? positive : choices, total = source.reduce((sum, choice) => sum + Math.max(0, choice.weight), 0);
    if (!source.length) return null;
    if (!total) return source[Math.min(source.length - 1, Math.floor(random2() * source.length))];
    let target = random2() * total;
    for (const choice of source) {
      target -= Math.max(0, choice.weight);
      if (target <= 0) return choice;
    }
    return source.at(-1);
  }
  var parseNumbers = (value) => String(value).trim().split(/\s+/).map(Number).filter(Number.isFinite);
  function generateRhythmicCorpusPhrase(corpus, { beats = 16, density = 0.66, notePool = [60, 63, 67, 70], range = [48, 84], random: random2 = unitRandom } = {}) {
    const sixteenths = Math.max(1, Math.ceil((Number(beats) || 16) * 4)), onsets = new Map(corpus.onsetChains.map((row) => [row.key, row.choices])), pitches = new Map(corpus.pitchChains.map((row) => [row.key, row.choices])), first = weightedCorpusChoice(corpus.pitchFirstBeats[0]?.choices || [], random2), events = [];
    let onset = "0 0 0 0", contour = first?.value || "0", anchor = nearestPitchClass(60, notePool, range), step = 0;
    while (step < sixteenths) {
      const onsetChoices = onsets.get(onset) || corpus.onsetChains[0]?.choices || [], proposal = weightedCorpusChoice(onsetChoices, random2)?.value || onset;
      const cells = parseNumbers(proposal).slice(0, 4);
      for (let index = 0; index < 4 && step + index < sixteenths; index++) if (cells[index] && random2() <= Math.max(0.12, Math.min(1, density))) {
        const offsets = parseNumbers(contour), raw = anchor + (offsets[index % Math.max(1, offsets.length)] || 0), note = nearestPitchClass(raw, notePool, range);
        events.push({ at: (step + index) / 4, duration: 0.22, note, onsetState: proposal });
      }
      const pitchChoices = pitches.get(contour) || pitches.get(String(parseNumbers(contour).at(-1) ?? 0)) || corpus.pitchChains[0]?.choices || [];
      contour = weightedCorpusChoice(pitchChoices, random2)?.value || contour;
      onset = proposal;
      step += 4;
    }
    if (!events.length) events.push({ at: 0, duration: 0.22, note: anchor, onsetState: "musical-silence-guard" });
    return events;
  }

  // public/shared/seasons.js
  var clamp012 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  function seasonsVoiceCount(arousal, maximum = 4, fullAt = 0.8) {
    return Math.max(1, Math.min(maximum, Math.round(1 + clamp012(Number(arousal) / fullAt) * (maximum - 1))));
  }
  function phrasePosition(progress, phraseBars, meterBeats) {
    return clamp012(progress) * Math.max(1, phraseBars) * Math.max(1, meterBeats);
  }
  function chordAtPosition(chords, durations, position) {
    const safeDurations = chords.map((_, index) => Math.max(1e-6, Number(durations[index]) || 1));
    const total = safeDurations.reduce((sum, value) => sum + value, 0), wrapped = ((Number(position) || 0) % total + total) % total;
    let start = 0;
    for (let index = 0; index < chords.length; index++) {
      const end = start + safeDurations[index];
      if (wrapped < end || index === chords.length - 1) return { index, chord: chords[index], start, duration: safeDurations[index], position: wrapped };
      start = end;
    }
  }
  function staggeredHeldVoices(chord, duration, voiceCount, random2 = random) {
    const notes = [...new Set(chord.map(Number).filter(Number.isFinite))];
    if (!notes.length) return [];
    return Array.from({ length: Math.min(voiceCount, notes.length) }, (_, index) => {
      const note = notes[index % notes.length] + 12 * (Math.floor(index / notes.length) + (random2() < 0.5 ? -1 : 0));
      const delay = index === 0 ? 0 : random2() * duration * 0.5;
      return { note, delay, duration: Math.max(0.01, duration - delay) };
    }).sort((a, b) => a.delay - b.delay);
  }
  function seasonsOnsetCycle(groups, arousal, random2 = random) {
    const length = groups.reduce((sum, value) => sum + Math.max(0, Math.trunc(Number(value) || 0)), 0);
    if (!length) return [];
    const starts = [];
    let position = 0;
    for (const group of groups) {
      starts.push(position);
      position += Math.max(1, Math.trunc(Number(group) || 1));
    }
    for (let index = starts.length - 1; index > 0; index--) {
      const other = Math.min(index, Math.floor(Math.max(0, Math.min(0.999999999, random2())) * (index + 1)));
      [starts[index], starts[other]] = [starts[other], starts[index]];
    }
    const count = Math.max(0, Math.min(starts.length, Math.round(clamp012(arousal) * starts.length))), selected = new Set(starts.slice(0, count));
    return Array.from({ length }, (_, index) => selected.has(index) ? 1 : 0);
  }
  function ascendingPitchClassVoicing(chord, arousal, random2 = random) {
    const pcs = [...new Set(chord.map(pitchClass).filter((value) => value !== null))];
    for (let index = pcs.length - 1; index > 0; index--) {
      const other = Math.min(index, Math.floor(Math.max(0, Math.min(0.999999999, random2())) * (index + 1)));
      [pcs[index], pcs[other]] = [pcs[other], pcs[index]];
    }
    const ascending = [];
    for (const pc of pcs) {
      let note = pc;
      while (ascending.length && note <= ascending.at(-1)) note += 12;
      ascending.push(note);
    }
    ascending.sort((a, b) => a - b);
    if (!ascending.length) return [];
    const octave = Math.floor(ascending[0] / 12) * 12, normalized = ascending.map((note) => note - octave + 60), count = Math.max(1, Math.min(normalized.length, Math.round(normalized.length * clamp012(arousal))));
    return normalized.slice(0, count);
  }
  function planAtProgress(chords, durations, progress) {
    const safe = chords.map((_, index) => Math.max(1e-6, Number(durations[index]) || 1)), total = safe.reduce((sum, value) => sum + value, 0);
    return chordAtPosition(chords, safe, clamp012(progress) * total);
  }
  function mostCommonPitchClass(chords) {
    const counts = /* @__PURE__ */ new Map();
    for (const note of chords.flat()) {
      const value = pitchClass(note);
      if (value !== null) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  }
  function anchoredChordPitch(chord, anchor) {
    const pcs = [...new Set(chord.map(pitchClass).filter((value) => value !== null))].sort((a, b) => a - b);
    if (!pcs.length) return null;
    if (pcs.includes(anchor)) return anchor;
    return pcs.reduce((best, value) => Math.abs(value - anchor) < Math.abs(best - anchor) ? value : best);
  }
  function seasonsDroneWindow(totalDuration, arousal, random2 = random) {
    const total = Math.max(0.01, Number(totalDuration) || 0.01), range = Math.max(0.1, Math.min(0.95, 1 - clamp012(arousal) + Math.max(0, Math.min(1, random2())) * 0.33)), duration = total * range, silence = Math.max(0, total - duration), delay = Math.max(0, Math.min(silence, duration * 0.5)) * Math.max(0, Math.min(1, random2()));
    return { delay, duration };
  }

  // public/shared/musicality.js
  var clamp2 = (value, low = 0, high = 1) => Math.max(low, Math.min(high, Number(value) || 0));
  function chooseContrastingPitch(pool, history2 = [], {
    maximumRepeats = 2,
    minimum = 48,
    maximum = 84,
    maximumLeap = 9,
    registerCenter = (minimum + maximum) / 2,
    edgePenalty = 0.45,
    random: random2 = () => 0.5
  } = {}) {
    const notes = [...new Set(pool.map(Number).filter(Number.isFinite))].flatMap((pc) => {
      const values = [];
      for (let note = pc; note < minimum; note += 12) ;
      for (let note = pc; note <= maximum; note += 12) if (note >= minimum) values.push(note);
      return values;
    });
    if (!notes.length) return 60;
    const last = history2.at(-1), run = history2.slice().reverse().findIndex((note) => note !== last);
    const repeats = run < 0 ? history2.length : run;
    const previousDirection = history2.length > 1 ? Math.sign(last - history2.at(-2)) : 0;
    const hasStepwiseChoice = last != null && notes.some((note) => Math.abs(note - last) <= maximumLeap);
    const weighted = notes.map((note) => {
      const interval = last == null ? 0 : note - last;
      let weight = 1 / (1 + Math.abs(interval) / 5);
      if (note === last && repeats >= maximumRepeats) weight = 0;
      if (previousDirection && Math.sign(interval) === -previousDirection) weight *= 1.7;
      if (hasStepwiseChoice && Math.abs(interval) > maximumLeap) weight = 0;
      const halfRange = Math.max(1, (maximum - minimum) / 2), edgeDistance = Math.abs(note - registerCenter) / halfRange;
      weight *= Math.max(0.08, 1 - edgePenalty * edgeDistance * edgeDistance);
      return weight;
    });
    let target = random2() * weighted.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < notes.length; index++) {
      if (weighted[index] <= 0) continue;
      if ((target -= weighted[index]) <= 0) return notes[index];
    }
    return notes.find((note) => note !== last) ?? notes[0];
  }
  function voiceLeadChord(previous, pitchClasses, { low = 48, high = 76 } = {}) {
    const pcs = [...new Set(pitchClasses.map((value) => (Number(value) % 12 + 12) % 12))];
    const candidates = pcs.map((pc) => {
      const notes = [];
      for (let note = pc; note <= high; note += 12) if (note >= low) notes.push(note);
      return notes;
    });
    const chord = [];
    let floor = low - 1;
    for (let voice = 0; voice < candidates.length; voice++) {
      const target = previous?.[voice] ?? low + voice * 4;
      const valid = candidates[voice].filter((note2) => note2 > floor);
      const note = (valid.length ? valid : candidates[voice]).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      chord.push(note);
      floor = note;
    }
    return chord;
  }
  function spaceAllocation(states, { targetDensity = 0.55 } = {}) {
    const sounding = states.filter((state2) => state2.state === "performing" && !state2.messageOnly);
    const count = Math.max(1, sounding.length);
    return sounding.map((state2, index) => ({
      target: state2.instanceId,
      density: clamp2(targetDensity / count * 0.9 + 0.08, 0.08, 0.72),
      phase: (index + 0.5) / count,
      downbeatProbability: index === 0 ? 0.45 : 0.12,
      role: index === 0 ? "anchor" : index % 2 ? "response" : "support"
    }));
  }
  function ensembleMixPlacements(states, { maximumForeground = 3, crowdingScale = 0.055 } = {}, phrase = 0) {
    const sounding = states.filter((state2) => state2.state === "performing" && !state2.messageOnly), priority = (state2) => {
      const category = String(state2.category || "").toLowerCase();
      if (category.includes("melody") || category.includes("ornament")) return 4;
      if (category.includes("bass")) return 3;
      if (category.includes("harmony")) return 2.4;
      if (category.includes("keys")) return 1.8;
      if (category.includes("beat") || category.includes("percussion")) return 1.2;
      if (category.includes("drone") || category.includes("texture")) return 0.4;
      return 1;
    }, ordered = sounding.slice().sort(
      (left, right) => priority(right) - priority(left) || String(left.instanceId).localeCompare(String(right.instanceId))
    ), foregroundCount = Math.min(
      maximumForeground,
      ordered.length,
      Math.max(1, Math.ceil((ordered.length - 2) / 3))
    ), crowding = -Math.min(0.38, Math.max(0, ordered.length - 3) * crowdingScale), rotated = ordered.length ? ordered.slice(phrase % ordered.length).concat(ordered.slice(0, phrase % ordered.length)) : [], foreground = new Set(
      rotated.slice().sort((left, right) => priority(right) - priority(left)).slice(0, foregroundCount).map((state2) => state2.instanceId)
    );
    return ordered.map((state2) => {
      const score = priority(state2), isForeground = foreground.has(state2.instanceId), role = isForeground ? "foreground" : score <= 0.5 ? "background" : "support", rolePlacement = isForeground ? 0.42 : role === "background" ? -0.5 : score <= 1.2 ? -0.25 : -0.08, placement = Math.max(-1, Math.min(1, rolePlacement + crowding));
      return { target: state2.instanceId, placement, role, category: state2.category, ensembleSize: ordered.length };
    });
  }

  // public/data/texture-timbres.js
  var TEXTURE_TIMBRES = [{ "id": 0, "name": "African Flute M", "low": 72, "high": 90, "spectrum": [0.125854, -0.107657, -0.209745, -0.183901, 0.921574, 0.851091, -0.255542, -0.27424, 1, 0.695994, -0.063252, 0.782395, -0.052206, 0.64054, 0.545486, 0.320827, 0.170584, 0.05835, 0.076634, -0.101003, -0.116857, -0.233192, -0.313655, -0.511012, -0.675335] }, { "id": 1, "name": "African Vox Ah S", "low": 45, "high": 79, "spectrum": [0.918561, 1, 0.95322, 0.90019, 0.968332, 0.918779, 0.798139, 0.686935, 0.5892, 0.413953, 0.169255, 0.057821, 0.083335, 0.274068, 0.49173, 0.41725, 0.202543, -0.030285, -0.144889, -0.201852, -0.192002, -0.20412, -0.324232, -0.422045, -0.642222] }, { "id": 2, "name": "African Vox La S", "low": 57, "high": 79, "spectrum": [0.402985, 0.861999, 1, 0.74194, 0.936729, 0.893315, 0.896376, 0.820017, 0.734341, 0.731738, 0.536148, 0.32863, 0.208799, 0.312237, 0.407409, 0.415596, 0.430511, 0.325513, 0.092231, 0.070825, 0.05089, -0.012027, -0.101132, -0.288266, -0.488543] }, { "id": 3, "name": "African Vox MM S", "low": 45, "high": 79, "spectrum": [0.900158, 1, 0.980186, 0.633004, 0.359694, 0.392325, 0.389589, 0.334197, 0.255947, 0.233267, 0.133747, 0.150427, 0.173776, 0.342343, 0.262339, 0.244819, 0.140532, -0.025764, -0.08944, -0.103933, -0.160002, -0.1642, -0.296149, -0.426958, -0.594503] }, { "id": 4, "name": "African Vox Oo M", "low": 45, "high": 63, "spectrum": [1, 0.977817, 0.817075, 0.759533, 0.652647, 0.465652, 0.489831, 0.520878, 0.429043, 0.130317, 3032e-6, -0.060362, -0.027536, 0.101189, 0.044497, -0.015484, -0.02251, 0.19851, 0.141639, 0.120606, 0.191645, 0.199352, 0.046235, -0.202638, -0.457105] }, { "id": 5, "name": "Alto Sax M", "low": 57, "high": 75, "spectrum": [-0.161115, 0.881799, 1, 0.431204, 0.577755, 0.714822, 0.664852, 0.755102, 0.822531, 0.815323, 0.654767, 0.727654, 0.775848, 0.712217, 0.729834, 0.698456, 0.586804, 0.63528, 0.486314, 0.352546, 0.219647, 0.059857, 0.06827, -0.114624, -0.227123] }, { "id": 6, "name": "Balafon M", "low": 58, "high": 82, "spectrum": [0.349643, 0.641015, 1, -0.114004, -0.393174, -0.635892, -0.421289, -0.564294, -0.635178, -0.658531, -0.743715, -0.855564, -0.907592, -0.773962, -0.825642, -0.909812, -0.917542, -0.944764, -0.948188, -1.068762, -1.096281, -1.123859, -1.213812, -1.265629, -1.439293] }, { "id": 7, "name": "Bass Clarinet S", "low": 34, "high": 46, "spectrum": [1, 0.936758, 0.889588, 0.976427, 0.962968, 0.806192, 0.732493, 0.719764, 0.708094, 0.615988, 0.576317, 0.529638, 0.431055, 0.367563, 0.20903, 0.135965, -0.050845, -0.201328, -0.310145, -0.415184, -0.501214, -0.520259, -0.629773, -0.769138, -0.851285] }, { "id": 8, "name": "Bass Marimba M", "low": 47, "high": 89, "spectrum": [0.874287, 1, 0.472006, 0.023779, 0.588823, 0.334791, -0.09291, -0.058531, 0.311088, -0.14658, -0.278524, -0.289202, -0.371654, -0.273851, -0.417309, -0.407121, -0.367713, -0.38762, -0.405062, -0.446744, -0.468307, -0.512143, -0.545826, -0.622744, -0.765458] }, { "id": 9, "name": "Bassoons S", "low": 34, "high": 74, "spectrum": [0.669518, 0.748585, 0.77557, 0.900825, 1, 0.928212, 0.746255, 0.579346, 0.606525, 0.602754, 0.609603, 0.484046, 0.477595, 0.348455, 0.135879, -0.061501, -0.186252, -0.364024, -0.441608, -0.410522, -0.527005, -0.648484, -0.742699, -0.895623, -1.08127] }, { "id": 10, "name": "Bowed Crotales M", "low": 84, "high": 113, "spectrum": [-0.565643, -0.883891, -0.870106, -0.843172, -0.799765, -0.791076, -0.810838, -0.677338, 1, 0.579826, -0.725343, -0.628946, -0.662474, 0.028319, -0.798425, -0.770643, -0.802699, -0.622002, -0.889319, -0.893365, -0.949958, -0.958568, -1.004292, -1.068326, -1.034235] }, { "id": 11, "name": "Bowed Vibes M", "low": 53, "high": 89, "spectrum": [6352e-6, -0.405194, 1, 0.981898, -0.15238, -0.327011, -0.486772, -0.392748, -0.346476, 0.409282, 0.311268, -0.359991, -0.393475, -0.399189, -0.48852, -0.350271, -0.520208, -0.501734, -0.446326, -0.613369, -0.546135, -0.649964, -0.673147, -0.745616, -0.612975] }, { "id": 12, "name": "Bush Mbira M", "low": 49, "high": 61, "spectrum": [0.335724, 0.529636, 1, -0.332558, -0.392098, -0.572352, -0.280076, -0.506212, -0.337733, -0.497666, 0.70421, 0.282494, -0.630045, -0.664049, -0.6938, -0.727326, -0.69268, -0.494719, -0.502325, -0.516278, -0.49337, -0.549604, -0.67135, -0.75372, -1.011797] }, { "id": 13, "name": "Celeste S", "low": 51, "high": 111, "spectrum": [-0.722927, 0.835812, 1, -0.720407, -1.150428, -1.024985, -1.05399, -1.205748, -1.222437, -1.249272, -1.234558, -1.249713, -1.352359, -1.396338, -1.414179, -1.392253, -1.329301, -1.505085, -1.510753, -1.537902, -1.58483, -1.569629, -1.614598, -1.635612, -1.308486] }, { "id": 14, "name": "Cello 2 S", "low": 38, "high": 90, "spectrum": [0.918614, 1, 0.867257, 0.820002, 0.924952, 0.768441, 0.804629, 0.688462, 0.67848, 0.619362, 0.420355, 0.482175, 0.390886, 0.437069, 0.441755, 0.28363, 0.167448, 0.115958, -0.021042, -0.043786, -0.05744, -0.117084, -0.193016, -0.324593, -0.368249] }, { "id": 15, "name": "Cello M", "low": 36, "high": 87, "spectrum": [0.619638, 0.973874, 1, 0.906571, 0.736464, 0.602006, 0.676362, 0.727669, 0.448463, 0.428429, 0.295042, 0.268539, 0.223996, 0.18516, 0.19487, 0.07896, -0.121876, -0.114457, -0.305065, -0.341758, -0.35716, -0.36342, -0.39476, -0.477945, -0.602657] }, { "id": 16, "name": "Charango M", "low": 67, "high": 88, "spectrum": [-0.312748, -0.690208, -0.76133, 0.690908, 1, -0.941196, -1.19278, 0.085938, -0.474566, -1.311536, -0.750437, -1.479836, -1.066131, -1.028233, -1.082893, -1.297655, -1.492351, -1.545172, -1.710218, -1.763989, -1.830361, -1.851751, -1.872234, -1.883283, -1.834667] }, { "id": 17, "name": "Clarinet S", "low": 50, "high": 91, "spectrum": [-0.311198, 0.896168, 1, 0.255806, 0.38176, 0.74579, 0.710443, 0.340122, 0.402524, 0.437858, 0.589333, 0.333703, 0.520842, 0.325318, 0.332845, 0.169281, -0.011532, -0.092958, -0.116891, -0.244439, -0.274519, -0.388756, -0.415295, -0.351818, -0.604732] }, { "id": 18, "name": "Clarinets S", "low": 50, "high": 84, "spectrum": [-0.119864, -0.129878, -0.20628, 0.841617, 1, -0.064733, -0.068271, 0.681588, 0.38886, 0.392602, 0.748729, -0.044857, 0.377288, 0.491052, 0.371961, 0.303646, 0.088707, 0.017356, -0.01582, -0.209849, -0.277872, -0.307684, -0.384751, -0.402892, -0.534721] }, { "id": 19, "name": "Crotales S", "low": 86, "high": 101, "spectrum": [-1.02844, -1.226206, -1.142737, -1.469035, -1.73798, -1.836643, -1.929277, -1.959537, -2.017338, -2.038795, -1.989129, -0.330788, 0.800728, -1.938753, -1.89099, -1.994573, 1, -1.825437, -1.686997, -0.58216, -1.907839, -1.730895, -1.895819, -1.982456, -2.16498] }, { "id": 20, "name": "Double Bass arco M", "low": 26, "high": 58, "spectrum": [1, 0.947122, 0.686732, 0.635313, 0.554298, 0.495003, 0.407842, 0.447878, 0.491292, 0.387685, 0.32198, 0.276639, 0.241543, 0.148469, 0.055013, -2467e-6, -0.217054, -0.24544, -0.249969, -0.325298, -0.361744, -0.342569, -0.3773, -0.549899, -0.556337] }, { "id": 21, "name": "Double Bass arco short M", "low": 26, "high": 58, "spectrum": [1, 0.885607, 0.479111, 0.158273, -0.026307, -0.204774, -0.32608, -0.357166, -0.351976, -0.3887, -0.392212, -0.447375, -0.469007, -0.487136, -0.615978, -0.669077, -0.719929, -0.744816, -0.762066, -0.785108, -0.796946, -0.805036, -0.830965, -0.880556, -1.007437] }, { "id": 22, "name": "Double Bass pizz M", "low": 32, "high": 60, "spectrum": [1, 0.874137, 0.728498, 0.334019, 0.199344, -0.054223, -0.097791, -0.227957, -0.362372, -0.463834, -0.500481, -0.546634, -0.576198, -0.606764, -0.626133, -0.664678, -0.685789, -0.7078, -0.72825, -0.738786, -0.783384, -0.80961, -0.844986, -0.927451, -0.959891] }, { "id": 23, "name": "Duduk M", "low": 54, "high": 72, "spectrum": [-0.07652, 0.91373, 1, 0.552856, 0.636689, 0.671644, 0.540557, 0.290607, 0.126519, 0.081433, 0.174629, 0.154789, 0.216208, 0.112264, 0.072072, 0.110184, 0.129484, 0.039558, -0.042911, -0.061396, -0.072204, -0.015068, -0.11182, -0.095765, -0.103577] }, { "id": 24, "name": "Female Choir S", "low": 57, "high": 81, "spectrum": [0.087849, 0.654976, 0.770484, 0.853487, 1, 0.860693, 0.818198, 0.858199, 0.765921, 0.76559, 0.807005, 0.369011, 0.244013, 0.210272, 0.246469, 0.44273, 0.391784, 0.43621, 0.070274, -0.02094, 0.025888, 0.105457, -0.08513, -0.213385, -0.36768] }, { "id": 25, "name": "Flugelhorn S", "low": 60, "high": 79, "spectrum": [-0.073796, -0.238929, -0.222642, 0.628748, 1, 0.484118, 0.042444, 0.867804, 0.903838, 0.112267, 0.800538, 0.555803, 0.655223, 0.227159, 0.431607, 0.158252, 0.013434, -0.200492, -0.301765, -0.381676, -0.434967, -0.536197, -0.638299, -0.578294, -0.688428] }, { "id": 26, "name": "Flute Ensemble S", "low": 48, "high": 96, "spectrum": [-0.097256, 0.840015, 1, 0.564986, 0.78257, 0.450308, 0.390912, 0.092477, 0.062714, 0.03284, -0.115109, -0.199657, -0.295232, -0.395742, -0.411515, -0.513476, -0.564215, -0.667287, -0.719933, -0.797657, -0.899831, -0.730867, -0.926224, -1.280624, -1.706646] }, { "id": 27, "name": "Flute M", "low": 60, "high": 96, "spectrum": [-0.427027, -0.408971, -0.348247, -0.21191, 1, 0.911048, -0.244206, -0.24324, 0.499865, 0.150908, -0.299452, 0.521966, -0.129789, 0.366014, 0.059259, -0.138912, -0.3726, -0.472997, -0.58212, -0.634978, -0.700876, -0.74928, -0.796733, -0.873191, -0.872031] }, { "id": 28, "name": "Flutes S", "low": 61, "high": 90, "spectrum": [0.217903, 0.020275, 1, 0.637916, 0.808599, 0.952416, 0.482165, 0.79431, 0.741849, 0.843166, 0.585674, 0.738685, 0.571938, 0.455611, 0.135715, 0.055657, -0.123397, -0.148623, -0.20495, -0.267896, -0.339803, -0.431017, -0.421789, -0.612138, -0.83096] }, { "id": 29, "name": "French Horns S", "low": 42, "high": 71, "spectrum": [0.318681, 0.587184, 0.894064, 1, 0.820414, 0.701006, 0.626273, 0.523262, 0.493437, 0.338415, 0.209013, 0.156062, -6471e-6, -0.141948, -0.017549, -0.262931, -0.375373, -0.515466, -0.687087, -0.89338, -0.947804, -1.019042, -1.073313, -1.107054, -1.131852] }, { "id": 30, "name": "Fujara M", "low": 55, "high": 79, "spectrum": [0.325172, 0.880282, 1, 0.302039, 0.370416, 0.27489, 0.271478, 0.165449, 0.203994, 0.263944, 0.125619, 0.103441, 0.08089, 0.076746, 0.052474, 0.022587, -0.027449, -0.030167, -0.045985, -0.087081, -0.114633, -0.175941, -0.339815, -0.444929, -0.499808] }, { "id": 31, "name": "Harpsichord 16 S", "low": 24, "high": 66, "spectrum": [0.994037, 1, 0.664731, 0.458386, 0.395969, 0.15587, 0.151616, 0.092469, 0.013799, -0.025051, -0.118037, -0.22685, -0.116237, -0.328184, -0.427501, -0.461022, -0.510508, -0.521968, -0.557817, -0.593284, -0.618959, -0.648327, -0.69143, -0.782644, -0.909474] }, { "id": 32, "name": "Harpsichord S", "low": 36, "high": 90, "spectrum": [0.7246, 0.99878, 1, 0.663689, 0.574564, 0.312735, 0.357319, 0.339933, 0.208464, 0.076203, 0.234828, 0.049317, -0.060606, 0.145243, 0.021149, 0.145575, -0.015317, 0.038198, 0.018626, -0.051763, -0.118644, -0.278493, -0.46971, -0.791526, -0.759803] }, { "id": 33, "name": "Horn M", "low": 36, "high": 72, "spectrum": [0.494049, 0.697332, 0.837955, 0.89712, 1, 0.921682, 0.885457, 0.834445, 0.702439, 0.548882, 0.364515, 0.118273, -0.019046, -0.050314, -0.233101, -0.523963, -0.677039, -0.93804, -1.12697, -1.225364, -1.26177, -1.280117, -1.304891, -1.332189, -1.353652] }, { "id": 34, "name": "Kanun M", "low": 45, "high": 89, "spectrum": [0.512067, 0.64639, 0.74882, 0.831154, 0.846871, 0.791522, 0.866041, 1, 0.882852, 0.641096, 0.689742, 0.62069, 0.234013, 0.028521, -0.131885, -0.158403, -0.365179, -0.603157, -0.78973, -0.848621, -0.897531, -0.943969, -0.929771, -0.856755, -0.84975] }, { "id": 35, "name": "Kaval M", "low": 61, "high": 88, "spectrum": [-0.117131, -0.119736, 0.695111, 0.825608, 0.224929, 0.964875, 1, 0.313689, 0.891769, 0.445496, 0.846891, 0.781995, 0.762749, 0.756938, 0.645873, 0.490396, 0.530514, 0.475683, 0.335527, 0.250432, 0.281822, 0.212276, 0.141349, 0.142728, -0.032975] }, { "id": 36, "name": "Kemence M", "low": 55, "high": 79, "spectrum": [0.129412, 0.174687, 0.245624, 0.836882, 1, 0.988281, 0.934244, 0.771579, 0.77957, 0.794226, 0.462905, 0.572219, 0.475168, 0.477133, 0.188732, 0.172018, 0.178451, 0.174366, -0.079527, -0.160961, -0.147403, -0.244925, -0.368788, -0.331492, -0.451197] }, { "id": 37, "name": "Marimba S", "low": 36, "high": 96, "spectrum": [1, 0.664889, -0.445966, -0.77991, -0.922018, -0.831374, -0.879499, -1.047833, -1.082835, -1.001538, -1.13359, -1.182344, -1.180503, -1.270782, -1.224592, -1.326971, -1.368799, -1.427461, -1.468471, -1.491722, -1.518543, -1.544439, -1.57324, -1.596533, -1.31393] }, { "id": 38, "name": "Ney M", "low": 59, "high": 87, "spectrum": [0.128407, -0.136223, 0.030513, 0.81395, 1, 0.140747, 0.254437, 0.998206, 0.643075, 0.340917, 0.526909, 0.434499, 0.612079, 0.221049, 0.248449, 0.214224, 0.181024, 0.222731, -0.109103, -0.19438, -0.239148, -0.245285, -0.342851, -0.497938, -0.899296] }, { "id": 39, "name": "Oboe M", "low": 60, "high": 89, "spectrum": [-0.588288, 0.28966, 0.826483, 0.370308, 0.993831, 0.897877, 1, 0.924544, 0.882758, 0.744951, 0.985245, 0.754309, 0.391681, 0.446097, 0.453647, 0.404698, 0.092917, -0.151832, -0.181711, -0.239018, -0.377839, -0.610016, -0.932348, -0.998068, -1.013949] }, { "id": 40, "name": "Oboes S", "low": 61, "high": 84, "spectrum": [0.139634, -0.099896, -0.256388, -0.082582, 0.799038, 0.512338, -0.453393, 0.310779, 0.859604, -0.272135, 0.689851, 1, 0.394031, 0.549404, 0.368185, 0.429851, 0.44242, 0.21742, -0.076648, -0.140609, -0.061537, -0.377132, -0.464279, -0.480078, -0.618921] }, { "id": 41, "name": "Persian Ney M", "low": 57, "high": 72, "spectrum": [0.03176, 0.891272, 1, 0.765844, 0.896284, 0.763344, 0.715477, 0.746877, 0.570584, 0.590343, 0.61026, 0.573318, 0.512567, 0.582289, 0.533498, 0.502261, 0.414061, 0.328713, 0.239112, 0.243863, 0.208324, 0.202415, 0.124968, -0.030663, -0.181195] }, { "id": 42, "name": "Pipe Organ M", "low": 31, "high": 73, "spectrum": [0.685495, 0.891688, 1, 0.806445, 0.949178, 0.799142, 0.793929, 0.943328, 0.80089, 0.782628, 0.889422, 0.648549, 0.782626, 0.576775, 0.657018, 0.449932, 0.595051, 0.427163, 0.296429, -0.138402, -0.151922, -0.320393, -0.42543, -0.484087, -0.526121] }, { "id": 43, "name": "Saz S", "low": 45, "high": 72, "spectrum": [0.748997, 0.896637, 0.95086, 1, 0.855806, 0.157918, 0.149036, 0.134496, 0.090378, 0.129309, -0.404612, -0.700092, -0.9129, -1.021299, -1.086414, -1.30454, -1.400269, -1.519279, -1.541626, -1.587144, -1.601248, -1.613831, -1.646292, -1.670314, -1.567656] }, { "id": 44, "name": "Shakuhachi S", "low": 41, "high": 76, "spectrum": [0.160336, 0.878816, 1, 0.570185, 0.716712, 0.291072, 0.27321, 0.359228, 0.210451, 0.221873, 0.1509, 0.056227, 0.028971, -0.031529, -8742e-6, -0.081485, -0.12456, -0.160002, -0.181124, -0.242521, -0.288514, -0.291946, -0.407552, -0.554369, -0.852267] }, { "id": 45, "name": "Sitar 2 M", "low": 56, "high": 92, "spectrum": [0.088794, 0.37279, 0.927438, 0.93602, 1, 0.950532, 0.782201, 0.688043, 0.572177, 0.298401, 0.015141, -0.018364, -8644e-6, -373e-5, -0.330119, -0.190551, -0.58544, -0.463719, -0.512549, -0.584992, -0.814296, -0.85436, -0.942643, -0.930331, -1.036841] }, { "id": 46, "name": "Sitar M", "low": 36, "high": 78, "spectrum": [0.920071, 1, 0.786661, 0.629041, 0.567189, 0.323698, 0.433025, 0.507602, 0.448788, 0.260038, -0.252098, -0.580576, -0.785674, -0.711303, -0.829475, -0.673009, -0.423851, -1.085818, -1.002529, -1.181763, -1.310247, -1.3668, -1.544789, -1.634589, -1.702186] }, { "id": 47, "name": "Soprano Sax M", "low": 57, "high": 84, "spectrum": [0.467868, 0.90129, 1, 0.506865, 0.627284, 0.510824, 0.46605, 0.445522, 0.461751, 0.475494, 0.570181, 0.379807, 0.473328, 0.325002, 0.284896, 0.336063, 0.213158, 0.09699, 0.083163, 0.049138, -0.040407, -0.06412, -0.061261, -0.159118, -0.388204] }, { "id": 48, "name": "Steel Drums S", "low": 62, "high": 96, "spectrum": [-0.022859, -0.849686, -0.038922, 0.534836, 0.781126, -0.04121, 0.070111, 1, 0.44757, 0.285666, 0.116845, -0.080611, 0.57518, -0.41751, -0.187078, -0.641241, -0.313238, -0.927371, -1.147115, -1.237922, -1.295323, -1.442787, -1.33224, -1.409068, -1.656493] }, { "id": 49, "name": "String Ensemble S", "low": 26, "high": 98, "spectrum": [1, 0.95826, 0.796512, 0.724329, 0.592493, 0.564167, 0.401414, 0.392868, 0.346704, 0.343031, 0.299977, 0.186911, 0.060394, -0.057828, -0.185907, -0.294762, -0.320148, -0.38131, -0.482453, -0.504804, -0.593211, -0.672534, -0.73359, -0.748217, -0.86742] }, { "id": 50, "name": "Suling Pelog M", "low": 71, "high": 91, "spectrum": [0.302674, -0.251714, -0.43265, 0.315483, 1, 0.497161, -0.544554, 0.696827, 0.944434, -0.334183, 0.598602, 0.580077, 0.555411, 0.308949, 0.250118, 0.059285, 0.043223, 0.090152, -0.018491, -0.042557, 0.018233, -0.073401, -0.181725, -0.383926, -0.743949] }, { "id": 51, "name": "Trombones S", "low": 35, "high": 67, "spectrum": [-0.051488, 0.840107, 1, 0.683173, 0.891015, 0.725316, 0.685596, 0.702059, 0.407475, 0.289857, 0.183246, -0.127728, -0.290318, -0.42876, -0.597055, -0.772827, -0.893108, -0.986858, -1.058868, -1.097529, -1.110033, -1.123137, -1.155318, -1.158996, -1.169307] }, { "id": 52, "name": "Trumpet M", "low": 52, "high": 88, "spectrum": [0.10825, 0.728124, 1, 0.398783, 0.873811, 0.549885, 0.794541, 0.94032, 0.952925, 0.891909, 0.804929, 0.598948, 0.340805, 0.243649, 0.18481, -0.02593, -0.132573, -0.247814, -0.333167, -0.393806, -0.413819, -0.498132, -0.572044, -0.770206, -1.058679] }, { "id": 53, "name": "Trumpet2 M", "low": 56, "high": 84, "spectrum": [-0.508385, 0.368765, 0.931516, 0.460786, 1, 0.903132, 0.941713, 0.866364, 0.740391, 0.555757, 0.804511, 0.81507, 0.731166, 0.516617, 0.492197, 0.163349, -0.100962, -0.169704, -0.273648, -0.4887, -0.550157, -0.785476, -1.042765, -1.221938, -1.262774] }, { "id": 54, "name": "Turkish Ney M", "low": 58, "high": 88, "spectrum": [-0.087558, -0.184075, 0.661196, 0.750039, 0.101076, 1, 0.943328, 0.464166, 0.902747, 0.549045, 0.824761, 0.744674, 0.560295, 0.57907, 0.530683, 0.456392, 0.536509, 0.369023, 0.357799, 0.272148, 0.338973, 0.204369, 0.166085, 0.121363, -0.08666] }, { "id": 55, "name": "Ud M", "low": 38, "high": 74, "spectrum": [0.722947, 0.95526, 1, 0.661549, 0.438065, 0.366484, 0.112913, -0.220173, -0.341514, -0.413923, -0.544657, -0.676504, -0.59233, -0.834059, -1.029427, -1.032767, -1.068981, -1.02564, -1.005257, -0.916712, -0.867323, -0.84338, -0.838293, -0.831131, -0.854973] }, { "id": 56, "name": "Vibraphone M", "low": 43, "high": 84, "spectrum": [0.041316, 0.790091, 1, 0.130174, -0.109182, -0.226867, -0.127271, 0.29062, 0.297066, -0.344511, -0.446326, -0.460377, -0.028384, -0.213193, -0.366679, -0.475415, -0.415894, -0.617242, -0.614434, -0.699916, -0.722634, -0.786445, -0.815931, -0.90739, -0.975882] }, { "id": 57, "name": "Viola S", "low": 52, "high": 91, "spectrum": [0.374264, 0.534407, 1, 0.601803, 0.840371, 0.754026, 0.784807, 0.724597, 0.717181, 0.524008, 0.709125, 0.779675, 0.602012, 0.465729, 0.579005, 0.538418, 0.373371, 0.304328, 0.161101, 0.157412, 0.081087, -0.104747, -0.176032, -0.324696, -0.331774] }, { "id": 58, "name": "Viola section muted S", "low": 51, "high": 81, "spectrum": [0.198462, 0.374886, 0.899043, 0.879296, 1, 0.812188, 0.721661, 0.570081, 0.597128, 0.550393, 0.404573, 0.48307, 0.35143, 0.220535, 0.181213, 0.1792, 0.150577, -0.047969, -0.250543, -0.360858, -0.484941, -0.629704, -0.677512, -0.781505, -0.919707] }, { "id": 59, "name": "Viola section portato S", "low": 48, "high": 81, "spectrum": [0.260419, 0.535202, 1, 0.97371, 0.933672, 0.911803, 0.81857, 0.562329, 0.442899, 0.536316, 0.51886, 0.403913, 0.362513, 0.215063, 0.145975, 0.142037, -0.016182, -0.275603, -0.49763, -0.634794, -0.788466, -0.896466, -0.925514, -0.994591, -0.989066] }, { "id": 60, "name": "Viola short S", "low": 52, "high": 91, "spectrum": [0.511323, 0.245805, 1, 0.363285, 0.279117, 0.151679, 0.131973, 0.042089, -0.271547, -0.563812, -0.426104, -0.413391, -0.451752, -0.649824, -0.664849, -0.695511, -0.784746, -0.932131, -1.085761, -1.186774, -1.277485, -1.46388, -1.553139, -1.692988, -1.846419] }, { "id": 61, "name": "Violin pizz S", "low": 56, "high": 88, "spectrum": [0.578234, 0.278337, 1, 0.318349, 0.657095, 0.4967, 0.205068, 0.103261, -0.179252, -0.551807, -0.267538, -0.492697, -0.687779, -0.680499, -0.707368, -0.854449, -0.981087, -0.991697, -1.052189, -1.129791, -1.18031, -1.270637, -1.347407, -1.501168, -1.675089] }, { "id": 62, "name": "Violin S", "low": 56, "high": 94, "spectrum": [-0.132399, -0.214117, 0.01205, 0.09502, -0.025481, -0.116169, -0.216829, -0.131427, -0.281537, -0.189381, -0.131447, -0.128904, 0.844989, 0.061637, 0.094605, 0.107635, 1, 0.428468, -0.014931, 0.74053, 0.502918, 0.010097, 0.198005, -0.034258, -0.449879] }, { "id": 63, "name": "Violin section S", "low": 56, "high": 95, "spectrum": [-0.128591, 0.260425, 0.343883, 1, 0.979565, 0.759211, 0.618008, 0.741229, 0.593109, 0.509917, 0.516376, 0.60272, 0.529661, 0.545051, 0.404965, 0.364207, 0.382232, 0.277743, 0.157064, -0.06397, -0.20859, -0.303988, -0.470973, -0.531465, -0.70769] }, { "id": 64, "name": "Violin pizz S", "low": 56, "high": 88, "spectrum": [0.586258, 0.263492, 1, 0.302829, 0.646763, 0.483533, 0.189935, 0.085464, -0.211215, -0.587655, -0.297766, -0.532055, -0.727559, -0.720103, -0.747089, -0.893321, -1.020319, -1.030468, -1.091012, -1.167001, -1.217986, -1.309448, -1.386334, -1.544119, -1.722126] }, { "id": 65, "name": "Violin S", "low": 56, "high": 94, "spectrum": [-0.133287, -0.214394, 0.01265, 0.096959, -0.023993, -0.115865, -0.216019, -0.130603, -0.280059, -0.188349, -0.132811, -0.128031, 0.843958, 0.061357, 0.095013, 0.107837, 1, 0.427109, -0.014085, 0.740672, 0.503058, 9408e-6, 0.198313, -0.03335, -0.449153] }, { "id": 66, "name": "Violin section S", "low": 56, "high": 95, "spectrum": [-0.12761, 0.260469, 0.34411, 1, 0.979501, 0.75941, 0.617582, 0.740695, 0.591828, 0.509609, 0.516269, 0.602445, 0.529161, 0.544954, 0.405029, 0.36455, 0.382117, 0.27786, 0.156978, -0.063817, -0.208385, -0.304045, -0.470829, -0.531625, -0.707368] }];

  // public/shared/timbre.js
  function timbresForPitch(records, pitch) {
    return records.filter((record) => pitch >= record.low && pitch <= record.high);
  }
  function nearestTimbres(records, target, count = 10) {
    if (!target?.length) return records.slice();
    return records.map((record) => ({ record, distance: Math.sqrt(record.spectrum.reduce((sum, value, index) => sum + (value - (target[index] ?? 0)) ** 2, 0)) })).sort((a, b) => a.distance - b.distance).slice(0, count).map((item) => item.record);
  }
  function chooseTextureTimbre(records, pitch, referenceSpectrum = null, nearestCount = 10) {
    const inRange = timbresForPitch(records, pitch), pool = nearestTimbres(inRange.length ? inRange : records, referenceSpectrum, nearestCount);
    return pool[randomInt(pool.length)] ?? null;
  }

  // public/shared/protocol-monitor.js
  var splitAddress = (address) => String(address || "").split("/").filter(Boolean);
  function classifyProtocolMessage(message = {}) {
    const address = String(message.address || ""), parts = splitAddress(address), namespace = parts[0] || "other";
    return {
      namespace: ["mc", "agent", "broadcast"].includes(namespace) ? namespace : "other",
      topic: parts.slice(1).join("/") || "(root)",
      address,
      source: message.source ?? null,
      args: Array.isArray(message.args) ? message.args.slice() : [],
      receivedAt: message.receivedAt ?? Date.now()
    };
  }
  function parseMonitorFields(args = []) {
    const fields = {};
    for (const value of args) {
      if (typeof value !== "string" || !value.includes("=")) continue;
      const separator = value.indexOf("="), key = value.slice(0, separator), raw = value.slice(separator + 1);
      if (!key) continue;
      fields[key] = raw.includes("_") ? raw.split("_").map((item) => {
        const number = Number(item);
        return Number.isFinite(number) ? number : item;
      }) : Number.isFinite(Number(raw)) ? Number(raw) : raw;
    }
    return fields;
  }
  var ProtocolMonitor = class {
    constructor(limit = 256) {
      this.limit = Math.max(1, Math.floor(limit));
      this.history = [];
      this.latest = /* @__PURE__ */ new Map();
    }
    capture(message) {
      const entry = classifyProtocolMessage(message);
      entry.fields = parseMonitorFields(entry.args);
      this.history.push(entry);
      if (this.history.length > this.limit) this.history.splice(0, this.history.length - this.limit);
      this.latest.set(entry.address, entry);
      return entry;
    }
    snapshot() {
      return {
        counts: this.history.reduce((counts, item) => (counts[item.namespace]++, counts), { mc: 0, agent: 0, broadcast: 0, other: 0 }),
        latest: Object.fromEntries(this.latest),
        history: this.history.map((item) => ({ ...item, args: item.args.slice(), fields: { ...item.fields } }))
      };
    }
    clear() {
      this.history.length = 0;
      this.latest.clear();
    }
  };

  // public/shared/message-router.js
  var normalizedAddress = (value) => {
    const address = String(value || "").trim();
    if (!address) return "";
    return address.startsWith("/") ? address : `/broadcast/${address}`;
  };
  function normalizeRouteRule(rule = {}) {
    const from = normalizedAddress(rule.from), to = normalizedAddress(rule.to);
    if (!from || !to) throw new TypeError("Message route rules require from and to addresses");
    return Object.freeze({
      from,
      to,
      source: rule.source == null ? null : String(rule.source),
      enabled: rule.enabled !== false,
      valueMode: rule.valueMode === "fixed" ? "fixed" : "preserve",
      value: rule.value
    });
  }
  function routeProtocolMessage(message, rule) {
    const normalized = normalizeRouteRule(rule);
    if (!normalized.enabled || String(message?.address || "") !== normalized.from) return null;
    if (normalized.source !== null && String(message?.source ?? "") !== normalized.source) return null;
    const args = normalized.valueMode === "fixed" ? Array.isArray(normalized.value) ? normalized.value.slice() : [normalized.value] : Array.isArray(message.args) ? message.args.slice() : [];
    return { address: normalized.to, args };
  }
  var MessageRouter = class {
    constructor(rules = []) {
      this.setRules(rules);
    }
    setRules(rules = []) {
      this.rules = rules.map(normalizeRouteRule);
      return this.rules;
    }
    addRule(rule) {
      const normalized = normalizeRouteRule(rule);
      this.rules.push(normalized);
      return normalized;
    }
    clear() {
      this.rules.length = 0;
    }
    route(message) {
      return this.rules.map((rule) => routeProtocolMessage(message, rule)).filter(Boolean);
    }
  };

  // public/shared/midi-analysis.js
  var mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  var deviation = (values) => {
    const average = mean(values);
    return values.length ? Math.sqrt(mean(values.map((value) => (value - average) ** 2))) : 0;
  };
  var clip = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  var MidiFeatureAnalyzer = class {
    constructor({ windowMs = 2e3, pitchRange = [36, 96], bendRange = 48, now = () => performance.now() } = {}) {
      this.windowMs = windowMs;
      this.pitchRange = pitchRange;
      this.bendRange = bendRange;
      this.now = now;
      this.bends = Array(16).fill(8192);
      this.active = /* @__PURE__ */ new Map();
      this.notes = [];
      this.onsets = [];
    }
    receive(bytes, time = this.now()) {
      const [status = 0, data1 = 0, data2 = 0] = bytes, kind = status & 240, channel = status & 15;
      if (kind === 224) {
        this.bends[channel] = data2 << 7 | data1;
        return;
      }
      const key = `${channel}:${data1}`;
      if (kind === 144 && data2 > 0) {
        const pitch = data1 + (this.bends[channel] - 8192) / 8192 * this.bendRange, event = { pitch, velocity: data2, onset: time, channel, note: data1 };
        this.active.set(key, event);
        this.onsets.push(time);
        return;
      }
      if (kind === 128 || kind === 144 && data2 === 0) {
        const event = this.active.get(key);
        if (event) {
          this.active.delete(key);
          this.notes.push({ ...event, duration: Math.max(0, time - event.onset) });
        }
      }
    }
    snapshot(time = this.now(), tempo = 120) {
      const cutoff = time - this.windowMs;
      this.notes = this.notes.filter((note) => note.onset >= cutoff);
      this.onsets = this.onsets.filter((onset) => onset >= cutoff);
      const sounding = [...this.notes, ...[...this.active.values()].filter((note) => note.onset >= cutoff).map((note) => ({ ...note, duration: time - note.onset }))], pitches = sounding.map((note) => note.pitch), velocities = sounding.map((note) => note.velocity), durations = sounding.map((note) => note.duration), onsetIntervals = this.onsets.slice(1).map((value, index) => value - this.onsets[index]), intervals = pitches.slice(1).map((value, index) => Math.abs(value - pitches[index])), beatMs = 6e4 / Math.max(1, tempo), range = Math.max(1, this.pitchRange[1] - this.pitchRange[0]);
      const raw = [mean(pitches), deviation(pitches), mean(intervals), mean(velocities), deviation(velocities), mean(durations), deviation(durations), mean(onsetIntervals), deviation(onsetIntervals), this.active.size];
      const normalized = [clip((raw[0] - this.pitchRange[0]) / range), clip(raw[1] / range), clip(raw[2] / range), clip(raw[3] / 127), clip(raw[4] / 127), clip(raw[5] / beatMs), clip(raw[6] / beatMs), clip(raw[7] / beatMs), clip(raw[8] / beatMs), clip(raw[9] / 10)];
      const complexity = clip(mean([normalized[1], normalized[2], normalized[4], normalized[6], normalized[8]])), consistency = clip(1 - mean([normalized[1], normalized[4], normalized[6], normalized[8]]));
      return { raw, normalized, complexity, consistency, eventCount: sounding.length };
    }
    clear() {
      this.active.clear();
      this.notes.length = 0;
      this.onsets.length = 0;
      this.bends.fill(8192);
    }
  };

  // public/shared/midi-input.js
  async function subscribeMidiInputs(handler, { navigatorObject = globalThis.navigator } = {}) {
    if (!navigatorObject?.requestMIDIAccess) return { access: null, inputs: [], close() {
    } };
    const access = await navigatorObject.requestMIDIAccess({ sysex: false }), listeners = [];
    const attach = (input) => {
      const listener = (event) => handler([...event.data], event.timeStamp, input);
      input.addEventListener("midimessage", listener);
      listeners.push([input, listener]);
    };
    for (const input of access.inputs.values()) attach(input);
    const stateListener = (event) => {
      if (event.port?.type === "input" && event.port.state === "connected" && !listeners.some(([input]) => input === event.port)) attach(event.port);
    };
    access.addEventListener?.("statechange", stateListener);
    return { access, inputs: [...access.inputs.values()], close() {
      for (const [input, listener] of listeners) input.removeEventListener("midimessage", listener);
      access.removeEventListener?.("statechange", stateListener);
      listeners.length = 0;
    } };
  }

  // public/shared/video-analysis.js
  var clip2 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  var FrameActivityAnalyzer = class {
    constructor({ width = 32, height = 24, smoothing = 6 } = {}) {
      this.width = width;
      this.height = height;
      this.smoothing = smoothing;
      this.previous = null;
      this.history = [];
    }
    analyze(data) {
      if (!data?.length) return 0;
      const luminance = new Float32Array(Math.floor(data.length / 4));
      let sum = 0;
      for (let pixel = 0, index = 0; index + 3 < data.length; pixel++, index += 4) {
        const value = (data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722) / 255;
        luminance[pixel] = value;
        sum += value;
      }
      const average = sum / luminance.length;
      let variance = 0, motion = 0;
      for (let index = 0; index < luminance.length; index++) {
        variance += (luminance[index] - average) ** 2;
        if (this.previous) motion += Math.abs(luminance[index] - this.previous[index]);
      }
      variance = Math.sqrt(variance / luminance.length);
      motion = this.previous ? motion / luminance.length : 0;
      this.previous = luminance;
      const activity = clip2(variance * 0.9 + motion * 2.2);
      this.history.push(activity);
      if (this.history.length > this.smoothing) this.history.shift();
      return this.history.reduce((total, value) => total + value, 0) / this.history.length;
    }
    clear() {
      this.previous = null;
      this.history.length = 0;
    }
  };
  async function openVideoFeatures({ navigatorObject = globalThis.navigator, documentObject = globalThis.document, width = 32, height = 24 } = {}) {
    if (!navigatorObject?.mediaDevices?.getUserMedia || !documentObject) throw new Error("Camera input is unavailable");
    const stream = await navigatorObject.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false }), video = documentObject.createElement("video"), canvas = documentObject.createElement("canvas"), context = canvas.getContext("2d", { willReadFrequently: true }), analyzer = new FrameActivityAnalyzer({ width, height });
    canvas.width = width;
    canvas.height = height;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    return { features() {
      context.drawImage(video, 0, 0, width, height);
      return { activity: analyzer.analyze(context.getImageData(0, 0, width, height).data) };
    }, stop() {
      video.pause();
      stream.getTracks().forEach((track) => track.stop());
      analyzer.clear();
    } };
  }

  // public/shared/network-bridge.js
  var copyArgs = (args) => Array.isArray(args) ? args.slice() : [];
  var isTime = (address) => String(address) === "/mc/time" || String(address).startsWith("/mc/time/");
  var isBroadcast = (address) => String(address).startsWith("/broadcast/");
  var LegacyLanBridge = class {
    constructor({ role = "slave", origin = "local", transport = () => {
    } } = {}) {
      this.role = role === "master" ? "master" : "slave";
      this.origin = String(origin);
      this.transport = transport;
      this.targets = [];
    }
    configure({ role = this.role, targets = this.targets } = {}) {
      this.role = role === "master" ? "master" : "slave";
      this.targets = [...new Set((targets || []).map(String).filter(Boolean))];
      return this.snapshot();
    }
    snapshot() {
      return { role: this.role, origin: this.origin, targets: this.targets.slice() };
    }
    forwardLocal(message) {
      const address = String(message?.address || "");
      if (message?.bridge?.origins?.includes(this.origin) || !isBroadcast(address) && !(this.role === "master" && isTime(address))) return false;
      this.transport({ address, args: copyArgs(message.args), bridge: { origins: [...message.bridge?.origins || [], this.origin], targets: this.targets.slice() } });
      return true;
    }
    receiveRemote(message) {
      const address = String(message?.address || "");
      if (message?.bridge?.origins?.includes(this.origin) || !isBroadcast(address) && !(this.role === "slave" && isTime(address))) return null;
      return { address, args: copyArgs(message.args), bridge: { origins: [...message.bridge?.origins || [], this.origin] } };
    }
  };

  // public/shared/form-development.js
  function formProgress(plan, clock = {}) {
    const sections = plan?.payload?.sections || [], phrase = Math.max(0, Number(clock.phrase) || 0), start = Number(plan?.appliesAt?.phrase) || 0, phraseBars = Math.max(1, Number(plan?.payload?.phraseBars) || Number(clock.meter?.phraseBars) || 1), barBased = Number.isFinite(Number(clock.bar)) && Number.isFinite(Number(plan?.appliesAt?.bar)), total = sections.reduce((sum, section2) => sum + Math.max(1, Number(section2.phrases) || 1), 0), local = Math.max(0, barBased ? Math.floor((Number(clock.bar) - Number(plan.appliesAt.bar)) / phraseBars) : phrase - start);
    let cursor = 0, index = 0;
    for (; index < sections.length - 1; index++) {
      const length2 = Math.max(1, Number(sections[index].phrases) || 1);
      if (local < cursor + length2) break;
      cursor += length2;
    }
    const section = sections[index] || null, length = Math.max(1, Number(section?.phrases) || 1);
    return { formPlanId: plan?.planId || null, revision: plan?.revision || 1, phrase: local, totalPhrases: total, sectionIndex: index, sectionRole: section?.role || null, sectionProgress: Math.min(1, Math.max(0, (local - cursor) / length)), overallProgress: total ? Math.min(1, local / total) : 0 };
  }
  function reviseFutureForm(plan, clock, adjustment = {}) {
    const sections = (plan?.payload?.sections || []).map((section) => ({ ...section })), progress = formProgress(plan, clock), operation = adjustment.operation || "extend-current";
    if (operation === "extend-current" && sections[progress.sectionIndex]) sections[progress.sectionIndex].phrases = Math.max(1, Number(sections[progress.sectionIndex].phrases) || 1) + Math.max(1, Number(adjustment.phrases) || 1);
    else if (operation === "insert-next") {
      sections.splice(progress.sectionIndex + 1, 0, { role: adjustment.role || "development", phrases: Math.max(1, Number(adjustment.phrases) || 1), rationale: adjustment.rationale || "Inserted during performance in response to ensemble development." });
    } else if (operation === "replace-future" && Array.isArray(adjustment.sections)) sections.splice(progress.sectionIndex + 1, Infinity, ...adjustment.sections.map((section) => ({ ...section })));
    else throw new TypeError(`Unsupported form adjustment: ${operation}`);
    return { ...plan.payload, sections, adjustment: { ...adjustment, at: progress } };
  }

  // public/agents.js
  var phrasePlanWindow = (clock) => {
    const phraseBars = clock.meter?.phraseBars || 4, createdAt = {
      bar: clock.bar || 0,
      phrase: clock.phrase || 0,
      section: clock.section || 0
    };
    return {
      createdAt,
      appliesAt: createdAt,
      expiresAt: {
        ...createdAt,
        bar: createdAt.bar + phraseBars,
        phrase: createdAt.phrase + 1
      },
      horizon: 1
    };
  };
  var ModalChordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.sections = [];
      this.phrase = -1;
      this.modeRoot = STOCHASTIC_CONFIG.modal.baseMidi;
      this.progression = this.generateProgression();
    }
    generateProgression() {
      const config = STOCHASTIC_CONFIG.modal, mode = config.modePitchClasses, count = Math.min(
        mode.length,
        weightedChoice(config.chordCounts, config.chordCountWeights)
      ), progression = [], bassline = scramble([...mode.keys()]).slice(0, count);
      for (const degree of bassline) {
        const root = this.modeRoot + mode[degree], third = this.modeRoot + mode[(degree + 2) % mode.length] + (degree + 2 >= mode.length ? 12 : 0), fifth = this.modeRoot + mode[(degree + 4) % mode.length] + (degree + 4 >= mode.length ? 12 : 0);
        progression.push([root, third, fifth, root + config.extensionSemitones]);
      }
      if (this.sections.length < config.sectionCapacity)
        this.sections.push(progression);
      return progression;
    }
    chooseProgression() {
      const config = STOCHASTIC_CONFIG.modal, createNew = this.sections.length < 2 || weightedChoice([true, false], config.newVersusRecallWeights);
      this.progression = createNew ? this.generateProgression() : this.sections[randomInt(this.sections.length)];
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/density") && Number(message.args.at(-1)) > 0.82)
        this.chooseProgression();
    }
    onTick(tick, clock = {
      barStart: tick % 16 === 0,
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64)
    }) {
      if (!clock.barStart) return;
      const phrase = clock.phrase;
      if (phrase !== this.phrase) {
        this.phrase = phrase;
        if (phrase > 0 && phrase % STOCHASTIC_CONFIG.modal.minimumPhrasesBetweenChanges === 0)
          this.chooseProgression();
        this.publishPlan(
          "harmony",
          {
            schemaVersion: 1,
            chords: this.progression.map((chord2) => [...chord2]),
            durations: this.progression.map(
              () => STOCHASTIC_CONFIG.modal.chordDurationBeats
            )
          },
          {
            ...phrasePlanWindow(clock),
            confidence: 0.72,
            priority: 0.55,
            rationale: "Share the complete current modal progression atomically so other agents can plan against it."
          }
        );
      }
      const chord = this.progression[clock.bar % this.progression.length];
      this.broadcast("notepool", chord);
      this.broadcast(
        "pcprob",
        STOCHASTIC_CONFIG.modal.chordProbabilities.slice(0, chord.length)
      );
      this.broadcast(
        "plan/chords",
        this.progression.map((chord2) => chord2.join(" "))
      );
      this.broadcast(
        "plan/chordDuration",
        this.progression.map(() => STOCHASTIC_CONFIG.modal.chordDurationBeats)
      );
      this.audio.chord(chord);
    }
  };
  var MilesChordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.progression = [[60, 64, 67, 70]];
      this.phrase = -1;
    }
    async start() {
      const response = await fetch("./data/miles-harmony.json");
      this.corpus = await response.json();
      this.generateCorpusProgression();
    }
    chordNotes(shape, root) {
      return shape.split("_").map(Number).map((interval) => 60 + root + interval);
    }
    generateCorpusProgression() {
      if (!this.corpus) return;
      const shapes = Object.keys(this.corpus), initial = weightedChoice(
        shapes,
        shapes.map((shape2) => this.corpus[shape2].initial || 0)
      );
      let shape = initial;
      this.progression = [];
      for (let i = 0; i < 4; i++) {
        const record = this.corpus[shape], transitions = Object.entries(record).filter(
          ([key2, value]) => key2.endsWith(">") && !key2.startsWith(">") && Array.isArray(value)
        );
        if (!transitions.length) break;
        const [key, rootWeights] = weightedChoice(
          transitions,
          transitions.map(([, weights]) => weights.reduce((a, b) => a + b, 0))
        );
        const root = weightedChoice([...Array(12).keys()], rootWeights);
        shape = key.slice(0, -1);
        this.progression.push(this.chordNotes(shape, root));
      }
      if (!this.progression.length)
        this.progression = [this.chordNotes(initial, 0)];
    }
    onTick(tick, clock = {
      barStart: tick % 16 === 0,
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64)
    }) {
      if (!clock.barStart) return;
      const phrase = clock.phrase;
      if (phrase !== this.phrase) {
        this.phrase = phrase;
        this.generateCorpusProgression();
        this.publishPlan(
          "harmony",
          {
            schemaVersion: 1,
            chords: this.progression.map((chord2) => [...chord2]),
            durations: [1, 1, 2, 2].slice(0, this.progression.length)
          },
          {
            ...phrasePlanWindow(clock),
            confidence: 0.7,
            priority: 0.55,
            rationale: "Share the generated corpus progression atomically for ensemble anticipation."
          }
        );
      }
      const chord = this.progression[clock.bar % this.progression.length];
      this.broadcast("notepool", chord);
      this.broadcast("pcprob", [0.95, 0.7, 0.85, 0.65]);
      this.broadcast("plan/chords", this.progression.flat());
      this.broadcast("plan/chordDuration", [1, 1, 2, 2]);
      this.audio.chord(chord);
    }
  };
  var SwingChordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.harmony = null;
      this.melody = null;
      this.phraseBars = this.config.initialPhraseBars;
      this.harmonicRhythm = this.config.harmonicRhythm;
      this.sections = /* @__PURE__ */ new Map();
      this.section = "A";
      this.progression = [];
      this.lastPhrase = -1;
      this.lastChord = -1;
    }
    configuration() {
      return STOCHASTIC_CONFIG.swingChord;
    }
    corpusPaths() {
      return [
        "./data/swing-standards-harmony.json",
        "./data/swing-standards-melody.json"
      ];
    }
    async start() {
      const [harmony, melody] = await Promise.all(
        this.corpusPaths().map(
          (path) => fetch(path).then((response) => response.json())
        )
      );
      this.harmony = harmony;
      this.melody = melody;
      this.generateProgression();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
      if (message.address.endsWith("/harmrhythm") || message.address.endsWith("/harmonicrhythm")) {
        const value = Number(message.args.at(-1));
        if (this.config.allowedHarmonicRhythms.includes(value))
          this.harmonicRhythm = value;
      }
      if (message.address.endsWith("/section")) {
        const label = String(message.args.at(-1) || "A");
        this.section = label;
        if (this.sections.has(label))
          this.progression = this.sections.get(label).map((item) => ({
            ...item,
            chord: [...item.chord],
            probabilities: [...item.probabilities]
          }));
        else {
          this.generateProgression();
          this.sections.set(
            label,
            this.progression.map((item) => ({
              ...item,
              chord: [...item.chord],
              probabilities: [...item.probabilities]
            }))
          );
        }
        this.publishPlan();
      }
    }
    probabilities(shape, root) {
      const record = this.melody?.[shape] || {}, weights = record.ngram || record.initial || [];
      return normalizeProbabilityVector(
        Array.from({ length: 12 }, (_, pc) => weights[(pc - root + 12) % 12])
      );
    }
    generateProgression() {
      if (!this.harmony) return;
      const target = Math.max(
        1,
        this.phraseBars * this.config.beatsPerAssumedBar
      ), items = [];
      let shape = corpusInitialShape(this.harmony), root = weightedPitchClass(this.harmony[shape]?.initial), duration = 0;
      while (duration < target && items.length < this.config.maximumChords) {
        const observed = observedDuration(this.harmony[shape], 1), beats = Math.min(target - duration, observed * this.harmonicRhythm), chord = transposeChord(shape, root, this.config.baseMidi);
        items.push({
          shape,
          root,
          chord,
          duration: beats,
          probabilities: this.probabilities(shape, root)
        });
        duration += beats;
        ({ shape, root } = corpusNextChord(this.harmony, shape));
      }
      this.progression = items.length ? items : [
        {
          shape: "0_3_7",
          root: 0,
          chord: [60, 63, 67],
          duration: target,
          probabilities: [1, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0, 0]
        }
      ];
    }
    publishPlan(clock) {
      if (!this.progression.length) return;
      this.broadcast(
        "plan/chords",
        this.progression.map((item) => item.chord.join(" "))
      );
      this.broadcast(
        "plan/chordDuration",
        this.progression.map((item) => item.duration)
      );
      if (clock)
        super.publishPlan(
          "harmony",
          {
            schemaVersion: 1,
            chords: this.progression.map((item) => [...item.chord]),
            durations: this.progression.map((item) => item.duration),
            section: this.section
          },
          {
            ...phrasePlanWindow(clock),
            confidence: 0.78,
            priority: 0.6,
            rationale: "Publish chords and durations as one future-plan snapshot while retaining the legacy paired messages."
          }
        );
    }
    chordIndex(clock) {
      const position = clock.bar % (clock.meter.phraseBars || this.phraseBars) * this.config.beatsPerAssumedBar + (clock.beat || 0), durations = this.progression.map((item) => item.duration);
      let total = 0;
      for (let index = 0; index < durations.length; index++) {
        total += durations[index];
        if (position < total) return index;
      }
      return durations.length - 1;
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      beatStart: tick % 4 === 0,
      meter: { phraseBars: 8 }
    }) {
      if (!this.harmony) return;
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        if (!this.sections.has(this.section)) {
          this.generateProgression();
          this.sections.set(
            this.section,
            this.progression.map((item2) => ({
              ...item2,
              chord: [...item2.chord],
              probabilities: [...item2.probabilities]
            }))
          );
        }
        this.publishPlan(clock);
        this.lastChord = -1;
      }
      if (!clock.beatStart && !clock.phraseStart) return;
      const index = this.chordIndex(clock);
      if (index === this.lastChord) return;
      this.lastChord = index;
      const item = this.progression[index];
      this.broadcast("notepool", item.chord);
      this.broadcast("pcprob", item.probabilities);
    }
  };
  var MethenyChordBot = class extends SwingChordBot {
    configuration() {
      return STOCHASTIC_CONFIG.methenyChord;
    }
    corpusPaths() {
      return ["./data/metheny-harmony.json", "./data/metheny-melody.json"];
    }
  };
  var XChordBot = class extends SwingChordBot {
    configuration() {
      return STOCHASTIC_CONFIG.xChord;
    }
    corpusPaths() {
      return ["./data/metheny-harmony.json", "./data/metheny-melody.json"];
    }
    constructor(...args) {
      super(...args);
      this.enabled = true;
      this.exiting = false;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/initialize")) {
        this.generateProgression();
        this.publishPlan();
        this.lastChord = -1;
      }
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/section") || message.address.endsWith("/phraselength"))
        this.broadcast("harmrhythm", [
          this.progression.length ? this.phraseBars / this.progression.length : this.harmonicRhythm
        ]);
    }
    onTick(tick, clock = { bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (this.enabled && !this.exiting) super.onTick(tick, clock);
    }
  };
  var MozartChordBot = class extends SwingChordBot {
    configuration() {
      return STOCHASTIC_CONFIG.mozartChord;
    }
    corpusPaths() {
      return ["./data/mozart-harmony.json", "./data/mozart-melody.json"];
    }
    constructor(...args) {
      super(...args);
      this.enabled = true;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/initialize")) {
        this.generateProgression();
        this.publishPlan();
        this.lastChord = -1;
      }
    }
    onTick(tick, clock = { tick: 0, tickInBar: 0, bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (this.enabled) super.onTick(tick, clock);
    }
  };
  var BowedBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.bowed;
      this.chords = [];
      this.chordDurations = [];
      this.phraseBars = this.config.phraseBars;
      this.lastChord = -1;
      this.lastPhrase = -1;
      this.curve = [];
      this.generateCurve();
    }
    generateCurve() {
      this.curve = randomFivePointCurve({
        xRanges: this.config.phraseCurveXRanges,
        terminalWeights: this.config.phraseCurveTerminalWeights
      });
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/plan/chords")) {
        const plan = parseChordPlan(
          message.args.slice(message.args[0] === message.source ? 1 : 0)
        );
        if (plan.length) this.chords = plan;
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const values = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (values.length) this.chordDurations = values;
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
    }
    currentPlan(clock) {
      const chords = this.chords.length ? this.chords : [this.notes], durations = this.chordDurations.length === chords.length ? this.chordDurations : Array(chords.length).fill(
        this.phraseBars * this.config.assumedBeatsPerBar / chords.length
      ), position = clock.bar % (clock.meter.phraseBars || this.phraseBars) * this.config.assumedBeatsPerBar + (clock.beat || 0);
      let total = 0, index = durations.length - 1;
      for (let i = 0; i < durations.length; i++) {
        total += durations[i];
        if (position < total) {
          index = i;
          break;
        }
      }
      return {
        index,
        chord: chords[index] || chords[0],
        position: position / (this.phraseBars * this.config.assumedBeatsPerBar)
      };
    }
    voiceChord(values) {
      const pitchClasses = values.map(pitchClass).filter((value) => value !== null), unique = [...new Set(pitchClasses)].sort((a, b) => a - b);
      if (!unique.length) return [60, 67];
      const right = [];
      let previous = 59;
      for (const pc of unique) {
        let note = 60 + pc;
        while (note <= previous) note += 12;
        right.push(note);
        previous = note;
      }
      const bass = Math.max(36, Math.min(59, Math.min(...right) - 24));
      return [bass, ...right];
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      beatStart: tick % 4 === 0,
      meter: { phraseBars: 4 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.lastChord = -1;
        this.generateCurve();
      }
      if (!clock.beatStart && !clock.phraseStart) return;
      const plan = this.currentPlan(clock), curve2 = Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.curve, plan.position))
      ), probability = Math.max(
        this.config.minimumAttackProbability,
        Math.min(1, this.density * curve2)
      );
      if (plan.index === this.lastChord || !clock.phraseStart && !this.instanceAllows(clock, 19, probability))
        return;
      this.lastChord = plan.index;
      const notes = this.voiceChord(plan.chord), duration = this.config.durationSecondsRange[0] + unitRandom() * (this.config.durationSecondsRange[1] - this.config.durationSecondsRange[0]);
      this.audio.bowedTexture(notes, duration, 0.25 + 0.65 * curve2);
    }
  };
  var DroneBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.memoryDevelopmentEnabled = true;
      this.config = STOCHASTIC_CONFIG.drone;
      this.chords = [];
      this.chordDurations = [];
      this.phraseBars = this.config.phraseBars;
      this.currentPitch = null;
      this.lastChord = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool")) this.lastChord = -1;
      if (message.address.endsWith("/plan/chords")) {
        const values = parseChordPlan(message.args);
        if (values.length) {
          this.chords = values;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const values = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (values.length) {
          this.chordDurations = values;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
    }
    mostCommonPitchClass() {
      const counts = /* @__PURE__ */ new Map();
      for (const chord of this.chords)
        for (const note of chord) {
          const pc = pitchClass(note);
          if (pc !== null) counts.set(pc, (counts.get(pc) || 0) + 1);
        }
      return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    }
    onMemoryRecall(motifs = []) {
      const recalled = motifs.slice().reverse().find(
        (motif) => motif.author !== this.instanceId && motif.events?.some((event) => event.pitches?.some(Number.isFinite))
      );
      if (!recalled) return;
      const pitches = recalled.events.flatMap((event) => event.pitches || []).map(Number).filter(Number.isFinite);
      if (pitches.length) {
        this.notes = [...new Set(pitches)];
        this.lastChord = -1;
      }
    }
    currentPlan(clock) {
      const chords = this.chords.length ? this.chords : [this.notes], durations = this.chordDurations.length === chords.length ? this.chordDurations : Array(chords.length).fill(
        this.phraseBars * this.config.assumedBeatsPerBar / chords.length
      ), position = clock.bar % (clock.meter.phraseBars || this.phraseBars) * this.config.assumedBeatsPerBar + (clock.beat || 0);
      let total = 0, index = durations.length - 1;
      for (let i = 0; i < durations.length; i++) {
        total += durations[i];
        if (position < total) {
          index = i;
          break;
        }
      }
      return { index, chord: chords[index], duration: durations[index] };
    }
    choosePitch(chord) {
      const pcs = [
        ...new Set(chord.map(pitchClass).filter((value) => value !== null))
      ], common = this.mostCommonPitchClass();
      let pc = pcs.includes(common) ? common : pcs[0] ?? pitchClass(this.notes[0]);
      if (this.currentPitch != null)
        pc = pcs.reduce(
          (best, value) => Math.abs(this.config.baseMidi + value - this.currentPitch) < Math.abs(this.config.baseMidi + best - this.currentPitch) ? value : best,
          pc
        );
      let note = this.config.baseMidi + pc;
      while (note > this.config.range[1]) note -= 12;
      while (note < this.config.range[0]) note += 12;
      return note;
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      bar: 0,
      beat: 0,
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { phraseBars: 8 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastMemoryPhrase && (clock.phrase || 0) % 4 === 0) {
        this.lastMemoryPhrase = clock.phrase;
        this.consultMemory({ limit: 12 });
      }
      if (!clock.beatStart && !clock.phraseStart) return;
      const plan = this.currentPlan(clock);
      if (plan.index === this.lastChord) return;
      this.lastChord = plan.index;
      this.currentPitch = this.choosePitch(plan.chord);
      const duration = Math.max(
        this.config.minimumSeconds,
        plan.duration * 60 / (clock.bpm || 108)
      );
      this.audio.dronePad(this.currentPitch, duration, this.density);
    }
  };
  var PadBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.pad;
      this.chords = [];
      this.chordDurations = [];
      this.phraseBars = this.config.phraseBars;
      this.lastChord = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool")) this.lastChord = -1;
      if (message.address.endsWith("/plan/chords")) {
        const values = parseChordPlan(message.args);
        if (values.length) {
          this.chords = values;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const values = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (values.length) {
          this.chordDurations = values;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
    }
    currentPlan(clock) {
      const chords = this.chords.length ? this.chords : [this.notes], durations = this.chordDurations.length === chords.length ? this.chordDurations : Array(chords.length).fill(
        this.phraseBars * this.config.assumedBeatsPerBar / chords.length
      ), position = clock.bar % (clock.meter.phraseBars || this.phraseBars) * this.config.assumedBeatsPerBar + (clock.beat || 0);
      let total = 0, index = durations.length - 1;
      for (let i = 0; i < durations.length; i++) {
        total += durations[i];
        if (position < total) {
          index = i;
          break;
        }
      }
      return {
        index,
        chord: chords[index],
        duration: durations[index],
        phrasePosition: position / (this.phraseBars * this.config.assumedBeatsPerBar)
      };
    }
    voiceChord(chord) {
      const pcs = [
        ...new Set(chord.map(pitchClass).filter((value) => value !== null))
      ].sort((a, b) => a - b), count = Math.max(
        1,
        Math.min(pcs.length, Math.ceil(pcs.length * this.density))
      ), selected = pcs.slice(0, count), notes = [];
      let previous = this.config.range[0] - 1;
      for (const pc of selected) {
        let note = this.config.baseMidi + pc;
        while (note <= previous) note += 12;
        if (note <= this.config.range[1]) {
          notes.push(note);
          previous = note;
        }
      }
      return notes.length ? notes : [this.config.baseMidi];
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      bar: 0,
      beat: 0,
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { phraseBars: 8 }
    }) {
      if (!clock.beatStart && !clock.phraseStart) return;
      const plan = this.currentPlan(clock);
      if (plan.index === this.lastChord) return;
      this.lastChord = plan.index;
      const notes = this.voiceChord(plan.chord), duration = Math.max(
        this.config.minimumSeconds,
        plan.duration * 60 / (clock.bpm || 108)
      ), openness = this.config.filterStart + (this.config.filterEnd - this.config.filterStart) * Math.max(0, Math.min(1, plan.phrasePosition));
      this.audio.padChord(notes, duration, this.density, openness);
    }
  };
  var NewDroneBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.newDrone;
      this.activityMask = [
        ...weightedChoice(this.config.sourceMasks, this.config.sourceMaskWeights)
      ];
      this.receivedMasks = [];
      this.lastPhrase = -1;
      this.lastCell = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      const intent = parseCompoundIntent(message);
      if (intent?.activityMask && intent.sender !== "ae_newDroneBOT" && intent.sender !== this.instanceId)
        this.receivedMasks.push(intent.activityMask);
      else if (message.address === "/broadcast/intent/activityMask")
        this.receivedMasks.push(normalizeActivityMask(message.args));
    }
    beginPhrase(phrase) {
      if (this.lastPhrase >= 0 && this.receivedMasks.length) {
        const complement = complementaryActivityMask(this.receivedMasks), ranked = complement.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index), mask = Array(16).fill(0);
        for (const item of scramble(
          ranked.slice(0, this.config.activeCells * 2)
        ).slice(0, this.config.activeCells))
          mask[item.index] = 1;
        this.activityMask = mask;
      }
      this.receivedMasks = [];
      this.lastPhrase = phrase;
      this.lastCell = -1;
      this.broadcast(
        "intent",
        serializeIntentFields("ae_newDroneBOT", {
          activityMask: this.activityMask
        })
      );
    }
    highNote() {
      const pcs = [
        ...new Set(
          this.notes.map(pitchClass).filter((value) => value !== null)
        )
      ], pc = pcs[randomInt(pcs.length)] ?? 0;
      let note = this.config.range[0] + pc;
      while (note < this.config.range[0]) note += 12;
      while (note > this.config.range[1]) note -= 12;
      return note;
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      subdivision: 0,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase)
        this.beginPhrase(clock.phrase);
      const cell = cycleIndexAtPhrasePosition(clock, 16);
      if (cell === this.lastCell) return;
      this.lastCell = cell;
      if (!this.activityMask[cell]) return;
      const duration = this.config.durationSecondsRange[0] + randomInt(
        this.config.durationSecondsRange[1] - this.config.durationSecondsRange[0]
      );
      this.audio.highDrone(this.highNote(), duration, 0.35 + 0.5 * this.density);
    }
  };
  var MhDroneBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.mhDrone;
      this.targetDensity = this.density;
      this.targetActivity = this.config.activity;
      this.activity = this.targetActivity;
      this.playing = true;
      this.stateUntilTick = null;
      this.stateStarted = false;
    }
    onMessage(message) {
      if (!message.address.endsWith("/hdensity")) super.onMessage(message);
      if (message.address.endsWith("/hdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.targetDensity = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.targetActivity = Math.max(0, Math.min(1, value));
      }
    }
    smooth() {
      const amount = this.config.controlSmoothing;
      this.density += (this.targetDensity - this.density) * amount;
      this.activity += (this.targetActivity - this.activity) * amount;
    }
    durationSeconds(playing) {
      const [low, high] = this.config.durationRandomPercentRange, variation = (low + randomInt(high - low)) / 100;
      return playing ? variation * (this.config.playDurationScale * (1 - this.activity)) + 1 : variation * (this.config.breakDurationScale * this.activity) + 1;
    }
    durationTicks(clock, playing) {
      return Math.max(
        1,
        Math.round(
          this.durationSeconds(playing) * (clock.bpm || 108) / 60 * (clock.meter?.subdivision || 4)
        )
      );
    }
    note() {
      const pcs = [
        ...new Set(
          this.notes.map(pitchClass).filter((value) => value !== null)
        )
      ], pc = pcs[randomInt(pcs.length)] ?? randomInt(12), octave = this.config.octaves[randomInt(this.config.octaves.length)];
      return pc + 12 * octave;
    }
    tremolo() {
      return this.config.tremoloBaseRange[0] + unitRandom() * (this.config.tremoloBaseRange[1] - this.config.tremoloBaseRange[0]) + unitRandom() * this.density * this.config.tremoloDensityRange;
    }
    onTick(tick, clock = { beatStart: tick % 4 === 0, bpm: 108, meter: { subdivision: 4 } }) {
      if (clock.beatStart) this.smooth();
      if (this.stateUntilTick == null || tick >= this.stateUntilTick) {
        if (this.stateUntilTick != null) this.playing = !this.playing;
        this.stateUntilTick = tick + this.durationTicks(clock, this.playing);
        this.stateStarted = false;
      }
      if (this.playing && !this.stateStarted) {
        this.stateStarted = true;
        this.audio.wubDrone(
          this.note(),
          this.durationSeconds(true),
          this.tremolo(),
          this.density
        );
      }
    }
  };
  var SequencerBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.sequencer;
      this.notes = [...this.config.defaultNotePool];
      this.stepsPerBeat = weightedChoice(
        this.config.stepsPerBeatChoices,
        this.config.stepsPerBeatWeights
      );
      this.pattern = [];
      this.phraseBars = this.config.phraseBars;
      this.lastStep = null;
      this.generatePattern();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
      if (message.address.endsWith("/notepool")) this.generatePattern();
    }
    generatePattern() {
      const pool = octaveExpandedPool(
        this.notes,
        this.config.octaveOffsets,
        this.config.pitchRange
      ), [low, high] = this.config.patternLengthRange, length = low + randomInt(high - low + 1);
      let index = randomInt(Math.max(1, pool.length));
      this.pattern = Array.from({ length }, () => {
        index = reflectedWalk(
          index,
          weightedChoice(this.config.walkDeltas, this.config.walkWeights),
          pool.length
        );
        return pool[index] ?? 60;
      });
      this.lastStep = null;
    }
    densityGate(position) {
      const [minimum, knee, , floor] = this.config.densityCurve;
      if (this.density <= minimum) return floor;
      return Math.max(
        floor,
        Math.min(1, (this.density - minimum) / Math.max(1e-3, knee - minimum))
      );
    }
    render(note, duration, velocity) {
      this.audio.sequencerNote(note, duration, velocity);
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      subdivision: tick % 4,
      bpm: 108,
      meter: { subdivision: 4, phraseBars: 8 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.generatePattern();
      }
      const local = sourceStep(clock, this.stepsPerBeat), key = `${clock.bar}:${local}`;
      if (key === this.lastStep) return;
      this.lastStep = key;
      const step = clock.bar % (clock.meter.phraseBars || this.phraseBars) * Math.max(1, (clock.meter.numerator || 4) * this.stepsPerBeat) + local, gate = this.densityGate(step);
      if (unitRandom() > gate || !this.instanceAllows(clock, 31, Math.max(this.config.minimumGate, gate)))
        return;
      const note = this.pattern[step % this.pattern.length], duration = this.config.noteDurationBeats * 60 / (clock.bpm || 108), [low, high] = this.config.velocityRange, velocity = this.shapeVelocity(low + (high - low) * gate, note, {
        clock,
        division: local,
        divisions: this.stepsPerBeat
      });
      this.render(note, duration, velocity);
    }
  };
  var PapMelody2Bot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.notePoolLease = new BoundaryPresenceLease(
        this.config.notePoolSilenceBars
      );
      this.densityLease = new BoundaryPresenceLease(
        this.config.densitySilenceBars
      );
      this.phraseBars = weightedChoice(
        this.config.phraseLengths,
        this.config.phraseLengths.map(() => 1)
      );
      this.curve = [];
      this.bag = [];
      this.lastBar = null;
      this.lastPhrase = null;
      this.generateInternalPool();
      this.generateCurve();
    }
    configuration() {
      return STOCHASTIC_CONFIG.papMelody2;
    }
    generateInternalPool() {
      const [low, high] = this.config.tonicRange, tonic = low + randomInt(high - low + 1), mode = weightedChoice(
        this.config.modes,
        this.config.modes.map(() => 1)
      );
      this.internalNotes = mode.map((interval) => tonic + interval);
      if (this.notePoolLease.ownsFallback) this.notes = [...this.internalNotes];
    }
    generateCurve() {
      this.curve = randomFivePointCurve({
        xRanges: this.config.phraseCurveXRanges,
        terminalWeights: this.config.phraseCurveTerminalWeights
      });
    }
    onMessage(message) {
      const isPool = message.address.endsWith("/notepool"), isDensity = message.address.endsWith("/density") && !message.address.endsWith("/vdensity");
      super.onMessage(message);
      if (isPool) {
        const values = message.args.map(Number).filter(Number.isFinite);
        if (values.length) this.notePoolLease.receive();
      }
      if (isDensity) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.density = Math.max(0, Math.min(1, value));
          this.densityLease.receive();
        }
      }
    }
    drawNote() {
      if (!this.bag.length) this.bag = scramble([...new Set(this.notes)]);
      return this.bag.pop() ?? 60;
    }
    phraseDensity(clock) {
      if (!this.densityLease.ownsFallback) return this.density;
      const bars = clock.meter?.phraseBars || this.phraseBars, position = ((clock.bar || 0) % bars + Math.max(
        0,
        Math.min(1, (clock.beat || 0) / (clock.meter?.numerator || 4))
      )) / bars;
      return Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.curve, position))
      );
    }
    chooseTuplet(density) {
      return densityWeightedTuplet(density, {
        divisions: this.config.tupletDivisions,
        baseWeights: this.config.tupletBaseWeights,
        densityPowers: this.config.tupletDensityPowers
      });
    }
    boundary(clock) {
      if (clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      if (this.notePoolLease.advanceBoundary()) {
        this.generateInternalPool();
        this.bag = [];
      }
      this.densityLease.advanceBoundary();
    }
    renderNote(note, duration, velocity, offset) {
      this.audio.papMelody(note, duration, velocity, offset);
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64),
      beat: Math.floor(tick % 16 / 4),
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      this.boundary(clock);
      if (clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.phraseBars = weightedChoice(
          this.config.phraseLengths,
          this.config.phraseLengths.map(() => 1)
        );
        this.generateCurve();
        if (this.notePoolLease.ownsFallback) this.generateInternalPool();
      }
      if (!clock.beatStart) return;
      const density = this.phraseDensity(clock), divisions = this.chooseTuplet(density), beatSeconds = 60 / (clock.bpm || 108), [low, high] = this.config.velocityRange, base = low + (high - low) * density;
      for (const index of filteredTupletMembers(
        divisions,
        density,
        this.config.memberProbabilityFloor
      )) {
        const note = this.drawNote(), velocity = this.shapeVelocity(base, note, {
          clock,
          division: index,
          divisions,
          voice: 0
        });
        this.renderNote(
          note,
          beatSeconds / divisions * this.config.noteDurationFraction,
          velocity,
          index * beatSeconds / divisions
        );
      }
    }
  };
  var LaverneBot = class extends PapMelody2Bot {
    constructor(...args) {
      super(...args);
      this.preset = randomInt(this.config.presets.length);
    }
    configuration() {
      return STOCHASTIC_CONFIG.laverne;
    }
    // The original Laverne event source explicitly fixes velocity at 110/127.
    shapeVelocity(base) {
      return base;
    }
    renderNote(note, duration, velocity, offset) {
      this.audio.laverne(
        note,
        duration,
        velocity,
        offset,
        this.config.presets[this.preset],
        this.preset
      );
    }
  };
  var PapMelodyBot = class extends PapMelody2Bot {
    constructor(...args) {
      super(...args);
      this.familyConfig = STOCHASTIC_CONFIG.papMelody;
      this.voiceBags = [[], [], []];
      this.walkIndex = 0;
    }
    fitToRange(note, range) {
      let value = Number(note);
      while (value < range[0]) value += 12;
      while (value > range[1]) value -= 12;
      return Math.max(range[0], Math.min(range[1], value));
    }
    voiceNote(index) {
      const range = this.familyConfig.voiceRanges[index], pool = index === 0 ? this.notes : this.internalNotes;
      if (index === 1) {
        this.walkIndex = reflectedWalk(
          this.walkIndex,
          weightedChoice(
            this.familyConfig.drunkDeltas,
            this.familyConfig.drunkWeights
          ),
          pool.length
        );
        return this.fitToRange(pool[this.walkIndex] ?? 60, range);
      }
      if (!this.voiceBags[index].length)
        this.voiceBags[index] = scramble([...pool]);
      return this.fitToRange(this.voiceBags[index].pop() ?? 60, range);
    }
    announceForm() {
      this.broadcast("meter", [
        this.phraseBars * this.familyConfig.legacyMeterMultiplier,
        this.familyConfig.legacyMeterDenominator
      ]);
      this.broadcast("density", [this.density]);
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64),
      beat: Math.floor(tick % 16 / 4),
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      this.boundary(clock);
      if (clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.phraseBars = weightedChoice(
          this.config.phraseLengths,
          this.config.phraseLengths.map(() => 1)
        );
        this.generateCurve();
        this.generateInternalPool();
        this.voiceBags = [[], [], []];
        this.announceForm();
      }
      if (!clock.beatStart) return;
      const density = this.phraseDensity(clock), divisions = this.chooseTuplet(density), beatSeconds = 60 / (clock.bpm || 108), [low, high] = this.config.velocityRange, base = low + (high - low) * density;
      for (const division of filteredTupletMembers(
        divisions,
        density,
        this.config.memberProbabilityFloor
      )) {
        let voices = [0, 1, 2].filter(
          () => unitRandom() < this.familyConfig.voicePlayProbability
        );
        if (!voices.length) voices = [division % 3];
        for (const voice of voices) {
          const note = this.voiceNote(voice), velocity = this.shapeVelocity(base, note, {
            clock,
            division,
            divisions,
            voice
          });
          this.audio.papMelodyVoice(
            note,
            beatSeconds / divisions * this.config.noteDurationFraction,
            velocity,
            division * beatSeconds / divisions,
            voice
          );
        }
      }
    }
  };
  var PapMelody4Bot = class extends PapMelody2Bot {
    constructor(...args) {
      super(...args);
      this.familyConfig = STOCHASTIC_CONFIG.papMelody4;
      this.scaleIndex = 6;
      this.modulation = 0;
      this.applyScale(false);
    }
    boundary(clock) {
      if (clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      const hadPool = this.notePoolLease.ownsFallback;
      if (this.notePoolLease.advanceBoundary() && !hadPool) this.applyScale(true);
      this.densityLease.advanceBoundary();
    }
    applyScale(announce = true) {
      let scale = [...this.familyConfig.majorScales[this.scaleIndex]], mode = "major";
      if (unitRandom() < this.familyConfig.modalChangeProbability) {
        const table = this.modulation < 0 ? this.familyConfig.minorModalInflections : this.familyConfig.majorModalInflections, inflection = weightedChoice(
          table,
          table.map(() => 1)
        );
        scale = scale.map((note, index) => note + inflection[index]);
        mode = this.modulation < 0 ? "minor-inflection" : "major-inflection";
      }
      this.internalNotes = [
        ...new Set(
          scale.slice(0, 7).map((note) => this.familyConfig.tonic + note)
        )
      ];
      this.notes = [...this.internalNotes];
      this.bag = [];
      this.mode = mode;
      if (announce) this.broadcast("notepool", this.notes);
    }
    modulate() {
      if (unitRandom() < this.familyConfig.modulationProbability) {
        const span = Math.max(1, Math.min(this.familyConfig.modulationSize, 7)), size = 1 + randomInt(span), direction = unitRandom() < 0.5 ? -1 : 1;
        this.scaleIndex = Math.max(
          0,
          Math.min(
            this.familyConfig.majorScales.length - 1,
            this.scaleIndex + direction * size
          )
        );
        this.modulation = this.familyConfig.scaleKeys[this.scaleIndex];
      }
      this.applyScale(this.notePoolLease.ownsFallback);
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool") && !this.notePoolLease.ownsFallback)
        this.bag = [];
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64),
      beat: Math.floor(tick % 16 / 4),
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      this.boundary(clock);
      if (clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.generateCurve();
        if (this.notePoolLease.ownsFallback) this.modulate();
      }
      if (!clock.beatStart) return;
      const density = this.phraseDensity(clock), divisions = this.chooseTuplet(density), beatSeconds = 60 / (clock.bpm || 108), base = 0.4 + 0.48 * density;
      for (const division of filteredTupletMembers(
        divisions,
        density,
        this.config.memberProbabilityFloor
      )) {
        const note = this.drawNote(), velocity = this.shapeVelocity(base, note, {
          clock,
          division,
          divisions,
          voice: 0
        });
        this.audio.papMelody4(
          note,
          beatSeconds / divisions * this.familyConfig.noteDurationFraction,
          velocity,
          division * beatSeconds / divisions,
          this.modulation
        );
      }
    }
  };
  var DampPianoBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.densityLease = new BoundaryPresenceLease(
        this.config.densitySilenceBars || 1
      );
      this.section = -1;
      this.sectionEndBar = 0;
      this.finished = false;
      this.lastBar = null;
      this.previousState = null;
      this.form = [];
      this.phraseBag = [];
      this.noteBags = this.config.registers.map(() => []);
      this.curve = [];
      this.generateForm();
    }
    configuration() {
      return STOCHASTIC_CONFIG.dampPiano;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/density") && !message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.density = Math.max(0, Math.min(1, value));
          this.densityLease.receive();
        }
      }
    }
    generateForm() {
      this.form = distinctBinaryForm(
        this.config.sectionCount,
        this.config.registers.length,
        this.config.partProbabilities
      );
      this.previousState = null;
    }
    nextPhraseLength() {
      if (!this.phraseBag.length)
        this.phraseBag = scramble([...this.config.phraseLengths]);
      return this.phraseBag.pop();
    }
    beginSection(clock) {
      this.section++;
      if (this.section >= this.config.sectionCount) {
        this.finished = true;
        return;
      }
      const length = this.nextPhraseLength(), numerator = Math.max(1, clock.meter?.numerator || 4), beats = length * this.config.legacyMeterMultiplier;
      this.sectionStartBar = clock.bar || 0;
      this.sectionEndBar = this.sectionStartBar + Math.max(1, Math.ceil(beats / numerator));
      this.curve = randomFivePointCurve({
        xRanges: this.config.phraseCurveXRanges,
        terminalWeights: this.config.phraseCurveTerminalWeights
      });
      this.noteBags = this.config.registers.map(() => []);
      this.broadcast("meter", [beats, this.config.legacyMeterDenominator]);
      this.previousState = this.form[this.section];
    }
    barBoundary(clock) {
      if (clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      this.densityLease.advanceBoundary();
      if (this.section < 0 || clock.bar >= this.sectionEndBar)
        this.beginSection(clock);
    }
    sectionDensity(clock) {
      if (!this.densityLease.ownsFallback) return this.density;
      const progress = Math.max(
        0,
        Math.min(
          1,
          ((clock.bar || 0) - this.sectionStartBar) / Math.max(1, this.sectionEndBar - this.sectionStartBar)
        )
      );
      return Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.curve, progress))
      );
    }
    drawRegister(index) {
      if (!this.noteBags[index].length)
        this.noteBags[index] = scramble([...this.config.registers[index].midi]);
      return this.noteBags[index].pop();
    }
    playNote(note, duration, velocity, offset, register) {
      this.audio.dampedPiano(note, duration, velocity, offset, register);
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      barStart: tick % 16 === 0,
      beat: Math.floor(tick % 16 / 4),
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      if (clock.barStart || this.lastBar == null) this.barBoundary(clock);
      if (this.finished || !clock.beatStart) return;
      const cap = this.config.maxDensities[this.section] / Math.max(...this.config.maxDensities), density = Math.min(cap, this.sectionDensity(clock)), divisions = densityWeightedTuplet(density, {
        divisions: this.config.tupletDivisions,
        baseWeights: this.config.tupletBaseWeights,
        densityPowers: this.config.tupletDensityPowers
      }), beatSeconds = 60 / (clock.bpm || 108), active = this.form[this.section], registers = active.map((value, index) => value ? index : -1).filter((index) => index >= 0);
      for (const member of filteredTupletMembers(
        divisions,
        density,
        this.config.memberProbabilityFloor
      ))
        for (const register of registers)
          this.playNote(
            this.drawRegister(register),
            beatSeconds / divisions * 0.68,
            0.38 + 0.5 * density,
            member * beatSeconds / divisions,
            register
          );
    }
  };
  var CounterpointBot = class extends DampPianoBot {
    configuration() {
      return STOCHASTIC_CONFIG.counterpoint;
    }
    constructor(...args) {
      super(...args);
      this.notePoolLease = new BoundaryPresenceLease(
        this.config.notePoolSilenceBars
      );
      this.densityLease.ownsFallback = true;
      this.notes = [...this.config.defaultNotes];
      this.generateInternalPool(false);
    }
    generateInternalPool(adopt = true) {
      const [low, high] = this.config.tonicRange, tonic = low + randomInt(high - low + 1), mode = weightedChoice(
        this.config.modes,
        this.config.modes.map(() => 1)
      );
      this.internalNotes = mode.map((interval) => tonic + interval);
      if (adopt) {
        this.notes = [...this.internalNotes];
        this.noteBags = this.config.registers.map(() => []);
      }
    }
    onMessage(message) {
      Agent.prototype.onMessage.call(this, message);
      if (message.address.endsWith("/notepool")) {
        const values = message.args.map(Number).filter(Number.isFinite);
        if (values.length) {
          this.notePoolLease.receive();
          this.noteBags = this.config.registers.map(() => []);
        }
      }
    }
    barBoundary(clock) {
      if (clock.bar === this.lastBar) return;
      const hadFallback = this.notePoolLease.ownsFallback;
      this.notePoolLease.advanceBoundary();
      if (this.notePoolLease.ownsFallback && !hadFallback)
        this.generateInternalPool(true);
      super.barBoundary(clock);
    }
    beginSection(clock) {
      super.beginSection(clock);
      if (this.finished) {
        this.send("/agent/off", []);
        return;
      }
      if (this.notePoolLease.ownsFallback) this.generateInternalPool(true);
    }
    drawRegister(index) {
      if (!this.noteBags[index].length)
        this.noteBags[index] = scramble([...this.notes]);
      const source = this.noteBags[index].pop() ?? 60, { range, offset } = this.config.registers[index];
      let note = source + offset;
      while (note < range[0]) note += 12;
      while (note > range[1]) note -= 12;
      return Math.max(range[0], Math.min(range[1], note));
    }
    playNote(note, duration, velocity, offset, register) {
      this.audio.counterpointVoice(note, duration, velocity, offset, register);
    }
  };
  var OrnamentBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.ornament;
      this.notes = [...this.config.defaultNotes];
      this.now = () => Date.now();
      const [low, high] = this.config.staleTimeoutRangeMs, timeout = low + randomInt(high - low);
      this.noteLease = new StalePresenceLease(timeout, () => this.now());
      this.densityLease = new StalePresenceLease(timeout, () => this.now());
      this.lastBar = null;
      this.curve = [];
      this.curveBars = 1;
      this.generateDensityCurve();
      this.expanded = expandPitchClasses(this.notes, {
        octaves: this.config.octaves,
        base: this.config.baseMidi
      });
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool")) {
        const values = message.args.map(Number).filter(Number.isFinite);
        if (values.length) {
          this.noteLease.receive(values);
          this.expanded = expandPitchClasses(this.notes, {
            octaves: this.config.octaves,
            base: this.config.baseMidi
          });
        }
      }
      if (message.address.endsWith("/hdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) this.densityLease.receive(value);
      }
    }
    generateDensityCurve() {
      this.curve = randomFivePointCurve({
        xRanges: [
          [0.05, 0.333],
          [0.35, 0.666],
          [0.7, 0.95]
        ],
        terminalWeights: [0.5, 0.5]
      });
      const [low, high] = this.config.densityCurveLengthRange;
      this.curveBars = low + randomInt(high - low);
    }
    internalDensity(bar) {
      const position = (bar % this.curveBars + this.curveBars) % this.curveBars / Math.max(1, this.curveBars - 1);
      return Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.curve, position))
      );
    }
    generatePool() {
      const fundamental = 8 + randomInt(25), pitchClasses = this.config.durationRatios.map(
        (ratio) => fundamental + Math.round(12 * Math.log2(ratio))
      );
      this.notes = [
        ...new Set(pitchClasses.map((note) => 36 + (note % 12 + 12) % 12))
      ];
      this.expanded = expandPitchClasses(this.notes, {
        octaves: this.config.octaves,
        base: this.config.baseMidi
      });
    }
    scheduleBar(clock) {
      const bar = clock.bar || 0;
      this.noteLease.update();
      this.densityLease.update();
      if (this.noteLease.ownsFallback) {
        this.generatePool();
        this.broadcast("notepool", this.notes);
      }
      if (this.densityLease.ownsFallback) {
        if (bar % this.curveBars === 0) this.generateDensityCurve();
        this.density = internalClamp(this.internalDensity(bar));
        this.broadcast("hdensity", [this.density]);
      }
      const maximum = Math.min(
        this.config.sequenceLengthMaximum,
        Math.max(
          1,
          Math.round(this.density * this.config.sequenceLengthScale[1])
        )
      ), count = 1 + randomInt(maximum), onsets = randomNormalizedOnsets(count, {
        candidates: this.config.candidateOnsets,
        resolution: this.config.onsetResolution
      }), pitches = scramble(
        Array.from(
          { length: Math.max(count, this.expanded.length) },
          (_, index) => this.expanded[index % this.expanded.length] ?? 60
        )
      ), barSeconds = 60 / (clock.bpm || 108) * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), [durationLow, durationHigh] = this.config.pluckDurationRange, [velocityLow, velocityHigh] = this.config.velocityRange, base = velocityLow + (velocityHigh - velocityLow) * this.density;
      for (const [index, onset] of onsets.entries()) {
        const next = onsets[index + 1] ?? 1, duration = Math.max(
          durationLow,
          Math.min(durationHigh, (next - onset) * barSeconds * 0.8)
        ), note = pitches[index % pitches.length], velocity = this.shapeVelocity(base, note, {
          clock,
          division: index,
          divisions: count
        });
        this.audio.ornamentPluck(
          note,
          duration,
          velocity,
          onset * barSeconds,
          index / count
        );
      }
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      barStart: tick % 16 === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      this.scheduleBar(clock);
    }
  };
  var MSynthBot = class extends Agent {
    configuration() {
      return STOCHASTIC_CONFIG.msynth;
    }
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.tala = [...this.config.defaultTala];
      this.corpus = this.config.fallbackCorpus;
      this.phraseEvents = [];
      this.lastPhrase = -1;
      this.form = [];
      this.formPosition = -1;
      this.finished = false;
      this.exitSent = false;
      this.plan = [];
      this.chordDurations = [];
      this.preset = 0;
      this.generateForm();
    }
    async start() {
      const response = await fetch("./data/msynth-metheny-corpus.json"), corpus = await response.json();
      if (corpus.onsetDurations?.length !== 119 || corpus.firstBeatContours?.length !== 32 || corpus.continuationContours?.length !== 60)
        throw new Error("Invalid MSynth corpus");
      this.corpus = corpus;
    }
    generateForm() {
      const count = this.config.formPhraseRange[0] + randomInt(
        this.config.formPhraseRange[1] - this.config.formPhraseRange[0]
      ), active = distinctBinaryForm(count, 1, [
        this.config.activePhraseProbability
      ]).map((state2) => Boolean(state2[0]));
      if (!active.some(Boolean)) active[randomInt(active.length)] = true;
      this.form = active;
      this.formPosition = -1;
      this.finished = false;
      this.exitSent = false;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/phraselength")) {
        const value = Number(message.args.at(-1));
        if (Number.isInteger(value) && value > 0 && value <= this.config.maximumPhraseBars)
          this.phraseBars = value;
      }
      if (message.address.endsWith("/phrases")) {
        const value = Number(message.args.at(-1));
        if (Number.isInteger(value) && value > 0) {
          this.form = distinctBinaryForm(
            Math.min(this.config.maximumPhrases, value),
            1,
            [this.config.activePhraseProbability]
          ).map((state2) => Boolean(state2[0]));
          this.formPosition = -1;
          this.finished = false;
          this.exitSent = false;
        }
      }
      if (message.address.endsWith("/plan/chords"))
        this.plan = message.args.flatMap(
          (value) => String(value).split(/\s+/).map(Number).filter(Number.isFinite)
        );
      if (message.address.endsWith("/plan/chordDuration"))
        this.chordDurations = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
      if (message.address.endsWith("/exiting") && String(message.args[0]) === this.config.botName)
        this.finished = true;
    }
    phrasePool() {
      return this.plan.length ? [
        ...new Set(
          this.plan.map((note) => 60 + pitchClass(note)).filter(Number.isFinite)
        )
      ] : this.notes;
    }
    beginPhrase(clock) {
      this.formPosition++;
      if (this.formPosition >= this.form.length) {
        this.finished = true;
        if (!this.exitSent) {
          this.exitSent = true;
          this.broadcast("exiting", [this.config.botName, 1]);
        }
        return;
      }
      const bars = this.phraseBars || clock.meter?.phraseBars || this.config.defaultPhraseBars, quarterBeats = bars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), pool = this.phrasePool();
      this.preset = randomInt(this.config.synthPresetCount);
      this.phraseEvents = this.form[this.formPosition] ? generateCorpusPhrase(this.corpus, {
        beats: quarterBeats,
        density: this.density,
        notePool: pool,
        range: this.config.midiRange,
        nearest: this.config.nearestCorpusRecords
      }) : [];
      this.broadcast("notepool", pool);
      this.broadcast(
        "tala",
        this.tala.length ? this.tala : this.config.defaultTala
      );
      this.broadcast("phraselength", [bars]);
      this.broadcast("phrases", [this.form.length]);
    }
    playEvent(note, duration, velocity, offset, preset) {
      this.audio.msynthNote(note, duration, velocity, offset, preset);
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4, phraseBars: 3 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        if (this.finished) {
          if (!this.exitSent) {
            this.exitSent = true;
            this.broadcast("exiting", [this.config.botName, 1]);
          }
          return;
        }
        this.beginPhrase(clock);
        const quarterSeconds = 60 / (clock.bpm || 108);
        for (const [index, event] of this.phraseEvents.entries()) {
          const velocity = this.config.velocityCycle[index % this.config.velocityCycle.length], duration = Math.max(
            this.config.minimumNoteSeconds,
            event.duration * quarterSeconds * this.config.durationGate
          );
          this.playEvent(
            event.note,
            duration,
            velocity,
            event.at * quarterSeconds,
            this.preset,
            event
          );
        }
      }
    }
  };
  var RSynthBot = class extends MSynthBot {
    configuration() {
      return STOCHASTIC_CONFIG.rsynth;
    }
    async start() {
      const response = await fetch("./data/rsynth-breaks-corpus.json"), corpus = await response.json();
      if (corpus.onsetChains?.length !== 16 || corpus.durationsByOnset?.length !== 16 || corpus.pitchChains?.length !== 121 || corpus.pitchFirstBeats?.length !== 1)
        throw new Error("Invalid RSynth corpus");
      this.corpus = corpus;
    }
    beginPhrase(clock) {
      this.formPosition++;
      if (this.formPosition >= this.form.length) {
        this.finished = true;
        if (!this.exitSent) {
          this.exitSent = true;
          this.broadcast("exiting", [this.config.botName, 1]);
        }
        return;
      }
      const bars = this.phraseBars || clock.meter?.phraseBars || this.config.defaultPhraseBars, quarterBeats = bars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), pool = this.phrasePool();
      this.preset = randomInt(this.config.synthPresetCount);
      this.phraseEvents = this.form[this.formPosition] ? generateRhythmicCorpusPhrase(this.corpus, {
        beats: quarterBeats,
        density: this.density,
        notePool: pool,
        range: this.config.midiRange
      }) : [];
      this.broadcast("notepool", pool);
      this.broadcast("tala", this.tala);
      this.broadcast("phraselength", [bars]);
      this.broadcast("phrases", [this.form.length]);
    }
    playEvent(note, duration, velocity, offset, preset) {
      this.audio.rsynthNote(note, duration, velocity, offset, preset);
    }
  };
  var MultiSynthBot = class extends MSynthBot {
    configuration() {
      return STOCHASTIC_CONFIG.multiSynth;
    }
    async start() {
    }
    generateForm() {
      const count = this.config.formPhraseRange[0] + randomInt(
        this.config.formPhraseRange[1] - this.config.formPhraseRange[0]
      );
      this.form = distinctBinaryForm(
        count,
        this.config.voiceCount,
        this.config.partProbabilities
      );
      this.formPosition = -1;
      this.finished = false;
      this.exitSent = false;
    }
    beginPhrase(clock) {
      this.formPosition++;
      if (this.formPosition >= this.form.length) {
        this.finished = true;
        if (!this.exitSent) {
          this.exitSent = true;
          this.broadcast("exiting", [this.config.botName, 1]);
        }
        return;
      }
      const bars = this.phraseBars || clock.meter?.phraseBars || this.config.defaultPhraseBars, quarterBeats = bars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), steps = Math.max(1, Math.ceil(quarterBeats * 4)), pool = this.phrasePool(), active = this.form[this.formPosition], events = [];
      for (let voice = 0; voice < this.config.voiceCount; voice++) {
        if (!active[voice]) continue;
        const low = this.config.densityLowRange[0] + unitRandom() * (this.config.densityLowRange[1] - this.config.densityLowRange[0]), high = this.config.densityHighRange[0] + unitRandom() * (this.config.densityHighRange[1] - this.config.densityHighRange[0]), partDensity = low + (high - low) * this.density, curve2 = randomFivePointCurve({
          xRanges: this.config.phraseCurveXRanges,
          terminalWeights: this.config.phraseCurveTerminalWeights
        }), available = Array.from({ length: steps }, (_, index) => index), selected = [];
        while (available.length && selected.length < this.config.onsetCandidatesPerPart) {
          const weights = available.map(
            (index) => this.config.metricVelocityCycle[index % this.config.metricVelocityCycle.length] * Math.max(
              0.02,
              interpolateCurvePoints(curve2, index / Math.max(1, steps - 1))
            )
          ), choice = weightedChoice(available, weights), position = available.indexOf(choice);
          available.splice(position, 1);
          if (unitRandom() <= partDensity) selected.push(choice);
        }
        if (!selected.length) selected.push(0);
        for (const onset of selected.sort((a, b) => a - b)) {
          const range = this.config.voiceRanges[voice], source = weightedChoice(
            pool,
            pool.map(() => 1)
          );
          let note = source;
          while (note < range[0]) note += 12;
          while (note > range[1]) note -= 12;
          events.push({
            at: onset / 4,
            duration: this.config.noteDurationQuarterBeats,
            note,
            voice
          });
        }
      }
      this.phraseEvents = events.sort((a, b) => a.at - b.at || a.voice - b.voice);
      this.preset = randomInt(this.config.synthPresetCount);
      this.broadcast("notepool", pool);
      this.broadcast("hdensity", [this.density]);
      this.broadcast("vdensity", [
        active.filter(Boolean).length / this.config.voiceCount
      ]);
      this.broadcast("tala", this.tala);
      this.broadcast("phraselength", [bars]);
      this.broadcast("phrases", [this.form.length]);
    }
    playEvent(note, duration, velocity, offset, preset, event) {
      this.audio.multiSynthNote(
        note,
        duration,
        velocity,
        offset,
        event?.voice || 0,
        preset
      );
    }
  };
  var ReichGuitarBot = class extends MultiSynthBot {
    configuration() {
      return STOCHASTIC_CONFIG.reichGuitar;
    }
    phraseDensity(activeCount) {
      const [gaussLow, gaussHigh] = this.config.gaussianInputRange, [densityLow, densityHigh] = this.config.gaussianDensityRange, z = Math.max(gaussLow, Math.min(gaussHigh, gaussianRandom())), base = densityLow + (densityHigh - densityLow) * (z - gaussLow) / (gaussHigh - gaussLow), fraction = activeCount / this.config.voiceCount, [boostHigh, boostLow] = this.config.sparseVoiceMultiplierRange, multiplier = boostHigh + (boostLow - boostHigh) * (fraction - 0.25) / 0.75;
      return Math.max(this.config.minimumDensity, Math.min(1, base * multiplier));
    }
    beginPhrase(clock) {
      this.formPosition++;
      if (this.formPosition >= this.form.length) {
        this.finished = true;
        if (!this.exitSent) {
          this.exitSent = true;
          this.broadcast("exiting", [this.config.botName, 1]);
        }
        return;
      }
      const bars = this.phraseBars || clock.meter?.phraseBars || this.config.defaultPhraseBars, quarterBeats = bars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), steps = Math.max(1, Math.ceil(quarterBeats * 4)), pool = this.phrasePool(), active = this.form[this.formPosition], activeCount = active.filter(Boolean).length, density = this.phraseDensity(activeCount), seed2 = Array.from(
        { length: steps },
        (_, index) => this.config.initialCell[index % this.config.initialCell.length]
      ), events = [];
      let previous = neighborEvolvedCycle(seed2, this.config.mutationsPerPhrase);
      for (let voice = 0; voice < this.config.voiceCount; voice++) {
        if (!active[voice]) continue;
        let shape;
        if (voice === 0) shape = previous;
        else if (unitRandom() < this.config.inheritShapeProbability)
          shape = rotateCycle(previous, this.config.phaseOffsets[voice]);
        else
          shape = neighborEvolvedCycle(
            previous,
            this.config.mutationsPerPhrase + voice
          );
        previous = shape;
        const motive = this.config.pitchMotives[voice % this.config.pitchMotives.length], range = this.config.voiceRanges[voice], voiceEvents = [];
        for (let onset = 0; onset < steps; onset++)
          if (shape[onset] && unitRandom() <= density) {
            const source = pool[(onset + voice) % pool.length] ?? 60, interval = motive[(onset + this.formPosition) % motive.length], pitchClass2 = ((source + interval) % 12 + 12) % 12;
            let note = range[0] + ((pitchClass2 - range[0]) % 12 + 12) % 12;
            while (note > range[1]) note -= 12;
            const event = {
              at: onset / 4,
              duration: this.config.noteDurationQuarterBeats,
              note,
              voice
            };
            voiceEvents.push(event);
            events.push(event);
          }
        if (!voiceEvents.length) {
          const note = range[0] + (((pool[voice % pool.length] ?? 60) - range[0]) % 12 + 12) % 12;
          events.push({
            at: voice * this.config.phaseOffsets[voice] / 4,
            duration: this.config.noteDurationQuarterBeats,
            note,
            voice
          });
        }
      }
      this.density = density;
      this.phraseEvents = events.filter((event) => event.at < quarterBeats).sort((a, b) => a.at - b.at || a.voice - b.voice);
      this.preset = randomInt(this.config.synthPresetCount);
      this.broadcast("notepool", [
        ...new Set(this.phraseEvents.map((event) => event.note))
      ]);
      this.broadcast("hdensity", [density]);
      this.broadcast("vdensity", [activeCount / this.config.voiceCount]);
      this.broadcast("tala", this.tala);
      this.broadcast("phraselength", [bars]);
      this.broadcast("phrases", [this.form.length]);
    }
    playEvent(note, duration, velocity, offset, preset, event) {
      this.audio.reichGuitar(
        note,
        duration,
        velocity,
        offset,
        event?.voice || 0,
        preset
      );
    }
  };
  var MethenyMelodyBot = class extends MSynthBot {
    configuration() {
      return STOCHASTIC_CONFIG.methenyMelody;
    }
    constructor(...args) {
      super(...args);
      this.phraseBars = weightedChoice(
        this.config.phraseLengths,
        this.config.phraseLengthWeights
      );
      this.chords = [];
      this.receivedPlan = false;
      this.harmony = null;
    }
    async start() {
      const [corpus, harmony] = await Promise.all(
        ["./data/msynth-metheny-corpus.json", "./data/metheny-harmony.json"].map(
          (path) => fetch(path).then((response) => response.json())
        )
      );
      if (corpus.onsetDurations?.length !== 119 || corpus.firstBeatContours?.length !== 32 || corpus.continuationContours?.length !== 60)
        throw new Error("Invalid Metheny melody corpus");
      this.corpus = corpus;
      this.harmony = harmony;
      this.generateLocalPlan();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/plan/chords")) {
        const chords = parseChordPlan(message.args);
        if (chords.length) {
          this.chords = chords;
          this.receivedPlan = true;
        }
      }
    }
    generateLocalPlan() {
      if (!this.harmony) {
        this.chords = [...this.config.defaultChords.map((chord) => [...chord])];
        return;
      }
      const target = Math.max(
        1,
        this.phraseBars * this.config.assumedBeatsPerBar
      ), items = [];
      let shape = corpusInitialShape(this.harmony), root = weightedPitchClass(this.harmony[shape]?.initial), duration = 0;
      while (duration < target && items.length < this.config.maximumChords) {
        const beats = Math.min(
          target - duration,
          observedDuration(this.harmony[shape], 1) * this.config.harmonicRhythm
        );
        items.push(transposeChord(shape, root, this.config.baseMidi));
        duration += beats;
        ({ shape, root } = corpusNextChord(this.harmony, shape));
      }
      this.chords = items.length ? items : [...this.config.defaultChords.map((chord) => [...chord])];
    }
    beginPhrase(clock) {
      this.formPosition++;
      if (this.formPosition >= this.form.length) {
        this.finished = true;
        if (!this.exitSent) {
          this.exitSent = true;
          this.broadcast("exiting", [this.config.botName, 1]);
        }
        return;
      }
      if (!this.receivedPlan) this.generateLocalPlan();
      const bars = this.phraseBars || clock.meter?.phraseBars || this.config.defaultPhraseBars, quarterBeats = bars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), pool = [...new Set(this.chords.flat())], density = this.config.phraseDensityRange[0] + unitRandom() * (this.config.phraseDensityRange[1] - this.config.phraseDensityRange[0]);
      this.preset = randomInt(this.config.synthPresetCount);
      this.phraseEvents = this.form[this.formPosition] ? generateCorpusPhrase(this.corpus, {
        beats: quarterBeats,
        density,
        notePool: pool,
        range: this.config.midiRange,
        nearest: this.config.nearestCorpusRecords
      }) : [];
      this.broadcast("notepool", this.chords[0] || pool);
    }
    playEvent(note, duration, velocity, offset, preset) {
      this.audio.methenyMelody(note, duration, velocity, offset, preset);
    }
  };
  var SeasonsArpyBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.seasonsArpy;
      this.notes = [...this.config.defaultNotes];
      this.tala = [...this.config.defaultTala];
      this.arousal = this.config.defaultArousal;
      this.progress = 0;
      this.hasProgress = false;
      this.phraseBars = this.config.defaultPhraseBars;
      this.order = [];
      this.orderMode = 0;
      this.noteIndex = 0;
      this.lastPosition = -1;
      this.finished = false;
      this.generateOrder();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.progress = Math.max(0, Math.min(1, value));
          this.hasProgress = true;
        }
      }
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0)
          this.phraseBars = Math.min(this.config.maximumPhraseBars, value);
      }
      if (message.address.endsWith("/notepool")) this.generateOrder();
      if (message.address.endsWith("/tala") || message.address.endsWith("/arousal"))
        this.cycleKey = null;
      if (message.address.endsWith("/exiting")) this.finished = true;
    }
    generateOrder() {
      const unique = [
        ...new Set(this.notes.map(Number).filter(Number.isFinite))
      ].sort((a, b) => a - b);
      this.orderMode = randomInt(this.config.orderModes);
      if (this.orderMode === 0) this.order = unique;
      else if (this.orderMode === 1) this.order = [...unique].reverse();
      else this.order = scramble(unique);
      this.noteIndex = 0;
    }
    rhythmCycle(length) {
      const groups = this.tala.reduce((sum, value) => sum + value, 0) === length ? this.tala : defaultGrouping(length), key = JSON.stringify([groups, length, Math.round(this.arousal * 100)]);
      if (key !== this.cycleKey) {
        const starts = new Set(additiveGroupStarts(groups, length));
        this.cycle = Array.from(
          { length },
          (_, index) => starts.has(index) || unitRandom() < this.arousal * this.config.additionalOnsetScale ? 1 : 0
        );
        this.cycleKey = key;
      }
      return this.cycle;
    }
    onTick(tick, clock = {
      tickInBar: tick % 16,
      phraseStart: tick === 0,
      meter: { numerator: 4, subdivision: 4, pulsesPerBar: 16, phraseBars: 4 }
    }) {
      if (this.finished) return;
      if (clock.phraseStart) this.generateOrder();
      const meterBeats = clock.meter?.numerator || 4, length = Math.max(
        1,
        this.tala.reduce((sum, value) => sum + value, 0) || meterBeats
      ), position = this.hasProgress ? Math.round(
        this.progress * Math.max(1, this.phraseBars) * meterBeats
      ) % length : ((clock.bar || 0) * meterBeats + (clock.beat || 0)) % length;
      if (position === this.lastPosition) return;
      this.lastPosition = position;
      const cycle = this.rhythmCycle(length);
      if (!cycle[position]) return;
      const note = this.order[this.noteIndex % Math.max(1, this.order.length)] ?? this.config.defaultNotes[0], velocity = this.config.velocityCycle[position % this.config.velocityCycle.length];
      this.noteIndex++;
      this.audio.seasonsArpy(note, this.config.noteDurationSeconds, velocity);
    }
  };
  var SeasonsBrokenChordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.seasonsBrokenChord;
      this.chords = this.config.defaultChords.map((chord) => [...chord]);
      this.durations = [...this.config.defaultDurations];
      this.arousal = this.config.defaultArousal;
      this.progress = 0;
      this.hasProgress = false;
      this.phraseBars = this.config.defaultPhraseBars;
      this.lastChord = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          const next = Math.max(0, Math.min(1, value));
          if (next < this.progress) this.lastChord = -1;
          this.progress = next;
          this.hasProgress = true;
        }
      }
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0)
          this.phraseBars = Math.min(this.config.maximumPhraseBars, value);
      }
      if (message.address.endsWith("/plan/chords")) {
        const chords = parseChordPlan(message.args);
        if (chords.length) {
          this.chords = chords;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const durations = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (durations.length) {
          this.durations = durations;
          this.lastChord = -1;
        }
      }
    }
    voicedChord(chord) {
      let previous = 35;
      return chord.map((value) => {
        let note = Number(value);
        if (note < 36) note = 48 + pitchClass(note);
        while (note <= previous) note += 12;
        previous = note;
        return note;
      });
    }
    onTick(tick, clock = {
      bar: 0,
      beat: 0,
      bpm: 120,
      meter: { numerator: 4, denominator: 4, phraseBars: 4 }
    }) {
      if (!this.chords.length) return;
      const meterBeats = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), position = this.hasProgress ? phrasePosition(this.progress, this.phraseBars, meterBeats) : (clock.bar || 0) * meterBeats + (clock.beat || 0) * 4 / (clock.meter?.denominator || 4), current = chordAtPosition(this.chords, this.durations, position);
      if (!current || current.index === this.lastChord) return;
      this.lastChord = current.index;
      const secondsPerQuarter = 60 / Math.max(1, clock.bpm || 120), durationSeconds = current.duration * secondsPerQuarter, voiceCount = seasonsVoiceCount(
        this.arousal,
        this.config.maximumVoices,
        this.config.fullPolyphonyArousal
      );
      for (const voice of staggeredHeldVoices(
        this.voicedChord(current.chord),
        durationSeconds,
        voiceCount
      ))
        this.audio.seasonsBrokenChord(
          voice.note,
          voice.duration,
          this.config.velocity,
          voice.delay
        );
    }
  };
  var SeasonsChordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.seasonsChord;
      this.chords = this.config.defaultChords.map((chord) => [...chord]);
      this.durations = [...this.config.defaultDurations];
      this.tala = [...this.config.defaultTala];
      this.arousal = this.config.defaultArousal;
      this.phraseBars = this.config.defaultPhraseBars;
      this.progress = 0;
      this.hasProgress = false;
      this.lastPosition = -1;
      this.rebuildCycle();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          const next = Math.max(0, Math.min(1, value));
          if (next < this.progress) this.lastPosition = -1;
          this.progress = next;
          this.hasProgress = true;
        }
      }
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.arousal = Math.max(0, Math.min(1, value));
          this.rebuildCycle();
        }
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0)
          this.phraseBars = Math.min(this.config.maximumPhraseBars, value);
      }
      if (message.address.endsWith("/tala")) this.rebuildCycle();
      if (message.address.endsWith("/plan/chords")) {
        const chords = parseChordPlan(message.args);
        if (chords.length) this.chords = chords;
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const durations = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (durations.length) this.durations = durations;
      }
    }
    rebuildCycle() {
      this.onsetCycle = seasonsOnsetCycle(this.tala, this.arousal);
      this.lastPosition = -1;
    }
    phase(clock) {
      if (this.hasProgress) return this.progress;
      const bars = Math.max(1, this.phraseBars), bar = ((clock.bar || 0) % bars + bars) % bars, within = (clock.tickInBar || 0) / Math.max(1, clock.meter?.pulsesPerBar || 1);
      return (bar + within) / bars;
    }
    onTick(tick, clock = { bar: 0, tickInBar: 0, bpm: 120, meter: { pulsesPerBar: 16 } }) {
      const length = this.onsetCycle.length;
      if (!length || !this.chords.length) return;
      const phase = this.phase(clock), position = Math.round(phase * this.phraseBars * length) % length;
      if (position === this.lastPosition) return;
      this.lastPosition = position;
      if (!this.onsetCycle[position]) return;
      const current = planAtProgress(this.chords, this.durations, phase), notes = ascendingPitchClassVoicing(current?.chord || [], this.arousal);
      if (!notes.length) return;
      const velocity = this.tala.join(",") === this.config.defaultTala.join(",") ? this.config.velocityContour[position % this.config.velocityContour.length] : metricWeights(this.tala, 1)[position] / 7;
      this.audio.seasonsChord(
        notes,
        this.config.articulationSeconds,
        Math.max(0.08, Math.min(1, velocity))
      );
    }
  };
  var SeasonsDroneBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.chords = this.config.defaultChords.map((chord) => [...chord]);
      this.durations = [...this.config.defaultDurations];
      this.tala = [...this.config.defaultTala];
      this.arousal = this.config.defaultArousal;
      this.phraseBars = this.config.defaultPhraseBars;
      this.progress = 0;
      this.hasProgress = false;
      this.receivedPlan = false;
      this.lastChord = -1;
      this.updateAnchor();
    }
    configuration() {
      return STOCHASTIC_CONFIG.seasonsDrone;
    }
    updateAnchor() {
      this.anchor = mostCommonPitchClass(this.chords);
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          const next = Math.max(0, Math.min(1, value));
          if (next < this.progress) this.lastChord = -1;
          this.progress = next;
          this.hasProgress = true;
        }
      }
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0)
          this.phraseBars = Math.min(this.config.maximumPhraseBars, value);
      }
      if (message.address.endsWith("/plan/chords")) {
        const chords = parseChordPlan(message.args);
        if (chords.length) {
          this.chords = chords;
          this.receivedPlan = true;
          this.lastChord = -1;
          this.updateAnchor();
        }
      }
      if (message.address.endsWith("/plan/chordDuration")) {
        const durations = message.args.map(Number).filter((value) => Number.isFinite(value) && value > 0);
        if (durations.length) {
          this.durations = durations;
          this.lastChord = -1;
        }
      }
      if (message.address.endsWith("/notepool") && !this.receivedPlan) {
        this.chords = [this.notes.map((note) => note % 12)];
        this.durations = [1];
        this.lastChord = -1;
        this.updateAnchor();
      }
    }
    phase(clock) {
      if (this.hasProgress) return this.progress;
      const bars = Math.max(1, this.phraseBars), bar = ((clock.bar || 0) % bars + bars) % bars, within = (clock.tickInBar || 0) / Math.max(1, clock.meter?.pulsesPerBar || 1);
      return (bar + within) / bars;
    }
    render(note, duration, velocity, delay) {
      this.audio.seasonsDrone(note, duration, velocity, delay);
    }
    onTick(tick, clock = {
      bar: 0,
      tickInBar: 0,
      bpm: 120,
      meter: { numerator: 4, denominator: 4, pulsesPerBar: 16 }
    }) {
      if (!this.chords.length) return;
      const phase = this.phase(clock), current = planAtProgress(this.chords, this.durations, phase);
      if (!current || current.index === this.lastChord) return;
      this.lastChord = current.index;
      const pc = anchoredChordPitch(current.chord, this.anchor);
      if (pc == null) return;
      const total = this.durations.slice(0, this.chords.length).reduce((sum, value) => sum + (Number(value) || 1), 0), fraction = current.duration / Math.max(1e-6, total), quarterBeats = this.phraseBars * (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4), spanSeconds = fraction * quarterBeats * 60 / Math.max(1, clock.bpm || 120), window2 = seasonsDroneWindow(spanSeconds, this.arousal);
      this.render(
        pc + this.config.octave * 12,
        window2.duration,
        this.config.velocity,
        window2.delay
      );
    }
  };
  var SeasonsSussyBot = class extends SeasonsDroneBot {
    configuration() {
      return STOCHASTIC_CONFIG.seasonsSussy;
    }
    render(note, duration, velocity, delay) {
      this.audio.seasonsSussy(note, duration, velocity, delay);
    }
  };
  var internalClamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  var BassBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.step = 0;
      this.noteIndex = 0;
      this.config = STOCHASTIC_CONFIG.walkingBass;
    }
    onTick(tick, clock = {
      tickInBar: tick % 16,
      meter: { groups: [4], subdivision: 4, pulsesPerBar: 16, rhythm: {} }
    }) {
      clock = this.interpretClock(clock);
      const minGap = Math.max(
        1,
        Math.ceil(
          clock.meter.subdivision * (this.config.minimumBeatsBetweenAttacks || 0)
        )
      );
      if (!this.rhythm(clock, this.config)[clock.tickInBar] || this.lastAttackTick != null && tick - this.lastAttackTick < minGap)
        return;
      this.lastAttackTick = tick;
      this.noteIndex = (this.noteIndex + weightedChoice(this.config.steps, this.config.stepWeights) + this.notes.length) % this.notes.length;
      const note = (this.notes[this.noteIndex] ?? 60) - 12, weights = metricWeights(clock.meter.groups, clock.meter.subdivision), accent = this.config.accentFloor + (1 - this.config.accentFloor) * (weights[clock.tickInBar] / Math.max(...weights));
      this.play(note, accent);
      this.step++;
    }
    play(note, accent) {
      this.audio.bass(note, accent);
    }
  };
  var WalkingBassBot = class extends BassBot {
  };
  var EBassBot = class extends BassBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.eBass;
    }
    play(note, accent) {
      this.audio.eBass(note, accent);
    }
  };
  var TalaPatternBassBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.snapBass;
      this.rootPitch = this.config.range[0];
    }
    choosePitchClass() {
      const pitchClasses = this.notes.map((note) => note % 12);
      if (this.config.pitchClassSelection === "first")
        return pitchClasses[0] ?? 0;
      const counts = /* @__PURE__ */ new Map();
      for (const pc of pitchClasses) counts.set(pc, (counts.get(pc) || 0) + 1);
      return [...counts].sort(
        (a, b) => b[1] - a[1] || pitchClasses.indexOf(a[0]) - pitchClasses.indexOf(b[0])
      )[0]?.[0] ?? 0;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool"))
        this.rootPitch = this.config.range[0] + this.choosePitchClass();
    }
    onTick(tick, clock = {
      tickInBar: tick % 16,
      meter: { groups: [4], subdivision: 4, pulsesPerBar: 16, rhythm: {} }
    }) {
      clock = this.interpretClock(clock);
      const active = this.rhythm(clock, this.config, this.density)[clock.tickInBar], minGap = Math.max(
        1,
        Math.ceil(
          clock.meter.subdivision * this.config.minimumBeatsBetweenAttacks
        )
      );
      if (!active || this.lastAttackTick != null && tick - this.lastAttackTick < minGap)
        return;
      this.lastAttackTick = tick;
      const index = clock.tickInBar % this.config.octaveCycle.length, note = Math.min(
        this.config.range[1],
        this.rootPitch + this.config.octaveCycle[index]
      ), velocity = this.config.velocityCycle[clock.subdivision % this.config.velocityCycle.length];
      this.play(note, velocity);
    }
    play(note, velocity) {
      this.audio.snapBass(note, velocity);
    }
  };
  var SnapBassBot = class extends TalaPatternBassBot {
  };
  var SynthBassBot = class extends TalaPatternBassBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.synthBass;
      this.rootPitch = this.config.range[0];
    }
    play(note, velocity) {
      this.audio.synthBass(note, velocity);
    }
  };
  var SplatterBassBot = class extends Agent {
    constructor(...args) {
      super(...args);
      const config = STOCHASTIC_CONFIG.splatterBass;
      this.activityMask = [...config.activityMask];
      this.pitchclassPool = [...config.pitchclassPool];
      this.nextActivityMask = [...this.activityMask];
      this.nextPitchclassPool = [...this.pitchclassPool];
      this.receivedMasks = [];
      this.receivedPitchclasses = [];
      this.intentSent = false;
      this.lastPhrase = -1;
      this.lastCycleIndex = -1;
      this.currentPitch = config.baseMidi + this.pitchclassPool[0];
    }
    onMessage(message) {
      super.onMessage(message);
      const compound = parseCompoundIntent(message);
      if (compound && compound.sender !== "ybot_splatterBOT" && compound.sender !== this.instanceId) {
        if (compound.activityMask) this.receivedMasks.push(compound.activityMask);
        if (compound.pitchclassPool)
          this.receivedPitchclasses.push(...compound.pitchclassPool);
        return;
      }
      if (message.address === "/broadcast/intent/activityMask")
        this.receivedMasks.push(normalizeActivityMask(message.args));
      if (message.address === "/broadcast/intent/pitchclassPool")
        this.receivedPitchclasses.push(...normalizePitchclassPool(message.args));
    }
    beginPhrase(phrase) {
      if (this.lastPhrase >= 0) {
        this.activityMask = [...this.nextActivityMask];
        this.pitchclassPool = this.nextPitchclassPool.length ? [...this.nextPitchclassPool] : [...this.pitchclassPool];
      }
      this.lastPhrase = phrase;
      this.receivedMasks = [];
      this.receivedPitchclasses = [];
      this.intentSent = false;
      this.lastCycleIndex = -1;
    }
    publishNextIntent() {
      this.nextActivityMask = complementaryActivityMask(this.receivedMasks);
      const pool = normalizePitchclassPool(this.receivedPitchclasses);
      this.nextPitchclassPool = pool.length ? pool : [...this.pitchclassPool];
      this.broadcast(
        "intent",
        serializeCompoundIntent(
          "ybot_splatterBOT",
          this.nextActivityMask,
          this.nextPitchclassPool
        )
      );
      this.intentSent = true;
    }
    onTick(tick, clock = {
      bar: 0,
      beat: 0,
      subdivision: 0,
      beatStart: tick % 4 === 0,
      phraseStart: tick === 0,
      phrase: 0,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.lastPhrase)
        this.beginPhrase(clock.phrase);
      const cycleIndex = cycleIndexAtPhrasePosition(
        clock,
        this.activityMask.length
      );
      if (!this.intentSent && cycleIndex >= STOCHASTIC_CONFIG.splatterBass.intentStep)
        this.publishNextIntent();
      if (!clock.beatStart || cycleIndex === this.lastCycleIndex) return;
      this.lastCycleIndex = cycleIndex;
      if (clock.barStart || this.currentPitch == null) {
        const pool = this.pitchclassPool.length ? this.pitchclassPool : STOCHASTIC_CONFIG.splatterBass.pitchclassPool;
        this.currentPitch = STOCHASTIC_CONFIG.splatterBass.baseMidi + pool[randomInt(pool.length)];
      }
      const activity = this.activityMask[cycleIndex], filterValue = STOCHASTIC_CONFIG.splatterBass.filterValues[activity] ?? 17, velocity = 0.35 + activity / 9 * 0.55, duration = STOCHASTIC_CONFIG.splatterBass.noteDurationBeats * 60 / 108;
      this.audio.acidBass(this.currentPitch, duration, velocity, filterValue);
    }
  };
  var RhodesBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.memoryDevelopmentEnabled = true;
    }
    onMemoryRecall(motifs = []) {
      const recalled = motifs.slice().reverse().find(
        (motif) => motif.author !== this.instanceId && motif.events?.some((event) => event.pitches?.length)
      );
      if (recalled) {
        const pitches = recalled.events.flatMap((event) => event.pitches || []).map(Number).filter(Number.isFinite);
        if (pitches.length) this.notes = [...new Set(pitches)];
      }
      this.memoryVoicingShift = ((this.memoryVoicingShift || 0) + 1) % STOCHASTIC_CONFIG.rhodes.voicingOffsets.length;
    }
    onTick(tick, clock = {
      tickInBar: tick % 16,
      bar: Math.floor(tick / 16),
      meter: { groups: [4], subdivision: 4, pulsesPerBar: 16, rhythm: {} }
    }) {
      clock = this.interpretClock(clock);
      const config = STOCHASTIC_CONFIG.rhodes, minGap = Math.max(
        1,
        Math.ceil(clock.meter.subdivision * config.minimumBeatsBetweenAttacks)
      );
      if (!this.rhythm(clock, config)[clock.tickInBar] || this.lastAttackTick != null && tick - this.lastAttackTick < minGap)
        return;
      this.lastAttackTick = tick;
      const offsets = config.voicingOffsets[(clock.bar + (this.memoryVoicingShift || 0)) % config.voicingOffsets.length], root = Math.min(...this.notes);
      const voiced = offsets.map((offset) => root + offset);
      this.audio.rhodes(voiced);
    }
  };
  var BeatBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.lastForm = -1;
      this.config = STOCHASTIC_CONFIG.beat;
    }
    onTick(tick, clock = {
      phraseStart: tick % 64 === 0,
      phrase: Math.floor(tick / 64),
      tickInBar: tick % 16,
      beat: Math.floor(tick % 16 / 4),
      subdivision: tick % 4,
      beatStart: tick % 4 === 0,
      groupStart: tick % 4 === 0,
      group: Math.floor(tick % 16 / 4),
      meter: { groups: [4], subdivision: 4, phraseBars: 4 }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart) {
        const form = clock.phrase;
        if (form !== this.lastForm) {
          this.lastForm = form;
          this.density = this.config.densityProfile[form % this.config.densityProfile.length];
          this.broadcast("phraselength", [clock.meter.phraseBars]);
          this.broadcast("phrases", [clock.meter.phraseBars]);
          if (this.tala.reduce((a, b) => a + b, 0) === clock.meter.numerator)
            this.broadcast("tala", this.tala);
          this.broadcast("hdensity", [this.density]);
          this.broadcast("vdensity", [
            this.config.densityProfile[(form + 4) % this.config.densityProfile.length]
          ]);
        }
      }
      this.pattern(tick, clock);
    }
    pattern(tick, clock) {
      const active = this.rhythm(clock, this.config, this.density)[clock.tickInBar];
      if (clock.groupStart && (clock.barStart || this.instanceAllows(clock, 0, 0.78)))
        this.audio.kick();
      if (clock.beatStart && clock.groupBeat === Math.floor(clock.meter.groups[clock.group] / 2) && this.instanceAllows(clock, 1, 0.82))
        this.audio.snare();
      if (active) this.audio.hat();
    }
  };
  var ElectronicBeatBot = class extends BeatBot {
  };
  var JazzBeatBot = class extends BeatBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.jazzBeat;
    }
    pattern(tick, clock) {
      const active = this.rhythm(clock, this.config, this.density)[clock.tickInBar];
      if (clock.groupStart && (clock.barStart || this.instanceAllows(clock, 0, 0.68)))
        this.audio.softKick();
      if (clock.beatStart && clock.groupBeat === Math.floor(clock.meter.groups[clock.group] / 2) && this.instanceAllows(clock, 1, 0.72))
        this.audio.brush();
      if (active) this.audio.ride(clock.groupStart ? 0.8 : 0.4);
    }
  };
  var CleanBeatBot = class extends BeatBot {
    configuration() {
      return STOCHASTIC_CONFIG.cleanBeat;
    }
    constructor(...args) {
      super(...args);
      this.config = this.configuration();
      this.phraseLength = weightedChoice(
        this.config.phraseLengths,
        this.config.phraseWeights
      );
      const [low, high] = this.config.formRandomRange;
      this.formPhrases = Math.max(
        1,
        Math.round((low + randomInt(high - low)) * 16 / this.phraseLength)
      );
      this.partState = [...this.config.initialPartState];
    }
    choosePartState(phrase) {
      if (phrase === 0) {
        this.partState = [...this.config.initialPartState];
        return;
      }
      this.partState = [
        1,
        ...this.config.percussionVoices.map(
          (_, index) => this.instanceAllows(
            { bar: phrase, group: index },
            index,
            0.25 + this.density * 0.65
          ) ? 1 : 0
        )
      ];
      if (this.partState.slice(1).every((value) => !value))
        this.partState[1 + phrase % 4] = 1;
    }
    onTick(tick, clock = {
      phraseStart: tick % 64 === 0,
      phrase: Math.floor(tick / 64),
      tickInBar: tick % 16,
      beat: Math.floor(tick % 16 / 4),
      subdivision: tick % 4,
      beatStart: tick % 4 === 0,
      groupStart: tick % 4 === 0,
      group: Math.floor(tick % 16 / 4),
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.lastForm) {
        this.lastForm = clock.phrase;
        this.density = this.config.densityProfile[clock.phrase % this.config.densityProfile.length];
        this.choosePartState(clock.phrase);
        const tala = this.config.sourceTala.reduce((sum, value) => sum + value, 0) === clock.meter.numerator ? [...this.config.sourceTala] : defaultGrouping(clock.meter.numerator);
        this.tala = tala;
        this.broadcast("phraselength", [this.phraseLength]);
        this.broadcast("phrases", [this.formPhrases]);
        this.broadcast("tala", tala);
        this.broadcast("hdensity", [this.density]);
        this.broadcast("vdensity", [
          this.partState.reduce((sum, value) => sum + value, 0) / this.partState.length
        ]);
        this.broadcast("activity", [this.partState]);
      }
      this.pattern(tick, clock);
    }
    pattern(tick, clock) {
      if (this.partState[0]) {
        const active = this.rhythm(clock, this.config, this.density)[clock.tickInBar];
        if (clock.groupStart && (clock.barStart || this.instanceAllows(clock, 0, 0.82)))
          this.audio.kick();
        if (clock.beatStart && clock.groupBeat === Math.floor(clock.meter.groups[clock.group] / 2) && this.instanceAllows(clock, 1, 0.86))
          this.audio.snare();
        if (active) this.audio.hat();
      }
      for (const [index, voice] of this.config.percussionVoices.entries()) {
        if (!this.partState[index + 1]) continue;
        const voiceConfig = { ...voice, sharedDensityRange: [0.05, 0.8] }, active = this.rhythm(clock, voiceConfig, this.density * voice.density)[clock.tickInBar];
        if (active && this.instanceAllows(clock, index + 2, 0.82))
          this.audio.cleanPercussion(index, 0.4 + this.density * 0.6);
      }
    }
  };
  var ClumpyBeatBot = class extends CleanBeatBot {
    configuration() {
      return STOCHASTIC_CONFIG.clumpyBeat;
    }
    pattern(tick, clock) {
      const steps = clock.meter.pulsesPerBar, hits = Math.max(1, Math.round(steps * this.density));
      if (this.partState[0]) {
        const active = clumpedRhythm(
          hits,
          clock.meter.groups,
          clock.meter.subdivision,
          this.instancePhase || 0
        )[clock.tickInBar];
        if (clock.groupStart) this.audio.kick();
        if (clock.beatStart && clock.groupBeat === Math.floor(clock.meter.groups[clock.group] / 2) && this.instanceAllows(clock, 1, 0.75))
          this.audio.snare();
        if (active) this.audio.hat();
      }
      for (const [index, voice] of this.config.percussionVoices.entries()) {
        if (!this.partState[index + 1]) continue;
        const voiceHits = Math.max(
          1,
          Math.round(steps * this.density * voice.density)
        ), active = clumpedRhythm(
          voiceHits,
          clock.meter.groups,
          clock.meter.subdivision,
          voice.rotation + (this.instancePhase || 0)
        )[clock.tickInBar];
        if (active && this.instanceAllows(clock, index + 2, 0.82))
          this.audio.cleanPercussion(index, 0.35 + this.density * 0.6);
      }
    }
  };
  var NoiseBeatBot = class extends CleanBeatBot {
    configuration() {
      return STOCHASTIC_CONFIG.noiseBeat;
    }
    pattern(tick, clock) {
      if (this.partState[0]) {
        const active = this.rhythm(clock, this.config, this.density)[clock.tickInBar];
        if (clock.groupStart && (clock.barStart || this.instanceAllows(clock, 0, 0.8)))
          this.audio.noiseDrum("kick");
        if (clock.beatStart && clock.groupBeat === Math.floor(clock.meter.groups[clock.group] / 2) && this.instanceAllows(clock, 1, 0.8))
          this.audio.noiseDrum("snare");
        if (active) this.audio.noiseDrum("hat");
      }
      for (const [index, voice] of this.config.percussionVoices.entries()) {
        if (!this.partState[index + 1]) continue;
        const voiceConfig = { ...voice, sharedDensityRange: [0.05, 0.8] }, active = this.rhythm(clock, voiceConfig, this.density * voice.density)[clock.tickInBar];
        if (active && this.instanceAllows(clock, index + 2, 0.84))
          this.audio.noisePercussion(index, 0.4 + this.density * 0.6);
      }
    }
  };
  var NewBeatBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.newBeat;
      this.activityMask = [...this.config.activityMask];
      this.receivedMasks = [];
      this.lastPhrase = -1;
      this.patterns = /* @__PURE__ */ new Map();
    }
    onMessage(message) {
      super.onMessage(message);
      const intent = parseCompoundIntent(message);
      if (intent && intent.sender !== "ae_newBeatBOT" && intent.sender !== this.instanceId && intent.activityMask) {
        this.receivedMasks.push(intent.activityMask);
        return;
      }
      if (message.address === "/broadcast/intent/activityMask")
        this.receivedMasks.push(normalizeActivityMask(message.args));
    }
    makeBarPattern(clock, barIndex, label, phraseStarts) {
      const steps = clock.meter.pulsesPerBar, offset = barIndex * steps, anchors = phraseStarts.filter((value) => value >= offset && value < offset + steps).map((value) => value - offset), activityStart = Math.floor(
        barIndex * this.activityMask.length / this.config.phraseBars
      ), activityEnd = Math.max(
        activityStart + 1,
        Math.floor(
          (barIndex + 1) * this.activityMask.length / this.config.phraseBars
        )
      ), activity = this.activityMask.slice(activityStart, activityEnd), level = activity.reduce((sum, value) => sum + value, 0) / (activity.length * 9), rotation = (this.instancePhase || 0) + barIndex;
      const kick = Array(steps).fill(0), snare = Array(steps).fill(0);
      for (const onset of anchors) kick[onset] = 1;
      kick[0] = 1;
      snare[Math.floor(steps / 2)] = 1;
      const hat = cyclicPattern({
        steps,
        hits: Math.max(1, Math.round(steps * (0.18 + level * 0.54))),
        rotation
      }), percussion = this.config.percussionVoices.map(
        (voice, index) => cyclicPattern({
          steps,
          hits: Math.max(
            1,
            Math.round(steps * Math.max(0.04, level) * voice.density)
          ),
          rotation: rotation + voice.rotation + index
        })
      );
      return { label, kick, snare, hat, percussion, level };
    }
    beginPhrase(clock) {
      if (this.lastPhrase >= 0)
        this.activityMask = residualActivityMask(
          this.config.activityMask,
          this.receivedMasks
        );
      this.receivedMasks = [];
      this.lastPhrase = clock.phrase;
      const bars = clock.meter.phraseBars || this.config.phraseBars, total = clock.meter.pulsesPerBar * bars, source = this.config.sourceTalaStructure, structure = source.reduce((sum, value) => sum + value, 0) === total ? [...source] : defaultGrouping(total), starts = additiveGroupStarts(structure, total), repetition = normalizeRepetitionStructure(
        this.config.repetitionStructure,
        bars
      );
      this.talaStructure = structure;
      this.repetitionStructure = repetition;
      this.patterns = /* @__PURE__ */ new Map();
      for (let bar = 0; bar < bars; bar++) {
        const label = repetition[bar], pattern = this.patterns.get(label) || this.makeBarPattern(clock, bar, label, starts);
        this.patterns.set(label, pattern);
      }
      this.broadcast(
        "intent",
        serializeIntentFields("ae_newBeatBOT", {
          repetitionStructure: repetition,
          talaStructure: structure,
          activityMask: this.activityMask
        })
      );
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      tickInBar: tick % 16,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.lastPhrase)
        this.beginPhrase(clock);
      if (!this.patterns.size)
        this.beginPhrase({ ...clock, phrase: clock.phrase || 0 });
      const bar = clock.bar % (clock.meter.phraseBars || this.config.phraseBars), label = this.repetitionStructure[bar], pattern = this.patterns.get(label);
      if (!pattern) return;
      const step = clock.tickInBar, accent = 0.35 + pattern.level * 0.65;
      if (pattern.kick[step]) this.audio.kick();
      if (pattern.snare[step] && this.instanceAllows(clock, 1, 0.88))
        this.audio.snare();
      if (pattern.hat[step]) this.audio.hat();
      for (const [index, cycle] of pattern.percussion.entries())
        if (cycle[step] && this.instanceAllows(clock, index + 2, 0.72))
          this.audio.cleanPercussion(index, accent);
    }
  };
  var HouseBeatBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.memoryDevelopmentEnabled = true;
      this.config = STOCHASTIC_CONFIG.houseBeat;
      this.section = this.config.defaultSection;
      const fallback = Array.from(
        { length: 128 },
        (_, index) => this.config.fallbackBar[index % 16]
      );
      this.corpus = {
        patterns: [fallback],
        ratings: [this.config.sectionTargets[this.section]]
      };
      this.sections = /* @__PURE__ */ new Map();
      this.generateSection(this.section);
    }
    async start() {
      const response = await fetch("./data/house-beats.json"), corpus = await response.json();
      if (corpus.patterns?.length !== 1194 || corpus.ratings?.length !== 1194 || corpus.patterns.some((pattern) => pattern.length !== 128))
        throw new Error("Invalid HouseBeat corpus");
      this.corpus = corpus;
      this.sections.clear();
      this.generateSection(this.section);
    }
    generateSection(section) {
      const target = this.config.sectionTargets[section] || this.config.sectionTargets.C, nearest = nearestRecords(
        this.corpus.ratings,
        target,
        this.config.nearestCount
      ), rank = exponentialRankIndex(nearest.length, this.config.rankBase), selected = nearest[rank] || nearest[0], pattern = this.corpus.patterns[selected?.index || 0];
      this.sections.set(section, {
        pattern: [...pattern],
        corpusIndex: selected?.index || 0,
        target
      });
      return this.sections.get(section);
    }
    selectSection(value) {
      let section = String(value ?? "").toUpperCase();
      const labels = Object.keys(this.config.sectionTargets);
      if (/^\d+$/.test(section))
        section = labels[(Number(section) % labels.length + labels.length) % labels.length];
      if (!this.config.sectionTargets[section]) return;
      this.section = section;
      if (!this.sections.has(section)) this.generateSection(section);
    }
    onMemoryRecall(motifs = []) {
      const own = motifs.filter((motif) => motif.author === this.instanceId);
      if (own.length < 2) return;
      const labels = Object.keys(this.config.sectionTargets), current = Math.max(0, labels.indexOf(this.section)), next = labels[(current + 1 + this.instanceHash % Math.max(1, labels.length - 1)) % labels.length];
      this.section = next;
      this.generateSection(next);
      this.lastSourceStep = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/section"))
        this.selectSection(message.args.at(-1));
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      tickInBar: tick % 16,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 8,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.broadcast("tala", this.config.sourceTala);
        this.broadcast("phraselength", [this.config.phraseBars]);
      }
      const sourceStep2 = clock.bar % this.config.phraseBars * 16 + Math.min(
        15,
        Math.floor(clock.tickInBar / clock.meter.pulsesPerBar * 16)
      );
      if (sourceStep2 === this.lastSourceStep) return;
      this.lastSourceStep = sourceStep2;
      const mask = this.sections.get(this.section)?.pattern[sourceStep2] || 0, accent = this.config.velocityCycle[sourceStep2 % this.config.velocityCycle.length];
      if (mask & 8) this.audio.houseDrum("kick", accent);
      if (mask & 4) this.audio.houseDrum("snare", accent);
      if (mask & 2) this.audio.houseDrum("closedHat", accent);
      if (mask & 1) this.audio.houseDrum("openHat", accent);
    }
  };
  var PercBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.percBeat;
      this.phraseBars = weightedChoice(
        this.config.phraseLengths,
        this.config.phraseWeights
      );
      const [low, high] = this.config.formRandomRange;
      this.formPhrases = low + randomInt(high - low);
      this.amplitudes = Array.from(
        { length: 3 },
        (_, index) => Math.round((index + 1) * this.config.amplitudeWalk.range / 4)
      );
      this.delays = [2, 6, 10];
      this.patterns = [];
      this.lastLocalPhrase = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if ((message.address.endsWith("/hdensity") || message.address.endsWith("/density")) && !message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.density = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Number(message.args.at(-1));
        if (Number.isInteger(value) && value > 0)
          this.pendingPhraseBars = Math.min(64, value);
      }
      if (message.address.endsWith("/phrases")) {
        const value = Number(message.args.at(-1));
        if (Number.isInteger(value) && value > 0)
          this.formPhrases = Math.min(256, value);
      }
    }
    generatePatterns(clock, localPhrase) {
      if (this.pendingPhraseBars) {
        this.phraseBars = this.pendingPhraseBars;
        this.pendingPhraseBars = null;
      }
      const steps = clock.meter.pulsesPerBar * this.phraseBars, [minimum, maximum] = this.config.densityMaskRange, maskDensity = minimum + this.density * (maximum - minimum);
      this.partState = this.config.voiceDensityScale.map(
        (_, index) => this.instanceAllows(
          { bar: localPhrase, group: index },
          index,
          0.55 + this.density * 0.4
        )
      );
      if (!this.partState.some(Boolean)) this.partState[localPhrase % 3] = true;
      this.patterns = this.config.voiceDensityScale.map((scale) => {
        const onsets = randomDupleOnsets(steps), count = Math.max(1, Math.round(onsets.length * maskDensity * scale)), cycle = cyclicPattern({ steps, clave: onsets.slice(0, count) }), first = Math.min(...onsets);
        if (Number.isFinite(first)) cycle[first] = 1;
        return cycle;
      });
      this.lastSourceStep = -1;
    }
    onTick(tick, clock = {
      barStart: tick % 16 === 0,
      bar: Math.floor(tick / 16),
      tickInBar: tick % 16,
      bpm: 120,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      const localPhrase = Math.floor(clock.bar / this.phraseBars), boundary = clock.barStart && clock.bar % this.phraseBars === 0;
      if (!this.patterns.length || boundary && localPhrase !== this.lastLocalPhrase) {
        this.lastLocalPhrase = localPhrase;
        this.generatePatterns(clock, localPhrase);
      }
      const sourceStep2 = clock.bar % this.phraseBars * clock.meter.pulsesPerBar + clock.tickInBar;
      if (sourceStep2 === this.lastSourceStep) return;
      this.lastSourceStep = sourceStep2;
      for (let index = 0; index < 3; index++) {
        if (!this.partState[index] || !this.patterns[index]?.[sourceStep2])
          continue;
        const amplitudeConfig = this.config.amplitudeWalk, delayConfig = this.config.delayWalk;
        this.amplitudes[index] = boundedDrunk(
          this.amplitudes[index],
          amplitudeConfig.range,
          amplitudeConfig.step
        );
        this.delays[index] = boundedDrunk(
          this.delays[index],
          delayConfig.range,
          delayConfig.step
        );
        const accent = amplitudeConfig.output[0] + this.amplitudes[index] / (amplitudeConfig.range - 1) * (amplitudeConfig.output[1] - amplitudeConfig.output[0]), phase = (sourceStep2 / Math.max(1, this.patterns[index].length) + index / 3) % 1, cutoff = this.config.filterRange[0] * Math.pow(
          this.config.filterRange[1] / this.config.filterRange[0],
          phase * this.config.voiceCutoffScale[index]
        ), delay = 60 / (clock.bpm || 120), feedback = this.config.delayGainRange[0] + this.delays[index] / (delayConfig.range - 1) * (this.config.delayGainRange[1] - this.config.delayGainRange[0]);
        this.audio.modulatedPercussion(index, accent, {
          cutoff,
          delay,
          feedback
        });
      }
    }
  };
  var PapPercBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.papPerc;
      this.density = this.config.rhythmDensity;
      this.densityLease = new FallbackControlLease(this.config.silenceBars);
      this.fallbackCurve = Array.from(
        { length: this.config.fallbackCurvePoints },
        () => unitRandom()
      );
      this.lastSourceStep = -1;
      this.lastBoundaryBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if ((message.address.endsWith("/hdensity") || message.address.endsWith("/density")) && !message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.density = Math.max(0, Math.min(1, value));
          this.densityLease.receive(this.density);
        }
      }
    }
    updateOwnership(clock) {
      if (!clock.barStart || clock.bar === this.lastBoundaryBar) return;
      if (this.lastBoundaryBar != null) {
        const owned = this.densityLease.advanceBoundary();
        if (owned && (!this.wasFallback || clock.bar % this.config.silenceBars === 0))
          this.fallbackCurve = Array.from(
            { length: this.config.fallbackCurvePoints },
            () => unitRandom()
          );
        this.wasFallback = owned;
      }
      this.lastBoundaryBar = clock.bar;
    }
    activeDensity(clock) {
      if (!this.densityLease.ownsFallback) return this.density;
      const position = (clock.bar % this.config.silenceBars + clock.tickInBar / clock.meter.pulsesPerBar) / this.config.silenceBars;
      return Math.max(
        0,
        Math.min(1, interpolateControlPoints(this.fallbackCurve, position, true))
      );
    }
    onTick(tick, clock = {
      barStart: tick % 16 === 0,
      bar: Math.floor(tick / 16),
      tickInBar: tick % 16,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      this.updateOwnership(clock);
      const sourceStep2 = Math.min(
        15,
        Math.floor(clock.tickInBar / clock.meter.pulsesPerBar * 16)
      );
      if (sourceStep2 === this.lastSourceStep && !clock.barStart) return;
      this.lastSourceStep = sourceStep2;
      const density = this.activeDensity(clock), kickScale = (Math.exp(density * Math.log(this.config.kickDensityBase)) - 1) / (this.config.kickDensityBase - 1), probabilities = [
        this.config.kickProb[sourceStep2] * kickScale,
        this.config.midProb[sourceStep2] * density,
        this.config.noiseProb[sourceStep2] * density
      ];
      if (unitRandom() < probabilities[0])
        this.audio.papPercussion("kick", 0, density);
      if (unitRandom() < probabilities[1])
        this.audio.papPercussion("mid", sourceStep2 % 2, density);
      if (unitRandom() < probabilities[2])
        this.audio.papPercussion(
          "noise",
          randomInt(this.config.noiseBands.length),
          density
        );
    }
  };
  var MhBeatBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.mhBeat;
      this.density = this.config.rhythmDensity;
      this.activity = this.config.activity;
      this.playing = true;
      this.stateUntilTick = null;
      this.lastSourceStep = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.activity = Math.max(0, Math.min(1, value));
      }
    }
    stateDurationTicks(clock, playing) {
      const [minimum, maximum] = this.config.randomDurationRange, randomSeconds = minimum + unitRandom() * (maximum - minimum), activitySeconds = this.config.durationScaleSeconds * (playing ? this.activity : 1 - this.activity), ticksPerSecond = (clock.bpm || 120) / 60 * clock.meter.subdivision;
      return Math.max(
        1,
        Math.round((activitySeconds + randomSeconds) * ticksPerSecond)
      );
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      tickInBar: tick % 16,
      bpm: 120,
      meter: {
        numerator: 4,
        groups: [4],
        subdivision: 4,
        phraseBars: 4,
        pulsesPerBar: 16,
        rhythm: {}
      }
    }) {
      if (this.stateUntilTick == null)
        this.stateUntilTick = tick + this.stateDurationTicks(clock, true);
      if (tick >= this.stateUntilTick) {
        this.playing = !this.playing;
        this.stateUntilTick = tick + this.stateDurationTicks(clock, this.playing);
      }
      if (!this.playing) return;
      const barPosition = clock.bar % this.config.contourBars, sourceStep2 = barPosition * 16 + Math.min(
        15,
        Math.floor(clock.tickInBar / clock.meter.pulsesPerBar * 16)
      );
      if (sourceStep2 === this.lastSourceStep) return;
      this.lastSourceStep = sourceStep2;
      const busyness = Math.max(
        0,
        Math.min(1, this.density * Math.sqrt(this.activity))
      ), contours = [
        this.config.kickContour,
        this.config.snareContour,
        this.config.cymbalContour
      ], kinds = ["kick", "snare", "cymbal"];
      for (let index = 0; index < 3; index++) {
        const probability = contours[index][sourceStep2] / 100 * busyness;
        if (unitRandom() < probability)
          this.audio.mhBeatDrum(kinds[index], 0.35 + 0.65 * busyness);
      }
    }
  };
  var MhBeatsynthBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.mhBeatsynth;
      this.density = this.config.rhythmDensity;
      this.now = () => Date.now();
      this.densityLease = new StaleValueLease(
        this.config.staleValueMs,
        () => this.now()
      );
      this.sequence = [];
      this.sequenceIndex = 0;
      this.lastBar = null;
      this.fallbackFrom = this.density;
      this.fallbackTarget = this.density;
      this.fallbackStart = 0;
      this.fallbackEnd = 0;
      this.generateSequence();
    }
    generateSequence() {
      const [low, high] = this.config.sequenceUnitRange, units = low + randomInt(high - low);
      this.sequence = [];
      for (let unit = 0; unit < units; unit++) {
        const row = this.config.patternRows[randomInt(this.config.generatedRowCount)];
        this.sequence.push(...row.map((cell) => cell && [...cell]));
      }
      const firstActive = this.sequence.findIndex(Boolean);
      if (firstActive > 0)
        this.sequence = [
          ...this.sequence.slice(firstActive),
          ...this.sequence.slice(0, firstActive)
        ];
      this.sequenceIndex = 0;
      return this.sequence;
    }
    onMessage(message) {
      super.onMessage(message);
      if (!message.address.endsWith("/hdensity")) return;
      const sender = typeof message.args[0] === "string" ? message.args[0] : "";
      if (sender === "mhBeatsynthBOT" || sender === this.instanceId) return;
      const value = Number(message.args.at(-1));
      if (this.densityLease.receive(value))
        this.density = Math.max(0, Math.min(1, value));
    }
    densityGate() {
      return randomProductGate(
        this.density,
        this.config.gateLeftRange,
        this.config.gateRightRange
      );
    }
    updateFallback(at) {
      if (!this.densityLease.update(at)) return;
      if (at >= this.fallbackEnd) {
        this.fallbackFrom = this.density;
        const [targetLow, targetHigh] = this.config.fallbackTargetRange;
        this.fallbackTarget = (targetLow + randomInt(targetHigh - targetLow)) / 100;
        const [rampLow, rampHigh] = this.config.fallbackRampMsRange;
        this.fallbackStart = at;
        this.fallbackEnd = at + rampLow + randomInt(rampHigh - rampLow);
      }
      const phase = Math.max(
        0,
        Math.min(
          1,
          (at - this.fallbackStart) / Math.max(1, this.fallbackEnd - this.fallbackStart)
        )
      );
      this.density = this.fallbackFrom + (this.fallbackTarget - this.fallbackFrom) * phase;
      this.send("/broadcast/hdensity", ["mhBeatsynthBOT", this.density]);
    }
    onTick(tick, clock = { bar: Math.floor(tick / 16), barStart: tick % 16 === 0 }) {
      this.updateFallback(this.now());
      if (!clock.barStart || clock.bar === this.lastBar || this.lastBar != null && !this.densityGate())
        return;
      this.lastBar = clock.bar;
      const cell = this.sequence[this.sequenceIndex++];
      if (cell)
        for (const voice of cell)
          this.audio.mhBeatsynth(voice, 0.4 + 0.6 * this.density, this.config);
      if (this.sequenceIndex >= this.sequence.length) {
        if (randomInt(3) === 0) this.generateSequence();
        else this.sequenceIndex = 0;
      }
    }
  };
  var SampleBeatBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.sampleBeat;
      this.notes = [...this.config.initialNotePool];
      this.poolKey = "";
      this.resonanceNote = 48;
      this.lastSourceStep = -1;
      this.lastBar = null;
      this.barsOnLoop = 0;
      this.chooseLoopAfter = this.nextLoopLength();
      this.resonatorPreset = randomInt(this.config.resonatorGainPresets.length);
      this.adoptNotePool(this.notes);
    }
    nextLoopLength() {
      const [low, high] = this.config.sampleChangeBarsRange;
      return low + randomInt(high - low);
    }
    resonanceCandidates(values) {
      const pitchClasses = [
        ...new Set(values.map(pitchClass).filter((value) => value !== null))
      ].sort((a, b) => a - b);
      if (pitchClasses.length) pitchClasses.push(pitchClasses[0]);
      return pitchClasses;
    }
    adoptNotePool(values) {
      const notes = values.map(Number).filter(Number.isFinite), key = JSON.stringify(notes);
      if (!notes.length || key === this.poolKey) return false;
      this.poolKey = key;
      const pitchClasses = this.resonanceCandidates(notes);
      this.resonanceNote = 48 + pitchClasses[randomInt(pitchClasses.length)];
      return true;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool")) this.adoptNotePool(message.args);
    }
    chooseNewLoop() {
      this.barsOnLoop = 0;
      this.chooseLoopAfter = this.nextLoopLength();
      this.resonatorPreset = randomInt(this.config.resonatorGainPresets.length);
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      barStart: tick % 16 === 0,
      tickInBar: tick % 16,
      meter: { pulsesPerBar: 16 }
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        if (this.lastBar != null && ++this.barsOnLoop > this.chooseLoopAfter)
          this.chooseNewLoop();
        this.lastBar = clock.bar;
      }
      const sourceStep2 = Math.min(
        this.config.sourceSteps - 1,
        Math.floor(
          clock.tickInBar / Math.max(1, clock.meter.pulsesPerBar) * this.config.sourceSteps
        )
      );
      if (sourceStep2 === this.lastSourceStep && !clock.barStart) return;
      this.lastSourceStep = sourceStep2;
      this.audio.sampleBeatLoop(
        this.resonanceNote,
        sourceStep2,
        0.7,
        this.config,
        this.resonatorPreset
      );
    }
  };
  var AutechreBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.autechre;
      this.phraseCurve = [];
      this.patterns = { kick: [], snare: [], hat: [] };
      this.voiceCurves = {};
      this.subdivision = this.config.initialSubdivision;
      this.drunkSubdivision = this.subdivision - this.config.subdivisionOffset;
      this.lastBar = null;
      this.lastPhrase = null;
      this.lastDensityBroadcastAt = null;
      this.now = () => Date.now();
      this.generateVoiceCurves();
      this.generatePhrase();
    }
    generateVoiceCurves() {
      for (const [voice, [low, high]] of Object.entries(
        this.config.voiceDensityKneeRanges
      )) {
        const x = low + unitRandom() * (high - low), [yLow, yHigh] = this.config.densityKneeOutputRange, y = yLow + unitRandom() * (yHigh - yLow);
        this.voiceCurves[voice] = [
          { x: 0, y: 0 },
          { x, y },
          { x: 1, y: 1 }
        ];
      }
    }
    generatePhrase() {
      const config = this.config;
      this.tala = randomAdditiveGrouping(
        config.sourceSteps,
        config.additiveParts
      );
      const starts = additiveGroupStarts(this.tala, config.sourceSteps);
      this.patterns.kick = [starts[0], ...scramble(starts.slice(1))];
      this.patterns.snare = scramble(
        starts.map((value) => (value + 1) % config.sourceSteps)
      );
      this.patterns.hat = scramble(
        Array.from({ length: config.sourceSteps }, (_, index) => index)
      );
      this.phraseCurve = randomFivePointCurve({
        xRanges: config.phraseCurveXRanges,
        terminalWeights: config.phraseCurveTerminalWeights
      });
    }
    updateSubdivision() {
      const config = this.config;
      if (unitRandom() >= config.subdivisionChangeChance) return false;
      if (unitRandom() < config.forceSixteenthsChance) this.subdivision = 16;
      else {
        this.drunkSubdivision = boundedDrunk(
          this.drunkSubdivision,
          config.subdivisionDrunkRange,
          config.subdivisionDrunkStep
        );
        this.subdivision = this.drunkSubdivision + config.subdivisionOffset;
      }
      this.broadcast("subdivision", [this.subdivision]);
      return true;
    }
    densityAt(position) {
      return Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.phraseCurve, position))
      );
    }
    activeOnsets(voice, density) {
      const pattern = this.patterns[voice], amount = interpolateCurvePoints(this.voiceCurves[voice], density), count = Math.max(
        0,
        Math.min(pattern.length, Math.trunc(pattern.length * amount))
      );
      return pattern.slice(0, count);
    }
    scheduleBar(clock) {
      const meter = clock.meter, barDuration = 60 / (clock.bpm || 120) * meter.numerator * 4 / meter.denominator, phraseBar = (clock.bar % (meter.phraseBars || this.config.phraseBars) + (meter.phraseBars || this.config.phraseBars)) % (meter.phraseBars || this.config.phraseBars), phraseBars = meter.phraseBars || this.config.phraseBars, effects = {
        sampleRate: this.config.degradeSampleRateRange[0] + unitRandom() * (this.config.degradeSampleRateRange[1] - this.config.degradeSampleRateRange[0]),
        bits: this.config.degradeBitsRange[0] + unitRandom() * (this.config.degradeBitsRange[1] - this.config.degradeBitsRange[0]),
        wet: this.config.delayWetRange[0] + unitRandom() * (this.config.delayWetRange[1] - this.config.delayWetRange[0]),
        delaySeconds: barDuration / this.config.sourceSteps
      };
      let densityForMessage = 0;
      for (const voice of ["kick", "snare", "hat"]) {
        let onsets = this.activeOnsets(
          voice,
          this.densityAt(phraseBar / phraseBars)
        );
        if (clock.bar === 0 && voice === "kick" && !onsets.includes(0))
          onsets = [0, ...onsets];
        for (const onset of onsets) {
          const raw = onset / this.config.sourceSteps, quantized = Math.round(raw * this.subdivision) / this.subdivision, phrasePosition2 = (phraseBar + quantized) / phraseBars, density = this.densityAt(phrasePosition2), accent = 0.35 + 0.65 * density;
          densityForMessage = Math.max(densityForMessage, density);
          this.audio.autechreDrum(
            voice,
            accent,
            effects,
            Math.max(0, quantized * barDuration)
          );
        }
      }
      const now = this.now();
      if (this.lastDensityBroadcastAt == null || now - this.lastDensityBroadcastAt >= this.config.densityBroadcastMinMs) {
        this.lastDensityBroadcastAt = now;
        this.broadcast("hdensity", [
          Math.round(densityForMessage / this.config.densityBroadcastResolution) * this.config.densityBroadcastResolution
        ]);
      }
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      phrase: Math.floor(tick / 64),
      barStart: tick % 16 === 0,
      phraseStart: tick % 64 === 0,
      bpm: 120,
      meter: { numerator: 4, denominator: 4, phraseBars: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.generatePhrase();
      }
      this.lastBar = clock.bar;
      this.updateSubdivision();
      this.scheduleBar(clock);
    }
  };
  var ProckRockBeadsBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.prockRock;
      this.current = this.initialIntent();
      this.next = null;
      this.received = /* @__PURE__ */ new Map();
      this.lastPhrase = -1;
      this.lastSourceStep = -1;
      this.stepsSinceTala = 0;
      this.register = 0;
    }
    initialIntent() {
      const c = this.config;
      return {
        activityMask: [...c.activityMask],
        repetitionStructure: [...c.repetitionStructure],
        talaStructure: [...c.talaStructure],
        contourA: [...c.contourA],
        iFollow: null,
        synchro: c.synchro
      };
    }
    onMessage(message) {
      super.onMessage(message);
      const intent = parseCompoundIntent(message);
      if (intent && intent.sender && intent.sender !== this.instanceId && intent.sender !== "ob_prockRockBeadsBot")
        this.received.set(intent.sender, intent);
    }
    publish() {
      this.broadcast(
        "intent",
        serializeIntentFields("ob_prockRockBeadsBot", this.current)
      );
    }
    plan() {
      const intents = [...this.received.values()];
      this.next = {
        ...this.current,
        activityMask: [...this.current.activityMask],
        repetitionStructure: [...this.current.repetitionStructure],
        talaStructure: [...this.current.talaStructure],
        contourA: [...this.current.contourA]
      };
      if (intents.length > 1) {
        const sync = intents.map((value) => value.synchro).filter(Number.isFinite);
        if (sync.length)
          this.next.synchro = sync.reduce((a, b) => a + b, 0) / sync.length;
        const votes = /* @__PURE__ */ new Map();
        for (const value of intents)
          if (value.iFollow)
            votes.set(value.iFollow, (votes.get(value.iFollow) || 0) + 1);
        const leader = [...votes].sort((a, b) => b[1] - a[1])[0];
        if (leader?.[1] >= this.config.minimumFollowVotes)
          this.next.iFollow = leader[0];
        if (unitRandom() < this.config.followChance)
          this.next.iFollow = intents[randomInt(intents.length)].sender;
        const followed = this.received.get(this.next.iFollow);
        if (followed?.contourA) this.next.contourA = [...followed.contourA];
        if (followed?.talaStructure?.length)
          this.next.talaStructure = [...followed.talaStructure];
      }
      this.received.clear();
    }
    talaStarts() {
      const starts = /* @__PURE__ */ new Set([0]);
      let total = 0;
      for (const part of this.next?.talaStructure || []) {
        total += part;
        starts.add(total);
      }
      return starts;
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick % 16 === 0,
      tickInBar: tick % 16,
      meter: { pulsesPerBar: 16, phraseBars: 4 }
    }) {
      const bars = clock.meter.phraseBars || 4, phrase = Math.floor(clock.bar / bars), phraseBar = (clock.bar % bars + bars) % bars, sourceStep2 = Math.min(
        255,
        Math.floor(clock.tickInBar / clock.meter.pulsesPerBar * 64) + phraseBar * 64
      );
      if (phrase !== this.lastPhrase) {
        if (this.next) this.current = this.next;
        this.next = null;
        this.lastPhrase = phrase;
        this.lastSourceStep = -1;
        this.stepsSinceTala = 0;
      }
      if (sourceStep2 === 64 && this.lastSourceStep < 64) this.publish();
      if (sourceStep2 === 192 && this.lastSourceStep < 192) this.plan();
      if (sourceStep2 % 32 === 0 && sourceStep2 !== this.lastSourceStep)
        this.register += this.current.contourA[Math.floor(sourceStep2 / 32)] === "U" ? 1 : -1;
      if (sourceStep2 % 2 === 0 && sourceStep2 !== this.lastSourceStep) {
        const maskIndex = Math.floor(sourceStep2 / 16), activity = Math.trunc((this.current.activityMask[maskIndex] || 0) / 3);
        if (activity > 0) {
          const eighth = Math.floor(sourceStep2 / 4), isTala = this.talaStarts().has(eighth);
          this.stepsSinceTala = isTala ? 0 : this.stepsSinceTala + 1;
          this.audio.prockRockDrum(this.stepsSinceTala, activity);
        }
      }
      this.lastSourceStep = sourceStep2;
    }
  };
  var ResynthBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.resynth;
      this.activityMask = [...this.config.activityMasks[2]];
      this.pitchclassPool = [
        ...this.config.pitchclassPools[randomInt(this.config.pitchclassPools.length)]
      ];
      this.contour = [
        ...this.config.contours[randomInt(this.config.contours.length)]
      ];
      this.receivedMasks = [];
      this.lastPhrase = -1;
      this.lastCell = -1;
      this.register = 60;
      this.model = randomInt(this.config.spectralModels.length);
    }
    onMessage(message) {
      super.onMessage(message);
      const intent = parseCompoundIntent(message);
      if (intent && intent.sender !== this.instanceId && intent.sender !== "bc.resynth_bot" && intent.activityMask)
        this.receivedMasks.push(intent.activityMask);
      else if (message.address === "/broadcast/intent/activityMask")
        this.receivedMasks.push(normalizeActivityMask(message.args));
    }
    beginPhrase(clock) {
      if (this.lastPhrase >= 0) {
        this.activityMask = this.receivedMasks.length ? residualActivityMask(
          this.config.activityMasks[randomInt(this.config.activityMasks.length)],
          this.receivedMasks
        ) : [
          ...this.config.activityMasks[randomInt(this.config.activityMasks.length)]
        ];
        this.pitchclassPool = [
          ...this.config.pitchclassPools[randomInt(this.config.pitchclassPools.length)]
        ];
        this.contour = [
          ...this.config.contours[randomInt(this.config.contours.length)]
        ];
        this.model = randomInt(this.config.spectralModels.length);
      }
      this.receivedMasks = [];
      this.lastPhrase = clock.phrase;
      this.lastCell = -1;
      this.broadcast(
        "intent",
        serializeIntentFields("bc.resynth_bot", {
          activityMask: this.activityMask,
          contourA: this.contour,
          pitchclassPool: this.pitchclassPool,
          talaStructure: this.config.talaStructure
        })
      );
    }
    noteFor(cell) {
      const direction = this.contour[Math.min(this.contour.length - 1, Math.floor(cell / 2))];
      this.register = Math.max(
        this.config.registerRange[0],
        Math.min(
          this.config.registerRange[1],
          this.register + (direction === "U" ? randomInt(this.config.registerStep + 1) : -randomInt(this.config.registerStep + 1))
        )
      );
      const pc = this.pitchclassPool[cell % this.pitchclassPool.length], target = this.register + (pc - this.register % 12 + 12) % 12;
      return target > this.config.registerRange[1] ? target - 12 : target;
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      subdivision: 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.lastPhrase)
        this.beginPhrase(clock);
      const cell = cycleIndexAtPhrasePosition(clock, 16);
      if (cell === this.lastCell) return;
      this.lastCell = cell;
      const activity = this.activityMask[cell] || 0;
      if (activity <= 0 || !clock.phraseStart && randomInt(10) >= activity)
        return;
      const [low, high] = this.config.noteDurationBeats, duration = (low + unitRandom() * (high - low)) * 60 / (clock.bpm || 108), velocity = Math.max(
        0.15,
        Math.min(
          1,
          0.45 + activity / 18 + (unitRandom() - 0.5) * this.config.velocityVariation
        )
      );
      this.audio.resynth(
        this.noteFor(cell),
        duration,
        velocity,
        this.config.spectralModels[this.model],
        this.model
      );
    }
  };
  var VinylBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.vinyl;
      this.lastSegment = null;
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      barStart: tick % 16 === 0,
      bpm: 108,
      meter: { numerator: 4 }
    }) {
      if (!clock.barStart && this.lastSegment != null) return;
      const segment = Math.floor((clock.bar || 0) / this.config.segmentBars);
      if (segment === this.lastSegment) return;
      this.lastSegment = segment;
      const duration = Math.max(
        2,
        this.config.segmentBars * (clock.meter?.numerator || 4) * 60 / (clock.bpm || 108) + 0.25
      );
      this.audio.vinylTexture(duration, this.config);
    }
  };
  var SweeperBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.sweeper;
      this.lastBar = null;
      this.barsUntilSweep = 1;
    }
    reset() {
      const [low, high] = this.config.barsUntilSweepRange;
      this.barsUntilSweep = low + randomInt(high - low + 1);
    }
    onTick(tick, clock = { bar: Math.floor(tick / 16), barStart: tick % 16 === 0 }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      if (--this.barsUntilSweep > 0) return;
      const [low, high] = this.config.durationMsRange, duration = (low + randomInt(high - low + 1)) / 1e3;
      this.audio.filterSweep(duration, this.config);
      this.reset();
    }
  };
  var FmTextureBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.fmTexture;
      this.activityMask = [...this.config.defaultActivityMask];
      this.pitchclassPool = [...this.config.defaultPitchclassPool];
      this.receivedMasks = [];
      this.lastPhrase = -1;
      this.lastCell = -1;
      this.registerIndex = 3;
      this.timbre = {};
      this.changeTimbre();
    }
    onMessage(message) {
      super.onMessage(message);
      const intent = parseCompoundIntent(message);
      if (intent && intent.sender !== this.instanceId && intent.sender !== "k_FMBOT") {
        if (intent.activityMask) this.receivedMasks.push(intent.activityMask);
        if (intent.pitchclassPool?.length)
          this.pitchclassPool = [...intent.pitchclassPool];
      }
    }
    changeTimbre() {
      const c = this.config;
      this.timbre = {
        carrierRatio: c.carrierRatios[randomInt(c.carrierRatios.length)],
        modulatorRatio: c.modulatorRatios[randomInt(c.modulatorRatios.length)],
        index: c.modulationIndexRange[0] + unitRandom() * (c.modulationIndexRange[1] - c.modulationIndexRange[0]),
        amDepth: c.amDepthRange[0] + unitRandom() * (c.amDepthRange[1] - c.amDepthRange[0])
      };
    }
    beginPhrase(clock) {
      if (this.lastPhrase >= 0 && this.receivedMasks.length)
        this.activityMask = residualActivityMask(
          this.config.defaultActivityMask,
          this.receivedMasks
        );
      this.receivedMasks = [];
      this.lastPhrase = clock.phrase;
      this.lastCell = -1;
      this.changeTimbre();
      this.broadcast(
        "intent",
        serializeIntentFields("k_FMBOT", {
          activityMask: this.activityMask,
          pitchclassPool: this.pitchclassPool
        })
      );
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      beat: 0,
      subdivision: 0,
      bpm: 108,
      meter: { numerator: 4, subdivision: 4, phraseBars: 4 }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.lastPhrase)
        this.beginPhrase(clock);
      const cell = cycleIndexAtPhrasePosition(clock, 16);
      if (cell === this.lastCell) return;
      this.lastCell = cell;
      const activity = this.activityMask[cell] || 0;
      if (activity <= 0 || !clock.phraseStart && randomInt(10) >= activity)
        return;
      this.registerIndex = reflectedWalk(
        this.registerIndex,
        randomInt(this.config.registerWalkStep * 2 + 1) - this.config.registerWalkStep,
        this.config.registerWalkSize
      );
      const pc = this.pitchclassPool[cell % this.pitchclassPool.length], note = Math.min(
        this.config.registerRange[1],
        this.config.registerRange[0] + this.registerIndex * 4 + pc % 12
      ), duration = this.config.noteDurationBeats * 60 / (clock.bpm || 108), [low, high] = this.config.velocityRange, velocity = this.shapeVelocity(low + (high - low) * activity / 9, note, {
        clock,
        division: cell,
        divisions: 16
      });
      this.audio.fmTexture(note, duration, velocity, this.timbre);
    }
  };
  var TonicBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.tonic;
      this.density = this.config.defaultDensity;
      this.activity = this.config.defaultActivity;
      this.now = () => Date.now();
      this.poolLease = new StalePresenceLease(
        this.config.fallbackTimeoutMs,
        () => this.now()
      );
      this.densityLease = new StaleValueLease(
        this.config.fallbackTimeoutMs,
        () => this.now()
      );
      this.activityLease = new StaleValueLease(
        this.config.fallbackTimeoutMs,
        () => this.now()
      );
      this.nextAt = 0;
      this.currentNote = null;
      this.hasPlayed = false;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool"))
        this.poolLease.receive(this.notes);
      if (message.address.endsWith("/hdensity"))
        this.densityLease.receive(this.density);
      if (message.address.endsWith("/vdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.activity = Math.max(0, Math.min(1, value));
          this.activityLease.receive(this.activity);
        }
      }
    }
    generatePool() {
      const mode = this.config.progressions[randomInt(this.config.progressions.length)], root = randomInt(
        this.config.transposeRange[1] - this.config.transposeRange[0] + 1
      ) + this.config.transposeRange[0];
      this.notes = mode.map(
        (value) => (value + root) % 12 + 48 + (1 + randomInt(3)) * 12
      );
      this.broadcast("notepool", this.notes);
    }
    updateFallback() {
      if (this.poolLease.update()) this.generatePool();
      if (this.densityLease.update()) {
        this.density = Math.max(
          0,
          Math.min(1, this.density + (unitRandom() - 0.5) * 0.2)
        );
        this.broadcast("hdensity", [this.density]);
      }
      if (this.activityLease.update()) {
        this.activity = Math.max(
          0,
          Math.min(1, this.activity + (unitRandom() - 0.5) * 0.2)
        );
        this.broadcast("vdensity", [this.activity]);
      }
    }
    onTick(tick, clock = { bpm: 108 }) {
      this.updateFallback();
      const now = this.now();
      if (now < this.nextAt) return;
      const [minDuration, maxDuration] = this.config.durationSecondsRange, duration = minDuration + unitRandom() * (maxDuration - minDuration);
      this.nextAt = now + duration * 1e3 + this.config.breakBaseMs + (1 - this.activity) * this.config.breakScaleMs;
      if (this.hasPlayed && unitRandom() > this.activity) return;
      if (this.currentNote == null || unitRandom() < this.density * this.config.noteChangeScale) {
        const source = this.notes[randomInt(this.notes.length)] ?? 60, [low, high] = this.config.detuneSemitonesRange;
        this.currentNote = source + low + unitRandom() * (high - low);
      }
      this.hasPlayed = true;
      this.audio.tonicWhistle(
        this.currentNote,
        duration,
        this.shapeVelocity(this.config.velocity, this.currentNote, {
          clock,
          amount: 0.7
        }),
        this.activity
      );
    }
  };
  var WindBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.wind;
      this.density = this.config.defaultDensity;
      this.lastBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/hdensity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.density = Math.max(0, Math.min(1, value));
      }
    }
    onTick(tick, clock = {
      bar: Math.floor(tick / 16),
      barStart: tick % 16 === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      const [low, high] = this.config.centroidRange, centroid = (low + (high - low) * this.density) * (this.config.frequencyScaleRange[0] + unitRandom() * (this.config.frequencyScaleRange[1] - this.config.frequencyScaleRange[0])), duration = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4) * 60 / (clock.bpm || 108) + 0.1;
      this.audio.windTexture(duration, centroid, this.density, this.config);
      this.broadcast("centroid", [centroid]);
    }
  };
  var BleepBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.bleep;
      this.density = this.config.defaultDensity;
      this.arousal = this.config.defaultArousal;
      this.preset = randomInt(this.config.presets.length);
      this.lastBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/vdensity") || message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      beatStart: tick % 4 === 0,
      bpm: 108,
      meter: { numerator: 4 }
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        this.lastBar = clock.bar;
        this.preset = randomInt(this.config.presets.length);
        this.broadcast("hdensity", [this.density]);
        this.broadcast("arousal", [this.arousal]);
      }
      if (!clock.beatStart) return;
      const [minCount, maxCount] = this.config.pulseCountRange, count = Math.max(
        minCount,
        Math.min(
          maxCount,
          Math.round(minCount + this.density * (maxCount - minCount))
        )
      ), beatSeconds = 60 / (clock.bpm || 108), preset = this.config.presets[this.preset], [lowDuration, highDuration] = this.config.durationMsRange, [lowVelocity, highVelocity] = this.config.velocityRange, base = lowVelocity + (highVelocity - lowVelocity) * this.arousal;
      for (let index = 0; index < count; index++) {
        const source = this.notes[(index + (clock.bar || 0)) % this.notes.length] ?? 60, octave = this.config.octaveOffsets[(index + this.preset) % this.config.octaveOffsets.length], note = source + octave, duration = (lowDuration + (highDuration - lowDuration) * (1 - this.arousal)) / 1e3, velocity = this.shapeVelocity(base, note, {
          clock,
          division: index,
          divisions: count,
          voice: index % 2
        });
        this.audio.bleep(
          note,
          duration,
          velocity,
          index * beatSeconds / count,
          preset,
          index % 2
        );
      }
    }
  };
  var WhinyBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.whiny;
      this.density = this.config.defaultDensity;
      this.arousal = this.config.defaultArousal;
      this.valence = this.config.defaultValence;
      this.lastBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/valence")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.valence = Math.max(0, Math.min(1, value));
      }
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      beatStart: tick % 4 === 0,
      bpm: 108
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        this.lastBar = clock.bar;
        this.broadcast("valence", [this.valence]);
        this.broadcast("arousal", [this.arousal]);
      }
      if (!clock.beatStart || !clock.barStart && unitRandom() > Math.max(this.config.triggerProbabilityFloor, this.density))
        return;
      const fundamental = this.notes[(clock.bar || 0) % this.notes.length] ?? 60, [low, high] = this.config.durationSeconds, duration = low + (high - low) * (1 - this.arousal), velocity = this.shapeVelocity(0.25 + 0.55 * this.arousal, fundamental, {
        clock,
        amount: 0.65
      });
      this.audio.whinyCluster(
        fundamental,
        duration,
        velocity,
        this.config,
        this.valence
      );
    }
  };
  var GroanBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.groan;
      this.arousal = this.config.defaultArousal;
      this.valence = this.config.defaultValence;
      this.note = this.config.initialNote;
      this.eventIndex = 0;
      this.lastBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool") && this.notes.length)
        this.note = this.notes[0];
      if (message.address.endsWith("/arousal")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.arousal = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/valence")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.valence = Math.max(0, Math.min(1, value));
      }
    }
    nextEvent() {
      const previous = this.note, multiplier = this.config.transpositionMultiplier[0] + this.arousal * (this.config.transpositionMultiplier[1] - this.config.transpositionMultiplier[0]), transpose = weightedChoice(
        this.config.transpositions,
        this.config.transpositionWeights
      ), [jitterLow, jitterHigh] = this.config.noteJitter;
      this.note = (this.note % 36 + 36) % 36 + 12 + transpose * multiplier % 12 + jitterLow + unitRandom() * (jitterHigh - jitterLow);
      const slide = (Math.abs(this.note - previous) * this.config.slidePerSemitoneMs + unitRandom() * this.config.slideRandomMs) / 1e3;
      return { note: this.note, slide };
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      beatStart: tick % 4 === 0,
      bpm: 108
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        this.lastBar = clock.bar;
        this.broadcast("valence", [this.valence]);
        this.broadcast("arousal", [this.arousal]);
      }
      if (!clock.beatStart) return;
      const beatMs = 6e4 / (clock.bpm || 108), minimum = this.config.minimumDurationMs[0] + this.arousal * (this.config.minimumDurationMs[1] - this.config.minimumDurationMs[0]), interval = minimum + this.config.intervalRandomMs / 2 + this.eventIndex * this.config.indexRandomMs / 2, count = Math.max(
        1,
        Math.min(4, Math.round(beatMs / Math.max(50, interval)))
      ), base = 0.35 + 0.5 * this.arousal;
      for (let index = 0; index < count; index++) {
        const event = this.nextEvent(), voice = this.eventIndex % this.config.voiceCount, velocity = this.shapeVelocity(base, event.note, {
          clock,
          division: index,
          divisions: count,
          voice
        });
        this.audio.groan(
          event.note,
          0.4 + 0.9 * this.valence,
          velocity,
          index * beatMs / count / 1e3,
          event.slide,
          voice
        );
      }
      this.eventIndex = (this.eventIndex + 1) % this.config.voiceCount;
    }
  };
  var WubBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.wub;
      this.density = this.config.defaultDensity;
      this.arousal = this.config.defaultArousal;
      this.valence = this.config.defaultValence;
      this.lastBar = null;
      this.voice = 0;
    }
    onMessage(message) {
      super.onMessage(message);
      for (const key of ["arousal", "valence"])
        if (message.address.endsWith(`/${key}`)) {
          const value = Number(message.args.at(-1));
          if (Number.isFinite(value)) this[key] = Math.max(0, Math.min(1, value));
        }
    }
    fundamental() {
      const lowest = Math.min(...this.notes), pc = (lowest % 12 + 12) % 12, [low, high] = this.config.fundamentalRandom;
      return this.config.fundamentalBase + pc + low + unitRandom() * (high - low);
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      beatStart: tick % 4 === 0,
      bpm: 108
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        this.lastBar = clock.bar;
        const centroid = 440 * 2 ** ((this.fundamental() - 69) / 12) * (1 + this.arousal * 2), panning = this.config.panningRange[0] + unitRandom() * (this.config.panningRange[1] - this.config.panningRange[0]);
        this.broadcast("hdensity", [this.density]);
        this.broadcast("valence", [this.valence]);
        this.broadcast("arousal", [this.arousal]);
        this.broadcast("centroid", [centroid]);
        this.broadcast("panning", [panning]);
      }
      if (!clock.beatStart) return;
      const [minCount, maxCount] = this.config.eventCountRange, count = Math.max(
        minCount,
        Math.round(minCount + this.density * (maxCount - minCount))
      ), beatSeconds = 60 / (clock.bpm || 108), [lowDuration, highDuration] = this.config.durationRange, base = 0.3 + 0.55 * this.arousal;
      for (let index = 0; index < count; index++) {
        const note = this.fundamental(), duration = lowDuration + (highDuration - lowDuration) * (1 - this.arousal), voice = (this.voice + index) % this.config.voiceCount, preset = this.config.presets[voice % this.config.presets.length], velocity = this.shapeVelocity(base, note, {
          clock,
          division: index,
          divisions: count,
          voice
        });
        this.audio.wubPluck(
          note,
          duration,
          velocity,
          index * beatSeconds / count,
          preset,
          voice
        );
      }
      this.voice = (this.voice + count) % this.config.voiceCount;
    }
  };
  var AtmosphereBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.atmosphere;
      this.pitch = this.config.defaultNote + this.config.octaveOffset;
      this.dirty = true;
      this.preset = randomInt(this.config.resonatorGainPresets.length);
      this.lastBar = null;
    }
    onMessage(message) {
      const previous = this.notes.join(",");
      super.onMessage(message);
      if (message.address.endsWith("/notepool") && this.notes.join(",") !== previous) {
        this.pitch = Math.min(...this.notes) + this.config.octaveOffset;
        this.dirty = true;
      }
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      if (!this.dirty && clock.bar % 4 !== 0) return;
      this.dirty = false;
      this.preset = randomInt(this.config.resonatorGainPresets.length);
      const barSeconds = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4) * 60 / (clock.bpm || 108), duration = Math.max(
        this.config.minimumSegmentSeconds,
        barSeconds * 4 + 0.1
      );
      this.audio.atmosphere(
        this.pitch,
        duration,
        this.config.resonatorGainPresets[this.preset],
        this.config.resonance
      );
    }
  };
  var TextureBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.texture;
      this.active = [];
      this.referenceSpectrum = null;
      this.lastBar = null;
    }
    pitchForVoice(index, timbre) {
      const source = this.notes[(index + (this.instancePhase || 0)) % this.notes.length] ?? 60;
      let pitch = source;
      while (pitch < timbre.low) pitch += 12;
      while (pitch > timbre.high) pitch -= 12;
      return pitch < timbre.low || pitch > timbre.high ? Math.max(timbre.low, Math.min(timbre.high, pitch)) : pitch;
    }
    regenerate(clock) {
      const count = Math.max(
        0,
        Math.min(
          this.config.voiceCount,
          Math.round(this.density * this.config.voiceCount)
        )
      ), barSeconds = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4) * 60 / (clock.bpm || 108), duration = Math.max(
        this.config.minimumDurationSeconds,
        barSeconds * this.config.holdBars
      );
      this.active = [];
      for (let index = 0; index < count; index++) {
        const provisional = this.notes[index % this.notes.length] ?? 60, timbre = chooseTextureTimbre(
          TEXTURE_TIMBRES,
          provisional,
          this.referenceSpectrum,
          this.config.nearestTimbres
        ), pitch = this.pitchForVoice(index, timbre), velocity = this.shapeVelocity(0.3 + 0.5 * this.density, pitch, {
          clock,
          voice: index,
          division: index,
          divisions: Math.max(1, count),
          amount: 0.55
        });
        this.active.push({ pitch, timbre });
        this.audio.textureGrain(
          pitch,
          duration,
          velocity,
          index * 0.035,
          timbre,
          index
        );
      }
      if (this.active.length)
        this.referenceSpectrum = this.active.at(-1).timbre.spectrum;
      this.broadcast("vdensity", [count / this.config.voiceCount]);
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      if (clock.bar % this.config.holdBars === 0 || this.active.length !== Math.round(this.density * this.config.voiceCount))
        this.regenerate(clock);
    }
  };
  var GranuBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.granu;
      this.arousal = this.config.defaultArousal;
      this.valence = this.config.defaultValence;
      this.lastBar = null;
    }
    onMessage(message) {
      super.onMessage(message);
      for (const key of ["arousal", "valence"])
        if (message.address.endsWith(`/${key}`)) {
          const value = Number(message.args.at(-1));
          if (Number.isFinite(value)) this[key] = Math.max(0, Math.min(1, value));
        }
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      const barSeconds = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4) * 60 / (clock.bpm || 108), duration = Math.max(1, barSeconds + 0.1), centroid = 50 + (3e3 - 50) * this.arousal;
      this.audio.granularSlurp(duration, this.arousal, this.valence, this.config);
      this.broadcast("valence", [this.valence]);
      this.broadcast("arousal", [this.arousal]);
      this.broadcast("centroid", [centroid]);
    }
  };
  var ChichichiBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.chichichi;
      this.patterns = Array.from({ length: 4 }, () => this.newPattern());
      this.state = 0;
    }
    newPattern() {
      const pattern = Array.from(
        { length: this.config.patternLength },
        () => unitRandom() < this.config.cellProbability ? 1 : 0
      );
      if (!pattern.some(Boolean)) pattern[randomInt(pattern.length)] = 1;
      return pattern;
    }
    changeState(command = "any") {
      if (command === "next")
        this.state = (this.state + 1) % this.patterns.length;
      else if (command === "previous")
        this.state = (this.state + this.patterns.length - 1) % this.patterns.length;
      else this.state = randomInt(this.patterns.length);
      this.patterns[this.state] = this.newPattern();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/statechange")) {
        const command = String(message.args.at(-1));
        if (this.config.stateNames.includes(command)) this.changeState(command);
      }
    }
    onTick(tick, clock = {
      tickInBar: tick % 16,
      barStart: tick === 0,
      bpm: 108,
      meter: { pulsesPerBar: 16 }
    }) {
      if (clock.barStart && unitRandom() < this.config.randomStateProbability)
        this.changeState("any");
      const steps = clock.meter?.pulsesPerBar || 16, index = Math.floor(
        (clock.tickInBar || 0) * this.config.patternLength / steps
      ) % this.config.patternLength;
      if (this.patterns[this.state][index])
        this.audio.chichichi(
          index,
          this.state,
          60 / (clock.bpm || 108),
          this.config
        );
    }
  };
  var DerivationsBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.derivations;
      this.lastBar = null;
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      bpm: 108,
      meter: { numerator: 4, denominator: 4 }
    }) {
      if (!clock.barStart || clock.bar === this.lastBar) return;
      this.lastBar = clock.bar;
      const [low, high] = this.config.densityRange, density = low + unitRandom() * (high - low), barSeconds = (clock.meter?.numerator || 4) * 4 / (clock.meter?.denominator || 4) * 60 / (clock.bpm || 108), duration = Math.max(
        0.5,
        barSeconds * this.config.globalLengthFactor / 2
      );
      this.audio.derivations(duration, density, this.config);
    }
  };
  var DeciderBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.decider;
      this.inputs = Array(this.config.numInputs).fill(0.5);
      this.state = Array(this.config.numElements).fill(
        Math.floor(this.config.numStates / 2)
      );
      this.leaf = -1;
      this.calls = 0;
    }
    async start() {
    }
    updateInputs() {
      const features = this.input?.features?.();
      if (!features) return;
      const hzToMidi = (hz) => 69 + 12 * Math.log2(Math.max(1e-3, hz) / 440);
      this.inputs[2] = hzToMidi(features.centroid || 440) / 127;
      this.inputs[3] = hzToMidi(features.frequency || features.centroid || 440) / 127;
      this.inputs[4] = (features.loudness || 0) * 10;
    }
    process() {
      this.updateInputs();
      for (let index = this.config.numInputs; index < this.state.length; index++) {
        const source = this.inputs[index % this.config.numInputs] ?? 0.5, delta = source > 0.5 ? 1 : -1;
        this.state[index] = (this.state[index] + delta + this.config.numStates) % this.config.numStates;
      }
      const sum = this.state.slice(this.config.numInputs).reduce((total, value) => total + value, 0), next = Math.floor(
        sum / Math.max(
          1,
          (this.state.length - this.config.numInputs) * (this.config.numStates - 1)
        ) * this.config.numElements
      );
      this.leaf = Math.max(0, Math.min(this.config.numElements - 1, next));
    }
    onTick() {
      const previous = this.leaf;
      this.process();
      if (this.calls % this.config.triggerEveryCalls === 0 && this.leaf !== previous)
        this.audio.deciderBreath(this.leaf, this.config);
      this.calls++;
    }
  };
  var BlankBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.blank;
      this.notes = this.config.defaultNotes.slice();
      this.density = this.config.defaultDensity;
      this.lastBar = null;
    }
    onTick(tick, clock = {
      bar: 0,
      barStart: tick === 0,
      beatStart: tick % 4 === 0,
      bpm: 120
    }) {
      if (clock.barStart && clock.bar !== this.lastBar) {
        this.lastBar = clock.bar;
        this.broadcast("hdensity", [this.density]);
      }
      if (!clock.beatStart || unitRandom() >= this.density) return;
      const note = this.notes[randomInt(this.notes.length)] ?? 60, duration = this.config.noteDurationBeats * 60 / (clock.bpm || 120), velocity = this.shapeVelocity(this.config.velocity, note, { clock });
      this.audio.blankTriangle(note, duration, velocity);
    }
  };
  var MonitorMessagesBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.monitor = new ProtocolMonitor(256);
    }
    onMessage(message) {
      this.monitor.capture(message);
    }
    onTick() {
    }
    snapshot() {
      return this.monitor.snapshot();
    }
    clear() {
      this.monitor.clear();
    }
  };
  var ReassignMessagesBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.router = new MessageRouter();
    }
    onMessage(message) {
      if (message.address === "/agent/reassign/clear") {
        this.router.clear();
        return;
      }
      if (message.address === "/agent/reassign") {
        const rule = message.args?.[0];
        if (rule && typeof rule === "object") this.router.addRule(rule);
        return;
      }
      if (message.source === this.instanceId || message.source === "ae_ReassignMessagesBOT")
        return;
      for (const routed of this.router.route(message))
        this.send(routed.address, routed.args);
    }
    onTick() {
    }
    setRules(rules) {
      return this.router.setRules(rules);
    }
  };
  var ValenceArousalBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.valenceArousal;
      this.arousal = this.config.initialArousal;
      this.valence = this.config.initialValence;
      this.arousalTarget = this.arousal;
      this.valenceTarget = this.valence;
      this.phraseBars = this.config.initialPhraseBars;
      this.lastPhrase = -1;
    }
    randomTarget() {
      const [low, high] = this.config.targetRange;
      return (low + randomInt(high - low + 1)) / this.config.targetDivisor;
    }
    choosePhraseBars() {
      const next = weightedChoice(
        this.config.phraseCandidates,
        this.config.phraseWeights
      ), smoothed = Math.round((next + this.phraseBars) / 2);
      return Math.max(
        this.config.phraseCandidates[0],
        Math.min(this.config.phraseCandidates.at(-1), smoothed)
      );
    }
    chooseMeter() {
      const c = this.config, weights = c.meterCandidates.map(
        (_, index) => c.meterLowWeights[index] * (1 - this.valenceTarget) + c.meterHighWeights[index] * this.valenceTarget
      ), numerator = weightedChoice(c.meterCandidates, weights), groups = randomAdditiveGrouping(numerator, c.groupChoices);
      return {
        numerator,
        denominator: 4,
        groups,
        subdivision: 4,
        phraseBars: this.phraseBars,
        rhythm: { hits: null, rotation: 0, clave: [] }
      };
    }
    beginPhrase() {
      this.arousalTarget = this.randomTarget();
      this.valenceTarget = this.randomTarget();
      this.phraseBars = this.choosePhraseBars();
      const meter = this.chooseMeter();
      this.broadcast("timeSignature", [meter, "nextPhrase"]);
      this.broadcast("tala", meter.groups);
      this.broadcast("phraselength", [this.phraseBars]);
    }
    onMessage(message) {
      if (message.address === "/system/instance")
        this.setIdentity(message.args[0]);
    }
    onTick(tick, clock = {
      phrase: 0,
      phraseStart: tick === 0,
      bar: 0,
      tickInBar: 0,
      meter: { phraseBars: this.phraseBars, pulsesPerBar: 16 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.beginPhrase();
      }
      const factor = this.config.smoothFactor;
      this.arousal += (this.arousalTarget - this.arousal) * factor;
      this.valence += (this.valenceTarget - this.valence) * factor;
      const bars = clock.meter?.phraseBars || this.phraseBars, pulses = clock.meter?.pulsesPerBar || 16, progress = (clock.bar % bars + (clock.tickInBar || 0) / pulses) / bars;
      this.broadcast("progress", [Math.max(0, Math.min(1, progress))]);
      this.broadcast("arousal", [this.arousal]);
      this.broadcast("valence", [this.valence]);
    }
  };
  var MidiAnalyzerBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.midiAnalyzer;
      this.analyzer = new MidiFeatureAnalyzer({
        windowMs: this.config.windowMs,
        pitchRange: this.config.pitchRange,
        bendRange: this.config.mpeBendRange
      });
      this.mappings = this.config.defaultMappings.map((mapping) => ({
        ...mapping
      }));
      this.history = [];
    }
    receiveMidi(bytes, time) {
      this.analyzer.receive(bytes, time);
    }
    async start() {
      try {
        this.midiSubscription = await subscribeMidiInputs(
          (bytes, time) => this.receiveMidi(bytes, time)
        );
      } catch {
      }
    }
    stop() {
      this.midiSubscription?.close();
    }
    onMessage(message) {
      if (message.address === "/agent/midiAnalyzer/map" && message.args?.[0] && typeof message.args[0] === "object")
        this.mappings = [{ ...message.args[0] }];
      if (message.address === "/agent/midiAnalyzer/clear") this.analyzer.clear();
    }
    onTick(tick, clock = { beatStart: true, bpm: 120 }) {
      if (!clock.beatStart) return;
      const snapshot = this.analyzer.snapshot(void 0, clock.bpm || 120);
      this.history.push(snapshot.normalized);
      if (this.history.length > this.config.smoothingWindows)
        this.history.shift();
      const smoothed = snapshot.normalized.map(
        (_, index) => this.history.reduce((sum, row) => sum + row[index], 0) / this.history.length
      );
      for (const mapping of this.mappings) {
        const value = smoothed[Math.max(
          0,
          Math.min(smoothed.length - 1, Number(mapping.feature) || 0)
        )];
        this.broadcast(String(mapping.address || "feature"), [value]);
      }
      this.lastFeatures = { ...snapshot, normalized: smoothed };
    }
  };
  var MidiBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.midiBot;
      this.notes = this.config.defaultNotePool.slice();
      this.density = this.config.defaultDensity;
      this.activity = this.config.defaultActivity;
      this.valence = this.config.defaultValence;
      this.arousal = this.config.defaultArousal;
      this.lastPhrase = -1;
      this.voiceNotes = Array(this.config.voiceCount).fill(null);
    }
    onMessage(message) {
      super.onMessage(message);
      for (const key of ["density", "activity", "valence", "arousal"])
        if (message.address.endsWith(`/${key}`)) {
          const value = Number(message.args.at(-1));
          if (Number.isFinite(value)) this[key] = Math.max(0, Math.min(1, value));
        }
    }
    pitchForVoice(voice) {
      const source = this.notes[randomInt(this.notes.length)] ?? 0, pitchClass2 = (source % 12 + 12) % 12, octave = (voice + randomInt(this.config.octaves)) % this.config.octaves;
      return pitchClass2 + 12 * (this.config.baseOctave + octave);
    }
    onTick(tick, clock = {
      beatStart: tick % 4 === 0,
      phraseStart: tick === 0,
      phrase: 0,
      bpm: 120
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.broadcast("notepool", this.notes);
        this.broadcast("density", [this.density]);
        this.broadcast("activity", [this.activity]);
      }
      if (!clock.beatStart) return;
      const [minimum, maximum] = this.config.activeVoiceRange, voices = Math.max(
        minimum,
        Math.min(
          maximum,
          Math.round(minimum + this.activity * (maximum - minimum))
        )
      ), probability = Math.max(
        0.02,
        Math.min(1, this.density * (0.4 + 0.6 * this.activity))
      );
      for (let voice = 0; voice < Math.min(this.config.voiceCount, voices); voice++)
        if (unitRandom() < probability) {
          const note = this.pitchForVoice(voice), [velocityLow, velocityHigh] = this.config.velocityRange, velocity = (velocityLow + randomInt(velocityHigh - velocityLow + 1)) / 127, [durationLow, durationHigh] = this.config.durationMsBase, duration = (durationLow + unitRandom() * (durationHigh + this.config.durationMsArousalScale * this.arousal - durationLow)) / 1e3;
          this.voiceNotes[voice] = note;
          this.audio.midiGeneratorVoice(note, duration, velocity, voice, {
            density: this.density,
            activity: this.activity,
            valence: this.valence,
            arousal: this.arousal
          });
        }
    }
  };
  var MidiGuitarInputBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.midiGuitarInput;
      this.bends = Array(16).fill(8192);
      this.onsets = [];
      this.pitches = [];
      this.activitySamples = [];
      this.lastBeat = -1;
    }
    receiveMidi(bytes, time = performance.now()) {
      const [status = 0, data1 = 0, data2 = 0] = bytes, kind = status & 240, channel = status & 15;
      if (kind === 224) {
        this.bends[channel] = data2 << 7 | data1;
        return;
      }
      if (kind === 144 && data2 > 0) {
        const pitch = data1 + (this.bends[channel] - 8192) / 8192 * this.config.mpeBendRange;
        this.onsets.push(time);
        this.pitches.push({ pitch, time });
      }
    }
    async start() {
      try {
        this.midiSubscription = await subscribeMidiInputs(
          (bytes, time) => this.receiveMidi(bytes, time)
        );
      } catch {
      }
      try {
        this.input = await this.audio.microphone();
      } catch {
      }
    }
    stop() {
      this.midiSubscription?.close();
      this.input?.stop();
    }
    onMessage(message) {
      if (message.address === "/agent/off" && (message.args.includes(this.instanceId) || message.args.includes("mh_MIDIGuitarInputBOT")))
        this.stop();
    }
    onTick(tick, clock = { beat: 0, beatStart: true }) {
      if (!clock.beatStart || clock.beat === this.lastBeat) return;
      this.lastBeat = clock.beat;
      const now = performance.now(), cutoff = now - this.config.noteWindowMs;
      this.onsets = this.onsets.filter((time) => time >= cutoff);
      this.pitches = this.pitches.filter((item) => item.time >= cutoff);
      const features = this.input?.features?.(), rawActivity = Math.max(
        0,
        Math.min(
          this.config.activityInputRange[1],
          Number(features?.loudness) || 0
        )
      ), activity = rawActivity / this.config.activityInputRange[1];
      this.activitySamples.push(activity);
      if (this.activitySamples.length > this.config.activitySmoothingSamples)
        this.activitySamples.shift();
      const smoothed = this.activitySamples.reduce((sum, value) => sum + value, 0) / this.activitySamples.length, density = Math.max(
        0,
        Math.min(1, this.onsets.length / this.config.densityDivisor)
      ), pool = [
        ...new Map(
          this.pitches.map((item) => [item.pitch.toFixed(6), item.pitch])
        ).values()
      ];
      this.broadcast("density", [density]);
      this.broadcast("activity", [smoothed]);
      if (pool.length) this.broadcast("notepool", pool);
    }
  };
  var VideoBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.video;
      this.density = 0;
      this.activity = 0;
      this.barkEnergy = [];
      this.elapsed = 0;
      this.lastBeat = -1;
    }
    async start() {
      try {
        this.videoInput = await openVideoFeatures({
          width: this.config.frameSize[0],
          height: this.config.frameSize[1]
        });
      } catch {
      }
    }
    stop() {
      this.videoInput?.stop();
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/density")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.density = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/activity")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.activity = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/barkenergy"))
        this.barkEnergy = message.args.map(Number).filter(Number.isFinite);
    }
    visualState() {
      const density = this.density, activity = this.activity, saturation = this.barkEnergy.length ? Math.max(
        0,
        Math.min(
          1,
          this.barkEnergy.reduce((sum, value) => sum + Math.abs(value), 0) / this.barkEnergy.length
        )
      ) : activity;
      return {
        velocity: density ** 1.8 * this.config.densityVelocityRange[1],
        scrollMs: this.config.activityScrollMs[0] + activity * (this.config.activityScrollMs[1] - this.config.activityScrollMs[0]),
        blurMs: this.config.activityBlurMs[0] + activity * (this.config.activityBlurMs[1] - this.config.activityBlurMs[0]),
        saturation,
        blackout: activity > this.config.blackoutThreshold
      };
    }
    onTick(tick, clock = { beat: 0, beatStart: true }) {
      if (!clock.beatStart || clock.beat === this.lastBeat) return;
      this.lastBeat = clock.beat;
      this.elapsed++;
      const measured = Number(this.videoInput?.features?.().activity);
      if (Number.isFinite(measured)) {
        this.activity = Math.max(0, Math.min(1, measured));
        this.broadcast("activity", [this.activity]);
      }
      this.lastVisualState = this.visualState();
    }
  };
  var WebBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.webBot;
      this.sourcePool = null;
      this.passage = this.newPassage();
      this.lastPhrase = -1;
      this.lastEvent = Array(this.config.partCount).fill(-1);
    }
    pitch() {
      const pool = this.sourcePool?.length ? this.sourcePool : this.config.scale.map((value) => this.config.register + value);
      return pool[randomInt(pool.length)];
    }
    newNote() {
      const c = this.config, [velocityLow, velocityHigh] = c.velocityRange;
      return {
        pitch: this.pitch(),
        duration: weightedChoice(c.durationMultipliers, c.durationWeights) * c.baseDurationMs,
        velocity: velocityLow + unitRandom() * (velocityHigh - velocityLow)
      };
    }
    newPassage() {
      return Array.from(
        { length: this.config.partCount },
        () => Array.from({ length: this.config.notesPerPhrase }, () => this.newNote())
      );
    }
    ornament() {
      const [low, high] = this.config.ornamentTransposition;
      this.passage = this.passage.map(
        (phrase) => phrase.flatMap((note) => [
          {
            ...note,
            pitch: note.pitch + low + unitRandom() * (high - low),
            duration: note.duration * 0.5
          },
          { ...note, duration: note.duration * 0.5 }
        ])
      );
    }
    develop() {
      this.ornament();
      const durations = this.passage.flatMap(
        (phrase) => phrase.map((note) => note.duration)
      ), density = durations.reduce((sum, value) => sum + value, 0) / durations.length;
      if (density < this.config.resetDensityThresholdMs)
        this.passage = this.newPassage();
      const [low, high] = this.config.passageDurationFactor, factor = low + unitRandom() * (high - low);
      for (const phrase of this.passage)
        for (const note of phrase) note.duration *= factor;
      this.broadcast("density", [
        Math.max(
          0,
          Math.min(
            1,
            this.config.baseDurationMs / (density || this.config.baseDurationMs)
          )
        )
      ]);
      this.lastEvent.fill(-1);
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool") && this.notes.length)
        this.sourcePool = this.notes.slice();
    }
    onTick(tick, clock = {
      phrase: 0,
      phraseStart: tick === 0,
      bar: 0,
      tickInBar: 0,
      meter: { phraseBars: 4, pulsesPerBar: 16 }
    }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.develop();
      }
      const meter = clock.meter || {}, totalTicks = (meter.phraseBars || 4) * (meter.pulsesPerBar || 16), position = (clock.bar % (meter.phraseBars || 4) * (meter.pulsesPerBar || 16) + (clock.tickInBar || 0)) / totalTicks;
      for (let voice = 0; voice < this.passage.length; voice++) {
        const phrase = this.passage[voice], index = Math.min(
          phrase.length - 1,
          Math.floor(position * phrase.length)
        );
        if (index === this.lastEvent[voice]) continue;
        this.lastEvent[voice] = index;
        const note = phrase[index], duration = Math.max(0.03, note.duration / 1e3);
        this.audio.webVoice(note.pitch, duration, note.velocity / 127, voice);
      }
    }
  };
  var ServerBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.bridge = new LegacyLanBridge({
        origin: "ae_ServerBOT",
        transport: (message) => this.outbound?.(message)
      });
      this.transport = "shared-websocket-room";
    }
    configure(options) {
      return this.bridge.configure(options);
    }
    connectTransport(callback) {
      this.outbound = callback;
    }
    receiveRemote(message) {
      const relayed = this.bridge.receiveRemote(message);
      if (relayed) this.send(relayed.address, relayed.args);
      return Boolean(relayed);
    }
    onMessage(message) {
      if (message.address === "/agent/server/configure" && message.args?.[0] && typeof message.args[0] === "object") {
        this.configure(message.args[0]);
        return;
      }
      if (message.source === this.instanceId || message.source === "ae_ServerBOT")
        return;
      this.bridge.forwardLocal(message);
    }
    onTick() {
    }
  };
  var TemplateBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.received = [];
      this.active = true;
    }
    subscribe(callback) {
      this.listener = callback;
    }
    onMessage(message) {
      if (message.address === "/system/instance") {
        this.setIdentity(message.args[0]);
        return;
      }
      if (message.source === this.instanceId || message.source === "mh_TemplateBOT")
        return;
      if (message.address === "/agent/off" && (message.args.includes(this.instanceId) || message.args.includes("mh_TemplateBOT"))) {
        this.active = false;
        this.send("/agent/offed", [this.instanceId || "mh_TemplateBOT"]);
        return;
      }
      const copy = {
        ...message,
        args: Array.isArray(message.args) ? message.args.slice() : []
      };
      this.received.push(copy);
      this.listener?.(copy);
    }
    onTick() {
    }
  };
  var XProducerBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xProducer;
      this.form = [];
      this.phrase = -1;
      this.section = null;
      this.initialized = false;
      this.enabled = true;
    }
    generate() {
      const c = this.config, first = weightedChoice(c.sections, c.formWeights);
      this.form = [first];
      for (let index = 1; index < c.phraseCount; index++) {
        const row = c.sectionTransitions[this.form.at(-1)] || c.sectionTransitions.A;
        this.form.push(weightedChoice(row.values, row.weights));
      }
      this.densityCurve = randomFivePointCurve({
        xRanges: c.densityPointXRanges,
        terminalWeights: c.densityTerminalWeights
      });
      this.subpatterns = c.subpatterns.map((pattern, index) => ({
        pattern: pattern.split(" "),
        weight: c.subpatternWeights[index]
      }));
      this.initialized = true;
      this.broadcast("initialize", [1]);
    }
    onMessage(message) {
      if (message.address.endsWith("/initialize")) this.generate();
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
    }
    phraseState(index) {
      const c = this.config, progress = index / Math.max(1, c.phraseCount - 1), density = Math.max(
        0,
        Math.min(1, interpolateCurvePoints(this.densityCurve, progress))
      ), parts = c.parts.map(() => unitRandom() < density ? 1 : 0);
      if (!parts.some(Boolean)) parts[randomInt(parts.length)] = 1;
      return { section: this.form[index], progress, density, parts };
    }
    emit(index) {
      const state2 = this.phraseState(index), sectionStart = index === 0 || this.form[index - 1] !== state2.section, sectionEnd = this.form.findIndex(
        (value, next) => next > index && value !== state2.section
      ), length = (sectionEnd < 0 ? this.form.length : sectionEnd) - index;
      if (sectionStart) {
        this.section = state2.section;
        this.broadcast("section", [state2.section]);
        this.broadcast("phraselength", [length]);
        this.broadcast(
          "subpattern",
          weightedChoice(
            this.subpatterns,
            this.subpatterns.map((item) => item.weight)
          ).pattern
        );
      }
      this.broadcast("progress", [state2.progress]);
      this.broadcast("density", [state2.density]);
      this.broadcast("onoff", [
        {
          parts: Object.fromEntries(
            this.config.parts.map((part, i) => [part, state2.parts[i]])
          )
        }
      ]);
    }
    onTick(tick, clock = { phraseStart: tick === 0, phrase: 0 }) {
      if (!this.enabled || !clock.phraseStart || clock.phrase === this.phrase)
        return;
      if (!this.initialized) this.generate();
      this.phrase = clock.phrase;
      const index = clock.phrase % this.form.length;
      if (clock.phrase > 0 && index === 0) {
        this.broadcast("exiting", [1]);
        this.generate();
      }
      this.emit(index);
    }
  };
  var XDrumBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xDrum;
      this.enabled = true;
      this.exiting = false;
      this.section = "A";
      this.sections = /* @__PURE__ */ new Map();
      this.lastStep = -1;
      this.generate({ numerator: 16 });
    }
    generate(meter = {}) {
      const c = this.config, numerator = Math.max(1, meter.numerator || 16), tala = numerator === 16 ? [...c.defaultTala] : randomAdditiveGrouping(numerator, c.additiveParts), starts = additiveGroupStarts(tala, numerator), map = (value) => Math.min(
        c.sourceSteps - 1,
        Math.floor(value / numerator * c.sourceSteps)
      ), base = [...new Set(starts.map(map))], amount = (scale = 0.5) => Math.max(
        1,
        Math.round(
          (c.voiceDensityRange[0] + this.density * (c.voiceDensityRange[1] - c.voiceDensityRange[0])) * c.sourceSteps * scale
        )
      );
      this.patterns = {
        kick: scramble(base).slice(0, amount(0.7)),
        snare: scramble([
          .../* @__PURE__ */ new Set([4, 12, ...base.map((value) => (value + 4) % 16)])
        ]).slice(0, amount(0.55)),
        hihat: scramble([...Array(16).keys()]).slice(0, amount(1))
      };
      if (!this.patterns.kick.includes(0)) this.patterns.kick.unshift(0);
      this.tala = tala;
      this.sections.set(this.section, {
        tala: [...tala],
        patterns: Object.fromEntries(
          Object.entries(this.patterns).map(([key, value]) => [key, [...value]])
        )
      });
      this.broadcast("tala", tala);
    }
    selectSection(value, meter) {
      this.section = String(value || "A");
      const cached = this.sections.get(this.section);
      if (cached) {
        this.tala = [...cached.tala];
        this.patterns = Object.fromEntries(
          Object.entries(cached.patterns).map(([key, row]) => [key, [...row]])
        );
        this.broadcast("tala", this.tala);
      } else this.generate(meter);
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/density")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.density = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/initialize"))
        this.generate(this.requestedMeter || { numerator: 16 });
      if (message.address.endsWith("/section"))
        this.selectSection(
          message.args.at(-1),
          this.requestedMeter || { numerator: 16 }
        );
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
    }
    onTick(tick, clock = { tickInBar: tick % 16, meter: { pulsesPerBar: 16, numerator: 4 } }) {
      if (!this.enabled || this.exiting) return;
      const step = Math.min(
        15,
        Math.floor(
          (clock.tickInBar || 0) / Math.max(1, clock.meter.pulsesPerBar) * 16
        )
      );
      if (step === this.lastStep) return;
      this.lastStep = step;
      const accent = 0.35 + 0.65 * this.density;
      if (this.patterns.kick.includes(step)) this.audio.houseDrum("kick", accent);
      if (this.patterns.snare.includes(step))
        this.audio.houseDrum("snare", accent);
      if (this.patterns.hihat.includes(step))
        this.audio.houseDrum("closedHat", accent);
    }
  };
  var XBassBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xBass;
      this.tala = [...this.config.defaultTala];
      this.enabled = true;
      this.exiting = false;
      this.velocityState = 45;
      this.lastStep = -1;
      this.generatePattern();
    }
    generatePattern() {
      const c = this.config, starts = additiveGroupStarts(this.tala, c.sourceSteps), candidates = [.../* @__PURE__ */ new Set([0, ...starts, ...Array(c.sourceSteps).keys()])], count = Math.max(
        c.minimumOnsets,
        Math.round(
          (c.densityOnsetRange[0] + this.density * (c.densityOnsetRange[1] - c.densityOnsetRange[0])) * c.sourceSteps
        )
      );
      this.pattern = scramble(candidates).slice(0, count);
      if (!this.pattern.includes(0)) this.pattern.unshift(0);
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/density")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value)) {
          this.density = Math.max(0, Math.min(1, value));
          this.generatePattern();
        }
      }
      if (message.address.endsWith("/tala")) this.generatePattern();
      if (message.address.endsWith("/initialize")) this.generatePattern();
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
    }
    choosePitch() {
      const ranked = scramble(this.notes), source = weightedChoice(
        ranked,
        ranked.map((_, index) => this.config.pitchRankWeights[index] ?? 0.05)
      ), pc = pitchClass(source) ?? 0;
      return this.config.baseMidi + pc;
    }
    onTick(tick, clock = { tickInBar: tick % 16, bpm: 120, meter: { pulsesPerBar: 16 } }) {
      if (!this.enabled || this.exiting) return;
      const step = Math.min(
        15,
        Math.floor(
          (clock.tickInBar || 0) / Math.max(1, clock.meter.pulsesPerBar) * 16
        )
      );
      if (step === this.lastStep || !this.pattern.includes(step)) return;
      this.lastStep = step;
      this.velocityState = boundedDrunk(
        this.velocityState,
        this.config.velocityWalk.range,
        this.config.velocityWalk.step
      );
      const [low, high] = this.config.velocityWalk.output, velocity = low + this.velocityState / (this.config.velocityWalk.range - 1) * (high - low), duration = this.config.noteDurationBeats * 60 / (clock.bpm || 120);
      this.audio.bass(this.choosePitch(), velocity, duration);
    }
  };
  var XPadBot = class extends PadBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xPad;
      this.harmonicRhythm = this.config.defaultHarmonicRhythm;
      this.progress = 0;
      this.enabled = true;
      this.exiting = false;
      this.pendingChord = true;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/notepool")) this.pendingChord = true;
      if (message.address.endsWith("/harmrhythm")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value) && value > 0) this.harmonicRhythm = value;
      }
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.progress = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/density")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.density = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
    }
    onTick(tick, clock = { beatStart: tick % 4 === 0, bpm: 120 }) {
      if (!this.enabled || this.exiting || !this.pendingChord || !clock.beatStart)
        return;
      this.pendingChord = false;
      const notes = this.voiceChord(this.notes), duration = Math.max(
        this.config.minimumSeconds,
        this.harmonicRhythm * 60 / (clock.bpm || 120)
      ), openness = this.config.filterStart + (this.config.filterEnd - this.config.filterStart) * this.progress;
      this.audio.padChord(notes, duration, this.density, openness);
    }
  };
  var XPercBot = class extends PercBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xPerc;
      this.phraseBars = 8;
      this.section = "A";
      this.sections = /* @__PURE__ */ new Map();
      this.subpattern = [...this.config.defaultSubpattern];
      this.enabled = true;
      this.exiting = false;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/subpattern")) {
        const values = message.args.filter(
          (value) => typeof value === "string" && !value.includes("BOT")
        );
        if (values.length) this.subpattern = values;
      }
      if (message.address.endsWith("/section")) {
        this.section = String(message.args.at(-1) || "A");
        const cached = this.sections.get(this.section);
        if (cached) this.patterns = cached.map((row) => [...row]);
        else this.patterns = [];
      }
      if (message.address.endsWith("/initialize")) this.patterns = [];
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
    }
    generatePatterns(clock, localPhrase) {
      if (this.sections.has(this.section)) {
        this.patterns = this.sections.get(this.section).map((row) => [...row]);
        this.lastSourceStep = -1;
        return;
      }
      super.generatePatterns(clock, localPhrase);
      const bars = this.subpattern.length, perBar = clock.meter.pulsesPerBar, source = this.patterns.map((row) => {
        const fragments = /* @__PURE__ */ new Map();
        return Array.from({ length: bars * perBar }, (_, index) => {
          const bar = Math.floor(index / perBar), label = this.subpattern[bar % bars];
          if (!fragments.has(label))
            fragments.set(label, row.slice(bar * perBar, (bar + 1) * perBar));
          return fragments.get(label)[index % perBar] || 0;
        });
      });
      this.patterns = source;
      this.sections.set(
        this.section,
        source.map((row) => [...row])
      );
    }
    onTick(tick, clock = { bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (this.enabled && !this.exiting) super.onTick(tick, clock);
    }
  };
  var XSequencerBot = class extends SequencerBot {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.xSequencer;
      this.notes = [...this.config.defaultNotePool];
      this.progress = 0;
      this.enabled = true;
      this.exiting = false;
      this.preset = randomInt(this.config.presetCount);
      this.generatePattern();
    }
    async start() {
      try {
        const response = await fetch("./data/x-sequencer-presets.json");
        this.presets = await response.json();
      } catch {
      }
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/progress")) {
        const value = Number(message.args.at(-1));
        if (Number.isFinite(value))
          this.progress = Math.max(0, Math.min(1, value));
      }
      if (message.address.endsWith("/initialize")) {
        this.preset = randomInt(this.config.presetCount);
        this.generatePattern();
      }
      if (message.address.endsWith("/onoff"))
        this.enabled = Number(message.args.at(-1)) !== 0;
      if (message.address.endsWith("/exiting"))
        this.exiting = Number(message.args.at(-1)) !== 0;
    }
    render(note, duration, velocity) {
      this.audio.xSequencerNote(
        note,
        duration,
        velocity,
        this.progress,
        this.preset
      );
    }
    onTick(tick, clock = { tick: 0, tickInBar: 0, bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (this.enabled && !this.exiting) super.onTick(tick, clock);
    }
  };
  var TangerineDreamBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.config = STOCHASTIC_CONFIG.tangerineDream;
      this.tala = [...this.config.defaultTala];
      this.phraseBars = 8;
      this.totalPhrases = 8;
      this.form = [];
      this.formPhrase = -1;
      this.currentChord = [60, 63, 67, 70];
      this.harmony = [[...this.currentChord]];
      this.harmonicRhythm = 4;
      this.sequence = [];
      this.sequenceIndex = 0;
      this.generateForm();
      this.generateSequence();
    }
    async start() {
      try {
        const [harmony, presets] = await Promise.all(
          [
            "./data/metheny-harmony.json",
            "./data/tangerine-dream-presets.json"
          ].map((path) => fetch(path).then((response) => response.json()))
        );
        this.harmonyCorpus = harmony;
        this.presets = presets;
        this.generateHarmony();
      } catch {
      }
    }
    generateForm() {
      const c = this.config, [low, high] = c.phraseCountRange;
      this.totalPhrases = low + randomInt(high - low);
      this.densityCurve = randomFivePointCurve({
        xRanges: c.densityPointXRanges,
        terminalWeights: c.densityTerminalWeights
      });
      this.form = [];
      let previous = null;
      for (let phrase = 0; phrase < this.totalPhrases; phrase++) {
        const density = Math.max(
          0.05,
          Math.min(
            1,
            interpolateCurvePoints(
              this.densityCurve,
              phrase / Math.max(1, this.totalPhrases - 1)
            )
          )
        ), limit = c.maximumActiveParts[Math.min(
          c.maximumActiveParts.length - 1,
          Math.floor(density * c.maximumActiveParts.length)
        )], state2 = c.partProbabilities.map(
          (probability, index) => unitRandom() < probability * (previous?.[index] === 0 ? 0.5 : 1) ? 1 : 0
        ), minimum = phrase === 0 || phrase === this.totalPhrases - 1 ? 1 : 2;
        while (state2.reduce((a, b) => a + b, 0) < minimum)
          state2[randomInt(state2.length)] = 1;
        while (state2.reduce((a, b) => a + b, 0) > limit) {
          const index = randomInt(state2.length);
          state2[index] = 0;
        }
        this.form.push({ state: state2, density });
        previous = state2;
      }
    }
    generateHarmony() {
      if (!this.harmonyCorpus) return;
      let shape = corpusInitialShape(this.harmonyCorpus), root = weightedPitchClass(this.harmonyCorpus[shape]?.initial);
      this.harmony = [];
      for (let i = 0; i < 4; i++) {
        this.harmony.push(transposeChord(shape, root, this.config.baseMidi));
        ({ shape, root } = corpusNextChord(this.harmonyCorpus, shape));
      }
      if (this.harmony.length) this.currentChord = this.harmony[0];
    }
    generateSequence() {
      const pool = octaveExpandedPool(this.currentChord, [-1, 0, 1], [48, 84]);
      let index = randomInt(Math.max(1, pool.length));
      this.sequence = Array.from({ length: 16 + randomInt(45) }, () => {
        index = reflectedWalk(
          index,
          weightedChoice([-2, -1, 0, 1, 2], [0.08, 0.24, 0.36, 0.24, 0.08]),
          pool.length
        );
        return pool[index] ?? 60;
      });
      this.sequenceIndex = 0;
      this.sequenceRate = weightedChoice(
        this.config.sequencerStepsPerBeat,
        [1, 1]
      );
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/phrases")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) {
          this.totalPhrases = Math.min(128, value);
          this.generateForm();
        }
      }
      if (message.address.endsWith("/phraselength")) {
        const value = Math.round(Number(message.args.at(-1)));
        if (value > 0) this.phraseBars = Math.min(128, value);
      }
    }
    beginPhrase(clock) {
      if (clock.phrase > 0 && clock.phrase % this.totalPhrases === 0) {
        this.generateForm();
        this.generateHarmony();
      }
      this.formPhrase = clock.phrase;
      const state2 = this.form[clock.phrase % this.form.length];
      this.state = Object.fromEntries(
        this.config.partNames.map((name, index) => [
          name,
          Boolean(state2.state[index])
        ])
      );
      this.density = state2.density;
      this.phraseBars = weightedChoice(
        this.config.phraseLengthCandidates,
        this.config.phraseLengthWeights
      );
      this.harmonicRhythm = weightedChoice(
        this.config.harmonicRhythmChoices,
        this.config.harmonicRhythmWeights
      );
      this.broadcast("phraselength", [this.phraseBars]);
      this.broadcast("hdensity", [this.density]);
      this.broadcast("tala", this.tala);
    }
    chordBoundary(clock) {
      return clock.barStart && clock.bar % this.harmonicRhythm === 0;
    }
    onTick(tick, clock = {
      phrase: 0,
      phraseStart: tick === 0,
      bar: 0,
      barStart: tick % 16 === 0,
      beat: 0,
      beatStart: tick % 4 === 0,
      group: 0,
      groupStart: tick % 4 === 0,
      subdivision: tick % 4,
      tickInBar: tick % 16,
      bpm: 120,
      meter: {
        numerator: 4,
        denominator: 4,
        groups: [4],
        subdivision: 4,
        pulsesPerBar: 16,
        phraseBars: 8
      }
    }) {
      clock = this.interpretClock(clock);
      if (clock.phraseStart && clock.phrase !== this.formPhrase)
        this.beginPhrase(clock);
      const progress = (clock.bar % (clock.meter.phraseBars || this.phraseBars) + (clock.tickInBar || 0) / clock.meter.pulsesPerBar) / (clock.meter.phraseBars || this.phraseBars);
      if (clock.beatStart) this.broadcast("progress", [progress]);
      if (this.chordBoundary(clock) && this.harmony.length) {
        this.currentChord = this.harmony[Math.floor(clock.bar / this.harmonicRhythm) % this.harmony.length];
        this.broadcast("notepool", this.currentChord);
        this.generateSequence();
        if (this.state?.pad)
          this.audio.padChord(
            this.currentChord.map((note) => note + this.config.padOctaveOffset),
            this.harmonicRhythm * 60 / (clock.bpm || 120),
            this.density,
            progress
          );
      }
      if (this.state?.bass && clock.groupStart)
        this.audio.bass(
          (this.currentChord[0] ?? 60) + this.config.bassOctaveOffset,
          0.4 + 0.5 * this.density
        );
      if (this.state?.melody && clock.beatStart && (clock.phraseStart || unitRandom() < this.density * this.config.melodyProbabilityScale)) {
        const note = this.currentChord[randomInt(this.currentChord.length)] ?? 60;
        this.audio.methenyMelody(
          note + 12,
          0.2 + 60 / (clock.bpm || 120) * 0.5,
          0.4 + 0.5 * this.density,
          0,
          0
        );
      }
      if (this.state?.sequencer && clock.subdivision % (clock.meter.subdivision / this.sequenceRate || 1) === 0) {
        const note = this.sequence[this.sequenceIndex++ % this.sequence.length];
        this.audio.xSequencerNote(
          note,
          0.18,
          0.35 + 0.5 * this.density,
          progress,
          0
        );
      }
      if (this.state?.drums) {
        if (clock.barStart)
          this.audio.houseDrum("kick", 0.45 + 0.5 * this.density);
        if (clock.beatStart && clock.beat === Math.floor(clock.meter.numerator / 2))
          this.audio.houseDrum("snare", 0.45 + 0.5 * this.density);
        if (clock.beatStart)
          this.audio.houseDrum("closedHat", 0.3 + 0.5 * this.density);
      }
    }
  };
  var RunglerBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.valence = 0.5;
      this.arousal = 0.5;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address.endsWith("/valence"))
        this.valence = this.normalizedControl(message.args.at(-1), this.valence);
      if (message.address.endsWith("/arousal"))
        this.arousal = this.normalizedControl(message.args.at(-1), this.arousal);
    }
    normalizedControl(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
    }
    onTick(tick, clock = { beatStart: tick % 4 === 0 }) {
      if (tick % Math.max(1, Math.round(8 - this.arousal * 7)) === 0) {
        const config = STOCHASTIC_CONFIG.rungler, note = config.pitchRange[0] + randomInt(config.pitchRange[1] - config.pitchRange[0] + 1), waveform = weightedChoice(
          ["square", "sawtooth"],
          config.waveformWeights
        ), velocity = this.shapeVelocity(0.3 + (1 - this.valence) * 0.3, note, {
          clock
        });
        this.audio.rungler(this.valence, this.arousal, note, waveform, velocity);
      }
    }
  };
  var AudioAnalyzerBot = class extends Agent {
    async start() {
      this.input = await this.audio.microphone();
    }
    onTick(tick, clock = { beatStart: tick % 4 === 0 }) {
      if (!clock.beatStart || !this.input) return;
      const features = this.input.features();
      this.broadcast("loudness", [features.loudness]);
      this.broadcast("centroid", [features.centroid]);
      this.broadcast("activity", [features.activity]);
      this.broadcast("arousal", [features.arousal]);
      this.broadcast("valence", [features.valence]);
    }
    stop() {
      this.input?.stop();
    }
  };
  var EffectsBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.valence = 0.5;
      this.arousal = 0.5;
    }
    onMessage(message) {
      const value = Math.max(0, Math.min(1, Number(message.args.at(-1))));
      if (!Number.isFinite(value)) return;
      if (message.address.endsWith("/valence")) this.valence = value;
      if (message.address.endsWith("/arousal")) this.arousal = value;
    }
    onTick(tick, clock = { barStart: tick % 16 === 0 }) {
      if (clock.barStart) this.audio.effectMonitor(this.valence, this.arousal);
    }
  };
  var PlexBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.form = [];
      this.section = -1;
      this.phrasesInSection = 0;
      this.lastPhrase = -1;
    }
    complexity(numerator) {
      const c = STOCHASTIC_CONFIG.plex, min = Math.min(...c.numerators), max = Math.max(...c.numerators), size = (numerator - min) / (max - min), odd = numerator % 2 ? 0.18 : 0, prime = [5, 7, 11, 13, 17].includes(numerator) ? 0.16 : 0;
      return Math.min(1, size * 0.66 + odd + prime);
    }
    chooseNumerator(role, previous, home) {
      const c = STOCHASTIC_CONFIG.plex;
      if (role === "return" || role === "complex-return") return home.numerator;
      if (role === "stabilize")
        return weightedChoice(
          c.stableNumerators,
          c.stableNumerators.map(() => 1)
        );
      const target = c.roleComplexity[role] ?? 0.5, continuity = c.continuity[role] ?? 0.5;
      return weightedChoice(
        c.numerators,
        c.numerators.map((value, index) => {
          const targetFit = 1 - Math.abs(this.complexity(value) - target), distance = Math.abs(value - previous.numerator) / (Math.max(...c.numerators) - Math.min(...c.numerators)), continuityFit = 1 - Math.min(1, distance);
          return c.numeratorWeights[index] * Math.max(0.01, targetFit) * (continuity * continuityFit + (1 - continuity) * Math.max(0.1, distance));
        })
      );
    }
    generateSection(index, role, previous, home) {
      const c = STOCHASTIC_CONFIG.plex, numerator = index === 0 ? weightedChoice(c.numerators, c.numeratorWeights) : this.chooseNumerator(role, previous, home || previous), isReturn = role === "return" || role === "complex-return", denominator = isReturn ? home.denominator : weightedChoice(c.denominators, c.denominatorWeights), subdivision = isReturn ? home.subdivision : weightedChoice(c.subdivisions, c.subdivisionWeights), phraseBars = isReturn ? home.phraseBars : weightedChoice(c.phraseBars, c.phraseBarWeights), target = c.roleComplexity[role] ?? 0.5, density = c.hitDensities.reduce(
        (best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best
      ), rotation = isReturn ? home.rhythm.rotation : weightedChoice(c.rotations, c.rotationWeights), baseGroups = defaultGrouping(numerator), groups = isReturn ? home.groups : rotateCycle(baseGroups, randomInt(baseGroups.length)), pulses = numerator * subdivision, baseTempo = index === 0 ? weightedChoice(c.baseTempos, c.baseTempoWeights) : home.tempo.targetBpm, targetBpm = isReturn ? home.tempo.targetBpm : Math.round(
        Math.max(
          40,
          Math.min(220, baseTempo * (c.roleTempoMultiplier[role] ?? 1))
        )
      );
      return {
        id: index,
        role,
        rationale: this.rationale(role, previous, home),
        numerator,
        denominator,
        groups,
        subdivision,
        phraseBars,
        phrases: weightedChoice(c.sectionPhrases, c.sectionPhraseWeights),
        rhythm: {
          hits: Math.max(1, Math.round(pulses * density)),
          rotation,
          clave: []
        },
        tempo: {
          targetBpm,
          durationBars: phraseBars,
          shape: weightedChoice(c.tempoShapes, c.tempoShapeWeights)
        },
        hdensity: Math.max(0.2, Math.min(0.85, target)),
        vdensity: Math.max(0.2, Math.min(0.8, target * 0.85))
      };
    }
    rationale(role, previous, home) {
      return {
        establish: "establish a metrical identity",
        "complex-frame": "open with marked metric instability",
        depart: "depart by a perceptibly related meter",
        contrast: "demarcate a new formal section by metric contrast",
        develop: "increase instability while retaining continuity",
        climax: "maximize metric and rhythmic intensity",
        relax: "reduce complexity after the high point",
        stabilize: "create a stable central field",
        return: "recall the home meter as formal resolution",
        "complex-return": "restore the opening frame"
      }[role] || "articulate form";
    }
    generateForm(clock = { bar: 0, phrase: 0, section: 0, meter: { phraseBars: 4 } }) {
      const c = STOCHASTIC_CONFIG.plex, archetype = weightedChoice(
        c.formArchetypes,
        c.formArchetypes.map((item) => item.weight)
      );
      this.form = [];
      let home, previous;
      for (const [index, role] of archetype.roles.entries()) {
        const section = this.generateSection(index, role, previous, home);
        home || (home = section);
        this.form.push(section);
        previous = section;
      }
      const payload = {
        schemaVersion: 1,
        archetype: archetype.name,
        sections: this.form
      };
      this.broadcast("form", [
        { version: 2, archetype: archetype.name, sections: this.form }
      ]);
      const phrases = this.form.reduce(
        (sum, section) => sum + section.phrases,
        0
      ), window2 = phrasePlanWindow(clock);
      this.formPlan = this.publishPlan("form", payload, {
        ...window2,
        expiresAt: {
          ...window2.createdAt,
          bar: window2.createdAt.bar + phrases * (clock.meter?.phraseBars || 4),
          phrase: window2.createdAt.phrase + phrases
        },
        horizon: phrases,
        confidence: 0.76,
        priority: 0.7,
        rationale: "Propose a complete metric and tempo articulation of the upcoming form."
      });
    }
    emitSection(clock = { bar: 0, phrase: 0, section: 0, meter: { phraseBars: 4 } }) {
      const section = this.form[this.section], meter = {
        numerator: section.numerator,
        denominator: section.denominator,
        subdivision: section.subdivision,
        phraseBars: section.phraseBars,
        rhythm: section.rhythm
      };
      this.broadcast("section", [section.id, this.form.length]);
      this.broadcast("timeSignature", [meter, "nextPhrase"]);
      this.broadcast("tempoCurve", [section.tempo, "nextPhrase"]);
      this.broadcast("tala", section.groups);
      this.broadcast("phraselength", [section.phraseBars]);
      this.broadcast("phrases", [section.phrases]);
      this.broadcast("hdensity", [section.hdensity]);
      this.broadcast("vdensity", [section.vdensity]);
      const appliesAt = {
        bar: (clock.bar || 0) + (clock.meter?.phraseBars || 4),
        phrase: (clock.phrase || 0) + 1,
        section: section.id
      };
      this.publishPlan(
        "rhythm",
        {
          schemaVersion: 1,
          meter,
          tala: [...section.groups],
          density: section.hdensity,
          verticalDensity: section.vdensity,
          tempo: { ...section.tempo },
          formalRole: section.role
        },
        {
          createdAt: {
            bar: clock.bar || 0,
            phrase: clock.phrase || 0,
            section: clock.section || 0
          },
          appliesAt,
          expiresAt: {
            ...appliesAt,
            bar: appliesAt.bar + section.phrases * section.phraseBars,
            phrase: appliesAt.phrase + section.phrases
          },
          horizon: section.phrases,
          confidence: 0.78,
          priority: 0.72,
          rationale: section.rationale
        }
      );
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/form/adjust" && this.formPlan) {
        const payload = reviseFutureForm(
          this.formPlan,
          this.currentClock || {},
          message.args?.[0] || {}
        );
        this.formPlan = this.plans.revise(this.formPlan, payload, {
          createdAt: this.formPlan.createdAt
        });
        this.form = payload.sections;
        this.broadcast("plan", [this.formPlan]);
      }
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      section: 0,
      meter: { phraseBars: 4 }
    }) {
      if (!clock.phraseStart || clock.bar === this.lastPhrase) return;
      this.lastPhrase = clock.bar;
      if (!this.form.length) this.generateForm(clock);
      this.broadcast("plan", [this.formPlan]);
      this.broadcast("form/progress", [formProgress(this.formPlan, clock)]);
      if (this.section < 0 || this.phrasesInSection >= this.form[this.section].phrases) {
        this.section = (this.section + 1) % this.form.length;
        this.phrasesInSection = 0;
        if (this.section === 0 && clock.bar > 0) this.generateForm(clock);
        this.emitSection(clock);
      }
      this.phrasesInSection++;
    }
  };
  var FormBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.lastPhrase = -1;
      this.formPlan = null;
      this.stopProposal = null;
      this.stopCommitment = null;
      this.formParticipants = /* @__PURE__ */ new Map();
      this.stopVotes = /* @__PURE__ */ new Map();
      this.extension = 0;
    }
    generateSections() {
      const config = STOCHASTIC_CONFIG.formBot, archetype = weightedChoice(
        config.archetypes,
        config.archetypes.map((item) => item.weight)
      );
      return {
        archetype: archetype.name,
        sections: archetype.roles.map((role, index) => ({
          id: index,
          role,
          phrases: weightedChoice(
            config.sectionPhrases,
            config.sectionPhraseWeights
          ),
          tension: config.roleTension[role] ?? 0.5,
          closure: index === archetype.roles.length - 1 ? config.roleClosure[role] ?? 0.8 : config.roleClosure[role] ?? 0.1
        }))
      };
    }
    proposeForm(clock) {
      this.formParticipants.clear();
      const generated = this.generateSections(), phraseBars = clock.meter?.phraseBars || 4, totalPhrases = generated.sections.reduce(
        (sum, section) => sum + section.phrases,
        0
      ), createdAt = {
        bar: clock.bar || 0,
        phrase: clock.phrase || 0,
        section: 0
      }, appliesAt = {
        bar: createdAt.bar + phraseBars,
        phrase: createdAt.phrase + 1,
        section: 0
      }, endpoint = {
        bar: appliesAt.bar + totalPhrases * phraseBars,
        phrase: appliesAt.phrase + totalPhrases,
        section: generated.sections.length
      };
      this.formPlan = this.publishPlan(
        "form",
        {
          schemaVersion: 1,
          ...generated,
          phraseBars,
          totalPhrases,
          candidateEndpoint: endpoint,
          extension: this.extension
        },
        {
          createdAt,
          appliesAt,
          expiresAt: {
            ...endpoint,
            bar: endpoint.bar + phraseBars,
            phrase: endpoint.phrase + 1
          },
          horizon: totalPhrases + 1,
          confidence: STOCHASTIC_CONFIG.formBot.confidence,
          priority: STOCHASTIC_CONFIG.formBot.priority,
          rationale: "Shape nested tension and relaxation into sections, then ask the participating agents whether the proposed closure is musically ready."
        }
      );
    }
    proposeStop(clock) {
      const config = STOCHASTIC_CONFIG.formBot, endpoint = this.formPlan.payload.candidateEndpoint, deadline = {
        bar: Math.max(
          clock.bar || 0,
          endpoint.bar - (clock.meter?.phraseBars || 4)
        ),
        phrase: Math.max(clock.phrase || 0, endpoint.phrase - 1),
        section: Math.max(0, endpoint.section - 1)
      };
      this.stopVotes.clear();
      const eligibleParticipants = [...this.formParticipants.keys()].sort();
      this.stopProposal = this.publishPlan(
        "lifecycle",
        {
          schemaVersion: 1,
          action: "stop",
          phase: "proposal",
          earliestAt: endpoint,
          deadline,
          quorum: config.quorum,
          minimumVotes: config.minimumVotes,
          eligibleParticipants,
          formPlanId: this.formPlan.planId
        },
        {
          createdAt: {
            bar: clock.bar || 0,
            phrase: clock.phrase || 0,
            section: clock.section || 0
          },
          appliesAt: endpoint,
          expiresAt: {
            ...endpoint,
            bar: endpoint.bar + (clock.meter?.phraseBars || 4),
            phrase: endpoint.phrase + 1
          },
          horizon: config.stopLeadPhrases + 1,
          parents: [this.formPlan.planId],
          parentDepth: this.formPlan.ancestryDepth,
          confidence: config.confidence,
          priority: config.stopPriority,
          rationale: "Invite each current agent to state whether it can finish at the candidate formal closure."
        }
      );
    }
    evaluateStop(clock) {
      const config = STOCHASTIC_CONFIG.formBot, participants = new Set(
        this.stopProposal.payload.eligibleParticipants || []
      ), votes = [...this.stopVotes.values()].filter(
        (response) => participants.has(response.responder) && response.disposition !== "abstain"
      ), accepts = votes.filter(
        (response) => ["accept", "transform"].includes(response.disposition)
      ), eligibleCount = participants.size, ratio = eligibleCount ? accepts.length / eligibleCount : 0;
      if (votes.length >= config.minimumVotes && ratio >= config.quorum) {
        const endpoint = this.stopProposal.payload.earliestAt;
        this.stopCommitment = this.publishPlan(
          "lifecycle",
          {
            schemaVersion: 1,
            action: "stop",
            phase: "commitment",
            decision: {
              eligible: eligibleCount,
              votes: votes.length,
              accepts: accepts.length,
              ratio,
              quorum: config.quorum
            },
            formPlanId: this.formPlan.planId,
            proposalPlanId: this.stopProposal.planId
          },
          {
            createdAt: {
              bar: clock.bar || 0,
              phrase: clock.phrase || 0,
              section: clock.section || 0
            },
            appliesAt: endpoint,
            expiresAt: {
              ...endpoint,
              bar: endpoint.bar + (clock.meter?.phraseBars || 4),
              phrase: endpoint.phrase + 1
            },
            horizon: 1,
            parents: [this.formPlan.planId, this.stopProposal.planId],
            parentDepth: Math.max(
              this.formPlan.ancestryDepth,
              this.stopProposal.ancestryDepth
            ),
            confidence: 1,
            priority: 1,
            rationale: "Commit the ensemble to the voted stopping point at a complete phrase boundary."
          }
        );
        this.broadcast("form/decision", [
          {
            status: "accepted",
            planId: this.stopCommitment.planId,
            ...this.stopCommitment.payload.decision,
            appliesAt: endpoint
          }
        ]);
        return;
      }
      this.extension++;
      this.broadcast("form/decision", [
        {
          status: "extended",
          eligible: eligibleCount,
          votes: votes.length,
          accepts: accepts.length,
          ratio,
          required: config.quorum,
          extension: this.extension
        }
      ]);
      this.formPlan = null;
      this.stopProposal = null;
      this.stopCommitment = null;
    }
    onPlanResponse(response) {
      if (response.planId === this.formPlan?.planId && response.disposition !== "abstain")
        this.formParticipants.set(response.responder, response);
      if (response.planId === this.stopProposal?.planId)
        this.stopVotes.set(response.responder, response);
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      section: 0,
      meter: { phraseBars: 4 }
    }) {
      if (!clock.phraseStart || clock.bar === this.lastPhrase) return;
      this.lastPhrase = clock.bar;
      if (!this.formPlan) {
        this.proposeForm(clock);
        return;
      }
      this.broadcast("plan", [this.formPlan]);
      this.broadcast("form/progress", [formProgress(this.formPlan, clock)]);
      const endpoint = this.formPlan.payload.candidateEndpoint, lead = STOCHASTIC_CONFIG.formBot.stopLeadPhrases;
      const leadBar = endpoint.bar - lead * (this.formPlan.payload.phraseBars || clock.meter?.phraseBars || 4);
      if (!this.stopProposal && (clock.bar || 0) >= leadBar) {
        this.proposeStop(clock);
        return;
      }
      if (this.stopProposal && !this.stopCommitment && (clock.bar || 0) >= this.stopProposal.payload.deadline.bar)
        this.evaluateStop(clock);
    }
  };
  function recordAgentState(states, state2) {
    if (!state2?.instanceId) return;
    const provisional = state2.instanceId === state2.definitionId;
    if (provisional) {
      const final = [...states.values()].find(
        (candidate) => candidate.definitionId === state2.definitionId && candidate.instanceId !== candidate.definitionId
      );
      if (final) return;
    } else if (state2.definitionId) states.delete(state2.definitionId);
    states.set(state2.instanceId, state2);
  }
  var CoordBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.states = /* @__PURE__ */ new Map();
      this.lastPhrase = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/agentState")
        recordAgentState(this.states, message.args?.[0]);
    }
    onTick(tick, clock = { phraseStart: tick === 0, phrase: 0, bar: 0 }) {
      if (!clock.phraseStart || clock.bar === this.lastPhrase) return;
      this.lastPhrase = clock.bar;
      const states = [...this.states.values()].filter(
        (state2) => state2.state === "performing" && !state2.messageOnly
      ), appliesAt = { bar: clock.bar || 0, phrase: clock.phrase || 0, section: clock.section || 0 };
      for (const placement of ensembleMixPlacements(states, STOCHASTIC_CONFIG.coord.mix, clock.phrase || 0))
        this.send("/agent/mix", [{
          ...placement,
          appliesAt,
          coordinator: this.instanceId,
          rationale: "Balance foreground focus, accompaniment support, and ensemble-size headroom."
        }]);
    }
  };
  var ManageBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.states = /* @__PURE__ */ new Map();
      this.lastPhrase = -1;
      this.activeOrder = [];
      this.requestedDefinitions = /* @__PURE__ */ new Set();
      this.pendingStarts = /* @__PURE__ */ new Set();
      this.pendingExits = /* @__PURE__ */ new Set();
      this.nextEntranceGroup = randomInt(3);
      this.stopCommitment = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/agentState") {
        const state2 = message.args?.[0];
        if (state2?.instanceId) {
          recordAgentState(this.states, state2);
          if (state2.state === "performing") {
            this.pendingStarts.delete(state2.instanceId);
            if (!this.activeOrder.includes(state2.instanceId))
              this.activeOrder.push(state2.instanceId);
          }
          if (["leaving", "stopped"].includes(state2.state))
            this.pendingExits.delete(state2.instanceId);
        }
      }
    }
    onPlan(plan) {
      super.onPlan(plan);
      if (plan.kind === "lifecycle" && plan.payload?.phase === "commitment" && plan.payload?.action === "stop" && !this.stopCommitment) {
        this.stopCommitment = plan;
        const phraseBars = this.currentClock?.meter?.phraseBars || 4, leaveAt = {
          ...plan.appliesAt,
          bar: plan.appliesAt.bar + phraseBars,
          phrase: plan.appliesAt.phrase + 1
        };
        for (const state2 of this.states.values())
          if (state2.state === "performing" && !state2.messageOnly) {
            this.directAt("stop", state2.instanceId, plan.appliesAt, {
              functionGroup: state2.functionGroup
            });
            this.directAt("leave", state2.instanceId, leaveAt, {
              functionGroup: state2.functionGroup
            });
            this.pendingExits.add(state2.instanceId);
          }
      }
    }
    directAt(action, target, appliesAt, extra = {}) {
      this.send(`/agent/${action}`, [
        {
          target,
          appliesAt,
          fadeBars: STOCHASTIC_CONFIG.manage.fadeBars,
          coordinator: this.instanceId,
          ...extra
        }
      ]);
    }
    direct(action, target, clock, extra = {}) {
      const phraseBars = clock.meter?.phraseBars || 4, appliesAt = {
        bar: (clock.bar || 0) + phraseBars,
        phrase: (clock.phrase || 0) + 1,
        section: clock.section || 0
      };
      this.send(`/agent/${action}`, [
        {
          target,
          appliesAt,
          fadeBars: STOCHASTIC_CONFIG.manage.fadeBars,
          coordinator: this.instanceId,
          ...extra
        }
      ]);
    }
    entranceCandidates() {
      const states = [...this.states.values()], performing = states.filter((state2) => state2.state === "performing"), counts = /* @__PURE__ */ new Map();
      for (const state2 of performing)
        counts.set(
          state2.functionGroup,
          (counts.get(state2.functionGroup) || 0) + 1
        );
      return states.filter(
        (state2) => state2.state === "loaded" && !state2.messageOnly && state2.functionGroup !== "incomplete" && !this.pendingStarts.has(state2.instanceId) && !this.pendingExits.has(state2.instanceId)
      ).sort(
        (left, right) => (counts.get(left.functionGroup) || 0) - (counts.get(right.functionGroup) || 0) || String(left.instanceId).localeCompare(String(right.instanceId))
      );
    }
    entranceCandidate() {
      return this.entranceCandidates()[0] || null;
    }
    targetCount(clock) {
      if (!this.activeFormPlan) return STOCHASTIC_CONFIG.manage.targetSoundAgents;
      const progress = formProgress(this.activeFormPlan, clock).overallProgress;
      return STOCHASTIC_CONFIG.manage.formTargets.find((stage) => progress <= stage.until)?.count ?? STOCHASTIC_CONFIG.manage.targetSoundAgents;
    }
    exitCandidates() {
      const performing = [...this.states.values()].filter(
        (state2) => state2.state === "performing" && !state2.messageOnly && !this.pendingExits.has(state2.instanceId)
      ), counts = /* @__PURE__ */ new Map();
      for (const state2 of performing)
        counts.set(
          state2.functionGroup,
          (counts.get(state2.functionGroup) || 0) + 1
        );
      return performing.sort(
        (left, right) => (counts.get(right.functionGroup) || 0) - (counts.get(left.functionGroup) || 0) || this.activeOrder.indexOf(left.instanceId) - this.activeOrder.indexOf(right.instanceId)
      );
    }
    requestLoad() {
      const soundStates = [...this.states.values()].filter(
        (state2) => !state2.messageOnly && state2.functionGroup !== "incomplete" && state2.state !== "leaving"
      ), present = new Set(soundStates.map((state2) => state2.definitionId)), groups = ["polyphonic", "monophonic", "percussive"];
      for (let attempt = 0; attempt < groups.length; attempt++) {
        const functionGroup = groups[(this.nextEntranceGroup + attempt) % groups.length], available = STOCHASTIC_CONFIG.manage.entranceRoster[functionGroup].filter(
          (id) => !present.has(id) && !this.requestedDefinitions.has(id)
        );
        if (!available.length) continue;
        const definitionId = available[randomInt(available.length)];
        this.nextEntranceGroup = (this.nextEntranceGroup + attempt + 1) % groups.length;
        this.requestedDefinitions.add(definitionId);
        this.send("/agent/load", [
          {
            target: this.instanceId,
            definitionId,
            functionGroup,
            loadOnly: true,
            coordinator: this.instanceId
          }
        ]);
        return true;
      }
      return false;
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      meter: { phraseBars: 4 }
    }) {
      if (!clock.phraseStart || clock.bar === this.lastPhrase || this.stopCommitment)
        return;
      this.lastPhrase = clock.bar;
      const target = this.targetCount(clock), performing = [...this.states.values()].filter(
        (state2) => state2.state === "performing" && !state2.messageOnly && !this.pendingExits.has(state2.instanceId)
      );
      if (performing.length > target) {
        for (const state2 of this.exitCandidates().slice(
          0,
          Math.min(STOCHASTIC_CONFIG.manage.maxExitsPerPhrase, performing.length - target)
        )) {
          this.direct("stop", state2.instanceId, clock, {
            functionGroup: state2.functionGroup
          });
          this.direct(
            "leave",
            state2.instanceId,
            {
              ...clock,
              bar: (clock.bar || 0) + (clock.meter?.phraseBars || 4),
              phrase: (clock.phrase || 0) + 1
            },
            {
              fadeBars: STOCHASTIC_CONFIG.manage.fadeBars,
              functionGroup: state2.functionGroup
            }
          );
          this.pendingExits.add(state2.instanceId);
        }
        return;
      }
      const needed = Math.max(0, target - performing.length), entrances = this.entranceCandidates().slice(
        0,
        Math.min(STOCHASTIC_CONFIG.manage.maxEntrancesPerPhrase, needed)
      );
      for (const candidate of entrances) {
        this.direct("invite", candidate.instanceId, clock, {
          functionGroup: candidate.functionGroup
        });
        this.direct("start", candidate.instanceId, clock, {
          functionGroup: candidate.functionGroup
        });
        this.pendingStarts.add(candidate.instanceId);
      }
      const soundStates = [...this.states.values()].filter(
        (state2) => !state2.messageOnly && state2.functionGroup !== "incomplete" && state2.state !== "leaving"
      ), present = new Set(soundStates.map((state2) => state2.definitionId)), awaiting = [...this.requestedDefinitions].filter(
        (id) => !present.has(id)
      ).length, deficit = Math.max(0, target - soundStates.length - awaiting);
      for (let index = 0; index < Math.min(STOCHASTIC_CONFIG.manage.maxEntrancesPerPhrase, deficit); index++)
        if (!this.requestLoad()) break;
      if (!this.activeFormPlan && performing.length === target && clock.phrase > 0 && clock.phrase % STOCHASTIC_CONFIG.manage.rotationPhrases === 0) {
        const state2 = this.exitCandidates()[0];
        if (state2) {
          this.direct("stop", state2.instanceId, clock, {
            functionGroup: state2.functionGroup
          });
          this.direct(
            "leave",
            state2.instanceId,
            {
              ...clock,
              bar: (clock.bar || 0) + (clock.meter?.phraseBars || 4),
              phrase: (clock.phrase || 0) + 1
            },
            {
              fadeBars: STOCHASTIC_CONFIG.manage.fadeBars,
              functionGroup: state2.functionGroup
            }
          );
          this.pendingExits.add(state2.instanceId);
        }
      }
    }
  };
  var TuneBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.harmony = [];
      this.harmonyPlan = null;
      this.lastPhrase = -1;
      this.lastTunedHarmonyPlanId = null;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/plan" && message.args?.[0]?.kind === "harmony") {
        const plan = message.args[0], chords = plan.payload?.chords;
        if (Array.isArray(chords) && chords.length) {
          this.harmonyPlan = {
            plan,
            chords: chords.map((chord) => chord.map(Number).filter(Number.isFinite)).filter((chord) => chord.length)
          };
          if (this.currentClock && plan.planId !== this.lastTunedHarmonyPlanId) {
            this.lastTunedHarmonyPlanId = plan.planId;
            this.createTuning(this.currentClock, true);
          }
        }
      }
      if (message.address.endsWith("/plan/chords")) {
        const parsed = parseChordPlan(message.args);
        if (parsed.length) this.harmony = parsed;
      }
    }
    createTuning(clock, applyNow = false) {
      const config = STOCHASTIC_CONFIG.tune, harmony = this.harmonyPlan?.chords?.length ? this.harmonyPlan.chords : this.harmony;
      const chords = harmony.length ? harmony : config.fallbackChords;
      const parameters = {
        purity: config.purity,
        continuity: config.continuity,
        grounding: config.grounding,
        complexity: config.complexity,
        primeSoftness: config.primeSoftness,
        oddLimit: config.oddLimit,
        iterations: config.iterations,
        chordExactness: config.chordExactness,
        exactComplexity: config.exactComplexity,
        exactPrimeSoftness: config.exactPrimeSoftness,
        exactOddLimit: config.exactOddLimit,
        exactRatios: config.exactRatios.map((pair) => [...pair])
      };
      const system = tuningSystem({
        divisions: config.divisions,
        period: config.period,
        purity: config.purity,
        complexity: config.complexity,
        primeSoftness: config.primeSoftness,
        oddLimit: config.oddLimit
      });
      const compromise = adaptiveJustIntonation(chords, parameters), exact = exactChordJustIntonation(chords, {
        exactness: 1,
        complexity: config.exactComplexity,
        primeSoftness: config.exactPrimeSoftness,
        oddLimit: config.exactOddLimit,
        ratios: config.exactRatios
      }), tunedChords = exact.map(
        (chord, index) => chord.map(
          (pitch, voice) => compromise[index][voice] + (pitch - compromise[index][voice]) * config.chordExactness
        )
      ), phraseBars = clock.meter?.phraseBars || 4, appliesAt = applyNow ? {
        bar: clock.bar || 0,
        phrase: clock.phrase || 0,
        section: clock.section || 0
      } : {
        bar: (clock.bar || 0) + phraseBars,
        phrase: (clock.phrase || 0) + 1,
        section: clock.section || 0
      };
      const durations = this.harmonyPlan?.plan?.payload?.durations?.map(Number).filter((value) => Number.isFinite(value) && value > 0) || chords.map(() => 1);
      const ratios = chordRatioProvenance(chords, {
        ...parameters,
        ratios: config.exactRatios
      });
      const chordReferencePitches = chords.map((chord) => Number(chord[0])), referencePitch = chordReferencePitches.find(Number.isFinite) ?? config.fallbackReferencePitch;
      return this.publishPlan(
        "tuning",
        {
          system,
          period: config.period,
          referencePitch,
          chordReferencePitches,
          nominalChords: chords.map((chord) => [...chord]),
          chords: tunedChords,
          ratios,
          durations: durations.length === chords.length ? durations : chords.map(() => 1),
          sourcePlanId: this.harmonyPlan?.plan?.planId || null,
          parameters
        },
        {
          createdAt: {
            bar: clock.bar || 0,
            phrase: clock.phrase || 0,
            section: clock.section || 0
          },
          appliesAt,
          expiresAt: {
            ...appliesAt,
            bar: appliesAt.bar + phraseBars,
            phrase: appliesAt.phrase + 1
          },
          horizon: 1,
          parents: this.harmonyPlan?.plan ? [this.harmonyPlan.plan.planId] : [],
          parentDepth: this.harmonyPlan?.plan?.ancestryDepth || 0,
          confidence: config.confidence,
          priority: config.priority,
          rationale: "Offer a continuously parameterized tuning system and chord-root-relative just intonation for the next phrase."
        }
      );
    }
    onTick(tick, clock = {
      phraseStart: tick === 0,
      phrase: 0,
      bar: 0,
      meter: { phraseBars: 4 }
    }) {
      if (!clock.phraseStart || clock.bar === this.lastPhrase) return;
      this.lastPhrase = clock.bar;
      if (!this.harmonyPlan || this.harmonyPlan.plan.planId !== this.lastTunedHarmonyPlanId)
        this.createTuning(clock);
    }
  };
  var HarmonyPulseBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.lastPhrase = -1;
      this.lastStep = -1;
      this.previousChord = [];
      this.progression = [];
      this.durations = [];
    }
    generate(clock) {
      const config = STOCHASTIC_CONFIG.harmonyPulse, roots = [...config.rootCycle], pool = this.notes.length ? this.notes : [60, 63, 67, 70];
      this.progression = roots.map((offset, index) => {
        const root = pitchClass(pool[index % pool.length]) + offset;
        const quality = config.qualities[index % config.qualities.length];
        return voiceLeadChord(this.previousChord, quality.map((value) => root + value), config.register);
      });
      this.previousChord = [...this.progression.at(-1)];
      this.durations = this.progression.map(
        (_, index) => config.durationBeats[index % config.durationBeats.length]
      );
      const phraseBars = clock.meter?.phraseBars || 4, appliesAt = { bar: (clock.bar || 0) + phraseBars, phrase: (clock.phrase || 0) + 1, section: clock.section || 0 };
      this.publishPlan("harmony", {
        schemaVersion: 1,
        chords: this.progression.map((chord) => [...chord]),
        durations: [...this.durations],
        maximumHoldBeats: config.maximumHoldBeats
      }, {
        createdAt: { bar: clock.bar || 0, phrase: clock.phrase || 0, section: clock.section || 0 },
        appliesAt,
        expiresAt: { ...appliesAt, bar: appliesAt.bar + phraseBars, phrase: appliesAt.phrase + 1 },
        confidence: 0.82,
        priority: 0.72,
        rationale: "Maintain audible harmonic motion with bounded holds and parsimonious voice leading."
      });
    }
    onTick(tick, clock = { bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.lastPhrase = clock.phrase;
        this.generate(clock);
        this.lastStep = -1;
      }
      if (!clock.beatStart || !this.progression.length) return;
      const beatInPhrase = (clock.bar || 0) % (clock.meter?.phraseBars || 4) * (clock.meter?.numerator || 4) + (clock.beat || 0);
      let span = 0, index = 0;
      while (index < this.durations.length - 1 && beatInPhrase >= span + this.durations[index]) span += this.durations[index++];
      index %= this.progression.length;
      if (index === this.lastStep) return;
      this.lastStep = index;
      const chord = this.progression[index], seconds = Math.min(STOCHASTIC_CONFIG.harmonyPulse.maximumHoldBeats, this.durations[index]) * (60 / (clock.bpm || 108)) * (4 / (clock.meter?.denominator || 4));
      this.broadcast("notepool", chord);
      this.audio.chord(chord, seconds, 0.58);
    }
  };
  var ContourBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.history = [];
      this.phraseEvents = [];
      this.lastPhrase = -1;
      this.lastSoundBar = -1;
    }
    planMotif(clock) {
      if (this.phraseEvents.length) {
        const motif = this.publishMotif(this.phraseEvents, {
          tags: ["melody", "curated", "contour-balanced"],
          createdAt: { bar: clock.bar || 0, phrase: Math.max(0, (clock.phrase || 0) - 1), section: clock.section || 0 }
        });
        const transformed = {
          ...transformMotif(motif, {
            transpose: weightedChoice([-5, -2, 0, 2, 5], [0.1, 0.2, 0.25, 0.3, 0.15]),
            timeScale: weightedChoice([0.5, 1, 2], [0.15, 0.7, 0.15]),
            invert: unitRandom() < 0.22,
            retrograde: unitRandom() < 0.12
          }),
          motifId: `${this.instanceId}:planned:${clock.phrase || 0}`,
          author: this.instanceId
        };
        const phraseBars = clock.meter?.phraseBars || 4, appliesAt = { bar: (clock.bar || 0) + phraseBars, phrase: (clock.phrase || 0) + 1, section: clock.section || 0 };
        this.publishPlan("motif", { schemaVersion: 1, motif: transformed, development: transformed.transformation }, {
          createdAt: { bar: clock.bar || 0, phrase: clock.phrase || 0, section: clock.section || 0 },
          appliesAt,
          expiresAt: { ...appliesAt, bar: appliesAt.bar + phraseBars, phrase: appliesAt.phrase + 1 },
          confidence: 0.74,
          priority: 0.58,
          rationale: "Offer a recognizable but varied contour for another melodic agent's next phrase."
        });
      }
      this.phraseEvents = [];
    }
    onTick(tick, clock = { tick: 0, tickInBar: 0, bar: 0, phrase: 0, beat: 0, subdivision: 0, barStart: true, beatStart: true, phraseStart: true, bpm: 108, meter: { numerator: 4, denominator: 4, subdivision: 4, phraseBars: 4, pulsesPerBar: 16, groups: [4] } }) {
      if (clock.phraseStart && clock.phrase !== this.lastPhrase) {
        this.planMotif(clock);
        this.lastPhrase = clock.phrase;
      }
      const subdivision = clock.meter?.subdivision || 4, offbeat = Math.max(1, Math.floor(subdivision / 2));
      if (clock.subdivision !== offbeat) return;
      const finalBeat = Math.max(0, Number(clock.meter?.numerator || 4) - 1), mustSoundThisBar = this.lastSoundBar !== clock.bar && clock.beat >= finalBeat;
      if (!mustSoundThisBar && unitRandom() > Math.min(0.72, this.density * STOCHASTIC_CONFIG.contour.densityScale))
        return;
      const note = chooseContrastingPitch(this.notes, this.history, {
        ...STOCHASTIC_CONFIG.contour,
        random: unitRandom
      });
      this.history.push(note);
      if (this.history.length > STOCHASTIC_CONFIG.contour.history) this.history.shift();
      const duration = 60 / (clock.bpm || 108) * (4 / (clock.meter?.denominator || 4)) * 0.62, velocity = this.shapeVelocity(0.62, note, { clock, amount: 0.7 });
      this.audio.ornamentPluck(note, duration, velocity);
      this.lastSoundBar = clock.bar;
      this.phraseEvents.push({ at: clock.tickInPhrase || clock.tick || 0, duration: subdivision * 0.62, pitches: [note], velocity });
    }
  };
  var SpaceBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.states = /* @__PURE__ */ new Map();
      this.lastPhrase = -1;
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/agentState" && message.args?.[0]?.instanceId)
        this.states.set(message.args[0].instanceId, message.args[0]);
    }
    onTick(tick, clock = { bar: 0, phrase: 0, phraseStart: true, meter: { phraseBars: 4 } }) {
      if (!clock.phraseStart || clock.phrase === this.lastPhrase) return;
      this.lastPhrase = clock.phrase;
      const allocations = spaceAllocation([...this.states.values()], STOCHASTIC_CONFIG.space);
      if (!allocations.length) return;
      const phraseBars = clock.meter?.phraseBars || 4, createdAt = { bar: clock.bar || 0, phrase: clock.phrase || 0, section: clock.section || 0 }, appliesAt = { bar: createdAt.bar + phraseBars, phrase: createdAt.phrase + 1, section: createdAt.section };
      this.publishPlan("orchestration", { schemaVersion: 1, allocations }, {
        createdAt,
        appliesAt,
        expiresAt: { ...appliesAt, bar: appliesAt.bar + phraseBars, phrase: appliesAt.phrase + 1 },
        confidence: 0.78,
        priority: 0.66,
        rationale: "Allocate complementary density, phase, anchor, support, and response roles to reduce masking and downbeat crowding."
      });
      for (const allocation of allocations)
        this.send("/agent/space", [{ ...allocation, appliesAt, coordinator: this.instanceId }]);
    }
  };
  var MemoryBot = class extends Agent {
    constructor(...args) {
      super(...args);
      this.memory = new MotifMemory(STOCHASTIC_CONFIG.memory.limit);
    }
    respond(payload, operation, motifs = [], extra = {}) {
      this.send("/agent/memory/response", [{
        target: payload.requester,
        memory: this.instanceId,
        requestId: payload.requestId,
        operation,
        motifs,
        total: this.memory.motifs.size,
        ...extra
      }]);
    }
    store(payload) {
      try {
        const candidate = validateMotif(payload.motif), duplicate = this.memory.recent(STOCHASTIC_CONFIG.memory.deduplicationWindow).find((motif2) => motif2.author === candidate.author && JSON.stringify(motif2.fingerprint) === JSON.stringify(candidate.fingerprint));
        if (duplicate) {
          this.respond(payload, "store", [duplicate], { ok: true, stored: false, reason: "duplicate-fingerprint" });
          return;
        }
        const motif = this.memory.remember(candidate);
        this.respond(payload, "store", [motif], { ok: true, stored: true });
      } catch (error) {
        this.respond(payload, "store", [], { ok: false, error: error.message });
      }
    }
    onMessage(message) {
      super.onMessage(message);
      if (message.address === "/broadcast/motif") {
        try {
          this.memory.remember(validateMotif(message.args?.[0]));
        } catch (error) {
          this.audio?.report?.("motif_rejected", { error: error.message });
        }
        return;
      }
      if (!this.targeted(message)) return;
      const payload = message.args?.[0] || {};
      if (message.address === "/agent/memory/store") this.store(payload);
      if (message.address === "/agent/memory/query") {
        const motifs = queryMotifs(this.memory, payload.query || {});
        this.respond(payload, "query", motifs, { ok: true });
      }
      if (message.address === "/agent/memory/get") {
        const motif = this.memory.get(String(payload.motifId || ""));
        this.respond(payload, "get", motif ? [motif] : [], { ok: Boolean(motif) });
      }
    }
    onTick() {
    }
  };
  var fixedPercussionMidi = /* @__PURE__ */ new Set([
    "beat",
    "jazzBeat",
    "cleanBeat",
    "clumpyBeat",
    "noiseBeat",
    "newBeat",
    "houseBeat",
    "perc",
    "papPerc",
    "mhBeat",
    "mhBeatsynth",
    "autechre",
    "prockRock",
    "xDrum",
    "xPerc"
  ]);
  var hybridMidi = /* @__PURE__ */ new Set(["sampleBeat", "tangerineDream"]);
  var port = (manifest, Type) => defineBot(
    {
      status: "behavioural-port",
      source: "local-max-collection",
      pitchContract: manifest.outputModes?.includes("midi") ? hybridMidi.has(manifest.id) ? "hybrid-mpe-percussion" : fixedPercussionMidi.has(manifest.id) ? "fixed-percussion" : "floating-mpe" : "none",
      ...manifest
    },
    (...args) => new Type(...args)
  );
  var BOT_REGISTRY = new BotRegistry().registerMany([
    port(
      {
        id: "modal",
        name: "ae_ModalChordBOT",
        category: "harmony",
        midiChannel: 1,
        outputModes: ["synth", "midi"],
        description: "Algorithmic static-modal harmony; broadcasts note pools and plans."
      },
      ModalChordBot
    ),
    port(
      {
        id: "miles",
        name: "ae_MilesChordBOT",
        category: "harmony",
        midiChannel: 2,
        outputModes: ["synth", "midi"],
        description: "Corpus-inspired pre-Bitches Brew harmony and chord plans."
      },
      MilesChordBot
    ),
    port(
      {
        id: "swingChord",
        name: "ae_SwingChordBOT",
        category: "harmony",
        midiChannel: 10,
        outputModes: [],
        description: "Silent Standards-corpus harmony agent publishing current chords, pitch-class probabilities, and phrase plans with section recall."
      },
      SwingChordBot
    ),
    port(
      {
        id: "methenyChord",
        name: "ae_MethenyChordBOT",
        category: "harmony",
        outputModes: [],
        description: "Silent Pat Metheny corpus harmony agent publishing current chords, pitch-class probabilities, and phrase plans with adjustable harmonic rhythm and section recall."
      },
      MethenyChordBot
    ),
    port(
      {
        id: "mozartChord",
        name: "ae_MozartChordBOT",
        category: "harmony",
        outputModes: [],
        description: "Silent Mozart corpus harmony agent publishing current chords, pitch-class probabilities, and phrase plans with initialization, on/off, and section recall."
      },
      MozartChordBot
    ),
    port(
      {
        id: "bowed",
        name: "ae_BowedBOT",
        category: "keys-pads",
        midiChannel: 5,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "bowed",
        description: "Sustained bowed-guitar/vibraphone texture following chord plans, note pools, tala, and density with separate bass and ascending chord registers."
      },
      BowedBot
    ),
    port(
      {
        id: "drone",
        name: "ae_DroneBOT",
        category: "keys-pads",
        midiChannel: 6,
        outputModes: ["synth", "midi"],
        description: "Monophonic sustained pad following chord plans or note-pool fallback, favoring phrase-common chord tones and smooth pitch continuity."
      },
      DroneBot
    ),
    port(
      {
        id: "pad",
        name: "ae_PadBOT",
        category: "keys-pads",
        midiChannel: 5,
        outputModes: ["synth", "midi"],
        description: "Sustained chord-plan pad whose voice count follows density and whose filter trajectory opens over the phrase."
      },
      PadBot
    ),
    port(
      {
        id: "newDrone",
        name: "ae_newDroneBOT",
        category: "keys-pads",
        midiChannel: 6,
        outputModes: ["synth", "midi"],
        description: "Sparse high-register drone that shares and interprets 16-cell activity intentions while choosing pitches from note pools."
      },
      NewDroneBot
    ),
    port(
      {
        id: "mhDrone",
        name: "mh_DroneBOT",
        category: "keys-pads",
        midiChannel: 6,
        outputModes: ["synth", "midi"],
        description: "Noisy wub drone with source-derived activity-dependent play/break durations, density-dependent tremolo, and smoothed ecosystem controls."
      },
      MhDroneBot
    ),
    port(
      {
        id: "sequencer",
        name: "ae_SequencerBOT",
        category: "melody",
        midiChannel: 1,
        outputModes: ["synth", "midi"],
        description: "Monophonic eighth- or sixteenth-note sequencer that walks an octave-expanded note pool and interprets density over arbitrary meters."
      },
      SequencerBot
    ),
    port(
      {
        id: "papMelody2",
        name: "PAP_MelodyBot2",
        category: "melody",
        midiChannel: 2,
        outputModes: ["synth", "midi"],
        description: "Tuplet melody synthesizer that listens for note-pool and density controls, then generates its own mode, phrase curve, and rhythm after bounded silence."
      },
      PapMelody2Bot
    ),
    port(
      {
        id: "laverne",
        name: "PAP_LaverneBOT",
        category: "melody",
        midiChannel: 7,
        outputModes: ["synth", "midi"],
        description: "Tuplet melody agent that follows shared note pools and density, becomes autonomous after bounded silence, and selects one of five source Laverne synthesizer presets per instance."
      },
      LaverneBot
    ),
    port(
      {
        id: "resynth",
        name: "bc.resynth_bot",
        category: "melody",
        midiChannel: 8,
        outputModes: ["synth", "midi"],
        description: "Sinusoidal resynthesis melody agent that publishes four-bar activity, pitch-class, contour, and tala intentions and interprets peers\u2019 activity plans."
      },
      ResynthBot
    ),
    port(
      {
        id: "papMelody",
        name: "PAP_MelodyBot",
        category: "melody",
        midiChannel: 3,
        outputModes: ["synth", "midi"],
        description: "Three-register probabilistic melody ensemble that publishes its legacy modulation meter and density while mixing external-pool, urn, and bounded-walk voices."
      },
      PapMelodyBot
    ),
    port(
      {
        id: "papMelody4",
        name: "PAP_MelodyBot4",
        category: "melody",
        midiChannel: 4,
        outputModes: ["synth", "midi"],
        description: "Listening-or-sending tuplet melody agent that modulates through its embedded 13-scale lattice and optional major/minor modal inflections."
      },
      PapMelody4Bot
    ),
    port(
      {
        id: "dampPiano",
        name: "PAP_DampPianoBot",
        category: "melody",
        midiChannel: 5,
        outputModes: ["synth", "midi"],
        description: "Self-terminating 15-section damped-piano form with four changing registers, density curves, within-beat tuplets, and legacy section-meter publication."
      },
      DampPianoBot
    ),
    port(
      {
        id: "counterpoint",
        name: "PAP_CounterpointBot",
        category: "melody",
        midiChannel: 6,
        outputModes: ["synth", "midi"],
        description: "Finite five-voice scale counterpoint with changing register states, note-pool listening/fallback, within-beat tuplets, legacy meter messages, and source-compatible agent-off termination."
      },
      CounterpointBot
    ),
    port(
      {
        id: "ornament",
        name: "mh_OrnamentBOT",
        category: "melody",
        midiChannel: 7,
        outputModes: ["synth", "midi"],
        description: "Monophonic plucked ornament sequences using three-octave pitch-class expansion, density-sized stochastic onset lists, and change-sensitive note-pool/density ownership."
      },
      OrnamentBot
    ),
    port(
      {
        id: "msynth",
        name: "ae_MSynthBOT",
        category: "melody",
        midiChannel: 8,
        outputModes: ["synth", "midi"],
        description: "Finite-form monophonic synth using the exact shipped Metheny onset and contour corpora, phrase-plan interpretation, uneven-meter clipping, and per-appearance synth variation."
      },
      MSynthBot
    ),
    port(
      {
        id: "rsynth",
        name: "ae_RSynthBOT",
        category: "melody",
        midiChannel: 9,
        outputModes: ["synth", "midi"],
        description: "Finite-form rhythmic monophonic synth driven by the exact embedded weighted onset and pitch Markov corpora, with plan following and arbitrary-meter clipping."
      },
      RSynthBot
    ),
    port(
      {
        id: "multiSynth",
        name: "ae_MultiSynthBOT",
        category: "melody",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Four-part finite-form synth using metric onset selection, phrase density curves, independent registers, and coordinated density/form messages."
      },
      MultiSynthBot
    ),
    port(
      {
        id: "reichGuitar",
        name: "ae_ReichGuitarBOT",
        category: "melody",
        midiChannel: 11,
        outputModes: ["synth", "midi"],
        description: "Four-part process-guitar agent with source-derived neighbor-cell mutations, phase inheritance, Gaussian phrase density, sparse-voice compensation, and finite form."
      },
      ReichGuitarBot
    ),
    port(
      {
        id: "methenyMelody",
        name: "ae_MethenyMelodyBOT",
        category: "melody",
        midiChannel: 12,
        outputModes: ["synth", "midi"],
        description: "Finite-form Pat Metheny corpus melody with source onset/contour records, local corpus harmony, received-plan precedence, and current-chord note-pool publication."
      },
      MethenyMelodyBot
    ),
    port(
      {
        id: "seasonsArpy",
        name: "ae_Seasons_Arpy",
        category: "melody",
        midiChannel: 13,
        outputModes: ["synth", "midi"],
        description: "Seasons installation plucked arpeggiator following progress as phrase phase, arousal as onset probability, additive tala, and changing note pools."
      },
      SeasonsArpyBot
    ),
    port(
      {
        id: "seasonsBrokenChord",
        name: "ae_Seasons_BrokenChord",
        category: "melody",
        midiChannel: 14,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "seasonsBrokenChord",
        description: "Seasons held broken-chord agent: progress selects planned harmony, arousal selects one to four voices, and entrances are staggered within the first half of each chord."
      },
      SeasonsBrokenChordBot
    ),
    port(
      {
        id: "seasonsChord",
        name: "ae_Seasons_Chord",
        category: "melody",
        midiChannel: 15,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "seasonsChord",
        description: "Seasons bowed-chord agent following normalized chord plans with tala-derived attacks and arousal-scaled ascending voicings."
      },
      SeasonsChordBot
    ),
    port(
      {
        id: "seasonsDrone",
        name: "ae_Seasons_Drone",
        category: "melody",
        midiChannel: 16,
        outputModes: ["synth", "midi"],
        description: "Monophonic high Seasons drone anchored to the plan-common pitch class, with proportional chord spans and arousal-shortened entrances."
      },
      SeasonsDroneBot
    ),
    port(
      {
        id: "seasonsSussy",
        name: "ae_Seasons_Sussy",
        category: "melody",
        midiChannel: 16,
        outputModes: ["synth", "midi"],
        description: "Low monophonic Seasons pad reusing DroneBOT behaviour exactly three octaves below its high-register counterpart."
      },
      SeasonsSussyBot
    ),
    port(
      {
        id: "vinyl",
        name: "ae_VinylBOT",
        category: "texture-noise",
        outputModes: ["synth"],
        description: "Autonomous continuous vinyl-noise bed with rumble and sparse surface crackle; it sends and consumes no musical protocol controls."
      },
      VinylBot
    ),
    port(
      {
        id: "sweeper",
        name: "Hewitt_Sweeper_bot",
        category: "texture-noise",
        outputModes: ["synth"],
        description: "Autonomous white-noise resonant filter sweep triggered on a randomly selected bar boundary."
      },
      SweeperBot
    ),
    port(
      {
        id: "fmTexture",
        name: "k_FMBOT",
        category: "texture-noise",
        midiChannel: 9,
        outputModes: ["synth", "midi"],
        description: "Complementary FM/AM texture whose activity recedes around peers and whose timbre ramps change at phrase boundaries."
      },
      FmTextureBot
    ),
    port(
      {
        id: "tonic",
        name: "mh_TonicBOT",
        category: "texture-noise",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Microtonal whistling drone that takes activity-shaped breaks and assumes note-pool/density/activity publication after ten seconds without external control."
      },
      TonicBot
    ),
    port(
      {
        id: "wind",
        name: "mh_WindBOT",
        category: "texture-noise",
        outputModes: ["synth"],
        description: "Density-controlled layered filtered wind whose measured/estimated spectral centroid is published to the ensemble."
      },
      WindBot
    ),
    port(
      {
        id: "bleep",
        name: "mh_BleepBOT",
        category: "texture-noise",
        midiChannel: 11,
        outputModes: ["synth", "midi"],
        description: "Two-voice high-rate FM pulse texture following floating note pools, density, activity, and arousal while publishing its control state."
      },
      BleepBot
    ),
    port(
      {
        id: "whiny",
        name: "mh_WhinyBOT",
        category: "texture-noise",
        midiChannel: 12,
        outputModes: ["synth", "midi"],
        description: "Polyphonic additive cluster generator folding twenty jittered partials into one octave around a floating fundamental."
      },
      WhinyBot
    ),
    port(
      {
        id: "groan",
        name: "mh_GroanBOT",
        category: "texture-noise",
        midiChannel: 13,
        outputModes: ["synth", "midi"],
        description: "Four-voice cracked-stick physical-model texture driven by the exact weighted transposition and microtonal glide process."
      },
      GroanBot
    ),
    port(
      {
        id: "wub",
        name: "mh_WubBOT",
        category: "texture-noise",
        midiChannel: 14,
        outputModes: ["synth", "midi"],
        description: "Six-voice cracked-stick pluck network following floating note pools and publishing density, affect, centroid, and panning features."
      },
      WubBot
    ),
    port(
      {
        id: "atmosphere",
        name: "ae_AtmosphereBOT",
        category: "texture-noise",
        midiChannel: 15,
        outputModes: ["synth", "midi"],
        description: "Continuous atmospheric resonator following the lowest floating note-pool pitch; source soundscape files are absent upstream, so Web Audio supplies its excitation."
      },
      AtmosphereBot
    ),
    port(
      {
        id: "texture",
        name: "ae_TextureBOT",
        category: "texture-noise",
        midiChannel: 16,
        outputModes: ["synth", "midi"],
        description: "Eight-voice density-controlled granular texture using the exact 67-entry Bark-spectrum timbre database and floating note-pool pitches. The very large referenced SampleBank is not present upstream."
      },
      TextureBot
    ),
    port(
      {
        id: "granu",
        name: "mh_GranuBOT",
        category: "texture-noise",
        outputModes: ["synth"],
        description: "Three-voice chaotic granular slurp controlled by valence and arousal and publishing affect plus spectral centroid. It is intentionally non-pitched, so no artificial MIDI-note output is exposed."
      },
      GranuBot
    ),
    port(
      {
        id: "chichichi",
        name: "Chichichi",
        category: "texture-noise",
        outputModes: ["synth"],
        description: "Sixteen-cell supporting noise/percussion reservoir with random binary vectors and next/previous/any state transitions. Browser audio approximates its external-input delay, exciter, and ring modulation."
      },
      ChichichiBot
    ),
    port(
      {
        id: "derivations",
        name: "_derivationsBOT",
        category: "texture-noise",
        outputModes: ["synth", "samples"],
        sampleBank: "derivations",
        description: "Autonomous and input-responsive timbral-matching texture reconstructed from its shipped analysis databases, initialization preset, and 18 original rehearsal recordings."
      },
      DerivationsBot
    ),
    port(
      {
        id: "decider",
        name: "ob_DeciderMusebot",
        category: "texture-noise",
        outputModes: ["synth", "samples"],
        sampleBank: "decider",
        description: "Audio-feature-driven serialized decision network reconstructed from Java bytecode, using its actual BreathSoundEvent behavior and seven shipped breath samples."
      },
      DeciderBot
    ),
    port(
      {
        id: "blank",
        name: "blank_BOT",
        category: "template",
        midiChannel: 1,
        outputModes: ["synth", "midi"],
        description: "Minimal conforming Musebot template: publishes horizontal density and probabilistically selects floating pitches from received note pools for a triangle-wave voice."
      },
      BlankBot
    ),
    port(
      {
        id: "monitorMessages",
        name: "ae_MonitorMessagesBOT",
        category: "utility",
        outputModes: [],
        description: "Receive-only typed protocol inspector retaining bounded mc, agent, broadcast, and other message histories. It emits neither sound nor protocol messages."
      },
      MonitorMessagesBot
    ),
    port(
      {
        id: "reassignMessages",
        name: "ae_ReassignMessagesBOT",
        category: "utility",
        outputModes: [],
        description: "Silent user-configurable message transformer with source filtering, address reassignment, fixed-value replacement, and lossless argument forwarding."
      },
      ReassignMessagesBot
    ),
    port(
      {
        id: "valenceArousal",
        name: "ae_ValenceArousalBOT",
        category: "utility",
        outputModes: [],
        description: "Silent Seasons form controller broadcasting smoothed progress, valence, arousal, source-derived phrase lengths, additive tala, and synchronized meter proposals."
      },
      ValenceArousalBot
    ),
    port(
      {
        id: "midiAnalyzer",
        name: "ae_MIDIanalyzerBOT",
        category: "utility",
        outputModes: [],
        description: "Silent ten-feature MIDI stream analyzer with five-window smoothing, configurable feature-to-protocol mapping, and MPE-aware fractional pitch measurement."
      },
      MidiAnalyzerBot
    ),
    port(
      {
        id: "midiBot",
        name: "mh_MidiBOT",
        category: "utility",
        midiChannel: 1,
        outputModes: ["midi"],
        description: "Sixteen-voice conductor-reactive external-MIDI generator retaining source affect/density controls and carrying floating note pools through per-instance MPE."
      },
      MidiBot
    ),
    port(
      {
        id: "midiGuitarInput",
        name: "mh_MIDIGuitarInputBOT",
        category: "utility",
        outputModes: [],
        description: "MPE-aware guitar MIDI and microphone bridge publishing floating note pools, note-rate density, and smoothed audio activity with complete input cleanup."
      },
      MidiGuitarInputBot
    ),
    port(
      {
        id: "video",
        name: "mh_VideoBOT",
        category: "utility",
        outputModes: [],
        description: "Camera and network-reactive visual agent preserving the source fluid-video control mappings and publishing measured frame activity without generating sound."
      },
      VideoBot
    ),
    port(
      {
        id: "webBot",
        name: "mh_WebBOT",
        category: "utility",
        midiChannel: 2,
        outputModes: ["synth", "midi"],
        description: "Four-part browser-native developing-variation agent reconstructed from its shipped Index.html, with recursive ornamentation and explicitly microtonal pitch displacement."
      },
      WebBot
    ),
    port(
      {
        id: "serverBot",
        name: "ae_ServerBOT",
        category: "utility",
        outputModes: [],
        description: "Silent legacy LAN bridge policy: broadcasts pass both ways, conductor time passes master-to-slave only, loops are suppressed, and typed arguments\u2014including floating pitches\u2014remain lossless. Same-server browser peers already use the shared WebSocket room."
      },
      ServerBot
    ),
    port(
      {
        id: "templateBot",
        name: "mh_TemplateBOT",
        category: "template",
        outputModes: [],
        description: "Silent developer template retaining the source identity, self-echo filtering, typed message ingress, and off acknowledgement without inventing musical behaviour."
      },
      TemplateBot
    ),
    port(
      {
        id: "xProducer",
        name: "ae_xProducerBOT",
        category: "composition",
        outputModes: [],
        description: "Silent hierarchical x-ensemble producer generating section form, density curves, subpatterns, activation maps, initialization, progress, phrase length, and exit messages from extracted source tables."
      },
      XProducerBot
    ),
    port(
      {
        id: "xChord",
        name: "ae_xChordBOT",
        category: "harmony",
        outputModes: [],
        description: "Silent x-ensemble Metheny-corpus harmony planner with section-specific progression storage/recall, pitch probabilities, harmonic rhythm, lifecycle controls, and floating-point-safe plans."
      },
      XChordBot
    ),
    port(
      {
        id: "xDrum",
        name: "ae_xDrumBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "xDrum",
        description: "Producer-directed three-voice drum agent with source additive 2/3 tala, density-shaped onset subsets, section recall, lifecycle controls, and all 12 shipped drum samples."
      },
      XDrumBot
    ),
    port(
      {
        id: "xBass",
        name: "ae_xBassBOT",
        category: "bass",
        midiChannel: 3,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "xBass",
        description: "Producer-directed tala bass with density-shaped onset selection, weighted note-pool choice, lifecycle controls, all 58 shipped samples, and fractional pitches retained through Web Audio, sample transposition, or MPE."
      },
      XBassBot
    ),
    port(
      {
        id: "xPad",
        name: "ae_xPadBOT",
        category: "keys-pads",
        midiChannel: 5,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "xPad",
        description: "Producer-directed ascending pad whose voice count follows density, duration follows harmonic rhythm, filter follows section progress, and floating pools reach all 58 shipped samples or MPE unchanged."
      },
      XPadBot
    ),
    port(
      {
        id: "xPerc",
        name: "ae_xPercBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "xPerc",
        description: "Producer-directed three-part percussion with duple phrase generation, symbolic eight-bar subpattern reuse, A\u2013E state recall, modulated filter/delay, lifecycle controls, and nine shipped samples."
      },
      XPercBot
    ),
    port(
      {
        id: "xSequencer",
        name: "ae_xSequencerBOT",
        category: "melody",
        midiChannel: 1,
        outputModes: ["synth", "midi"],
        description: "Producer-directed 1970s eighth/sixteenth sequencer reusing arbitrary-meter pool walking, density masking, progress/lifecycle controls, five exact source synth presets, and microtonal Web Audio/MPE pitch."
      },
      XSequencerBot
    ),
    port(
      {
        id: "tangerineDream",
        name: "ae_TangerineDreamBOT",
        category: "composition",
        midiChannel: 2,
        outputModes: ["synth", "midi"],
        description: "Self-contained finite Tangerine Dream-like form integrating corpus harmony, additive tala, density-shaped part orchestration, drums, bass, melody, sequencer, and pad over arbitrary meter with unified microtonal Web Audio/MPE pitch."
      },
      TangerineDreamBot
    ),
    port(
      {
        id: "walkingBass",
        name: "ae_WalkingBassBOT",
        category: "bass",
        midiChannel: 3,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "walkingBass",
        description: "Acoustic-style walking bass reacting to harmony, tala, and density."
      },
      WalkingBassBot
    ),
    port(
      {
        id: "eBass",
        name: "ae_EBassBOT",
        category: "bass",
        midiChannel: 4,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "eBass",
        description: "Electric-style bass reacting to harmony, tala, and density."
      },
      EBassBot
    ),
    port(
      {
        id: "snapBass",
        name: "ae_SnapBassBOT",
        category: "bass",
        midiChannel: 7,
        outputModes: ["synth", "midi"],
        description: "Short, sample-inspired bass attacks derived from the most common received pitch class and aligned with tala."
      },
      SnapBassBot
    ),
    port(
      {
        id: "synthBass",
        name: "ae_SynthBassBOT",
        category: "bass",
        midiChannel: 8,
        outputModes: ["synth", "midi"],
        description: "Tala-aligned synth bass using the first received pitch class, density-shaped onsets, and an extracted velocity contour."
      },
      SynthBassBot
    ),
    port(
      {
        id: "splatterBass",
        name: "ybot_splatterBOT",
        category: "bass",
        midiChannel: 9,
        outputModes: ["synth", "midi"],
        description: "Acid bass that proposes complementary 16-step activity intentions and shares pitch-class pools for the next phrase."
      },
      SplatterBassBot
    ),
    port(
      {
        id: "rhodes",
        name: "ae_RhodesBOT",
        category: "keys-pads",
        midiChannel: 5,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "rhodes",
        description: "Rhodes-style keyboard voicings aligned with tala and density."
      },
      RhodesBot
    ),
    port(
      {
        id: "beat",
        name: "ae_BeatBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "beat",
        description: "Form-generating drums and percussion built from additive 2/3 tala."
      },
      ElectronicBeatBot
    ),
    port(
      {
        id: "jazzBeat",
        name: "ae_JazzBeatBOT",
        category: "beat",
        midiChannel: 11,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "jazzBeat",
        description: "Form-generating jazz-brush patterns built from additive tala."
      },
      JazzBeatBot
    ),
    port(
      {
        id: "cleanBeat",
        name: "ae_CleanBeatBOT",
        category: "beat",
        midiChannel: 12,
        outputModes: ["synth", "midi"],
        description: "Form-generating clean drums plus four percussion layers, with source-derived additive tala, phrase, density, and activation data."
      },
      CleanBeatBot
    ),
    port(
      {
        id: "clumpyBeat",
        name: "ae_ClumpyBeatBOT",
        category: "beat",
        midiChannel: 13,
        outputModes: ["synth", "midi"],
        description: "Five-part beat agent whose onsets expand progressively away from additive-tala downbeats as density rises."
      },
      ClumpyBeatBot
    ),
    port(
      {
        id: "noiseBeat",
        name: "ae_NoiseBeatBOT",
        category: "beat",
        midiChannel: 14,
        outputModes: ["synth", "midi"],
        description: "CleanBeat-family form and additive tala rendered with synthesized resonant noise drums and four noise-percussion layers."
      },
      NoiseBeatBot
    ),
    port(
      {
        id: "newBeat",
        name: "ae_newBeatBOT",
        category: "beat",
        midiChannel: 15,
        outputModes: ["synth", "midi"],
        description: "Four-bar drum and percussion agent that coordinates additive-sixteenth tala, repetition, and residual ensemble-activity intentions."
      },
      NewBeatBot
    ),
    port(
      {
        id: "houseBeat",
        name: "ae_HouseBeatBOT",
        category: "beat",
        midiChannel: 16,
        outputModes: ["synth", "midi"],
        description: "Eight-bar four-voice house patterns selected from the source 1,194-pattern corpus, with section generation and exact recall."
      },
      HouseBeatBot
    ),
    port(
      {
        id: "perc",
        name: "ae_PercBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Three independent phrase-wide duple percussion layers with density masking, filter motion, amplitude walks, and beat-synchronized delay."
      },
      PercBot
    ),
    port(
      {
        id: "papPerc",
        name: "PAP_PercBot",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Probability-table percussion synth that follows ensemble density and takes bounded local density ownership after four silent bars."
      },
      PapPercBot
    ),
    port(
      {
        id: "mhBeat",
        name: "mh_BeatBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Three-contour drum sequencer whose busyness follows density \xD7 \u221Aactivity and whose activity-dependent breaks retain the source timing equations."
      },
      MhBeatBot
    ),
    port(
      {
        id: "mhBeatsynth",
        name: "mh_BeatsynthBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Sparse bar-sequenced bass, snare, and metallic cymbal synthesizer with change-sensitive density fallback ownership."
      },
      MhBeatsynthBot
    ),
    port(
      {
        id: "sampleBeat",
        name: "ae_SampleBeatBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Machine-loop monitor resonated at a pitch class selected from changing note pools, retaining source loop-duration and resonator-preset data."
      },
      SampleBeatBot
    ),
    port(
      {
        id: "autechre",
        name: "ae_AutechreBOT",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "midi"],
        description: "Self-forming processed drum agent with regenerated additive patterns, nonlinear density curves, and independently scheduled odd subdivisions."
      },
      AutechreBot
    ),
    port(
      {
        id: "prockRock",
        name: "ob_prockRockBeadsBot",
        category: "beat",
        midiChannel: 10,
        outputModes: ["synth", "samples", "midi"],
        sampleBank: "prockRock",
        prockRockMidiNotes: STOCHASTIC_CONFIG.prockRock.midiNotes,
        description: "Java intention-sharing drum agent with delayed phrase planning and its original deterministic 96-sample drum-bead bank."
      },
      ProckRockBeadsBot
    ),
    port(
      {
        id: "rungler",
        name: "ae_RunglerBOT",
        category: "texture",
        midiChannel: 6,
        outputModes: ["synth", "midi"],
        description: "Unstable rungler-inspired synth controlled by valence and arousal."
      },
      RunglerBot
    ),
    port(
      {
        id: "analyzer",
        name: "ae_AudioAnalyzerBOT",
        category: "utility",
        outputModes: [],
        description: "Microphone feature analysis broadcast as ensemble messages."
      },
      AudioAnalyzerBot
    ),
    defineBot(
      {
        id: "effects",
        name: "ae_effectsBOT",
        status: "native",
        source: "web-suite",
        category: "utility",
        outputModes: ["synth"],
        pitchContract: "none",
        description: "Control-reactive effects monitor; cross-window audio routing is not yet implemented."
      },
      (...args) => new EffectsBot(...args)
    ),
    defineBot(
      {
        id: "memory",
        name: "mh_MemoryBOT",
        status: "native",
        source: "web-suite-extension",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        planningCapabilities: { motif: true },
        description: "Message-only ensemble memory storing emergent motifs and answering bounded direct queries from other agents."
      },
      (...args) => new MemoryBot(...args)
    ),
    defineBot(
      {
        id: "harmonyPulse",
        name: "mh_HarmonyPulseBOT",
        status: "native",
        source: "web-suite-extension",
        category: "harmony",
        midiChannel: 1,
        performanceType: "polyphonic",
        outputModes: ["synth", "midi"],
        pitchContract: "floating-mpe",
        description: "Curated harmony agent with bounded chord holds, regular but varied harmonic rhythm, and parsimonious voice leading."
      },
      (...args) => new HarmonyPulseBot(...args)
    ),
    defineBot(
      {
        id: "contour",
        name: "mh_ContourBOT",
        status: "native",
        source: "web-suite-extension",
        category: "melody",
        midiChannel: 2,
        performanceType: "monophonic",
        outputModes: ["synth", "midi"],
        pitchContract: "floating-mpe",
        description: "Offbeat-responsive melody agent that bounds repeated notes, balances contour, and publishes developed motifs in advance."
      },
      (...args) => new ContourBot(...args)
    ),
    defineBot(
      {
        id: "space",
        name: "mh_SpaceBOT",
        status: "native",
        source: "web-suite-extension",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        planningCapabilities: { orchestration: true },
        description: "Message-only ensemble listener assigning complementary density, phase, and anchor/support/response roles each phrase."
      },
      (...args) => new SpaceBot(...args)
    ),
    defineBot(
      {
        id: "plex",
        name: "mh_PlexBOT",
        status: "native",
        source: "web-suite",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        description: "Message-only form agent proposing complex signatures, independent talas, phrase structures, densities, and rhythmic cycles."
      },
      (...args) => new PlexBot(...args)
    ),
    defineBot(
      {
        id: "form",
        name: "mh_FormBOT",
        status: "native",
        source: "web-suite",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        description: "Message-only duration and ending agent: proposes a finite tension-shaped form, polls readiness, and commits the ensemble\u2019s logical stopping point at a phrase boundary."
      },
      (...args) => new FormBot(...args)
    ),
    defineBot(
      {
        id: "tune",
        name: "mh_TuneBOT",
        status: "native",
        source: "web-suite",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        planningCapabilities: { harmony: true },
        description: "Optional message-only tuning agent offering continuous floating-point tuning systems and voice-leading-aware chord-wise just intonation. Existing bots retain ordinary tuning when it is absent."
      },
      (...args) => new TuneBot(...args)
    ),
    defineBot(
      {
        id: "coord",
        name: "mh_CoordBOT",
        status: "native",
        source: "web-suite",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        description: "Optional mix coordinator assigning sounding agents continuous foreground, support, and background placements at phrase boundaries."
      },
      (...args) => new CoordBot(...args)
    ),
    defineBot(
      {
        id: "manage",
        name: "mh_ManageBOT",
        status: "native",
        source: "web-suite",
        category: "conductor",
        outputModes: [],
        pitchContract: "none",
        description: "Optional ensemble manager loading and starting performers, rotating entries and exits, and coordinating graceful departures around an accepted form."
      },
      (...args) => new ManageBot(...args)
    )
  ]);
  var AGENTS = BOT_REGISTRY.object();

  // public/timing.js
  var BufferedClock = class {
    constructor(lookahead = 0.25) {
      this.lookahead = lookahead;
      this.reset();
    }
    reset() {
      this.anchorTick = null;
      this.anchorTime = 0;
      this.lastTick = null;
      this.lastInterval = null;
    }
    timeFor(tick, bpm, now, subdivision = 4) {
      const interval = 60 / bpm / subdivision;
      const rateChanged = this.lastInterval !== null && Math.abs(interval - this.lastInterval) > 1e-9;
      if (this.anchorTick === null || rateChanged || tick <= this.lastTick || tick - this.lastTick > 8) {
        this.anchorTick = tick;
        this.anchorTime = now + this.lookahead;
      }
      let target = this.anchorTime + (tick - this.anchorTick) * interval;
      if (target < now + 0.035) {
        this.anchorTick = tick;
        this.anchorTime = now + this.lookahead;
        target = this.anchorTime;
      }
      this.lastTick = tick;
      this.lastInterval = interval;
      return target;
    }
  };

  // public/audio.js
  var midiHz = (note) => 440 * 2 ** ((note - 69) / 12);
  var hzMidi = (hz) => 69 + 12 * Math.log2(Math.max(1e-3, hz) / 440);
  var noteNames = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11
  };
  var midiRoutes = new MidiRouteRegistry();
  var nextMidiRoute = 1;
  var AudioEngine = class {
    constructor({ clientOnly = false, context = null } = {}) {
      this.clientOnly = clientOnly;
      this.ctx = context;
      this.mpeEnabled = true;
      this.mpeBendRange = 48;
      this.mpeZone = "lower";
      this.mpeAllocator = new MpeChannelAllocator();
      this.midiRouteId = `audio-${nextMidiRoute++}`;
    }
    async start(resume = true) {
      this.ctx || (this.ctx = new AudioContext({ latencyHint: "interactive" }));
      this.clock || (this.clock = new BufferedClock());
      this.buffers || (this.buffers = /* @__PURE__ */ new Map());
      if (resume && !this.master) {
        this.master = this.ctx.createGain();
        this.limiter = this.ctx.createDynamicsCompressor();
        this.spatialFilter = this.ctx.createBiquadFilter();
        this.spatialGain = this.ctx.createGain();
        this.master.gain.value = this.pendingPerformanceGain ?? 4;
        this.spatialGain.gain.value = this.pendingSpatialGain ?? 1;
        this.spatialFilter.type = "lowpass";
        this.spatialFilter.frequency.value = this.pendingSpatialCutoff ?? 18e3;
        this.spatialFilter.Q.value = 0.55;
        this.limiter.threshold.value = -8;
        this.limiter.knee.value = 8;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 3e-3;
        this.limiter.release.value = 0.18;
        this.master.connect(this.limiter).connect(this.spatialFilter).connect(this.spatialGain).connect(this.ctx.destination);
      }
      if (resume && this.ctx.state !== "running") {
        const resumed = this.ctx.resume();
        await Promise.race([
          resumed,
          new Promise(
            (_, reject) => setTimeout(
              () => reject(new Error("Browser audio did not start within 2 seconds")),
              2e3
            )
          )
        ]);
      }
      this.muted = false;
      this.report("audio_context", {
        state: this.ctx.state,
        sampleRate: this.ctx.sampleRate
      });
      if (resume && this.ctx.state !== "running")
        throw new Error(
          `Browser audio is ${this.ctx.state}; allow audio autoplay for this page and try again`
        );
    }
    async configure(definition, mode = "synth", midiOutputId = "") {
      this.definition = definition;
      this.mode = mode;
      this.expressionProfile = EXPRESSION_CONFIG.categoryProfiles[definition.category] || "neutral";
      this.defaultMidiChannel = definition.midiChannel ? definition.midiChannel - 1 : null;
      this.sampleFiles = [];
      if (mode === "samples" && definition.sampleBank)
        await this.loadSampleBank(definition.sampleBank);
      if (mode === "midi") await this.configureMidi(midiOutputId);
    }
    async loadSampleBank(bank) {
      let manifest;
      if (this.clientOnly) {
        throw new Error(
          "Original samples are disabled in the standalone demonstration"
        );
      } else {
        const response = await fetch(`/api/samples/${encodeURIComponent(bank)}`);
        if (!response.ok)
          throw new Error(
            `Sample bank ${bank} is unavailable (${response.status})`
          );
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json"))
          throw new Error(`Sample bank ${bank} returned an invalid response`);
        manifest = await response.json();
        if (!Array.isArray(manifest.files))
          throw new Error(`Sample bank ${bank} has an invalid manifest`);
        this.sampleBase = `/samples/${encodeURIComponent(bank)}`;
      }
      this.sampleBank = bank;
      this.sampleFiles = manifest.files;
      await Promise.all(
        manifest.files.map((file) => this.loadBuffer(bank, file))
      );
    }
    async loadBuffer(bank, file) {
      const key = `${bank}/${file}`;
      if (this.buffers.has(key)) return this.buffers.get(key);
      const url = `${this.sampleBase}/${file.split("/").map(encodeURIComponent).join("/")}?format=wav1`, promise = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Sample load failed: ${file}`);
        return r.arrayBuffer();
      }).then((data) => this.ctx.decodeAudioData(data));
      this.buffers.set(key, promise);
      return promise;
    }
    async midiOutputs() {
      if (this.clientOnly) {
        if (!navigator.requestMIDIAccess)
          throw new Error("This browser does not support Web MIDI");
        this.midiAccess || (this.midiAccess = await navigator.requestMIDIAccess({ sysex: false }));
        return [...this.midiAccess.outputs.values()].map((output) => ({
          id: output.id,
          name: output.name || output.id,
          manufacturer: output.manufacturer || "Web MIDI",
          state: output.state,
          connection: output.connection
        }));
      }
      const response = await fetch("/api/midi/outputs"), { outputs } = await response.json();
      return outputs.map((name) => ({
        id: name,
        name,
        manufacturer: "Musebots server / native MIDI",
        state: "connected",
        connection: "open"
      }));
    }
    async configureMidi(outputId = "") {
      midiRoutes.release(this.midiRouteId);
      const outputs = await this.midiOutputs();
      this.midiOutput = outputs.find((output) => output.id === outputId) || outputs[0];
      if (!this.midiOutput) throw new Error("No MIDI output is available");
      if (this.clientOnly) {
        const native = this.midiAccess.outputs.get(this.midiOutput.id);
        this.midiOutput.send = (bytes, time = performance.now()) => native.send(bytes, time);
        return;
      }
      if (!this.midiSocket || this.midiSocket.readyState > 1) {
        this.midiSocket = new WebSocket(
          `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ensemble`
        );
        await new Promise((resolve, reject) => {
          this.midiSocket.addEventListener("open", resolve, { once: true });
          this.midiSocket.addEventListener(
            "error",
            () => reject(new Error("Could not connect to the server MIDI bridge")),
            { once: true }
          );
        });
      }
      this.midiOutput.send = (bytes, time = performance.now()) => {
        const delay = Math.max(0, time - performance.now()), send = () => {
          if (this.midiSocket?.readyState === WebSocket.OPEN)
            this.midiSocket.send(
              JSON.stringify({
                type: "midi",
                port: this.midiOutput.name,
                bytes
              })
            );
        };
        delay ? setTimeout(send, delay) : send();
      };
    }
    configureMpe({ enabled = true, zone = "lower", bendRange = 48 } = {}) {
      this.mpeEnabled = enabled !== false;
      this.mpeZone = zone;
      this.mpeBendRange = Math.max(0.01, Math.min(96, Number(bendRange) || 48));
      const channels = zone === "upper" ? Array.from({ length: 15 }, (_, index) => 14 - index) : zone === "single" ? [this.midiChannelOverride ?? this.defaultMidiChannel ?? 0] : Array.from({ length: 15 }, (_, index) => index + 1);
      this.mpeAllocator.setChannels(channels);
      if (this.midiOutput) {
        const collisions = midiRoutes.claim(
          this.midiRouteId,
          this.midiOutput.id || this.midiOutput.name,
          channels
        );
        if (collisions.length)
          this.report("midi_route_collision", {
            port: this.midiOutput.name,
            zone,
            channels,
            collisions
          });
      }
      if (this.midiOutput) {
        if (this.mpeEnabled) {
          for (const bytes of mpeZoneMessages(zone, channels.length))
            this.sendMidi(bytes);
          const manager = zone === "upper" ? 15 : 0;
          for (const bytes of bendRangeMessages(manager, 2))
            this.sendMidi(bytes);
        }
        for (const channel of channels)
          for (const bytes of bendRangeMessages(channel, this.mpeBendRange))
            this.sendMidi(bytes);
      }
    }
    sendMidi(bytes, time = globalThis.performance?.now?.() ?? 0, details = {}) {
      if (!this.midiOutput) return;
      this.onMidiRaw?.({
        bytes: [...bytes],
        scheduledAt: Number(time),
        port: this.midiOutput.name || this.midiOutput.id || null,
        bendRange: this.mpeBendRange,
        ...details
      });
      this.midiOutput.send(bytes, time);
    }
    panicMidi() {
      if (!this.midiOutput) return;
      for (let channel = 0; channel < 16; channel++) {
        this.sendMidi([176 + channel, 64, 0]);
        this.sendMidi([176 + channel, 120, 0]);
        this.sendMidi([176 + channel, 123, 0]);
        this.sendMidi([224 + channel, 0, 64]);
      }
      this.mpeAllocator.setChannels(this.mpeAllocator.channels);
    }
    midiDamper(duration = 0.5, channel = null, offset = 0) {
      if (this.muted || !this.midiOutput) return;
      const seconds = Math.max(0.03, Math.min(8, Number(duration) || 0.5)), at = globalThis.performance.now() + Math.max(0, (this.eventStart(offset) - this.ctx.currentTime) * 1e3), channels = channel != null ? [Math.max(0, Math.min(15, Number(channel) || 0))] : this.mpeEnabled && this.mpeZone !== "single" ? [this.mpeZone === "upper" ? 15 : 0] : [this.midiChannelOverride ?? this.defaultMidiChannel ?? 0];
      for (const target of channels) {
        this.sendMidi([176 + target, 64, 127], at, {
          expression: { damper: "down", duration: seconds }
        });
        this.sendMidi([176 + target, 64, 0], at + seconds * 1e3, {
          expression: { damper: "up", duration: seconds }
        });
      }
    }
    releaseMidiRoute() {
      midiRoutes.release(this.midiRouteId);
    }
    setMidiChannel(value) {
      this.midiChannelOverride = value === "default" || value === "" ? null : Math.max(0, Math.min(15, Number(value) - 1));
    }
    testMidi() {
      if (!this.midiOutput)
        throw new Error("Select and open a MIDI output first");
      const channel = this.midiChannelOverride ?? this.defaultMidiChannel ?? 0, at = performance.now() + 20;
      this.sendMidi([144 + channel, 60, 100], at, { test: true });
      this.sendMidi([128 + channel, 60, 0], at + 1500, { test: true });
      return {
        port: this.midiOutput.name,
        note: 60,
        channel: channel + 1,
        velocity: 100
      };
    }
    setPerformanceClock(clock = {}) {
      this.currentClock = clock;
      this.velocityGain = this.performanceVelocity(1);
    }
    setMixPlacement(value = 0) {
      this.mixPlacement = Math.max(-1, Math.min(1, Number(value) || 0));
    }
    performanceVelocity(value) {
      return placedVelocity(metricalVelocity(value, this.currentClock), this.mixPlacement || 0);
    }
    beginTick(tick, bpm, subdivision = 4, clock = {}) {
      this.setPerformanceClock({ ...clock, tick, bpm });
      this.eventTime = this.clock.timeFor(
        tick,
        bpm,
        this.ctx.currentTime,
        subdivision
      );
      return Math.max(0, this.eventTime - this.ctx.currentTime);
    }
    toggle() {
      this.muted = !this.muted;
      return this.muted;
    }
    setPerformanceGain(value, duration = 0) {
      const target = Math.max(0, Math.min(4, Number(value)));
      this.pendingPerformanceGain = target;
      if (!this.master) return;
      const now = this.ctx.currentTime, seconds = Math.max(0, Number(duration) || 0), gain = this.master.gain;
      if (typeof gain.cancelAndHoldAtTime === "function")
        gain.cancelAndHoldAtTime(now);
      else {
        const held = gain.value;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(held, now);
      }
      if (seconds > 0)
        gain.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
      else gain.setValueAtTime(target, now);
    }
    setSpatialGain(value, duration = 0.12) {
      const target = Math.max(0, Math.min(1, Number(value)));
      this.pendingSpatialGain = target;
      if (!this.spatialGain || !this.ctx) return;
      const gain = this.spatialGain.gain, now = this.ctx.currentTime, seconds = Math.max(0, Number(duration) || 0);
      if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
      else {
        const held = gain.value;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(held, now);
      }
      if (seconds) gain.linearRampToValueAtTime(target, now + seconds);
      else gain.setValueAtTime(target, now);
    }
    setSpatialAttenuation({ gain = 1, cutoffHz = 18e3, q = 0.55 } = {}, duration = 0.14) {
      this.setSpatialGain(gain, duration);
      const cutoff = Math.max(40, Math.min(this.ctx?.sampleRate ? this.ctx.sampleRate * 0.45 : 2e4, Number(cutoffHz) || 18e3));
      this.pendingSpatialCutoff = cutoff;
      if (!this.spatialFilter || !this.ctx) return;
      const now = this.ctx.currentTime, seconds = Math.max(0, Number(duration) || 0), frequency = this.spatialFilter.frequency;
      frequency.cancelScheduledValues(now);
      frequency.setValueAtTime(Math.max(40, frequency.value), now);
      if (seconds) frequency.exponentialRampToValueAtTime(cutoff, now + seconds);
      else frequency.setValueAtTime(cutoff, now);
      this.spatialFilter.Q.setTargetAtTime(Math.max(0.01, Number(q) || 0.55), now, 0.02);
    }
    lifecycle(action, payload = {}) {
      this.onLifecycle?.(action, payload);
    }
    report(kind, details = {}) {
      if (Number.isFinite(Number(details.velocity)) && kind !== "expressive_note")
        details = { ...details, velocity: this.performanceVelocity(details.velocity) };
      this.onAudioEvent?.({
        kind,
        ...details,
        contextState: this.ctx?.state,
        mode: this.mode
      });
    }
    setTuningPlan(payload = null) {
      this.tuningPayload = payload ? validateTuningPayload(payload) : null;
      this.tuningChordIndex = 0;
      this.report("tuning_plan", {
        active: Boolean(this.tuningPayload),
        planId: this.tuningPayload?.planId || null
      });
    }
    setTuningPosition(clock = {}) {
      if (!this.tuningPayload?.durations?.length) return;
      const meter = clock.meter || {}, beatsPerBar = (meter.numerator || 4) * 4 / (meter.denominator || 4), start = this.tuningPayload.appliesAt?.bar || 0, position = Math.max(
        0,
        ((clock.bar || 0) - start) * beatsPerBar + (clock.beat || 0) * 4 / (meter.denominator || 4)
      ), total = this.tuningPayload.durations.reduce(
        (sum, value) => sum + value,
        0
      ), phase = total ? position % total : 0;
      let cumulative = 0;
      this.tuningChordIndex = this.tuningPayload.durations.findIndex(
        (duration) => (cumulative += duration) > phase
      );
      if (this.tuningChordIndex < 0) this.tuningChordIndex = 0;
    }
    tunePitch(note) {
      return this.tuningPayload ? applyTuningSystem(note, this.tuningPayload, this.tuningChordIndex) : note;
    }
    eventStart(offset = 0) {
      return Math.max(
        this.ctx.currentTime + 5e-3,
        (this.eventTime || this.ctx.currentTime) + offset
      );
    }
    voice(note, duration, gain, type = "sine", offset = 0, expression = {}) {
      if (!this.ctx || this.muted || !this.master) return;
      const nominalNote = note, web = EXPRESSION_CONFIG.webAudio;
      note = this.tunePitch(note);
      const sourceVelocity = Number.isFinite(Number(expression.velocity)) ? Number(expression.velocity) : Math.min(1, Math.sqrt(Math.max(0, gain) / 0.16)), performedVelocity = this.performanceVelocity(sourceVelocity), performance2 = expressivePerformance({
        note,
        duration,
        profile: this.expressionProfile || "neutral",
        ...expression,
        velocity: performedVelocity
      }), now = this.eventStart(offset), osc = this.ctx.createOscillator(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain(), pressure = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lfoDepth = this.ctx.createGain(), releaseStart = Math.max(
        now + performance2.attackSeconds,
        now + duration - performance2.releaseSeconds
      ), safeGain = Math.max(
        1e-4,
        gain * Math.sqrt(performedVelocity / Math.max(0.04, sourceVelocity))
      );
      osc.type = type;
      osc.frequency.value = midiHz(note);
      filter.type = "lowpass";
      filter.Q.value = type === "sawtooth" || type === "square" ? web.brightWaveQ : web.softWaveQ;
      const cutoff = performance2.slideCurve.map(
        (value) => Math.min(
          this.ctx.sampleRate * 0.42,
          web.filterBaseHz + midiHz(note) * (web.filterFundamentalFloor + value * web.filterExpressionRange)
        )
      );
      filter.frequency.setValueCurveAtTime(
        new Float32Array(cutoff),
        now,
        Math.max(0.02, duration)
      );
      amp.gain.setValueAtTime(1e-4, now);
      amp.gain.exponentialRampToValueAtTime(
        safeGain,
        now + performance2.attackSeconds
      );
      amp.gain.setValueAtTime(safeGain, releaseStart);
      amp.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      pressure.gain.setValueCurveAtTime(
        new Float32Array(
          performance2.pressureCurve.map(
            (value) => web.gainPressureFloor + web.gainPressureScale * value
          )
        ),
        now,
        Math.max(0.02, duration)
      );
      osc.detune.setValueCurveAtTime(
        new Float32Array(performance2.pitchCurve.map((value) => value * 100)),
        now,
        Math.max(0.02, duration)
      );
      lfo.frequency.value = performance2.vibratoRate;
      lfoDepth.gain.value = performance2.vibratoDepth * 100;
      lfo.connect(lfoDepth).connect(osc.detune);
      osc.connect(filter).connect(amp).connect(pressure).connect(this.master);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + duration + 0.03);
      lfo.stop(now + duration + 0.03);
      this.report("rendered_pitch", {
        nominalNote,
        note,
        deviationCents: (note - nominalNote) * 100,
        duration
      });
      this.report("expressive_note", {
        note,
        duration,
        profile: performance2.profile,
        velocity: performance2.velocity,
        pressure: performance2.pressure,
        slide: performance2.slide,
        vibratoDepth: performance2.vibratoDepth,
        sustained: performance2.sustained
      });
    }
    noise(duration, gain, filterHz = 6e3, offset = 0) {
      if (!this.ctx || this.muted) return;
      gain *= this.velocityGain || 1;
      const length = Math.ceil(this.ctx.sampleRate * duration), buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain(), now = this.eventStart(offset);
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = filterHz;
      const attack = duration >= 0.3 ? Math.min(0.02, duration * 0.02) : Math.min(3e-3, duration * 0.12), release = duration >= 0.3 ? Math.min(0.08, duration * 0.08) : Math.min(8e-3, duration * 0.2), releaseStart = Math.max(now + attack, now + duration - release);
      amp.gain.setValueAtTime(1e-4, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), now + attack);
      amp.gain.setValueAtTime(Math.max(1e-4, gain), releaseStart);
      amp.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      source.connect(filter).connect(amp).connect(this.master);
      source.start(now);
    }
    expressiveMidiCurve(channel, note, duration, at, performance2) {
      if (!performance2.sustained) return;
      for (const event of expressionCurveEvents(
        performance2,
        duration,
        Math.min(16, Math.max(4, Math.ceil(duration * 4)))
      )) {
        const time = at + event.at * 1e3, encoded = mpePitch(note + event.pitch, this.mpeBendRange);
        this.sendMidi([224 + (channel & 15), encoded.lsb, encoded.msb], time);
        this.sendMidi(
          [176 + (channel & 15), 74, normalizedMidi7(event.slide)],
          time
        );
        this.sendMidi(
          [208 + (channel & 15), normalizedMidi7(event.pressure)],
          time
        );
      }
    }
    midiNote(note, duration = 0.25, velocity = 0.7, channel = 0, offset = 0, expression = {}) {
      if (this.muted || !this.midiOutput) return;
      velocity = this.performanceVelocity(velocity);
      const nominalNote = note;
      note = this.tunePitch(note);
      const performance2 = expressivePerformance({
        note,
        duration,
        velocity,
        profile: this.expressionProfile || "neutral",
        ...expression
      }), delay = Math.max(
        0,
        (this.eventStart(offset) - this.ctx.currentTime) * 1e3
      ), at = globalThis.performance.now() + delay, offAt = at + duration * 1e3, midiVelocity = Math.max(1, normalizedMidi7(performance2.velocity)), releaseVelocity = normalizedMidi7(performance2.releaseVelocity);
      this.report("rendered_pitch", {
        nominalNote,
        note,
        deviationCents: (note - nominalNote) * 100,
        duration
      });
      if (this.mpeEnabled && this.mpeZone !== "single") {
        channel = this.mpeAllocator.acquire(offAt + 2, at);
        if (channel == null) {
          this.report("mpe_voice_limit", {
            pitch: note,
            limit: this.mpeAllocator.channels.length
          });
          return;
        }
        const encoded2 = mpePitch(note, this.mpeBendRange), on = [144 + (channel & 15), encoded2.note, midiVelocity], off2 = [128 + (channel & 15), encoded2.note, releaseVelocity];
        this.sendMidi([224 + (channel & 15), encoded2.lsb, encoded2.msb], at);
        for (const bytes of mpeExpressionMessages(channel, performance2))
          this.sendMidi(bytes, at + 0.25);
        this.sendMidi(on, at + 0.5, { expression: performance2 });
        this.expressiveMidiCurve(channel, note, duration, at, performance2);
        this.sendMidi(off2, offAt);
        this.sendMidi([208 + (channel & 15), 0], offAt + 0.5);
        this.sendMidi([176 + (channel & 15), 74, 64], offAt + 0.75);
        this.sendMidi([224 + (channel & 15), 0, 64], offAt + 1);
        if (typeof setTimeout === "function")
          setTimeout(
            () => this.mpeAllocator.release(channel),
            Math.max(0, offAt - globalThis.performance.now() + 2)
          );
        this.onMidiSend?.({
          port: this.midiOutput.name,
          bytes: on,
          at,
          pitch: encoded2.pitch,
          bend: encoded2.bend,
          channel: channel + 1,
          mpe: true,
          expression: performance2
        });
        return;
      }
      channel = this.midiChannelOverride ?? this.defaultMidiChannel ?? channel;
      if (this.definition?.pitchContract === "fixed-percussion") {
        const drumNote = Math.max(0, Math.min(127, Math.round(note))), status2 = 144 + (channel & 15), off2 = 128 + (channel & 15);
        this.sendMidi([status2, drumNote, midiVelocity], at, {
          expression: performance2
        });
        this.sendMidi([off2, drumNote, releaseVelocity], offAt);
        this.onMidiSend?.({
          port: this.midiOutput.name,
          bytes: [status2, drumNote, midiVelocity],
          at,
          pitch: drumNote,
          bend: null,
          channel: channel + 1,
          mpe: false,
          expression: performance2
        });
        return;
      }
      const encoded = mpePitch(note, this.mpeBendRange), status = 144 + (channel & 15), off = 128 + (channel & 15);
      this.sendMidi([224 + (channel & 15), encoded.lsb, encoded.msb], at);
      for (const bytes of mpeExpressionMessages(channel, performance2))
        this.sendMidi(bytes, at + 0.25);
      this.sendMidi([status, encoded.note, midiVelocity], at + 0.5, {
        expression: performance2
      });
      this.expressiveMidiCurve(channel, note, duration, at, performance2);
      this.sendMidi([off, encoded.note, releaseVelocity], offAt);
      this.sendMidi([208 + (channel & 15), 0], offAt + 0.5);
      this.sendMidi([176 + (channel & 15), 74, 64], offAt + 0.75);
      this.sendMidi([224 + (channel & 15), 0, 64], offAt + 1);
      this.onMidiSend?.({
        port: this.midiOutput.name,
        bytes: [status, encoded.note, midiVelocity],
        at,
        pitch: encoded.pitch,
        bend: encoded.bend,
        channel: channel + 1,
        mpe: false,
        expression: performance2
      });
    }
    sampleFile(file, rate = 1, gain = 0.7, offset = 0, duration = 0) {
      if (this.muted || !file) return;
      const promise = this.buffers.get(`${this.sampleBank}/${file}`);
      if (!promise) return;
      promise.then((buffer) => {
        const source = this.ctx.createBufferSource(), amp = this.ctx.createGain(), start = this.eventStart(offset);
        source.buffer = buffer;
        source.playbackRate.value = rate;
        if (duration >= 0.3) {
          const attack = Math.min(6e-3, duration * 0.02), release = Math.min(0.03, duration * 0.08);
          amp.gain.setValueAtTime(1e-4, start);
          amp.gain.exponentialRampToValueAtTime(
            Math.max(1e-4, gain),
            start + attack
          );
          amp.gain.setValueAtTime(
            Math.max(1e-4, gain),
            Math.max(start + attack, start + duration - release)
          );
        } else amp.gain.setValueAtTime(gain, start);
        if (duration > 0)
          amp.gain.exponentialRampToValueAtTime(1e-4, start + duration);
        source.connect(amp).connect(this.master);
        source.start(start);
        if (duration > 0) source.stop(start + duration + 0.03);
      });
    }
    randomFile(pattern) {
      const choices = this.sampleFiles.filter((file) => pattern.test(file));
      return choices[Math.floor(random() * choices.length)];
    }
    samplePitch(note, offset = 0, gain = 0.65, duration = 0) {
      const nominalNote = note;
      note = this.tunePitch(note);
      this.report("rendered_pitch", {
        nominalNote,
        note,
        deviationCents: (note - nominalNote) * 100,
        duration
      });
      const candidates = this.sampleFiles.map((file) => {
        const match = file.match(/(?:^|[\s_-])([A-G](?:b|#)?)(-?\d)(?=\.|\s)/i);
        if (!match) return null;
        const name = match[1][0].toUpperCase() + match[1].slice(1), midi = (Number(match[2]) + 1) * 12 + noteNames[name];
        return { file, midi };
      }).filter(Boolean);
      if (!candidates.length) return;
      const nearest = candidates.reduce(
        (a, b) => Math.abs(b.midi - note) < Math.abs(a.midi - note) ? b : a
      );
      this.sampleFile(
        nearest.file,
        2 ** ((note - nearest.midi) / 12),
        gain,
        offset,
        duration
      );
    }
    pitched(note, duration, gain, type, profile = "neutral", velocity = null) {
      const musicalVelocity = Math.max(
        0,
        Math.min(1, velocity ?? Math.sqrt(Math.max(0, gain) / 0.16))
      );
      this.report("pitched", {
        note,
        duration,
        gain,
        velocity: musicalVelocity,
        profile
      });
      if (this.mode === "midi")
        this.midiNote(note, duration, musicalVelocity, void 0, 0, { profile });
      else if (this.mode === "samples")
        this.samplePitch(note, 0, 0.25 + 0.45 * musicalVelocity, duration);
      else
        this.voice(note, duration, gain, type, 0, {
          profile,
          velocity: musicalVelocity
        });
    }
    expressiveAcidBass(note, duration, velocity, filterValue) {
      const slide = Math.max(0.08, Math.min(0.9, Number(filterValue) / 127)), expression = {
        pressure: 0.3 + 0.55 * Math.max(0, Math.min(1, velocity)),
        slide,
        slideCurve: [
          Math.min(1, slide + 0.16),
          slide,
          Math.max(0.05, slide - 0.22)
        ],
        pitchCurve: [0, 0.012, -8e-3, 0],
        vibratoDepth: 0.025
      };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, 0, 0, expression);
        return;
      }
      this.voice(
        note,
        duration,
        0.035 + 0.05 * velocity,
        "sawtooth",
        0,
        expression
      );
      this.voice(
        note - 12,
        duration * 0.86,
        8e-3 + 0.012 * velocity,
        "sine",
        4e-3,
        {
          ...expression,
          slide: Math.max(0.08, slide * 0.55),
          vibratoDepth: 0.012
        }
      );
    }
    acidBass(...args) {
      return this.expressiveAcidBass(...args);
    }
    percussion(note, pattern, synth, velocity = 0.75, duration = 0.1) {
      velocity = Math.max(0, Math.min(1, velocity));
      this.report("percussion", { note, velocity, duration });
      if (this.mode === "midi")
        this.midiNote(note, duration, velocity, 9, 0, { profile: "pluck" });
      else if (this.mode === "samples")
        this.sampleFile(
          this.randomFile(pattern),
          1,
          0.28 + 0.5 * velocity,
          0,
          duration
        );
      else synth();
    }
    bass(n, a, duration = 0.24) {
      this.pitched(n, duration, 0.16 * a, "triangle", "bass", a);
    }
    eBass(n, a, duration = 0.3) {
      this.pitched(n, duration, 0.13 * a, "sawtooth", "bass", a);
    }
    snapBass(n, a, duration = 0.12) {
      this.pitched(n, duration, 0.2 * a, "square", "bass", a);
    }
    synthBass(n, a, duration = 0.22) {
      this.pitched(n, duration, 0.15 * a, "sawtooth", "bass", a);
    }
    sequencerNote(note, duration = 0.2, velocity = 0.65) {
      this.report("sequencerNote", { note, duration, velocity });
      const expression = { profile: "pluck" };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, 0, expression);
        return;
      }
      this.voice(note, duration, 0.025 + 0.045 * velocity, "sawtooth", 0, {
        ...expression,
        velocity
      });
      this.voice(
        note + 12,
        duration * 0.7,
        8e-3 + 8e-3 * velocity,
        "square",
        6e-3,
        { ...expression, velocity }
      );
    }
    xSequencerNote(note, duration = 0.2, velocity = 0.65, progress = 0, preset = 0) {
      this.report("xSequencerNote", {
        note,
        duration,
        velocity,
        progress,
        preset
      });
      const brightness = 0.2 + 0.8 * Math.max(0, Math.min(1, progress)), expression = {
        profile: "pluck",
        velocity,
        slide: 0.22 + 0.5 * brightness
      };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, 0, expression);
        return;
      }
      this.voice(
        note,
        duration,
        (0.018 + 0.04 * velocity) * brightness,
        "sawtooth",
        0,
        expression
      );
      this.voice(
        note + 12,
        duration * 0.7,
        (5e-3 + 9e-3 * velocity) * brightness,
        "square",
        6e-3,
        expression
      );
    }
    papMelody(note, duration = 0.2, velocity = 0.65, offset = 0) {
      this.report("papMelody", { note, duration, velocity, offset });
      const expression = { profile: "lead", velocity };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset, expression);
        return;
      }
      this.voice(
        note,
        duration,
        0.02 + 0.035 * velocity,
        "triangle",
        offset,
        expression
      );
      this.voice(
        note + 12,
        duration * 0.6,
        6e-3 + 8e-3 * velocity,
        "sine",
        offset + 4e-3,
        expression
      );
    }
    laverne(note, duration = 0.2, velocity = 0.866142, offset = 0, preset = {}, presetIndex = 0) {
      this.report("laverne", {
        note,
        duration,
        velocity,
        offset,
        preset: presetIndex
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["sine", "sawtooth", "triangle", "square"];
      for (const [index, osc] of (preset.oscillators || []).entries()) {
        const pitch = note + 12 * (osc.octave || 0) + (osc.tune || 0) / 100, gain = (0.012 + 0.026 * velocity) * (osc.level ?? 100) / 100;
        this.voice(
          pitch,
          duration,
          gain,
          types[osc.waveform] || "sine",
          offset + index * 3e-3
        );
      }
    }
    resynth(note, duration = 0.5, velocity = 0.65, model = {}, modelIndex = 0) {
      this.report("resynth", { note, duration, velocity, model: modelIndex });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      const ratios = model.ratios || [1, 2, 3], gains = model.gains || [1, 0.3, 0.15];
      for (let index = 0; index < ratios.length; index++)
        this.voice(
          note + 12 * Math.log2(Math.max(0.01, ratios[index])),
          duration,
          0.018 * velocity * (gains[index] ?? 0.1),
          "sine",
          index * 15e-4
        );
    }
    vinylTexture(duration = 8, config = {}) {
      this.report("vinylTexture", { duration });
      if (!this.ctx || this.muted) return;
      this.noise(duration, config.bedGain ?? 0.022, config.bedBandHz ?? 4200);
      this.noise(
        duration,
        config.rumbleGain ?? 0.018,
        config.rumbleBandHz ?? 72,
        0.01
      );
      const count = Math.max(
        1,
        Math.round(duration * 12 * (config.crackleDensity ?? 0.035))
      );
      for (let index = 0; index < count; index++)
        this.noise(
          4e-3 + random() * 0.018,
          (config.crackleGain ?? 0.014) * (0.3 + random() * 0.7),
          config.crackleBandHz ?? 7800,
          random() * Math.max(0, duration - 0.03)
        );
    }
    filterSweep(duration = 0.2, config = {}) {
      this.report("filterSweep", { duration });
      if (!this.ctx || this.muted) return;
      const now = this.eventStart(), length = Math.max(1, Math.ceil(this.ctx.sampleRate * (duration + 0.03))), buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
      for (let index = 0; index < length; index++) data[index] = random() * 2 - 1;
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain(), [start, peak, end] = config.frequencyEnvelope || [100, 18e3, 100], half = now + duration / 2;
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.Q.value = Math.max(0.1, (config.resonance ?? 0.7) * 20);
      filter.frequency.setValueAtTime(start, now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(this.ctx.sampleRate * 0.45, peak),
        half
      );
      filter.frequency.exponentialRampToValueAtTime(end, now + duration);
      amp.gain.setValueAtTime(1e-4, now);
      amp.gain.linearRampToValueAtTime((config.amplitude ?? 0.7) * 0.12, half);
      amp.gain.linearRampToValueAtTime(1e-4, now + duration);
      source.connect(filter).connect(amp).connect(this.master);
      source.start(now);
      source.stop(now + duration + 0.03);
    }
    fmTexture(note, duration = 0.8, velocity = 0.65, timbre = {}) {
      this.report("fmTexture", { note, duration, velocity, timbre });
      const carrierRatio = Math.max(0.125, Number(timbre.carrierRatio) || 1), modulatorRatio = Math.max(0.125, Number(timbre.modulatorRatio) || 1), index = Math.max(0, Number(timbre.index) || 1), movement = Math.max(0, Math.min(1, Number(timbre.amDepth) || 0)), carrier = note + 12 * Math.log2(carrierRatio), expression = {
        pressure: 0.25 + 0.55 * velocity,
        slide: 0.3 + 0.45 / (1 + index),
        slideCurve: [
          0.28 + 0.3 * velocity,
          0.38 + 0.3 * movement,
          0.22 + 0.18 * velocity
        ],
        pitchCurve: [0, 0.012 * movement, -8e-3 * movement, 0],
        vibratoDepth: 0.025 + 0.12 * movement,
        vibratoRate: 3.8 + 1.7 * movement
      };
      if (this.mode === "midi") {
        this.midiNote(carrier, duration, velocity, void 0, 0, expression);
        return;
      }
      this.voice(
        carrier,
        duration,
        0.014 + 0.032 * velocity,
        "sine",
        0,
        expression
      );
      const sidebandGain = (2e-3 + 6e-3 * velocity) * Math.min(1, index / 4);
      if (sidebandGain > 0) {
        const interval = 12 * Math.log2(modulatorRatio);
        this.voice(
          carrier + interval,
          duration * 0.92,
          sidebandGain,
          "sine",
          4e-3,
          {
            ...expression,
            pressure: 0.2 + 0.32 * velocity,
            slide: Math.max(0.12, expression.slide - 0.12)
          }
        );
        this.voice(
          carrier - interval,
          duration * 0.86,
          sidebandGain * 0.62,
          "sine",
          8e-3,
          {
            ...expression,
            pressure: 0.16 + 0.25 * velocity,
            slide: Math.max(0.08, expression.slide - 0.2)
          }
        );
      }
    }
    tonicWhistle(note, duration = 2, velocity = 0.58, activity = 0.5) {
      this.report("tonicWhistle", { note, duration, velocity, activity });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      this.voice(note, duration, 0.012 + 0.024 * velocity, "sine");
      this.voice(
        note + 12.03,
        duration * 0.95,
        2e-3 + 4e-3 * activity,
        "sine",
        0.012
      );
      this.noise(duration, 25e-4 + 3e-3 * activity, midiHz(note), 0);
    }
    windTexture(duration = 2, centroid = 2e3, density = 0.5, config = {}) {
      this.report("windTexture", { duration, centroid, density });
      if (!this.ctx || this.muted) return;
      const frequencies = config.moduleFrequencies || [300, 700, 1200], gains = config.moduleGains || [0.3, 0.2, 0.15], count = Math.max(3, Math.round(3 + density * (frequencies.length - 3)));
      for (let index = 0; index < count; index++) {
        const base = frequencies[index % frequencies.length], frequency = Math.max(
          40,
          Math.min(this.ctx.sampleRate * 0.45, base * (centroid / 1800))
        );
        this.noise(
          duration,
          15e-4 + 5e-3 * (gains[index] || 0.1),
          frequency,
          index * 4e-3
        );
      }
    }
    bleep(note, duration = 0.08, velocity = 0.65, offset = 0, preset = {}, voice = 0) {
      this.report("bleep", { note, duration, velocity, offset, preset, voice });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const fm = preset.fm?.[voice] ?? (voice ? 34 : 30), curve2 = voice ? preset.curve2 ?? 0.92 : preset.curve1 ?? 0.92;
      this.voice(
        note,
        duration,
        0.018 + 0.035 * velocity,
        voice ? "square" : "sine",
        offset
      );
      this.voice(
        note + 12 * Math.log2(Math.max(0.01, fm) / 30),
        duration * Math.max(0.15, curve2),
        4e-3 + 8e-3 * velocity,
        "sine",
        offset + 2e-3
      );
    }
    whinyCluster(fundamental, duration = 0.4, velocity = 0.6, config = {}, valence = 0.5) {
      const frequencies = [], base = midiHz(fundamental), [jitterLow, jitterHigh] = config.partialJitter || [-0.03, 0.03];
      for (let partial = 1; partial <= (config.partialCount || 20); partial++) {
        let frequency = (partial + jitterLow + random() * (jitterHigh - jitterLow)) * base;
        while (frequency > (config.foldMaximumHz || 1e3)) frequency /= 2;
        frequencies.push(frequency);
      }
      const pitches = frequencies.map(hzMidi);
      this.report("whinyCluster", { fundamental, duration, velocity, pitches });
      if (this.mode === "midi") {
        for (const [index, pitch] of pitches.slice(0, 15).entries())
          this.midiNote(
            pitch,
            duration,
            velocity * 0.65,
            void 0,
            index * 2e-3
          );
        return;
      }
      for (const [index, pitch] of pitches.entries())
        this.voice(
          pitch,
          duration,
          2e-3 + 4e-3 * velocity,
          "sine",
          index * 1e-3
        );
    }
    groan(note, duration = 0.8, velocity = 0.65, offset = 0, slide = 0.02, voice = 0) {
      this.report("groan", { note, duration, velocity, offset, slide, voice });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      this.voice(
        note,
        duration,
        0.014 + 0.025 * velocity,
        voice % 2 ? "sawtooth" : "triangle",
        offset,
        {
          profile: "lead",
          velocity,
          // The source bot uses resonant/plucked synthesis. A separate burst of
          // filtered white noise made every browser note sound as though it
          // contained a click, so articulation now comes from the voice envelope.
          attackSeconds: 0.012
        }
      );
    }
    wubPluck(note, duration = 0.6, velocity = 0.65, offset = 0, preset = {}, voice = 0) {
      this.report("wubPluck", {
        note,
        duration,
        velocity,
        offset,
        preset,
        voice
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const type = voice % 2 ? "triangle" : "sawtooth", decay = Math.max(0.1, (preset.decay ?? 70) / 100);
      this.voice(note, duration * decay, 0.012 + 0.025 * velocity, type, offset);
      this.noise(
        Math.min(0.035, duration * 0.1),
        6e-3 + 8e-3 * velocity,
        midiHz(note) * 2,
        offset
      );
    }
    atmosphere(note, duration = 8, gains = [], resonance = 100) {
      this.report("atmosphere", { note, duration, gains, resonance });
      const expression = {
        profile: "texture",
        velocity: 0.52,
        pressure: 0.38,
        slide: 0.34,
        pressureCurve: [0.25, 0.46, 0.34],
        slideCurve: [0.28, 0.42, 0.31],
        pitchCurve: [0, 6e-3, -4e-3, 0],
        vibratoDepth: 0.018,
        vibratoRate: 0.16
      };
      if (this.mode === "midi") {
        this.midiNote(note, duration, 0.52, void 0, 0, expression);
        return;
      }
      const count = Math.min(10, gains.length || 10);
      for (let index = 0; index < count; index++) {
        const ratio = 1 + index * 0.0125, pitch = note + 12 * Math.log2(ratio), gain = 15e-4 + 45e-4 * (gains[index] ?? 0.5);
        this.voice(
          pitch,
          duration,
          gain,
          index % 3 === 0 ? "triangle" : "sine",
          index * 8e-3,
          {
            ...expression,
            vibratoDepth: 0.012 + index * 6e-4,
            vibratoRate: 0.12 + index * 6e-3
          }
        );
      }
      this.noise(duration, 5e-3, midiHz(note), 0);
    }
    textureGrain(note, duration = 8, velocity = 0.6, offset = 0, timbre = {}, voice = 0) {
      this.report("textureGrain", {
        note,
        duration,
        velocity,
        offset,
        timbre: timbre.name,
        voice
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const spectrum = timbre.spectrum || [], strongest = [...spectrum.keys()].sort((a, b) => (spectrum[b] ?? -Infinity) - (spectrum[a] ?? -Infinity)).slice(0, 3);
      this.voice(
        note,
        duration,
        7e-3 + 0.011 * velocity,
        voice % 2 ? "triangle" : "sine",
        offset
      );
      for (const [index, band] of strongest.entries())
        this.voice(
          note + 12 * Math.log2(1 + (band + 1) / 6),
          duration * (0.65 - index * 0.12),
          15e-4 + 3e-3 * velocity,
          "sine",
          offset + 6e-3 * index
        );
      this.noise(
        duration,
        15e-4 + 3e-3 * velocity,
        midiHz(note) * (1.5 + voice * 0.08),
        offset
      );
    }
    granularSlurp(duration = 2, arousal = 0.5, valence = 0.5, config = {}) {
      this.report("granularSlurp", { duration, arousal, valence });
      const voices = config.voiceCount || 3, centroid = 50 + (3e3 - 50) * arousal;
      for (let voice = 0; voice < voices; voice++) {
        const offset = voice * 0.027, band = centroid * (0.72 + voice * 0.28) * (1 + (valence - 0.5) * 0.3);
        this.noise(duration, 6e-3 + 6e-3 * arousal, band, offset);
        this.voice(
          24 + 36 * valence + voice * 7.03,
          duration,
          2e-3 + 4e-3 * arousal,
          voice % 2 ? "triangle" : "sine",
          offset
        );
      }
    }
    chichichi(cell = 0, state2 = 0, beatSeconds = 0.5, config = {}) {
      this.report("chichichi", { cell, state: state2 });
      const duration = Math.max(0.025, beatSeconds * 0.22), band = (config.highpassHz || 4e3) * (1 + cell / 32);
      this.noise(duration, 0.018 + 6e-3 * (state2 % 2), band);
      this.voice(35 + state2 * 5 + cell * 0.17, duration, 4e-3, "sine", 2e-3);
    }
    derivations(duration = 4, density = 0.8, config = {}) {
      this.report("derivations", { duration, density });
      if (this.mode === "samples") {
        const file = this.randomFile(/\.(?:aif|aiff|wav)$/i), range = config.transposeRange ?? 0.5, rate = 1 - range + random() * range * 2;
        this.sampleFile(file, rate, 0.32, 0, duration);
        return;
      }
      const count = Math.max(2, Math.round(2 + density * 5));
      for (let index = 0; index < count; index++) {
        const frequency = 70 + random() * 7600;
        this.noise(duration, 15e-4 + 25e-4 / count, frequency, index * 0.013);
        this.voice(
          24 + 12 * Math.log2(frequency / 55),
          duration,
          15e-4,
          "sine",
          index * 0.017
        );
      }
    }
    deciderBreath(leaf = 0, config = {}) {
      this.report("deciderBreath", { leaf });
      const phase = (leaf % 200 + 200) % 200, rate = phase < 50 ? 0.5 : phase > 150 ? 2 : phase > 140 ? 3 : 1, duration = ((config.attackMs || 500) + (config.releaseMs || 1e3)) / 1e3;
      if (this.mode === "samples") {
        this.sampleFile(
          this.randomFile(/\.(?:aif|aiff|wav)$/i),
          rate,
          0.3,
          0,
          duration
        );
        return;
      }
      const [low, high] = config.filterRangeHz || [1e3, 11e3], band = low + (high - low) * (leaf / Math.max(1, (config.numElements || 30) - 1));
      this.noise(duration, 0.016, band);
      this.voice(30 + leaf * 0.31, duration, 25e-4, "sine");
    }
    blankTriangle(note, duration = 0.5, velocity = 0.65) {
      this.report("blankTriangle", { note, duration, velocity });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      this.voice(note, duration, 0.025 + 0.04 * velocity, "triangle");
    }
    midiGeneratorVoice(note, duration = 0.5, velocity = 0.65, voice = 0, controls = {}) {
      this.report("midiGeneratorVoice", {
        note,
        duration,
        velocity,
        voice,
        controls
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      this.voice(
        note,
        duration,
        0.012 + 0.02 * velocity,
        voice % 2 ? "triangle" : "sine"
      );
    }
    webVoice(note, duration = 0.5, velocity = 0.5, voice = 0) {
      this.report("webVoice", { note, duration, velocity, voice });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      this.voice(
        note,
        duration,
        0.014 + 0.024 * velocity,
        voice % 2 ? "sine" : "triangle"
      );
    }
    papMelodyVoice(note, duration = 0.2, velocity = 0.65, offset = 0, voice = 0) {
      this.report("papMelodyVoice", { note, duration, velocity, offset, voice });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["triangle", "sawtooth", "sine"];
      this.voice(
        note,
        duration,
        0.016 + 0.025 * velocity,
        types[voice % 3],
        offset
      );
      if (voice === 2)
        this.voice(
          note - 12,
          duration * 0.55,
          5e-3 + 5e-3 * velocity,
          "sine",
          offset + 6e-3
        );
    }
    papMelody4(note, duration = 0.2, velocity = 0.65, offset = 0, modulation = 0) {
      this.report("papMelody4", { note, duration, velocity, offset, modulation });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      this.voice(note, duration, 0.018 + 0.03 * velocity, "square", offset);
      this.voice(
        note + 7,
        duration * 0.58,
        5e-3 + 6e-3 * velocity,
        "triangle",
        offset + 5e-3
      );
    }
    dampedPiano(note, duration = 0.22, velocity = 0.65, offset = 0, register = 0) {
      this.report("dampedPiano", { note, duration, velocity, offset, register });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      this.voice(note, duration, 0.025 + 0.045 * velocity, "triangle", offset);
      this.voice(
        note + 12,
        Math.min(0.09, duration * 0.38),
        6e-3 + 9e-3 * velocity,
        "sine",
        offset + 3e-3
      );
      this.noise(
        Math.min(0.035, duration * 0.2),
        4e-3 + 6e-3 * velocity,
        900 + register * 1400,
        offset
      );
    }
    counterpointVoice(note, duration = 0.22, velocity = 0.65, offset = 0, register = 0) {
      this.report("counterpointVoice", {
        note,
        duration,
        velocity,
        offset,
        register
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["triangle", "sine", "square", "sawtooth", "triangle"];
      this.voice(
        note,
        duration,
        0.013 + 0.024 * velocity,
        types[register % types.length],
        offset
      );
      this.voice(
        note + (register % 2 ? 12 : -12),
        duration * 0.52,
        35e-4 + 4e-3 * velocity,
        "sine",
        offset + 6e-3
      );
    }
    ornamentPluck(note, duration = 0.16, velocity = 0.65, offset = 0, pan = 0.5) {
      this.report("ornamentPluck", { note, duration, velocity, offset, pan });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      this.voice(note, duration, 0.02 + 0.038 * velocity, "triangle", offset);
      this.noise(
        Math.min(0.016, duration * 0.12),
        12e-4 + 22e-4 * velocity,
        1050 + note * 13,
        offset
      );
    }
    msynthNote(note, duration = 0.2, velocity = 0.65, offset = 0, preset = 0) {
      this.report("msynthNote", { note, duration, velocity, offset, preset });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["sawtooth", "triangle", "square", "sine", "sawtooth"], type = types[preset % types.length], gain = 0.018 + 0.032 * velocity;
      this.voice(note, duration, gain, type, offset);
      if (preset === 0 || preset === 4)
        this.voice(
          note + 12,
          duration * 0.55,
          gain * 0.2,
          "sine",
          offset + 4e-3
        );
      if (preset === 2)
        this.noise(
          Math.min(0.03, duration * 0.15),
          gain * 0.12,
          1200 + note * 18,
          offset
        );
    }
    rsynthNote(note, duration = 0.14, velocity = 0.65, offset = 0, preset = 0) {
      this.report("rsynthNote", { note, duration, velocity, offset, preset });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["square", "sawtooth", "triangle", "square", "sine"], gain = 0.018 + 0.034 * velocity;
      this.voice(note, duration, gain, types[preset % types.length], offset);
      if (preset % 2 === 0)
        this.noise(
          Math.min(0.02, duration * 0.12),
          gain * 0.08,
          1600 + note * 20,
          offset
        );
    }
    multiSynthNote(note, duration = 0.2, velocity = 0.65, offset = 0, part = 0, preset = 0) {
      this.report("multiSynthNote", {
        note,
        duration,
        velocity,
        offset,
        part,
        preset
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["triangle", "sawtooth", "square", "sine"], gain = 0.011 + 0.018 * velocity;
      this.voice(
        note,
        duration,
        gain,
        types[(part + preset) % types.length],
        offset
      );
      if (part === 0)
        this.voice(
          note - 12,
          duration * 0.62,
          gain * 0.22,
          "sine",
          offset + 5e-3
        );
    }
    reichGuitar(note, duration = 0.18, velocity = 0.65, offset = 0, part = 0, preset = 0) {
      this.report("reichGuitar", {
        note,
        duration,
        velocity,
        offset,
        part,
        preset
      });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const gain = 0.016 + 0.027 * velocity;
      this.voice(
        note,
        duration,
        gain,
        part % 2 ? "triangle" : "sawtooth",
        offset
      );
      this.noise(
        Math.min(0.024, duration * 0.15),
        gain * 0.11,
        1500 + note * 24,
        offset
      );
      if (preset % 2)
        this.voice(
          note + 12,
          duration * 0.35,
          gain * 0.12,
          "sine",
          offset + 4e-3
        );
    }
    methenyMelody(note, duration = 0.24, velocity = 0.65, offset = 0, preset = 0) {
      this.report("methenyMelody", { note, duration, velocity, offset, preset });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset);
        return;
      }
      const types = ["sawtooth", "triangle", "square"], gain = 0.018 + 0.028 * velocity;
      this.voice(note, duration, gain, types[preset % 3], offset);
      if (preset === 1)
        this.voice(
          note + 12,
          duration * 0.48,
          gain * 0.16,
          "sine",
          offset + 6e-3
        );
    }
    seasonsArpy(note, duration = 0.158318, velocity = 0.66) {
      this.report("seasonsArpy", { note, duration, velocity });
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity);
        return;
      }
      this.voice(note, duration, 0.018 + 0.032 * velocity, "triangle");
      this.noise(
        Math.min(0.018, duration * 0.12),
        25e-4 + 4e-3 * velocity,
        1900 + note * 20
      );
    }
    seasonsBrokenChord(note, duration, velocity = 0.55, offset = 0) {
      this.report("seasonsBrokenChord", { note, duration, velocity, offset });
      const expression = { profile: "pad", velocity };
      if (this.mode === "midi")
        this.midiNote(note, duration, velocity, void 0, offset, expression);
      else if (this.mode === "samples")
        this.samplePitch(note, offset, 0.22 + 0.28 * velocity, duration);
      else {
        this.voice(
          note,
          duration,
          0.014 + 0.025 * velocity,
          "triangle",
          offset,
          expression
        );
        this.voice(
          note + 12,
          duration * 0.94,
          4e-3 + 6e-3 * velocity,
          "sine",
          offset + 0.01,
          expression
        );
      }
    }
    seasonsChord(notes, duration = 0.85, velocity = 0.6) {
      this.report("seasonsChord", { notes, duration, velocity });
      const expression = { profile: "pad", velocity };
      if (this.mode === "midi")
        notes.forEach(
          (note, index) => this.midiNote(
            note,
            duration,
            velocity,
            void 0,
            index * 0.012,
            expression
          )
        );
      else if (this.mode === "samples")
        notes.forEach(
          (note, index) => this.samplePitch(note, index * 0.018, 0.22 + 0.25 * velocity)
        );
      else
        notes.forEach((note, index) => {
          this.voice(
            note,
            duration,
            0.012 + 0.022 * velocity,
            index % 2 ? "sine" : "triangle",
            index * 0.018,
            expression
          );
          this.voice(
            note + 12,
            duration * 0.75,
            3e-3 + 5e-3 * velocity,
            "sine",
            index * 0.018 + 0.012,
            expression
          );
        });
    }
    seasonsDrone(note, duration, velocity = 0.52, offset = 0) {
      this.report("seasonsDrone", { note, duration, velocity, offset });
      const expression = { profile: "drone", velocity };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset, expression);
        return;
      }
      this.voice(
        note,
        duration,
        0.012 + 0.018 * velocity,
        "sine",
        offset,
        expression
      );
      this.voice(
        note - 12,
        duration * 0.96,
        4e-3 + 6e-3 * velocity,
        "triangle",
        offset + 0.02,
        expression
      );
    }
    seasonsSussy(note, duration, velocity = 0.52, offset = 0) {
      this.report("seasonsSussy", { note, duration, velocity, offset });
      const expression = { profile: "drone", velocity };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, offset, expression);
        return;
      }
      this.voice(
        note,
        duration,
        0.014 + 0.02 * velocity,
        "triangle",
        offset,
        expression
      );
      this.voice(
        note - 12,
        duration * 0.96,
        5e-3 + 7e-3 * velocity,
        "sine",
        offset + 0.02,
        expression
      );
    }
    chord(ns) {
      this.report("chord", { notes: ns });
      const expression = { profile: "keys", velocity: 0.55 };
      if (this.mode === "midi") {
        this.midiDamper(0.68);
        ns.forEach((n) => this.midiNote(n, 0.56, 0.55, void 0, 0, expression));
      } else if (this.mode === "samples") ns.forEach((n) => this.samplePitch(n));
      else
        ns.forEach(
          (n, i) => this.voice(n, 0.7, 0.025, "sine", i * 0.018, expression)
        );
    }
    rhodes(ns) {
      this.report("rhodes", { notes: ns });
      const expression = { profile: "keys", velocity: 0.5 };
      if (this.mode === "midi")
        ns.forEach((n) => this.midiNote(n, 0.48, 0.5, void 0, 0, expression));
      else if (this.mode === "samples") ns.forEach((n) => this.samplePitch(n));
      else
        ns.forEach((n) => this.voice(n, 0.48, 0.025, "triangle", 0, expression));
    }
    bowedTexture(notes, duration = 0.7, accent = 0.6) {
      this.report("bowedTexture", { notes, duration, accent });
      const velocity = 0.3 + 0.45 * accent, expression = { profile: "pad", velocity, pressure: 0.2 + 0.5 * accent };
      if (this.mode === "midi") {
        notes.forEach(
          (note, index) => this.midiNote(
            note,
            duration,
            velocity,
            void 0,
            index * 0.012,
            expression
          )
        );
        return;
      }
      if (this.mode === "samples") {
        notes.forEach((note) => this.samplePitch(note));
        return;
      }
      notes.forEach((note, index) => {
        this.voice(
          note,
          duration,
          0.018 + 0.012 * accent,
          index ? "triangle" : "sawtooth",
          index * 0.018,
          expression
        );
        if (index)
          this.voice(
            note + 12,
            duration * 0.8,
            6e-3 * accent,
            "sine",
            index * 0.018 + 0.02,
            expression
          );
      });
    }
    dronePad(note, duration = 1, density = 0.5) {
      this.report("dronePad", { note, duration, density });
      const velocity = 0.35 + 0.35 * density, expression = {
        profile: "drone",
        velocity,
        pressure: 0.22 + 0.42 * density
      };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, 0, expression);
        return;
      }
      this.voice(
        note,
        duration,
        0.025 + 0.025 * density,
        "sawtooth",
        0,
        expression
      );
      this.voice(
        note + 12,
        duration * 0.92,
        9e-3 + 0.01 * density,
        "sine",
        0.015,
        expression
      );
    }
    padChord(notes, duration = 1, density = 0.5, openness = 0.5) {
      this.report("padChord", { notes, duration, density, openness });
      const velocity = 0.3 + 0.35 * density, expression = {
        profile: "pad",
        velocity,
        pressure: 0.2 + 0.4 * density,
        slide: 0.18 + 0.68 * openness
      };
      if (this.mode === "midi") {
        notes.forEach(
          (note, index) => this.midiNote(
            note,
            duration,
            velocity,
            void 0,
            index * 0.012,
            expression
          )
        );
        return;
      }
      const gain = 0.012 + 0.015 * density + 8e-3 * openness;
      notes.forEach((note, index) => {
        this.voice(note, duration, gain, "sawtooth", index * 0.015, expression);
        this.voice(
          note + 12,
          duration * 0.9,
          gain * 0.35,
          "sine",
          index * 0.015 + 0.01,
          expression
        );
      });
    }
    highDrone(note, duration = 12, accent = 0.6) {
      this.report("highDrone", { note, duration, accent });
      const velocity = 0.25 + 0.4 * accent, expression = {
        profile: "drone",
        velocity,
        pressure: 0.18 + 0.42 * accent
      };
      if (this.mode === "midi") {
        this.midiNote(note, duration, velocity, void 0, 0, expression);
        return;
      }
      this.voice(note, duration, 0.014 + 0.012 * accent, "sine", 0, expression);
      this.voice(
        note - 12,
        duration * 0.95,
        6e-3 + 6e-3 * accent,
        "triangle",
        0.02,
        expression
      );
    }
    wubDrone(note, duration = 2, tremolo = 3, density = 0.5) {
      this.report("wubDrone", { note, duration, tremolo, density });
      if (this.mode === "midi") {
        this.midiNote(note, duration, 0.3 + 0.35 * density);
        return;
      }
      const pulses = Math.max(
        1,
        Math.min(12, Math.round(duration * Math.max(0.2, tremolo)))
      ), step = duration / pulses;
      for (let index = 0; index < pulses; index++) {
        const offset = index * step;
        this.voice(
          note,
          Math.min(step * 0.72, 0.4),
          0.012 + 0.018 * density,
          index % 2 ? "sawtooth" : "square",
          offset
        );
        this.noise(
          Math.min(step * 0.25, 0.08),
          6e-3 + 0.01 * density,
          300 + note * 12,
          offset
        );
      }
    }
    kick() {
      this.percussion(36, /kick/i, () => this.voice(36, 0.13, 0.22, "sine"));
    }
    softKick() {
      this.percussion(
        36,
        /kick/i,
        () => this.voice(36, 0.16, 0.18, "sine"),
        0.58,
        0.16
      );
    }
    snare() {
      this.percussion(38, /snare/i, () => this.noise(0.1, 0.12, 1800), 0.76, 0.1);
    }
    hat() {
      this.percussion(
        42,
        /hihat|click/i,
        () => this.noise(0.035, 0.04, 8500),
        0.58,
        0.035
      );
    }
    brush() {
      this.percussion(
        38,
        /snare|brush/i,
        () => this.noise(0.24, 0.13, 2800),
        0.48,
        0.24
      );
    }
    ride(a = 0.7) {
      this.percussion(
        51,
        /hihat|ride/i,
        () => this.noise(0.13, 0.1 * Math.max(0.45, a), 6500),
        0.35 + 0.55 * a,
        0.13
      );
    }
    cleanPercussion(index, accent = 0.6) {
      const notes = [46, 50, 54, 56], filters = [3300, 4400, 5600, 7200], note = notes[index % notes.length];
      this.percussion(
        note,
        new RegExp(`(?:perc|tom|conga|bongo|clave|${index + 1})`, "i"),
        () => this.noise(
          0.045 + index * 0.018,
          0.035 + 0.035 * accent,
          filters[index % filters.length]
        ),
        0.35 + 0.55 * accent,
        0.045 + index * 0.018
      );
    }
    noiseDrum(kind) {
      const notes = { kick: 36, snare: 38, hat: 42 }, note = notes[kind] ?? 42, filters = { kick: 240, snare: 1300, hat: 7600 };
      this.percussion(note, /noise/i, () => {
        if (kind === "kick") this.voice(34, 0.16, 0.16, "sine");
        this.noise(
          kind === "hat" ? 0.035 : 0.11,
          kind === "hat" ? 0.055 : 0.11,
          filters[kind]
        );
      });
    }
    noisePercussion(index, accent = 0.6) {
      const notes = [46, 48, 50, 53], filters = [700, 1200, 2400, 4800], note = notes[index % 4];
      this.report("noisePercussion", { index, accent });
      if (this.mode === "midi") this.midiNote(note, 0.09, 0.45 + 0.4 * accent, 9);
      else
        this.noise(
          0.06 + index * 0.025,
          0.045 + 0.05 * accent,
          filters[index % 4]
        );
    }
    houseDrum(kind, accent = 0.7) {
      const notes = { kick: 36, snare: 38, closedHat: 42, openHat: 46 }, patterns = {
        kick: /kick/i,
        snare: /snare/i,
        closedHat: /hihat|closed/i,
        openHat: /hihat|open/i
      }, note = notes[kind] ?? 42, duration = kind === "openHat" ? 0.14 : kind === "snare" ? 0.09 : kind === "kick" ? 0.14 : 0.035;
      this.percussion(
        note,
        patterns[kind] || /hihat/i,
        () => {
          if (kind === "kick") this.voice(34, 0.14, 0.16 * accent, "sine");
          else
            this.noise(
              duration,
              (kind === "snare" ? 0.11 : 0.055) * accent,
              kind === "snare" ? 1900 : 7600
            );
        },
        0.3 + 0.65 * accent,
        duration
      );
    }
    modulatedPercussion(index, accent = 0.7, { cutoff = 1200, delay = 0.08, feedback = 0.2 } = {}) {
      const notes = [60, 62, 64], note = notes[index % 3];
      this.report("modulatedPercussion", {
        index,
        accent,
        cutoff,
        delay,
        feedback
      });
      if (this.mode === "midi") {
        this.midiNote(note, 0.1, 0.35 + 0.55 * accent, 9);
        return;
      }
      if (this.mode === "samples") {
        this.sampleFile(
          this.sampleFiles[index % this.sampleFiles.length],
          1,
          0.35 + 0.55 * accent
        );
        return;
      }
      if (!this.ctx || this.muted) return;
      const duration = 0.055 + index * 0.025, length = Math.ceil(this.ctx.sampleRate * duration), buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain(), echo = this.ctx.createDelay(1), returnGain = this.ctx.createGain(), now = this.eventStart();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = Math.max(
        20,
        Math.min(this.ctx.sampleRate * 0.45, cutoff)
      );
      filter.Q.value = 2 + index * 1.5;
      amp.gain.setValueAtTime(0.08 * accent, now);
      amp.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      echo.delayTime.value = Math.max(0, Math.min(0.75, delay));
      returnGain.gain.value = Math.max(0, Math.min(0.48, feedback));
      source.connect(filter).connect(amp);
      amp.connect(this.master);
      amp.connect(echo).connect(returnGain).connect(echo);
      returnGain.connect(this.master);
      source.start(now);
    }
    papPercussion(kind, variant = 0, accent = 0.7) {
      const notes = { kick: 36, mid: 45, noise: 42 }, note = notes[kind] ?? 42;
      this.report("papPercussion", { kind, variant, accent });
      if (this.mode === "midi") {
        this.midiNote(note, 0.1, 0.4 + 0.5 * accent, 9);
        return;
      }
      if (kind === "kick") {
        this.voice(31, 0.16, 0.17 * accent, "sine");
        return;
      }
      if (kind === "mid") {
        this.voice(
          42 + variant * 3,
          0.11,
          0.08 * accent,
          variant % 2 ? "square" : "triangle"
        );
        return;
      }
      this.noise(
        0.035 + 0.025 * variant,
        0.045 + 0.025 * accent,
        [7200, 3200, 900][variant % 3]
      );
    }
    mhBeatDrum(kind, accent = 0.7) {
      const notes = { kick: 36, snare: 38, cymbal: 42 }, note = notes[kind] ?? 42;
      this.report("mhBeatDrum", { kind, accent });
      if (this.mode === "midi") {
        this.midiNote(
          note,
          kind === "cymbal" ? 0.08 : 0.12,
          0.35 + 0.55 * accent,
          9
        );
        return;
      }
      if (kind === "kick") this.voice(34, 0.14, 0.18 * accent, "sine");
      else
        this.noise(
          kind === "snare" ? 0.1 : 0.045,
          (kind === "snare" ? 0.11 : 0.055) * accent,
          kind === "snare" ? 1800 : 7800
        );
    }
    mhBeatsynth(kind, accent = 0.7, config = {}) {
      const notes = config.midiNotes || [36, 38, 51], note = notes[kind] ?? 36;
      this.report("mhBeatsynth", { kind, accent });
      if (this.mode === "midi") {
        this.midiNote(note, kind === 2 ? 0.12 : 0.2, 0.35 + 0.55 * accent, 9);
        return;
      }
      if (kind === 0) {
        const [low, high] = config.bassFrequencyRange || [15, 26], frequency = low + random() * (high - low), midi = 69 + 12 * Math.log2(frequency / 440);
        this.voice(midi, 0.28, 0.14 * accent, "triangle");
        return;
      }
      if (kind === 1) {
        this.noise(0.13, 0.11 * accent, 800 + random() * 50);
        return;
      }
      const [detuneLow, detuneHigh] = config.cymbalDetuneRange || [0.99, 1.02];
      for (const frequency of config.cymbalFrequencies || [
        3e3,
        3100,
        3150,
        3200,
        3230,
        3260,
        3290,
        3300
      ]) {
        const midi = 69 + 12 * Math.log2(
          frequency * (detuneLow + random() * (detuneHigh - detuneLow)) / 440
        );
        this.voice(midi, 0.075, 9e-3 * accent, "square");
      }
    }
    sampleBeatLoop(resonanceNote, step, accent = 0.7, config = {}, preset = 0) {
      const pattern = config.monitorPattern || {}, kind = (pattern.kick || []).includes(step) ? "kick" : (pattern.snare || []).includes(step) ? "snare" : (pattern.hat || []).includes(step) ? "hat" : null;
      this.report("sampleBeatLoop", { resonanceNote, step, kind, preset });
      if (this.mode === "midi") {
        if (kind)
          this.midiNote(
            config.midiNotes?.[kind] ?? 42,
            0.08,
            0.4 + 0.45 * accent,
            9
          );
        if (step === 0) this.midiNote(resonanceNote, 0.35, 0.35);
        return;
      }
      if (kind === "kick") this.voice(34, 0.12, 0.16 * accent, "sine");
      else if (kind === "snare") this.noise(0.09, 0.09 * accent, 1700);
      else if (kind === "hat") this.noise(0.028, 0.035 * accent, 7600);
      if (kind) {
        const gains = config.resonatorGainPresets?.[preset] || [0.5], gain = gains.reduce((sum, value) => sum + value, 0) / gains.length;
        this.voice(resonanceNote, 0.1, 0.018 * gain, "sine");
      }
    }
    autechreDrum(kind, accent = 0.7, effects = {}, offset = 0) {
      const notes = { kick: 36, snare: 38, hat: 42 }, note = notes[kind] ?? 42;
      this.report("autechreDrum", { kind, accent, effects, offset });
      if (this.mode === "midi") {
        this.midiNote(note, 0.07, 0.35 + 0.55 * accent, 9, offset);
        return;
      }
      const bitFactor = Math.max(0.2, Math.min(1, (effects.bits || 12) / 24)), cutoff = 300 + Math.max(0, Math.min(1, effects.sampleRate ?? 0.5)) * 9e3;
      if (kind === "kick")
        this.voice(32, 0.11, 0.16 * accent * bitFactor, "sine", offset);
      else
        this.noise(
          kind === "snare" ? 0.085 : 0.025,
          (kind === "snare" ? 0.1 : 0.035) * accent * bitFactor,
          kind === "snare" ? Math.min(3200, cutoff) : Math.max(4200, cutoff),
          offset
        );
      if ((effects.wet || 0) > 0) {
        const echoOffset = offset + (effects.delaySeconds || 0.1);
        if (kind === "kick")
          this.voice(32, 0.07, 0.07 * accent * effects.wet, "sine", echoOffset);
        else this.noise(0.02, 0.025 * accent * effects.wet, cutoff, echoOffset);
      }
    }
    prockRockDrum(index, activity = 3) {
      this.report("prockRockDrum", { index, activity });
      if (this.mode === "midi") {
        const notes = this.definition?.prockRockMidiNotes || [
          36,
          38,
          42,
          46,
          45,
          47,
          48,
          50,
          49,
          51,
          52,
          53
        ];
        this.midiNote(
          notes[index % notes.length],
          0.1,
          0.35 + Math.min(3, activity) * 0.18,
          9
        );
        return;
      }
      if (this.mode === "samples") {
        this.sampleFile(
          this.sampleFiles[index % this.sampleFiles.length],
          1,
          0.7
        );
        return;
      }
      if (index % 4 === 0) this.voice(34, 0.14, 0.16, "sine");
      else if (index % 4 === 1) this.noise(0.09, 0.1, 1800);
      else this.noise(0.035, 0.055, 6500 + index % 5 * 500);
    }
    rungler(v, a, note, waveform, velocity = 0.3 + (1 - v) * 0.3) {
      if (this.mode === "midi") this.midiNote(note, 0.08 + a * 0.22, velocity);
      else
        this.voice(
          note,
          0.08 + a * 0.22,
          (0.025 + (1 - v) * 0.035) * (0.55 + velocity * 0.7),
          waveform,
          0,
          { velocity }
        );
    }
    effectMonitor(v, a) {
      this.report("effectMonitor", { v, a });
      this.voice(48 + v * 12, 0.15 + a * 0.25, 0.012, "sine");
    }
    async microphone() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), source = this.ctx.createMediaStreamSource(stream), analyser = this.ctx.createAnalyser(), samples = new Float32Array(1024), spectrum = new Uint8Array(512);
      analyser.fftSize = 1024;
      source.connect(analyser);
      return {
        stop() {
          stream.getTracks().forEach((track) => track.stop());
        },
        features() {
          analyser.getFloatTimeDomainData(samples);
          analyser.getByteFrequencyData(spectrum);
          let sum = 0, weighted = 0, total = 0;
          samples.forEach((x) => sum += x * x);
          spectrum.forEach((x, i) => {
            weighted += x * i;
            total += x;
          });
          const loudness = Math.sqrt(sum / samples.length), centroid = total ? weighted / total / spectrum.length : 0;
          return {
            loudness,
            centroid,
            activity: Math.min(1, loudness * 12),
            arousal: Math.min(1, loudness * 8 + centroid * 0.3),
            valence: Math.max(0, Math.min(1, 0.7 - centroid * 0.35))
          };
        }
      };
    }
  };

  // public/client-ensemble.js
  var OPEN = 1;
  var CLOSED = 3;
  var MAX_RETAINED_PLANS = 512;
  var LocalSocket = class {
    constructor(ensemble2) {
      this.ensemble = ensemble2;
      this.readyState = OPEN;
      this.listeners = /* @__PURE__ */ new Map();
      queueMicrotask(() => this.emit("open", {}));
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
      this.listeners.get(type).add(listener);
    }
    emit(type, event) {
      for (const listener of this.listeners.get(type) || []) listener(event);
    }
    deliver(message) {
      this.emit("message", { data: JSON.stringify(message) });
    }
    send(value) {
      if (this.readyState !== OPEN) return;
      this.ensemble.receive(this, JSON.parse(value));
    }
    close() {
      if (this.readyState === CLOSED) return;
      this.readyState = CLOSED;
      this.ensemble.leave(this);
      this.emit("close", {});
    }
  };
  var ClientEnsemble = class {
    constructor(meterApi = globalThis.MusebotMeter, { bpm = 108, meter } = {}) {
      this.meterApi = meterApi;
      this.bpm = bpm;
      this.meter = meterApi.normalizeMeter(meter || {});
      this.tick = 0;
      this.bar = 0;
      this.tickInBar = 0;
      this.clients = /* @__PURE__ */ new Map();
      this.parameters = /* @__PURE__ */ new Map();
      this.nextClient = 1;
      this.protocolSequence = 0;
      this.timer = null;
      this.nextAt = 0;
      this.pendingMeter = null;
      this.pendingTempoCurve = null;
      this.tempoCurve = null;
    }
    connect() {
      return new LocalSocket(this);
    }
    receive(socket, message) {
      if (message.type === "client_hello") return;
      if (message.type === "join" && !this.clients.has(socket)) {
        const client2 = { id: String(this.nextClient++), room: String(message.room || "main").slice(0, 64), agent: String(message.agent || "unknown").slice(0, 64) };
        this.clients.set(socket, client2);
        socket.deliver({ type: "welcome", room: client2.room, instanceId: `${client2.agent}:local-${client2.id}`, bpm: this.bpm, tick: this.tick, bar: this.bar, meter: this.meter, parameters: Object.fromEntries(this.parameters) });
        socket.deliver(this.protocol("relay", "/system/instance", [`${client2.agent}:local-${client2.id}`]));
        for (const [key, state2] of this.parameters) socket.deliver(this.protocol(state2.source, state2.address || key, state2.args));
        this.broadcast({ type: "presence", agent: client2.agent, state: "joined", count: this.clients.size }, client2.room);
        this.start();
        return;
      }
      const client = this.clients.get(socket);
      if (!client) return;
      if (message.type === "switch") {
        client.agent = String(message.agent || client.agent).slice(0, 64);
        return;
      }
      if (message.type === "protocol") {
        const address = String(message.address || ""), args = Array.isArray(message.args) ? message.args : [];
        if (address === "/broadcast/timeSignature") this.queueMeter(args[0], args[1]);
        if (address === "/broadcast/tempoCurve") this.queueTempoCurve(args[0], args[1]);
        const protocol = this.protocol(client.agent, address, args);
        this.remember(protocol);
        this.broadcast(protocol, client.room);
      }
    }
    remember(message) {
      if (!message.address.startsWith("/broadcast/") || message.address === "/broadcast/plan/response") return;
      const plan = message.address === "/broadcast/plan" ? message.args?.[0] : null, isForm = message.address === "/broadcast/form" || message.address.startsWith("/broadcast/form/") || plan?.kind === "form";
      if (isForm) return;
      const key = plan?.author && plan?.kind ? `${message.address}#${plan.author}#${plan.kind}` : message.address, store = this.parameters;
      store.delete(key);
      store.set(key, { address: message.address, args: message.args, source: message.source });
      if (plan) while ([...store.keys()].filter((value) => value.startsWith("/broadcast/plan#")).length > MAX_RETAINED_PLANS) {
        const oldest = [...store.keys()].find((value) => value.startsWith("/broadcast/plan#"));
        store.delete(oldest);
      }
    }
    protocol(source, address, args) {
      return { type: "protocol", source, address, args, clientTime: Date.now(), eventId: `client:${++this.protocolSequence}` };
    }
    broadcast(message, room) {
      for (const [socket, client] of this.clients) if (!room || client.room === room) socket.deliver(message);
    }
    leave(socket) {
      const client = this.clients.get(socket);
      if (!client) return;
      this.clients.delete(socket);
      this.broadcast({ type: "presence", agent: client.agent, state: "left", count: this.clients.size }, client.room);
      if (!this.clients.size) this.stop();
    }
    queueMeter(value = {}, mode = "nextBar") {
      const meter = this.meterApi.normalizeMeter({ ...value, groups: Array.isArray(value.groups) ? value.groups : [] }), remaining = mode === "nextPhrase" ? this.meter.phraseBars - this.bar % this.meter.phraseBars || this.meter.phraseBars : 1, targetBar = this.bar + remaining;
      this.pendingMeter = { meter, targetBar };
      this.broadcast({ type: "meter_queued", meter, targetBar });
      return this.pendingMeter;
    }
    queueTempoCurve(value = {}, mode = "nextBar") {
      const remaining = mode === "nextPhrase" ? this.meter.phraseBars - this.bar % this.meter.phraseBars || this.meter.phraseBars : 1;
      this.pendingTempoCurve = { targetBpm: Math.max(40, Math.min(220, Number(value.targetBpm) || this.bpm)), durationBars: Math.max(1, Math.min(1024, Math.round(Number(value.durationBars) || 1))), shape: ["linear", "easeInOut", "exponential"].includes(value.shape) ? value.shape : "easeInOut", targetBar: this.bar + remaining };
    }
    curvePosition(value, shape) {
      const x = Math.max(0, Math.min(1, value));
      if (shape === "easeInOut") return (1 - Math.cos(Math.PI * x)) / 2;
      if (shape === "exponential") return x * x;
      return x;
    }
    updateTempo() {
      if (this.pendingTempoCurve && this.bar >= this.pendingTempoCurve.targetBar && this.tickInBar === 0) {
        this.tempoCurve = { ...this.pendingTempoCurve, startBpm: this.bpm, startBar: this.bar };
        this.pendingTempoCurve = null;
      }
      if (!this.tempoCurve) return;
      const fractional = this.bar + this.tickInBar / this.meter.pulsesPerBar, progress = (fractional - this.tempoCurve.startBar) / this.tempoCurve.durationBars, mix = this.curvePosition(progress, this.tempoCurve.shape), start = this.tempoCurve.startBpm, target = this.tempoCurve.targetBpm;
      this.bpm = this.tempoCurve.shape === "exponential" ? start * (target / start) ** mix : start + (target - start) * mix;
      if (progress >= 1) {
        this.bpm = target;
        this.tempoCurve = null;
      }
      this.broadcast({ type: "tempo", bpm: this.bpm, curveActive: Boolean(this.tempoCurve) });
    }
    pulse() {
      this.updateTempo();
      this.broadcast({ type: "clock", ...this.meterApi.clockContext(this), clientTime: Date.now() });
      this.tick++;
      this.tickInBar++;
      if (this.tickInBar >= this.meter.pulsesPerBar) {
        this.tickInBar = 0;
        this.bar++;
        if (this.pendingMeter && this.bar >= this.pendingMeter.targetBar) {
          this.meter = this.pendingMeter.meter;
          this.pendingMeter = null;
          this.broadcast({ type: "meter_changed", meter: this.meter, bar: this.bar });
          const message = this.protocol("client-conductor", "/broadcast/meter", [this.meter]);
          this.parameters.set(message.address, { args: message.args, source: message.source });
          this.broadcast(message);
        }
      }
    }
    schedule() {
      if (!this.clients.size) return;
      const interval = 6e4 / this.bpm / this.meter.subdivision;
      this.nextAt || (this.nextAt = performance.now() + interval);
      this.timer = setTimeout(() => {
        this.pulse();
        this.nextAt += 6e4 / this.bpm / this.meter.subdivision;
        this.schedule();
      }, Math.max(0, this.nextAt - performance.now()));
    }
    start() {
      if (!this.timer) this.schedule();
    }
    stop() {
      clearTimeout(this.timer);
      this.timer = null;
      this.nextAt = 0;
    }
  };
  var LOCAL_SOCKET_OPEN = OPEN;

  // public/data/signal-tower-tokens.json
  var signal_tower_tokens_default = {
    schemaVersion: 1,
    note: "Tokens are permanent public-link identifiers. If a registry id or display name changes, preserve its token and update only id.",
    bots: [
      {
        token: "0aaoe12",
        id: "analyzer"
      },
      {
        token: "0ray2wc",
        id: "atmosphere"
      },
      {
        token: "1tj20jz",
        id: "autechre"
      },
      {
        token: "1uaak00",
        id: "beat"
      },
      {
        token: "0sogt9m",
        id: "blank"
      },
      {
        token: "06zfzls",
        id: "bleep"
      },
      {
        token: "1ap4uih",
        id: "bowed"
      },
      {
        token: "13chil2",
        id: "chichichi"
      },
      {
        token: "11w2dz9",
        id: "cleanBeat"
      },
      {
        token: "0oqv0lu",
        id: "clumpyBeat"
      },
      {
        token: "0q39hje",
        id: "contour"
      },
      {
        token: "1420c65",
        id: "coord"
      },
      {
        token: "0cm243q",
        id: "counterpoint"
      },
      {
        token: "0a2f6an",
        id: "dampPiano"
      },
      {
        token: "0sw6k6y",
        id: "decider"
      },
      {
        token: "1exf3tq",
        id: "derivations"
      },
      {
        token: "1p5qlfa",
        id: "drone"
      },
      {
        token: "1cnveoc",
        id: "eBass"
      },
      {
        token: "183y7wy",
        id: "effects"
      },
      {
        token: "0ckwauw",
        id: "fmTexture"
      },
      {
        token: "01qwhre",
        id: "form"
      },
      {
        token: "1wfbz39",
        id: "granu"
      },
      {
        token: "0ejyz79",
        id: "groan"
      },
      {
        token: "0d5w79f",
        id: "harmonyPulse"
      },
      {
        token: "1tcfvwk",
        id: "houseBeat"
      },
      {
        token: "09z06mh",
        id: "jazzBeat"
      },
      {
        token: "0yqb6nl",
        id: "laverne"
      },
      {
        token: "0pcg3o3",
        id: "manage"
      },
      {
        token: "0i67odr",
        id: "memory"
      },
      {
        token: "0mdunfa",
        id: "methenyChord"
      },
      {
        token: "14nug5k",
        id: "methenyMelody"
      },
      {
        token: "00vbfsx",
        id: "mhBeat"
      },
      {
        token: "15owse5",
        id: "mhBeatsynth"
      },
      {
        token: "0p94oqd",
        id: "mhDrone"
      },
      {
        token: "0efr9wj",
        id: "midiAnalyzer"
      },
      {
        token: "1azybke",
        id: "midiBot"
      },
      {
        token: "19p5rxp",
        id: "midiGuitarInput"
      },
      {
        token: "05mk472",
        id: "miles"
      },
      {
        token: "12n8yn1",
        id: "modal"
      },
      {
        token: "1vdi2ry",
        id: "monitorMessages"
      },
      {
        token: "0bghjwf",
        id: "mozartChord"
      },
      {
        token: "0dle2jv",
        id: "msynth"
      },
      {
        token: "1j12n4l",
        id: "multiSynth"
      },
      {
        token: "18tllte",
        id: "newBeat"
      },
      {
        token: "0lfm6sc",
        id: "newDrone"
      },
      {
        token: "1xn5pme",
        id: "noiseBeat"
      },
      {
        token: "1nyi8a0",
        id: "ornament"
      },
      {
        token: "16mwq9d",
        id: "pad"
      },
      {
        token: "0stv4wx",
        id: "papMelody"
      },
      {
        token: "0a1f7ft",
        id: "papMelody2"
      },
      {
        token: "0aleetr",
        id: "papMelody4"
      },
      {
        token: "0ln87n1",
        id: "papPerc"
      },
      {
        token: "19ib16o",
        id: "perc"
      },
      {
        token: "1hm65x9",
        id: "plex"
      },
      {
        token: "0y49rsk",
        id: "prockRock"
      },
      {
        token: "1p8ii68",
        id: "reassignMessages"
      },
      {
        token: "060b109",
        id: "reichGuitar"
      },
      {
        token: "05ovom9",
        id: "resynth"
      },
      {
        token: "1736z75",
        id: "rhodes"
      },
      {
        token: "0e4gd04",
        id: "rsynth"
      },
      {
        token: "1lkdwh1",
        id: "rungler"
      },
      {
        token: "0uychbi",
        id: "sampleBeat"
      },
      {
        token: "1c5492a",
        id: "seasonsArpy"
      },
      {
        token: "1mchgfb",
        id: "seasonsBrokenChord"
      },
      {
        token: "1soqn28",
        id: "seasonsChord"
      },
      {
        token: "0xbpohc",
        id: "seasonsDrone"
      },
      {
        token: "0gb4fdb",
        id: "seasonsSussy"
      },
      {
        token: "0vdk4ux",
        id: "sequencer"
      },
      {
        token: "09i7h6c",
        id: "serverBot"
      },
      {
        token: "0us7z8r",
        id: "snapBass"
      },
      {
        token: "154vvte",
        id: "space"
      },
      {
        token: "16cni4g",
        id: "splatterBass"
      },
      {
        token: "1yaqkib",
        id: "sweeper"
      },
      {
        token: "1m2sepw",
        id: "swingChord"
      },
      {
        token: "18vwixd",
        id: "synthBass"
      },
      {
        token: "19l18sa",
        id: "tangerineDream"
      },
      {
        token: "0kr46xz",
        id: "templateBot"
      },
      {
        token: "1wahyxz",
        id: "texture"
      },
      {
        token: "0wr4rjl",
        id: "tonic"
      },
      {
        token: "0xqas7e",
        id: "tune"
      },
      {
        token: "06u8799",
        id: "valenceArousal"
      },
      {
        token: "0oqg9xz",
        id: "video"
      },
      {
        token: "1efyb24",
        id: "vinyl"
      },
      {
        token: "1rtk17o",
        id: "walkingBass"
      },
      {
        token: "1rxzyz7",
        id: "webBot"
      },
      {
        token: "0f2gzhv",
        id: "whiny"
      },
      {
        token: "0dktkuq",
        id: "wind"
      },
      {
        token: "0lcgkze",
        id: "wub"
      },
      {
        token: "0r6xd7j",
        id: "xBass"
      },
      {
        token: "0g2z1t2",
        id: "xChord"
      },
      {
        token: "1wyw8v8",
        id: "xDrum"
      },
      {
        token: "08bqspt",
        id: "xPad"
      },
      {
        token: "0cfvfjk",
        id: "xPerc"
      },
      {
        token: "0pt2dxi",
        id: "xProducer"
      },
      {
        token: "0f192eh",
        id: "xSequencer"
      }
    ]
  };

  // public/shared/spatialization.js
  var SPATIALIZATION_CONFIG = Object.freeze({
    minimumGain: 0.2,
    nearCutoffHz: 18e3,
    farCutoffHz: 1600,
    filterQ: 0.55,
    rampSeconds: 0.14,
    updateIntervalMs: 80
  });
  function wrappedAxisDistance(left, right, period) {
    const size = Math.max(1, Number(period) || 1), raw = Math.abs(Number(left) - Number(right)) % size;
    return Math.min(raw, size - raw);
  }
  function spatialAttenuation(listener, source, period, config = SPATIALIZATION_CONFIG) {
    const size = Math.max(1, Number(period) || 1), dx = wrappedAxisDistance(listener.x, source.x, size), dy = wrappedAxisDistance(listener.y, source.y, size), normalizedDistance = Math.max(0, Math.min(1, Math.hypot(dx, dy) / (size / Math.SQRT2))), falloff = normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance), minimumGain = Math.max(0, Math.min(1, Number(config.minimumGain))), gain = 1 - (1 - minimumGain) * falloff, near = Math.max(40, Number(config.nearCutoffHz) || 18e3), far = Math.max(40, Math.min(near, Number(config.farCutoffHz) || 1600)), cutoffHz = near * Math.pow(far / near, falloff);
    return { gain, cutoffHz, normalizedDistance, falloff };
  }

  // integrations/bio-signal-towers.js
  var ROOM = "signal-towers";
  var QUERY_KEY = "signals";
  var MAX_TOWERS = 24;
  var ensemble = new ClientEnsemble();
  var runtimes = /* @__PURE__ */ new Map();
  var sharedAudioContext = null;
  var audioStateTransitions = [];
  function towerAudioContext() {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContext({ latencyHint: "interactive" });
      const record = () => {
        audioStateTransitions.push({ at: Math.round(performance.now()), state: sharedAudioContext.state });
        if (audioStateTransitions.length > 32) audioStateTransitions.shift();
        if (sharedAudioContext.state === "interrupted")
          console.warn("Signal-tower audio context interrupted by the browser or operating system");
      };
      sharedAudioContext.addEventListener("statechange", record);
      record();
    }
    return sharedAudioContext;
  }
  function syncWebsiteAudioFocus() {
    var _a;
    const sounding = [...runtimes.values()].some((runtime) => !runtime.item.messageOnly);
    const context = sounding ? towerAudioContext() : sharedAudioContext;
    if (context) for (const runtime of runtimes.values()) (_a = runtime.audio).ctx || (_a.ctx = context);
    window.MH_ISO?.setMusebotAudioActive?.(sounding, context);
  }
  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  var tokenCatalog = signal_tower_tokens_default.bots.flatMap(({ token, id }) => AGENTS[id] ? [{
    token,
    id,
    label: AGENTS[id].name,
    category: AGENTS[id].category,
    description: AGENTS[id].description,
    performanceType: AGENTS[id].performanceType,
    messageOnly: AGENTS[id].performanceType === "silent"
  }] : []).sort(
    (a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
  );
  var catalog = tokenCatalog.filter(
    (item) => item.performanceType !== "incomplete" && (item.messageOnly || AGENTS[item.id].outputModes.includes("synth"))
  );
  var byToken = new Map(tokenCatalog.map((item) => [item.token, item]));
  if (byToken.size !== tokenCatalog.length) throw new Error("Musebot tower token collision");
  var agentIds = Object.values(AGENTS).map((agent) => agent.id);
  if (tokenCatalog.length !== agentIds.length || agentIds.some((id) => !tokenCatalog.some((item) => item.id === id)))
    throw new Error("Signal-tower token manifest does not cover every Musebot");
  function encodeState(records) {
    const json = JSON.stringify({
      v: 1,
      t: records.map((item) => [item.uid, item.tx, item.ty, item.botToken || ""])
    });
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }
  function decodeState(value) {
    if (!value) return [];
    try {
      const padded = String(value).replaceAll("-", "+").replaceAll("_", "/");
      const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (parsed?.v !== 1 || !Array.isArray(parsed.t)) return [];
      return parsed.t.slice(0, MAX_TOWERS).flatMap((row, index) => {
        if (!Array.isArray(row) || row.length < 4) return [];
        const tx = Number(row[1]), ty = Number(row[2]), token = String(row[3] || "");
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return [];
        return [{
          uid: String(row[0] || `s${index + 1}`).slice(0, 24),
          tx: Math.round(tx),
          ty: Math.round(ty),
          type: "signal",
          botToken: byToken.has(token) ? token : ""
        }];
      });
    } catch {
      return [];
    }
  }
  var TowerRuntime = class {
    constructor(building, item) {
      this.uid = building.uid;
      this.item = item;
      this.state = "loading";
      this.unlocked = false;
      this.lastBeatAt = -Infinity;
      this.socket = ensemble.connect();
      this.audio = new AudioEngine({ clientOnly: true, context: sharedAudioContext });
      this.audio.configure(AGENTS[item.id], "synth").catch(() => {
      });
      const send = (address, args = []) => {
        if (this.socket.readyState !== LOCAL_SOCKET_OPEN) return;
        this.socket.send(JSON.stringify({ type: "protocol", address, args }));
      };
      this.bot = AGENTS[item.id].create(send, this.audio);
      this.bot.setIdentity?.(`tower:${this.uid}:${item.token}`);
      this.socket.addEventListener("open", () => {
        this.socket.send(JSON.stringify({
          type: "join",
          room: ROOM,
          agent: `tower:${this.uid}:${item.token}`
        }));
      });
      this.socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "welcome") this.state = this.unlocked ? "playing" : "ready";
        if (message.type === "protocol")
          this.bot.onMessage?.(normalizeProtocolMessage(message));
        if (message.type === "clock") {
          if (message.beatStart) this.lastBeatAt = performance.now();
          if (!this.item.messageOnly && (!this.unlocked || this.audio.ctx?.state !== "running")) return;
          if (!this.item.messageOnly) this.audio.beginTick(
            message.tick,
            message.bpm,
            message.meter?.subdivision || 4,
            message
          );
          this.bot.onTick?.(message.tick, message);
        }
      });
      Promise.resolve(this.bot.start?.()).catch((error) => {
        this.state = "error";
        console.error("Signal tower Musebot failed", error);
      });
    }
    async unlock() {
      var _a;
      if (this.item.messageOnly) {
        this.unlocked = true;
        this.state = "playing";
        return;
      }
      (_a = this.audio).ctx || (_a.ctx = towerAudioContext());
      if (this.unlocked && this.audio.ctx?.state === "running") return;
      try {
        await this.audio.start(true);
        this.audio.clock?.reset();
        this.unlocked = true;
        this.state = "playing";
      } catch {
        this.state = "blocked";
      }
    }
    stop() {
      this.bot.stop?.();
      this.audio.stop?.();
      this.socket.close();
      this.state = "stopped";
    }
  };
  function ensure(building) {
    const item = byToken.get(building.botToken);
    const current = runtimes.get(building.uid);
    if (!item) {
      current?.stop();
      runtimes.delete(building.uid);
      return;
    }
    if (current?.item.token === item.token) return current;
    current?.stop();
    configureRandomSeed(stableHash(`${building.uid}:${item.token}`));
    const runtime = new TowerRuntime(building, item);
    runtimes.set(building.uid, runtime);
    syncWebsiteAudioFocus();
    return runtime;
  }
  function reflect(buildings) {
    const towers = buildings.filter((building) => building.type === "signal");
    try {
      const url = new URL(location.href);
      if (towers.length) url.searchParams.set(QUERY_KEY, encodeState(towers));
      else url.searchParams.delete(QUERY_KEY);
      history.replaceState(history.state, "", url.href);
    } catch {
    }
    for (const tower of towers) ensure(tower);
    for (const [uid, runtime] of runtimes)
      if (!towers.some((tower) => tower.uid === uid)) {
        runtime.stop();
        runtimes.delete(uid);
      }
    syncWebsiteAudioFocus();
  }
  function restore(buildings) {
    let value = "";
    try {
      value = new URL(location.href).searchParams.get(QUERY_KEY) || "";
    } catch {
    }
    const existing = new Set(buildings.filter((building) => building.type === "signal").map((building) => building.uid));
    for (const tower of decodeState(value)) if (!existing.has(tower.uid)) {
      buildings.push(tower);
      existing.add(tower.uid);
    }
    for (const tower of buildings.filter((building) => building.type === "signal"))
      ensure(tower);
  }
  function nextUid(buildings) {
    let index = 1;
    const used = new Set(buildings.map((building) => building.uid));
    while (used.has(`s${index}`)) index++;
    return `s${index}`;
  }
  function remove(building) {
    const runtime = runtimes.get(building.uid);
    runtime?.stop();
    runtimes.delete(building.uid);
    syncWebsiteAudioFocus();
  }
  var lastListenerUpdate = -Infinity;
  function updateListener(x, y, period, buildings) {
    const now = performance.now();
    if (now - lastListenerUpdate < SPATIALIZATION_CONFIG.updateIntervalMs) return;
    lastListenerUpdate = now;
    const size = Math.max(1, Number(period) || 1), listenerX = Number(x), listenerY = Number(y);
    if (!Number.isFinite(listenerX) || !Number.isFinite(listenerY)) return;
    const byUid = new Map(buildings.filter((building) => building.type === "signal").map((building) => [building.uid, building]));
    for (const runtime of runtimes.values()) {
      const tower = byUid.get(runtime.uid);
      if (!tower || runtime.item.messageOnly) continue;
      const attenuation = spatialAttenuation(
        { x: listenerX, y: listenerY },
        { x: Number(tower.tx), y: Number(tower.ty) },
        size
      );
      runtime.distanceGain = attenuation.gain;
      runtime.distanceCutoffHz = attenuation.cutoffHz;
      runtime.audio.setSpatialAttenuation?.(
        { ...attenuation, q: SPATIALIZATION_CONFIG.filterQ },
        SPATIALIZATION_CONFIG.rampSeconds
      );
    }
  }
  function setBot(building, token, buildings) {
    building.botToken = byToken.has(token) ? token : "";
    ensure(building)?.unlock();
    reflect(buildings);
  }
  function createSelector() {
    const overlay = document.createElement("div");
    overlay.id = "mh-signal-selector";
    overlay.hidden = true;
    overlay.innerHTML = `<div class="mh-signal-panel" role="dialog" aria-modal="true" aria-labelledby="mh-signal-title">
    <button class="mh-signal-close" type="button" aria-label="Close">\xD7</button>
    <p class="mh-signal-kicker">SIGNAL TOWER</p>
    <h2 id="mh-signal-title">Choose a Musebot</h2>
    <p class="mh-signal-help">Each tower hosts one independent agent. Towers on this page share a clock and Musebot Protocol room.</p>
    <label class="mh-signal-search-label">Find a bot<input class="mh-signal-search" type="search" autocomplete="off"></label>
    <div class="mh-signal-list"></div>
  </div>`;
    const style = document.createElement("style");
    style.textContent = `
    #mh-signal-selector{position:fixed;inset:0;z-index:30;background:rgba(5,8,14,.72);display:grid;place-items:center;padding:18px;font-family:var(--mh-ui,system-ui,sans-serif)}
    #mh-signal-selector[hidden]{display:none}.mh-signal-panel{position:relative;width:min(620px,94vw);max-height:86vh;overflow:auto;background:#fff;color:#20242a;border:1px solid #d9d9d9;border-radius:24px 7px 24px 7px;padding:22px;box-shadow:0 20px 70px rgba(0,0,0,.38)}
    .mh-signal-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:26px;cursor:pointer}.mh-signal-kicker{margin:0 0 5px;font-size:11px;font-weight:800;letter-spacing:.15em;color:#5b2a86}.mh-signal-panel h2{margin:0 0 7px}.mh-signal-help{margin:0 28px 16px 0;line-height:1.45;color:#555}
    .mh-signal-search-label{display:grid;gap:5px;font-size:12px;font-weight:800}.mh-signal-search{font:inherit;font-size:15px;padding:9px 11px;border:1px solid #bbb;border-radius:10px}.mh-signal-list{display:grid;gap:6px;margin-top:12px}.mh-signal-option{text-align:left;border:1px solid #ddd;background:#f8f9fb;border-radius:14px 5px 14px 5px;padding:9px 11px;cursor:pointer}.mh-signal-option:hover,.mh-signal-option:focus{background:#c3f0ff;outline:none}.mh-signal-option strong,.mh-signal-option small{display:block}.mh-signal-option small{margin-top:2px;color:#666}.mh-signal-category{margin:12px 0 2px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5b2a86}
  `;
    document.head.append(style);
    document.body.append(overlay);
    return overlay;
  }
  var selectedBuilding = null;
  var selectedBuildings = null;
  var selector = null;
  function openSelector(building, buildings) {
    selector || (selector = createSelector());
    selectedBuilding = building;
    selectedBuildings = buildings;
    const input = selector.querySelector(".mh-signal-search");
    const list = selector.querySelector(".mh-signal-list");
    const render = () => {
      const query = input.value.trim().toLowerCase();
      list.replaceChildren();
      let category = null;
      for (const item of catalog.filter((entry) => !query || `${entry.label} ${entry.category} ${entry.description}`.toLowerCase().includes(query))) {
        if (item.category !== category) {
          category = item.category;
          const heading = document.createElement("div");
          heading.className = "mh-signal-category";
          heading.textContent = category;
          list.append(heading);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mh-signal-option";
        button.dataset.token = item.token;
        button.innerHTML = `<strong></strong><small></small>`;
        button.querySelector("strong").textContent = item.label;
        button.querySelector("small").textContent = `${item.messageOnly ? "Messages only \xB7 " : "Sounding \xB7 "}${item.description}`;
        list.append(button);
      }
    };
    input.oninput = render;
    selector.onclick = (event) => {
      if (event.target === selector || event.target.closest(".mh-signal-close")) {
        selector.hidden = true;
        return;
      }
      const option = event.target.closest(".mh-signal-option");
      if (option && selectedBuilding) {
        setBot(selectedBuilding, option.dataset.token, selectedBuildings);
        selector.hidden = true;
      }
    };
    input.value = "";
    render();
    selector.hidden = false;
    setTimeout(() => input.focus(), 0);
  }
  async function unlock() {
    await Promise.all([...runtimes.values()].map((runtime) => runtime.unlock()));
  }
  window.MH_MUSEBOTS = {
    restore,
    reflect,
    remove,
    openSelector,
    unlock,
    updateListener,
    nextUid,
    catalog: () => catalog.map(({ token, label, category, description, messageOnly }) => ({ token, label, category, description, messageOnly })),
    hasActive: () => runtimes.size > 0,
    hasSounding: () => [...runtimes.values()].some((runtime) => !runtime.item.messageOnly),
    diagnostics: () => ({
      contextState: sharedAudioContext?.state || "not-created",
      contextTransitions: audioStateTransitions.map((item) => ({ ...item })),
      towers: [...runtimes.values()].map((runtime) => ({
        uid: runtime.uid,
        bot: runtime.item.label,
        state: runtime.state,
        limiterReductionDb: Number(runtime.audio.limiter?.reduction || 0),
        masterGain: Number(runtime.audio.master?.gain.value || 0),
        distanceGain: Number(runtime.distanceGain ?? 1),
        distanceCutoffHz: Number(runtime.distanceCutoffHz ?? SPATIALIZATION_CONFIG.nearCutoffHz)
      }))
    }),
    stateFor(uid) {
      const runtime = runtimes.get(uid);
      return runtime ? {
        state: runtime.state,
        label: runtime.item.label,
        beat: Math.max(0, 1 - (performance.now() - runtime.lastBeatAt) / 260)
      } : { state: "unassigned", label: "Choose a Musebot", beat: 0 };
    }
  };
  window.dispatchEvent(new CustomEvent("mh-musebots-ready"));
})();
