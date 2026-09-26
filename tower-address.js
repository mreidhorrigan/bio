// @ts-check
"use strict";
/* ============================================================================
   tower-address.js  ·  MH_TOWER_ADDRESS  ·  the visitor's signal towers, kept
   ----------------------------------------------------------------------------
   The signal towers a visitor raises in the iso village (engine.js) stand in the
   3D village too (slimeverse3d-page.js). The Musebots bundle (signal-towers.js,
   generated elsewhere) writes them into the address, ?signals=, and reads them
   back from it. An address is easily left behind: the Slimeverse 3D house's own
   link, the site's menu, a page opened and closed. So this tab also keeps a copy
   (sessionStorage), and a page opened with no towers in its address takes them
   from there. It is the same sandbox as before, for this visit only: a new tab or
   a new visit starts with none, and a link that carries towers wins.

     recall()   before the bundle reads the address: no ?signals= there, but
                some kept in this tab? put them in the address. Returns the value
                (or "")
     keep()     after the bundle has written the address (a tower raised, moved,
                given a Musebot or taken away): keep what it holds, or forget
                when it holds none
   ========================================================================== */
(function () {
  const PARAM = "signals", KEY = "mh-signals";
  const session = () => { try { return window.sessionStorage || null; } catch (e) { return null; } };

  function recall() {
    try {
      const u = new URL(location.href), here = u.searchParams.get(PARAM);
      if (here) return here;
      const s = session(), kept = s && s.getItem(KEY);
      if (!kept) return "";
      u.searchParams.set(PARAM, kept);
      history.replaceState(history.state, "", u.href);
      return kept;
    } catch (e) { return ""; }                                  // a restricted history or storage: the address alone
  }

  function keep() {
    try {
      const v = new URL(location.href).searchParams.get(PARAM), s = session();
      if (!s) return;
      if (v) s.setItem(KEY, v); else s.removeItem(KEY);
    } catch (e) { /* storage refused: the address alone */ }
  }

  window.MH_TOWER_ADDRESS = { recall, keep, PARAM, KEY };
})();
