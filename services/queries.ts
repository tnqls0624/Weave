import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Event, User } from "../types";
import { apiService } from "./api";

// Query Keys
export const queryKeys = {
  events: ["events"] as const,
  event: (id: string) => ["events", id] as const,
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
  calendars: ["calendars"] as const,
  calendar: (id: string) => ["calendars", id] as const,
};

// Events Queries
export const useEvents = (calendarId?: string) => {
  return useQuery({
    queryKey: calendarId
      ? [...queryKeys.events, { calendarId }]
      : queryKeys.events,
    queryFn: () => apiService.getEvents(calendarId),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
};

export const useEvent = (eventId: string) => {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => apiService.getEvent(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Users Queries
export const useUsers = () => {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => apiService.getUsers(),
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
  });
};

export const useUser = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => apiService.getUser(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

// Calendars Queries
export const useCalendars = () => {
  return useQuery({
    queryKey: queryKeys.calendars,
    queryFn: () => apiService.getCalendars(),
    staleTime: 30 * 60 * 1000, // 30분
    gcTime: 60 * 60 * 1000, // 1시간
  });
};

export const useCalendar = (calendarId: string) => {
  return useQuery({
    queryKey: queryKeys.calendar(calendarId),
    queryFn: () => apiService.getCalendar(calendarId),
    enabled: !!calendarId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

// Mutations
export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventData: Omit<Event, "id">) =>
      apiService.createEvent(eventData as Omit<Event, "id">),
    onSuccess: (newEvent) => {
      // 이벤트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.events });

      // 새로운 이벤트 캐시에 추가
      queryClient.setQueryData(queryKeys.event(newEvent.id), newEvent);
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      eventData,
    }: {
      eventId: string;
      eventData: Partial<Event>;
    }) => apiService.updateEvent(eventId, eventData as Partial<Event>),
    onSuccess: (updatedEvent) => {
      // 이벤트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.events });

      // 업데이트된 이벤트 캐시 업데이트
      queryClient.setQueryData(queryKeys.event(updatedEvent.id), updatedEvent);
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => apiService.deleteEvent(eventId),
    onSuccess: (_, eventId) => {
      // 이벤트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.events });

      // 삭제된 이벤트 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      userData,
    }: {
      userId: string;
      userData: Partial<User>;
    }) => apiService.updateUser(userId, userData),
    onSuccess: (updatedUser) => {
      // 사용자 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.users });

      // 업데이트된 사용자 캐시 업데이트
      queryClient.setQueryData(queryKeys.user(updatedUser.id), updatedUser);
    },
  });
};
