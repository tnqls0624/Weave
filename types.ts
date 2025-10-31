export type View = 'feed' | 'calendar' | 'create' | 'map' | 'settings';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  color: string;
  initialLocation?: Location;
  location?: Location;
}

export type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Calendar {
  id: string;
  name: string;
}

export interface Event {
  id: string;
  calendarId: string;
  participantIds: string[];
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  description?: string;
  location?: Location;
  repeat?: RepeatOption;
}
