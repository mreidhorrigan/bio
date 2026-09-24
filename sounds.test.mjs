// sounds.test.mjs: the worlds' sound design stays whole.
//
//   node --test sounds.test.mjs
//
// sounds.js is the one place the worlds' sounds are defined (MH_SOUNDS.RECIPES);
// the iso village (engine.js) and the 3D slimeverse (verse3d.js) only play them by
// name. These checks keep it so: a sound one view plays that the file does not
// have, a view making tones of its own again (the step once drifted between the
// two), a creature's voice losing the shape M. gave it, or a recipe too quiet to
// hear, all fail here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const window = {};
new Function("window", readFileSync(new URL("./sounds.js", import.meta.url), "utf8"))(window);
const { RECIPES } = window.MH_SOUNDS;
const read = (f) => readFileSync(new URL("./" + f, import.meta.url), "utf8");

test("every sound the worlds play is a recipe in sounds.js", () => {
  const iso = read("engine.js"), v3 = read("verse3d.js");
  const names = [...iso.matchAll(/\bcue\("(\w+)"/g), ...v3.matchAll(/\bplaySound\("(\w+)"/g)].map((m) => m[1]);
  const voices = /const EAR = [^;]*VOICE = \{([^}]*)\}/.exec(v3);
  assert.ok(voices, "verse3d.js names its creatures' voices (VOICE)");
  names.push(...[...voices[1].matchAll(/:\s*"(\w+)"/g)].map((m) => m[1]));
  assert.ok(names.length >= 10, "the engines play their sounds by name (" + names.length + " found)");
  for (const n of names) assert.ok(RECIPES[n], "no recipe in sounds.js for \"" + n + "\"");
});

test("the worlds make no tones of their own outside sounds.js", () => {
  for (const f of ["engine.js", "verse3d.js"]) assert.ok(!/createOscillator/.test(read(f)), f + " makes its own oscillators: put the sound in sounds.js");
});

test("the creatures' voices keep their shape", () => {
  for (const n of ["blooloo", "teke", "tekeAsk", "lilili"]) assert.ok(RECIPES[n], "the voice " + n + " is there");
  // blooloo: two notes, the high one first, then the low, each holding its pitch (M., 2026-09-24)
  const [bloo, loo] = RECIPES.blooloo.blips;
  assert.equal(RECIPES.blooloo.blips.length, 2, "blooloo is two notes");
  assert.ok(bloo.at < loo.at && bloo.pitch > loo.pitch, "blooloo goes high then low");
  assert.ok(bloo.to == null && loo.to == null, "blooloo's notes hold their pitch, with no slide");
  // teke: four clucks, low, below the key's root (M. likes them there, 2026-09-24)
  assert.equal(RECIPES.teke.blips.length, 4, "teketeke is four clucks");
  for (const b of RECIPES.teke.blips.concat(RECIPES.tekeAsk.blips)) assert.ok(b.pitch < 1, "the teke's clucks stay low, below the root (" + b.pitch + ")");
});

test("every recipe can be heard", () => {
  for (const [n, r] of Object.entries(RECIPES)) {
    assert.ok(r.blips.length, n + " has blips");
    assert.ok(Math.max(...r.blips.map((b) => b.gain)) >= 0.015, n + " is too quiet to hear");
  }
});

test("the step is one sound in both views", () => {
  assert.match(read("engine.js"), /step\(\) \{ cue\("step"\)/, "the iso step plays the step recipe");
  assert.match(read("verse3d.js"), /playSound\("step"\)/, "the 3D step plays the step recipe");
});
