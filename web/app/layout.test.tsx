// GetToIt web — RootLayout integration test.
//
// wfr-10. Asserts the root layout mounts the global <Footer/> so every
// route (including terminal join states and legal pages) gets the
// Privacy/Terms/Help affordances. We render the layout with a child
// <main> stand-in and look up the footer landmark + its canonical
// legal links — same approach as a real page render, just without a
// route-level fetch.
//
// We bypass the <html>/<body> wrapping (jsdom complains about nested
// document elements) by rendering the layout's children into a div.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("mounts the global Footer with Privacy and Terms links", () => {
    // RootLayout returns <html><body>{children}</body></html>. jsdom
    // refuses to mount nested <html>, so we lift the body contents
    // into a wrapper div via a custom container. The render API does
    // not expose that hook cleanly, so we test the layout's behaviour
    // by asserting the returned JSX tree contains a <Footer/>.
    const tree = RootLayout({ children: <main>hello</main> });
    // The returned tree is <html><body>{children}<Footer/></body></html>
    // (or any structural variant that puts a Footer next to children).
    // Render the body's children into the test DOM.
    const body = (tree as { props: { children: { props: { children: unknown } } } })
      .props.children;
    const bodyChildren = (body as { props: { children: unknown } }).props
      .children;
    render(<>{bodyChildren as React.ReactNode}</>);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute(
      "href",
      "/terms"
    );
  });
});
