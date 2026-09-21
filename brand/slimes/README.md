# Extracted world views

Standalone pages that show the walkable world's artwork off the world: the two
animated one-eyed slimes, and everything else the world draws.

- `isometric.html` is the Canvas 2D world avatar. Its painter, technurture green palette, idle pulse, directional eye, shadow, and walking peristalsis come from `engine.js` and `theme-technurture.js`. The page's pointer/keyboard handling is only a demonstration harness.
- `widget.html` is the fixed inline-SVG companion from `slime-widget.js`, including its violet artwork, three-second squash, responsive size, reduced-motion rule, and smoothed mouse/touch gaze.
- `assets.html` is every other drawn thing, in all three skins: kiosks (unvisited, visited, active), dwellings and alien growths, signal towers in each state, flora, a live patch of fauna, monuments, signposts, ground by biome, and the palettes.
- `tower-proposals.html` is a design page rather than an extraction: signal-tower styles for the two slime skins, drawn beside the live tower in all four states. A and A-night were adopted and now ship; the rest stay as the alternatives that were not taken.
- `slime-2d.html` is a proposal: the slime as a body in flat 2D situations. Free it is a circle, falling it tapers, and on the ground its underside takes the shape of what it lies on. The painter, `slime-2d.js`, is standalone and has no dependencies.
- `shoggoth-proposals.html`: a monster for the world, six designs. **C, the iridescent bulk, was adopted** and now hunts in the slimeverse.
- `prey-proposals.html`: six creatures for the shoggoths to hunt, each referencing public-domain science fiction. **E, the zoogs, were adopted** and now graze the slimeverse.
- `index.html` links the seven views.

Open any of them directly in a browser. They use only local relative files and do not require a server, build
step, package installation, or network connection.

## Two kinds of extraction

The two slime pages **copy** their painter, so each is one small file that can be
lifted out whole. They can therefore drift: the canonical sources remain
`engine.js` and `slime-widget.js`, and a change there must be ported here.

`assets.html` takes the other approach. It **loads the canonical sources** by
relative path (`../../theme-technocute.js`, `../../theme-technurture.js`,
`../../theme-technoscure.js`, `../../buildings.js`, `../../ecology.js`) and gives
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
`slime-2d.js` proposes the same creature with a skin and a volume, for any flat
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
