# Landscapes

Background decoration for `glossary.html`, generated elsewhere and copied here
as finished art. **Nothing in this folder was drawn by hand or regenerated for
this site.** It comes from the CANVAS_AUTOMATION project, where a procedural
renderer grows these:

| File | What it is | Where it came from |
|---|---|---|
| `treescape.svg` | A grown landscape: trees, undergrowth, water, sand. "26 seconds of simulated succession, drawn by the Planetary Ecology vector renderer." | `courses/iat210/course/assets/ornaments/week-13-p-readings.svg` |
| `ruined-skyline-a.svg` | A destroyed cityscape in three seeded depth layers: building widths, heights, damaged roof profiles, gaps, and the windows that survived. | `out/procedural-landscape-prototypes/ruined-skyline.svg` |
| `ruined-skyline-b.svg` | The same generator, a different seed. | `out/procedural-landscape-prototypes/ruined-skyline-03.svg` |

The generators are `scripts/procedural_art/` in that project, and the write-up
is `research/14-procedural-footer-landscape-prototypes.md`. To change the art,
regenerate it there and copy the result here.

## The one edit made to the copies

The two skylines carried a `viewBox` and no `width`/`height`. An image with no
intrinsic size does not reliably rasterise onto a canvas, so the copies state
the size their own `viewBox` already implied (1200 by 168). No path, colour, or
seed was touched.

## How the page uses them

`glossary-world.js` loads each one as an image, tints it twice (once for the
daylight, once for the dark), and draws it as a parallax band. The treescape
stands behind the daylight half of the circuit; the skylines are the buried city
on the floor of the cave. Their internal CSS animation does not run when an
image is drawn onto a canvas, which is what we want: they are scenery, and the
world already moves.
