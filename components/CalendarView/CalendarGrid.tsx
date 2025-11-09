import dayjs from "dayjs";
import React, { useCallback, useMemo, useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CalendarList, DateData } from "react-native-calendars";
// @ts-ignore
import DoubleClick from "react-native-double-tap";
import { isHoliday } from "../../constants/holidays";
import type { Schedule, User } from "../../types";

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
  onSelectDay: (date: Date) => void;
  onDoubleTap: (date: Date) => void;
  getEventColor: (schedule: Schedule) => string;
  getEventForDay: (
    schedule: Schedule,
    day: Date
  ) => { isStart: boolean; isEnd: boolean; visible: boolean };
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
    onSelectDay,
    onDoubleTap,
    getEventColor,
    getEventForDay,
    eventsDateCache,
  }) => {
    let dateColor = isCurrentMonth ? "#374151" : "#d1d5db";
    if (isCurrentMonth) {
      if (dayOfWeek === 0 || isHoliday) dateColor = "#ef4444";
      if (dayOfWeek === 6) dateColor = "#007AFF";
    }

    const dayEventsForDisplay = dayEvents.slice(0, 2);

    // 연속된 일정이 있는지 확인
    const hasMultiDayEvent = dayEventsForDisplay.some((schedule: Schedule) => {
      const dateInfo = eventsDateCache.get(schedule.id);
      return dateInfo
        ? dayjs(schedule.startDate).diff(dayjs(schedule.endDate)) !== 0
        : false;
    });

    return (
      <DoubleClick
        dateKey={dayDateString}
        immediateSingle={true}
        singleTapImmediate={() => onSelectDay(dayDate)}
        doubleTap={() => onDoubleTap(dayDate)}
        delay={500}
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
          {isHoliday && holidayName && (
            <Text style={styles.holidayName} numberOfLines={1}>
              {holidayName}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.eventsContainer,
            !hasMultiDayEvent && styles.eventsContainerPadding,
          ]}
        >
          {dayEventsForDisplay.map((schedule: Schedule, idx: number) => {
            const eventInfo = getEventForDay(schedule, dayDate);
            if (!eventInfo.visible) return null;

            // 캐시된 날짜 정보 사용 (Date 객체 생성 최소화)
            const dateInfo = eventsDateCache.get(schedule.id);
            const isMultiDay = dateInfo
              ? dateInfo.startTime !== dateInfo.endTime
              : false;

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
          {dayEvents.length > 2 && (
            <Text style={styles.moreEvents}>+{dayEvents.length - 2}</Text>
          )}
        </View>
      </DoubleClick>
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

  const getEventColor = useCallback(
    (schedule: Schedule): string => {
      let colorName = "gray";

      // 스케줄의 첫 번째 참여자의 색상 사용
      if (schedule.participants.length > 0) {
        const firstParticipantId = schedule.participants[0];
        const firstParticipant = users.find((u) => u.id === firstParticipantId);

        if (firstParticipant && firstParticipant.color) {
          colorName = firstParticipant.color;
        }
      }

      const colorMap: { [key: string]: string } = {
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

      return colorMap[colorName] || colorMap["gray"];
    },
    [users]
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
    schedules.forEach((schedule: Schedule) => {
      const eventStart = new Date(schedule.startDate + "T00:00:00");
      const eventEnd = schedule.endDate
        ? new Date(schedule.endDate + "T00:00:00")
        : eventStart;
      cache.set(schedule.id, {
        startTime: eventStart.getTime(),
        endTime: eventEnd.getTime(),
        startDateStr: schedule.startDate || "",
        endDateStr: schedule.endDate || schedule.startDate || "",
      });
    });
    return cache;
  }, [schedules]);

  // 날짜별 이벤트를 사전 계산하여 캐시 (성능 최적화)
  const eventsByDateCache = useMemo(() => {
    const cache = new Map<string, Schedule[]>();
    schedules.forEach((schedule: Schedule) => {
      const dateInfo = eventsDateCache.get(schedule.id);
      if (!dateInfo) return;

      const eventStart = dateInfo.startTime;
      const eventEnd = dateInfo.endTime;

      // 이벤트가 포함된 모든 날짜에 추가
      let currentDate = eventStart;
      while (currentDate <= eventEnd) {
        const dateStr = dayjs(currentDate).format("YYYY-MM-DD");
        if (!cache.has(dateStr)) {
          cache.set(dateStr, []);
        }
        cache.get(dateStr)!.push(schedule);
        currentDate += 24 * 60 * 60 * 1000; // 다음 날
      }
    });
    return cache;
  }, [schedules, eventsDateCache]);

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

  // onSelectDay를 ref로 저장하여 안정적인 참조 유지
  const onSelectDayRef = useRef(onSelectDay);
  onSelectDayRef.current = onSelectDay;

  const stableOnSelectDay = useCallback((date: Date) => {
    onSelectDayRef.current(date);
  }, []);

  // onDoubleTap을 ref로 저장하여 안정적인 참조 유지
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  const stableOnDoubleTap = useCallback((date: Date) => {
    onDoubleTapRef.current(date);
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
          onSelectDay={stableOnSelectDay}
          onDoubleTap={stableOnDoubleTap}
          getEventColor={stableGetEventColor}
          getEventForDay={stableGetEventForDay}
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
        pastScrollRange={2}
        futureScrollRange={2}
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
  },
  dayNumber: {
    fontSize: 16,
    marginBottom: 2,
    marginHorizontal: 4,
    fontWeight: "500",
  },
  holidayName: {
    fontSize: 8,
    color: "#ef4444",
    fontWeight: "600",
    marginBottom: 2,
  },
  today: {
    backgroundColor: "#000",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: "center",
    fontWeight: "bold",
    color: "#fff",
    overflow: "hidden",
    marginBottom: 0,
  },
  eventsContainer: {
    width: "100%",
    flex: 1,
    overflow: "visible",
  },
  eventsContainerPadding: {
    paddingHorizontal: 1,
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
