import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("the site loads and integrates the generated signal-tower bundle", async () => {
  const [html, engine, buildings, bundle] = await Promise.all([
    read("index.html"), read("engine.js"), read("buildings.js"), read("signal-towers.js"),
  ]);
  assert.match(html, /addEventListener\("load"/);
  assert.match(html, /script\.src = "signal-towers\.js\?v=[^"]+"; script\.async = true/);
  // the ✎ Build bar draws a button per registered tool: the tower is one of them
  assert.match(engine, /id: "signal", label:/);
  assert.match(engine, /data-tool="\$\{t\.id\}"/);
  assert.match(engine, /MH_MUSEBOTS\.restore\(BUILDINGS\)/);
  assert.match(engine, /MH_MUSEBOTS\.reflect\(BUILDINGS\)/);
  assert.match(engine, /restorePlayerFromURL\(\)/);
  assert.match(engine, /searchParams\.set\("slime"/);
  assert.match(engine, /MH_MUSEBOTS\.hasSounding/);
  assert.match(engine, /setMusebotAudioActive/);
  assert.match(engine, /siteAudioDiagnostics/);
  assert.match(engine, /musebotsActive \? 1\.65 : 1/);
  assert.match(engine, /placementCursor\(buildTool\)/);
  assert.match(engine, /MH_MUSEBOTS\.updateListener\(player\.x, player\.y, P, BUILDINGS\)/);
  assert.match(engine, /mh-musebots-ready/);
  assert.match(engine, /mh-signal-finish-build/);
  assert.match(engine, /state\.beat/);
  assert.match(buildings, /drawSignalTower/);
  assert.match(buildings, /state\.beat/);
  assert.match(bundle, /signal-towers/);
  assert.match(bundle, /Choose a Musebot/);
  assert.match(bundle, /Done building/);
  assert.match(bundle, /mh-signal-finish-build/);
});
