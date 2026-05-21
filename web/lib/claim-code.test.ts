// Tests for the web claim-code mint client (tb-WF-13).

import { describe, expect, it, vi } from "vitest";

import { mintClaimCode, type ClaimCodeMintDeps } from "./claim-code";

/** A fake Supabase client with just the surface `mintClaimCode` touches:
 *  `auth.getSession()` (for the refresh token) and
 *  `functions.invoke()` (the mint-claim-code Edge Function call). */
function fakeClient(opts: {
  refreshToken?: string | null;
  invokeResult?: { data: unknown; error: unknown };
}): ClaimCodeMintDeps["client"] {
  return {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: opts.refreshToken
              ? { refresh_token: opts.refreshToken }
              : null,
          },
        }),
    },
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve(
          opts.invokeResult ?? {
            data: { status: "ok", code: "ABCD2345" },
            error: null,
          },
        ),
      ),
    },
  } as unknown as ClaimCodeMintDeps["client"];
}

describe("mintClaimCode", () => {
  it("posts the session refresh token and returns the minted code", async () => {
    const client = fakeClient({
      refreshToken: "v1.rt_webtoken",
      invokeResult: {
        data: { status: "ok", code: "WXYZ6789" },
        error: null,
      },
    });
    const code = await mintClaimCode({ client });
    expect(code).toBe("WXYZ6789");

    // The Edge Function was invoked with the refresh token in the body.
    const invoke = (client.functions as { invoke: ReturnType<typeof vi.fn> })
      .invoke;
    expect(invoke).toHaveBeenCalledWith("mint-claim-code", {
      body: { refresh_token: "v1.rt_webtoken" },
    });
  });

  it("throws when there is no live session to mint from", async () => {
    const client = fakeClient({ refreshToken: null });
    await expect(mintClaimCode({ client })).rejects.toThrow();
  });

  it("throws when the Edge Function returns an error", async () => {
    const client = fakeClient({
      refreshToken: "v1.rt_webtoken",
      invokeResult: { data: null, error: { message: "boom" } },
    });
    await expect(mintClaimCode({ client })).rejects.toThrow();
  });

  it("throws when the Edge Function returns no code", async () => {
    const client = fakeClient({
      refreshToken: "v1.rt_webtoken",
      invokeResult: { data: { status: "ok" }, error: null },
    });
    await expect(mintClaimCode({ client })).rejects.toThrow();
  });
});
