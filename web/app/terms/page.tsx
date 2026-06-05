// GetToIt — Terms of Service.
//
// Public legal page satisfying TB-16 acceptance criterion
// "TOS hosted at gettoit.app/terms" and required for App Store
// submission. Pairs with the Privacy Policy at /privacy.
//
// canonical tokens for typography and color so it stays on-brand
// without forcing a long-form-text surface into the locked spec.

import type { CSSProperties } from "react";

import { GTIMark } from "../../components/SunsetPop";

export const metadata = {
  title: "Terms of Service - GetToIt",
  description:
    "The rules for using GetToIt during the beta period. Plain-language terms covering eligibility, acceptable use, and disclaimers.",
};

const EFFECTIVE_DATE = "May 14, 2026";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--ink)",
  color: "var(--paper)",
  fontFamily: "var(--ff-body)",
  padding: "var(--sp-10) var(--sp-6)",
};

const containerStyle: CSSProperties = {
  maxWidth: "40rem",
  margin: "0 auto",
  lineHeight: 1.55,
};

const homeLinkRowStyle: CSSProperties = {
  // wfr-19. Mounts the GTIMark wordmark at the top of the legal page
  // as the in-page Escape Hatch to home. The wordmark itself is a
  // Link to `/` (wfr-18) so we just give it breathing room before the
  // article content starts.
  marginBottom: "var(--sp-6)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontWeight: 700,
  fontSize: "var(--fz-eyebrow)",
  letterSpacing: "var(--tr-eyebrow)",
  textTransform: "uppercase",
  opacity: 0.78,
  marginBottom: "var(--sp-3)",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--ff-display)",
  fontWeight: 900,
  fontSize: "var(--fz-display-s)",
  letterSpacing: "var(--tr-display)",
  lineHeight: 1.0,
  margin: `0 0 var(--sp-3) 0`,
};

const metaStyle: CSSProperties = {
  fontFamily: "var(--ff-mono)",
  fontSize: "var(--fz-sm)",
  opacity: 0.6,
  marginBottom: "var(--sp-8)",
};

const h2Style: CSSProperties = {
  fontFamily: "var(--ff-display)",
  fontWeight: 800,
  fontSize: "var(--fz-title)",
  letterSpacing: "var(--tr-display)",
  margin: `var(--sp-10) 0 var(--sp-3) 0`,
};

const pStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontSize: "var(--fz-body)",
  margin: `0 0 var(--sp-4) 0`,
  opacity: 0.92,
};

const ulStyle: CSSProperties = {
  margin: `0 0 var(--sp-4) 0`,
  paddingLeft: "var(--sp-6)",
};

const liStyle: CSSProperties = {
  fontFamily: "var(--ff-body)",
  fontSize: "var(--fz-body)",
  margin: `0 0 var(--sp-2) 0`,
  opacity: 0.92,
};

const linkStyle: CSSProperties = {
  color: "var(--sun)",
  textDecoration: "underline",
};

const allCapsStyle: CSSProperties = {
  ...pStyle,
  textTransform: "uppercase",
  fontSize: "var(--fz-sm)",
  letterSpacing: "0.04em",
  opacity: 0.86,
};

export default function TermsPage() {
  return (
    <main style={pageStyle}>
      <article style={containerStyle}>
        <div style={homeLinkRowStyle}>
          <GTIMark size={20} />
        </div>
        <p style={eyebrowStyle}>GetToIt</p>
        <h1 style={titleStyle}>Terms of Service</h1>
        <p style={metaStyle}>Effective {EFFECTIVE_DATE}</p>

        <p style={pStyle}>
          These Terms of Service (the &quot;Terms&quot;) govern your use of
          the GetToIt mobile app and the gettoit.app website (together, the
          &quot;Service&quot;). By installing or using the Service, you
          agree to these Terms. If you do not agree, please do not use the
          Service. Questions:{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>
          .
        </p>

        <h2 style={h2Style}>1. The Service</h2>
        <p style={pStyle}>
          GetToIt helps small groups decide where to eat. You answer a short
          quiz, the app pulls nearby restaurants from a third-party data
          provider, and the group reaches a single verdict together.
          GetToIt is provided free of charge during the current beta. There
          is no paid tier, no in-app purchase, and no subscription.
        </p>

        <h2 style={h2Style}>2. Beta status</h2>
        <p style={pStyle}>
          The Service is in active beta. Features may change, break, or be
          removed without notice. Bugs and outages are expected. We may
          invite specific groups of users and may pause or end the beta at
          any time. Your continued use after a change means you accept the
          change.
        </p>

        <h2 style={h2Style}>3. Eligibility</h2>
        <p style={pStyle}>
          You must be at least 13 years old to use the Service. If you are
          between 13 and the age of legal majority where you live, you may
          only use the Service with the permission of a parent or legal
          guardian. The Service is offered only to users located in the
          United States.
        </p>

        <h2 style={h2Style}>4. Your account</h2>
        <p style={pStyle}>
          When you first open the app, GetToIt creates an anonymous account
          for you. You can optionally upgrade that account by signing in
          with Apple, which lets you keep your history across devices and
          re-installs. You are responsible for activity that occurs under
          your account, whether anonymous or claimed.
        </p>
        <p style={pStyle}>
          You can delete your account at any time from the Settings screen
          inside the app. Deletion is permanent and immediate.
        </p>

        <h2 style={h2Style}>5. Acceptable use</h2>
        <p style={pStyle}>You agree not to:</p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            Use the Service to harass, threaten, or harm another person.
          </li>
          <li style={liStyle}>
            Interfere with, probe, or attempt to circumvent the
            Service&apos;s security or rate limits, or use automated means
            (scripts, bots) to interact with the Service.
          </li>
          <li style={liStyle}>
            Reverse-engineer, decompile, or attempt to extract source code
            from the app, except where this restriction is forbidden by
            applicable law.
          </li>
          <li style={liStyle}>
            Use the Service to violate any law or any third party&apos;s
            rights.
          </li>
          <li style={liStyle}>
            Misrepresent your identity in a way intended to deceive other
            members of a decision group.
          </li>
        </ul>
        <p style={pStyle}>
          We may suspend or terminate your access if we reasonably believe
          you are violating these rules.
        </p>

        <h2 style={h2Style}>6. Restaurant information</h2>
        <p style={pStyle}>
          Restaurant data shown in the Service (names, addresses, hours,
          categories, dietary tags, and similar attributes) is supplied by
          third-party data providers, primarily Foursquare. We do not
          control this data and do not warrant that it is accurate, current,
          or complete. Hours can be wrong. Restaurants can close. Dietary
          tags can be incorrect or out of date. You are responsible for
          confirming any detail that matters to you (for example, allergens,
          accessibility, or whether the restaurant is open) directly with
          the restaurant before relying on it.
        </p>

        <h2 style={h2Style}>7. Push notifications</h2>
        <p style={pStyle}>
          If you grant push permission, the Service will send you
          notifications related to your decision groups (for example, when
          a verdict is ready). You can revoke this permission at any time
          from device Settings.
        </p>

        <h2 style={h2Style}>8. Your data and privacy</h2>
        <p style={pStyle}>
          Our handling of your data is described in the{" "}
          <a href="/privacy" style={linkStyle}>
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>

        <h2 style={h2Style}>9. Our intellectual property</h2>
        <p style={pStyle}>
          The Service, including the GetToIt name, logo, visual design,
          source code, and any documentation, belongs to the operator of
          GetToIt and is protected by copyright, trademark, and other laws.
          These Terms do not grant you any right to use the GetToIt name
          or logo other than to identify the Service in factual references.
        </p>

        <h2 style={h2Style}>10. Disclaimers</h2>
        <p style={allCapsStyle}>
          The service is provided &quot;as is&quot; and &quot;as
          available&quot; without warranties of any kind, whether express
          or implied. To the maximum extent permitted by law, we disclaim
          all implied warranties, including merchantability, fitness for a
          particular purpose, non-infringement, and any warranty arising
          from course of dealing or usage of trade.
        </p>
        <p style={pStyle}>
          We do not warrant that the Service will be uninterrupted, secure,
          error-free, or free from harmful components, or that the
          restaurant information shown in the Service is accurate or
          complete.
        </p>

        <h2 style={h2Style}>11. Limitation of liability</h2>
        <p style={allCapsStyle}>
          To the maximum extent permitted by law, in no event will the
          operator of GetToIt be liable for any indirect, incidental,
          consequential, special, punitive, or exemplary damages arising
          out of or relating to the Service. Our total aggregate liability
          to you for all claims arising out of or relating to the Service
          will not exceed one hundred United States dollars ($100).
        </p>
        <p style={pStyle}>
          Some jurisdictions do not allow the exclusion or limitation of
          certain damages. To the extent your jurisdiction does not allow
          such exclusion or limitation, the limitations above will apply
          only to the maximum extent permitted by law.
        </p>

        <h2 style={h2Style}>12. Indemnification</h2>
        <p style={pStyle}>
          You agree to indemnify and hold harmless the operator of GetToIt
          from any claim, demand, loss, or expense (including reasonable
          legal fees) arising from your misuse of the Service, your
          violation of these Terms, or your violation of any law or any
          third party&apos;s rights.
        </p>

        <h2 style={h2Style}>13. Termination</h2>
        <p style={pStyle}>
          You may stop using the Service at any time, and you may delete
          your account from the Settings screen inside the app. We may
          suspend or terminate your access to the Service at any time,
          with or without notice, if we reasonably believe you have
          violated these Terms, if doing so is required by law, or if we
          decide to end the beta. The sections that by their nature should
          survive termination (including disclaimers, limitations of
          liability, indemnification, and governing law) will survive.
        </p>

        <h2 style={h2Style}>14. Governing law and venue</h2>
        <p style={pStyle}>
          These Terms are governed by the laws of the State of Tennessee,
          United States, without regard to its conflict-of-laws principles.
          Any dispute arising out of or relating to these Terms or the
          Service that the parties cannot resolve informally will be
          brought exclusively in the state or federal courts located in
          Tennessee, and you consent to the personal jurisdiction of those
          courts. Either party may instead bring a qualifying claim in
          small-claims court.
        </p>

        <h2 style={h2Style}>15. Informal resolution first</h2>
        <p style={pStyle}>
          Before filing any lawsuit, please email{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>{" "}
          with a description of the issue and what you would like resolved.
          We will try in good faith to address it within 30 days.
        </p>

        <h2 style={h2Style}>16. Apple-specific terms</h2>
        <p style={pStyle}>
          The mobile app version of the Service is distributed through the Apple
          App Store. Apple is not a party to these Terms and has no
          obligation to provide support for the Service. Apple is a
          third-party beneficiary of these Terms with the right to enforce
          them against you. You agree to comply with the Apple Media
          Services Terms and Conditions to the extent applicable to your
          use of the Service.
        </p>

        <h2 style={h2Style}>17. Changes to these Terms</h2>
        <p style={pStyle}>
          We may update these Terms from time to time. If we make a
          material change, we will update the effective date at the top of
          this page and flag the change in the app the next time you open
          it. Your continued use of the Service after the effective date
          of the updated Terms means you accept the change.
        </p>

        <h2 style={h2Style}>18. Miscellaneous</h2>
        <p style={pStyle}>
          These Terms, together with the Privacy Policy, are the entire
          agreement between you and the operator of GetToIt regarding the
          Service. If any provision of these Terms is held unenforceable,
          the remaining provisions will remain in full force and effect.
          Our failure to enforce any right or provision will not be a
          waiver of that right or provision.
        </p>

        <h2 style={h2Style}>19. Contact</h2>
        <p style={pStyle}>
          Email:{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>
          <br />
          Operator: GetToIt, Tennessee, United States.
        </p>
      </article>
    </main>
  );
}
