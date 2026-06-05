---
title: App Store Connect Privacy Nutrition Labels â€” GetToIt 0.1.0
status: living
last-updated: 2026-05-14
related: tb-16, adr-0006
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# ASC Privacy Nutrition Labels â€” GetToIt 0.1.0

The complete answer set for the App Store Connect "App Privacy" form, derived line-by-line from the deployed Privacy Policy at `https://gettoit.app/privacy` and from [[adr/0006-privacy-posture-0.1.0|ADR 0006]]. This file is the **source of truth** for what GetToIt declares to Apple. If the Privacy Policy or ADR changes, update both this file and the App Privacy form in ASC.

Open `tb-16-privacy-legal-delete.md` -> "Acceptance criteria" -> this row is the last HITL gate before TB-16 closes:

> [ ] (HITL) Privacy Nutrition Labels filled out in App Store Connect to match the policy.

## 1. Where the form lives

App Store Connect -> **Apps** -> **GetToIt - Do More, Plan Less** -> sidebar **App Privacy** (under "General").

First time, the page shows a **Get Started** button. Click it. Apple then guides you through a multi-step wizard. The wizard order below matches what ASC shows in May 2026; if Apple has rearranged it, the *values* still hold â€” just answer them in whatever order the new wizard asks.

## 2. The model Apple uses

Apple groups everything into three big questions:

1. **Data Collection** â€” for each Data Type in Apple's taxonomy, do we collect it from this app?
2. **Linked to User** â€” if we collect it, can it be tied back to the user's identity?
3. **Used for Tracking** â€” Apple defines tracking as "linking data collected from your app with data collected from other companies' apps, websites, or offline properties for targeted advertising or advertising measurement purposes, or sharing data with data brokers."

For every Data Type we collect, Apple then asks **Purposes** (multi-select from a fixed list).

The fixed Purposes list:
- Third-Party Advertising
- Developer's Advertising or Marketing
- Analytics
- Product Personalization
- App Functionality
- Other Purposes

## 3. Universal answers for GetToIt

These apply to **every** Data Type we declare:

| Question | GetToIt answer | Why |
|---|---|---|
| Used for Tracking | **No** | Zero third-party ad SDKs, zero cross-app/cross-site identity linking, zero data-broker sharing. [[adr/0006-privacy-posture-0.1.0|ADR 0006]] makes this explicit. |
| Third-Party Advertising purpose | **No** | Same â€” no ads. |
| Developer's Advertising or Marketing purpose | **No** | No marketing email blasts, no retargeting, nothing. |
| Product Personalization purpose | **No** | 0.1.0 has no profile-based personalization. Quiz answers reset per session per [[../50_product/questions-profile-vs-session-split|questions-profile-vs-session-split.md]]. |

The Purposes we **do** check (per Data Type below) are **App Functionality** (always) and sometimes **Analytics** (for cohort-level rollups described in PP Â§3).

## 4. Data Types collected â€” line-by-line answers

Walk the wizard one Data Type at a time. For each, click into Apple's category, then the specific type. Use the table below as the script.

### 4.1 Contact Info

| Apple sub-type | We collect? | Linked to User? | Tracking? | Purposes |
|---|---|---|---|---|
| **Name** | Yes (only when user signs in with Apple) | Yes | No | App Functionality |
| **Email Address** | Yes (only when user signs in with Apple; Apple-relayed address is what we receive) | Yes | No | App Functionality |
| Phone Number | No | â€” | â€” | â€” |
| Physical Address | No | â€” | â€” | â€” |
| Other User Contact Info | No | â€” | â€” | â€” |

Note: Apple distinguishes "real email" from "Apple-relayed email." We get whichever the user chose at the Sign-in-with-Apple consent sheet. Either way, declare **Email Address: Yes, Linked**.

### 4.2 Health & Fitness

| Apple sub-type | We collect? |
|---|---|
| Health | No |
| Fitness | No |

### 4.3 Financial Info

| Apple sub-type | We collect? |
|---|---|
| Payment Info | No |
| Credit Info | No |
| Other Financial Info | No |

### 4.4 Location

