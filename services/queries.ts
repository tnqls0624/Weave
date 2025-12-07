import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schedule, User } from "../types";
import { apiService } from "./api";
import { updateWidgetData } from "../widgets/widgetTaskHandler";

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
  workspaceGallery: (id: string) => ["workspaces", id, "gallery"] as const,

  // Schedule (Schedule)
  schedules: ["schedules"] as const,
  schedule: (id: string) => ["schedules", id] as const,
  scheduleCounts: (id: string) => ["schedules", id, "counts"] as const,

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

// 스케줄 카운트 조회 (댓글 수, 사진 수) - 상세 페이지에서만 사용
export const useScheduleCounts = (scheduleId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.scheduleCounts(scheduleId),
    queryFn: () => apiService.getScheduleCounts(scheduleId),
    enabled: options?.enabled !== undefined ? options.enabled : !!scheduleId,
    staleTime: 30 * 1000, // 30초 - 자주 변할 수 있음
    gcTime: 5 * 60 * 1000, // 5분
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
    onSuccess: async (newSchedule) => {
      // 새로운 스케줄 캐시에 추가
      queryClient.setQueryData(queryKeys.schedule(newSchedule.id), newSchedule);

      // 모든 워크스페이스 스케줄 캐시 강제 리셋 (staleTime 무시하고 즉시 refetch)
      await queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "workspaces" &&
            (key[2] === "schedules" || key[2] === "feed")
          );
        },
      });

      // schedules 쿼리도 리셋
      await queryClient.resetQueries({ queryKey: queryKeys.schedules });
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
    onSuccess: async (updatedSchedule) => {
      // 업데이트된 스케줄 캐시 업데이트
      queryClient.setQueryData(
        queryKeys.schedule(updatedSchedule.id),
        updatedSchedule
      );

      // 모든 워크스페이스 스케줄 캐시 강제 리셋 (staleTime 무시하고 즉시 refetch)
      await queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "workspaces" &&
            (key[2] === "schedules" || key[2] === "feed")
          );
        },
      });

      // schedules 쿼리도 리셋
      await queryClient.resetQueries({ queryKey: queryKeys.schedules });
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

// ==================== Schedule Comments ====================
export const useScheduleComments = (scheduleId: string) => {
  return useQuery({
    queryKey: ["schedules", scheduleId, "comments"],
    queryFn: () => apiService.getScheduleComments(scheduleId),
    enabled: !!scheduleId,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  });
};

export const useCreateScheduleComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      content,
      parentId,
      mentions,
    }: {
      scheduleId: string;
      content: string;
      parentId?: string;
      mentions?: string[];
    }) => apiService.createScheduleComment(scheduleId, content, parentId, mentions),
    onSuccess: (_, variables) => {
      // 댓글 목록 캐시만 무효화 (commentCount는 로컬 상태로 관리)
      queryClient.invalidateQueries({
        queryKey: ["schedules", variables.scheduleId, "comments"],
      });
    },
  });
};

export const useUpdateScheduleComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      commentId,
      content,
    }: {
      scheduleId: string;
      commentId: string;
      content: string;
    }) => apiService.updateScheduleComment(scheduleId, commentId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["schedules", variables.scheduleId, "comments"],
      });
    },
  });
};

export const useDeleteScheduleComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      commentId,
    }: {
      scheduleId: string;
      commentId: string;
    }) => apiService.deleteScheduleComment(scheduleId, commentId),
    onSuccess: (_, variables) => {
      // 댓글 목록 캐시만 무효화 (commentCount는 로컬 상태로 관리)
      queryClient.invalidateQueries({
        queryKey: ["schedules", variables.scheduleId, "comments"],
      });
    },
  });
};

// ==================== Comment Reactions ====================
export const useToggleCommentReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      commentId,
      emoji,
    }: {
      scheduleId: string;
      commentId: string;
      emoji: string;
    }) => apiService.toggleCommentReaction(commentId, emoji),
    onSuccess: (_, variables) => {
      // 댓글 목록 캐시 무효화 (리액션 정보 포함)
      queryClient.invalidateQueries({
        queryKey: ["schedules", variables.scheduleId, "comments"],
      });
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
    onSuccess: async (updatedUser) => {
      // 사용자 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });

      // 업데이트된 사용자 캐시 업데이트
      queryClient.setQueryData(queryKeys.user(updatedUser.id), updatedUser);

      // 워크스페이스 캐시도 무효화 (사용자 아바타 등이 포함되어 있음)
      await queryClient.resetQueries({ queryKey: queryKeys.workspaces });

      // 피드 캐시도 무효화
      await queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "workspaces" &&
            key[2] === "feed"
          );
        },
      });
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

