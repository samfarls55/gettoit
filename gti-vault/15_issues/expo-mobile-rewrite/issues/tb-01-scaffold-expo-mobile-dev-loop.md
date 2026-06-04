---
status: ready-for-agent
type: AFK
github_issue: 326
---

# TB-01: Scaffold Expo mobile dev loop

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Create the new Expo managed React Native + TypeScript app foundation for the mobile rewrite. The slice should make mobile development verifiable from Windows: typecheck, test, and dev-only web preview all run locally. Include a minimal GetToIt-branded placeholder surface, a first token adapter path, and one smoke test proving the test harness can render a mobile screen.

## Acceptance criteria

- [ ] A new Expo managed TypeScript app exists as the active future mobile client scaffold.
- [ ] Root scripts expose mobile typecheck, mobile tests, mobile web preview, and a combined mobile verification command.
- [ ] The mobile app can render a placeholder GetToIt surface in Expo web.
- [ ] The mobile app has a token adapter path from the design system, even if only a minimal subset is wired.
- [ ] Typecheck and tests pass locally on Windows.
- [ ] A screen smoke test proves React Native Testing Library can render and assert visible output.

## Blocked by

None - can start immediately.

