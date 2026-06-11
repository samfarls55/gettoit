export type VerdictFlavor = "group" | "solo";
export type RerollReason = "cost" | "dist" | "mood" | "diet" | "avail";

const MAX_REROLL_BURNS = 3;

export type RerollInput = {
  roomId: string;
  reason: RerollReason;
};

export type WidenAndRerunInput = {
  roomId: string;
  radiusMiles: number;
};

export type LiveVerdictReceipt = {
  id: string;
  name: string;
  action: string;
};

export type RerollViewModel = {
  burnsRemaining: number;
  ineligibleReason: string | null;
  isEligible: boolean;
  windowClosesAt: string | null;
};

export type LiveVerdictViewModel = {
  kind: "live";
  roomId: string;
  flavor: VerdictFlavor;
  placeName: string;
  formattedAddress: string | null;
  googleMapsUri: string;
  attributionText: string;
  ruleText: string;
  timeBadge: {
    time: string;
    audience: string;
  };
  receipts: LiveVerdictReceipt[];
  primaryActionLabel: string;
  reroll: RerollViewModel;
};

export type NoSurvivorVerdictViewModel = {
  kind: "noSurvivor";
  roomId: string;
  currentRadiusMiles: number;
  maxRadiusMiles: number;
  minRadiusMiles: number;
  stepMiles: number;
};

export type HistoryVerdictViewModel = {
  kind: "history";
  roomId: string;
  planName: string;
  decidedAtLabel: string;
  display:
    | {
        status: "available";
        placeName: string;
        formattedAddress: string | null;
        googleMapsUri: string;
        attributionText: string;
      }
    | {
        status: "unavailable";
        placeName: "Place unavailable";
        details: string;
      };
};

export type VerdictViewModel =
  | LiveVerdictViewModel
  | NoSurvivorVerdictViewModel
  | HistoryVerdictViewModel;

export type VerdictRepository = {
  loadVerdict: (input: {
    roomId: string;
    flavor: VerdictFlavor;
  }) => Promise<VerdictViewModel>;
  loadHistoryVerdict: (input: {
    roomId: string;
    flavor: VerdictFlavor;
  }) => Promise<HistoryVerdictViewModel>;
  reroll: (input: RerollInput) => Promise<void>;
  widenAndRerun: (input: WidenAndRerunInput) => Promise<void>;
};

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type VerdictSupabaseQuery<TRow> = PromiseLike<
  SupabaseQueryResult<TRow[]>
> & {
  select: (columns: string) => VerdictSupabaseQuery<TRow>;
  eq: (column: string, value: unknown) => VerdictSupabaseQuery<TRow>;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => VerdictSupabaseQuery<TRow>;
};

export type VerdictSupabaseClient = {
  from: <TRow>(table: string) => VerdictSupabaseQuery<TRow>;
  functions: {
    invoke: <TData>(
      functionName: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: TData | null; error: Error | null }>;
  };
  rpc: <TData>(
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: TData | null; error: Error | null }>;
};

type SupabaseVerdictRow = {
  id: string;
  room_id: string;
  option_id: string | null;
  winner_google_place_id?: string | null;
  computed_at: string;
  method: string;
  rule_text: string;
};

type SupabasePlanHistoryRow = {
  id: string;
  name: string;
  verdict_fired_at: string | null;
  rooms?: Array<{ id: string }> | null;
};

type SupabaseVerdictSlateEntryRow = {
  verdict_id: string;
  slate_rank: number;
  google_place_id: string;
};

type LatestVerdictAndSlate = {
  verdict: SupabaseVerdictRow;
  slateRows: SupabaseVerdictSlateEntryRow[];
};

type SupabaseMemberRow = {
  user_id: string;
  display_name?: string | null;
};

type SupabaseVoteRow = {
  user_id: string;
  q2?: {
    answer?: {
      tier?: string | number;
    };
  };
  q4?: {
    answer?: {
      vibe?: string;
      level?: string | number;
    };
  };
};

type SupabaseRerollRow = {
  id: string;
  room_id: string;
};

type GoogleAttributionPayload = {
  provider: "google";
  render: "text";
  text: "Powered by Google";
};

export type GoogleVerdictDisplay = {
  place: {
    place_id: string;
    display_name: string;
    google_maps_uri: string;
    formatted_address?: string;
  };
  attribution: GoogleAttributionPayload;
};

