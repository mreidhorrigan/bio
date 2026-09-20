#!/usr/bin/env python3
"""Render each page in both languages and report what the French misses.

    python3 tools/i18n-check.py                  # every page with a switch
    python3 tools/i18n-check.py ExamTimer.html   # just one

It serves the repo on a spare port, loads each page in headless Chrome, and
checks:

  * the language switch is on the page, in both languages
  * <html lang> flips to fr
  * every French rule still matches something (MH_I18N.check(), run inside the
    page through a same-origin iframe) — this is what catches a rule whose
    selector has drifted away from the markup
  * nothing in the French page is still visibly English

The last check is a heuristic: it lists visible strings that are byte-identical
in both renders. Names of works, tool names, numbers, and keyboard keys are
SUPPOSED to be identical, so the list is read, not obeyed. See docs/i18n.md.
"""
import http.server
import json
import os
import re
import socket
import subprocess
import sys
import threading
from html.parser import HTMLParser

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", "about.html", "toolbox.html", "MCQer.html", "SeatPlanner.html",
         "ExamTimer.html", "Nameplates.html", "autofac.html", "pitch-shift.html",
         "Horrigan_CV.html"]
# Identical in both languages on purpose: names, keys, units, symbols.
KEEP = re.compile(r"""^(?:
      [\W\d\s]+                                   # punctuation, numbers, arrows
    | (?:MCQer|SeatPlanner|ExamTimer|Nameplates|Canvas|CourseTools|CV|Web|PDF|DOCX)
    | (?:No\ Phenomenon|SoundCloud|Bandcamp|Autofac.*|Rock\ walls.*|Clod\ Bathos.*|Appraising.*)
    | (?:Matt(?:hew)?\ Horrigan.*|M\.\ Reid\ Horrigan.*|mhorriga.*)
    | (?:WASD|Cmd|Ctrl|Espace|Space|Menu|Options?|Instagram|GPT|IMSCC|IAT.*)
    | .{0,2}                                      # one- or two-character labels
  )$""", re.X | re.I)


class Visible(HTMLParser):
    """The text a reader actually sees, in document order."""
    SKIP = {"script", "style", "noscript", "svg", "path", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.out = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            return
        text = " ".join(data.split())
        if text:
            self.out.append(text)


def serve(port):
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def dom(url):
    out = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--dump-dom",
         "--virtual-time-budget=5000", url],
        capture_output=True, text=True, timeout=90)
    return out.stdout


HARNESS = """<!doctype html><meta charset="utf-8"><title>i18n check</title>
<iframe id="f" src="%s" style="width:900px;height:600px"></iframe>
<pre id="out">pending</pre>
<script>
  // Same origin, so the harness can ask the page's own i18n runtime which of its
  // French rules matched nothing. That is the real coverage check.
  document.getElementById("f").addEventListener("load", function () {
    setTimeout(function () {
      var out = document.getElementById("out");
      try {
        var w = document.getElementById("f").contentWindow;
        out.textContent = w.MH_I18N ? JSON.stringify(w.MH_I18N.check("fr")) : "NO-I18N";
      } catch (e) { out.textContent = "ERR " + e.message; }
    }, 2500);
  });
</script>
"""


def stale_rules(base, page, tmpdir):
    """Ask the page's own runtime which French rules matched nothing."""
    name = "._i18n_check.html"
    path = os.path.join(tmpdir, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(HARNESS % (page + "?lang=fr"))
    try:
        html = dom(base + name)
    finally:
        os.remove(path)
    m = re.search(r'(?s)<pre id="out">(.*?)</pre>', html)
    if not m:
        return ["harness did not run"]
    text = m.group(1).strip()
    if text in ("pending", "NO-I18N") or text.startswith("ERR"):
        return [text]
    try:
        return json.loads(text)
    except ValueError:
        return ["unreadable: " + text[:80]]


def visible(html):
    # Strip scripts and styles BEFORE splitting on <body>: a CSS comment in
    # toolbox.html contains the literal text "<body>", which otherwise wins.
    html = re.sub(r"(?is)<script.*?</script>|<style.*?</style>|<!--.*?-->", "", html)
    body = re.search(r"(?is)<body[^>]*>(.*)</body>", html)
    p = Visible()
    p.feed(body.group(1) if body else html)
    return p.out


def main():
    pages = [a for a in sys.argv[1:] if not a.startswith("-")] or PAGES
    if not os.path.exists(CHROME):
        print("Chrome not found at " + CHROME)
        return 2
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    serve(port)
    base = "http://127.0.0.1:%d/" % port

    bad = 0
    shared, matched = {}, set()      # "*" rules, and where they landed

    def all_shared(stale):
        """The shared rules that DID match on this page."""
        if not isinstance(stale, list):
            return []
        if stale and not isinstance(stale[0], dict):
            return []                                   # the check itself failed
        missing = {e["sel"] for e in stale if e["scope"] == "*"}
        return [sel for sel in shared if sel not in missing]

    for page in pages:
        if not os.path.exists(os.path.join(ROOT, page)):
            continue
        en, fr = dom(base + page), dom(base + page + "?lang=fr")
        notes = []
        if "mh-langbtn" not in en:
            notes.append("no language switch in English")
        if "mh-langbtn" not in fr:
            notes.append("no language switch in French")
        if not re.search(r'<html[^>]*\blang="fr"', fr):
            notes.append("<html lang> did not become fr")
        stale = stale_rules(base, page, ROOT)
        if isinstance(stale, list) and stale and isinstance(stale[0], dict):
            for entry in stale:
                shared.setdefault(entry["sel"], 0)
            mine = [e["sel"] for e in stale if e["scope"] == page]
            if mine:
                notes.append("%d rule(s) match nothing: %s" % (len(mine), ", ".join(mine)))
        elif stale:
            notes.append("check failed: " + "; ".join(str(x) for x in stale))
        matched.update(sel for sel in all_shared(stale) if True)
        ven, vfr = visible(en), visible(fr)
        same = [t for t in set(ven) & set(vfr) if not KEEP.match(t)]
        print(("%-22s %s" % (page, "; ".join(notes) if notes else "ok")))
        if notes:
            bad += 1
        for t in sorted(same, key=len, reverse=True)[:40]:
            print("    still English? " + (t[:110]))
    # Only meaningful over the whole site: a shared rule for the CV's own bar will
    # of course match nothing if the CV was not among the pages checked.
    orphans = [] if pages != PAGES else [sel for sel in shared if sel not in matched]
    if orphans:
        print("\nshared rules that matched no page at all:")
        for sel in orphans:
            print("    " + sel)
        bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
