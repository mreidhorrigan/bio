# The slime logo, for Vimeo

Vimeo takes JPEG, PNG and GIF. It does not take SVG, so `../favicon-slime.svg`
has to be rasterised. These files are that conversion. Nothing is redrawn: each
one is the same vector logo, framed for a different slot.

| File | Use it for |
|---|---|
| `slime-player-logo-320.png` | The custom logo in the video player (a paid-plan feature). Transparent, cropped tight so the player can show it as large as it allows. |
| `slime-player-logo-160.png` | The same, half size, if the larger one is refused. |
| `slime-avatar-1080.png` | Profile picture. |
| `slime-thumbnail-1280x720.png` | Custom video thumbnail, the usual 16:9. |
| `slime-logo-1500-transparent.png` | Anything else: a showcase header, a team badge, a slide. Transparent, square, large enough to scale down cleanly. |

Every file here is a transparent PNG. `opaque-fallback/` holds the same avatar and
thumbnail flattened onto the house parchment or violet-black, as PNG and as JPEG,
for an upload path that rejects transparency or insists on a JPEG. JPEG cannot
hold an alpha channel, which is why those are flattened rather than converted.

Each profile picture keeps the slime well inside the circle Vimeo crops to in
some places, so nothing clips. The player logos are deliberately edge-to-edge:
the player pads them itself, and padding baked into the file only makes the logo
look smaller.

Upload forms sometimes cap file size or pixel dimensions, and Vimeo changes those
limits from time to time. Everything here is small (under 150 KB), but if a form
refuses a file, the fix is a smaller pixel size rather than a different format.

## Rebuilding

    sh brand/backstage/vimeo/make-vimeo-assets.sh

Needs `librsvg` (`brew install librsvg`) and macOS's `sips`. The script derives
every crop from the artwork's bounds inside the favicon grid rather than framing
by eye, so edit the logo and re-run, and the whole set stays in register.
