import assert from "node:assert/strict";
import test from "node:test";
import { SeededRng, circlesOverlap, wrap, wrappedDelta, wrappedDistance } from "./world-math.mjs";

test("toroidal fixture behaviour", () => {
  assert.equal(wrap(-1, 54), 53);
  assert.equal(wrappedDelta(53, 54), -1);
  assert.equal(wrappedDelta(27, 54), 27);
  assert.ok(Math.abs(wrappedDistance(53, 2, 1, 2, 54) - 2) < 1e-12);
  assert.equal(circlesOverlap(53.8, 2, 0.3, 0.1, 2, 0.2, 54), true);
});

test("seeded fixture path is repeatable and bounded", () => {
  const left = new SeededRng(42), right = new SeededRng(42);
  for (let i = 0; i < 128; i++) assert.equal(left.nextU32(), right.nextU32());
  for (let i = 0; i < 128; i++) assert.ok(left.next() >= 0 && left.next() < 1);
});
