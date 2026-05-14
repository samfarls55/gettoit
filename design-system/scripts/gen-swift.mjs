#!/usr/bin/env node
// GetToIt — Sunset Pop · tokens.json → ios/Sources/GTITokens.swift
// Run: node design-system/scripts/gen-swift.mjs
// Output is deterministic. CI / verify.mjs re-runs this with --check and diffs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(dsRoot, '..');
const tokensPath = path.join(dsRoot, 'tokens.json');
const outPath = path.join(repoRoot, 'ios', 'Sources', 'GTITokens.swift');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const generated = renderSwift(tokens);

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== generated) {
    console.error(`drift: ${path.relative(process.cwd(), outPath)} differs from tokens.json`);
    console.error('       run: node design-system/scripts/gen-swift.mjs');
    process.exit(1);
  }
  console.log(`ok: ${path.relative(process.cwd(), outPath)} matches tokens.json`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, generated);
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${generated.length} bytes)`);

// ─────────────────────────────────────────────────────────────
function renderSwift(t) {
  const lines = [];
  lines.push('// GetToIt — Sunset Pop · design tokens (canonical)');
  lines.push('// GENERATED from design-system/tokens.json — do not edit by hand.');
  lines.push('// Re-run:  node design-system/scripts/gen-swift.mjs');
  lines.push('// Verify:  node design-system/scripts/gen-swift.mjs --check');
  lines.push('');
  lines.push('import SwiftUI');
  lines.push('');

  // ── Color helper ────────────────────────────────────────────
  lines.push('public extension Color {');
  lines.push('    /// Build a SwiftUI `Color` from a sRGB hex literal. Used by generated tokens.');
  lines.push('    init(gtiHex hex: UInt32, opacity: Double = 1.0) {');
  lines.push('        let r = Double((hex >> 16) & 0xFF) / 255.0');
  lines.push('        let g = Double((hex >>  8) & 0xFF) / 255.0');
  lines.push('        let b = Double( hex        & 0xFF) / 255.0');
  lines.push('        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)');
  lines.push('    }');
  lines.push('}');
  lines.push('');

  // ── GTIColor ────────────────────────────────────────────────
  lines.push('/// Brand colors. All values originate in `design-system/tokens.json`.');
  lines.push('public enum GTIColor {');
  lines.push(`    public static let ink         = Color(gtiHex: ${hex(t.color['ink'])})`);
  lines.push(`    public static let ink2        = Color(gtiHex: ${hex(t.color['ink-2'])})`);
  lines.push(`    public static let ink3        = Color(gtiHex: ${hex(t.color['ink-3'])})`);
  lines.push(`    public static let paper       = Color(gtiHex: ${hex(t.color['paper'])})`);
  lines.push(`    public static let sun         = Color(gtiHex: ${hex(t.color['sun'])})`);
  lines.push(`    public static let sunDeep     = Color(gtiHex: ${hex(t.color['sun-deep'])})`);
  lines.push('');
  lines.push('    /// Per-member identity dots on S04 Waiting. Up to 3 members.');
  lines.push('    public static let memberIdentity: [Color] = [');
  for (const c of t.color['member-identity']) {
    lines.push(`        Color(gtiHex: ${hex(c)}),`);
  }
  lines.push('    ]');
  lines.push('');
  lines.push('    public enum Glass {');
  lines.push(`        public static let fill          = Color.white.opacity(${rgbaAlpha(t.color.glass['fill'])})`);
  lines.push(`        public static let fillStrong    = Color.white.opacity(${rgbaAlpha(t.color.glass['fill-strong'])})`);
  lines.push(`        public static let fillSoft      = Color.white.opacity(${rgbaAlpha(t.color.glass['fill-soft'])})`);
  lines.push(`        public static let fillSoftPress = Color.white.opacity(${rgbaAlpha(t.color.glass['fill-soft-press'])})`);
  lines.push(`        public static let stroke        = Color.white.opacity(${rgbaAlpha(t.color.glass['stroke'])})`);
  lines.push('    }');
  lines.push('');
  lines.push('    public enum TextOnGradient {');
  lines.push(`        public static let primary     = Color.white`);
  lines.push(`        public static let secondary   = Color.white.opacity(${rgbaAlpha(t.color.text['on-gradient'].secondary)})`);
  lines.push(`        public static let tertiary    = Color.white.opacity(${rgbaAlpha(t.color.text['on-gradient'].tertiary)})`);
  lines.push('    }');
  lines.push('');
  lines.push('    /// Tinted-ink secondary text role for surfaces whose gradient reaches into the yellow/peach range');
  lines.push('    /// (initiator, Q1, Q2 yellow-bottom; verdict, checkin yellow-top). White-on-yellow secondary fails WCAG AA;');
  lines.push('    /// ink-at-0.78 measures 7.74:1 against the brightest stop. See tokens.json `text.on-bright-gradient`.');
  lines.push('    public enum TextOnBrightGradient {');
  lines.push(`        public static let secondary   = Color(gtiHex: ${hex(t.color['ink'])}, opacity: ${rgbaAlpha(t.color.text['on-bright-gradient'].secondary)})`);
  lines.push('    }');
  lines.push('');
  lines.push('    public enum TextOnSurface {');
  lines.push(`        public static let primary     = Color(gtiHex: ${hex(t.color['ink'])})`);
  lines.push(`        public static let secondary   = Color(gtiHex: ${hex(t.color['ink'])}, opacity: ${rgbaAlpha(t.color.text['on-surface'].secondary)})`);
  lines.push(`        public static let tertiary    = Color(gtiHex: ${hex(t.color['ink'])}, opacity: ${rgbaAlpha(t.color.text['on-surface'].tertiary)})`);
  lines.push('    }');
  lines.push('}');
  lines.push('');

  // ── GTIGradient ─────────────────────────────────────────────
  lines.push('/// Per-surface 4-stop linear gradients. Stop positions are shared across all surfaces.');
  lines.push('public enum GTIGradient {');
  const stops = t.gradient['stop-positions'];
  lines.push(`    public static let stopPositions: [Double] = [${stops.map(s => String(s)).join(', ')}]`);
  lines.push('');
  lines.push('    /// Build a top-to-bottom `LinearGradient` from the 4 stops of the named surface.');
  lines.push('    public static func surface(_ name: Surface) -> LinearGradient {');
  lines.push('        let stops = colorStops(name)');
  lines.push('        return LinearGradient(');
  lines.push('            stops: zip(stops, stopPositions).map { Gradient.Stop(color: $0.0, location: $0.1) },');
  lines.push('            startPoint: .top,');
  lines.push('            endPoint: .bottom');
  lines.push('        )');
  lines.push('    }');
  lines.push('');
  lines.push('    /// Raw color stops for a surface, in top-to-bottom order.');
  lines.push('    public static func colorStops(_ name: Surface) -> [Color] {');
  lines.push('        switch name {');
  const surfaceOrder = Object.keys(t.gradient.surfaces);
  for (const s of surfaceOrder) {
    const colors = t.gradient.surfaces[s].map(c => `Color(gtiHex: ${hex(c)})`).join(', ');
    lines.push(`        case .${camel(s)}: return [${colors}]`);
  }
  lines.push('        }');
  lines.push('    }');
  lines.push('');
  lines.push('    public enum Surface: String, CaseIterable, Sendable {');
  for (const s of surfaceOrder) {
    lines.push(`        case ${camel(s)}`);
  }
  lines.push('    }');
  lines.push('}');
  lines.push('');

  // ── GTIFont ─────────────────────────────────────────────────
  lines.push('/// Type scale. Display family is Inter at the configured display weight.');
  lines.push('public enum GTIFont {');
  lines.push(`    public static let displayFamily   = ${quote(t.typography.families.display)}`);
  lines.push(`    public static let bodyFamily      = ${quote(t.typography.families.body)}`);
  lines.push(`    public static let monoFamily      = ${quote(t.typography.families.mono)}`);
  lines.push(`    public static let displayWeight   = ${t.typography['display-weight']}`);
  lines.push('');
  lines.push('    public enum Size {');
  const scale = t.typography.scale;
  for (const k of Object.keys(scale)) {
    lines.push(`        public static let ${camel(k)}: CGFloat = ${scale[k].size}`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    public enum Weight {');
  for (const k of Object.keys(scale)) {
    lines.push(`        public static let ${camel(k)}: Int = ${scale[k].weight}`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    public enum LineHeight {');
  for (const k of Object.keys(scale)) {
    lines.push(`        public static let ${camel(k)}: CGFloat = ${scale[k]['line-height']}`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    /// Letter-spacing in em (as written in tokens.json). Multiply by font size to get points.');
  lines.push('    public enum TrackingEm {');
  for (const k of Object.keys(scale)) {
    lines.push(`        public static let ${camel(k)}: CGFloat = ${emToNumber(scale[k].tracking)}`);
  }
  lines.push('    }');
  lines.push('}');
  lines.push('');

  // ── GTISpacing ──────────────────────────────────────────────
  lines.push('/// Spacing scale. Keys match `tokens.json` (numeric step → points).');
  lines.push('public enum GTISpacing {');
  for (const k of Object.keys(t.spacing)) {
    lines.push(`    public static let step${k}: CGFloat = ${t.spacing[k]}`);
  }
  lines.push('}');
  lines.push('');

  // ── GTIRadii ────────────────────────────────────────────────
  lines.push('public enum GTIRadii {');
  for (const k of Object.keys(t.radii)) {
    lines.push(`    public static let ${camel(k)}: CGFloat = ${t.radii[k]}`);
  }
  lines.push('}');
  lines.push('');

  // ── GTIMotion ───────────────────────────────────────────────
  lines.push('/// Motion timings. Durations are seconds (converted from tokens.json ms).');
  lines.push('public enum GTIMotion {');
  lines.push('    public enum Duration {');
  for (const k of Object.keys(t.motion['duration-ms'])) {
    const ms = t.motion['duration-ms'][k];
    lines.push(`        public static let ${camel(k)}: Double = ${(ms / 1000).toFixed(3)}`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    public enum ChoreoDelay {');
  for (const k of Object.keys(t.motion['choreo-delay-ms'])) {
    const ms = t.motion['choreo-delay-ms'][k];
    lines.push(`        public static let ${camel(k)}: Double = ${(ms / 1000).toFixed(3)}`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    /// CSS cubic-bezier control points. Use with `Animation.timingCurve`.');
  lines.push('    public enum Easing {');
  for (const k of Object.keys(t.motion.easing)) {
    const pts = parseCubicBezier(t.motion.easing[k]);
    lines.push(`        public static let ${camel(k)}: (Double, Double, Double, Double) = (${pts.join(', ')})`);
  }
  lines.push('    }');
  lines.push('}');
  lines.push('');

  // ── GTIVibeLabels ───────────────────────────────────────────
  lines.push('/// Q4 vibe scalar labels. Locked vocabulary.');
  lines.push('public enum GTIVibeLabels {');
  lines.push(`    public static let all: [String] = [${t['vibe-labels'].map(quote).join(', ')}]`);
  lines.push('}');
  lines.push('');

  // ── GTITexture ──────────────────────────────────────────────
  lines.push('public enum GTITexture {');
  lines.push(`    public static let grainOpacity: Double = ${t.texture['grain-opacity']}`);
  lines.push(`    public static let grainTilePx: CGFloat = ${t.texture['grain-tile-px']}`);
  lines.push(`    public static let grainBlend = ${quote(t.texture['grain-blend'])}`);
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ─── helpers ──────────────────────────────────────────────────
function hex(h) {
  // accepts '#RRGGBB' → '0xRRGGBB'
  const m = h.match(/^#([0-9A-Fa-f]{6})$/);
  if (!m) throw new Error(`expected #RRGGBB, got ${h}`);
  return `0x${m[1].toUpperCase()}`;
}

function rgbaAlpha(rgba) {
  // 'rgba(255,255,255,0.18)' → '0.18'
  const m = rgba.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`expected rgba(...), got ${rgba}`);
  return m[1];
}

function camel(s) {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function quote(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function emToNumber(s) {
  // '-0.025em' → '-0.025', '0' → '0'
  if (s === '0' || s === 0) return '0';
  const m = String(s).match(/^(-?[\d.]+)em$/);
  if (!m) throw new Error(`expected em tracking, got ${s}`);
  return m[1];
}

function parseCubicBezier(s) {
  // 'cubic-bezier(.22,.61,.36,1)' → ['0.22','0.61','0.36','1.0']
  const m = s.match(/cubic-bezier\(([^)]+)\)/);
  if (!m) throw new Error(`expected cubic-bezier(...), got ${s}`);
  return m[1].split(',').map(x => {
    const trimmed = x.trim();
    // ensure leading 0 for swift literal nicety: '.22' → '0.22'
    return trimmed.startsWith('.') ? `0${trimmed}`
         : trimmed.startsWith('-.') ? `-0${trimmed.slice(1)}`
         : trimmed;
  });
}
