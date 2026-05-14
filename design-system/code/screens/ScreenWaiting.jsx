// Surface 04 — Waiting / coordination
// Honest, calm. No spinners.
// v1: initiator gets a "Decide now" CTA (disabled until quorum); all members see a live countdown.
// TB-12: anonymous users on iOS get an Auth Upgrade Chip (C-22) above the
// other CTAs. Web fallback passes `platform="web"` and the chip stays hidden.
// sg-03 (v1.1): web-fallback anonymous voters get a "Download the app" CTA
// in the dock slot C-22 leaves empty on web. Exactly one of the two
// affordances ever renders for a given context — never both.

function ScreenWaiting({
  onAdvance,
  isInitiator = true,
  secondsRemaining = 462,
  // C-22 wiring — defaults model the canonical state: anonymous iOS user
  // who hasn't dismissed and hasn't linked yet, so the chip renders in
  // its `default` state.
  platform = 'ios',
  isAnonymous = true,
  authChipState = 'default', // 'default' | 'in-progress' | 'success' | 'dismissed' | 'hidden'
  onSaveTasteProfile = () => {},
  onDismissAuthChip = () => {},
  // sg-03 download CTA wiring — fires when the user taps "Download the
  // app" on the web fallback. Caller routes them to the App Store URL
  // (itms-apps:// on iOS Safari, https://apps.apple.com elsewhere) and
  // emits the waiting_download_cta_tapped telemetry event.
  onDownloadApp = () => {},
}) {
  const people = [
    { name: 'You',  color: '#FFD23F', answered: true },
    { name: 'Alex', color: '#7DDFB5', answered: true },
    { name: 'Maya', color: '#FF8DA1', answered: true },
    { name: 'Sam',  color: '#9BC0FF', answered: false },
  ];
  const done = people.filter(p => p.answered).length;
  const quorum = done >= 2;

  const mm = Math.floor(secondsRemaining / 60);
  const ss = String(secondsRemaining % 60).padStart(2, '0');
  const countdownLabel = `Auto-fires in ${mm}:${ss}`;

  const decideLabel = quorum
    ? `Decide now · ${done} of ${people.length} in`
    : `Decide now · need 2 in`;

  return (
    <GradientSurface stop="waiting">
      <div className="gti-canvas">
        <div className="content">
          <div style={{
            padding: '0 22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <GTIMark size={16} />
            <div className="gti-eyebrow" style={{ color: '#fff', opacity: 0.6 }}>
              You're in
            </div>
          </div>

          <div style={{
            flex: 1, padding: '40px 22px 0',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          }}>
            <div className="gti-display" style={{
              fontSize: 76, color: '#fff', letterSpacing: '-0.03em', lineHeight: 0.95,
            }}>{done} of {people.length}</div>
            <div className="gti-display" style={{
              fontSize: 34, color: 'rgba(255,255,255,0.85)',
              letterSpacing: '-0.02em', lineHeight: 1, marginTop: 6,
              textTransform: 'uppercase',
            }}>are in</div>

            <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
              {people.map(p => (
                <div key={p.name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <AvatarDot {...p} size={48} />
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    letterSpacing: 0.1, textTransform: 'uppercase',
                    opacity: p.answered ? 1 : 0.55,
                  }}>{p.name}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 36,
              fontSize: 14, fontWeight: 600,
              color: 'rgba(255,255,255,0.78)', maxWidth: 260,
            }}>
              <span style={{ fontWeight: 800 }}>Sam</span> is still answering. We'll surface the verdict the second they're done — no spinners, promise.
            </div>
          </div>

          {/* low-emphasis live countdown — every member sees it */}
          <div style={{
            padding: '0 22px',
            textAlign: 'center',
            fontFamily: 'var(--ff-mono)',
            fontSize: 11, fontWeight: 500,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 14,
          }}>{countdownLabel}</div>

          <CTADock>
            {/* C-22 Auth Upgrade Chip — iOS-only, anonymous-only. Web
                fallback (TB-15) passes platform="web" so the chip is
                hidden per ADR 0007 ("Web fallback voters stay anonymous
                indefinitely"). Linked-Apple users also render `hidden`. */}
            {platform === 'ios' && isAnonymous && (
              <AuthUpgradeChip
                state={authChipState}
                onSave={onSaveTasteProfile}
                onDismiss={onDismissAuthChip}
              />
            )}
            {/* sg-03 "Download the app" CTA — web fallback, anonymous-only.
                Replaces the dock slot C-22 leaves empty on web. iOS users
                are already in the app so this CTA is suppressed; Apple-
                linked web users (returning) have a real identity so it is
                also suppressed. Exactly one of {C-22, this CTA} ever
                renders for a given context. */}
            {platform === 'web' && isAnonymous && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'stretch', gap: 8,
              }}>
                <PillCTA
                  label="Download the app"
                  fill="white"
                  onClick={onDownloadApp}
                />
                <div style={{
                  fontFamily: 'var(--ff-body)',
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.6)',
                  textAlign: 'center',
                }}>Then your votes save with you</div>
              </div>
            )}
            {isInitiator && (
              <PillCTA
                label={decideLabel}
                fill="ghost"
                disabled={!quorum}
                onClick={onAdvance}
              />
            )}
            <PillCTA label="Nudge Sam" fill="ghost" onClick={onAdvance} />
          </CTADock>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenWaiting });
