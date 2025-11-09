import FeedView from "@/components/FeedView";
import { useWorkspaceScheduleFeed } from "@/services/queries";
import { useAppData, useAppStore } from "@/stores";
import { Schedule, User } from "@/types";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setCalendarDate, setDetailDrawerDate, activeWorkspaceId } =
    useAppStore();
  const { users, currentUser, isLoading: appDataLoading, error } = useAppData();

  const { data: feedSchedules = [], isLoading: feedLoading } =
    useWorkspaceScheduleFeed(activeWorkspaceId, {
      enabled: !!activeWorkspaceId,
    });

  const handleEventSelect = (schedule: Schedule) => {
    const eventDate = dayjs(schedule.startDate).toDate();
    setCalendarDate(eventDate);
    setDetailDrawerDate(eventDate);
    router.push("/(tabs)/calendar");
  };

  if (appDataLoading || feedLoading) {
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
        schedules={feedSchedules}
        users={users as unknown as User[]}
        currentUser={currentUser}
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
