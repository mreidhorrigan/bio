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

The core site has no build step, dependencies, or framework: it is plain HTML,
CSS, and vanilla JavaScript with a Canvas. The optional Musebot signal-tower
bundle is generated from the separate `web-musebots` project so that this site
still ships as static files.

The core world and themes do not wait for the comparatively large Musebot bundle.
`signal-towers.js` begins loading asynchronously after the window `load` event,
then announces readiness and restores any towers encoded in the URL. This keeps
the optional music system off the critical page-loading path.

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
| `signal-towers.js` | Generated, self-contained browser bundle for playable Musebot signal towers. Its source of truth is `web-musebots/integrations/bio-signal-towers.js`; do not hand-edit the bundle. |
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

## Musebot signal towers

In build mode, **Raise a signal tower** adds a third building type. Placing or
clicking a tower opens the Musebot selector. The selector includes sounding bots
and message-only coordinating agents such as PlexBOT, with their roles labelled;
incomplete and external-MIDI-only entries remain out of the public menu. Each assigned tower runs an
independent instance of the selected browser Musebot; every tower on the page
shares the same client-side clock and Musebot Protocol room, so several towers
can play together. The first pointer or keyboard interaction unlocks Web Audio.

Tower positions and assignments are stored in the `signals` URL query parameter,
and the slime's current world position is stored in `slime`. Copying the URL
therefore shares both the ensemble configuration and the visitor's location. The query
contains versioned opaque public tokens, not Musebot registry IDs or display
names. Those tokens are permanently assigned in
`web-musebots/public/data/signal-tower-tokens.json`; when a bot is renamed, update
the manifest's ID but retain its token so old links continue to work.

This static integration reuses the canonical Musebot agent implementations,
audio engine, protocol normalization, and client ensemble—the same behavioral
core used by the other wrappers. It does not connect visitors to one another or
to a running Musebot server: sharing a link shares configuration, not a live
network session.

Active towers flash their beacon on every shared ensemble beat. All tower audio
uses one browser `AudioContext` with separate per-bot signal chains, avoiding the
resource pressure and timing instability of one hardware-facing context per bot.
While autoplay is blocked, agents may join and exchange protocol state but do
not schedule musical ticks into the suspended context. The clock is freshly
anchored after the user unlocks audio, preventing stale startup notes from
colliding with the live stream and forcing the limiters to turn the mix down.
Theme changes
remain live, but expensive full-canvas transition snapshots and the website's
separate theme-change sound are skipped while towers are active to protect the
real-time audio stream, particularly on mobile devices.

The website's footsteps and interface cues use the same `AudioContext` as active
towers, retaining those sounds without making two contexts compete for browser
audio hardware. For a
diagnostic snapshot, run `MH_MUSEBOTS.diagnostics()` in the browser console; it
reports context state transitions, Chrome recovery attempts, audio-clock tick
age/count, and each tower limiter's current gain reduction. If Chrome suspends
or interrupts the shared context after user unlock, the integration makes
throttled resume attempts from context transitions and ensemble clocks, with
additional retries on focus, page-show, visibility, pointer, touch, and key
events. Successful recovery resets buffered clocks so stale events do not burst.
`MH_ISO.siteAudioDiagnostics()` reports the website-cue side of the same graph.
While sounding towers are present, cue gain receives modest compensation so quiet
slime footsteps remain perceptible under the ensemble; the music is not ducked.

Each sounding tower also has independent distance attenuation based on the
shortest wrapped distance to the slime in the toroidal world. Encapsulated shared
spatialization logic applies both smooth gain falloff and progressively darker
low-pass filtering. Gain bottoms out at 20%, so a distant agent remains audible.
Message-only towers are unaffected. Current `distanceGain` and
`distanceCutoffHz` values appear in `MH_MUSEBOTS.diagnostics()`.
Filter automation holds its instantaneous value before redirecting overlapping
ramps and glides more slowly than gain, avoiding cutoff jumps or walking-induced
warble while preserving responsive loudness cues.

Input-responsive enhancements never request microphone permission merely because
a bot was loaded. In particular, Decider remains autonomous unless a future
explicit input control opts it into microphone analysis.

After changing the underlying Musebots, regenerate the checked-in website bundle:

```sh
cd "/Users/matthorrigan/Documents/OneDrive - Simon Fraser University (1sfu)/Work/2026_Musebots/web-musebots"
npm run website:towers
```

Run the website-side integration check with `node --test signal-towers.test.mjs`.

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
