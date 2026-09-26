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
`brand/backstage/house-style.md` (section 10 summarizes these same rules).

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

### 6. No hyphenated “-level” modifiers.

Treat every hyphenated adjective ending in `-level` as prohibited LLM jargon,
including `workflow-level`, `process-level`, `output-level`, and `task-level`.
Name the exact scope, evidence, object, or relationship instead. Do not replace
one `-level` compound with another.

### 7. The serial comma, always.

Three or more items in a series take a comma before the conjunction. It is the
house comma, not a preference to be weighed each time.

- ✓ `plain text, CSV, and Canvas export`
- ✗ `plain text, CSV and Canvas export`
- ✓ `It builds the world, places the kiosks, and moves the avatar.`

It earns its keep on the sentences where the last two items would otherwise
read as one thing: `the tools, the games, and the music` is three offerings,
`the tools, the games and the music` can be read as two.

### 8. A run-in title takes a colon.

A title that opens a paragraph and runs straight into its text (a run-in title,
set in italics or bold) always ends in a **colon**, never a period. Chicago sets
a period here; the house style wins. Rule 5 still decides the next word's case.

- ✓ `*Contingency, management, leadership:* I design courses for scalability …`
- ✗ `*Contingency, management, leadership.* I design courses for scalability …`
- ✓ `**Media samples:** matthorrigan.com (a walkable isometric site …)`

A caption label (`Table 1.`) is not a run-in title. A bold lead that is itself a
complete sentence keeps its period.

### 9. Default to Chicago.

For anything these house rules don't cover (hyphenation, number style, quotation
and punctuation placement, capitalization edge cases), follow the **Chicago Manual
of Style**. The house rules above win wherever they speak; Chicago fills the rest.
Chicago prescribes the serial comma too, so rule 7 is Chicago made explicit
rather than an exception to it.

## Workflow when editing site copy

1. Write or revise the prose following the rules above.
2. Run the linter:
   `python3 storage/house-style/house-style-private-workshop/scan-style.py`
   (it finds the site's pages itself; or name a file, HTML or Markdown, to check just it).
   It strips comments and code, so it judges what ships. It exits non-zero on a
   spaced em dash.
3. Skim the warnings (em-dash over-use, suspect semicolons, run-in titles that
   end in a period) and fix real ones.

The linter and any private drafts live in the gitignored `storage/house-style/`
workshop. The committed brand docs are `brand/backstage/house-style.md`,
`brand/backstage/tokens.json`, and `brand/brand.css`.
