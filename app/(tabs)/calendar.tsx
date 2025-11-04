import CalendarView from "@/components/CalendarView";
import { useAppData, useAppStore } from "@/stores";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
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
    setEventToEdit,
  } = useAppStore();

  const {
    events: calendarEvents,
    users,
    activeCalendar,
    isLoading,
    error,
  } = useAppData();

  const handleStartEdit = (event: any) => {
    setEventToEdit(event);
    router.push("/create");
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
        <Text>Loading calendar...</Text>
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
        events={calendarEvents}
        users={users}
        currentDate={calendarDate}
        setCurrentDate={setCalendarDate}
        selectedDate={detailDrawerDate}
        setSelectedDate={setDetailDrawerDate}
        onStartEdit={handleStartEdit}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        activeCalendarName={activeCalendar.name}
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
