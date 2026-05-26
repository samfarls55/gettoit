// Surface 09 — Settings
// The minimal account-management surface. 0.1.0 ships exactly one action:
// delete the user's data (App Store 5.1.1(v) + ADR 0006). No toggles, no
// rows of options, no profile editor — the empty space is the feature.
// Reuses the registered `midnight` gradient so this surface visually
// steps out of the Sunset Pop ritual arc.
//
// CTA dock hierarchy (wfr-07, 2026-05-26): DONE is the visually dominant
// C-05 white PillCTA; DELETE MY DATA renders below it in the C-05 ghost
// destructive treatment. The no-red contract from `tokens.md §1.3`
// governs — destructive weight lives in the outline + copy + native
// confirm alert, never in a colored fill.

function ScreenSettings({ onDelete, onDone }) {
  return (
    <GradientSurface stop="midnight">
      <div style={{
        position: 'absolute', inset: 0,
        padding: '64px 22px 24px',
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}>
        <GTIMark size={22} />

        <div style={{ marginTop: 56 }}>
          <Eyebrow style={{ marginBottom: 14 }}>Your account</Eyebrow>
          <h1 className="gti-display" style={{
            fontSize: 36, lineHeight: 0.96, margin: 0,
            textTransform: 'uppercase',
          }}>
            Just one<br/>thing here<br/>for now.
          </h1>
        </div>

        <p style={{
          marginTop: 28, fontSize: 15, fontWeight: 600, lineHeight: 1.45,
          color: 'rgba(255,255,255,0.84)', maxWidth: 320,
        }}>
          Deletes everything: your sessions, your votes, your taste
          profile. Rooms you joined keep going — your spot in them
          clears. Can't be undone.
        </p>

        <CTADock>
          <PillCTA label="Done" fill="white" onClick={onDone} />
          <PillCTA label="Delete my data" fill="ghost" onClick={onDelete} />
        </CTADock>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenSettings });
