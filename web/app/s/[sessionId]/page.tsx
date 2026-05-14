// GetToIt web — /s/<sessionId> route.
//
// The active web session. Anonymous auth, member-row insert, quiz,
// Waiting, and read-only Verdict all live inside the client-side
// `SessionRoom` orchestrator. The page itself is a thin shell.

import { SessionRoom } from "../../../components/SessionRoom";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GetToIt — Session",
  description: "Answer 5 questions, see the verdict.",
};

export default function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
      }}
    >
      <SessionRoom roomId={params.sessionId} />
    </main>
  );
}
