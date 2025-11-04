import { registerForPushNotificationsAsync } from "@/utils/notification";
import { EventSubscription } from "expo-modules-core";
import * as Notifications from "expo-notifications";
import React, { ReactNode, useEffect } from "react";
import { Platform, Vibration } from "react-native";
import { useNotificationStore } from "../stores";

// 진동 패턴 정의 (밀리초 단위)
// [진동시간, 대기시간, 진동시간, ...] 형태로 설정
const VIBRATION_PATTERN =
  Platform.OS === "android"
    ? [0, 250, 250, 250] // Android는 첫 번째 요소가 대기시간이 됨
    : [250, 250, 250]; // iOS는 모든 요소가 [진동, 대기, 진동, ...] 순서로 적용됨

export const useNotification = () => {
  return useNotificationStore();
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const {
    setExpoPushToken,
    setNotification,
    setError,
    setNotificationSound,
    setNotificationListener,
    setResponseListener,
    loadNotificationSound,
    playNotificationSound,
    scheduleUpdateCallback,
    notificationSound,
    notificationListener,
    responseListener,
  } = useNotificationStore();

  useEffect(() => {
    let listener: EventSubscription;
    let responseListener_: EventSubscription;

    const initNotifications = async () => {
      // 알림 소리 로드
      await loadNotificationSound();

      const token = await registerForPushNotificationsAsync();
      setExpoPushToken(token || null);

      listener = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log("🔔 Notification Received: ", notification);
          setNotification(notification);

          // 푸시 알림 수신 시 진동 발생
          Vibration.vibrate(VIBRATION_PATTERN);

          // 푸시 알림 수신 시 소리 재생
          playNotificationSound();

          // 일정 관련 알림인 경우 콜백 호출
          const notificationData = notification.request.content.data;
          const notificationType =
            notificationData?.type || notificationData?.notificationType;

          // 일정 생성, 수정, 삭제 알림 감지
          if (
            notificationType === "schedule_created" ||
            notificationType === "schedule_updated" ||
            notificationType === "schedule_deleted" ||
            notificationType === "schedule" // 일반적인 일정 알림
          ) {
            console.log("📅 일정 업데이트 알림 감지, 캘린더 새로고침 트리거");
            if (scheduleUpdateCallback) {
              scheduleUpdateCallback();
            }
          }
        }
      );

      responseListener_ = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log(
            "🔔 Notification Response: ",
            JSON.stringify(response, null, 2),
            JSON.stringify(response.notification.request.content.data, null, 2)
          );
          // Handle the notification response here
        }
      );

      setNotificationListener(listener);
      setResponseListener(responseListener_);
    };

    initNotifications().catch((error) => setError(error));

    return () => {
      if (listener) {
        listener.remove();
      }
      if (responseListener_) {
        responseListener_.remove();
      }

      // 컴포넌트 언마운트 시 소리 객체 해제
      const { notificationSound } = useNotificationStore.getState();
      if (notificationSound) {
        notificationSound.unloadAsync();
      }
    };
  }, []);

  return <>{children}</>;
};
