#!/usr/bin/env node
// bug-24 — Bottom sheet shape split: C-16 stays, new C-27 Action Sheet.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes
// the bug-24 grill outcome (`gti-vault/15_issues/v1.1/issues/bug-24-bottom-sheet-ios-shape.md
// §"Grill outcome (2026-05-24)"`) as structural assertions against the
// spec doc, the JSX, and the surrounding bookkeeping. Mirrors
// test-plan-list.mjs from sg-WF-4.
//
// The expected fix shape:
//   1. components.md gains a `C-27 · Action Sheet` section after C-26.
//   2. components.md C-16 intro is amended to disambiguate C-16 (modal
//      editor) from C-27 (action sheet).
//   3. components.jsx exports a new `ActionSheet` primitive companion
//      to the existing inline-composed C-16 sheet language.
//   4. surfaces/00-plan-list.md §Components used references C-27 and
//      adds a Delete confirm sheet subsection.
//   5. CHANGELOG.md carries the bug-24 entry (NOT prefixed `BREAKING:`
//      since C-16 is unchanged and C-27 is purely additive).
//
// Run: node design-system/scripts/test-bug-24.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const componentsMd = path.join(dsRoot, 'components.md');
const componentsJsx = path.join(dsRoot, 'code', 'components.jsx');
const surfacePlanList = path.join(dsRoot, 'surfaces', '00-plan-list.md');
const changelog = path.join(dsRoot, 'CHANGELOG.md');

const failures = [];
const passes = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, label) {
  if (cond) passes.push(label);
  else failures.push(label);
}

// ── 1. components.md — C-27 Action Sheet section ────────────
const compMd = read(componentsMd);

assert(/##\s*C-27\s*·\s*Action Sheet/.test(compMd),
  'components.md has a C-27 · Action Sheet section');

assert(/native iOS|native-iOS|native\s+grabber/i.test(compMd),
  'components.md C-27 documents the native-iOS shape (grabber)');

assert(/presentationDragIndicator/i.test(compMd) || /presentationDetents/i.test(compMd),
  'components.md C-27 references SwiftUI native sheet primitives');

assert(/content[-\s]?height/i.test(compMd),
  'components.md C-27 documents the content-height detent');

// C-16 still exists and is unchanged in title — but the intro mentions C-27 disambiguation.
assert(/##\s*C-16\s*·\s*Bottom Sheet/.test(compMd),
  'components.md C-16 section title preserved (C-16 unchanged)');

// The C-16 intro should now disambiguate from C-27.
const c16Slice = (() => {
  const start = compMd.indexOf('## C-16');
  const end = compMd.indexOf('## C-17', start);
  return start >= 0 && end >= 0 ? compMd.slice(start, end) : '';
})();
assert(/C-27/.test(c16Slice) || /action sheet/i.test(c16Slice),
  'components.md C-16 intro disambiguates from the C-27 action sheet');

// ── 2. components.jsx — ActionSheet export ─────────────────
const compJsx = read(componentsJsx);

assert(/function\s+ActionSheet\s*\(/.test(compJsx),
  'components.jsx defines an ActionSheet function (C-27)');

assert(/Object\.assign\(window,[\s\S]*ActionSheet[\s\S]*\}/.test(compJsx),
  'components.jsx exports ActionSheet on window');

// C-27 web JSX must model rounded-top + full-width + ARIA modal.
const actionSheetSlice = (() => {
  const start = compJsx.indexOf('function ActionSheet');
  // Slice until next top-level `function` declaration or end.
  const rest = compJsx.slice(start);
  const nextFn = rest.slice(20).search(/\nfunction\s+\w+\s*\(/);
  const end = nextFn >= 0 ? start + 20 + nextFn : compJsx.length;
  return compJsx.slice(start, end);
})();

assert(/role=['"]dialog['"]/.test(actionSheetSlice),
  'components.jsx ActionSheet renders with role="dialog"');
assert(/aria-modal=['"]true['"]/.test(actionSheetSlice),
  'components.jsx ActionSheet renders aria-modal="true"');
// Rounded-top only — bottom corners zero.
assert(/borderTopLeftRadius|borderRadius:\s*['"]?\d+px\s+\d+px\s+0\s+0/i.test(actionSheetSlice) ||
       /border-top-left-radius/i.test(actionSheetSlice),
  'components.jsx ActionSheet renders with rounded-top-only corners');

// Existing C-16 + C-23 primitives still exist (C-16 unchanged, C-23 inherits).
assert(/function\s+LocationPickerSheet\s*\(/.test(compJsx),
  'components.jsx still exports LocationPickerSheet (C-23, inherits C-16)');

// ── 3. surfaces/00-plan-list.md — references C-27 ──────────
const surface = read(surfacePlanList);

assert(/C-27/.test(surface),
  '00-plan-list.md references the new C-27 Action Sheet primitive');

// Components-used list mentions C-27 (consumer).
assert(/C-27[\s\S]{0,100}(consumer|ActionSheet)/i.test(surface) ||
       /ActionSheet[\s\S]{0,40}\(?C-27/i.test(surface),
  '00-plan-list.md §Components used names C-27 ActionSheet (consumer)');

// Delete confirm sheet subsection exists (added).
assert(/Delete confirm sheet/i.test(surface),
  '00-plan-list.md has a Delete confirm sheet subsection');

// ── 4. CHANGELOG.md — bug-24 entry, additive (not BREAKING) ─
const cl = read(changelog);
assert(/bug-24/i.test(cl),
  'CHANGELOG.md carries a bug-24 entry');
assert(/C-27/.test(cl),
  'CHANGELOG.md entry names the new C-27 primitive');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
