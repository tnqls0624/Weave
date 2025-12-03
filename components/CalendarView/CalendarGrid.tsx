import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { isHoliday } from "../../constants/holidays";
import type { Schedule, User } from "../../types";

// 음력을 양력으로 변환하는 헬퍼 함수
const lunarToSolar = (year: number, month: number, day: number): { year: number; month: number; day: number } | null => {
  try {
    const calendar = new KoreanLunarCalendar();
    calendar.setLunarDate(year, month, day, false); // false = 평달 (윤달 아님)
    const solarDate = calendar.getSolarCalendar();
    return { year: solarDate.year, month: solarDate.month, day: solarDate.day };
  } catch {
    return null;
  }
};

// 특정 연도의 음력 날짜를 양력으로 변환
const getLunarDateInYear = (lunarMonth: number, lunarDay: number, targetYear: number): string | null => {
  const solar = lunarToSolar(targetYear, lunarMonth, lunarDay);
  if (!solar) return null;
  return `${solar.year}-${String(solar.month).padStart(2, "0")}-${String(solar.day).padStart(2, "0")}`;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// 모듈 레벨 변수 - 더블탭 감지용 (리렌더링 영향 없음)
let lastTapTime = 0;
let lastTapDateString = "";

const PARTICIPANT_COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  orange: "#fb923c",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#34d399",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#60a5fa",
  indigo: "#6366f1",
  violet: "#a78bfa",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
  gray: "#9ca3af",
};

type ScheduleWithRange = {
  schedule: Schedule;
  startTime: number;
  endTime: number;
};

interface CalendarGridProps {
  currentDate: Date;
  schedules: Schedule[];
  users: User[];
  currentUser: User;
  onSelectDay: (date: Date) => void;
  onDoubleTap: (date: Date) => void;
  onChangeMonth: (amount: number) => void;
  animationDirection: "left" | "right" | null;
  onAnimationEnd: () => void;
  selectedDate: Date | null;
}

// 월 데이터 타입
interface MonthData {
  key: string;
  year: number;
  month: number; // 0-indexed
}

// 개별 날짜 셀 컴포넌트 (메모이제이션)
interface DayCellProps {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isHolidayDate: boolean;
  holidayName?: string;
  dayOfWeek: number;
  dayEvents: Schedule[];
  dayCellHeight: number;
  dayCellWidth: number;
  maxVisibleRows: number;
  getEventColor: (schedule: Schedule) => string;
  getEventForDay: (
    schedule: Schedule,
    day: Date
  ) => { isStart: boolean; isEnd: boolean; visible: boolean };
  eventLaneMap: Map<string, number>;
  eventsDateCache: Map<
    string,
    {
      startTime: number;
      endTime: number;
      startDateStr: string;
      endDateStr: string;
    }
  >;
  onPress: () => void;
}

