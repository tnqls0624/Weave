import CalendarView from "@/components/CalendarView";
import { apiService } from "@/services/api";
import locationWebSocketService from "@/services/locationWebSocketService";
import { useAppData, useAppStore } from "@/stores";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
    activeWorkspaceId,
  } = useAppStore();

  const { schedules, users, currentUser, activeWorkspace, isLoading, error } =
    useAppData();

  // 위치 데이터 프리페치 (지도 탭 진입 시 빠른 로딩을 위해)
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const prefetchLocationData = async () => {
      try {
        console.log("📍 [Prefetch] Prefetching location data for map tab...");

        // 1. REST API로 위치 데이터 미리 가져오기
        const startTime = Date.now();
        await apiService.getWorkspaceUserLocations(activeWorkspaceId);
        const elapsed = Date.now() - startTime;
        console.log(`✅ [Prefetch] Location data fetched (${elapsed}ms)`);

        // 2. WebSocket 연결 미리 설정 (연결만 하고 구독은 지도 탭에서)
        if (!locationWebSocketService.isConnected()) {
          console.log("📡 [Prefetch] Pre-connecting WebSocket...");
          await locationWebSocketService.connect();
          console.log("✅ [Prefetch] WebSocket connected");
        }
      } catch (error) {
        console.error("❌ [Prefetch] Failed to prefetch location data:", error);
        // 에러 발생해도 무시 (지도 탭에서 다시 시도할 것임)
      }
    };

    // 약간의 지연을 두고 프리페치 (캘린더 렌더링 우선)
    const timeoutId = setTimeout(prefetchLocationData, 500);

    return () => clearTimeout(timeoutId);
  }, [activeWorkspaceId]);

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
    async (schedule: any) => {
      try {
        // 개별 일정 API 호출하여 locationReminder, checklist 포함된 전체 데이터 가져오기
        const fullSchedule = await apiService.getSchedule(schedule.id);
        setScheduleToEdit(fullSchedule);
        router.push("/create");
      } catch (error) {
        console.error("Failed to fetch schedule details:", error);
        // 실패 시 기존 데이터로 fallback
        setScheduleToEdit(schedule);
        router.push("/create");
      }
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
        activeCalendarName={activeWorkspace?.title || ""}
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
