---
target: mobile app dashboard/plan list screen
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-07-02T17-32-14Z
slug: mobile-src-plans-planlistscreen-tsx
---
# Impeccable Critique: Mobile Dashboard / Plan List

Target: `mobile/src/plans/PlanListScreen.tsx`
Date: 2026-07-02
Mode: critique

## Executive Take

This screen is visually much stronger than a generic dashboard. The Luxe Midnight direction is coherent, the hierarchy is intentional, and the primary "NextUp" card is directionally right for GetToIt's "one answer fast" product promise.

The main problem is not taste. It is decisiveness. The screen says "here is the one thing that needs you now," then immediately shows the same active plan again in a browsing rail, then lets a long closed-plan archive take over the page. That moves the experience from "close the loop" back toward "manage a list."

Overall score: 25 / 40, Acceptable.

## Heuristic Scores

| Heuristic | Score | Note |
| --- | ---: | --- |
| Visibility of system status | 3 | Active/closed states are visible, but loading and error states are thin. |
| Match to real-world expectations | 3 | Labels are understandable, but state copy is still product-internal. |
| User control and freedom | 3 | Create/open/delete/cancel are present. There is little control over long history. |
| Consistency and standards | 2 | Strong visual system, but repeated chips/titles/actions create inconsistent meaning. |
| Error prevention | 2 | Delete confirmation is good. Archive overload and duplicated current plans are not prevented. |
| Recognition over recall | 3 | The screen is legible; hidden horizontal content weakens recognition. |
| Flexibility and efficiency | 2 | Heavy users get no search, filter, archive, or compact mode. |
| Aesthetic and minimalist design | 3 | Attractive and branded, but not minimal enough for the product promise. |
| Error recovery | 2 | Load failure is generic and gives little recovery. |
| Help and guidance | 2 | Empty state helps lightly; active states should explain social progress better. |

## P1 Findings

### P1: The "one next action" hierarchy is contradicted by the rail

Evidence:
- `getNextUpPlan` promotes the first active plan as the urgent item: `mobile/src/plans/PlanListScreen.tsx:486`.
- The horizontal "Plans in motion" rail still maps every live bucket, including the promoted plan: `mobile/src/plans/PlanListScreen.tsx:210`.
- Runtime inspection showed the same plan appearing in both NextUp and the active rail above the fold.
- Tests currently codify repeated state language: `Needs setup` appears 5 times, `Quiz open` 3 times, and `Pick ready` 3 times in the linked plan-list fixture.

Why it matters:
GetToIt's product promise is a decisive, follow-through-ready verdict. Duplicating the same plan immediately after promoting it trains the user to browse and compare instead of doing the one needed thing.

Recommendation:
Exclude the promoted NextUp plan from the rail. Rename the remaining rail to "Other active plans" only when there are remaining active plans. Make the NextUp card the only source of truth for that plan's state and CTA.

Acceptance check:
In the first viewport, each active plan appears at most once and there is exactly one visually dominant primary action.

### P1: Closed plans turn the dashboard into an archive

Evidence:
- Closed plans are rendered as the full `historyPlans` grid: `mobile/src/plans/PlanListScreen.tsx:249`.
- The grid uses wrapping 48% cards, which expands quickly with history: `mobile/src/plans/PlanListScreen.tsx:900`.
- Runtime inspection showed many closed plans visible and continuing under the fixed bottom action area.
- The bottom action dock is absolutely positioned with `minHeight: 96`: `mobile/src/plans/PlanListScreen.tsx:1033`.

Why it matters:
For returning users, the dashboard becomes a memory lane before it remains a current-decision surface. That is backwards for a low-patience mobile product where the job is "what are we doing now?"

Recommendation:
Show at most 2 to 4 recent closed plans on the dashboard, then route to a dedicated history view or "View closed plans" action. Add scroll padding equal to the fixed action dock height so content is never covered.

Acceptance check:
With 20 closed plans, the first screen still prioritizes current/active plans and no closed-plan card is obscured by the bottom action dock.

## P2 Findings

### P2: Gold CTA foreground contrast is inconsistent

Evidence:
- The browser overlay detector reported low contrast of about 1.6:1 for light foreground on the gold CTA color and flagged gray-on-color on gold buttons/icons.
- The visual overlay marked the NextUp action icon and bottom "Start a Plan" icon.

Recommendation:
On gold/copper filled controls, force all nested text and icon foreground to the dark ink token. Do not rely on inherited icon color. Re-run the overlay detector and a screenshot pass after the change.

### P2: The horizontal rail hides active work

Evidence:
- The active rail is a horizontal `ScrollView`: `mobile/src/plans/PlanListScreen.tsx:210`.
- Live cards have fixed width `294` and `overflow: "hidden"`: `mobile/src/plans/PlanListScreen.tsx:720`.
- The detector flagged positioned children clipped by overflow containers on live cards.

Recommendation:
For active plans, prefer a compact vertical list below NextUp, or show one visible secondary card with an explicit count. If the rail stays, add a clear scroll affordance and remove clipped decorative layers.

### P2: Status copy repeats instead of explaining group progress

Evidence:
- Bucket definitions repeat terse labels such as `Needs setup`, `Quiz open`, and `Pick ready`: `mobile/src/plans/PlanListScreen.tsx:56`.
- Cards repeat bucket title, state title, body copy, status chip, and CTA in close proximity.

Recommendation:
Replace bucket jargon with concrete group-state copy: "Send the quiz link", "2 people still answering", "Open tonight's pick", "Ready to share." Use one state label per card and one action verb.

## P3 Observations

- The top-left hamburger is labeled `Open Settings`. If it opens settings, use a gear. If it opens navigation, label it as menu.
- The avatar uses a hardcoded remote image URL. If it is an account affordance, make it real and tappable; if not, remove it from this task surface.
- Loading and error states are too sparse. The route-level load failure says only "Plans unavailable / Try again in a moment"; add retry and skeletons that preserve the dashboard shape.
- The decorative `cardWash` layer contributes to clipped-overflow detector noise. The brand already has enough texture through typography, color, and borders.

## Anti-Pattern Check

This does not look like a generic AI-generated dashboard in the usual visual sense. It has a real visual system, sharp radii, deliberate type, and a recognizable brand mood.

The weaker pattern is product slop: repeated status chips, duplicated plan cards, a decorative card wash, and an archive grid taking space from the next action. It looks polished, but slightly over-specified for a product that should feel decisive.

CLI deterministic scan: clean.
Browser overlay: injected successfully and flagged cramped padding, clipped overflow, and gold-control contrast issues. Some cramped-padding flags are likely React Native Web wrapper noise, but the contrast and clipping issues are actionable.

## Persona Red Flags

Casey, distracted mobile user:
The primary card helps, but the rail and long closed list compete for attention. One-handed use gets worse when the fixed bottom dock covers lower content.

Jordan, first-time user:
The same plan appearing twice can feel like two different tasks. Labels like "Pick ready" and "Live verdict" are understandable after use, but not immediately social or explanatory.

Alex, heavy user:
The long history grid has no filter, search, archive, or compact mode. A power user with many plans will scroll instead of act.

## Recommended Next Pass

1. Remove the promoted NextUp plan from the active rail and reduce repeated state copy.
2. Cap closed plans on the dashboard and move full history behind a dedicated action.
3. Fix gold button foreground colors, then re-run screenshot and overlay checks.

## Open Design Questions

1. Which should be tackled first: decisive next action, closed-plan cleanup, or accessibility polish?
2. How broad should the next pass be: top 2 issues only, full dashboard polish, or copy-only first?
3. Should the dashboard feel more social and alive, or quieter and more utilitarian?
