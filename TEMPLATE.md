# Make it your own

A file-by-file guide to turning this fork into your site. You only edit content.
The engine and the skins keep working on their own. Nothing here needs a build
step: edit a file, save, and refresh the page.

If you are new to this, the order below is the order to do it in. You can stop after
step 4 and already have a real, live site.

## 0. Fork and go live

1. Click **Fork** on GitHub to copy the repo into your account.
2. In your fork: **Settings, then Pages.** Set the source to **Deploy from a
   branch,** branch `main`, folder `/ (root)`. Save.
3. Wait a minute. Your site is live at `your-name.github.io/your-repo`.
4. Edit a file on github.com (the pencil icon) or clone the repo and edit locally.
   Either way, every change you push redeploys the site.

Open the live page now and walk around with the arrow keys or WASD, or tap. Knowing
how it feels makes the edits below make sense.

## 1. `content.js` (the words: your main job)

This is the heart of the site. It sets one object, `window.MH_CONTENT`, with a list
of `kiosks`. Each kiosk is one thing a visitor can walk up to. Edit these and you
have edited the site.

A kiosk looks like this:

```js
{
  title: "About",                         // the label on the kiosk
  page: { url: `${B}classic.html` },      // what opens when you walk up
  html: `<p>Plain-text fallback prose.</p>`,
  satellites: [                           // optional: little houses down a road
    { title: "A thing", url: "https://…" },
  ],
}
```

What to change in each kiosk:

- **`title`** is the word shown on the kiosk. Make it yours (Work, Writing, Shop,
  Photos, anything).
- **`page`** is what opens. Use `{ url: "..." }` to open a page or another site. Use
  `{ toc: [ { label, url }, ... ] }` to open a small menu of links instead.
- **`html`** is a plain-prose backup. Keep a sentence or two here.
- **`satellites`** are optional. In the lush and dark skins each one grows into a
  house along that kiosk's road. Drop the list if you do not want them.

`${B}` at the front of a path is just "the site root." Leave it in place on links to
your own pages. Use a full `https://` address for links to other sites.

You can have more or fewer than five kiosks. Add or delete whole `{ ... }` blocks.
`home: 0` means the first kiosk is the one the avatar starts facing. Leave it at `0`
or point it at another kiosk's position in the list.

## 2. `classic.html` and your photo

`classic.html` is the plain bio page, and the "About" kiosk opens it. Replace the
text with your own. Replace `Matt.jpg` with your own portrait (keep the same
filename, or change the filename in `classic.html` to match). Update the page title
near the top.

## 3. Your CV

Replace `Horrigan_CV.html` and `Horrigan_CV.pdf` with your own, or remove the CV
kiosk from `content.js` if you do not want one. If you rename the files, update the
links in `content.js` and in `menubar.js`.

## 4. `menubar.js` (the top bar links)

The top bar is built from a few simple lists near the top of `menubar.js`. Edit only
those lists. Each item is `["Label", "link"]`.

- `GAMES`, `TOOLS`, `MUSIC` become dropdown menus. Add, remove, or rename items.
- `LINKS_BEFORE_DROPDOWNS` is the Home/About/CV row.
- `LINKS_AFTER_DROPDOWNS` holds the Research link.

Everything below those lists is styling. Leave it alone.

## 5. Titles, icons, and the app name

- **Page titles and the description:** edit the `<title>` and the
  `<meta name="description">` in `index.html` and `classic.html`.
- **App name:** edit `name` and `short_name` in `site.webmanifest`.
- **Favicons:** replace the `favicon-*.png`, `apple-touch-icon.png`, and
  `android-chrome-*.png` files with your own if you like. Keep the same filenames.

## 6. Tools and games

`toolbox.html`, `MCQer.html`, `SeatPlanner.html`, `ExamTimer.html`,
`Nameplates.html`, `autofac.html`, and `Rock_Walls_and_Damp.html` are Matt's own
projects. Replace them with yours or delete them, then remove their links from
`content.js` and `menubar.js`.

## 7. Your domain

To use a custom domain, put it in `CNAME` (one line, no `https://`) and point your
domain's DNS at GitHub Pages. To use the free github.io address instead, delete the
`CNAME` file.

## Leave these alone

These are the template. They keep working without you, and editing them is how a
fork breaks. Do not touch them unless you really mean to:

- `engine.js`: the walkable engine.
- `theme-technocute.js`, `theme-technurture.js`, `theme-technoscure.js`: the three
  skins.
- `ecology.js`, `buildings.js`: the living world the skins draw.
- `brand/`: the shared colours and type.
- The boot script at the bottom of `index.html`.

Want a different look? Tweak the colours at the top of one of the `theme-*.js`
files. That is the safe way to restyle without rewriting the engine.

## License: keep the credit, keep the license

This template is shared under **Creative Commons Attribution-ShareAlike 4.0
International (CC BY-SA 4.0).** Two things come with that, and swapping in your own
content does not change them:

1. **Credit Matt Horrigan.** A sample line for your footer or your repo's README:

   > Walkable isometric site engine by Matt Horrigan (https://matthorrigan.com),
   > used under CC BY-SA 4.0. Changes were made.

2. **Share alike.** Your version stays under CC BY-SA 4.0, so the next person can
   fork yours the same way you forked this.

Full terms are in [`LICENSE`](LICENSE).
