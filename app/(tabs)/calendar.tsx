import CalendarView from "@/components/CalendarView";
import { useApp } from "@/contexts/AppContext";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    calendarEvents,
    users,
    calendarDate,
    setCalendarDate,
    detailDrawerDate,
    setDetailDrawerDate,
    setIsSidebarOpen,
    setIsSearchOpen,
    activeCalendar,
    setEventToEdit,
  } = useApp();

  const handleStartEdit = (event: any) => {
    setEventToEdit(event);
    router.push("/create");
  };

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
