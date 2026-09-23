#!/usr/bin/env python3
"""Build glossary-data.js for the walkable glossary.

Two bodies, kept strictly apart, because the difference is the point:

  GLOSSARY      the author's own vocabulary. Sections I to V of the
                Zettelclauden's LEXICON.md are terms scattered through his own
                corpus; sections VI and VII are coinages made during the Claude
                loop passes, so they are admitted only where the zettel behind
                them is tagged provenance:human.

  ANTIGLOSSARY  the penumbra: notes Claude wrote about what the corpus does not
                say. Tagged zone:penumbra in Zotero, provenance:claude-probe.
                Nobody should mistake these for the author's theory.

Reads, never writes, two places that are not this repository:
  ~/Zotero/zotero.sqlite                    (copied first; Zotero may be open)
  …/PERUSABLE/CLAUDE_HERE/02_THEMES/LEXICON.md

    python3 brand/backstage/build-glossary-data.py [--out glossary-data.js]
"""
import argparse
import html as _html
import json
import os
import re
import shutil
import sqlite3
import tempfile

HOME = os.path.expanduser("~")
ZOTERO = os.path.join(HOME, "Zotero", "zotero.sqlite")
LEXICON = os.path.join(
    HOME, "Documents", "OneDrive - Simon Fraser University (1sfu)", "Work",
    "2024_MusicBookProject", "Drafting", "AllNotes", "PERUSABLE", "CLAUDE_HERE",
    "02_THEMES", "LEXICON.md")
COLLECTION = "BV9J4ES9"          # Zotero → CLAUDES_NOTES → Zettelclauden
HERE = os.path.dirname(os.path.abspath(__file__))
ENTRIES = os.path.join(HERE, "glossary-entries.md")        # the written glossary
ANTI_ENTRIES = os.path.join(HERE, "antiglossary-entries.md")   # the written penumbra

# The four terms the glossary page carried before it was generated, in the
# author's own published wording. They win over the lexicon's compressed note
# for the same term, because he wrote these for readers. Two of them are in the
# lexicon's loop-pass sections and would otherwise be dropped as coinages that
# are not provably his; his having published them settles that.
SITE_TERMS = {
    "departmentality": (
        "The reproduction of a distinct subculture for each department of a"
        " motion picture production. Departments gain autonomy by refusing"
        " requests and becoming opaque when surveilled.", "Academia / labour / media", "★↗"),
    "hauntological security": (
        "Resignation to a future with unknown but overwhelmingly negative"
        " consequences, and a central part of the comfort that small horror"
        " games afford.", "SF / horror / infohazard / cyberpunk", "★"),
    "margin-worker": (
        "A middle manager on a film crew, mediating between departments, whose"
        " work absorbs the unglamourous parts of directorship.",
        "Academia / labour / media", "★"),
    "voiceshifting": (
        "The techniques by which artists modify the pitch and formants of their"
        " electronically mediated voices to create characters and personae. Not"
        " only Auto-Tune, but a rich variety of precursors, alternatives, and"
        " experimental workflows.", "Voice / sound / music", "★"),
}

MARKS = {"★": "coinage", "↗": "extended", "↺": "borrowed", "": "plain"}


def kind_of(mark):
    """★ coined it, ↗ extended someone else's, ↺ borrowed it whole.

    A mark can carry two. ★↗ is the commonest: a word of M.'s own, coined on
    somebody else's term, and it gets a kind of its own so the page can say that
    in words rather than printing an arrow nobody can read.
    """
    if "★" in mark and "↗" in mark:
        return "extended-coinage"
    for ch in mark:
        if ch in MARKS:
            return MARKS[ch]
    return "plain"


def tidy(s):
    """Lexicon prose is markdown; the page wants a plain sentence."""
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    s = re.sub(r"\[\[(.+?)\]\]", r"\1", s)
    s = re.sub(r"\s*\(see [^)]+\)", "", s)
    s = re.sub(r"\s*\(cf\. [^)]+\)", "", s)
    s = re.sub(r"\bcoined\b", "neologized", s)       # the site's word for it (the user's call, 2026-09-22)
    return s.strip(" ;·")


