// GetToIt — RerollStore (TB-10).
//
// Invokes the `apply_reroll(p_room_id, p_reason, p_detail, p_diet_chip,
// p_new_vibe)` RPC on the database, then chases with a `compute-verdict`
// re-invocation so the engine writes the new verdict + cuts. The store
// surfaces the live "rerolls used" count for the S07 surface's stamp.
//
// Wiring contract:
//   * `applyReroll(reason:detail:newVibe:dietChip:)` calls the RPC,
//     surfaces error JSON from the function (cap_exhausted /
//     not_a_member / room_not_found), and on success kicks off the
//     `compute-verdict` re-run so the engine emits a fresh verdict
//     under the new state. The S05 surface picks up the new verdict
//     via its existing Realtime subscriber.
//   * `refreshUsedCount()` reads the current count of `rerolls` rows
//     for the room — drives the S07 stamp + the S06 lock-plate footer.
//
// What this store does NOT do:
//   * Compute the verdict. The RPC mutates state, deletes the prior
//     verdict, and stamps `rooms.last_reroll_reason`; the downstream
//     `compute-verdict` Edge Function reads the state and writes the
//     new verdict + cuts. The split keeps the iOS surface thin.
//   * Enforce the 3-cap. Server-authoritative via the trigger AND the
//     RPC's count check.

import Foundation
import Supabase

@MainActor
public final class RerollStore: ObservableObject {
    @Published public private(set) var rerollsUsed: Int = 0
    @Published public private(set) var lastError: String?

    public enum RerollError: Error, Equatable, Sendable {
        case capExhausted
        case notAMember
        case unauthenticated
        case roomNotFound
        case invalidReason(String)
        case dietChipRequired
        case newVibeRequired
        case unknown(String)
    }

    private let client: SupabaseClient
    private let roomID: UUID

    public init(client: SupabaseClient, roomID: UUID) {
        self.client = client
        self.roomID = roomID
    }

    /// Apply a reroll. Calls the apply_reroll RPC, then kicks off
    /// compute-verdict so the engine writes the new verdict.
    @discardableResult
    public func applyReroll(
        reason: RerollScreen.Reason,
        detail: String?,
        newVibe: Int?,
        dietChip: String?
    ) async throws -> ApplyResult {
        let payload = ApplyRerollPayload(
            p_room_id: roomID.uuidString.lowercased(),
            p_reason: reason.rawValue,
            p_detail: detail,
            p_diet_chip: dietChip,
            p_new_vibe: newVibe
        )

        let response: ApplyRerollResponse
        do {
            response = try await client
                .rpc("apply_reroll", params: payload)
                .execute()
                .value
        } catch {
            self.lastError = "\(error)"
            throw error
        }

        if let err = response.error {
            self.lastError = err
            throw mapErrorString(err)
        }

        if let remaining = response.remaining {
            // Server-authoritative — trust the RPC's count over our
            // local optimistic increment.
            self.rerollsUsed = max(0, 3 - remaining)
        } else if let count = response.count {
            self.rerollsUsed = count
        }

        // Chase with compute-verdict so the engine writes the new
        // verdict + cuts. Errors here are surfaced but don't roll
        // back the reroll row — the engine can be re-poked.
        try await invokeComputeVerdict()

        return ApplyResult(
            rerollID: response.reroll_id,
            count: response.count ?? rerollsUsed,
            remaining: response.remaining ?? max(0, 3 - rerollsUsed),
            reason: response.reason ?? reason.rawValue
        )
    }

    /// Pull the current `rerolls` count for the room. Used on appear +
    /// after the apply_reroll RPC to keep the surface in sync.
    public func refreshUsedCount() async throws {
        struct Row: Decodable { let id: UUID }
        let rows: [Row] = try await client
            .from("rerolls")
            .select("id")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .execute()
            .value
        self.rerollsUsed = rows.count
    }

    // MARK: - internals

    private func invokeComputeVerdict() async throws {
        struct Body: Encodable { let room_id: String }
        try await client.functions.invoke(
            "compute-verdict",
            options: FunctionInvokeOptions(
                method: .post,
                body: Body(room_id: roomID.uuidString.lowercased())
            )
        )
    }

    private func mapErrorString(_ err: String) -> RerollError {
        switch err {
        case "cap_exhausted":    return .capExhausted
        case "not_a_member":     return .notAMember
        case "unauthenticated":  return .unauthenticated
        case "room_not_found":   return .roomNotFound
        case "diet_chip_required": return .dietChipRequired
        case "new_vibe_required":  return .newVibeRequired
        default:
            if err.hasPrefix("invalid_reason") { return .invalidReason(err) }
            return .unknown(err)
        }
    }

    // MARK: - wire types

    public struct ApplyResult: Equatable, Sendable {
        public let rerollID: String?
        public let count: Int
        public let remaining: Int
        public let reason: String
    }

    private struct ApplyRerollPayload: Encodable {
        let p_room_id: String
        let p_reason: String
        let p_detail: String?
        let p_diet_chip: String?
        let p_new_vibe: Int?
    }

    private struct ApplyRerollResponse: Decodable {
        let status: String?
        let reroll_id: String?
        let reason: String?
        let count: Int?
        let remaining: Int?
        let error: String?
    }
}
