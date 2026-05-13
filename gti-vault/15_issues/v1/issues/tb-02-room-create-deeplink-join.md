---
issue: tb-02
title: Initiator creates room + Universal Link + deep-link invitee join
github_issue: 3
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-02 — Initiator creates room + invitee deep-link join

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The first multi-user vertical. An initiator opens the app on Device A, taps the primary CTA on a minimal S01, generates a Universal Link, and shares via the iOS share sheet. A second user on Device B taps the link, lands in the app, is signed in anonymously, and is added to the same room.

- **Schema** — add `rooms (id uuid, creator_user_id uuid, status text, vertical text, created_at timestamptz)` and `members (room_id uuid, user_id uuid, role text, joined_at timestamptz)` migrations. RLS per `60_engineering/stack-patterns.md` §"Schema shape" — only members of a room can read its rows.
- **InviteLink module (iOS)** — generates `https://gettoit.app/join/{roomId}?inviteToken={token}` Universal Links. Parses incoming links into `(roomId, inviteToken)` tuples. Pure functions on `URLComponents`.
- **AASA file** — update `https://gettoit.app/.well-known/apple-app-site-association` (TB-00) with the real Apple Team ID and Bundle ID. `paths: ["/join/*"]`.
- **iOS — Associated Domains entitlement** — `applinks:gettoit.app`. Universal Link handler in the App's `onOpenURL` (or `UIScene` equivalent) routes to a "join screen."
- **S01 minimal port** — SwiftUI port of [[../../../../design-system/surfaces/01-initiator|S01]] with only the food vertical enabled and the primary CTA wired. **Defer the timer chip + radius slider to TB-03** — they will be added in the next tracer bullet. Just the visual locked port + share-sheet trigger.
- **Join screen** — minimal SwiftUI view that calls `signInAnonymously` (if no session), inserts a `members` row with `role='participant'`, and displays `"Joined room <id>"`.
- **Integration tests** — room creation writes the row with `role='owner'`; deep-link join writes a `members` row with `role='participant'`; RLS rejects reads from non-members.

## Acceptance criteria

- [ ] `rooms` and `members` migrations land with RLS policies.
- [ ] iOS InviteLink module generates + parses round-trip Universal Links.
- [ ] AASA file hosted with real Team ID + Bundle ID.
- [ ] Tapping the link on Device B with the app installed deep-links to the join screen.
- [ ] Deep-link join writes a `members` row.
- [ ] Integration tests for room create, member add, RLS pass.
- [ ] S01 SwiftUI port matches the locked design-system spec for the parts in scope (no timer/radius controls yet — those land in TB-03).
- [ ] Share-sheet flow tested on a real device (or simulator with simulated share).

## Blocked by

- [[tb-01-walking-skeleton|TB-01]]
