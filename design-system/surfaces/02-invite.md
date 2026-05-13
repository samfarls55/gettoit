---
surface: 02-invite
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenInviteUnfurl.jsx
  - code/screens/ScreenInviteWeb.jsx
---

# S02 · Invite Unfurl + Web Fallback

> **Code:**
> - [`../code/screens/ScreenInviteUnfurl.jsx`](../code/screens/ScreenInviteUnfurl.jsx) — iMessage link preview (canon path)
> - [`../code/screens/ScreenInviteWeb.jsx`](../code/screens/ScreenInviteWeb.jsx) — hosted fallback page for non-installers

## What this surface defends against

- **Algorithm framing.** The sender's name is the eyebrow (`"Maya sent you a session"`) — Maya is asking, not the app.
- **Coercion.** Sessions have an expiration. Non-answering is a valid path (it just lowers quorum). The unfurl doesn't say "answer now."
- **Onboarding cliff.** Web fallback is first-class. A non-installer can participate in a session within 30 seconds without downloading.

## Two modes, one design language

| Mode | Where it lives | When you see it |
|---|---|---|
| iMessage unfurl | Inside any chat thread that links the session | Most recipients — link preview just appears when Maya pastes |
| Web fallback | Standalone page at `gettoit.app/s/<sessionId>` | Recipients without the app — tap the unfurl, land on the web page, answer in browser |

The web fallback uses the same gradient + display type as the unfurl card, so visual continuity is preserved across the install boundary.

## Copy register

- **Unfurl eyebrow `"Tonight's session"`** — definite article. The unfurl carries weight on its own; the chat context provides the urgency.
- **Web headline `"{Sender} sent you a session"`** — credits the initiator, not the app. The sender is the asker.
- **Web CTA `"Answer in browser"`** — voluntary verb, plain noun. Counter-intuitively *not* `"Open in app"` as primary — the optimization target is "answer fast," not "drive installs."
- **Expiration line `"gettoit.app/s/<id> · expires in 27 min"`** — transparent. Users know the link has a half-life.

## Implementation notes

- Unfurl is OG/Twitter meta tags + hosted preview image generated server-side. The visual in `ScreenInviteUnfurl.jsx` is what `og:image` should render to (1200×630 portrait crop for chat clients).
- Session expiration is 4h from generation. The remaining minutes are computed at render time.
