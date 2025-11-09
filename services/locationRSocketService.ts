import {
  IdentitySerializer,
  JsonSerializer,
  RSocketClient,
} from "rsocket-core";
import RSocketWebSocketClient from "rsocket-websocket-client";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";

// HTTP URL을 WebSocket URL로 변환 (RSocket은 7070 포트 사용)
const getWebSocketUrl = (baseUrl: string): string => {
  // HTTP URL에서 호스트 추출
  const url = new URL(baseUrl);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";

  // RSocket은 7070 포트 사용
  return `${protocol}//${url.hostname}:7070/rsocket`;
};

class LocationRSocketService {
  private client: RSocketClient | null = null;
  private rsocket: any = null;
  private isConnecting: boolean = false;

  // RSocket 연결
  async connect(serverUrl?: string) {
    // 이미 연결되어 있으면 기존 연결 반환
    if (this.rsocket) {
      console.log("✅ RSocket already connected");
      return this.rsocket;
    }

    // 연결 중이면 대기
    if (this.isConnecting) {
      console.log("⏳ RSocket connection in progress, waiting...");
      // 연결이 완료될 때까지 대기
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.rsocket;
    }

    this.isConnecting = true;

    try {
      const wsUrl = serverUrl || getWebSocketUrl(API_BASE_URL);

      this.client = new RSocketClient({
        serializers: {
          data: JsonSerializer,
          metadata: IdentitySerializer,
        },
        setup: {
          keepAlive: 60000,
          lifetime: 180000,
          dataMimeType: "application/json",
          metadataMimeType: "message/x.rsocket.routing.v0",
        },
        transport: new RSocketWebSocketClient({
          url: wsUrl,
        }),
      });

      this.rsocket = await this.client.connect();
      console.log("✅ RSocket connected successfully");
      return this.rsocket;
    } catch (error) {
      console.error("❌ RSocket connection failed:", error);
      console.error(
        "💡 Hint: Check if server is running at:",
        getWebSocketUrl(API_BASE_URL)
      );
      console.error(
        "💡 Hint: Server should have RSocket endpoint at port 7070 with path /rsocket"
      );
      this.rsocket = null;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // 라우팅 메타데이터 생성 헬퍼
  private encodeRoute(route: string): string {
    return String.fromCharCode(route.length) + route;
  }

  // 워크스페이스의 현재 위치 조회 (Request-Response)
  async getLocations(workspaceId: string) {
    if (!this.rsocket) {
      await this.connect();
    }

    if (!this.rsocket) {
      throw new Error("RSocket not connected");
    }

    console.log(`📍 Requesting locations for workspace: ${workspaceId}`);

    const route = `workspace.${workspaceId}.locations.get`;

    return new Promise((resolve, reject) => {
      this.rsocket
        .requestResponse({
          data: {},
          metadata: this.encodeRoute(route),
        })
        .subscribe({
          onComplete: (payload: any) => {
            const data = JSON.parse(payload.data);
            console.log("✅ Received locations:", data);
            resolve(data);
          },
          onError: (error: any) => {
            console.error("❌ Failed to get locations:", error);
            reject(error);
          },
        });
    });
  }

  // 위치 업데이트 전송 (Fire-and-Forget)
  async updateLocation(
    workspaceId: string,
    latitude: number,
    longitude: number
  ) {
    if (!this.rsocket) {
      await this.connect();
    }

    if (!this.rsocket) {
      throw new Error("RSocket not connected");
    }

    console.log(`📤 Updating location for workspace ${workspaceId}:`, {
      latitude,
      longitude,
    });

    const route = `workspace.${workspaceId}.location.update`;

    this.rsocket.fireAndForget({
      data: JSON.stringify({ latitude, longitude }),
      metadata: this.encodeRoute(route),
    });
  }

  // 실시간 위치 스트림 구독 (Request-Stream)
  async streamLocations(
    workspaceId: string,
    onLocation: (location: any) => void
  ) {
    if (!this.rsocket) {
      await this.connect();
    }

    if (!this.rsocket) {
      throw new Error("RSocket not connected");
    }

    console.log(`📡 Starting location stream for workspace: ${workspaceId}`);

    const route = `workspace.${workspaceId}.locations.stream`;

    return this.rsocket
      .requestStream({
        data: {},
        metadata: this.encodeRoute(route),
      })
      .subscribe({
        onComplete: () => {
          console.log("✅ Location stream completed");
        },
        onError: (error: any) => {
          console.error("❌ Location stream error:", error);
        },
        onNext: (payload: any) => {
          try {
            const location = JSON.parse(payload.data);
            console.log("📍 Received location update:", location);
            onLocation(location);
          } catch (error) {
            console.error("❌ Failed to parse location data:", error);
          }
        },
        onSubscribe: (subscription: any) => {
          subscription.request(2147483647); // request max
          console.log("✅ Subscribed to location stream");
        },
      });
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.rsocket !== null;
  }

  // 연결 종료
  disconnect() {
    console.log("🔌 Disconnecting RSocket...");
    if (this.rsocket) {
      this.rsocket.close();
      this.rsocket = null;
    }
    if (this.client) {
      this.client = null;
    }
    this.isConnecting = false;
    console.log("✅ RSocket disconnected");
  }
}

export default new LocationRSocketService();
