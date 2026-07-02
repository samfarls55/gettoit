---
target: app dashboard page
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-07-02T14-01-04Z
slug: mobile-src-plans-planlistscreen-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Badges and delete progress exist, but the dashboard still does not surface the most urgent plan, group progress, quorum, or verdict readiness. |
| 2 | Match System / Real World | 2 | The CTA labels are clearer now, but "Created," "Joined," "Decided," and "History" still read like database states rather than dinner-planning language. |
| 3 | User Control and Freedom | 2 | Delete has an inline escape, but list-load recovery still has no direct retry and the main plan path is not easy to back out of or resume. |
| 4 | Consistency and Standards | 2 | Disabled nav is more honest, but it still occupies prime nav space; the avatar looks like an account button but is only an image. |
| 5 | Error Prevention | 3 | The destructive delete affordance is separated from the status chip and confirmed before acting, which removes the biggest safety problem. |
| 6 | Recognition Rather Than Recall | 2 | Plan actions are visible, but users still have to infer urgency and remember context that is not on the card. |
| 7 | Flexibility and Efficiency | 1 | There is no quick-resume path, urgency sort, shortcut, search, or compact handling for a long plan list. |
| 8 | Aesthetic and Minimalist Design | 3 | The palette and type roles are stronger after the typography cleanup, but repeated cards, fake avatars, and placeholder nav still add noise. |
| 9 | Error Recovery | 2 | Delete failure is now surfaced inline; the broader plan-list loading/error state still lacks an actionable retry path. |
| 10 | Help and Documentation | 1 | Empty copy hints at purpose, but it does not give a direct next action or explain what a new user should do next. |
| **Total** | | **20/40** | **Acceptable: small fixes improved safety, but the dashboard still needs a product-shape pass.** |

## Anti-Patterns Verdict

**LLM assessment**: This no longer has the clearest prior tells: "Vote Now" is gone, the Created chip is no longer the delete affordance, and disabled tabs are semantically disabled. It still has product slop: the screen feels like a polished plan archive instead of a fast social decision surface. The main tells are generic buckets, a horizontal card rail, fake participant avatars, and navigation for unavailable destinations.

**Deterministic scan**: CLI scan on `mobile/src/plans/PlanListScreen.tsx` returned `[]`. No detector findings, rule names, locations, or false positives were reported for the source file.

**Visual overlays**: Browser mutation and `detect.js` injection succeeded in the parent run, but the visible page was the unauthenticated sign-in shell, not the dashboard. The only console issue observed there was `clipped-overflow-container` on the auth shell, so it is not counted as a dashboard finding. Assessment B separately reached the same auth boundary and did not claim an overlay because its mutation preflight failed.

## Overall Impression

The small UI fixes helped. The dashboard is safer and less misleading than the 19/40 snapshot. But the core experience still asks users to browse a status rail when the product promise is "one answer, fast." The biggest opportunity is to make the screen answer one question immediately: what needs me now?

## What's Working

- The destructive action is much safer: delete is separate from status, requires confirmation, disables while pending, and shows an inline failure message.
- The primary CTA labels now match the user's likely task: "Finish setup" and "Answer quiz" are clearer than "Vote Now."
- The Luxe Midnight identity remains coherent: dark surfaces, restrained gold, Playfair for major headings, Manrope for body, and JetBrains Mono for labels.

## Priority Issues

**[P1] No decisive primary path**

**Why it matters**: A dinner-decision app should reduce scanning. Right now the user lands on a title, a rail, a create card, history, settings, and bottom nav. Nothing says, "do this next."

**Fix**: Promote a single "Next up" plan above the horizontal rail. Use existing buckets in urgency order: created plans first, joined plans second, decided plans third. Give it one action. Keep the rail as secondary browsing.

**Suggested command**: `$impeccable polish`

**[P1] Social state is hardcoded and therefore untrustworthy**

**Why it matters**: The `A`, `M`, and `+3` avatar stack suggests real participants, but it is static. That creates fake social proof in a product where trust in group state matters.

**Fix**: Remove the fake avatars until real participant data exists. Replace them with honest state copy like "Waiting on the group" or "Quiz open." If participant counts exist in the repository later, add them then.

**Suggested command**: `$impeccable clarify`

**[P2] Disabled bottom navigation still burns prime mobile space**

**Why it matters**: Groups, Activity, and Profile are now semantically disabled, but they still look like the app's main destinations and occupy the thumb zone. On mobile, that space should either navigate or help the user act.

**Fix**: Hide unavailable tabs until they are real, or reduce the bottom bar to the current Plans destination plus a Start Plan action. Keep placeholders out of the primary mobile nav.

**Suggested command**: `$impeccable distill`

**[P2] IA labels still sound internal**

**Why it matters**: "Created," "Joined," "Decided," and "History" describe storage status more than user intent. They force users to translate app state into dinner action.

**Fix**: Use user-state labels: "Needs setup," "Quiz open," "Pick ready," and "Closed." Rename "Live Plans" to "Needs you" or "Happening now."

**Suggested command**: `$impeccable clarify`

**[P2] Mobile and accessibility polish remain uneven**

**Why it matters**: The settings control is 40pt rather than 44pt, horizontal rails are awkward for keyboard/screen-reader users, web focus states are not defined, and the avatar's role is visually ambiguous.

**Fix**: Make top controls 44x44, expose selected state on the active nav item, add visible web focus styles where React Native Web supports them, and make the avatar either a real account button or a plain non-button image.

**Suggested command**: `$impeccable audit`

## Persona Red Flags

**Alex (Power User)**: Alex wants the fastest route back into the active dinner decision. Instead, they must scan a horizontal rail, identify the right card, and ignore placeholder nav. No quick-resume, urgency sort, or compact path exists.

**Sam (Accessibility-Dependent User)**: Sam gets better disabled-state semantics than before, but active nav still lacks selected semantics, settings is smaller than the target size, and horizontal card rails can be cumbersome for keyboard and screen-reader navigation.

**Casey (Distracted Mobile User)**: Casey is likely one-handed and impatient. The best thumb-zone space is spent on unavailable tabs, while "Start a Plan" may sit off to the right inside a horizontal rail. Empty state copy gives no direct button.

## Minor Observations

- "Here's what you're up to" is low-value filler.
- The remote avatar image can fail independently of the dashboard and does not seem tied to account state.
- `Create group Plan` ignores couples/duos from the product context.
- `hasAnyPlan` treats history as enough activity, so a user with only old plans does not get a strong start-new prompt.
- Font loading inside the screen is a pragmatic web patch, but longer term it belongs in app-level setup.

## Questions to Consider

- What should be unmissable within 3 seconds: resume the urgent room, start tonight's plan, or see the ready pick?
- If GetToIt promises one answer, why does the dashboard ask users to browse a strip of cards?
- Are Groups, Activity, and Profile real destinations now, or placeholders taking the best mobile real estate?
- Would organizing around "Tonight" feel more human than organizing around plan status buckets?
