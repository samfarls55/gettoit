import { createClient } from "@supabase/supabase-js";

export type MobileAuthState =
  | { kind: "idle" }
  | { kind: "anonymous"; userId: string }
  | { kind: "linkedApple"; userId: string };

export type AppleCredential = {
  idToken: string;
  nonce?: string;
};

export type AppleCredentialProvider = {
  requestAppleCredential: () => Promise<AppleCredential>;
};

export type SupabaseAuthUser = {
  id: string;
  is_anonymous?: boolean;
};

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token: string;
  user: SupabaseAuthUser;
};

type SupabaseResult<TData> = {
  data: TData;
  error: Error | null;
};

type AppleTokenRequest = {
  provider: "apple";
  token: string;
  nonce?: string;
};

type AppleLinkRequest = AppleTokenRequest & {
  currentUserId: string;
};

export type MobileSupabaseAuthClient = {
  getSession: () => Promise<
    SupabaseResult<{ session: SupabaseAuthSession | null }>
  >;
  signInWithIdToken: (
    request: AppleTokenRequest,
  ) => Promise<SupabaseResult<{ session: SupabaseAuthSession | null }>>;
  linkAppleWithIdToken: (
    request: AppleLinkRequest,
  ) => Promise<SupabaseResult<{ session: SupabaseAuthSession | null }>>;
  refreshSession: (request: {
    refresh_token: string;
  }) => Promise<SupabaseResult<{ session: SupabaseAuthSession | null }>>;
  signOut: () => Promise<SupabaseResult<Record<string, never>>>;
};

export type MobileSupabaseFunctionsClient = {
  invoke: <TData>(
    functionName: string,
    options: { body: Record<string, unknown> },
  ) => Promise<SupabaseResult<TData>>;
};

export type MobileSupabaseClient = {
  auth: MobileSupabaseAuthClient;
  functions: MobileSupabaseFunctionsClient;
};

export type MobileAuthRepositoryDependencies = {
  appleProvider: AppleCredentialProvider;
  supabase: MobileSupabaseClient;
};

export type MobileAuthRepository = {
  restoreSession: () => Promise<MobileAuthState>;
  getCurrentAuthState: () => Promise<MobileAuthState>;
  signInWithApple: () => Promise<MobileAuthState>;
  redeemClaimCode: (code: string) => Promise<MobileAuthState>;
  signOut: () => Promise<MobileAuthState>;
  deleteCurrentAccount: () => Promise<MobileAuthState>;
};

type ExpoProcess = {
  env?: Record<string, string | undefined>;
};

declare const process: ExpoProcess | undefined;

export type MobileSupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getMobileSupabaseConfig(
  env: Record<string, string | undefined> = process?.env ?? {},
): MobileSupabaseConfig {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env vars are missing: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createMobileSupabaseClient(
  config = getMobileSupabaseConfig(),
): MobileSupabaseClient {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  return {
    auth: {
      getSession: () => client.auth.getSession(),
      signInWithIdToken: (request) => client.auth.signInWithIdToken(request),
      linkAppleWithIdToken: async (request) => {
        const result = await client.auth.signInWithIdToken(request);
        const linkedUserId = result.data.session?.user.id;

        if (!result.error && linkedUserId && linkedUserId !== request.currentUserId) {
          return {
            data: result.data,
            error: new Error("Apple link returned a different user_id"),
          };
        }

        return result;
      },
      refreshSession: (request) => client.auth.refreshSession(request),
      signOut: async () => {
        const { error } = await client.auth.signOut();

        return { data: {}, error };
      },
    },
    functions: {
      invoke: async <TData,>(
        functionName: string,
        options: { body: Record<string, unknown> },
      ) => {
        const { data, error } = await client.functions.invoke(
          functionName,
          options,
        );

        return { data: data as TData, error };
      },
    },
  };
}

export function createSupabaseAuthRepository({
  appleProvider,
  supabase,
}: MobileAuthRepositoryDependencies): MobileAuthRepository {
  async function readCurrentSession(): Promise<SupabaseAuthSession | null> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  }

  function mapSession(sessionValue: SupabaseAuthSession | null): MobileAuthState {
    if (!sessionValue) {
      return { kind: "idle" };
    }

    if (sessionValue.user.is_anonymous === false) {
      return { kind: "linkedApple", userId: sessionValue.user.id };
    }

    return { kind: "anonymous", userId: sessionValue.user.id };
  }

  function mapRequiredSession(
    sessionValue: SupabaseAuthSession | null,
    operationName: string,
  ): MobileAuthState {
    if (!sessionValue) {
      throw new Error(`${operationName} returned no session`);
    }

    return mapSession(sessionValue);
  }

  async function restoreSession(): Promise<MobileAuthState> {
    return mapSession(await readCurrentSession());
  }

  async function authenticateWithApple(
    credential: AppleCredential,
    currentState: MobileAuthState,
  ): Promise<SupabaseResult<{ session: SupabaseAuthSession | null }>> {
    const request = {
      provider: "apple" as const,
      token: credential.idToken,
      nonce: credential.nonce || undefined,
    };

    if (currentState.kind === "anonymous") {
      return supabase.auth.linkAppleWithIdToken({
        ...request,
        currentUserId: currentState.userId,
      });
    }

    return supabase.auth.signInWithIdToken(request);
  }

  return {
    restoreSession,
    getCurrentAuthState: restoreSession,
    signInWithApple: async () => {
      const [credential, currentState] = await Promise.all([
        appleProvider.requestAppleCredential(),
        restoreSession(),
      ]);
      const result = await authenticateWithApple(credential, currentState);

      if (result.error) {
        throw result.error;
      }

      const nextState = mapRequiredSession(
        result.data.session,
        "Apple sign-in",
      );

      if (nextState.kind !== "linkedApple") {
        throw new Error("Apple sign-in did not return a Linked-Apple session");
      }

      return nextState;
    },
    redeemClaimCode: async (code) => {
      const currentState = await restoreSession();

      if (currentState.kind !== "idle") {
        throw new Error("Claim codes can only be redeemed before sign-in");
      }

      const trimmedCode = code.trim();

      if (!trimmedCode) {
        throw new Error("Claim code is required");
      }

      const redeemResult = await supabase.functions.invoke<{
        refresh_token?: string;
        user_id?: string;
      }>("redeem-claim-code", {
        body: { code: trimmedCode },
      });

      if (redeemResult.error) {
        throw redeemResult.error;
      }

      const refreshToken = redeemResult.data.refresh_token;

      if (!refreshToken) {
        throw new Error("Claim-code redeem returned no refresh token");
      }

      const refreshResult = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshResult.error) {
        throw refreshResult.error;
      }

      const nextState = mapRequiredSession(
        refreshResult.data.session,
        "Claim-code session install",
      );

      if (nextState.kind !== "anonymous") {
        throw new Error("Claim-code redeem did not install an Anonymous session");
      }

      return nextState;
    },
    signOut: async () => {
      const result = await supabase.auth.signOut();

      if (result.error) {
        throw result.error;
      }

      return { kind: "idle" };
    },
    deleteCurrentAccount: async () => {
      const result = await supabase.functions.invoke("delete-user", {
        body: {},
      });

      if (result.error) {
        throw result.error;
      }

      const signOutResult = await supabase.auth.signOut();

      if (signOutResult.error) {
        throw signOutResult.error;
      }

      return { kind: "idle" };
    },
  };
}
