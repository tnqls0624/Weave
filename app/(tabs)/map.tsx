import NaverMapView from "@/components/NaverMapView";
import { useAppData } from "@/stores";
import { Schedule, User } from "@/types";
import { useIsFocused } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused(); // 현재 탭이 활성화되어 있는지 체크
  const { schedules, activeWorkspaceUsers, error } = useAppData();

  if (error) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text>Error loading map: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NaverMapView
        users={activeWorkspaceUsers as unknown as User[]}
        schedules={schedules as unknown as Schedule[]}
        isActive={isFocused}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
