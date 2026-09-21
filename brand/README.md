# brand

The house design system. One thing here is served to visitors, and everything
else is workshop.

| | |
|---|---|
| `brand.css` | **Loaded by the site.** The shared tokens (colours, type, the "leaf" corner). Eight pages link it: `about`, `toolbox`, the CV, and the four tools. |
| `backstage/` | Everything the site does not load: the design sheets, the style guide, the logo source and its exports, and the tooling. |

Nothing in `backstage/` is fetched by a page, so it can be reorganised freely.
It still ships with the repository, which is deliberate: this site is a
CC BY-SA template, and the sheets are how someone reading it learns what the
world is made of.
