---
folder: 60_engineering
purpose: Implementation patterns implied by the v1 stack decision (ADR 0001)
---

# Stack Patterns — GetToIt v1

Implementation patterns and conventions implied by [[adr/0001-ios-tech-stack-supabase|ADR 0001]]. Capture *now* so the choices behind each pattern survive memory decay.

Stack: **Swift + SwiftUI + Supabase** (Postgres + Realtime + Auth + Storage + Edge Functions). Client SDK: `supabase-swift`.

## Realtime

**Use Realtime Broadcast for live vote events.** Postgres Changes are reportedly flaky at scale and process replication on a single thread (every subscriber triggers an RLS auth check per change).

Pattern:
- Client emits a `vote` event on the `room:{roomId}` channel.
- All room subscribers receive the event in ~50–200ms.
- A separate Postgres `INSERT` writes the durable record (async; for state-of-record / late-joiners).
- Cold start / re-hydration: query the votes table for the room — *do not* subscribe to Postgres Changes for live updates.

**Use Presence channel for "who's in the room" / "voted" indicators.** First-class in the Swift SDK; this is the canonical Supabase example.

## Auth

**Anonymous auth as the default invitee path.** `signInAnonymously()` issues a JWT with no PII. The invitee taps the deep link, votes immediately, and can later link Apple/email credentials without losing their vote history.

**Sign in with Apple** for explicit account creation via `signInWithIdToken` + Authentication Services. Required for cross-device account portability and for "this person is real" upgrades from anonymous.

**`supabase-swift` defaults to Keychain auth storage.** Unsigned simulator builds (`CODE_SIGNING_ALLOWED=NO`, which is how our iOS CI lane runs) silently fail keychain writes — `signInAnonymously` returns a Session but `currentSession` stays nil, so PostgREST has no JWT to attach and every request lands as the `anon` role (RLS rejects). Inject `InMemoryAuthStorage` for integration tests; production keeps the keychain default and works once code-signed. See `ios/Tests/RoomStoreIntegrationTests.swift`.

## RLS — schema-level recursion landmines

**Don't subquery a table from inside its own SELECT policy.** Postgres trips `42P17 infinite recursion detected in policy for relation "<name>"` instantly. The same trap fires across two tables that join through each other (table A's policy queries B; B's policy queries A — recursion).

For TB-02 the members SELECT policy is `user_id = auth.uid()` (own row only). The `rooms` SELECT policy joins through `members`, but only needs the caller's own member row to compute "which rooms admit me", which the self-policy admits without recursion.

