import { MaterialIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Schedule, User } from "../types";

interface FeedViewProps {
  schedules: Schedule[];
  users: User[];
  currentUser?: User;
  onEventSelect: (schedule: Schedule) => void;
}

const FeedView: React.FC<FeedViewProps> = ({
  schedules,
  users,
  currentUser,
  onEventSelect,
}) => {
  // 항상 오늘 날짜를 기준으로 upcoming events 필터링
  const today = dayjs().startOf("day");

  const currentUserId = currentUser?.id;

  const upcomingEvents = schedules
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

  const getUser = (id: string) => users.find((u) => u.id === id);

  const getEventColor = (schedule: Schedule) => {
    // 스케줄의 첫 번째 참여자의 색상 사용 (users 배열에서 조회)
    const firstParticipantId = schedule.participants[0];
    if (firstParticipantId) {
      const participant = users.find((u) => u.id === firstParticipantId);
      return participant?.color || "gray";
    }
    return "gray";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return "Today";
    }
    if (date.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>일정 목록</Text>
      <View style={styles.eventsList}>
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((schedule: Schedule) => {
            const participants = schedule.participants
              .map((id: string) => getUser(id))
              .filter(Boolean) as User[];
            const eventColor = getEventColor(schedule);
            const borderColor = getColorCode(eventColor);

            return (
              <Pressable
                key={schedule.id}
                onPress={() => onEventSelect(schedule)}
                style={[styles.eventCard, { borderLeftColor: borderColor }]}
              >
                <Text style={styles.eventTitle}>{schedule.title}</Text>
                <Text style={[styles.eventDate, { color: borderColor }]}>
                  {formatDate(schedule.startDate || "")}
                </Text>

                <View style={styles.eventDetails}>
                  {schedule.startDate && (
                    <View style={styles.timeRow}>
                      <MaterialIcons
                        name="access-time"
                        size={16}
                        color="#6b7280"
                      />
                      <Text style={styles.timeText}>
                        {schedule.startDate}{" "}
                        {schedule.endDate && `- ${schedule.endDate}`}
                      </Text>
                    </View>
                  )}
                  {schedule.memo && (
                    <Text style={styles.description}>{schedule.memo}</Text>
                  )}
                  {participants.length > 0 && (
                    <View style={styles.participants}>
                      {participants.map((p: User, idx: number) => (
                        <Image
                          key={p.id}
                          source={{ uri: p.avatarUrl }}
                          style={[
                            styles.avatar,
                            idx > 0 && styles.avatarOverlap,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No upcoming events.</Text>
            <Text style={styles.emptySubtext}>
              Create one from the &apos;+&apos; button below!
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  eventsList: {
    gap: 10,
  },
  eventCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1.5,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  eventDetails: {
    gap: 6,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  description: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },
  participants: {
    flexDirection: "row",
    paddingTop: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarOverlap: {
    marginLeft: -6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
  },
});

export default FeedView;
