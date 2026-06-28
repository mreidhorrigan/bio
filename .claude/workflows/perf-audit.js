/* Saved, reusable pipeline. Run it with the Workflow tool: Workflow({ name: 'perf-audit' }),
 * or browse/launch it from /workflows. It fans out read-only auditors over the site's
 * subsystems, adversarially verifies each finding, and synthesizes a prioritized action list.
 * Read-only: it never edits files — it returns findings for you to apply. */
export const meta = {
  name: 'perf-audit',
  description: 'Audit matthorrigan.com (the walkable isometric site) for loading + runtime performance wins',
  phases: [
    { title: 'Audit', detail: 'parallel read-only auditors, one per subsystem' },
    { title: 'Verify', detail: 'adversarially confirm each finding is real, safe, and worth it' },
    { title: 'Synthesize', detail: 'de-duped, prioritized action list' },
  ],
}

const ROOT = '/Users/matthorrigan/Documents/bio'   // single source of truth: the live files live here

const ORIENT = `This is a hand-rolled canvas isometric website (no framework, no build step). The live
homepage is ${ROOT}/index.html, which loads (deferred): engine.js, content.js, ecology.js, buildings.js,
theme-technocute.js, theme-technurture.js, theme-technoscure.js. Those .js and all HTML/image/PDF assets
are REAL files at ${ROOT} (root is the single source — there is no dev tree or build step). The render
loop is engine.js loop()/draw(); themes provide paint* painters; ecology.js is an optional life layer.
You are AUDITING ONLY — read with Read/Grep/Bash, do NOT edit any file. Report concrete, real wins.`

const FINDING_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          file: { type: 'string', description: 'path' },
          location: { type: 'string', description: 'function name and/or line range' },
          issue: { type: 'string', description: 'the perf problem, concretely' },
          runsWhen: { type: 'string', enum: ['per-frame', 'per-visible-actor-per-frame', 'per-tile-per-frame', 'at-load', 'on-resize', 'on-interaction', 'other'] },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          fix: { type: 'string', description: 'the concrete change, specific enough to implement' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'], description: 'risk of changing behavior/visuals' },
        },
        required: ['title', 'file', 'location', 'issue', 'runsWhen', 'impact', 'fix', 'risk'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    real: { type: 'boolean', description: 'true only if the cost genuinely occurs as claimed and the fix is sound' },
    reasoning: { type: 'string' },
    correctedImpact: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
    safeFix: { type: 'boolean', description: 'true if the fix is very unlikely to change visuals/behavior' },
    refinedFix: { type: 'string', description: 'the fix, corrected/sharpened if needed' },
  },
  required: ['real', 'reasoning', 'correctedImpact', 'safeFix', 'refinedFix'],
}

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    prioritized: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          rank: { type: 'number' },
          title: { type: 'string' },
          file: { type: 'string' },
          change: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          category: { type: 'string', enum: ['runtime', 'loading'] },
        },
        required: ['rank', 'title', 'file', 'change', 'impact', 'risk', 'category'],
      },
    },
  },
  required: ['summary', 'prioritized'],
}

