# iOS Tech Stack Research — GetToIt 0.1.0

_Generated from `results/*.json` via `generate_report.py`. See `_index.md` for scope, `outline.yaml` for items, `fields.yaml` for field framework._

**Topic:** optimal iOS tech stack for group-decision / food-discovery apps  
**Priority lens:** balanced — ship 0.1.0 fastest without painting into corner  
**Stacks evaluated:** 8  

## Stacks at a glance

| #   | Stack                                                         | TTFP                                                                   | Cost @ 1k DAU                                                          | Perf / $                                                               | Lock-in                            |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| 1   | [Swift + SwiftUI + CloudKit](#cloudkit)                       | Fast for a SwiftUI+SwiftData dev: ~3-7 days to a working group-vote... | $0/mo                                                                  | Unbeatable in $/DAU terms — effectively zero infrastructure cost fo... | Highest of any stack in comparison |
| 2   | [Swift + SwiftUI + Convex](#convex)                           | 3-7 days realistic for a single-room group-vote demo (auth + room c... | Roughly $0-$10/mo                                                      | Strong in 0-1k DAU (free), good in 1-10k DAU (Pro envelope fits nat... | Medium                             |
| 3   | [Swift + SwiftUI + Firebase](#firebase)                       | 2–5 days for a solo dev with Claude Code                               | Typically $0–10/mo on Blaze if you stay under daily free quotas        | Strong for read-light apps, weak for read-heavy (chat, voting, pres... | High                               |
| 4   | [Swift + SwiftUI + InstantDB](#instantdb)                     | ~3-5 days to a working group-vote room for a Swift dev who's alread... | —                                                                      | Strong in the 0-10k DAU window for GetToIt's specific shape (bu... | Moderate                           |
| 5   | [Swift + SwiftUI + Nakama](#nakama)                           | 5-10 days for a working group-vote room                                | Self-host on Hetzner CX22 (~$5/mo) + managed Postgres or self-manag... | Best-in-class IF self-hosted on bare-metal VPS (Hetzner)               | Low                                |
| 6   | [Swift + SwiftUI + Supabase](#supabase)                       | 3–7 days to a working group-vote room for a solo dev with Claude Code  | $0/mo if comfortable with free-tier project pause risk; $25/mo Pro ... | Best-in-class for the 0–10K DAU social/group bracket among hosted BaaS | Low                                |
| 7   | [Swift + SwiftUI + Supabase + PowerSync](#supabase-powersync) | 5-10 days realistic                                                    | Roughly $25-$60/mo                                                     | Strong but base-cost-heavy                                             | Lower than Convex                  |
| 8   | [Swift + SwiftUI + Turso](#turso)                             | 10-20 days for a working group-vote room — longer than Nakama becau... | Likely $0 (free tier)                                                  | Excellent for write-light / offline-first / async workflows            | Moderate                           |

## Swift + SwiftUI + CloudKit
<a id="cloudkit"></a>

### Basic Info
- **name** — Swift + SwiftUI + CloudKit
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — CloudKit (Apple-native BaaS; CKDatabase + CKShare custom zones for groups; SwiftData/Core Data integration; APNs for sync push)

### Category Fit
- **realtime_quality** — Mediocre to acceptable. CloudKit is not a true realtime push system; it uses CKSubscription + silent APNs to notify clients of changes. Typical end-to-end latency is 'around 15 seconds for pretty good performance' per Apple developer forums, with reported tail latency >10 seconds for 1KB deltas. No guaranteed sub-second sync. iOS 26.4 (April 2026) shipped a regression that broke CloudKit silent push entirely for many third-party apps; Apple released 26.4.1 on April 8 2026 to fix it — a recent reminder that the realtime layer is Apple-controlled and can break under your feet. For GetToIt's group-vote UX, 5-15s latency is noticeable but tolerable if compensated by optimistic UI; not on par with InstantDB/Firebase/Supabase.
- **presence_support** — None native. CloudKit has no presence/typing/who's-online primitive. You'd hack it via short-TTL records that each client writes on heartbeat — works but burns ops/sec budget and inherits the 15s latency. Effectively a no-go for live presence; recommend not advertising 'live presence' as a feature on this stack.
- **optimistic_updates** — Possible but DIY. SwiftData/Core Data + CloudKit shows local writes immediately on the writing device; propagation to other devices is the slow part. No built-in rollback if the server rejects — you write your own conflict handler. Reasonably ergonomic with SwiftData but you build it yourself.
- **offline_handling** — Excellent. SwiftData/Core Data is the local store; CloudKit is the sync layer. App works fully offline by default; sync resumes automatically when network returns. Single strongest CloudKit attribute for GetToIt's subway-vote scenario.
- **auth_flow_friction** — Lowest possible. User is already signed into iCloud at the OS level — no app-level signup, no email, no magic code, no password. CKShare invite link opens directly to the room with system-level acceptance UI. Zero-tap auth for the inviter, two-tap for the invitee (open link, tap 'Join'). Caveat: requires invitee to be signed into iCloud (~all iOS users) AND have your app installed.
- **social_invites** — Excellent for iOS-to-iOS sharing. CKShare URL drops cleanly into iMessage, Mail, AirDrop, share sheet — Apple owns this UX end to end. Caveat: invitee must have your app installed or accept install prompt; no web fallback. Universal Links + App Store deferred deep link is the bridge for new users.
- **push_notifications** — First-class via CKSubscription. Server (or other devices) writes a record, all subscribers get a silent push that triggers a fetch + UI update. Apple-operated, free, reliable when it works (see iOS 26.4 incident for the 'when it doesn't' case). No infrastructure to operate.
- **group_session_model** — Natively CKShare + custom zone. The zone-sharing pattern (one zone per room, share that zone) maps cleanly onto 'N humans voting on M options'. Apple's `sample-cloudkit-zonesharing` repo is the reference. CKShare records carry participant list, permissions, accept-state — all the room-membership bookkeeping is free.
- **vote_write_fanout_pattern** — 1 vote = 1 CKRecord save in the shared zone -> Apple's CloudKit infra fans out CKQuerySubscription / CKRecordZoneSubscription notifications to all participants -> each device wakes via silent push, fetches the changed record, updates UI. Cost: zero $ per fanout (Apple eats it). Latency: 5-15s typical, occasional minutes-long lag. Throughput cap: 40 requests/sec on free tier baseline (scales linearly with users via per-user grant).
- **session_ttl_support** — DIY entirely. No CloudKit-side cron, scheduled function, or TTL. To compute 'deadline hit -> verdict', either (a) compute client-side when the next participant opens the app and notices the deadline passed (lazy eval, no server cost) or (b) run an external worker (Cloudflare Cron, your own VPS) that hits CloudKit Web Services API on schedule. Option (a) is the iOS-idiomatic path; latency-of-verdict bounded by 'next time someone opens the app'.
- **room_membership_model** — First-class via CKShare. Participants enumerated, roles (owner / read-write / read-only) supported, accept/decline state tracked, permissions enforced server-side. Highest-fidelity room model of any stack in the comparison set.
- **quorum_or_deadline_eval** — DIY. No server compute. Strategies: lazy client-side evaluation (cheapest), background-refresh via BGAppRefreshTask on each participant's device, or external worker via CloudKit Web Services API. Lazy client-side is simplest and matches Apple's 'no servers' philosophy.
- **anonymous_invite_join** — No. CKShare participants must have iCloud accounts; anonymous voting is not supported. Invitee gets a system 'Accept' dialog showing their Apple ID. For GetToIt's 'send link to my Android friend' case this is a hard stop — fundamentally iOS-only-friends product. App Clip can read public CloudKit data starting iOS 16 but cannot write.

### Onboarding & Invite Friction
- **app_clip_support** — Read-only since iOS 16. App Clips can read from CloudKit public DB but cannot write. CKShare participation from an App Clip is not supported (CKShare implies a full iCloud account context). Means the App Clip pattern of 'tap link, vote, get prompted to install full app' is functionally blocked for write workflows like voting.
- **universal_link_invite_pattern** — Excellent. CKShare URLs are themselves Universal Links + custom-handled by the OS share-acceptance UI. Out-of-the-box experience.
- **contacts_pull_friction** — Standard Contacts framework — same as any iOS stack. CloudKit has no friend-graph primitive, but CKShare's invitee picker uses the system Contacts picker UI automatically.

### Velocity
- **time_to_first_prototype** — Fast for a SwiftUI+SwiftData dev: ~3-7 days to a working group-vote room using SwiftData+CloudKit auto-sync and a CKShare zone. Slower for someone new to CloudKit quirks (schema deploy-to-production step, dev/prod environment split, debugging silent-push failures via Console). Apple's `sample-cloudkit-zonesharing` cuts the time substantially.
- **learning_curve** — Steep early, easier later. CloudKit has a unique mental model (zones, shares, subscriptions, dev vs prod schema) with poor error messages and the famously bad CloudKit Dashboard. Once internalized, day-to-day is comfortable, but the first month is painful.
- **ecosystem_maturity_2026** — Mature but stagnant. CloudKit has been shipping since iOS 8 (2014); SwiftData+CloudKit integration is stable as of iOS 18+. WWDC tooling investments continue (sample repos updated, CloudKit Console UI iterations). The iOS 26.4 silent-push regression in April 2026 dented confidence; community sentiment is 'reliable until Apple breaks it'.
- **hiring_pool** — Largest of any backend in this comparison. Any iOS dev with 5+ years has touched CloudKit; SwiftData+CloudKit is in every recent tutorial. Hiring contractors is easy.
- **claude_code_familiarity** — Very high. CloudKit + SwiftUI + SwiftData is heavily represented in training data (Apple sample code, Hacking with Swift, Kodeco, Apple docs). Claude generates idiomatic code with high first-pass accuracy. Known sharp edges (schema deploy step, optional-everything for CloudKit compatibility) are well documented and Claude reliably warns about them.
- **xcode_first_class** — Yes. Best Xcode integration of any backend. SwiftData @Model with `cloudKitDatabase` mode, Xcode Previews work with mock containers, type-safe queries via `#Predicate`, CloudKit Console linked from Xcode, schema diffing in the editor. This is the home-field stack.

### Operational / Cost
- **cost_per_DAU_first_1k** — $0/mo. Trivially under the per-user-grant ceiling. The Apple Developer Program $99/yr is the only fixed cost.
- **cost_per_DAU_first_10k** — $0/mo. Per-user-grant scales linearly: 10k DAU = ~2.5 TB asset storage allowance, far above what a food-vote app uses. This is CloudKit's signature advantage.
- **cost_at_100k_DAU** — Likely still $0/mo for typical GetToIt payloads (small records, photo URLs offloaded). The 1 PB / 10 TB / 10k req/sec ceiling is the only theoretical wall and you'd hit application-layer scaling issues first. CloudKit cost trajectory at 100k+ DAU is by far the cheapest of any stack in the comparison.
- **perf_per_dollar** — Unbeatable in $/DAU terms — effectively zero infrastructure cost forever. Cost you pay is in dimensions other than $: (a) iOS-only, no Android ever, (b) realtime latency 5-15s not sub-second, (c) Apple-can-break-it risk (see iOS 26.4 incident), (d) DX friction during initial setup. For a solo dev shipping iOS-first food-vote app at 0-10k DAU, perf-per-dollar wins decisively if you can swallow the platform lock-in.
- **realtime_message_cost_per_1k** — $0. Silent pushes via APNs are free and unmetered. No 'per message' line item exists.
- **concurrent_connection_ceiling_free** — N/A — CloudKit doesn't maintain client WebSocket connections. Sync is via on-demand push + fetch, so there's no concurrency ceiling in the same sense as Firebase/Supabase/InstantDB. The relevant cap is 40 req/sec on the free baseline, scaling with per-user grants.
- **auth_mau_cost_curve** — $0 — iCloud auth is free, Sign in with Apple is free. No MAU billing on auth.
- **cold_start_egress_pattern** — Pull-on-open via CKDatabaseSubscription change tokens. App fetches deltas since last sync. Cold launch on a fresh device pulls full zone contents (small for vote rooms). Efficient.
- **vendor_lockin_risk** — Highest of any stack in comparison. CloudKit is iOS/macOS-only forever; no Android, no web client (CloudKit JS exists but is read-mostly and clunky). Data export is only via CloudKit Web Services API record-by-record — no SQL dump, no bulk export. Schema is heavily constrained (all-optional fields, no unique constraints) so migrating to a normalized SQL database requires data cleanup. Pivoting off CloudKit = rewriting the app's data layer entirely.
- **scaling_ceiling** — App-level ceiling is the 40 req/sec free baseline scaling linearly with users. For GetToIt's bursty write pattern (a vote every few seconds during a session) this is more than enough through 100k+ DAU. Latency ceiling is more concerning than throughput.
- **data_export_path** — Per-record via CloudKit Web Services API (REST). No SQL dump, no bulk JSON export, no event log. Building an export pipeline takes meaningful eng time.

### Apple Platform Alignment
- **swiftui_native_feel** — Best in class. SwiftData @Model + .modelContainer(for: ..., isCloudKitEnabled: true) + @Query is two lines of code from 'no backend' to 'syncing iOS app'. Gestures, haptics, animations are app-level and unconstrained. Whole stack feels designed together because it is.
- **sign_in_with_apple_native** — Not even needed for in-app auth (iCloud account is the auth context for CKShare). If you want SiwA for a separate user identity (e.g., for cross-platform fallback later), Apple-native and trivial.
- **app_review_friction** — Lowest of any stack. Apple loves apps that use CloudKit (it deepens lock-in to iCloud). Zero known review blockers.
- **foundation_models_ready** — Yes. Read CKRecord values from SwiftData, hand to FoundationModels for verdict summaries / place rationales, write the response back as a new record. On-device, no API keys, no cloud costs. Apple's privacy story aligns: everything stays on-device + in iCloud.
- **app_intents_data_dependency** — Best support of any stack. App Intents + SwiftData + CloudKit is a documented WWDC pattern; @Dependency injection of the model container is idiomatic. Live data flows into Shortcuts, Siri, App Intents with no glue code.
- **liveactivity_dynamic_island_push** — Possible but DIY APNs to your activity tokens. CloudKit silent push won't reach Live Activities directly — you need to operate an APNs sender (your own worker or service) that observes CloudKit changes (server-side via CloudKit Web Services API) and forwards them as Live Activity updates. Same plumbing required as any non-Firebase stack.
- **widget_timeline_data_access** — Best in class. SwiftData + CloudKit in a widget extension works out of the box via shared App Group container. WidgetKit reloads on CKDatabaseSubscription pushes.

### Food Vertical Fit
- **geo_query_support** — No native CloudKit geo index. CKRecord supports CLLocation type fields but no radius queries. The right tool is MapKit MKLocalSearch.Request for nearby restaurant search — free, Apple-native. Store the results as CKRecords in the room zone.
- **places_data_integration** — MapKit is the obvious primary — free, Apple-native, good in major metros. Foursquare or Google Places as fallback for category/photo data. Stack-neutral; CloudKit doesn't constrain choice.
- **places_api_total_cost_at_1k_DAU** — MapKit primary: $0. Foursquare fallback within 10k calls/mo free: $0. Google Places (post-Feb-2025 free-credit removal): ~$17 per 1000 Text Search calls, so ~$170/mo at 10k calls. Recommend MapKit + Foursquare combo = $0 through low-thousands DAU.
- **places_data_freshness** — MapKit: fresh in US major metros, sparser internationally. Foursquare: best category/taste data. Google Places: best photo quality. Backend-neutral.
- **image_storage_cost** — Free up to per-user grant. 250 MB asset storage per user means each user can store 1250 dish photos at 200KB each before exceeding their grant. At 10k DAU that's 2.5 TB free asset storage — plenty.
- **image_cdn_included** — CloudKit assets are served from Apple's CDN automatically with no transform support (no resize, no format conversion). For thumbnails you generate them client-side or via on-device image processing before uploading multiple sizes.

### Push & Notification UX
- **silent_push_to_compute_widget** — First-class via CKDatabaseSubscription. Apple sends silent push automatically when records change; widget refreshes via WidgetKit timeline reload. Zero infrastructure.
- **cross_user_push_fanout_cost** — $0. CloudKit + Apple's APNs eat the entire fanout cost. Notifying all 5 group members on each vote is free.

### Risk & Longevity
- **single_founder_maintainability** — Best in class. Zero ops, no servers to maintain, no scaling decisions. Apple operates the backend. Solo dev can run a 100k-DAU app on CloudKit while sleeping.
- **community_size** — Massive. CloudKit has 10+ years of Stack Overflow Q&A, Apple developer forums, WWDC sessions, books, courses. Largest community of any stack in comparison.
- **last_major_release** — Continuous. iOS 26 (2025) and iOS 26.4 (April 2026) both included CloudKit changes. Apple ships updates every cycle; framework is not deprecated or in maintenance mode.
- **notable_failure_modes** — (a) iOS 26.4 silent-push regression April 2026 — broke realtime sync until 26.4.1 hotfix April 8 2026. (b) Production schema deploy is a manual step in CloudKit Console; forgetting it means 'works in Xcode, broken on App Store' silent failures. (c) macOS apps must explicitly link CloudKit.framework or release builds fail silently. (d) Record-type indexing bug reported on Apple forums July 2025 — new records of an existing type stopped appearing in query results in Production environment for some apps. (e) CKShare zone-sharing constraint: 5000-record limit on the root record of a share. (f) Real-time latency unpredictable (1s best case, 10s+ worst case, no SLA).
- **funding_runway_signal** — N/A — Apple. As long as iCloud exists, CloudKit exists. No funding risk; instead, the relevant signal is Apple's strategic interest in iCloud (very high — it's a moat product).
- **eol_history** — Apple has EOL'd many APIs (iCloud Drive Documents, Backboard, etc.) but CloudKit itself has not been EOL'd and shows no signs (continued WWDC investment, SwiftData integration in iOS 17, CKShare improvements through iOS 26). Realm (Atlas Device Sync) was EOL'd September 2025 by MongoDB — a reminder that even mature sync products die. CloudKit has the lowest EOL risk of any third-party-vendor option simply because Apple's incentive to kill it is near-zero.
- **self_host_escape_hatch** — None. CloudKit is closed source and Apple-operated only. If Apple breaks it (see iOS 26.4) you wait for Apple to fix it. No self-host option exists or ever will.
- **data_export_format** — CloudKit Web Services REST API returns JSON per record. No SQL dump, no bulk export tooling, no event log. Bulk migration off CloudKit requires writing an iterating exporter against the Web Services API.

### Uncertain fields
- shareplay_groupactivities_fit
- free_tier_ceiling
- egress_cost_image_heavy
- apns_priority_tier_support

## Swift + SwiftUI + Convex
<a id="convex"></a>

### Basic Info
- **name** — Swift + SwiftUI + Convex
- **primary_language** — Swift (client), TypeScript (backend functions)
- **ui_framework** — SwiftUI (UIKit interop available)
- **backend** — Convex — TS-defined reactive backend with end-to-end type-safe queries, mutations, actions; built-in realtime via reactive query subscriptions; storage, file storage, scheduled functions, cron, search indexes

### Category Fit
- **realtime_quality** — Best-in-class for the BaaS category. Convex's model differs from Supabase/Firebase: every query function is automatically a live subscription — the server reruns the query function on any data dependency change and pushes the new result to subscribed clients with strong consistency. There is no separate 'changefeed' or 'channel' abstraction; the subscription IS the query. The Swift client exposes this via ConvexClient.subscribe(...) returning a Combine Publisher of query results. For a group-vote room this means: write a single query function getRoomState(roomId) -> {options, votes, members, verdict?}, every member's iOS client subscribes to it, and any vote write triggers automatic recomputation and fan-out. Consistency is transactional — clients never see a torn read.
- **presence_support** — No first-class presence primitive like Supabase Realtime's presence channels. Build it on top: write a heartbeats table with lastSeen timestamps, query function filters to recent (<30s) members. Cheap to model but DIY. Typing indicators / 'voted' badges fall out naturally because vote rows already drive the reactive query.
- **offline_handling** — Weakest area. Convex does not provide a full offline sync layer like PowerSync/Replicache. The Swift client handles intermittent network blips (queue + retry the active mutation on reconnect) but does not give you a persistent local replica of the room state. 'Vote on subway' works in the narrow sense that one queued mutation survives a brief disconnect, but reading the room and seeing other members' votes while fully offline does NOT work out of the box. Convex's own blog points users to Automerge or Replicache for serious local-first needs.
- **auth_flow_friction** — Low-to-medium. Convex Auth library supports magic links, OTPs, and OAuth (Apple, Google, GitHub). Apple OAuth requires a deployed HTTPS site (Apple won't OAuth to localhost), which is mild dev-friction. For native iOS the cleanest path in 2026 is Clerk-Convex-Swift (clerk/clerk-convex-swift) which handles Sign in with Apple natively via ASAuthorizationController and exchanges the credential for a Convex JWT, or rolling your own AuthProvider against Convex Auth.
- **social_invites** — DIY. No first-party share-sheet / contacts pull helpers. Use Apple's Universal Links + a Convex HTTP action to mint and resolve invite tokens. Standard SwiftUI ShareLink + Contacts framework on the client.
- **push_notifications** — No built-in APNS dispatcher. Pattern: Convex action calls a third-party push service (Expo Push, Knock, OneSignal, Courier, a0.dev, or direct APNS via a Node SDK in a Convex action) when a verdict-ready event fires. Adds a vendor but is standard. Device-token storage and silent-push triggers must be modeled in your Convex schema.
- **group_session_model** — Excellent fit. The 'N humans voting on M options with a deadline' pattern maps cleanly to Convex documents: rooms table (deadline, status), options table (roomId, label, placeData), votes table (roomId, userId, optionId, weight, ts), members table (roomId, userId, role). One reactive query per room returns the merged view; a scheduled function (Convex cron / scheduler.runAt) fires at the deadline to compute the verdict and flip room.status — all members' subscriptions auto-update. This is arguably the textbook Convex use case.
- **vote_write_fanout_pattern** — A vote write is one mutation. Convex's reactivity engine identifies every active query whose dependency graph touches the affected rows (the room's vote/option/member docs) and reruns ONLY those queries server-side, then pushes deltas over websocket to subscribed clients. Billing-wise this counts as one mutation call + N query reruns (each re-execution is a function call). For a 5-person room this is ~6 function calls per vote. At 10k DAU with typical 2 rooms/day/user and 5 members/room, expect ~60k vote events/day producing ~360k function calls/day from fan-out alone — roughly 10.8M/month. This sits above the free tier (1M/mo) but well inside the $25 Pro tier's 25M envelope.
- **session_ttl_support** — First-class via Convex scheduler. Mutations can call ctx.scheduler.runAt(deadlineMs, internal.rooms.evaluateVerdict, {roomId}). Built-in, durable, exactly-once-ish — no external cron service needed. Ideal for deadline-bounded voting rooms.
- **room_membership_model** — DIY but trivial — a members table with (roomId, userId, role, joinedAt). Convex enforces auth and authorization inside query/mutation functions (you write the checks). No prebuilt rooms/permissions primitive like a chat SDK, but the freedom is part of the point.
- **quorum_or_deadline_eval** — Two clean paths: (a) scheduled function at deadline computes verdict in one transaction; (b) after each vote, a mutation checks if vote count === member count and triggers verdict computation inline. Both are server-authoritative and transactional. Combine for 'whichever comes first' semantics.
- **anonymous_invite_join** — Supported pattern via Convex Auth Anonymous provider OR by storing an invite-token row and letting an unauthenticated HTTP action create a temporary session bound to that room only. Not as turnkey as Firebase Anonymous Auth but well within a day's work. App Clip integration is purely client-side and orthogonal.

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — Standard iOS Universal Links (apple-app-site-association on your domain) routed to a SwiftUI scene that calls a Convex HTTP action to validate the invite token and add the user to the room. No vendor-specific helpers.
- **contacts_pull_friction** — Pure Apple-side concern — CNContactStore + permission prompt. Convex is uninvolved.

### Velocity
- **time_to_first_prototype** — 3-7 days realistic for a single-room group-vote demo (auth + room create + invite link + vote + verdict). Convex's TS-first backend and end-to-end type safety, combined with Claude Code's strong TS coverage, make this one of the faster stacks to bootstrap. The Swift client API is small and reactive subscriptions ship working in tens of lines.
- **learning_curve** — Moderate. Swift dev learns TypeScript + Convex's query/mutation/action mental model (~1-2 days). The reactive query model is the big concept — once it clicks, productivity is high. Schema definition in TS (with Convex's v.* validator types) is more ergonomic than SQL migrations.
- **ecosystem_maturity_2026** — Swift SDK shipped GA late 2024 with continuous iteration through 2026. Backend itself is mature (used in production by T3 Chat, Resend, and many YC startups). Docs are good; Discord active. Smaller than Firebase/Supabase community but well above Realm-grade.
- **hiring_pool** — Small but growing. Convex is well-known in the TS/React startup scene; Swift+Convex specifically is niche. Solo dev + Claude Code is the realistic mode; contractor pool is limited.
- **claude_code_familiarity** — Strong. Convex's TS API surface has wide LLM training-data coverage thanks to documentation density and active blog (stack.convex.dev). The Swift client is newer so LLM-generated Swift call sites may need correction against the current SDK API. Expect ~85% of generated TS to compile first try, ~70% of generated Swift to compile first try.
- **xcode_first_class** — Decent. SPM package with type-safe Swift wrappers. Schema is defined in TS, not Swift, so there is no native Swift codegen for schema types — you hand-write Codable structs that mirror the TS schema. No Xcode preview integration beyond standard SwiftUI previews.

### Operational / Cost
- **free_tier_ceiling** — Starter (free) plan: 1M function calls/mo, 0.5GB database storage, 1GB file storage, 20 GB-hours of action compute, 1GB data egress. For GetToIt at pre-launch through ~100 DAU, free tier comfortably covers everything. Note: Starter is pay-as-you-go beyond the free allowances (you set a spend cap) — there is no hard cap that errors out unless you configure one.
- **cost_per_DAU_first_1k** — Roughly $0-$10/mo. 1k DAU × 2 rooms/day × 5 members × ~6 function-call fan-out per vote × ~30 days ~= 1.8M function calls (well below 25M Pro envelope, and even within 1M Starter if vote frequency is lower). On Starter, overage at ~$2.20 per additional 1M function calls = ~$2 in function overage; storage + bandwidth marginal. Realistic month-1k figure: under $10 unless image storage explodes.
- **cost_per_DAU_first_10k** — Roughly $25-$75/mo. 10k DAU × 2 rooms × 5 members × 6 fan-out ~= 18M function calls/mo — fits inside Pro's 25M included. $25 base + minor storage + ~5-15GB egress at $0.12/GB ($0.60-$1.80) + image storage. Place data caching (Google Places / Foursquare lookups stored in Convex) keeps food-vertical reads cheap.
- **cost_at_100k_DAU** — Roughly $400-$1,500/mo. 100k DAU at the same pattern produces ~180M function calls/mo. Function overage ~$2.20/1M × 155M = ~$340. Add database bandwidth ($0.20-0.22/GB), egress ($0.12/GB), storage. Convex stays competitive at this scale but is not the cheapest — a hand-rolled Postgres+websockets shop can beat it. Trajectory is OK, not exceptional.
- **perf_per_dollar** — Strong in 0-1k DAU (free), good in 1-10k DAU (Pro envelope fits naturally), middling at 100k+. The reactivity-per-dollar is excellent because one mutation drives server-side fan-out without you provisioning a websocket gateway. The big risk is function-call inflation from chatty subscriptions; budget by designing coarse query functions per room rather than many fine-grained ones.
- **realtime_message_cost_per_1k** — Convex doesn't bill 'realtime messages' as a separate line item. Every push to a subscribed client comes from a query function execution, which is billed as a function call. Effective cost per 1k realtime updates: ~$0.0022 (= $2.20 per 1M function calls). This is materially cheaper than Pusher/Ably ($1+ per 1M messages on cheaper tiers) and on par with Supabase Realtime when bundled.
- **auth_mau_cost_curve** — Convex Auth does not bill per MAU — auth state is just rows in your users table, billed as storage + function calls. This is a significant cost advantage vs Supabase ($0.00325/MAU above 100k) or Firebase Auth pricing at scale.
- **egress_cost_image_heavy** — Convex's unified 'data egress' rate is $0.12/GB (covers file downloads, action egress, log streams, deployment backups) — recently reduced ~3x from the prior file-bandwidth price. Cheaper than Supabase uncached egress ($0.09/GB cached / Supabase is actually similar/cheaper for cached). Convex does not have a Smart-CDN tier with separate cached/uncached rates.
- **cold_start_egress_pattern** — On app open the Swift client opens a websocket and the active subscriptions re-resolve, fetching current values. Each resolved query is a function call. The 'cost shape' on app open is N function calls (one per active subscription) + the corresponding result payloads counted toward egress. Mitigate by keeping the room screen's query coarse and the home-screen query lightweight.
- **vendor_lockin_risk** — Medium. The backend is defined in TS against Convex APIs (ctx.db.query, ctx.scheduler, etc.) that have no direct equivalent elsewhere. Migrating to Supabase or a custom Postgres+websockets stack would require rewriting all server functions and the reactive-subscription glue on the client. However, Convex is open-source (FSL → Apache-2.0 after 2 years) and self-hostable in Docker with Postgres backend support, which is a real escape hatch (with operational cost). Data is exportable via SQL dump from the self-hosted Postgres path or via Convex's own export.
- **scaling_ceiling** — Convex publicly handles workloads into hundreds of thousands of users. Known production gotchas surfaced in the June 2025 T3 Chat postmortem: text search indexing compaction can cause query invalidation storms, and manual deploy tooling didn't preserve provisioned VM types. The platform itself has not hit a publicly-documented hard scaling wall, but search-index-heavy workloads need vetting. Convex transparently posts postmortems — credibility signal.
- **data_export_path** — Multiple: (a) self-host with Postgres backend gives you direct SQL access; (b) Convex Cloud has a deployment export feature producing a snapshot; (c) HTTP actions can stream data out to S3 or any sink on demand. Format is JSON documents.

### Apple Platform Alignment
- **swiftui_native_feel** — Standard SwiftUI — Convex is just a data layer behind your views. Gestures, animations, haptics are unaffected. Reactive subscriptions integrate cleanly with @StateObject / @Observable view models via the Combine Publisher returned by subscribe.
- **sign_in_with_apple_native** — Supported via Convex Auth's Apple provider OR via Clerk-Convex-Swift integration. Native ASAuthorizationController on the client → exchange the Apple identity token for a Convex JWT. Apple's localhost restriction means dev requires a public HTTPS deploy for OAuth testing.
- **app_review_friction** — No known Convex-specific App Store review blockers. Standard concerns apply (data deletion endpoint required for accounts; clear privacy policy; only request contacts permission when used).
- **foundation_models_ready** — Fully compatible. Foundation Models is an on-device Apple framework — the data fed to it (verdict summary text, place rationale) comes from your Convex query results. Convex doesn't gate this. Pattern: a Convex query returns the place + vote distribution; Swift code constructs a prompt and calls FoundationModels.LanguageModelSession on-device.
- **app_intents_data_dependency** — App Intents that read live Convex data is awkward because the AppIntent runs in the main app's process and a fresh ConvexClient must be initialized + subscribed each invocation — there's startup latency on the websocket handshake. Acceptable for one-shot 'check verdict' intents; not ideal for high-frequency intents. No iOS-extension-shared-DB constraint (since Convex has no local DB to share).
- **liveactivity_dynamic_island_push** — Server-driven Live Activity updates are possible via APNS push tokens registered for the activity, but Convex does not have a built-in Live Activity push helper. Pattern: a Convex action collects activity push tokens and POSTs APNS pushes with content-state updates. Same APNS infrastructure as alert pushes, different payload.
- **widget_timeline_data_access** — Widget timelines run in a separate process and cannot share a websocket. Pattern: a background-refresh in the main app writes a JSON snapshot to App Group UserDefaults; widget reads from App Group. Or the widget fetches via a one-shot Convex HTTP action on timeline reload. Higher latency than a local-first stack but workable.

### Food Vertical Fit
- **geo_query_support** — Convex search/indexes do not natively support geospatial queries (no PostGIS equivalent). Pattern: store places with lat/lng + a geohash, query by geohash prefix as a filterable index, then refine in Swift on Haversine distance. Adequate for nearby-restaurants but less ergonomic than PostGIS or Firestore GeoQueries.
- **places_data_integration** — DIY. Call Google Places / Foursquare / Apple MapKit Local Search from a Convex action, cache the response in a places table, return cached entries to clients. Action calls are billed normally.
- **places_api_total_cost_at_1k_DAU** — Independent of Convex — driven by which places API you choose. Google Places ended its $200/mo free credit in Feb 2025; Foursquare Places API offers ~10k calls/mo free then ~$0.49 per 1k calls; Apple MapKit Local Search is free with reasonable rate limits. Aggressive caching in Convex (one places lookup per zip code per day, reuse across users) keeps cost negligible at 1k DAU regardless of provider.
- **image_storage_cost** — Convex file storage. Storage is metered as part of the database/file-storage included allowance; precise per-GB rate beyond the Pro tier's included quota is in the Convex pricing FAQ. Egress is the unified $0.12/GB rate.
- **image_cdn_included** — No built-in image CDN with on-the-fly transforms (no Supabase Smart CDN equivalent). File storage URLs are served directly. For a food vertical you will likely want Cloudflare Images, imgix, or pre-generated thumbnails written to Convex storage.

### Push & Notification UX
- **silent_push_to_compute_widget** — Standard iOS background-push pattern. A Convex action fires APNS with content-available:1; the iOS app's didReceiveRemoteNotification wakes briefly to refresh the App Group snapshot used by the widget. Convex provides no helper but does not impede.
- **apns_priority_tier_support** — Full — your Convex action constructs the APNS payload, so all APNS priority/push-type values are available.
- **cross_user_push_fanout_cost** — Convex billing: a 'notify all 5 members' fan-out is one Convex mutation that triggers one action that loops member device tokens and posts to APNS. Cost = 1 function call + N action invocations + zero APNS cost (Apple's APNS is free). The dominant variable cost is the third-party push provider if you don't bring your own APNS connection.

### Risk & Longevity
- **single_founder_maintainability** — Good. TS-first backend with Convex's hosted dashboard, type-safe schemas, and end-to-end tracing reduces operational burden. The Swift client is small enough to read end-to-end. Real risk: Convex-specific knowledge debt — TS-defined reactive backends are still uncommon enough that a future contractor or LLM may need ramp time.
- **community_size** — convex-backend repo ~11.5k GitHub stars. Active Discord (thousands of members). r/Convex small but engaged. Active first-party blog (news.convex.dev, stack.convex.dev). Smaller than Supabase or Firebase communities; comfortably bigger than truly niche BaaS.
- **last_major_release** — Continuous — backend and SDKs ship multiple releases per month. Swift SDK ongoing iteration through 2026; check github.com/get-convex/convex-swift/releases for the current tag (recent activity confirmed via product roadmap items shipping in April-May 2026 window).
- **notable_failure_modes** — 1) June 2025 T3 Chat postmortem: text-search-index compaction caused query invalidation storms; deploy tooling didn't preserve VM type. 2) Function-call cost can balloon with chatty subscriptions if queries are designed too fine-grained. 3) No offline replica — disconnected reads are not supported by the SDK. 4) Long-running 'actions' (non-deterministic, can call external APIs) have separate compute billing and cold starts. 5) Reactive subscriptions over flaky networks reconnect and re-resolve, adding bursty function calls.
- **funding_runway_signal** — Strong. $24M raise led by a16z (with Spark Capital co-lead) closed in 2025. Public reports cite ~$11M ARR by Oct 2024, up from $6.2M Dec 2023. Founder Jamie Turner publicly active. No layoff or distress signals as of May 2026.
- **eol_history** — No products killed by Convex Inc. (the company's only product is Convex). Open-sourcing the backend in 2024 is a positive signal for long-term continuity.
- **self_host_escape_hatch** — Real but operationally heavy. Open-source backend (FSL Apache 2.0, converts to pure Apache after 2 years per file) supports Postgres or SQLite, dashboard included, Docker packaged. Convex Inc. explicitly warns it is NOT a supported alternative to the hosted product and offers no support plan for self-host. Realistic use: parachute option if the company dies, not a daily-driver.
- **data_export_format** — JSON document export from hosted dashboard; SQL via the self-hosted Postgres path; HTTP actions can stream to any destination.

### Uncertain fields
- optimistic_updates
- app_clip_support
- shareplay_groupactivities_fit
- concurrent_connection_ceiling_free
- places_data_freshness

## Swift + SwiftUI + Firebase
<a id="firebase"></a>

### Basic Info
- **name** — Swift + SwiftUI + Firebase
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — Firebase (Cloud Firestore + Cloud Messaging + Firebase Authentication + Cloud Storage + Cloud Functions)

### Category Fit
- **realtime_quality** — Mature, battle-tested, the gold standard for mobile real-time. Firestore snapshot listeners push document/query changes over a single multiplexed HTTP/2 connection with automatic exponential-backoff reconnect, offline cache replay, and order guarantees. The system is engineered specifically for mobile networks (handles airplane mode, cellular handoff, app suspension gracefully). For group voting: every connected client gets an updated vote count in 100–500ms with no DIY plumbing. Caveat: per-document read is billed on every listener trigger — $0.18 per 100K reads compounds with chat-heavy fanout.
- **presence_support** — No native Firestore presence. Standard pattern requires bridging to Realtime Database (which has native onDisconnect()) and mirroring state into Firestore via Cloud Functions. Three moving parts vs Supabase's one-channel presence. Documented in official Firebase docs but adds setup friction and a second billed product.
- **optimistic_updates** — Built-in. Firestore's local cache applies writes immediately, snapshot listeners fire local 'pending' events with metadata.hasPendingWrites = true, then re-fire with server-confirmed state. SwiftUI views see instant feedback without manual reconciliation code. One of Firebase's strongest UX wins.
- **offline_handling** — Best-in-class. Persistent disk cache enabled by default on iOS — reads/writes/queries/listeners all work fully offline, sync automatically on reconnect. No conflict-resolution config needed; last-write-wins with server timestamps. 'Vote on subway' is zero engineering effort. The single feature where Firebase clearly outpaces Supabase.
- **auth_flow_friction** — Very low. FirebaseAuth + Sign in with Apple integration is canonical, samples plentiful. Anonymous auth in one call (Auth.auth().signInAnonymously()), upgradeable to linked identity later without losing UID. FirebaseUI provides drop-in auth screens.
- **social_invites** — Significant regression May 2025. Firebase Dynamic Links shut down Aug 25, 2025 — the previous flagship invite/deep-link product is gone. Replacement path: roll your own Universal Links + apple-app-site-association, or pay third-party (Branch, AppsFlyer, Kochava, ChottuLink). Same DIY position as Supabase now — Firebase no longer has a structural advantage here.
- **push_notifications** — FCM is the strongest push story in mobile. Free unlimited push delivery for iOS/Android/web — no per-message charge ever. APNs token handling abstracted away. Topic subscriptions, conditional sends, scheduled pushes all built-in. The 'no cost per push' line is genuinely true.
- **group_session_model** — Awkward fit. Firestore is document-oriented; a 'room of N humans voting on M options with a deadline' becomes /rooms/{id} doc + /rooms/{id}/members subcollection + /rooms/{id}/votes subcollection. Joining a room with members + recent votes requires multiple round trips (Firestore can't JOIN). Security rules per collection — workable but more verbose than RLS. The shape works, but you feel the NoSQL grain.
- **vote_write_fanout_pattern** — One vote = one document write ($0.18 per 100K writes) → snapshot listeners on /rooms/{id}/votes fire for every subscriber. The fanout is automatic but billed per read: 5-person room, 1 vote → 4 listener reads. At 10K DAU × 5 votes/day × 4 watchers = 200K reads/day just for votes ≈ $11/mo. Compounds with chat, presence updates, status changes. This is the core Firestore cost-at-scale concern.
- **session_ttl_support** — DIY via Cloud Functions + Cloud Scheduler. Schedule a function to scan /rooms where deadline < now() AND status == 'open' every minute. No native TTL evaluator (Firestore has document TTL for deletion but not for triggering business logic). Workable, ~half-day setup.
- **room_membership_model** — DIY subcollection pattern. Security rules read room membership from a subcollection or array field — works but rule logic gets gnarly past 2 levels of nesting. No declarative 'user X is in room Y' primitive.
- **quorum_or_deadline_eval** — Cloud Functions trigger on /votes write → read all votes for room → if count == member count, write verdict to room doc. Or scheduled function for deadline. Each trigger is billable. Functions cold-start lag occasionally visible (~200–800ms).
- **anonymous_invite_join** — signInAnonymously() is one call, creates a Firebase UID, linkable to real auth later. Combined with Universal Link → vote in zero taps after install (must install app first; no App Clip story documented).

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — Post-Dynamic-Links death (Aug 2025), pure Apple Universal Links with apple-app-site-association on your domain. Firebase Hosting can host the AASA file for free. No bundled link-shortener — third-party or DIY.
- **contacts_pull_friction** — Apple Contacts framework, not Firebase. Standard CNContactStore flow. Firebase Auth supports phone-number sign-in (paid SMS) for friend-graph matching.

### Velocity
- **time_to_first_prototype** — 2–5 days for a solo dev with Claude Code. Firebase's tutorial coverage is the largest in mobile (~50K SO questions, official Codelabs, YouTube). SwiftUI + Firestore listener boilerplate is canonical, copy-paste. Faster than Supabase to first prototype mainly because offline + optimistic updates are free, no extra plumbing for snappy feel.
- **learning_curve** — Low if you've used Firestore before; moderate if you haven't — NoSQL data modeling (denormalization, subcollections, fanout writes) is a different muscle from SQL. Security Rules language is its own DSL.
- **ecosystem_maturity_2026** — Most mature mobile BaaS in existence. Firebase Apple SDK v12.13.x as of May 2026, releases every 1–2 weeks, Swift Package Manager primary (CocoaPods goes read-only Oct 2026). FirebaseFirestore module absorbed FirebaseFirestoreSwift extension — Codable + property wrappers in main SDK. Google's strongest mobile platform play.
- **hiring_pool** — Largest pool of all backends evaluated. Firebase is the default at bootcamps and the most-Googled mobile backend.
- **claude_code_familiarity** — Very high. Firebase has the largest training-data footprint of any BaaS (50K+ SO questions, decade of tutorials). Claude Code generates idiomatic FirestoreSwift + AuthSwift code reliably. Google released official Firebase MCP server + Agent Skills (Feb 2026) specifically for Claude Code / Gemini CLI / Cursor — most polished AI-assist story among BaaS options.
- **xcode_first_class** — Strong. @DocumentID property wrapper, Codable decode/encode built into FirestoreSwift, async/await throughout, Swift Macros for query building emerging. Xcode previews work because Firestore offline cache returns synchronously when seeded. Best Swift ergonomics among the BaaS options.

### Operational / Cost
- **free_tier_ceiling** — Spark plan (forever free): Firestore 1 GB storage, 50K reads/day, 20K writes/day, 20K deletes/day, 10GB/mo egress. Auth: 50K MAU. FCM: unlimited free pushes forever. Cloud Storage 5GB. Hard ceiling: if you exceed Spark, the product shuts off for the month unless you upgrade. Spark is a hard cap, not soft throttle — this is a structural risk for viral apps.
- **cost_per_DAU_first_1k** — Typically $0–10/mo on Blaze if you stay under daily free quotas. 1K DAU × 50 reads/day = 50K reads — at Spark's free limit. Real-world reports: $0.22/mo for 100 DAU, ~$5–10/mo for 1K DAU. Effective: ~$0.01/DAU/mo. Per-document-read billing is the constant risk.
- **cost_per_DAU_first_10k** — Documented example: 10K DAU social app with 5 feed loads + 1 post/day on denormalized model = $23/mo ($18 reads + $3.24 writes + $1.80 storage). Un-denormalized variant: $38/mo. For GetToIt's 5-person voting rooms with snapshot listeners: estimate $25–60/mo at 10K DAU, dominated by listener reads. Effective: ~$0.003–0.006/DAU/mo.
- **perf_per_dollar** — Strong for read-light apps, weak for read-heavy (chat, voting, presence). Per-document-read pricing means every snapshot listener tick costs money. Free quotas are generous enough that 0.1.0 typically costs nothing, but the cost curve steepens earlier than Supabase. Free push delivery (FCM) is uniquely valuable.
- **realtime_message_cost_per_1k** — Firestore doesn't bill messages — it bills reads. Each listener event = one read = $0.0018 per 1K. FCM push delivery is free regardless of volume. Different cost model than Supabase: pay per data-change-fanned-out, not per WebSocket message.
- **concurrent_connection_ceiling_free** — Firestore auto-scales to ~1M concurrent connections (no published free-tier cap beyond daily read limits). Realtime Database caps at 200K concurrent per database instance, shardable. No connection-count cliff — daily read quota is the real free-tier ceiling.
- **auth_mau_cost_curve** — Free up to 50K MAU. Above 50K, Identity Platform kicks in: $0.0055 per MAU on 50,001–100,000, steps down at higher volumes. ~70% more expensive per MAU than Supabase ($0.00325) above the free tier. Enterprise SSO different bracket ($0.015/MAU).
- **egress_cost_image_heavy** — Cloud Storage egress ~$0.12/GB after 10GB/mo free. Compare to Supabase Pro: $0.03/GB cached / $0.09/GB uncached. Firebase is meaningfully more expensive for image-heavy egress, especially without an explicit CDN tier. Mitigations: front Storage with Cloud CDN (extra setup + cost), or use Firebase Hosting cache.
- **cold_start_egress_pattern** — Snapshot listeners replay from local cache on app open — minimal cold-start network cost. Initial subscribe pulls only deltas if the cache is warm. Best-in-class cold-start UX.
- **vendor_lockin_risk** — High. Firestore query model, security rules, and proprietary data format have no off-Google equivalent. Export path: Firestore export → Cloud Storage → BigQuery (one-way analytics, not portable to another OLTP store). Migrating off Firebase to Postgres is a substantial rewrite. Auth schema (custom claims, providers) is Firebase-shaped. The Firebase Extensions ecosystem deepens lock-in further.
- **scaling_ceiling** — Firestore: ~10K writes/sec per database (sharding via multiple databases possible since Native mode multi-DB GA), ~1M concurrent connections. Hot-document writes capped at ~1/sec/document. Far beyond GetToIt's 0.1.0 horizon. At very high scale, Firestore's per-op cost becomes prohibitive before its technical ceiling.
- **data_export_path** — Firestore export to Cloud Storage (proprietary format loadable into BigQuery only). No SQL dump. Auth users exportable via Admin SDK to JSON. Storage assets accessible via gsutil. Practical migration off Firebase is a multi-week project.

### Apple Platform Alignment
- **swiftui_native_feel** — Excellent. FirebaseFirestore Swift APIs are Codable-first, @DocumentID + @FirestoreQuery property wrappers feel SwiftUI-native. Async/await across SDK. SwiftUI environment injection patterns documented.
- **sign_in_with_apple_native** — First-class. AuthCredential from ASAuthorizationAppleIDCredential identity token + nonce, then Auth.auth().signIn(with: credential). Standard 30-line implementation. Anonymous → Apple link conversion supported (anonymous UID preserved).
- **app_review_friction** — Low. Firebase has zero known structural App Review issues. Privacy Manifests shipped in SDK (took until ~2024 to land — early days were rough but settled). Crashlytics manifest required disk-space-collection removal in 2024 SDK update.
- **foundation_models_ready** — Backend-agnostic — Foundation Models run on-device. Firebase also offers Firebase AI Logic / Genkit for cloud LLMs (Vertex / Gemini) with optional federation, but for GetToIt's iOS 26 Foundation Models use case, no Firebase-side integration needed.
- **app_intents_data_dependency** — DIY but unobstructed. App Intent → instantiates shared Firestore reference → Codable fetch. Works with Firestore's offline cache (intents resolve fast).
- **liveactivity_dynamic_island_push** — FCM HTTP 0.1.0 supports Live Activity push remotely via push-type: liveactivity headers — documented, with FCM handling the APNs translation. push-to-start tokens supported (iOS 17.2+). Cleaner integration than Supabase's direct-APNs path. 'Get started with Live Activity' is in official FCM docs.
- **widget_timeline_data_access** — Standard WidgetKit + App Group container. Firestore offline cache available from within widget extension (FirebaseFirestore configured in widget bundle). Reads served from local cache, listener can be triggered on widget timeline refresh.

### Food Vertical Fit
- **geo_query_support** — DIY via geohashing — Firestore has no native PostGIS. Standard pattern: store geohash + lat/lng on document, query by geohash prefix range, filter false positives client-side. Libraries: GeoFirestore-iOS (community-maintained). Recent multi-field inequality query support (March 2024) helps but Firestore is structurally weaker than PostGIS for geo.
- **places_data_integration** — Backend-agnostic. Apple MapKit (free, MKLocalSearch), Foursquare, Google Places — choose any. Cache in Firestore if desired. Firebase has no places product of its own.
- **places_api_total_cost_at_1k_DAU** — Same as Supabase / any backend — depends on chosen provider. MapKit: $0. Foursquare: free 10K/mo (drops to 500/mo Jun 2026). Google Places: paid since Feb 2025 (~$17/1K Place Details calls). Cache aggressively in Firestore to stay near zero.
- **places_data_freshness** — Inherited from provider. No Firebase-side caching layer — DIY TTL on Firestore docs.
- **image_storage_cost** — Cloud Storage: $0.026/GB/mo (Standard, us-central1). 5GB free. Comparable to Supabase Pro ($0.021/GB/mo) but Firebase egress costs (~$0.12/GB) erode the difference quickly.
- **image_cdn_included** — No built-in transformations. Cloud Storage serves raw bytes; transformations require Firebase Extensions (Resize Images) or Cloud Functions image processing. Frontend can pipe through Imgix / Cloudinary / Cloud CDN. Less batteries-included than Supabase's Smart CDN.

### Push & Notification UX
- **silent_push_to_compute_widget** — FCM supports content_available silent pushes with full APNs priority/expiration control. Standard pattern.
- **apns_priority_tier_support** — Full APNs priority control through FCM HTTP 0.1.0 API (apns_priority field, push-type headers). Same expressiveness as direct APNs.
- **cross_user_push_fanout_cost** — $0. FCM delivery free for unlimited iOS pushes. 5-person group × every vote × 4 watchers fanout = zero marginal push cost. This is Firebase's structural win vs Supabase (where Edge Function invocations bill at $2 per 1M past 500K free).

### Risk & Longevity
- **single_founder_maintainability** — Very high. Largest community, longest track record, Google-funded — solo dev has the deepest support tail. But the lock-in means a failed pivot off Firebase is costly.
- **community_size** — Largest of any BaaS. ~50K Stack Overflow questions, official Firebase Slack, Google Groups (firebase-talk), Firebase Summit annual conference, hundreds of YouTube channels, dozens of paid courses.
- **last_major_release** — Firebase Apple SDK v12.13.x as of May 2026, weekly-to-biweekly cadence. Firestore Live Activity push support, Identity Platform features, MCP server, Agent Skills all shipped in 2025–2026 window.
- **notable_failure_modes** — (1) Per-document read pricing surprises — unbounded snapshot listeners on growing collections silently bleed budget. (2) Hot-document write contention (~1 write/sec limit). (3) Security Rules misconfiguration (similar foot-gun to RLS, less expressive). (4) Spark plan hard cutoff — exceed daily quota, product locks until reset. (5) Dynamic Links death (Aug 2025) blindsided projects relying on invite links. (6) Crashlytics startup performance regression debates ongoing.
- **funding_runway_signal** — N/A — Google subsidiary, no independent funding events. Strategic priority for Google Cloud / Android. No layoff signals affecting Firebase team. But: Google has killed products at scale before (see eol_history) — strategic-priority signal is weaker than Supabase's growth-stage VC commitment.
- **eol_history** — Yes — significant. Firebase Dynamic Links shut down Aug 25, 2025 (one of the platform's flagship features for a decade). Firebase Hosting console UI consolidations, Firebase Realtime Database backseat to Firestore. Google more broadly: Stadia, Optimize, Google+, etc. Firebase has a real precedent of killing products customers depended on.
- **self_host_escape_hatch** — None. Firestore, FCM, Firebase Auth are proprietary managed services with no open-source equivalent. The 'escape' is a multi-month rewrite to a different stack (Postgres + APNs server + Keycloak/Auth0).
- **data_export_format** — Firestore: proprietary export to GCS (loadable to BigQuery, not portable). Auth: JSON via Admin SDK. Storage: native object format via gsutil. No SQL dump path. Weakest export story among options evaluated.

### Uncertain fields
- app_clip_support
- shareplay_groupactivities_fit
- cost_at_100k_DAU

## Swift + SwiftUI + InstantDB
<a id="instantdb"></a>

### Basic Info
- **name** — Swift + SwiftUI + InstantDB
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — InstantDB (typed local-first BaaS; Postgres triple store + WebSocket sync; auth, presence, storage, optimistic mutations built-in)

### Category Fit
- **realtime_quality** — Strong by design. InstantDB tails Postgres WAL to detect novelty and invalidate relevant queries on the server, then pushes deltas through WebSocket to all subscribers. Architecture inspired by Asana WorldStore and Figma LiveGraph. Client maintains a triple-store cache and reconciles via CRDTs. For 5-person group-vote rooms this is well within sweet spot; the published bottleneck is concurrent WebSocket connections per machine (currently scales >10k, target 100k+). Swift SDK exposes async sequences (`for await result in db.query(...).values()`) that map cleanly onto SwiftUI reactive flow.
- **presence_support** — First-class. Room-based presence + pub/sub topics in the Swift SDK — typing indicators, who's-in-the-room, voted indicators all idiomatic. No extra service to wire up.
- **optimistic_updates** — First-class and automatic. Mutations write to a persistent outbox locally before they hit the wire; UI updates instantly and rolls back on server rejection. No manual diffing required.
- **offline_handling** — Local-first by design. Queries resolve from on-device cache when offline; mutations queue in persistent outbox and flush in order on reconnect. CRDT-style merge on the server. Vote-on-subway scenario is the design center.
- **auth_flow_friction** — Low. Magic code (email), ID tokens (Sign in with Apple), and guest sign-in are built into the Swift SDK. Group-invite flow: deep link -> guest session -> upgrade to SiwA later. Apple Sign-In supported on iOS/macOS; not on watchOS/tvOS (Google Sign-In also missing on those two).
- **social_invites** — DIY on top of iOS primitives. InstantDB has no opinion on invite UX, so you wire Universal Links, share sheet, and contacts pull yourself. Room/membership semantics in the SDK make 'join via link' trivial once the link payload is parsed.
- **group_session_model** — Architecturally native. The SDK ships first-class 'rooms' as a presence + pub/sub primitive; combined with a `rooms` entity in the triple store (members, options, deadline, status) you express 'N humans voting on M options with a deadline' in one schema file and a few lines of SwiftUI. Matches GetToIt's group-first model more directly than any stack in the comparison set.
- **vote_write_fanout_pattern** — 1 vote = 1 mutation on the writer's device -> outbox -> WebSocket to InstantDB server -> WAL tail detects novelty -> invalidation pushed to N subscribers watching the room query. Sub-second latency typical at sub-10k connection counts. Cost model is connection-based, not per-message, so fanout cost stays flat as room size grows (within group sizes of 2-10).
- **room_membership_model** — First-class. Presence rooms are SDK primitives; permissions are expressed as InstaQL rules (rule-based row-level auth). Membership semantics natural; permission rule edits must be done via dashboard or TS SDK (Swift SDK doesn't expose rule management).
- **anonymous_invite_join** — Yes. Guest sign-in is documented in the Swift SDK; an invitee can vote with a guest session and upgrade to SiwA later. Combined with Universal Links this gets close to App-Clip-style frictionless join (without needing an actual App Clip — though the main app still has to be installed).

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — DIY. Standard iOS Universal Links pattern; deep-link payload encodes room ID, SDK joins the room. No vendor-provided helper.
- **contacts_pull_friction** — Standard iOS Contacts framework — same as any other stack. InstantDB doesn't offer a friend-graph primitive; you'd model `friendships` as triples.

### Velocity
- **time_to_first_prototype** — ~3-5 days to a working group-vote room for a Swift dev who's already comfortable with SwiftUI. Schema + Swift macros + room presence + optimistic mutations are all in the SDK; the main time sinks are: (1) writing your own APNs worker, (2) wiring Universal Links, (3) learning InstaQL syntax.
- **learning_curve** — Moderate. Triple-store + InstaQL is a new mental model for Swift devs used to Core Data or REST. Once the 'everything is [entity, attribute, value]' click happens it's quick. Swift SDK is small (v0.2.1) so docs gaps will require reading source.
- **ecosystem_maturity_2026** — Backend: maturing, production-used at >10k concurrent WebSocket scale, $18M Series A March 2025 ($20.2M total raised, Hummingbird/Blackbird). Swift SDK: community-maintained by tornikegomareli (not official InstantDB), 8 GitHub stars, 6 releases, latest v0.2.1 Feb 25 2026. Backend stable; Swift SDK is single-maintainer risk.
- **hiring_pool** — Small. Swift devs who've used InstantDB specifically are rare; any senior iOS contractor can pick it up in a week given the small SDK surface area.
- **claude_code_familiarity** — Mixed. Claude knows InstantDB's TypeScript/React SDK well (training-data abundant), and knows Swift + SwiftUI well, but the Swift SDK is new and small — generated code will need verification against the README and the source. Worst case: Claude generates calls in the JS-SDK shape. Expect to hand-correct ~20% of first-pass code.
- **xcode_first_class** — Partial. Swift macros are used for compile-time-safe schema/query types (per the SDK README). No documented Xcode Previews integration. No schema codegen tooling beyond what the macros provide.

### Operational / Cost
- **perf_per_dollar** — Strong in the 0-10k DAU window for GetToIt's specific shape (bursty group sessions, small payloads, image storage offloaded). Connection-priced pricing wins vs Firebase/Firestore's per-read pricing for chatty group queries. Loses to CloudKit (which is free at scale) on raw $/DAU but wins on cross-platform optionality and DX.
- **cold_start_egress_pattern** — Pull-on-open: SDK syncs deltas since last seen on app open via WebSocket reconnect. With local cache this is incremental, not full-state. Cold-start cost is small for returning users; first-launch users pay a full room snapshot download (still tiny — kilobytes for a vote room).
- **vendor_lockin_risk** — Moderate. Backend is open-source (github.com/instantdb/instant, Postgres + Clojure), so self-host escape hatch exists. But: (a) self-hosting Clojure + Postgres + WebSocket gateway is non-trivial ops work, (b) Swift SDK is a single-maintainer community port — if it goes unmaintained you'd port to TS or another community SDK, (c) InstaQL is a proprietary query language so migration off means rewriting queries. Triple-store data exports to standard SQL via Postgres dump.
- **scaling_ceiling** — Around 10k concurrent WebSocket connections per node per published architecture notes; horizontal scale-out exists but is the active engineering frontier for the InstantDB team. For GetToIt's 0-10k DAU horizon this is comfortable; 100k+ DAU is the inflection.

### Apple Platform Alignment
- **swiftui_native_feel** — Good. Swift macros + async sequences feed SwiftUI's reactive model naturally. Gestures, haptics, animations are app-level concerns and unaffected by the backend. Nothing in the SDK fights SwiftUI idioms.
- **sign_in_with_apple_native** — Yes. ID-token-based sign-in is documented in the Swift SDK README. Works on iOS/macOS; not on watchOS/tvOS (per SDK limitations note).
- **app_review_friction** — Low. Standard third-party backend; no known App Review red flags. Magic-code auth is normal practice; guest sessions don't violate anything. Sign in with Apple offered alongside other methods covers the Apple-required SiwA-parity rule.
- **foundation_models_ready** — Yes — feeding iOS 26 Foundation Models is straightforward. Query the room state from InstantDB, hand the JSON to FoundationModels for verdict-summary or place-rationale generation, write the result back as a new triple. No SDK-level integration needed; LLM is entirely on-device.
- **liveactivity_dynamic_island_push** — DIY. Live Activities require server-driven APNs pushes to the activity-specific token. Since InstantDB has no native APNs, you'd run a small worker that watches room state (subscribe via server-side stream) and pushes Live Activity updates as 'X of N voted, Ym left'. Feasible but not turnkey.

### Food Vertical Fit
- **places_data_integration** — Stack-agnostic. You'd call MapKit (free), Foursquare ($0 up to 10k req/mo), or Google Places (paid as of Feb 2025) from the iOS app directly and store the result snapshots in InstantDB as room options. Backend choice doesn't constrain places provider.
- **places_api_total_cost_at_1k_DAU** — Apple MapKit MKLocalSearch.Request: $0 (recommended primary). Foursquare: $0 within 10k calls/mo free tier — easily covers 1k DAU at ~10 searches/user/mo. Google Places: ~$17 per 1000 Text Search calls post-Feb 2025 free-credit end, so 10k calls/mo = ~$170/mo. Recommend MapKit primary, Foursquare fallback. Backend stack is neutral to this choice.

### Push & Notification UX
- **silent_push_to_compute_widget** — DIY via your own APNs worker. InstantDB has no built-in push, so silent-content-available pushes to refresh widgets are a workflow you'd build outside the BaaS. Cost is APNs free tier (unlimited) plus your worker compute.
- **apns_priority_tier_support** — Determined by your worker, not by the BaaS. Standard APNs priority 5 (silent) and 10 (alert) both available since you're calling APNs directly.
- **cross_user_push_fanout_cost** — Effectively free — APNs itself is free, and your worker compute for fanning out to 5 group members on each vote is trivial (a few KB of payload per recipient). True cost is the engineering time to build and operate the worker.

### Risk & Longevity
- **single_founder_maintainability** — Backend: defensible — open-source, Postgres-backed, dockerizable. Swift SDK: risky — single community maintainer, low star count (8), no employer behind it. A solo dev should be prepared to fork the Swift SDK if the maintainer disappears.
- **community_size** — Backend: 10.3k GitHub stars on instantdb/instant, active Discord, growing developer community, '$18M raise + Hummingbird/Blackbird backing' signal. Swift SDK: 8 stars on tornikegomareli/instant-swift-sdk, very small.
- **last_major_release** — Backend: actively shipping (regular commits per repo). Swift SDK: v0.2.1 released Feb 25, 2026.
- **notable_failure_modes** — (a) Swift SDK: broken link attributes in server schema cause linked entities to come back nil after optimistic UI — diagnosable but requires server-side dashboard work. (b) Permission rules can only be edited via dashboard or TypeScript SDK — Swift devs can't manage rules from the iOS app side. (c) Triple-store EAV layout means Postgres query planner has less statistics info, so complex queries can be slower than a normalized schema. (d) WebSocket-connection-per-machine bottleneck (>10k handled today, 100k is the team's next milestone).
- **funding_runway_signal** — Strong. $18M Series A March 2025 (Hummingbird Ventures led, Blackbird Ventures participated), $20.2M total raised. Founding team hiring per their jobs page. Multi-year runway likely.
- **eol_history** — No prior product EOLs by InstantDB Inc — company is young (founded 2022-2023). No track record of killing products, but also no track record of long-term commitment.
- **self_host_escape_hatch** — Yes. Full backend (Clojure + Postgres + WebSocket gateway) is OSS at github.com/instantdb/instant. Non-trivial to self-host but possible. Strong escape valve for vendor-failure scenarios.

### Uncertain fields
- push_notifications
- session_ttl_support
- quorum_or_deadline_eval
- app_clip_support
- shareplay_groupactivities_fit
- free_tier_ceiling
- cost_per_DAU_first_1k
- cost_per_DAU_first_10k
- cost_at_100k_DAU
- realtime_message_cost_per_1k
- concurrent_connection_ceiling_free
- auth_mau_cost_curve
- egress_cost_image_heavy
- data_export_path
- app_intents_data_dependency
- widget_timeline_data_access
- geo_query_support
- places_data_freshness
- image_storage_cost
- image_cdn_included
- data_export_format

## Swift + SwiftUI + Nakama
<a id="nakama"></a>

### Basic Info
- **name** — Swift + SwiftUI + Nakama
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — Nakama (open-source Go game backend, Postgres/CockroachDB); self-host via Docker or Heroic Cloud managed

### Category Fit
- **realtime_quality** — Strong. Native WebSocket + rUDP socket from Nakama Swift client with async/await. Server pushes presence, chat, party, match state, status changes in real-time. Authoritative match handler supports server-tick model for verdict eval. One Nakama node officially scales to ~10k CCU; clusters tested to 2M CCU on AWS by Code Wizards. Designed for synchronous game state — overkill for vote events but trivially capable.
- **presence_support** — First-class. Status presence API: follow users to see online/offline + custom status string. Match/party/chat/group all emit presence join/leave events. 'Typing', 'voted', 'in room' map cleanly to status updates or match state ticks.
- **offline_handling** — Weak. Nakama is connection-oriented (WebSocket); no built-in offline write queue or local cache. Persistent notifications are retained server-side and delivered on reconnect, but vote writes while offline must be queued in app code and replayed. Storage API has list/read/write but no offline mirror.
- **auth_flow_friction** — Moderate. Device-ID auth allows zero-tap account creation (anonymous). Linking later to Sign in with Apple supported. Group invites are server-API (groupAddUsers / groupAccept) — share-sheet-to-room flow requires custom universal-link layer on top.
- **social_invites** — Server primitives strong (groups with owner/admin/member roles, invitations, requests). iOS share-sheet / universal link / contacts integration is DIY — Nakama exposes IDs, you build the link layer.
- **push_notifications** — In-app notifications first-class (persistent + transient, retrieved on reconnect). APNs push is NOT built-in — community pattern is server-side runtime hook (Go/TS/Lua) calling APNs HTTP/2 or OneSignal. Documented gist exists; no turnkey integration.
- **group_session_model** — Excellent fit. Three overlapping primitives: (1) Groups = persistent clans with members + roles, (2) Parties = transient session of users gathered for a moment of play, (3) Matches = authoritative real-time state container with tick loop. A GetToIt 'room of N humans voting on M options with deadline' maps naturally to Party + authoritative Match with custom match handler enforcing deadline tick.
- **vote_write_fanout_pattern** — Server broadcasts via match/party socket. One vote = one message to server, server broadcasts MatchData op-code to all party/match presences. O(N) fanout but on a single Go process — no per-message billing, just CPU/bandwidth. Persistent notifications fan out to offline users on reconnect.
- **session_ttl_support** — Authoritative match handler tick loop can implement deadline natively (e.g., 1 tick/sec, MatchLoop checks expired_at, calls verdict, MatchTerminate). No built-in 'scheduled job' but Go runtime can register cron-like background tasks.
- **room_membership_model** — First-class. Groups have owner/admin/member roles + open/closed join policy. Parties have leader + members + private/public flag. Match presences track who is currently connected. All three exposed via SDK with permission checks server-side.
- **quorum_or_deadline_eval** — Implement in match handler (Go/TS/Lua server code) — read match state, count votes, compare to presence count, emit verdict op-code when threshold or deadline hit. No declarative rule layer; you write the Go function.
- **anonymous_invite_join** — Device-ID anonymous auth means a tap on a deep link can create an account + join party in one server roundtrip — but you build the link handler. App Clip flow is possible but undocumented for Nakama.

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — DIY. Nakama gives you party/group IDs; you implement Associated Domains + AASA file + SwiftUI .onOpenURL handler that calls socket.joinParty(id).
- **contacts_pull_friction** — DIY. Facebook friend import is built-in; Contacts.framework import is your code (push hashed phone numbers to a custom RPC that queries the users table).

### Velocity
- **time_to_first_prototype** — 5-10 days for a working group-vote room. Day 1-2: spin up Nakama via Docker, get Swift SDK auth flow. Day 3-5: party create/join/socket. Day 6-10: custom match handler in Go for deadline+verdict. Faster if you skip authoritative match and use party messages only.
- **learning_curve** — Moderate-to-steep for a Swift dev. Requires Go (or TS/Lua) for server runtime functions, Postgres ops sense, Docker/k8s for self-host, and understanding of game-server idioms (match handlers, op-codes, ticks) that don't map 1:1 to typical CRUD app thinking.
- **ecosystem_maturity_2026** — Server: mature (v3.38.0 released March 2026, 12.6k stars, 102 releases, AWS+GCP marketplace). Swift client: weak (29 stars, 21 forks, last release v1.2.0 March 2024, deprioritized per maintainer comment, several long-standing 'help wanted' issues). Mismatch is the headline risk.
- **hiring_pool** — Small. Game backend specialists exist but most are Unity/Unreal-focused. Swift+Nakama is a near-empty intersection. Contractors will charge premium or need ramp-up time.
- **claude_code_familiarity** — Server runtime (Go/TS): good — well-documented, public examples. Swift client: weak — small training corpus, frequent 0.1.0/v2/v3 API drift, LLM-generated code likely to hallucinate methods. Expect to hand-correct Swift SDK calls against the GitHub source.
- **xcode_first_class** — No. SDK is plain async/await Swift over gRPC stubs. No Xcode previews integration, no schema codegen, no Swift Macros. Server schema lives in Postgres + Go structs, far from Swift type system.

### Operational / Cost
- **cost_per_DAU_first_1k** — Self-host on Hetzner CX22 (~$5/mo) + managed Postgres or self-managed DB on same box: ~$5-15/mo total at 1k DAU. One Nakama node handles 10k CCU; 1k DAU is ~50-200 CCU. Heroic Cloud equivalent: $600+/mo. Self-host wins ~50-100x at this scale.
- **cost_at_100k_DAU** — Self-host: clustered Nakama Enterprise (paid license) + scaled Postgres/CockroachDB; multi-thousand $/mo in infra alone. Heroic Cloud: low five figures/mo. Trajectory check: doable but requires Enterprise license for clustering OR custom session-affinity sharding on OSS edition.
- **perf_per_dollar** — Best-in-class IF self-hosted on bare-metal VPS (Hetzner). One $5-10/mo box delivers 10k CCU + auth + storage + social graph + notifications. Worst-in-class on Heroic Cloud at <10k DAU — the $600 floor is engineered for game studios with budget, not solo iOS devs at 0-1k DAU. Stack only competes on cost if founder accepts ops burden.
- **realtime_message_cost_per_1k** — Self-host: $0 (only VPS bandwidth, typically free up to ~20TB/mo on Hetzner). Heroic Cloud: bundled into shard cost. No per-message metering on either path — sharp contrast with Pusher/Ably/PubNub.
- **concurrent_connection_ceiling_free** — Self-host: ~10k CCU per node. Heroic Cloud: no free tier. So 'free-tier concurrent connections' is N/A — it's either self-host (10k) or paid ($600/mo floor).
- **auth_mau_cost_curve** — No per-MAU auth billing on either path. Auth is part of the server; cost is CPU/RAM/DB. Step function only at node-saturation points.
- **egress_cost_image_heavy** — Nakama is not an object/image store. You bring your own (S3 / R2 / Cloudflare Images) for dish photos. Nakama proxies metadata, not blobs. Egress cost is the storage vendor's, not Nakama's.
- **cold_start_egress_pattern** — Socket reconnect on app open + replay of persistent notifications since last cursor. Bounded by notification volume per user — typically small. No mass subscription warmup like Firestore's snapshot listeners.
- **vendor_lockin_risk** — Low. Server is Apache-2.0 OSS Go — you can fork and run forever. Postgres-compatible DB means data is portable. Migration off requires rewriting the runtime functions if you change backend, but the data export path is clean (pg_dump).
- **scaling_ceiling** — OSS edition: ~10k CCU per node, single-node only. Multi-node clustering requires Nakama Enterprise (commercial license, undisclosed price). Postgres connection pool and write throughput are the next bottlenecks.
- **data_export_path** — Postgres-native. pg_dump for full export, SQL queries for selective. Storage API objects live in Postgres rows. No proprietary export needed.

### Apple Platform Alignment
- **swiftui_native_feel** — Neutral. Nakama is a pure data/socket layer — SwiftUI feel depends entirely on your view code. Async/await SDK plugs into .task and @Observable cleanly.
- **sign_in_with_apple_native** — Supported as a social provider — authenticateApple(token:). You handle ASAuthorizationController on the iOS side and pass the identityToken. Documented but minimal Swift-specific examples.
- **foundation_models_ready** — No backend coupling. Foundation Models run on-device; you'd pass Nakama-fetched data (places, votes, member preferences) into the Apple Intelligence framework locally. Clean separation, no integration story published.
- **liveactivity_dynamic_island_push** — Possible but DIY. Nakama runtime function calls APNs liveactivity push type with state delta. No built-in helper. You build the APNs HTTP/2 client in Go runtime or call OneSignal/etc.
- **widget_timeline_data_access** — Widget reads from shared App Group container; you cache Nakama state to disk on socket update. Background refresh via silent push triggers widget reload. Standard iOS pattern, Nakama agnostic.

### Food Vertical Fit
- **geo_query_support** — Not built-in. Storage API is key-value JSON, no geospatial index. Implement with PostGIS extension on the backing Postgres and a custom Go RPC, OR delegate geo entirely to Apple MapKit / Foursquare on the client.
- **places_data_integration** — Backend-agnostic. Nakama does not provide places data. You hit Foursquare/Google Places/MapKit directly from iOS, cache results in Nakama Storage if you want shared room state.
- **places_api_total_cost_at_1k_DAU** — Not Nakama's concern — depends entirely on chosen places provider. MapKit (free, on-device) is the perf-per-dollar pick for GetToIt. See places_data_integration note.
- **places_data_freshness** — N/A — see places_data_integration. Quality is whatever places API you pick.
- **image_storage_cost** — N/A — Nakama doesn't store blobs. Pair with R2 ($0.015/GB-mo, zero egress) or S3.
- **image_cdn_included** — No CDN. Pair with Cloudflare Images, imgix, or similar.

### Push & Notification UX
- **silent_push_to_compute_widget** — Standard APNs background push from Nakama runtime function. DIY plumbing.
- **apns_priority_tier_support** — Whatever your runtime function code sets in the APNs request — full control.
- **cross_user_push_fanout_cost** — Per-push APNs is free from Apple. Cost is server CPU + bandwidth to send N HTTP/2 requests. At 0-10k DAU negligible.

### Risk & Longevity
- **single_founder_maintainability** — Manageable IF self-hosted on simple Docker Compose. Requires comfort with Postgres ops, Go basics for runtime functions, and reading Nakama Go source when SDK lags. Heroic Cloud removes ops but adds $600+/mo. Solo dev should expect ~10-20% time on backend ops in steady state.
- **community_size** — Server: substantial (12.6k stars, active forum, Discord, AWS-blog case studies). Swift client: tiny (29 stars). Stack Overflow signal is mostly Unity/Godot/Unreal, not Swift — debugging help for Swift-specific issues will be sparse.
- **last_major_release** — Server: v3.38.0 (March 20, 2026). Swift client: v1.2.0 (March 19, 2024) — 14 months stale.
- **notable_failure_modes** — (1) Swift SDK behind server API drift — known historic pattern. (2) Single-node OSS edition has hard CCU ceiling; multi-node needs commercial Enterprise license. (3) Custom Go/TS match handler code is yours to maintain. (4) No turnkey APNs — every push is custom code. (5) Heroic Cloud pricing opacity makes budgeting hard before committing.
- **funding_runway_signal** — Heroic Labs raised $120K seed in 2015 — no public follow-on rounds. Company has been operating ~10 years on customer revenue (game studios on Heroic Cloud + Enterprise licenses). Bootstrap/profitable signal is positive for longevity but not for rapid SDK investment.
- **eol_history** — No EOL events found. Nakama server has been continuously developed since v1.0 (2017). Heroic Cloud is the second iteration (2.0 announced).
- **self_host_escape_hatch** — Excellent. Apache-2.0 server + open Go runtime. If Heroic Labs disappeared, you fork the repo, run on any Docker host, retain all features. Only Enterprise clustering would be lost.
- **data_export_format** — Postgres SQL dump. Portable to any Postgres-compatible system.

### Uncertain fields
- optimistic_updates
- app_clip_support
- shareplay_groupactivities_fit
- free_tier_ceiling
- cost_per_DAU_first_10k
- app_review_friction
- app_intents_data_dependency

## Swift + SwiftUI + Supabase
<a id="supabase"></a>

### Basic Info
- **name** — Swift + SwiftUI + Supabase
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — Supabase (Postgres + Realtime + Auth + Storage + Edge Functions)

### Category Fit
- **realtime_quality** — Solid for typical group-vote workloads. Three primitives: (1) Postgres Changes — pushes table-level INSERT/UPDATE/DELETE via logical replication, processed on a single thread to maintain order (can lag at scale, 100 subscribers to one table = 100 RLS auth checks per insert); (2) Broadcast — low-latency WebSocket messaging between clients, the recommended path for vote events; (3) Presence — sync of arbitrary client state. For GetToIt's 5-person group + occasional fanout, Broadcast + table read on first paint is the clean pattern. Median replication lag visible in 'Broadcast from Database Replication Lag' report. Postgres Changes have reported flakiness in production threads; Broadcast is more reliable.
- **presence_support** — First-class. Built-in Presence channel — each client publishes a payload, server maintains merged view, emits sync/join/leave events. Swift SDK exposes this directly. Use case (who's in the room, who voted) is the canonical example in Supabase docs.
- **optimistic_updates** — No built-in optimistic mutation framework. Solo dev pattern: update local SwiftUI @State immediately, fire Supabase write, reconcile on Realtime echo or rollback on error. Workable but DIY. Compare to Convex/InstantDB which automate this.
- **offline_handling** — Weakest dimension. Native client has no offline queue, no conflict resolution, no local cache. Three escape hatches: (1) pair with SwiftData and write a sync layer (Medium tutorials exist, ~1-2 weeks effort); (2) bolt on PowerSync (commercial, LWW conflict resolution out of the box, partner-listed integration); (3) WatermelonDB/RxDB (community plugins, JS-leaning). For 'vote on subway' 0.1.0 with 5-person groups, a thin SwiftData mirror with last-write-wins is adequate; full offline-first requires PowerSync.
- **auth_flow_friction** — Low. Native Sign in with Apple via Authentication Services framework + signInWithIdToken — one SDK call. signInAnonymously() works without any PII, can be linked to a real identity later. Magic links + deep linking documented for iOS. Custom URL scheme required in Info.plist for OAuth redirect.
- **social_invites** — DIY but unobstructed. Universal Links via Associated Domains, share sheet via SwiftUI ShareLink. Supabase has no native invite primitive — you build /join/{roomId} URLs against your own API. Anonymous sign-in means an invitee can land on a deep link and vote without first signing up.
- **push_notifications** — No native APNs sender — you ship via Edge Function calling APNs directly with .p8 key, or via FCM as a relay. Database webhooks trigger Edge Functions on row inserts (e.g., new vote → push 'Verdict ready'). Adds ~half a day of plumbing vs Firebase's zero-config FCM. OneSignal listed as partner integration.
- **group_session_model** — Excellent fit. A 'room of N humans voting on M options with a deadline' maps to a rooms table + members table (room_id, user_id, role) + options table + votes table (room_id, user_id, option_id). All joined in one SQL query — Firestore would need multiple round trips. RLS policies enforce 'only members of room X can read/write' declaratively. Server-authoritative deadline via timestamptz column + pg_cron job.
- **vote_write_fanout_pattern** — One vote → one Postgres INSERT → logical replication → fan-out to all subscribed clients via Realtime. Broadcast pattern (preferred): client emits vote event on room channel, all subscribers receive in ~50–200ms, also writes to DB asynchronously for durability. Cost per vote is trivial in DB ($0.18 / 1M reads is not the model; Pro plan includes unlimited DB queries). Realtime billed by messages: free tier 2M/mo, then $2.50 per 1M.
- **session_ttl_support** — Native. Postgres has timestamptz + pg_cron. Schedule a job to run every minute, find rooms with deadline <= now() AND status='open', compute verdict, broadcast result. Edge Functions can also be cron-triggered. pgmq queue available for deferred work.
- **room_membership_model** — DIY (write your own members table) but trivial in SQL. RLS policies make permission enforcement declarative: 'user X can SELECT from votes WHERE room_id IN (SELECT room_id FROM members WHERE user_id = auth.uid())'. Cleaner than Firestore's collection-level rules.
- **quorum_or_deadline_eval** — Native. SQL trigger on votes INSERT can check 'count(votes) = count(members)' and update room.status to 'closed' + compute verdict. Or pg_cron sweeps deadlines. Server-authoritative, race-free.
- **anonymous_invite_join** — Supported via signInAnonymously() — creates an anonymous JWT, no PII required. User can vote, then later link credentials (Apple/Google/email) to upgrade without losing their data. Combine with deep link → instant join with zero taps to vote.

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — Standard iOS pattern. Associated Domains entitlement + apple-app-site-association file hosted on your domain. Supabase has no built-in invite link service — you generate /room/{id} links yourself.
- **contacts_pull_friction** — Apple Contacts framework concern, not Supabase. Standard CNContactStore + permission prompt. Supabase happily stores hashed phone numbers for friend-graph matching.

### Velocity
- **time_to_first_prototype** — 3–7 days to a working group-vote room for a solo dev with Claude Code. supabase-swift mirrors supabase-js, SwiftUI quickstart in official docs, Sign in with Apple snippet ready to copy. Schema in 30 min, RLS in 1–2 hr, Realtime subscribe in 1 hr, voting UI in a day.
- **learning_curve** — Low for a Swift dev who knows any SQL. Higher if they've never written RLS policies — that's the one new concept. Postgres extensions (pg_cron, PostGIS, pgmq) are gravy once oriented.
- **ecosystem_maturity_2026** — Strong and rising. $5B valuation Oct 2025, ARR ~$70M (2.5x YoY), Series E closed, seeking $10B round Apr 2026. Stable releases monthly. Realtime sub-system maturing — Broadcast more reliable than Postgres Changes per community reports.
- **hiring_pool** — Good for Postgres talent (huge generalist pool). Smaller pool of dedicated Supabase contractors than Firebase, but any Postgres + iOS dev ramps in days.
- **claude_code_familiarity** — High and improving. supabase-swift API mirrors supabase-js exactly, and supabase-js has massive training-data coverage. SQL/RLS extremely well-represented in LLM training. Official Supabase MCP server and Claude skills exist. Code generation quality for Swift bindings is solid; minor friction around newer publishable/secret key migration (Supabase rolled out 2025).
- **xcode_first_class** — Standard SwiftPM integration. No schema → Swift codegen tool (vs Firestore's @DocumentID — Supabase queries return generic [String: Any] or you write Codable structs by hand). Swift Macros for codegen would be community-built. Type-safety via PostgREST is decent but not as ergonomic as Convex's TS reactivity.

### Operational / Cost
- **free_tier_ceiling** — Two free projects (pause after 1 week inactivity). Per project: 500 MB Postgres, 1 GB Storage, 50K MAU, unlimited API requests, 200 peak Realtime connections, 2M Realtime messages/mo, 256KB max message size, 5GB egress/mo. Realistic GetToIt 0.1.0 ceiling: ~1–2K DAU before Realtime connections or egress force Pro upgrade.
- **cost_per_DAU_first_1k** — $0/mo if comfortable with free-tier project pause risk; $25/mo Pro plan to remove pause + raise ceilings (8GB DB, 100GB storage, 100K MAU, 500 peak connections, 5M Realtime messages, 250GB egress). At 1K DAU with food-app vote pattern, well inside Pro included quotas. Effective: ~$0.025/DAU/mo on Pro.
- **cost_per_DAU_first_10k** — $25 Pro base + likely overages on Realtime messages (~$5–20/mo if heavy presence usage; 5M included, $2.50 per 1M after) + peak connections if more than 500 simultaneous voters ($10 per 1,000 packs) + egress if dish photos large (250GB included, $0.09/GB uncached / $0.03/GB cached). Realistic 10K DAU: $50–150/mo total. Effective: ~$0.005–0.015/DAU/mo.
- **perf_per_dollar** — Best-in-class for the 0–10K DAU social/group bracket among hosted BaaS. $25/mo Pro covers MVP traffic with headroom; unlimited DB ops (vs Firestore's per-op pricing) is the structural advantage for write-heavy voting workloads. Postgres on dedicated micro instance can saturate before pricing does.
- **realtime_message_cost_per_1k** — $2.50 per 1M messages = $0.0025 per 1K messages. Free tier 2M/mo, Pro tier 5M/mo included. Compare to Firebase: FCM push is free, Firestore listener events are billed as document reads ($0.18 per 100K reads = $1.80 per 1M).
- **concurrent_connection_ceiling_free** — 200 peak concurrent Realtime connections on free tier — caps roughly 40 simultaneous 5-person rooms. Pro: 500 connections (100 simultaneous rooms). $10 per additional 1,000 connections.
- **auth_mau_cost_curve** — Free up to 50K MAU. Pro plan ($25/mo) raises to 100K MAU included. Above that: $0.00325 per additional MAU. Significantly cheaper than Firebase's $0.0055/MAU above 50K.
- **egress_cost_image_heavy** — $0.09/GB uncached, $0.03/GB cached via Smart CDN. 250GB included on Pro. Dish photos at 500KB avg × 100 views per user × 10K DAU = 500GB/mo → 250GB billable × $0.03 (cached) = ~$7.50/mo. Reasonable.
- **cold_start_egress_pattern** — Subscriptions are pull on demand — client opens app, subscribes to room channel, fetches initial state via REST. No firehose. Cold-start cost = one query per active room.
- **vendor_lockin_risk** — Low. Data lives in vanilla Postgres — pg_dump → restore anywhere. Auth schema is portable (users in auth.users table). Realtime + Storage + Edge Functions are Supabase-specific but each is replaceable (any WebSocket server, S3, Cloudflare Workers). The OSS stack runs self-hosted via docker-compose, all components MIT/Apache/PostgreSQL-licensed.
- **scaling_ceiling** — Postgres-bound. Compute add-ons scale to 16XL ($3,730/mo, 64 vCPU / 256GB RAM). Realtime tier scales by contacting support past Pro. Practical ceiling: ~100K–500K DAU before sharding or read replicas needed. Far beyond GetToIt's relevant horizon.
- **data_export_path** — pg_dump (native SQL dump), CSV per table from Studio, daily PITR backups on Pro. Most portable export path of any BaaS evaluated.

### Apple Platform Alignment
- **swiftui_native_feel** — Pure-Swift SDK, async/await throughout, Codable models. No bridge weirdness. SwiftUI integration is idiomatic — @Observable view models calling SupabaseClient async methods.
- **sign_in_with_apple_native** — First-class. signInWithIdToken(provider: .apple, idToken: ...) — pass Apple's ASAuthorizationAppleIDCredential token directly. No web redirect, no secret key rotation needed for native iOS. Caveat: Apple's ID token omits full name, must be captured client-side from first auth and stored via updateUser.
- **app_review_friction** — Low. Privacy Manifest disclosure required — Supabase Auth logs email + IP, both count as third-party PII transmission, must be listed in privacy policy. No known structural App Review rejections tied to Supabase specifically.
- **foundation_models_ready** — Backend-agnostic — iOS 26 Foundation Models run on-device. Pattern: pull room state from Supabase → feed to FoundationModels Apple Intelligence session → display verdict rationale. No SDK conflict.
- **app_intents_data_dependency** — DIY but unobstructed. Build an App Intent that takes a room ID, calls SupabaseClient inside the intent's perform(), returns the verdict. Works with @Dependency for shared client instance.
- **liveactivity_dynamic_island_push** — Supabase doesn't natively send Live Activity pushes (requires APNs push-type: liveactivity headers). Pattern: Database webhook → Edge Function → APNs HTTP/2 call with .p8 key + activity push token. ~1–2 days of glue code. iOS 16.1+ for Live Activities, iOS 17.2+ for remote-start.
- **widget_timeline_data_access** — Standard WidgetKit + App Group container pattern. App writes latest room state to UserDefaults(suiteName:) on Realtime update, widget reads from suite. Or background refresh task fetches from Supabase directly.

### Food Vertical Fit
- **geo_query_support** — Excellent. PostGIS extension is one click in Supabase dashboard. Native SQL operators for distance (<->), bounding-box (ST_MakeBox2D), and radius queries. Sort restaurants by distance from user via ORDER BY location <-> ST_Point(lng, lat). Call from Swift via .rpc() with Codable response.
- **places_data_integration** — Backend-agnostic — places data sourced from Apple MapKit (free, MKLocalSearch), Foursquare (10K calls/mo free until Jun 2026, then 500/mo), or Google Places (paid since Feb 2025). Cache results in PostGIS for repeat queries.
- **places_api_total_cost_at_1k_DAU** — Depends on provider. MapKit: $0. Foursquare current free tier (10K calls/mo) covers 1K DAU at ~10 lookups each before paying $15/CPM. Post-Jun-2026 (500/mo free), Foursquare ~$135/mo at 10K calls. Cache aggressively in Postgres to keep costs near zero.
- **places_data_freshness** — Inherited from chosen provider. MapKit is Apple-curated, generally fresh hours/open-now data. Foursquare strong on hours/menus. Caching layer must respect TTL.
- **image_storage_cost** — $0.021/GB/mo Storage on Pro. 100GB included. Dish photos at ~500KB avg → 200K photos per included GB.
- **image_cdn_included** — Yes. Smart CDN with built-in image transformations (resize, format conversion). Cached egress at $0.03/GB. Image transformation has a separate per-origin charge — many devs generate thumbnails client-side to avoid it.

### Push & Notification UX
- **silent_push_to_compute_widget** — Standard APNs background push (content-available: 1) via Edge Function → APNs. Works for widget refresh. No Supabase abstraction over this.
- **apns_priority_tier_support** — Full APNs control when sending directly from Edge Function — priority 10 (immediate) vs 5 (efficient), push-type, expiration. No Supabase layer to flatten the API.
- **cross_user_push_fanout_cost** — Edge Function invocations: 500K/mo free, then $2 per 1M. Per push: one HTTP/2 connection to APNs, batched per-token. 5-person group, every vote pushes 4 watchers: 4 pushes × 1 vote × 10K users × 5 votes/day × 30 days = 6M pushes/mo = ~$12 in Edge Function invocations. APNs delivery itself is free.

### Risk & Longevity
- **single_founder_maintainability** — High. SQL skills transfer to any future hire. Self-host escape hatch via docker-compose if hosted dies. No proprietary query language to forget.
- **community_size** — Large and growing. supabase-swift ~1.1K GitHub stars; main supabase repo ~75K+ stars. Active Discord, GitHub Discussions. Smaller than Firebase Stack Overflow corpus (~50K Firebase questions) but younger and rising.
- **last_major_release** — supabase-swift releases roughly bi-weekly through May 2026. Main platform releases monthly Docker images. Active development.
- **notable_failure_modes** — (1) Postgres Changes lag/drop under heavy load — use Broadcast instead for hot paths. (2) RLS misconfiguration is the #1 production foot-gun — easy to leak data with permissive policy. (3) Connection limits hit suddenly when scaling (200 free / 500 Pro). (4) Free-tier projects pause after 1 week of inactivity — must upgrade or keep warm. (5) Edge Function cold starts on free plan (150s timeout, occasional warm-up lag).
- **funding_runway_signal** — Excellent. $5B valuation Oct 2025, $80M Series C + $200M Series D + $100M Series E ladder, $70M ARR up 250% YoY, seeking $10B valuation Apr 2026. No layoffs or product cuts on record. Investor base includes Accel, Peak XV, Craft, Coatue.
- **eol_history** — No products killed. Realtime v2 superseded 0.1.0 with migration path. Storage tier changes recent (3x cheaper cached egress, 10x upload size — May 2024 blog post). Track record is additive, not subtractive.
- **self_host_escape_hatch** — Yes — docker-compose stack in supabase/supabase repo, ~30 min to stand up. All components OSS-licensed (Postgres, GoTrue/Auth, PostgREST, Realtime in Elixir, Storage in Node, Kong gateway). Production-parity with hosted. Reverse proxy (Caddy/Nginx) required for HTTPS.
- **data_export_format** — Native SQL via pg_dump. Also CSV per table from Studio UI. Most portable export format among BaaS options — Postgres is the lingua franca.

### Uncertain fields
- app_clip_support
- shareplay_groupactivities_fit
- cost_at_100k_DAU

## Swift + SwiftUI + Supabase + PowerSync
<a id="supabase-powersync"></a>

### Basic Info
- **name** — Swift + SwiftUI + Supabase + PowerSync
- **primary_language** — Swift (client), SQL + Postgres + edge functions Deno/TS (backend)
- **ui_framework** — SwiftUI (UIKit interop available)
- **backend** — Supabase (managed Postgres + Auth + Realtime + Storage + Edge Functions) with PowerSync overlay providing bidirectional sync between server Postgres and on-device SQLite for offline-first reads/writes

### Category Fit
- **realtime_quality** — Two complementary mechanisms must be reasoned about together. (1) Supabase Realtime delivers Postgres WAL changes over websocket channels — solid but channel-state management and consistency-vs-write timing are the developer's problem (writes and read-subscriptions travel separate paths, so a client may emit a write and see its own change arrive after a brief delay). (2) PowerSync, when enabled, replaces this with a SQLite-local-first model — clients read from a local SQLite replica that PowerSync keeps current via sync rules against logical replication. The 'realtime feel' becomes near-instantaneous for the local user (zero-latency local reads) while remote-user changes propagate in ~100-500ms typical. For GetToIt's group voting this is excellent: each member's local SQLite holds the room state, votes apply locally and queue for sync; everyone else's UI updates as their PowerSync stream catches up.
- **presence_support** — Supabase Realtime has first-class Presence channels (broadcast + presence). PowerSync does NOT cover presence — it is row-sync only. Pattern: use Supabase Realtime Presence (alongside, not replacing PowerSync) for 'who's in the room / typing / connected', and use PowerSync for the durable voting data. This dual-channel setup works but means two SDKs, two connection lifecycles.
- **optimistic_updates** — Built into PowerSync's design — every write is applied to local SQLite first, returned synchronously to the UI, then queued for upload to the backend write endpoint. The user always sees their vote instantly. Conflicts (rare in a vote-per-user-per-room model) resolve on the server with default last-write-wins or a custom upload handler.
- **offline_handling** — Best-in-class for the stacks under consideration. Local SQLite keeps reads functional indefinitely offline. Writes queue in PowerSync's upload queue (durable, survives app kill) and replay when connectivity returns. 'Vote on the subway' is the literal canonical PowerSync demo. Subtlety: presence/realtime (Supabase Realtime) does NOT work offline — only the PowerSync-managed data layer does. The verdict computation still requires server connectivity to fire (PowerSync syncs the verdict row back down once the server-side scheduled function ran).
- **auth_flow_friction** — Low. supabase-swift is first-party, well-maintained, modern Swift Concurrency. Sign in with Apple natively via ASAuthorizationController + supabase.auth.signInWithIdToken(provider: .apple, idToken: ...). The Apple-only-shares-name-on-first-signin caveat is documented; capture the name from the native response and call updateUser. PowerSync uses the Supabase JWT as its sync auth token — single-source auth, no separate PowerSync login.
- **social_invites** — Supabase deep linking docs cover universal links and custom schemes, BUT a known limitation: Supabase's SITE_URL config historically supported only custom schemes, not universal links, requiring a redirect page workaround. Implementable, just a known papercut. Contacts pull is pure Apple framework, orthogonal.
- **push_notifications** — Supabase has no first-party APNS dispatcher. Pattern: Edge Function (Deno) calls APNS directly with the device token row from your Postgres, OR use OneSignal / Knock / Courier on top. PowerSync is push-agnostic. Cost is APNS-free + Edge Function invocations + your push provider if used.
- **group_session_model** — Excellent fit, expressed in plain SQL. Tables: rooms (id, deadline_at, status), room_members (room_id, user_id, role), options (room_id, label, place_id), votes (room_id, user_id, option_id, weight). PostGIS for nearby-places queries. RLS policies enforce 'a user can only read/write rows for rooms they're a member of' — this is the heart of Supabase's security model and works hand-in-glove with PowerSync's sync rules (which mirror the RLS predicates to decide what to sync to each device). The mental model is more familiar to most devs than Convex's reactive-query model.
- **vote_write_fanout_pattern** — A vote is an INSERT into votes. PowerSync's upload handler (a Supabase Edge Function or RPC) writes the row to Postgres. Logical replication picks up the change; PowerSync's sync service evaluates which connected clients have sync rules matching that row and pushes the delta to each. Each delta is one PowerSync 'data synced' byte cost. For a 5-member room, one vote produces ~4 outbound syncs (peer members), plus the local write. Effective cost per vote is dominated by data-synced bytes (a vote row is ~100 bytes ⇒ ~400 bytes synced). 10k DAU × 2 rooms × 5 votes/room × ~400 bytes ≈ 40 MB/day ≈ 1.2 GB/month of PowerSync data sync — well inside the Pro plan's 30 GB/mo envelope. Supabase Realtime presence is a separate concurrent-connection cost.
- **session_ttl_support** — DIY using Supabase. Postgres pg_cron extension or Supabase Scheduled Edge Functions can fire at deadlines (or run every minute checking deadline_at <= now()). PowerSync syncs the resulting status flip back to clients. Not as ergonomic as Convex's per-row ctx.scheduler.runAt but standard.
- **room_membership_model** — First-class via RLS-enforced room_members table. Permissions live in SQL policies — auditable, declarative, well-understood. PowerSync sync rules mirror the same predicates.
- **quorum_or_deadline_eval** — SQL trigger on votes INSERT can check count(*) === (select count(*) from room_members where room_id = NEW.room_id), and on equality run verdict computation in the same transaction. Combine with the pg_cron deadline-eval path for whichever-comes-first. All server-authoritative.
- **anonymous_invite_join** — Supabase Anonymous Sign-Ins is supported (returns a real authenticated user with is_anonymous=true). Pair with an invite_tokens table and an Edge Function that grants the anon user membership to the specified room. Works inside PowerSync (anon JWTs carry into the sync auth).

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — Standard apple-app-site-association on your domain pointing to a SwiftUI scene. Supabase handles the OAuth/email-magic-link side of deep linking explicitly in their docs.
- **contacts_pull_friction** — Pure Apple-side, orthogonal to both Supabase and PowerSync.

### Velocity
- **time_to_first_prototype** — 5-10 days realistic. The two SDKs each have their own setup ceremony, and there is a definite ramp on PowerSync sync rules (a YAML-ish DSL describing which rows go to which clients). PowerSync-only path: 2-4 days. PowerSync + Supabase + RLS-policies-mirrored-to-sync-rules with auth, room CRUD, vote, and verdict: 5-10 days. Note: PowerSync Swift SDK is still Alpha as of early 2026, which adds debug friction.
- **learning_curve** — Steeper than Convex or Supabase-alone. Three layered concepts: (1) Postgres + RLS, (2) Supabase client + Realtime + Storage, (3) PowerSync sync rules + conflict resolution + upload handler. Each is well-documented individually; integrating all three for a single feature is where time goes.
- **ecosystem_maturity_2026** — Supabase is highly mature (large community, stable SDKs). PowerSync overall is mature (V1 GA on the service for ~2 years) but the Swift SDK specifically is in Open Alpha as of early 2026 (per official 'PowerSync Swift SDK in Open Alpha' announcement and ongoing alpha-stage warnings in docs). v1.11 shipped March 2026 with tvOS support and bug fixes. Production use of powersync-swift = signing up for breaking changes.
- **hiring_pool** — Supabase: large, growing, easy to find. PowerSync: small specialist pool. Combined: medium — most Supabase-fluent devs would need to learn PowerSync from scratch.
- **claude_code_familiarity** — Supabase has wide and excellent LLM coverage (high training-data density, lots of tutorials). PowerSync has thinner coverage, especially for Swift; PowerSync Flutter/React-Native is more visible in training data than PowerSync Swift. Expect higher human-correction rate on PowerSync-Swift specific code from Claude than on pure-Supabase code.
- **xcode_first_class** — Supabase-swift is idiomatic modern Swift with full async/await, good. PowerSync-swift wraps the Kotlin Multiplatform SDK via SKIE — the public API is Swift but the bridge introduces some non-idiomatic surface (errors wrapped in PowerSyncException, etc., partially fixed in March 2026 release). Schema codegen exists in some PowerSync SDKs; for Swift, table schemas are declared in code.

### Operational / Cost
- **free_tier_ceiling** — Supabase Free: 500MB DB, 1GB file storage, 5GB cached + 5GB uncached egress, 50k MAU, 200 peak realtime concurrent connections, 2M realtime messages/mo. Projects pause after 1 week of inactivity (a real issue for low-traffic prototypes). Max 2 active projects. PowerSync Free Cloud: $0/mo, 2GB data synced/mo, 500MB data hosted, 50 peak concurrent connections. Combined free tier comfortably handles development and the first ~50-200 DAU, but the 50-peak-connection PowerSync cap is the binding constraint on simultaneous active group rooms in free tier.
- **cost_per_DAU_first_1k** — Roughly $25-$60/mo. Supabase Pro $25 + PowerSync Pro $49 = $74 base. At 1k DAU sync volume is ~120MB/mo (negligible against PowerSync Pro's 30GB included). Supabase Pro covers 100k MAU and 250GB egress — plenty. Optimization: stay on PowerSync Free until you hit its 50-concurrent-connection cap (which is the realistic gate at ~50-200 DAU depending on session length), then jump to Pro. Hard floor with both vendors paid: ~$74/mo.
- **cost_per_DAU_first_10k** — Roughly $75-$120/mo. Supabase Pro $25 (10k DAU is well inside 100k MAU). PowerSync Pro $49 base with 30GB sync included; at 10k DAU expect 1-3GB/mo sync volume — comfortably inside. Add ~10-20GB egress on Supabase ($0.09/GB uncached = $1-2). Realtime presence connections: 10k concurrent peak likely exceeds Pro's included quota (Pro included ~500 peak per most docs); overage at $10/1k peak connections — but voting rooms are short-lived so concurrent peak is more like (active_rooms × members) not DAU.
- **cost_at_100k_DAU** — Roughly $200-$600/mo. Both vendors scale linearly without cliff. Supabase: $25 base + auth MAU overage at $0.00325/MAU on the marginal MAUs over 100k (zero if you sit under), egress overages, database compute upgrade probably needed (~$60-$120/mo for larger instance). PowerSync: data-synced overage at the Pro tier's published rate (per-GB after 30GB). Total under $1k/mo at 100k DAU is realistic with reasonable optimization.
- **perf_per_dollar** — Strong but base-cost-heavy. $74/mo floor (Supabase Pro + PowerSync Pro) is steep for an app with 10 DAU but excellent leverage at 1k-10k DAU because per-marginal-user cost is near-zero (local-first SQLite means reads don't hit the backend at all). At 0-10k DAU range you trade a higher floor for the lowest per-user cost in the stacks under consideration.
- **realtime_message_cost_per_1k** — Supabase Realtime: 2M messages/mo free, then $2.50 per 1M messages on Pro (= $0.0025 per 1k). PowerSync bills 'data synced' in GB, not messages — a different unit. For a voting fan-out the dominant cost is PowerSync data sync; Supabase Realtime messages only fire if you use a separate channel for presence/typing.
- **concurrent_connection_ceiling_free** — Supabase Free: 200 peak concurrent Realtime connections. PowerSync Free: 50 peak concurrent sync connections. The PowerSync 50-cap is the binding constraint for simultaneous active group-vote rooms on the free tier (e.g. 10 active 5-member rooms = 50 connections).
- **auth_mau_cost_curve** — Supabase: free up to 50k MAU, Pro includes 100k MAU, then $0.00325 per additional MAU. PowerSync uses the JWT issued by Supabase Auth and does not bill auth separately. Combined: GetToIt pays Supabase's MAU rate only.
- **egress_cost_image_heavy** — Supabase Storage with Smart CDN: $0.03/GB cached, $0.09/GB uncached on Pro after the 250GB+250GB included. This is materially cheaper than Convex's $0.12/GB unified rate for image-heavy workloads. Image transformations are an additional billed feature; many devs roll their own thumbnails to avoid the per-transform cost.
- **cold_start_egress_pattern** — Local-first model reduces cold-start cost: on app open the local SQLite already has the last-synced state, the UI renders instantly with no network call, and PowerSync opens a sync stream in the background to catch up. This is a distinct UX win versus Convex/Firebase patterns where app open triggers fresh subscription resolution.
- **vendor_lockin_risk** — Lower than Convex. Supabase is Postgres underneath — standard pg_dump exports trivially, and you can self-host Supabase via the open-source stack. PowerSync is the higher-lockin piece: sync rules are PowerSync-specific, and removing PowerSync means rebuilding offline sync from scratch. PowerSync also has an Open Edition (self-hostable, source-available) and an Enterprise Self-Hosted Edition — real escape hatches.
- **scaling_ceiling** — Supabase: well-documented multi-million-user deployments. Connection pooling (Supavisor) handles Postgres connection scaling. PowerSync: known production deployments in hundreds of thousands of users, but the Swift SDK alpha status means iOS-specific scaling battle-testing is thinner than Flutter/React-Native.
- **data_export_path** — Excellent. pg_dump from Supabase produces a complete SQL snapshot. PowerSync sync state can be reconstructed from Postgres alone (it's read-derived). Lowest-friction migration story of the stacks under consideration.

### Apple Platform Alignment
- **swiftui_native_feel** — Excellent. Local-first SQLite reads via PowerSync's Swift API integrate with @Observable/SwiftUI naturally — query results expose AsyncSequence/Combine streams that drive views with no network spinner state to model. supabase-swift is idiomatic async/await.
- **sign_in_with_apple_native** — First-class. ASAuthorizationController → supabase.auth.signInWithIdToken(.apple, idToken). Capture full name from Apple's native response on first signin and updateUser. Works seamlessly with PowerSync — same JWT.
- **app_review_friction** — No known stack-specific App Store review blockers. Standard concerns apply.
- **foundation_models_ready** — Compatible. iOS 26 FoundationModels runs on-device; data comes from PowerSync's local SQLite query results, which is actually MORE convenient than a network-only stack because there's no async wait for verdict text inputs. Pattern: read place + vote distribution from SQLite, build prompt, call LanguageModelSession on-device.
- **app_intents_data_dependency** — KNOWN LIMITATION as of May 2026: PowerSync Swift SDK does NOT support opening its local SQLite database from iOS app extensions (widgets, App Intents extensions, Live Activities). Root cause: the database file lives in the main app's sandbox, no App Group container support in the underlying Kotlin Multiplatform driver. GitHub feature request open (powersync-swift#126). Workarounds: (a) main app writes a JSON snapshot to App Group UserDefaults for the extension to read, (b) the extension calls Supabase REST directly (bypassing PowerSync, no offline support in the extension). This is the single biggest architectural risk of this stack for GetToIt if widgets/App Intents are load-bearing.
- **liveactivity_dynamic_island_push** — Possible via APNS push tokens registered for the activity. Same caveat as above: the Live Activity extension cannot read PowerSync's SQLite directly, so the APNS payload must carry the full content-state inline. A Supabase Edge Function fires the push.
- **widget_timeline_data_access** — Same limitation. Widgets cannot read PowerSync local SQLite directly. Workaround pattern: main app writes a JSON snapshot to shared App Group; widget reads from App Group. Acceptable for low-frequency widget refresh (every few minutes) but adds engineering work.

### Food Vertical Fit
- **geo_query_support** — Best-in-class for the stacks under consideration. PostGIS is a one-click extension in Supabase — full geo types (Point, Polygon, LineString), the <-> nearest-neighbor operator, ST_DWithin radius queries, GiST indexes. Swift client calls these via .rpc('nearby_places', params). PowerSync syncs PostGIS columns as serialized geometry (or stripped to lat/lng for client-side filtering depending on sync-rule design).
- **places_data_integration** — Same DIY pattern as any backend — call Google Places / Foursquare / MapKit from an Edge Function, cache in Postgres with PostGIS geometry, optionally sync nearby cached entries down to clients via PowerSync.
- **places_api_total_cost_at_1k_DAU** — Independent of the backend stack. Google Places ended its $200/mo free credit Feb 2025; Foursquare Places ~10k/mo free then ~$0.49/1k; Apple MapKit Local Search free with rate limits. Caching in Postgres with TTLs keeps cost near zero at 1k DAU regardless of provider.
- **image_storage_cost** — Supabase Storage: $0.021/GB-month. Cheaper than most alternatives. CDN-served via the Smart CDN.
- **image_cdn_included** — Yes — Supabase Smart CDN serves Storage assets globally with cached/uncached egress tiers ($0.03/GB cached, $0.09/GB uncached). Image Transformations available as a paid add-on for resize/crop/format conversion.

### Push & Notification UX
- **silent_push_to_compute_widget** — Standard APNS background-push pattern from a Supabase Edge Function. The wake-up notification triggers the main app to write a fresh snapshot to App Group; widget refreshes. (Widget cannot itself read PowerSync SQLite — see above.)
- **apns_priority_tier_support** — Full — your Edge Function constructs the APNS payload with any priority/push-type.
- **cross_user_push_fanout_cost** — Edge Function pulls member device tokens from Postgres, loops over APNS calls. Edge Function invocations are billed (Pro includes 2M/mo). APNS itself free.

### Risk & Longevity
- **single_founder_maintainability** — Tractable but with one sharp edge: the PowerSync Swift SDK's alpha status means breaking changes will land and a solo dev must keep up. Supabase side is stable and well-traveled. Recommendation: pin powersync-swift versions tightly, allocate ~half a day per minor bump.
- **community_size** — Supabase: very large (tens of thousands of Discord, ~70k+ GitHub stars on the main monorepo, massive Stack Overflow presence). PowerSync: small but engaged (single-digit-thousand Discord, focused Slack). Combined community for the specific Supabase+PowerSync-Swift integration is small.
- **last_major_release** — Supabase: continuous, near-daily across the platform. supabase-swift updates monthly. PowerSync Swift: v1.11.0 in March 2026 (adds tvOS support); March 31 2026 fix for CancellationError wrapping. No GA / 1.0-stable announcement for powersync-swift as of May 2026 — verify on github.com/powersync-ja/powersync-swift/releases.
- **notable_failure_modes** — 1) PowerSync Swift SDK alpha — expect breaking changes. 2) No iOS-extension access to local SQLite (widgets, App Intents). 3) Sync rules complexity: getting RLS and PowerSync sync rules to agree is a class of bugs. 4) Supabase Free tier pauses after 1 week inactivity (dev annoyance). 5) Dual-SDK setup means two connection lifecycles to debug. 6) Supabase Realtime + PowerSync data flowing simultaneously can cause UI to update twice (presence ping vs SQLite-derived view) if not designed carefully.
- **eol_history** — Supabase: no killed products. PowerSync: no killed products; recently SIMPLIFIED billing (sync ops and data processing metrics removed in favor of unified data-synced metric) — that's a roadmap-tightening, not an EOL.
- **self_host_escape_hatch** — Strongest of the stacks under consideration. Supabase entirely self-hostable via the open-source repo (Postgres + GoTrue + Realtime + Storage + Studio in Docker). PowerSync Open Edition is source-available and self-hostable. PowerSync Enterprise Self-Hosted Edition for production self-host with support.
- **data_export_format** — SQL via pg_dump (Supabase). PowerSync state is read-derived from Postgres — no proprietary export needed.

### Uncertain fields
- app_clip_support
- shareplay_groupactivities_fit
- places_data_freshness
- funding_runway_signal

## Swift + SwiftUI + Turso
<a id="turso"></a>

### Basic Info
- **name** — Swift + SwiftUI + Turso
- **primary_language** — Swift
- **ui_framework** — SwiftUI
- **backend** — Turso (libSQL — SQLite fork with embedded replicas + server sync); per-tenant database architecture; S3-backed Turso Cloud or self-host libSQL server

### Category Fit
- **realtime_quality** — Weak for live multi-user voting. Turso Sync is explicit push()/pull() — no WebSocket-based change subscriptions yet (acknowledged on roadmap, not shipped). Pattern is periodic poll (e.g., every 1s) or post-action sync. 'Last-push-wins' conflict resolution. Acceptable for async voting (verdict after deadline) but feels laggy vs Firestore/Supabase for live 'X voted' indicators unless you layer your own pub/sub on top.
- **presence_support** — Not built-in. Turso is a database, not a presence system. Implement by writing presence rows with timestamps + heartbeat + TTL cleanup. No native 'follow user' or socket-based status events.
- **optimistic_updates** — Native. Embedded replica IS the optimistic write — you write locally, sync pushes to cloud asynchronously. Local SQL query returns the just-written row immediately. Conflict on remote = last-push-wins or custom transform hook.
- **offline_handling** — Best-in-class for offline. Offline Writes (public beta) lets app write to local SQLite WAL, push when connectivity returns. Embedded replica means full local read access offline. Subway vote scenario maps natively: tap vote -> local INSERT -> sync on signal.
- **auth_flow_friction** — DIY. Turso has no auth product. You bring Sign in with Apple via Apple's framework or pair Turso with Clerk/Auth0/Supabase Auth. Adds an integration point and a second vendor bill (or self-rolled JWT).
- **social_invites** — DIY entirely. No friend graph, no invite primitives. You design a 'rooms' table with member rows, generate invite tokens, build universal link handler. All app code — Turso just stores the rows.
- **push_notifications** — DIY entirely. No notification system. Pair with APNs directly (your server-side code reading a CDC trigger or scheduled job) or OneSignal/Knock/Courier. Turso has no concept of 'notify users when row X changes'.
- **group_session_model** — Architecturally elegant. Per-room SQLite database maps 1:1 to 'room of N humans voting on M options'. Each room is its own .db file in Turso (one of millions in the multi-tenant fleet). Schema per room: members, options, votes, deadline. But the elegance hides the absence of a server runtime to broadcast or evaluate — you build that layer.
- **vote_write_fanout_pattern** — Pull-based. Voter writes to local replica, syncs to cloud. Other members' clients pull periodically (1-5s) and see the row. No push fanout. Cost is per-row-read from Turso (5M/mo free on starter). At 5 voters/room with 1Hz polling, that's 5 reads/sec/room — burn rate scales linearly with room count and poll frequency.
- **session_ttl_support** — DIY. No scheduled jobs in Turso. Deadline enforcement requires either client-side eval (race-prone) or a separate cron/worker (Cloudflare Worker, fly.io machine) that reads expired-room databases and writes verdict rows.
- **quorum_or_deadline_eval** — DIY external worker (see session_ttl_support). Or in-app on the last voter's device — fragile.
- **anonymous_invite_join** — Possible via custom token-based join URL. No native flow.

### Onboarding & Invite Friction
- **universal_link_invite_pattern** — DIY. Same as any iOS app — your responsibility, Turso doesn't know about the link.
- **contacts_pull_friction** — DIY. Pull contacts, hash phone numbers, query a 'users' database (could be a single shared Turso DB) for matches.

### Velocity
- **time_to_first_prototype** — 10-20 days for a working group-vote room — longer than Nakama because you build presence + invites + notifications + deadline eval from scratch. SQL schema is fast (1-2 days) but the missing pieces (auth, push, fanout, scheduled eval) each take 1-3 days. Realistic only if you accept poll-based fanout.
- **learning_curve** — Low for SQL and SQLite (most devs know it). High for the missing-pieces architecture — you're effectively assembling a backend from {Turso, an auth provider, an APNs sender, a cron worker, a CDN for images}. Each piece is simple; the integration tax is the cost.
- **ecosystem_maturity_2026** — Database core: improving rapidly but in flux. Turso announced May 2025 they are rewriting SQLite in Rust as 'Turso Database' (was 'Limbo') and pivoting libSQL features — edge replicas, multi-db schemas, ATTACH being discontinued for new users. Swift SDK: 48 stars, still technical preview, last visible release 0.1.1, open issues around arm64e build and embedded replica options. Signal: choose carefully; the company is in mid-pivot.
- **hiring_pool** — Tiny. SQLite-native iOS devs exist (GRDB community). Turso-specific iOS experience is essentially zero in 2026.
- **claude_code_familiarity** — SQL: excellent. libsql-swift API surface: weak — small training corpus, frequent API churn (0.1.x), LLM-generated code will often hallucinate methods or mix node/JS SDK shapes. Expect to lean on Read tool against the GitHub source.
- **xcode_first_class** — Partial. Plain Swift package via SPM, async/await API. No SwiftData-style codegen — you write SQL by hand. No type-safe queries (compare: SwiftData @Model + #Predicate). Could pair with SQL.swift or GRDB-style query builder but not natively.

### Operational / Cost
- **free_tier_ceiling** — Generous for read-heavy: 500M row reads/mo, 10M row writes/mo, 5GB storage, 500 databases, 3GB embedded-replica sync allowance. Adequate for 1k-5k DAU IF you keep writes lean. Polling-based vote read traffic will eat the read budget faster than expected.
- **cost_per_DAU_first_1k** — Likely $0 (free tier). 1k DAU at ~5 votes/day = 5k writes/day = 150k/mo (well under 10M write cap). Reads depend on poll frequency: 1k DAU × 1hr/day × 1Hz poll × 4 active rooms = ~14M reads/day = 420M/mo (under 500M cap). Tight margin but free. Pair with $0 MapKit + R2 image storage stays at $0-5/mo.
- **cost_per_DAU_first_10k** — Developer plan ($4.99/mo, 2.5B reads, ~50M writes) or Scaler ($24.92/mo). Likely $5-30/mo at 10k DAU. Critical caveat: aggressive polling for 'realtime feel' could push to Scaler or trigger overage ($0.50-0.75/GB extra storage; reads/writes have their own overage curve).
- **cost_at_100k_DAU** — Pro plan ($416.58/mo) entry point. Per-write/read overage charges compound — at 100k DAU with active polling, several hundred to low-thousand $/mo plausible. Multi-tenant DB-per-room amortizes well in Turso's S3-diskless architecture.
- **perf_per_dollar** — Excellent for write-light / offline-first / async workflows. Poor-to-mediocre for live polling-heavy group voting because cost is paid in reads × poll rate. If you embrace 'verdict at deadline, not live tally' the per-dollar story is strong. If users expect live counters updating <500ms, this stack burns reads.
- **realtime_message_cost_per_1k** — N/A — no realtime message API. Cost is per-row read/write. ~$0 within free tier; overage details on Turso pricing page.
- **concurrent_connection_ceiling_free** — Not metered as 'connections' — Turso is HTTP/libSQL protocol, not persistent socket. Connection count effectively unlimited within request budget.
- **auth_mau_cost_curve** — N/A — no auth product. Cost depends on chosen auth vendor (Clerk: free up to 10k MAU, then $25/mo + $0.02/MAU; Auth0: free up to 25k MAU).
- **egress_cost_image_heavy** — N/A — Turso stores SQL rows, not blobs. Pair with R2 ($0.015/GB-mo, zero egress) or Cloudflare Images for dish photos.
- **cold_start_egress_pattern** — Embedded replica pull on app open if last sync stale. Bounded by row delta since last sync — small for active users, larger for return-after-week scenarios. No subscription warmup cost like Firestore.
- **vendor_lockin_risk** — Moderate. libSQL is OSS (MIT) — you can self-host the server. BUT: the Turso Database Rust rewrite is replacing libSQL as the company's intended direction, and several libSQL features are being discontinued for new users. Migrating off Turso Cloud to self-hosted libSQL is feasible today but the version-skew situation through 2026-2027 will matter.
- **scaling_ceiling** — DB-per-tenant scales nearly horizontally (S3-backed multi-tenant). Bottlenecks: (a) read rate per database (single-writer SQLite), (b) sync latency for hot rooms, (c) overage cost curves at the high end. Hard ceiling not publicly stated.
- **data_export_path** — SQLite. Every database is a .db file. turso db shell + .dump or download the file. Trivial export, fully portable to any SQLite or Postgres (via tools).

### Apple Platform Alignment
- **swiftui_native_feel** — Neutral. Turso is invisible to view layer — SwiftUI feel is your code. .task + async/await sync calls compose cleanly. Lack of @Model/@Query type-safety vs SwiftData is a friction point.
- **sign_in_with_apple_native** — Not provided. Use Apple's AuthenticationServices framework directly + your own JWT or Clerk/Auth0 integration.
- **app_review_friction** — None inherent. No data-collection or content moderation gotchas tied to Turso.
- **foundation_models_ready** — Excellent. SQL queries return structured rows ready to feed into on-device Foundation Models. No cloud roundtrip needed for prompt-time data assembly. Per-user/per-room database isolation aligns with Apple Intelligence's privacy posture.
- **app_intents_data_dependency** — Compatible — Turso queries inside App Intent perform() return fast (local replica). No @Dependency-style framework but no friction either.
- **liveactivity_dynamic_island_push** — DIY. APNs liveactivity push from your worker that watches Turso CDC for verdict-ready rows. Multiple moving parts.
- **widget_timeline_data_access** — Native fit. Widget extension shares App Group container with main app; main app keeps embedded replica synced; widget queries local SQLite. Background refresh via silent push.

### Food Vertical Fit
- **geo_query_support** — Partial. SQLite has R-tree extension; libSQL inherits it. Custom radius queries doable. Less ergonomic than PostGIS but functional.
- **places_data_integration** — Backend-agnostic. Hit Foursquare/Google Places/MapKit on the client; cache rows in Turso if you want shared-room state.
- **places_api_total_cost_at_1k_DAU** — Not Turso's concern — MapKit (free, on-device) is the perf-per-dollar pick. See places_data_integration note.
- **places_data_freshness** — N/A — depends on chosen places API.
- **image_storage_cost** — N/A — pair with R2 ($0.015/GB-mo) or similar.
- **image_cdn_included** — No. BYO Cloudflare Images / imgix.

### Push & Notification UX
- **silent_push_to_compute_widget** — DIY APNs from your worker. No Turso primitive.
- **apns_priority_tier_support** — Full control via your APNs sender — Turso is not involved.
- **cross_user_push_fanout_cost** — Per-APNs cost is free; your worker compute is the cost. Negligible at 0-10k DAU.

### Risk & Longevity
- **single_founder_maintainability** — Mixed. SQL ops are familiar; the integration tax (auth + push + cron worker + image CDN + Turso) means more moving parts than a one-box BaaS. Counterbalanced by: each piece is OSS-replaceable and portable. Long-term durability good IF you accept the assembly model.
- **community_size** — Database project: moderate (turso/libsql core has active Discord, GitHub). Swift SDK: tiny (48 stars, ~5 open issues). iOS-specific community questions are rare on Stack Overflow.
- **notable_failure_modes** — (1) No realtime push — polling burns read budget. (2) Last-push-wins conflict semantics can lose votes if two writers race and second push overwrites — needs custom transform hook for vote-merge logic. (3) Mid-pivot risk: libSQL features deprecating, Turso Database Rust rewrite still BETA. (4) Swift SDK tech preview — production use is at your own risk. (5) Every supporting service (auth, push, cron, CDN) is a separate vendor or self-rolled.
- **funding_runway_signal** — ChiselStrike/Turso raised $7M seed (May 2023). No announced Series A through May 2026. Recent platform pivot (Turso Database Rust rewrite, feature deprecations) suggests strategy reset — could be focusing for next raise or compressing scope due to runway. Read this as moderate risk.
- **eol_history** — Edge Replicas, Multi-DB Schemas, and database ATTACH being discontinued for new users (announced 2025 in 'Upcoming changes' post). Existing paid customers grandfathered. ChiselStrike (the original product) was pivoted into Turso. Two pivot events in company history — pattern worth weighing.
- **self_host_escape_hatch** — Strong on paper. libSQL server is MIT/Apache-2.0; you can run it yourself. Caveat: the Rust 'Turso Database' rewrite is the company's forward direction and is BETA — self-hosting libSQL going forward may diverge from what Turso Cloud runs.
- **data_export_format** — SQLite file. Most portable database format in existence.

### Uncertain fields
- room_membership_model
- app_clip_support
- shareplay_groupactivities_fit
- last_major_release
