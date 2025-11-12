import { MaterialIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Calendar, User } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  calendars: Calendar[];
  activeCalendarId: string;
  onSelectCalendar: (id: string) => void;
  currentUser: User;
  children: React.ReactNode;
}

const SidebarComponent: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  calendars,
  activeCalendarId,
  onSelectCalendar,
  currentUser,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const activeCalendarTitle = useMemo(() => {
    const activeCalendar = calendars.find(
      (calendar) => calendar.id === activeCalendarId
    );
    return activeCalendar?.title || "워크스페이스";
  }, [calendars, activeCalendarId]);

  const renderDrawerContent = () => (
    <View
      style={[
        styles.drawerContent,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: currentUser.avatarUrl }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <Text style={styles.subtitle}>{activeCalendarTitle}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#4b5563" />
        </Pressable>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.nav}>
        {calendars && calendars.length > 0 ? (
          calendars.map((calendar) => {
            const isActive = calendar.id === activeCalendarId;
            return (
              <Pressable
                key={calendar.id}
                onPress={() => onSelectCalendar(calendar.id)}
                style={[
                  styles.calendarItem,
                  isActive && styles.activeCalendarItem,
                ]}
              >
                <MaterialIcons
                  name="event"
                  size={20}
                  color={isActive ? "#fff" : "#9ca3af"}
                />
                <Text
                  style={[
                    styles.calendarText,
                    isActive && styles.activeCalendarText,
                  ]}
                >
                  {calendar.title || "Unnamed Calendar"}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#6b7280", textAlign: "center" }}>
              No workspaces available
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <Drawer
      open={isOpen}
      onOpen={() => {}}
      onClose={onClose}
      drawerPosition="left"
      drawerStyle={styles.drawerStyle}
      renderDrawerContent={renderDrawerContent}
      overlayStyle={styles.overlay}
    >
      {children}
    </Drawer>
  );
};

const Sidebar = memo(SidebarComponent);

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
    backgroundColor: "#fff",
    width: 288,
  },
  drawerStyle: {
    width: 288,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  nav: {
    flex: 1,
    padding: 16,
  },
  calendarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeCalendarItem: {
    backgroundColor: "#007AFF",
  },
  calendarText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 12,
  },
  activeCalendarText: {
    color: "#fff",
  },
});

export default Sidebar;
