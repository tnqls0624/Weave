import { apiService } from "@/services/api";
import { getApp } from "@react-native-firebase/app";
import {
  AuthorizationStatus,
  FirebaseMessagingTypes,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

// 알림 핸들러 설정 - 초기화 시에만 한 번 실행되도록 외부로 이동
Notifications.setNotificationHandler({
  handleNotification:
    async (): Promise<Notifications.NotificationBehavior> => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
});

const messaging = getMessaging(getApp());

// Firebase 백그라운드 메시지 핸들러 - 최상위에서 한 번만 설정
setBackgroundMessageHandler(
  messaging,
  async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    // 백그라운드 메시지에서는 알림을 직접 표시하지 않음 (FCM이 자동으로 처리)
    return Promise.resolve();
  }
);

// Expo 푸시 알림 토큰을 가져오는 함수
export async function registerForPushNotificationsAsync() {
  let token;

  // if (Platform.OS === 'android') {
  //   await Notifications.setNotificationChannelAsync('default', {
  //     name: 'default',
  //     importance: Notifications.AndroidImportance.MAX,
  //     vibrationPattern: [0, 250, 250, 250],
  //     lightColor: '#FF231F7C',
  //   });
  // }

  if (Constants.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    try {
      // iOS에서는 projectId가 반드시 필요함
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error("Project ID is missing in app.json");
        return null;
      }

      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      token = expoPushToken.data;
    } catch (error) {
      console.error("Error getting expo push token:", error);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

class NotificationManager {
  private static instance: NotificationManager;
  private unsubscribeMessage?: () => void;
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;
  private isInitialized: boolean = false;

  // 중복 알림 방지를 위한 변수들
  private lastNotificationTime: number = 0;
  private lastNotificationContent: string = "";
  private readonly NOTIFICATION_COOLDOWN_MS: number = 2000; // 알림 쿨다운 (2초)

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async init() {
    // 이미 초기화되었으면 중복 초기화 방지
    if (this.isInitialized) {
      console.log("NotificationManager already initialized");
      return;
    }

    try {
      const permissionGranted = await this.requestPermissions();
      if (permissionGranted) {
        // await this.createAndroidChannel();
        console.log("알림 권한 획득 성공");
        this.setupListeners();
        this.isInitialized = true;
      } else {
        console.log("알림 권한 획득 실패");
      }
    } catch (error) {
      console.error("Notification initialization error:", error);
    }
  }

  private async requestPermissions() {
    try {
      // Expo Notifications 권한 요청
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log("Expo Notifications 권한 상태:", finalStatus);
      }

      if (finalStatus !== "granted") {
        console.log("Expo Notifications 권한 거부됨");
        return false;
      }

      // Firebase Messaging 권한 요청 (iOS에서는 APNS 설정 필요)
      try {
        console.log("🔔 Firebase Messaging 권한 요청 시작...");
        const authStatus = await requestPermission(messaging);
        console.log("🔔 Firebase 권한 상태:", authStatus);

        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          try {
            const fcmToken = await getToken(messaging);

            // FCM 토큰을 서버에 전송
            try {
              await apiService.updateNotifications(true, fcmToken);
            } catch (apiError: any) {
              console.error(
                "❌ FCM 토큰 서버 업데이트 실패:",
                apiError.message
              );
            }
          } catch (tokenError: any) {
            console.error("❌ FCM 토큰 가져오기 실패");
            console.error("에러 메시지:", tokenError.message);
          }
        } else {
          console.log("❌ Firebase Messaging 권한 거부됨");
          // 권한이 거부되면 pushEnabled를 false로 업데이트
          try {
            await apiService.updateNotifications(false);
          } catch (apiError: any) {
            console.error("❌ 서버 업데이트 실패:", apiError.message);
          }
        }
      } catch (error: any) {
        console.error("❌ Firebase Messaging 초기화 실패");
      }

      return true;
    } catch (error) {
      console.error("Permission request error:", error);
      return false;
    }
  }

  private async createAndroidChannel() {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default Channel",
        importance: Notifications.AndroidImportance.MAX,
      });
    }
  }

  // 알림 데이터에서 스케줄 ID 추출
  private extractScheduleId(data: any): string | null {
    if (!data) return null;

    // FCM 메시지 형식
    if (data.data && data.data.scheduleId) {
      return data.data.scheduleId;
    }

    // Expo 알림 형식
    if (
      data.request &&
      data.request.content &&
      data.request.content.data &&
      data.request.content.data.scheduleId
    ) {
      return data.request.content.data.scheduleId;
    }

    return null;
  }

  // 스케줄 ID가 있으면 해당 스케줄 상세 화면으로 이동
  private navigateToSchedule(scheduleId: string | null) {
    if (!scheduleId) return;

    console.log(`스케줄 화면으로 이동: ${scheduleId}`);

    // 약간의 지연을 두어 앱이 완전히 로드된 후 이동
    setTimeout(() => {
      router.push(`/(tabs)/calendar?scheduleId=${scheduleId}`);
    }, 500);
  }

  private setupListeners() {
    try {
      // 리스너가 이미 설정되어 있는지 확인하고 기존 리스너 제거
      this.cleanup();

      // FCM 리스너 (모듈 방식)
      this.unsubscribeMessage = onMessage(
        messaging,
        async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
          if (remoteMessage?.notification) {
            const { title, body } = remoteMessage.notification;
            await this.showNotification(
              title || "알림",
              body || "새 메시지가 있습니다.",
              remoteMessage.data
            );
          }
        }
      );

      // Expo Notifications 리스너
      this.notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log("Notification received:", notification);
        }
      );

      this.responseListener =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log("Notification response:", response);

          // 알림 응답에서 스케줄 ID 추출
          const scheduleId = this.extractScheduleId(response);

          // 스케줄 화면으로 이동
          this.navigateToSchedule(scheduleId);
        });

      // 앱이 종료된 상태에서 알림을 통해 열린 경우 처리 (모듈 방식)
      getInitialNotification(messaging).then(
        (remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
          if (remoteMessage) {
            console.log("App opened from terminated state:", remoteMessage);

            // 앱이 종료된 상태에서 알림을 통해 열린 경우
            const scheduleId = this.extractScheduleId(remoteMessage);
            this.navigateToSchedule(scheduleId);
          }
        }
      );
    } catch (error) {
      console.error("Setup listeners error:", error);
    }
  }

  // 중복 알림 방지를 위한 함수
  private isDuplicateNotification(title: string, body: string): boolean {
    const now = Date.now();
    const content = `${title}:${body}`;

    // 1. 동일한 내용의 알림이 최근에 표시되었는지 확인
    // 2. 설정된 쿨다운 시간 내에 있는지 확인
    if (
      content === this.lastNotificationContent &&
      now - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN_MS
    ) {
      console.log("중복 알림 감지 - 무시됨:", content);
      return true;
    }

    // 새로운 알림 정보 기록
    this.lastNotificationContent = content;
    this.lastNotificationTime = now;
    return false;
  }

  private async showNotification(title: string, body: string, data?: any) {
    try {
      console.log("알림 표시 시도:", { title, body, data });

      // 중복 알림인지 확인
      if (this.isDuplicateNotification(title, body)) {
        return;
      }

      // iOS에서는 sound 값을 true가 아닌 구체적인 값으로 설정
      const sound = Platform.OS === "ios" ? "default" : true;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: data || {}, // 알림에 데이터 포함
        },
        trigger: null, // 즉시 표시
      });

      console.log("알림 표시 성공");
    } catch (error) {
      console.error("Show notification error:", error);
    }
  }

  cleanup() {
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
      this.unsubscribeMessage = undefined;
    }

    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = undefined;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = undefined;
    }

    console.log("NotificationManager 리소스 정리 완료");
  }
}

export default NotificationManager;
