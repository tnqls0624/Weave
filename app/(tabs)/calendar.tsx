import CalendarView from "@/components/CalendarView";
import { useAppData, useAppStore } from "@/stores";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    calendarDate,
    setCalendarDate,
    detailDrawerDate,
    setDetailDrawerDate,
    setIsSidebarOpen,
    setIsSearchOpen,
    setScheduleToEdit,
  } = useAppStore();

  const { schedules, users, currentUser, activeWorkspace, isLoading, error } =
    useAppData();

  // setCalendarDate를 useCallback으로 메모이제이션
  const handleSetCalendarDate = useCallback(
    (date: Date) => {
      setCalendarDate(date);
    },
    [setCalendarDate]
  );

  // setDetailDrawerDate를 useCallback으로 메모이제이션
  const handleSetDetailDrawerDate = useCallback(
    (date: Date | null) => {
      setDetailDrawerDate(date);
    },
    [setDetailDrawerDate]
  );

  const handleStartEdit = useCallback(
    (schedule: any) => {
      setScheduleToEdit(schedule);
      router.push("/create");
    },
    [setScheduleToEdit, router]
  );

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, [setIsSidebarOpen]);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, [setIsSearchOpen]);

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
        <ActivityIndicator size="large" color="#007AFF" />
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
        <Text>Error loading calendar: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CalendarView
        schedules={schedules || []}
        users={users || []}
        activeCalendarName={activeWorkspace?.name || ""}
        currentUser={currentUser}
        currentDate={calendarDate}
        setCurrentDate={handleSetCalendarDate}
        selectedDate={detailDrawerDate}
        setSelectedDate={handleSetDetailDrawerDate}
        onStartEdit={handleStartEdit}
        onOpenSidebar={handleOpenSidebar}
        onOpenSearch={handleOpenSearch}
      />

      {/* Floating Action Button */}
      <Pressable
        style={[styles.fab, { bottom: 80 + insets.bottom }]}
        onPress={() => router.push("/create")}
        android_ripple={{ color: "rgba(255, 255, 255, 0.3)" }}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    backgroundColor: "#007AFF",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