def read_lexicon():
    """Entries per section, with their novelty mark.

    A bullet is a head of one or more bold terms, then a single shared gloss:

        - **hyperrock** ★ ; **maidcore**, **clowncore** ↺ (scene labels) — voiceshifting genres.

    so the terms after the first are aliases of the first, not entries of their
    own. A second entry can also begin INSIDE a gloss, after a full stop or a
    middle dot, and that one does get its own record:

        - **electrovocology** ★ — the study of … **spectropoetics** ★ — poetics of …
    """
    src = open(LEXICON, encoding="utf-8").read()
    head_item = re.compile(r"\*\*(.+?)\*\*\s*([★↗↺/]*)\s*(\([^()]*\))?\s*")

    def parse(chunk, out):
        chunk = re.sub(r"\s+", " ", chunk).strip()
        items, pos = [], 0
        while True:                                   # the head: terms, then the gloss
            m = head_item.match(chunk, pos)
            if not m:
                break
            items.append((m.group(1).strip(), m.group(2)))
            pos = m.end()
            sep = re.match(r"[;,]\s*", chunk[pos:])
            if not sep:
                break
            pos += sep.end()
        if not items:
            return                                    # not a term bullet at all
        rest = re.sub(r"^—\s*", "", chunk[pos:])
        tail = ""
        cut = re.search(r"(?<=[.·])\s+(\*\*[^*]+\*\*\s*[★↗↺/]*\s*(?:\([^()]*\))?\s*(?:[;,]|—))", rest)
        if cut:
            tail, rest = rest[cut.start(1):], rest[:cut.start(1)].rstrip()
        names = []
        for name, _ in items:
            names += [n.strip() for n in name.split("/") if n.strip()]
        out.append({"term": names[0], "aka": names[1:], "mark": items[0][1], "gloss": rest})
        if tail:
            parse(tail, out)

    out, dropped = [], []
    parts = re.split(r"^##\s+(.+)$", src, flags=re.M)
    for i in range(1, len(parts), 2):
        section, body = parts[i].strip(), parts[i + 1]
        raw = []
        for m in re.finditer(r"^-\s+(.*?)(?=\n-\s|\n#|\n---|\Z)", body, re.M | re.S):
            parse(m.group(1), raw)
        label = re.sub(r"^[IVX]+\.\s*", "", section)
        label = re.split(r"\s+\(|\s+—\s+", label)[0].strip()
        for e in raw:
            e.update({"kind": kind_of(e["mark"]), "gloss": tidy(e["gloss"]),
                      "section": label, "loopPass": section.startswith(("VI.", "VII."))})
            # The long-tail bullet names nine coinages and defines none of them
            # ("glosses in _raw-capture*.md"). An entry with no definition is a
            # dead stop in a glossary, so it waits until there is one to show.
            if not e["gloss"] or "sampling of the long tail" in e["gloss"]:
                dropped.append(e["term"])
                continue
            out.append(e)
    if dropped:
        print("  no gloss in LEXICON.md, left out: %s" % ", ".join(dropped))
    return out


