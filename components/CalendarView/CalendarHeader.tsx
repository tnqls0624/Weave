import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface CalendarHeaderProps {
  currentDate: Date;
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
  activeCalendarName: string;
  onTitleClick: () => void;
  isPickerOpen: boolean;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onOpenSidebar,
  onOpenSearch,
  activeCalendarName,
  onTitleClick,
  isPickerOpen,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  return (
    <View style={styles.container}>
      <Pressable onPress={onOpenSidebar} style={styles.iconButton}>
        <MaterialIcons name="menu" size={24} color="#4b5563" />
      </Pressable>
      <View style={styles.titleContainer}>
        <Pressable onPress={onTitleClick} style={styles.titleButton}>
          <Text style={styles.title}>{`${year}년 ${month}월`}</Text>
          <MaterialIcons
            name={isPickerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={20}
            color="#007AFF"
          />
        </Pressable>
        <Text style={styles.subtitle}>{activeCalendarName}</Text>
      </View>
      <Pressable onPress={onOpenSearch} style={styles.iconButton}>
        <MaterialIcons name="search" size={24} color="#4b5563" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 0,
    minHeight: 48,
    backgroundColor: "#ffffff",
  },
  iconButton: {
    padding: 8,
  },
  titleContainer: {
    alignItems: "center",
  },
  titleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#007AFF",
  },
  subtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
});

export default CalendarHeader;
