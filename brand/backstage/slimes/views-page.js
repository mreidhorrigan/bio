// @ts-check
"use strict";
/* views-page.js: the iso world and its 3D view on one page (views.html).

   The iso world (the site's own index.html) runs in a frame; the 3D view sits
   over it. The switch hands the walk from one to the other at the same spot:

   into 3D      the 3D slime starts on the iso slime's tile, facing its way, in
                the iso world's skin; the iso world is hidden but keeps running
                underneath, so its signal towers' Musebots never stop, and the
                towers stand in 3D at their tiles, their lamps lit by the same
                Musebots. While in 3D the towers' sound is placed from the 3D
                slime (MH_MUSEBOTS.updateListener), so it follows the walk.
   back         the iso slime is put where the 3D one got to (MH_ISO.placePlayer)
                and the iso world takes the listener back from the same place.
   Because both views hand over at the same spot, the towers' sound does not
   jump; what changes, their gain ramps smooth, and the pictures cross-fade.
   Towers raised in the iso world keep their address state (?mh-signal=...):
   this page passes its own query on to the frame, so a link can carry them. */
(function () {
  const V = window.MH_VERSE3D, isoF = /** @type {HTMLIFrameElement} */ (document.getElementById("iso"));
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById("view3d")), btn = document.getElementById("switch"), note = document.getElementById("note");
  if (!V || !isoF || !cv || !btn) return;
  let in3d = false;
  const iso = () => /** @type {any} */ (isoF.contentWindow);
  const ISO = () => iso() && iso().MH_ISO, BOTS = () => iso() && iso().MH_MUSEBOTS;
  const towers = () => { const I = ISO(); return I && I.buildings ? I.buildings().filter((b) => b.type === "signal") : []; };
  // the frame gets this page's own query (a skin, towers), so a link to this page can carry the iso world's state
  isoF.src = "../../../index.html" + location.search;

  const W = V.create(cv, {
    keysWhen: () => in3d,
    towers: () => towers().map((b) => ({ uid: b.uid, tx: b.tx, ty: b.ty })),
    towerState: (uid) => (BOTS() && BOTS().stateFor ? BOTS().stateFor(uid) : { state: "unassigned", beat: 0 }),
    onFrame() {                                                // the towers' sound follows the 3D slime
      if (!in3d) return;
      const S = W.S(), B = BOTS(), I = ISO();
      if (!S || !S.tileOf || !B || !B.updateListener || !I) return;
      const [tx, ty] = S.tileOf(W.me.x, W.me.z);
      const [fx, fy] = S.tileDir(W.me.yaw);
      I.placePlayer(tx, ty, fx, fy);                           // the iso slime walks along, unseen: the two never disagree
      B.updateListener(tx, ty, I.hub().period, I.buildings());
      if (note) note.textContent = towers().length + (towers().length === 1 ? " tower" : " towers") + " from the map";
    },
  });
  // @ts-ignore: for probes and the console
  window.MH_VIEWS = { W, in3d: () => in3d, toggle: () => toggle() };

  function to3d() {
    const I = ISO();
    if (!I) return;
    const skin = I.skin ? I.skin() : "technurture", p = I.player();
    W.setSkin(skin); W.load("outdoors");
    const S = W.S(), at = S.fromTile(p.x, p.y);
    W.me.x = at[0]; W.me.z = at[1]; W.me.yaw = S.tileYaw(p.fx || 0, p.fy || 1); W.me.speed = 0;
    W.resume();
    in3d = true; document.body.classList.add("in3d");
    btn.textContent = "Back to the map"; cv.focus({ preventScroll: true });
    // once the fade is done the map stops drawing (display none), but its Musebots play on
    setTimeout(() => { if (in3d) isoF.style.display = "none"; }, 380);
  }
  function toMap() {
    const I = ISO(), S = W.S();
    if (I && S && S.tileOf && W.scene().startsWith("outdoors")) {
      const [tx, ty] = S.tileOf(W.me.x, W.me.z), [fx, fy] = S.tileDir(W.me.yaw);
      I.placePlayer(tx, ty, fx, fy);
    }
    isoF.style.display = "block";
    in3d = false; document.body.classList.remove("in3d");
    btn.textContent = "Walk it in 3D";
    setTimeout(() => { if (!in3d) W.pause(); }, 380);           // once the fade is done
    isoF.focus();
  }
  function toggle() { if (in3d) toMap(); else to3d(); }
  btn.addEventListener("click", toggle);
  W.load("outdoors"); W.run(); W.pause();                      // ready, not drawing until it is shown
})();
