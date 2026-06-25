---
name: house-style-writing
description: >-
  Apply the matthorrigan.com house writing style when composing or revising any
  reader-facing prose on the site: tool pages (MCQer, SeatPlanner, ExamTimer),
  the home page, the CV, and all button, label, hint, placeholder, and status
  text. Enforces no spaced em dashes, sparing em-dash use overall, no semicolons
  joining independent sentences, and a plain, active, concrete voice. Use it
  whenever you add or edit words that a visitor will read.
---

# matthorrigan.com house writing style

The site has one writing voice, the way it has one visual language. This skill is
the source of truth for that voice. The visual rules live beside it in
`brand/house-style.md` (section 11 summarizes these same rules).

## When this applies

**Reader-facing prose only:** subtitles, instructions, hints, placeholders,
button and link text, status and banner messages, the CV, the home page. Code and
developer comments are not bound by it (they may follow it). Creative work (the
games `autofac.html`, `Rock_Walls_and_Damp.html`) keeps its own voice and is
exempt.

## The rules

### 1. No spaced em dashes. Ever.

Never write a space-em dash-space (` — `). It is the single hard rule. An em dash
is *allowed* only when it is **closed up** against the words on both sides
(`word—word`), and even then only **rarely** (see rule 2). Recast a spaced one:

| Instead of ` — ` | Use | When |
|---|---|---|
| two independent clauses | a period (`.`), two sentences | the halves stand alone |
| an explanation / list lead-in | a colon (`:`) | the second half spells out the first |
| a light aside | a comma (`,`) | a brief, in-line qualifier |
| a parenthetical | parentheses `( )` | a true side note you could lift out |

Examples:

- ✗ `Upload a roster — a name list or a Canvas export — and a layout.`
  ✓ `Upload a roster (a name list or a Canvas export) and a layout.`
- ✗ `Entry is now closed — no entry after 30 minutes.`
  ✓ `Entry is now closed. No entry after 30 minutes.`
- ✗ `Scramble pool — all options included.`
  ✓ `Scramble pool: all options included.`

### 2. Don't lean on the em dash at all.

Even unspaced, the em dash is a crutch. Aim for **none**; allow at most **one per
paragraph**. Most are a period, colon, or pair of parentheses wearing a costume.
A sentence with two em dashes is almost always two sentences plus an aside.

### 3. Semicolons don't join sentences.

If both sides of a semicolon can stand alone as sentences, write two sentences.

- ✗ `The correct option is prefixed [Answer.]; the test form shows no marker.`
  ✓ `The correct option is prefixed [Answer.]. The test form shows no marker.`

Keep the semicolon only for separating items in a list whose items already
contain commas. That case is rare in UI copy.

### 4. Plain, active, concrete.

- Short sentences. One idea each.
- Active voice and the imperative for instructions: "Upload a roster," not "A
  roster can be uploaded."
- Say what a control does, in the user's terms, not the implementation's.
- Cut filler ("simply," "just," "please," "in order to"). Prefer the short word.
- Sentence case for everything except proper nouns. No Title Case In Sentences.
- Match the existing copy's terms; don't introduce a synonym for a named thing.

### 5. Colon capitalization (APA).

Capitalize the first word after a colon **only when what follows is a complete
sentence**. Keep it lowercase when what follows is a fragment or a list.

- ✓ complete sentence: `The rule is simple: Every roster needs a layout.`
- ✓ fragment: `Upload two things: a roster and a layout.`
- ✓ list: `Supported formats: plain text, CSV, Canvas export.`

### 6. Default to Chicago.

For anything these house rules don't cover (hyphenation, number style, quotation
and punctuation placement, capitalization edge cases), follow the **Chicago Manual
of Style**. The house rules above win wherever they speak; Chicago fills the rest.

## Workflow when editing site copy

1. Write or revise the prose following the rules above.
2. Run the linter from the repo root:
   `house-style-private/scan-style.py` (or name a file to check just it).
   It strips comments and code, so it judges what ships. It exits non-zero on a
   spaced em dash.
3. Skim the warnings (em-dash over-use, suspect semicolons) and fix real ones.

The linter and any private drafts live in the gitignored `house-style-private/`
workshop. The committed brand docs are `brand/house-style.md`, `brand/tokens.json`,
and `brand/brand.css`.
