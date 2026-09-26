// wayfinding.test.mjs: the markers that show which way the village's houses are.
//
//   node --test wayfinding.test.mjs
//
// wayfinding.js (MH_WAYFINDING) places them: in the iso village on the frame's edge
// toward each house (edge), in the 3D village at the left or right edge by the side
// the house lies on, high ahead and low behind (sides); both views draw them with
// its mark() and have no marker code of their own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("./" + f, import.meta.url), "utf8");
const win = {};
new Function("window", read("wayfinding.js"))(win);
const WF = win.MH_WAYFINDING, W = 1000, H = 700;

test("iso: on the frame's edge, toward the house", () => {
  const [r, l, u] = WF.edge(W, H, [{ x: 3000, y: 350 }, { x: -500, y: 350 }, { x: 500, y: -900 }]);
  assert.equal(Math.round(r.x), W - WF.MARGIN); assert.equal(Math.round(r.y), 350); assert.ok(Math.abs(r.a) < 1e-9, "points right");
  assert.equal(Math.round(l.x), WF.MARGIN); assert.ok(Math.abs(Math.abs(l.a) - Math.PI) < 1e-9, "points left");
  assert.equal(Math.round(u.y), WF.MARGIN); assert.ok(u.a < 0, "points up");
});

test("3D: left or right by the side the house lies on; ahead high, behind low", () => {
  const [right, left, ahead, behind] = WF.sides(W, H, [Math.PI / 2, -Math.PI / 2, 0.05, Math.PI - 0.05]);
  assert.equal(right.x, W - WF.MARGIN); assert.equal(left.x, WF.MARGIN);
  assert.ok(Math.cos(right.a) > 0 && Math.cos(left.a) < 0, "each arrow points out of its own side");
  assert.ok(ahead.y < right.y && right.y < behind.y, "ahead high, abeam in the middle, behind low");
  assert.ok(Math.sin(ahead.a) < 0 && Math.sin(behind.a) > 0, "the arrow tilts up ahead, down behind");
  for (const m of [right, left, ahead, behind]) assert.ok(m.y >= WF.MARGIN && m.y <= H - WF.MARGIN, "inside the frame");
});

test("3D: markers on one side never overlap, and stay inside the frame", () => {
  const ms = WF.sides(W, H, [3.1, 3.12, 3.13, 3.14, 3.0, 2.9]);   // six houses nearly straight behind, on the right
  const ys = ms.map((m) => m.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= WF.GAP - 1e-9, "a GAP apart");
  assert.ok(ys[0] >= WF.MARGIN && ys[ys.length - 1] <= H - WF.MARGIN, "inside the frame");
});

test("both views draw the markers through wayfinding.js, with no marker code of their own", () => {
  const iso = read("engine.js"), v3 = read("slimeverse3d-page.js");
  assert.match(iso, /MH_WAYFINDING[\s\S]{0,400}\.edge\(/, "engine.js places them with edge()");
  assert.match(v3, /MH_WAYFINDING[\s\S]{0,1600}\.sides\(/, "slimeverse3d-page.js places them with sides()");
  for (const [name, src] of [["engine.js", iso], ["slimeverse3d-page.js", v3]]) {
    assert.match(src, /\.mark\(/, name + " draws them with mark()");
    assert.doesNotMatch(src, /lineTo\(8, -6\)/, name + " has no arrow of its own");
  }
  for (const page of ["index.html", "slimeverse3d.html"]) assert.match(read(page), /src="wayfinding\.js"/, page + " loads wayfinding.js");
});
