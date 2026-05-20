// GetToIt — PlanDestructiveConfirmSheet (tb-WF-9, workflow-overhaul).
//
// The C-16-pattern bottom sheet that confirms a destructive Plan
// action: delete (Created) or leave (Joined). The sheet is composed
// inline from the C-16 sheet language (radius 26, dark glass, 38×4
// handle) and a C-05 `PillCTA fill="white"` primary; the dismiss is an
// eyebrow-token label (white 0.6) below the pill.
//
// HARD RULE — NO RED. The destructive weight is carried by the copy
// (the title is the question, the body is the consequence) and by the
// sheet's visual register (dark glass, no celebration motion), NOT by
// a colored button. The primary pill uses the existing C-05 primary
// treatment — white pill with dark text — for every variant. Tests
// pin `Copy.primaryFill == .white` for every variant so a future
// regression cannot paint a red primary.
//
// Spec: `design-system/surfaces/00-plan-list.md §"Three-dot menu
// (locked Q4) — Confirm sheet copy (LOCKED)"` + JSX reference in
// `design-system/code/screens/ScreenPlanList.jsx` (`ConfirmSheet`
// inline component).
//
// Variants — one per row of the surface-doc copy table:
//   * .pendingDelete         (Created Pending → Delete plan)
//   * .decidedActiveDelete   (Created Decided-active → Delete plan)
//   * .historyDelete         (Created Decided-expired → Remove)
//   * .joinedLeave           (Joined any status → Leave plan)
//
// Variant resolution from (role, status, verb) is a pure helper —
// `variantFor(role:status:verb:)` — so callers and tests reach the
// same mapping without going through the view tree.

import SwiftUI

public struct PlanDestructiveConfirmSheet: View {

    // MARK: - variants

    /// The four destructive-confirm variants. Each maps to a row in the
    /// locked copy table.
    public enum Variant: Equatable, CaseIterable, Sendable {
        case pendingDelete
        case decidedActiveDelete
        case historyDelete
        case joinedLeave
    }

    /// The verb a card's menu item invokes. `delete` is creator-only;
    /// `leave` is joiner-only. Separate from `Variant` because the
    /// (role, status, verb) → Variant resolver is the pure helper
    /// tests pin.
    public enum Verb: Equatable, Sendable {
        case delete
        case leave
    }

    // MARK: - copy

    /// Frozen copy struct emitted per variant by `copyFor(_:)`. The
    /// `primaryFill` is `.white` for every variant — the HARD RULE —
    /// NO RED contract.
    public struct Copy: Equatable, Sendable {
        public enum Fill: Equatable, Sendable {
            case white
        }

        public let title: String
        public let body: String
        public let primary: String
        public let primaryFill: Fill
        public let dismiss: String

        public init(
            title: String,
            body: String,
            primary: String,
            primaryFill: Fill,
            dismiss: String
        ) {
            self.title = title
            self.body = body
            self.primary = primary
            self.primaryFill = primaryFill
            self.dismiss = dismiss
        }
    }

    // MARK: - pure helpers

    /// The locked copy table — one row per variant. Tests pin every
    /// string verbatim against `surfaces/00-plan-list.md §"Three-dot
    /// menu (locked Q4) — Confirm sheet copy (LOCKED)"`.
    public static func copyFor(_ variant: Variant) -> Copy {
        switch variant {
        case .pendingDelete:
            return Copy(
                title: "Delete this plan?",
                body: "Nothing's been decided yet — no one's been notified.",
                primary: "Delete plan",
                primaryFill: .white,
                dismiss: "KEEP"
            )
        case .decidedActiveDelete:
            return Copy(
                title: "Delete this plan?",
                body: "The active room will end. Joiners will see a session-ended notice.",
                primary: "Delete plan",
                primaryFill: .white,
                dismiss: "KEEP"
            )
        case .historyDelete:
            return Copy(
                title: "Remove from history?",
                body: "The verdict will be deleted permanently.",
                primary: "Remove",
                primaryFill: .white,
                dismiss: "KEEP"
            )
        case .joinedLeave:
            return Copy(
                title: "Leave this plan?",
                body: "Your answers will be removed. The room continues for everyone else.",
                primary: "Leave plan",
                primaryFill: .white,
                dismiss: "STAY"
            )
        }
    }

