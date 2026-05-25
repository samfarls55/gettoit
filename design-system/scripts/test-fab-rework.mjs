#!/usr/bin/env node
// bug-23 — Plan list FAB rework (T1 ink-fill, new `shadow.fab` token).
//
// Structural test encoding the bug-23 grill-outcome acceptance criteria
// (vault file `gti-vault/15_issues/0.1.0/issues/bug-23-plan-list-fab-design-system-fit.md`).
// Mirrors `test-plan-list.mjs` from sg-WF-4 — the design system has no
// behavioral test framework; `verify.mjs` covers drift, orphan-hex,
// and surface↔jsx pairing, but cannot catch the T1 visual-register
// rework. This script gates that the rework lands end-to-end:
//
//   1. tokens.json carries the new `shadow.fab` recipe (sun-tinted halo).
//   2. tokens.md §5 documents the new token.
//   3. code/tokens.css exposes `--shadow-fab` so JSX can `var()` it.
//   4. ios/Sources/GTITokens.swift exposes `GTIShadow.fab` so the iOS
//      port can pin the sun-tinted halo without a third inline literal.
//   5. components.md §C-26 Visual spec table reflects the T1 ink-fill
//      (ink-2 background, no glass border, sun-tinted shadow).
//   6. code/components.jsx FloatingActionButton drops glass + uses the
//      new shadow var.
//   7. ios/Sources/App/FloatingActionButton.swift drops glass + uses
//      GTIShadow.fab + GTIColor.ink2.
//   8. CHANGELOG carries the BREAKING entry naming bug-23.
//   9. The locked rationale in components.md §C-26 cites the impeccable
//      grill and the T1 ink-fill decision.
//  10. surfaces/00-plan-list.md is NOT structurally edited (only the
//      FAB's fill/border/shadow change — its external contract is the
//      same diameter / position / behavior).
//
// Run: node design-system/scripts/test-fab-rework.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(dsRoot, '..');

const tokensJson = path.join(dsRoot, 'tokens.json');
const tokensMd = path.join(dsRoot, 'tokens.md');
const tokensCss = path.join(dsRoot, 'code', 'tokens.css');
const swiftTokens = path.join(repoRoot, 'ios', 'Sources', 'GTITokens.swift');
const componentsMd = path.join(dsRoot, 'components.md');
const componentsJsx = path.join(dsRoot, 'code', 'components.jsx');
const fabSwift = path.join(repoRoot, 'ios', 'Sources', 'App', 'FloatingActionButton.swift');
const changelog = path.join(dsRoot, 'CHANGELOG.md');
const surfaceDoc = path.join(dsRoot, 'surfaces', '00-plan-list.md');

const failures = [];
const passes = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, label) {
  if (cond) passes.push(label);
  else failures.push(label);
}

// ── 1. tokens.json carries shadow.fab ──────────────────────
const tokens = JSON.parse(read(tokensJson));
assert(typeof tokens?.shadow?.fab === 'string',
  'tokens.json: shadow.fab is a string');
const fabRecipe = tokens?.shadow?.fab ?? '';
assert(/0\s+12px\s+32px\s+rgba\(255,\s*210,\s*63,\s*0\.32\)/.test(fabRecipe),
  'tokens.json: shadow.fab carries the sun-tinted outer drop (0 12px 32px rgba(255,210,63,0.32))');
assert(/inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255,\s*0\.08\)/.test(fabRecipe),
  'tokens.json: shadow.fab carries the 0.08-white inset highlight');

// ── 2. tokens.md §5 documents the new token ────────────────
const tokensMdSrc = read(tokensMd);
assert(/`?shadow-fab`?/.test(tokensMdSrc),
  'tokens.md: §5 shadow table includes shadow-fab');

// ── 3. tokens.css exposes --shadow-fab ─────────────────────
const tokensCssSrc = read(tokensCss);
assert(/--shadow-fab:\s*0\s+12px\s+32px\s+rgba\(255,\s*210,\s*63,\s*0\.32\)/.test(tokensCssSrc),
  'code/tokens.css: --shadow-fab is emitted with the sun-tinted halo recipe');

// ── 4. GTITokens.swift exposes GTIShadow.fab ───────────────
const swiftSrc = read(swiftTokens);
assert(/enum\s+GTIShadow\b/.test(swiftSrc),
  'GTITokens.swift: GTIShadow enum is generated');
assert(/static\s+let\s+fab\b/.test(swiftSrc),
  'GTITokens.swift: GTIShadow.fab member exists');
// The recipe alpha + sun tint + radius / y must round-trip into the Swift constants.
assert(/fab[\s\S]{0,200}?(?:opacity|alpha).{0,40}0\.32/i.test(swiftSrc),
  'GTITokens.swift: GTIShadow.fab carries the 0.32 sun-tinted alpha');
assert(/fab[\s\S]{0,200}?radius:\s*32\b/.test(swiftSrc),
  'GTITokens.swift: GTIShadow.fab carries a 32-pt blur radius');
assert(/fab[\s\S]{0,200}?y:\s*12\b/.test(swiftSrc),
  'GTITokens.swift: GTIShadow.fab carries a +12 y offset');

// ── 5. components.md §C-26 Visual spec table (T1 ink-fill) ─
const compsMd = read(componentsMd);
const c26Idx = compsMd.indexOf('## C-26');
assert(c26Idx >= 0, 'components.md contains a C-26 section');
const c26EndIdx = compsMd.indexOf('\n## ', c26Idx + 1);
const c26 = c26Idx >= 0
  ? compsMd.slice(c26Idx, c26EndIdx >= 0 ? c26EndIdx : compsMd.length)
  : '';

