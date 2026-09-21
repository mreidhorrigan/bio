# backstage

Everything in `brand/` that the site does not load.

| | |
|---|---|
| `slimes/` | The design sheets: the two extracted slime views, every drawn asset in the world, and the proposal sheets for signal towers, the slime in 2D, shoggoths and prey. Open `slimes/index.html`. |
| `to-gif.sh`, `capture-panel.py` | Turn a screen recording or a single panel from those sheets into a GIF. |
| `favicon-slime.svg` | The logo, in vector. Everything in `vimeo/` is built from it. |
| `vimeo/` | The logo rasterised for Vimeo, which takes JPEG, PNG and GIF but never SVG. |
| `house-style.md` | The written and visual house style. |
| `tokens.json`, `pentad.py` | The design tokens and the script that works with them. |
| `gif/` | Output. Not tracked. |

## Making a GIF

    sh brand/backstage/to-gif.sh movie brand/backstage/Untitled.mov
    sh brand/backstage/to-gif.sh panels brand/backstage/slimes/prey-proposals.html
    sh brand/backstage/to-gif.sh panel  brand/backstage/slimes/prey-proposals.html "zoogs grazing"

**movie** takes anything ffmpeg reads and runs the two-pass palette route, which
is the difference between a GIF that looks like the recording and one that looks
like 1998. `START` and `DURATION` trim it:

    START=0.5 DURATION=2 sh brand/backstage/to-gif.sh movie brand/backstage/Untitled.mov out.gif 20 640

**panel** skips recording altogether. Every sheet exposes `redraw(t)`, so the
page is stepped at an exact frame rate and each frame is read straight off the
canvas: no cursor, no window chrome, no dropped frames, and a clock we control.
`FPS`, `SECONDS_LONG` and `SCALE` tune it:

    FPS=20 SECONDS_LONG=3 sh brand/backstage/to-gif.sh panel brand/backstage/slimes/shoggoth-proposals.html "congeries roused"

A panel matches when every word of the query appears in its caption, in any
order and ignoring case. `panels` lists what a sheet has.

Needs `ffmpeg` (brew install ffmpeg); panel mode also needs Google Chrome.
