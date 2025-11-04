import { EventSubscription } from "expo-modules-core";
import * as Notifications from "expo-notifications";
import { create } from "zustand";

interface NotificationState {
  // State
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: Error | null;
  notificationSound: any | null; // Audio.Sound type

  // Refs
  notificationListener: EventSubscription | null;
  responseListener: EventSubscription | null;
  scheduleUpdateCallback: (() => void) | null;

  // Actions
  setExpoPushToken: (token: string | null) => void;
  setNotification: (notification: Notifications.Notification | null) => void;
  setError: (error: Error | null) => void;
  setNotificationSound: (sound: any | null) => void;
  setNotificationListener: (listener: EventSubscription | null) => void;
  setResponseListener: (listener: EventSubscription | null) => void;
  registerScheduleUpdateListener: (callback: () => void) => void;
  unregisterScheduleUpdateListener: () => void;

  // Methods
  loadNotificationSound: () => Promise<void>;
  playNotificationSound: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  expoPushToken: null,
  notification: null,
  error: null,
  notificationSound: null,
  notificationListener: null,
  responseListener: null,
  scheduleUpdateCallback: null,

  // Actions
  setExpoPushToken: (token) => set({ expoPushToken: token }),
  setNotification: (notification) => set({ notification }),
  setError: (error) => set({ error }),
  setNotificationSound: (sound) => set({ notificationSound: sound }),
  setNotificationListener: (listener) =>
    set({ notificationListener: listener }),
  setResponseListener: (listener) => set({ responseListener: listener }),

  registerScheduleUpdateListener: (callback) => {
    set({ scheduleUpdateCallback: callback });
  },

  unregisterScheduleUpdateListener: () => {
    set({ scheduleUpdateCallback: null });
  },

  loadNotificationSound: async () => {
    try {
      console.log("알림 사용 안함...");
      // Lazy import to avoid module loading at initialization
      //   const { Audio } = await import("expo-av");
      //   const { sound } = await Audio.Sound.createAsync(
      //     require("@/assets/sounds/notification.mp3")
      //   );
      //   set({ notificationSound: sound });
      //   console.log("알림 소리 로드 완료");
    } catch (error) {
      console.error("알림 소리 로드 실패:", error);
    }
  },

  playNotificationSound: async () => {
    const { notificationSound } = get();
    try {
      if (notificationSound) {
        await notificationSound.replayAsync();
      } else {
        console.log("알림 소리가 로드되지 않았습니다.");
      }
    } catch (error) {
      console.error("알림 소리 재생 실패:", error);
    }
  },
}));
