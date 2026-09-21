#!/usr/bin/env python3
"""Capture frames from one panel of a proposal sheet.

Every sheet in brand/backstage/slimes/ exposes redraw(t), which paints every panel at a
time we choose. That makes a screen recording unnecessary: the page can be
stepped at an exact frame rate and each frame read straight off the canvas, so
there is no cursor, no dropped frame, and no window chrome. This drives that
through headless Chrome and writes PNG frames; to-gif.sh turns them into a GIF.

    python3 brand/backstage/capture-panel.py --sheet brand/backstage/slimes/prey-proposals.html --list
    python3 brand/backstage/capture-panel.py --sheet ... --panel "Congeries" --frames /tmp/f

A panel is matched when every word of the query appears in its caption, in any
order and ignoring case, so "zoogs grazing" is enough. Where several match (a
design appears once per skin), the first is taken.
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DRIVER = """<!doctype html><meta charset="utf-8"><title>capture</title>
<style>html,body{margin:0;background:#fff}iframe{border:0}</style>
<pre id="out">pending</pre>
<iframe id="f" src="%(sheet)s" style="width:1400px;height:%(height)dpx"></iframe>
<script>
const WANT = %(want)s, LIST = %(list)s, FPS = %(fps)s, N = %(frames)d, T0 = %(t0)s;
function api(w) {
  for (const k of ["MH_ASSETS","MH_TOWER_PAGE","MH_SLIME2D_PAGE","MH_SHOG_PAGE","MH_PREY_PAGE"])
    if (w[k] && typeof w[k].redraw === "function") return w[k];
  return null;
}
function caption(fig) {
  const c = fig.querySelector("figcaption");
  return c ? c.textContent.replace(/\\s+/g, " ").trim() : "";
}
function go() {
  const out = {};
  try {
    const w = document.getElementById("f").contentWindow;
    const d = document.getElementById("f").contentDocument;
    const A = api(w);
    if (!A) throw new Error("this page exposes no redraw(t) hook");
    const figs = [...d.querySelectorAll("figure.panel")].filter(f => f.querySelector("canvas"));
    if (LIST) {
      out.panels = figs.map(caption);
      document.getElementById("out").textContent = JSON.stringify(out);
      return;
    }
    // every word of the query has to appear, so "zoogs grazing" is enough and
    // the order and punctuation of the caption do not matter
    const words = WANT.toLowerCase().split(/\s+/).filter(Boolean);
    const fig = figs.find(f => { const c = caption(f).toLowerCase(); return words.every(t => c.includes(t)); });
    if (!fig) throw new Error("no panel matching " + JSON.stringify(WANT));
    const cv = fig.querySelector("canvas");
    out.matched = caption(fig);
    out.size = [cv.width, cv.height];
    out.frames = [];
    for (let i = 0; i < N; i++) {
      A.redraw(T0 + i / FPS);                    // our clock, not the wall's
      out.frames.push(cv.toDataURL("image/png"));
    }
  } catch (e) { out.error = String(e && e.message || e); }
  document.getElementById("out").textContent = JSON.stringify(out);
}
document.getElementById("f").addEventListener("load", () => setTimeout(go, %(settle)d));
setTimeout(go, %(settle)d + 2500);
</script>
"""


def run(args):
    sheet = os.path.abspath(args.sheet)
    if not os.path.exists(sheet):
        sys.exit("no such sheet: " + sheet)
    if not os.path.exists(CHROME):
        sys.exit("Google Chrome is required")
    frames = 1 if args.list else max(1, round(float(args.seconds) * float(args.fps)))
    html = DRIVER % {
        "sheet": "file://" + sheet,
        "want": json.dumps(args.panel or ""),
        "list": "true" if args.list else "false",
        "fps": float(args.fps),
        "frames": frames,
        "t0": float(args.t0),
        "settle": int(args.settle),
        # tall enough that no panel is culled by the sheets' viewport check
        "height": 20000,
    }
    with tempfile.TemporaryDirectory() as tmp:
        driver = os.path.join(tmp, "driver.html")
        with open(driver, "w", encoding="utf-8") as fh:
            fh.write(html)
        cmd = [
            CHROME, "--headless", "--disable-gpu", "--allow-file-access-from-files",
            "--force-device-scale-factor=%s" % args.scale,
            "--window-size=1400,1000",
            "--virtual-time-budget=%d" % (8000 + frames * 120),
            "--dump-dom", "file://" + driver,
        ]
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=600).stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if not m:
        sys.exit("the page produced nothing; try a larger --settle")
    import html as _html
    data = json.loads(_html.unescape(m.group(1)))
    if data.get("error"):
        sys.exit(data["error"])
    if args.list:
        seen = []
        for name in data.get("panels", []):
            if name not in seen:
                seen.append(name)
        print("%d panels on %s:" % (len(seen), os.path.basename(sheet)))
        for name in seen:
            print("  " + name)
        return
    os.makedirs(args.frames, exist_ok=True)
    for i, url in enumerate(data["frames"], 1):
        raw = base64.b64decode(url.split(",", 1)[1])
        with open(os.path.join(args.frames, "f%04d.png" % i), "wb") as fh:
            fh.write(raw)
    print("%s: %d frames at %sx%s -> %s"
          % (data["matched"], len(data["frames"]), data["size"][0], data["size"][1], args.frames),
          file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", required=True)
    ap.add_argument("--panel")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--fps", default=16)
    ap.add_argument("--seconds", default=2.5)
    ap.add_argument("--t0", default=0.0, help="the clock value the first frame is painted at")
    ap.add_argument("--scale", default=2, help="device pixel ratio; the sheets cap their backing store at 2")
    ap.add_argument("--settle", default=1200, type=int, help="ms to let the sheet boot")
    ap.add_argument("--frames", default="frames")
    run(ap.parse_args())
