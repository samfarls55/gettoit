---
issue: bug-33
title: Replace DispatchQueue.main.async with Task @MainActor in LocationCoordinator
status: done
type: AFK
github_issue: 242
created: 2026-05-25
closed: 2026-05-26
---

# bug-33 — LocationCoordinator uses manual DispatchQueue.main.async for UI hops

## Symptom

`ios/Sources/App/LocationCoordinator.swift` hops to main thread via `DispatchQueue.main.async { ... }` inside three MapKit / CoreLocation callbacks:

- Line 296 — inside `search.start { [weak self] response, _ in ... }` (manual-pick path).
- Line 342 — inside `geocoder.reverseGeocodeLocation(location) { placemarks, _ in ... }` (timezone resolve).
- Line 386 — inside `geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in ... }` (GPS resolve).

Surfaced by `/swift-code-review` 2026-05-25 against `CODING_STANDARDS.md` rule **CONC-010** (S2 — concurrency / UI-thread isolation). Rule wants `@MainActor` / structured concurrency in place of manual queue hops.

## Fix scope

Replace each `DispatchQueue.main.async { ... body ... }` with `Task { @MainActor in ... body ... }`. Three sites total. The enclosing class is a `CLLocationManagerDelegate` subclass of `NSObject`; we are NOT migrating the whole type to `@MainActor` (that would ripple through CoreLocation delegate signatures and is out of scope).

Semantics difference to be aware of:
- `DispatchQueue.main.async` coalesces to the next runloop iteration on the main queue.
- `Task { @MainActor in ... }` schedules through the Swift concurrency runtime to the main actor — also lands on the main thread, but with one extra hop through the cooperative pool.

Both produce the same observable effect for state mutations on `@Published` / `@ObservedObject` properties. Document the slight timing-semantics change in the PR description.

## Acceptance criteria

- [ ] Zero `DispatchQueue.main.async` calls remain in `ios/Sources/App/LocationCoordinator.swift`.
- [ ] `manual-pick → commit` path still routes through the resolved-timezone branch when `item.timeZone` is nil (covered by `ios/Tests/LocationCoordinatorTests.swift` — confirm green).
- [ ] GPS reverse-geocode still updates `self.place` only when `self.place?.source != .manual` (existing behaviour at line 402).
- [ ] iOS build green.
- [ ] Manual TestFlight smoke (per `[[project_no_mac_ci_only_ios]]`): the manual-pick → commit path still updates the SetupScreen location chip in the same perceived frame as before (no visible regression). Optional — only if CI is already cutting a TestFlight build for another issue in the same batch.

## Brief for AFK agent

Full autonomy on:
- Whether to keep the `Task { @MainActor in ... }` style at each site, or hoist into a private `@MainActor` helper method called from each callback. Per-site inline is simpler and matches the local-replacement spirit of the fix.
- Whether to keep the existing `[weak self]` capture lists. `Task` closures inherit task-locals automatically; the `[weak self]` is still needed where present to break the retain cycle on the long-lived callback.

Out of scope:
- Migrating `LocationCoordinator` to `@MainActor` wholesale. That's an architectural change — flag for `/improve-codebase-architecture` if dogfood ever surfaces a real ordering bug from the timing-semantics shift.
- The two existing `Task { @MainActor in ... }` sites (lines 503, 515) — already correctly shaped.

## References

- `ios/Sources/App/LocationCoordinator.swift:290-330, 336-346, 382-410` — the three callback bodies.
- `CODING_STANDARDS.md` rule CONC-010, CONC-011.

## Surfaced by

`/swift-code-review` against `ios/`, 2026-05-25.

## Comments

- 2026-05-26 — Closed by [#246](https://github.com/samfarls55/gettoit/pull/246). All three `DispatchQueue.main.async` sites replaced with `Task { @MainActor in ... }`. Source-grep regression test added in `LocationCoordinatorTests`. All CI checks green (ios xcodebuild test 4m23s pass). Kept inline-at-each-site style and existing `[weak self]` captures per the issue's stated preference. No wholesale `@MainActor` migration on the type.
