import FeedView from "@/components/FeedView";
import { useWorkspaceScheduleFeed } from "@/services/queries";
import { useAppData, useAppStore } from "@/stores";
import { Schedule, User } from "@/types";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FeedScreen() {
  const router = useRouter();
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
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <Text>피드를 불러오는 중 오류가 발생했습니다: {error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FeedView
        schedules={feedSchedules}
        users={users as unknown as User[]}
        currentUser={currentUser}
        onEventSelect={handleEventSelect}
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
