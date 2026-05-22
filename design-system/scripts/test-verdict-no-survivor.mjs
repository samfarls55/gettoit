#!/usr/bin/env node
// sg-WF-9 — web-01 §C no-survivor verdict-card spec-gap structural test.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing, and its web-invitee-doc
// check tests for the five locked surfaces by fixed marker strings only, so
// it cannot catch a missing §C variant. This script encodes the sg-WF-9
// acceptance criteria as structural assertions against the amended §C spec,
// giving the spec-only issue a real red→green TDD cycle (mirroring
// test-account-claim.mjs from sg-WF-8).
//
// sg-WF-9 is a spec-only amendment: §C ("Read-only verdict card") of
// web-01-invitee-shell.md was specced for the venue case only and has no
// `no_survivor` variant, though a decided no-survivor plan is a real,
// reachable state that §B resume routing lands on §C. This amendment adds
// the no-survivor variant — codifying the interim treatment bug-17 ships in
// web code so the spec and the web code describe the same surface.
//
// Run: node design-system/scripts/test-verdict-no-survivor.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const webInviteeSurface = path.join(dsRoot, 'surfaces', 'web-01-invitee-shell.md');
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

// Isolate §C ("Read-only verdict card") so the assertions test the
// no-survivor variant inside §C specifically — not a stray match from §A,
// §B, §D, §E or the sg-WF-8 mint section further down the file.
function sectionC(text) {
  const start = text.search(/^##\s+C\s+·\s+Read-only verdict card/m);
  if (start === -1) return '';
  const rest = text.slice(start + 1);
  const nextHeading = rest.search(/^##\s+/m);
  return nextHeading === -1 ? text.slice(start) : text.slice(start, start + 1 + nextHeading);
}

// ── 1. web-01 §C — the no-survivor variant exists ───────────
assert(fs.existsSync(webInviteeSurface), 'surfaces/web-01-invitee-shell.md exists');
const web = fs.existsSync(webInviteeSurface) ? read(webInviteeSurface) : '';
const cSection = sectionC(web);

assert(cSection.length > 0,
  'web-01-invitee-shell.md has a §C "Read-only verdict card" section');

// §C must explicitly address the no_survivor verdict method as a variant.
assert(/no.?survivor/i.test(cSection),
  '§C documents a no-survivor variant');
assert(/no_survivor/.test(cSection),
  '§C names the engine `no_survivor` verdict method');
assert(/(variant|case|mode)/i.test(cSection) && /no.?survivor/i.test(cSection),
  '§C frames no-survivor as an explicit variant / case of the card');

// ── 2. The no-survivor card copy ────────────────────────────
// The variant matches bug-17's interim treatment: plan name + a single
// "No spot fits" card in the venue slot.
assert(/No spot fits/.test(cSection),
  '§C no-survivor variant uses the "No spot fits" card copy');
assert(/(plan name|plan's name)/i.test(cSection),
  '§C no-survivor variant keeps the plan name');

// ── 3. No votes-derived meta line ───────────────────────────
// `votes` is ephemeral and gone by decided-time — the same rule §C's
// venue case already states. The no-survivor variant must say so too.
assert(/(no votes-derived|no votes derived|no hard-needs|no hard needs|no meta line|no votes-derived meta)/i.test(cSection),
  '§C no-survivor variant states there is no votes-derived meta / hard-needs line');
assert(/ephemeral/i.test(cSection),
  '§C explains `votes` is ephemeral by decided-time');

// ── 4. The eyebrow is decided ───────────────────────────────
// The issue requires §C to decide the eyebrow for the no-survivor case.
assert(/eyebrow/i.test(cSection),
  '§C no-survivor variant addresses the eyebrow');

// ── 5. No primary CTA; "Getting the app?" mint line retained ─
assert(/no primary CTA/i.test(cSection),
  '§C no-survivor variant explicitly states no primary CTA');
assert(/Getting the app\?/.test(cSection),
  '§C no-survivor variant retains the "Getting the app?" mint line');

// ── 6. Same minimal register — a read, not the full S05 ─────
assert(/(read, not the full|not the full S05|minimal register|same minimal)/i.test(cSection),
  '§C no-survivor variant keeps the minimal "this is a read" register');

// ── 7. Attribution + cross-reference ────────────────────────
assert(/sg-WF-9/.test(cSection) || /sg-WF-9/.test(web),
  'web-01-invitee-shell.md attributes the no-survivor variant to sg-WF-9');
assert(/bug-17/i.test(cSection),
  '§C references bug-17 (the web code that ships the interim variant)');

// ── 8. No new token / component ─────────────────────────────
// The no-survivor variant must compose from existing primitives only —
// §C already states this for its venue case; the variant inherits it.
assert(/no new (token|component)/i.test(web),
  'web-01-invitee-shell.md states the no-survivor variant adds no new token / component');

// ── 9. CHANGELOG ────────────────────────────────────────────
const cl = read(changelog);
assert(/sg-WF-9/.test(cl),
  'CHANGELOG.md carries an entry referencing sg-WF-9');
assert(/no.?survivor/i.test(cl),
  'CHANGELOG.md describes the no-survivor variant amendment');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
