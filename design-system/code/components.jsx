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

Object.assign(window, {
  GTI_GRADIENTS, VIBE_LABELS,
  GradientSurface, TopBar, QuestionHeader,
  Chip, PillCTA, ReceiptChip, AvatarDot,
  CTADock, Eyebrow, Glass, GTIMark,
});
