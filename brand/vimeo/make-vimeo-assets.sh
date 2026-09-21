#!/bin/sh
# Rebuild the Vimeo-ready rasters from brand/favicon-slime.svg.
#
# Vimeo takes JPEG, PNG and GIF, never SVG, so the vector logo has to be
# rasterised. Every file at the top level is a transparent PNG; flattened
# copies go in opaque-fallback/. Run this from anywhere; it writes into its
# own directory.
#
#   sh brand/vimeo/make-vimeo-assets.sh
#
# Needs librsvg (brew install librsvg) for the SVG, and sips (macOS) for JPEG.
set -e

HERE=$(cd "$(dirname "$0")" && pwd)
SRC="$HERE/../favicon-slime.svg"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The artwork sits inside the favicon's 32x32 grid: the dome spans x 3..29,
# y 8..27, and its 2px ink stroke bleeds 1px, so the real bounds are x 2..30,
# y 7..28 and the centre is (16, 17.5). Every crop below is built from those
# numbers, so nothing is framed by eye.
python3 - "$SRC" "$TMP" <<'PY'
import sys
src = open(sys.argv[1], encoding="utf-8").read()
tmp = sys.argv[2].rstrip("/") + "/"
def square(side):                       # a square viewBox centred on the artwork
    return f'viewBox="{16 - side/2} {17.5 - side/2} {side} {side}"'
for name, vb in [
    ("tight",  'viewBox="2 7 28 21"'),  # no padding: the player logo
    ("square", square(36)),             # a little air: the general transparent logo
    ("avatar", square(40)),             # more air: survives a circular crop
    ("card",   'viewBox="-14.5 -2.5 61 40"'),   # 16:9 for a video thumbnail
]:
    open(tmp + "slime-" + name + ".svg", "w", encoding="utf-8").write(
        src.replace('viewBox="0 0 32 32"', vb))
PY

cd "$HERE"

# Player logo: transparent, cropped tight so the player shows it as large as it can.
rsvg-convert -h 160  -f png -o slime-player-logo-160.png "$TMP/slime-tight.svg"
rsvg-convert -h 320  -f png -o slime-player-logo-320.png "$TMP/slime-tight.svg"

# General-purpose transparent logo.
rsvg-convert -w 1500 -h 1500 -f png -o slime-logo-1500-transparent.png "$TMP/slime-square.svg"

# Profile picture: square, transparent, framed to survive a circular crop.
rsvg-convert -w 1080 -h 1080 -f png -o slime-avatar-1080.png "$TMP/slime-avatar.svg"

# Video thumbnail: 16:9, transparent.
rsvg-convert -w 1280 -h 720 -f png -o slime-thumbnail-1280x720.png "$TMP/slime-card.svg"

# Fallbacks, in case an upload path rejects transparency or wants a JPEG. JPEG
# cannot hold an alpha channel, so these are flattened onto a house colour.
mkdir -p "$HERE/opaque-fallback"
rsvg-convert -w 1080 -h 1080 -f png -b "#f6f4ee" -o opaque-fallback/slime-avatar-1080-parchment.png "$TMP/slime-avatar.svg"
rsvg-convert -w 1080 -h 1080 -f png -b "#1e1528" -o opaque-fallback/slime-avatar-1080-dark.png      "$TMP/slime-avatar.svg"
rsvg-convert -w 1280 -h 720  -f png -b "#f6f4ee" -o opaque-fallback/slime-thumbnail-1280x720.png    "$TMP/slime-card.svg"
for f in opaque-fallback/slime-avatar-1080-parchment opaque-fallback/slime-avatar-1080-dark opaque-fallback/slime-thumbnail-1280x720; do
  sips -s format jpeg -s formatOptions 92 "$f.png" --out "$f.jpg" >/dev/null
done

echo "Wrote (transparent):"
ls -1 "$HERE"/*.png
echo "Wrote (opaque fallbacks):"
ls -1 "$HERE"/opaque-fallback/*
