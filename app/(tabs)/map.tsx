import MapView from "@/components/MapView";
import { useAppData } from "@/stores";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const {
    events: calendarEvents,
    activeCalendarUsers,
    isLoading,
    error,
  } = useAppData();

  if (isLoading) {
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
        <Text>Loading map...</Text>
      </View>
    );
  }

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
      <MapView events={calendarEvents} users={activeCalendarUsers} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