export type VerdictSlateDisplayRefetch = (
  googlePlaceId: string,
) => Promise<GoogleVerdictDisplay | null>;

export type VerdictSlateEntry = {
  googlePlaceId: string;
  rank: number;
};

export type VerdictSlateAdvanceResult =
  | {
      status: "presented";
      entry: VerdictSlateEntry;
      display: GoogleVerdictDisplay;
      burnsUsed: number;
      skippedPlaceIds: string[];
    }
  | {
      status: "exhausted";
      burnsUsed: number;
      skippedPlaceIds: string[];
    };

export const fakeVerdictRepository: VerdictRepository = {
  loadVerdict: async ({ roomId, flavor }) => ({
    kind: "live",
    roomId,
    flavor,
    placeName: "Pico's Taqueria",
    formattedAddress: "1 Main St",
    googleMapsUri: "https://maps.google.example/picos",
    attributionText: "Powered by Google",
    ruleText: "Best fit for the table.",
    timeBadge: {
      time: "7:00 PM",
      audience: flavor === "solo" ? "" : "All 2 of you",
    },
    receipts:
      flavor === "solo"
        ? []
        : [
            { id: "ava", name: "Ava", action: "wanted social" },
            { id: "morgan", name: "Morgan", action: "wanted calm" },
          ],
    primaryActionLabel: flavor === "solo" ? "Save taste profile" : "I'm in",
    reroll: {
      burnsRemaining: 3,
      ineligibleReason: null,
      isEligible: true,
      windowClosesAt: null,
    },
  }),
  loadHistoryVerdict: async ({ roomId }) => ({
    kind: "history",
    roomId,
    planName: "Taco crawl",
    decidedAtLabel: "Decided Jun 4",
    display: {
      status: "available",
      placeName: "Pico's Taqueria",
      formattedAddress: "1 Main St",
      googleMapsUri: "https://maps.google.example/picos",
      attributionText: "Powered by Google",
    },
  }),
  reroll: async () => undefined,
  widenAndRerun: async () => undefined,
};

function assertSupabaseRows<TRow>(
  result: SupabaseQueryResult<TRow[]>,
  queryName: string,
): TRow[] {
  if (result.error) {
    throw new Error(`${queryName} failed: ${result.error.message}`);
  }

  return result.data ?? [];
}

function latestVerdict(rows: SupabaseVerdictRow[]): SupabaseVerdictRow | null {
  return [...rows].sort((left, right) =>
    right.computed_at.localeCompare(left.computed_at),
  )[0] ?? null;
}

function dollarsForTier(tier: number): string {
  return "$".repeat(Math.max(1, Math.min(tier, 4)));
}

function audienceCopy(memberCount: number, flavor: VerdictFlavor): string {
  if (flavor === "solo") {
    return "";
  }

  return `All ${memberCount} of you`;
}

function memberName(member: SupabaseMemberRow): string {
  return member.display_name?.trim() || "Someone";
}

function voteAction(vote: SupabaseVoteRow): string {
  const vibe = vote.q4?.answer?.vibe;

  if (typeof vibe === "string" && vibe.trim()) {
    return `wanted ${vibe}`;
  }

  const tier = vote.q2?.answer?.tier;
  if (typeof tier === "string" && tier.trim()) {
    return `capped at ${tier}`;
  }

  if (typeof tier === "number") {
    return `capped at ${dollarsForTier(tier)}`;
  }

  return "voted in";
}

function receiptsFor(
  members: SupabaseMemberRow[],
  votes: SupabaseVoteRow[],
  flavor: VerdictFlavor,
): LiveVerdictReceipt[] {
  if (flavor === "solo") {
    return [];
  }

  const membersByUserId = new Map(
    members.map((member) => [member.user_id, member]),
  );

  return votes.map((vote) => {
    const member = membersByUserId.get(vote.user_id);

    return {
      id: vote.user_id,
      name: member ? memberName(member) : "Someone",
      action: voteAction(vote),
    };
  });
}

function rerollStateFor(rerolls: SupabaseRerollRow[]): RerollViewModel {
  const burnsRemaining = Math.max(0, MAX_REROLL_BURNS - rerolls.length);

  return {
    burnsRemaining,
    ineligibleReason:
      burnsRemaining > 0 ? null : "No rerolls left. Tonight is locked.",
    isEligible: burnsRemaining > 0,
    windowClosesAt: null,
  };
}

