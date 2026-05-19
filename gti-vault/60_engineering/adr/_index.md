---
folder: 60_engineering/adr
purpose: Architecture Decision Records — context, decision, consequences
---

# adr — Index

Architecture Decision Records. One file per decision, numbered from `0001`. Filename pattern: `NNNN-<kebab-slug>.md`.

ADRs are created lazily by `/grill-with-docs` when decisions crystallise. See `docs/agents/domain.md` for the consumer contract.

## Records

- [[0001-ios-tech-stack-supabase|0001 — iOS v1 tech stack: Swift + SwiftUI + Supabase]] (accepted 2026-05-12) — rejects Firebase (lock-in + per-doc-read fanout cost) and Convex (two-language tax + no PostGIS) on a balanced priority lens.
- [[0002-places-data-foursquare-mapkit|0002 — Places data: Foursquare primary, MapKit fallback]] (accepted 2026-05-12) — free-tier cost floor with vendor-risk hedge; rejects Google Places + Yelp Fusion (both paid).
- [[0003-web-fallback-nextjs-vercel|0003 — Web fallback: Next.js on Vercel]] (accepted 2026-05-12) — preserves viral loop for non-iOS invitees; reuses `design-system/tokens.css` directly.
- [[0004-monorepo-layout|0004 — Monorepo layout]] (accepted 2026-05-12) — `ios/`, `web/`, `design-system/`, `gti-vault/` siblings at repo root.
- [[0005-telemetry-supabase-event-store|0005 — Telemetry: Supabase tables + SQL views]] (accepted 2026-05-12) — north-star metric computable via in-stack SQL; no third-party analytics in v1.
- [[0006-privacy-posture-v1|0006 — Privacy posture v1]] (accepted 2026-05-12) — claimed-retained / anonymous-30d-TTL / in-app delete / no third-party preference sharing / US-only beta.
- [[0007-auth-anonymous-default-apple-upgrade|0007 — Auth: anonymous default + post-quiz Apple upgrade]] (accepted 2026-05-12) — preserves two-tap invitee promise; upgrade chip on Waiting surface.
- [[0008-ios-min-target-17|0008 — iOS minimum deployment target: iOS 17]] (accepted 2026-05-12) — Observable macro, stable ActivityKit, ~95% device reach.
- [[0009-locationpicker-as-reusable-component|0009 — LocationPicker as a reusable design-system component]] (accepted 2026-05-14) — adds `C-23 LocationPicker` rather than composing existing primitives; recurrence expected across profile, multi-geo, and post-v1.1 surfaces.
- [[0010-generic-jsonb-votes-schema|0010 — Generic jsonb votes schema + a schema-driven engine mapping layer]] (accepted 2026-05-15) — `votes` carries five generic `q1`..`q5` jsonb `{ meta, answer }` slots; the verdict engine reads them through a mapping layer that dispatches on `meta.question_kind`, so quiz content changes without a migration.
- [[0011-worst-off-protecting-verdict-engine|0011 — Worst-off-protecting verdict engine (EBA + satisficing floor + maximin)]] (accepted 2026-05-15) — full rewrite of the verdict engine; a maximin tiebreak over a satisficing floor protects the worst-off member, so a polarizing higher-sum pick loses to a worst-off-protecting one. Rejects utilitarian sum / centroid aggregation.
- [[0012-candidate-pool-floor|0012 — Candidate-pool floor]] (accepted 2026-05-19) — a named eight-category `Dining and Drinking` allowlist applied as a fetch-time hard filter on every Foursquare call, so the Q5 candidate pool and the verdict candidate set derive from one floored union. Closes the un-floored general-call leak; reconciles with v1.1-quiz-amendments §5.
