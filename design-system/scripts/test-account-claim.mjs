#!/usr/bin/env node
// sg-WF-8 — Account-claim design-system amendment structural test.
//
// The design-system has no behavioral test framework — `verify.mjs` covers
// drift gates, orphan-hex, and surface↔jsx pairing. This script encodes
// the acceptance criteria of sg-WF-8 as structural assertions against the
// amended spec docs + JSX, so the issue gets a real red→green TDD cycle
// (mirroring test-plan-list.mjs from sg-WF-4 and test-plan-setup.mjs from
// sg-WF-1).
//
// sg-WF-8 is a spec-only amendment (no wiring): it adds the S00a
// "Voted on the web?" account-claim affordance + code-entry state + TTL-
// honest teaching copy, and the low-key "Getting the app?" mint affordance
// (+ its revealed code/instructions state) on the web invitee Waiting
// screen (web-01 §B) and read-only verdict card (web-01 §C).
//
// Run: node design-system/scripts/test-account-claim.mjs
// Exit 0 = pass, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');

const signinSurface = path.join(dsRoot, 'surfaces', '00a-signin.md');
const webInviteeSurface = path.join(dsRoot, 'surfaces', 'web-01-invitee-shell.md');
const screenSignIn = path.join(dsRoot, 'code', 'screens', 'ScreenSignIn.jsx');
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

// ── 1. S00a surface doc — "Voted on the web?" account-claim ──
assert(fs.existsSync(signinSurface), 'surfaces/00a-signin.md exists');
const signin = fs.existsSync(signinSurface) ? read(signinSurface) : '';

// The secondary affordance — quiet, secondary, beneath the SiwA pill.
assert(/Voted on the web\?/.test(signin),
  '00a-signin.md documents the "Voted on the web?" secondary affordance');
assert(/secondary/i.test(signin) && /(quiet|low-key|low key)/i.test(signin),
  '00a-signin.md frames the affordance as quiet + secondary (not competing with the pill)');
assert(/(beneath|below).*(Sign.?in.with.Apple|pill|Apple)/i.test(signin),
  '00a-signin.md places the affordance beneath the Sign-in-with-Apple pill');
assert(/(ignore|ignores|friction)/i.test(signin),
  '00a-signin.md notes the fresh-install user ignores it without friction');

// The code-entry state it reveals — single code input + CTA.
assert(/code.?entry/i.test(signin),
  '00a-signin.md documents the code-entry state the affordance reveals');
assert(/(code field|code input|claim.?code field|claim.?code input)/i.test(signin),
  '00a-signin.md documents a single claim-code input');
assert(/claim code/i.test(signin),
  '00a-signin.md uses the canonical "claim code" term');

// TTL-honest teaching copy — ADR 0006 ~30-day anonymous-identity TTL.
assert(/30.?day/i.test(signin),
  '00a-signin.md teaching copy is honest about the ~30-day anonymous-identity TTL');
assert(/ADR 0006|0006-privacy-posture/i.test(signin),
  '00a-signin.md references ADR 0006 (the 30-day TTL source)');
assert(/recent web Plans?/i.test(signin),
  '00a-signin.md frames recovery as "bring back your recent web Plans" (TTL-honest)');
assert(!/recover all your history/i.test(signin),
  '00a-signin.md never over-promises "recover all your history"');
// Teaching copy for a user who does not yet have a code.
assert(/(generate|mint).*(code|link)/i.test(signin),
  '00a-signin.md teaches how to generate a code from a prior web link');

// No new component / token invented — must use existing primitives.
assert(/no new (component|token)/i.test(signin),
  '00a-signin.md explicitly states no new component / token');
assert(/ADR 0015|0015-web-invitee-account-claim/i.test(signin),
  '00a-signin.md references ADR 0015 (the claim-code bridge architecture)');

// ── 2. ScreenSignIn.jsx — code-entry state ──────────────────
assert(fs.existsSync(screenSignIn), 'code/screens/ScreenSignIn.jsx exists');
const jsx = fs.existsSync(screenSignIn) ? read(screenSignIn) : '';

