import { AppProvider } from "@/contexts/AppContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { apiService } from "@/services/api";
import { useApiSync } from "@/services/apiSync";
import { queryClient } from "@/services/queryClient";
import { queryKeys } from "@/services/queries";
import { useAppStore } from "@/stores/appStore";
import NotificationManager from "@/utils/notification";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import dayjs from "dayjs";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

const PREFETCH_MONTH_COUNT = 12;

const buildYearPrefetchPlan = (windowStart: dayjs.Dayjs) =>
  Array.from({ length: PREFETCH_MONTH_COUNT }, (_, index) => {
    const targetMonth = windowStart.add(index, "month");
    return {
      year: targetMonth.year(),
      month: targetMonth.month() + 1,
    };
  });

const prefetchWorkspaceSchedulesForYear = async (
  workspaceId: string,
  windowStart: dayjs.Dayjs
) => {
  const monthsToPrefetch = buildYearPrefetchPlan(windowStart);

  await Promise.all(
    monthsToPrefetch.map(({ year, month }) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.workspaceSchedules(workspaceId, { year, month }),
        queryFn: () =>
          apiService.getWorkspaceSchedules(workspaceId, { year, month }),
        staleTime: 5 * 60 * 1000,
      })
    )
  );
};

const getPrefetchCacheKey = (workspaceId: string, windowStart: dayjs.Dayjs) =>
  `${workspaceId}-${windowStart.format("YYYY-MM")}`;

// 앱 초기화 및 딥링크 처리를 위한 커스텀 훅 생성
const useAppInitialization = () => {
  const appInitializedRef = useRef(false);
  const splashHiddenRef = useRef(false);
  const prefetchedWindowRef = useRef<Set<string>>(new Set());
  const { isAuthenticated, activeWorkspaceId } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!appInitializedRef.current) {
          // 기본 서비스 초기화 (최초 1회)
          await NotificationManager.getInstance().init();
          initializeKakaoSDK(
            process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || ""
          );
          appInitializedRef.current = true;
        }

        // 인증된 사용자는 스플래시 동안 1년치 스케줄을 프리페치
        if (isAuthenticated && activeWorkspaceId) {
          const windowStart = dayjs().startOf("month");
          const cacheKey = getPrefetchCacheKey(
            activeWorkspaceId,
            windowStart
          );

          if (!prefetchedWindowRef.current.has(cacheKey)) {
            await prefetchWorkspaceSchedulesForYear(
              activeWorkspaceId,
              windowStart
            );
            prefetchedWindowRef.current.add(cacheKey);
          }
        }
      } catch (error) {
        console.error("[앱 초기화] 오류:", error);
      }

      if (!splashHiddenRef.current) {
        // 오류가 발생해도 스플래시 화면 숨김
        await SplashScreen.hideAsync();
        splashHiddenRef.current = true;
      }
    };

    // 앱 초기화 실행
    initializeApp();
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
