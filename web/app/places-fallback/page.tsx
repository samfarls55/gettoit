// Web fallback empty state — surfaces the "couldn't load options
// nearby" message when the PlacesProxy Edge Function returns a thin
// response or errors on the web client.
//
// Why a standalone route: per ADR 0002, the web fallback does NOT
// have a MapKit escape hatch (MapKit is native mobile only). When the
// proxy fails on web, the entire candidate-pool path is dead, so
// the experience degrades to a clear copy state rather than an
// indefinite spinner.
//
// TB-15 (the full web fallback build) consumes the `PlacesEmptyState`
// component below to render this state inline in the web quiz flow.
// For TB-05 we ship the component standalone and expose it at this
// route so QA / cohort 1 can verify the surface even before TB-15.

import { PlacesEmptyState } from "@/components/PlacesEmptyState";

export const metadata = {
  title: "GetToIt — Couldn't load options",
};

export default function PlacesFallbackPage() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(180deg, var(--g1) 0%, var(--g2) 32%, var(--g3) 66%, var(--g4) 100%)",
        padding: "var(--sp-6)",
      }}
    >
      <PlacesEmptyState />
    </main>
  );
}
