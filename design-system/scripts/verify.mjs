#!/usr/bin/env node
// GetToIt — Sunset Pop · verify design system invariants
// Run: node design-system/scripts/verify.mjs
//
// Checks:
//   1. tokens.json parses and has required top-level keys
//   2. code/tokens.css matches what gen-css.mjs would emit  (drift gate)
//   3. Every hex color in code/components.jsx + code/screens/*.jsx is registered in tokens.json
//      (orphan-hex sweep — proves screens don't sneak unregistered colors past the spec)
//   4. Every hex color in web/ TS/TSX/CSS source is registered in tokens.json
//      (TB-15 — mirrors the design-system sweep against the Next.js fallback)
//   5. Every surface doc (surfaces/0N-*.md) has frontmatter listing the JSX it owns, every
//      JSX in code/screens/ is claimed by exactly one surface doc (no orphan/double-claim)
//   6. The web invitee shell surface doc (surfaces/web-NN-*.md) exists and covers all
//      five locked surfaces/states (sg-WF-5 — web-only spec, no paired JSX in this repo)
//
// Exit code 0 = clean, 1 = any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(dsRoot, '..');
const tokensPath = path.join(dsRoot, 'tokens.json');
const cssPath = path.join(dsRoot, 'code', 'tokens.css');
const componentsPath = path.join(dsRoot, 'code', 'components.jsx');
const screensDir = path.join(dsRoot, 'code', 'screens');
const surfacesDir = path.join(dsRoot, 'surfaces');
const webRoot = path.join(repoRoot, 'web');

const failures = [];
const notes = [];
const hexRe = /#[0-9A-Fa-f]{6}\b/g;

// ── 1. tokens.json shape ───────────────────────────────────
let tokens;
try {
  tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
} catch (e) {
  failures.push(`tokens.json: ${e.message}`);
  finish();
}

const requiredKeys = ['color', 'gradient', 'typography', 'spacing', 'radii', 'motion', 'texture', 'vibe-labels'];
for (const k of requiredKeys) {
  if (!(k in tokens)) failures.push(`tokens.json: missing top-level key "${k}"`);
}
const requiredSurfaces = ['initiator', 'q1', 'q2', 'q3', 'q4', 'q5', 'waiting', 'verdict', 'checkin', 'midnight'];
for (const s of requiredSurfaces) {
  const stops = tokens.gradient?.surfaces?.[s];
  if (!Array.isArray(stops) || stops.length !== 4) {
    failures.push(`tokens.json: gradient.surfaces.${s} must be a 4-element array`);
  }
}

// ── 2. CSS drift gate ──────────────────────────────────────
const genPath = path.join(__dirname, 'gen-css.mjs');
const proc = spawnSync(process.execPath, [genPath, '--check'], { encoding: 'utf8' });
if (proc.status !== 0) {
  failures.push(`code/tokens.css drift: regenerate via "node design-system/scripts/gen-css.mjs"`);
  if (proc.stderr) notes.push(proc.stderr.trim());
} else {
  notes.push(`drift-check: code/tokens.css matches tokens.json`);
}

// ── 2b. Swift drift gate ───────────────────────────────────
const genSwiftPath = path.join(__dirname, 'gen-swift.mjs');
const swiftProc = spawnSync(process.execPath, [genSwiftPath, '--check'], { encoding: 'utf8' });
if (swiftProc.status !== 0) {
  failures.push(`ios/Sources/GTITokens.swift drift: regenerate via "node design-system/scripts/gen-swift.mjs"`);
  if (swiftProc.stderr) notes.push(swiftProc.stderr.trim());
} else {
  notes.push(`drift-check: ios/Sources/GTITokens.swift matches tokens.json`);
}

// ── 3. Orphan-hex sweep ────────────────────────────────────
const registered = collectRegisteredHex(tokens);

const jsxFiles = [componentsPath, ...listJsx(screensDir)];
const orphansByFile = {};

for (const f of jsxFiles) {
  const src = fs.readFileSync(f, 'utf8');
  // strip block + line comments so commentary hex doesn't false-positive
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const matches = stripped.match(hexRe) || [];
  const orphans = [...new Set(matches.map(h => h.toUpperCase()))]
    .filter(h => !registered.has(h));
  if (orphans.length) orphansByFile[path.relative(dsRoot, f)] = orphans;
}

