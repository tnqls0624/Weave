import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schedule, User } from "../types";
import { apiService } from "./api";

// Query Keys
export const queryKeys = {
  // Auth
  auth: ["auth"] as const,
  profile: ["profile"] as const,

  // Workspace (Calendar)
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspaces", id] as const,
  workspaceSchedules: (id: string, params?: any) =>
    ["workspaces", id, "schedules", params] as const,
  workspaceScheduleFeed: (id: string) => ["workspaces", id, "feed"] as const,

  // Schedule (Schedule)
  schedules: ["schedules"] as const,
  schedule: (id: string) => ["schedules", id] as const,

  // Users
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
};

// ==================== Auth Queries ====================
export const useSocialLogin = () => {
  return useMutation({
    mutationFn: (data: {
      provider: "google" | "apple" | "kakao";
      token: string;
    }) => apiService.socialLogin(data),
    onSuccess: (response) => {
      // 로그인 성공 시 프로필 캐시 설정
      // Access Token 저장
      apiService.setTokens(response.accessToken, response.refreshToken);
    },
  });
};

// ==================== User Queries ====================
export const useMyProfile = () => {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiService.getMyProfile(),
    staleTime: 10 * 60 * 1000, // 10분 - 프로필은 자주 변경되지 않음
    gcTime: 60 * 60 * 1000, // 1시간
  });
};

// ==================== Schedule Queries ====================
export const useSchedule = (scheduleId: string) => {
  return useQuery({
    queryKey: queryKeys.schedule(scheduleId),
    queryFn: () => apiService.getSchedule(scheduleId),
    enabled: !!scheduleId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
};

// ==================== Workspace Queries ====================
export const useMyWorkspaces = () => {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => apiService.getMyWorkspaces(),
    staleTime: 5 * 60 * 1000, // 5분 - 캐시 활용으로 성능 최적화
    gcTime: 60 * 60 * 1000, // 1시간
  });
};

export const useWorkspace = (workspaceId: string) => {
  return useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => apiService.getWorkspace(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30 * 60 * 1000, // 30분
    gcTime: 60 * 60 * 1000, // 1시간
  });
};

export const useWorkspaceSchedules = (
  workspaceId: string,
  params?: { year?: number; month?: number; week?: number; day?: number },
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: queryKeys.workspaceSchedules(workspaceId, params),
    queryFn: () => apiService.getWorkspaceSchedules(workspaceId, params),
    enabled: options?.enabled !== undefined ? options.enabled : !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5분 - 캐시 활용으로 성능 최적화
    gcTime: 30 * 60 * 1000, // 30분
  });
};

export const useWorkspaceScheduleFeed = (
  workspaceId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: queryKeys.workspaceScheduleFeed(workspaceId),
    queryFn: () => apiService.getWorkspaceScheduleFeed(workspaceId),
    enabled: options?.enabled !== undefined ? options.enabled : !!workspaceId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useCalendars = () => {
  return useMyWorkspaces();
};

export const useCalendar = (calendarId: string) => {
  return useWorkspace(calendarId);
};

// ==================== Location Queries ====================
export const useWorkspaceUserLocations = (
  workspaceId: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) => {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "locations"],
    queryFn: () => apiService.getWorkspaceUserLocations(workspaceId),
    enabled: options?.enabled !== undefined ? options.enabled : !!workspaceId,
    refetchInterval: options?.refetchInterval || 10000, // 기본 10초마다 자동 refetch
    staleTime: 5000, // 5초
    gcTime: 30000, // 30초
  });
};

export const useUpdateParticipantColors = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      participantColors,
    }: {
      workspaceId: string;
      participantColors: Record<string, string>;
    }) => apiService.updateParticipantColors(workspaceId, participantColors),
    onSuccess: async (_, variables) => {
      // 1. 워크스페이스 쿼리를 완전히 리셋 (staleTime 무시하고 강제 refetch)
      await queryClient.resetQueries({
        queryKey: queryKeys.workspaces,
      });

      // 2. 모든 스케줄 쿼리도 완전히 리셋
      await queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "workspaces" &&
            key[1] === variables.workspaceId &&
            key[2] === "schedules"
          );
        },
      });
    },
  });
};

// ==================== Mutations ====================
export const useCreateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleData: Omit<Schedule, "id">) =>
      apiService.createSchedule(scheduleData),
    onSuccess: (newSchedule) => {
      // 워크스페이스 스케줄 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });

      // 새로운 스케줄 캐시에 추가
      queryClient.setQueryData(queryKeys.schedule(newSchedule.id), newSchedule);
    },
  });
};

export const useUpdateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      scheduleData,
    }: {
      scheduleId: string;
      scheduleData: Partial<Schedule>;
    }) => apiService.updateSchedule(scheduleId, scheduleData),
    onSuccess: (updatedSchedule) => {
      // 워크스페이스 스케줄 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });

      // 업데이트된 스케줄 캐시 업데이트
      queryClient.setQueryData(
        queryKeys.schedule(updatedSchedule.id),
        updatedSchedule
      );
    },
  });
};

export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => apiService.deleteSchedule(scheduleId),
    onSuccess: (_, scheduleId) => {
      // 워크스페이스 스케줄 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });

      // 삭제된 스케줄 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.schedule(scheduleId) });
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
      // 사용자 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });

      // 업데이트된 사용자 캐시 업데이트
      queryClient.setQueryData(queryKeys.user(updatedUser.id), updatedUser);
    },
  });
};

// Location Mutations
export const useUpdateMyLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (location: { latitude: number; longitude: number }) =>
      apiService.updateMyLocation(location),
    onSuccess: () => {
      // 워크스페이스 위치 정보 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

// Notification Mutations
export const useUpdateNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pushEnabled: boolean) =>
      apiService.updateNotifications(pushEnabled),
    onSuccess: () => {
      // 사용자 프로필 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
};
