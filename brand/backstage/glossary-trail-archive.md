# The glossary's trail (archived 2026-09-24)

Taken off the page at M.'s word, with the "Back to the world" footer and the
violet outline round the picture. The slime says what they did instead, in its
first-person bubbles (glossary-world.js, the tips): where it can jump (Home,
End, Page Down), and how to go back to the village (a light).

The trail was the circuit laid flat along the foot of the window: a 9 px strip,
light where the cave is lit and dark in the penumbra, with a green dot where the
slime was. A click on it sent the slime to that point of the circuit.

To restore it, put the four pieces back where they were.

## glossary.html, in the hero, after the dock

```html
      <!-- The circuit laid flat along the foot of the window. Its ends are the
           same place, so the light fades at both, the way it does in the world. -->
      <div class="trail" id="trail" aria-hidden="true" hidden><i class="dot"></i></div>
```

## glossary.html, the style, after `.dock > *`

```css
    .trail{ position:absolute; left:0; right:0; bottom:0; height:9px; cursor:pointer;
      background:var(--rule); box-shadow:0 -1px 3px rgba(0,0,0,.14); }
    .trail .dot{ position:absolute; top:-5px; width:8px; height:19px; margin-left:-4px; border-radius:4px;
      background:#4FA373; border:1.5px solid #1f3a1a; }
```

## glossary-world.js

At the top, beside `card`:

```js
  const bar = document.getElementById("trail");
```

In the world's options, `onStep` and `onSize`:

```js
    onStep: () => {
      read(); climb();
      if (bar) bar.querySelector(".dot").style.left = (S.me.x / worldW * 100) + "%";
    },
    onSize: () => {
      // ...
      if (bar) {
        // The light changes over the mouths, not at a line, so the bar does too.
        const pc = (x) => (wrap(x) / worldW * 100).toFixed(2) + "%";
        const DAYC = "#bcdcc7", DARKC = "#242a20";
        bar.style.background = "linear-gradient(90deg,"
          + DAYC + " 0%," + DAYC + " " + pc(entryX - MOUTH / 2) + ","
          + DARKC + " " + pc(entryX + MOUTH / 2) + "," + DARKC + " " + pc(exitX - MOUTH / 2) + ","
          + DAYC + " " + pc(exitX + MOUTH / 2) + "," + DAYC + " 100%)";
        bar.hidden = false;
      }
    },
```

After the cite button's code, the click that sent the slime along:

```js
  if (bar) bar.addEventListener("pointerdown", (ev) => {
    const r = bar.getBoundingClientRect();
    S.go(clamp((ev.clientX - r.left) / r.width, 0, 1) * worldW);
    pin(null);
  });
```

## The footer and the outline, for the record

```html
    <footer><a href="index.html">Back to the world</a></footer>
```

```css
    .hero canvas:focus-visible{ outline:3px solid var(--accent); outline-offset:-4px; }
```
