export type WaitingMemberProgress = {
  id: string;
  displayName: string;
  quizSubmitted: boolean;
};

export type WaitingSnapshotStatus =
  | "waiting"
  | "verdictReady"
  | "sessionEnded";

export type WaitingSnapshot = {
  roomId: string;
  status: WaitingSnapshotStatus;
  members: WaitingMemberProgress[];
};

export type WaitingRepository = {
  loadSnapshot: (roomId: string) => Promise<WaitingSnapshot>;
  fireVerdict: (input: { roomId: string }) => Promise<WaitingSnapshot>;
};

const fakeWaitingMembers: WaitingMemberProgress[] = [
  { id: "you", displayName: "You", quizSubmitted: true },
  { id: "morgan", displayName: "Morgan", quizSubmitted: false },
];

export const fakeWaitingRepository: WaitingRepository = {
  loadSnapshot: async (roomId) => ({
    roomId,
    status: "waiting",
    members: fakeWaitingMembers,
  }),
  fireVerdict: async (input) => ({
    roomId: input.roomId,
    status: "verdictReady",
    members: fakeWaitingMembers,
  }),
};
