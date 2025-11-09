import CreateScheduleView from "@/components/CreateScheduleView";
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
      if (id) {
        // Update existing schedule
        await updateScheduleMutation.mutateAsync({
          scheduleId: id,
          scheduleData,
        });
      } else {
        // Create new schedule
        await createScheduleMutation.mutateAsync({
          ...scheduleData,
          workspace: activeWorkspaceId,
        });
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
