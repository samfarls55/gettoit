import { StyleSheet, View } from "react-native";

export function VerdictBackdrop() {
  return (
    <>
      <View style={styles.topHighlight} />
      <View style={styles.leftRail} />
      <View style={styles.bottomRule} />
    </>
  );
}

const styles = StyleSheet.create({
  topHighlight: {
    backgroundColor: "rgba(212,175,55,0.08)",
    height: 112,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  leftRail: {
    backgroundColor: "rgba(255,183,123,0.10)",
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: 1,
  },
  bottomRule: {
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: 96,
    height: 1,
    left: 24,
    pointerEvents: "none",
    position: "absolute",
    right: 24,
  },
});
