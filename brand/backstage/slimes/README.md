# Extracted world views

Standalone pages that show the walkable world's artwork off the world: the two
animated one-eyed slimes, and everything else the world draws.

- `isometric.html` is the Canvas 2D world avatar. Its painter, technurture green palette, idle pulse, directional eye, shadow, and walking peristalsis come from `engine.js` and `theme-technurture.js`. The page's pointer/keyboard handling is only a demonstration harness.
- `widget.html` is the fixed inline-SVG companion from `slime-widget.js`, including its violet artwork, three-second squash, responsive size, reduced-motion rule, and smoothed mouse/touch gaze.
- `assets.html` is every other drawn thing, in all three skins: kiosks (unvisited, visited, active), dwellings and alien growths, signal towers in each state, flora, a live patch of fauna, monuments, signposts, ground by biome, and the palettes.
- `tower-proposals.html` is a design page rather than an extraction: signal-tower styles for the two slime skins, drawn beside the live tower in all four states. A and A-night were adopted and now ship; the rest stay as the alternatives that were not taken.
- `cave-proposals.html` is a proposal: the glossary is underground, and its two halves are different caves. Three options for that pair (grown and dead, greenhouse and mine, reef and deep), then three for the Glossary house in the village that leads down into it. Its painters are `cave-proposals.js`; nothing there is wired into the site.
- `slime-2d.html` is a proposal: the slime as a body in flat 2D situations. Free it is a circle, falling it tapers, and on the ground its underside takes the shape of what it lies on. The painter now lives at the site root as `slime-2d.js`, because `glossary.html` walks the slime along the glossary with it. This sheet loads that same file, so the two cannot drift apart.
- `shoggoth-proposals.html`: a monster for the world, six designs. **C, the iridescent bulk, was adopted** and now hunts in the slimeverse.
- `prey-proposals.html`: six creatures for the shoggoths to hunt, each referencing public-domain science fiction. **E, the zoogs, were adopted** and now graze the slimeverse.
- `verse3d.html` is a proposal: the slimeverse in three dimensions, on the site's `engine-3d.js`. Three places, outdoors (the village), indoors (one dwelling) and the cave under the Glossary, joined by the dwelling's door, the wellhead, the hatch and the rope, with shoggoths hunting zoogs. `verse3d.js` is what the places share and `verse3d-scenes.js` holds the three places. Both now live at the site root, since the site's own `slimeverse3d.html` walks the same places (see "On the site" below).
- `index.html` links the views.

Open any of them directly in a browser. They use only local relative files and do not require a server, build
step, package installation, or network connection.

## Two kinds of extraction

The two slime pages **copy** their painter, so each is one small file that can be
lifted out whole. They can therefore drift: the canonical sources remain
`engine.js` and `slime-widget.js`, and a change there must be ported here.

`assets.html` takes the other approach. It **loads the canonical sources** by
relative path (`../../../theme-technocute.js`, `../../../theme-technurture.js`,
`../../../theme-technoscure.js`, `../../../buildings.js`, `../../../ecology.js`) and gives
them a small stub of the engine, so it cannot drift: it is the site's own code,
drawn on small canvases instead of one big one. Only `assets.js` is a copy, and
only of engine.js's toolbox (`hash01`, `noise01`, `shade`, `mix`, `mixHex`,
`accentFill`, `hexA`, `poly`, `roundRect`, `diamond`, `shadow`, `label`, `clamp`,
`wrap`, `wrapDelta`, `tr`) and its biome field. Keep those in step with
`engine.js`: a theme that calls a helper the harness lacks breaks every panel.

Two couplings the harness mirrors on purpose: engine.js's `roundRect` ignores its
context argument and draws into the engine's own canvas, so the harness binds it
to whichever panel is painting. `diamond` uses the tile size, 96×48 in every skin.

## What `assets.html` gives you

Panels animate on one clock, honour `prefers-reduced-motion`, and paint only when
scrolled into view. From the console:

    MH_ASSETS.redraw()    paint every panel once, ignoring the viewport check
    MH_ASSETS.errors      painter exceptions, newest last. Empty is healthy
    MH_ASSETS.panels()    the list of panel names
    MH_ASSETS.themes()    the registered skins, as the engine would see them

A few things are supplied by the harness rather than the site, and are marked as
such on the page: signal-tower states come from a stub standing in for the Musebot
bundle, and the fauna panel runs its own small world so the ecology has somewhere
to live.

