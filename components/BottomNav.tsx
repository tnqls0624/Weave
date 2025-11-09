import { useAppStore } from "@/stores";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BottomNav: React.FC = () => {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { resetSettingsPage } = useAppStore();

  // Get current route from segments (e.g., ['(tabs)', 'calendar'] -> 'calendar')
  const currentRoute = segments[segments.length - 1] || "calendar";

  const navItems = [
    { route: "feed", icon: "list", label: "피드" },
    { route: "calendar", icon: "event", label: "캘린더" },
    { route: "create", icon: "add", label: "생성" },
    { route: "map", icon: "map", label: "지도" },
    { route: "settings", icon: "settings", label: "설정" },
  ];

  const handleNavigate = (route: string) => {
    if (route === "create") {
      router.push("/create");
    } else {
      // 같은 탭을 다시 누른 경우 초기 화면으로 리셋
      if (currentRoute === route) {
        if (route === "settings") {
          resetSettingsPage();
        }
        // 다른 탭들도 필요시 여기에 리셋 로직 추가
      }
      router.push(`/(tabs)/${route}` as any);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.nav}>
        {navItems.map(({ route, icon, label }) => {
          if (route === "create") {
            return (
              <View key={route} style={styles.createButtonContainer}>
                <Pressable
                  onPress={() => handleNavigate(route)}
                  style={styles.createButton}
                  android_ripple={{ color: "#007AFF" }}
                >
                  <MaterialIcons name="add" size={32} color="#fff" />
                </Pressable>
              </View>
            );
          }
          const isActive = currentRoute === route;
          return (
            <Pressable
              key={route}
              onPress={() => handleNavigate(route)}
              style={styles.navItem}
              android_ripple={{ color: "#e5e7eb" }}
            >
              <MaterialIcons
                name={icon as keyof typeof MaterialIcons.glyphMap}
                size={24}
                color={isActive ? "#007AFF" : "#6b7280"}
              />
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingBottom: 0,
    zIndex: 100,
  },
  nav: {
    flexDirection: "row",
    height: 64,
    maxWidth: 448,
    alignSelf: "center",
    width: "100%",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  createButtonContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  createButton: {
    position: "absolute",
    top: -20,
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
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  activeLabel: {
    color: "#007AFF",
  },
});

export default BottomNav;
