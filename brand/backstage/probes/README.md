# Probes

Throwaway harnesses, kept because the next bug is usually the same shape. Each
one iframes the site and reports numbers into a `<pre>`, so headless Chrome can
answer a question the eye cannot:

| File | The question it answered |
|---|---|
| `__lit.html` | Is the Construction sign lit in gloomthmaxx? It samples the sign's pixels against the unlit background. |
| `__s_technurture.html`, `__s_technoscure.html` | Where do the shoggoths stand in each skin? Used to prove they keep their positions across a skin switch. |
| `__shake2.html` | Does the camera jump when a kiosk card closes? It tracks the camera across the close. |
| `__glossary-cave.html` | Does the walkable glossary hold together? It counts the markers, measures the circuit's seam and its steepest step, checks the cave's mouths and that its roof never lands on a hanging sign, confirms the scenery baked, and samples how dark it is inside. |
| `__glossary.html` | Does the walkable glossary still work? Counts the markers and the word lists, walks the slime to a few of them, checks the card follows, and measures how much darker the cave is. |
| `__glossary-fr.html` | The same page in French: headings, lede, the four translated definitions, the section names, and the card. |
| `__slime3d.html` | Does the 3D cave hold together? At thirty camera samples the camera must be inside the rock, the slime centred; the walls must hold it in; the water must move under it and settle; and the prop, creature, and sign hooks must each add to the frame. |
| `__slime3d-shot.html` | Freezes the 3D cave somewhere for a screenshot. Add `#lit`, `#water`, `#turn`, `#dark` or `#deep`. |
| `__slime3d-cost.html` | The 3D cave's frame cost, measured from outside: time the whole headless run at `#0` and at `#200` ticks and divide the difference, since virtual time freezes the page's own clocks. |
| `__slime3d-perf.html` | Real frame times and the slime's contrast against the ground. Needs a real browser: headless Chrome does not run its frames in real time. |
| `__glossary-waterline.html` | The one waterline: where it falls for each flooded share of the floor, what it does to the living and the dark half, and that every pool shares it and the way in stays dry. |
| `__slime3d-reflection.html` | The slime's reflection while it wades: flipped through the water's level, it must stay upright (under 3 degrees of lean, where flipping each point through the wave beneath it leaned 3.1) and its points may shiver no more than 0.45. |
| `__verse3d.html` | The three places of `slimes/verse3d.html`, outdoors, indoors and the cave: in each the camera must stay in open air and the slime in frame while it walks about, a click must land somewhere walkable, the pool must reflect, and a zoog must shy away from the slime. Nothing may stand inside a solid or inside another creature after a walk, a click at the foot of the frame must send the slime ahead (never round), and walking to a click at the side must not swing the camera; no shoggoth may be indoors. Then the shoggoths must catch a zoog outdoors within a minute, and every way between places (door, wellhead, hatch, rope) must lead where it says. |
| `__verse3d-ways.html` | Every way between the 3D places in all three skins (doors, wellhead, hatch, rope; 56 of them), walked onto after the creatures have moved about, and no place's entry standing inside one of its own ways out (that way would never arm). |
| `__isomap.html` | One thing for one thing, in every skin: loads the running iso world (`index.html?theme=` each skin in turn) and that skin's 3D outdoors, and checks the torus, that every placed thing (kiosk, road-house, junction, wellhead) is in 3D as the same kind of thing at the same tile, the biome at 400 tiles, and that the iso water tiles are lake in 3D; for bureaucore, that the board is flat with no plants and no creatures. |
| `__verse3d-keys.html` | Presses the walk keys as a visitor does (keydown on the page) in each place and measures how far the slime goes, then hurries it a whole lap of the outdoor torus along the road and back onto the plaza from the other side. Three walkers go round the cave ring with wandering steering and must come back to the rope; the eye must be out of sight from behind; and walking must make its sound. |
| `__slimeverse3d.html` | The site's `slimeverse3d.html`: it starts in the Slimeverse 3D house, the door leads out beside that house, a kiosk and a road-house open their cards, the wellhead opens the Glossary, a click opens the page of the house it meets, the hatch leads to the cave, a change of skin keeps the slime and the shoggoths where they stood, and the address round-trips (theme, place, tile). |
| `__slimeverse3d-phone.html` | The site's 3D page at 390 by 800: the lens sees the village (over 38 degrees), the language switch is a pill, Menu opens the building chips in the page's language, a finger turns the slime, a pinch and the − button zoom, the zoom survives a door, and a tap still walks. |
| `__vacuole-dark.html` | Gloomthmaxx: over each sign's balloon the scene is as dark as the same box below the board (the sign's gloom reveal covers its board only). On the old theme every sign failed. |
| `__verse3d-lake.html` | The lake's fine grain, near to far, in two skins, and pixel differences at 2 to 8 px apart, for a lattice. |
| `__verse3d-swim.html` | Glides the camera with the clock stopped and counts pixels jumping just under the horizon: the far distance must not swim. |
| `__verse3d-blocks.html` | How blocky the depth-of-field bands look against the plain frame, for tuning the blur's crudeness. |
| `__views.html` | The two-views page: towers reported by the iso world stand in 3D at their tiles, the slime crosses at the same spot both ways, the towers' listener follows the 3D slime, and the map stops drawing while hidden. |
| `__verse3d-focus.html` | Depth of field: the distance loses fine detail in focus mode and the near ground does not; and the camera walked round and past houses makes no jerk (the sharpest change in its step between frames). |
| `__isomap-night.html`, `__isomap-bureau.html` | `__isomap.html` for gloomthmaxx and for bureaucore, one skin a probe (the night skin renders slowly headless). |
| `__scale.html` | One size for each thing in every view, and the ground's own measure: the iso tile in slime radii and the torus, against the 3D tile and period; and bureaucore's block against its iso box. Draws the iso skins' own painters alone on blank canvases (the zoog, the shoggoth's mass, five dwellings) and measures them in iso slime radii; builds each 3D place whole and measures every tagged thing in 3D slime radii; then checks the size table (`MH_VERSE3D.SIZES`) against the iso drawing, each 3D thing against the table in shape (height over width) and scale (enterable buildings at the table's `ENTER` factor), the dwelling outside against its room inside, and the well's mouth against the daylight under it in the cave. |
| `__verse3d-cost.html` | A frame's cost in one place of `verse3d.html`, measured from outside like `__slime3d-cost.html`: time `#outdoors:0` against `#outdoors:300` (or `indoors`, `cave`) and divide the difference. |
| `__verse3d-shot.html` | Freezes one place for a screenshot, the view alone: `#outdoors`, `#indoors`, `#cave`, `#pool`, `#pool-front`, `#pond`, `#pond-plain` (the same frame without the water photo), `#field` or `#lake`; prefix `night-` or `bureau-` for those skins. |
| `__slime3d-water.html` | The 3D water seen across its near rim: the rim must stay floor (no water painted over it) and the bottom of the frame must be floor, not sky. |
| `__glossary-water2.html` | Reads one island pool column by column, with and without the water, to see where the fill lands and what covers it. How the moss-over-water interruption was found. |
| `__shot.html` | Puts the slime somewhere on the circuit and stops, so a headless screenshot catches that spot. Add `#day`, `#coin`, `#entry`, `#deep`, `#exit`, or `#pool` (a pool with an island in it). |

They use absolute paths (`/index.html`, `/glossary.html`), so serve the repo
root and open them from there. The glossary ones have to be served rather than
opened from disk: the page draws SVG scenery onto its canvas, which taints the
canvas on a `file://` origin and blocks the pixel reads these probes make.

    python3 tools/run-probes.py                     # every probe, from the repo root
    node tools/frame-probe.mjs <url> 8 walk [profile]   # real-time frame evenness (and the CPU's top functions)
    node tools/hang-probe.mjs <url> 30              # where a page stalls, if it does

Probes that load the 3D workshop pin `?skin=technurture`: the page otherwise
picks its skin by the time of day, and the night skin costs several times more
to paint, so a probe run after 8 pm timed out.
    python3 tools/run-probes.py __slime3d.html      # one of them
    python3 tools/run-probes.py --shot "__slime3d-shot.html#dark" out.png

or by hand:

    python3 -m http.server 8000        # from the repo root
    open http://localhost:8000/brand/backstage/probes/__lit.html

They are here rather than at the site root because the site root is what
deploys. Nothing in `brand/backstage` is loaded by the website.
