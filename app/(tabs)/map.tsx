import NaverMapView from "@/components/NaverMapView";
import { useAppData } from "@/stores";
import { Schedule, User } from "@/types";
import { useIsFocused } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MapScreen() {
  const isFocused = useIsFocused(); // 현재 탭이 활성화되어 있는지 체크
  const { schedules, activeWorkspaceUsers, error } = useAppData();

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <Text>Error loading map: {error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <NaverMapView
        users={activeWorkspaceUsers as unknown as User[]}
        schedules={schedules as unknown as Schedule[]}
        isActive={isFocused}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
});
