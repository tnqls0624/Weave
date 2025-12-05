import CreateScheduleView from "@/components/CreateScheduleView";
import { apiService } from "@/services/api";
import {
  useAppData,
  useAppStore,
  useCreateSchedule,
  useUpdateSchedule,
} from "@/stores";
import { User } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function CreateScreen() {
  const router = useRouter();
  const { scheduleId } = useLocalSearchParams<{ scheduleId?: string }>();
  const {
    scheduleToEdit,
    setScheduleToEdit,
    activeWorkspaceId,
    detailDrawerDate,
  } = useAppStore();
  const { users, schedules, currentUser, isLoading, error } = useAppData();
  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  const handleSetActiveView = (view: string) => {
    if (view !== "create") {
      setScheduleToEdit(null);
      router.back();
    }
  };

  // Find schedule to edit if scheduleId is provided
  const schedule = scheduleId
    ? schedules.find((s: any) => s.id === scheduleId) || null
    : scheduleToEdit;

  const handleSave = async (scheduleData: any, id?: string) => {
    try {
      // locationReminder와 checklist 데이터 분리
      const { locationReminder, checklist, ...coreScheduleData } = scheduleData;

      let savedScheduleId: string;

      if (id) {
        // Update existing schedule
        await updateScheduleMutation.mutateAsync({
          scheduleId: id,
          scheduleData: coreScheduleData,
        });
        savedScheduleId = id;
      } else {
        // Create new schedule
        const createdSchedule = await createScheduleMutation.mutateAsync({
          ...coreScheduleData,
          workspace: activeWorkspaceId,
        });
        savedScheduleId = createdSchedule.id;
      }

      // LocationReminder 저장/삭제
      if (locationReminder && locationReminder.isEnabled) {
        await apiService.setLocationReminder(savedScheduleId, {
          latitude: locationReminder.latitude,
          longitude: locationReminder.longitude,
          radius: locationReminder.radius,
          address: locationReminder.address,
          placeName: locationReminder.placeName,
        });
      } else if (id) {
        // 수정 시 기존 위치 알림이 있었는데 삭제한 경우
        try {
          await apiService.deleteLocationReminder(savedScheduleId);
        } catch (e) {
          // 기존에 없었으면 무시
        }
      }

      // Checklist 저장 (새로 추가된 항목들)
      if (checklist && checklist.length > 0) {
        for (const item of checklist) {
          // 임시 ID(temp-)로 시작하는 항목은 새로 추가
          if (item.id.startsWith("temp-")) {
            await apiService.addChecklistItem(savedScheduleId, item.content);
          }
        }
      }

      setScheduleToEdit(null);
      router.back();
    } catch (error) {
      console.error("Failed to save schedule:", error);
      // 에러 처리 로직 추가 가능
    }
  };

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CreateScheduleView
        onSave={handleSave}
        users={users as unknown as User[]}
        currentUser={currentUser as User}
        setActiveView={handleSetActiveView}
        scheduleToEdit={schedule || null}
        initialDate={detailDrawerDate}
        existingSchedules={schedules}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
