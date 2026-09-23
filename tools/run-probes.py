#!/usr/bin/env python3
"""Run the probe pages in brand/backstage/probes headlessly and print what they say.

    python3 tools/run-probes.py                      # every __*.html probe
    python3 tools/run-probes.py __slime3d.html       # just one (or several)
    python3 tools/run-probes.py --shot __slime3d-shot.html#dark out.png

A probe iframes a page of the site, measures something the eye cannot, and
writes its findings into a <pre>. This serves the repo on a spare port, loads
each probe in headless Chrome, and prints the <pre> text. A line containing
NO, EXCEPTION, MISSING or FAIL marks a failed check and makes the exit code
non-zero. With --shot it saves a screenshot of the probe instead (a shot probe
freezes the page somewhere interesting), for `open`ing rather than reading.
Probes run one at a time: parallel Chromes contend and time out.
"""
import glob
import http.server
import os
import re
import socket
import subprocess
import sys
import threading
from html.parser import HTMLParser

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBES = os.path.join(ROOT, "brand", "backstage", "probes")
BAD = re.compile(r"\b(NO|EXCEPTION|MISSING|FAIL)\b")


class Pre(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.out = []

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self.depth += 1

    def handle_endtag(self, tag):
        if tag == "pre" and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.out.append(data)


def serve():
    port = None
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


def budget_of(name, default=8000):
    """A probe says how much virtual time it needs with
    <meta name="budget" content="12000">; the default suits most of them. Chrome
    only dumps the page when the budget is spent, so the night skin, which is
    slow to draw on a CPU, wants the smallest budget its waits allow."""
    try:
        with open(os.path.join(PROBES, name), encoding="utf-8") as fh:
            m = re.search(r'<meta\s+name="budget"\s+content="(\d+)"', fh.read())
        return int(m.group(1)) if m else default
    except OSError:
        return default


def chrome(url, extra, budget=8000, timeout=None):
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
           "--window-size=1280,900", "--virtual-time-budget=%d" % budget] + extra + [url]
    if timeout is None:
        timeout = 300                                # the night skin can take minutes on a CPU
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def main():
    args = sys.argv[1:]
    srv, port = serve()
    base = "http://127.0.0.1:%d/brand/backstage/probes/" % port
    try:
        if args and args[0] == "--shot":
            probe, out = args[1], args[2]
            # the shot probes hold a 1280 by 820 frame, so shoot exactly that
            chrome(base + probe, ["--screenshot=" + os.path.abspath(out), "--window-size=1280,820"], budget_of(probe.split("#")[0]))
            print("wrote", out)
            return 0
        names = args or sorted(os.path.basename(p) for p in glob.glob(os.path.join(PROBES, "__*.html"))
                               if "shot" not in p and "perf" not in p)   # shots are pictures; perf needs a real browser
        failed = []
        for name in names:
            print("=== " + name)
            try:
                res = chrome(base + name, ["--dump-dom"], budget_of(name))
            except subprocess.TimeoutExpired:
                print("TIMEOUT")
                failed.append(name)
                continue
            parser = Pre()
            parser.feed(res.stdout)
            text = "".join(parser.out).strip()
            print(text or "(no <pre> output)")
            # a probe that only ever said "running" never ran its checks (its script
            # failed to parse, or never reached them): that is a failure, not a pass
            if not text or text.strip() == "running" or BAD.search(text):
                failed.append(name)
        print("\n%d probe%s failed%s" % (len(failed), "" if len(failed) == 1 else "s", (": " + ", ".join(failed)) if failed else ""))
        return 1 if failed else 0
    finally:
        srv.shutdown()


if __name__ == "__main__":
    sys.exit(main())
