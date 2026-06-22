# matthorrigan.com — house style

The shared visual language for the site, written so that **build tools** (the CV
builder, a future dossier builder, any new tool) — human or AI — can apply it
consistently without reverse-engineering the existing pages.

Three forms, same truth:

| File | For | Use it when |
|------|-----|-------------|
| `brand/house-style.md` (this file) | humans & LLM-driven builders | you want the rules **and the why** |
| `brand/tokens.json` | programmatic builders | you need the values as data |
| `brand/brand.css` | HTML builders | you want a drop-in `<link>` with tokens + helpers |

The existing pages are the **reference implementations**: `menubar.js`,
`index.html`, `Horrigan_CV.html`, and the tools `MCQer.html` / `SeatPlanner.html`
/ `ExamTimer.html`. `autofac.html` is a deliberately separate dark *game* skin —
see [The game exception](#the-game-exception).

---

## 1. Quick start for a new tool/page

```html
<head>
  <link rel="stylesheet" href="brand/brand.css">      <!-- tokens + helpers -->
  <script src="menubar.js" defer></script>            <!-- the shared menubar -->
</head>
```

Then:

- Build surfaces with the **leaf corner** (`var(--leaf)`, `--leaf-lg`, `--leaf-sm`).
- Use **violet `--accent`** for the document's links / primary buttons / labels.
- Cap a tool's main card at **`--card-max`** so the tools read as one set.
- Let the **menubar stay cyan-only** (it's handled for you by `menubar.js`).
- Type: **`--sans-font`** for UI / headings / app chrome. Use **`--body-font`**
  (serif) for long-form prose and for **tool instructions** (subtitles, hints,
  reference notes). Use **`--mono-font`** for code/tabular output.
- Reference radii with a fallback so they render before `menubar.js` runs:
  `border-radius: var(--mh-leaf, 16px 4px 16px 4px / 7px 2px 7px 2px);`

> **Status:** the existing reference pages each *inline* their own `:root` token
> block (they predate these files). `brand.css` / `tokens.json` carry the identical
> values and are the canonical source for **new** tools — import, don't copy.

---

## 2. Principles (the "why")

1. **One signature shape — the leaf corner.** Every rounded thing carries the
   same asymmetric corner so the site reads as one hand. It's distinctive without
   being loud.
2. **One highlight colour — cyan `#c3f0ff`.** Interaction/attention is *always*
   cyan: menubar hover, current page, text selection, focus, key-word highlights.
   Nothing else competes for "this is live / selected / important".
3. **Three house colours.** The brand reads in three: the cyan highlight
   (`--brand-cyan`), the warm orange flare (`--flare-warm`), and the deep violet
   accent (`--accent`). They sit far apart on the wheel (cool, warm, deep) so they
   complement rather than clash. Cyan is for interaction, orange is the landing
   backdrop only, violet carries the document's links and buttons.
4. **Menubar = site brand; document body = its own accent.** The menubar is
   cyan everywhere. The reading surface (CV, tools) uses the **violet `--accent`**
   for its links and buttons. Keeping these lanes separate is intentional.
5. **Fixed geometry over fluid.** The leaf uses fixed px radii so a wide panel and
   a narrow pill show the *same* corner arc. Percentages stretch the corner flat,
   so we use them only for genuinely fluid/inline things (text highlights).
6. **Status colours stay out of the brand.** Errors/warnings use a separate red
   (`--danger`) so they never get mistaken for the violet accent.

---

## 3. Colour

### Highlight / interaction
| Token (canonical) | Value | Role | Aliases in code |
|---|---|---|---|
| `--brand-cyan` | `#c3f0ff` | the single highlight/interaction colour | `--mh-blue`, `--favcolor`, `--focus`, `--flare-cool` |

### Document accent (CV + tools; **not** the menubar)
| Token | Value | Role |
|---|---|---|
| `--accent` | `#5b2a86` | deep violet: links, primary buttons, labels, progress fills |
| `--accent-strong` | `#46206a` | accent hover / active |
| `--accent-wash` | `#f1ebf8` | tint behind hovered / confirmed surfaces |
| `--on-accent` | `#ffffff` | text/icons on an accent fill |

The accent is the **third house colour**: a deep violet picked to complement the
cyan highlight and the orange flare (see Principle 3). It is dark enough to clear
WCAG AA for text and buttons on white (contrast ≈ 9.9:1).

### Flare / orange (the warm house colour)
| Token | Value | Role |
|---|---|---|
| `--flare-warm` | `#f28b46` | orange end of the home/landing "cloud" (`--secondcolor` on index) |
| `--flare-strong` | `#9a4310` | deep burnt orange: orange-family callout **text + border** |
| `--flare-wash` | `#fdefe2` | light orange: orange-family callout **background** |
| `--flare-cool` | `#c3f0ff` | blue end of the cloud (= `--brand-cyan`) |

Use `--flare-strong` on `--flare-wash` for an **orange callout** that keeps the
light-background / dark-text contrast of a danger strip but reads as the warm
house colour, not an error. (ExamTimer's exam-rules warning uses it.)

### Neutrals
| Token | Value |
|---|---|
| `--ink` | `#1a1a1a` |
| `--muted` | `#595959` |
| `--faint` | `#8a8a8a` |
| `--rule` | `#d9d9d9` |
| `--bg` | `#f9f7fb` |
| `--surface` | `#ffffff` |
| `--surface-tint` | `#f1edf7` |

The `--bg` and `--surface-tint` near-whites carry a faint **lavender** tint so the
neutrals lean toward the violet accent rather than against it. (They were warm-pink
under the old maroon accent.)

### Status (deliberately distinct from the brand)
| Token | Value | Role |
|---|---|---|
| `--danger` | `#b2241a` | error / warning text & state |
| `--danger-strong` | `#8f1c14` | error hover / active (ExamTimer's danger button) |
| `--danger-wash` | `#fbecea` | error / warning background |
| `--ok` | `#1f7a3d` | affirmation (ExamTimer's "ends at" / running) |

> The **full palette above lives in the three tools** (`MCQer` / `SeatPlanner` /
> `ExamTimer`) — they're its reference implementation. The **CV** defines only a
> subset (`--ink`, `--muted`, `--faint`, `--rule`, `--accent` + the fonts) and
> pulls cyan in via inline `var(--mh-blue, #c3f0ff)` fallbacks. A new builder
> should take the full set from `brand.css`, not from the CV.

---

## 4. The leaf corner (the signature)

An **asymmetric corner**: a gentle elliptical **sweep at the top-left and
bottom-right**, **near-square at the top-right and bottom-left**.

```
   ╭───────────────────╴      top-left: big sweep   ·  top-right: near-square
   │                    
   ╶───────────────────╯      bottom-left: near-square ·  bottom-right: big sweep
```

**Syntax** (CSS `border-radius` longhand):
`h-TL h-TR h-BR h-BL / v-TL v-TR v-BR v-BL`

**Rule:** use **fixed px** radii, never percentages — so the corner arc is
identical on a narrow pill and a wide panel. (With `%`, the horizontal radius
grows with width and the corner reads flatter as the element widens — the bug we
fixed when the dropdown bubbles looked flatter than the nav bubbles.) Keep the
**orientation** exactly as given; never flip which corners sweep.

| Size | Value | Use | Code name |
|---|---|---|---|
| item | `16px 4px 16px 4px / 7px 2px 7px 2px` | menubar pills, hover/current highlights | `--mh-leaf` |
| button | `15px 4px 15px 4px / 8px 3px 8px 3px` | buttons & medium controls | `--leaf` |
| card | `22px 6px 22px 6px / 12px 4px 12px 4px` | cards, panels, modals, drop zones, sections | `--leaf-lg` |
| panel | `22px 6px 22px 6px / 10px 3px 10px 3px` | the menubar dropdown panel (same shape, shallower) | `--mh-leaf-box` |
| small | `8px 3px 8px 3px / 5px 2px 5px 2px` | inputs, chips, badges, small boxes | `--leaf-sm` |
| bar | `34px 16px` | the menubar's **bottom-right** sweep (`border-bottom-right-radius`) | `--mh-leaf-bar` |
| fluid | `25% 5% 25% 5%` | **inline/fluid only** — text highlights that scale with content | `--leaf-fluid` |

**Never leaf** (keep these shapes):

- **Progress bars** — tracks & fills stay `border-radius: 999px` (rounded ends
  read correctly on a thin bar; a leaf would look broken).
- **True circles** — avatars, numbered badges, dots stay `border-radius: 50%`.
- **Squared-on-purpose** — surfaces inside `@media print` or fullscreen/projection
  modes keep `border-radius: 0`.

(The index hero photo is a sibling fluid value, `25% 0% 50% 0%` — already in the
leaf family; leave it.)

---

## 5. Highlight & selection

The cyan "highlighter" treatment:

```css
.hl, .menubar-item:hover, .menubar-item.is-current {
  color: #000;
  background: var(--brand-cyan);             /* #c3f0ff */
  border-radius: var(--mh-leaf);
  filter: drop-shadow(0 0 5px var(--brand-cyan));
}
```

Used for: menubar hover & current item, the CV menubar buttons (Web · Print / PDF
· Download PDF ↓), and `.blacklight` key-word highlights on the index.

**Selection** — set site-wide so it matches:

```css
::selection { background: var(--brand-cyan); color: #000; }
```

(`::selection` ignores `border-radius` and `filter`, so only background + colour
apply — that's expected.)

---

## 6. External-link cue (menubar)

Menubar links that open **another website** (a different origin) get a subtle
**curved underline**: a mostly-flat line that **sweeps up at the bottom-right**,
echoing the leaf's bottom edge. It's drawn as an SVG mask so it follows the label
width. Colour `#9aa0a6`, brightening to `#17a3d6` on hover. On-site links get no
cue. (Handled automatically by `menubar.js` via origin comparison; works on the
live domain and in local `file://` previews.)

---

## 7. Typography

| Token | Stack | Use |
|---|---|---|
| `--sans-font` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` | UI, headings, app chrome, controls, CV headings |
| `--body-font` | `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` | long-form prose: the **CV body** AND the **tools' instructional prose** |
| `--mono-font` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | code / tabular previews (e.g. MCQer's format reference) |

- **Sans is the default for chrome; serif carries the words.** The tools set their
  `<body>` to `--sans-font` for the UI (labels, buttons, inputs, badges). Their
  **instructional prose** — the masthead subtitle, hint text, reference notes,
  option descriptions, ExamTimer's rules — uses **`--body-font`** (serif), echoing
  the home page's reading voice so the tools feel like the rest of the site, not a
  separate app. The split is the rule: if it instructs or describes, it's serif; if
  it's a control, it's sans.
- The **menubar** pins a system-sans stack at a **fixed `13px` / weight `600`**
  (px, not rem) so the bar is pixel-identical across pages with different root
  font-sizes (the CV uses `html{font-size:14px}`; others default to 16px).
  `menubar.js` hard-codes this stack (which additionally lists `system-ui`)
  rather than referencing `--sans-font`, on purpose, so the bar is self-contained.
- **Home-page exception:** `index.html` is bespoke: Georgia serif body with
  Tahoma/Arial small-caps headings. `--body-font` falls back to Georgia, so the
  tools' serif prose reads as a sibling of the home page even where Iowan is absent.

---

## 8. The menubar (shared component)

One framework-free script powers the nav on every page.

```html
<script src="menubar.js" defer></script>
```

- **Links live in `menubar.js`** — edit the `GAMES`, `TOOLS`,
  `LINKS_BEFORE_DROPDOWNS`, and `LINKS_AFTER_DROPDOWNS` arrays at the top; the
  dropdowns build themselves.
- **Two modes:** on a normal page it injects a fixed `#mh-menubar` bar; on the CV
  it splices the nav into the existing `#cv-menubar`.
- **Bar:** fixed top, `min-height: 46px`, `#fff`, `1px solid #d9d9d9` bottom rule,
  `box-shadow: 0 1px 4px rgba(0,0,0,.05)`, padding `4px clamp(12px,4vw,28px)`,
  **bottom-right** corner uses `--mh-leaf-bar`. The bar pins `box-sizing:
  border-box` on itself so a host page's box model can't resize it.
- **Item:** sans `13px/600`, colour `#595959`, padding `5.5px 13px`, radius
  `--mh-leaf`; hover/current → the cyan highlight (§5).
- **Dropdown panel:** `#fff`, `1px solid #d9d9d9`, radius `--mh-leaf-box`,
  `box-shadow: 0 6px 18px rgba(0,0,0,.12)`.

A builder generating a new page just needs to include the script and (if it has
its own fixed bar like the CV) expose a `#cv-menubar` container.

---

## 9. Component patterns (cheat-sheet)

| Element | Corner | Notes |
|---|---|---|
| Main card (a tool's outer panel) | `--leaf-lg` | width capped at **`--card-max`** (`860px`) so the tools match; let wide content (e.g. a grid) scroll inside its own pane rather than stretch the card |
| Card / panel / modal / drop zone / section | `--leaf-lg` | `--surface` on `--bg`; `--rule` borders; elevation `--shadow-card` |
| Button / medium control | `--leaf` | violet `--accent` fill or outline; cyan only in the menubar |
| Input / select / textarea | `--leaf-sm` | `--rule` border; cyan focus ring (below) |
| Chip / badge | `--leaf-sm` | even ones that were pill-shaped |
| Menubar item / pill / highlight | `--mh-leaf` | cyan highlight on hover/current |
| Code / tabular preview | `--leaf-sm` | text in `--mono-font` |
| Callout / notice strip | `0 6px 6px 0` | left-accent exception (below) — **not** leafed |
| Progress track / fill | `999px` | **not** leafed |
| Avatar / numbered badge / dot | `50%` | **not** leafed |
| Landing backdrop | — | `.flare-backdrop` (orange→cyan radial) |

**States & elevation**

- **Focus ring** — cyan, on `:focus-visible`: `box-shadow: 0 0 0 3px var(--focus)`,
  typically paired with `border-color: var(--accent)` on inputs/controls. Tint
  native controls with `accent-color: var(--accent)`.
- **Elevation** — `--shadow-card` `0 4px 28px rgba(0,0,0,.10)` for main cards;
  `--shadow-bar` `0 1px 4px rgba(0,0,0,.05)` for the menubar; `--shadow-dropdown`
  `0 6px 18px rgba(0,0,0,.12)` for the menubar panel.
- **Callout / notice** — an intentional non-leaf exception: a coloured **left**
  border (`4px solid var(--accent)`, or `--danger` for errors) with simple
  right-rounded corners `border-radius: 0 6px 6px 0`. Helper: `.callout` /
  `.callout.is-error` in `brand.css`.

---

## 10. The game exception

`autofac.html` is a **separate dark "game" sub-brand** (the DrawScreen splash
aesthetic) and intentionally does **not** follow this house style: `--bg #050507`,
`--panel #0a0a0e`, `--amber #ffc75c`, `--cyan #9be8ff`, `--green #73ff8c`, and no
rounded corners. Documents and tools should not borrow it; it's listed here (and
in `tokens.json` → `gamePalette`) so it reads as deliberate, not drift. It still
includes the shared `menubar.js`.

---

## 11. Writing style (the words)

The site has a house *writing* voice as much as a visual one. It governs the
**reader-facing prose**: tool subtitles and hints, button and status text, the CV,
the home page. (Internal dev comments are not bound by it, though they may follow
it.) The full, enforceable rules and rewrite recipes live in the
**`house-style-writing` skill** (`.claude/skills/house-style-writing/SKILL.md`);
the essentials:

1. **No spaced em dashes.** Never ` — `. Recast as two sentences (`.`), a colon
   (`:` for an elaboration), a comma, or parentheses for an aside.
2. **Don't lean on the em dash.** At most one per paragraph, and prefer none.
   Most em dashes are a period, colon, or pair of parentheses in disguise.
3. **Semicolons don't join sentences.** If both halves stand alone, use two
   sentences. Keep the semicolon only for separating items in a complex list.
4. **Plain, active, concrete.** Short sentences. Say what the control does.

A linter for rules 1–3 lives in the local-only `house-style-private/` workshop
(`scan-style.py`), kept out of the repo.

---

## 12. Keeping this in sync

`brand.css` and `tokens.json` are the source of truth for the values; this file
is the source of truth for the rules. The existing pages predate these files and
**inline** their own equivalent tokens, so when a value changes today you must
update all three brand files **and** the affected reference pages. New tools
should **import** `brand.css` rather than copy, so over time the look converges on
one editable place. (Retrofitting the existing pages to import `brand.css` would
make that fully true: a worthwhile future cleanup, not done here.)
