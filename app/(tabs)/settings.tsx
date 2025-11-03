import SettingsView from "@/components/SettingsView";
import { useApp } from "@/contexts/AppContext";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { users, setUsers } = useApp();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SettingsView users={users} setUsers={setUsers} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
