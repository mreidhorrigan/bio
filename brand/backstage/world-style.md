# The worlds' art style

How the site's three walkable worlds are drawn, so that anything added to them
looks as if it was always there. `house-style.md` covers the pages (colour, type,
the leaf corner, the words). This file covers the worlds:

| World | Engine | Content |
|---|---|---|
| the isometric village (the homepage) | `engine.js` | `theme-*.js` painters, `content.js`, `ecology.js`, `buildings.js` |
| the sidescroller (the Glossary's cave) | `engine-side.js`, `slime-2d.js` | `glossary-world.js` |
| the 3D slimeverse | `engine-3d.js` | `verse3d.js` (runtime), `verse3d-scenes.js` (places) |

Read this before you add or change anything drawn in a world: a plant, a
creature, a building, a prop, a sign, a light, a sound. The checklist at the end
is the short form.

---

## 1. The one rule: a flat fill inside one ink outline

Every world draws a thing as a fill (flat, or gently graded from a lit top to a
shaded foot) inside a single dark outline. There are no textures, no
photographic surfaces (see section 6), and no outlines doubled or left open.
What differs between the worlds is only which things are big enough to carry an
outline at their size on screen.

**Anything that stands among outlined things, and is wide enough on screen to
read as a body, has an outline too.** This includes a stroke drawn as a line: a
stalk, a post, a mast. A bare pale stroke next to an inked cap reads as a
mistake. The spore-cap stalks in 3D were exactly that until 2026-09-23, and the
user caught it.

Hairlines stay single strokes: reeds, tendrils, vines, creases, ripples,
glints, rungs. They are too thin to carry an outline, so their own colour has to
be dark enough to read as ink against the ground, or light enough to read as a
glint.

---

## 2. The isometric village (`engine.js`, `theme-*.js`)

- **Buildings** (the kiosk dwellings): a graded fill in the wall colour, a
  2 px outline in that same colour darkened by 42% (`U.shade(wall, -0.42)`),
  one white gel sheen at the upper left (alpha about 0.24), the round ooze
  doorway, and the window glowing through `shadowBlur`.
- **Props** (plants, lilies, moulds): small fills with no outline, since at
  the iso scale an outline would swamp them. Their light is a `glow()`.
- **Ground shadows**: one soft ellipse under each thing (`shadow()`, black at
  0.28, half as tall as it is wide).
- **Signs**: the leaf-corner plaque in the skin's sign format (`paintKioskSign`).
- **Structures** that are not dwellings (the Glossary's wellhead) are
  registered painters (`registerStructure`), named by `structure:` in
  `content.js`, on a road-house or on a kiosk.

## 3. The sidescroller (`glossary-world.js`)

- **Boards**: the parchment plaque with an outline of 1.4 px, 2.2 px when lit.
  In the dark half they switch to technoscure's signpost: near-black, a teal
  rule, gold serif letters.
- **Posts**: an ink stroke 4.5 px wide under a colour stroke 2.4 px wide. It is
  the same outlined stroke as the 3D engine's `o.edge`.
- **Tentacles**: round-capped segments drawn in two passes, ink under colour.
- **The page's chrome over the cave** dresses as the word card at the foot of
  the picture: the site menubar floats inset as a card (the card's white, grey
  rule, leaf corner, shadow), and while the card is the gloom's signpost (a word
  of the antiglossary) so is the bar (`body.in-pen`). Nothing else: no footer,
  no progress strip (archived in glossary-trail-archive.md), no outline round the
  picture; the slime says what they did, in its first-person bubbles (a light
  leads back to the village; Home, End and Page Down jump; when the keyboard
  reaches the picture, it says so). The ground a phone shows past the page's
  ends is the cave floor's colour (`#403b2f`).

**Every world page, on a phone:** `viewport-fit=cover`, so the picture runs under
the notch and rounded corners (without it the strips beside them show the
page's pale ground as bars), and whatever is read or pressed keeps clear of them
with `env(safe-area-inset-*)`.

## 4. The 3D slimeverse (`engine-3d.js`)

The engine keeps the same look in three dimensions. Its primitives and their
rules:

| Primitive | Use it for | The outline |
|---|---|---|
| `E.organic(pts, fill, ink, w, o)` | any rounded body: the slime, zoogs, caps, pods, boulders, lobes | automatic. `max(0.8, min(2.6, width × 0.045 × w))` px. Dropped when the body is narrower than `o.inkPx` px (default 5), so small things do not turn into blots of ink. |
| `E.line(pts, colour, w, o)` | an open path | none by default. With **`o.edge: ink`** it is outlined like a body (0.8 to 2.6 px either side, a quarter of the stroke's width), and its colour becomes a fill the fog washes. **A stalk, post or mast wider than a hairline takes `o.edge`.** |
| `E.face(pts, fill, ink, w, o)` | a flat polygon: a floor strip, a plank, a wall panel | the given ink, if any. `o.seal` strokes a face in its own colour to close seams between neighbours. |
| `E.billboard(p, draw, o)` | glows, speech bubbles, text plates | whatever it draws itself |

**Inks** (always the scene's, never a new black):

| Where | Ink |
|---|---|
| village by day (technurture) | `rgba(20,40,28,0.8)` |
| village at night (gloomthmaxx) | `rgba(0,0,0,0.6)` |
| bureaucore board | `#111111` |
| spore-caps and their stalks | `rgba(50,20,60,0.8)` (`CAP_INK`) |
| the slime | its skin's own: `#1f3a1a` by day, `#0a0e0a` at night, `#111111` in bureaucore |
| the cave | `rgba(12,18,12,0.85)` in the lit half; a pale `rgba(190,208,226,0.45)` in the dark, where a dark line would vanish |
| the house | `rgba(40,26,12,0.8)` by day, `rgba(0,0,0,0.7)` at night |

**Fills and light:**

- `{ vgrad: [top, foot] }` for a lit top and a shaded foot. The engine makes
  each gradient once per colour pair, so use it rather than a new gradient per
  frame.
- One white sheen at the upper left for anything glossy (`sheen(alpha)`,
  alpha 0.2 to 0.34). The light comes from the top left in every world.
- Glows are radial-gradient halos (`halo(colour, reach)`, `glowAt`), **never a
  canvas blur or filter**: those cost too much on a software canvas.
- **A glow fades to nothing exactly at the edge of what it fills.** Shape the
  gradient to the fill: for an elliptical glow, scale the context so a round
  gradient becomes the ellipse, and end it at alpha 0 on the rim, easing out
  through its outer half. A round gradient filling a flat ellipse is cut off
  while still bright and leaves a hard rim. The gloomthmaxx neon signs had one
  until 2026-09-23 (`probes/__verse3d-neon.html` checks it).
- At night, a light source is `lit: true`, so the dark does not swallow it.
- Fur and lumps come from `o.rough` (`{ tufts, depth, seed, round }`): the
  zoogs are furred, the shoggoths lumpy. Do not draw fuzz by hand.

**Joints and order:** when two parts meet (a cap on its stalk, a head on a
reed), the part in front gets a small `bias` (0.1 to 0.6) so it paints last and
covers the joint. Without it the depth sort can put the stalk's inked end over
the cap.

**Behaviour that is part of the look:**

- Anything big enough to hide the slime from the camera carries `fade: true`,
  and is drawn see-through while it does.
- Things standing on the floor reflect in pools. Lines do not. A custom item
  reflects only with `o.mirror`.
- The fog washes fills toward the air colour and fades outlines. A new
  surface should come up out of the haze, never pop in at the draw edge.
- Motion honours reduced motion (`ctx.reduce`): no sway, no bob, no drop
  animation.

## 5. Sizes, places, and the 1:1 mapping

- Every thing in 3D maps to a thing in the iso village: a house is a house, a
  signal tower a signal tower, the wellhead the wellhead. Nothing is added to
  the 3D village that the iso skin does not have.
- Sizes come from `MH_VERSE3D.SIZES` in slime radii (`UNIT` = 3.1 units = the
  iso slime's 13 px). An iso pixel is `ISO_PX = UNIT / 13` units. Buildings the
  slime can enter are drawn `ENTER` (1.9) times their iso size. A new thing gets
  a `SIZES` entry with its iso source, and `probes/__scale.html` checks it.
- **Tiles to world units only through the scene** (`fromTile`, `tileOf`,
  `tileYaw`, `tileDir`). World z runs against the iso ty. Converting by hand
  (`(ty - HX) * 16`) builds the village's mirror image, which is how the 3D
  village was drawn until 2026-09-23.
- The village walks at the iso pace (the theme's `speed` in tiles a second,
  times the 16-unit tile).

## 6. Photos, words, and sounds

- **Photos:** sparse. The iso lakes use `water.webp`. The 3D water does not
  (on a surface seen in depth it aliased into seams). Too many photos look like
  "ai slop", and so does none at all: ask before adding one.
- **Words in a world:** signs in the skin's format (the leaf plaque, the neon
  marquee at night, the number plate in bureaucore). A stretch with a name of its
  own (the glossary, the antiglossary) is signed at both ends, the arrow pointing
  into it ("Glossary ›" where it begins, "‹ Glossary" where it ends), so a
  visitor coming from either way knows where they are.
- **A cave's daylight is its way out.** In the 3D cave the shaft of light under
  the well, and in the glossary's cave every shaft down a crack and the light at
  the way in: a click on it sends the slime to it, and it bounces up and out (in
  3D, out of the wellhead in the village; from the glossary, back to the village
  address kept for the tab, in the view the visitor came from). The creatures' speech
  bubbles are 3D only ("Yikes!", "Yeep!", "teketeke", "lilililililili!",
  "blooloo!").
- **Instructions are the slime's to give,** in the first person, in a speech
  bubble over it, in every world (since 2026-09-24): "I can walk: the arrow
  keys, or WASD." Brief, with a touch set for phones, and seldom (since
  2026-09-26). When the slime speaks is `tips.js` (MH_TIPS), the same in every
  world: each area's introduction first (the tips marked `"intro"`: the walk,
  opening a house and Space in the villages, the light on arriving in the
  cave), a moment after arriving and a quiet spell of 6 s after each bubble.
  The rest only when the visitor has been still, and the slime quiet, for 25 s:
  one tip a lull. Each tip is said once, remembered in the browser by its
  English words (localStorage, else sessionStorage, else the page's own
  memory), so neither the next visit nor the other view says it again, and a
  tip is skipped once the visitor has done it. Build mode is introduced once. A
  click on something built says "I can move that" once, and after that the
  slime walks there, as on the ground. The glossary's "I can take your keys
  now" is said each time the page opens and the keyboard reaches the picture:
  it stands in for the picture's outline. `tips.test.mjs` checks the pacing
  and the memory, `probes/__tips.html` the worlds. The bubble is the same
  everywhere: white, a #111 ink outline, rounded ends, a tail, a 700 serif,
  wrapped to fit a phone (`bubble()` in verse3d.js, `drawSlimeSay` in
  engine.js, `drawSay` in glossary-world.js). The same words stand in the page,
  out of sight, for a screen reader, all of them all the time. No instruction
  panels or legends on screen, and no toasts that tell the visitor what to do
  (status toasts, "Sound off", stay).
- **Sounds live in one file, `sounds.js` (MH_SOUNDS).** Every sound the worlds
  make is a named recipe there (the step, the landing, the creatures' voices,
  the iso cues): blips with a wave, a pitch against the skin's key, a slide, a
  length, and a loudness at the speaker. The iso engine (`cue(name)`) and the 3D
  runtime (`playSound(name)`) only play them by name, dividing out their own
  master, so the two views sound alike and cannot drift apart (the step once
  did). Change a sound in `sounds.js` and nowhere else. `sounds.test.mjs` fails
  if an engine plays a name the file lacks, makes its own oscillators, loses a
  creature's voice's shape (the blooloo two steady notes, high then low; the
  teke's clucks low, below the key's root), or has a recipe too quiet to hear.
  Voiced: the slime's step and landing, a pet zoog's "blooloo!", a shoggoth's
  "teketeke", "teke?!" and "lilililililili!", heard within 140 units of the
  slime; a zoog's "Yikes!" and "Yeep!" stay silent until the user asks.

## 7. A new element, checked

1. Which iso thing is it? Give it a `SIZES` entry with its iso source.
2. Is it a body? Use `organic` with the scene's ink. Is it a stroke wider than
   a hairline? Use `line` with `edge:` in the ink of the body it belongs to.
3. Graded fill (`vgrad`), one upper-left sheen if glossy, halo glows (no blur).
4. Where parts meet, bias the front part.
5. Tall enough to hide the slime? `fade: true`.
6. Does it light the dark? `lit: true` at night.
7. Placed by tile? Only through `fromTile` / `tileOf`.
8. Honour `ctx.reduce` in any motion.
9. Write a probe for it in `brand/backstage/probes/` (pixels or positions; never
   a picture read by eye). `__verse3d-stalk.html` is the model for an outline check.