function decidedAtLabel(isoTime: string | null): string {
  if (!isoTime) {
    return "Decided time unavailable";
  }

  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Decided time unavailable";
  }

  return `Decided ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function mapSlateRowsToEntries(
  rows: SupabaseVerdictSlateEntryRow[],
): VerdictSlateEntry[] {
  return rows.map((row) => ({
    googlePlaceId: row.google_place_id,
    rank: row.slate_rank,
  }));
}

export async function advanceVerdictSlate({
  slate,
  currentGooglePlaceId,
  burnsUsed,
  refetch,
}: {
  slate: VerdictSlateEntry[];
  currentGooglePlaceId: string;
  burnsUsed: number;
  refetch: VerdictSlateDisplayRefetch;
}): Promise<VerdictSlateAdvanceResult> {
  const currentIndex = slate.findIndex(
    (entry) => entry.googlePlaceId === currentGooglePlaceId,
  );
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const skippedPlaceIds: string[] = [];

  for (const entry of slate.slice(startIndex)) {
    const display = await refetch(entry.googlePlaceId);
    if (!display) {
      skippedPlaceIds.push(entry.googlePlaceId);
      continue;
    }

    return {
      status: "presented",
      entry,
      display,
      burnsUsed: burnsUsed + 1,
      skippedPlaceIds,
    };
  }

  return {
    status: "exhausted",
    burnsUsed,
    skippedPlaceIds,
  };
}

async function refetchVerdictDisplay(
  supabase: VerdictSupabaseClient,
  googlePlaceId: string,
): Promise<GoogleVerdictDisplay> {
  const { data, error } = await supabase.functions.invoke<GoogleVerdictDisplay>(
    "places-proxy",
    {
      body: {
        surface: "verdict_display",
        google_place_id: googlePlaceId,
      },
    },
  );

  if (error) {
    throw new Error(`Verdict display refetch failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Verdict display refetch failed: no display data returned");
  }

  return data;
}

