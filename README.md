# A walkable isometric homepage

This is the source for [matthorrigan.com](https://matthorrigan.com): a personal
website you walk around. Instead of a menu, you steer a little avatar across an
isometric world and walk up to kiosks. Each kiosk opens a page of the site (About,
Toolbox, CV, Music, Games). One world renders in three "skins," and the landing
skin follows your local time of day.

It is built to be **forked as a template.** Keep the design and the engine, swap in
your own words, and you have your own walkable site. This README explains the one
split that makes that work: the **content** (your words, swap these) versus the
**engine and design system** (the walkable machine, keep these).

No build step, no dependencies, no framework. Plain HTML, CSS, and vanilla
JavaScript with a Canvas. Edit a file, save, refresh.

## The one idea: content vs. engine

The words and the machine are kept apart on purpose. The content knows nothing
about how it looks. The engine knows nothing about what it says. That is what lets
a friend fork this, replace the content, and keep a working walkable site.

### Content (replace this with your own)

| File | What it holds |
|---|---|
| `content.js` | The kiosks: the site's words. Five entries (About, Toolbox, CV, Music, Games), each with a title, prose, links, and the "satellites" that grow into houses along a road in the slime skins. This is the main file you edit. |
| `classic.html` | The plain bio page and portrait. The "About" kiosk opens this. |
| `Horrigan_CV.html`, `Horrigan_CV.pdf` | The CV, in browser and PDF form. |
| `menubar.js` (the link arrays only) | The site-wide top bar's links: `GAMES`, `TOOLS`, `MUSIC`, the Home/About/CV row, and `Research`. Edit the arrays near the top. Leave the styling below them. |
| `Matt.jpg` | The portrait used by `classic.html`. |
| `index.html`, `classic.html`, `site.webmanifest` | Page titles, the meta description, and the app name. |
| The tool and game pages | `toolbox.html`, `MCQer.html`, `SeatPlanner.html`, `ExamTimer.html`, `Nameplates.html`, `autofac.html`, `Rock_Walls_and_Damp.html`, and the favicons. These are Matt's projects. Replace or remove them. |
| `CNAME` | Your custom domain (or delete it to use the github.io address). |

### Engine and design system (keep this: it is the template)

| File | What it does |
|---|---|
| `engine.js` | The walkable isometric engine. Vanilla JS and Canvas, zero dependencies. It builds one looping world, places the kiosks in a ring, moves the avatar, and opens each kiosk's page. It is presentation-agnostic: a theme supplies the look, `content.js` supplies the words. |
| `theme-technocute.js` | The "bureaucore" skin: clean, flat, minimal, the default calm look. |
| `theme-technurture.js` | The lush daylight slimeworld skin: a sunlit, overgrown world that changes with its biomes. |
| `theme-technoscure.js` | The dark "gloomthmaxx" skin: the same world after nightfall. |
| `ecology.js` | An optional artificial-life layer: flora that spreads, grazers, predators, and drifting motes. The slime skins lean on it. The calm skin does not. |
| `buildings.js` | Procedural slime-world dwellings the skins draw. |
| `index.html` (the boot script) | Wires the engine, content, ecology, and themes together and picks the starting skin. |
| `brand/` | The house design tokens (colours, type, the "leaf" corner) shared across the whole site. |

### How they connect

`content.js` sets one object, `window.MH_CONTENT`, that lists the kiosks. The engine
reads that object and lays the same kiosks out across every skin. Swap the words and
the world is unchanged. Switch skins and the words are unchanged. The engine and the
content meet at exactly one line: `MH_ISO.start(skin)`.

Paths inside `content.js` are base-aware through `window.MH_SITE` (set in
`index.html`), so the same content file works from the site root or from a dev
folder without edits.

## Quick start: fork and make it yours

1. **Fork** this repo on GitHub.
2. **Turn on GitHub Pages:** Settings, then Pages, then deploy from the `main`
   branch at the root. Your site goes live at `your-name.github.io/your-repo`.
3. **Edit `content.js`:** change each kiosk's title, prose, links, and satellites
   to your own. This is most of the work.
4. **Replace the content files:** swap `classic.html`, the CV files, and `Matt.jpg`
   for yours. Update the page titles and description in `index.html` and
   `classic.html`, and the name in `site.webmanifest`.
5. **Edit the menubar links:** open `menubar.js` and change the arrays near the top
   (`GAMES`, `TOOLS`, `MUSIC`, the Home/About/CV row, `Research`).
6. **Set your domain:** put your domain in `CNAME`, or delete `CNAME` to use the
   github.io address.
7. **Leave the engine alone:** do not touch `engine.js`, the `theme-*.js` files,
   `ecology.js`, `buildings.js`, or `brand/`. The site keeps working. If you want a
   different look, tweak a skin rather than rewriting it.

A longer, file-by-file walkthrough lives in [`TEMPLATE.md`](TEMPLATE.md).

## License and attribution

The whole work is licensed under **Creative Commons Attribution-ShareAlike 4.0
International (CC BY-SA 4.0).** By the author's choice, one license covers the
engine, the themes, and the example content alike. See [`LICENSE`](LICENSE) for the
full legal code.

That license asks two things of anyone who reuses this:

- **Credit** Matt Horrigan. A sample line:

  > Walkable isometric site engine by Matt Horrigan (https://matthorrigan.com),
  > used under CC BY-SA 4.0. Changes were made.

- **Share alike.** Your version, and anything you build from it, stays under
  CC BY-SA 4.0 so the next person has the same freedom you did.

Replacing the content with your own words is exactly what this template is for, and
it does not change either requirement: keep the credit and keep the license.

## Credits

Design, engine, and themes by Matt Horrigan ([matthorrigan.com](https://matthorrigan.com)).
