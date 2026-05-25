---
folder: 60_engineering
purpose: TB-08 — "I'm in" ratification, push permission prompt, S06 hard-close shutter
---

# Ratification + push + hard-close — TB-08

The mechanics that convert the verdict from "agreement" to "commitment." Three load-bearing pieces:

- **Ratification.** Per-member "I'm in" tap writes a `ratifications` row. The live mutual-state count surfaces on the S05 committed-mode CTA (`"You're in · N of M"`).
- **Push permission prompt.** Fires after the FIRST "I'm in" tap, exactly once per session. Voluntary warm-friend register on the pre-permission line — `"We'll check in tomorrow — see if you went."` — never the system register (`"Enable notifications"`, `"Allow alerts"`).
- **Hard close.** After the correctability window expires OR every member has ratified, the room flips to `status='locked'` and the iOS surface routes to S06. The shutter motion, sun-yellow hairline edges, mono timestamp footer all spec-locked.

## Where the canonical code lives

- **Schema migrations**
  - `supabase/migrations/20260514000000000_ratifications_and_push_tokens.sql`
    - `ratifications (verdict_id, user_id, ratified_at)` — PK (verdict, user). RLS: SELECT room-members, INSERT-self-in-room. No UPDATE / DELETE — re-ratifying is a swallowed no-op via the PK conflict; un-ratifying would re-litigate the commitment.
    - `push_tokens (user_id, device_token, platform, registered_at)` — PK (user, token). RLS: self-scoped SELECT / INSERT / DELETE. Service-role bypasses RLS for the `apns-sender` Edge Function's fanout reads.
  - `supabase/migrations/20260514000010000_rooms_lock_columns.sql`
    - Adds `rooms.correctability_window_seconds` (default 30, check between 5 and 600), `rooms.verdict_committed_at`, `rooms.locked_at`.
    - `tg_ratifications_open_or_close_window` — AFTER INSERT trigger on `ratifications`. Opens the window on first ratification (sets `verdict_committed_at`), closes it early when every member has ratified (flips `status` to `locked` + sets `locked_at`).
    - `cron_lock_expired_correctability_windows` — per-minute pg_cron worker. Locks rooms whose window has elapsed since `verdict_committed_at`.
  - `supabase/migrations/20260514000020000_user_preferences_push_denied.sql`
    - Adds `user_preferences.push_denied_at`. Set by `PushCoordinator` when the user taps "Don't Allow" on the native prompt. Drives the in-app banner fallback at next launch (PRD user story 40).
- **Edge Function** — `supabase/functions/apns-sender/`
  - `handler.ts` — pure HTTP handler. ES256 JWT signed via the shared `_shared/apns-jwt.ts`. Fanout: one POST per (user, device_token) pair; failed sends recorded with `(status, reason)` and the batch continues.
  - `index.ts` — composes the handler with the supabase-js data adapter and a real fetch-based APNs HTTP/2 delivery adapter (POSTs to `api.push.apple.com/3/device/<token>`).
  - Tests:
    - `_shared/apns-jwt.test.ts` — signs against an ephemeral P-256 keypair, verifies signature, locks header (`alg=ES256`, `kid`, `typ`), locks payload (`iss=teamId`, `iat`), confirms IEEE P1363 64-byte signature shape.
    - `apns-sender/handler.test.ts` — auth gating, env-misconfigured (`500`), per-user fanout, non-iOS platform skip, failed-send logging, custom payload merge.
    - `apns-sender/stub-apns.test.ts` — runs a stub APNs server on an ephemeral port and verifies the canonical POST shape (path `/3/device/<token>`, headers `apns-topic` / `apns-push-type=alert` / `apns-priority=10` / `authorization: bearer <jwt>`, body `{aps:{alert:{title, body}, sound:default}}`).
