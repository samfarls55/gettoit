// Surface 12 — Next-day check-in
// Feeds the north-star metric: % of verdicts followed through on.
// One tap from a lock-screen notification — three big options, no form.

function ScreenCheckin({ onAdvance }) {
  // 'went' | 'skipped' | 'snooze' — the 'snooze' id commits the
  // `snoozed` outcome. bug-16: that write is terminal (one row per
  // user per room), so the third option's copy no longer promises a
  // re-ask — it reads as "didn't decide / leave it blank".
  const [tap, setTap] = React.useState(null);
  const [why, setWhy] = React.useState(null);

  return (
    <GradientSurface stop="checkin">
      <div className="gti-canvas">
        <div className="content">
          <div style={{
            padding: '0 22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <GTIMark size={16} />
            <div className="gti-eyebrow" style={{ color: '#fff', opacity: 0.6 }}>
              Yesterday's verdict
            </div>
          </div>

          {/* miniature recall of the verdict */}
          <div style={{ marginTop: 30, padding: '0 22px', textAlign: 'center', color: '#fff' }}>
            <Eyebrow style={{ opacity: 0.6, marginBottom: 8 }}>Wed Apr 23 · 7:00 PM</Eyebrow>
            <div className="gti-display" style={{
              fontSize: 44, letterSpacing: '-0.03em',
              textTransform: 'uppercase', lineHeight: 0.92,
            }}>Pico's<br/>Taqueria</div>
            <div style={{
              marginTop: 10, fontSize: 11, fontWeight: 700,
              opacity: 0.78, letterSpacing: 0.16, textTransform: 'uppercase',
            }}>4 in · 8 min walk</div>
          </div>

          {/* the question */}
          <div style={{ marginTop: 36, padding: '0 22px', textAlign: 'center' }}>
            <h2 className="gti-display" style={{
              margin: 0, fontSize: 32, color: '#fff',
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>Did you go?</h2>
          </div>

          {!tap ? (
            <div style={{
              marginTop: 26, padding: '0 22px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {[
                { id: 'went',    label: 'We went',            sub: 'And it was great',     fill: 'sun'   },
                { id: 'skipped', label: 'We skipped',         sub: 'Something came up',    fill: 'white' },
                { id: 'snooze',  label: "I'd rather not say", sub: "We'll leave it blank", fill: 'ghost' },
              ].map(o => (
                <button key={o.id} onClick={() => setTap(o.id)} style={{
                  appearance: 'none', cursor: 'pointer', border: 0,
                  padding: '16px 22px', borderRadius: 18,
                  background:
                    o.fill === 'sun' ? 'var(--sun)' :
                    o.fill === 'white' ? '#fff' : 'transparent',
                  color: o.fill === 'ghost' ? '#fff' : 'var(--ink)',
                  boxShadow:
                    o.fill === 'sun' ? '0 12px 28px rgba(255,210,63,0.35)' :
                    o.fill === 'white' ? '0 12px 28px rgba(0,0,0,0.16)' :
                    'inset 0 0 0 1.5px rgba(255,255,255,0.5)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  textAlign: 'left',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 16, letterSpacing: 0.06,
                    }}>{o.label}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, opacity: 0.7,
                      letterSpacing: 0.06, marginTop: 2,
                    }}>{o.sub}</div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 18, opacity: 0.7 }}>→</span>
                </button>
              ))}
            </div>
          ) : tap === 'skipped' ? (
            <div style={{
              marginTop: 20, padding: '0 22px',
              animation: 'gti-fade-up 320ms var(--ease-out-soft) both',
            }}>
              <div className="gti-eyebrow" style={{
                color: '#fff', opacity: 0.7, marginBottom: 10, textAlign: 'center',
              }}>What got in the way?</div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
              }}>
                {['Wallet/time','Group bailed','Place was packed','Mood shifted','Other'].map(r => (
                  <Chip key={r} label={r}
                    selected={why === r}
                    onClick={() => setWhy(r)} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: 20, padding: '32px 22px', textAlign: 'center', color: '#fff',
              animation: 'gti-fade-up 320ms var(--ease-out-soft) both',
            }}>
              <div className="gti-display" style={{ fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {tap === 'went'
                  ? '☼ Got it.'
                  : tap === 'skipped' ? 'Ok — tomorrow.' : 'Ok — no worries.'}
              </div>
              <p style={{
                margin: '14px auto 0', maxWidth: 280,
                fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.78)', lineHeight: 1.45,
              }}>
                {tap === 'went'
                  ? "Your follow-through is the only metric that matters. We'll remember Pico's worked."
                  : tap === 'skipped'
                    ? "We'll pop back tonight before your usual session window."
                    : "We've left this one blank — no follow-up. See you next session."}
              </p>
            </div>
          )}

          <CTADock>
            {tap ? (
              <PillCTA label="Done" fill="white" onClick={onAdvance} />
            ) : (
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.55)',
                textAlign: 'center', letterSpacing: 0.14,
                textTransform: 'uppercase', fontWeight: 700,
              }}>One tap, then we're gone for the day.</div>
            )}
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenCheckin });
