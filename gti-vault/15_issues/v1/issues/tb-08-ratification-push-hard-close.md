---
issue: tb-08
title: "I'm in" ratification + push permission + hard-close shutter
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-08 — Ratification + push perm + hard close

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

Make the verdict commitment real. The "I'm in" button toggles per-member ratification state, mutual-state visibility updates live across the group, the native iOS push permission prompt fires after the first I'm in tap (per session), and once the correctability window closes the screen visibly hard-closes with the shutter motion per S06.

- **Schema** — `ratifications (verdict_id uuid, user_id uuid, ratified_at timestamptz)`. RLS limits writes to the user's own row.
- **PushCoordinator** — input: a permission request trigger (post-first-I'm-in per session). Output: registered APNs device token written to a `push_tokens (user_id, device_token, platform, registered_at)` row. Wraps `UNUserNotificationCenter` + `UIApplication.registerForRemoteNotifications`.
- **APNsSender Edge Function stub** — TypeScript / Deno. Input: `(user_ids[], notification)`. Output: APNs delivery via JWT-signed HTTP/2 post. TB-08 ships the stub + the JWT sign + the basic delivery; per-trigger fanout wiring lands as the verdict_ready webhook hits the function. Real check-in pushes wire up in TB-14.
- **Verdict surface — `committed` mode** — per the locked S05 spec, the CTA flips from `"I'm in"` (white pill) to `"You're in · N of M"` (sun pill with ink check prefix). Mutual-state count updates live via Realtime as other members ratify. Below the CTA: `"Window closes in 47s"` countdown.
- **Pre-permission line on S05** — apply a spec change to `design-system/surfaces/05-verdict.md` + `code/screens/ScreenVerdict.jsx`: add a low-emphasis line below or beside the verdict footer reading `"We'll check in tomorrow — see if you went."` Voluntary register, suppress system-register strings like "Enable notifications" or "Allow alerts." The line fires the native iOS push prompt after the first I'm in tap, once per session. Denied state falls back to in-app banner on next launch. Web fallback omits this line. Update `design-system/CHANGELOG.md` and confirm `verify.mjs` green.
- **Correctability window** — configurable per room, default 30s. After all members have ratified OR the window expires, the room flips to `status = 'locked'` and S06 hard-close engages.
- **S06 SwiftUI port** — full port of [[../../../../design-system/surfaces/06-hard-close|S06]] including: veil fade-in, top + bottom shutter slides, "VERDICT LOCKED" stamp pop, headline + body + mono timestamp footer. Sun-yellow hairline edges on shutters (not red). Motion per `motion.md` §"Hard-close shutter."
- **Tests** — I'm-in tap writes a `ratifications` row; mutual-state count updates via Realtime; push perm prompt fires exactly once per session; denied state writes the denial flag for the in-app banner fallback; hard-close locks the room at window expiry; lock motion runs per spec timings.

## Acceptance criteria

- [ ] `design-system/surfaces/05-verdict.md` + `code/screens/ScreenVerdict.jsx` updated with pre-permission copy line.
- [ ] `design-system/CHANGELOG.md` updated; `node design-system/scripts/verify.mjs` passes.
- [ ] `ratifications` and `push_tokens` migrations land with RLS.
- [ ] APNsSender Edge Function deployed; JWT sign + APNs HTTP/2 post verified against a stub APNs.
- [ ] S05 `committed` mode renders with live mutual-state count + correctability countdown.
- [ ] S06 SwiftUI port matches the locked motion + copy spec.
- [ ] Push permission prompt fires once per session post-first-I'm-in.
- [ ] Denied push state falls back to in-app banner on next launch.
- [ ] Hard-close flips room to `status = 'locked'` at window expiry.
- [ ] Integration tests for ratification, mutual-state count, push perm, lock flip.

## Blocked by

- [[tb-07-waiting-realtime-fire-trigger|TB-07]]
