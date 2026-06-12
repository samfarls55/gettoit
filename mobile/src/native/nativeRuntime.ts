import * as AppleAuthentication from "expo-apple-authentication";
import { Linking, Share } from "react-native";

import type { AppleCredentialProvider } from "../auth/authRepository";
import {
  createMobileSupabaseClient,
  createSupabaseAuthRepository,
} from "../auth/authRepository";
import { createGroupInviteUrl } from "../invites/inviteLinks";
import {
  createSupabaseQ5CandidateRepository,
  type Q5CandidateRepository,
  type Q5SupabaseClient,
} from "../quiz/q5CandidateRepository";
import {
  createSupabaseVerdictRepository,
  type VerdictRepository,
  type VerdictSupabaseClient,
} from "../verdict/verdictRepository";

const defaultInviteBaseUrl = "https://gettoit.app";

type ExpoProcess = {
  env?: Record<string, string | undefined>;
};

declare const process: ExpoProcess | undefined;

function inviteBaseUrl(): string {
  return process?.env?.EXPO_PUBLIC_WEB_BASE_URL ?? defaultInviteBaseUrl;
}

const appleCredentialProvider: AppleCredentialProvider = {
  requestAppleCredential: async () => {
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      throw new Error("Apple Sign-In is not available on this device");
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple Sign-In returned no identity token");
    }

    return {
      idToken: credential.identityToken,
    };
  },
};

function createRuntimeAuthRepository() {
  return createSupabaseAuthRepository({
    appleProvider: appleCredentialProvider,
    supabase: createMobileSupabaseClient(),
  });
}

function createRuntimeVerdictRepository() {
  return createSupabaseVerdictRepository({
    supabase: createMobileSupabaseClient() as VerdictSupabaseClient,
  });
}

function createRuntimeQ5CandidateRepository() {
  return createSupabaseQ5CandidateRepository({
    supabase: createMobileSupabaseClient() as Q5SupabaseClient,
  });
}

export const nativeAuthBoundary = {
  restoreSession: async () => createRuntimeAuthRepository().restoreSession(),
  deleteCurrentAccount: async () =>
    createRuntimeAuthRepository().deleteCurrentAccount(),
  signInWithApple: async () =>
    createRuntimeAuthRepository().signInWithApple(),
  redeemClaimCode: async (code: string) =>
    createRuntimeAuthRepository().redeemClaimCode(code),
  signOut: async () => createRuntimeAuthRepository().signOut(),
};

export const nativeInviteBoundary = {
  createGroupInviteLink: async (plan: { id: string }) =>
    createGroupInviteUrl({
      baseUrl: inviteBaseUrl(),
      roomId: plan.id,
    }),
  resolveInviteLink: async () => {
    throw new Error("Invite resolution must be provided by the app repository");
  },
  shareInviteLink: async (url: string) => {
    await Share.share({ url, message: url });
  },
};

export const nativeQ5CandidateRepository: Q5CandidateRepository = {
  loadCandidates: async (input) =>
    createRuntimeQ5CandidateRepository().loadCandidates(input),
};

export const nativeVerdictRepository: VerdictRepository = {
  loadVerdict: async (input) =>
    createRuntimeVerdictRepository().loadVerdict(input),
  loadHistoryVerdict: async (input) =>
    createRuntimeVerdictRepository().loadHistoryVerdict(input),
  reroll: async (input) => createRuntimeVerdictRepository().reroll(input),
  widenAndRerun: async (input) =>
    createRuntimeVerdictRepository().widenAndRerun(input),
};

export const nativeLinkBoundary = {
  getInitialUrl: () => Linking.getInitialURL(),
  subscribe: (listener: (url: string) => void) => {
    const subscription = Linking.addEventListener("url", (event) => {
      listener(event.url);
    });

    return () => subscription.remove();
  },
};
