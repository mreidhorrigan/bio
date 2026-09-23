#!/usr/bin/env python3
"""Load every page in headless Chrome and report what its console said.

    python3 tools/console-sweep.py                     # every page in PAGES
    python3 tools/console-sweep.py about.html?lang=fr  # just one
    python3 tools/console-sweep.py --keep-log          # and keep the server log

It serves the repo on port 8781 with `python3 -m http.server`, keeping the
server's own log so that 404s can be read back afterwards, then loads each page
in headless Chrome with the console copied to stderr: once at desktop width,
and the pages in PHONE_PAGES again at phone width. Everything the console said
is reported (errors, uncaught exceptions, failed loads, deprecation warnings,
plain logs), apart from the "AudioContext was not allowed to start" that
autoplay policy prints on every page that makes sound without a gesture.

Pages load one at a time: parallel Chromes contend and time out. A page that
has not finished after TIMEOUT seconds is killed and reported as such, with
whatever it said before the kill.

The report is one line per page, OK or the messages, then the 404s from the
server log with the page that was loading when each one happened.
"""
import collections
import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8781
BASE = "http://127.0.0.1:%d/" % PORT
TIMEOUT = 60                     # seconds of wall time per page before Chrome is killed
DESKTOP, PHONE = "1100,760", "400,800"
PAGES = ["index.html", "index.html?theme=technocute", "index.html?theme=technurture",
         "index.html?theme=technoscure", "index.html?theme=technoscure&lang=fr",
         "about.html", "about.html?lang=fr", "about.html?menu=Music",
         "glossary.html", "glossary.html?lang=fr", "slime3d.html", "slimeverse3d.html", "slimeverse3d.html?lang=fr", "criticism.html",
         "research.html", "toolbox.html", "Horrigan_CV.html", "MCQer.html",
         "SeatPlanner.html", "ExamTimer.html", "Nameplates.html", "autofac.html",
         "Rock_Walls_and_Damp.html", "pitch-shift.html", "test-viewport.html",
         "brand/backstage/slimes/verse3d.html", "brand/backstage/slimes/verse3d.html?skin=technoscure",
         "brand/backstage/slimes/verse3d.html?skin=technocute"]
PHONE_PAGES = ["index.html", "glossary.html", "slime3d.html", "slimeverse3d.html"]
# The night skin (and the bare homepage, which picks it after dark) renders far
# too slowly on a CPU for a virtual-time run to finish: these are cut short, and a
# cut with nothing logged counts as clean. Load errors show in the first second.
SLOW = ("index.html", "index.html?theme=technoscure", "index.html?theme=technoscure&lang=fr")
SLOW_TIMEOUT = 25
# Known and harmless: autoplay policy, and Chrome announcing its debug socket.
BENIGN = ("The AudioContext was not allowed to start", "DevTools listening")
# [pid:tid:date:LEVEL:CONSOLE:line] "message", source: url (line)
# Older Chromes wrote CONSOLE(line) instead of CONSOLE:line. A message can span lines.
CONSOLE = re.compile(r':(\w+):CONSOLE[:(]\d+\)?\] "(.*?)", source: (\S*) \((\d+)\)', re.S)
# 127.0.0.1 - - [date] "GET /path HTTP/1.1" 404 -
REQUEST = re.compile(r'"(?:GET|HEAD|POST) (\S+) HTTP/[^"]*" (\d{3})')


def port_open():
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def serve(log):
    """Start http.server on PORT with its log going to the open file `log`."""
    proc = subprocess.Popen(
        [sys.executable, "-u", "-m", "http.server", str(PORT),
         "--bind", "127.0.0.1", "--directory", ROOT],
        stdout=log, stderr=subprocess.STDOUT)
    for _ in range(50):
        if port_open():
            return proc
        if proc.poll() is not None:
            break
        time.sleep(0.1)
    stop(proc)
    raise SystemExit("http.server did not come up on port %d" % PORT)


def stop(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def load(url, size, timeout=TIMEOUT):
    """Chrome's stderr for one page, and whether Chrome had to be killed."""
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--enable-logging=stderr", "--v=0",
         "--virtual-time-budget=6000", "--window-size=" + size, "--dump-dom", url],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, start_new_session=True)
    killed = False
    try:
        _, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        killed = True
    finally:
        if proc.poll() is None:          # timed out, or Ctrl-C: take the whole tree down
            os.killpg(proc.pid, signal.SIGKILL)
            _, err = proc.communicate()  # keeps what was read before the timeout
    return err.decode("utf-8", "replace"), killed


