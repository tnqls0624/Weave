import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import locationWebSocketService from "./locationWebSocketService";
import { apiService } from "./api";

const TASK_MANAGER_AVAILABLE =
  TaskManager &&
  typeof TaskManager.defineTask === "function" &&
  typeof TaskManager.isTaskDefined === "function";

if (TASK_MANAGER_AVAILABLE) {
  console.log("✅ TaskManager loaded - Background tracking available");
} else {
  console.warn(
    "⚠️ TaskManager not fully available - Use foreground tracking only (rebuild required for background)"
  );
}

const LOCATION_TASK_NAME = "background-location-task";
const WORKSPACE_ID_KEY = "background_tracking_workspace_id";
const BACKGROUND_UPDATE_COUNT_KEY = "background_update_count";

interface LocationTrackingState {
  isTracking: boolean;
  workspaceId: string | null;
  foregroundSubscription: Location.LocationSubscription | null;
}

// 백그라운드 태스크를 앱 시작 시 정의 (한 번만)
if (TASK_MANAGER_AVAILABLE) {
  // 이미 정의되어 있는지 확인 (동기 함수)
  const isDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);

  if (!isDefined) {
    TaskManager.defineTask(
      LOCATION_TASK_NAME,
      async ({ data, error }: any) => {
        if (error) {
          console.error("❌ Background location task error:", error);
          return;
        }

        if (data) {
          const { locations } = data;
          const location = locations[0];

          if (location) {
            try {
              // AsyncStorage에서 워크스페이스 ID 가져오기
              const workspaceId = await AsyncStorage.getItem(
                WORKSPACE_ID_KEY
              );

              if (!workspaceId) {
                console.warn(
                  "⚠️ No workspace ID found in background task"
                );
                return;
              }

              // 업데이트 카운터 증가
              const countStr = await AsyncStorage.getItem(BACKGROUND_UPDATE_COUNT_KEY);
              const count = countStr ? parseInt(countStr) + 1 : 1;
              await AsyncStorage.setItem(BACKGROUND_UPDATE_COUNT_KEY, count.toString());

              const { latitude, longitude } = location.coords;
              const timestamp = new Date().toLocaleTimeString();

              console.log("\n" + "🌙".repeat(30));
              console.log(`🌙 [BACKGROUND #${count}] Location Update at ${timestamp}`);
              console.log("🌙".repeat(30));
              console.log(`📋 Workspace: ${workspaceId}`);
              console.log(`🌍 Latitude: ${latitude.toFixed(6)}`);
              console.log(`🌍 Longitude: ${longitude.toFixed(6)}`);
              console.log(`🎯 Accuracy: ${location.coords.accuracy?.toFixed(2)}m`);
              console.log(`⏱️  Time: ${new Date(location.timestamp).toLocaleString()}`);

              // 1. REST API로 서버에 저장 (주 수단 - 안정적)
              console.log("📤 [BACKGROUND] Sending to REST API...");
              const startTime = Date.now();
              try {
                await apiService.saveLocationToWorkspace(workspaceId, {
                  latitude,
                  longitude,
                });
                const elapsed = Date.now() - startTime;
                console.log(`✅ [BACKGROUND] REST API success (${elapsed}ms)`);
              } catch (apiError: any) {
                console.error(
                  `❌ [BACKGROUND] REST API failed:`,
                  apiError?.message || apiError
                );
              }

              // 2. WebSocket으로 실시간 브로드캐스트 (보조 수단 - 선택적)
              // 백그라운드에서는 WebSocket 연결이 불안정할 수 있으므로 실패해도 무시
              console.log("📡 [BACKGROUND] Broadcasting via WebSocket...");
              try {
                const isConnected = locationWebSocketService.isConnected();
                console.log(`🔌 [BACKGROUND] WebSocket connected: ${isConnected}`);

                if (isConnected) {
                  await locationWebSocketService.updateLocation(
                    workspaceId,
                    latitude,
                    longitude
                  );
                  console.log("✅ [BACKGROUND] WebSocket broadcast success");
                } else {
                  console.log("⚠️ [BACKGROUND] WebSocket not connected, skipping");
                }
              } catch (wsError: any) {
                console.log(
                  "⚠️ [BACKGROUND] WebSocket failed (non-critical):",
                  wsError?.message || wsError
                );
                // WebSocket 실패는 무시 (REST API로 이미 저장됨)
              }

              console.log("🌙".repeat(30) + "\n");
            } catch (error) {
              console.error(
                "❌ [Background] Failed to process location:",
                error
              );
            }
          }
        }
      }
    );
    console.log("✅ Background location task defined");
  } else {
    console.log("✅ Background location task already defined");
  }
}