export function createSupabaseVerdictRepository({
  supabase,
}: {
  supabase: VerdictSupabaseClient;
}): VerdictRepository {
  const loadLatestVerdictAndSlate = async (
    roomId: string,
  ): Promise<LatestVerdictAndSlate> => {
    const verdictRows = assertSupabaseRows(
      await supabase
        .from<SupabaseVerdictRow>("verdicts")
        .select(
          "id, room_id, option_id, winner_google_place_id, computed_at, method, rule_text",
        )
        .eq("room_id", roomId)
        .order("computed_at", { ascending: false }),
      "Verdict read",
    );
    const verdict = latestVerdict(verdictRows);

    if (!verdict) {
      throw new Error("Verdict read failed: no row returned");
    }

    if (verdict.method === "no_survivor" || !verdict.option_id) {
      return { verdict, slateRows: [] };
    }

    const slateRows = assertSupabaseRows(
      await supabase
        .from<SupabaseVerdictSlateEntryRow>("verdict_slate_entries")
        .select("verdict_id, slate_rank, google_place_id")
        .eq("verdict_id", verdict.id)
        .order("slate_rank", { ascending: true }),
      "Verdict slate read",
    );

    return {
      verdict,
      slateRows,
    };
  };

  const loadPlanHistoryContext = async (
    roomId: string,
  ): Promise<SupabasePlanHistoryRow> => {
    const rows = assertSupabaseRows(
      await supabase
        .from<SupabasePlanHistoryRow>("plans")
        .select("id, name, verdict_fired_at, rooms(id)")
        .eq("rooms.id", roomId),
      "Plan history read",
    );
    const plan = rows[0];

    if (!plan) {
      throw new Error("Plan history read failed: no row returned");
    }

    return plan;
  };

  return {
    loadVerdict: async ({ roomId, flavor }) => {
      const { verdict, slateRows } = await loadLatestVerdictAndSlate(roomId);

      if (verdict.method === "no_survivor" || !verdict.option_id) {
        return {
          kind: "noSurvivor",
          roomId,
          currentRadiusMiles: 2,
          maxRadiusMiles: 5,
          minRadiusMiles: 1,
          stepMiles: 0.5,
        };
      }

      const googlePlaceId =
        verdict.winner_google_place_id ?? slateRows[0]?.google_place_id;

      if (!googlePlaceId) {
        throw new Error("Verdict slate read failed: no Google Place ID returned");
      }
      const display = await refetchVerdictDisplay(supabase, googlePlaceId);

      const memberRows = assertSupabaseRows(
        await supabase
          .from<SupabaseMemberRow>("members")
          .select("user_id, display_name")
          .eq("room_id", roomId),
        "Verdict members read",
      );
      const voteRows = assertSupabaseRows(
        await supabase
          .from<SupabaseVoteRow>("votes")
          .select("user_id, q2, q4")
          .eq("room_id", roomId),
        "Verdict votes read",
      );
      const rerollRows = assertSupabaseRows(
        await supabase
          .from<SupabaseRerollRow>("rerolls")
          .select("id, room_id")
          .eq("room_id", roomId),
        "Verdict rerolls read",
      );

      return {
        kind: "live",
        roomId,
        flavor,
        placeName: display.place.display_name,
        formattedAddress: display.place.formatted_address ?? null,
        googleMapsUri: display.place.google_maps_uri,
        attributionText: display.attribution.text,
        ruleText: verdict.rule_text,
        timeBadge: {
          time: "7:00 PM",
          audience: audienceCopy(memberRows.length, flavor),
        },
        receipts: receiptsFor(memberRows, voteRows, flavor),
        primaryActionLabel:
          flavor === "solo" ? "Save taste profile" : "I'm in",
        reroll: rerollStateFor(rerollRows),
      };
    },
    loadHistoryVerdict: async ({ roomId }) => {
      const [plan, { verdict, slateRows }] = await Promise.all([
        loadPlanHistoryContext(roomId),
        loadLatestVerdictAndSlate(roomId),
      ]);
      const googlePlaceId =
        verdict.winner_google_place_id ?? slateRows[0]?.google_place_id;
      const base = {
        kind: "history" as const,
        roomId,
        planName: plan.name,
        decidedAtLabel: decidedAtLabel(plan.verdict_fired_at),
      };

      if (!googlePlaceId) {
        return {
          ...base,
          display: {
            status: "unavailable",
            placeName: "Place unavailable",
            details: "Unavailable details. Current place data could not be refetched.",
          },
        };
      }

      try {
        const display = await refetchVerdictDisplay(supabase, googlePlaceId);

        return {
          ...base,
          display: {
            status: "available",
            placeName: display.place.display_name,
            formattedAddress: display.place.formatted_address ?? null,
            googleMapsUri: display.place.google_maps_uri,
            attributionText: display.attribution.text,
          },
        };
      } catch {
        return {
          ...base,
          display: {
            status: "unavailable",
            placeName: "Place unavailable",
            details: "Unavailable details. Current place data could not be refetched.",
          },
        };
      }
    },
    reroll: async ({ roomId, reason }) => {
      const { verdict, slateRows } = await loadLatestVerdictAndSlate(roomId);
      const currentGooglePlaceId =
        verdict.winner_google_place_id ?? slateRows[0]?.google_place_id;

      if (!currentGooglePlaceId) {
        throw new Error("Verdict slate reroll failed: no current Google Place ID");
      }

      const rerollRows = assertSupabaseRows(
        await supabase
          .from<SupabaseRerollRow>("rerolls")
          .select("id, room_id")
          .eq("room_id", roomId),
        "Verdict rerolls read",
      );
      const advance = await advanceVerdictSlate({
        slate: mapSlateRowsToEntries(slateRows),
        currentGooglePlaceId,
        burnsUsed: rerollRows.length,
        refetch: (googlePlaceId) =>
          refetchVerdictDisplay(supabase, googlePlaceId).catch(() => null),
      });

      if (advance.status === "exhausted") {
        throw new Error("Verdict slate exhausted: start a new decision");
      }

      const { error } = await supabase.rpc("apply_verdict_slate_reroll", {
        p_room_id: roomId,
        p_google_place_id: advance.entry.googlePlaceId,
        p_reason: reason,
      });

      if (error) {
        throw new Error(`Verdict slate reroll failed: ${error.message}`);
      }
    },
    widenAndRerun: async () => undefined,
  };
}
