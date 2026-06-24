// GetToIt web — /join/<roomId> page footer-visibility test.
//
// wfr-30. The global Footer (wfr-10) is mounted in `RootLayout` so every
// route gets Privacy / Terms / Help affordances. The InviteShell route's
// gradient surface previously had `<main style={position:"fixed", inset:0}>`
// which sat on top of the footer in the stacking context and visually
// hid it — defeating the wfr-10 acceptance "footer visible on every web
// route" for `/join/[roomId]`.
//
// wfr-30 explicitly resolves this by ensuring the footer remains visible
// on the InviteShell route. The page's <main> must NOT be position:fixed
// (which would cover the body's footer sibling); it must flow as a flex
// child so the Footer in the column below it can render.

import { describe, expect, it } from "vitest";

import JoinPage from "./page";

describe("JoinPage layout", () => {
  it("does not use position:fixed on <main> so the global Footer stays visible", async () => {
    // JoinPage is a server component returning a JSX tree. We inspect
    // the returned element directly rather than rendering — InviteShell
    // booting under jsdom needs supabase mocks the layout test does
    // not own, and the layout assertion only needs the <main> style.
    const tree = (await JoinPage({
      params: Promise.resolve({ roomId: "room-1" }),
    })) as {
      type: string;
      props: { style?: { position?: string } };
    };
    expect(tree.type).toBe("main");
    expect(tree.props.style?.position).not.toBe("fixed");
  });
});
