import BottomNav from "@/components/BottomNav";
import SearchView from "@/components/SearchView";
import Sidebar from "@/components/Sidebar";
import { useAppData, useAppStore } from "@/stores";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function TabLayout() {
  const router = useRouter();
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isSearchOpen,
    setIsSearchOpen,
    activeWorkspaceId,
    handleSelectWorkspace,
    setCalendarDate,
    setDetailDrawerDate,
  } = useAppStore();

  const { workspaces, currentUser, users, schedules } = useAppData();

  const handleEventSelect = (event: any) => {
    const eventDate = new Date(event.startDate + "T00:00:00");
    setCalendarDate(eventDate);
    setDetailDrawerDate(eventDate);
    setIsSearchOpen(false);
    router.push("/(tabs)/calendar");
  };

  return (
    <Sidebar
      isOpen={isSidebarOpen}
      onClose={() => setIsSidebarOpen(false)}
      calendars={workspaces || []} // API에서 가져온 workspaces 데이터
      activeCalendarId={activeWorkspaceId}
      onSelectCalendar={handleSelectWorkspace}
      currentUser={
        currentUser ||
        (users && users.length > 0
          ? users[0]
          : ({
              id: "user1",
              name: "You",
              avatarUrl: "https://i.pravatar.cc/150?u=user1",
              color: "blue",
            } as any))
      }
    >
      <View style={styles.container}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" }, // Hide default tab bar, use custom BottomNav
          }}
          initialRouteName="feed"
        >
          <Tabs.Screen name="feed" />
          <Tabs.Screen name="calendar" />
          <Tabs.Screen name="map" />
          <Tabs.Screen name="settings" />
        </Tabs>

        <SearchView
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          events={schedules || []}
          onScheduleSelect={handleEventSelect}
        />

        {!isSidebarOpen && <BottomNav />}
      </View>
    </Sidebar>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
