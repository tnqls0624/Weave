import { MaterialIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import relativeTime from "dayjs/plugin/relativeTime";
import React, { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  Image,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Schedule, User } from "../types";

// dayjs 한글 설정
dayjs.locale("ko");
dayjs.extend(relativeTime);

interface FeedViewProps {
  schedules: Schedule[];
  users: User[];
  currentUser?: User;
  onEventSelect: (schedule: Schedule) => void;
}

// 색상 코드 변환 함수
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

// 시간 포맷 함수
const formatTime = (startDate: string, endDate?: string) => {
  const isTimeFormat = startDate && startDate.includes(":");
  if (!isTimeFormat) {
    return "종일";
  }
  if (endDate) {
    return `${startDate} - ${endDate}`;
  }
  return startDate;
};

// EventCard 컴포넌트
interface EventCardProps {
  schedule: Schedule;
  isLast: boolean;
  users: User[];
  onEventSelect: (schedule: Schedule) => void;
}

const EventCard = memo<EventCardProps>(
  ({ schedule, isLast, users, onEventSelect }) => {
    const getUser = (id: string) => users.find((u) => u.id === id);

    const getEventColor = () => {
      const firstParticipantId = schedule.participants[0];
      if (firstParticipantId) {
        const participant = users.find((u) => u.id === firstParticipantId);
        return participant?.color || "gray";
      }
      return "gray";
    };

    const participants = schedule.participants
      .map((id: string) => getUser(id))
      .filter(Boolean) as User[];
    const eventColor = getEventColor();
    const borderColor = getColorCode(eventColor);

    return (
      <Pressable
        onPress={() => onEventSelect(schedule)}
        style={({ pressed }) => [
          styles.eventCard,
          {
            borderLeftColor: borderColor,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          isLast && styles.lastCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {schedule.title}
          </Text>
          <View style={[styles.colorDot, { backgroundColor: borderColor }]} />
        </View>

        <View style={styles.eventDetails}>
          {schedule.startDate && (
            <View style={styles.timeRow}>
              <MaterialIcons name="access-time" size={14} color="#9ca3af" />
              <Text style={styles.timeText}>
                {formatTime(schedule.startDate, schedule.endDate)}
              </Text>
            </View>
          )}

          {schedule.memo && (
            <View style={styles.memoRow}>
              <MaterialIcons name="notes" size={14} color="#9ca3af" />
              <Text style={styles.description} numberOfLines={2}>
                {schedule.memo}
              </Text>
            </View>
          )}

          {participants.length > 0 && (
            <View style={styles.participantsRow}>
              <View style={styles.participants}>
                {participants.slice(0, 4).map((p: User, idx: number) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.avatarUrl }}
                    style={[styles.avatar, idx > 0 && styles.avatarOverlap]}
                  />
                ))}
                {participants.length > 4 && (
                  <View style={[styles.moreParticipants, styles.avatarOverlap]}>
                    <Text style={styles.moreText}>
                      +{participants.length - 4}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.participantNames}>
                {participants
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(", ")}
                {participants.length > 3 && " 외"}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }
);

EventCard.displayName = "EventCard";

const FeedView: React.FC<FeedViewProps> = ({
  schedules,
  users,
  currentUser,
  onEventSelect,
}) => {
  const insets = useSafeAreaInsets();
  // 항상 오늘 날짜를 기준으로 upcoming events 필터링
  const today = dayjs().startOf("day");

  const currentUserId = currentUser?.id;

  const formatDate = (dateString: string) => {
    const eventDate = dayjs(dateString);
    const today = dayjs().startOf("day");
    const tomorrow = today.add(1, "day");
    const dayAfterTomorrow = today.add(2, "day");
    const nextWeek = today.add(7, "day");

    if (eventDate.isSame(today, "day")) {
      return "오늘";
    }
    if (eventDate.isSame(tomorrow, "day")) {
      return "내일";
    }
    if (eventDate.isSame(dayAfterTomorrow, "day")) {
      return "모레";
    }
    if (eventDate.isBefore(nextWeek)) {
      return eventDate.format("dddd"); // 요일 (월요일, 화요일 등)
    }

    // 이번 달인 경우
    if (eventDate.isSame(today, "month")) {
      return eventDate.format("MM월 DD일 (ddd)");
    }

    // 다른 달인 경우
    return eventDate.format("MM월 DD일");
  };

  // 일정을 날짜별로 그룹화
  const groupedEvents = useMemo(() => {
    const filtered = schedules
      .filter((schedule: Schedule) => {
        if (!schedule.startDate) {
          return false;
        }

        if (currentUserId && !schedule.participants.includes(currentUserId)) {
          return false;
        }

        const eventDate = dayjs(schedule.startDate).startOf("day");
        // 오늘 이후의 일정만 표시 (오늘 포함)
        return !eventDate.isBefore(today);
      })
      .sort((a, b) => {
        const dateA = a.startDate ? dayjs(a.startDate) : dayjs();
        const dateB = b.startDate ? dayjs(b.startDate) : dayjs();
        return dateA.diff(dateB);
      });

    // 날짜별로 그룹화
    const groups: { [key: string]: { title: string; events: Schedule[] } } = {};

    filtered.forEach((schedule) => {
      const date = dayjs(schedule.startDate).format("YYYY-MM-DD");
      const title = formatDate(schedule.startDate || "");

      if (!groups[date]) {
        groups[date] = {
          title,
          events: [],
        };
      }

      groups[date].events.push(schedule);
    });

    return Object.entries(groups).map(([date, data]) => ({
      date,
      ...data,
    }));
  }, [schedules, currentUserId, today]);

  // Render date section
  const renderDateSection: ListRenderItem<(typeof groupedEvents)[0]> =
    useCallback(
      ({ item: group }) => (
        <View style={styles.dateSection}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateTitle}>{group.title}</Text>
            <View style={styles.dateBadge}>
              <Text style={styles.dateCount}>{group.events.length}개</Text>
            </View>
          </View>
          {group.events.map((schedule: Schedule, index: number) => (
            <EventCard
              key={schedule.id}
              schedule={schedule}
              isLast={index === group.events.length - 1}
              users={users}
              onEventSelect={onEventSelect}
            />
          ))}
        </View>
      ),
      [users, onEventSelect]
    );

  // Key extractor for FlatList
  const keyExtractor = useCallback(
    (item: (typeof groupedEvents)[0]) => item.date,
    []
  );

  // List header component
  const ListHeaderComponent = useCallback(
    () => <Text style={styles.mainTitle}>다가오는 일정</Text>,
    []
  );

  // Empty component
  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <MaterialIcons name="event" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>예정된 일정이 없습니다</Text>
        <Text style={styles.emptySubtext}>
          캘린더에서 새로운 일정을 추가해보세요
        </Text>
      </View>
    ),
    []
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      data={groupedEvents}
      renderItem={renderDateSection}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={5}
      windowSize={10}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
  },
  dateBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  eventCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  lastCard: {
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  eventDetails: {
    gap: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  description: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
    flex: 1,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  participants: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  moreParticipants: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 12,
    color: "#9ca3af",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 17,
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

export default FeedView;
