import { Client } from "@stomp/stompjs";
import { apiService } from "./api";

// STOMP Client 타입
type StompClient = Client;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: number;
  replyQueue?: string;
}

// 피싱 알림 인터페이스
interface PhishingAlert {
  smsId: string;
  sender: string;
  message: string;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  detectionReasons: string[];
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

const API_BASE_URL = "wss://api.weave.io.kr/api/ws";

class LocationWebSocketService {
  private stompClient: StompClient | null = null;
  private isConnecting: boolean = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private streamSubscriptions = new Map<string, any>();
  private replySubscription: any = null;
  private phishingAlertSubscription: any = null;
  private phishingAlertCallbacks: ((alert: PhishingAlert) => void)[] = [];
  private connectionPromise: Promise<StompClient> | null = null; // 연결 프로미스 캐싱

  // STOMP 연결 (순수 WebSocket + STOMP, SockJS 미사용)
  async connect(retryCount: number = 0): Promise<StompClient> {
    const MAX_RETRIES = 3;

    // 이미 연결되어 있으면 즉시 반환
    if (this.stompClient && this.stompClient.connected) {
      return this.stompClient;
    }

    // 연결 중인 프로미스가 있으면 재사용
    if (this.connectionPromise) {
      console.log("⏳ Reusing existing connection promise...");
      return this.connectionPromise;
    }

    // 새로운 연결 시작
    this.connectionPromise = this.doConnect(retryCount);

    try {
      const client = await this.connectionPromise;
      return client;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  private async doConnect(retryCount: number = 0): Promise<StompClient> {
    const MAX_RETRIES = 3;

    this.isConnecting = true;
    try {
      const wsUrl = `${API_BASE_URL}`;

      // AsyncStorage에서 토큰 로드 (async) - 병렬 처리로 최적화
      const accessToken = await apiService.getAccessToken();

      if (!accessToken) {
        // 토큰이 없어도 연결 시도 (서버에서 처리)
        console.warn("⚠️ No access token, attempting anonymous connection...");
      }

      const wsUrlWithToken = accessToken
        ? `${wsUrl}?token=${accessToken}`
        : wsUrl;

      // STOMP Client 생성 (순수 WebSocket + STOMP) - 최적화된 설정
      this.stompClient = new Client({
        // React Native의 네이티브 WebSocket 사용
        webSocketFactory: () => {
          const ws = new WebSocket(wsUrlWithToken);
          // WebSocket 바이너리 타입 설정으로 성능 향상
          ws.binaryType = 'arraybuffer';
          return ws;
        },
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        reconnectDelay: 100, // 100ms로 단축 (빠른 재연결)
        heartbeatIncoming: 1000, // 1초로 단축 (빠른 연결 감지)
        heartbeatOutgoing: 1000, // 1초로 단축
        connectionTimeout: 3000, // 연결 타임아웃 3초
        maxWebSocketFrameSize: 16 * 1024, // 16KB 프레임 크기 제한
      });

      return new Promise((resolve, reject) => {
        if (!this.stompClient) {
          reject(new Error("STOMP client is null"));
          return;
        }

        this.stompClient.onConnect = (frame: any) => {
          this.isConnecting = false;
          console.log("✅ STOMP connected in", Date.now() - startTime, "ms");
          resolve(this.stompClient!);
        };

        this.stompClient.onStompError = (frame: any) => {
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error(frame.headers?.message || "STOMP connection error"));
        };

        this.stompClient.onWebSocketError = (event: any) => {
          this.isConnecting = false;
          this.connectionPromise = null;

          // 서버가 실행 중이지 않을 가능성
          if (event?.target?.readyState === 3) {
            // CLOSED
            const errorMsg = `
⚠️ WebSocket 연결 실패!

가능한 원인:
1. Spring Boot 서버가 실행 중이지 않습니다
   → ./gradlew bootRun으로 서버를 시작하세요
2. 잘못된 서버 주소 (현재: ${API_BASE_URL})
            `;
            console.error(errorMsg);
            reject(new Error(errorMsg));
          }
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

        const startTime = Date.now();
        this.stompClient.activate();
      });
    } catch (error) {
      console.error(`❌ Connection attempt ${retryCount + 1} failed:`, error);
      this.stompClient = null;
      this.isConnecting = false;

      // 재시도 로직 (빠른 재시도)
      if (retryCount < MAX_RETRIES) {
        console.log(`⏳ Retrying connection in 100ms...`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms로 단축
        return this.doConnect(retryCount + 1);
      }

      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // STOMP 메시지 전송 헬퍼 (최적화)
  private sendStompMessage(
    destination: string,
    body: any,
    headers: any = {}
  ): void {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn("⚠️ STOMP not connected, skipping message");
      return; // 에러 대신 경고만 (빠른 실패)
    }

    // JSON 직렬화 최적화 - 작은 객체는 즉시 전송
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    this.stompClient.publish({
      destination,
      body: bodyStr,
      headers: {
        ...headers,
        'content-type': 'application/json',
        'priority': '10' // 높은 우선순위
      },
    });
  }

  // 정리 헬퍼
  private cleanup(): void {
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error("STOMP disconnected"));
    }
    this.pendingRequests.clear();

    // streamSubscriptions 정리
    for (const [, subscription] of this.streamSubscriptions) {
      if (subscription && subscription.stream) {
        subscription.stream.unsubscribe();
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

      // 타임아웃 설정 (빠른 실패)
      setTimeout(() => {
        replySubscription.unsubscribe();
        reject(new Error("Get locations timeout"));
      }, 1000); // 1초로 단축
    });
  }

  // 위치 업데이트 전송 (Fire-and-Forget)
  // 서버의 LocationRequestDto와 일치: { latitude: Double, longitude: Double }
  async updateLocation(
    workspaceId: string,
    latitude: number,
    longitude: number
  ) {
    // 연결 재시도 로직 (빠른 실패 모드 - 위치 업데이트는 실시간성이 중요)
    let connectionAttempts = 0;
    const maxConnectionAttempts = 2; // 위치 업데이트는 빠르게 처리

    while (
      (!this.stompClient || !this.stompClient.connected) &&
      connectionAttempts < maxConnectionAttempts
    ) {
      try {
        console.log(
          `🔄 Attempting quick connection for location update... (Attempt ${
            connectionAttempts + 1
          }/${maxConnectionAttempts})`
        );
        await this.connect();

        // 최소 대기 시간
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms로 단축

        if (this.stompClient && this.stompClient.connected) {
          break;
        }
      } catch (error) {
        console.warn(
          `⚠️ Quick connection attempt ${connectionAttempts + 1} failed:`,
          error
        );
        connectionAttempts++;

        if (connectionAttempts < maxConnectionAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms로 단축
        }
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
    // 연결 재시도 로직
    let connectionAttempts = 0;
    const maxConnectionAttempts = 3;

    while (
      (!this.stompClient || !this.stompClient.connected) &&
      connectionAttempts < maxConnectionAttempts
    ) {
      try {
        console.log(
          `🔄 Attempting to establish STOMP connection... (Attempt ${
            connectionAttempts + 1
          }/${maxConnectionAttempts})`
        );
        await this.connect();

        // 연결 후 최소 대기
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms로 단축

        if (this.stompClient && this.stompClient.connected) {
          console.log("✅ STOMP connection established successfully");
          break;
        }
      } catch (error) {
        console.error(
          `❌ Connection attempt ${connectionAttempts + 1} failed:`,
          error
        );
        connectionAttempts++;

        if (connectionAttempts < maxConnectionAttempts) {
          console.log(`⏳ Waiting 100ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms로 단축
        }
      }
    }

    if (!this.stompClient || !this.stompClient.connected) {
      console.error(
        "❌ Failed to establish STOMP connection after multiple attempts"
      );
      // 연결 실패해도 gracefully 처리
      return {
        unsubscribe: () => {
          console.log("No subscription to unsubscribe (connection failed)");
        },
      };
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

    // 초기 위치 구독 제거 (NaverMapView에서 REST API로 이미 가져옴)
    // 중복 방지를 위해 STOMP 초기 위치 구독은 사용하지 않음

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

    // 구독 정보 저장 (스트림만)
    this.streamSubscriptions.set(workspaceId, {
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
      if (subscription.stream) {
        subscription.stream.unsubscribe();
      }
      this.streamSubscriptions.delete(workspaceId);
      console.log(
        `✅ Unsubscribed from location stream for workspace: ${workspaceId}`
      );
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.stompClient !== null && this.stompClient.connected;
  }

  // 채널 구독 (일반용)
  async subscribeToChannel(
    channel: string,
    callback: (data: any) => void
  ): Promise<void> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    // 이미 구독 중이면 먼저 해제
    if (this.streamSubscriptions.has(channel)) {
      const existing = this.streamSubscriptions.get(channel);
      if (existing) {
        existing.unsubscribe();
      }
    }

    const subscription = this.stompClient.subscribe(channel, (message: any) => {
      try {
        const data = JSON.parse(message.body);
        callback(data);
      } catch (error) {
        console.error(`Failed to parse message from ${channel}:`, error);
      }
    });

    this.streamSubscriptions.set(channel, subscription);
  }

  // 채널 구독 해제
  async unsubscribeFromChannel(channel: string): Promise<void> {
    const subscription = this.streamSubscriptions.get(channel);
    if (subscription) {
      subscription.unsubscribe();
      this.streamSubscriptions.delete(channel);
    }
  }

  // ===== 피싱 가드 관련 메서드 =====

  /**
   * 피싱 알림 구독
   */
  async subscribeToPhishingAlerts(
    onAlert: (alert: PhishingAlert) => void
  ): Promise<void> {
    // 연결 재시도 로직
    let connectionAttempts = 0;
    const maxConnectionAttempts = 3;

    while (
      (!this.stompClient || !this.stompClient.connected) &&
      connectionAttempts < maxConnectionAttempts
    ) {
      try {
        console.log(
          `🔄 Attempting to establish STOMP connection for phishing alerts... (Attempt ${
            connectionAttempts + 1
          }/${maxConnectionAttempts})`
        );
        await this.connect();

        // 연결 후 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (this.stompClient && this.stompClient.connected) {
          console.log("✅ STOMP connection established for phishing alerts");
          break;
        }
      } catch (error) {
        console.error(
          `❌ Connection attempt ${connectionAttempts + 1} failed:`,
          error
        );
        connectionAttempts++;

        if (connectionAttempts < maxConnectionAttempts) {
          console.log(`⏳ Waiting 2 seconds before retry...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!this.stompClient || !this.stompClient.connected) {
      console.error(
        "❌ Failed to establish STOMP connection for phishing alerts"
      );
      return; // Gracefully fail without throwing
    }

    // 콜백 등록
    this.phishingAlertCallbacks.push(onAlert);

    // 이미 구독 중이면 리턴
    if (this.phishingAlertSubscription) {
      return;
    }

    // 피싱 알림 토픽 구독
    // this.phishingAlertSubscription = this.stompClient.subscribe(
    //   "/topic/phishing.alerts",
    //   (message: any) => {
    //     try {
    //       const alert: PhishingAlert = JSON.parse(message.body);
    //       console.log("🚨 Phishing alert received:", alert);

    //       // 모든 등록된 콜백 실행
    //       this.phishingAlertCallbacks.forEach((callback) => {
    //         try {
    //           callback(alert);
    //         } catch (error) {
    //           console.error("Error in phishing alert callback:", error);
    //         }
    //       });
    //     } catch (error) {
    //       console.error("Failed to parse phishing alert:", error);
    //     }
    //   }
    // );

    // 사용자별 피싱 알림 구독 (선택적)
    // const userTopic = "/user/queue/phishing.personal";
    // this.stompClient.subscribe(userTopic, (message: any) => {
    //   try {
    //     const alert: PhishingAlert = JSON.parse(message.body);
    //     console.log("🚨 Personal phishing alert received:", alert);

    //     // 개인 알림 처리
    //     this.phishingAlertCallbacks.forEach((callback) => {
    //       try {
    //         callback(alert);
    //       } catch (error) {
    //         console.error("Error in personal phishing alert callback:", error);
    //       }
    //     });
    //   } catch (error) {
    //     console.error("Failed to parse personal phishing alert:", error);
    //   }
    // });
  }

  /**
   * 피싱 알림 전송 (서버로)
   */
  async sendPhishingAlert(alert: PhishingAlert): Promise<void> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error("STOMP not connected");
    }

    console.log("📤 Sending phishing alert:", alert);

    this.sendStompMessage("/app/phishing.report", {
      ...alert,
      reportedAt: new Date().toISOString(),
      deviceInfo: {
        platform: "mobile",
        version: "1.0.0",
      },
    });
  }

  /**
   * 실시간 피싱 통계 스트림
   */
  // async streamPhishingStats(
  //   workspaceId: string,
  //   onStats: (stats: any) => void
  // ): Promise<{ unsubscribe: () => void }> {
  //   if (!this.stompClient || !this.stompClient.connected) {
  //     await this.connect();
  //   }

  //   if (!this.stompClient || !this.stompClient.connected) {
  //     throw new Error("STOMP not connected");
  //   }

  //   const statsKey = `phishing-stats-${workspaceId}`;

  //   // 이미 구독 중이면 재사용
  //   if (this.streamSubscriptions.has(statsKey)) {
  //     console.log("⚠️ Already subscribed to phishing stats");
  //     return {
  //       unsubscribe: () => this.unsubscribePhishingStats(workspaceId),
  //     };
  //   }

  //   console.log(
  //     `📊 Starting phishing stats stream for workspace: ${workspaceId}`
  //   );

  //   const subscription = this.stompClient.subscribe(
  //     `/topic/phishing.stats.${workspaceId}`,
  //     (message: any) => {
  //       try {
  //         const stats = JSON.parse(message.body);
  //         console.log("📊 Phishing stats update:", stats);
  //         onStats(stats);
  //       } catch (error) {
  //         console.error("Failed to parse phishing stats:", error);
  //       }
  //     }
  //   );

  //   this.streamSubscriptions.set(statsKey, subscription);

  //   // 통계 스트림 시작 요청
  //   this.sendStompMessage(`/app/phishing.stats.stream`, {
  //     workspaceId,
  //     action: "start",
  //   });

  //   return {
  //     unsubscribe: () => this.unsubscribePhishingStats(workspaceId),
  //   };
  // }

  /**
   * 피싱 통계 구독 해제
   */
  private unsubscribePhishingStats(workspaceId: string): void {
    const statsKey = `phishing-stats-${workspaceId}`;
    const subscription = this.streamSubscriptions.get(statsKey);

    if (subscription) {
      subscription.unsubscribe();
      this.streamSubscriptions.delete(statsKey);

      if (this.stompClient && this.stompClient.connected) {
        this.sendStompMessage(`/app/phishing.stats.stream`, {
          workspaceId,
          action: "stop",
        });
      }
    }
  }

  /**
   * 피싱 알림 구독 해제
   */
  // unsubscribeFromPhishingAlerts(): void {
  //   if (this.phishingAlertSubscription) {
  //     this.phishingAlertSubscription.unsubscribe();
  //     this.phishingAlertSubscription = null;
  //   }
  //   this.phishingAlertCallbacks = [];
  //   console.log("✅ Unsubscribed from phishing alerts");
  // }

  /**
   * 피싱 위치 알림 전송 (지도에 표시용)
   */
  async sendPhishingLocationAlert(
    workspaceId: string,
    alert: PhishingAlert
  ): Promise<void> {
    if (!alert.location) {
      console.warn("No location in phishing alert");
      return;
    }

    if (!this.stompClient || !this.stompClient.connected) {
      await this.connect();
    }

    this.sendStompMessage(`/app/phishing.location.${workspaceId}`, {
      workspaceId,
      smsId: alert.smsId,
      sender: alert.sender,
      riskLevel: alert.riskLevel,
      location: alert.location,
      timestamp: alert.timestamp,
    });
  }

  // 연결 종료
  disconnect() {
    // 피싱 알림 구독 해제
    // this.unsubscribeFromPhishingAlerts();

    this.cleanup();
    this.isConnecting = false;
  }
}

const locationWebSocketService = new LocationWebSocketService();

export default locationWebSocketService;
export { locationWebSocketService };
export type { PhishingAlert };
