import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import React, { useCallback, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isHoliday } from "../../constants/holidays";
import { useDeleteSchedule } from "../../services/queries";
import type { Schedule, User } from "../../types";

dayjs.locale("ko");

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
  const deleteScheduleMutation = useDeleteSchedule();
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(
    null
  );

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
    onClose();
    bottomSheetRef.current?.close();
  };

  const handleDeleteSchedule = (schedule: Schedule) => {
    Alert.alert(
      "스케줄 삭제",
      `"${schedule.title}" 스케줄을 삭제하시겠습니까?`,
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingScheduleId(schedule.id);
              await deleteScheduleMutation.mutateAsync(schedule.id);
              // 삭제 성공 시 자동으로 캐시가 무효화되어 화면이 업데이트됨
            } catch (error) {
              console.error("Failed to delete schedule:", error);
              Alert.alert("오류", "스케줄 삭제에 실패했습니다.");
            } finally {
              setDeletingScheduleId(null);
            }
          },
        },
      ]
    );
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

  // 날짜 포맷팅
  const formatDate = () => {
    const today = dayjs().startOf("day");
    const selectedDate = dayjs(date);

    if (selectedDate.isSame(today, "day")) {
      return `오늘 • ${selectedDate.format("MM월 DD일 (ddd)")}`;
    }
    if (selectedDate.isSame(today.add(1, "day"), "day")) {
      return `내일 • ${selectedDate.format("MM월 DD일 (ddd)")}`;
    }
    if (selectedDate.isSame(today.subtract(1, "day"), "day")) {
      return `어제 • ${selectedDate.format("MM월 DD일 (ddd)")}`;
    }

    return selectedDate.format("YYYY년 MM월 DD일 (dddd)");
  };

  // 시간 포맷팅
  const formatTime = (startTime?: string, endTime?: string) => {
    if (!startTime) {
      return "종일";
    }

    if (endTime && endTime !== startTime) {
      return `${startTime} - ${endTime}`;
    }

    return startTime;
  };

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
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{formatDate()}</Text>
            {holiday && (
              <View style={styles.holidayBadge}>
                <MaterialIcons name="celebration" size={14} color="#ef4444" />
                <Text style={styles.holidayText}>{holiday.name}</Text>
              </View>
            )}
            {daySchedules.length > 0 && (
              <Text style={styles.scheduleCount}>
                일정 {daySchedules.length}개
              </Text>
            )}
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
                  style={[
                    styles.scheduleCard,
                    { borderLeftColor: textColor },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.titleRow}>
                        <View
                          style={[styles.colorDot, { backgroundColor: textColor }]}
                        />
                        <Text style={styles.scheduleTitle} numberOfLines={2}>
                          {schedule.title}
                        </Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <Pressable
                          onPress={() => onStartEdit(schedule)}
                          style={({ pressed }) => [
                            styles.iconButton,
                            pressed && styles.iconButtonPressed,
                          ]}
                          disabled={deletingScheduleId === schedule.id}
                        >
                          <MaterialIcons
                            name="edit"
                            size={20}
                            color="#6b7280"
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteSchedule(schedule)}
                          style={({ pressed }) => [
                            styles.iconButton,
                            pressed && styles.iconButtonPressed,
                            deletingScheduleId === schedule.id &&
                              styles.iconButtonDisabled,
                          ]}
                          disabled={deletingScheduleId === schedule.id}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={20}
                            color="#ef4444"
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.detailsContainer}>
                      <View style={styles.timeRow}>
                        <MaterialIcons
                          name="access-time"
                          size={16}
                          color="#9ca3af"
                        />
                        <Text style={styles.timeLabel}>
                          {formatTime(schedule.startTime, schedule.endTime)}
                        </Text>
                      </View>

                      {schedule.memo && (
                        <View style={styles.memoRow}>
                          <MaterialIcons
                            name="notes"
                            size={16}
                            color="#9ca3af"
                          />
                          <Text style={styles.memoText} numberOfLines={3}>
                            {schedule.memo}
                          </Text>
                        </View>
                      )}

                      {participants.length > 0 && (
                        <View style={styles.participantsRow}>
                          <View style={styles.participantAvatars}>
                            {participants.slice(0, 4).map((p, idx) => (
                              <Image
                                key={p.id}
                                source={{ uri: p.avatarUrl }}
                                style={[
                                  styles.participantAvatar,
                                  idx > 0 && styles.avatarOverlap,
                                ]}
                              />
                            ))}
                            {participants.length > 4 && (
                              <View
                                style={[
                                  styles.moreParticipants,
                                  styles.avatarOverlap,
                                ]}
                              >
                                <Text style={styles.moreText}>
                                  +{participants.length - 4}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.participantNames} numberOfLines={1}>
                            {participants
                              .slice(0, 3)
                              .map((p) => p.name)
                              .join(", ")}
                            {participants.length > 3 && " 외"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-available" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>이 날에는 일정이 없습니다</Text>
            <Text style={styles.emptySubtext}>
              캘린더에서 새로운 일정을 추가해보세요
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 28,
  },
  holidayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  holidayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },
  scheduleCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  scheduleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scheduleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  iconButtonPressed: {
    backgroundColor: "#e5e7eb",
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  detailsContainer: {
    gap: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  memoText: {
    flex: 1,
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 19,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  participantAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  moreParticipants: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  moreText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
  },
  participantNames: {
    flex: 1,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    marginLeft: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export default DayDetailDrawer;
