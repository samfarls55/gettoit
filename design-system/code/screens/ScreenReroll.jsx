// Surface 11 — Reroll sheet
// Friction-bearing.  Reason becomes a new constraint and is shown to the group.

function ScreenReroll({ onAdvance }) {
  const [reason, setReason] = React.useState(null);
  const [detail, setDetail] = React.useState('');
  const reasons = [
    { id: 'cost',  label: 'Too pricey',   icon: '$' },
    { id: 'dist',  label: 'Too far',      icon: '→' },
    { id: 'mood',  label: 'Mood shifted', icon: '~' },
    { id: 'diet',  label: 'Diet missed',  icon: '✕' },
    { id: 'avail', label: 'Not open',     icon: '○' },
  ];

  return (
    <GradientSurface stop="midnight">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />

      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 12,
        background: 'rgba(20,20,30,0.92)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderRadius: 26,
        border: '1px solid rgba(255,255,255,0.10)',
        padding: '22px 22px 18px',
        color: '#fff',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
        animation: 'gti-fade-up 380ms var(--ease-out-soft) both',
        display: 'flex', flexDirection: 'column', maxHeight: '88%',
      }}>
        {/* handle */}
        <div style={{
          width: 38, height: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.22)',
          margin: '0 auto 18px',
        }} />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, marginBottom: 4,
        }}>
          <div>
            <Eyebrow style={{ opacity: 0.6, marginBottom: 6 }}>Reroll the verdict</Eyebrow>
            <h2 className="gti-display" style={{
              margin: 0, fontSize: 32, lineHeight: 0.95,
              letterSpacing: '-0.02em', textTransform: 'uppercase',
            }}>What changed?</h2>
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 6,
            background: 'rgba(255,210,63,0.16)',
            border: '1px solid rgba(255,210,63,0.45)',
            color: 'var(--sun)',
            fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 10,
            letterSpacing: 0.14, textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>2 left</div>
        </div>

        <p style={{
          margin: '12px 0 18px',
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.4, maxWidth: 320,
        }}>
          Your reason becomes a new constraint. The group sees it. Pick the one that's actually true.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          marginBottom: 14,
        }}>
          {reasons.map(r => {
            const sel = reason === r.id;
            return (
              <button key={r.id} onClick={() => setReason(r.id)} style={{
                appearance: 'none', cursor: 'pointer',
                padding: '14px 14px', borderRadius: 12, textAlign: 'left',
                background: sel ? 'var(--sun)' : 'rgba(255,255,255,0.04)',
                color: sel ? 'var(--ink)' : '#fff',
                border: sel ? 'none' : '1px solid rgba(255,255,255,0.14)',
                transition: 'all 180ms var(--ease-out)',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: sel ? '0 10px 22px rgba(255,210,63,0.28)' : 'none',
              }}>
                <span style={{
                  fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: 18, opacity: 0.85,
                }}>{r.icon}</span>
                <span style={{
                  fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 13, letterSpacing: 0.05,
                }}>{r.label}</span>
              </button>
            );
          })}
        </div>

        {reason && (
          <div style={{
            animation: 'gti-fade-up 340ms var(--ease-out-soft) both',
            marginBottom: 14,
          }}>
            <div className="gti-eyebrow" style={{
              color: 'rgba(255,255,255,0.6)', marginBottom: 6,
            }}>One line for the group (optional)</div>
            <input
              value={detail} onChange={e => setDetail(e.target.value)}
              placeholder="e.g. just realized I left my wallet"
              style={{
                width: '100%', padding: '12px 14px',
                borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontFamily: 'var(--ff-body)',
                fontSize: 13, fontWeight: 600, outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PillCTA
            label={reason ? 'Reroll · burns 1 of 3' : 'Pick a reason first'}
            fill={reason ? 'sun' : 'ink'}
            disabled={!reason}
            onClick={onAdvance}
          />
          <button style={{
            appearance: 'none', border: 0, background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 11,
            letterSpacing: 0.16, textTransform: 'uppercase',
            cursor: 'pointer', padding: 4,
          }}>Cancel · keep Pico's</button>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenReroll });
