import { Calendar, Event, User } from './types';
import { toYYYYMMDD } from './utils/date';

export const USERS: User[] = [
  { id: 'user1', name: 'You', avatarUrl: 'https://i.pravatar.cc/150?u=user1', color: 'blue', initialLocation: { latitude: 37.7749, longitude: -122.4194 } },
  { id: 'user2', name: 'Alex', avatarUrl: 'https://i.pravatar.cc/150?u=user2', color: 'emerald', initialLocation: { latitude: 37.7759, longitude: -122.4224 } },
  { id: 'user3', name: 'Sam', avatarUrl: 'https://i.pravatar.cc/150?u=user3', color: 'orange', initialLocation: { latitude: 37.7719, longitude: -122.4154 } },
  { id: 'user4', name: 'Jess', avatarUrl: 'https://i.pravatar.cc/150?u=user4', color: 'violet', initialLocation: { latitude: 37.7789, longitude: -122.4184 } },
];

export const CALENDARS: Calendar[] = [
  { id: 'family', name: 'Family Calendar' },
  { id: 'work', name: 'Work' },
  { id: 'personal', name: 'Personal' },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(today.getDate() + 2);
const fourDaysFromNow = new Date(today);
fourDaysFromNow.setDate(today.getDate() + 4);
const sixDaysFromNow = new Date(today);
sixDaysFromNow.setDate(today.getDate() + 6);


export const EVENTS: Event[] = [
  {
    id: '1',
    calendarId: 'work',
    participantIds: ['user2', 'user3'],
    title: 'Team Standup',
    startDate: toYYYYMMDD(today),
    startTime: '09:00',
    endTime: '09:15',
    description: 'Daily sync meeting.',
  },
  {
    id: '2',
    calendarId: 'family',
    participantIds: ['user1', 'user4'],
    title: 'Lunch with Jess',
    startDate: toYYYYMMDD(today),
    startTime: '12:30',
    endTime: '13:30',
    description: 'Catch up at The Italian Place.',
    location: { latitude: 37.78825, longitude: -122.4324 },
  },
  {
    id: '3',
    calendarId: 'work',
    participantIds: ['user2', 'user3', 'user4'],
    title: 'Project Phoenix Kick-off',
    startDate: toYYYYMMDD(tomorrow),
    startTime: '14:00',
    endTime: '15:00',
    description: 'Initial meeting to discuss project goals and timeline.',
  },
  {
    id: '4',
    calendarId: 'personal',
    participantIds: ['user2'],
    title: 'Dentist Appointment',
    startDate: toYYYYMMDD(dayAfterTomorrow),
    startTime: '11:00',
    endTime: '11:30',
  },
  {
    id: '5',
    calendarId: 'personal',
    participantIds: ['user1'],
    title: 'Gym Session',
    startDate: toYYYYMMDD(dayAfterTomorrow),
    startTime: '18:00',
    endTime: '19:00',
    description: 'Leg day.',
  },
  {
    id: '6',
    calendarId: 'work',
    participantIds: ['user1', 'user3'],
    title: 'Business Trip',
    startDate: toYYYYMMDD(fourDaysFromNow),
    endDate: toYYYYMMDD(sixDaysFromNow),
    startTime: '08:00',
    endTime: '17:00',
    description: 'Client visit to New York.',
  },
];
