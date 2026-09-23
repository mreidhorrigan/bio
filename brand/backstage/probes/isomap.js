/* The script of the __isomap*.html probes: see __isomap.html. */
/* The 3D outdoors is meant to be the iso world walked in three dimensions:
   the same torus, the same things at the same tiles, the same kind of thing
   for each (a house is a house, the Glossary's wellhead a wellhead), and the
   same land. This asks the RUNNING iso world (index.html, in each skin in turn,
   through window.MH_ISO) what it has placed and where, and compares it with
   that skin's 3D outdoors. */
const say = (t) => { document.getElementById("out").textContent += "\n" + t; };
// every skin in turn: the iso world is loaded in that skin, and the 3D page set to it
const SKINS = window.ISOMAP_SKINS || ["technurture"];      // set by the page: one skin a probe, or the night skin alone outlasts the budget
let k = 0;
const isoF = document.getElementById("iso");
document.getElementById("v3").addEventListener("load", () => next());
function next() {
  if (k >= SKINS.length) { say("errors: none"); document.title = "done"; return; }
  const skin = SKINS[k++];
  isoF.onload = () => setTimeout(() => { run(skin); next(); }, 2500);
  isoF.src = "/index.html?theme=" + skin;
}
function run(skin) {
  say("=== " + skin);
  try {
    const ISO = isoF.contentWindow.MH_ISO, v3 = document.getElementById("v3").contentWindow, W = v3.MH_V3D, V = v3.MH_VERSE3D;
    if (!ISO || !ISO.exhibits || !W) { say("worlds: MISSING"); return; }
    W.pause(); W.setSkin(skin); W.load("outdoors");
    ISO.hub();
    const S = W.S(), hub = ISO.hub();
    const per3 = W.S().period / V.ISO.tile;
    say("skin: iso " + (isoF.contentWindow.localStorage.getItem("mh-skin") || "?") + ", 3D " + W.scene());
    say("torus: iso " + hub.period + " tiles, 3D " + per3 + " tiles of " + V.ISO.tile + " units" + (hub.period === per3 ? "" : " NO"));
    const iso = ISO.exhibits().map((e) => ({ kind: e.structure === "wellhead" ? "wellhead" : "house", title: e.title, dx: e.tx - hub.x, dy: e.ty - hub.y }));
    const mine = S.things().map((t) => ({ kind: t.kind, title: t.title, dx: t.tx - hub.x, dy: t.ty - hub.y }));
    say("things placed: iso " + iso.length + ", 3D " + mine.length + (iso.length === mine.length ? "" : " NO"));
    let bad = 0;
    for (const e of iso) {
      const m = mine.find((t) => t.title === e.title);
      if (!m) { bad++; say("  " + e.title + ": in the iso world, not in 3D NO"); continue; }
      const off = Math.hypot(m.dx - e.dx, m.dy - e.dy);
      if (m.kind !== e.kind || off > 0.1) { bad++; say("  " + e.title + ": iso " + e.kind + " at " + e.dx.toFixed(2) + "," + e.dy.toFixed(2) + " vs 3D " + m.kind + " at " + m.dx.toFixed(2) + "," + m.dy.toFixed(2) + " NO"); }
    }
    for (const m of mine) if (!iso.find((e) => e.title === m.title)) { bad++; say("  " + m.title + ": in 3D, not in the iso world NO"); }
    say("each thing the same kind at the same tile: " + (bad ? bad + " differ NO" : "all " + iso.length));
    if (!S.sea) {                                              // a skin without biomes: a flat board, no lakes, no plants, no creatures
      const flat = [0, 100, -200, 333].every((x) => Math.abs(S.floorAt(x, x * 0.7) - S.floorAt(0, 0)) < 1e-6);
      say("a flat board with no biomes: " + (flat ? "yes" : "NO") + ", plants " + (S.flora || []).length + ", creatures " + (W.zoogs().length + W.shoggoths().length) + ((S.flora || []).length + W.zoogs().length + W.shoggoths().length === 0 ? "" : " NO"));
      return;
    }
    // the land: the biome at 400 tiles across the torus
    let same = 0, n = 0;
    for (let k = 0; k < 400; k++) {
      const tx = (k * 37) % hub.period, ty = (k * 53 + 11) % hub.period;
      const x = (tx - hub.x) * V.ISO.tile, z = (ty - hub.y) * V.ISO.tile;
      n++; if (ISO.biome(tx, ty) === S.biomeAt(x, z)) same++;
    }
    say("biomes agree at " + same + " of " + n + " tiles" + (same === n ? "" : " NO"));
    // lakes: every iso water tile is under the 3D water line at its centre, away from roads and the plaza
    let wet = 0, water = 0;
    for (let k = 0; k < 400; k++) {
      const tx = (k * 37) % hub.period, ty = (k * 53 + 11) % hub.period;
      if (ISO.biome(tx, ty) !== "water" || tx === hub.x || ty === hub.y) continue;
      water++;
      const x = (tx - hub.x) * V.ISO.tile, z = (ty - hub.y) * V.ISO.tile;
      if (W.poolAt(x, z)) wet++;
    }
    say("iso water tiles that are lake in 3D: " + wet + " of " + water + (water && wet >= water * 0.8 ? "" : " NO"));
  } catch (e) { say("EXCEPTION " + e.message + "\n" + e.stack); }
}