assert(/function\s+ScreenSignIn\s*\(/.test(jsx),
  'ScreenSignIn.jsx still defines a ScreenSignIn function');
assert(/Object\.assign\(window,\s*\{[\s\S]*ScreenSignIn/.test(jsx),
  'ScreenSignIn.jsx still registers ScreenSignIn on window');

// The two-state contract — the surface owns a default state and a
// revealed code-entry state. A prop drives it (spec-only; no wiring).
assert(/claim/i.test(jsx),
  'ScreenSignIn.jsx renders the account-claim affordance');
assert(/Voted on the web\?/.test(jsx),
  'ScreenSignIn.jsx contains the "Voted on the web?" affordance label');

// The code input — single field, reuses the soft-glass input pattern.
assert(/<input\b/.test(jsx),
  'ScreenSignIn.jsx renders a code input field');
assert(/claimCode|codeValue|onClaimCode|codeEntry/i.test(jsx),
  'ScreenSignIn.jsx exposes claim-code props (spec-only, caller wires them)');

// The code-entry CTA reuses the existing PillCTA.
assert(/<PillCTA\b/.test(jsx),
  'ScreenSignIn.jsx still composes the existing PillCTA primitive');

// No new component invented inside the screen.
assert(!/function\s+(ClaimCode|CodeEntry|CodeField)/.test(jsx),
  'ScreenSignIn.jsx defines no new component (uses existing primitives only)');

// TTL-honest teaching copy present in the JSX itself.
assert(/recent web Plans?/i.test(jsx),
  'ScreenSignIn.jsx code-entry copy says "recent web Plans" (TTL-honest)');
assert(!/recover all your history/i.test(jsx),
  'ScreenSignIn.jsx never over-promises "recover all your history"');

// ── 3. web-01 invitee shell — "Getting the app?" mint ───────
assert(fs.existsSync(webInviteeSurface), 'surfaces/web-01-invitee-shell.md exists');
const web = fs.existsSync(webInviteeSurface) ? read(webInviteeSurface) : '';

// The low-key mint affordance — quiet line, not a banner, not a hard upsell.
assert(/Getting the app\?/.test(web),
  'web-01-invitee-shell.md documents the "Getting the app?" mint affordance');
assert(/(quiet line|low-key|low key)/i.test(web),
  'web-01-invitee-shell.md frames the affordance as a quiet, low-key line');
assert(/(not a banner|never a banner)/i.test(web),
  'web-01-invitee-shell.md states the affordance is not a banner');
assert(/(not|no|never)\s+a?\s*hard\s+upsell/i.test(web),
  'web-01-invitee-shell.md states the affordance is not a hard upsell');
assert(/plumbing, not a growth surface|plumbing-not-growth/i.test(web),
  'web-01-invitee-shell.md keeps the web-invitee §Q7 plumbing-not-growth lock');

// The revealed state — displayed claim code + instructions to S00a entry.
assert(/claim code/i.test(web),
  'web-01-invitee-shell.md uses the canonical "claim code" term');
assert(/Voted on the web\?/.test(web),
  'web-01-invitee-shell.md points the revealed instructions at the S00a "Voted on the web?" entry');
assert(/(reveal|revealed|shown after the tap|after the tap)/i.test(web),
  'web-01-invitee-shell.md documents the revealed (post-tap) state');

// Lazy mint — minted on the affordance tap, not eagerly.
assert(/(lazy|lazily)/i.test(web) && /mint/i.test(web),
  'web-01-invitee-shell.md documents the lazy mint (code generated on tap)');

// The affordance lands on BOTH the Waiting screen AND the read-only
// verdict card — never on the closed terminal, never on the quiz.
assert(/Waiting/i.test(web),
  'web-01-invitee-shell.md carries the mint affordance on the Waiting screen (§B)');
assert(/read-only verdict card/i.test(web),
  'web-01-invitee-shell.md carries the mint affordance on the read-only verdict card (§C)');
// It must NOT appear on the closed terminal (§D) or quiz (§E) — the doc
// must say so explicitly so a future reader does not add it there.
assert(/(not|never|off).{0,40}(closed|terminal)/i.test(web),
  'web-01-invitee-shell.md states the mint affordance is off the closed terminal');

// References to the governing decision doc + ADR.
assert(/ADR 0015|0015-web-invitee-account-claim/i.test(web),
  'web-01-invitee-shell.md references ADR 0015 (the claim-code bridge)');
assert(/sg-WF-8/.test(web),
  'web-01-invitee-shell.md attributes the amendment to sg-WF-8');

// No new token / component — the mint affordance reuses existing tokens.
assert(/no new (token|component)/i.test(web),
  'web-01-invitee-shell.md states the mint affordance adds no new token / component');

// ── 4. CHANGELOG ────────────────────────────────────────────
const cl = read(changelog);
assert(/sg-WF-8/.test(cl),
  'CHANGELOG.md carries an entry referencing sg-WF-8');
assert(/Voted on the web\?|account.?claim|claim code/i.test(cl),
  'CHANGELOG.md describes the account-claim amendment');

// ── Report ─────────────────────────────────────────────────
for (const p of passes) console.log(`  ok  ${p}`);
for (const f of failures) console.error(`fail  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
