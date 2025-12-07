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
  checklist?: ChecklistItem[]; // 체크리스트
  photos?: SchedulePhoto[]; // 사진 앨범
  locationReminder?: LocationReminder; // 위치 기반 알림
}

// 일정 댓글
export interface ScheduleComment {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  parentId?: string; // 답글인 경우 부모 댓글 ID
  mentions?: MentionedUser[]; // 멘션된 사용자 목록
  isEdited?: boolean; // 수정 여부
  reactions?: CommentReaction[]; // 댓글 리액션
  replies?: ScheduleComment[]; // 답글 목록
  createdAt: string; // ISO date string
  updatedAt?: string;
}

// 멘션된 사용자
export interface MentionedUser {
  userId: string;
  userName: string;
}

// 리액션 타입
export type ReactionEmoji = "👍" | "❤️" | "🎉" | "👀" | "🙏" | "😢";

// 리액션
export interface Reaction {
  emoji: ReactionEmoji;
  count: number;
  isReactedByMe: boolean;
  users?: ReactedUser[];
}

// 리액션한 사용자
export interface ReactedUser {
  userId: string;
  userName: string;
  avatarUrl?: string;
}

// 댓글 리액션
export interface CommentReaction {
  emoji: string;
  count: number;
  isReactedByMe: boolean;
}

// 일정 리액션 요약
export interface ReactionSummary {
  reactions: Reaction[];
}

// 체크리스트 아이템
export interface ChecklistItem {
  id: string;
  content: string;
  isCompleted: boolean;
  completedBy?: string; // 완료한 사용자 ID
  completedAt?: string; // 완료 시간
  createdBy: string; // 생성한 사용자 ID
  createdAt: string;
}

// 일정 사진
export interface SchedulePhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string; // 업로드한 사용자 ID
  uploadedByName?: string;
  uploadedAt: string;
  caption?: string;
}

// 위치 기반 알림
export interface LocationReminder {
  id: string;
  scheduleId: string;
  latitude: number;
  longitude: number;
  radius: number; // 미터 단위
  address?: string;
  placeName?: string;
  isEnabled: boolean;
  triggeredAt?: string;
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
