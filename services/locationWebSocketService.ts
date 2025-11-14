// @ts-ignore - STOMP library will be available at runtime
import { Client } from "@stomp/stompjs";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import { apiService } from "./api";

// ---- React Native / Node-like 환경에서 WebSocket polyfill ----
const g: any = globalThis as any;
if (typeof g.WebSocket === "undefined") {
  console.log("🌐 WebSocket not found on globalThis. Applying W3CWebSocket polyfill.");
  g.WebSocket = W3CWebSocket as any;
} else {
  console.log("🌐 Native WebSocket detected. Using existing implementation.");
}

// STOMP Client 타입
type StompClient = Client;

// 환경변수 (Expo에서는 Constants 사용 권장하지만 호환성을 위해 직접 정의)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";
const EXPLICIT_WEBSOCKET_URL: string | undefined = undefined;
const WEBSOCKET_PATH = "/websocket";

const buildWebSocketUrl = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const portSegment = url.port ? `:${url.port}` : "";
  const normalizedPath = WEBSOCKET_PATH.startsWith("/")
    ? WEBSOCKET_PATH
    : `/${WEBSOCKET_PATH}`;
  return `${protocol}//${url.hostname}${portSegment}${normalizedPath}`;
};

const resolveWebSocketUrl = (override?: string): string => {
  if (override) return override;
  if (EXPLICIT_WEBSOCKET_URL) return EXPLICIT_WEBSOCKET_URL;
  return buildWebSocketUrl(API_BASE_URL);
};

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

  // STOMP 연결
  async connect(serverUrl?: string): Promise<StompClient> {
    // 이미 연결되어 있으면 기존 연결 반환
    if (this.stompClient && this.stompClient.connected) {
      console.log("✅ STOMP already connected");
      return this.stompClient;
    }

    // 연결 중이면 대기
    if (this.isConnecting) {
      console.log("⏳ STOMP connection in progress, waiting...");
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
      const wsUrl = resolveWebSocketUrl(serverUrl);
      const accessToken = apiService.getAccessToken();

      if (!accessToken) {
        throw new Error("No access token available for STOMP authentication");
      }

      console.log("🌐 Connecting STOMP to:", wsUrl);

      this.stompClient = new Client({
        // RN/Expo에서도 동작하도록 WebSocket 인스턴스를 직접 생성
        webSocketFactory: () => new W3CWebSocket(wsUrl),
        // 브라우저 환경에서도 사용할 수 있도록 brokerURL도 설정 (polyfill이 있으면 사용됨)
        brokerURL: wsUrl,
        connectHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
        debug: (str: string) => {
          console.log("STOMP:", str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      return new Promise((resolve, reject) => {
        if (!this.stompClient) {
          reject(new Error("STOMP client is null"));
          return;
        }

        this.stompClient.onConnect = (frame: any) => {
          console.log("✅ STOMP connected successfully");

          // 임시 응답 큐 구독 설정
          this.setupReplyQueue();

          resolve(this.stompClient!);
        };

        this.stompClient.onStompError = (frame: any) => {
          console.error("❌ STOMP error:", frame.headers.message);
          reject(new Error(frame.headers.message));
        };

        this.stompClient.onWebSocketClose = () => {
          console.log("🔌 STOMP WebSocket disconnected");
          this.cleanup();
        };

        this.stompClient.activate();
      });
    } catch (error) {
      console.error("❌ STOMP connection failed:", error);
      console.error(
        "💡 Hint: Check if server is running at:",
        resolveWebSocketUrl()
      );
      console.error(
        "💡 Hint: Server should expose a STOMP WebSocket endpoint (default: /websocket)"
      );
      this.stompClient = null;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // 임시 응답 큐 설정
  private setupReplyQueue(): void {
    if (!this.stompClient || !this.stompClient.connected) {
      return;
    }

    const replyQueue = `/temp-queue/${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.replySubscription = this.stompClient.subscribe(
      replyQueue,
      (message: any) => {
        try {
          const response = JSON.parse(message.body);

          if (
            response.correlationId &&
            this.pendingRequests.has(response.correlationId)
          ) {
            const request = this.pendingRequests.get(
              response.correlationId
            )!;
            clearTimeout(request.timeout);
            this.pendingRequests.delete(response.correlationId);

            if (response.error) {
              request.reject(new Error(response.error));
            } else {
              request.resolve(response.data);
            }
          }
        } catch (error) {
          console.error("❌ Failed to parse STOMP message:", error);
        }
      }
    );

    console.log(`✅ Subscribed to reply queue: ${replyQueue}`);
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

  // Request-Response 패턴 헬퍼
  private async sendRequest(destination: string, body: any): Promise<any> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    const correlationId = this.generateId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error("Request timeout"));
      }, 30000);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout,
      });

      this.sendStompMessage(destination, {
        ...body,
        correlationId,
      });
    });
  }

  // 고유 ID 생성 헬퍼
  private generateId(): string {
    return (
      Date.now().toString() + Math.random().toString(36).substr(2, 9)
    );
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
    console.log(`📍 Requesting locations for workspace: ${workspaceId}`);

    return this.sendRequest(`/app/locations.get.${workspaceId}`, {
      workspaceId,
    });
  }

  // 위치 업데이트 전송 (Fire-and-Forget)
  async updateLocation(
    workspaceId: string,
    latitude: number,
    longitude: number
  ) {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    console.log(`📤 Updating location for workspace ${workspaceId}:`, {
      latitude,
      longitude,
    });

    this.sendStompMessage(`/app/location.update.${workspaceId}`, {
      workspaceId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });
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

    const subscription = this.stompClient.subscribe(
      `/topic/locations.${workspaceId}`,
      (message: any) => {
        try {
          const locationData = JSON.parse(message.body);
          console.log("📍 Received location update:", locationData);
          onLocation(locationData);
        } catch (error) {
          console.error("❌ Failed to parse location data:", error);
        }
      }
    );

    this.streamSubscriptions.set(workspaceId, subscription);

    this.sendStompMessage(`/app/locations.stream.${workspaceId}`, {
      workspaceId,
      action: "start",
    });

    console.log(
      `✅ Subscribed to location stream for workspace: ${workspaceId}`
    );

    return {
      unsubscribe: () => this.unsubscribeFromStream(workspaceId),
    };
  }

  // 스트림 구독 해제 헬퍼
  private unsubscribeFromStream(workspaceId: string): void {
    console.log(
      `🛑 Unsubscribing from location stream for workspace: ${workspaceId}`
    );

    const subscription = this.streamSubscriptions.get(workspaceId);
    if (subscription) {
      subscription.unsubscribe();
      this.streamSubscriptions.delete(workspaceId);

      if (this.stompClient && this.stompClient.connected) {
        this.sendStompMessage(`/app/locations.stream.${workspaceId}`, {
          workspaceId,
          action: "stop",
        });
      }
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.stompClient !== null && this.stompClient.connected;
  }

  // 연결 종료
  disconnect() {
    console.log("🔌 Disconnecting STOMP...");
    this.cleanup();
    this.isConnecting = false;
    console.log("✅ STOMP disconnected");
  }
}

export default new LocationWebSocketService();