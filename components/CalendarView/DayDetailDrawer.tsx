import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isHoliday } from "../../constants/holidays";
import type { Schedule, User } from "../../types";

interface DayDetailDrawerProps {
  date: Date;
  events: Schedule[];
  users: User[];
  currentUser: User;
  onClose: () => void;
  onStartEdit: (schedule: Schedule) => void;
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

  const getScheduleColor = (schedule: Schedule) => {
    // 스케줄의 첫 번째 참여자의 색상 사용 (users 배열에서 조회)
    const firstParticipantId = (schedule.participants || [])[0];
    if (firstParticipantId) {
      const participant = users.find((u) => u.id === firstParticipantId);
      return participant?.color || "gray";
    }
    return "gray";
  };

  const getColorCode = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      red: "#ef4444",
      orange: "#fb923c",
      amber: "#f59e0b",
      yellow: "#eab308",
      lime: "#84cc16",
      green: "#22c55e",
      emerald: "#34d399",
      teal: "#14b8a6",
      cyan: "#06b6d4",
      blue: "#60a5fa",
      indigo: "#6366f1",
      violet: "#a78bfa",
      purple: "#a855f7",
      fuchsia: "#d946ef",
      pink: "#ec4899",
      rose: "#f43f5e",
      gray: "#9ca3af",
    };
    return colorMap[colorName] || colorMap["gray"];
  };

  const daySchedules = events.filter((schedule) => {
    const scheduleStart = new Date(schedule.startDate + "T00:00:00");
    const scheduleEnd = schedule.endDate
      ? new Date(schedule.endDate + "T00:00:00")
      : scheduleStart;
    const currentDay = new Date(date);
    currentDay.setHours(0, 0, 0, 0);
    return currentDay >= scheduleStart && currentDay <= scheduleEnd;
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

        {daySchedules.length > 0 ? (
          daySchedules
            .sort((a, b) => {
              if (a.startTime && b.startTime)
                return a.startTime.localeCompare(b.startTime);
              if (a.startTime) return -1;
              if (b.startTime) return 1;
              return a.title.localeCompare(b.title);
            })
            .map((schedule) => {
              const participants = (schedule.participants || [])
                .map(getUser)
                .filter(Boolean) as User[];
              const scheduleColor = getScheduleColor(schedule);
              const bgColor = getColorCode(scheduleColor) + "20";
              const textColor = getColorCode(scheduleColor);

              return (
                <View
                  key={schedule.id}
                  style={[styles.scheduleCard, { backgroundColor: bgColor }]}
                >
                  <View
                    style={[styles.timeColumn, { backgroundColor: textColor }]}
                  >
                    <Text style={styles.timeText}>
                      {schedule.startTime ? schedule.startTime : "All-day"}
                    </Text>
                  </View>
                  <View style={styles.scheduleContent}>
                    <View style={styles.scheduleHeader}>
                      <View>
                        <Text style={styles.scheduleTitle}>
                          {schedule.title}
                        </Text>
                        {schedule.memo && (
                          <Text style={styles.scheduleDescription}>
                            {schedule.memo}
                          </Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => onStartEdit(schedule)}
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
          <Text style={styles.emptyText}>No schedules for this day.</Text>
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
  scheduleCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  timeColumn: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginRight: 10,
    paddingVertical: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scheduleTitle: {
    fontWeight: "600",
    color: "#1f2937",
    fontSize: 14,
  },
  scheduleDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  editButton: {
    padding: 4,
    borderRadius: 16,
  },
  participants: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
  },
  participantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fff",
    marginLeft: -6,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 32,
  },
});

export default DayDetailDrawer;