class LocationTrackingService {
  private state: LocationTrackingState = {
    isTracking: false,
    workspaceId: null,
    foregroundSubscription: null,
  };

  // 위치 권한 요청
  async requestPermissions(): Promise<boolean> {
    try {
      console.log("📍 Requesting location permissions...");

      // 포그라운드 위치 권한
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        console.warn("⚠️ Foreground location permission denied");
        return false;
      }

      // 백그라운드 위치 권한 (선택사항)
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== "granted") {
        console.warn(
          "⚠️ Background location permission denied (foreground only)"
        );
      }

      console.log("✅ Location permissions granted");
      return true;
    } catch (error) {
      console.error("❌ Failed to request location permissions:", error);
      return false;
    }
  }

  // 위치 권한 상태 확인
  async checkPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: foreground.status === "granted",
      background: background.status === "granted",
    };
  }

  // 포그라운드 위치 추적 시작
  async startForegroundTracking(
    workspaceId: string,
    intervalMs: number = 3000 // 기본 3초 (실시간 위치 공유)
  ): Promise<boolean> {
    try {
      if (this.state.isTracking) {
        console.log("⚠️ Location tracking already running");
        return true;
      }

      console.log("\n" + "=".repeat(60));
      console.log("🚀 [FOREGROUND] Starting location tracking");
      console.log("=".repeat(60));
      console.log(`📋 Workspace ID: ${workspaceId}`);
      console.log(`⏱️  Update interval: ${intervalMs}ms`);
      console.log(`📅 Started at: ${new Date().toLocaleString()}`);

      // 권한 확인
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log("❌ [FOREGROUND] Permission denied");
        return false;
      }
      console.log("✅ [FOREGROUND] Location permissions granted");

      // WebSocket 연결
      try {
        await locationWebSocketService.connect();
        console.log("✅ [FOREGROUND] WebSocket connected");
      } catch (wsError) {
        console.warn("⚠️ [FOREGROUND] WebSocket connection failed:", wsError);
      }

      // 포그라운드 위치 구독
      this.state.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High, // 높은 정확도
          timeInterval: intervalMs,
          distanceInterval: 0, // 거리 제한 없이 시간 간격으로만 업데이트
        },
        (location) => {
          this.handleLocationUpdate(workspaceId, location);
        }
      );

      this.state.isTracking = true;
      this.state.workspaceId = workspaceId;

      console.log("✅ [FOREGROUND] Location tracking started successfully");
      console.log("=".repeat(60) + "\n");

      // 백그라운드 태스크 상태도 확인 (5초 후)
      setTimeout(async () => {
        console.log("📊 Checking background task configuration...");
        await this.getBackgroundTaskStatus();
      }, 5000);

      return true;
    } catch (error) {
      console.error("❌ [FOREGROUND] Failed to start tracking:", error);
      return false;
    }
  }

  // 백그라운드 위치 추적 시작
  async startBackgroundTracking(workspaceId: string): Promise<boolean> {
    try {
      if (this.state.isTracking) {
        console.log("⚠️ Location tracking already running");
        return true;
      }

      console.log("\n" + "=".repeat(60));
      console.log("🌙 [BACKGROUND] Starting background location tracking");
      console.log("=".repeat(60));
      console.log(`📋 Workspace ID: ${workspaceId}`);
      console.log(`📅 Started at: ${new Date().toLocaleString()}`);

      if (!TASK_MANAGER_AVAILABLE) {
        console.warn(
          "⚠️ [BACKGROUND] TaskManager unavailable - falling back to foreground"
        );
        return this.startForegroundTracking(workspaceId);
      }

      // 권한 확인
      const permissions = await this.checkPermissions();
      console.log("📍 [BACKGROUND] Permissions:", permissions);

      if (!permissions.background) {
        console.warn(
          "⚠️ [BACKGROUND] Background permission not granted, using foreground only"
        );
        return this.startForegroundTracking(workspaceId);
      }

      // 워크스페이스 ID를 AsyncStorage에 저장 (백그라운드 태스크에서 사용)
      await AsyncStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
      // 업데이트 카운터 초기화
      await AsyncStorage.setItem(BACKGROUND_UPDATE_COUNT_KEY, "0");
      console.log("💾 [BACKGROUND] Workspace ID saved to AsyncStorage");
      console.log("🔄 [BACKGROUND] Update counter reset to 0");

      // WebSocket 연결 시도 (실패해도 괜찮음 - REST API가 주 수단)
      try {
        await locationWebSocketService.connect();
        console.log("✅ [BACKGROUND] WebSocket connected");
      } catch (wsError) {
        console.warn(
          "⚠️ [BACKGROUND] WebSocket connection failed (will use REST API only):",
          wsError
        );
      }

      // 백그라운드 위치 추적 시작 (태스크는 이미 파일 최상위에서 정의됨)
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High, // 높은 정확도 (실시간 위치 공유를 위해)
        timeInterval: 5000, // 5초마다 업데이트 (실시간 위치 공유)
        distanceInterval: 5, // 5미터 이동 시 업데이트
        foregroundService: {
          notificationTitle: "Weave 위치 공유",
          notificationBody: "워크스페이스 멤버들과 실시간으로 위치를 공유하고 있습니다",
        },
      });

      this.state.isTracking = true;
      this.state.workspaceId = workspaceId;

      console.log("✅ [BACKGROUND] Background location tracking started");
      console.log("📱 [BACKGROUND] Foreground service notification shown");
      console.log("⏱️  [BACKGROUND] Updates every 5 seconds or 5 meters");
      console.log("🎯 [BACKGROUND] High accuracy mode enabled");
      console.log("🌙 [BACKGROUND] Watch for 🌙🌙🌙 logs to confirm it's running");
      console.log("=".repeat(60) + "\n");

      // 상태 확인 (5초 후)
      setTimeout(async () => {
        await this.getBackgroundTaskStatus();
      }, 5000);

      return true;
    } catch (error) {
      console.error("❌ [BACKGROUND] Failed to start tracking:", error);
      // AsyncStorage 정리
      await AsyncStorage.removeItem(WORKSPACE_ID_KEY);
      await AsyncStorage.removeItem(BACKGROUND_UPDATE_COUNT_KEY);
      return false;
    }
  }

  // 위치 업데이트 처리
  private async handleLocationUpdate(
    workspaceId: string,
    location: Location.LocationObject
  ) {
    const timestamp = new Date().toLocaleTimeString();

    console.log("\n" + "-".repeat(60));
    console.log(`📍 [FOREGROUND] Location Update at ${timestamp}`);
    console.log("-".repeat(60));
    console.log(`📋 Workspace: ${workspaceId}`);
    console.log(`🌍 Latitude: ${location.coords.latitude.toFixed(6)}`);
    console.log(`🌍 Longitude: ${location.coords.longitude.toFixed(6)}`);
    console.log(`🎯 Accuracy: ${location.coords.accuracy?.toFixed(2)}m`);
    console.log(`⏱️  Timestamp: ${new Date(location.timestamp).toLocaleString()}`);

    try {
      // 1. REST API로 서버에 저장 (주 수단)
      console.log("📤 [FOREGROUND] Sending to REST API...");
      const startTime = Date.now();

      try {
        await apiService.saveLocationToWorkspace(workspaceId, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        const elapsed = Date.now() - startTime;
        console.log(`✅ [FOREGROUND] REST API success (${elapsed}ms)`);
      } catch (apiError: any) {
        console.error(`❌ [FOREGROUND] REST API failed:`, apiError?.message || apiError);
      }

      // 2. WebSocket으로 실시간 브로드캐스트 (보조 수단)
      console.log("📡 [FOREGROUND] Broadcasting via WebSocket...");
      const wsStartTime = Date.now();

      try {
        const isConnected = locationWebSocketService.isConnected();
        console.log(`🔌 [FOREGROUND] WebSocket connected: ${isConnected}`);

        if (isConnected) {
          await locationWebSocketService.updateLocation(
            workspaceId,
            location.coords.latitude,
            location.coords.longitude
          );
          const wsElapsed = Date.now() - wsStartTime;
          console.log(`✅ [FOREGROUND] WebSocket broadcast success (${wsElapsed}ms)`);
        } else {
          console.log("⚠️ [FOREGROUND] WebSocket not connected, skipping");
        }
      } catch (wsError: any) {
        console.error(`❌ [FOREGROUND] WebSocket failed:`, wsError?.message || wsError);
      }
    } catch (error: any) {
      console.error("❌ [FOREGROUND] Location update error:", error?.message || error);
    }

    console.log("-".repeat(60) + "\n");
  }

  // 위치 추적 중지
  async stopTracking(): Promise<void> {
    try {
      console.log("\n" + "=".repeat(60));
      console.log("🛑 Stopping location tracking");
      console.log("=".repeat(60));
      console.log(`📅 Stopped at: ${new Date().toLocaleString()}`);

      // 포그라운드 구독 해제
      if (this.state.foregroundSubscription) {
        this.state.foregroundSubscription.remove();
        this.state.foregroundSubscription = null;
        console.log("✅ Foreground subscription removed");
      }

      // 백그라운드 태스크 중지
      if (TASK_MANAGER_AVAILABLE) {
        const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
        if (isTaskDefined) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log("✅ Background task stopped");
        }
      }

      // AsyncStorage에서 워크스페이스 ID 및 카운터 제거
      await AsyncStorage.removeItem(WORKSPACE_ID_KEY);
      await AsyncStorage.removeItem(BACKGROUND_UPDATE_COUNT_KEY);
      console.log("✅ AsyncStorage cleaned");

      this.state.isTracking = false;
      this.state.workspaceId = null;

      console.log("✅ Location tracking stopped successfully");
      console.log("=".repeat(60) + "\n");
    } catch (error) {
      console.error("❌ Failed to stop location tracking:", error);
    }
  }

  // 현재 위치 한 번만 가져오기
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      console.log("📍 Getting current location...");
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("✅ Current location:", {
        latitude: location.coords.latitude.toFixed(6),
        longitude: location.coords.longitude.toFixed(6),
      });

      return location;
    } catch (error) {
      console.error("❌ Failed to get current location:", error);
      return null;
    }
  }

  // 위치 추적 상태 확인
  isTracking(): boolean {
    return this.state.isTracking;
  }

  // 현재 워크스페이스 ID
  getWorkspaceId(): string | null {
    return this.state.workspaceId;
  }

  // 백그라운드 태스크 상태 확인 (디버깅용)
  async getBackgroundTaskStatus(): Promise<{
    isTaskDefined: boolean;
    isTaskRegistered: boolean;
    updateCount: number;
    workspaceId: string | null;
  }> {
    const isTaskDefined = TASK_MANAGER_AVAILABLE
      ? TaskManager.isTaskDefined(LOCATION_TASK_NAME)
      : false;

    let isTaskRegistered = false;
    if (TASK_MANAGER_AVAILABLE) {
      try {
        const registeredTasks = await TaskManager.getRegisteredTasksAsync();
        isTaskRegistered = registeredTasks.some(
          (task) => task.taskName === LOCATION_TASK_NAME
        );
      } catch (error) {
        console.error("Failed to get registered tasks:", error);
      }
    }

    const countStr = await AsyncStorage.getItem(BACKGROUND_UPDATE_COUNT_KEY);
    const updateCount = countStr ? parseInt(countStr) : 0;

    const workspaceId = await AsyncStorage.getItem(WORKSPACE_ID_KEY);

    const status = {
      isTaskDefined,
      isTaskRegistered,
      updateCount,
      workspaceId,
    };

    console.log("\n" + "=".repeat(60));
    console.log("🔍 BACKGROUND TASK STATUS CHECK");
    console.log("=".repeat(60));
    console.log(`📋 Task Defined: ${isTaskDefined ? "✅ YES" : "❌ NO"}`);
    console.log(`📋 Task Registered: ${isTaskRegistered ? "✅ YES" : "❌ NO"}`);
    console.log(`📊 Update Count: ${updateCount}`);
    console.log(`🏢 Workspace ID: ${workspaceId || "None"}`);
    console.log("=".repeat(60) + "\n");

    return status;
  }
}

export default new LocationTrackingService();
