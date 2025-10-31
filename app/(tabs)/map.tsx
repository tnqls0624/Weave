import MapView from '@/components/MapView';
import { useApp } from '@/contexts/AppContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { calendarEvents, activeCalendarUsers } = useApp();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <MapView events={calendarEvents} users={activeCalendarUsers} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