- **iOS — `ios/Sources/App/`**
  - `PushCoordinator.swift` — owns the once-per-session permission ask. Seams: `PushPermissionCenter`, `PushRegistrationDriver`, `PushTokenWriter`, `PushDenialFlagStore` (each backed by a `System*` / `Supabase*` adapter in production, stubbed in tests).
  - `RatificationStore.swift` — observable count/total/hasRatified. Writes ratification rows via PostgREST; refreshes count + member total on appear. The `apply(event:)` seam is exercised by tests + the future Realtime subscriber.
  - `LockedScreen.swift` — S06 SwiftUI port. Veil + shutter motion ms-exact to `design-system/motion.md` §"Hard-close shutter". Reduced motion → fade variant.
  - `VerdictScreen.swift` — extended with:
    - `.committed` flavor (mode `.committed` OR local "I'm in" tap) renders sun-fill pill, ink check prefix, `"You're in · N of M"` label.
    - Window countdown reads `"Window closes in {seconds}s"`.
    - Pre-permission line under the CTA dock — `"We'll check in tomorrow — see if you went."` — suppressed in `.readOnly` / `.noSurvivor`.
- **iOS tests**
  - `Tests/PushCoordinatorTests.swift` — once-per-session contract, granted / denied / already-authorized / already-denied state machine, device-token hex encoding, status mapping.
  - `Tests/RatificationStoreTests.swift` — `apply(event:)` shape: count snapshot replaces; ratified events increment; cap at total; hasRatified flips only on the current user's broadcast.
  - `Tests/LockedScreenTests.swift` — choreo timings locked ms-exact to motion.md; footer copy (`"Locked 6:48:32 PM · 2 of 3 rerolls remain"` / `"No rerolls left. Tonight is locked."`); elapsed formatter; body materialisation under shutter + fade.
  - `Tests/VerdictScreenRatifyTests.swift` — committed-mode CTA labels, pre-permission copy lock (forbidden phrasings explicitly asserted), suppression in `.readOnly` / `.noSurvivor`, body materialisation.
  - `Tests/RatificationIntegrationTests.swift` — live Supabase round-trip: ratify idempotency, push_token upsert idempotency, denial-flag round-trip.

## Once-per-session push prompt contract

PRD user story 39 locks "per session, not per verdict." The coordinator's `requestedThisSession` flag is in-memory only — it resets at process exit. Subsequent app launches re-evaluate the OS permission status; if it's already `.authorized` the coordinator re-registers (so the APNs token can refresh) without prompting again.

Edge cases the tests lock:
- **Already authorized at launch.** No prompt; re-register fires so the APNs token refreshes (Apple admits stale tokens for ~7 days but the canonical pattern is re-register on every launch).
- **Already denied at launch.** No prompt; the flag-store write fires so the in-app banner can surface on this same session.
- **Granted after the prompt.** Driver kicks `registerForRemoteNotifications`; the AppDelegate eventually delivers the device token to `recordToken(_:)` which upserts into `push_tokens`.

## APNs delivery — wire shape

The Edge Function POSTs to `https://api.push.apple.com/3/device/<hex token>`. Headers:

| Header | Value |
|---|---|
| `authorization` | `bearer <ES256 JWT>` (lowercase `bearer` per APNs spec) |
| `apns-topic` | `app.gettoit.GetToIt` (the bundle id, from `APNS_TOPIC`) |
| `apns-push-type` | `alert` |
| `apns-priority` | `10` |
| `content-type` | `application/json` |

JWT header: `{ alg: "ES256", kid: "<APNS_AUTH_KEY_ID>", typ: "JWT" }`. JWT payload: `{ iss: "<APNS_TEAM_ID>", iat: <unix seconds> }`. No `aud`, no `sub`. ES256 signatures are IEEE P1363 (raw `r||s`, 64 bytes) — WebCrypto returns exactly this shape so no DER-to-raw conversion is needed.

Body: `{ "aps": { "alert": { "title", "body" }, "sound": "default" }, ...custom payload merged at top level }`.

