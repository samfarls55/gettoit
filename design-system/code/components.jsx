// GetToIt — Sunset Pop · shared components (canonical)
// No tweak deps — single palette (sunset), single vibe vocab (mood), grain 0.35.

// ── The 4-stop gradient map. The narrative arc of the product ──
const GTI_GRADIENTS = {
  initiator: { g1: '#FF8868', g2: '#FF9F6B', g3: '#FFB855', g4: '#FFD23F' },
  q1:        { g1: '#FF6B5E', g2: '#FF8A5F', g3: '#FFB256', g4: '#FFD23F' },
  q2:        { g1: '#FF5878', g2: '#FF7A66', g3: '#FFA15A', g4: '#FFC75A' },
  q3:        { g1: '#E04F8B', g2: '#B855B0', g3: '#8A5BD0', g4: '#6E63E0' },
  q4:        { g1: '#2F3380', g2: '#3F47A6', g3: '#5E59C9', g4: '#7C68E4' },
  q5:        { g1: '#0E1450', g2: '#181B5E', g3: '#252A6E', g4: '#363B82' },
  waiting:   { g1: '#1B1F66', g2: '#2A2A7C', g3: '#4A3F9F', g4: '#7256C4' },
  verdict:   { g1: '#FFC548', g2: '#FF8A5A', g3: '#C24F7E', g4: '#2A2068' },
  checkin:   { g1: '#FFDB6B', g2: '#FFA86D', g3: '#FF7F88', g4: '#9F4C9F' },
  midnight:  { g1: '#0A0B1A', g2: '#10112A', g3: '#161836', g4: '#1F2244' },
};

// Vibe vocabulary — locked to mood register
const VIBE_LABELS = ['HUSHED','MELLOW','BUZZY','LOUD','ROWDY'];

