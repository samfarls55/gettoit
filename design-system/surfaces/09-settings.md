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

`GradientSurface` (midnight stop) · top-leading `xmark` close glyph (wfr-29) · `Eyebrow` · display headline (smaller than S01's, 36pt) · body paragraph · `PillCTA` ghost (DELETE destructive).

The GTI mark used to occupy the top-leading slot in the original 0.1.0 spec; wfr-29 gives that slot to the close glyph since the iOS sheet-dismissal habit lives there. The Plan list entry path provides the brand context — there is no risk of users losing where they are after a single tap into a utility surface.

## Surface escape — top-leading close glyph (wfr-29, 2026-05-26)

The surface dismiss verb lives on a top-leading `xmark` SF Symbol icon-button, anchored above the eyebrow on the safe-area inset. Matches the iOS sheet-dismissal convention ([[../../gti-vault/30_design/interaction-patterns/principles#P-07. Habituation|P-07 Habituation]]) — the gesture/affordance users already use to dismiss every other modal-utility surface on the platform works here too. 44pt minimum tap target (Apple HIG); white-at-0.86 opacity so the glyph reads as chrome rather than competing with the eyebrow + headline.

Why an icon, not a text label like the QuizChrome `Back` / `Exit` slots: Quiz is a sequential quiz step — its chrome verbs name the consequence ("back to the previous question", "exit the quiz"). Settings is a utility surface that visually steps out of the Sunset Pop ritual arc (midnight gradient) and reads as a sheet-style escape from the Plan list. The `xmark` glyph carries that "this is the sheet escape" register at a glance.

## CTA dock hierarchy (wfr-07, 2026-05-26 → amended by wfr-29)

After wfr-29 retired the bottom-center DONE PillCTA, the dock holds a single action:

1. **`DELETE MY DATA`** — C-05 PillCTA `ghost` variant (transparent fill, 1.5pt white-0.5 stroke, white text). The destructive treatment lives in the outline + the copy + the native two-step confirm alert, never in a colored fill. The `tokens.md §1.3` no-red contract still governs.

Why ghost (not the white pill, not a red token): the original 0.1.0 spec used the white pill for DELETE because DELETE was the only action on the surface. wfr-07 briefly added a white-pill DONE above it; wfr-29 then moved the dismiss to a top-leading close glyph, so the dock returns to a single action — but the ghost treatment from wfr-07 is preserved so the destructive verb still reads as destructive (not as "the surface's primary"). The outline reads as "not the primary", the copy reads as "destructive", and the native alert is the consent gate. Sun-fill was not considered — sun is the system's signal for "the system registered your input", never for a destructive action.

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
- **Close (`xmark`)** — surface dismiss affordance (returns to the Plan list). Top-leading glyph; no text label needed because the iOS sheet-dismissal habit already names it. Replaces the wfr-07 bottom-center "Done" PillCTA per wfr-29.

## Behavior

1. **Entry:** user taps the Settings entry on the Plan list (see [[00-plan-list|S00 Plan list]]).
2. **Idle state:** surface displays top-leading `xmark` close glyph, headline, body paragraph, and the ghost "Delete my data" CTA.
3. **CTA tap:** native iOS `UIAlertController` (action sheet on iPad, alert on iPhone) presents:
   - Title: `"Delete your data?"`
   - Message: `"This can't be undone."` (terse — the body paragraph already spelled out the consequence)
   - Destructive button: `"Delete forever"`
   - Cancel button: `"Cancel"` (default)
4. **Confirm:** call `supabase.auth.admin.deleteUser()` (via an Edge function — the iOS client doesn't ship a service-role key). Cascade FKs handle every dependent row. On success, the iOS app immediately bootstraps a fresh anonymous session and returns to the Plan list. On failure, present a non-blocking error toast and stay on S09.
5. **Close glyph or Cancel:** dismiss back to the Plan list. No state mutation.

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
- **About / version / build info.** Not user-visible at 0.1.0. Engineering can read it from EAS/TestFlight metadata for the active React Native app in `mobile/`.
