import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { Schedule } from "../types";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingSchedules: Schedule[];
  conflictType: "time" | "allday" | "none";
  message: string;
}

/**
 * 일정 충돌 감지 서비스
 * 새 일정 생성/수정 시 기존 일정과의 충돌을 감지합니다.
 */
export class ScheduleConflictService {
  /**
   * 두 시간 범위가 겹치는지 확인
   */
  private static isTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = dayjs(`2000-01-01 ${start1}`);
    const e1 = dayjs(`2000-01-01 ${end1}`);
    const s2 = dayjs(`2000-01-01 ${start2}`);
    const e2 = dayjs(`2000-01-01 ${end2}`);

    // 시간 범위가 겹치는 경우
    return s1.isBefore(e2) && e1.isAfter(s2);
  }

  /**
   * 두 날짜 범위가 겹치는지 확인
   */
  private static isDateOverlap(
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string
  ): boolean {
    const s1 = dayjs(startDate1);
    const e1 = dayjs(endDate1);
    const s2 = dayjs(startDate2);
    const e2 = dayjs(endDate2);

    return s1.isSameOrBefore(e2) && e1.isSameOrAfter(s2);
  }

  /**
   * 새 일정이 기존 일정과 충돌하는지 확인
   */
  static checkConflict(
    newSchedule: Partial<Schedule>,
    existingSchedules: Schedule[],
    excludeScheduleId?: string // 수정 시 자기 자신 제외
  ): ConflictInfo {
    const {
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      participants = [],
    } = newSchedule;

    if (!startDate || !endDate) {
      return {
        hasConflict: false,
        conflictingSchedules: [],
        conflictType: "none",
        message: "",
      };
    }

    const conflictingSchedules: Schedule[] = [];

    for (const schedule of existingSchedules) {
      // 자기 자신은 제외
      if (excludeScheduleId && schedule.id === excludeScheduleId) {
        continue;
      }

      // 참여자가 겹치지 않으면 충돌 아님
      const hasCommonParticipant = participants.some((p) =>
        schedule.participants?.includes(p)
      );
      if (!hasCommonParticipant && participants.length > 0) {
        continue;
      }

      // 날짜가 겹치는지 확인
      const dateOverlap = this.isDateOverlap(
        startDate,
        endDate,
        schedule.startDate,
        schedule.endDate
      );

      if (!dateOverlap) {
        continue;
      }

      // 종일 일정인 경우
      if (isAllDay || schedule.isAllDay) {
        // 종일 일정끼리는 같은 날에 여러 개 가능하므로 충돌 아님
        // 단, 시간 지정 일정과 종일 일정은 알림만 표시
        if (isAllDay && schedule.isAllDay) {
          continue;
        }
        // 종일 일정과 시간 지정 일정이 겹치면 알림
        conflictingSchedules.push(schedule);
        continue;
      }

      // 시간이 있는 일정끼리 충돌 체크
      if (startTime && endTime && schedule.startTime && schedule.endTime) {
        // 같은 날인 경우에만 시간 충돌 체크
        if (startDate === schedule.startDate) {
          const timeOverlap = this.isTimeOverlap(
            startTime,
            endTime,
            schedule.startTime,
            schedule.endTime
          );

          if (timeOverlap) {
            conflictingSchedules.push(schedule);
          }
        }
      }
    }

    if (conflictingSchedules.length === 0) {
      return {
        hasConflict: false,
        conflictingSchedules: [],
        conflictType: "none",
        message: "",
      };
    }

    // 충돌 메시지 생성
    const hasAllDayConflict = conflictingSchedules.some((s) => s.isAllDay);
    const hasTimeConflict = conflictingSchedules.some(
      (s) => !s.isAllDay && s.startTime
    );

    let message = "";
    if (hasTimeConflict) {
      const conflictTitles = conflictingSchedules
        .filter((s) => !s.isAllDay)
        .map((s) => `"${s.title}"`)
        .join(", ");
      message = `같은 시간에 ${conflictTitles} 일정이 있습니다.`;
    } else if (hasAllDayConflict) {
      const conflictTitles = conflictingSchedules
        .filter((s) => s.isAllDay)
        .map((s) => `"${s.title}"`)
        .join(", ");
      message = `이 날에 종일 일정 ${conflictTitles}이(가) 있습니다.`;
    }

    return {
      hasConflict: true,
      conflictingSchedules,
      conflictType: hasTimeConflict ? "time" : "allday",
      message,
    };
  }

  /**
   * 특정 참여자의 일정 충돌 확인
   * (다른 참여자가 해당 시간에 바쁜지 확인)
   */
  static checkParticipantAvailability(
    newSchedule: Partial<Schedule>,
    existingSchedules: Schedule[],
    participantId: string,
    excludeScheduleId?: string
  ): { isBusy: boolean; busySchedules: Schedule[] } {
    const { startDate, endDate, startTime, endTime, isAllDay } = newSchedule;

    if (!startDate || !endDate) {
      return { isBusy: false, busySchedules: [] };
    }

    const busySchedules: Schedule[] = [];

    for (const schedule of existingSchedules) {
      if (excludeScheduleId && schedule.id === excludeScheduleId) {
        continue;
      }

      // 해당 참여자의 일정인지 확인
      if (!schedule.participants?.includes(participantId)) {
        continue;
      }

      // 날짜 겹침 확인
      const dateOverlap = this.isDateOverlap(
        startDate,
        endDate,
        schedule.startDate,
        schedule.endDate
      );

      if (!dateOverlap) {
        continue;
      }

      // 종일 일정이면 바쁨
      if (isAllDay || schedule.isAllDay) {
        busySchedules.push(schedule);
        continue;
      }

      // 시간 겹침 확인
      if (startTime && endTime && schedule.startTime && schedule.endTime) {
        if (startDate === schedule.startDate) {
          const timeOverlap = this.isTimeOverlap(
            startTime,
            endTime,
            schedule.startTime,
            schedule.endTime
          );

          if (timeOverlap) {
            busySchedules.push(schedule);
          }
        }
      }
    }

    return {
      isBusy: busySchedules.length > 0,
      busySchedules,
    };
  }

  /**
   * 빈 시간대 찾기
   * (선택한 날짜에서 가능한 시간대 추천)
   */
  static findAvailableTimeSlots(
    date: string,
    existingSchedules: Schedule[],
    participants: string[],
    durationMinutes: number = 60
  ): { startTime: string; endTime: string }[] {
    // 해당 날짜의 일정만 필터
    const daySchedules = existingSchedules.filter((s) => {
      // 날짜가 겹치는지
      if (!this.isDateOverlap(date, date, s.startDate, s.endDate)) {
        return false;
      }
      // 참여자가 겹치는지
      return participants.some((p) => s.participants?.includes(p));
    });

    // 종일 일정이 있으면 빈 시간 없음
    if (daySchedules.some((s) => s.isAllDay)) {
      return [];
    }

    // 시간이 있는 일정만 추출
    const timeSchedules = daySchedules
      .filter((s) => s.startTime && s.endTime)
      .map((s) => ({
        start: dayjs(`${date} ${s.startTime}`),
        end: dayjs(`${date} ${s.endTime}`),
      }))
      .sort((a, b) => a.start.diff(b.start));

    // 가능한 시간대 찾기 (09:00 ~ 22:00)
    const availableSlots: { startTime: string; endTime: string }[] = [];
    let currentTime = dayjs(`${date} 09:00`);
    const endOfDay = dayjs(`${date} 22:00`);

    for (const schedule of timeSchedules) {
      // 현재 시간부터 일정 시작까지 빈 시간이 있는지
      const gapMinutes = schedule.start.diff(currentTime, "minute");
      if (gapMinutes >= durationMinutes) {
        availableSlots.push({
          startTime: currentTime.format("HH:mm"),
          endTime: schedule.start.format("HH:mm"),
        });
      }
      // 현재 시간을 일정 종료 시간으로 업데이트
      if (schedule.end.isAfter(currentTime)) {
        currentTime = schedule.end;
      }
    }

    // 마지막 일정 이후 ~ 22:00까지 빈 시간
    const lastGap = endOfDay.diff(currentTime, "minute");
    if (lastGap >= durationMinutes) {
      availableSlots.push({
        startTime: currentTime.format("HH:mm"),
        endTime: endOfDay.format("HH:mm"),
      });
    }

    return availableSlots;
  }
}

export default ScheduleConflictService;
