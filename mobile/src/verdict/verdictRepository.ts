export type VerdictFlavor = "group" | "solo";

export type LiveVerdictReceipt = {
  id: string;
  name: string;
  action: string;
};

export type LiveVerdictViewModel = {
  roomId: string;
  flavor: VerdictFlavor;
  placeName: string;
  metaLine: string;
  ruleText: string;
  timeBadge: {
    time: string;
    audience: string;
  };
  receipts: LiveVerdictReceipt[];
  primaryActionLabel: string;
};

export type VerdictRepository = {
  loadLiveVerdict: (input: {
    roomId: string;
    flavor: VerdictFlavor;
  }) => Promise<LiveVerdictViewModel>;
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
};

type SupabaseVerdictRow = {
  id: string;
  room_id: string;
  option_id: string | null;
  computed_at: string;
  method: string;
  rule_text: string;
};

type SupabaseOptionRow = {
  id: string;
  payload: {
    name?: string;
    categories?: string[];
    price_tier?: number;
    walk_minutes_estimate?: number;
  };
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

export const fakeVerdictRepository: VerdictRepository = {
  loadLiveVerdict: async ({ roomId, flavor }) => ({
    roomId,
    flavor,
    placeName: "Pico's Taqueria",
    metaLine: "Mexican - $$ - 8 min walk",
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
  }),
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

function metaLineForOption(option: SupabaseOptionRow): string {
  const payload = option.payload;
  const parts = [
    payload.categories?.[0],
    typeof payload.price_tier === "number"
      ? dollarsForTier(payload.price_tier)
      : null,
    typeof payload.walk_minutes_estimate === "number"
      ? `${payload.walk_minutes_estimate} min walk`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" - ");
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

export function createSupabaseVerdictRepository({
  supabase,
}: {
  supabase: VerdictSupabaseClient;
}): VerdictRepository {
  return {
    loadLiveVerdict: async ({ roomId, flavor }) => {
      const verdictRows = assertSupabaseRows(
        await supabase
          .from<SupabaseVerdictRow>("verdicts")
          .select("id, room_id, option_id, computed_at, method, rule_text")
          .eq("room_id", roomId)
          .order("computed_at", { ascending: false }),
        "Verdict read",
      );
      const verdict = latestVerdict(verdictRows);

      if (!verdict?.option_id) {
        throw new Error("Verdict read failed: no winning option");
      }

      const optionRows = assertSupabaseRows(
        await supabase
          .from<SupabaseOptionRow>("options")
          .select("id, payload")
          .eq("id", verdict.option_id),
        "Verdict option read",
      );
      const option = optionRows[0];

      if (!option) {
        throw new Error("Verdict option read failed: no row returned");
      }

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

      return {
        roomId,
        flavor,
        placeName: option.payload.name ?? "Unnamed",
        metaLine: metaLineForOption(option),
        ruleText: verdict.rule_text,
        timeBadge: {
          time: "7:00 PM",
          audience: audienceCopy(memberRows.length, flavor),
        },
        receipts: receiptsFor(memberRows, voteRows, flavor),
        primaryActionLabel:
          flavor === "solo" ? "Save taste profile" : "I'm in",
      };
    },
  };
}
