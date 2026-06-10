import { createClient } from "@supabase/supabase-js";

import {
  createMobileSupabaseClient,
  createSupabaseAuthRepository,
  getMobileSupabaseConfig,
  type AppleCredential,
  type MobileAuthRepositoryDependencies,
  type SupabaseAuthSession,
} from "../src/auth/authRepository";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  })),
}));

function session(
  userId: string,
  isAnonymous: boolean,
): SupabaseAuthSession {
  return {
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
    user: {
      id: userId,
      is_anonymous: isAnonymous,
    },
  };
}

function appleCredential(): AppleCredential {
  return {
    idToken: "apple-id-token",
    nonce: "apple-nonce",
  };
}

function makeDeps(
  overrides: Partial<MobileAuthRepositoryDependencies> = {},
): MobileAuthRepositoryDependencies {
  return {
    appleProvider: {
      requestAppleCredential: jest.fn().mockResolvedValue(appleCredential()),
    },
    supabase: {
      auth: {
        getSession: mockGetSession(session("anon-user", true)),
        signInWithIdToken: jest.fn().mockResolvedValue({
          data: { session: session("apple-user", false) },
          error: null,
        }),
        linkAppleWithIdToken: jest.fn().mockResolvedValue({
          data: { session: session("anon-user", false) },
          error: null,
        }),
        refreshSession: jest.fn().mockResolvedValue({
          data: { session: session("claimed-user", true) },
          error: null,
        }),
        signOut: jest
          .fn()
          .mockResolvedValue({ error: null }),
      },
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: {
            refresh_token: "claim-refresh-token",
            user_id: "claimed-user",
          },
          error: null,
        }),
      },
    },
    ...overrides,
  };
}

function mockGetSession(sessionValue: SupabaseAuthSession | null, error = null) {
  return jest.fn().mockResolvedValue({
    data: { session: sessionValue },
    error,
  });
}

function makeDepsWithSession(
  sessionValue: SupabaseAuthSession | null,
): MobileAuthRepositoryDependencies {
  const deps = makeDeps();

  return {
    ...deps,
    supabase: {
      ...deps.supabase,
      auth: {
        ...deps.supabase.auth,
        getSession: mockGetSession(sessionValue),
      },
    },
  };
}

describe("authRepository", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reads Supabase config from Expo public environment variables", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

    expect(getMobileSupabaseConfig()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "public-anon-key",
    });
  });

  it("throws when Expo Supabase config is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getMobileSupabaseConfig()).toThrow(
      "Supabase env vars are missing",
    );
  });

  it("configures Supabase auth with native session storage", () => {
    createMobileSupabaseClient({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "public-anon-key",
    });

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "public-anon-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          storage: expect.objectContaining({
            getItem: expect.any(Function),
            removeItem: expect.any(Function),
            setItem: expect.any(Function),
          }),
        }),
      }),
    );
  });

  it.each([
    { name: "idle", input: null, kind: "idle" },
    { name: "Anonymous", input: session("anon-user", true), kind: "anonymous" },
    {
      name: "Linked-Apple",
      input: session("apple-user", false),
      kind: "linkedApple",
    },
  ] as const)("maps a Supabase session to $name auth state", async ({
    input,
    kind,
  }) => {
    const deps = makeDepsWithSession(input);
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.restoreSession()).resolves.toMatchObject({
      kind,
    });
  });

  it("uses the native Apple boundary and links Apple onto an Anonymous session", async () => {
    const deps = makeDeps();
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.signInWithApple()).resolves.toEqual({
      kind: "linkedApple",
      userId: "anon-user",
    });

    expect(deps.appleProvider.requestAppleCredential).toHaveBeenCalledTimes(1);
    expect(deps.supabase.auth.linkAppleWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "apple-nonce",
      currentUserId: "anon-user",
    });
    expect(deps.supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("signs in with Apple from idle without requiring a native Apple runtime in tests", async () => {
    const deps = makeDepsWithSession(null);
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.signInWithApple()).resolves.toEqual({
      kind: "linkedApple",
      userId: "apple-user",
    });

    expect(deps.supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "apple-nonce",
    });
  });

  it("redeems a claim code and installs the carried Anonymous session", async () => {
    const deps = makeDepsWithSession(null);
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.redeemClaimCode(" ABCD2345 ")).resolves.toEqual({
      kind: "anonymous",
      userId: "claimed-user",
    });

    expect(deps.supabase.functions.invoke).toHaveBeenCalledWith(
      "redeem-claim-code",
      { body: { code: "ABCD2345" } },
    );
    expect(deps.supabase.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: "claim-refresh-token",
    });
  });

  it("keeps claim-code redemption idle-only", async () => {
    const deps = makeDeps();
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.redeemClaimCode("ABCD2345")).rejects.toThrow(
      "Claim codes can only be redeemed before sign-in",
    );
    expect(deps.supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("surfaces Supabase auth errors", async () => {
    const deps = makeDeps();
    deps.supabase.auth.getSession = mockGetSession(
      null,
      new Error("auth service unavailable"),
    );
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.restoreSession()).rejects.toThrow(
      "auth service unavailable",
    );
  });

  it("exposes sign-out and account-delete hooks", async () => {
    const deps = makeDeps();
    const repository = createSupabaseAuthRepository(deps);

    await expect(repository.signOut()).resolves.toEqual({ kind: "idle" });
    await expect(repository.deleteCurrentAccount()).resolves.toEqual({
      kind: "idle",
    });

    expect(deps.supabase.auth.signOut).toHaveBeenCalledTimes(2);
    expect(deps.supabase.functions.invoke).toHaveBeenCalledWith("delete-user", {
      body: {},
    });
  });
});
