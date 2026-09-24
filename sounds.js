// @ts-check
"use strict";
/* ============================================================================
   sounds.js  ·  MH_SOUNDS  ·  every sound the worlds make, in one place
   ----------------------------------------------------------------------------
   The isometric village (engine.js) and the 3D slimeverse (verse3d.js) both play
   their sounds from these recipes, so the two views cannot drift apart: the step
   was once a louder triangle in one and a faint low sine in the other. Change a sound
   HERE, and only here. sounds.test.mjs (node --test) fails if a sound either
   world asks for has no recipe here, if an engine makes its own oscillators
   again, if a recipe goes silent, or if a creature's voice loses its shape (the
   blooloo high then low, the teke's clucks low).

   A RECIPE is a list of blips. Each blip:
     at      when it starts, in seconds after the sound does
     dur     how long it lasts (a soft 14 ms attack, then an exponential fall)
     wave    "sine" | "triangle"
     pitch   a multiple of the key's root (the skin's audio.root), or
     degree  a step of the skin's scale, added to the degree the caller asks for
     to      (optional) the pitch it slides to, as a multiple of the root
     gain    its loudness AT THE SPEAKER (after the engine's master), 0 to 1
   and a recipe may be `soft`: through a low-pass at 900 Hz, the squelch.

   MH_SOUNDS.play(name, ctx, o)
     o.out     the node to play into (the engine's master, or a panner before it)
     o.soft    the engine's low-pass into its master, for a soft recipe (optional:
               an engine that filters everything, as the 3D one does, leaves it out)
     o.level   the engine's master gain, which play() divides out, so a recipe
               sounds the same in every view
     o.root    the key's root in Hz; o.scale the skin's scale (semitones)
     o.degree  the scale degree a cue is played from (a kiosk's own note)
     o.scale   (the scale, for degrees)
     o.boost   an extra factor (the iso cues' compensation under Musebots)
     o.near    0 to 1: how near the speaker is (a creature's voice fades with it)
   ========================================================================== */
(function () {
  const four = (at, gain) => [0, 1, 2, 3].map((i) => ({ at: at + i / 60, dur: 0.06, wave: "triangle", pitch: 1, gain }));
  const RECIPES = {
    // ── the slime ──────────────────────────────────────────────────────────
    // its step, in both views: a triangle blip four times over, 1/60 s apart,
    // smeared into one wet squelch and rounded by the low-pass; once a stride
    step: { soft: true, blips: four(0, 0.0176) },
    // landing from a drop (down the hatch into the 3D cave): a low plop, then the squelch
    land: { soft: true, blips: [{ at: 0, dur: 0.16, wave: "sine", pitch: 0.5, to: 0.33, gain: 0.048 }].concat(four(0.03, 0.0176)) },

    // bouncing up out of a cave, through its light: a rising boing, and a pop
    launch: { blips: [{ at: 0, dur: 0.3, wave: "sine", pitch: 1, to: 3, gain: 0.05 }, { at: 0, dur: 0.06, wave: "triangle", pitch: 1.5, gain: 0.03 }] },

    // ── the creatures (3D; each fades with how near it is: o.near) ───────────
    // a pet zoog's "blooloo!": two round notes, the high one first, then the low
    // ("bloo" a major third above "loo"; each note holds its pitch, with no slide).
    // M.'s call, 2026-09-24: it went low then high before, each note sliding up.
    blooloo: { blips: [{ at: 0, dur: 0.1, wave: "sine", pitch: 3, gain: 0.04 },
      { at: 0.12, dur: 0.13, wave: "sine", pitch: 2.4, gain: 0.036 }] },
    // a shoggoth's "teketeke": four low clucks, te and ke, each falling, below the
    // key's root (0.667 and 0.5 of it). Low on purpose: M. likes them there (2026-09-24)
    teke: { blips: [0, 1, 2, 3].map((i) => { const p = i & 1 ? 0.5 : 0.667; return { at: i * 0.09, dur: 0.05, wave: "triangle", pitch: p, to: p * 0.8, gain: 0.036 }; }) },
    // "teke?!": a shoggoth bumped off its hunt, the second cluck rising, asking
    tekeAsk: { blips: [{ at: 0, dur: 0.05, wave: "triangle", pitch: 0.667, to: 0.5336, gain: 0.036 },
      { at: 0.09, dur: 0.11, wave: "triangle", pitch: 0.5, to: 0.9, gain: 0.036 }] },
    // "lilililililili!": a shoggoth that has found a zoog, a quick trill
    lilili: { blips: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ at: i * 0.05, dur: 0.045, wave: "triangle", pitch: i & 1 ? 2.25 : 2, gain: 0.028 })) },

    // ── the iso village's cues (on the skin's scale: o.degree) ───────────────
    open: { blips: [{ at: 0, dur: 0.16, wave: "sine", degree: 0, gain: 0.075 }, { at: 0.08, dur: 0.14, wave: "sine", degree: 2, gain: 0.055 }] },
    near: { blips: [{ at: 0, dur: 0.08, wave: "sine", degree: 0, gain: 0.0275 }] },
    close: { blips: [{ at: 0, dur: 0.11, wave: "sine", degree: 1, gain: 0.035 }, { at: 0.07, dur: 0.12, wave: "sine", degree: 0, gain: 0.0275 }] },
    nav: { blips: [{ at: 0, dur: 0.05, wave: "sine", degree: 2, gain: 0.0225 }] },
    pick: { blips: [{ at: 0, dur: 0.09, wave: "sine", degree: 4, gain: 0.0425 }] },
  };
  /** A scale degree's frequency: the scale repeats up the octaves. */
  function degreeHz(root, scale, degree) {
    const sc = scale && scale.length ? scale : [0, 2, 4, 7, 9], n = sc.length, oct = Math.floor(degree / n);
    return root * Math.pow(2, (sc[((degree % n) + n) % n] + 12 * oct) / 12);
  }
  /** Play a recipe. Returns false if it is unknown or there is nothing to play into. */
  function play(name, ctx, o) {
    const R = RECIPES[name];
    if (!R) { if (window.console) console.warn("[MH_SOUNDS] no sound called " + name); return false; }
    if (!ctx || !o || !o.out) return false;
    const root = o.root || 261.63, level = o.level || 1, scale = o.scale, t0 = ctx.currentTime + (o.delay || 0);
    const k = ((o.boost || 1) * (o.near == null ? 1 : o.near)) / level;
    const dest = R.soft && o.soft ? o.soft : o.out;
    for (const b of R.blips) {
      const peak = Math.min(0.32 / level, b.gain * k);
      if (!(peak > 0.0001)) continue;
      const f0 = b.degree != null ? degreeHz(root, scale, b.degree + (o.degree || 0)) : root * b.pitch;
      const f1 = b.to != null ? root * b.to : f0, t = t0 + b.at;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = b.wave; osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + b.dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.014, b.dur * 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + b.dur);
      osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + b.dur + 0.03);
    }
    return true;
  }
  window.MH_SOUNDS = { RECIPES, play, degreeHz };
})();
