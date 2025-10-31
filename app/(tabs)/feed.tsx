import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedView from '@/components/FeedView';
import { useApp } from '@/contexts/AppContext';

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { calendarEvents, users, setCalendarDate, setDetailDrawerDate } = useApp();

  const handleEventSelect = (event: any) => {
    const eventDate = new Date(event.startDate + 'T00:00:00');
    setCalendarDate(eventDate);
    setDetailDrawerDate(eventDate);
    router.push('/(tabs)/calendar');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FeedView 
        events={calendarEvents} 
        users={users} 
        onEventSelect={handleEventSelect} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
