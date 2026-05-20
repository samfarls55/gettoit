// Surface 04 — Q2 · Budget cap
// Single-select tier. 4 fixed tiers — never a slider (slider creates per-user
// information asymmetry that doesn't survive the aggregate rule chip).

function ScreenQ2Budget({ onAdvance, onBack, onExit, role = 'initiator', solo = false }) {
  const [tier, setTier] = React.useState(1);
  const tiers = [
    { label: '$',    sub: 'Under $15' },
    { label: '$$',   sub: '$15 – $30' },
    { label: '$$$',  sub: '$30 – $60' },
    { label: '$$$$', sub: 'No cap'     },
  ];

  return (
    <GradientSurface stop="q2">
      <div className="gti-canvas">
        <div className="content">
          {/* sg-WF-2: Q2 chrome — Back + Exit. */}
          <QuizChrome role={role} solo={solo} onBack={onBack} onExit={onExit} />
          <TopBar step={2} total={5} />
          <div style={{ height: 40 }} />
          <QuestionHeader
            index={2} total={5}
            title="What's your max?"
            sub="Pick the ceiling — we won't suggest above it."
          />
          <div style={{
            marginTop: 20, padding: '0 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {tiers.map((t, i) => {
              const sel = tier === i;
              return (
                <button key={i} onClick={() => setTier(i)} style={{
                  appearance: 'none', border: 0, cursor: 'pointer',
                  textAlign: 'left', padding: '16px 20px',
                  borderRadius: 16,
                  background: sel ? 'var(--sun)' : 'rgba(255,255,255,0.06)',
                  color: sel ? 'var(--ink)' : '#fff',
                  border: sel ? '0' : '1.5px solid rgba(255,255,255,0.45)',
                  boxShadow: sel
                    ? '0 14px 30px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.4)'
                    : 'none',
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  transition: 'all 220ms var(--ease-out)',
                  transform: sel ? 'scale(1.015)' : 'scale(1)',
                }}>
                  <div style={{
                    fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: 32,
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>{t.label}</div>
                  <div style={{
                    fontWeight: 700, fontSize: 13,
                    letterSpacing: 0.08, textTransform: 'uppercase',
                    opacity: sel ? 0.8 : 0.78,
                  }}>{t.sub}</div>
                </button>
              );
            })}
          </div>
          <CTADock>
            <PillCTA label="Next" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenQ2Budget });
