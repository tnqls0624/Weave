import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import locationWebSocketService from "./locationWebSocketService";

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

interface LocationTrackingState {
  isTracking: boolean;
  workspaceId: string | null;
  foregroundSubscription: Location.LocationSubscription | null;
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
    intervalMs: number = 1000 // 기본 5초
  ): Promise<boolean> {
    try {
      if (this.state.isTracking) {
        console.log("⚠️ Location tracking already running");
        return true;
      }

      // 권한 확인
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      // WebSocket 연결
      await locationWebSocketService.connect();

      console.log(
        `🚀 Starting foreground location tracking (interval: ${intervalMs}ms)`
      );

      // 포그라운드 위치 구독
      this.state.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: intervalMs,
          distanceInterval: 0,
        },
        (location) => {
          this.handleLocationUpdate(workspaceId, location);
        }
      );

      this.state.isTracking = true;
      this.state.workspaceId = workspaceId;

      console.log("✅ Foreground location tracking started");
      return true;
    } catch (error) {
      console.error("❌ Failed to start foreground tracking:", error);
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

      if (!TASK_MANAGER_AVAILABLE) {
        console.warn(
          "⚠️ TaskManager unavailable - falling back to foreground tracking"
        );
        return this.startForegroundTracking(workspaceId);
      }

      // 권한 확인
      const permissions = await this.checkPermissions();
      if (!permissions.background) {
        console.warn(
          "⚠️ Background permission not granted, using foreground only"
        );
        return this.startForegroundTracking(workspaceId);
      }

      // WebSocket 연결
      await locationWebSocketService.connect();

      console.log("🚀 Starting background location tracking");

      // 백그라운드 태스크 정의
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
              this.handleLocationUpdate(workspaceId, location);
            }
          }
        }
      );

      // 백그라운드 위치 추적 시작
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30초
        distanceInterval: 50, // 50미터
        foregroundService: {
          notificationTitle: "Weave",
          notificationBody: "위치를 공유하고 있습니다",
        },
      });

      this.state.isTracking = true;
      this.state.workspaceId = workspaceId;

      console.log("✅ Background location tracking started");
      return true;
    } catch (error) {
      console.error("❌ Failed to start background tracking:", error);
      return false;
    }
  }

  // 위치 업데이트 처리
  private async handleLocationUpdate(
    workspaceId: string,
    location: Location.LocationObject
  ) {
    try {
      const { latitude, longitude } = location.coords;

      console.log(`📍 Location update:`, {
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        accuracy: location.coords.accuracy,
      });

      // WebSocket으로 위치 전송 (Fire-and-Forget)
      await locationWebSocketService.updateLocation(
        workspaceId,
        latitude,
        longitude
      );
    } catch (error) {
      console.error("❌ Failed to send location update:", error);
    }
  }

  // 위치 추적 중지
  async stopTracking(): Promise<void> {
    try {
      console.log("🛑 Stopping location tracking...");

      // 포그라운드 구독 해제
      if (this.state.foregroundSubscription) {
        this.state.foregroundSubscription.remove();
        this.state.foregroundSubscription = null;
      }

      // 백그라운드 태스크 중지
      if (TASK_MANAGER_AVAILABLE) {
        const isTaskDefined = await TaskManager.isTaskDefined(
          LOCATION_TASK_NAME
        );
        if (isTaskDefined) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      }

      this.state.isTracking = false;
      this.state.workspaceId = null;

      console.log("✅ Location tracking stopped");
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
}

export default new LocationTrackingService();
