// Surface 01 — Plan setup
//
// sg-WF-1 (workflow-overhaul). Canonical Plan creation + Plan edit surface
// that collapses today's S01 (Initiator landing) + S01b (Pre-quiz parameters)
// into one screen. Two modes — `create` and `edit` — driven by a single
// `mode` prop. Both modes share layout; only the headline + secondary CTA
// label differ.
//
// Inventory (five controls, flat eyebrow-per-control rhythm):
//   1. Name this plan       — required text input, 40-char cap
//   2. Who's coming         — single-select chips (occasion framing, not headcount)
//   3. Search area          — C-28 SearchAreaPicker chip
//   4. When are you eating  — single-select chips
//   5. How you want to eat  — single-select chips
//
// sg-SA-1 replaces the old active Setup `Where to` + `How far` split with
// one Search area chip. The full-screen editor is C-28; iOS wiring lands in
// the paired tracer bullets. See `surfaces/01-setup.md` for the full contract.
//
// iOS wiring is the paired tracer-bullet tb-WF-4; this JSX is the
// design-system contract only.

const GROUP_CONTEXTS  = ['Just me', 'Two of us', 'A group'];
const MEAL_TIMES      = ['Breakfast', 'Lunch', 'Dinner', 'Late night'];
const SERVICE_SHAPES  = ['Dine in', 'Outdoor seating', 'Takeout', 'Delivery'];

