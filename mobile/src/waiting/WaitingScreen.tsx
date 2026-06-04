import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTokens } from "../design/tokens";
import type {
  WaitingRepository,
  WaitingSnapshot,
} from "./waitingRepository";

type WaitingScreenProps = {
  isInitiator: boolean;
  onSessionEnded: () => void;
  onVerdictReady: () => void;
  repository: WaitingRepository;
  roomId: string;
};

export function WaitingScreen({
  isInitiator,
  onSessionEnded,
  onVerdictReady,
  repository,
  roomId,
}: WaitingScreenProps) {
  const [snapshot, setSnapshot] = useState<WaitingSnapshot | null>(null);
  const [isClosingVoting, setIsClosingVoting] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    repository.loadSnapshot(roomId).then((nextSnapshot) => {
      if (!isCurrent) {
        return;
      }

      setSnapshot(nextSnapshot);
      routeSnapshot(nextSnapshot, onVerdictReady, onSessionEnded);
    });

    return () => {
      isCurrent = false;
    };
  }, [onSessionEnded, onVerdictReady, repository, roomId]);

  const handleCloseVoting = async () => {
    setIsClosingVoting(true);

    try {
      const nextSnapshot = await repository.fireVerdict({ roomId });
      setSnapshot(nextSnapshot);
      routeSnapshot(nextSnapshot, onVerdictReady, onSessionEnded);
    } finally {
      setIsClosingVoting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>Waiting</Text>
      <Text style={styles.title}>Waiting for the group</Text>
      <Text style={styles.subtitle}>
        The verdict opens as soon as voting closes.
      </Text>
      <View style={styles.memberStack}>
        {(snapshot?.members ?? []).map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <Text style={styles.memberName}>{member.displayName}</Text>
            <Text style={styles.memberStatus}>
              {member.quizSubmitted ? "Submitted" : "Still answering"}
            </Text>
          </View>
        ))}
      </View>
      {isInitiator ? (
        <Pressable
          accessibilityRole="button"
          disabled={isClosingVoting}
          onPress={handleCloseVoting}
          style={[styles.primaryButton, isClosingVoting && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonLabel}>Close voting</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function routeSnapshot(
  snapshot: WaitingSnapshot,
  onVerdictReady: () => void,
  onSessionEnded: () => void,
) {
  if (snapshot.status === "verdictReady") {
    onVerdictReady();
  }

  if (snapshot.status === "sessionEnded") {
    onSessionEnded();
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[8],
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  memberStack: {
    gap: mobileTokens.spacing[3],
  },
  memberRow: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: 12,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  memberName: {
    color: mobileTokens.color.paper,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  memberStatus: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: 999,
    minHeight: 56,
    justifyContent: "center",
    marginTop: mobileTokens.spacing[4],
    paddingHorizontal: mobileTokens.spacing[4],
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonLabel: {
    color: mobileTokens.color.ink,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
