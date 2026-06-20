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
- Use **maroon `--accent`** for the document's links / primary buttons / labels.
- Let the **menubar stay cyan-only** (it's handled for you by `menubar.js`).
- Type: **`--sans-font`** for UI / headings / app chrome; **`--body-font`** (serif)
  for long-form prose (the CV); **`--mono-font`** for code/tabular output.
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
3. **Menubar = site brand; document body = its own accent.** The menubar is
   cyan everywhere. The reading surface (CV, tools) uses the **maroon `--accent`**
   for its links and buttons. Keeping these lanes separate is intentional.
4. **Fixed geometry over fluid.** The leaf uses fixed px radii so a wide panel and
   a narrow pill show the *same* corner arc. Percentages stretch the corner flat;
   we only use them for genuinely fluid/inline things (text highlights).
5. **Status colours stay out of the brand.** Errors/warnings use a separate red
   (`--danger`) so they never get mistaken for the maroon accent.

---

## 3. Colour

### Highlight / interaction
| Token (canonical) | Value | Role | Aliases in code |
|---|---|---|---|
| `--brand-cyan` | `#c3f0ff` | the single highlight/interaction colour | `--mh-blue`, `--favcolor`, `--focus`, `--flare-cool` |

### Document accent (CV + tools; **not** the menubar)
| Token | Value | Role |
|---|---|---|
| `--accent` | `#6b1f2a` | deep maroon — links, primary buttons, labels, progress fills |
| `--accent-strong` | `#531722` | accent hover / active |
| `--accent-wash` | `#f6eef0` | tint behind hovered / confirmed surfaces |
| `--on-accent` | `#ffffff` | text/icons on an accent fill |

### Flare / landing backdrop
| Token | Value | Role |
|---|---|---|
| `--flare-warm` | `#f28b46` | orange end of the home/landing "cloud" (`--secondcolor` on index) |
| `--flare-cool` | `#c3f0ff` | blue end of the cloud (= `--brand-cyan`) |

### Neutrals
| Token | Value |
|---|---|
| `--ink` | `#1a1a1a` |
| `--muted` | `#595959` |
| `--faint` | `#8a8a8a` |
| `--rule` | `#d9d9d9` |
| `--bg` | `#faf6f7` |
| `--surface` | `#ffffff` |
| `--surface-tint` | `#f3eef1` |

### Status (deliberately distinct from the brand)
| Token | Value | Role |
|---|---|---|
| `--danger` | `#b2241a` | error / warning text & state |
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
| `--sans-font` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` | UI, headings, app chrome, **the tool bodies**, CV headings |
| `--body-font` | `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` | long-form prose — the **CV body** (and prose blocks elsewhere) |
| `--mono-font` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | code / tabular previews (e.g. MCQer's format reference) |

- **Sans is the default for UI.** The three tools are UI-dense apps and set their
  `<body>` to `--sans-font`; `--body-font` (serif) is for *running prose* — the
  CV's body — not for tool chrome.
- The **menubar** pins a system-sans stack at a **fixed `13px` / weight `600`**
  (px, not rem) so the bar is pixel-identical across pages with different root
  font-sizes (the CV uses `html{font-size:14px}`; others default to 16px).
  `menubar.js` hard-codes this stack — which additionally lists `system-ui` —
  rather than referencing `--sans-font`, on purpose, so the bar is self-contained.
- **Home-page exception:** `index.html` is bespoke — Georgia serif body with
  Tahoma/Arial small-caps headings. New tools should prefer `--sans-font` (UI) +
  `--body-font` (prose) rather than copying the home page.

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
| Card / panel / modal / drop zone / section | `--leaf-lg` | `--surface` on `--bg`; `--rule` borders; elevation `--shadow-card` |
| Button / medium control | `--leaf` | maroon `--accent` fill or outline; cyan only in the menubar |
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

## 11. Keeping this in sync

`brand.css` and `tokens.json` are the source of truth for the values; this file
is the source of truth for the rules. The existing pages predate these files and
**inline** their own equivalent tokens, so when a value changes today you must
update all three brand files **and** the affected reference pages. New tools
should **import** `brand.css` rather than copy, so over time the look converges on
one editable place. (Retrofitting the existing pages to import `brand.css` would
make that fully true — a worthwhile future cleanup, not done here.)
