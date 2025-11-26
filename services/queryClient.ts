import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본 설정 - 더 공격적인 캐싱
      staleTime: 15 * 60 * 1000, // 15분 (기본값을 더 길게)
      gcTime: 60 * 60 * 1000, // 1시간 (메모리에 더 오래 보관)
      retry: (failureCount, error) => {
        // 네트워크 에러인 경우 재시도
        if (error instanceof Error && error.message.includes("network")) {
          return failureCount < 2; // 재시도 횟수 줄임
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000), // 더 짧은 재시도 지연
      refetchOnWindowFocus: false, // 포커스 시 재요청 방지
      refetchOnReconnect: false, // 재연결 시 재요청 방지
      refetchOnMount: false, // 마운트 시 재요청 방지
      networkMode: "offlineFirst", // 오프라인 우선 모드
    },
    mutations: {
      // 뮤테이션 설정
      retry: false,
      networkMode: "offlineFirst", // 오프라인 우선 모드
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});
