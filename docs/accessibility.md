# Accessibility

An audit of the public site on 2026-09-24, and the plan that follows from it.

## How it was checked

`tools/a11y-audit.mjs` loads each public page in headless Chrome, at background
priority and muted, and reports what a screen reader and a keyboard meet there:
the page's language, title, landmarks and headings; the accessibility tree
(every link, button, field and image, with its name); the keyboard, Tab by Tab,
with each stop's name and whether it can be seen; text below WCAG AA contrast;
canvases, live regions, dialogs, media and new-tab links. For the three worlds it
also makes a visit by keyboard: open the menu, choose a house, open and close a
card, and follow where focus goes.

```
node tools/a11y-audit.mjs                 # every public page
node tools/a11y-audit.mjs index.html      # one page
```

The accessibility tree is what a screen reader is given. It is not a screen
reader. The fixes below are checked by the audit and by probes, and then need
one pass with VoiceOver on a Mac and on an iPhone before they count as done.

## What already works

- Every page names its language, and the French switch changes it (and marks
  the switch itself `lang="fr"`).
- The Glossary gives all its words as a real list under the picture, and the
  word the slime reaches is announced (a polite live region). Its canvas has a
  name that says so.
- The 3D page names its canvas, gives the slime's instructions in words for a
  screen reader, has a named `role="dialog"` card with `aria-modal`, and a menu
  button with `aria-expanded`.
- Every page honours reduced motion; no page locks zoom.
- The site menubar is plain links and `<details>` menus: it works by keyboard
  and by touch, and marks the current page.
- The flickering neon letter in gloomthmaxx blinks under three times a second
  in a small area, and stops under reduced motion.

## What the audit found

As found on 2026-09-24, before the fixes (see Done, below, for what each
became).

### The homepage (the iso village)

1. **Enter and Space are taken from the buttons.** The world's key handler runs
   on every keystroke, whatever has focus. Enter on the focused ☰ Menu button
   walks the slime to About and opens it; Space on any button is swallowed and
   does the same. A keyboard user cannot reliably press anything on the page.
   The letter shortcuts (M, T, B, C, G, H, E) also fire from a focused button.
2. **A screen reader meets an unnamed canvas and no heading.** Since the intro
   page went, the homepage has no `h1`, no description, and no way to the plain
   pages. The first thing after the language switch is a canvas with no name.
3. **Invisible stops in the Tab order.** The building menu's seven buttons and
   the build bar's six tools stay focusable while they are faded out: a sighted
   keyboard user tabs through thirteen stops they cannot see.
4. **No word while the slime walks.** Choosing a house from the menu walks the
   slime there and then opens the page, several seconds later. Nothing tells a
   screen reader user that anything is happening.
5. **The white focus ring vanishes on the light skin.** On bureaucore's cream,
   a white ring round a dark button is hard to see.
6. **Sound has only a key to stop it.** M mutes, but there is no button, and
   Musebots towers restored from an address keep playing music.

### The 3D page

7. **Focus leaves the open card.** Tab from the card's link goes to the
   language switch, the canvas and the skin buttons behind it.
8. The page has no heading (a hidden `h1` would give a screen reader its name).

### The Glossary

9. **Home, End, Page Up and Page Down move the slime from anywhere on the
   page**, so they cannot scroll down to the lists. They should belong to the
   picture only when it has focus.
10. Its 57 "cite" buttons are all named "cite": out of context, a screen reader
    cannot tell them apart.

### The teaching tools

11. **The Exam Version Generator cannot be used by keyboard.** Its three upload
    areas are plain `div`s and its file fields are `display:none`: after the
    menubar, Tab reaches nothing. The rest of the form appears only once a file
    is in.
12. The Seating Planner's and Nameplates' file fields have no names (a screen
    reader says "button" and nothing else), and no visible focus: the field is
    transparent over its card, and the card does not show that it has focus.
