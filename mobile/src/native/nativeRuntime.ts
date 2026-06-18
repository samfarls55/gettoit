import * as AppleAuthentication from "expo-apple-authentication";
import { Linking, Share } from "react-native";

import type { AppleCredentialProvider } from "../auth/authRepository";
import {
  createMobileSupabaseClient,
  createSupabaseAuthRepository,
  type MobileSupabaseClient,
} from "../auth/authRepository";
import {
  createGroupInviteUrl,
  resolveInviteLink,
  type InviteRoomState,
} from "../invites/inviteLinks";
import {
  createSupabasePlanRepository,
  type PlanRepository,
  type PlanSupabaseClient,
} from "../plans/planRepository";
import { logDevRunEvent, shouldRequestDevRunTrace } from "./devRunLogger";
import {
  createSupabaseQ5CandidateRepository,
  type Q5CandidateRepository,
  type Q5SupabaseClient,
} from "../quiz/q5CandidateRepository";
import {
  createSupabaseQuizProgressRepository,
  type QuizProgressRepository,
  type QuizProgressSupabaseClient,
} from "../quiz/quizProgressRepository";
import {
  createSupabaseQuizSubmissionRepository,
  type QuizSubmissionRepository,
  type QuizSubmissionSupabaseClient,
} from "../quiz/quizSubmissionRepository";
import {
  createSupabaseVerdictRepository,
  type VerdictRepository,
  type VerdictSupabaseClient,
} from "../verdict/verdictRepository";
import {
  createSupabaseWaitingRepository,
  type WaitingRepository,
  type WaitingSupabaseClient,
} from "../waiting/waitingRepository";

const defaultInviteBaseUrl = "https://gettoit.app";

type ExpoProcess = {
  env?: Record<string, string | undefined>;
};

type NativeInviteRoomRow = {
  id: string;
  status: string;
};

type NativeInviteRoomQuery = PromiseLike<{
  data: NativeInviteRoomRow[] | null;
  error: Error | null;
}> & {
  select: (columns: string) => NativeInviteRoomQuery;
  eq: (column: string, value: unknown) => NativeInviteRoomQuery;
};

