// GetToIt — Privacy Policy.
//
// Public legal page satisfying TB-16 acceptance criterion
// "Privacy Policy hosted at gettoit.app/privacy" and the App Store
// submission Privacy Policy URL requirement. Content matches the
// posture defined in `gti-vault/60_engineering/adr/0006-privacy-posture-0.1.0.md`
// and must stay in lock-step with the Privacy Nutrition Labels filed
// in App Store Connect.
//
// Not a mobile design-system surface (no entry in
// `design-system/surfaces/`) — web-only legal page consuming the
// canonical tokens for typography and color so it stays on-brand
// without forcing a long-form-text surface into the locked spec.

import type { CSSProperties } from "react";

import { GTIMark } from "../../components/SunsetPop";

export const metadata = {
  title: "Privacy Policy - GetToIt",
  description:
    "How GetToIt handles your data: what we collect, what we share, how long we keep it, and how to delete it.",
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

export default function PrivacyPage() {
  return (
    <main style={pageStyle}>
      <article style={containerStyle}>
        <div style={homeLinkRowStyle}>
          <GTIMark size={20} />
        </div>
        <p style={eyebrowStyle}>GetToIt</p>
        <h1 style={titleStyle}>Privacy Policy</h1>
        <p style={metaStyle}>Effective {EFFECTIVE_DATE}</p>

        <p style={pStyle}>
          GetToIt helps small groups stop arguing about where to eat. This
          policy explains, in plain language, what data the app handles, what
          we share, how long we keep it, and how you can delete it. If you
          have questions, email{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>
          .
        </p>

        <h2 style={h2Style}>1. Who we are</h2>
        <p style={pStyle}>
          GetToIt is a personal project operated by an independent developer
          based in Tennessee, United States. The service consists of a mobile
          app distributed via the Apple App Store (and EAS/TestFlight during the
          beta period) and a companion web fallback hosted at gettoit.app.
        </p>

        <h2 style={h2Style}>2. Information we collect</h2>
        <p style={pStyle}>
          GetToIt collects only what it needs to run a group decision. There
          is no advertising, no profiling, and no resale of any data.
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong>Anonymous account ID.</strong> When you first open the
            app, GetToIt generates a random device-bound identifier so your
            votes and rooms can be tied together across screens. This ID
            contains no personal information.
          </li>
          <li style={liStyle}>
            <strong>Sign in with Apple identity (optional).</strong> If you
            choose to upgrade your anonymous account by signing in with
            Apple, we receive your Apple-relayed email address and the name
            you choose to share. We never see your real Apple ID password.
          </li>
          <li style={liStyle}>
            <strong>Quiz answers and room activity.</strong> Your responses
            to the in-app quiz, which restaurants you tap or scroll past,
            ratification taps, rerolls, and post-decision check-in answers
            are stored so the group decision engine can produce a verdict and
            so we can measure whether the app actually helps you decide.
          </li>
          <li style={liStyle}>
            <strong>Precise location, ephemerally.</strong> When you start a
            decision, the app requests your current location to send to the
            Foursquare Places API so we can find restaurants near you. We do
            not store your coordinates against your identity; we use them in
            the request and discard them.
          </li>
          <li style={liStyle}>
            <strong>Push device token (optional).</strong> If you grant push
            permission, your APNs device token is stored so we can notify
            you when the group has a verdict.
          </li>
        </ul>
        <p style={pStyle}>
          GetToIt does not collect contacts, photos, microphone, camera,
          HealthKit, financial, or browsing-history data.
        </p>

        <h2 style={h2Style}>3. How we use the information</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>To run a group decision end-to-end.</li>
          <li style={liStyle}>
            To send the verdict push notification (only if you granted push
            permission).
          </li>
          <li style={liStyle}>
            To measure aggregate product health, such as how often groups
            reach a verdict and how often verdicts hold up at follow-through.
            These metrics are computed at the cohort level.
          </li>
          <li style={liStyle}>
            To debug crashes, errors, and abuse, using server logs that are
            retained for a short operational window.
          </li>
        </ul>
        <p style={pStyle}>
          We do not use your data to build a profile of you, to target ads,
          or to sell or share with data brokers.
        </p>

        <h2 style={h2Style}>4. Who else sees your data</h2>
        <p style={pStyle}>
          GetToIt uses a small number of service providers (sometimes called
          subprocessors) to operate. They only process what they need to do
          their job; none of them receive your preferences or your account
          identity for their own purposes.
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong>Apple (Sign in with Apple, APNs).</strong> Handles
            optional sign-in and push delivery. Governed by Apple&apos;s own
            privacy practices.
          </li>
          <li style={liStyle}>
            <strong>Foursquare Places API.</strong> Receives only your
            current coordinates and search parameters (radius, time-of-day
            hint) so it can return nearby restaurants. Foursquare does not
            receive your account ID, your name, your email, your quiz
            answers, or your preferences.
          </li>
          <li style={liStyle}>
            <strong>Supabase (United States).</strong> Hosts our database,
            authentication, edge functions, and realtime channels.
          </li>
          <li style={liStyle}>
            <strong>Vercel (United States).</strong> Hosts the gettoit.app
            web fallback and this policy page.
          </li>
        </ul>
        <p style={pStyle}>
          Within a room you started or joined, the other members can see the
          decisions you all reached together (the verdict, who voted, who
          ratified) but they cannot see your individual quiz answers. Outside
          of the rooms you participate in, no one else can see your activity.
        </p>

        <h2 style={h2Style}>5. How long we keep it</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong>If you signed in with Apple:</strong> we keep your data
            until you delete your account from the Settings screen inside
            the app.
          </li>
          <li style={liStyle}>
            <strong>If you stayed anonymous:</strong> we automatically delete
            your account and the data tied to it 30 days after your last
            activity in the app. This sweep runs hourly on the server.
          </li>
          <li style={liStyle}>
            <strong>Aggregate, anonymized analytics</strong> (event counts,
            funnel metrics) survive account deletion because they no longer
            point to anyone.
          </li>
        </ul>

        <h2 style={h2Style}>6. Deleting your data</h2>
        <p style={pStyle}>
          Open the GetToIt app, tap{" "}
          <strong>Settings</strong> (from the main screen footer), then tap{" "}
          <strong>Delete my data</strong>. After you confirm, your account is
          erased from our database. Rooms you created are removed entirely.
          Rooms you only participated in have your contribution removed; the
          rest of the group&apos;s history in those rooms remains so the
          other participants&apos; experience is not retroactively rewritten.
        </p>
        <p style={pStyle}>
          We do not currently offer a data export. If you need a copy of
          your data before deletion, email{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>{" "}
          and we will respond manually within a reasonable period.
        </p>

        <h2 style={h2Style}>7. Children</h2>
        <p style={pStyle}>
          GetToIt is not directed at children under 13, and we do not
          knowingly collect data from anyone under 13. If you believe a child
          under 13 has used the service, please email{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>{" "}
          and we will delete the associated data.
        </p>

        <h2 style={h2Style}>8. Where the service is available</h2>
        <p style={pStyle}>
          GetToIt is currently offered only to users in the United States. We
          have not certified the service against the EU General Data
          Protection Regulation or other non-US privacy frameworks, so we ask
          that you not use the service from outside the United States during
          this beta period.
        </p>

        <h2 style={h2Style}>9. California residents</h2>
        <p style={pStyle}>
          GetToIt does not sell or share personal information for
          cross-context behavioral advertising as those terms are defined
          under the California Consumer Privacy Act (CCPA / CPRA). California
          residents may exercise their right to delete by using the in-app
          Delete my data button described above, or by emailing{" "}
          <a href="mailto:support@gettoit.app" style={linkStyle}>
            support@gettoit.app
          </a>
          .
        </p>

        <h2 style={h2Style}>10. Security</h2>
        <p style={pStyle}>
          We use industry-standard practices: TLS for all client-server
          traffic, row-level security policies in our database so members of
          one room cannot read another room&apos;s data, and short-lived
          authentication tokens. No system is perfectly secure; if we ever
          have a breach that affects you, we will notify you at the email on
          file (for users signed in with Apple) and post a notice on this
          page.
        </p>

        <h2 style={h2Style}>11. Changes to this policy</h2>
        <p style={pStyle}>
          If we change this policy, we will update the effective date at the
          top of this page. Material changes that affect how we handle data
          will also be flagged in the app the next time you open it.
        </p>

        <h2 style={h2Style}>12. Contact</h2>
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