## Hard-close motion — locked timings

Mirrors `design-system/motion.md` §"Hard-close shutter":

| Step | Wall-clock delay | Duration | Animation |
|---|---|---|---|
| Veil | 0ms | 200ms | ease (linear ish) |
| Top + bottom shutter slides | 100ms | 700ms | ease-out-soft |
| "VERDICT LOCKED" stamp pop | 800ms | 480ms | ease-out-soft (scale 0.6 → 1.08 → 1) |
| Headline fade-up | 1000ms | 600ms | ease-out-soft |
| Body fade-up | 1200ms | 600ms | ease-out-soft |
| Timestamp footer fade-up | 1400ms | 600ms | ease-out-soft |

Reduced motion forces the `fade` variant — veil + plate appear instantly, no shutter slide, no stamp pop. The verdict still visibly closes.

The shutters carry **sun-yellow hairline inner edges** (`GTIColor.sun.opacity(0.18)`, 1pt). This is the load-bearing design defense against the surface feeling punitive — sun-edge reads as "system did what you asked, on time," not as "warning" / "error."

## Correctability window — open / close shape

1. **Open.** First ratification fires the AFTER-INSERT trigger on `ratifications`. The trigger updates `rooms.verdict_committed_at = ratified_at` (only when null and `status='verdict_ready'`).
2. **Close (early).** The same trigger checks `count(ratifications for this room) >= count(members)`. If yes, flips `rooms.status = 'locked' + locked_at = now()`.
3. **Close (expired).** The `cron_lock_expired_correctability_windows` worker runs every minute. Locks rooms where `verdict_committed_at + correctability_window_seconds <= now()` and `status='verdict_ready'`.

Both close paths land at the same end state (`status='locked', locked_at` set). The iOS subscriber routes to S06 on the `status='locked'` transition; the iOS-side polling fallback at next launch lands on the same surface.

## Adjacencies flagged (not fixed)

- **Verdict-ready APNs broadcast.** TB-08 ships the APNsSender as a stub — the function signs JWTs and delivers against APNs correctly, but the per-trigger fanout wiring (Postgres webhook on `verdicts INSERT` → APNsSender) lands as part of TB-14's check-in fanout work. The S05 surface itself doesn't need a push on the verdict-ready event; the iOS Realtime subscriber routes the user to S05 within ~50-200ms of `rooms.status='verdict_ready'`.
- **Real Realtime subscription on `ratifications`.** The `RatificationStore.apply(event:)` seam is exercised by the integration + unit tests; the live `client.channel("room:\(roomID)").send(...)` wiring on `ratifications INSERT` lands as a small follow-up (mirrors the verdict_ready broadcast pattern in `compute-verdict/index.ts`). Until then, the `refreshCount()` re-read on app foreground catches up.
- **Banner-fallback surface for denied push.** `push_denied_at` is persisted; the actual in-app banner surface (PRD user story 40) is a small surface addition that's natural to land alongside TB-14's check-in copy.
- **Re-ratify path.** Re-ratifying is currently a swallowed no-op via the PK. If a future surface needs "un-commit" semantics (which we explicitly defend against), the schema gap surfaces there.

## Related

- [[../10_prds/0.1.0-prd|0.1.0 PRD]] §"User stories 36–40, 60–64" + §"PushCoordinator"
- [[apple-keys-setup|apple-keys-setup.md]] §"Key 3 — APNs auth key" (the `.p8` wiring TB-08 consumes)
- [[stack-patterns|stack-patterns.md]] §"Push notifications"
- [[../../design-system/surfaces/05-verdict|S05 spec]] §"Modes" + §"Copy register" (the locked pre-permission line)
- [[../../design-system/surfaces/06-hard-close|S06 spec]] (full hard-close surface)
- [[../15_issues/0.1.0/issues/tb-08-ratification-push-hard-close|TB-08 ticket]]