// ────────────────────────────────────────────────────────────
// Gradient surface — applies CSS vars + grain
// ────────────────────────────────────────────────────────────
function GradientSurface({ stop, children }) {
  const stops = GTI_GRADIENTS[stop] || GTI_GRADIENTS.initiator;
  const style = {
    '--g1': stops.g1, '--g2': stops.g2, '--g3': stops.g3, '--g4': stops.g4,
    position: 'absolute', inset: 0, overflow: 'hidden',
  };
  return (
    <div style={style}>
      <div className="gti-gradient" />
      <div className="gti-grain" />
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Top bar — close × + segmented progress
// ────────────────────────────────────────────────────────────
function TopBar({ step = 0, total = 5, onClose }) {
  return (
    <div style={{
      position: 'relative', zIndex: 3,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 22px',
    }}>
      <button onClick={onClose} aria-label="Close session" style={{
        appearance: 'none', border: 0, background: 'transparent',
        color: '#fff', padding: 4, cursor: 'pointer',
        fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 22,
        lineHeight: 1, opacity: 0.85,
      }}>×</button>
      <div style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'center' }}>
        {Array.from({length: total}).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i < step ? '#fff' : 'rgba(255,255,255,0.32)',
            transition: 'background 300ms var(--ease-out)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Question header — eyebrow + display title + sub
// ────────────────────────────────────────────────────────────
function QuestionHeader({ index, total, title, sub }) {
  return (
    <div style={{ padding: '0 22px', color: '#fff' }}>
      <div className="gti-eyebrow" style={{ opacity: 0.78, marginBottom: 10 }}>
        Q{index} of {total}
      </div>
      <h1 className="gti-display" style={{
        fontSize: 38, margin: '0 0 10px',
        textWrap: 'balance',
      }}>{title}</h1>
      {sub && (
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600,
          color: 'rgba(255,255,255,0.78)', letterSpacing: 0.1,
        }}>{sub}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Chip — veto (multi) or single-select
// Default: white outline on gradient.  Selected: sun fill + ink text.
// ────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, style = {} }) {
  const base = {
    appearance: 'none',
    fontFamily: 'var(--ff-body)',
    fontSize: 15, fontWeight: 700,
    padding: '14px 22px',
    borderRadius: 999,
    cursor: 'pointer',
    transition: 'all 180ms var(--ease-out)',
    minHeight: 48,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    ...style,
  };
  if (selected) {
    return (
      <button onClick={onClick} style={{
        ...base,
        background: 'var(--sun)', color: 'var(--ink)',
        border: '1.5px solid transparent',
        boxShadow:
          '0 8px 22px rgba(255,210,63,0.35), 0 0 0 4px rgba(255,210,63,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
        transform: 'scale(1.02)',
      }}>{label}</button>
    );
  }
  return (
    <button onClick={onClick} style={{
      ...base,
      background: 'rgba(255,255,255,0.04)',
      color: '#fff',
      border: '1.5px solid rgba(255,255,255,0.55)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }}>{label}</button>
  );
}

// ────────────────────────────────────────────────────────────
// Primary pill CTA
// ────────────────────────────────────────────────────────────
function PillCTA({ label, fill = 'white', onClick, disabled, style = {}, prefix }) {
  const fills = {
    white: { bg: '#fff', fg: 'var(--ink)' },
    sun:   { bg: 'var(--sun)', fg: 'var(--ink)' },
    ink:   { bg: 'var(--ink)', fg: '#fff' },
    ghost: { bg: 'transparent', fg: '#fff' },
  };
  const { bg, fg } = fills[fill] || fills.white;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      appearance: 'none', border: 0,
      width: '100%', height: 60, borderRadius: 999,
      background: bg, color: fg,
      fontFamily: 'var(--ff-body)',
      fontWeight: 900, fontSize: 14, letterSpacing: '0.14em',
      textTransform: 'uppercase',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      boxShadow: fill === 'sun'
        ? '0 12px 32px rgba(255,210,63,0.4), inset 0 1px 0 rgba(255,255,255,0.45)'
        : fill === 'ghost'
        ? 'inset 0 0 0 1.5px rgba(255,255,255,0.55)'
        : '0 12px 32px rgba(0,0,0,0.18)',
      transition: 'transform 140ms var(--ease-out), opacity 200ms',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      ...style,
    }}>{prefix}{label}</button>
  );
}

// ────────────────────────────────────────────────────────────
// Receipt chip — glass; "{name} {action}"
// ────────────────────────────────────────────────────────────
function ReceiptChip({ name, action, delay = 0, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 5,
      padding: '7px 13px 8px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(14px) saturate(160%)',
      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      border: '0.75px solid rgba(255,255,255,0.32)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(0,0,0,0.08)',
      animation: `gti-stagger-in 480ms var(--ease-out-soft) ${delay}ms both`,
      ...style,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.1 }}>{name}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.1 }}>{action}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Avatar dot — colored, with initial + answered ring
// ────────────────────────────────────────────────────────────
function AvatarDot({ name, color, answered, size = 36 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#FFD23F',
      color: 'var(--ink)',
      fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      boxShadow: answered
        ? '0 0 0 2.5px rgba(255,255,255,0.85), 0 8px 22px rgba(0,0,0,0.18)'
        : 'inset 0 0 0 1px rgba(255,255,255,0.25)',
      opacity: answered ? 1 : 0.55,
      filter: answered ? 'none' : 'grayscale(0.5)',
      transition: 'all 320ms var(--ease-out)',
    }}>
      {initial}
      {answered && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--sun)',
          border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: 'var(--ink)', fontWeight: 900,
        }}>✓</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Layout helpers
// ────────────────────────────────────────────────────────────
function CTADock({ children, gap = 14 }) {
  return (
    <div style={{
      marginTop: 'auto',
      padding: '0 22px 18px',
      display: 'flex', flexDirection: 'column', gap,
    }}>{children}</div>
  );
}

function Eyebrow({ children, style = {}, opacity = 0.78 }) {
  return (
    <div className="gti-eyebrow" style={{ color: '#fff', opacity, ...style }}>{children}</div>
  );
}

