#!/usr/bin/env node
// sg-WF-2 — Quiz Back + Exit chrome structural test.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes the
// acceptance criteria of sg-WF-2 as structural assertions against the spec
// docs and the JSX, so the issue gets a real red→green TDD cycle.
//
// Run: node design-system/scripts/test-quiz-chrome.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const surfaceDoc = path.join(dsRoot, 'surfaces', '03-quiz.md');
const componentsJsx = path.join(dsRoot, 'code', 'components.jsx');
const screensDir = path.join(dsRoot, 'code', 'screens');

const screens = {
  Q1: 'ScreenQ1Vetoes.jsx',
  Q2: 'ScreenQ2Budget.jsx',
  Q3: 'ScreenQ3Distance.jsx',
  Q4: 'ScreenQ4Vibe.jsx',
  Q5: 'ScreenQ5Regret.jsx',
};

const failures = [];
const passes = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, label) {
  if (cond) passes.push(label);
  else failures.push(label);
}

// ── Surface doc assertions ─────────────────────────────────
const surface = read(surfaceDoc);

assert(
  /^##\s+Quiz chrome \(Back \+ Exit\)/m.test(surface),
  'surfaces/03-quiz.md has a `## Quiz chrome (Back + Exit)` section'
);

// Per-question render rules: Q1 omits Back
assert(
  /Q1[^\n]*(no|omits|never|without).*Back|Back[^\n]*Q2.*Q5|Back.*not.*Q1/.test(surface) ||
    /Q1[^\n]*Exit only/i.test(surface),
  'surfaces/03-quiz.md documents Q1 omits Back / Back is Q2–Q5 only'
);

// Role-conditional labels
assert(
  /initiator[\s\S]*Exit/i.test(surface) && /joiner[\s\S]*Leave/i.test(surface),
  'surfaces/03-quiz.md documents role-conditional labels (initiator → Exit, joiner → Leave)'
);

// Placement
assert(
  /top-leading[\s\S]*Back|Back[\s\S]*top-leading/.test(surface),
  'surfaces/03-quiz.md documents top-leading placement for Back'
);
assert(
  /top-trailing[\s\S]*Exit|Exit[\s\S]*top-trailing/.test(surface),
  'surfaces/03-quiz.md documents top-trailing placement for Exit/Leave'
);

// Treatment + tap target
assert(
  /eyebrow/i.test(surface) && /Inter\s*700/i.test(surface),
  'surfaces/03-quiz.md documents eyebrow treatment (Inter 700)'
);
assert(/44/.test(surface), 'surfaces/03-quiz.md documents 44pt tap target');
assert(/no icons|pure text/i.test(surface), 'surfaces/03-quiz.md documents no-icons / pure text labels');

// Confirmation copy variants — all three must appear verbatim
const exitInitiator = [
  'Exit this plan?',
  'Your answers will be discarded. Others can still finish without you.',
  'Keep going',
];
const leaveJoiner = [
  'Leave this plan?',
  'Your answers will be discarded. The host and others can still finish.',
];
const exitSolo = [
  'Your answers will be discarded. Your plan will stay saved so you can start over.',
];

for (const s of [...exitInitiator, ...leaveJoiner, ...exitSolo]) {
  assert(surface.includes(s), `surfaces/03-quiz.md contains confirmation string: "${s}"`);
}

// ── components.jsx — QuizChrome primitive ──────────────────
const componentsSrc = read(componentsJsx);
assert(
  /function\s+QuizChrome\s*\(/.test(componentsSrc),
  'components.jsx exports a QuizChrome function'
);
assert(
  /QuizChrome[,}]/.test(componentsSrc) && /Object\.assign\(window,\s*\{[\s\S]*QuizChrome/.test(componentsSrc),
  'components.jsx registers QuizChrome on window'
);

// ── Per-screen assertions ──────────────────────────────────
for (const [q, file] of Object.entries(screens)) {
  const src = read(path.join(screensDir, file));

  // QuizChrome is rendered on every quiz screen
  assert(/<QuizChrome\b/.test(src), `${file} (${q}) renders <QuizChrome>`);

  // Q1 must NOT render a Back affordance — QuizChrome on Q1 must declare back={false} or canBack={false}
  if (q === 'Q1') {
    assert(
      /<QuizChrome[^>]*\b(canBack|showBack|back)\s*=\s*\{?\s*false/.test(src),
      `${file} (Q1) suppresses Back affordance (canBack=false or showBack=false)`
    );
    // Also: Q1 must not pass an onBack handler
    assert(
      !/onBack\s*=/.test(src),
      `${file} (Q1) does not wire onBack`
    );
  } else {
    // Q2–Q5 must wire onBack
    assert(
      /onBack\s*=/.test(src),
      `${file} (${q}) wires onBack to QuizChrome`
    );
  }

  // Every screen wires onExit
  assert(
    /onExit\s*=/.test(src),
    `${file} (${q}) wires onExit to QuizChrome`
  );
}

// ── QuizChrome must support a `role` prop (initiator | joiner) and render Exit / Leave accordingly ──
assert(
  /role\s*=\s*['"]initiator['"]|role\s*===\s*['"]joiner['"]|role\s*===\s*['"]initiator['"]/.test(componentsSrc),
  'QuizChrome implementation switches label by role (Exit vs Leave)'
);
assert(
  /['"]Exit['"]/.test(componentsSrc) && /['"]Leave['"]/.test(componentsSrc),
  'QuizChrome implementation has both Exit and Leave labels'
);

// QuizChrome must render a confirmation dialog containing all three copy variants
for (const s of [...exitInitiator, ...leaveJoiner, ...exitSolo]) {
  assert(componentsSrc.includes(s), `components.jsx (QuizChrome) contains confirmation string: "${s}"`);
}

// 44pt minimum tap target — QuizChrome buttons must have minHeight ≥ 44
assert(
  /minHeight:\s*44/.test(componentsSrc),
  'QuizChrome buttons declare minHeight: 44'
);

// ── ScreenQ1 must NOT contain the word "Back" as a button label in JSX ──
const q1Src = read(path.join(screensDir, screens.Q1));
// The literal `Back` label must not appear as a button in the rendered tree.
// (It can appear in code comments, just not in any JSX child string.)
const q1Stripped = q1Src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
assert(
  !/>Back</.test(q1Stripped),
  'ScreenQ1Vetoes.jsx does not render the literal text "Back" as a button child'
);

// ── CHANGELOG entry ────────────────────────────────────────
const changelog = read(path.join(dsRoot, 'CHANGELOG.md'));
assert(
  /sg-WF-2/i.test(changelog) || /Quiz chrome \(Back \+ Exit\)/i.test(changelog) ||
    /Back\s*\+\s*Exit/i.test(changelog),
  'CHANGELOG.md carries an entry for the Quiz Back + Exit chrome'
);

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
