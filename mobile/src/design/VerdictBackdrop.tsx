import { StyleSheet, View } from "react-native";

export function VerdictBackdrop() {
  return (
    <>
      <View pointerEvents="none" style={styles.sunGlow} />
      <View pointerEvents="none" style={styles.emberGlow} />
    </>
  );
}

const styles = StyleSheet.create({
  sunGlow: {
    position: "absolute",
    right: -54,
    top: -64,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: "rgba(255,210,63,0.18)",
  },
  emberGlow: {
    position: "absolute",
    left: -84,
    bottom: 96,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,122,61,0.12)",
  },
});
