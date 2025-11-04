import FeedView from "@/components/FeedView";
import { useAppData, useAppStore } from "@/stores";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setCalendarDate, setDetailDrawerDate } = useAppStore();
  const { events: calendarEvents, users, isLoading, error } = useAppData();

  const handleEventSelect = (event: any) => {
    const eventDate = new Date(event.startDate + "T00:00:00");
    setCalendarDate(eventDate);
    setDetailDrawerDate(eventDate);
    router.push("/(tabs)/calendar");
  };

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
        <Text>Loading feed...</Text>
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
        <Text>Error loading feed: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FeedView
        events={calendarEvents}
        users={users}
        onEventSelect={handleEventSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
});
