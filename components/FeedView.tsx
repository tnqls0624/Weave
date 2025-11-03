import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Event, User } from "../types";

interface FeedViewProps {
  events: Event[];
  users: User[];
  onEventSelect: (event: Event) => void;
}

const FeedView: React.FC<FeedViewProps> = ({
  events,
  users,
  onEventSelect,
}) => {
  const upcomingEvents = events
    .filter((event) => {
      if (event.startTime) {
        const eventDateTime = new Date(`${event.startDate}T${event.startTime}`);
        return eventDateTime >= new Date();
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventEndDate = event.endDate
          ? new Date(event.endDate + "T00:00:00")
          : new Date(event.startDate + "T00:00:00");
        return eventEndDate >= today;
      }
    })
    .sort((a, b) => {
      const dateA = a.startTime
        ? new Date(`${a.startDate}T${a.startTime}`)
        : new Date(a.startDate + "T00:00:00");
      const dateB = b.startTime
        ? new Date(`${b.startDate}T${b.startTime}`)
        : new Date(b.startDate + "T00:00:00");
      return dateA.getTime() - dateB.getTime();
    });

  const getUser = (id: string) => users.find((u) => u.id === id);

  const getEventColor = (event: Event) => {
    const currentUser = users.find((u) => u.id === "user1");
    if (event.participantIds.includes(currentUser!.id)) {
      return currentUser!.color;
    }
    const firstParticipant = users.find(
      (u) => u.id === event.participantIds[0]
    );
    return firstParticipant?.color || "gray";
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
      blue: "#3b82f6",
      emerald: "#10b981",
      orange: "#f97316",
      violet: "#8b5cf6",
      gray: "#6b7280",
    };
    return colorMap[colorName] || colorMap["gray"];
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>일정 목록</Text>
      <View style={styles.eventsList}>
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((event) => {
            const participants = event.participantIds
              .map(getUser)
              .filter(Boolean) as User[];
            const eventColor = getEventColor(event);
            const borderColor = getColorCode(eventColor);

            return (
              <Pressable
                key={event.id}
                onPress={() => onEventSelect(event)}
                style={[styles.eventCard, { borderLeftColor: borderColor }]}
              >
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={[styles.eventDate, { color: borderColor }]}>
                  {formatDate(event.startDate)}
                </Text>

                <View style={styles.eventDetails}>
                  {event.startTime && (
                    <View style={styles.timeRow}>
                      <MaterialIcons
                        name="access-time"
                        size={16}
                        color="#6b7280"
                      />
                      <Text style={styles.timeText}>
                        {event.startTime}{" "}
                        {event.endTime && `- ${event.endTime}`}
                      </Text>
                    </View>
                  )}
                  {event.description && (
                    <Text style={styles.description}>{event.description}</Text>
                  )}
                  {participants.length > 0 && (
                    <View style={styles.participants}>
                      {participants.map((p, idx) => (
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
    gap: 16,
  },
  eventCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
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
    fontSize: 14,
    color: "#6b7280",
  },
  description: {
    fontSize: 14,
    color: "#6b7280",
  },
  participants: {
    flexDirection: "row",
    paddingTop: 8,
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
