#!/usr/bin/env node
// sg-WF-4 — Plan list surface structural test.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes
// the acceptance criteria of sg-WF-4 as structural assertions against the
// spec doc, the JSX, and the surrounding bookkeeping, so the issue gets a
// real red→green TDD cycle (mirroring test-plan-setup.mjs from sg-WF-1).
//
// Run: node design-system/scripts/test-plan-list.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const newSurface = path.join(dsRoot, 'surfaces', '00-plan-list.md');
const oldLanding = path.join(dsRoot, 'surfaces', '00-landing.md');
const screenPlanList = path.join(dsRoot, 'code', 'screens', 'ScreenPlanList.jsx');
const componentsJsx = path.join(dsRoot, 'code', 'components.jsx');
const componentsMd = path.join(dsRoot, 'components.md');
const readme = path.join(dsRoot, 'README.md');
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

// ── 1. New surface doc — frontmatter + content ─────────────
assert(fs.existsSync(newSurface), 'surfaces/00-plan-list.md exists');

const surface = fs.existsSync(newSurface) ? read(newSurface) : '';

// Frontmatter
assert(/^---\r?\n[\s\S]*?surface:\s*00-plan-list/m.test(surface),
  '00-plan-list.md frontmatter: surface = 00-plan-list');
assert(/^---\r?\n[\s\S]*?status:\s*locked/m.test(surface),
  '00-plan-list.md frontmatter: status = locked');
assert(/locked-date:\s*2026-05-20/.test(surface),
  '00-plan-list.md frontmatter: locked-date = 2026-05-20');
assert(/jsx:[\s\S]*?-\s*code\/screens\/ScreenPlanList\.jsx/.test(surface),
  '00-plan-list.md frontmatter claims code/screens/ScreenPlanList.jsx');
assert(/supersedes:[\s\S]*?-\s*00-landing/.test(surface),
  '00-plan-list.md frontmatter supersedes 00-landing');

// Locked sections (Q1)
for (const section of ['Pending', 'Decided', 'History']) {
  assert(surface.includes(section),
    `00-plan-list.md mentions section "${section}"`);
}

// Card content (Q2) — verdict-place-name inlined on Decided/History, 1-line Pending
assert(/1-line/i.test(surface) || /one[\s-]?line/i.test(surface),
  '00-plan-list.md documents 1-line Pending card silhouette');
assert(/2-line/i.test(surface) || /two[\s-]?line/i.test(surface),
  '00-plan-list.md documents 2-line Decided/History card silhouette');
assert(/verdict.place/i.test(surface),
  '00-plan-list.md documents the verdict place name on Decided/History cards');

// Joined chip (Q3)
assert(/JOINED|`JOINED`|Joined/.test(surface),
  '00-plan-list.md documents the JOINED chip');
assert(/var\(--sun\)/.test(surface),
  '00-plan-list.md uses var(--sun) for the chip color');
assert(/C-11|eyebrow/i.test(surface),
  '00-plan-list.md references the C-11 / eyebrow typography for the chip');

// Three-dot menu (Q4) — C-25 + menu contents
assert(/C-25/.test(surface),
  '00-plan-list.md references the new C-25 Action Dot Menu primitive');
assert(/Edit plan/.test(surface),
  '00-plan-list.md documents the "Edit plan" menu item');
assert(/Delete plan/.test(surface),
  '00-plan-list.md documents the "Delete plan" menu item');
assert(/Leave plan/.test(surface),
  '00-plan-list.md documents the "Leave plan" menu item');

// Confirm sheet copy table (Q4) — locked copy register, no red
for (const title of [
  'Delete this plan?',
  'Remove from history?',
  'Leave this plan?',
]) {
  assert(surface.includes(title),
    `00-plan-list.md contains locked confirm-sheet title "${title}"`);
}
assert(/no red/i.test(surface) || /never sun/i.test(surface) || /never.*red/i.test(surface),
  '00-plan-list.md explicitly documents the no-red rule for destructive actions');
assert(/KEEP/.test(surface), '00-plan-list.md documents the KEEP dismiss eyebrow');
assert(/STAY/.test(surface), '00-plan-list.md documents the STAY dismiss eyebrow');

// Create affordance (Q5 + Q6)
assert(/C-26/.test(surface),
  '00-plan-list.md references the new C-26 Floating Action Button primitive');
assert(/disambig/i.test(surface),
  '00-plan-list.md documents the disambig sheet');
assert(/Create your first plan/.test(surface),
  '00-plan-list.md contains locked empty-state pill copy "Create your first plan"');
assert(/Solo/.test(surface) && /Group/.test(surface),
  '00-plan-list.md documents the Solo / Group disambig options');
assert(/no Cancel/i.test(surface) || /No Cancel/.test(surface),
  '00-plan-list.md documents the no-Cancel-button rule on the disambig sheet');

// Ordering (Q7)
assert(/created_at\s*DESC/.test(surface),
  '00-plan-list.md documents Pending sort key (created_at DESC)');
assert(/verdict_fired_at\s*DESC/.test(surface),
  '00-plan-list.md documents Decided sort key (verdict_fired_at DESC)');
assert(/expired_at\s*DESC/.test(surface),
  '00-plan-list.md documents History sort key (expired_at DESC)');

// Tap behavior — both Created and Joined tables
assert(/Edit mode|edit.?mode|`edit`/i.test(surface),
  '00-plan-list.md documents Created Pending → S01 Setup in edit mode');
assert(/resume.from.state|resume-from-state/i.test(surface),
  '00-plan-list.md documents Joined card resume-from-state');
for (const dest of ['S03 Quiz', 'S04 Waiting', 'S05 Verdict']) {
  assert(surface.includes(dest),
    `00-plan-list.md references tap destination "${dest}"`);
}

// ── 2. ScreenPlanList.jsx — structural assertions ──────────
assert(fs.existsSync(screenPlanList), 'code/screens/ScreenPlanList.jsx exists');

const jsx = fs.existsSync(screenPlanList) ? read(screenPlanList) : '';

assert(/function\s+ScreenPlanList\s*\(/.test(jsx),
  'ScreenPlanList.jsx defines a ScreenPlanList function');
assert(/Object\.assign\(window,\s*\{[\s\S]*ScreenPlanList/.test(jsx),
  'ScreenPlanList.jsx registers ScreenPlanList on window');

// Surface uses initiator gradient
assert(/<GradientSurface[^>]*stop=['"]initiator['"]/.test(jsx),
  'ScreenPlanList.jsx renders on the initiator gradient surface');

// Three section props
assert(/pending\s*=\s*\[\s*\]/.test(jsx),
  'ScreenPlanList.jsx accepts a `pending` array prop (default [])');
assert(/decided\s*=\s*\[\s*\]/.test(jsx),
  'ScreenPlanList.jsx accepts a `decided` array prop (default [])');
assert(/history\s*=\s*\[\s*\]/.test(jsx),
  'ScreenPlanList.jsx accepts a `history` array prop (default [])');

// Composition — uses the new primitives + existing ones
assert(/<FloatingActionButton\b/.test(jsx),
  'ScreenPlanList.jsx uses the new C-26 FloatingActionButton');
assert(/<ActionDotMenuTrigger\b/.test(jsx),
  'ScreenPlanList.jsx uses the new C-25 ActionDotMenuTrigger');
assert(/<ActionDotMenu\b/.test(jsx),
  'ScreenPlanList.jsx uses the new C-25 ActionDotMenu popover');
assert(/<PillCTA\b/.test(jsx),
  'ScreenPlanList.jsx uses the existing C-05 PillCTA');
assert(/<Eyebrow\b/.test(jsx),
  'ScreenPlanList.jsx uses the existing Eyebrow primitive');

// Card section labels
for (const label of ['Pending', 'Decided', 'History']) {
  assert(new RegExp(`['"]${label}['"]`).test(jsx),
    `ScreenPlanList.jsx contains section label literal "${label}"`);
}

// Locked menu item copy
for (const item of ['Edit plan', 'Delete plan', 'Leave plan']) {
  assert(jsx.includes(`'${item}'`) || jsx.includes(`"${item}"`),
    `ScreenPlanList.jsx contains menu item literal "${item}"`);
}

// Locked confirm-sheet + UI copy strings — title + body for each branch.
// We accept either a quoted string literal OR an inline JSX text occurrence
// (the JSX uses both — quoted in setter args, inline as element children).
for (const literal of [
  'Delete this plan?',
  'Remove from history?',
  'Leave this plan?',
  'Create your first plan',
  "Who's coming?",
  'No plans yet',
  'Welcome back',
  'Start a plan',
  'Solo',
  'Group',
]) {
  assert(jsx.includes(literal),
    `ScreenPlanList.jsx contains copy literal "${literal}"`);
}

// JOINED chip uses var(--sun)
assert(/Joined/.test(jsx) && /var\(--sun\)/.test(jsx),
  'ScreenPlanList.jsx renders the JOINED chip in var(--sun)');

// Empty state — must not render FAB
assert(/!isEmpty|isEmpty\s*\?[^:]*:[^}]*FloatingActionButton|isEmpty[\s\S]*FloatingActionButton/.test(jsx),
  'ScreenPlanList.jsx gates the FAB on !isEmpty (suppressed in empty state)');

// History collapsibility — state hook present
assert(/historyOpen|setHistoryOpen|React\.useState\(true\)/.test(jsx),
  'ScreenPlanList.jsx owns a history-collapsible state hook');

// No red anywhere in card / sheet styles — the JSX must not contain
// any red-ish hex or color name that would slip past the orphan-hex sweep.
const redHexes = jsx.match(/#(FF[0-3]{2}[0-3]{2}|[Ff][Ff][0-9A-Fa-f]{4})/g) || [];
const noRed = redHexes.every(h => {
  // Tokens.json has FFD23F (sun), FFB256 etc. — all warm yellows / coral. We just
  // ensure no rgb-style red literal sneaks in. The orphan-hex sweep is the
  // authoritative gate; this is a belt-and-braces check.
  return /^#FF[A-F89][0-9A-F]{3}$/i.test(h) || /^#FFD/i.test(h);
});
assert(noRed,
  'ScreenPlanList.jsx contains no obvious red hex literals (orphan sweep is the authoritative gate)');

// ── 3. C-25 + C-26 in components.jsx ──────────────────────
const componentsSrc = read(componentsJsx);
assert(/function\s+ActionDotMenuTrigger\s*\(/.test(componentsSrc),
  'components.jsx defines ActionDotMenuTrigger');
assert(/function\s+ActionDotMenu\s*\(/.test(componentsSrc),
  'components.jsx defines ActionDotMenu');
assert(/function\s+FloatingActionButton\s*\(/.test(componentsSrc),
  'components.jsx defines FloatingActionButton');
assert(/Object\.assign\(window,[\s\S]*ActionDotMenuTrigger[\s\S]*ActionDotMenu[\s\S]*FloatingActionButton/.test(componentsSrc),
  'components.jsx exports all three new primitives on window');

// FAB must be 56×56 per the spec
assert(/width:\s*56,\s*height:\s*56/.test(componentsSrc),
  'components.jsx FAB renders at 56×56 per the spec');
// FAB sun-yellow glyph
assert(/color:\s*['"]var\(--sun\)['"]/.test(componentsSrc),
  'components.jsx FAB uses var(--sun) for the glyph color');

// Menu must have role=menu / menuitem for accessibility
assert(/role=['"]menu['"]/.test(componentsSrc),
  'components.jsx ActionDotMenu has role="menu"');
assert(/role=['"]menuitem['"]/.test(componentsSrc),
  'components.jsx ActionDotMenu rows have role="menuitem"');

// ── 4. C-25 + C-26 in components.md ────────────────────────
const compMd = read(componentsMd);
assert(/##\s*C-25/.test(compMd),
  'components.md has a C-25 section');
assert(/Action Dot Menu/.test(compMd),
  'components.md C-25 is titled Action Dot Menu');
assert(/##\s*C-26/.test(compMd),
  'components.md has a C-26 section');
assert(/Floating Action Button/.test(compMd),
  'components.md C-26 is titled Floating Action Button');
assert(/(no red|never red|forbids red|no.*red)/i.test(compMd),
  'components.md C-25 documents the no-red rule for destructive items');

// ── 5. 00-landing.md — superseded with pointer ─────────────
const landing = read(oldLanding);
assert(/^---\r?\n[\s\S]*?status:\s*superseded/m.test(landing),
  '00-landing.md frontmatter status = superseded');
assert(/superseded-by:\s*00-plan-list/.test(landing),
  '00-landing.md frontmatter superseded-by = 00-plan-list');
assert(/SUPERSEDED/.test(landing),
  '00-landing.md carries an in-body SUPERSEDED banner');

// ── 6. README + CHANGELOG ──────────────────────────────────
const rm = read(readme);
assert(/00-plan-list\.md/.test(rm) && /ScreenPlanList\.jsx/.test(rm),
  'README.md code map references the new surface + screen');

const cl = read(changelog);
assert(/BREAKING:.*app entry surface|BREAKING:.*S00 Landing|BREAKING:.*Plan list/i.test(cl),
  'CHANGELOG.md carries the BREAKING entry for the S00 retirement');
assert(/sg-WF-4|00-plan-list|C-25|C-26/.test(cl),
  'CHANGELOG.md carries entries referencing sg-WF-4 / C-25 / C-26');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
