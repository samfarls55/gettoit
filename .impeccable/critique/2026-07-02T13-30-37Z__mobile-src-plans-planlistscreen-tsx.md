---
target: app dashboard page
total_score: 19
p0_count: 0
p1_count: 4
timestamp: 2026-07-02T13-30-37Z
slug: mobile-src-plans-planlistscreen-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading and error states exist, but no skeletons, retry, or delete failure feedback. |
| 2 | Match System / Real World | 2 | "Vote Now" and "Created" do not match what the user actually does on a pending plan. |
| 3 | User Control and Freedom | 2 | Delete confirmation exists, but there is no undo or recovery if deletion fails. |
| 4 | Consistency and Standards | 2 | The bottom nav looks navigable but only the settings and plan cards are real controls. |
| 5 | Error Prevention | 2 | Created status chip doubles as delete affordance, which makes a destructive action too easy to misread. |
| 6 | Recognition Rather Than Recall | 2 | Important live cards hide horizontally, and inactive nav destinations are visible but inert. |
| 7 | Flexibility and Efficiency | 1 | No batch, filter, search, shortcut, or compact path for a heavy history list. |
| 8 | Aesthetic and Minimalist Design | 3 | Strong visual identity, but display typography and decorative scale overpower task scanning. |
| 9 | Error Recovery | 1 | Generic unavailable state has no retry, and delete errors are not surfaced in the dashboard. |
| 10 | Help and Documentation | 1 | Empty and loading states do little teaching, and there is no contextual help. |
| **Total** | | **19/40** | **Poor: visually confident, product behavior still under-specified.** |

## Anti-Patterns Verdict

**LLM assessment**: This does not look like the usual AI dashboard template. It avoids metric cards, gradient text, and generic SaaS composition. The failure is product slop instead: a luxury editorial treatment is applied to a repeated-use dashboard. The screen is pretty, but users have to decode which elements are actions, which labels are state, and why a food decision app feels like a premium archive.

**Deterministic scan**: CLI scan on `mobile/src/plans/PlanListScreen.tsx` returned `[]`. Browser overlay found 31 rule hits: 23 `cramped-padding`, 5 `clipped-overflow-container`, 1 `gray-on-color`, and 2 `low-contrast`. The most credible hit is low contrast in the active bottom nav label: `#d0c5af` on `#6f6100` is 3.6:1, below the 4.5:1 target. The `#e5e2e1` on `#ffb77b` 1.3:1 hit appears around copper avatar/button coloring and should be verified in the exact element before patching. Many cramped-padding hits are noisy React Native wrapper divs, but the pattern matches the visual issue: cards and nav feel compressed at phone width.

**Visual overlays**: Injection succeeded in a `[Human]` browser tab and an overlay screenshot was saved to `output/playwright/impeccable-dashboard-overlay.png`. The live browser was closed after capture, so no overlay remains active.

## Overall Impression

The dashboard is handsome but not yet trustworthy. The single biggest opportunity is to make the dashboard act like a fast task surface: clearer primary action, real navigation affordances, compact scan-friendly typography, and responsive structure beyond phone width.

## What's Working

- The dark gold identity is distinctive and consistent with the existing Luxe Midnight tokens.
- The top-level buckets, Live Plans and Past Plans, are understandable within a few seconds.
- Delete confirmation is inline instead of modal-first, which fits the app's friction-for-correctability principle.

## Priority Issues

**[P1] Action semantics are misleading**

**Why it matters**: The created card shows `Vote Now`, but opening it routes to setup/edit behavior. The `Created` chip is also the delete trigger. A tired dinner organizer will misread both.

**Fix**: Rename the card CTA to the real action, such as `Finish setup` or `Open plan`. Move delete behind a clear icon button or overflow action with a destructive label. Keep status as status only.

**Suggested command**: `$impeccable clarify`

**[P1] Tablet and wide web layout is just the phone layout stretched sideways**

**Why it matters**: At 820px wide, live cards run in one horizontal rail, past plans stretch into long slabs, and the bottom mobile tab bar remains fixed across the whole viewport. It feels unfinished on anything larger than a phone.

**Fix**: Add a breakpoint: constrain the app shell to phone width for a mobile-only product, or introduce a two-column dashboard layout with a real side/top navigation pattern on wider screens.

**Suggested command**: `$impeccable adapt`

**[P1] Dashboard typography uses display type for nearly everything**

**Why it matters**: Playfair works for brand moments, but it slows scanning in nav labels, chips, subtitles, card metadata, and repeated history items. Product UI should make status and next action instantly legible.

**Fix**: Keep Playfair for `GetToIt`, `Your Plans`, and maybe section headings. Move buttons, chips, nav, metadata, subtitles, and list text to the body or label family already in tokens.

**Suggested command**: `$impeccable typeset`

**[P1] Recovery states are too thin for real app failure**

**Why it matters**: The dashboard can show `Plans unavailable`, but no retry. Delete is locally hidden before async completion inside the screen, and failure has no visible recovery path from the card.

**Fix**: Use a skeleton while loading, add a `Try again` action to the error state, and keep pending delete state visible until the repository confirms success. On failure, restore the card and show inline error copy.

**Suggested command**: `$impeccable harden`

**[P2] Bottom nav exposes unavailable destinations as if they work**

**Why it matters**: Groups, Activity, and Profile look tappable, but the accessibility tree exposes them as generic text, not buttons. That creates false exits for sighted users and invisible dead ends for assistive tech users.

**Fix**: Either make them real `Pressable` controls with routes, mark unavailable items as disabled with accessible labels, or remove them until they exist.

**Suggested command**: `$impeccable polish`

## Persona Red Flags

**Alex (Power User)**: The history list can grow long, but there is no search, filter, or sort. The horizontal live rail hides active work offscreen. Alex cannot quickly jump to the one plan that matters.

**Sam (Accessibility-Dependent User)**: Bottom nav destinations are not controls, active nav contrast misses 4.5:1, and visual icons such as `event_note` leak as text in the accessibility snapshot. Sam can open cards, but the navigation model is inconsistent.

**Casey (Distracted Mobile User)**: The primary action is in the card, but the card label says `Vote Now` even when the next step is setup. The oversized header consumes prime thumb-time space, while the actual live work starts lower and partially offscreen.

## Minor Observations

- The top avatar uses a remote image with no accessible label or fallback purpose.
- `Past Plans` on a large real account becomes a wall of similar cards.
- The product context says avoid generic restaurant cards and ranked-list energy; this screen mostly avoids that, but the history grid still feels more archive than social decision loop.
- The overlay's clipped-overflow warnings are mostly acceptable for avatars and decorative washes, but they would become real bugs if any menu or tooltip is placed inside the cards.

## Questions to Consider

- What should a created plan's first action actually be: finish setup, invite people, or start answering?
- Is this dashboard intentionally mobile-only, or should web/tablet feel first-class?
- Should the dashboard feel like a luxury archive, or like a fast social cockpit for getting people to one answer?
