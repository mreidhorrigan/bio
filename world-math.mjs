export function wrap(value, period) {
  if (!Number.isFinite(value) || !Number.isFinite(period) || period <= 0) return NaN;
  return ((value % period) + period) % period;
}

export function wrappedDelta(delta, period) {
  const value = wrap(delta, period);
  return value > period / 2 ? value - period : value;
}

export function wrappedDistance(ax, ay, bx, by, period) {
  return Math.hypot(wrappedDelta(bx - ax, period), wrappedDelta(by - ay, period));
}

export function circlesOverlap(ax, ay, ar, bx, by, br, period) {
  const dx = wrappedDelta(bx - ax, period), dy = wrappedDelta(by - ay, period);
  const radius = Math.max(0, ar) + Math.max(0, br);
  return dx * dx + dy * dy < radius * radius;
}

export class SeededRng {
  constructor(seed) { this.state = (seed >>> 0) || 0x6d2b79f5; }
  nextU32() {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (this.state = x >>> 0);
  }
  next() { return this.nextU32() / 0x100000000; }
}