if (Object.keys(orphansByFile).length) {
  for (const [f, hexes] of Object.entries(orphansByFile)) {
    failures.push(`orphan hex in ${f}: ${hexes.join(', ')}  — add to tokens.json or replace with a registered token`);
  }
} else {
  notes.push(`orphan-hex sweep: all JSX hex codes registered in tokens.json`);
}

// ── 3b. Orphan-hex sweep over web/ (TB-15) ────────────────
//
// The Next.js fallback consumes design-system/code/tokens.css directly
// but re-implements components (no JSX import per ADR 0003). Mirror
// the JSX sweep against the web source tree so we catch any hex
// codes that slip past the token contract on the web side.
const webFiles = fs.existsSync(webRoot)
  ? listSourceFiles(webRoot, new Set(['node_modules', '.next', 'public']),
      f => /\.(tsx?|jsx?|css|module\.css)$/.test(f))
  : [];
const webOrphansByFile = {};
for (const f of webFiles) {
  const src = fs.readFileSync(f, 'utf8');
  // Strip CSS + JS comments — same approach as the JSX sweep, plus
  // CSS-only `/* … */` blocks already handled by the block-comment
  // regex. Strip single-quoted/double-quoted import paths to avoid
  // false positives from URLs like `#anchor`. (Hex colors are 6 chars
  // bordered by non-hex; importantly we only strip line/block comments.)
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const matches = stripped.match(hexRe) || [];
  const orphans = [...new Set(matches.map(h => h.toUpperCase()))]
    .filter(h => !registered.has(h));
  if (orphans.length) webOrphansByFile[path.relative(repoRoot, f)] = orphans;
}
if (Object.keys(webOrphansByFile).length) {
  for (const [f, hexes] of Object.entries(webOrphansByFile)) {
    failures.push(`orphan hex in ${f}: ${hexes.join(', ')}  — add to tokens.json or replace with a registered token`);
  }
} else if (webFiles.length > 0) {
  notes.push(`web/ orphan-hex sweep: ${webFiles.length} source files clean against tokens.json`);
}

// ── 4. Surface ↔ JSX pairing ───────────────────────────────
// Surface filename pattern: NN-slug.md or NN<letter>-slug.md
// (the letter suffix lets pre-flow surfaces like 00a-signin / 00b-location-permission
// sit before the existing 01–09 ritual arc without renumbering everything).
const surfaceDocs = fs.existsSync(surfacesDir)
  // Surface filenames are `NN-slug.md` (numbered into the ritual arc) or
  // `NNx-slug.md` (pre-flow / out-of-arc surfaces — `00a-signin`,
  // `00b-location-permission`, etc.) where `x` is a single lowercase
  // letter. The letter suffix lets multiple pre-flow surfaces share the
  // `00` slot without renumbering the rest of the arc.
  ? fs.readdirSync(surfacesDir).filter(n => /^\d{2}[a-z]?-.*\.md$/.test(n))
  : [];

const claimedJsx = new Map();  // jsx-rel-path -> surface slug
const pairingErrors = [];

for (const docName of surfaceDocs) {
  const docPath = path.join(surfacesDir, docName);
  const text = fs.readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) {
    pairingErrors.push(`surfaces/${docName}: missing frontmatter (need surface, status, locked-date, jsx)`);
    continue;
  }
  for (const reqKey of ['surface', 'status', 'locked-date', 'jsx']) {
    if (!(reqKey in fm)) pairingErrors.push(`surfaces/${docName}: frontmatter missing "${reqKey}"`);
  }
  const jsxList = Array.isArray(fm.jsx) ? fm.jsx : [];
  if (jsxList.length === 0) {
    pairingErrors.push(`surfaces/${docName}: frontmatter "jsx" must be a non-empty list`);
  }
  for (const rel of jsxList) {
    const abs = path.join(dsRoot, rel);
    if (!fs.existsSync(abs)) {
      pairingErrors.push(`surfaces/${docName}: jsx "${rel}" does not exist`);
      continue;
    }
    if (claimedJsx.has(rel)) {
      pairingErrors.push(`surfaces/${docName}: jsx "${rel}" already claimed by ${claimedJsx.get(rel)}`);
    } else {
      claimedJsx.set(rel, docName);
    }
  }
}

const allScreenJsx = listJsx(screensDir).map(p => path.relative(dsRoot, p).split(path.sep).join('/'));
for (const screen of allScreenJsx) {
  if (!claimedJsx.has(screen)) {
    pairingErrors.push(`orphan jsx: ${screen} not claimed by any surfaces/0N-*.md`);
  }
}

