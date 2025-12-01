export type View = "feed" | "calendar" | "create" | "map" | "settings";

export type RepeatOption = "none" | "daily" | "weekly" | "monthly";

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
  // TEMPORARILY DISABLED - Security features
  // phishingGuardEnabled?: boolean;
  // phishingAutoBlock?: boolean;
  // phishingSensitivityLevel?: string;
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
  repeatType?: string;
  calendarType?: string;
  reminderMinutes?: number; // 알림 시간 (분 단위, null이면 알림 없음)
}