def read_zotero():
    """Every note in the Zettelclauden, with its id, provenance and zone."""
    tmp = tempfile.mkdtemp()
    copy = os.path.join(tmp, "z.sqlite")
    shutil.copy(ZOTERO, copy)
    db = sqlite3.connect(copy)
    rows = db.execute("""
        SELECT i.itemID, n.note
        FROM items i
        JOIN itemNotes n ON n.itemID = i.itemID
        JOIN collectionItems ci ON ci.itemID = i.itemID
        JOIN collections c ON c.collectionID = ci.collectionID
        LEFT JOIN deletedItems d ON d.itemID = i.itemID
        WHERE (c.key = ? OR c.parentCollectionID =
               (SELECT collectionID FROM collections WHERE key = ?))
          AND d.itemID IS NULL
        GROUP BY i.itemID""", (COLLECTION, COLLECTION)).fetchall()
    notes = []
    for item_id, note in rows:
        tags = [t for (t,) in db.execute(
            "SELECT t.name FROM itemTags it JOIN tags t ON t.tagID = it.tagID WHERE it.itemID = ?",
            (item_id,))]
        text = _html.unescape(re.sub(r"<[^>]+>", "\n", note or ""))
        lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n")]
        lines = [l for l in lines if l]
        head = lines[0] if lines else ""
        m = re.match(r"([ZN]\d+[a-z]?)\s*·\s*(.+)", head)
        nid = m.group(1) if m else next((t for t in tags if re.match(r"^[ZN]\d+", t)), "")
        title = m.group(2) if m else head
        term, _, gloss = title.partition("—")
        body = next((l for l in lines[1:] if len(l) > 80 and not l.startswith(("Links", "Seed", "Provenance"))), "")
        notes.append({
            "id": nid,
            "term": tidy(term),
            "gloss": tidy(gloss),
            "body": tidy(body),
            "provenance": next((t.split(":", 1)[1] for t in tags if t.startswith("provenance:")), ""),
            "zone": next((t.split(":", 1)[1] for t in tags if t.startswith("zone:")), ""),
        })
    db.close()
    shutil.rmtree(tmp, ignore_errors=True)
    return notes


