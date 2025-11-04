import SettingsView from "@/components/SettingsView";
import { useAppData, useUpdateUser } from "@/stores";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { users, isLoading, error } = useAppData();
  const updateUserMutation = useUpdateUser();

  const handleUpdateUser = async (userId: string, userData: any) => {
    try {
      await updateUserMutation.mutateAsync({ userId, userData });
    } catch (error) {
      console.error("Failed to update user:", error);
    }
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
        <Text>Loading settings...</Text>
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
        <Text>Error loading settings: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SettingsView users={users} onUpdateUser={handleUpdateUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
