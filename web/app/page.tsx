// GetToIt web fallback — root surface.

import type { CSSProperties } from "react";

const mainStyle: CSSProperties = {
  minHeight: "72vh",
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(180deg, var(--g1) 0%, var(--g2) 32%, var(--g3) 66%, var(--g4) 100%)",
  color: "var(--paper)",
  fontFamily: "var(--ff-display)",
  padding: "var(--sp-6)",
  textAlign: "center",
};

export default function Page() {
  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: "34rem" }}>
        <p
          style={{
            fontFamily: "var(--ff-body)",
            fontWeight: 700,
            fontSize: "var(--fz-eyebrow)",
            letterSpacing: "var(--tr-eyebrow)",
            textTransform: "uppercase",
            opacity: 0.78,
            marginBottom: "var(--sp-3)",
          }}
        >
          GetToIt
        </p>
        <h1
          style={{
            fontFamily: "var(--ff-display)",
            fontWeight: 900,
            fontSize: "var(--fz-display-m)",
            letterSpacing: "var(--tr-display)",
            lineHeight: 0.92,
            margin: 0,
          }}
        >
          Decide where to eat together.
        </h1>
        <p
          style={{
            fontFamily: "var(--ff-body)",
            fontWeight: 500,
            fontSize: "var(--fz-body)",
            lineHeight: 1.45,
            opacity: 0.86,
            margin: "var(--sp-4) auto 0",
          }}
        >
          Open a GetToIt invite link to vote with your group and see the
          verdict when everyone is in.
        </p>
      </div>
    </main>
  );
}