13. The Exam Timer's exam-name field has no label.

### Every page

14. **No skip link and no `<main>`.** Nine menubar stops come before the
    content on every page, and a screen reader cannot jump to it.
15. Links that open another site in a new tab do not say so, and the menus'
    ▾ is read out as a character.
16. **The faint grey (`--faint`, `#8a8a8a`) is below AA for text**: 3.45:1 on
    white, 2.99:1 on the Exam Timer's lavender. It carries the tools' hints, the
    Glossary's counts, and the Exam Timer's Hours / Minutes / Seconds.
17. Smaller things: the Rock Walls page is titled `Rock_Walls_and_Damp`; the CV
    (built by the CV builder) uses several `h1`s and puts its menubar last in
    reading order.

## Done (2026-09-24)

Steps 1 to 5 below, and the focus ring of step 6, are in. What each does now:

- **Keys.** In the iso and 3D villages, a focused button or menu keeps Enter and
  Space, and a focused link keeps Enter, to press them; a field keeps every key.
  **Space goes to the next stop**: in the villages, the next house on the menu
  (after the one the slime is at, or went to last; from the landing spot, About),
  whose page opens, as its menu chip does; coming back, the address puts the slime
  at that house, so Space goes on to the one after. In the Glossary, Space goes to
  the next word while the picture is on screen and nothing has focus; Home, End,
  Page Up and Page Down move the slime only while the picture has focus, and
  otherwise scroll the page. A button pressed with a mouse hands focus back to the
  world, so Space keeps going on to the next stop rather than pressing it again.
- **The homepage for a screen reader.** A named canvas; a hidden `h1` and a line
  saying what the page is and how to get about; "Read the site as plain pages"
  as a stop that shows itself on focus; "Going to …" / "Opening …" said as the
  slime sets off; the ☰ Menu says whether it is open (`aria-expanded`); the
  building menu shows itself as soon as the keyboard reaches it; the build tools
  are `inert` outside build mode.
- **Cards.** The iso and 3D cards are named modal dialogs: Tab stays inside, and
  closing gives focus back to where it was. Another site's link in a card or menu
  is described as opening a new tab.
- **The teaching tools.** The Exam Version Generator's upload areas are keyboard
  buttons (Enter or Space opens the file picker) with names, and its status is
  announced; its version stepper's − and + are named. The Seating Planner's and
  Nameplates' file fields are named by their cards, which show the focus ring;
  the Exam Timer's name field is labelled.
