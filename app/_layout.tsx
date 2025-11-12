import { AppProvider } from "@/contexts/AppContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useApiSync } from "@/services/apiSync";
import { queryClient } from "@/services/queryClient";
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
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

// 앱 초기화 및 딥링크 처리를 위한 커스텀 훅 생성
const useAppInitialization = () => {
  const appInitializedRef = useRef(false);

  useEffect(() => {
    // 앱이 이미 초기화되었는지 확인
    if (appInitializedRef.current) {
      ("앱이 이미 초기화되었습니다");
      return;
    }

    // 앱이 초기화되었음을 표시
    appInitializedRef.current = true;

    // 앱 초기화 로직 시작
    const initializeApp = async () => {
      try {
        // 기본 서비스 초기화
        await NotificationManager.getInstance().init();
        initializeKakaoSDK(process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || "");

        // 스플래시 화면 숨기기
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("[앱 초기화] 오류:", error);
        // 오류가 발생해도 스플래시 화면 숨김
        await SplashScreen.hideAsync();
      }
    };

    // 앱 초기화 실행
    initializeApp();
  }, []);

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