// T1 ink-fill background
assert(/var\(--ink-2\)|--ink-2/.test(c26),
  'components.md §C-26: Background uses --ink-2');
// Glass register must be retired — no `backdrop-filter` or `rgba(255,255,255,0.18)`
// fill should survive the Visual spec table (the glass-vs-sun-fill rationale
// paragraph may still mention glass historically, see assertion 9 below).
assert(!/backdrop-filter:\s*blur\(14px\)/.test(c26),
  'components.md §C-26: backdrop-filter blur is no longer in the Visual spec table');
assert(!/`?0\.75px\s+solid\s+rgba\(255,255,255,0\.32\)`?/.test(c26),
  'components.md §C-26: the glass 0.75px border row is gone');
// Sun-tinted shadow either via the var or the literal recipe.
assert(/var\(--shadow-fab\)|rgba\(255,210,63,0\.32\)/.test(c26),
  'components.md §C-26: Shadow row references --shadow-fab / the sun-tinted halo');

// ── 6. FloatingActionButton JSX T1 ────────────────────────
const jsx = read(componentsJsx);
// Find the FloatingActionButton function body
const fabFnIdx = jsx.indexOf('function FloatingActionButton');
assert(fabFnIdx >= 0, 'components.jsx defines FloatingActionButton');
const fabFnEnd = jsx.indexOf('\nfunction ', fabFnIdx + 1);
const fabFnEndFallback = jsx.indexOf('Object.assign(window', fabFnIdx + 1);
const fabFn = jsx.slice(
  fabFnIdx,
  fabFnEnd > 0
    ? fabFnEnd
    : (fabFnEndFallback > 0 ? fabFnEndFallback : jsx.length)
);

// JSX must render the T1 register — ink-2 background, no glass fill, no blur, no glass border, shadow var.
assert(/background:\s*['"`]var\(--ink-2\)['"`]/.test(fabFn),
  'components.jsx FAB: background uses var(--ink-2)');
assert(!/backdropFilter/.test(fabFn),
  'components.jsx FAB: backdropFilter is gone');
assert(!/WebkitBackdropFilter/.test(fabFn),
  'components.jsx FAB: WebkitBackdropFilter is gone');
assert(!/rgba\(255,255,255,0\.18\)/.test(fabFn),
  'components.jsx FAB: the glass white-0.18 background is gone');
assert(!/0\.75px\s+solid\s+rgba\(255,255,255,0\.32\)/.test(fabFn),
  'components.jsx FAB: the glass white-0.32 border is gone');
assert(/border:\s*['"`]none['"`]/.test(fabFn),
  'components.jsx FAB: border is explicitly none');
assert(/boxShadow:\s*['"`]var\(--shadow-fab\)['"`]/.test(fabFn),
  'components.jsx FAB: boxShadow uses var(--shadow-fab)');

// ── 7. iOS FloatingActionButton.swift T1 ──────────────────
const fabSwiftSrc = read(fabSwift);
assert(/GTIColor\.ink2/.test(fabSwiftSrc),
  'FloatingActionButton.swift: uses GTIColor.ink2 for the disc background');
assert(!/\.background\(\.ultraThinMaterial,\s*in:\s*Circle\(\)\)/.test(fabSwiftSrc),
  'FloatingActionButton.swift: the ultraThinMaterial glass background is gone');
assert(!/\.overlay\(\s*Circle\(\)\.stroke\(Color\.white\.opacity\(0\.32\)/.test(fabSwiftSrc),
  'FloatingActionButton.swift: the white-0.32 glass border overlay is gone');
assert(/GTIShadow\.fab/.test(fabSwiftSrc),
  'FloatingActionButton.swift: applies GTIShadow.fab');
// The legacy `.shadow(color: Color.black.opacity(0.18), ...)` literal must be retired.
assert(!/\.shadow\(color:\s*Color\.black\.opacity\(0\.18\),\s*radius:\s*12,\s*x:\s*0,\s*y:\s*8\)/.test(fabSwiftSrc),
  'FloatingActionButton.swift: the legacy black-0.18 / radius 12 / y 8 shadow literal is gone');

// ── 8. CHANGELOG BREAKING entry ───────────────────────────
const changelogSrc = read(changelog);
assert(/BREAKING:\s*C-26[\s\S]*?bug-23/i.test(changelogSrc),
  'CHANGELOG: BREAKING entry for the C-26 T1 rework names bug-23');

// ── 9. C-26 rationale paragraph updated ───────────────────
assert(/T1\s+ink-fill|ink-fill/i.test(c26),
  'components.md §C-26: rationale paragraph names the T1 ink-fill decision');
assert(/impeccable/i.test(c26),
  'components.md §C-26: rationale paragraph cites the impeccable grill');
assert(/2026-05-24/.test(c26),
  'components.md §C-26: rationale paragraph dates the grill (2026-05-24)');

// ── 10. surface 00-plan-list.md NOT structurally edited ───
const surfaceSrc = read(surfaceDoc);
// The surface's §"Components used" must still list C-26; the FAB's
// container / position / behavior contract is the load-bearing piece,
// not the fill/border/shadow.
assert(/C-26/.test(surfaceSrc),
  'surfaces/00-plan-list.md: still references C-26 (external FAB contract unchanged)');
// The surface doc should NOT have to repeat the new T1 visuals — they
// live in components.md §C-26 only.
assert(!/T1\s+ink-fill/i.test(surfaceSrc),
  'surfaces/00-plan-list.md: does NOT repeat the T1 ink-fill visual (it stays in components.md)');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.error(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
