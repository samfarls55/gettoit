// GetToIt — Sunset Pop · design tokens (canonical)
// GENERATED from design-system/tokens.json — do not edit by hand.
// Re-run:  node design-system/scripts/gen-swift.mjs
// Verify:  node design-system/scripts/gen-swift.mjs --check

import SwiftUI

public extension Color {
    /// Build a SwiftUI `Color` from a sRGB hex literal. Used by generated tokens.
    init(gtiHex hex: UInt32, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >>  8) & 0xFF) / 255.0
        let b = Double( hex        & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Brand colors. All values originate in `design-system/tokens.json`.
public enum GTIColor {
    public static let ink         = Color(gtiHex: 0x0E1011)
    public static let ink2        = Color(gtiHex: 0x1A1C1F)
    public static let ink3        = Color(gtiHex: 0x0A0A0F)
    public static let paper       = Color(gtiHex: 0xFFFFFF)
    public static let sun         = Color(gtiHex: 0xFFD23F)
    public static let sunDeep     = Color(gtiHex: 0xF5B800)

    /// Per-member identity dots on S04 Waiting. Up to 3 members.
    public static let memberIdentity: [Color] = [
        Color(gtiHex: 0x7DDFB5),
        Color(gtiHex: 0xFF8DA1),
        Color(gtiHex: 0x9BC0FF),
    ]

    public enum Glass {
        public static let fill        = Color.white.opacity(0.18)
        public static let fillStrong  = Color.white.opacity(0.28)
        public static let fillSoft    = Color.white.opacity(0.10)
        public static let stroke      = Color.white.opacity(0.42)
    }

    public enum TextOnGradient {
        public static let primary     = Color.white
        public static let secondary   = Color.white.opacity(0.78)
        public static let tertiary    = Color.white.opacity(0.6)
    }

    public enum TextOnSurface {
        public static let primary     = Color(gtiHex: 0x0E1011)
        public static let secondary   = Color(gtiHex: 0x0E1011, opacity: 0.7)
        public static let tertiary    = Color(gtiHex: 0x0E1011, opacity: 0.5)
    }
}

/// Per-surface 4-stop linear gradients. Stop positions are shared across all surfaces.
public enum GTIGradient {
    public static let stopPositions: [Double] = [0, 0.32, 0.66, 1]

    /// Build a top-to-bottom `LinearGradient` from the 4 stops of the named surface.
    public static func surface(_ name: Surface) -> LinearGradient {
        let stops = colorStops(name)
        return LinearGradient(
            stops: zip(stops, stopPositions).map { Gradient.Stop(color: $0.0, location: $0.1) },
            startPoint: .top,
            endPoint: .bottom
        )
    }

    /// Raw color stops for a surface, in top-to-bottom order.
    public static func colorStops(_ name: Surface) -> [Color] {
        switch name {
        case .initiator: return [Color(gtiHex: 0xFF8868), Color(gtiHex: 0xFF9F6B), Color(gtiHex: 0xFFB855), Color(gtiHex: 0xFFD23F)]
        case .q1: return [Color(gtiHex: 0xFF6B5E), Color(gtiHex: 0xFF8A5F), Color(gtiHex: 0xFFB256), Color(gtiHex: 0xFFD23F)]
        case .q2: return [Color(gtiHex: 0xFF5878), Color(gtiHex: 0xFF7A66), Color(gtiHex: 0xFFA15A), Color(gtiHex: 0xFFC75A)]
        case .q3: return [Color(gtiHex: 0xE04F8B), Color(gtiHex: 0xB855B0), Color(gtiHex: 0x8A5BD0), Color(gtiHex: 0x6E63E0)]
        case .q4: return [Color(gtiHex: 0x2F3380), Color(gtiHex: 0x3F47A6), Color(gtiHex: 0x5E59C9), Color(gtiHex: 0x7C68E4)]
        case .q5: return [Color(gtiHex: 0x0E1450), Color(gtiHex: 0x181B5E), Color(gtiHex: 0x252A6E), Color(gtiHex: 0x363B82)]
        case .waiting: return [Color(gtiHex: 0x1B1F66), Color(gtiHex: 0x2A2A7C), Color(gtiHex: 0x4A3F9F), Color(gtiHex: 0x7256C4)]
        case .verdict: return [Color(gtiHex: 0xFFC548), Color(gtiHex: 0xFF8A5A), Color(gtiHex: 0xC24F7E), Color(gtiHex: 0x2A2068)]
        case .checkin: return [Color(gtiHex: 0xFFDB6B), Color(gtiHex: 0xFFA86D), Color(gtiHex: 0xFF7F88), Color(gtiHex: 0x9F4C9F)]
        case .midnight: return [Color(gtiHex: 0x0A0B1A), Color(gtiHex: 0x10112A), Color(gtiHex: 0x161836), Color(gtiHex: 0x1F2244)]
        }
    }

    public enum Surface: String, CaseIterable, Sendable {
        case initiator
        case q1
        case q2
        case q3
        case q4
        case q5
        case waiting
        case verdict
        case checkin
        case midnight
    }
}

/// Type scale. Display family is Inter at the configured display weight.
public enum GTIFont {
    public static let displayFamily   = "'Inter', system-ui, -apple-system, sans-serif"
    public static let bodyFamily      = "'Inter', system-ui, -apple-system, sans-serif"
    public static let monoFamily      = "'IBM Plex Mono', ui-monospace, Menlo, monospace"
    public static let displayWeight   = 900

    public enum Size {
        public static let displayXl: CGFloat = 88
        public static let displayL: CGFloat = 64
        public static let displayM: CGFloat = 44
        public static let displayS: CGFloat = 32
        public static let heading: CGFloat = 28
        public static let title: CGFloat = 22
        public static let body: CGFloat = 16
        public static let sm: CGFloat = 14
        public static let eyebrow: CGFloat = 11
        public static let cta: CGFloat = 14
        public static let monoTag: CGFloat = 11
    }

    public enum Weight {
        public static let displayXl: Int = 900
        public static let displayL: Int = 900
        public static let displayM: Int = 900
        public static let displayS: Int = 900
        public static let heading: Int = 800
        public static let title: Int = 700
        public static let body: Int = 600
        public static let sm: Int = 600
        public static let eyebrow: Int = 700
        public static let cta: Int = 800
        public static let monoTag: Int = 500
    }

    public enum LineHeight {
        public static let displayXl: CGFloat = 0.9
        public static let displayL: CGFloat = 0.9
        public static let displayM: CGFloat = 0.92
        public static let displayS: CGFloat = 0.95
        public static let heading: CGFloat = 1.05
        public static let title: CGFloat = 1.2
        public static let body: CGFloat = 1.4
        public static let sm: CGFloat = 1.4
        public static let eyebrow: CGFloat = 1
        public static let cta: CGFloat = 1
        public static let monoTag: CGFloat = 1
    }

    /// Letter-spacing in em (as written in tokens.json). Multiply by font size to get points.
    public enum TrackingEm {
        public static let displayXl: CGFloat = -0.025
        public static let displayL: CGFloat = -0.025
        public static let displayM: CGFloat = -0.025
        public static let displayS: CGFloat = -0.02
        public static let heading: CGFloat = -0.015
        public static let title: CGFloat = -0.01
        public static let body: CGFloat = 0
        public static let sm: CGFloat = 0
        public static let eyebrow: CGFloat = 0.18
        public static let cta: CGFloat = 0.14
        public static let monoTag: CGFloat = 0.18
    }
}

/// Spacing scale. Keys match `tokens.json` (numeric step → points).
public enum GTISpacing {
    public static let step1: CGFloat = 4
    public static let step2: CGFloat = 8
    public static let step3: CGFloat = 12
    public static let step4: CGFloat = 16
    public static let step5: CGFloat = 20
    public static let step6: CGFloat = 24
    public static let step8: CGFloat = 32
    public static let step10: CGFloat = 40
    public static let step12: CGFloat = 48
    public static let step16: CGFloat = 64
}

public enum GTIRadii {
    public static let chip: CGFloat = 999
    public static let tag: CGFloat = 8
    public static let card: CGFloat = 18
    public static let cardLg: CGFloat = 22
    public static let hero: CGFloat = 28
    public static let pill: CGFloat = 999
    public static let sheet: CGFloat = 26
}

/// Motion timings. Durations are seconds (converted from tokens.json ms).
public enum GTIMotion {
    public enum Duration {
        public static let gradTween: Double = 1.100
        public static let chip: Double = 0.180
        public static let rise: Double = 0.700
        public static let pop: Double = 0.520
        public static let shutter: Double = 0.700
    }

    public enum ChoreoDelay {
        public static let staggerReceipt: Double = 0.080
        public static let eyebrow: Double = 0.080
        public static let name: Double = 0.280
        public static let meta: Double = 0.700
        public static let time: Double = 0.820
        public static let rule: Double = 1.020
        public static let receipts: Double = 1.140
        public static let cta: Double = 1.380
    }

    /// CSS cubic-bezier control points. Use with `Animation.timingCurve`.
    public enum Easing {
        public static let out: (Double, Double, Double, Double) = (0.22, 0.61, 0.36, 1)
        public static let outSoft: (Double, Double, Double, Double) = (0.16, 1, 0.3, 1)
        public static let inOut: (Double, Double, Double, Double) = (0.65, 0, 0.35, 1)
    }
}

/// Q4 vibe scalar labels. Locked vocabulary.
public enum GTIVibeLabels {
    public static let all: [String] = ["HUSHED", "MELLOW", "BUZZY", "LOUD", "ROWDY"]
}

public enum GTITexture {
    public static let grainOpacity: Double = 0.35
    public static let grainTilePx: CGFloat = 280
    public static let grainBlend = "overlay"
}