const DIMENSIONS = [
  { key: 'engine-render-loop', prompt: `${ORIENT}

AUDIT: the engine render loop hot path in ${ROOT}/engine.js. Hunt for runtime cost that recurs every frame:
- per-frame heap allocation (new arrays/objects/closures) in loop()/draw() and the actors build+sort (the
  'actors.push({draw:()=>...})' pattern allocates closures + objects every frame, then sorts).
- per-frame gradient creation (createRadialGradient/createLinearGradient) inside draw/vignette/darkness.
- the darkness dark-canvas pass (ensureDarkCv, the per-kiosk reveal loop, drawImage multiply).
- redundant recomputation: repeated toScreen/nearImg/biomeAt/zoneAt for the same entity in a frame;
  trig (Math.sin/cos/hypot/atan2) in tight per-tile or per-actor loops.
- the ground/tile pass: how many tiles are drawn per frame; any work for off-screen tiles; culling gaps.
- requestAnimationFrame loop: does it run/repaint when nothing moves or the tab is hidden? any throttle?
Report each as a finding with the precise location and a concrete, low-risk fix (e.g. hoist a reusable
array/point buffer, cache a gradient keyed by size, reuse actor objects, skip work when idle).` },

  { key: 'theme-painters', prompt: `${ORIENT}

AUDIT: the theme painters in ${ROOT}/theme-technocute.js, ${ROOT}/theme-technurture.js, ${ROOT}/theme-technoscure.js.
Focus on per-visible-actor and per-tile cost (these run inside the frame for every on-screen building/kiosk/tile):
- gradient objects created per call (createLinearGradient in paintKiosk/paintBuilding/groundBlob) that could be
  cached or replaced with a cheaper fill.
- shadowBlur usage (expensive) and glow() halos drawn per actor per frame.
- measureText calls in draw, repeated string work, per-frame Math.random for visuals (non-deterministic + GC).
- groundBlob and any per-tile painter: allocation or trig per tile.
Give concrete low-risk fixes (cache gradients, precompute per-slot constants, drop/limit shadowBlur, reuse buffers).` },

  { key: 'ecology', prompt: `${ORIENT}

AUDIT: ${ROOT}/ecology.js for structural runtime cost.
Look at: ECO.update (the sim tick + per-entity think loops), the spatial grid rebuild, ECO.actors draw dispatch,
per-frame allocations, reaping/splicing, fields/flora stepping, and whether anything heavy runs every animation frame
vs the low sim tick. Report concrete low-risk fixes (reuse buffers, avoid splice churn, gate work behind the sim tick).` },

  { key: 'loading-startup', prompt: `${ORIENT}

AUDIT: loading + first-paint + startup, prioritising the HOMEPAGE (${ROOT}/index.html) critical path.
- script loading: the .js are 'defer'; is the homepage blocked on parsing ~200KB of engine.js before the
  first interactive frame? any way to start faster (smaller critical JS, idle-defer non-essential)?
- asset weights: check ${ROOT} for large PNG/JPG (e.g. autofac_cover.png, Matt.jpg). Confirm with 'ls -la' / grep
  whether any are on the HOMEPAGE path (they should not be) and whether the pages that use them lazy-load / size
  them responsibly (loading="lazy", width/height, could be compressed/resized to WebP).
- favicons/manifest, fonts (system fonts? any webfont fetch?), <meta viewport>, render-blocking CSS.
- canvas init: devicePixelRatio scaling cost, initial resize, any synchronous heavy work before the first frame.
Report concrete wins with rough byte/ms impact and risk. Loading wins for the homepage are the priority.` },

  { key: 'dom-content-misc', prompt: `${ORIENT}

AUDIT: ${ROOT}/content.js, ${ROOT}/menubar.js, ${ROOT}/buildings.js, and cross-cutting concerns.
- load-time + parse cost; event listeners (could pointermove/scroll be passive?); resize handlers (debounced?);
  layout thrash (reading offsetHeight then writing styles); the View Transitions skin-swap; localStorage access patterns.
- cross-cutting runtime wins applicable site-wide: image-rendering hints, will-change misuse, pausing rAF on
  document.hidden, capping devicePixelRatio, avoiding forced reflows.
Report concrete, low-risk findings.` },
]

const verifyPrompt = (f) => `${ORIENT}

Adversarially VERIFY this performance finding. Open the cited file/location yourself and check independently.
A finding is REAL only if: (a) the cost genuinely occurs as described and on the path claimed (per-frame costs
must actually be in the frame loop), (b) the impact is not negligible micro-optimization, and (c) the proposed
fix is sound and won't change the rendered result or behavior. Default to real=false if you cannot confirm the
cost in the code. Correct the impact and sharpen the fix.

FINDING:
${JSON.stringify(f, null, 2)}`

phase('Audit')
const audited = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: `audit:${d.key}`, phase: 'Audit', schema: FINDING_SCHEMA }),
  (res, d) => {
    const fs = (res && res.findings) || []
    if (!fs.length) return []
    return parallel(fs.map((f) => () =>
      agent(verifyPrompt(f), { label: `verify:${d.key}`, phase: 'Verify', schema: VERDICT_SCHEMA })
        .then((v) => ({ ...f, verdict: v }))
        .catch(() => null)
    ))
  },
)

const confirmed = audited.flat().filter(Boolean).filter((f) => f.verdict && f.verdict.real && f.verdict.correctedImpact !== 'none')
log(`confirmed ${confirmed.length} real findings`)

phase('Synthesize')
const plan = await agent(
  `${ORIENT}\n\nHere are ${confirmed.length} VERIFIED performance findings (each already adversarially confirmed real). ` +
  `De-duplicate overlapping ones, then produce a single prioritized action list ordered by (impact / risk) — highest-value, ` +
  `lowest-risk first. Separate runtime vs loading via the category field. Keep each change concrete enough to implement directly.\n\n` +
  JSON.stringify(confirmed.map((f) => ({ title: f.title, file: f.file, location: f.location, issue: f.issue, runsWhen: f.runsWhen, impact: f.verdict.correctedImpact, refinedFix: f.verdict.refinedFix, safeFix: f.verdict.safeFix, risk: f.risk })), null, 2),
  { phase: 'Synthesize', schema: PLAN_SCHEMA },
)

return { confirmedCount: confirmed.length, plan, confirmed }