if (pairingErrors.length) {
  pairingErrors.forEach(e => failures.push(e));
} else {
  notes.push(`surface↔jsx pairing: ${surfaceDocs.length} surface docs claim ${allScreenJsx.length} screens, no orphans / double-claims`);
}

// ── 5. Web invitee shell surface doc (sg-WF-5) ─────────────
//
// The web invitee shell is a web-only surface tree (the iMessage/SMS
// `/join/<roomId>` flow). It lives under a `web-NN-*` namespace rather
// than the `NN-*` ritual-arc namespace because (a) it never reaches an
// iOS surface and (b) its JSX is built by the paired shell-wiring
// tracer-bullets (tb-WF-11 / tb-WF-12) in `web/`, not as design-system
// `code/screens/` JSX — so the §4 surface↔jsx pairing check (which only
// matches `NN[a-z]?-*.md`) intentionally skips it. This check is the
// gate that the spec-gap doc itself stays present and complete.
const webInviteeDocs = fs.existsSync(surfacesDir)
  ? fs.readdirSync(surfacesDir).filter(n => /^web-\d{2}-.*\.md$/.test(n))
  : [];
if (webInviteeDocs.length === 0) {
  failures.push(
    'web invitee shell: no surfaces/web-NN-*.md found — sg-WF-5 surface doc missing'
  );
} else {
  // The five locked surfaces/states from the decision doc §Q4–Q7.
  // Each must be addressed by a heading or table-of-states row.
  const requiredMarkers = [
    'Name entry',
    'Resume',
    'verdict card',
    'closed',
    'Leave',
  ];
  for (const docName of webInviteeDocs) {
    const text = fs.readFileSync(path.join(surfacesDir, docName), 'utf8');
    const missing = requiredMarkers.filter(
      m => !text.toLowerCase().includes(m.toLowerCase())
    );
    if (missing.length) {
      failures.push(
        `surfaces/${docName}: web invitee shell doc missing coverage of: ${missing.join(', ')}`
      );
    }
    // The doc must reference the decision doc for behavior and must
    // document the cross-browser / cleared-storage resume limitation
    // (decision doc §Q3) as an accepted constraint.
    if (!text.includes('workflow-overhaul-web-invitee-flow')) {
      failures.push(
        `surfaces/${docName}: must reference the decision doc (workflow-overhaul-web-invitee-flow)`
      );
    }
    if (!/cross-browser/i.test(text) || !/cleared.?storage/i.test(text)) {
      failures.push(
        `surfaces/${docName}: must document the cross-browser / cleared-storage resume limitation (decision doc §Q3)`
      );
    }
  }
  if (failures.every(f => !f.startsWith('surfaces/web-') && !f.startsWith('web invitee'))) {
    notes.push(
      `web invitee shell: ${webInviteeDocs.length} doc(s) cover all five locked surfaces/states`
    );
  }
}

finish();

// ───────────────────────────────────────────────────────────
function collectRegisteredHex(t) {
  const set = new Set();
  const visit = v => {
    if (typeof v === 'string') {
      const m = v.match(hexRe);
      if (m) m.forEach(h => set.add(h.toUpperCase()));
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(visit);
    }
  };
  visit(t);
  return set;
}

function listJsx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(n => n.endsWith('.jsx'))
    .map(n => path.join(dir, n));
}

// Recursive listing for the web sweep — walks the tree, skipping
// node_modules / build output, returning paths that match `accept`.
function listSourceFiles(root, ignoredDirs, accept) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      if (ignoredDirs.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && accept(ent.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function finish() {
  for (const n of notes) console.log(`  ok  ${n}`);
  for (const f of failures) console.error(`fail  ${f}`);
  process.exit(failures.length ? 1 : 0);
}

// Minimal YAML frontmatter parser — handles scalar k:v and k:\n  - item lists.
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const body = m[1];
  const out = {};
  let currentKey = null;
  for (const rawLine of body.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const listMatch = rawLine.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      out[currentKey].push(stripQuotes(listMatch[1].trim()));
      continue;
    }
    const kvMatch = rawLine.match(/^([\w-]+):\s*(.*)$/);
    if (kvMatch) {
      const k = kvMatch[1];
      const v = kvMatch[2].trim();
      if (v === '') {
        currentKey = k;
        out[k] = [];
      } else {
        out[k] = stripQuotes(v);
        currentKey = null;
      }
    }
  }
  return out;
}

function stripQuotes(s) {
  return s.replace(/^['"]|['"]$/g, '');
}
