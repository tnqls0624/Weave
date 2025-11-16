import { Client } from "@stomp/stompjs";
import { apiService } from "./api";

// STOMP Client 타입
type StompClient = Client;

// 환경변수 기반 WebSocket/STOMP 엔드포인트 (SockJS 미사용, 순수 WebSocket + STOMP)
const API_BASE_URL = "wss://api.weave.io.kr/api/ws";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: number;
  replyQueue?: string;
}

class LocationWebSocketService {
  private stompClient: StompClient | null = null;
  private isConnecting: boolean = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private streamSubscriptions = new Map<string, any>();
  private replySubscription: any = null;

  // STOMP 연결 (순수 WebSocket + STOMP, SockJS 미사용)
  async connect(): Promise<StompClient> {
    if (this.stompClient && this.stompClient.connected) {
      return this.stompClient;
    }

    // 연결 중이면 대기
    if (this.isConnecting) {
      // 연결이 완료될 때까지 대기
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.stompClient && this.stompClient.connected) {
        return this.stompClient;
      }
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${API_BASE_URL}`;
      const accessToken = apiService.getAccessToken();

      if (!accessToken) {
        throw new Error("No access token available for STOMP authentication");
      }

      const wsUrlWithToken = `${wsUrl}?token=${accessToken}`;

      // STOMP Client 생성 (순수 WebSocket + STOMP)
      // 쿼리 파라미터로만 토큰 전달 (connectHeader는 비워둠)
      this.stompClient = new Client({
        // React Native의 네이티브 WebSocket 사용
        webSocketFactory: () => {
          const ws = new WebSocket(wsUrlWithToken);
          return ws;
        },
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
      });

      return new Promise((resolve, reject) => {
        if (!this.stompClient) {
          reject(new Error("STOMP client is null"));
          return;
        }

        this.stompClient.onConnect = (frame: any) => {
          resolve(this.stompClient!);
        };

        this.stompClient.onStompError = (frame: any) => {
          reject(new Error(frame.headers?.message || "STOMP connection error"));
        };

        this.stompClient.onWebSocketError = (event: any) => {
          console.error("WebSocket error:", event);
        };

        this.stompClient.onWebSocketClose = (event: any) => {
          this.cleanup();
          if (this.isConnecting) {
            reject(
              new Error(
                `WebSocket closed during connection: ${
                  event?.reason || "Unknown"
                }`
              )
            );
          }
        };

        this.stompClient.onDisconnect = () => {
          this.cleanup();
        };

        this.stompClient.activate();
      });
    } catch (error) {
      this.stompClient = null;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // STOMP 메시지 전송 헬퍼
  private sendStompMessage(
    destination: string,
    body: any,
    headers: any = {}
  ): void {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    this.stompClient.publish({
      destination,
      body: JSON.stringify(body),
      headers,
    });
  }

  // 정리 헬퍼
  private cleanup(): void {
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error("STOMP disconnected"));
    }
    this.pendingRequests.clear();

    for (const [, subscription] of this.streamSubscriptions) {
      if (subscription) {
        subscription.unsubscribe();
      }
    }
    this.streamSubscriptions.clear();

    if (this.replySubscription) {
      this.replySubscription.unsubscribe();
      this.replySubscription = null;
    }

    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }

  // 워크스페이스의 현재 위치 조회 (Request-Response)
  async getLocations(workspaceId: string) {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }
    return new Promise((resolve, reject) => {
      // Spring이 자동으로 /user/{sessionId}/queue/locations로 변환
      // 클라이언트는 /user/queue/locations를 구독
      const replySubscription = this.stompClient!.subscribe(
        `/user/queue/locations`,
        (message: any) => {
          try {
            const locations = JSON.parse(message.body);
            console.log("✅ Received locations:", locations);
            replySubscription.unsubscribe();
            resolve(locations);
          } catch (error) {
            console.error("❌ Failed to parse locations:", error);
            replySubscription.unsubscribe();
            reject(error);
          }
        }
      );

      // 위치 조회 요청 전송
      this.sendStompMessage(`/app/workspace/${workspaceId}/locations`, {});

      // 타임아웃 설정
      setTimeout(() => {
        replySubscription.unsubscribe();
        reject(new Error("Get locations timeout"));
      }, 10000);
    });
  }

  // 위치 업데이트 전송 (Fire-and-Forget)
  // 서버의 LocationRequestDto와 일치: { latitude: Double, longitude: Double }
  async updateLocation(
    workspaceId: string,
    latitude: number,
    longitude: number
  ) {
    // 연결이 없으면 연결 시도 (실패해도 조용히 실패)
    if (!this.stompClient || !this.stompClient.connected) {
      try {
        await this.connect();
      } catch (error) {
        console.warn("⚠️ Failed to connect for location update:", error);
        return;
      }
    }

    if (!this.stompClient || !this.stompClient.connected) {
      return;
    }

    // 서버 DTO 형식에 맞게 Double로 변환
    const locationData = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };

    // 유효성 검증
    if (
      isNaN(locationData.latitude) ||
      isNaN(locationData.longitude) ||
      locationData.latitude === null ||
      locationData.longitude === null
    ) {
      throw new Error(
        "Invalid location data: latitude and longitude must be valid numbers"
      );
    }

    console.log(`📤 Updating location for workspace ${workspaceId}:`, {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    });

    this.sendStompMessage(
      `/app/workspace/${workspaceId}/location`,
      locationData
    );
  }

  // 실시간 위치 스트림 구독 (STOMP Stream)
  async streamLocations(
    workspaceId: string,
    onLocation: (location: any) => void
  ) {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    console.log(`📡 Starting location stream for workspace: ${workspaceId}`);

    if (this.streamSubscriptions.has(workspaceId)) {
      console.log(
        `⚠️ Already subscribed to location stream for workspace: ${workspaceId}`
      );
      return {
        unsubscribe: () => this.unsubscribeFromStream(workspaceId),
      };
    }

    // 먼저 현재 위치 데이터를 가져오기
    try {
      const initialLocations: any = await this.getLocations(workspaceId);

      // 초기 위치들을 콜백으로 전달
      if (Array.isArray(initialLocations)) {
        initialLocations.forEach((location: any) => {
          onLocation(location);
        });
      }
    } catch (error) {
      console.error("Failed to fetch initial locations:", error);
      // 에러가 나도 스트림 구독은 계속 진행
    }

    const initialSubscription = this.stompClient.subscribe(
      `/user/queue/initial-locations`,
      (message: any) => {
        try {
          const locations = JSON.parse(message.body);
          // 초기 위치들을 개별적으로 콜백 호출
          if (Array.isArray(locations)) {
            locations.forEach((location) => {
              onLocation(location);
            });
          } else {
            onLocation(locations);
          }
        } catch (error) {
          console.error("Failed to parse initial locations:", error);
        }
      }
    );

    // 실시간 위치 업데이트 구독 (서버에서 /topic/workspace/{workspaceId}/locations로 브로드캐스트)
    const streamSubscription = this.stompClient.subscribe(
      `/topic/workspace/${workspaceId}/locations`,
      (message: any) => {
        try {
          const locationData = JSON.parse(message.body);
          onLocation(locationData);
        } catch (error) {
          console.error("Failed to parse location data:", error);
        }
      }
    );

    // 구독 정보 저장 (초기 위치 + 스트림)
    this.streamSubscriptions.set(workspaceId, {
      initial: initialSubscription,
      stream: streamSubscription,
    });

    return {
      unsubscribe: () => this.unsubscribeFromStream(workspaceId),
    };
  }

  // 스트림 구독 해제 헬퍼
  private unsubscribeFromStream(workspaceId: string): void {
    const subscription = this.streamSubscriptions.get(workspaceId);
    if (subscription) {
      if (subscription.initial) {
        subscription.initial.unsubscribe();
      }
      if (subscription.stream) {
        subscription.stream.unsubscribe();
      }
      this.streamSubscriptions.delete(workspaceId);
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.stompClient !== null && this.stompClient.connected;
  }

  // 연결 종료
  disconnect() {
    this.cleanup();
    this.isConnecting = false;
  }
}

export default new LocationWebSocketService();