def messages(err):
    """Console lines worth reading, deduplicated, in first-seen order."""
    seen = collections.Counter()
    for level, text, source, line in CONSOLE.findall(err):
        if any(b in text for b in BENIGN):
            continue
        text = " ".join(text.split())
        if len(text) > 300:
            text = text[:300] + "…"
        where = (source.replace(BASE, "") or "?") + ":" + line
        seen["%s %s  <%s>" % (level, text, where)] += 1
    return [m + (" ×%d" % n if n > 1 else "") for m, n in seen.items()]


def new_lines(path, seen):
    """The server log lines written since the last look."""
    with open(path, encoding="utf-8", errors="replace") as fh:
        lines = fh.read().splitlines()
    return lines[seen:], len(lines)


def main():
    flags = [a for a in sys.argv[1:] if a.startswith("-")]
    pages = [a for a in sys.argv[1:] if not a.startswith("-")] or PAGES
    if not os.path.exists(CHROME):
        print("Chrome not found at " + CHROME)
        return 2
    if port_open():
        print("something is already listening on port %d; stop it first" % PORT)
        return 2
    runs = [(p, DESKTOP) for p in pages] + [(p, PHONE) for p in pages if p in PHONE_PAGES]
    labels = [p if size == DESKTOP else p + " @" + size.replace(",", "x") for p, size in runs]
    width = max(len(label) for label in labels)

    log = tempfile.NamedTemporaryFile("w", prefix="console-sweep-", suffix=".log", delete=False)
    server = serve(log)
    bad, timed_out, seen = 0, [], 0
    notfound = {}        # path -> [labels that were loading]
    other = {}           # "status path" -> [labels], for anything else that failed
    try:
        for (page, size), label in zip(runs, labels):
            if not os.path.exists(os.path.join(ROOT, page.split("?")[0])):
                print("%-*s  no such file" % (width, label), flush=True)
                bad += 1
                continue
            slow = page in SLOW
            err, killed = load(BASE + page, size, SLOW_TIMEOUT if slow else TIMEOUT)
            time.sleep(0.2)                  # let the server log its last request
            lines, seen = new_lines(log.name, seen)
            for line in lines:
                m = REQUEST.search(line)
                if m and int(m.group(2)) >= 400:
                    if m.group(2) == "404":
                        notfound.setdefault(m.group(1), []).append(label)
                    else:
                        other.setdefault(m.group(2) + " " + m.group(1), []).append(label)
            msgs = messages(err)
            if killed and slow and not msgs:
                head = "OK (cut at %d s: the night skin renders slowly on a CPU)" % SLOW_TIMEOUT
            elif killed:
                timed_out.append(label)
                head = "TIMEOUT: killed after %d s" % (SLOW_TIMEOUT if slow else TIMEOUT)
                if msgs:
                    head += ", %d message(s) before that" % len(msgs)
            elif not any('"GET /%s HTTP' % page in line for line in lines):
                head = "NOT LOADED: the server saw no request for it"
            else:
                head = "OK" if not msgs else "%d message(s)" % len(msgs)
            if not head.startswith("OK"):
                bad += 1
            print("%-*s  %s" % (width, label, head), flush=True)
            for m in msgs:
                print("    " + m, flush=True)
    finally:
        stop(server)
        log.close()
        if "--keep-log" not in flags:
            os.remove(log.name)
        if port_open():
            print("warning: something is still listening on port %d" % PORT)

    print()
    if notfound:
        print("404s from the server log:")
        for path, who in notfound.items():
            print("    %-40s <- %s" % (path, ", ".join(dict.fromkeys(who))))
        bad += 1
    else:
        print("404s from the server log: none")
    if other:
        print("other failed responses:")
        for key, who in other.items():
            print("    %-40s <- %s" % (key, ", ".join(dict.fromkeys(who))))
        bad += 1
    if timed_out:
        print("timed out: " + ", ".join(timed_out))
    if "--keep-log" in flags:
        print("server log kept at " + log.name)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
