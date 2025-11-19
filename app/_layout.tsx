import { AppProvider } from "@/contexts/AppContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { apiService } from "@/services/api";
import { useApiSync } from "@/services/apiSync";
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
  const { isAuthenticated, activeWorkspaceId } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!appInitializedRef.current) {
          await NotificationManager.getInstance().init();
          initializeKakaoSDK(
            process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || ""
          );
          appInitializedRef.current = true;
        }

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
        }
      } catch (error) {
        console.error("[앱 초기화] 오류:", error);
      }

      if (!splashHiddenRef.current) {
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