// ==================== Notification History ====================
import { notificationHistoryService } from "./notificationHistoryService";
import { NotificationItem } from "../types";

export const useNotificationHistory = () => {
  return useQuery({
    queryKey: ["notificationHistory"],
    queryFn: () => notificationHistoryService.getNotificationHistory(),
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: ["notificationUnreadCount"],
    queryFn: () => notificationHistoryService.getUnreadCount(),
    staleTime: 30 * 1000, // 30초
    gcTime: 1 * 60 * 1000, // 1분
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationHistoryService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationHistory"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationHistoryService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationHistory"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationHistoryService.clearAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationHistory"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
  });
};

// ==================== Schedule Checklist ====================

export const useScheduleChecklist = (scheduleId: string) => {
  return useQuery({
    queryKey: ["scheduleChecklist", scheduleId],
    queryFn: () => apiService.getScheduleChecklist(scheduleId),
    enabled: !!scheduleId,
    staleTime: 1 * 60 * 1000,
  });
};

export const useAddChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, content }: { scheduleId: string; content: string }) =>
      apiService.addChecklistItem(scheduleId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduleChecklist", variables.scheduleId] });
    },
  });
};

export const useToggleChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, itemId }: { scheduleId: string; itemId: string }) =>
      apiService.toggleChecklistItem(scheduleId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduleChecklist", variables.scheduleId] });
    },
  });
};

export const useUpdateChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, itemId, content }: { scheduleId: string; itemId: string; content: string }) =>
      apiService.updateChecklistItem(scheduleId, itemId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduleChecklist", variables.scheduleId] });
    },
  });
};

export const useDeleteChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, itemId }: { scheduleId: string; itemId: string }) =>
      apiService.deleteChecklistItem(scheduleId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduleChecklist", variables.scheduleId] });
    },
  });
};

// ==================== Schedule Photos ====================

export const useSchedulePhotos = (scheduleId: string) => {
  return useQuery({
    queryKey: ["schedulePhotos", scheduleId],
    queryFn: () => apiService.getSchedulePhotos(scheduleId),
    enabled: !!scheduleId,
    staleTime: 1 * 60 * 1000,
  });
};

export const useUploadSchedulePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, imageUri, caption }: { scheduleId: string; imageUri: string; caption?: string }) =>
      apiService.uploadSchedulePhoto(scheduleId, imageUri, caption),
    onSuccess: (_, variables) => {
      // 사진 목록 캐시만 무효화 (photoCount는 모달 닫을 때 갱신)
      queryClient.invalidateQueries({ queryKey: ["schedulePhotos", variables.scheduleId] });
    },
  });
};

export const useDeleteSchedulePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, photoId }: { scheduleId: string; photoId: string }) =>
      apiService.deleteSchedulePhoto(scheduleId, photoId),
    onSuccess: (_, variables) => {
      // 사진 목록 캐시만 무효화 (photoCount는 모달 닫을 때 갱신)
      queryClient.invalidateQueries({ queryKey: ["schedulePhotos", variables.scheduleId] });
    },
  });
};

// ==================== Location Reminder ====================

export const useLocationReminder = (scheduleId: string) => {
  return useQuery({
    queryKey: ["locationReminder", scheduleId],
    queryFn: () => apiService.getLocationReminder(scheduleId),
    enabled: !!scheduleId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSetLocationReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: string;
      data: { latitude: number; longitude: number; radius: number; address?: string; placeName?: string };
    }) => apiService.setLocationReminder(scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["locationReminder", variables.scheduleId] });
    },
  });
};

export const useToggleLocationReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, isEnabled }: { scheduleId: string; isEnabled: boolean }) =>
      apiService.toggleLocationReminder(scheduleId, isEnabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["locationReminder", variables.scheduleId] });
    },
  });
};

export const useDeleteLocationReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => apiService.deleteLocationReminder(scheduleId),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ["locationReminder", scheduleId] });
    },
  });
};

// ==================== Place Search ====================

export const useSearchPlaces = () => {
  return useMutation({
    mutationFn: ({ query, display = 5 }: { query: string; display?: number }) =>
      apiService.searchPlaces(query, display),
  });
};

// ==================== Workspace Gallery ====================

export const useWorkspaceGallery = (
  workspaceId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: queryKeys.workspaceGallery(workspaceId),
    queryFn: () => apiService.getWorkspaceGallery(workspaceId),
    enabled: options?.enabled !== undefined ? options.enabled : !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000, // 30분
    refetchOnWindowFocus: false,
  });
};
