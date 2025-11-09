import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { apiService } from "./api";

/**
 * Zustand 스토어의 토큰을 ApiService와 동기화하는 훅
 */
export const useApiSync = () => {
  const { accessToken, refreshToken, isAuthenticated } = useAppStore();

  useEffect(() => {
    if (isAuthenticated && accessToken && refreshToken) {
      apiService.setTokens(accessToken, refreshToken);
    } else {
      // 로그아웃 시 토큰 제거
      apiService.clearTokens();
      console.log("🔒 [API Sync] Tokens cleared (not authenticated)");
    }
  }, [accessToken, refreshToken, isAuthenticated]);
};