type JoinRoomSmartResult = {
  status?: "joined" | "already_member" | "read_only";
  room_status?: string;
  error?: "room_not_found" | "unauthenticated" | string;
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

function createRuntimeAuthRepository(
  supabase = createMobileSupabaseClient(),
) {
  return createSupabaseAuthRepository({
    appleProvider: appleCredentialProvider,
    supabase,
  });
}

async function requireLinkedAppleSession(
  supabase: MobileSupabaseClient,
  operationName: string,
) {
  const authState = await createRuntimeAuthRepository(supabase)
    .getCurrentAuthState();

  if (authState.kind !== "linkedApple") {
    throw new Error(`${operationName} requires a Linked-Apple session`);
  }

  return authState;
}

async function createRuntimePlanRepository() {
  const supabase = createMobileSupabaseClient();
  const authState = await requireLinkedAppleSession(supabase, "Plans");

  return createSupabasePlanRepository({
    logEvent: logDevRunEvent,
    supabase: supabase as PlanSupabaseClient,
    userId: authState.userId,
  });
}

function createRuntimeVerdictRepository() {
  return createSupabaseVerdictRepository({
    logEvent: logDevRunEvent,
    supabase: createMobileSupabaseClient() as VerdictSupabaseClient,
  });
}

function createRuntimeQ5CandidateRepository() {
  return createSupabaseQ5CandidateRepository({
    logEvent: logDevRunEvent,
    shouldRequestDebugTrace: shouldRequestDevRunTrace,
    supabase: createMobileSupabaseClient() as Q5SupabaseClient,
  });
}

async function createRuntimeQuizProgressRepository() {
  const supabase = createMobileSupabaseClient();
  const authState = await requireLinkedAppleSession(supabase, "Quiz progress");

  return createSupabaseQuizProgressRepository({
    logEvent: logDevRunEvent,
    supabase: supabase as QuizProgressSupabaseClient,
    userId: authState.userId,
  });
}

async function createRuntimeQuizSubmissionRepository() {
  const supabase = createMobileSupabaseClient();
  const authState = await requireLinkedAppleSession(supabase, "Quiz submit");

  return createSupabaseQuizSubmissionRepository({
    logEvent: logDevRunEvent,
    supabase: supabase as QuizSubmissionSupabaseClient,
    userId: authState.userId,
  });
}

async function createRuntimeWaitingRepository() {
  const supabase = createMobileSupabaseClient();
  const authState = await requireLinkedAppleSession(supabase, "Waiting room");

  return createSupabaseWaitingRepository({
    logEvent: logDevRunEvent,
    supabase: supabase as WaitingSupabaseClient,
    userId: authState.userId,
  });
}

function inviteRoomStateForStatus(
  roomId: string,
  status: string | undefined,
): InviteRoomState {
  switch (status) {
    case "verdict_ready":
    case "locked":
      return { kind: "decided", roomId };
    case "expired":
      return { kind: "stale", roomId };
    case "firing":
      return { kind: "waiting", roomId };
    case "open":
    default:
      return { kind: "inProgress", roomId };
  }
}

async function loadInviteRoomState(
  supabase: MobileSupabaseClient,
  roomId: string,
): Promise<InviteRoomState> {
  const result = await (supabase.from<NativeInviteRoomRow>(
    "rooms",
  ) as NativeInviteRoomQuery)
    .select("id, status")
    .eq("id", roomId);

  if (result.error) {
    throw new Error(`Invite room read failed: ${result.error.message}`);
  }

  const room = result.data?.[0];
  return room ? inviteRoomStateForStatus(roomId, room.status) : { kind: "stale", roomId };
}

async function lookupInviteRoom(roomId: string): Promise<InviteRoomState> {
  const supabase = createMobileSupabaseClient();
  await requireLinkedAppleSession(supabase, "Invite links");

  const result = await supabase.rpc<JoinRoomSmartResult>("join_room_smart", {
    p_room_id: roomId,
  });

  if (result.error) {
    throw new Error(`Invite join failed: ${result.error.message}`);
  }

  if (result.data?.error) {
    return { kind: "stale", roomId };
  }

  if (result.data?.status === "read_only") {
    return inviteRoomStateForStatus(roomId, result.data.room_status);
  }

  return loadInviteRoomState(supabase, roomId);
}

export const nativeAuthBoundary = {
  restoreSession: async () => createRuntimeAuthRepository().restoreSession(),
  deleteCurrentAccount: async () =>
    createRuntimeAuthRepository().deleteCurrentAccount(),
  signInWithApple: async () =>
    createRuntimeAuthRepository().signInWithApple(),
  signInWithDevPassword: async (request: {
    email: string;
    password: string;
  }) => createRuntimeAuthRepository().signInWithDevPassword(request),
  redeemClaimCode: async (code: string) =>
    createRuntimeAuthRepository().redeemClaimCode(code),
  signOut: async () => createRuntimeAuthRepository().signOut(),
};

export const nativeInviteBoundary = {
  createGroupInviteLink: async (plan: { id: string; roomId?: string }) =>
    createGroupInviteUrl({
      baseUrl: inviteBaseUrl(),
      roomId: plan.roomId ?? plan.id,
    }),
  resolveInviteLink: async (url: string) =>
    resolveInviteLink(url, lookupInviteRoom),
  shareInviteLink: async (url: string) => {
    await Share.share({ url, message: url });
  },
};

export const nativePlanRepository: PlanRepository = {
  listPlans: async () => (await createRuntimePlanRepository()).listPlans(),
  savePlan: async (plan) =>
    (await createRuntimePlanRepository()).savePlan(plan),
  launchPlan: async (plan) =>
    (await createRuntimePlanRepository()).launchPlan(plan),
  deletePlan: async (input) =>
    (await createRuntimePlanRepository()).deletePlan(input),
};

export const nativeQ5CandidateRepository: Q5CandidateRepository = {
  loadCandidates: async (input) =>
    createRuntimeQ5CandidateRepository().loadCandidates(input),
};

export const nativeQuizProgressRepository: QuizProgressRepository = {
  loadProgress: async (roomId) =>
    (await createRuntimeQuizProgressRepository()).loadProgress(roomId),
  saveProgress: async (progress) =>
    (await createRuntimeQuizProgressRepository()).saveProgress(progress),
  exitPlan: async (input) =>
    (await createRuntimeQuizProgressRepository()).exitPlan(input),
};

export const nativeQuizSubmissionRepository: QuizSubmissionRepository = {
  submitQuiz: async (payload) =>
    (await createRuntimeQuizSubmissionRepository()).submitQuiz(payload),
};

export const nativeWaitingRepository: WaitingRepository = {
  loadSnapshot: async (roomId) =>
    (await createRuntimeWaitingRepository()).loadSnapshot(roomId),
  fireVerdict: async (input) =>
    (await createRuntimeWaitingRepository()).fireVerdict(input),
};

export const nativeVerdictRepository: VerdictRepository = {
  loadVerdict: async (input) =>
    createRuntimeVerdictRepository().loadVerdict(input),
  loadHistoryVerdict: async (input) =>
    createRuntimeVerdictRepository().loadHistoryVerdict(input),
  reroll: async (input) => createRuntimeVerdictRepository().reroll(input),
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
