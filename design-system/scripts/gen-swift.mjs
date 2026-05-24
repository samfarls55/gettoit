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
  lines.push('');
  lines.push('    /// Range Slider (C-21) accent colors. `tick` is the subtle anchor mark used by the');
  lines.push('    /// S01 Setup distance slider variant (at the 1.0 mi walk/drive boundary).');
  lines.push('    public enum Slider {');
  lines.push(`        public static let tick        = Color.white.opacity(${rgbaAlpha(t.color.slider.tick)})`);
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

  // ── GTIShadow ───────────────────────────────────────────────
  // Drop-shadow primitives. SwiftUI's `.shadow(color:radius:x:y:)` modifier
  // does not natively render multi-stop CSS shadows (e.g. the inset
  // highlight layer on `shadow.fab`); only the outer drop layer of each
  // multi-stop recipe is lifted into Swift here. iOS hosts that want the
  // inset highlight render it via a separate overlay (a sub-1px white
  // sheen rarely reads on a small disc, and the FAB ports without it).
  lines.push('/// Drop-shadow primitives. The outer drop layer of each `tokens.json` shadow recipe');
  lines.push('/// is exposed here as a `Recipe` value the iOS port applies via `.shadow(color:radius:x:y:)`.');
  lines.push('/// Multi-stop CSS recipes (inset highlights, second / third stop) are not lifted —');
  lines.push('/// SwiftUI\'s shadow modifier renders one drop layer, and the inset / spread layers are');
  lines.push('/// best rendered via a separate overlay if the host needs them.');
  lines.push('public enum GTIShadow {');
  lines.push('    public struct Recipe: Sendable, Equatable {');
  lines.push('        public let color: Color');
  lines.push('        public let radius: CGFloat');
  lines.push('        public let x: CGFloat');
  lines.push('        public let y: CGFloat');
  lines.push('        public init(color: Color, radius: CGFloat, x: CGFloat = 0, y: CGFloat = 0) {');
  lines.push('            self.color = color');
  lines.push('            self.radius = radius');
  lines.push('            self.x = x');
  lines.push('            self.y = y');
  lines.push('        }');
  lines.push('    }');
  lines.push('');
  for (const k of Object.keys(t.shadow)) {
    if (k.startsWith('_')) continue;            // skip _notes
    const recipe = parseShadowOuterDrop(t.shadow[k]);
    if (!recipe) continue;                       // skip recipes we cannot lift cleanly
    lines.push(`    /// Outer drop of \`tokens.json\` \`shadow.${k}\` recipe — applied via \`.gtiShadow(...)\`.`);
    lines.push(`    public static let ${camel(k)} = Recipe(`);
    lines.push(`        color: ${recipe.color},`);
    lines.push(`        radius: ${recipe.radius},`);
    lines.push(`        x: ${recipe.x},`);
    lines.push(`        y: ${recipe.y}`);
    lines.push('    )');
  }
  lines.push('}');
  lines.push('');
  lines.push('public extension View {');
  lines.push('    /// Apply a `GTIShadow.Recipe` as a SwiftUI drop shadow. Wraps the standard');
  lines.push('    /// `.shadow(color:radius:x:y:)` modifier so call sites pin the recipe by name.');
  lines.push('    func gtiShadow(_ recipe: GTIShadow.Recipe) -> some View {');
  lines.push('        self.shadow(color: recipe.color, radius: recipe.radius, x: recipe.x, y: recipe.y)');
  lines.push('    }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// Parse the outer drop layer of a CSS box-shadow recipe.
//   Input:  "0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)"
//   Output: { color, radius, x, y, doc }
//
// Skips:
//   * recipes whose first stop is an inset (no usable drop layer)
//   * recipes with no rgba()/hex color
// Returns null if the recipe cannot be parsed cleanly.
function parseShadowOuterDrop(recipe) {
  // Trim the CSS into the first comma-separated stop, respecting parens.
  const firstStop = splitTopLevelComma(recipe)[0]?.trim() ?? '';
  if (/^inset\b/i.test(firstStop)) return null;
  // Expected shape: `<x> <y> <blur> [spread] <color>` — we lift x / y / blur and color.
  // Allow optional spread for completeness (we currently emit no spread token, but
  // the parser tolerates one) — the spread component is dropped on the Swift side.
  const m = firstStop.match(
    /^(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?(?:\s+(-?\d+(?:\.\d+)?)(?:px)?)?\s+(.+)$/
  );
  if (!m) return null;
  const [, xStr, yStr, blurStr, /* spread */, colorStr] = m;
  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  const radius = parseFloat(blurStr);
  const color = swiftColorFromCss(colorStr.trim());
  if (!color) return null;
  return { color, radius, x, y };
}

function splitTopLevelComma(s) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

function swiftColorFromCss(s) {
  // rgba(r,g,b,a) — preserved at the alpha; rounded to nearest 0xRRGGBB.
  const rgba = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    const r = parseInt(rgba[1], 10);
    const g = parseInt(rgba[2], 10);
    const b = parseInt(rgba[3], 10);
    const a = rgba[4] != null ? parseFloat(rgba[4]) : 1;
    const hex = `0x${[r, g, b].map(n => n.toString(16).toUpperCase().padStart(2, '0')).join('')}`;
    if (a === 1) return `Color(gtiHex: ${hex})`;
    return `Color(gtiHex: ${hex}, opacity: ${a})`;
  }
  // #RRGGBB hex
  const hexm = s.match(/^#([0-9A-Fa-f]{6})$/);
  if (hexm) return `Color(gtiHex: 0x${hexm[1].toUpperCase()})`;
  return null;
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