def build():
    # Terms M. has vouched for by hand, whatever mark the lexicon gave them.
    VOUCHED = {k for k, v in read_entries(ENTRIES).items() if v.get("mine")}
    lex = read_lexicon()
    notes = read_zotero()
    by_term = {}
    for n in notes:
        if n["term"]:
            by_term.setdefault(re.sub(r"^the\s+", "", n["term"].lower()).strip(), n)

    def zettel_for(term):
        key = re.sub(r"^the\s+", "", term.lower()).strip()
        n = by_term.get(key)
        if n and n["id"].startswith("Z"):
            return n
        for other, n in by_term.items():                  # "masocriticism" ← "corporate masocriticism"
            if not n["id"].startswith("Z"):
                continue
            if key and (key == other or key in other.split() or other.endswith(" " + key)):
                return n
        return None

    # ONLY NEOLOGISMS. The lexicon's own marks are the author's account of where
    # each term came from: ★ he coined it, ↗ he extended someone else's, ↺ he
    # borrowed it whole. A word is his invention when the mark carries ★, in any
    # combination; a term he only extended is somebody else's word. The
    # antiglossary is Claude's inventions throughout, so it needs no test.
    dropped_borrowed = []
    glossary, seen = [], set()
    for e in lex:
        z = zettel_for(e["term"])
        human = bool(z and z["provenance"] == "human")
        if e["loopPass"] and not human:
            continue                                   # a loop-pass coinage, not his alone
        key = e["term"].lower()
        if key in seen:
            continue
        seen.add(key)
        if "★" not in e["mark"] and key not in SITE_TERMS and key not in VOUCHED:
            dropped_borrowed.append("%s %s" % (e["term"], e["mark"] or "(unmarked)"))
            continue
        if "↺" in e["mark"] and e["aka"]:
            # "profilicity / antiprofilicity ↺/★": the borrowed word came first and
            # the coinage answers it. The coinage is the entry; the borrowed word
            # is what it is coined against.
            e = dict(e, term=e["aka"][-1], aka=[], against=e["term"])
        row = {
            "term": e["term"], "aka": e["aka"], "kind": e["kind"], "mark": e["mark"],
            "gloss": e["gloss"], "section": e["section"],
            "zettel": (z or {}).get("id", ""), "provenance": (z or {}).get("provenance", ""),
        }
        if e.get("against"):
            row["against"] = e["against"]
        glossary.append(row)

    for term, (gloss, section, mark) in SITE_TERMS.items():
        hit = next((e for e in glossary if e["term"].lower() == term), None)
        if hit:
            hit["gloss"] = gloss
        else:
            z = zettel_for(term)
            glossary.append({"term": term, "aka": [], "kind": kind_of(mark), "mark": mark,
                             "gloss": gloss, "section": section,
                             "zettel": (z or {}).get("id", ""),
                             "provenance": (z or {}).get("provenance", "")})

    written = read_entries(ENTRIES)
    moved = []
    for term, w in written.items():
        hit = next((e for e in glossary if e["term"].lower() == term), None)
        if w.get("drop"):
            if hit:
                glossary.remove(hit)
            continue
        if w.get("cave"):
            # Not his coinage but not anybody else's either: a word that came out
            # of the loop passes. It belongs with the rest of the machine's
            # inventions, in the cave, and it says so there.
            moved.append({"id": w.get("zettel", ""), "term": w.get("term") or term,
                          "gloss": w.get("gloss") or (hit["gloss"] if hit else ""),
                          "glossFr": w.get("fr", ""), "why": w["cave"]})
            if hit:
                glossary.remove(hit)
            continue
        if not hit:                                  # a term the lexicon never carried
            z = zettel_for(term)
            hit = {"term": w.get("term", term), "aka": [], "kind": "coinage",
                   "mark": w.get("mark", "\u2605"), "gloss": "", "section": w.get("section", ""),
                   "zettel": w.get("zettel") or (z or {}).get("id", ""),
                   "provenance": (z or {}).get("provenance", "")}
            glossary.append(hit)
        if w.get("term"):
            hit["term"] = w["term"]                   # the written spelling wins
        if w.get("gloss"):
            hit["gloss"] = w["gloss"]
        if w.get("fr"):
            hit["glossFr"] = w["fr"]
        if w.get("term-fr"):
            hit["termFr"] = w["term-fr"]
        for f in ("section", "mark", "zettel"):
            if w.get(f):
                hit[f] = w[f]
        if w.get("mark"):
            hit["kind"] = kind_of(w["mark"])     # the kind follows the mark
        if w.get("mine"):
            hit["mine"] = True


    anti = list(moved)
    for n in notes:
        if n["zone"] != "penumbra":
            continue
        # The body is not shipped: the page shows the claim, and the note
        # itself stays in Zotero where it can be argued with.
        anti.append({"id": n["id"], "term": n["term"], "gloss": n["gloss"] or n["body"][:180]})
    anti_written = read_entries(ANTI_ENTRIES)
    left_out = [k for k, w in anti_written.items() if w.get("drop")]
    anti = [a for a in anti if (a.get("id") or "").lower() not in left_out
            and a["term"].lower() not in left_out]
    # An entry written here that matches no note and no moved term is still an
    # entry: the cave is where a word goes when it is nobody's coinage.
    have = {(a.get("id") or "").lower() for a in anti} | {a["term"].lower() for a in anti}
    for key, w in anti_written.items():
        if key in have or not w.get("gloss") or w.get("drop"):
            continue
        if any((w.get("title") or "").lower() == a["term"].lower() for a in anti):
            continue
        anti.append({"id": "", "term": w.get("title") or key, "gloss": w["gloss"],
                     "glossFr": w.get("fr", ""), "termFr": w.get("title-fr", "")})

    for a in anti:
        # by note id for a note, by term for a word that was moved in here
        w = anti_written.get((a.get("id") or "").lower()) or anti_written.get(a["term"].lower(), {})
        if w.get("gloss"):
            a["gloss"] = w["gloss"]
        if w.get("fr"):
            a["glossFr"] = w["fr"]
        if w.get("title"):
            a["term"] = w["title"]
        if w.get("title-fr"):
            a["termFr"] = w["title-fr"]
    # One stable name per entry for ?term= and ?note=, checked for collisions.
    seen_slugs = {}
    for e in glossary + anti:
        base = slugify(e.get("id") or e["term"])
        slug, n = base, 2
        while slug in seen_slugs:
            slug, n = "%s-%d" % (base, n), n + 1
        seen_slugs[slug] = True
        e["slug"] = slug

    anti.sort(key=lambda a: (a.get("id") or "zz", a["term"]))
    if left_out:
        print("  nobody's coinage, so in neither half: %s" % ", ".join(sorted(left_out)))
    if moved:
        print("  moved into the cave, as the machine's own words: %s"
              % ", ".join(m["term"] for m in moved))

    if dropped_borrowed:
        print("  not his coinages, so left out of the glossary (%d):" % len(dropped_borrowed))
        for d in sorted(dropped_borrowed):
            print("    %s" % d)

    words = load_words()
    for e in glossary:
        e["rank"] = neologism(e["term"], e["mark"], words)

    # The data is ordered by that rank, because the crawl is: the walk starts in
    # ordinary language and ends in words that exist nowhere but here. The page's
    # text lists are alphabetical, as a glossary should be.
    return {"glossary": sorted(glossary, key=lambda g: (g["rank"], g["term"].lower())),
            "antiglossary": anti}


