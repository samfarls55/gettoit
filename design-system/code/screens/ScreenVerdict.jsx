// Surface 09 — Verdict (hero) · 6 modes: 'default' | 'cuts' | 'committed' | 'read-only' | 'no-survivor' | 'solo'
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

// TB-13 — the `solo` variant is derived from the host-passed
// `members` array length when the host doesn't pass a `mode` override.
// The variant is also addressable explicitly via `mode='solo'`. Either
// path produces the same suppressed-receipt-row + save-taste-profile
// render. See `surfaces/05-verdict.md` §"solo".
function ScreenVerdict({
  mode = 'default',
  isInitiator = true,
  onAdvance,
  members = [
    { name: 'you'  },
    { name: 'alex' },
    { name: 'maya' },
    { name: 'sam'  },
  ],
}) {
  // Derive solo from `members.length === 1` when the caller didn't pass
  // a mode override that already names a variant. Explicit mode wins so
  // the design-system preview can force the variant for QA.
  const derivedSolo = members.length === 1 && mode === 'default';
  const isSolo = mode === 'solo' || derivedSolo;
  const isReadOnly = mode === 'read-only';
  const isNoSurvivor = mode === 'no-survivor';

  const [cutsOpen, setCutsOpen] = React.useState(mode === 'cuts');
  const [committed, setCommitted] = React.useState(mode === 'committed');
  const [widenOpen, setWidenOpen] = React.useState(false);
  const [widenRadius, setWidenRadius] = React.useState(3.0); // current + 1.0 mi

  React.useEffect(() => {
    setCutsOpen(mode === 'cuts');
    setCommitted(mode === 'committed');
    setWidenOpen(false);
  }, [mode]);

  const anim = (ms, dur = 700) => ({
    animation: `gti-rise ${dur}ms var(--ease-out-soft) ${ms}ms both`,
  });
  const pop = (ms) => ({
    animation: `gti-pop 520ms var(--ease-out-soft) ${ms}ms both`,
  });

  // Late-joiner is not in receipts — they didn't contribute. Solo
  // mode suppresses the row entirely (one voice doesn't need to be
  // receipted back to itself); the fixture list is unchanged so the
  // group-default render is identical to TB-06.
  const receipts = [
    { name: 'you',  action: 'wanted lively' },
    { name: 'alex', action: 'filtered shellfish' },
    { name: 'maya', action: 'capped at $30' },
    { name: 'sam',  action: 'capped at 15 min walk' },
  ];

  // Mode-shaped flags — keep the JSX flat below
  const eyebrowCopy =
    isNoSurvivor ? 'Tonight'
    : isReadOnly  ? "Tonight's verdict"
    :               'Tonight, the verdict is';

  const heroLines =
    isNoSurvivor ? ['No spot', 'fits']
    :              ["Pico's", 'Taqueria'];

  const metaCopy =
    isNoSurvivor ? 'Vegan options · $$ cap · 15 min walk'
    :              'Mexican · $$ · 8 min walk';

  const ruleCopy =
    isNoSurvivor ? 'Vegan options left no candidates within walking distance tonight.'
    :              'Budget cap cut Ren Soba. Pico’s had the lowest regret-of-omission.';

  const showTimeBadge = !isNoSurvivor;
  // Solo suppresses receipts — one voice doesn't need to be receipted
  // back to itself. The group-default still surfaces the row.
  const showReceipts = !isNoSurvivor && !isSolo;
  const showCutsDrawer = !isNoSurvivor;
  const showStartOverSecondary = !isReadOnly; // suppressed in read-only
  // Solo replaces the group-save affordance with the C-22 save-taste-
  // profile chip. The chip surfaces under the primary CTA when the user
  // is anonymous; the host hides it for already-linked users.
  const showSoloSaveChip = isSolo && !isReadOnly && !isNoSurvivor;

  return (
    <GradientSurface stop="verdict">
      <div className="gti-canvas">
        <div className="content">

          {/* eyebrow */}
          <div style={{ padding: '0 22px', textAlign: 'center', ...anim(VERDICT_CHOREO.eyebrow, 500) }}>
            <Eyebrow style={{ opacity: 0.86 }}>{eyebrowCopy}</Eyebrow>
          </div>

          {/* HERO — stacked one word per line */}
          <div style={{ padding: '14px 22px 0', textAlign: 'center' }}>
            <div className="gti-display" style={{
              fontSize: 60, color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '-0.03em', lineHeight: 0.9,
              ...anim(VERDICT_CHOREO.name, 800),
            }}>{heroLines[0]}<br/>{heroLines[1]}</div>

            <div style={{
              marginTop: 12, fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.88)',
              letterSpacing: 0.18, textTransform: 'uppercase',
              ...anim(VERDICT_CHOREO.meta, 500),
            }}>{metaCopy}</div>
          </div>

          {/* time badge — suppressed for no-survivor */}
          {showTimeBadge && (
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
                }}>{isSolo ? 'You' : 'All four of you'}</div>
              </div>
            </div>
          )}

          {/* rule sentence */}
          <div style={{
            marginTop: 22, padding: '0 26px', textAlign: 'center',
            ...anim(VERDICT_CHOREO.rule, 500),
          }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.45, textWrap: 'balance',
            }}>{ruleCopy}</p>
          </div>

          {/* voice receipts — suppressed for no-survivor */}
          {showReceipts && (
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
          )}

          {/* cuts drawer — suppressed for no-survivor */}
          {showCutsDrawer && (
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
          )}

          {/* No-survivor inline widen-radius expansion */}
          {isNoSurvivor && widenOpen && (
            <div style={{
              margin: '18px 22px 0',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.10)',
              border: '0.75px solid rgba(255,255,255,0.32)',
              borderRadius: 18,
              animation: 'gti-fade-up 320ms var(--ease-out-soft) both',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 4,
              }}>
                <div className="gti-eyebrow" style={{ color: '#fff', opacity: 0.78 }}>Widen to</div>
                <span style={{
                  fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.88)',
                }}>{widenRadius.toFixed(1)} MI</span>
              </div>
              <RangeSlider
                value={widenRadius} min={1.0} max={10.0} step={0.5}
                onChange={setWidenRadius}
                ariaLabel="Widen walk radius"
                valueLabel={`${widenRadius.toFixed(1)} miles`}
              />
            </div>
          )}

          {/* CTA */}
          <CTADock>
            <div style={anim(VERDICT_CHOREO.cta, 500)}>
              {isReadOnly ? (
                <PillCTA label="Start a new decision" fill="white" onClick={onAdvance} />
              ) : isNoSurvivor ? (
                <PillCTA
                  label={widenOpen ? `Re-run · ${widenRadius.toFixed(1)} mi` : 'Widen radius'}
                  fill="sun"
                  disabled={!isInitiator}
                  onClick={() => widenOpen ? onAdvance() : setWidenOpen(true)}
                />
              ) : !committed ? (
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

            {/* secondary — suppressed in read-only */}
            {showStartOverSecondary && (
              isNoSurvivor ? (
                <button onClick={onAdvance} style={{
                  appearance: 'none', border: 0, background: 'transparent',
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'var(--ff-body)', fontWeight: 800, fontSize: 12,
                  letterSpacing: 0.16, textTransform: 'uppercase',
                  cursor: 'pointer', padding: 12, marginTop: -6,
                }}>Start over</button>
              ) : (
                <button onClick={onAdvance} style={{
                  appearance: 'none', border: 0, background: 'transparent',
                  color: 'rgba(255,255,255,0.65)',
                  fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 11,
                  letterSpacing: 0.16, textTransform: 'uppercase',
                  cursor: 'pointer', padding: 6, marginTop: -6,
                }}>
                  {committed ? 'Window closes in 47s' : 'Start over'}
                </button>
              )
            )}

            {/* TB-13 — solo mode replaces the group-save affordance with
                the C-22 save-taste-profile chip. The chip surfaces in
                `default-idle` state for anonymous users; the host hides
                it (state='hidden') for already-linked users. Solo is the
                highest-conversion moment for Apple Sign-in (the user
                just demonstrated effort solo). See `components.md` §C-22. */}
            {showSoloSaveChip && (
              <div style={{ marginTop: 4 }}>
                <AuthUpgradeChip state="default" />
              </div>
            )}

            {/* TB-08 — pre-permission line. Voluntary warm-friend register; NEVER
                "Enable notifications" / "Allow alerts" / "Turn on push". The
                native iOS push prompt fires after the first "I'm in" tap (once
                per session). Suppressed in read-only + no-survivor. */}
            {!isReadOnly && !isNoSurvivor && (
              <div style={{
                marginTop: 8, padding: '0 8px', textAlign: 'center',
                color: 'rgba(255,255,255,0.55)',
                fontFamily: 'var(--ff-body)', fontSize: 11, fontWeight: 600,
              }}>
                We'll check in tomorrow — see if you went.
              </div>
            )}
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenVerdict, VERDICT_CHOREO });
