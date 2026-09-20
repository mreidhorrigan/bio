#!/usr/bin/env python3
"""List the reader-facing strings on a page, so the French dictionary can be
kept honest as the site grows.

Usage:  python3 tools/i18n-extract.py ExamTimer.html [--markup|--js|--attrs]

It prints three groups:
  MARKUP  visible text nodes in <body>, with a CSS-ish path to the element
  ATTRS   placeholder / title / aria-label / alt / value-on-button attributes
  JS      string literals in inline <script> that look like sentences

This is a reading aid, not a build step: nothing on the site depends on it.
See docs/i18n.md.
"""
import re
import sys
from html.parser import HTMLParser

SKIP = {"script", "style", "noscript", "svg", "path", "head", "title"}
ATTRS = ("placeholder", "title", "aria-label", "alt", "label")


class Reader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.skip = 0
        self.markup = []
        self.attrs = []

    def path(self):
        out = []
        for tag, ident, cls in self.stack[-3:]:
            bit = tag
            if ident:
                bit = "#" + ident
            elif cls:
                bit += "." + cls.split()[0]
            out.append(bit)
        return " > ".join(out)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP:
            self.skip += 1
        self.stack.append((tag, a.get("id"), a.get("class", "")))
        for name in ATTRS:
            v = a.get(name)
            if v and not v.startswith(("http", "#", "/")) and re.search(r"[A-Za-z]{3}", v):
                self.attrs.append((self.path(), name, v.strip()))
        if tag in ("input", "img", "br", "hr", "meta", "link"):
            self.stack.pop()
            if tag in SKIP:
                self.skip -= 1

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip:
            self.skip -= 1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.skip:
            return
        text = " ".join(data.split())
        if len(text) > 1 and re.search(r"[A-Za-z]{2}", text):
            self.markup.append((self.path(), text))


def strip_comments(js):
    """Drop // and /* */ comments so an apostrophe in prose ("don't") cannot
    open a phantom string literal."""
    out, i, n = [], 0, len(js)
    while i < n:
        c = js[i]
        if c in "\"'`":                              # skip over a real string
            q, i = c, i + 1
            out.append(q)
            while i < n:
                if js[i] == "\\":
                    out.append(js[i:i + 2]); i += 2; continue
                out.append(js[i])
                if js[i] == q:
                    i += 1; break
                i += 1
            continue
        if c == "/" and i + 1 < n and js[i + 1] == "/":
            while i < n and js[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and js[i + 1] == "*":
            end = js.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        if c == "/":
            # A regex literal may contain a quote (/['\u2019]/g). Skip over it, or
            # that quote opens a phantom string and swallows the code after it.
            prev = "".join(out).rstrip()
            if not prev or prev[-1] in "(,=:[!&|?+{};\n" or prev.endswith("return"):
                j, klass = i + 1, False
                while j < n:
                    if js[j] == "\\":
                        j += 2; continue
                    if js[j] == "[":
                        klass = True
                    elif js[j] == "]":
                        klass = False
                    elif js[j] == "/" and not klass:
                        break
                    elif js[j] == "\n":
                        break
                    j += 1
                if j < n and js[j] == "/":
                    out.append(" "); i = j + 1
                    continue
        out.append(c); i += 1
    return "".join(out)


def js_strings(src):
    found = []
    for raw in re.findall(r"(?is)<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", src):
        block = strip_comments(raw)
        for m in re.finditer(r"""(['"`])((?:\\.|(?!\1)[^\\])*)\1""", block):
            s = m.group(2)
            if len(s) < 4 or not re.search(r"[A-Za-z]\s+[A-Za-z]|[A-Za-z]{4}", s):
                continue
            if re.match(r"^[\w.#\-\[\]=]+$", s):          # selectors, ids, keys
                continue
            if re.search(r"^(https?:|data:|image/|text/|application/)", s):
                continue
            if not re.search(r"[A-Z ]", s):
                continue
            # A JS regex literal can hold a quote (/['\u2019]/g), which derails the
            # naive scan below it. Drop anything that reads as code, not prose.
            if re.search(r"[{};]|=>|\bfunction\b|\breturn\b|\bconst\b|/g[,)]|\bvar\b", s):
                continue
            if s.count("\n") > 1:
                continue
            found.append(s)
    seen, out = set(), []
    for s in found:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if not args:
        print(__doc__)
        return 1
    src = open(args[0], encoding="utf-8", errors="replace").read()
    # Strip scripts and styles BEFORE splitting on <body>: a CSS comment in
    # toolbox.html contains the literal text "<body>", which otherwise wins.
    stripped = re.sub(r"(?is)<script(?![^>]*\bsrc=)[^>]*>.*?</script>|<style.*?</style>|<!--.*?-->", "", src)
    body = re.search(r"(?is)<body[^>]*>(.*)</body>", stripped)
    markup = body.group(1) if body else stripped
    markup = re.sub(r"(?is)<script.*?</script>", "", markup)
    p = Reader()
    p.feed(markup)
    want_all = not (flags & {"--markup", "--js", "--attrs"})
    if want_all or "--markup" in flags:
        print("== MARKUP ==")
        for path, text in p.markup:
            print(f"  [{path}] {text}")
    if want_all or "--attrs" in flags:
        print("== ATTRS ==")
        for path, name, v in p.attrs:
            print(f"  [{path}] {name}={v}")
    if want_all or "--js" in flags:
        print("== JS ==")
        for s in js_strings(src):
            print(f"  {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
