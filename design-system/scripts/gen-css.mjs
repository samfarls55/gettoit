#!/usr/bin/env node
// GetToIt — Sunset Pop · tokens.json → code/tokens.css
// Run: node design-system/scripts/gen-css.mjs
// Output is deterministic. CI / verify.mjs re-runs this and diffs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const tokensPath = path.join(dsRoot, 'tokens.json');
const outPath = path.join(dsRoot, 'code', 'tokens.css');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

const generated = renderCss(tokens);

// Allow --check mode for CI: exit 1 if disk differs from generated
const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== generated) {
    console.error(`drift: ${path.relative(process.cwd(), outPath)} differs from tokens.json`);
    console.error('       run: node design-system/scripts/gen-css.mjs');
    process.exit(1);
  }
  console.log(`ok: ${path.relative(process.cwd(), outPath)} matches tokens.json`);
  process.exit(0);
}

fs.writeFileSync(outPath, generated);
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${generated.length} bytes)`);

// ────────────────────────────────────────────────────────────
function renderCss(t) {
  const c = t.color;
  const ty = t.typography;
  const sp = t.spacing;
  const r = t.radii;
  const m = t.motion;
  const tr = ty.tracking;
  const initiator = t.gradient.surfaces[t.gradient['tween-from']];
  const tween = `${m['duration-ms']['grad-tween']}ms ${m.easing['in-out']}`;

  return `/* GetToIt — Sunset Pop · design tokens (canonical)
   GENERATED from design-system/tokens.json — do not edit by hand.
   Re-run:  node design-system/scripts/gen-css.mjs
   Verify:  node design-system/scripts/gen-css.mjs --check */

/* Registered properties so the gradient stops can actually tween */
@property --g1 { syntax: '<color>'; inherits: true; initial-value: ${initiator[0]}; }
@property --g2 { syntax: '<color>'; inherits: true; initial-value: ${initiator[1]}; }
@property --g3 { syntax: '<color>'; inherits: true; initial-value: ${initiator[2]}; }
@property --g4 { syntax: '<color>'; inherits: true; initial-value: ${initiator[3]}; }

:root {
  /* ink + paper */
  --ink: ${c.ink};
  --ink-2: ${c['ink-2']};
  --ink-3: ${c['ink-3']};
  --paper: ${c.paper};
  --sun: ${c.sun};
  --sun-deep: ${c['sun-deep']};

  /* glass on gradient */
  --glass-fill: ${c.glass.fill};
  --glass-stroke: ${c.glass.stroke};
  --glass-fill-strong: ${c.glass['fill-strong']};
  --glass-fill-soft: ${c.glass['fill-soft']};

  /* type */
  --ff-display: ${ty.families.display};
  --ff-body: ${ty.families.body};
  --ff-mono: ${ty.families.mono};
  --display-weight: ${ty['display-weight']};

  --fz-display-xl: ${ty.scale['display-xl'].size}px;
  --fz-display-l: ${ty.scale['display-l'].size}px;
  --fz-display-m: ${ty.scale['display-m'].size}px;
  --fz-display-s: ${ty.scale['display-s'].size}px;
  --fz-heading: ${ty.scale.heading.size}px;
  --fz-title: ${ty.scale.title.size}px;
  --fz-body: ${ty.scale.body.size}px;
  --fz-sm: ${ty.scale.sm.size}px;
  --fz-eyebrow: ${ty.scale.eyebrow.size}px;
  --fz-cta: ${ty.scale.cta.size}px;

  --tr-eyebrow: ${tr.eyebrow};
  --tr-cta: ${tr.cta};
  --tr-display: ${tr.display};

  /* spacing */
  --sp-1: ${sp['1']}px;  --sp-2: ${sp['2']}px;  --sp-3: ${sp['3']}px; --sp-4: ${sp['4']}px;
  --sp-5: ${sp['5']}px; --sp-6: ${sp['6']}px; --sp-8: ${sp['8']}px;
  --sp-10: ${sp['10']}px; --sp-12: ${sp['12']}px; --sp-16: ${sp['16']}px;

  /* radii */
  --r-chip: ${r.chip}px;
  --r-card: ${r.card}px;
  --r-card-lg: ${r['card-lg']}px;
  --r-pill: ${r.pill}px;
  --r-hero: ${r.hero}px;
  --r-tag: ${r.tag}px;
  --r-sheet: ${r.sheet}px;

  /* motion */
  --ease-out: ${m.easing.out};
  --ease-out-soft: ${m.easing['out-soft']};
  --ease-in-out: ${m.easing['in-out']};
  --grad-tween: ${tween};
}

html, body {
  margin: 0; padding: 0;
  background: #08080a;
  color: var(--ink);
  font-family: var(--ff-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }

/* ── Gradient surface — the core of Sunset Pop ──────────── */
.gti-gradient {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg,
      var(--g1) 0%,
      var(--g2) 32%,
      var(--g3) 66%,
      var(--g4) 100%);
  transition:
    --g1 var(--grad-tween),
    --g2 var(--grad-tween),
    --g3 var(--grad-tween),
    --g4 var(--grad-tween);
}

/* ── Grain — texture defense against algorithm-flat ─────── */
.gti-grain {
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: ${t.texture['grain-opacity']};
  mix-blend-mode: ${t.texture['grain-blend']};
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${t.texture['grain-tile-px']}' height='${t.texture['grain-tile-px']}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>");
}

/* ── Display utilities ──────────────────────────────────── */
.gti-eyebrow {
  font-family: var(--ff-body);
  font-weight: 700;
  font-size: var(--fz-eyebrow);
  letter-spacing: var(--tr-eyebrow);
  text-transform: uppercase;
}
.gti-cta {
  font-family: var(--ff-body);
  font-weight: 800;
  font-size: var(--fz-cta);
  letter-spacing: var(--tr-cta);
  text-transform: uppercase;
}
.gti-display {
  font-family: var(--ff-display);
  font-weight: var(--display-weight);
  letter-spacing: var(--tr-display);
  line-height: 0.92;
}

/* ── Motion primitives ──────────────────────────────────── */
.gti-rise {
  display: inline-block;
  animation: gti-rise ${m['duration-ms'].rise}ms var(--ease-out-soft) both;
}
@keyframes gti-rise {
  from { transform: translateY(36px); opacity: 0; filter: blur(4px); }
  to { transform: translateY(0); opacity: 1; filter: blur(0); }
}
@keyframes gti-fade-up {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes gti-pop {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes gti-stagger-in {
  from { transform: translateY(8px) scale(0.96); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes gti-shutter-top {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
@keyframes gti-shutter-bot {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* ── Mobile canvas inside the device frame ─────────────── */
.gti-canvas {
  position: absolute; inset: 0;
  overflow: hidden;
  color: #fff;
}
.gti-canvas .content {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  padding-top: 56px;
  padding-bottom: 32px;
}
`;
}
