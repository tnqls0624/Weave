import SettingsView from "@/components/SettingsView";
import { useWorkspaceSchedules } from "@/services/queries";
import { useAppData, useAppStore, useUpdateUser } from "@/stores";
import { User } from "@/types";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { users, currentUser, activeWorkspace, isLoading, error } = useAppData();
  const { clearAuth, activeWorkspaceId } = useAppStore();
  const updateUserMutation = useUpdateUser();

  // 일정 개수를 가져오기 위해 schedules 조회
  const { data: schedules = [], isLoading: schedulesLoading } =
    useWorkspaceSchedules(
      activeWorkspaceId,
      {},
      {
        enabled: !!activeWorkspaceId,
      }
    );

  const handleUpdateUser = async (userId: string, userData: any) => {
    try {
      await updateUserMutation.mutateAsync({ userId, userData });
    } catch (error) {
      console.error("Failed to update user:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "로그아웃",
      "정말 로그아웃 하시겠습니까?",
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "로그아웃",
          style: "destructive",
          onPress: () => {
            clearAuth();
            router.replace("/login");
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <Text>Error loading settings: {error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SettingsView
        users={users as unknown as User[]}
        currentUser={currentUser}
        workspaceId={activeWorkspaceId}
        activeWorkspace={activeWorkspace}
        scheduleCount={schedules.length}
        schedulesLoading={schedulesLoading}
        onUpdateUser={handleUpdateUser}
        onLogout={handleLogout}
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