function Glass({ children, style = {}, soft = false }) {
  return (
    <div style={{
      background: soft ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: '0.75px solid rgba(255,255,255,0.32)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
      borderRadius: 'var(--r-card)',
      ...style,
    }}>{children}</div>
  );
}

// ────────────────────────────────────────────────────────────
// Range Slider (C-21) — continuous numeric input on gradient surface.
// Used on S01 for radius. Sun-yellow filled track + white thumb.
// Visual track is 6px; tap target is the full row (44 tall) via hit-slop.
// ────────────────────────────────────────────────────────────
function RangeSlider({ value, min, max, step, onChange, valueLabel, ariaLabel }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{
      position: 'relative', width: '100%',
      paddingTop: 18, paddingBottom: 18,
    }}>
      <div style={{
        position: 'absolute', inset: '18px 0',
        display: 'flex', alignItems: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'relative', width: '100%', height: 6, borderRadius: 999,
          background: 'rgba(255,255,255,0.22)',
          boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.18)',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `calc(${pct}% )`, borderRadius: 999,
            background: 'var(--sun)',
            boxShadow: '0 0 12px rgba(255,210,63,0.45)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: `calc(${pct}% )`,
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.7)',
          }} />
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuetext={valueLabel}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          width: '100%', height: 44, background: 'transparent',
          margin: 0, padding: 0, cursor: 'pointer',
          position: 'relative', zIndex: 2, opacity: 0,
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Auth Upgrade Chip (C-22) — Sign-in-with-Apple affordance on S04 Waiting.
// Voluntary warm-friend register; never a gate. iOS-only — web fallback
// passes `web` and the chip renders nothing.
//
// States:
//   default     — anonymous, never dismissed (or > 30d since dismissal): full chip
//   in-progress — user tapped; Apple sheet is up; pill disabled with spinner glyph
//   success     — link succeeded; quiet "Saved." confirmation in mono-tag
//   dismissed   — user tapped "Maybe later" within last 30d: render nothing
//   hidden      — already Apple-linked OR rendering on web: render nothing
// ────────────────────────────────────────────────────────────
function AuthUpgradeChip({
  state = 'default',
  onSave = () => {},
  onDismiss = () => {},
}) {
  if (state === 'dismissed' || state === 'hidden') return null;

  if (state === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          transition: 'opacity 320ms var(--ease-out)',
        }}
      >Saved.</div>
    );
  }

  const inProgress = state === 'in-progress';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'stretch', gap: 12,
    }}>
      <PillCTA
        label="Save this taste profile"
        fill="white"
        disabled={inProgress}
        onClick={onSave}
        prefix={
          // Apple logo glyph. Unicode  is the Apple Inc. PUA codepoint;
          // iOS renders it as the apple silhouette in SF Pro. On platforms
          // without SF Pro the JSX falls back to an SVG path via the
          // generic font stack — for spec fidelity this glyph is fine.
          // The in-progress state keeps the glyph but disables the pill;
          // the actual Apple sheet on top of the surface is the real
          // progress UI.
          <span
            aria-hidden="true"
            style={{
              fontSize: 18, fontWeight: 900,
              color: 'var(--ink)', lineHeight: 1,
            }}
          ></span>
        }
      />
      {!inProgress && (
        <button
          onClick={onDismiss}
          style={{
            appearance: 'none', border: 0, background: 'transparent',
            // 44pt-tall hit row clearing HIG min; visible label is smaller.
            minHeight: 44,
            padding: '12px 16px',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--ff-body)',
            fontWeight: 700, fontSize: 11,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            cursor: 'pointer',
            alignSelf: 'center',
          }}
        >Maybe later</button>
      )}
    </div>
  );
}

