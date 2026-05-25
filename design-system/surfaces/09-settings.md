---
surface: 09-settings
status: locked
locked-date: 2026-05-14
jsx:
  - code/screens/ScreenSettings.jsx
---

# S09 · Settings

> **Code:** [`../code/screens/ScreenSettings.jsx`](../code/screens/ScreenSettings.jsx)

The minimal account-management surface. 0.1.0 contains exactly one action: deleting the user's data. Required by App Store guideline 5.1.1(v) ("apps that support account creation must offer account deletion within the app"). Per [[../../gti-vault/60_engineering/adr/0006-privacy-posture-0.1.0|ADR 0006]] the delete is hard — cascade FKs purge dependent rows; `events.user_id` nullifies for analytics fidelity.

This surface deliberately does **not** look like a typical settings screen. There are no toggles, no rows of options, no profile editor. The whole point is the one action it contains.

## What this surface defends against

- **Settings-drawer creep.** No notifications toggle, no theme picker, no profile editor, no help link. 0.1.0 ships one action; 0.1.0+ adds rows when needed, never preemptively. The defense is the empty white space — a future contributor sees the surface and is forced to justify adding to it.
- **Hidden delete.** App Store reviewers ding apps where the delete affordance is buried (5.1.1(v) requires it be "easily discoverable"). The path from a cold-start app launch to the delete confirmation is exactly: tap "Settings" on S01 footer → tap "Delete my data" on S09 → tap confirm in the native alert. Two taps + one alert; one of them on the primary surface.
- **Aggressive destruction framing.** No red color anywhere (no red exists in the system — see `tokens.md §1.3`). The destructive intent lives in the **copy** ("Delete my data" CTA, "Delete forever" alert button) and the **alert** — not in chrome. The user has to read what they're tapping; they can't pattern-match off color alone.
- **One-way trip alarm.** The body paragraph names exactly what gets deleted and what doesn't. No vague "this can't be undone" platitudes; concrete language about rooms, votes, and identity.

## Components used

`GradientSurface` (midnight stop) · `GTIMark` · `Eyebrow` · display headline (smaller than S01's, 36pt) · body paragraph · `PillCTA` white · footer text link (same treatment as the S01 entry point — `eyebrow` mono-tag, tertiary on gradient).

## Gradient choice — midnight

Reuses the existing `midnight` gradient stop (`tokens.json` → `gradient.surfaces.midnight`). Two reasons:

1. **Narrative separation.** The Sunset Pop arc (initiator → q1 → q2 → q3 → q4 → q5 → waiting → verdict → checkin) is the decision ritual. Settings is not part of that arc; midnight visually flags "this is a utility, not the journey." Returning to S01 re-enters the arc.
2. **Pre-existing.** `midnight` is already registered (`tokens.md §1.2`) — no new gradient stop added to `tokens.json`. Keeps the spec change scoped to one surface + the S01 footer exception.

## Copy register

- **`"Your account"`** — eyebrow. Possessive register; matches the warm-friend voice rather than "Settings" or "Account management".
- **`"Just one thing here for now."`** — display headline. Honest about 0.1.0 scope; pre-empts the "where are the rest of the settings?" reaction. Lower-emphasis treatment (36pt instead of 52pt) signals "this is not the destination, it's a utility."
- **`"Deletes everything: your sessions, your votes, your taste profile. Rooms you joined keep going — your spot in them clears. Can't be undone."`** — body paragraph. Names exactly what gets removed and what survives (per ADR 0006: cascade-on-participated-rooms means co-participants lose your rows, but the room itself stays alive for the others). The "can't be undone" line is the regret-prevention guardrail; no "are you sure" softening.
- **`"Delete my data"`** — CTA. First-person possessive, plain verb. Not "Delete account" (corporate), not "Erase me" (cute).
- **`"Delete forever"` / `"Cancel"`** — native iOS alert buttons. "Forever" is the irreversibility signal in the moment of confirmation. Cancel is default; user has to traverse to the destructive button.
- **`"Done"`** — footer link (returns to S01). Plain, terminal verb.

## Behavior

1. **Entry:** user taps "SETTINGS" footer link on S01 Initiator (see [[01-initiator|S01 §"Settings footer link"]]).
2. **Idle state:** surface displays headline, body paragraph, "Delete my data" CTA, "Done" footer link.
3. **CTA tap:** native iOS `UIAlertController` (action sheet on iPad, alert on iPhone) presents:
   - Title: `"Delete your data?"`
   - Message: `"This can't be undone."` (terse — the body paragraph already spelled out the consequence)
   - Destructive button: `"Delete forever"`
   - Cancel button: `"Cancel"` (default)
4. **Confirm:** call `supabase.auth.admin.deleteUser()` (via an Edge function — the iOS client doesn't ship a service-role key). Cascade FKs handle every dependent row. On success, the iOS app immediately bootstraps a fresh anonymous session and returns to S01. On failure, present a non-blocking error toast and stay on S09.
5. **Cancel or Done:** dismiss back to S01. No state mutation.

## 0.1.0 scope

**Exactly one action: Delete my data.** No notifications toggle. No theme switcher. No profile editor. No "About" or "Version" footer. No "Sign out" (anonymous users can't sign out; claimed users sign out via Apple system settings if they really need to — and per ADR 0007 the upgrade is one-way; the auth-state machine doesn't support reverting to anonymous from claimed).

If a new requirement adds a row to this surface, that's a spec change — flag and discuss before adding. The empty space is the feature.

## Edge cases

- **Anonymous user invokes delete.** Their anonymous `auth.users` row is removed; cascade purges everything. The iOS layer immediately bootstraps a fresh anonymous session (per the cold-start path in [[../../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]) and returns to S01. From the user's perspective: they tapped delete, the app reset.
- **Claimed user invokes delete.** Same flow — the claimed `auth.users` row is removed (including the Apple identity link). The iOS layer bootstraps a fresh anonymous session. If the user signs in with Apple again, they get a new `auth.users` row with the same Apple identity; their pre-delete data does NOT come back (it cascaded). This matches the "hard delete" intent in ADR 0006.
- **Delete during an active room.** The user might be mid-session in a room they joined. Their `members.user_id` cascades; the room's vote count drops by one. Other participants see a delta in real time (per the existing Realtime subscription) but the room continues toward its verdict if quorum still holds. Out of scope to surface a "you're in an active session" warning at 0.1.0.
- **Delete during a room they created.** That room hard-deletes via cascade. Other members lose access (their `members` rows cascade with the room). Acceptable per ADR 0006.
- **Network failure mid-delete.** The Edge function returns an error; iOS shows a non-blocking toast and stays on S09. User can retry. The auth.users row is either deleted-and-the-cascade-completed (Postgres tx semantics) or not deleted at all; no partial-state.
- **Concurrent push notification.** The user's push tokens cascade on delete. APNs sends to the dead device token are no-ops on Apple's side.

## Out of scope (deferred)

- **Data export.** Per ADR 0006, deferred to v2.
- **Sign out / unlink Apple identity.** Per ADR 0007, the Apple link is one-way at 0.1.0.
- **Notification preferences.** No notifications toggle; the only notification is the next-day check-in push (S08), and that's opt-in at the system level (push permission prompt). If a user denies push, no toggle is needed because no notification fires.
- **About / version / build info.** Not user-visible at 0.1.0. Engineering can read it from TestFlight metadata.
