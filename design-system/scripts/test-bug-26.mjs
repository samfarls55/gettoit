#!/usr/bin/env node
// bug-26 — Full removal of the verdict cuts drawer.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes
// the bug-26 grill outcome (`gti-vault/15_issues/0.1.0/issues/bug-26-verdict-cuts-drawer-removal.md
// §"Grill outcome (2026-05-24)"`) as structural assertions against the
// spec docs, the JSX, the iOS port, and the surrounding bookkeeping.
// Mirrors test-bug-24.mjs from bug-24.
//
// The expected fix shape:
//   1. surfaces/05-verdict.md drops the `cuts` row from §Modes,
//      removes every `cuts-drawer` / `"See what got cut →"` reference
//      across mode rows, the §read-only mode-specific section, and the
//      edge-case section.
//   2. components.md C-13 · Cuts Drawer entry is deleted (slot left
//      empty — the design system tolerates gaps; see the spec note in
//      bug-26 §Fix scope). The C-12 → C-14 jump is allowed.
//   3. accessibility.md drops the Cuts drawer trigger / Cuts row tap-
//      target rows, the §Fixes "bump to 44" item, the cuts entries in
//      every Verdict focus-order list, the Cuts trigger / Cuts row VO
//      label rows, the "Cuts drawer rule" announcement paragraph, and
//      the §Audit-results bullet about the 32-tall trigger.
//   4. motion.md drops the "Cuts drawer fade-up" mention from the
//      ease-out-soft row, the "Cuts drawer trigger remains in its
//      slot" sentence from the read-only entry, the "Cuts drawer open"
//      utility-motion row, and the §Reduced-motion bullet about the
//      cuts drawer.
//   5. ScreenVerdict.jsx drops the showCutsDrawer flag, the
//      cutsOpen state, the cuts JSX block, and the `cuts` mode-effect
//      handling.
//   6. ios/Sources/App/VerdictScreen.swift drops the `.cuts` enum case,
//      cutsExpanded state, cutsDrawer view, and the
//      showCutsDrawer/cutsExpanded ModeSnapshot fields.
//   7. CHANGELOG.md carries a BREAKING bug-26 entry (the `cuts` mode is
//      being removed — JSX consumers that assumed cuts existed will
//      break).
//
// Run: node design-system/scripts/test-bug-26.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(dsRoot, '..');

const surfaceVerdict = path.join(dsRoot, 'surfaces', '05-verdict.md');
const componentsMd = path.join(dsRoot, 'components.md');
const accessibilityMd = path.join(dsRoot, 'accessibility.md');
const motionMd = path.join(dsRoot, 'motion.md');
const screenVerdictJsx = path.join(dsRoot, 'code', 'screens', 'ScreenVerdict.jsx');
const verdictSwift = path.join(repoRoot, 'ios', 'Sources', 'App', 'VerdictScreen.swift');
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

// ── 1. surfaces/05-verdict.md — `cuts` mode and drawer references removed ─
const surface = read(surfaceVerdict);

// The §Modes table introduction lists the modes — must drop `cuts`.
assert(!/\bcuts\b/.test(surface.match(/> \*\*Code:\*\*[\s\S]*?Six modes:.+?\./)?.[0] ?? '') &&
       /Five modes/.test(surface),
  'surfaces/05-verdict.md intro lists Five modes (no `cuts`)');

// No `| `cuts` |` row in the §Modes table.
assert(!/\|\s*`cuts`\s*\|/i.test(surface),
  'surfaces/05-verdict.md §Modes table has no `cuts` row');

// No "Cuts drawer" mentions anywhere in the surface doc.
assert(!/cuts drawer/i.test(surface),
  'surfaces/05-verdict.md has no "Cuts drawer" references');

// No "See what got cut" trigger copy.
assert(!/see what got cut/i.test(surface),
  'surfaces/05-verdict.md has no "See what got cut" trigger copy');

