#!/bin/sh
# to-gif.sh — make a GIF, either from a screen recording or straight from a
# panel on one of the proposal sheets.
#
#   sh brand/backstage/to-gif.sh movie brand/backstage/Untitled.mov [out.gif] [fps] [width]
#   sh brand/backstage/to-gif.sh panel brand/backstage/slimes/shoggoth-proposals.html "Congeries" [out.gif]
#   sh brand/backstage/to-gif.sh panels brand/backstage/slimes/prey-proposals.html          # list what is on a sheet
#
# MOVIE takes anything ffmpeg reads (.mov, .mp4, .webm) and runs the two-pass
# palette route, which is the difference between a GIF that looks like the
# recording and one that looks like 1998. Trim with START and DURATION.
#
# PANEL skips recording altogether. Every sheet exposes redraw(t), so the page
# can be stepped frame by frame at an exact rate and each frame read straight
# off the canvas: no screen, no cursor, no dropped frames, and a loop that
# closes properly because the clock is ours.
#
# Output lands in brand/backstage/gif/ unless a path is given. Needs ffmpeg (brew install
# ffmpeg); panel mode also needs Google Chrome.
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
OUTDIR="$HERE/gif"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
[ $# -ge 1 ] || usage
MODE=$1; shift

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg is required: brew install ffmpeg" >&2; exit 1; }
mkdir -p "$OUTDIR"

case "$MODE" in
  movie)
    [ $# -ge 1 ] || usage
    SRC=$1
    OUT=${2:-"$OUTDIR/$(basename "${SRC%.*}").gif"}
    FPS=${3:-18}
    WIDTH=${4:-540}
    START=${START:-0}
    DURATION=${DURATION:-}
    TRIM="-ss $START"
    [ -n "$DURATION" ] && TRIM="$TRIM -t $DURATION"
    PAL=$(mktemp -t togif).png
    # shellcheck disable=SC2086
    ffmpeg -v error -y $TRIM -i "$SRC" \
      -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" "$PAL"
    # shellcheck disable=SC2086
    ffmpeg -v error -y $TRIM -i "$SRC" -i "$PAL" \
      -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
      -loop 0 "$OUT"
    rm -f "$PAL"
    echo "$OUT  ($(du -h "$OUT" | cut -f1), ${FPS}fps, ${WIDTH}px wide)"
    ;;

  panel|panels)
    [ $# -ge 1 ] || usage
    SHEET=$1; shift
    case "$SHEET" in /*) ;; *) SHEET="$REPO/$SHEET" ;; esac
    [ -f "$SHEET" ] || { echo "no such sheet: $SHEET" >&2; exit 1; }
    [ -x "$CHROME" ] || { echo "Google Chrome is required for panel mode" >&2; exit 1; }
    if [ "$MODE" = "panels" ]; then
      python3 "$HERE/capture-panel.py" --sheet "$SHEET" --list
      exit 0
    fi
    [ $# -ge 1 ] || usage
    WANT=$1
    OUT=${2:-"$OUTDIR/$(basename "${SHEET%.*}")-$(echo "$WANT" | tr ' A-Z' '-a-z' | tr -cd 'a-z0-9-').gif"}
    FPS=${FPS:-16}
    SECONDS_LONG=${SECONDS_LONG:-2.5}
    SCALE=${SCALE:-2}
    FRAMES=$(mktemp -d -t togifframes)
    python3 "$HERE/capture-panel.py" --sheet "$SHEET" --panel "$WANT" \
      --fps "$FPS" --seconds "$SECONDS_LONG" --scale "$SCALE" --frames "$FRAMES"
    PAL="$FRAMES/palette.png"
    ffmpeg -v error -y -framerate "$FPS" -i "$FRAMES/f%04d.png" \
      -vf "palettegen=stats_mode=diff" "$PAL"
    ffmpeg -v error -y -framerate "$FPS" -i "$FRAMES/f%04d.png" -i "$PAL" \
      -lavfi "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" -loop 0 "$OUT"
    N=$(ls "$FRAMES"/f*.png | wc -l | tr -d ' ')
    rm -rf "$FRAMES"
    echo "$OUT  ($(du -h "$OUT" | cut -f1), $N frames at ${FPS}fps)"
    ;;

  *) usage ;;
esac
