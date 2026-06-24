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

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({
  params,
}: SessionPageProps) {
  const { sessionId } = await params;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
      }}
    >
      <SessionRoom roomId={sessionId} />
    </main>
  );
}
