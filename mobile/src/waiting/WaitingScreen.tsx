import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
    >
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
    </ScrollView>
  );
}

function routeSnapshot(
  snapshot: WaitingSnapshot,
  onVerdictReady: () => void,
  onSessionEnded: () => void,
) {
  switch (snapshot.status) {
    case "waiting":
      return;
    case "verdictReady":
      onVerdictReady();
      return;
    case "sessionEnded":
      onSessionEnded();
      return;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileTokens.color.ink,
  },
  content: {
    flexGrow: 1,
    gap: mobileTokens.spacing[4],
    padding: mobileTokens.spacing[5],
    paddingTop: mobileTokens.spacing[10],
  },
  eyebrow: {
    color: mobileTokens.color.sun,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.display,
    fontSize: mobileTokens.typography.headline.size,
    fontWeight: mobileTokens.typography.headline.weight,
    lineHeight: mobileTokens.typography.headline.lineHeight,
  },
  subtitle: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    lineHeight: mobileTokens.typography.body.lineHeight,
  },
  memberStack: {
    gap: mobileTokens.spacing[3],
  },
  memberRow: {
    backgroundColor: mobileTokens.color.surfaceContainerLow,
    borderColor: mobileTokens.color.glassStroke,
    borderRadius: mobileTokens.radius.lg,
    borderWidth: 1,
    gap: mobileTokens.spacing[3],
    padding: mobileTokens.spacing[4],
  },
  memberName: {
    color: mobileTokens.color.paper,
    fontFamily: mobileTokens.typography.family.body,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
  },
  memberStatus: {
    color: mobileTokens.color.textSecondaryOnGradient,
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.eyebrow.size,
    fontWeight: mobileTokens.typography.eyebrow.weight,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: mobileTokens.color.sun,
    borderRadius: mobileTokens.radius.md,
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
    fontFamily: mobileTokens.typography.family.label,
    fontSize: mobileTokens.typography.body.size,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
