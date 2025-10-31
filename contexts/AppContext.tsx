import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Event, User, Calendar } from '../types';
import { EVENTS, USERS, CALENDARS } from '../constants';

interface AppContextType {
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  activeCalendarId: string;
  setActiveCalendarId: (id: string) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  detailDrawerDate: Date | null;
  setDetailDrawerDate: (date: Date | null) => void;
  eventToEdit: Event | null;
  setEventToEdit: (event: Event | null) => void;
  handleSaveEvent: (eventData: Omit<Event, 'id' | 'calendarId'>, eventId?: string) => void;
  handleSelectCalendar: (calendarId: string) => void;
  activeCalendar: Calendar;
  calendarEvents: Event[];
  activeCalendarUsers: User[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>(EVENTS);
  const [users, setUsers] = useState(USERS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeCalendarId, setActiveCalendarId] = useState('family');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [detailDrawerDate, setDetailDrawerDate] = useState<Date | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const handleSaveEvent = useCallback((eventData: Omit<Event, 'id' | 'calendarId'>, eventId?: string) => {
    if (eventId) {
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === eventId ? { ...event, ...eventData, id: eventId, calendarId: event.calendarId } : event
        ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      );
    } else {
      const newEvent: Event = {
        ...eventData,
        calendarId: activeCalendarId,
        id: (Math.max(...events.map(e => parseInt(e.id, 10)), 0) + 1).toString(),
      };
      setEvents(prevEvents => [...prevEvents, newEvent].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
    }
    setEventToEdit(null);
  }, [events, activeCalendarId]);

  const handleEventSelect = useCallback((event: Event) => {
    const eventDate = new Date(event.startDate + 'T00:00:00');
    setCalendarDate(eventDate);
    setDetailDrawerDate(eventDate);
  }, []);

  const handleStartEdit = useCallback((event: Event) => {
    setEventToEdit(event);
  }, []);

  const handleSelectCalendar = useCallback((calendarId: string) => {
    setActiveCalendarId(calendarId);
    setIsSidebarOpen(false);
  }, []);

  const activeCalendar = useMemo(() => 
    CALENDARS.find(c => c.id === activeCalendarId) || CALENDARS[0],
    [activeCalendarId]
  );

  const calendarEvents = useMemo(() => 
    events.filter(event => event.calendarId === activeCalendarId),
    [events, activeCalendarId]
  );

  const activeCalendarUsers = useMemo(() => {
    const participantIds = new Set(calendarEvents.flatMap(event => event.participantIds));
    const currentUser = users.find(u => u.id === 'user1');
    if (currentUser) {
      participantIds.add(currentUser.id);
    }
    return users.filter(user => participantIds.has(user.id));
  }, [calendarEvents, users]);

  return (
    <AppContext.Provider
      value={{
        events,
        setEvents,
        users,
        setUsers,
        isSidebarOpen,
        setIsSidebarOpen,
        isSearchOpen,
        setIsSearchOpen,
        activeCalendarId,
        setActiveCalendarId,
        calendarDate,
        setCalendarDate,
        detailDrawerDate,
        setDetailDrawerDate,
        eventToEdit,
        setEventToEdit,
        handleSaveEvent,
        handleSelectCalendar,
        activeCalendar,
        calendarEvents,
        activeCalendarUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
