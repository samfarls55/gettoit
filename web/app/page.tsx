// GetToIt web fallback — placeholder landing surface.
//
// TB-01 walking skeleton. Real fallback (web invite + quiz + verdict)
// lands in TB-15 against the same Sunset Pop tokens loaded in
// `layout.tsx`. The styles below reference the generated CSS custom
// flows here without code changes.

export default function Page() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(180deg, var(--g1) 0%, var(--g2) 32%, var(--g3) 66%, var(--g4) 100%)",
        color: "var(--paper)",
        fontFamily: "var(--ff-display)",
        padding: "var(--sp-6)",
        textAlign: "center",
      }}
    >
      <div>
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
          Coming soon.
        </h1>
      </div>
    </main>
  );
}
