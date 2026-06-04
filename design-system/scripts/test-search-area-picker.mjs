#!/usr/bin/env node
// sg-SA-1 - SearchAreaPicker design-system structural test.
//
// The design-system verifier checks drift, token registration, and surface/JSX
// pairing. This script pins the SearchAreaPicker acceptance criteria that live
// in prose and canonical JSX so the spec change gets a real red-green cycle.
//
// Run: node design-system/scripts/test-search-area-picker.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const componentsMdPath = path.join(dsRoot, 'components.md');
const setupPath = path.join(dsRoot, 'surfaces', '01-setup.md');
const componentsJsxPath = path.join(dsRoot, 'code', 'components.jsx');
const setupJsxPath = path.join(dsRoot, 'code', 'screens', 'ScreenSetup.jsx');
const readmePath = path.join(dsRoot, 'README.md');
const accessibilityPath = path.join(dsRoot, 'accessibility.md');
const motionPath = path.join(dsRoot, 'motion.md');
const changelogPath = path.join(dsRoot, 'CHANGELOG.md');

const passes = [];
const failures = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, label) {
  if (cond) passes.push(label);
  else failures.push(label);
}

function section(text, headingRe) {
  const match = headingRe.exec(text);
  if (!match) return '';
  const start = match.index;
  const rest = text.slice(start + match[0].length);
  const next = rest.search(/\n##\s+C-\d+/);
  return text.slice(start, next === -1 ? text.length : start + match[0].length + next);
}

const componentsMd = read(componentsMdPath);
const setup = read(setupPath);
const componentsJsx = read(componentsJsxPath);
const setupJsx = read(setupJsxPath);
const readme = read(readmePath);
const accessibility = read(accessibilityPath);
const motion = read(motionPath);
const changelog = read(changelogPath);

const c28 = section(componentsMd, /^##\s+C-28\b.*SearchAreaPicker.*$/m);
const c23 = section(componentsMd, /^##\s+C-23\b.*LocationPicker.*$/m);

assert(Boolean(c28), 'components.md documents C-28 SearchAreaPicker');
assert(/active Setup geography primitive/i.test(c28),
  'C-28 is named as the active Setup geography primitive');
assert(/Search area chip/i.test(c28) && /full-screen\s+\**Search area editor/i.test(c28),
  'C-28 includes the compact chip and full-screen editor');

for (const marker of [
  /full-screen map/i,
  /close|back/i,
  /top search field/i,
  /current-location button/i,
  /selected circle/i,
  /radius badge/i,
  /minus/i,
  /plus/i,
  /USE THIS AREA/,
  /dirty close prompt/i,
]) {
  assert(marker.test(c28), `C-28 editor contract includes ${marker}`);
}

assert(/distance from the map camera center to the nearest visible map edge/i.test(c28),
  'C-28 defines radius from camera center to nearest visible map edge');
assert(/Search area jump/i.test(c28) && /recenter/i.test(c28) && /without committing/i.test(c28),
  'C-28 defines Search area jump as recentering without committing');
assert(/Density preview pins/i.test(c28) && /food\/dining|food and dining/i.test(c28),
  'C-28 documents Density preview pins as broad food/dining feedback');
assert(/inside the selected circle/i.test(c28) && /around 20/i.test(c28) &&
       /non-interactive/i.test(c28) && /non-blocking/i.test(c28),
  'C-28 pins are inside-circle, capped around 20, non-interactive, and non-blocking');
assert(/no timezone or timing semantics/i.test(c28),
  'C-28 explicitly has no timezone or timing semantics');

assert(Boolean(c23), 'components.md retains the C-23 LocationPicker section');
assert(/historical|superseded/i.test(c23) && /active Setup/i.test(c23),
  'C-23 is marked historical/superseded for active Setup use');

assert(/Search area/i.test(setup) && /C-28\s+SearchAreaPicker/i.test(setup),
  'S01 Setup references C-28 SearchAreaPicker');
assert(/Locked inventory[\s\S]*Search area/i.test(setup),
  'S01 locked inventory includes one Search area row');
assert(!/^\|\s*3\s*\|\s*`Where to`/m.test(setup) &&
       !/^\|\s*6\s*\|\s*`How far`/m.test(setup),
  'S01 locked inventory no longer has separate Where to and How far rows');
assert(!/Where the LocationPicker lives/i.test(setup),
  'S01 removes the active LocationPicker placement section');
assert(!/Distance slider - C-21 variant/i.test(setup),
  'S01 removes the active distance slider section');
assert(/USE THIS AREA/.test(setup) && /dirty close/i.test(setup),
  'S01 documents explicit commit and dirty close behavior');
assert(/no timezone or timing semantics/i.test(setup),
  'S01 states Search area has no timezone or timing semantics');

assert(/function\s+SearchAreaPickerChip\s*\(/.test(componentsJsx),
  'components.jsx exports SearchAreaPickerChip');
assert(/function\s+SearchAreaEditor\s*\(/.test(componentsJsx),
  'components.jsx exports SearchAreaEditor');
assert(/Object\.assign\(window,\s*\{[\s\S]*SearchAreaPickerChip[\s\S]*SearchAreaEditor/.test(componentsJsx),
  'components.jsx registers C-28 exports on window');

assert(/<SearchAreaPickerChip\b/.test(setupJsx),
  'ScreenSetup.jsx uses SearchAreaPickerChip');
assert(!/<LocationPickerChip\b/.test(setupJsx),
  'ScreenSetup.jsx no longer uses LocationPickerChip for active Setup geography');
assert(!/<RangeSlider\b/.test(setupJsx) && !/DISTANCE_STEPS/.test(setupJsx),
  'ScreenSetup.jsx no longer renders the separate How far RangeSlider');

assert(/C-01.*C-28|C-01.*C-28/s.test(readme),
  'README component inventory reaches C-28');
assert(/SearchAreaPicker chip|SearchAreaPicker editor/i.test(accessibility),
  'accessibility.md covers C-28 tap targets and labels');
assert(/SearchAreaPicker/i.test(motion),
  'motion.md covers C-28 utility motion');
assert(/sg-SA-1|SearchAreaPicker/.test(changelog),
  'CHANGELOG.md carries an sg-SA-1 SearchAreaPicker entry');

for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