WORDS = "/usr/share/dict/words"          # 235k ordinary English words, on any mac


def load_words():
    try:
        return {w.strip().lower() for w in open(WORDS, encoding="utf-8", errors="ignore")}
    except OSError:
        return set()


def neologism(term, mark, words):
    """0 for a word the field already uses, 1 for one that exists nowhere else.

    Two things decide it, and neither is a judgement call:

      the mark   ↺ borrowed whole, ↗ someone else's term extended, ★ his own
                 coinage. That is the author's own account of where a term came
                 from, and it carries most of the weight.
      the letters  whether the words are in an ordinary English dictionary.
                 "margin-worker" is a coinage out of two plain words; nothing
                 outside this corpus says "phobonomics". Worth a fifth.

    The walk is ordered by this, and the ground grows rockier as it rises.
    """
    star, ext, bor = "★" in mark, "↗" in mark, "↺" in mark
    if bor and star:
        base = 0.45                              # borrowed, and a coinage beside it
    elif bor:
        base = 0.05
    elif star and ext:
        base = 0.60
    elif star:
        base = 0.80
    elif ext:
        base = 0.35
    else:
        base = 0.25
    parts = [w for w in re.split(r"[^A-Za-z]+", term) if len(w) > 2]
    odd = [w for w in parts if words and w.lower() not in words]
    return round(min(1.0, base + 0.2 * (len(odd) / len(parts) if parts else 0)), 4)


def unescape(s):
    """A hand-written file may spell a no-break space the way i18n-fr.js does,
    as a \\uXXXX escape. Decode those AFTER whitespace is normalised, because
    str.split() counts a no-break space as whitespace and would eat it."""
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


def read_entries(path):
    """The hand-written entries: prose first, parsing second.

    A section is a heading, then any number of `key: value` lines, then the
    English definition, then optionally a line saying just `fr:` and the French
    after it. Anything above the first `---` is the file's own instructions.
    """
    out = {}
    try:
        src = open(path, encoding="utf-8").read()
    except OSError:
        return out
    src = src.split("\n---\n", 1)[-1]
    for block in re.split(r"^##\s+", src, flags=re.M)[1:]:
        lines = block.rstrip().split("\n")
        key = lines[0].strip()
        fields, body, i = {}, [], 1
        while i < len(lines) and re.match(r"^[a-z-]+:\s*\S", lines[i]):
            k, _, v = lines[i].partition(":")
            fields[k.strip()] = unescape(v.strip())
            i += 1
        rest = "\n".join(lines[i:])
        en, _, fr = rest.partition("\nfr:\n")
        fields.setdefault("term", key)                # the heading IS the headword
        fields["gloss"] = unescape(" ".join(en.split()))
        fields["fr"] = unescape(" ".join(fr.split()))
        out[key.lower()] = fields
    return out