function ScreenSetup({
  mode = 'create',                              // 'create' | 'edit'
  // Initial values — host supplies these in edit mode to prefill from the
  // existing pending Plan. In create mode they default to the locked
  // workflow-overhaul defaults (Q10).
  initialName = '',
  initialGroupContext = 'A group',
  initialMealTime = 'Dinner',
  initialServiceShape = 'Dine in',
  initialSearchArea = {
    label: 'Mission, San Francisco',
    radiusMiles: 2.0,
  },
  onSearchAreaOpen = () => {},
  // Callbacks
  onPrimary = () => {},                         // Drop the invite link / Start the quiz
  onSecondary = () => {},                       // SAVE FOR LATER / SAVE CHANGES
}) {
  const [name, setName]                 = React.useState(initialName);
  const [groupContext, setGroupContext] = React.useState(initialGroupContext);
  const [mealTime, setMealTime]         = React.useState(initialMealTime);
  const [serviceShape, setServiceShape] = React.useState(initialServiceShape);
  const [searchArea]                    = React.useState(initialSearchArea);

  // Validation — workflow-overhaul Q10: name required for BOTH dock CTAs.
  const nameValid = name.trim().length > 0;

  // Headlines + dock labels — mode-driven.
  const headline    = mode === 'edit' ? 'Edit your plan' : 'Start a new plan';
  const secondary   = mode === 'edit' ? 'SAVE CHANGES'   : 'SAVE FOR LATER';
  // Primary label swaps on the live group context — solo gets quiz, group
  // gets invite. Default group context is `A group`, so first-paint is invite.
  const primary     = groupContext === 'Just me'
    ? 'Start the quiz'
    : 'Drop the invite link';

  // Reusable chip-section renderer — eyebrow + wrapping chip row.
  const Section = ({ eyebrow, options, value, onPick }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow opacity={0.6}>{eyebrow}</Eyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <Chip
            key={opt}
            label={opt.toUpperCase()}
            selected={value === opt}
            onClick={() => onPick(opt)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <GradientSurface stop="initiator">
      <div className="gti-canvas">
        <div className="content" style={{ overflowY: 'auto' }}>
          <div style={{
            padding: '64px 22px 24px',
            display: 'flex', flexDirection: 'column', gap: 22,
          }}>

            {/* GTIMark — top-left chrome (matches S01-initiator) */}
            <GTIMark size={22} />

            {/* Headline block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              <h1 className="gti-display" style={{
                fontSize: 44, lineHeight: 0.92, margin: 0,
                color: '#fff', textTransform: 'uppercase',
              }}>{headline}</h1>
              <p style={{
                margin: 0, fontSize: 15, fontWeight: 600, maxWidth: 300,
                color: 'rgba(14,16,17,0.78)',
              }}>One screen. Set it once. Share when you're ready.</p>
            </div>

            {/* 1. Name this plan — required text input.
                wfr-26 — eyebrow above the name input replaced by a
                persistent field label (sentence case, body-sm
                semibold, white-0.78) so the label doesn't read as a
                section heading. Persists during and after typing
                while the in-field placeholder disappears on type.
                The other rows keep the eyebrow treatment. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--ff-body)', fontSize: 14, fontWeight: 600,
                  color: 'rgba(255,255,255,0.78)',
                }}
              >Name this plan</span>
              <div style={{
                width: '100%', minHeight: 56,
                padding: '12px 16px',
                borderRadius: 'var(--r-row)',
                background: 'var(--glass-fill-soft)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px) saturate(160%)',
                WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                display: 'flex', alignItems: 'center',
              }}>
                <input
                  type="text"
                  value={name}
                  maxLength={40}
                  placeholder="Name this plan"
                  onChange={e => setName(e.target.value)}
                  aria-label="Name this plan"
                  style={{
                    appearance: 'none', border: 0, outline: 0,
                    background: 'transparent',
                    width: '100%',
                    fontFamily: 'var(--ff-body)',
                    fontSize: 17, fontWeight: 700,
                    color: '#fff',
                  }}
                />
              </div>
              {/* wfr-24 — adjacent character-limit hint (Input Hints
                  pattern). Overrides the surface doc's original
                  "no truncation indicator" line. */}
              <span style={{
                fontFamily: 'var(--ff-body)', fontSize: 13, fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
              }}>Up to 40 characters</span>
            </div>

            {/* 2. Who's coming — single-select chips (occasion framing) */}
            <Section
              eyebrow="Who's coming"
              options={GROUP_CONTEXTS}
              value={groupContext}
              onPick={setGroupContext}
            />

            {/* 3. Search area — C-28 SearchAreaPicker chip */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Eyebrow opacity={0.6}>Search area</Eyebrow>
              <SearchAreaPickerChip
                searchArea={searchArea}
                onOpen={onSearchAreaOpen}
              />
              <span style={{
                fontFamily: 'var(--ff-body)', fontSize: 13, fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
              }}>Choose the map area GetToIt should search.</span>
            </div>

            {/* 4. When are you eating — single-select chips */}
            <Section
              eyebrow="When are you eating"
              options={MEAL_TIMES}
              value={mealTime}
              onPick={setMealTime}
            />

            {/* 5. How you want to eat — single-select chips */}
            <Section
              eyebrow="How you want to eat"
              options={SERVICE_SHAPES}
              value={serviceShape}
              onPick={setServiceShape}
            />

            <div style={{ height: 4 }} />

            <CTADock>
              <PillCTA
                label={primary}
                fill="white"
                disabled={!nameValid}
                onClick={onPrimary}
              />
              {/* Secondary text link — eyebrow token treatment, same as today's
                  S01 SETTINGS link. Mode-driven label. Disabled in lockstep
                  with primary (per workflow-overhaul Q10 — both gated on name). */}
              <button
                onClick={onSecondary}
                disabled={!nameValid}
                aria-label={mode === 'edit'
                  ? 'Save changes and return to the plan list'
                  : 'Save this plan for later and return to the plan list'}
                style={{
                  appearance: 'none', background: 'transparent', border: 0,
                  cursor: nameValid ? 'pointer' : 'not-allowed',
                  minHeight: 44, marginTop: 4,
                  fontFamily: 'var(--ff-body)', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                  opacity: nameValid ? 1 : 0.45,
                }}
              >{secondary}</button>
            </CTADock>
          </div>
        </div>
      </div>
    </GradientSurface>
  );
}

Object.assign(window, { ScreenSetup });
