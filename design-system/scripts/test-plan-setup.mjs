#!/usr/bin/env node
// sg-WF-1 — Plan setup surface structural test.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes
// the acceptance criteria of sg-WF-1 as structural assertions against the
// spec doc, the JSX, and the surrounding bookkeeping, so the issue gets a
// real red→green TDD cycle (mirroring test-quiz-chrome.mjs from sg-WF-2).
//
// Run: node design-system/scripts/test-plan-setup.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const newSurface = path.join(dsRoot, 'surfaces', '01-setup.md');
const oldInitiator = path.join(dsRoot, 'surfaces', '01-initiator.md');
const oldParameters = path.join(dsRoot, 'surfaces', '01b-parameters.md');
const screenSetup = path.join(dsRoot, 'code', 'screens', 'ScreenSetup.jsx');
const componentsJsx = path.join(dsRoot, 'code', 'components.jsx');
const componentsMd = path.join(dsRoot, 'components.md');
const tokensJson = path.join(dsRoot, 'tokens.json');
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
assert(fs.existsSync(newSurface), 'surfaces/01-setup.md exists');

const surface = fs.existsSync(newSurface) ? read(newSurface) : '';

// Frontmatter
assert(/^---\r?\n[\s\S]*?surface:\s*01-setup/m.test(surface),
  '01-setup.md frontmatter: surface = 01-setup');
assert(/^---\r?\n[\s\S]*?status:\s*locked/m.test(surface),
  '01-setup.md frontmatter: status = locked');
assert(/locked-date:\s*2026-06-03/.test(surface),
  '01-setup.md frontmatter: locked-date = 2026-06-03');
assert(/jsx:[\s\S]*?-\s*code\/screens\/ScreenSetup\.jsx/.test(surface),
  '01-setup.md frontmatter claims code/screens/ScreenSetup.jsx');

// Five locked controls — every eyebrow must appear verbatim somewhere in the doc
for (const eyebrow of [
  'Name this plan',
  "Who's coming",
  'Search area',
  'When are you eating',
  'How you want to eat',
]) {
  assert(surface.includes(eyebrow),
    `01-setup.md mentions eyebrow "${eyebrow}"`);
}

// Defaults documented
for (const def of [
  /A group/,                    // group context default
  /Dinner/,                     // meal time default
  /Dine in/,                    // service shape default
]) {
  assert(def.test(surface), `01-setup.md documents default matching ${def}`);
}

// Headline + body copy — both modes
assert(surface.includes('Start a new plan'),
  '01-setup.md contains create-mode headline "Start a new plan"');
assert(surface.includes('Edit your plan'),
  '01-setup.md contains edit-mode headline "Edit your plan"');
assert(surface.includes("One screen. Set it once. Share when you're ready."),
  '01-setup.md contains body copy');

// Dock CTAs
assert(surface.includes('SAVE FOR LATER'),
  '01-setup.md documents create-mode secondary "SAVE FOR LATER"');
assert(surface.includes('SAVE CHANGES'),
  '01-setup.md documents edit-mode secondary "SAVE CHANGES"');
assert(surface.includes('Drop the invite link'),
  '01-setup.md documents primary "Drop the invite link"');
assert(surface.includes('Start the quiz'),
  '01-setup.md documents primary "Start the quiz" (solo branch)');

// Validation rules
assert(/required/i.test(surface) && /name/i.test(surface),
  '01-setup.md documents name-required validation');
assert(/40[\s-]?char/i.test(surface),
  '01-setup.md documents 40-char cap');

// Search area semantics
assert(/C-28\s+SearchAreaPicker/.test(surface),
  '01-setup.md documents C-28 SearchAreaPicker as active geography');
assert(/Set search area/.test(surface) && /Search area - N\.N mi/.test(surface),
  '01-setup.md documents Search area chip empty and committed copy');
assert(/distance from the map camera center to the nearest visible map edge/i.test(surface),
  '01-setup.md documents viewport-derived Search area radius');
assert(/USE THIS AREA/.test(surface) && /dirty close/i.test(surface),
  '01-setup.md documents explicit commit and dirty close prompt');

// Mode prop is documented
assert(/`mode`/.test(surface) && /create/.test(surface) && /edit/.test(surface),
  '01-setup.md documents the `mode` prop with create/edit values');

// Spec exception — must reference S01-initiator's "name your night" defense and
// must declare an override (not silently re-introduce it).
assert(/name.your.night/i.test(surface) || /pre-commitment/i.test(surface),
  '01-setup.md acknowledges the S01-initiator anti-pre-commitment defense');
assert(/override|exception|defends against/i.test(surface),
  '01-setup.md flags the override as a spec exception');

// ── 2. ScreenSetup.jsx — structural assertions ─────────────
assert(fs.existsSync(screenSetup), 'code/screens/ScreenSetup.jsx exists');

const jsx = fs.existsSync(screenSetup) ? read(screenSetup) : '';

assert(/function\s+ScreenSetup\s*\(/.test(jsx),
  'ScreenSetup.jsx defines a ScreenSetup function');
assert(/Object\.assign\(window,\s*\{[\s\S]*ScreenSetup/.test(jsx),
  'ScreenSetup.jsx registers ScreenSetup on window');

// Mode prop — single component drives both modes
assert(/mode\s*=\s*['"]create['"]/.test(jsx) || /mode\s*=\s*['"]edit['"]/.test(jsx) ||
       /mode\s*=\s*['"]\w+['"]/.test(jsx),
  'ScreenSetup.jsx accepts a `mode` prop with a string default');
assert(/['"]Edit your plan['"]/.test(jsx) && /['"]Start a new plan['"]/.test(jsx),
  'ScreenSetup.jsx switches headline by mode (both literal strings present)');
assert(/['"]SAVE FOR LATER['"]/.test(jsx) && /['"]SAVE CHANGES['"]/.test(jsx),
  'ScreenSetup.jsx switches secondary CTA by mode');

// Composition
assert(/<SearchAreaPickerChip\b/.test(jsx),
  'ScreenSetup.jsx uses the C-28 SearchAreaPickerChip');
assert(!/<LocationPickerChip\b/.test(jsx),
  'ScreenSetup.jsx no longer uses the historical C-23 LocationPickerChip for active Setup');
assert(/<Chip\b/.test(jsx),
  'ScreenSetup.jsx uses the existing C-04 Chip');
assert(!/<RangeSlider\b/.test(jsx),
  'ScreenSetup.jsx no longer renders the separate C-21 RangeSlider for active Setup');
assert(/<PillCTA\b/.test(jsx),
  'ScreenSetup.jsx uses the C-05 PillCTA');
assert(/<CTADock\b/.test(jsx),
  'ScreenSetup.jsx uses the CTADock layout helper');
assert(/<GradientSurface[^>]*stop=['"]initiator['"]/.test(jsx),
  'ScreenSetup.jsx renders on the initiator gradient surface');

assert(/initialSearchArea/.test(jsx),
  'ScreenSetup.jsx accepts an initialSearchArea prop');

// Chip options — all locked options for each group must appear as literals
for (const opt of ['Just me', 'Two of us', 'A group',
                   'Breakfast', 'Lunch', 'Dinner', 'Late night',
                   'Dine in', 'Outdoor seating', 'Takeout', 'Delivery']) {
  assert(jsx.includes(`'${opt}'`) || jsx.includes(`"${opt}"`),
    `ScreenSetup.jsx contains chip option literal "${opt}"`);
}

// Validation — name gates both CTAs
assert(/name\.trim\(\)\.length\s*>\s*0|nameValid|name\.trim\(\)\.length\s*===\s*0|!name\.trim/.test(jsx),
  'ScreenSetup.jsx gates CTAs on name.trim().length');
assert(/maxLength=\{?40\}?/.test(jsx),
  'ScreenSetup.jsx enforces 40-char input cap');

// Solo / group primary label switch
assert(/['"]Start the quiz['"]/.test(jsx) && /['"]Drop the invite link['"]/.test(jsx),
  'ScreenSetup.jsx switches primary CTA label between group and solo');

// ── 3. RangeSlider variant — non-uniform steps + tickAt props ──
const componentsSrc = read(componentsJsx);
assert(/function\s+RangeSlider\s*\([^)]*\bsteps\b[^)]*\)/.test(componentsSrc),
  'components.jsx RangeSlider accepts a `steps` prop');
assert(/function\s+RangeSlider\s*\([^)]*\btickAt\b[^)]*\)/.test(componentsSrc),
  'components.jsx RangeSlider accepts a `tickAt` prop');
// Backward-compat — old min/max/step API must still be there
assert(/function\s+RangeSlider\s*\([^)]*\bmin\b[^)]*\bmax\b[^)]*\bstep\b[^)]*\)/.test(componentsSrc),
  'components.jsx RangeSlider preserves the uniform min/max/step API');
// Snap behavior — there must be a Math.abs or "nearest" snap operation
assert(/Math\.abs\([\s\S]*steps\b|bestDelta|snap/i.test(componentsSrc),
  'components.jsx RangeSlider snaps to nearest entry when `steps` is supplied');
// Tick render — there must be a slider.tick color usage (the white-0.55 rgba is shared
// with chip outline, so check for the dimensions of the tick instead: 2 × 10)
assert(/width:\s*2[^A-Za-z0-9]\s*,?\s*height:\s*10/.test(componentsSrc),
  'components.jsx RangeSlider renders a 2 × 10 tick when tickAt is present');

// ── 4. Components.md — variant documented ──────────────────
const compMd = read(componentsMd);
assert(/##\s*C-21/.test(compMd), 'components.md has a C-21 section');
assert(/Non-uniform|non-uniform/.test(compMd),
  'components.md C-21 documents the non-uniform-step variant');
assert(/tickAt|anchor tick/.test(compMd),
  'components.md C-21 documents the tickAt prop');
assert(/color\.slider\.tick|slider\.tick/.test(compMd),
  'components.md C-21 references the new color.slider.tick token');
assert(/##\s*C-28\b[\s\S]*SearchAreaPicker/.test(compMd),
  'components.md has a C-28 SearchAreaPicker section');
assert(/historical|superseded/i.test(compMd) && /active Setup/i.test(compMd),
  'components.md marks C-23 historical/superseded for active Setup use');

// ── 5. tokens.json — new color.slider.tick token ───────────
const tokens = JSON.parse(read(tokensJson));
assert(tokens.color && tokens.color.slider && tokens.color.slider.tick,
  'tokens.json registers color.slider.tick');
assert(typeof tokens.color?.slider?.tick === 'string' &&
       /rgba?\(/.test(tokens.color.slider.tick),
  'tokens.json color.slider.tick is an rgba value');

// ── 6. Superseded surfaces — frontmatter + banner ──────────
const initiator = read(oldInitiator);
const parameters = read(oldParameters);

assert(/^---\r?\n[\s\S]*?status:\s*superseded/m.test(initiator),
  '01-initiator.md frontmatter status = superseded');
assert(/superseded-by:\s*01-setup/.test(initiator),
  '01-initiator.md frontmatter superseded-by = 01-setup');
assert(/SUPERSEDED/.test(initiator),
  '01-initiator.md carries an in-body SUPERSEDED banner');

assert(/^---\r?\n[\s\S]*?status:\s*superseded/m.test(parameters),
  '01b-parameters.md frontmatter status = superseded');
assert(/superseded-by:\s*01-setup/.test(parameters),
  '01b-parameters.md frontmatter superseded-by = 01-setup');
assert(/SUPERSEDED/.test(parameters),
  '01b-parameters.md carries an in-body SUPERSEDED banner');

// ── 7. README + CHANGELOG — code map + changelog entry ─────
const rm = read(readme);
assert(/01-setup\.md/.test(rm) && /ScreenSetup\.jsx/.test(rm),
  'README.md code map references the new surface + screen');

const cl = read(changelog);
assert(/01-setup|Plan setup|sg-WF-1/.test(cl),
  'CHANGELOG.md carries an entry for sg-WF-1 / Plan setup');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
