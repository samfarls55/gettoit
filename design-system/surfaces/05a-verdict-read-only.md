---
surface: 05a-verdict-read-only
status: locked
locked-date: 2026-05-26
jsx: []
---

# S05a · Read-only verdict

> **Parent:** [`05-verdict.md`](./05-verdict.md) (live verdict — `default` / `committed` / `solo`)
> **Sibling:** [`05b-no-survivor.md`](./05b-no-survivor.md) (widen-and-retry terminal)
> Per [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]] — the closed-verdict view is a single-intent Focus surface, distinct from the live verdict.

The Focus surface rendered when a viewer arrives at a `decided-expired` Plan, OR when a Web invitee deep-links into someone else's `decided-active` Plan they did not vote in. **One intent:** show a closed verdict as a record.

Same eyebrow / hero / time-badge / receipts shell as the live verdict (so a closed Plan reads visually continuous with how it looked while live), but stripped of every affordance that would imply the viewer can still influence the outcome:

- **No ratify.** The verdict is sealed. The `I'm in` pill is absent.
- **No reroll.** Only the live verdict surface burns rerolls.
- **No dock countdown.** No correctability window on a closed verdict.
- **No save-chip.** The C-22 chip is a solo-live affordance; the read-only path is a different intent.
- **No pre-permission line.** No ratification means no check-in to chase.

## Arrival vectors

The surface is reached two ways, distinguished by the `showHomeChrome` parameter:

| Arrival | `showHomeChrome` | Why |
|---|---|---|
| Account member tapping a Decided-active or History entry from PlanList | `true` | The Plan is on their list; Home pops back to PlanList |
| Account member deep-linking into their own `decided-expired` Plan | `true` | Same — their list owns the Plan |
| Account member tapping a Joined Decided card | `true` | They're a participating member; PlanList shows the Plan in **Joined** |
| Web invitee deep-linking into someone else's `decided-expired` Plan | `false` | The Web invitee has no Plan list (per *Web invitee* in `CONTEXT.md`) — `Home` has no honest destination |

The split is call-site knowledge — the surface itself takes the flag as an `init` parameter. Callers in `RootView` know which arrival vector they own.

## Verdict chrome (Done)

When `showHomeChrome` is true, the read-only surface carries a top-leading `Done` verb above the eyebrow. The verb is `Done` (not `Home`) because the late-joiner arrival vector — deep-linking into someone else's `decided-expired` Plan — has no Plan-list destination to land on, and the surface ships a single chrome verb across both vectors so VO and reduced-motion users get the same focus chain regardless of how they arrived.

| Element | Spec |
|---|---|
| Position | Top of the surface, above the eyebrow |
| `Done` | Top-leading |
| Top-trailing | Empty — same shape as the live verdict chrome |
| Type | Existing `eyebrow` token treatment — Inter 700 / 11 / tracking 0.18em / UPPERCASE |
| Color | white 0.78 |
| Icons | **None** — pure text label |
| Tap target | 44pt minimum (per HIG) |
| Tap behavior | Fires `onAdvance` — the same Solo Setup re-invite path the primary `Start a new decision` CTA uses |

When `showHomeChrome` is false (the Web-invitee arrival), the chrome row is omitted entirely — there is no honest destination to surface.

### Why `Done`, not `Home`

The late-joiner deep-link arrival has no Plan list to land on (the Plan isn't theirs), and the Web invitee arrival has no Plan list at all (per the *Web invitee* definition in `CONTEXT.md`). A `Home` verb in either case would either dump the user on the signed-in account holder's PlanList (for Account-member sub-vectors that mostly do have it) or on a nonexistent surface (for the Web-invitee case). `Done` frames the chrome as "close this read-only snapshot" — honest in both arrival shapes. The tap fires `onAdvance`, so the primary CTA path is the only destination either chrome or the body CTA can produce.

## Choreographed reveal

Same timing as the live verdict ([`05-verdict.md`](./05-verdict.md) §"Choreographed reveal"). The eyebrow / hero / meta / time-badge / rule chip / receipts / CTA fade-up steps all fire at the same canonical delays. The only difference is what lands at step 7 (1380ms): the re-invite CTA `"Start a new decision"` rather than `"I'm in"`.

## Layout

| Element | Visible state |
|---|---|
| Chrome row | `Done` top-leading when `showHomeChrome` is true; absent when false |
| Eyebrow | `"Tonight's verdict"` (past-tense-implicit) |
| Hero | Place name UPPERCASE stacked, one word per line — same shape as live |
| Meta line | `"Mexican · $$ · 8 min walk"` — same shape as live |
| Time badge | Same shape as live; suppressed audience subtitle when `audience` is empty (no-survivor sealed terminals reached via this surface) |
| Rule chip | Same active-voice register as live (`"Budget cap cut Ren Soba."`) |
| Receipts row | Lowercase first names + private-anonymized verbs — same as live. **Excludes the late-joiner** — they didn't vote |
| Primary CTA | `"Start a new decision"` white pill — fires `onAdvance` |

## Copy register (load-bearing)

- **`"Tonight's verdict"`** — past-tense-implicit. The late-joiner sees the decision already happened. Distinct from the live `"Tonight, the verdict is"`.
- **`"Start a new decision"`** — voluntary, framed as a new round (not "re-do" or "join late"). The Account member returns to PlanList; the Web invitee becomes the initiator of their own next session via Solo Setup.

## Voice and motor accessibility (VO)

- VO read order: chrome (when rendered) → eyebrow → hero → meta → time badge → rule chip → receipts (in order) → re-invite CTA.
- The absent ratification path is announced as **"Not available — this verdict is closed."** Surfaced as the `accessibilityHint` on the re-invite CTA so a VO user reading the focus chain hears the closure before they hear the CTA's action.
- Same locked string in `accessibility.md` §"Verdict (read-only mode)".

## Defends against

- **Retroactive influence by late-joiners.** Read-only mode honestly shows the verdict was sealed before they arrived. No receipt chip for them (would imply they contributed). No ratification (would imply their tap matters to the outcome).
- **Confusion about who owns the Plan.** The `Done` verb (not `Home`) is the chrome shape that doesn't promise a Plan-list destination the viewer might not have.

## Edge cases

- **No-survivor terminal reached via read-only.** A late-joiner deep-linking into a `decided-expired` Plan whose engine run produced no survivor still renders through this surface (not `05b-no-survivor.md`). The hero stacks as `NO SPOT / FITS`, the meta line is empty, the time badge audience is empty, the rule chip carries the load-bearing message. No widen CTA (initiator-only — and the late-joiner is not the initiator). Primary CTA is `"Start a new decision"` as on every other read-only render.
- **Sealed Plan reached from PlanList History.** Same render shape; `showHomeChrome` is true. Account member is already on the Plan; `Done` returns them to PlanList via the precedence-chain teardown.
