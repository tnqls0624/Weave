export type View = "feed" | "calendar" | "create" | "map" | "settings";

export type RepeatOption = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  name: string;
  birthday: string;
  avatarUrl: string;
  color: string;
  initialLocation?: Location;
  location?: Location;
  pushEnabled?: boolean;
  locationEnabled?: boolean;
  fcmToken?: string;
  email?: string;
  inviteCode?: string;
}

export interface Calendar {
  id: string;
  title?: string;
  master: string; // 마스터 사용자 ID
  users: string[]; // 워크스페이스 참여자 ID 배열
  participantColors?: Record<string, string>; // userId -> hex color code
  loveDay?: string;
  thumbnailImage?: string;
}

export interface Schedule {
  id: string;
  workspace: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (종일 일정의 경우 없을 수 있음)
  endTime?: string; // HH:mm (종일 일정의 경우 없을 수 있음)
  title: string;
  memo?: string;
  participants: string[]; // 참여자 ID 배열 (User 객체가 아닌 ID)
  isHoliday?: boolean;
  isAllDay?: boolean; // 종일 일정 여부
  repeatType?: string;
  calendarType?: string;
  reminderMinutes?: number; // 알림 시간 (분 단위, null이면 알림 없음)
  isImportant?: boolean; // 중요 일정 여부 (D-day 알림용)
  commentCount?: number; // 댓글 수
}

// 일정 댓글
export interface ScheduleComment {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  createdAt: string; // ISO date string
  updatedAt?: string;
}

// 알림 타입
export type NotificationType =
  | "schedule_invite" // 일정 초대
  | "schedule_update" // 일정 수정
  | "schedule_delete" // 일정 삭제
  | "schedule_reminder" // 일정 리마인더
  | "schedule_comment" // 일정 댓글
  | "dday_reminder" // D-day 알림
  | "general"; // 일반 알림

// 알림 아이템
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduleId?: string;
  scheduleTitle?: string;
  inviterName?: string; // 초대한 사람 이름
  createdAt: string; // ISO date string
  isRead: boolean;
}
