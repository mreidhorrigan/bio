# Extracted slime views

These pages isolate the website's two existing animated one-eyed slimes without redesigning them.

- `isometric.html` is the Canvas 2D world avatar. Its painter, technurture green palette, idle pulse, directional eye, shadow, and walking peristalsis come from `engine.js` and `theme-technurture.js`. The page's pointer/keyboard handling is only a demonstration harness.
- `widget.html` is the fixed inline-SVG companion from `slime-widget.js`, including its violet artwork, three-second squash, responsive size, reduced-motion rule, and smoothed mouse/touch gaze.
- `index.html` links the two live views.

Open `index.html`, `isometric.html`, or `widget.html` directly in a browser. They use only local relative files and do not require a server, build step, package installation, or network connection.

The extraction is deliberately self-contained for reuse. The canonical site sources remain `engine.js` and `slime-widget.js`; if those are changed later, port the same change here to prevent drift.
