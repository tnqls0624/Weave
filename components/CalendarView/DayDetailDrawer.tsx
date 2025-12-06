import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { isHoliday } from "../../constants/holidays";
import { useDeleteSchedule, queryKeys } from "../../services/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { Schedule, User } from "../../types";
import ScheduleComments from "../ScheduleComments";
import SchedulePhotoAlbum from "../SchedulePhotoAlbum";

dayjs.locale("ko");

// 음력을 양력으로 변환하는 헬퍼 함수
const lunarToSolar = (year: number, month: number, day: number): { year: number; month: number; day: number } | null => {
  try {
    const calendar = new KoreanLunarCalendar();
    calendar.setLunarDate(year, month, day, false);
    const solarDate = calendar.getSolarCalendar();
    return { year: solarDate.year, month: solarDate.month, day: solarDate.day };
  } catch {
    return null;
  }
};

// 특정 연도의 음력 날짜를 양력으로 변환
const getLunarDateInYear = (lunarMonth: number, lunarDay: number, targetYear: number): string | null => {
  const solar = lunarToSolar(targetYear, lunarMonth, lunarDay);
  if (!solar) return null;
  return `${solar.year}-${String(solar.month).padStart(2, "0")}-${String(solar.day).padStart(2, "0")}`;
};

// D-Day 계산 (오늘 기준)
const calculateDDay = (targetDateStr: string): number | null => {
  const today = dayjs().startOf("day");
  const targetDate = dayjs(targetDateStr).startOf("day");
  const diff = targetDate.diff(today, "day");
  return diff;
};

