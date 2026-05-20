// Surface 00 — Plan list
//
// sg-WF-4 (workflow-overhaul). The new app entry surface, replacing
// S00 Landing. A sectioned list of the user's Plans (Pending → Decided
// → History) with a floating create affordance (C-26 FAB) and per-card
// three-dot menus (C-25) for the destructive actions. Reminders-app
// spirit — persistent named items, mechanical newest-event-first
// ordering within each section, sections that hide when empty.
//
// The host surface supplies pre-sorted `pending`, `decided`, `history`
// arrays. The JSX is data-agnostic — it knows nothing about Supabase
// or about per-joiner quiz progress; the iOS port (tb-WF-5..9) owns
// the SQL and the resume-from-state routing.
//
// Plan card shape (props):
//   {
//     id,                    // stable key
//     name,                  // display string
//     verdictPlaceName,      // string | null — populated on Decided/History
//     role,                  // 'created' | 'joined'
//     status,                // 'pending' | 'decided-active' | 'decided-expired'
//                            // (the list bucket — pending → Pending,
//                            //  decided-active → Decided, decided-expired
//                            //  → History; the spec talks in section names
//                            //  but the data layer talks in card status)
//   }
//
// Built from existing primitives + the two new C-25 / C-26 primitives
// in `components.jsx`. The disambig sheet and confirm sheet are
// composed inline from the C-16 sheet language (radius 26, dark glass,
// 38×4 handle) and stacked C-05 `ghost` pills — single-use, single
// surface, so they live here rather than in `components.jsx`.

