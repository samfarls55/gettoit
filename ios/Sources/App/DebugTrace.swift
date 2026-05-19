// GetToIt — DebugTrace.
//
// TEMPORARY diagnostic instrumentation for the post-Q5 verdict-spinner
// hang (the "LINING UP THE VERDICT" surface never advancing to S05).
//
// Posts breadcrumb rows to the `public.debug_trace` table so the hang
// can be traced by reading the rows straight out of the database — no
// Mac / Xcode console required.
//
// Why a raw URLSession and NOT the shared SupabaseClient: the bug under
// investigation is the verdict read (`VerdictStore.fetchVerdict`)
// hanging somewhere inside the supabase-swift client. Routing the
// breadcrumbs through that same client would let the hang swallow the
// breadcrumbs too. This helper uses an independent ephemeral URLSession
// with a hard request timeout and the public anon key, so a wedged
// SupabaseClient cannot stop a breadcrumb from landing.
//
// `debug_trace` accepts anon INSERTs (an RLS insert policy scoped to
// this diagnosis).
//
// REMOVE — this whole file and every `DebugTrace.mark` call site — once
// the verdict-spinner root cause is fixed.

import Foundation
import os

public enum DebugTrace {

    /// One id per app process. A single reproduction run's breadcrumbs
    /// group under it; a relaunch gets a fresh id and is tellable apart.
    private static let runID = UUID().uuidString

    /// Monotonic across the whole process — gives the breadcrumbs a
    /// total order even when `created_at` collides at sub-millisecond.
    private static let counter = OSAllocatedUnfairLock(initialState: 0)

    /// Resolved once. `nil` only if the app bundle has no Supabase
    /// config, in which case `mark` is a silent no-op.
    private static let config = SupabaseConfig.fromBundle()

    /// Independent of the shared SupabaseClient and hard-bounded, so a
    /// wedged client cannot stop or stall a breadcrumb.
    private static let session: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 8
        cfg.timeoutIntervalForResource = 12
        cfg.waitsForConnectivity = false
        return URLSession(configuration: cfg)
    }()

    /// Drop one breadcrumb. Fire-and-forget: never throws, never blocks
    /// the caller, and never routes through the SupabaseClient.
    public static func mark(
        _ checkpoint: String,
        room roomID: UUID? = nil,
        detail: String? = nil
    ) {
        let seq = counter.withLock { (n: inout Int) -> Int in
            n += 1
            return n
        }

        guard let config else { return }

        var body: [String: Any] = [
            "session_id": runID,
            "seq": seq,
            "checkpoint": checkpoint,
        ]
        if let roomID { body["room_id"] = roomID.uuidString }
        if let detail { body["detail"] = detail }

        guard let payload = try? JSONSerialization.data(withJSONObject: body) else {
            return
        }

        var request = URLRequest(
            url: config.url.appendingPathComponent("rest/v1/debug_trace")
        )
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = payload

        Task.detached {
            _ = try? await session.data(for: request)
        }
    }
}
