// GetToIt — S01 · Initiator landing (TB-02 minimal port).
//
// This is the minimum port required by TB-02:
//   * Food vertical visibly selected; Drinks + Movie rendered as
//     disabled future-plan rows.
//   * Primary CTA "Drop the invite link" creates a room and triggers
//     the iOS share sheet with the generated Universal Link.
//
// Explicitly **deferred to TB-03**:
//   * Timer chip group (5 · 10 · 15 · 30 min)
//   * Radius slider (0.5 – 5.0 mi)
// Those controls land in TB-03 with their schema columns
// (`rooms.timer_minutes`, `rooms.radius_meters`). For TB-02 we write
// the row without them and the server-side schema defaults take over.
//
// All color, type, spacing, and motion come from `GTITokens.swift` —
// per repo CLAUDE.md, never inline hex/px/easing.

import SwiftUI
import UIKit

@MainActor
public struct InitiatorScreen: View {
    @State private var phase: Phase = .ready
    @State private var pendingShare: PendingShare?

    private let roomStore: RoomStore

    public init(roomStore: RoomStore) {
        self.roomStore = roomStore
    }

    public enum Phase: Equatable {
        case ready
        case creating
        case shared(roomID: UUID)
        case error(String)
    }

    /// State the share sheet reads when present. Driven into a sheet
    /// item so SwiftUI cleanly tears down the share view after dismiss.
    public struct PendingShare: Identifiable, Equatable {
        public let id: UUID
        public let url: URL
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: GTISpacing.step6) {
                header

                Spacer(minLength: GTISpacing.step6)

                verticalPicker

                Spacer(minLength: 0)

                cta
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step16)
            .padding(.bottom, GTISpacing.step6)
        }
        .sheet(item: $pendingShare) { share in
            ShareSheet(items: [share.url])
        }
    }

    // MARK: - sub-views

    private var header: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step4) {
            Text("TONIGHT'S SESSION")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .accessibilityIdentifier("initiator.eyebrow")

            Text("Figure\nit out\ntogether")
                // Display weight is locked at 900 in tokens.json; SwiftUI's
                // `.black` weight maps to 900 in the Inter family. `display-m`
                // is the token tokens.md §2 maps to the initiator headline.
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("initiator.headline")

            Text("Five quick taps each. One verdict. Sixty seconds.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .frame(maxWidth: 280, alignment: .leading)
                .accessibilityIdentifier("initiator.subhead")
        }
    }

    private var verticalPicker: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("PICK A VERTICAL")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .padding(.bottom, GTISpacing.step1)

            verticalRow(label: "Food", meta: "Where to eat", selected: true, enabled: true)
            verticalRow(label: "Drinks", meta: "Coming v2", selected: false, enabled: false)
            verticalRow(label: "Movie", meta: "Coming v2", selected: false, enabled: false)
        }
    }

    private func verticalRow(label: String, meta: String, selected: Bool, enabled: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: GTIFont.Size.body, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Text(meta.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .semibold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
            }
            Spacer()
            if selected {
                ZStack {
                    Circle().fill(GTIColor.sun)
                    Text("✓")
                        .font(.system(size: GTIFont.Size.eyebrow + 1, weight: .black))
                        .foregroundStyle(GTIColor.ink)
                }
                .frame(width: 22, height: 22)
                .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, GTISpacing.step5)
        .padding(.vertical, GTISpacing.step3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(selected ? GTIColor.Glass.fillStrong : GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(selected ? GTIColor.Glass.stroke : Color.white.opacity(0.18), lineWidth: 1)
        )
        .opacity(enabled ? 1.0 : 0.55)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label). \(meta)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    @ViewBuilder
    private var cta: some View {
        VStack(spacing: GTISpacing.step3) {
            if case .error(let message) = phase {
                Text(message)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("initiator.error")
            }

            Button(action: shareInviteLink) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .frame(height: 60)
                    Group {
                        if phase == .creating {
                            ProgressView()
                                .tint(GTIColor.ink)
                        } else {
                            Text("DROP THE INVITE LINK")
                                .font(.system(size: GTIFont.Size.cta, weight: .black))
                                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                                .foregroundStyle(GTIColor.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("initiator.cta")
            .disabled(phase == .creating)
        }
    }

    // MARK: - actions

    private func shareInviteLink() {
        phase = .creating
        Task {
            do {
                let room = try await roomStore.createRoom()
                // Token is a placeholder for v1 — TB-02 just needs the
                // round-trip-able shape. Signed/expiring tokens land in a
                // later tracer bullet once the abuse surface materializes.
                let token = UUID().uuidString
                let url = InviteLink.url(roomID: room.id, inviteToken: token)
                UIPasteboard.general.string = url.absoluteString
                phase = .shared(roomID: room.id)
                pendingShare = PendingShare(id: room.id, url: url)
            } catch {
                phase = .error("Couldn't create the session. \(String(describing: error))")
            }
        }
    }
}

// MARK: - share sheet bridge

/// Bridges `UIActivityViewController` into SwiftUI so we can present
/// the iOS share sheet from `.sheet(item:)`. The auto-transition into
/// Q1 after sharing (PRD user story 8) is wired in TB-04 — for TB-02
/// we just drop the link and stay on S01.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
