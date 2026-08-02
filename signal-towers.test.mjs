import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("the site loads and integrates the generated signal-tower bundle", async () => {
  const [html, engine, buildings, bundle] = await Promise.all([
    read("index.html"), read("engine.js"), read("buildings.js"), read("signal-towers.js"),
  ]);
  assert.match(html, /addEventListener\("load"/);
  assert.match(html, /script\.src = "signal-towers\.js"; script\.async = true/);
  assert.match(engine, /data-tool="signal"/);
  assert.match(engine, /MH_MUSEBOTS\.restore\(BUILDINGS\)/);
  assert.match(engine, /MH_MUSEBOTS\.reflect\(BUILDINGS\)/);
  assert.match(engine, /restorePlayerFromURL\(\)/);
  assert.match(engine, /searchParams\.set\("slime"/);
  assert.match(engine, /MH_MUSEBOTS\.hasSounding/);
  assert.match(engine, /setMusebotAudioActive/);
  assert.match(engine, /siteAudioDiagnostics/);
  assert.match(engine, /this\.musebotsActive \? 1\.65 : 1/);
  assert.match(engine, /placementCursor\(buildTool\)/);
  assert.match(engine, /MH_MUSEBOTS\.updateListener\(player\.x, player\.y, P, BUILDINGS\)/);
  assert.match(engine, /mh-musebots-ready/);
  assert.match(engine, /state\.beat/);
  assert.match(buildings, /drawSignalTower/);
  assert.match(buildings, /state\.beat/);
  assert.match(bundle, /signal-towers/);
  assert.match(bundle, /Choose a Musebot/);
});