// The "Only 1 candidate survives" edge case no longer mentions cuts auto-open.
const edgeCases = surface.match(/##\s*Edge cases[\s\S]*?(?=##\s|$)/i)?.[0] ?? '';
assert(!/cuts/i.test(edgeCases),
  'surfaces/05-verdict.md §Edge cases drops every cuts reference');

// The §"five-second test" must drop `cuts` from the "applies in full to" list.
const fiveSecondTest = surface.match(/##\s*The five-second test[\s\S]*?(?=##\s|$)/i)?.[0] ?? '';
assert(!/`cuts`/.test(fiveSecondTest),
  'surfaces/05-verdict.md §"The five-second test" no longer applies to `cuts` mode');

// ── 2. components.md — C-13 Cuts Drawer entry deleted ─────
const compMd = read(componentsMd);

assert(!/##\s*C-13\s*·\s*Cuts Drawer\b/.test(compMd),
  'components.md no longer has a live C-13 · Cuts Drawer section');

// The C-13 slot may be left as a retirement marker, but it must not
// re-spec the trigger / drawer (i.e. the "Trigger (collapsed)" table
// row that used to define the copy + style must be gone).
assert(!/Trigger \(collapsed\)/i.test(compMd),
  'components.md drops the C-13 Trigger (collapsed) spec row');

// Sibling components C-12 and C-14 still present (slot 13 left empty per spec).
assert(/##\s*C-12\b/.test(compMd),
  'components.md still has the C-12 entry');
assert(/##\s*C-14\b/.test(compMd),
  'components.md still has the C-14 entry');

// ── 3. accessibility.md — cuts references removed ─────────
const a11y = read(accessibilityMd);

assert(!/cuts drawer trigger/i.test(a11y),
  'accessibility.md drops Cuts drawer trigger tap-target rows');

assert(!/cuts row/i.test(a11y),
  'accessibility.md drops Cuts row tap-target / VO references');

assert(!/cuts trigger/i.test(a11y),
  'accessibility.md drops Cuts trigger references (focus order + VO)');

assert(!/see what got cut/i.test(a11y),
  'accessibility.md drops "See what got cut" copy');

assert(!/cuts drawer rule/i.test(a11y),
  'accessibility.md drops the "Cuts drawer rule" announcement paragraph');

// Verdict focus orders for default/cuts/committed becomes default/committed.
// (No `/` `cuts` `/` between default and committed in the focus-order heading.)
assert(/Verdict \(default\s*\/\s*committed\)/i.test(a11y),
  'accessibility.md §Focus order names the Verdict block as "(default / committed)"');

// ── 4. motion.md — cuts drawer references removed ─────────
const motion = read(motionMd);

assert(!/cuts drawer/i.test(motion),
  'motion.md drops Cuts drawer references (easing, utility-motion, reduced-motion)');

assert(!/cuts trigger/i.test(motion),
  'motion.md drops the read-only "Cuts drawer trigger remains" sentence');

// ── 5. ScreenVerdict.jsx — cuts JSX removed ───────────────
const jsx = read(screenVerdictJsx);

assert(!/showCutsDrawer/.test(jsx),
  'ScreenVerdict.jsx drops the showCutsDrawer flag');

assert(!/cutsOpen/.test(jsx),
  'ScreenVerdict.jsx drops the cutsOpen React state');

// The retirement note in the file header may reference the historical
// copy; what must not survive is the live button. Strip block + line
// comments from the JSX before scanning so the retirement note doesn't
// false-positive.
const jsxNoComments = jsx
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
assert(!/See what got cut/.test(jsxNoComments),
  'ScreenVerdict.jsx drops the live "See what got cut →" trigger copy');

assert(!/What got cut/.test(jsxNoComments),
  'ScreenVerdict.jsx drops the live expanded-drawer "What got cut" header copy');

assert(!/mode === ['"]cuts['"]/.test(jsx),
  'ScreenVerdict.jsx drops the `mode === "cuts"` branch handling');

// Six modes → Five modes mention in the file header comment.
assert(!/6 modes/.test(jsx) && !/six modes/i.test(jsx),
  'ScreenVerdict.jsx header drops the "6 modes" annotation (cuts removed)');

// ── 6. iOS VerdictScreen.swift — cuts UI removed ──────────
const swift = read(verdictSwift);

assert(!/case cuts\b/.test(swift),
  'VerdictScreen.swift drops the `.cuts` enum case');

assert(!/cutsExpanded/.test(swift),
  'VerdictScreen.swift drops the cutsExpanded @State and ModeSnapshot field');

assert(!/showCutsDrawer/.test(swift),
  'VerdictScreen.swift drops the showCutsDrawer ModeSnapshot field');

assert(!/cutsDrawer/.test(swift),
  'VerdictScreen.swift drops the cutsDrawer view');

assert(!/SEE WHAT GOT CUT/.test(swift),
  'VerdictScreen.swift drops the "SEE WHAT GOT CUT →" trigger copy');

assert(!/verdict\.cuts\.trigger/.test(swift),
  'VerdictScreen.swift drops the verdict.cuts.trigger accessibility identifier');

// ── 7. CHANGELOG.md — BREAKING bug-26 entry ───────────────
const cl = read(changelog);

assert(/bug-26/i.test(cl),
  'CHANGELOG.md carries a bug-26 entry');

// Find the bug-26 entry and confirm it carries the BREAKING prefix.
const bug26Line = cl.split('\n').find(line => /bug-26/i.test(line)) ?? '';
assert(/BREAKING/i.test(bug26Line),
  'CHANGELOG.md bug-26 entry is prefixed BREAKING (the cuts mode is being deleted)');

// ── Report ────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
