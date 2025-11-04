import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본 설정
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분 (이전 cacheTime)
      retry: (failureCount, error) => {
        // 네트워크 에러인 경우 재시도
        if (error instanceof Error && error.message.includes("network")) {
          return failureCount < 3;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // 뮤테이션 설정
      retry: false,
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});