// D-Day 텍스트 포맷
const formatDDay = (dDay: number): string => {
  if (dDay === 0) return "D-Day";
  if (dDay > 0) return `D-${dDay}`;
  return `D+${Math.abs(dDay)}`;
};

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
  const queryClient = useQueryClient();
  const deleteScheduleMutation = useDeleteSchedule();
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(
    null
  );
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedScheduleForComments, setSelectedScheduleForComments] = useState<Schedule | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedScheduleForDetail, setSelectedScheduleForDetail] = useState<Schedule | null>(null);
  const [localCommentCounts, setLocalCommentCounts] = useState<Record<string, number>>({});

  const openCommentsModal = (schedule: Schedule) => {
    setSelectedScheduleForComments(schedule);
    setCommentsModalVisible(true);
  };

  const closeCommentsModal = () => {
    setCommentsModalVisible(false);
    setSelectedScheduleForComments(null);
    // 댓글 모달 닫을 때 스케줄 목록 새로고침 (commentCount 반영)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === "workspaces" &&
          (key[2] === "schedules" || key[2] === "feed")
        );
      },
    });
  };

  const openDetailModal = (schedule: Schedule) => {
    setSelectedScheduleForDetail(schedule);
    setDetailModalVisible(true);
  };

  const handleCommentCountChange = useCallback((count: number) => {
    if (!selectedScheduleForComments) return;
    setLocalCommentCounts(prev => {
      if (prev[selectedScheduleForComments.id] === count) return prev;
      return {
        ...prev,
        [selectedScheduleForComments.id]: count
      };
    });
  }, [selectedScheduleForComments?.id]);

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedScheduleForDetail(null);
    // 사진 모달 닫을 때 스케줄 목록 새로고침 (photoCount 반영)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === "workspaces" &&
          (key[2] === "schedules" || key[2] === "feed")
        );
      },
    });
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        onPress={() => {
          // backdrop 클릭 시 닫기만 하고 이벤트 전파 방지
          onClose();
        }}
      />
    ),
    [onClose]
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

  // 반복 일정을 해당 날짜에 맞게 필터링 (음력 지원)
  const daySchedules = events.flatMap((schedule) => {
    const currentDay = dayjs(date).startOf("day");
    const originalStart = dayjs(schedule.startDate);
    const originalEnd = schedule.endDate ? dayjs(schedule.endDate) : originalStart;
    const duration = originalEnd.diff(originalStart, "day");
    const repeatType = schedule.repeatType?.toLowerCase() || "none";
    const isLunar = schedule.calendarType?.toLowerCase() === "lunar";

    // 음력 + 매년 반복: 해당 연도의 음력을 양력으로 변환
    if (isLunar && repeatType === "yearly") {
      const lunarMonth = originalStart.month() + 1;
      const lunarDay = originalStart.date();
      const targetYear = currentDay.year();

      const solarDateString = getLunarDateInYear(lunarMonth, lunarDay, targetYear);
      if (!solarDateString) return [];

      const solarStart = dayjs(solarDateString);
      const solarEnd = solarStart.add(duration, "day");

      if (currentDay.isSame(solarStart, "day") ||
          (currentDay.isAfter(solarStart) && currentDay.isBefore(solarEnd.add(1, "day")))) {
        // 원본 음력 날짜는 유지 (수정 시 사용)
        return [schedule];
      }
      return [];
    }

    // 음력 + 반복 없음: 해당 연도의 음력을 양력으로 변환
    if (isLunar && repeatType === "none") {
      const lunarMonth = originalStart.month() + 1;
      const lunarDay = originalStart.date();
      const lunarYear = originalStart.year();

      const solarDateString = getLunarDateInYear(lunarMonth, lunarDay, lunarYear);
      if (!solarDateString) return [];

      const solarStart = dayjs(solarDateString);
      const solarEnd = solarStart.add(duration, "day");

      if (currentDay.isSame(solarStart, "day") ||
          (currentDay.isAfter(solarStart) && currentDay.isBefore(solarEnd.add(1, "day")))) {
        // 원본 음력 날짜는 유지 (수정 시 사용)
        return [schedule];
      }
      return [];
    }

    // 양력 반복 없는 일정
    if (repeatType === "none") {
      const scheduleStart = originalStart.startOf("day");
      const scheduleEnd = originalEnd.startOf("day");
      if (currentDay.isSame(scheduleStart, "day") ||
          (currentDay.isAfter(scheduleStart) && currentDay.isBefore(scheduleEnd.add(1, "day")))) {
        return [schedule];
      }
      return [];
    }

    // 양력 반복 일정: 해당 날짜에 맞는 인스턴스인지 확인
    let checkDate = originalStart;

    // 효율성을 위해 현재 날짜 근처로 점프
    if (repeatType === "yearly") {
      checkDate = originalStart.year(currentDay.year());
      // 이번 해 인스턴스가 해당 날짜 범위에 포함되는지 확인
      if (currentDay.isBefore(checkDate)) {
        checkDate = checkDate.subtract(1, "year");
      }
    } else if (repeatType === "monthly") {
      checkDate = originalStart.year(currentDay.year()).month(currentDay.month());
      if (currentDay.isBefore(checkDate)) {
        checkDate = checkDate.subtract(1, "month");
      }
    } else if (repeatType === "weekly") {
      const weeksDiff = currentDay.diff(originalStart, "week");
      checkDate = originalStart.add(weeksDiff, "week");
      if (currentDay.isBefore(checkDate)) {
        checkDate = checkDate.subtract(1, "week");
      }
    } else if (repeatType === "daily") {
      checkDate = currentDay;
    }

    // 해당 날짜가 반복 인스턴스의 범위 내에 있는지 확인
    const instanceStart = checkDate.startOf("day");
    const instanceEnd = checkDate.add(duration, "day").startOf("day");

    // 원본 시작일 이후인지 확인
    if (instanceStart.isBefore(originalStart)) {
      return [];
    }

    if (currentDay.isSame(instanceStart, "day") ||
        (currentDay.isAfter(instanceStart) && currentDay.isBefore(instanceEnd.add(1, "day")))) {
      return [{
        ...schedule,
        startDate: instanceStart.format("YYYY-MM-DD"),
        endDate: instanceEnd.format("YYYY-MM-DD"),
      }];
    }

    return [];
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

              // 중요 일정 D-Day 계산
              const dDay = schedule.isImportant && schedule.startDate
                ? calculateDDay(schedule.startDate)
                : null;

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
                        {dDay !== null && (
                          <View style={[
                            styles.ddayBadge,
                            dDay === 0 && styles.ddayBadgeToday,
                            dDay < 0 && styles.ddayBadgePast,
                          ]}>
                            <Text style={[
                              styles.ddayText,
                              dDay === 0 && styles.ddayTextToday,
                            ]}>
                              {formatDDay(dDay)}
                            </Text>
                          </View>
                        )}
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

                      {/* 액션 버튼들 */}
                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.commentsButton}
                          onPress={() => openCommentsModal(schedule)}
                        >
                          <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
                          <Text style={styles.commentsButtonText}>
                            댓글 {localCommentCounts[schedule.id] ?? schedule.commentCount ?? 0}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.detailButton}
                          onPress={() => openDetailModal(schedule)}
                        >
                          <Ionicons name="images-outline" size={16} color="#6b7280" />
                          <Text style={styles.detailButtonText}>
                            사진 {schedule.photoCount || 0}
                          </Text>
                        </Pressable>
                      </View>

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

      {/* 댓글 모달 */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCommentsModal}
      >
        <View style={styles.commentsModal}>
          <View style={styles.commentsModalHeader}>
            <Pressable onPress={closeCommentsModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
            <Text style={styles.commentsModalTitle}>
              {selectedScheduleForComments?.title || "댓글"}
            </Text>
            <View style={{ width: 32 }} />
          </View>
          {selectedScheduleForComments && (
            <ScheduleComments
              scheduleId={selectedScheduleForComments.id}
              currentUserId={currentUser.id}
              workspaceUsers={users}
              onCommentCountChange={handleCommentCountChange}
            />
          )}
        </View>
      </Modal>

      {/* 사진 앨범 모달 */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.albumModal}>
          <View style={styles.albumHeader}>
            <Pressable onPress={closeDetailModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
            <Text style={styles.albumTitle} numberOfLines={1}>
              {selectedScheduleForDetail?.title || "사진"}
            </Text>
            <View style={{ width: 32 }} />
          </View>
          {selectedScheduleForDetail && (
            <SchedulePhotoAlbum
              scheduleId={selectedScheduleForDetail.id}
              currentUserId={currentUser.id}
              isFullScreen={true}
            />
          )}
        </View>
      </Modal>
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
  ddayBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  ddayBadgeToday: {
    backgroundColor: "#fee2e2",
  },
  ddayBadgePast: {
    backgroundColor: "#f3f4f6",
  },
  ddayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d97706",
  },
  ddayTextToday: {
    color: "#ef4444",
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  commentsButtonText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  detailButtonText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  commentsModal: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  commentsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalCloseButton: {
    padding: 4,
  },
  commentsModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  // 앨범 모달 스타일
  albumModal: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  albumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
});

export default DayDetailDrawer;
