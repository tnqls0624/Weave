import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationItem, NotificationType } from "../types";

const NOTIFICATION_HISTORY_KEY = "@notification_history";
const MAX_NOTIFICATION_COUNT = 100; // 최대 100개 저장

class NotificationHistoryService {
  private static instance: NotificationHistoryService;

  private constructor() {}

  public static getInstance(): NotificationHistoryService {
    if (!NotificationHistoryService.instance) {
      NotificationHistoryService.instance = new NotificationHistoryService();
    }
    return NotificationHistoryService.instance;
  }

  // 알림 타입 판별
  parseNotificationType(data: any): NotificationType {
    if (!data) return "general";

    const type = data.type || data.notificationType;

    switch (type) {
      case "SCHEDULE_INVITE":
      case "schedule_invite":
        return "schedule_invite";
      case "SCHEDULE_UPDATE":
      case "schedule_update":
        return "schedule_update";
      case "SCHEDULE_DELETE":
      case "schedule_delete":
        return "schedule_delete";
      case "SCHEDULE_REMINDER":
      case "schedule_reminder":
        return "schedule_reminder";
      case "SCHEDULE_COMMENT":
      case "schedule_comment":
        return "schedule_comment";
      case "DDAY_REMINDER":
      case "dday_reminder":
        return "dday_reminder";
      default:
        return "general";
    }
  }

  // 알림 아이템 생성
  createNotificationItem(
    title: string,
    body: string,
    data?: any
  ): NotificationItem {
    const type = this.parseNotificationType(data);

    return {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      body,
      scheduleId: data?.scheduleId,
      scheduleTitle: data?.scheduleTitle,
      inviterName: data?.inviterName,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
  }

  // 알림 저장
  async saveNotification(notification: NotificationItem): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      history.unshift(notification); // 최신 알림을 앞에 추가

      // 최대 개수 초과 시 오래된 알림 삭제
      if (history.length > MAX_NOTIFICATION_COUNT) {
        history.splice(MAX_NOTIFICATION_COUNT);
      }

      await AsyncStorage.setItem(
        NOTIFICATION_HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch (error) {
      console.error("Failed to save notification:", error);
    }
  }

  // 알림 목록 조회
  async getNotificationHistory(): Promise<NotificationItem[]> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get notification history:", error);
      return [];
    }
  }

  // 특정 타입의 알림만 조회
  async getNotificationsByType(
    type: NotificationType
  ): Promise<NotificationItem[]> {
    const history = await this.getNotificationHistory();
    return history.filter((item) => item.type === type);
  }

  // 읽지 않은 알림 개수 조회
  async getUnreadCount(): Promise<number> {
    const history = await this.getNotificationHistory();
    return history.filter((item) => !item.isRead).length;
  }

  // 알림 읽음 처리
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      const index = history.findIndex((item) => item.id === notificationId);

      if (index !== -1) {
        history[index].isRead = true;
        await AsyncStorage.setItem(
          NOTIFICATION_HISTORY_KEY,
          JSON.stringify(history)
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  // 모든 알림 읽음 처리
  async markAllAsRead(): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      history.forEach((item) => {
        item.isRead = true;
      });
      await AsyncStorage.setItem(
        NOTIFICATION_HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }

  // 특정 알림 삭제
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      const filteredHistory = history.filter(
        (item) => item.id !== notificationId
      );
      await AsyncStorage.setItem(
        NOTIFICATION_HISTORY_KEY,
        JSON.stringify(filteredHistory)
      );
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }

  // 모든 알림 삭제
  async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  }

  // 일정 초대 알림 메시지 생성
  createInviteNotificationMessage(
    inviterName: string,
    scheduleTitle: string
  ): { title: string; body: string } {
    return {
      title: "일정 초대",
      body: `${inviterName}님이 '${scheduleTitle}' 일정에 초대했습니다`,
    };
  }
}

export const notificationHistoryService =
  NotificationHistoryService.getInstance();