    /// Pure resolver — (role, status, verb) → Variant. Tests pin the
    /// four cases; call sites use this to feed the sheet's `variant`.
    public static func variantFor(
        role: PlansStore.DecidedPlanRow.Role,
        status: PlansStore.LifecycleState,
        verb: Verb
    ) -> Variant {
        if role == .joined || verb == .leave {
            // A joiner can only Leave; verb is forced to .leave by
            // the menu items themselves. Defensive: any (joined, X)
            // input maps to joinedLeave regardless of status.
            return .joinedLeave
        }
        // role == .owner, verb == .delete
        switch status {
        case .pending:         return .pendingDelete
        case .decidedActive:   return .decidedActiveDelete
        case .decidedExpired:  return .historyDelete
        }
    }

    // MARK: - dependencies (host-supplied)

    private let variant: Variant
    private let onConfirm: () -> Void
    private let onDismiss: () -> Void

    // MARK: - init

    public init(
        variant: Variant,
        onConfirm: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.variant = variant
        self.onConfirm = onConfirm
        self.onDismiss = onDismiss
    }

    // MARK: - body

    public var body: some View {
        let copy = Self.copyFor(variant)
        ZStack {
            // C-16 dark-glass register — same backdrop tint the
            // disambig + reroll sheets use. ink2 @ 0.94 matches the
            // JSX's `rgba(20,20,30,0.92)` register.
            GTIColor.ink2.opacity(0.94)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                handle
                    .padding(.top, GTISpacing.step3)
                    .padding(.bottom, GTISpacing.step5 - 2) // 18pt — matches C-16

                Text(copy.title)
                    .font(.system(size: GTIFont.Size.heading, weight: .black))
                    .tracking(GTIFont.TrackingEm.heading * GTIFont.Size.heading)
                    .textCase(.uppercase)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, GTISpacing.step5 + 2) // 22pt
                    .padding(.bottom, GTISpacing.step3 - 2)     // 10pt
                    .accessibilityIdentifier("planList.confirmSheet.title")

                Text(copy.body)
                    .font(.system(size: GTIFont.Size.body - 2, weight: .medium))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, GTISpacing.step5 + 2) // 22pt
                    .padding(.bottom, GTISpacing.step5 + 2)     // 22pt
                    .accessibilityIdentifier("planList.confirmSheet.body")

                Button(action: {
                    onConfirm()
                }) {
                    ZStack {
                        RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                            .fill(GTIColor.paper)
                        Text(copy.primary.uppercased())
                            .font(.system(size: GTIFont.Size.cta, weight: .black))
                            .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                            .foregroundStyle(GTIColor.ink)
                    }
                    .frame(height: 60)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, GTISpacing.step5 + 2) // 22pt
                .accessibilityIdentifier("planList.confirmSheet.primary")
                .accessibilityLabel(copy.primary)

                Button(action: {
                    onDismiss()
                }) {
                    Text(copy.dismiss)
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                        .padding(.top, GTISpacing.step2)
                        .padding(.bottom, GTISpacing.step5 - 2) // 18pt
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("planList.confirmSheet.dismiss")
                .accessibilityLabel(copy.dismiss)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .presentationDetents([.height(confirmDetentHeight), .medium])
        .presentationCornerRadius(GTIRadii.sheet)
        .presentationDragIndicator(.hidden) // we render our own handle
        .accessibilityIdentifier("planList.confirmSheet")
    }

    // MARK: - bits

    /// 38×4 white-0.22 handle pill — matches the C-16 sheet primitive.
    private var handle: some View {
        Capsule()
            .fill(Color.white.opacity(0.22))
            .frame(width: 38, height: 4)
            .accessibilityHidden(true)
    }

    /// The sheet's intrinsic content height — handle + title + body +
    /// primary pill + dismiss. Pinned so SwiftUI's `.sheet` presents
    /// at the right size on first open. The user can drag to `.medium`
    /// if they want.
    private var confirmDetentHeight: CGFloat {
        // 12 top + 4 handle + 18 + ~28 title + 10 + ~52 body (2 lines) +
        // 22 + 60 pill + 8 + 44 dismiss + 18 = ~276pt. Round up.
        300
    }
}

// MARK: - test affordance

extension PlanDestructiveConfirmSheet {
    /// Test-only hook — drives the primary-pill tap without walking
    /// the SwiftUI view tree. Production code never calls this.
    @MainActor
    func simulateConfirm() {
        onConfirm()
    }

    /// Test-only hook — drives the dismiss eyebrow tap without walking
    /// the SwiftUI view tree. Production code never calls this.
    @MainActor
    func simulateDismiss() {
        onDismiss()
    }
}
