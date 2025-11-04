import CreateEventView from "@/components/CreateEventView";
import {
  useAppData,
  useAppStore,
  useCreateEvent,
  useUpdateEvent,
} from "@/stores";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function CreateScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const { eventToEdit, setEventToEdit, activeCalendarId } = useAppStore();
  const { users, events, isLoading, error } = useAppData();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();

  const handleSetActiveView = (view: string) => {
    if (view !== "create") {
      setEventToEdit(null);
      router.back();
    }
  };

  // Find event to edit if eventId is provided
  const event = eventId
    ? events.find((e: any) => e.id === eventId) || null
    : eventToEdit;

  const handleSave = async (eventData: any, id?: string) => {
    try {
      if (id) {
        // Update existing event
        await updateEventMutation.mutateAsync({ eventId: id, eventData });
      } else {
        // Create new event
        await createEventMutation.mutateAsync({
          ...eventData,
          calendarId: activeCalendarId,
        });
      }
      setEventToEdit(null);
      router.back();
    } catch (error) {
      console.error("Failed to save event:", error);
      // 에러 처리 로직 추가 가능
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CreateEventView
        onSave={handleSave}
        users={users}
        currentUser={users[0]}
        setActiveView={handleSetActiveView}
        eventToEdit={event}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