- **Every page.** A "Skip to the content" link first (menubar.js), a `<main>`
  (or `role="main"` on the tools' card), new-tab links described as such, the
  menus' ▾ silent, and Escape in a menu hands focus back to its button.
- **Focus you can see.** The site's ring (`--focus-ring` in brand/brand.css) is
  the cyan halo with a violet line inside it; the worlds' buttons have a white
  ring with a dark one outside it, so it shows on every skin.
- **The Glossary's "cite" buttons** are each named with their word.

Checked by `brand/backstage/probes/__keys-a11y.html`, the audit, and the probes
the changes touch.

## Left

- The Musebots picker is a named modal dialog; it lives in the web-musebots
  repository (signal-towers.js here is generated).
- Rock Walls takes its window title from its Twine story's name; renaming the
  story would lose visitors' saved games, so it stays.
- The CV's headings and reading order come from the CV builder.
- A pass with VoiceOver, on a Mac and an iPhone.

## The plan

Each step is small, keeps the site looking and behaving as it does, and is
checked by the audit and the existing probes before it goes in.

### 1. Keys that let the controls work (homepage, Glossary)

- `engine.js`: the world's key handler steps aside when a button, link or field
  has focus: Enter and Space press the control, the letters type or do nothing.
  Walking keys still walk (as the 3D page and Glossary already do).
- `engine-side.js` / `glossary-world.js`: Home, End, Page Up and Page Down move
  the slime only while the picture has focus; elsewhere they scroll the page.
- Checked by: a probe pressing Enter and Space on each homepage button (each does
  its own job, and the slime stays put); the Glossary probe with End from the
  lists (the page scrolls); `__iso-sound`, `__tabs`, `__glossary-keys`.

### 2. The homepage for a screen reader

- Name the canvas as the 3D page names its own (`role="img"`, a description).
- A visually hidden `h1` ("M. Reid Horrigan") and a short visually hidden
  paragraph: what the page is, that the building menu reaches every house, and
  a link to the plain pages (About).
- The building menu shows itself when one of its buttons has focus, so no stop
  is invisible; the build bar is `inert` outside build mode.
- A polite announcement when the slime sets off ("Going to Research.") and when
  the page opens, in the reader's language (`i18n-fr.js` gets the French).
- Checked by: the audit (a named canvas, a heading, no hidden stops, the
  announcement said); the existing homepage probes unchanged.

### 3. Cards that behave as dialogs

- 3D page and iso card: Tab and Shift-Tab stay inside an open card; on closing,
  focus goes back to where it was. The iso card gets `role="dialog"`,
  `aria-modal` and its title as its name.
- Checked by: the audit's Tab-inside-the-card test; `__card-away`,
  `__slimeverse3d`.

### 4. The teaching tools

- Exam Version Generator: each upload area becomes a keyboard control (focusable,
  a button to a screen reader, Enter and Space open the file picker, its hint
  read with it); drag and drop stays as it is.
- Seating Planner and Nameplates: each file field named by its card's title,
  and the card shows the site's focus ring while its field has focus.
- Exam Timer: the exam-name field labelled.
- Checked by: the audit (every control reached by Tab and named); a file loaded
  by keyboard in each tool.

### 5. Every page

- `menubar.js` adds a "Skip to the content" link, visible when focused, as the
  first stop on every page with the menubar; each page's content gets a `<main>`.
- New-tab links say so to a screen reader (visually hidden "opens in a new
  tab"; the 3D page's cards already say it aloud); the ▾ becomes silent.
- Checked by: the audit (a skip link, a `main`, no unannounced new tabs).

### 6. Seeing focus, and hearing less

- A two-tone focus ring (dark and light together) for the world's buttons, so it
  shows on every skin.
- A mute button beside ☰ Menu in the homepage and the 3D page (M still works),
  its state remembered between the two views.
- Checked by: the audit's focus check on each skin; `__iso-sound`,
  `__views-switch`.

### Decisions (M., 2026-09-24)

- **The faint grey** is now `#6b6b6b` (`--faint` in brand/brand.css, the tokens,
  the house style and the CV builder): AA on white and on both lavenders (5.33:1,
  5.01:1, 4.62:1).
- **A mute button**, beside ☰ Menu in the iso village and the 3D village; M
  still works, and the setting holds for the visit in both views
  (sessionStorage `mh-muted`). The Musebots bundle sends its music straight to
  the audio context's destination, past the site's master, so M never silenced
  it: the homepage now stands one gain in for that destination (engine.js
  `installSpeaker`), and the mute turns it down, silencing everything.
- **No pause for the world.** It is innocuous and nothing in it puts the slime at
  risk; reduced motion already stills it.

### Build mode by keyboard (added 2026-09-24)

The arrow keys move a tile across the screen (up is up), shown as a white and
dark outline over the world; WASD (and ZQSD on a French keyboard) still walk.
Enter does what a press would do there with the chosen tool: Move picks up the
building on the tile and puts it down at the next Enter; a building tool builds
there; Remove takes the visitor's own building away (the plaza's houses stay).
Escape puts a carried building back, or else leaves build mode. Each step is
said to a screen reader: what stands on the tile, and what Enter did. A tool
chosen from the keyboard gives focus back to the world at the first arrow, so
the next Enter builds rather than pressing the tool button again.