When wider visibility is needed (e.g. TB-07's Waiting surface — every member sees every co-member): use a SECURITY DEFINER function (`is_room_member(room_id, user_id)`) that bypasses RLS internally. Mark it `SECURITY DEFINER` + `SET search_path = ''` and grant `EXECUTE` to `authenticated` only.

**RLS-aware insert-then-read order.** `client.from("X").insert(values).select().single()` does an insert then a SELECT to return the row, and the SELECT evaluates the SELECT policy. For self-bootstrap rows (room creator inserts a `rooms` row, then their own `members` row), the SELECT policy on `rooms` may require `members` membership — which doesn't exist yet. Allocate the id client-side, insert without `returning=representation`, then fetch later when the bootstrap membership exists. See `RoomStore.createRoom`.

## Invite flow

- Universal Links via Associated Domains entitlement + `apple-app-site-association` file.
- Link shape: `https://gettoit.app/join/{roomId}?inviteToken={token}`.
- No Supabase-native invite primitive — build it yourself. (Branch / AppsFlyer not required; iOS Universal Links + share sheet are sufficient.)
- Invitee with the app installed: deep link → join screen → anonymous auth → vote. Two taps.
- Invitee without the app: App Store deferred deep link → install → resume to join screen. Standard pattern.

## Schema shape

Relational, with RLS policies enforcing room-scoped access. Indicative tables:

- `rooms (id, creator_user_id, deadline_at, status, vertical, created_at)`
- `members (room_id, user_id, role, joined_at)` — `role` ∈ {`owner`, `participant`}
- `options (id, room_id, label, payload_json)` — `payload_json` carries food-vertical fields (place_id, lat, lng, etc.)
- `votes (room_id, user_id, option_id, created_at)` — unique on (room_id, user_id) for single-vote semantics, or composite if ranked
- `verdicts (room_id, option_id, computed_at, method)` — `method` ∈ {`quorum`, `deadline`, `manual`}

**RLS rule of thumb:** every table has `WHERE room_id IN (SELECT room_id FROM members WHERE user_id = auth.uid())` style policies. Auth.uid() comes from the JWT. Declarative, server-enforced.

## Deadline / quorum / verdict computation

Server-authoritative. Two interchangeable patterns:

- **Trigger-driven:** `AFTER INSERT ON votes` checks `count(votes) = count(members)`. If true, computes verdict, inserts into `verdicts`, broadcasts `verdict_ready` event.
- **Cron-driven:** `pg_cron` job runs every minute, scans `rooms WHERE status='open' AND deadline_at <= now()`, computes verdict for each, broadcasts.

Both can coexist (whichever fires first wins; the other becomes a no-op via `status` check).

## Food vertical / geo

- **PostGIS extension enabled.** Use `geography(Point, 4326)` for restaurant locations.
- **Nearby query:** `ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_meters)`.
- **Places data:** Foursquare (free 10k/mo on relevant endpoints) is the cost-floor pick for v1; Apple MapKit POI search is free with a developer account and is the fallback. Avoid Google Places (paid since Feb 2025) and Yelp Fusion (paid).
- Store a minimal `places` cache table to avoid re-hitting the third-party API per session.

## Push notifications

- **No native APNs sender.** Edge Function reads APNs `.p8` key from env, signs JWT, posts to APNs HTTP/2 endpoint.
- **Trigger:** Postgres webhook on `verdicts INSERT` → Edge Function → APNs fanout to all room members.
- **Live Activity / Dynamic Island:** server pushes via APNs to update "3 of 5 voted, deadline in 2m" UI. Standard ActivityKit pattern; Supabase is just the trigger source.
- Estimate ~half a day of plumbing for first version.

## Offline

**v1 strategy: DIY SwiftData mirror with last-write-wins.**

- Local SwiftData store mirrors the active room's `votes` rows.
- Writes go to local store immediately (optimistic UI), then fire to Supabase.
- Reconcile on Realtime echo or rollback on error.
- Conflict resolution: LWW by `created_at`. Acceptable for v1 because vote windows are short (minutes, not days) and groups are small (≤ ~8 people).
- Estimate ~1–2 weeks of engineering for a reusable pattern.

**Escape hatch:** if offline pain materializes during the first sprint, layer PowerSync on top (do *not* switch BaaS). Accept the $25–60/mo cost floor and the Live Activity caveat documented in ADR 0001.

## Cost shape (working assumption)

At 0–1k DAU: free tier carries the load. Watch the 7-day idle-pause caveat.
At 1k+ DAU: $25/mo Pro plan covers 100K MAU + 500 realtime conns + 5M msgs + 250GB egress — meaningful headroom into the low-10k DAU range.
At 10k+ DAU: re-model. Postgres reads are unmetered on Pro; realtime messages and egress are the variable axes.

## What we are explicitly not doing in v1

- React Native, Flutter, or any cross-platform client framework.
- Firebase, Convex, CloudKit, Nakama, Turso, InstantDB. See ADR 0001 alternatives.
- PowerSync overlay. Defer until offline UX pain shows up.
- Custom auth (no email/password flow in v1 — Sign in with Apple + anonymous only).
- Google Places or Yelp Fusion (paid; use Foursquare or MapKit).
- Realtime Postgres Changes for live vote fanout (use Broadcast).
