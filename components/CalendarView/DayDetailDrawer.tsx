import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isHoliday } from "../../constants/holidays";
import type { Event, User } from "../../types";

interface DayDetailDrawerProps {
  date: Date;
  events: Event[];
  users: User[];
  currentUser: User;
  onClose: () => void;
  onStartEdit: (event: Event) => void;
}

const DayDetailDrawer: React.FC<DayDetailDrawerProps> = ({
  date,
  events,
  users,
  currentUser,
  onClose,
  onStartEdit,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const handleClose = () => {
    bottomSheetRef.current?.close();
    setTimeout(onClose, 300);
  };

  const getUser = (id: string) => users.find((u) => u.id === id);

  const getEventColor = (event: Event) => {
    if (event.participantIds.includes(currentUser.id)) {
      return currentUser.color;
    }
    const firstParticipant = users.find(
      (u) => u.id === event.participantIds[0]
    );
    return firstParticipant?.color || "gray";
  };

  const getColorCode = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      blue: "#3b82f6",
      emerald: "#10b981",
      orange: "#f97316",
      violet: "#8b5cf6",
      gray: "#6b7280",
    };
    return colorMap[colorName] || colorMap["gray"];
  };

  const dayEvents = events.filter((event) => {
    const eventStart = new Date(event.startDate + "T00:00:00");
    const eventEnd = event.endDate
      ? new Date(event.endDate + "T00:00:00")
      : eventStart;
    const currentDay = new Date(date);
    currentDay.setHours(0, 0, 0, 0);
    return currentDay >= eventStart && currentDay <= eventEnd;
  });

  // 공휴일 확인
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;
  const holiday = isHoliday(dateString);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 64 + insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {date.toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </Text>
            {holiday && <Text style={styles.holidayText}>{holiday.name}</Text>}
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        {dayEvents.length > 0 ? (
          dayEvents
            .sort((a, b) => {
              if (a.startTime && b.startTime)
                return a.startTime.localeCompare(b.startTime);
              if (a.startTime) return -1;
              if (b.startTime) return 1;
              return a.title.localeCompare(b.title);
            })
            .map((event) => {
              const participants = event.participantIds
                .map(getUser)
                .filter(Boolean) as User[];
              const eventColor = getEventColor(event);
              const bgColor = getColorCode(eventColor) + "20";
              const textColor = getColorCode(eventColor);

              return (
                <View
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: bgColor }]}
                >
                  <View
                    style={[styles.timeColumn, { backgroundColor: textColor }]}
                  >
                    <Text style={styles.timeText}>
                      {event.startTime ? event.startTime : "All-day"}
                    </Text>
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <View>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {event.description && (
                          <Text style={styles.eventDescription}>
                            {event.description}
                          </Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => onStartEdit(event)}
                        style={styles.editButton}
                      >
                        <MaterialIcons name="edit" size={20} color="#6b7280" />
                      </Pressable>
                    </View>
                    {participants.length > 0 && (
                      <View style={styles.participants}>
                        {participants.map((p) => (
                          <Image
                            key={p.id}
                            source={{ uri: p.avatarUrl }}
                            style={styles.participantAvatar}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
        ) : (
          <Text style={styles.emptyText}>
            No events scheduled for this day.
          </Text>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  holidayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  eventCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  timeColumn: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginRight: 12,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eventTitle: {
    fontWeight: "bold",
    color: "#1f2937",
    fontSize: 16,
  },
  eventDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
  },
  participants: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fff",
    marginLeft: -8,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 32,
  },
});

export default DayDetailDrawer;
