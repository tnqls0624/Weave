import { AppProvider } from "@/contexts/AppContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { apiService } from "@/services/api";
import { useApiSync } from "@/services/apiSync";
import locationTrackingService from "@/services/locationTrackingService";
import locationWebSocketService from "@/services/locationWebSocketService";
import { queryKeys } from "@/services/queries";
import { queryClient } from "@/services/queryClient";
import { useAppStore } from "@/stores/appStore";
import NotificationManager from "@/utils/notification";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

const prefetchWorkspaceSchedulesForYear = async (
  workspaceId: string,
  currentYear: number
) => {
  const yearData = await queryClient.fetchQuery({
    queryKey: queryKeys.workspaceSchedules(workspaceId, { year: currentYear }),
    queryFn: async () => {
      const data = await apiService.getWorkspaceSchedules(workspaceId, {
        year: currentYear,
      });
      return data;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // 가져온 데이터를 각 월별 캐시에도 저장
  for (let month = 1; month <= 12; month++) {
    const monthData = yearData.filter((schedule) => {
      const scheduleDate = dayjs(schedule.startDate);
      return (
        scheduleDate.year() === currentYear &&
        scheduleDate.month() + 1 === month
      );
    });

    queryClient.setQueryData(
      queryKeys.workspaceSchedules(workspaceId, {
        year: currentYear,
        month,
      }),
      monthData
    );
  }
};

const getPrefetchCacheKey = (workspaceId: string, year: number) =>
  `${workspaceId}-${year}`;

// 앱 초기화 및 딥링크 처리를 위한 커스텀 훅 생성
const useAppInitialization = () => {
  const appInitializedRef = useRef(false);
  const splashHiddenRef = useRef(false);
  const prefetchedWindowRef = useRef<Set<string>>(new Set());
  const locationSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const { isAuthenticated, activeWorkspaceId } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. 기본 앱 초기화 (항상 실행)
        if (!appInitializedRef.current) {
          await NotificationManager.getInstance().init();
          initializeKakaoSDK(
            process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || ""
          );
          appInitializedRef.current = true;
        }

        // 2. 인증된 경우 데이터 프리페치
        if (isAuthenticated && activeWorkspaceId) {
          const currentYear = dayjs().year();
          const cacheKey = getPrefetchCacheKey(activeWorkspaceId, currentYear);

          if (!prefetchedWindowRef.current.has(cacheKey)) {
            await prefetchWorkspaceSchedulesForYear(
              activeWorkspaceId,
              currentYear
            );
            prefetchedWindowRef.current.add(cacheKey);
          }

          // 3. workspace 데이터도 기다림 (users 포함)
          await queryClient.prefetchQuery({
            queryKey: queryKeys.workspace(activeWorkspaceId),
            queryFn: () => apiService.getWorkspace(activeWorkspaceId),
            staleTime: 30 * 60 * 1000,
          });

          // 4. 위치 공유 상태 확인 및 자동 재개
          try {
            const userProfile = await queryClient.fetchQuery({
              queryKey: queryKeys.profile,
              queryFn: () => apiService.getMyProfile(),
              staleTime: 10 * 60 * 1000,
            });

            // 위치 공유가 활성화되어 있으면 백그라운드 추적 시작
            if (userProfile?.locationEnabled) {
              console.log("📍 [Auto-Resume] Starting background location tracking...");
              const success = await locationTrackingService.startBackgroundTracking(
                activeWorkspaceId
              );
              if (success) {
                console.log("✅ [Auto-Resume] Background location tracking started successfully");
              } else {
                console.warn("⚠️ [Auto-Resume] Failed to start background location tracking");
              }
            } else {
              console.log("ℹ️ [Auto-Resume] Location sharing is disabled, skipping location tracking");
            }
          } catch (error) {
            console.error("❌ [Auto-Resume] Failed to check location sharing status:", error);
          }
        }
      } catch (error) {
      } finally {
        // 4. 모든 초기화 완료 후 스플래시 숨김
        if (!splashHiddenRef.current) {
          await SplashScreen.hideAsync();
          splashHiddenRef.current = true;
        }
      }
    };

    // 앱 초기화 실행
    initializeApp();
  }, [isAuthenticated, activeWorkspaceId]);

  // WebSocket 실시간 위치 스트리밍 구독 (포그라운드 감지)
  useEffect(() => {
    if (!isAuthenticated || !activeWorkspaceId) {
      return;
    }

    const subscribeToLocationStream = async () => {
      // 기존 구독이 있으면 해제
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.unsubscribe();
        locationSubscriptionRef.current = null;
      }

      try {
        console.log("🔌 [App] Subscribing to location WebSocket stream...");

        // 초기 위치 데이터 가져오기 (React Query 캐시 업데이트)
        await queryClient.prefetchQuery({
          queryKey: ["workspaces", activeWorkspaceId, "locations"],
          queryFn: () => apiService.getWorkspaceUserLocations(activeWorkspaceId),
          staleTime: 5 * 1000, // 5초간 캐시 유지
        });

        // WebSocket 스트림 구독
        locationSubscriptionRef.current = await locationWebSocketService.streamLocations(
          activeWorkspaceId,
          (locationData: any) => {
            // 실시간 위치 업데이트를 React Query 캐시에 반영
            queryClient.setQueryData(
              ["workspaces", activeWorkspaceId, "locations"],
              (oldData: any) => {
                if (!oldData || !Array.isArray(oldData)) {
                  return [locationData];
                }

                const userId = locationData.userId || locationData.id;
                const existingIndex = oldData.findIndex((loc: any) =>
                  (loc.userId || loc.id) === userId
                );

                if (existingIndex !== -1) {
                  // 기존 사용자 위치 업데이트
                  const updated = [...oldData];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...locationData,
                  };
                  return updated;
                } else {
                  // 새 사용자 추가
                  return [...oldData, locationData];
                }
              }
            );
          }
        );

        console.log("✅ [App] WebSocket location stream subscribed");
      } catch (error) {
        console.error("❌ [App] Failed to subscribe to location stream:", error);
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        console.log("🟢 [App] App came to foreground, subscribing to location stream");
        subscribeToLocationStream();
      } else if (nextAppState === "background") {
        console.log("🔴 [App] App went to background");
        // 백그라운드에서도 구독 유지 (선택사항)
        // locationSubscriptionRef.current?.unsubscribe();
      }
    };

    // 초기 구독
    subscribeToLocationStream();

    // AppState 리스너 등록
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      // 클린업
      subscription.remove();
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.unsubscribe();
        locationSubscriptionRef.current = null;
      }
    };
  }, [isAuthenticated, activeWorkspaceId]);

  return null;
};

// API 동기화 컴포넌트
function ApiSyncProvider({ children }: { children: React.ReactNode }) {
  useApiSync();
  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // 앱 초기화 훅 사용
  useAppInitialization();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <ApiSyncProvider>
              <NotificationProvider>
                <ThemeProvider
                  value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                >
                  <Stack>
                    <Stack.Screen
                      name="index"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="login"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="create"
                      options={{ presentation: "modal", headerShown: false }}
                    />
                    {/* TEMPORARILY DISABLED - Security features */}
                    {/* <Stack.Screen
                      name="phishing-settings"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="phishing-history"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="manual-check"
                      options={{ headerShown: false }}
                    /> */}
                  </Stack>
                  <StatusBar style="auto" />
                </ThemeProvider>
              </NotificationProvider>
            </ApiSyncProvider>
          </AppProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
