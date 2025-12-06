import { useAppStore } from "@/stores";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BottomNav: React.FC = () => {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { resetSettingsPage, isMapTabEnabled } = useAppStore();

  // Get current route from segments (e.g., ['(tabs)', 'calendar'] -> 'calendar')
  const currentRoute = segments[segments.length - 1] || "calendar";

  const navItems = useMemo(() => {
    const items = [
      { route: "feed", icon: "list", label: "피드" },
      { route: "calendar", icon: "event", label: "캘린더" },
      { route: "gallery", icon: "photo-library", label: "갤러리" },
    ];

    if (isMapTabEnabled) {
      items.push({ route: "map", icon: "map", label: "지도" });
    }

    items.push({ route: "settings", icon: "settings", label: "설정" });

    return items;
  }, [isMapTabEnabled]);

  const handleNavigate = (route: string) => {
    // 같은 탭을 다시 누른 경우 초기 화면으로 리셋
    if (currentRoute === route) {
      if (route === "settings") {
        resetSettingsPage();
      }
      // 다른 탭들도 필요시 여기에 리셋 로직 추가
    }
    router.push(`/(tabs)/${route}` as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.nav}>
        {navItems.map(({ route, icon, label }) => {
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
    maxWidth: 500, // Optimized for 5 items
    alignSelf: "center",
    width: "100%",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 11, // Optimized for 5 items
    fontWeight: "500",
    color: "#6b7280",
  },
  activeLabel: {
    color: "#007AFF",
  },
});

export default BottomNav;