function ScreenPlanList({
  // Data — host supplies three pre-sorted arrays. Joined-card resume
  // state is owned by the iOS layer; this JSX just calls `onTapCard`.
  pending = [],
  decided = [],
  history = [],
  // Empty-state hero — when all three arrays are empty, the list flips
  // to the centered hero block. Pass `forceEmpty` to preview.
  forceEmpty = false,
  // Callbacks
  onTapCard = () => {},               // (plan) => void
  onEditPlan = () => {},              // (plan) => void   — Created Pending menu
  onDeletePlan = () => {},            // (plan) => void   — Created (any)
  onLeavePlan = () => {},             // (plan) => void   — Joined (any)
  onCreate = () => {},                // ({ groupContext }) => void
}) {
  const isEmpty = forceEmpty
    || (pending.length === 0 && decided.length === 0 && history.length === 0);

  // History collapse state — default expanded on first viewing,
  // persists per-session. The JSX owns the state because it is
  // surface-local UI; iOS port owns its own equivalent.
  const [historyOpen, setHistoryOpen] = React.useState(true);

  // Which card has its menu open. Only one menu is ever open at a time.
  const [openMenuId, setOpenMenuId] = React.useState(null);

  // Destructive confirm sheet — the host card and the chosen verb.
  // `verb` is 'delete' | 'leave'; the title/body/pill are derived from
  // the card status + verb.
  const [confirm, setConfirm] = React.useState(null);   // { plan, verb } | null

  // Disambig sheet — opens from the FAB or the empty-state hero pill.
  const [disambigOpen, setDisambigOpen] = React.useState(false);

  // Helpers ---------------------------------------------------------

  const closeMenu = () => setOpenMenuId(null);

  const menuItemsFor = (plan) => {
    if (plan.role === 'joined') {
      return [{
        label: 'Leave plan',
        onSelect: () => setConfirm({ plan, verb: 'leave' }),
      }];
    }
    // role === 'created'
    if (plan.status === 'pending') {
      return [
        { label: 'Edit plan', onSelect: () => onEditPlan(plan) },
        { label: 'Delete plan', onSelect: () => setConfirm({ plan, verb: 'delete' }) },
      ];
    }
    return [
      { label: 'Delete plan', onSelect: () => setConfirm({ plan, verb: 'delete' }) },
    ];
  };

  const confirmCopyFor = ({ plan, verb }) => {
    if (verb === 'leave') {
      return {
        title: 'Leave this plan?',
        body: 'Your answers will be removed. The room continues for everyone else.',
        primary: 'Leave plan',
        dismiss: 'STAY',
        onPrimary: () => onLeavePlan(plan),
      };
    }
    // delete
    if (plan.status === 'pending') {
      return {
        title: 'Delete this plan?',
        body: "Nothing's been decided yet — no one's been notified.",
        primary: 'Delete plan',
        dismiss: 'KEEP',
        onPrimary: () => onDeletePlan(plan),
      };
    }
    if (plan.status === 'decided-active') {
      return {
        title: 'Delete this plan?',
        body: 'The active room will end. Joiners will see a session-ended notice.',
        primary: 'Delete plan',
        dismiss: 'KEEP',
        onPrimary: () => onDeletePlan(plan),
      };
    }
    // decided-expired → History
    return {
      title: 'Remove from history?',
      body: 'The verdict will be deleted permanently.',
      primary: 'Remove',
      dismiss: 'KEEP',
      onPrimary: () => onDeletePlan(plan),
    };
  };

  // PlanCard --------------------------------------------------------

  const PlanCard = ({ plan }) => {
    const showVerdict = plan.status === 'decided-active'
      || plan.status === 'decided-expired';
    const isJoined = plan.role === 'joined';
    const menuOpen = openMenuId === plan.id;

    return (
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start',
        padding: '14px 18px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        minHeight: showVerdict ? 76 : 64,
        transition: 'background 140ms var(--ease-out)',
        gap: 12,
      }}>
        <button
          type="button"
          onClick={() => onTapCard(plan)}
          style={{
            appearance: 'none', border: 0, background: 'transparent',
            flex: 1, textAlign: 'left', cursor: 'pointer',
            padding: 0, color: '#fff',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {isJoined && (
            <div className="gti-eyebrow" style={{
              color: 'var(--sun)', marginBottom: 6,
            }}>Joined</div>
          )}
          <div style={{
            fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 17,
            lineHeight: 1.2, color: '#fff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{plan.name}</div>
          {showVerdict && plan.verdictPlaceName && (
            <div style={{
              marginTop: 4,
              fontFamily: 'var(--ff-body)', fontWeight: 500, fontSize: 13,
              lineHeight: 1.3, color: 'rgba(255,255,255,0.7)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{plan.verdictPlaceName}</div>
          )}
        </button>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ActionDotMenuTrigger
            open={menuOpen}
            onToggle={() => setOpenMenuId(menuOpen ? null : plan.id)}
            ariaLabel={`More actions for ${plan.name}`}
          />
          {menuOpen && (
            <ActionDotMenu
              items={menuItemsFor(plan)}
              onDismiss={closeMenu}
            />
          )}
        </div>
      </div>
    );
  };

  // SectionHeader ---------------------------------------------------

  const SectionHeader = ({ label, count, collapsible, open, onToggle }) => (
    <button
      type="button"
      onClick={collapsible ? onToggle : undefined}
      aria-expanded={collapsible ? (open ? 'true' : 'false') : undefined}
      style={{
        appearance: 'none', border: 0, background: 'transparent',
        width: '100%',
        padding: '12px 22px 8px',
        display: 'flex', alignItems: 'center', gap: 6,
        minHeight: 44,
        cursor: collapsible ? 'pointer' : 'default',
        color: '#fff',
      }}
    >
      <span className="gti-eyebrow" style={{ opacity: 0.78 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--ff-body)', fontWeight: 700, fontSize: 11,
        letterSpacing: 0.1,
        color: 'rgba(255,255,255,0.55)',
      }}>({count})</span>
      {collapsible && (
        <span aria-hidden="true" style={{
          marginLeft: 'auto',
          fontFamily: 'var(--ff-body)', fontWeight: 900, fontSize: 14,
          color: 'rgba(255,255,255,0.55)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 200ms var(--ease-out)',
        }}>›</span>
      )}
    </button>
  );

  // Sections list ---------------------------------------------------

  const Section = ({ rows }) => (
    <div style={{
      padding: '0 22px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {rows.map(p => <PlanCard key={p.id} plan={p} />)}
    </div>
  );

  // Empty-state hero ------------------------------------------------

  const EmptyHero = () => (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 22px',
      color: '#fff',
    }}>
      <div style={{
        maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16,
        alignItems: 'stretch',
      }}>
        <Eyebrow opacity={0.6} style={{ textAlign: 'center' }}>No plans yet</Eyebrow>
        <p style={{
          margin: 0,
          fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: 15,
          lineHeight: 1.4, color: 'rgba(255,255,255,0.78)',
          maxWidth: 260, alignSelf: 'center', textAlign: 'center',
          textWrap: 'balance',
        }}>
          This is where your Plans live — solo nights, group dinners,
          anything you'd rather decide once and forget.
        </p>
        <div style={{ marginTop: 8 }}>
          <PillCTA
            label="Create your first plan"
            fill="white"
            onClick={() => setDisambigOpen(true)}
          />
        </div>
      </div>
    </div>
  );

  // Disambig sheet --------------------------------------------------

  const DisambigSheet = () => {
    if (!disambigOpen) return null;
    const close = () => setDisambigOpen(false);
    const pick = (groupContext) => {
      close();
      onCreate({ groupContext });
    };
    return (
      <>
        <div
          onClick={close}
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.32)',
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Start a plan"
          style={{
            position: 'absolute', zIndex: 21,
            left: 12, right: 12, bottom: 12,
            background: 'rgba(20,20,30,0.92)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderRadius: 26,
            border: '1px solid rgba(255,255,255,0.10)',
            padding: '22px 22px 18px',
            color: '#fff',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
            animation: 'gti-fade-up 380ms var(--ease-out-soft) both',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* handle */}
          <div style={{
            width: 38, height: 4, borderRadius: 999,
            background: 'rgba(255,255,255,0.22)',
            margin: '0 auto 18px',
          }} />

          <Eyebrow opacity={0.6} style={{ marginBottom: 6 }}>Start a plan</Eyebrow>
          <h2 className="gti-display" style={{
            margin: 0, marginBottom: 18,
            fontSize: 26, lineHeight: 0.95,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
          }}>Who's coming?</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PillCTA label="Solo"  fill="ghost" onClick={() => pick('solo')}  />
            <PillCTA label="Group" fill="ghost" onClick={() => pick('group')} />
          </div>
        </div>
      </>
    );
  };

  // Confirm sheet ---------------------------------------------------

  const ConfirmSheet = () => {
    if (!confirm) return null;
    const copy = confirmCopyFor(confirm);
    const close = () => setConfirm(null);
    return (
      <>
        <div
          onClick={close}
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: 'rgba(0,0,0,0.32)',
          }}
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={copy.title}
          style={{
            position: 'absolute', zIndex: 31,
            left: 12, right: 12, bottom: 12,
            background: 'rgba(20,20,30,0.92)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderRadius: 26,
            border: '1px solid rgba(255,255,255,0.10)',
            padding: '22px 22px 18px',
            color: '#fff',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
            animation: 'gti-fade-up 380ms var(--ease-out-soft) both',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* handle */}
          <div style={{
            width: 38, height: 4, borderRadius: 999,
            background: 'rgba(255,255,255,0.22)',
            margin: '0 auto 18px',
          }} />

          <h2 className="gti-display" style={{
            margin: 0, marginBottom: 10,
            fontSize: 26, lineHeight: 0.95,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
          }}>{copy.title}</h2>
          <p style={{
            margin: 0, marginBottom: 22,
            fontSize: 14, fontWeight: 500,
            color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.45, maxWidth: 320, textWrap: 'balance',
          }}>{copy.body}</p>

          <PillCTA
            label={copy.primary}
            fill="white"
            onClick={() => { copy.onPrimary(); close(); }}
          />
          <button
            type="button"
            onClick={close}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              marginTop: 8,
              minHeight: 44,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'var(--ff-body)',
              fontWeight: 700, fontSize: 11,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              cursor: 'pointer', alignSelf: 'center', padding: '12px 16px',
            }}
          >{copy.dismiss}</button>
        </div>
      </>
    );
  };

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  return (
    <GradientSurface stop="initiator">
      {isEmpty ? (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            padding: '64px 22px 24px',
            display: 'flex', flexDirection: 'column', color: '#fff',
          }}>
            <GTIMark size={22} />
          </div>
          <EmptyHero />
        </>
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          padding: '64px 0 96px',
          display: 'flex', flexDirection: 'column', color: '#fff',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '0 22px 8px' }}>
            <GTIMark size={22} />
          </div>
          <Eyebrow style={{ padding: '12px 22px 0', opacity: 0.78 }}>
            Welcome back
          </Eyebrow>

          {pending.length > 0 && (
            <>
              <SectionHeader label="Pending" count={pending.length} />
              <Section rows={pending} />
            </>
          )}
          {decided.length > 0 && (
            <>
              <SectionHeader label="Decided" count={decided.length} />
              <Section rows={decided} />
            </>
          )}
          {history.length > 0 && (
            <>
              <SectionHeader
                label="History"
                count={history.length}
                collapsible={true}
                open={historyOpen}
                onToggle={() => setHistoryOpen(!historyOpen)}
              />
              {historyOpen && <Section rows={history} />}
            </>
          )}
        </div>
      )}

      {/* FAB — populated state only. Suppressed in empty state per
          the surface doc (the hero pill is the sole create affordance
          on first launch / zero-Plan state). */}
      {!isEmpty && (
        <FloatingActionButton
          onClick={() => setDisambigOpen(true)}
          ariaLabel="Start a new plan"
        />
      )}

      <DisambigSheet />
      <ConfirmSheet />
    </GradientSurface>
  );
}

Object.assign(window, { ScreenPlanList });