const DayCell = React.memo<DayCellProps>(
  ({
    date,
    dateString,
    isCurrentMonth,
    isToday,
    isSelected,
    isHolidayDate,
    holidayName,
    dayOfWeek,
    dayEvents,
    dayCellHeight,
    dayCellWidth,
    maxVisibleRows,
    getEventColor,
    getEventForDay,
    eventLaneMap,
    eventsDateCache,
    onPress,
  }) => {
    let dateColor = isCurrentMonth ? "#374151" : "#d1d5db";
    if (isCurrentMonth) {
      if (dayOfWeek === 0 || isHolidayDate) dateColor = "#ef4444";
      if (dayOfWeek === 6) dateColor = "#007AFF";
    }

    type VisibleEvent = {
      schedule: Schedule;
      lane: number;
      eventInfo: { isStart: boolean; isEnd: boolean; visible: boolean };
      dateInfo:
        | {
            startTime: number;
            endTime: number;
            startDateStr: string;
            endDateStr: string;
          }
        | undefined;
    };

    const visibleEvents: VisibleEvent[] = dayEvents
      .map((schedule: Schedule) => {
        const eventInfo = getEventForDay(schedule, date);
        if (!eventInfo.visible) {
          return null;
        }
        const lane = eventLaneMap.get(schedule.id) ?? 0;
        const dateInfo = eventsDateCache.get(schedule.id);
        return {
          schedule,
          lane,
          eventInfo,
          dateInfo,
        };
      })
      .filter(Boolean) as VisibleEvent[];

    const sortedVisibleEvents = visibleEvents.sort((a, b) => {
      if (a.lane !== b.lane) {
        return a.lane - b.lane;
      }
      const aStart = a.dateInfo?.startTime ?? 0;
      const bStart = b.dateInfo?.startTime ?? 0;
      if (aStart !== bStart) {
        return aStart - bStart;
      }
      const aEnd = a.dateInfo?.endTime ?? 0;
      const bEnd = b.dateInfo?.endTime ?? 0;
      return aEnd - bEnd;
    });

    const eventRows: (VisibleEvent | null)[] = Array(maxVisibleRows).fill(null);
    let overflowCount = 0;

    sortedVisibleEvents.forEach((eventData) => {
      const { lane } = eventData;
      if (lane < maxVisibleRows) {
        if (!eventRows[lane]) {
          eventRows[lane] = eventData;
        } else {
          overflowCount += 1;
        }
      } else {
        overflowCount += 1;
      }
    });

    const hasMultiDayEvent = eventRows.some(
      (event) =>
        event &&
        event.dateInfo &&
        event.dateInfo.startTime !== event.dateInfo.endTime
    );

    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.dayCell,
          { height: dayCellHeight, minHeight: dayCellHeight, width: dayCellWidth },
          isSelected && styles.selectedDayCell,
        ]}
      >
        <View style={styles.dayNumberContainer}>
          <Text
            style={[
              styles.dayNumber,
              { color: dateColor },
              isToday && styles.today,
            ]}
          >
            {date.getDate()}
          </Text>
          <View style={styles.holidayLabelSlot}>
            {isHolidayDate && holidayName ? (
              <Text style={styles.holidayName} numberOfLines={1}>
                {holidayName}
              </Text>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.eventsContainer,
            !hasMultiDayEvent && styles.eventsContainerTight,
          ]}
        >
          {eventRows.map((eventWithLane, idx: number) => {
            if (!eventWithLane) {
              return (
                <View
                  key={`event-placeholder-${idx}`}
                  style={[
                    styles.eventBarPlaceholder,
                    idx === 0 && styles.firstEventBar,
                  ]}
                />
              );
            }

            const { schedule, eventInfo, dateInfo } = eventWithLane;

            const isMultiDay =
              dateInfo && dateInfo.startTime !== dateInfo.endTime;

            return (
              <View
                key={schedule.id}
                style={[
                  styles.eventBar,
                  {
                    backgroundColor: getEventColor(schedule),
                  },
                  eventInfo.isStart && styles.eventBarStart,
                  !eventInfo.isStart &&
                    isMultiDay &&
                    styles.eventBarContinuation,
                  eventInfo.isEnd && styles.eventBarEnd,
                  !eventInfo.isEnd && isMultiDay && styles.eventBarNotEnd,
                  idx === 0 && styles.firstEventBar,
                ]}
              >
                {eventInfo.isStart && (
                  <View style={styles.eventBarContent}>
                    {schedule.isImportant && (
                      <Ionicons name="star" size={10} color="#fff" style={styles.importantIcon} />
                    )}
                    <Text
                      style={styles.eventBarText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {schedule.title}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          {overflowCount > 0 && (
            <Text style={styles.moreEvents}>+{overflowCount}</Text>
          )}
        </View>
      </Pressable>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.dateString !== nextProps.dateString) return false;
    if (prevProps.isCurrentMonth !== nextProps.isCurrentMonth) return false;
    if (prevProps.isToday !== nextProps.isToday) return false;
    if (prevProps.isHolidayDate !== nextProps.isHolidayDate) return false;
    if (prevProps.dayOfWeek !== nextProps.dayOfWeek) return false;
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.dayCellHeight !== nextProps.dayCellHeight) return false;
    if (prevProps.dayCellWidth !== nextProps.dayCellWidth) return false;
    if (prevProps.maxVisibleRows !== nextProps.maxVisibleRows) return false;
    if (prevProps.dayEvents.length !== nextProps.dayEvents.length) return false;

    const eventsEqual = prevProps.dayEvents.every(
      (schedule: Schedule, i: number) =>
        schedule.id === nextProps.dayEvents[i].id
    );
    if (!eventsEqual) return false;

    if (prevProps.eventsDateCache !== nextProps.eventsDateCache) return false;
    if (prevProps.eventLaneMap !== nextProps.eventLaneMap) return false;

    return true;
  }
);

DayCell.displayName = "DayCell";

// 월 그리드 컴포넌트
interface MonthGridProps {
  year: number;
  month: number;
  selectedDate: Date | null;
  screenWidth: number;
  calendarHeight: number;
  onSelectDay: (date: Date) => void;
  onDoubleTap: (date: Date) => void;
  getEventColor: (schedule: Schedule) => string;
  getEventForDay: (
    schedule: Schedule,
    day: Date
  ) => { isStart: boolean; isEnd: boolean; visible: boolean };
  eventLaneMap: Map<string, number>;
  eventsDateCache: Map<
    string,
    {
      startTime: number;
      endTime: number;
      startDateStr: string;
      endDateStr: string;
    }
  >;
  eventsByDateCache: Map<string, Schedule[]>;
}

const MonthGrid = React.memo<MonthGridProps>(({
  year,
  month,
  selectedDate,
  screenWidth,
  calendarHeight,
  onSelectDay,
  onDoubleTap,
  getEventColor,
  getEventForDay,
  eventLaneMap,
  eventsDateCache,
  eventsByDateCache,
}) => {
  const dayCellWidth = screenWidth / 7;

  // 해당 월의 첫째 날
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();

  // 해당 월의 마지막 날
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // 이전 달의 마지막 날
  const prevMonthLastDay = new Date(year, month, 0);
  const prevMonthDays = prevMonthLastDay.getDate();

  // 필요한 주 수 계산
  const totalCells = firstDayOfWeek + daysInMonth;
  const numberOfWeeks = Math.ceil(totalCells / 7);

  const dayCellHeight = calendarHeight / numberOfWeeks;

  const maxVisibleEventRows = useMemo(() => {
    if (numberOfWeeks >= 6) return 2;
    if (numberOfWeeks === 5) return 3;
    return 4;
  }, [numberOfWeeks]);

  const selectedDateString = selectedDate?.toDateString() ?? null;
  const todayString = new Date().toDateString();

  // 날짜 배열 생성
  const days = useMemo(() => {
    const result: Array<{
      date: Date;
      dateString: string;
      isCurrentMonth: boolean;
    }> = [];

    // 이전 달 날짜들 (첫 주 채우기)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      result.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: false,
      });
    }

    // 현재 달 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      result.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: true,
      });
    }

    // 다음 달 날짜들 (마지막 주 채우기)
    const remainingCells = numberOfWeeks * 7 - result.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      result.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: false,
      });
    }

    return result;
  }, [year, month, firstDayOfWeek, daysInMonth, numberOfWeeks, prevMonthDays]);

  // 주 단위로 그룹화
  const weeks = useMemo(() => {
    const result: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const getDayEvents = useCallback(
    (dateStr: string): Schedule[] => {
      return eventsByDateCache.get(dateStr) || [];
    },
    [eventsByDateCache]
  );

  const handlePress = useCallback(
    (date: Date, dateStr: string) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime;
      const isSameDate = lastTapDateString === dateStr;
      const isDoubleTap = timeSinceLastTap < 400 && isSameDate;

      console.log('TAP:', { day: date.getDate(), timeSinceLastTap, isDoubleTap, isSameDate });

      // 모듈 레벨 변수 업데이트
      lastTapTime = now;
      lastTapDateString = dateStr;

      if (isDoubleTap) {
        lastTapTime = 0;
        lastTapDateString = "";
        onDoubleTap(date);
      } else {
        onSelectDay(date);
      }
    },
    [onSelectDay, onDoubleTap]
  );

  return (
    <View style={[styles.monthGrid, { width: screenWidth, height: calendarHeight }]}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((dayData) => {
            const { date, dateString, isCurrentMonth } = dayData;
            const dayOfWeek = date.getDay();
            const dayEvents = getDayEvents(dateString);
            const holiday = isHoliday(dateString);
            const isHolidayDate = !!holiday;
            const holidayName = holiday?.name;
            const isToday = date.toDateString() === todayString;
            const isSelected = date.toDateString() === selectedDateString;

            return (
              <DayCell
                key={dateString}
                date={date}
                dateString={dateString}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                isSelected={isSelected}
                isHolidayDate={isHolidayDate}
                holidayName={holidayName}
                dayOfWeek={dayOfWeek}
                dayEvents={dayEvents}
                dayCellHeight={dayCellHeight}
                dayCellWidth={dayCellWidth}
                maxVisibleRows={maxVisibleEventRows}
                getEventColor={getEventColor}
                getEventForDay={getEventForDay}
                eventLaneMap={eventLaneMap}
                eventsDateCache={eventsDateCache}
                onPress={() => handlePress(date, dateString)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

MonthGrid.displayName = "MonthGrid";

const CalendarGridComponent: React.FC<CalendarGridProps> = ({
  currentDate,
  schedules,
  users,
  currentUser,
  onSelectDay,
  onDoubleTap,
  onChangeMonth,
  animationDirection,
  onAnimationEnd,
  selectedDate,
}) => {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const isScrolling = useRef(false);
  const currentIndexRef = useRef(120); // 중앙 인덱스 (120개월 전후)

  // 월 데이터의 기준 날짜 저장 (초기 렌더링 시점의 currentDate)
  const baseMonthRef = useRef({ year: currentDate.getFullYear(), month: currentDate.getMonth() });

  const calendarHeight = useMemo(() => {
    const dayNamesHeight = 240;
    return screenHeight - dayNamesHeight;
  }, [screenHeight]);

  // 월 데이터 생성 (240개월: 10년 전후)
  const monthsData = useMemo<MonthData[]>(() => {
    const result: MonthData[] = [];
    const { year: baseYear, month: baseMonth } = baseMonthRef.current;

    for (let i = -120; i <= 120; i++) {
      const date = new Date(baseYear, baseMonth + i, 1);
      result.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        year: date.getFullYear(),
        month: date.getMonth(),
      });
    }
    return result;
  }, []);

  // currentDate가 변경되면 해당 월로 스크롤
  useEffect(() => {
    const { year: baseYear, month: baseMonth } = baseMonthRef.current;
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();

    // 기준 월에서 타겟 월까지의 차이 계산
    const monthDiff = (targetYear - baseYear) * 12 + (targetMonth - baseMonth);
    const targetIndex = 120 + monthDiff;

    // 인덱스 범위 체크 (0 ~ 240)
    const maxIndex = monthsData.length - 1;
    const safeIndex = Math.max(0, Math.min(targetIndex, maxIndex));

    // 현재 인덱스와 다르면 스크롤
    if (safeIndex !== currentIndexRef.current && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: safeIndex, animated: false });
      currentIndexRef.current = safeIndex;
    }
  }, [currentDate, monthsData.length]);

  // 현재 연도 기준 전후 1년씩 (총 3년치) 미리 캐싱
  const visibleRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const start = new Date(year - 1, 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year + 1, 11, 31);
    end.setHours(23, 59, 59, 999);
    return {
      startTime: start.getTime(),
      endTime: end.getTime(),
      year,
      startYear: year - 1,
      endYear: year + 1,
    };
  }, [currentDate.getFullYear()]);

  // 반복 일정을 펼쳐서 여러 인스턴스로 생성 (음력 지원)
  const scheduleRanges = useMemo<ScheduleWithRange[]>(() => {
    const ranges: ScheduleWithRange[] = [];

    schedules.forEach((schedule: Schedule) => {
      const startDateString = schedule.startDate || dayjs().format("YYYY-MM-DD");
      const originalStart = dayjs(startDateString);
      const endDateString = schedule.endDate || startDateString;
      const duration = dayjs(endDateString).diff(originalStart, "day");

      const repeatType = schedule.repeatType?.toLowerCase() || "none";
      const isLunar = schedule.calendarType?.toLowerCase() === "lunar";

      // 음력 일정이면서 반복이 있는 경우: 매년 음력 날짜를 양력으로 변환
      if (isLunar && repeatType === "yearly") {
        // 원본 음력 날짜 (월, 일만 사용)
        const lunarMonth = originalStart.month() + 1; // dayjs는 0-indexed
        const lunarDay = originalStart.date();

        // visibleRange의 각 연도에 대해 음력을 양력으로 변환
        for (let year = visibleRange.startYear; year <= visibleRange.endYear; year++) {
          const solarDateString = getLunarDateInYear(lunarMonth, lunarDay, year);
          if (!solarDateString) continue;

          const solarStart = dayjs(solarDateString);
          const solarEnd = solarStart.add(duration, "day");

          const instanceStart = solarStart.toDate();
          instanceStart.setHours(0, 0, 0, 0);
          const instanceEnd = solarEnd.toDate();
          instanceEnd.setHours(0, 0, 0, 0);

          // visibleRange 내에 있는 인스턴스만 추가
          if (instanceEnd.getTime() >= visibleRange.startTime && instanceStart.getTime() <= visibleRange.endTime) {
            const instanceId = `${schedule.id}_lunar_${year}`;
            ranges.push({
              schedule: {
                ...schedule,
                id: instanceId,
                startDate: solarStart.format("YYYY-MM-DD"),
                endDate: solarEnd.format("YYYY-MM-DD"),
              },
              startTime: instanceStart.getTime(),
              endTime: instanceEnd.getTime(),
            });
          }
        }
        return;
      }

      // 음력 일정이면서 반복 없음: 원본 음력 날짜를 해당 연도 양력으로 변환
      if (isLunar && repeatType === "none") {
        const lunarMonth = originalStart.month() + 1;
        const lunarDay = originalStart.date();
        const lunarYear = originalStart.year();

        const solarDateString = getLunarDateInYear(lunarMonth, lunarDay, lunarYear);
        if (solarDateString) {
          const solarStart = dayjs(solarDateString);
          const solarEnd = solarStart.add(duration, "day");

          const eventStart = solarStart.toDate();
          eventStart.setHours(0, 0, 0, 0);
          const eventEnd = solarEnd.toDate();
          eventEnd.setHours(0, 0, 0, 0);

          ranges.push({
            schedule: {
              ...schedule,
              startDate: solarStart.format("YYYY-MM-DD"),
              endDate: solarEnd.format("YYYY-MM-DD"),
            },
            startTime: eventStart.getTime(),
            endTime: eventEnd.getTime(),
          });
        }
        return;
      }

      // 양력 반복 없는 일정
      if (repeatType === "none") {
        const eventStart = new Date(`${startDateString}T00:00:00`);
        const eventEnd = new Date(`${endDateString}T00:00:00`);
        ranges.push({
          schedule,
          startTime: eventStart.getTime(),
          endTime: eventEnd.getTime(),
        });
        return;
      }

      // 양력 반복 일정: visibleRange 내에서 인스턴스 생성
      const rangeStart = dayjs(visibleRange.startTime);
      const rangeEnd = dayjs(visibleRange.endTime);

      // 반복 타입에 따라 인스턴스 생성
      let currentDate = originalStart;

      // 시작일이 visibleRange 이전이면, visibleRange 시작점 근처로 점프
      if (currentDate.isBefore(rangeStart)) {
        if (repeatType === "yearly") {
          // 연간 반복: visibleRange 시작 연도로 점프
          const yearDiff = rangeStart.year() - currentDate.year();
          currentDate = currentDate.add(yearDiff, "year");
          // 아직 이전이면 1년 더
          if (currentDate.isBefore(rangeStart)) {
            currentDate = currentDate.add(1, "year");
          }
          // 1년 앞으로 한번 더 가서 이전 해도 포함
          currentDate = currentDate.subtract(1, "year");
        } else if (repeatType === "monthly") {
          // 월간 반복: visibleRange 시작 월로 점프
          const monthDiff = rangeStart.diff(currentDate, "month");
          currentDate = currentDate.add(Math.max(0, monthDiff - 1), "month");
        } else if (repeatType === "weekly") {
          // 주간 반복: visibleRange 시작 주로 점프
          const weekDiff = rangeStart.diff(currentDate, "week");
          currentDate = currentDate.add(Math.max(0, weekDiff - 1), "week");
        } else if (repeatType === "daily") {
          // 일간 반복: visibleRange 시작일로 점프
          currentDate = rangeStart;
        }
      }

      // 반복 인스턴스 생성 (최대 1000개로 제한)
      let count = 0;
      const maxInstances = 1000;

      while (currentDate.isBefore(rangeEnd) && count < maxInstances) {
        const instanceStart = currentDate.toDate();
        instanceStart.setHours(0, 0, 0, 0);
        const instanceEnd = currentDate.add(duration, "day").toDate();
        instanceEnd.setHours(0, 0, 0, 0);

        // visibleRange 내에 있는 인스턴스만 추가
        if (instanceEnd.getTime() >= visibleRange.startTime && instanceStart.getTime() <= visibleRange.endTime) {
          // 반복 인스턴스는 고유 ID 생성 (원본ID_날짜)
          const instanceId = `${schedule.id}_${currentDate.format("YYYY-MM-DD")}`;
          ranges.push({
            schedule: {
              ...schedule,
              id: instanceId,
              // 반복 인스턴스의 날짜 업데이트
              startDate: currentDate.format("YYYY-MM-DD"),
              endDate: currentDate.add(duration, "day").format("YYYY-MM-DD"),
            },
            startTime: instanceStart.getTime(),
            endTime: instanceEnd.getTime(),
          });
        }

        // 다음 반복으로 이동
        switch (repeatType) {
          case "daily":
            currentDate = currentDate.add(1, "day");
            break;
          case "weekly":
            currentDate = currentDate.add(1, "week");
            break;
          case "monthly":
            currentDate = currentDate.add(1, "month");
            break;
          case "yearly":
            currentDate = currentDate.add(1, "year");
            break;
          default:
            currentDate = rangeEnd; // 루프 종료
        }
        count++;
      }
    });

    return ranges;
  }, [schedules, visibleRange]);

  const visibleScheduleRanges = useMemo(() => {
    return scheduleRanges.filter(({ startTime, endTime }) => {
      return (
        endTime >= visibleRange.startTime && startTime <= visibleRange.endTime
      );
    });
  }, [scheduleRanges, visibleRange]);

  const userColorMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      if (user.id) {
        map.set(user.id, user.color || "gray");
      }
    });
    return map;
  }, [users]);

  const getEventColor = useCallback(
    (schedule: Schedule): string => {
      const firstParticipantId = schedule.participants[0];
      if (firstParticipantId && userColorMap.has(firstParticipantId)) {
        const colorName = userColorMap.get(firstParticipantId)!;
        return (
          PARTICIPANT_COLOR_MAP[colorName] || PARTICIPANT_COLOR_MAP["gray"]
        );
      }
      return PARTICIPANT_COLOR_MAP["gray"];
    },
    [userColorMap]
  );

  type EventDateInfo = {
    startTime: number;
    endTime: number;
    startDateStr: string;
    endDateStr: string;
  };

  const eventsDateCache = useMemo(() => {
    const cache = new Map<string, EventDateInfo>();
    visibleScheduleRanges.forEach(({ schedule, startTime, endTime }) => {
      cache.set(schedule.id, {
        startTime,
        endTime,
        startDateStr: schedule.startDate || "",
        endDateStr: schedule.endDate || schedule.startDate || "",
      });
    });
    return cache;
  }, [visibleScheduleRanges]);

  const eventsByDateCache = useMemo(() => {
    const cache = new Map<string, Schedule[]>();
    visibleScheduleRanges.forEach(({ schedule, startTime, endTime }) => {
      let currentTime = startTime;
      while (currentTime <= endTime) {
        const dateStr = dayjs(currentTime).format("YYYY-MM-DD");
        if (!cache.has(dateStr)) {
          cache.set(dateStr, []);
        }
        cache.get(dateStr)!.push(schedule);
        currentTime += DAY_IN_MS;
      }
    });
    return cache;
  }, [visibleScheduleRanges]);

  const eventLaneMap = useMemo(() => {
    const laneAssignments = new Map<string, number>();
    const laneEndTimes: number[] = [];

    const sortedSchedules = [...visibleScheduleRanges].sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.endTime - b.endTime;
    });

    sortedSchedules.forEach(({ schedule, startTime, endTime }) => {
      let assignedLane = -1;
      for (let laneIndex = 0; laneIndex < laneEndTimes.length; laneIndex += 1) {
        if (startTime > laneEndTimes[laneIndex]) {
          assignedLane = laneIndex;
          laneEndTimes[laneIndex] = endTime;
          break;
        }
      }

      if (assignedLane === -1) {
        laneEndTimes.push(endTime);
        assignedLane = laneEndTimes.length - 1;
      }

      laneAssignments.set(schedule.id, assignedLane);
    });

    return laneAssignments;
  }, [visibleScheduleRanges]);

  const getEventForDay = useCallback(
    (
      schedule: Schedule,
      day: Date
    ): { isStart: boolean; isEnd: boolean; visible: boolean } => {
      const dateInfo = eventsDateCache.get(schedule.id);
      if (!dateInfo) {
        return { isStart: false, isEnd: false, visible: false };
      }

      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayTime = dayStart.getTime();

      if (dayTime < dateInfo.startTime || dayTime > dateInfo.endTime) {
        return { isStart: false, isEnd: false, visible: false };
      }

      const isStart = dayTime === dateInfo.startTime;
      const isEnd = dayTime === dateInfo.endTime;

      return { isStart, isEnd, visible: true };
    },
    [eventsDateCache]
  );

  // Refs for stable callbacks
  const getEventColorRef = useRef(getEventColor);
  getEventColorRef.current = getEventColor;

  const getEventForDayRef = useRef(getEventForDay);
  getEventForDayRef.current = getEventForDay;

  const stableGetEventColor = useCallback(
    (schedule: Schedule) => getEventColorRef.current(schedule),
    []
  );

  const stableGetEventForDay = useCallback(
    (schedule: Schedule, day: Date) => getEventForDayRef.current(schedule, day),
    []
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / screenWidth);

      if (newIndex !== currentIndexRef.current) {
        const diff = newIndex - currentIndexRef.current;
        currentIndexRef.current = newIndex;
        onChangeMonth(diff);
      }
    },
    [screenWidth, onChangeMonth]
  );

  const renderMonth = useCallback(
    ({ item }: { item: MonthData }) => {
      return (
        <MonthGrid
          year={item.year}
          month={item.month}
          selectedDate={selectedDate}
          screenWidth={screenWidth}
          calendarHeight={calendarHeight}
          onSelectDay={onSelectDay}
          onDoubleTap={onDoubleTap}
          getEventColor={stableGetEventColor}
          getEventForDay={stableGetEventForDay}
          eventLaneMap={eventLaneMap}
          eventsDateCache={eventsDateCache}
          eventsByDateCache={eventsByDateCache}
        />
      );
    },
    [
      selectedDate,
      screenWidth,
      calendarHeight,
      onSelectDay,
      onDoubleTap,
      stableGetEventColor,
      stableGetEventForDay,
      eventLaneMap,
      eventsDateCache,
      eventsByDateCache,
    ]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth]
  );

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <View style={styles.container}>
      <View style={styles.dayNames}>
        {dayNames.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.dayName,
              i === 0 && styles.sunday,
              i === 6 && styles.saturday,
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
      <FlatList
        ref={flatListRef}
        data={monthsData}
        renderItem={renderMonth}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={120}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        removeClippedSubviews={false}
        maxToRenderPerBatch={25}
        windowSize={51}
        initialNumToRender={25}
        updateCellsBatchingPeriod={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  dayNames: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    alignItems: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    paddingVertical: 8,
  },
  sunday: {
    color: "#ef4444",
  },
  saturday: {
    color: "#007AFF",
  },
  monthGrid: {
    flexDirection: "column",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 0,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    overflow: "visible",
    zIndex: 1,
  },
  selectedDayCell: {
    backgroundColor: "#f3f4f6",
  },
  dayNumberContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 26,
    marginBottom: 0,
  },
  dayNumber: {
    fontSize: 12,
    marginHorizontal: 3,
    fontWeight: "500",
  },
  holidayLabelSlot: {
    height: 8,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  holidayName: {
    fontSize: 8,
    color: "#ef4444",
    fontWeight: "600",
  },
  today: {
    backgroundColor: "#000",
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 20,
    fontWeight: "bold",
    fontSize: 11,
    color: "#fff",
    overflow: "hidden",
  },
  eventsContainer: {
    width: "100%",
    flex: 1,
    overflow: "visible",
    zIndex: 10,
  },
  eventsContainerTight: {
    paddingHorizontal: 1,
  },
  eventBarPlaceholder: {
    height: 20,
    marginBottom: 3,
    width: "100%",
    paddingHorizontal: 4,
  },
  eventBar: {
    height: 20,
    paddingHorizontal: 3,
    justifyContent: "center",
    marginBottom: 3,
    marginHorizontal: 2,
    overflow: "hidden",
    zIndex: 5,
  },
  eventBarStart: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  eventBarEnd: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  eventBarContinuation: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginLeft: -2,
  },
  eventBarNotEnd: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginRight: -2,
  },
  eventBarContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    overflow: "hidden",
  },
  importantIcon: {
    marginRight: 2,
  },
  eventBarText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    overflow: "hidden",
    flex: 1,
  },
  firstEventBar: {
    marginTop: 2,
  },
  moreEvents: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
});

const CalendarGrid = React.memo(
  CalendarGridComponent,
  (prevProps, nextProps) => {
    if (prevProps.currentDate.getTime() !== nextProps.currentDate.getTime()) {
      return false;
    }

    if (
      prevProps.selectedDate?.getTime() !== nextProps.selectedDate?.getTime()
    ) {
      return false;
    }

    if (prevProps.schedules.length !== nextProps.schedules.length) {
      return false;
    }

    const schedulesEqual = prevProps.schedules.every(
      (schedule, i) => schedule.id === nextProps.schedules[i]?.id
    );
    if (!schedulesEqual) {
      return false;
    }

    if (prevProps.users.length !== nextProps.users.length) {
      return false;
    }

    if (prevProps.currentUser.id !== nextProps.currentUser.id) {
      return false;
    }

    if (prevProps.animationDirection !== nextProps.animationDirection) {
      return false;
    }

    if (prevProps.onSelectDay !== nextProps.onSelectDay) {
      return false;
    }

    if (prevProps.onDoubleTap !== nextProps.onDoubleTap) {
      return false;
    }

    if (prevProps.onChangeMonth !== nextProps.onChangeMonth) {
      return false;
    }

    if (prevProps.onAnimationEnd !== nextProps.onAnimationEnd) {
      return false;
    }

    return true;
  }
);

CalendarGrid.displayName = "CalendarGrid";

export default CalendarGrid;
