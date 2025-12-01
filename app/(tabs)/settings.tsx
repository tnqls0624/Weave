import SettingsView from "@/components/SettingsView";
import { useWorkspaceSchedules } from "@/services/queries";
import { useAppData, useAppStore, useUpdateUser } from "@/stores";
import { User } from "@/types";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
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
        <Text>Error loading settings: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
