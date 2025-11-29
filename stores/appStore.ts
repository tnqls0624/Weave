import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hexToColorName } from "../services/api";
import {
  useMyProfile,
  useMyWorkspaces,
  useWorkspaceSchedules,
} from "../services/queries";
import { Calendar, Schedule, User } from "../types";

// 기본 캘린더 (fallback용)
const DEFAULT_CALENDAR: Calendar = {
  id: "family",
  name: "Family Calendar",
  master: "",
  users: [],
};

type SettingsPage = "main" | "account" | "tags" | "notifications" | "privacy";

interface AppState {
  // Auth State
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;

  // UI State
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Workspace (Calendar)
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  detailDrawerDate: Date | null;
  setDetailDrawerDate: (date: Date | null) => void;

  // Schedule Editing
  scheduleToEdit: Schedule | null;
  setScheduleToEdit: (schedule: Schedule | null) => void;

  // Settings Page State
  settingsPage: SettingsPage;
  setSettingsPage: (page: SettingsPage) => void;
  resetSettingsPage: () => void;

  // Actions
  handleSelectWorkspace: (workspaceId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth State
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },
      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      // UI State
      isSidebarOpen: false,
      setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
      isSearchOpen: false,
      setIsSearchOpen: (open) => set({ isSearchOpen: open }),

      // Workspace (Calendar)
      activeWorkspaceId: "family",
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      calendarDate: new Date(),
      setCalendarDate: (date) => set({ calendarDate: date }),
      detailDrawerDate: null,
      setDetailDrawerDate: (date) => set({ detailDrawerDate: date }),

      // Schedule Editing
      scheduleToEdit: null,
      setScheduleToEdit: (schedule) => set({ scheduleToEdit: schedule }),

      // Settings Page State
      settingsPage: "main",
      setSettingsPage: (page) => set({ settingsPage: page }),
      resetSettingsPage: () => set({ settingsPage: "main" }),

      // Actions
      handleSelectWorkspace: (workspaceId) => {
        const state = get();
        state.setActiveWorkspaceId(workspaceId);
        state.setIsSidebarOpen(false);
      },
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // 영구 저장할 상태만 선택
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);

// React Query를 사용하는 커스텀 훅들 (컴포넌트에서 사용)
export const useAppData = () => {
  const { activeWorkspaceId, calendarDate, setActiveWorkspaceId } =
    useAppStore();

  // 현재 연도 기준 스케줄 조회 (월 변경 시 재요청 방지)
  const currentYear = calendarDate.getFullYear();

  const {
    data: workspaces = [],
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useMyWorkspaces();

  // 워크스페이스가 로드되면 activeWorkspaceId 자동 설정
  useEffect(() => {
    if (Array.isArray(workspaces) && workspaces.length > 0) {
      const isValidWorkspace = workspaces.some(
        (w: any) => w.id === activeWorkspaceId
      );
      if (!isValidWorkspace) {
        // activeWorkspaceId가 유효하지 않으면 첫 번째 워크스페이스로 설정
        setActiveWorkspaceId(workspaces[0].id);
      }
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId]);

  // 유효한 activeWorkspaceId가 있을 때만 스케줄 조회
  const shouldFetchSchedules =
    Array.isArray(workspaces) &&
    workspaces.length > 0 &&
    workspaces.some((w: any) => w.id === activeWorkspaceId);

  // 연도 단위로 스케줄 조회 (월 변경해도 재요청 없음)
  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    error: schedulesError,
  } = useWorkspaceSchedules(
    shouldFetchSchedules ? activeWorkspaceId : "",
    {
      year: currentYear,
    },
    { enabled: shouldFetchSchedules }
  );

  // 로그인한 사용자 프로필 조회 (인증된 경우에만)
  const { data: currentUserProfile, isLoading: profileLoading } =
    useMyProfile();

  // workspaces와 schedules가 배열인지 확인 (메모이제이션)
  const workspacesArray = useMemo(
    () => (Array.isArray(workspaces) ? workspaces : []),
    [workspaces]
  );

  const schedulesArray = useMemo(
    () => (Array.isArray(schedules) ? schedules : []),
    [schedules]
  );

  // 활성 워크스페이스 (메모이제이션)
  const activeWorkspace = useMemo(
    () =>
      workspacesArray.find((w: any) => w.id === activeWorkspaceId) ||
      workspacesArray[0] ||
      DEFAULT_CALENDAR,
    [workspacesArray, activeWorkspaceId]
  );

  // 워크스페이스의 users 배열에서 사용자 정보를 가져와 participantColors와 결합
  const users = useMemo(() => {
    const participantColors = activeWorkspace.participantColors || {};
    const userMap = new Map<string, User>();

    // 워크스페이스의 users 배열에서 사용자 정보 가져오기
    if (Array.isArray(activeWorkspace.users)) {
      activeWorkspace.users.forEach((user: any) => {
        // user가 객체인 경우
        if (typeof user === "object" && user.id) {
          const hexColor = participantColors[user.id];
          // participantColors에 없으면 user.color를 사용, 그것도 없으면 gray
          const finalColor = hexColor
            ? hexToColorName(hexColor)
            : user.color || "gray";

          userMap.set(user.id, {
            id: user.id,
            name: user.name || "",
            birthday: user.birthday || "",
            avatarUrl: user.avatarUrl || "",
            color: finalColor,
          });
        }
      });
    }

    // 현재 로그인한 사용자도 추가 (없으면)
    if (currentUserProfile && !userMap.has(currentUserProfile.id)) {
      const hexColor = participantColors[currentUserProfile.id];
      const finalColor = hexColor
        ? hexToColorName(hexColor)
        : currentUserProfile.color || "gray"; // blue 대신 gray 기본값

      userMap.set(currentUserProfile.id, {
        id: currentUserProfile.id,
        name: currentUserProfile.name || "",
        avatarUrl: currentUserProfile.avatarUrl || "",
        color: finalColor,
      });
    }

    return Array.from(userMap.values());
  }, [activeWorkspace, currentUserProfile]);

  // 활성 워크스페이스의 참여자 필터링 (메모이제이션)
  const activeWorkspaceUsers = useMemo(() => {
    if (!schedulesArray || schedulesArray.length === 0) {
      return users;
    }
    const participantIds = new Set<string>(
      schedulesArray.flatMap(
        (schedule: any) =>
          schedule.participants || schedule.participantIds || []
      )
    );
    // 로그인한 사용자 ID 추가 (프로필에서 가져옴)
    if (currentUserProfile?.id) {
      participantIds.add(currentUserProfile.id);
    }
    return users.filter((user) => participantIds.has(user.id));
  }, [schedulesArray, users, currentUserProfile?.id]);

  // 반환값 메모이제이션
  return useMemo(
    () => ({
      // Schedule 데이터
      schedules: schedulesArray,
      users,
      workspaces: workspacesArray,
      activeWorkspace,
      activeWorkspaceUsers,
      // 현재 로그인한 사용자
      currentUser: currentUserProfile,
      isLoading: schedulesLoading || workspacesLoading || profileLoading,
      error: schedulesError || workspacesError,
    }),
    [
      schedulesArray,
      users,
      workspacesArray,
      activeWorkspace,
      activeWorkspaceUsers,
      currentUserProfile,
      schedulesLoading,
      workspacesLoading,
      profileLoading,
      schedulesError,
      workspacesError,
    ]
  );
};

// useCalendars는 useMyWorkspaces를 사용하도록 설정
export { useMyWorkspaces as useCalendars };
