---
folder: 50_product
purpose: Product vision, decisions, feature context
---

# 50_product — Product

Product vision, decisions, feature context.

## Contents

- [[north-star]] — Core problem, primary metric (verdicts-followed-through %), and compound moat.
- [[decision-model]] — End-to-end group decision flow: invite, quiz, aggregation, verdict, reroll, check-in.
- [[0.1.0-scope]] — Smallest cut that proves the thesis: food vertical only, no ML. Deferrals + open gaps.
- [[research-brief]] — Decision-simplification research questions. **CLOSED 2026-05-08**; see deliverables below.
- [[framework-comparison]] — P1 synthesis. Locks the 0.1.0 engine as EBA + Satisficing hybrid; assigns sub-signal roles to remaining frameworks.
- [[paralysis-cause-priority]] — P2 synthesis. Ranks paralysis causes; separates state-multipliers from causes; maps each to a quiz mechanic.
- [[verdict-screen-spec]] — P3 synthesis. Verdict-screen copy framework, ratification UX, distribution rule (NEED-then-EQUALITY, never EQUITY).
- [[0.1.0-design-locks]] — The four research-brief deliverables locked: quiz length (5), signal type, tiebreaker rule, verdict-screen copy framework.
- [[questions-profile-vs-session-split]] — 0.1.0 rule for which inputs live on the account (profile) vs are asked every run (session). Source of truth for 0.1.0 #9.
- [[0.1.0-quiz-amendments]] — 0.1.0 quiz redesign: three-bucket model, the 5 questions, Q5 preference probe, satisficing + maximin verdict engine. Amends [[0.1.0-design-locks]].
- [[0.1.0-workflow-overhaul-plan-setup]] — Workflow overhaul: Plan as the new noun, persistent list-backed Plans, collapsed S01+S01b Setup screen, distance slider replaces walk/drive, three nav verbs (Back/Exit/Delete). Locked outcomes of /grill-with-docs 2026-05-19.
- [[0.1.0-workflow-overhaul-plan-list]] — Plan list surface (the new app entry): sectioned by status (Pending / Decided / History), verdict inlined on decided cards, JOINED chip on joined cards, three-dot menu + C-16 confirm sheet for destructive actions, FAB + Solo/Group disambig sheet for create. Locked outcomes of /grill-with-docs 2026-05-20. Sibling to workflow-overhaul-plan-setup; amends its §Q7 + §Q11.
- [[0.1.0-workflow-overhaul-web-invitee-flow]] — Web invitee single-link flow: the `/join/<roomId>` shell (name entry → resume → read-only → leave), anonymous-session-only identity, a shared `_shared/votes-wire.ts` vote contract, and the app-installed account-claim gap. Locked outcomes of /grill-with-docs 2026-05-21. Sibling to workflow-overhaul-plan-setup / -plan-list; resolves the *how* of sg-WF-5 §Q6.
- [[0.1.0-workflow-overhaul-web-invitee-account-claim]] — Web invitee account claim: a single-use claim code carries the browser anonymous session into the freshly-installed app *before* Apple sign-in, so the existing S00a `linkApple` path upgrades it (zero row migration). Same-device + before-sign-in only; after-sign-in recovery deferred. Locked outcomes of /grill-with-docs 2026-05-21. Sibling to workflow-overhaul-web-invitee-flow; resolves sg-WF-7 (its §Q8 gap) — see [[../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].
- [[research/decision-simplification-frameworks/report|research/decision-simplification-frameworks/]] — P1 raw research archive: 6 framework JSONs + outline + synthesized report. Source for [[framework-comparison]].
- [[research/paralysis-causes/report|research/paralysis-causes/]] — P2 raw research archive: 6 paralysis-cause JSONs + outline + synthesized report. Source for [[paralysis-cause-priority]].
- [[research/group-fairness-procedural-justice/report|research/group-fairness-procedural-justice/]] — P3 raw research archive: 7 fairness-construct JSONs + outline + synthesized report. Source for [[verdict-screen-spec]].