def slugify(s):
    """The piece of a URL that names one entry, so every entry can be cited."""
    s = s.lower().replace("\u2192", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "entry"


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def write_lists(data, page):
    """Write the two word lists into glossary.html, between its markers.

    The crawl reads glossary-data.js and the lists are written from the same
    build, so the two cannot disagree. Everything outside the markers is the
    page's own hand-written prose and is left exactly as it is.
    """
    rows = []
    order = sorted(range(len(data["glossary"])), key=lambda i: data["glossary"][i]["term"].lower())
    for i in order:
        e = data["glossary"][i]
        tfr = (' data-fr="%s"' % esc(e["termFr"])) if e.get("termFr") else ""
        dt = ('        <dt id="t-%s"><button type="button" data-side="glossary" data-i="%d"%s>%s</button>'
              '<button type="button" class="cite" data-cite="%s">cite</button></dt>'
              % (esc(e["slug"]), i, tfr, esc(e["term"]), esc(e["slug"])))
        where = " \u00b7 ".join([x for x in [e["section"], e["zettel"]] if x])
        # The English is written out, so the list reads with no script at all.
        # glossary-world.js rewrites the section and the "also" in French.
        aka = ('<span class="aka" data-aka="%s"> also %s.</span>'
               % (esc(", ".join(e["aka"])), esc(", ".join(e["aka"])))) if e["aka"] else ""
        fr = (' data-fr="%s"' % esc(e["glossFr"])) if e.get("glossFr") else ""
        dd = ('        <dd data-term="%s"><span class="g"%s>%s</span>%s '
              '<span class="where" data-section="%s" data-zettel="%s">%s</span></dd>'
              % (esc(e["term"].lower()), fr, esc(e["gloss"]), aka,
                 esc(e["section"]), esc(e["zettel"]), esc(where)))
        rows.append(dt + "\n" + dd)
    gloss_html = "\n".join(rows)

    rows = []
    for i, a in enumerate(data["antiglossary"]):
        dt = ('        <dt id="t-%s"><button type="button" data-side="penumbra" data-i="%d">%s</button>'
              '<button type="button" class="cite" data-cite="%s">cite</button></dt>'
              % (esc(a["slug"]), i, esc(a["term"]), esc(a["slug"])))
        fr = (' data-fr="%s"' % esc(a["glossFr"])) if a.get("glossFr") else ""
        dd = ('        <dd><span class="g"%s>%s</span> <span class="where">%s \u00b7 zone:penumbra</span></dd>'
              % (fr, esc(a["gloss"]), esc(a.get("id") or "the penumbra")))
        rows.append(dt + "\n" + dd)
    pen_html = "\n".join(rows)

    src = open(page, encoding="utf-8").read()
    for name, body in (("GLOSSARY", gloss_html), ("PENUMBRA", pen_html)):
        a = src.index("<!-- %s:START -->" % name) + len("<!-- %s:START -->" % name)
        b = src.index("<!-- %s:END -->" % name)
        src = src[:a] + "\n" + body + "\n        " + src[b:]
    open(page, "w", encoding="utf-8").write(src)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "glossary-data.js"))
    ap.add_argument("--page", default=os.path.join(os.path.dirname(__file__), "..", "..", "glossary.html"))
    a = ap.parse_args()
    data = build()
    js = ("// @ts-check\n\"use strict\";\n"
          "/* glossary-data.js — GENERATED by brand/backstage/build-glossary-data.py.\n"
          " * Do not hand-edit: re-run the script, which reads the Zettelclauden's\n"
          " * LEXICON.md and the Zotero collection it lives in.\n"
          " *\n"
          " *   glossary      the author's own vocabulary\n"
          " *   antiglossary  the penumbra, written by Claude about what the corpus does not say\n"
          " */\n"
          "window.MH_GLOSSARY = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    out = os.path.abspath(a.out)
    open(out, "w", encoding="utf-8").write(js)
    print("%s: %d glossary terms, %d antiglossary entries"
          % (os.path.relpath(out), len(data["glossary"]), len(data["antiglossary"])))
    g = data["glossary"]
    print("  the walk begins: %s" % ", ".join("%s (%.2f)" % (e["term"], e["rank"]) for e in g[:3]))
    print("  and ends:        %s" % ", ".join("%s (%.2f)" % (e["term"], e["rank"]) for e in g[-3:]))
    write_lists(data, os.path.abspath(a.page))
    print("%s: both word lists written between their markers" % os.path.relpath(os.path.abspath(a.page)))
    # House style has one hard rule, and these words pass through onto the page.
    spaced = [e.get("term") for e in data["glossary"] + data["antiglossary"]
              if " \u2014 " in (e.get("gloss", "") + e.get("term", ""))]
    if spaced:
        print("  SPACED EM DASH, against house style, in: %s" % ", ".join(spaced))
