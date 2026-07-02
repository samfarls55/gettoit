---
target: plan list mobile screen
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-02T18-16-34Z
slug: mobile-src-plans-planlistscreen-tsx
---
**Design Health Score**
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The next active state is clear, but list loading/sync and archive volume are not communicated. |
| 2 | Match System / Real World | 3 | "Plan", "Closed", and "Open pick" mostly fit, though closed rows do not explain what value reopening gives. |
| 3 | User Control and Freedom | 3 | Plans are openable and delete has a confirmation, but long history has no jump, filter, or archive control. |
| 4 | Consistency and Standards | 3 | Strong token use and consistent cards, with a bottom dock that reads like nav even though it is mostly a CTA. |
| 5 | Error Prevention | 3 | Delete is guarded and actions are labeled; no obvious destructive trap on the dashboard. |
| 6 | Recognition Rather Than Recall | 3 | Primary actions are visible, but too many identical closed rows become scanning work. |
| 7 | Flexibility and Efficiency | 2 | Power users cannot search, group, or jump through long closed history. |
| 8 | Aesthetic and Minimalist Design | 3 | On-brand and restrained, but the unbounded history list and repeated status copy add noise. |
| 9 | Error Recovery | 3 | Delete failure has inline recovery; broader offline/loading recovery is not evident on this screen. |
| 10 | Help and Documentation | 2 | Copy helps a little, but there is no contextual explanation for archive behavior or why a plan is next. |
| **Total** | | **28/40** | **Good: solid foundation, with dashboard scope and archive density holding it back.** |

**Anti-Patterns Verdict**

**LLM assessment**: This does not look obviously AI-generated. The screen respects Luxe Midnight: dark surface, sharp low-radius containers, sparse gold for primary actions, Playfair only for the main title, Manrope for UI copy, and JetBrains Mono for status labels. The risk is not generic decoration; it is product strangeness. The repeated all-caps mono labels and repeated gold CTAs make the dashboard feel a little more like a styled component inventory than a decisive mobile triage screen.

**Deterministic scan**: CLI detector on `mobile/src/plans/PlanListScreen.tsx` returned `[]`, so no source-level slop findings. Browser overlay injection reported 23 markers: 21 `cramped-padding` and 2 `clipped-overflow-container`. Most are React Native Web wrapper false positives or expected clipping around avatar/image wrappers. The detector did not catch the main UX issue: closed history dominates the dashboard.

**Visual overlays**: Injection succeeded in the Playwright browser tab, not a Codex [Human] tab. The overlay markers were visible in the browser snapshot and console logs were captured. No reliable user-visible [Human] overlay is available from this run.

**Overall Impression**

The screen is in a much healthier place than the previous iteration: the giant create card is gone, the next plan is clearly primary, historical plans are selectable, and the compact `New Plan` action sits in the thumb zone. The biggest opportunity is to make the dashboard a triage surface again. Right now the closed-plan archive floods the same screen that is supposed to answer "what needs me now?"

**What's Working**

1. The next-up card has the right weight. Gold border, larger title, and full-width action make the current plan unambiguous without turning the whole screen into a hero.
2. The compact bottom `New Plan` button is much better. It is reachable, readable, and no longer competes with the active plan card.
3. The visual system is coherent. Contrast is strong: paper on surface is 14.42:1, secondary text is 10.87:1, tertiary metadata is 5.43:1, and ink on gold is 9.12:1.

**Priority Issues**

**[P1] Closed Plans is an unbounded archive on a decision dashboard**

**Why it matters**: The product promise is "one answer, fast." After the active cards, the user hits a long wall of closed rows. That makes the dashboard feel like history storage instead of current decision guidance, and it creates a decision point with far more than 4 visible selectable options.

**Fix**: Keep all closed plans selectable, but move the archive behavior into a clearer structure: show the latest 3 to 5 closed plans, then a `View all closed Plans` row; or keep all rows but group by recency with sticky month labels and a compact search/filter affordance. Do not return to non-selectable history.

**Suggested command**: `$impeccable distill`

**[P1] Secondary active plans are too close in weight to the next-up plan**

**Why it matters**: `Needs you now`, `Verdict ready`, `Open pick`, and the secondary `Verdict ready` card all use similar patterns. The hierarchy is visually improved, but the logic behind "this one first" is still not obvious enough for a tired mobile user.

**Fix**: Keep the next-up card as the only full card. Turn secondary active plans into denser rows with title, state, and a trailing action or chevron. Add one concise reason to the next-up area, such as latest verdict, waiting on you, or setup incomplete.

**Suggested command**: `$impeccable layout`

**[P2] The bottom dock is half navigation, half action bar**

**Why it matters**: `Plans current section` and `Ready when you are.` read like a tab bar, but there is only one tab and one real command. It costs vertical space on the smallest viewport and competes with the closed list.

**Fix**: Make it a pure action dock: remove the left copy, or replace it with a true nav item set only when more tabs exist. Keep `New Plan` compact and bottom-right.

**Suggested command**: `$impeccable polish`

**[P2] Closed rows repeat low-value metadata**

**Why it matters**: Every row says `Closed` and `Closed verdict`, so scanning does not get easier after the first row. The repeated copy consumes vertical space without helping the user recognize a past decision.

**Fix**: Replace repeated status text with useful recall cues: closed date, chosen venue, group name, or outcome. Tighten row height only after the metadata earns its place.

**Suggested command**: `$impeccable clarify`

**[P2] Web accessibility semantics are underpowered**

**Why it matters**: The snapshot exposes most labels as generic nodes, not navigable headings. Screen-reader and keyboard users can activate the main controls, but a long archive becomes a linear slog of similar buttons.

**Fix**: Add heading roles for `Your Plans`, `Needs you now`, `Other active Plans`, and `Closed Plans`; verify visible focus states for all Pressables on web; consider an archive landmark/list label that announces count.

**Suggested command**: `$impeccable audit`

**Persona Red Flags**

**Alex (Power User)**: Alex can open the obvious plan fast, but cannot search or jump through 19 closed rows. The dashboard is doing archive work without archive tools.

**Sam (Accessibility-Dependent User)**: Sam gets useful button labels, which is good. The red flag is navigation structure: the main sections are generic in the accessibility snapshot, and the closed archive repeats many similar buttons without a higher-level way to skip or summarize them.

**Casey (Distracted Mobile User)**: Casey benefits from the thumb-zone `New Plan` button and clear next-up card. Casey loses momentum when the closed archive starts immediately below the active cards, because it looks like a long task list rather than past context.

**Minor Observations**

- The all-caps mono labels are within the design system, but there are a lot of them on one small screen.
- `Other active Plans` is clear, but a little administrative. `Also active` would be shorter if brand voice allows it.
- The avatar/menu top bar is visually polished, but the hamburger has no visible text label. Accessibility label covers screen readers.
- The current screenshot evidence lives at `C:\development\gettoit\output\playwright\impeccable-planlist-top-430-20260702.png` and `C:\development\gettoit\output\playwright\impeccable-planlist-history-430-20260702.png`.

**Questions to Consider**

1. What if the dashboard only answered "what needs me now" and the archive lived one tap deeper?
2. What should make a closed plan recognizable: date, venue, group, or verdict result?
3. Does `New Plan` need permanent dock presence when an urgent plan is active, or should it become quieter during active decision work?
