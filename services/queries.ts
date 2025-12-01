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
    mutationFn: ({
      loginType,
      accessToken,
    }: {
      loginType: "GOOGLE" | "APPLE" | "KAKAO";
      accessToken: string;
    }) => apiService.socialLogin(loginType, accessToken),
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
    staleTime: 30 * 60 * 1000, // 30분 - 프로필은 자주 변경되지 않음
    gcTime: 2 * 60 * 60 * 1000, // 2시간 - 메모리에 더 오래 보관
    refetchOnWindowFocus: false, // 포커스 시 재요청 방지
    refetchOnReconnect: false, // 재연결 시 재요청 방지
  });
};

// ==================== Schedule Queries ====================
export const useSchedule = (scheduleId: string) => {
  return useQuery({
    queryKey: queryKeys.schedule(scheduleId),
    queryFn: () => apiService.getSchedule(scheduleId),
    enabled: !!scheduleId,
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
    refetchOnWindowFocus: false,
  });
};

// ==================== Workspace Queries ====================
export const useMyWorkspaces = () => {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => apiService.getMyWorkspaces(),
    staleTime: 15 * 60 * 1000, // 15분 - 워크스페이스는 자주 변경되지 않음
    gcTime: 2 * 60 * 60 * 1000, // 2시간
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const useWorkspace = (workspaceId: string) => {
  return useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => apiService.getWorkspace(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60 * 60 * 1000, // 1시간
    gcTime: 2 * 60 * 60 * 1000, // 2시간
    refetchOnWindowFocus: false,
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
    staleTime: 60 * 60 * 1000, // 1시간 - 더 긴 캐싱
    gcTime: 3 * 60 * 60 * 1000, // 3시간 - 메모리에 더 오래 유지
    refetchOnWindowFocus: false,
    refetchOnMount: false, // 마운트 시 재요청 방지
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
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 60 * 60 * 1000, // 1시간
    refetchOnWindowFocus: false,
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
    mutationFn: ({
      pushEnabled,
      fcmToken,
    }: {
      pushEnabled: boolean;
      fcmToken?: string;
    }) => apiService.updateNotifications(pushEnabled, fcmToken),
    onSuccess: () => {
      // 사용자 프로필 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
};

// ==================== Workspace Management Mutations ====================
export const useLeaveWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => apiService.leaveWorkspace(workspaceId),
    onSuccess: (_, workspaceId) => {
      // 워크스페이스 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      // 해당 워크스페이스의 스케줄 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.workspace(workspaceId) });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => apiService.deleteWorkspace(workspaceId),
    onSuccess: (_, workspaceId) => {
      // 워크스페이스 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      // 해당 워크스페이스의 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.workspace(workspaceId) });
    },
  });
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: { title?: string; thumbnailImage?: string };
    }) => apiService.updateWorkspace(workspaceId, data),
    onSuccess: (updatedWorkspace) => {
      // 워크스페이스 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      // 해당 워크스페이스 캐시 업데이트
      queryClient.setQueryData(
        queryKeys.workspace(updatedWorkspace.id),
        updatedWorkspace
      );
    },
  });
};

export const useKickWorkspaceMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
    }: {
      workspaceId: string;
      userId: string;
    }) => apiService.kickWorkspaceMember(workspaceId, userId),
    onSuccess: (_, variables) => {
      // 워크스페이스 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      // 해당 워크스페이스 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace(variables.workspaceId),
      });
    },
  });
};

// ==================== Prefetch Utilities ====================
export const usePrefetchAdjacentMonths = (
  workspaceId: string,
  year: number,
  month: number
) => {
  const queryClient = useQueryClient();

  const prefetchMonth = async (y: number, m: number) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workspaceSchedules(workspaceId, { year: y, month: m }),
      queryFn: () => apiService.getWorkspaceSchedules(workspaceId, { year: y, month: m }),
      staleTime: 60 * 60 * 1000,
      gcTime: 3 * 60 * 60 * 1000,
    });
  };

  // 이전/다음 달 프리페치
  const prefetchAdjacent = async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    // 병렬로 이전/다음 달 프리페치
    await Promise.all([
      prefetchMonth(prevYear, prevMonth),
      prefetchMonth(nextYear, nextMonth),
    ]);
  };

  return { prefetchAdjacent };
};

// 스케줄 상세 프리페치
export const usePrefetchSchedule = () => {
  const queryClient = useQueryClient();

  return (scheduleId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.schedule(scheduleId),
      queryFn: () => apiService.getSchedule(scheduleId),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });
  };
};
