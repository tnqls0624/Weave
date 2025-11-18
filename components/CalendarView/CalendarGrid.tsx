import dayjs from "dayjs";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CalendarList, DateData } from "react-native-calendars";
import { Subject } from "rxjs";
import { isHoliday } from "../../constants/holidays";
import type { Schedule, User } from "../../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

// 개별 날짜 셀 컴포넌트 (메모이제이션)
interface DayCellProps {
  day: DateData;
  dayDate: Date;
  dayDateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isHoliday: boolean;
  holidayName?: string;
  dayOfWeek: number;
  dayEvents: Schedule[];
  dayCellHeight: number;
  maxVisibleRows: number;
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
}

const DayCell = React.memo<DayCellProps>(
  ({
    day,
    dayDate,
    dayDateString,
    isCurrentMonth,
    isToday,
    isSelected,
    isHoliday,
    holidayName,
    dayOfWeek,
    dayEvents,
    dayCellHeight,
    maxVisibleRows,
    onSelectDay,
    onDoubleTap,
    getEventColor,
    getEventForDay,
    eventLaneMap,
    eventsDateCache,
  }) => {
    // 전역 핸들러 사용
    const handlePress = useCallback(() => {
      onSelectDay(dayDate);
    }, [onSelectDay, dayDate]);

    let dateColor = isCurrentMonth ? "#374151" : "#d1d5db";
    if (isCurrentMonth) {
      if (dayOfWeek === 0 || isHoliday) dateColor = "#ef4444";
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
        const eventInfo = getEventForDay(schedule, dayDate);
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
        onPress={handlePress}
        style={[
          styles.dayCell,
          { height: dayCellHeight, minHeight: dayCellHeight },
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
            {day.day}
          </Text>
          <View style={styles.holidayLabelSlot}>
            {isHoliday && holidayName ? (
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
                  <Text
                    style={styles.eventBarText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {schedule.title}
                  </Text>
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
    // 메모이제이션 비교 로직 - 함수는 참조가 변경되지 않으므로 비교 제외
    if (prevProps.day.dateString !== nextProps.day.dateString) {
      return false;
    }
    if (prevProps.isCurrentMonth !== nextProps.isCurrentMonth) {
      return false;
    }
    if (prevProps.isToday !== nextProps.isToday) {
      return false;
    }
    if (prevProps.isHoliday !== nextProps.isHoliday) {
      return false;
    }
    if (prevProps.dayOfWeek !== nextProps.dayOfWeek) {
      return false;
    }
    if (prevProps.isSelected !== nextProps.isSelected) {
      return false;
    }
    if (prevProps.dayCellHeight !== nextProps.dayCellHeight) {
      return false;
    }
    if (prevProps.maxVisibleRows !== nextProps.maxVisibleRows) {
      return false;
    }

    // 이벤트 비교
    if (prevProps.dayEvents.length !== nextProps.dayEvents.length) {
      return false;
    }

    // 이벤트 ID만 비교 (내용 변경은 무시하여 성능 최적화)
    const eventsEqual = prevProps.dayEvents.every(
      (schedule: Schedule, i: number) =>
        schedule.id === nextProps.dayEvents[i].id
    );

    // eventsDateCache는 events 변경 시에만 재생성되므로 참조 비교로 충분
    if (prevProps.eventsDateCache !== nextProps.eventsDateCache) {
      return false;
    }

    if (prevProps.eventLaneMap !== nextProps.eventLaneMap) {
      return false;
    }

    return eventsEqual;
  }
);

DayCell.displayName = "DayCell";

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
  // RxJS Subject를 사용한 전역 더블탭 추적
  const tapSubject = useRef(new Subject<Date>()).current;
  const onSelectDayRef = useRef(onSelectDay);
  const onDoubleTapRef = useRef(onDoubleTap);
  const { height: screenHeight } = useWindowDimensions();
  const calendarListRef = useRef<any>(null);
  const calendarHeight = useMemo(() => {
    // dayNames 높이 (약 33px) 제외하고 나머지 공간을 모두 사용
    const dayNamesHeight = 240;
    return screenHeight - dayNamesHeight;
  }, [screenHeight]);

  // 현재 월의 실제 주 수 계산
  const numberOfWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 해당 월의 첫 날
    const firstDay = new Date(year, month, 1);
    // 해당 월의 마지막 날
    const lastDay = new Date(year, month + 1, 0);

    // 첫 날의 요일 (0 = 일요일)
    const firstDayOfWeek = firstDay.getDay();
    // 마지막 날의 일수
    const daysInMonth = lastDay.getDate();

    // 필요한 총 셀 수: 첫 날 이전 빈 셀 + 실제 날짜 수
    const totalCells = firstDayOfWeek + daysInMonth;

    // 필요한 주 수 계산 (올림)
    const weeks = Math.ceil(totalCells / 7);

    // 4주~6주 사이로 유동적 반환
    return weeks;
  }, [currentDate]);

  // 각 주(week)의 높이를 동적으로 계산 (실제 주 수에 따라)
  const weekHeight = useMemo(() => {
    // 화면을 실제 주 수로 나눔
    return calendarHeight / numberOfWeeks;
  }, [calendarHeight, numberOfWeeks]);

  // 각 날짜 셀의 높이 계산
  const dayCellHeight = useMemo(() => {
    return weekHeight;
  }, [weekHeight]);

  const maxVisibleEventRows = useMemo(() => {
    if (numberOfWeeks >= 6) return 2;
    if (numberOfWeeks === 5) return 3;
    return 4;
  }, [numberOfWeeks]);

  const scheduleRanges = useMemo<ScheduleWithRange[]>(() => {
    return schedules.map((schedule: Schedule) => {
      const startDateString = schedule.startDate || dayjs().format("YYYY-MM-DD");
      const eventStart = new Date(`${startDateString}T00:00:00`);
      const endDateString = schedule.endDate || startDateString;
      const eventEnd = new Date(`${endDateString}T00:00:00`);

      return {
        schedule,
        startTime: eventStart.getTime(),
        endTime: eventEnd.getTime(),
      };
    });
  }, [schedules]);

  const visibleRange = useMemo(() => {
    const start = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    start.setHours(0, 0, 0, 0);
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 2,
      0
    );
    end.setHours(23, 59, 59, 999);
    return {
      startTime: start.getTime(),
      endTime: end.getTime(),
    };
  }, [currentDate]);

  const visibleScheduleRanges = useMemo(() => {
    return scheduleRanges.filter(({ startTime, endTime }) => {
      return endTime >= visibleRange.startTime && startTime <= visibleRange.endTime;
    });
  }, [scheduleRanges, visibleRange]);

  // currentDate를 문자열로 변환
  const currentDateString = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, "0")}-01`;
  }, [currentDate]);

  // 선택된 날짜를 문자열로 변환 (성능 최적화)
  const selectedDateString = useMemo(() => {
    if (!selectedDate) return null;
    return selectedDate.toDateString();
  }, [selectedDate]);

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

  // 이벤트 날짜 정보를 사전 계산하여 캐시 (성능 최적화)
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

  // 날짜별 이벤트를 사전 계산하여 캐시 (성능 최적화)
  const eventsByDateCache = useMemo(() => {
    const cache = new Map<string, Schedule[]>();
    visibleScheduleRanges.forEach(({ schedule, startTime, endTime }) => {
      let currentDate = startTime;
      while (currentDate <= endTime) {
        const dateStr = dayjs(currentDate).format("YYYY-MM-DD");
        if (!cache.has(dateStr)) {
          cache.set(dateStr, []);
        }
        cache.get(dateStr)!.push(schedule);
        currentDate += DAY_IN_MS; // 다음 날
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

  const getDayEvents = useCallback(
    (day: Date): Schedule[] => {
      const dateStr = dayjs(day).format("YYYY-MM-DD");
      return eventsByDateCache.get(dateStr) || [];
    },
    [eventsByDateCache]
  );

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

  // RxJS로 더블탭 처리
  useEffect(() => {
    onSelectDayRef.current = onSelectDay;
    onDoubleTapRef.current = onDoubleTap;
  }, [onSelectDay, onDoubleTap]);

  useEffect(() => {
    let lastTapTime = 0;
    let timer: number | null = null;

    const subscription = tapSubject.subscribe((date) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime;

      // 400ms 이내 두 번째 탭 = 더블탭
      if (timeSinceLastTap < 400 && lastTapTime > 0) {
        // 타이머 취소
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        // 더블탭 후 현재 시간으로 업데이트 (연속 더블탭 가능하게)
        lastTapTime = now;
        // 더블탭: 날짜 선택 + drawer 열기 (순차적으로)
        onSelectDayRef.current(date);
        // 약간의 딜레이를 두고 drawer 열기 (자연스러운 순서)
        setTimeout(() => {
          onDoubleTapRef.current(date);
        }, 10);

        timer = setTimeout(() => {
          lastTapTime = 0;
          timer = null;
        }, 400);
      } else {
        // 첫 번째 탭: 즉시 날짜 선택
        lastTapTime = now;
        onSelectDayRef.current(date);

        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          lastTapTime = 0;
          timer = null;
        }, 400);
      }
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      subscription.unsubscribe();
    };
  }, [tapSubject]);

  // 탭 이벤트를 Subject로 전달
  const stableOnSelectDay = useCallback(
    (date: Date) => {
      tapSubject.next(date);
    },
    [tapSubject]
  );

  const stableOnDoubleTap = useCallback(() => {
    // 더 이상 사용하지 않음 (stableOnSelectDay에서 처리)
  }, []);

  // getEventColor와 getEventForDay도 ref로 저장하여 안정적인 참조 유지
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

  // 커스텀 Day 렌더링 함수
  const renderDay = useCallback(
    (day: DateData) => {
      if (!day)
        return (
          <View
            style={[
              styles.dayCell,
              { height: dayCellHeight, minHeight: dayCellHeight },
            ]}
          />
        );

      const dayDate = new Date(day.dateString);
      const dayDateString = dayDate.toDateString();
      const dayMonth = dayDate.getMonth() + 1;
      const dayYear = dayDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const isCurrentMonth =
        dayMonth === currentMonth && dayYear === currentYear;
      const isToday = new Date().toDateString() === dayDateString;
      const dayOfWeek = dayDate.getDay();
      const dayEvents = getDayEvents(dayDate);

      // 공휴일 확인
      const holiday = isHoliday(day.dateString);
      const isHolidayDate = !!holiday;
      const holidayName = holiday?.name;

      // 선택된 날짜인지 확인 (문자열 비교로 성능 최적화)
      const isSelected = selectedDateString === dayDateString;

      return (
        <DayCell
          day={day}
          dayDate={dayDate}
          dayDateString={dayDateString}
          isCurrentMonth={isCurrentMonth}
          isToday={isToday}
          isSelected={isSelected}
          isHoliday={isHolidayDate}
          holidayName={holidayName}
          dayOfWeek={dayOfWeek}
          dayEvents={dayEvents}
          dayCellHeight={dayCellHeight}
          maxVisibleRows={maxVisibleEventRows}
          onSelectDay={stableOnSelectDay}
          onDoubleTap={stableOnDoubleTap}
          getEventColor={stableGetEventColor}
          getEventForDay={stableGetEventForDay}
          eventLaneMap={eventLaneMap}
          eventsDateCache={eventsDateCache}
        />
      );
    },
    [
      dayCellHeight,
      currentDate,
      selectedDateString,
      getDayEvents,
      stableOnSelectDay,
      stableOnDoubleTap,
      stableGetEventColor,
      stableGetEventForDay,
      maxVisibleEventRows,
      eventLaneMap,
      eventsDateCache,
    ]
  );

  // CalendarList에서 월 변경 감지
  const handleVisibleMonthsChange = useCallback(
    (months: { month: number; year: number }[]) => {
      if (months.length === 0) return;

      const visibleMonth = months[0];
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      if (
        visibleMonth.year !== currentYear ||
        visibleMonth.month !== currentMonth
      ) {
        const yearDiff = visibleMonth.year - currentYear;
        const monthDiff = yearDiff * 12 + (visibleMonth.month - currentMonth);
        onChangeMonth(monthDiff);
      }
    },
    [currentDate, onChangeMonth]
  );

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const CustomDayComponent = useMemo(
    () =>
      ({ date }: { date: DateData }) => {
        return renderDay(date);
      },
    [renderDay]
  );

  const headerStyle = useMemo(() => ({ display: "none" as const }), []);

  const calendarStyle = useMemo(
    () => [styles.calendar, { height: calendarHeight }],
    [calendarHeight]
  );

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
      <CalendarList
        ref={calendarListRef}
        headerStyle={headerStyle}
        current={currentDateString}
        horizontal={true}
        pagingEnabled={true}
        pastScrollRange={120}
        futureScrollRange={120}
        scrollEnabled={true}
        hideArrows={true}
        hideExtraDays={false}
        disableMonthChange={true}
        firstDay={0}
        hideDayNames={true}
        dayComponent={CustomDayComponent as any}
        onVisibleMonthsChange={handleVisibleMonthsChange}
        theme={{
          weekVerticalMargin: 0,
        }}
        style={calendarStyle}
        markingType="custom"
        enableSwipeMonths={false}
        showWeekNumbers={false}
        displayLoadingIndicator={false}
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
  calendar: {},
  dayCell: {
    width: "100%",
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 0,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    overflow: "visible",
  },
  selectedDayCell: {
    backgroundColor: "#f3f4f6",
  },
  dayNumberContainer: {
    alignItems: "center",
    width: "100%",
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 16,
    marginHorizontal: 4,
    fontWeight: "500",
  },
  holidayLabelSlot: {
    height: 12,
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
    borderRadius: 15,
    paddingHorizontal: 3,
    paddingVertical: 2,
    textAlign: "center",
    fontWeight: "bold",
    color: "#fff",
    overflow: "hidden",
  },
  eventsContainer: {
    width: "100%",
    flex: 1,
    overflow: "visible",
  },
  eventsContainerTight: {
    paddingHorizontal: 1,
  },
  eventBarPlaceholder: {
    height: 18,
    marginBottom: 2,
    width: "100%",
    paddingHorizontal: 4,
  },
  eventBar: {
    height: 18,
    paddingHorizontal: 4,
    justifyContent: "center",
    marginBottom: 2,
    overflow: "visible",
    width: "100%",
  },
  eventBarStart: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  eventBarEnd: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  eventBarContinuation: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginLeft: -1,
  },
  eventBarNotEnd: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginRight: -1,
  },
  eventBarText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    overflow: "hidden",
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

// CalendarGrid 컴포넌트를 메모이제이션하여 불필요한 리렌더링 방지
const CalendarGrid = React.memo(
  CalendarGridComponent,
  (prevProps, nextProps) => {
    // Date 객체는 참조가 다르므로 시간 값으로 비교
    if (prevProps.currentDate.getTime() !== nextProps.currentDate.getTime()) {
      return false;
    }

    if (
      prevProps.selectedDate?.getTime() !== nextProps.selectedDate?.getTime()
    ) {
      return false;
    }

    // 일정 배열 비교 (ID와 길이만 비교)
    if (prevProps.schedules.length !== nextProps.schedules.length) {
      return false;
    }

    const schedulesEqual = prevProps.schedules.every(
      (schedule, i) => schedule.id === nextProps.schedules[i]?.id
    );
    if (!schedulesEqual) {
      return false;
    }

    // 사용자 배열 비교
    if (prevProps.users.length !== nextProps.users.length) {
      return false;
    }

    // 현재 사용자 비교
    if (prevProps.currentUser.id !== nextProps.currentUser.id) {
      return false;
    }

    // animationDirection 비교
    if (prevProps.animationDirection !== nextProps.animationDirection) {
      return false;
    }

    // 함수는 참조 비교 (부모에서 useCallback으로 안정화되어야 함)
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
