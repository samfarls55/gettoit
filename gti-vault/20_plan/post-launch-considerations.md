---
folder: 20_plan
purpose: Decisions consciously deferred past v1.1 / first non-self user
---

# Post-public-launch considerations

Items deliberately scoped out of v1.1 with a documented reason. Revisit when the listed gate fires.

## Hardware-keyboard / iPad / focus-ring support

**Decision.** SignInScreen (and any other Form surface) does not support hardware-keyboard navigation, Tab-key focus traversal, or visible focus rings in v1.1. On-screen keyboard path only.

**Why.**
- iPhone-only target. App is shipped as iPhone-only via App Store; no iPad, no Catalyst.
- Hardware keyboard on iPhone is a rounding-error cohort for a social-decision app.
- No realistic QA path — see [[../../../home/node/.claude/projects/-workspace/memory/project_no_mac_ci_only_ios|project_no_mac_ci_only_ios]] memory: no Mac, no iPad, no Magic Keyboard.
- The workflow-design hub's [[../30_design/interaction-patterns/principles#P-12. Keyboard Only]] gate is written against desktop-web forms; over-fitting to iPhone-only social app.

**Revisit gate.** Any of:
- iPad target added.
- App Store / TestFlight feedback signals iPhone Bluetooth-keyboard users.
- Catalyst / macOS target added.

**Resolved by.** `/workflow-review` 2026-05-26 grill #32. Audit finding #32 closes as `deferred` (not `done`).
