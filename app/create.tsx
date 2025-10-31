import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CreateEventView from '@/components/CreateEventView';
import { useApp } from '@/contexts/AppContext';

export default function CreateScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const { 
    handleSaveEvent, 
    users, 
    eventToEdit,
    setEventToEdit,
    events
  } = useApp();

  const handleSetActiveView = (view: string) => {
    if (view !== 'create') {
      setEventToEdit(null);
      router.back();
    }
  };

  // Find event to edit if eventId is provided
  const event = eventId 
    ? events.find(e => e.id === eventId) || null
    : eventToEdit;

  return (
    <View style={styles.container}>
      <CreateEventView 
        onSave={(eventData, id) => {
          handleSaveEvent(eventData, id);
          router.back();
        }}
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
    backgroundColor: '#fff',
  },
});
