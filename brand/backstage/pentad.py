#!/usr/bin/env python3
"""
pentad.py — the matthorrigan.com house palette as ONE adjustable knob.

The house colour is a PENTAD: five hues spaced 72° apart on the wheel, anchored
on the house cyan (hue 195°). Three members are long-established and hand-tuned
(cyan, violet, orange); two (rose, green) are *derived* here to complete the ring.
Every member is rendered into the same small set of tonal slots so they are used
the same way across the site.

    arm  +0°   195°  cyan    highlight / interaction         (held #c3f0ff)
    arm +72°   267°  violet  links, buttons, labels          (held #5b2a86)
    arm +144°  339°  rose    NEW — a pink we can use          (derived)
    arm +216°   51°  orange  landing flare / warm callout     (held #f28b46, warm of arm)
    arm +288°  123°  green   NEW — positive / nature accent   (derived)

THE PRIMARY RELATIONSHIP IS CYAN ↔ ORANGE. They are the two most important brand
colours and sit NEAR-COMPLEMENTARY (cyan 195°, and the orange is hand-held at
~24° — cyan's true complement is 15° — rather than on its 51° geometric arm,
precisely so the cool/warm pairing resonates). That cool↔warm axis is the soul of
the brand: the orange→cyan "cloud" backdrop, and the up-and-rightward motion of
the leaf corners and gradient ribbons. Violet is the document accent; rose and
green are SPARSE semantic accents. Never let violet + orange stand alone as the
only two colours of a mark (that pair reads as FedEx) — lead with cyan + orange.

ADJUST THE PALETTE HERE — three knobs, nothing else:
  * ANCHOR_HUE   rotate the WHOLE ring (every derived member moves with it).
  * MEMBERS      per arm: a `hold` dict pins hand-tuned hexes; `None` ⇒ derive it.
  * TONE         the L/S targets for the deep / strong / mid / tint / wash slots.
  * SUPPORT      the "world" around the pentad: browns, neutrals, rare bridges —
                 derivatives of the arms, NOT new brand hues (see house-style.md).

Run it:
  python3 pentad.py            # human table: hex + WCAG contrast on white
  python3 pentad.py --css      # a :root{…} block of --<member>-<slot> custom props
  python3 pentad.py --json     # the same values as JSON

It writes nothing — pipe --css / --json where you need them. brand/brand.css and
brand/tokens.json carry the emitted numbers; this file is the source of those
numbers (change a knob here, re-emit, paste). Held members are echoed verbatim so
the whole pentad prints in one place. Pure stdlib; no dependencies.
"""
from __future__ import annotations

import colorsys
import json
import sys

# --- knob 1: where the ring is anchored ------------------------------------
ANCHOR_HUE = 195          # the house cyan's hue; the ring is ANCHOR_HUE + 72·k
ARM = 72                  # 360 / 5 — a pentad's even step

# --- knob 2: the five members, in ring order -------------------------------
# `hold`: a dict of slot→hex to pin a hand-tuned member (its hue may sit a few
# degrees off the geometric arm — that's deliberate, the tuned value wins; the
# orange in particular is held at ~24° to sit near cyan's complement).
# `None`: derive the member's slots from its arm hue via TONE (knob 3).
# `css`: the established CSS custom-property name per slot, so the emitted --css
# matches the names brand.css already uses (the three tools expect --accent /
# --flare-* for the violet / orange members). New members use the default
# --<name> / --<name>-<slot> scheme. This keeps `--css` directly pasteable.
MEMBERS: list[dict] = [
    {"name": "cyan",   "role": "highlight / interaction",
     "hold": {"tint": "#c3f0ff"},
     "css": {"tint": "--brand-cyan"}},                   # the one pale highlight
    {"name": "violet", "role": "links, buttons, labels",
     "hold": {"base": "#5b2a86", "strong": "#46206a", "wash": "#f1ebf8"},
     "css": {"base": "--accent", "strong": "--accent-strong", "wash": "--accent-wash"}},
    {"name": "rose",   "role": "pink accent / warm highlight", "hold": None},
    {"name": "orange", "role": "landing flare / warm callout (cyan's co-lead)",
     "hold": {"base": "#f28b46", "strong": "#9a4310", "wash": "#fdefe2"},
     "css": {"base": "--flare-warm", "strong": "--flare-strong", "wash": "--flare-wash"}},
    {"name": "green",  "role": "positive / nature accent", "hold": None},
]

# --- knob 3: the tonal recipe for a DERIVED member -------------------------
# Each slot is (lightness, saturation). `base`/`strong` carry a minimum WCAG
# contrast on white so they're safe as text/links; tint/wash mirror the cyan and
# violet-wash tonalities so a new member drops into the existing patterns.
TONE = {
    "base":   {"L": 0.345, "S": 0.52, "min_contrast": 5.0},   # deep, AA text/link
    "strong": {"L": 0.285, "S": 0.52, "min_contrast": 6.5},   # darker hover/active
    "mid":    {"L": 0.55,  "S": 0.55, "min_contrast": None},  # bright fill / ribbon
    "tint":   {"L": 0.88,  "S": 1.00, "min_contrast": None},  # pale highlight (cyan-like)
    "wash":   {"L": 0.947, "S": 0.48, "min_contrast": None},  # surface / callout bg
}