function GTIMark({ size = 18 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      color: '#fff', fontFamily: 'var(--ff-body)',
    }}>
      <div style={{
        width: size * 0.9, height: size * 0.9, borderRadius: 5,
        background: 'var(--sun)', color: 'var(--ink)',
        fontWeight: 900, fontSize: size * 0.55,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(255,210,63,0.4)',
      }}>g</div>
      <span style={{ fontWeight: 800, fontSize: size * 0.78, letterSpacing: 0.6 }}>
        GetToIt
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// LocationPicker (C-23) — persistent location selector.
// Decision in ADR 0009: reusable component, not ad-hoc composition.
// Two JSX exports compose into one conceptual primitive — chip readout
// + bottom-sheet typeahead editor.
//
// Refero anchor: Lumy "Changing location" (screen a18a8df8). Dark
// surface, sun-yellow accent for selected, paper-plane glyph on the
// "Use current location" row, recents grouped under an eyebrow rule.
//
// States: auto | manual | stale | empty | loading
//   auto    — permission granted + GPS resolved a coordinate
//   manual  — denied OR user typed-and-committed a value
//   stale   — granted but last GPS fix > 30 min ago
//   empty   — denied AND user has not yet selected
//   loading — initial GPS request in flight
//
// The iOS data layer (`MKLocalSearchCompleter`, `CLLocationManager`) is
// wired in tb-03. The design-system spec is data-agnostic — the host
// surface supplies `state`, `place`, `suggestions`, and the callbacks.
// ────────────────────────────────────────────────────────────
function LocationPickerChip({
  state = 'auto',
  place,                              // { name, sub } | null
  staleMinutes,                       // number — only meaningful when state === 'stale'
  onOpen = () => {},
}) {
  const showGPSGlyph = state === 'auto' || state === 'stale';
  const isLoading = state === 'loading';

  const subLabel = (() => {
    switch (state) {
      case 'stale': return 'Out of date — tap to refresh';
      case 'empty': return 'Tap to select';
      default:      return 'Your location';
    }
  })();

  const displayName = isLoading
    ? null
    : (place?.name || 'Set your location');

  return (
    <button
      onClick={onOpen}
      disabled={isLoading}
      aria-label={`Edit location. Current value: ${displayName || 'locating'}.`}
      style={{
        appearance: 'none', border: 0, cursor: isLoading ? 'wait' : 'pointer',
        textAlign: 'left',
        width: '100%', minHeight: 56,
        padding: '12px 16px',
        borderRadius: 'var(--r-row)',
        background: 'var(--glass-fill-soft)',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        display: 'flex', alignItems: 'center', gap: 12,
        color: '#fff',
        transition: 'background 140ms var(--ease-out)',
      }}
    >
      {showGPSGlyph && (
        <span aria-hidden="true" style={{
          display: 'inline-block',
          fontSize: 16, fontWeight: 900, lineHeight: 1,
          color: 'var(--sun)',
          opacity: state === 'stale' ? 0.45 : 1,
          transform: 'rotate(-45deg)',
        }}>➤</span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isLoading ? (
          <div style={{
            fontFamily: 'var(--ff-mono)',
            fontSize: 11, fontWeight: 500,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            animation: 'gti-locate-pulse 1400ms var(--ease-in-out) infinite',
          }}>Locating…</div>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 17, fontWeight: 700, lineHeight: 1.2,
              color: place ? '#fff' : 'rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{displayName}{state === 'stale' && (
              <span style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: 11, fontWeight: 500,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                marginLeft: 8,
              }}>· Out of date</span>
            )}</div>
            <div className="gti-eyebrow" style={{
              color: 'rgba(255,255,255,0.6)', marginTop: 2,
            }}>{subLabel}</div>
          </>
        )}
      </div>

      {!isLoading && (
        <span aria-hidden="true" style={{
          fontSize: 14, fontWeight: 900, color: 'rgba(255,255,255,0.55)',
          marginLeft: 4,
        }}>›</span>
      )}
    </button>
  );
}

