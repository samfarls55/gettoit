// Surface 01 — Plan setup
//
// sg-WF-1 (workflow-overhaul). Canonical Plan creation + Plan edit surface
// that collapses today's S01 (Initiator landing) + S01b (Pre-quiz parameters)
// into one screen. Two modes — `create` and `edit` — driven by a single
// `mode` prop. Both modes share layout; only the headline + secondary CTA
// label differ.
//
// Inventory (six controls, flat eyebrow-per-control rhythm):
//   1. Name this plan       — required text input, 40-char cap
//   2. Who's coming         — single-select chips (occasion framing, not headcount)
//   3. Where to             — C-23 LocationPicker (existing)
//   4. When are you eating  — single-select chips
//   5. How you want to eat  — single-select chips
//   6. How far              — C-21 RangeSlider variant (non-uniform steps + 1.0 mi tick)
//
// Built from existing primitives only — the only spec deepening is the
// C-21 variant (optional `steps` array + `tickAt` prop). See the surface
// doc `surfaces/01-setup.md` for the full contract, including the spec
// exception against S01-initiator's "no name your night" defense.
//
// iOS wiring is the paired tracer-bullet tb-WF-4; this JSX is the
// design-system contract only.

// Distance slider snap-list (workflow-overhaul Q8) — non-uniform:
// 0.25 mi step under 1 mi (walking range), 0.5 mi from 1–5 mi, 1.0 mi
// from 5–10 mi. Tick anchors the implicit walk/drive boundary at 1.0 mi.
const DISTANCE_STEPS = [
  0.25, 0.5, 0.75,
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
  6.0, 7.0, 8.0, 9.0, 10.0,
];

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
  initialDistance = 1.0,
  // C-23 LocationPicker wiring — host surface supplies state + place.
  // Defaults model the canonical post-pre-prime granted state for preview.
  locationState = 'auto',                       // 'auto' | 'manual' | 'stale' | 'empty' | 'loading'
  locationPlace = { name: 'Mission · San Francisco', sub: 'San Francisco, CA' },
  onLocationOpen = () => {},
  // Callbacks
  onPrimary = () => {},                         // Drop the invite link / Start the quiz
  onSecondary = () => {},                       // SAVE FOR LATER / SAVE CHANGES
}) {
  const [name, setName]                 = React.useState(initialName);
  const [groupContext, setGroupContext] = React.useState(initialGroupContext);
  const [mealTime, setMealTime]         = React.useState(initialMealTime);
  const [serviceShape, setServiceShape] = React.useState(initialServiceShape);
  const [distance, setDistance]         = React.useState(initialDistance);

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

            {/* 1. Name this plan — required text input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Eyebrow opacity={0.6}>Name this plan</Eyebrow>
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
            </div>

            {/* 2. Who's coming — single-select chips (occasion framing) */}
            <Section
              eyebrow="Who's coming"
              options={GROUP_CONTEXTS}
              value={groupContext}
              onPick={setGroupContext}
            />

            {/* 3. Where to — existing C-23 LocationPicker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Eyebrow opacity={0.6}>Where to</Eyebrow>
              <LocationPickerChip
                state={locationState}
                place={locationPlace}
                onOpen={onLocationOpen}
              />
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

            {/* 6. How far — C-21 RangeSlider variant with non-uniform steps + 1.0 mi tick */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <Eyebrow opacity={0.6}>How far</Eyebrow>
                <span style={{
                  fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.88)',
                }}>{distance.toFixed(1)} MI</span>
              </div>
              <RangeSlider
                value={distance}
                steps={DISTANCE_STEPS}
                tickAt={1.0}
                onChange={setDistance}
                ariaLabel="Plan distance"
                valueLabel={`${distance.toFixed(1)} miles`}
              />
            </div>

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