# --- knob 4: supporting colours — the "world" around the pentad ------------
# Derivatives of the arms (a hue near a member, rendered at an L/S), NOT new brand
# hues. Browns are the orange arm darkened+muted; neutrals are grey pulled toward
# an arm (violet=cool, orange=warm). Use browns/neutrals freely for structure;
# keep teal/gold (the analogous bridges) RARE. Each row: name, hue, L, S, role.
SUPPORT = [
    ("brown",        24,  0.27,  0.28, "house brown (walnut): warm rules, wood/sepia accents, brown text"),
    ("brown-deep",   24,  0.22,  0.30, "espresso: deepest warm near-black text"),
    ("taupe",        24,  0.42,  0.16, "warm neutral: muted text/metadata in warm contexts"),
    ("slate",       267,  0.45,  0.06, "cool neutral: secondary text/icons in the cool chrome"),
    ("teal",        183,  0.345, 0.52, "RARE cool bridge (near cyan): a secondary cool accent (AA text)"),
    ("gold",         45,  0.45,  0.62, "RARE warm bridge (near orange): decorative metallic (not text)"),
    ("violet-black",267,  0.12,  0.30, "near-black tinted to the identity violet: headline ink"),
    ("parchment",    40,  0.95,  0.30, "warm surface: an orange-keyed callout card"),
    ("cream",        45,  0.965, 0.35, "lightest warm page tint"),
]


# --------------------------------------------------------------------------- #
# colour maths (sRGB / HSL / WCAG) — stdlib only
# --------------------------------------------------------------------------- #
def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _hls_to_hex(hue: float, light: float, sat: float) -> str:
    r, g, b = colorsys.hls_to_rgb((hue % 360) / 360, light, sat)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _luminance(h: str) -> float:
    def lin(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = _hex_to_rgb(h)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast_on_white(h: str) -> float:
    """WCAG contrast ratio of `h` against #ffffff (1 … 21)."""
    return (1.0 + 0.05) / (_luminance(h) + 0.05)


def _derive_slot(hue: float, spec: dict) -> str:
    """Render one tonal slot at `hue`, darkening past its L target if needed to
    clear `min_contrast` (so a light-hued member's text slot still passes AA)."""
    light, sat = spec["L"], spec["S"]
    need = spec["min_contrast"]
    hexv = _hls_to_hex(hue, light, sat)
    while need and light > 0.10 and contrast_on_white(hexv) < need:
        light -= 0.004
        hexv = _hls_to_hex(hue, light, sat)
    return hexv


def build() -> list[dict]:
    """Resolve the whole pentad: every member with its arm hue and slot hexes
    (held members echo their pinned hexes; derived members are generated)."""
    out = []
    for k, m in enumerate(MEMBERS):
        hue = (ANCHOR_HUE + ARM * k) % 360
        if m["hold"]:
            slots = dict(m["hold"])
        else:
            slots = {name: _derive_slot(hue, spec) for name, spec in TONE.items()}
        out.append({"name": m["name"], "role": m["role"], "arm": k,
                    "hue": hue, "held": bool(m["hold"]), "slots": slots,
                    "css": m.get("css", {})})
    return out


def support() -> list[dict]:
    """Resolve the supporting colours (browns / neutrals / bridges)."""
    return [{"name": n, "hue": h, "hex": _hls_to_hex(h, L, S), "role": role}
            for (n, h, L, S, role) in SUPPORT]


# --------------------------------------------------------------------------- #
# emitters
# --------------------------------------------------------------------------- #
def emit_table(pentad: list[dict], supp: list[dict]) -> str:
    lines = [f"matthorrigan.com pentad — anchor {ANCHOR_HUE}°, step {ARM}°",
             "primary relationship: CYAN ↔ ORANGE (near-complementary cool/warm)\n"]
    for m in pentad:
        tag = "held " if m["held"] else "deriv"
        lines.append(f"{m['name']:7s} arm{m['arm']}  hue {m['hue']:5.0f}  [{tag}]  "
                     f"{m['role']}")
        for slot, hexv in m["slots"].items():
            c = contrast_on_white(hexv)
            note = "  AA-text" if (slot in ("base", "strong") and c >= 4.5) else ""
            lines.append(f"    {slot:7s} {hexv}   c/white {c:5.2f}{note}")
        lines.append("")
    lines.append("supporting colours (derivatives of the arms, NOT new brand hues):")
    for s in supp:
        c = contrast_on_white(s["hex"])
        lines.append(f"    {s['name']:13s} {s['hex']}   c/white {c:5.2f}   {s['role']}")
    return "\n".join(lines)


def emit_css(pentad: list[dict], supp: list[dict]) -> str:
    lines = [":root {"]
    for m in pentad:
        for slot, hexv in m["slots"].items():
            var = m["css"].get(slot) or (f"--{m['name']}" if slot == "base"
                                         else f"--{m['name']}-{slot}")
            lines.append(f"  {var:18s} {hexv};")
    lines.append("  /* supporting colours (derivatives, not brand hues) */")
    for s in supp:
        lines.append(f"  {('--' + s['name']):18s} {s['hex']};")
    lines.append("}")
    return "\n".join(lines)


def emit_json(pentad: list[dict], supp: list[dict]) -> str:
    data = {
        "anchorHue": ANCHOR_HUE, "step": ARM,
        "primaryRelationship": "cyan<->orange (near-complementary cool/warm)",
        "members": [
            {"name": m["name"], "arm": m["arm"], "hue": m["hue"],
             "held": m["held"], "role": m["role"],
             "slots": {s: {"hex": h, "contrastOnWhite": round(contrast_on_white(h), 2)}
                       for s, h in m["slots"].items()}}
            for m in pentad
        ],
        "support": [
            {"name": s["name"], "hue": s["hue"], "hex": s["hex"], "role": s["role"],
             "contrastOnWhite": round(contrast_on_white(s["hex"]), 2)}
            for s in supp
        ],
    }
    return json.dumps(data, indent=2)


def main() -> None:
    pentad, supp = build(), support()
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--css":
        print(emit_css(pentad, supp))
    elif arg == "--json":
        print(emit_json(pentad, supp))
    else:
        print(emit_table(pentad, supp))


if __name__ == "__main__":
    main()