function LocationPickerSheet({
  open = false,
  state = 'auto',                     // permission state (same as chip)
  query = '',
  onQueryChange = () => {},
  suggestions = [],                   // [{ id, name, sub }]
  recents = [],                       // [{ id, name, sub }]
  selectedId = null,
  staleMinutes,
  onUseCurrentLocation = () => {},
  onSelectSuggestion = () => {},
  onOpenSettings = () => {},
  onDismiss = () => {},
}) {
  if (!open) return null;

  const showCurrentLocationRow = state === 'auto' || state === 'stale';
  const showDenyCard = state === 'empty';
  const hasQuery = query.trim().length > 0;
  const showEmptyState = !hasQuery && recents.length === 0 && !showDenyCard;
  const listItems = hasQuery ? suggestions : recents;
  const listLabel = hasQuery ? 'Results' : 'Recent';

  return (
    <div role="dialog" aria-modal="true" aria-label="Location" style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* Backdrop — tap to dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Close location picker"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.32)',
          border: 0, padding: 0, cursor: 'pointer',
          animation: 'gti-fade-up 280ms var(--ease-out) both',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative',
        margin: '0 12px 12px',
        padding: '14px 18px 22px',
        borderRadius: 'var(--r-sheet)',
        background: 'rgba(20,20,30,0.92)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: 'var(--shadow-sheet, 0 -20px 60px rgba(0,0,0,0.5))',
        color: '#fff',
        animation: 'gti-sheet-rise 380ms var(--ease-out-soft) both',
      }}>
        {/* Handle */}
        <div aria-hidden="true" style={{
          width: 38, height: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.22)',
          margin: '0 auto 18px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, minHeight: 32,
        }}>
          <button
            onClick={onDismiss}
            aria-label="Close"
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 22,
              lineHeight: 1, cursor: 'pointer',
            }}
          >×</button>
          <div className="gti-eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Location
          </div>
          <div style={{ width: 44 }} aria-hidden="true" />
        </div>

        {/* Typeahead input */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          borderRadius: 'var(--r-row)',
          background: 'var(--glass-fill-soft)',
          border: '1px solid rgba(255,255,255,0.18)',
          transition: 'border-color 180ms var(--ease-out)',
        }}>
          <span aria-hidden="true" style={{
            fontSize: 14, fontWeight: 900, color: 'rgba(255,255,255,0.55)',
          }}>⌕</span>
          <input
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search a city, neighborhood, or address"
            aria-label="Search a city, neighborhood, or address"
            style={{
              flex: 1, appearance: 'none', border: 0, outline: 0,
              background: 'transparent',
              fontFamily: 'var(--ff-body)',
              fontSize: 16, fontWeight: 600, lineHeight: 1.2,
              color: '#fff',
              caretColor: 'var(--sun)',
            }}
          />
          {hasQuery && (
            <button
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              style={{
                appearance: 'none', border: 0, background: 'transparent',
                width: 32, height: 32, cursor: 'pointer',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 14,
                lineHeight: 1,
              }}
            >×</button>
          )}
        </label>

        {/* "Use current location" affordance — granted states only */}
        {showCurrentLocationRow && (
          <button
            onClick={onUseCurrentLocation}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              width: '100%', minHeight: 52, marginTop: 8,
              padding: '12px 16px',
              borderRadius: 'var(--r-row)',
              display: 'flex', alignItems: 'center', gap: 12,
              color: '#fff', cursor: 'pointer', textAlign: 'left',
              transition: 'background 140ms var(--ease-out)',
            }}
            aria-label="Use current location"
          >
            <span aria-hidden="true" style={{
              fontSize: 14, fontWeight: 900, color: 'var(--sun)',
              transform: 'rotate(-45deg)', display: 'inline-block',
            }}>➤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 15, fontWeight: 700 }}>
                Use current location
              </div>
              {state === 'stale' && typeof staleMinutes === 'number' && (
                <div className="gti-eyebrow" style={{
                  color: 'rgba(255,255,255,0.6)', marginTop: 2,
                }}>Last fix {staleMinutes} min ago</div>
              )}
            </div>
          </button>
        )}

        {/* Deny-state re-enable card — permission denied only */}
        {showDenyCard && (
          <div style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 'var(--r-card)',
            background: 'var(--glass-fill-soft)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <div className="gti-eyebrow" style={{ color: 'var(--sun)' }}>
              Location off
            </div>
            <div style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 15, fontWeight: 800, lineHeight: 1.3,
              color: '#fff', marginTop: 6,
              textWrap: 'balance',
            }}>Type a place above to keep going.</div>
            <div style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 13, fontWeight: 500, lineHeight: 1.4,
              color: 'rgba(255,255,255,0.7)', marginTop: 4,
            }}>Or turn on location in Settings if you'd rather we pick it up automatically.</div>
            <button
              onClick={onOpenSettings}
              style={{
                appearance: 'none', border: 0, background: 'transparent',
                width: '100%', height: 48, marginTop: 12,
                borderRadius: 999,
                fontFamily: 'var(--ff-body)',
                fontWeight: 800, fontSize: 14,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.55)',
              }}
            >Open Settings</button>
          </div>
        )}

        {/* Section header — Recent / Results */}
        {listItems.length > 0 && (
          <div className="gti-eyebrow" style={{
            color: 'rgba(255,255,255,0.6)',
            marginTop: 18, marginBottom: 6,
            padding: '0 4px',
          }}>{listLabel}</div>
        )}

        {/* Suggestion list */}
        {listItems.length > 0 && (
          <div role="listbox" aria-live="polite" style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 280, overflowY: 'auto',
          }}>
            {listItems.map(item => {
              const selected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSuggestion(item)}
                  role="option"
                  aria-selected={selected}
                  style={{
                    appearance: 'none', border: 0, cursor: 'pointer',
                    width: '100%', minHeight: 52, padding: '12px 16px',
                    borderRadius: 'var(--r-row)',
                    textAlign: 'left',
                    background: selected ? 'var(--sun)' : 'transparent',
                    color: selected ? 'var(--ink)' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 140ms var(--ease-out)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--ff-body)',
                      fontSize: 15, fontWeight: 700, lineHeight: 1.2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{item.name}</div>
                    <div style={{
                      fontFamily: 'var(--ff-body)',
                      fontSize: 12, fontWeight: 500, lineHeight: 1.3,
                      color: selected ? 'rgba(14,16,17,0.7)' : 'rgba(255,255,255,0.6)',
                      marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{item.sub}</div>
                  </div>
                  {selected && (
                    <span aria-hidden="true" style={{
                      width: 18, height: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--ink)',
                      fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 12,
                      lineHeight: 1,
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state — no query, no recents, permission not denied */}
        {showEmptyState && (
          <div style={{
            padding: '48px 22px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            textAlign: 'center',
          }}>
            <span aria-hidden="true" style={{
              fontSize: 32, fontWeight: 900, color: 'var(--sun)', lineHeight: 1,
            }}>◎</span>
            <div style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 16, fontWeight: 800, lineHeight: 1.3,
              color: '#fff', textWrap: 'balance',
            }}>Type a place to get started.</div>
            <div style={{
              fontFamily: 'var(--ff-body)',
              fontSize: 13, fontWeight: 500, lineHeight: 1.4,
              color: 'rgba(255,255,255,0.65)', maxWidth: 260,
              textWrap: 'balance',
            }}>City, neighborhood, or street address — whatever lands quickest.</div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  GTI_GRADIENTS, VIBE_LABELS,
  GradientSurface, TopBar, QuestionHeader,
  Chip, PillCTA, ReceiptChip, AvatarDot,
  CTADock, Eyebrow, Glass, GTIMark,
  RangeSlider, AuthUpgradeChip,
  LocationPickerChip, LocationPickerSheet,
});