## The tower proposals

`tower-proposals.html` loads the same harness as `assets.html`, so its **Live**
row is the shipped painter from `buildings.js`. The alternatives live in
`tower-proposals.js`, written to drop into `buildings.js` unchanged: each takes
the same `(C, b)` context `drawSignalTower` takes, and uses the same helpers.

**What shipped.** `engine.js` now passes `theme: T.id` in the env for a building,
and `drawSignalTower` branches on it: the two slime skins draw a colonised mast
(the mast stays, because a Musebot tower is the one built thing in a grown world,
but the world climbs it), and bureaucore keeps the plain mast. The night version
swaps ink for iron, the rungs for bone so the silhouette survives the night
multiply, and the green vines for drained ones with faintly luminous buds.

The slime towers also use a revised state vocabulary: unassigned is an unlit
fixture rather than the old violet, which was the sporecap violet in both skins;
ready is steady, playing beats, error blinks. Bureaucore still uses the old
vocabulary, so the two differ until that is unified.

## The slime in 2D

The site's avatar is a squashing ellipse that always stands on a level tile.
`../../../slime-2d.js` proposes the same creature with a skin and a volume, for any flat
2D situation. The underside is found by rolling a disc along the ground and
tracing the curve its belly makes, and that disc's radius is the slime's surface
tension: the one number that decides everything. A small disc creeps into every
crack, a large one spans them, so bridging a gap and draping over a boulder come
from the same rule rather than from special cases. Measured on the sheet's own
test grounds, at the house tension the slime bridges gaps up to about a quarter
of its width and settles into anything wider.

## Shoggoths

`shoggoth-proposals.js` holds six designs and the two palettes they use. The
painters take the `(C, b)` context `buildings.js` builds, plus `C.state`
(`dormant`, `roused`, `moving`) and `C.pal`.

**Design C shipped.** It replaced the hunched, eyestalked predator in
`ecology.js`: a protoplasmic mass whose eyes open and sink back in, with an
oil-slick sheen sliding across it and tentacles instead of a mouth. It keeps
what the old predator taught the world to read, being near-black against the
greens with an amber eye, and where a theme roots its predators
(technurture's `predatorDormant`) it puts down anchor roots and half-lids its
eyes instead of growing limbs. The engine now passes the active skin to the
ecology, so the creature picks day or night colours. It is drawn cheaply on
purpose: 26 samples for the silhouette and four round-capped segments per
tentacle, because a dozen of them paint every frame.

## Prey

`prey-proposals.js` holds six designs, each a direct reference to a
public-domain creature: a mooncalf and a Selenite (Wells, 1901), a thoat
(Burroughs, 1912), and an Elder Thing, a ghast and zoogs (Lovecraft). The first
three are unambiguously public domain in the US, being published before 1929.
The Lovecraft creatures come from 1936 and 1943 publications, which sit in the
window where US copyright had to be renewed: the Mythos is treated as public
domain in practice, but that rests on non-renewal rather than on age, so check
before shipping one.

**Design E shipped.** The zoogs replaced the small tan grazer in `ecology.js`:
one entity is one zoog, and the knot of them is what the flock does by itself.
Its base is the ground line, so it sits on the world rather than hovering over
it, and the only time one leaves the ground is mid-bound, when its shadow
tightens under it. Three or four eyes, stable per beast, blinking out of step.

## The slimeverse in 3D

`verse3d.html` loads `../../../engine-3d.js`, `../../../verse3d.js` and
`../../../verse3d-scenes.js` in place, so its renderer and places are the ones
the site's page uses and cannot drift. On top of the renderer:

- `verse3d.js` (`MH_VERSE3D`) is what every place shares: the slime (the same
  body, eye and wading as `slime3d.js`), the boom camera, pools (a height field
  in any basin, bounded by a shoreline marched out from the centre, with glints
  and reflections), the shoggoths (design C: a lumpy mass whose eyes open and
  sink back in, five tentacles, a sheen that slides), the zoogs (design E:
  furred tufts with three or four eyes, in knots, that graze, bound and flee),
  drifting motes, plaques, click-to-walk, and the ways between places, which
  load the next place through a short fade.
- `verse3d-scenes.js` registers the three places (the outdoors reads the
  iso village from `content.js`, loaded by the page) with
  `MH_VERSE3D.defineScene(id, { name, setup(ctx) })`. A place is a ground
  (`floorAt`, and `ceilAt` when it has a roof), a palette, where the body may
  go and where a camera may stand, what it builds each frame, its pools,
  solids, entries, ways out, signs and life. A fourth place is one more
  `defineScene`.

**The outdoors is the iso world, one thing for one thing.** Same torus (58
tiles, so the walking never ends and the plaza comes round again), same
plaza, the kiosks of `content.js` on the same ring, the axis roads and the
spur roads, the junction house, the Glossary's wellhead, the same biomes from
the iso world's own noise (ported from `engine.js`), its water tiles as real
lakes with the roads crossing them as causeways, and each tile's plant where
the iso world's `propAt` grows it, with undergrowth between. A house is a
house (every one can be entered, and its door leads back to itself); a signal
tower exists only where a visitor raises one, so none stands by default. The
one change: in the daylight skin the iso shoggoths are rooted, and here they
walk. `probes/__isomap.html` loads the running iso world and checks every
placed thing, the torus, the biomes and the lakes against it.

**Every skin has its 3D version**, built by one function (`isoWorld` in
`verse3d-scenes.js`) from that skin's own settings in `theme-*.js`, so each
keeps the one-to-one mapping:

- *Slimeverse by day* (technurture): biomes, lakes, gel dwellings, plants,
  zoogs and shoggoths.
- *Gloomthmaxx* (technoscure): the same world, its 58-tile torus and its
  land, in the night tints, sunk in darkness (a seventh of its colour, as the
  iso night multiplies by its dark map) except where there is light: the
  slime's glow and the beam ahead of it, the warm window of each house, the
  monument, and the things that are their own light (neon marquee signs,
  plant glows, fireflies, the shoggoths' eyes). Its ecology: 20 zoogs, 9
  roaming shoggoths, 42 fireflies. Its houses' insides are the same rooms at
  night, lit by their lamps.
- *Bureaucore* (technocute): its own 52-tile torus, a flat paper board, the
  pale-blue plaza and violet roads, each kiosk a solid black-edged block in
  its accent colour with its number plate and an uppercase title plate, a
  cyan cone at the plaza, and nothing else: no biomes, no plants, no
  creatures. A block is tall and narrow, so its inside is a tall narrow office.

The page opens in the skin last chosen in the iso world (`mh-skin`), or the one
in `?skin=`, and switches between them. The wellhead in every skin is the iso
one (`engine.js` drawWellhead): a collar of gel lobes in its road's colour, two
bowed posts, a domed cap and a windlass, sized from the iso pixels at the
slime's own ratio (13 px to one slime radius). In every slime skin the doorway
is the iso "ooze doorway", dark, with one warm window beside it.

**The ground outdoors is one surface**, not tiles: `E.heightfield` (in the
engine) casts a ray through every fourth pixel to the land, colours it from
a baked texture of the blended biomes with the land's light in it (and
smaller copies for the distance, so nothing shimmers), and lays it on
smoothed. The land rolls gently (the iso elevation, and two finer rolls), and
the haze takes it into the sky at the horizon. About 2 to 3 ms a frame.

**Shoggoths walk on their tentacles**, after the reacher in the lizard worlds
(`more_procedurality`, planetary_ecology): some of the nine arms grip the
ground ahead, the body is pulled along among them and raised on them, the
rearmost grip lets go and reaches ahead again, and the free arms hang and
curl. A planted tip that lands on a zoog has it. Each arm reaches two and a
half to three and a quarter times the body's width. Each shoggoth has six to
eight eyes spread round its whole body, so that from any side about as many
face the viewer as the iso shoggoth shows on its one face.

**Plants come in every size**: most knee-high, some up to the slime, and now
and then a giant up to nine times the ordinary, a gel pod the size of a house
or a spore-cap to walk under.

**Indoors** the books and the windlass are archived (kept in
`verse3d-scenes.js`, `archivedShelves` and `archivedWindlass`, uncalled).

**Everything that stands up is solid.** A place lists its solids (houses to
their bulge, rocks, plants by their own size, lamps, posts, a vine that hangs
low enough to be in the way). A sign's post is added for it. The slime and
every creature are solid to each other, an overlap shared by weight, so a zoog
gives way to the slime and the slime to a shoggoth. The static solids sit in a
16-unit grid, so a body looks only at what is near it.

**Clicking to walk** holds the camera's heading while the slime walks, then
eases it back behind. A click that lands behind the slime (low in the frame)
becomes a goal just ahead of it, so a click never turns the view round.

**The cave is round-edged.** The floor curves up into each wall and the wall
over into the roof, a quarter-circle at each corner, and the end walls follow
the same section. Its bands turn smoothly from floor to wall to roof colour
and are sealed in their own colour (the engine's `o.seal`), so no seam shows.

**Things come into view out of the fog**, never at an edge. The fog reaches
the air's full colour a little short of where a place stops drawing, measured
as distance from the camera. Outdoors the sky meets the horizon in that same
colour, and the fine ground round the slime fades into the coarse ground
under it.

**Photographs, sparingly.** The only photo is the one the iso lakes use
(`water.webp`). It lies under deep water, tiled at a fixed size on the surface
so it keeps its grain, with the water's own colour thickening toward the
shore. The lakes outdoors have it (in the ground renderer, with the sky
mirrored where the eye grazes the water), and the cave's pools (darkened).
The shallow bath indoors does not. The glossary's sidescroller shows it under
its deep water the same way, through the `under` hook of `engine-side.js`
`drawWater`.

### One size for each thing, in every view

The same world is drawn three ways, so a zoog or a dwelling must be the same
object in each. `MH_VERSE3D.SIZES` keeps each thing's half-width and height
once, in slime radii (the iso slime is 13 px, the 3D one `UNIT` world units):

| thing | w | h | from the iso painter |
|---|---|---|---|
| zoog | 0.46 | 0.46 | `ecology.js` drawGrazer |
| shoggoth | 1.27 | 2.0 | `ecology.js` drawPredator, the mass alone |
| dwelling | 2.4 | 4.4 | `theme-technurture.js` paintKiosk, enterable |

The shape (h over w) must match the iso drawing. The scale must match too,
except for a building the slime can walk into, which has to hold a room: every
enterable building is drawn `ENTER` (1.9) times its iso size, all by the same
factor. The dwelling's outline is the iso painter's own curve
(`MH_VERSE3D.DWELL`), turned about its axis outside and seen from within
inside, with the door and window where the iso drawing puts them. The room
inside is that outline less a wall's thickness.

`probes/__scale.html` tests the method by measurement. It draws the iso
painters alone on blank canvases, builds each 3D place whole, and fails when
the table, the iso drawing and the 3D drawing disagree, or when the dwelling
outside and its room inside, or the well's mouth and the daylight under it,
differ. A new thing gets a row in `SIZES`, a `tag` on the items that draw it,
and a line in the probe.

Frame cost, headless and walking (`__verse3d-cost.html`): see the probes
README; every place in every skin runs under the live `slime3d.html`'s cost
measured the same way. Round bodies' gradients are made once per colour pair
and stretched to each body (the engine's `{ vgrad }` fill), and the cave's
rounded bands overlap rather than being stroked to hide their seams: both
had made the frame rate stutter.

### On the site (`/slimeverse3d.html`)

The iso village's Games branch has a road-house, Slimeverse 3D, whose page is
`slimeverse3d.html` at the root (its own code in `slimeverse3d-page.js`). The
page starts inside the slime's house, and its door leads out beside that same
house in the village. The runtime runs with `doors: "menus"`: every other house
is a way that opens (`{ open: item }`) rather than a way to a room. Walking in
opens a card with its link or words, as the iso village's card does, and a click
(`clickHit`, a ray against `clickables()`) opens the page straight away in a new
tab. The wellhead opens the Glossary. Only the Slimeverse 3D house leads inside
(`setBack` points its way out at the house's own door, `entries.home`). The
hatch still leads down to the cave, and the cave leads nowhere else for now.

- **The cave is a ring**, `period` 1504, its bends integer waves of it, so
  walking on in either direction comes round to the rope again. There is no end
  wall. `__verse3d-keys.html` sends three walkers round it with wandering steering.
- **The address** speaks the iso world's language: `?theme=technurture|
  gloomthmaxx|bureaucore`, `?place=village|house|cave`, and `?slime=x,y` (iso
  tiles in the village, the place's own units inside). The page rewrites it
  every half second, and its "Back to the village" link carries the skin and the
  tile. With no theme, the skin is `mh-skin` from localStorage (shared with
  the iso world), or the time of day.
- **Skins keep the world**: `setSkin` keeps the slime's spot and heading, and
  `carryOver` keeps every zoog and shoggoth where it stood. A shoggoth rooted by
  day wakes where it was at night.
- **Bumping a hunting shoggoth** stops it a moment ("teke?!"), time for a zoog
  to get away.
- **The step sound** is the earlier, slimier one: four soft triangle blips,
  smeared a sixtieth of a second apart, at each crest of the walk, through a
  lowpass at 900 Hz. The page has a sound switch.
- **The eye** is on the slime's front, so from behind the camera does not see
  it, however high the camera rides: it also needs the camera ahead of the
  slime's middle, since the body is a squashed dome, not the sphere the eye's
  normal assumes. The reflection shows it by the same rule, as a mirror would
  (`W.eyes()` counts the eyes drawn, for probes).
- **Clicks enter only by a door**: a house's clickable is a column the doorway's
  size in its wall. The house bodies follow in the list with no item, so a click
  on a wall opens nothing; a ray that meets a wall looks a little further in,
  for a dwelling bulges out past its doorway; and a house the ray entered in
  front of the slime is drawn see-through, so the click passes it.
- **The slime's house is the same room in every skin**, technurture's. Only the
  pane and the open door follow the skin, dark in gloomthmaxx's night.
  Bureaucore's paper box room is retired (git history has it). The shell
  (walls, pane, door, crown) is drawn on layer 1, under everything in the room,
  so the doorway never covers a zoog beside it.
- **3D water has no photo.** The iso lakes' photo was tried on the 3D lakes and
  pools and taken out: seen in depth it aliased into seams. The iso map keeps it.
- **The controls** follow the iso village's: "☰ Menu" (building chips at the
  top) and the way back bottom right, the skins bottom centre, M to mute. On a
  touch screen a finger dragged sideways turns the slime (`C.turn`), two fingers
  pinch the zoom, a tap walks; + and − zoom too. The zoom is a factor
  (`C.pref`) on each place's own camera distance, kept through doors and
  remembered (`mh-3d-zoom`); a phone starts at 1.4. The lens takes the window's
  width into account, so a phone held upright sees the village.
- **Probes that walk far** use `W.step()`, a frame without the painting
  (`__verse3d-ways` fell from 290 s of CPU to 2.4 s).

**Adoption path.** The cave here is `slime3d.js`'s corridor carried over, and
the slime, its water and its reflection are the same code in both files. If
this is taken up, `slime3d.js` becomes one more scene on `verse3d.js` rather
than a second copy of the slime.

### Two views, one world (`views.html`)

The iso world (the site's own `index.html`) and the 3D view on one page, with a
switch. `views-page.js` hands the walk across at the same spot: into 3D the
slime starts on the iso slime's tile, facing its way, in the iso world's skin;
back on the map the iso slime stands where the 3D one reached
(`MH_ISO.placePlayer`). The iso world stays loaded underneath, so the signal
towers a visitor raised there, and their Musebots, carry on: the towers stand
in 3D at their tiles (read live from `MH_ISO.buildings()`), each as its skin's
iso mast with its lamp lit by its Musebot's state, and while 3D shows the
towers' sound is placed from the 3D slime (`MH_MUSEBOTS.updateListener`). The
map stops drawing while hidden. Because both views hand over at the same spot
the sound does not jump; the towers' own gain ramps smooth what changes, and
the pictures cross-fade. The page passes its query on to the iso frame, so a
link carrying towers (the iso world's address state) carries them here.
`probes/__views.html` checks the hand-over.

### Signs, sounds and speech

Every sign floats on a vacuole (`vacuole.js` at the site root), in the iso
skins and in 3D alike: a gel balloon tethered to the board, dim in
gloomthmaxx, a plain white balloon in bureaucore. In 3D a sign is the iso
sign's own size, at the slime's ratio. The 3D slime walks to the iso world's
step (a sine blip on the skin's root note, about twice a second), with a
sound switch on the page. In 3D only, the creatures speak in bubbles: a zoog
running from a shoggoth cries "Yikes!" or "Yeep!"; a shoggoth mutters
"teketeke" and cries "lilililililili!" when it finds a zoog to chase. The
bubbles are pictures, never sounds.

### Distance, and the camera

Outdoors, things far off are drawn out of focus (the engine's `E.focus`),
coming sharp as they near; `?distance=mist` shows the earlier haze instead,
kept for places that want it. Houses and large plants between the camera and
the slime turn see-through (`o.fade`) rather than pulling the camera in, which
had made the view jump at every corner.
