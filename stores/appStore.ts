import { create } from "zustand";
import { CALENDARS } from "../constants";
import { useCalendars, useEvents, useUsers } from "../services/queries";
import { Event } from "../types";

interface AppState {
  // UI State (Zustand에서 관리)
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Calendar
  activeCalendarId: string;
  setActiveCalendarId: (id: string) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  detailDrawerDate: Date | null;
  setDetailDrawerDate: (date: Date | null) => void;

  // Event Editing
  eventToEdit: Event | null;
  setEventToEdit: (event: Event | null) => void;

  // Actions
  handleSelectCalendar: (calendarId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // UI State
  isSidebarOpen: false,
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  isSearchOpen: false,
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),

  // Calendar
  activeCalendarId: "family",
  setActiveCalendarId: (id) => set({ activeCalendarId: id }),
  calendarDate: new Date(),
  setCalendarDate: (date) => set({ calendarDate: date }),
  detailDrawerDate: null,
  setDetailDrawerDate: (date) => set({ detailDrawerDate: date }),

  // Event Editing
  eventToEdit: null,
  setEventToEdit: (event) => set({ eventToEdit: event }),

  // Actions
  handleSelectCalendar: (calendarId) => {
    const state = get();
    state.setActiveCalendarId(calendarId);
    state.setIsSidebarOpen(false);
  },
}));

// React Query를 사용하는 커스텀 훅들 (컴포넌트에서 사용)
export const useAppData = () => {
  const { activeCalendarId } = useAppStore();

  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError,
  } = useEvents(activeCalendarId);
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
  } = useUsers();
  const {
    data: calendars = [],
    isLoading: calendarsLoading,
    error: calendarsError,
  } = useCalendars();

  const activeCalendar =
    calendars.find((c) => c.id === activeCalendarId) ||
    calendars[0] ||
    CALENDARS[0];

  const calendarEvents = events.filter(
    (event) => event.calendarId === activeCalendarId
  );

  const activeCalendarUsers = (() => {
    const participantIds = new Set(
      calendarEvents.flatMap((event) => event.participantIds)
    );
    const currentUser = users.find((u) => u.id === "user1");
    if (currentUser) {
      participantIds.add(currentUser.id);
    }
    return users.filter((user) => participantIds.has(user.id));
  })();

  return {
    events: calendarEvents,
    users,
    calendars,
    activeCalendar,
    activeCalendarUsers,
    isLoading: eventsLoading || usersLoading || calendarsLoading,
    error: eventsError || usersError || calendarsError,
  };
};