| Apple sub-type | We collect? | Linked to User? | Tracking? | Purposes |
|---|---|---|---|---|
| **Precise Location** | Yes | **No** | No | App Functionality |
| Coarse Location | No (we only request precise; we don't separately collect coarse) | â€” | â€” | â€” |

**Critical answer:** Precise Location is **NOT Linked to User**. Per PP Â§2 ("Precise location, ephemerally") and ADR 0006: we send coordinates to Foursquare in the moment, discard them, and do not store them against the user's account. Apple's "Not Linked" definition fits this exactly: the data is not associated with the user's identity in a way that persists.

If ASC questions this during review, the supporting language is in the deployed PP: "We do not store your coordinates against your identity; we use them in the request and discard them."

### 4.5 Sensitive Info

| Apple sub-type | We collect? |
|---|---|
| Sensitive Info | No |

### 4.6 Contacts

| Apple sub-type | We collect? |
|---|---|
| Contacts | No |

### 4.7 User Content

| Apple sub-type | We collect? |
|---|---|
| Emails or Text Messages | No |
| Photos or Videos | No |
| Audio Data | No |
| Gameplay Content | No |
| Customer Support | No (no in-app support form â€” email is out-of-band via support@gettoit.app) |
| Other User Content | No |

0.1.0 has no free-text fields anywhere, so there is no user-generated content to declare.

### 4.8 Browsing History

| Apple sub-type | We collect? |
|---|---|
| Browsing History | No |

### 4.9 Search History

| Apple sub-type | We collect? |
|---|---|
| Search History | No |

### 4.10 Identifiers

| Apple sub-type | We collect? | Linked to User? | Tracking? | Purposes |
|---|---|---|---|---|
| **User ID** | Yes (anonymous device-bound UUID + optional Apple `sub` once linked) | Yes | No | App Functionality, Analytics |
| **Device ID** | Yes (APNs push device token, only if push permission granted) | Yes | No | App Functionality |

**On "User ID":** the anonymous UUID we generate IS the user's identity for anonymous accounts. Apple expects this as "Linked." Same for the post-link Apple `sub` value â€” that's the durable user ID once the user upgrades.

**On "Device ID":** the APNs push token is required for push delivery (S04 Waiting + S05 Verdict notifications per TB-08). We attach it to the user row so verdict pushes hit the right device. Linked to the user. No other use.

### 4.11 Purchases

| Apple sub-type | We collect? |
|---|---|
| Purchase History | No |

0.1.0 has no in-app purchases, no subscription, no payment flow.

### 4.12 Usage Data

| Apple sub-type | We collect? | Linked to User? | Tracking? | Purposes |
|---|---|---|---|---|
| **Product Interaction** | Yes | Yes | No | App Functionality, Analytics |
| Advertising Data | No | â€” | â€” | â€” |
| Other Usage Data | No | â€” | â€” | â€” |

**Product Interaction** covers everything in PP Â§2 bullet 3 (quiz answers, restaurant tap/scroll, ratification taps, rerolls, check-in answers) and PP Â§3 (used for running the decision + cohort-level Analytics rollups via the `metric_*` SQL views per [[checkin-telemetry|checkin-telemetry.md]]).

The Analytics rollups themselves survive account deletion because `events.user_id` is `on delete set null` (ADR 0006 amendment 2026-05-14). For ASC declaration purposes, however, the **collected** form of Product Interaction is **Linked** â€” analytics anonymization happens server-side at aggregation time, not at collection time. Apple's question is about the collection point.

### 4.13 Diagnostics

| Apple sub-type | We collect? |
|---|---|
| Crash Data | No (0.1.0 ships without a third-party crash reporter; Apple's built-in `os_log` crash collection â€” visible to the operator via Xcode Organizer â€” does not count as "data collected from your app" per Apple's own guidance, since it's an OS feature) |
| Performance Data | No |
| Other Diagnostic Data | No |

If 0.1.0 later adds Sentry / Crashlytics / similar, this section grows. Today it is empty.

### 4.14 Other Data

| Apple sub-type | We collect? |
|---|---|
| Other Data Types | No |

## 5. Summary table â€” what we declare

Quick recap of every YES, in one place. Use this to sanity-check the final ASC review screen before submit.

| Data Type | Linked | Tracking | Purposes |
|---|---|---|---|
| Contact Info -> Name | Yes | No | App Functionality |
| Contact Info -> Email Address | Yes | No | App Functionality |
| Location -> Precise Location | **No** | No | App Functionality |
| Identifiers -> User ID | Yes | No | App Functionality, Analytics |
| Identifiers -> Device ID | Yes | No | App Functionality |
| Usage Data -> Product Interaction | Yes | No | App Functionality, Analytics |

Six rows total. Everything else: **Not Collected**.

## 6. Privacy Policy URL

ASC asks for a Privacy Policy URL on the same App Privacy screen (separate from the data-type wizard). Paste:

```
https://gettoit.app/privacy
```

Confirmed live as of 2026-05-14 â€” see TB-16 / TB-00 framework-preset addendum.

## 7. After submit

- ASC saves the labels immediately; they do not require a fresh app submission to update later.
- The labels appear on the App Store listing the next time the listing is published.
- If you ever add a new SDK, new feature, or new third-party integration, return to this file FIRST. Update the labels in lock-step with the deployed Privacy Policy.

## 8. What this declaration does NOT cover

- **No "Privacy Choices" entries** â€” 0.1.0 has no in-app consent dialogs beyond the standard iOS prompts (Location, Notifications). Apple does not ask us to declare those in App Privacy.
- **No "Third-Party Partners" listing inside App Privacy** â€” App Privacy is about what *we* collect. Foursquare, Supabase, Vercel, and Apple are all disclosed in the deployed Privacy Policy Â§4, which Apple reviews via the URL above. ASC has no separate sub-form for subprocessors.
- **No EU-specific declarations** â€” we are US-only per ADR 0006. If/when EU launch enters scope, this runbook expands.

## 9. Related

- [[../15_issues/0.1.0/issues/tb-16-privacy-legal-delete|TB-16]] â€” parent issue.
- [[adr/0006-privacy-posture-0.1.0|ADR 0006]] â€” the privacy posture this declaration encodes.
- [[../../web/app/privacy/page.tsx|gettoit.app/privacy source]] â€” the policy the labels must match.
- [[../15_issues/0.1.0/issues/tb-17-testflight-cohort|TB-17]] â€” external TestFlight + cohort recruit, the next gate after TB-16 closes.
