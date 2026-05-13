// Surface 09 — Verdict (hero) · 3 modes: 'default' | 'cuts' | 'committed'
// Choreographed reveal is canon (~1.4s).  Five-second test:
//   verdict → rule → receipts → ratify → correctability — all in priority read order.

const VERDICT_CHOREO = {
  eyebrow:  80,
  name:    280,
  meta:    700,
  time:    820,
  rule:   1020,
  receipts: 1140,
  cta:    1380,
};

function ScreenVerdict({ mode = 'default', onAdvance }) {
  const [cutsOpen, setCutsOpen] = React.useState(mode !== 'default');
  const [committed, setCommitted] = React.useState(mode === 'committed');

  React.useEffect(() => {
    setCutsOpen(mode !== 'default');
    setCommitted(mode === 'committed');
  }, [mode]);

  const anim = (ms, dur = 700) => ({
    animation: `gti-rise ${dur}ms var(--ease-out-soft) ${ms}ms both`,
  });
  const pop = (ms) => ({
    animation: `gti-pop 520ms var(--ease-out-soft) ${ms}ms both`,
  });

  const receipts = [
    { name: 'you',  action: 'wanted lively' },
    { name: 'alex', action: 'filtered shellfish' },
    { name: 'maya', action: 'capped at $30' },
    { name: 'sam',  action: 'capped at 15 min walk' },
  ];

  return (
    <GradientSurface stop="verdict">
      <div className="gti-canvas">
        <div className="content">

          {/* eyebrow */}
          <div style={{ padding: '0 22px', textAlign: 'center', ...anim(VERDICT_CHOREO.eyebrow, 500) }}>
            <Eyebrow style={{ opacity: 0.86 }}>Tonight, the verdict is</Eyebrow>
          </div>

          {/* HERO — stacked one word per line */}
          <div style={{ padding: '14px 22px 0', textAlign: 'center' }}>
            <div className="gti-display" style={{
              fontSize: 60, color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '-0.03em', lineHeight: 0.9,
              ...anim(VERDICT_CHOREO.name, 800),
            }}>Pico's<br/>Taqueria</div>

            <div style={{
              marginTop: 12, fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.88)',
              letterSpacing: 0.18, textTransform: 'uppercase',
              ...anim(VERDICT_CHOREO.meta, 500),
            }}>Mexican · $$ · 8 min walk</div>
          </div>

          {/* time badge */}
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: 'var(--sun)', color: 'var(--ink)',
              padding: '12px 30px', borderRadius: 16, textAlign: 'center',
              boxShadow: '0 18px 38px rgba(255,210,63,0.36), inset 0 1px 0 rgba(255,255,255,0.5)',
              ...pop(VERDICT_CHOREO.time),
            }}>
              <div className="gti-display" style={{ fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1 }}>
                7:00 PM
              </div>
              <div style={{
                marginTop: 4, fontSize: 9, fontWeight: 800,
                letterSpacing: 0.18, textTransform: 'uppercase',
              }}>All four of you</div>
            </div>
          </div>

          {/* rule sentence — names what cut what, never who */}
          <div style={{
            marginTop: 22, padding: '0 26px', textAlign: 'center',
            ...anim(VERDICT_CHOREO.rule, 500),
          }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.45, textWrap: 'balance',
            }}>
              Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.
            </p>
          </div>

          {/* voice receipts */}
          <div style={{
            marginTop: 22, padding: '0 22px',
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
          }}>
            {receipts.map((r, i) => (
              <ReceiptChip key={r.name}
                name={r.name} action={r.action}
                delay={VERDICT_CHOREO.receipts + i * 80}
              />
            ))}
          </div>

          {/* cuts drawer */}
          <div style={{ marginTop: 18, padding: '0 22px' }}>
            {!cutsOpen ? (
              <button onClick={() => setCutsOpen(true)} style={{
                appearance: 'none', border: 0, background: 'transparent',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                width: '100%', textAlign: 'center', padding: 8,
                fontFamily: 'var(--ff-body)', fontSize: 11, fontWeight: 800,
                letterSpacing: 0.16, textTransform: 'uppercase',
                ...anim(VERDICT_CHOREO.cta - 100, 500),
              }}>See what got cut →</button>
            ) : (
              <div style={{ animation: 'gti-fade-up 360ms var(--ease-out-soft) both' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0 4px 8px',
                }}>
                  <div className="gti-eyebrow" style={{ color: '#fff', opacity: 0.7 }}>
                    What got cut
                  </div>
                  <button onClick={() => setCutsOpen(false)} style={{
                    appearance: 'none', border: 0, background: 'transparent',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                    fontFamily: 'var(--ff-body)', fontSize: 10, fontWeight: 800,
                    letterSpacing: 0.14, textTransform: 'uppercase', padding: 2,
                  }}>Hide</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { name: 'Ren Soba',   reason: 'over budget cap' },
                    { name: 'Café Lou',   reason: 'shellfish veto' },
                    { name: 'Halal Cart', reason: 'outside walk range' },
                  ].map((c, i) => (
                    <div key={c.name} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      padding: '8px 12px', borderRadius: 10,
                      background: 'rgba(0,0,0,0.18)',
                      animation: `gti-fade-up 340ms var(--ease-out-soft) ${i * 60}ms both`,
                    }}>
                      <span style={{
                        textDecoration: 'line-through',
                        textDecorationColor: 'rgba(255,255,255,0.6)',
                        textDecorationThickness: 1.5,
                        fontWeight: 800, fontSize: 14, color: '#fff',
                      }}>{c.name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: 'rgba(255,255,255,0.7)', letterSpacing: 0.06,
                      }}>{c.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <CTADock>
            <div style={anim(VERDICT_CHOREO.cta, 500)}>
              {!committed ? (
                <PillCTA label="I'm in" fill="white" onClick={() => setCommitted(true)} />
              ) : (
                <PillCTA
                  label="You're in · 3 of 4"
                  prefix={<span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--ink)', color: 'var(--sun)',
                    fontSize: 12, fontWeight: 900,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</span>}
                  fill="sun"
                />
              )}
            </div>
            <button onClick={onAdvance} style={{
              appearance: 'none', border: 0, background: 'transparent',
              color: 'rgba(255,255,255,0.65)',
              fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 11,
              letterSpacing: 0.16, textTransform: 'uppercase',
              cursor: 'pointer', padding: 6, marginTop: -6,
            }}>
              {committed ? 'Window closes in 47s' : 'Start over'}
            </button>
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenVerdict, VERDICT_CHOREO });
