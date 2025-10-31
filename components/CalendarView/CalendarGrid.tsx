import { FlashList, FlashListRef } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Event, User } from '../../types';

interface CalendarGridProps {
  currentDate: Date;
  events: Event[];
  users: User[];
  currentUser: User;
  onSelectDay: (date: Date) => void;
  onChangeMonth: (amount: number) => void;
  animationDirection: 'left' | 'right' | null;
  onAnimationEnd: () => void;
}

interface MonthData {
  id: string;
  date: Date;
  year: number;
  month: number;
  weeks: Date[][];
}

const CalendarGrid: React.FC<CalendarGridProps> = ({ 
  currentDate, 
  events, 
  users, 
  currentUser, 
  onSelectDay,
  onChangeMonth,
  animationDirection,
  onAnimationEnd
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlashListRef<MonthData>>(null);
  const isScrollingRef = useRef(false);
  
  // 달력 너비와 높이 계산
  const calendarWidth = screenWidth;
  const calendarHeight = screenHeight - 50; // dayNames 높이 제외

  // 여러 달의 데이터 생성 (이전 2개월 ~ 현재 ~ 다음 2개월)
  const monthsData = useMemo(() => {
    const months: MonthData[] = [];
    
    for (let offset = -2; offset <= 2; offset++) {
      // 날짜를 1일로 정규화하여 JavaScript Date 롤오버 버그 방지
      // 예: 8월 31일에서 +1개월 시 9월에는 31일이 없어 10월 1일로 롤오버되는 문제 방지
      const date = new Date(currentDate);
      date.setDate(1); // 항상 해당 월의 1일로 설정
      date.setMonth(date.getMonth() + offset);
      
      const year = date.getFullYear();
      const month = date.getMonth();
      
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      const startDate = new Date(firstDayOfMonth);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      
      const endDate = new Date(lastDayOfMonth);
      if (endDate.getDay() !== 6) {
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      }
      
      const days: Date[] = [];
      let day = new Date(startDate);
      while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
      }
      
      const weeks: Date[][] = [];
      for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
      }
      
      months.push({
        id: `${year}-${month}`,
        date,
        year,
        month,
        weeks,
      });
    }
    
    return months;
  }, [currentDate]);

  // 현재 달의 인덱스 찾기
  const currentMonthIndex = useMemo(() => {
    return monthsData.findIndex(m => 
      m.year === currentDate.getFullYear() && 
      m.month === currentDate.getMonth()
    );
  }, [monthsData, currentDate]);

  // 스크롤 위치를 현재 달로 설정
  useEffect(() => {
    if (listRef.current && currentMonthIndex !== -1 && !isScrollingRef.current) {
      listRef.current.scrollToIndex({
        index: currentMonthIndex,
        animated: false,
      });
    }
  }, [currentMonthIndex]);

  // 스크롤 이벤트 핸들러
  // const handleScroll = useCallback((event: any) => {
    // const offsetX = event.nativeEvent.contentOffset.x;
    // const currentIndex = Math.round(offsetX / screenWidth);
    
    // if (currentIndex !== currentMonthIndex && currentIndex >= 0 && currentIndex < monthsData.length) {
    //   const targetMonth = monthsData[currentIndex];
    //   const currentMonth = monthsData[currentMonthIndex];
      
    //   if (targetMonth.year !== currentMonth.year || targetMonth.month !== currentMonth.month) {
    //     const diff = targetMonth.date.getTime() - currentMonth.date.getTime();
    //     const monthDiff = Math.round(diff / (1000 * 60 * 60 * 24 * 30));
        
    //     if (monthDiff !== 0) {
    //       onChangeMonth(monthDiff);
    //       onAnimationEnd();
    //     }
    //   }
    // }
  // }, [onChangeMonth]);

  const getEventColor = useCallback((event: Event): string => {
    let colorName = 'gray';
    if (event.participantIds.includes(currentUser.id)) {
      colorName = currentUser.color;
    } else if (event.participantIds.length > 0) {
      const firstParticipant = users.find(u => u.id === event.participantIds[0]);
      if (firstParticipant) {
        colorName = firstParticipant.color;
      }
    }
    
    const colorMap: { [key: string]: string } = {
      blue: '#60a5fa',
      emerald: '#34d399',
      orange: '#fb923c',
      violet: '#a78bfa',
      gray: '#9ca3af',
    };
    return colorMap[colorName] || colorMap['gray'];
  }, [currentUser, users]);

  const getDayEvents = useCallback((day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate + 'T00:00:00');
      const eventEnd = event.endDate ? new Date(event.endDate + 'T00:00:00') : eventStart;
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      return (dayStart >= eventStart && dayStart <= eventEnd) || 
             (dayEnd >= eventStart && dayEnd <= eventEnd) ||
             (dayStart <= eventStart && dayEnd >= eventEnd);
    });
  }, [events]);

  const getEventForDay = useCallback((event: Event, day: Date): { isStart: boolean; isEnd: boolean; visible: boolean } => {
    const eventStart = new Date(event.startDate + 'T00:00:00');
    const eventEnd = event.endDate ? new Date(event.endDate + 'T00:00:00') : eventStart;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    if (dayStart < eventStart) return { isStart: false, isEnd: false, visible: false };
    if (dayStart > eventEnd) return { isStart: false, isEnd: false, visible: false };
    
    const isStart = dayStart.getTime() === eventStart.getTime();
    const isEnd = dayStart.getTime() === eventEnd.getTime();
    
    return { isStart, isEnd, visible: true };
  }, []);

  // DayCell 컴포넌트를 React.memo로 최적화
  const DayCell = React.memo<{
    day: Date;
    monthData: MonthData;
    dayIndex: number;
    weekIndex: number;
    totalWeeks: number;
    onSelectDay: (date: Date) => void;
    getDayEvents: (day: Date) => Event[];
    getEventColor: (event: Event) => string;
    getEventForDay: (event: Event, day: Date) => { isStart: boolean; isEnd: boolean; visible: boolean };
  }>(({ day, monthData, dayIndex, weekIndex, totalWeeks, onSelectDay, getDayEvents, getEventColor, getEventForDay }) => {
    const isCurrentMonth = day.getMonth() === monthData.month;
    const isToday = new Date().toDateString() === day.toDateString();
    const dayOfWeek = day.getDay();
    const dayEvents = getDayEvents(day);

    let dateColor = isCurrentMonth ? '#374151' : '#d1d5db';
    if (isCurrentMonth) {
      if (dayOfWeek === 0) dateColor = '#ef4444';
      if (dayOfWeek === 6) dateColor = '#3b82f6';
    }

    const dayEventsForDisplay = dayEvents.slice(0, 2);

    return (
      <Pressable
        onPress={() => onSelectDay(day)}
        style={[
          styles.dayCell,
          (dayIndex + 1) % 7 !== 0 && styles.dayCellBorderRight,
          weekIndex < totalWeeks - 1 && styles.dayCellBorderBottom
        ]}
      >
        <Text style={[
          styles.dayNumber,
          { color: dateColor },
          isToday && styles.today
        ]}>
          {day.getDate()}
        </Text>
        <View style={styles.eventsContainer}>
          {dayEventsForDisplay.map((event, idx) => {
            const eventInfo = getEventForDay(event, day);
            if (!eventInfo.visible) return null;
            
            return (
              <View
                key={event.id}
                style={[
                  styles.eventBar,
                  { 
                    backgroundColor: getEventColor(event),
                  },
                  !eventInfo.isStart && styles.eventBarContinuation,
                  !eventInfo.isEnd && styles.eventBarNotEnd,
                  idx === 0 && styles.firstEventBar
                ]}
              >
                {eventInfo.isStart && (
                  <Text 
                    style={styles.eventBarText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {event.title}
                  </Text>
                )}
              </View>
            );
          })}
          {dayEvents.length > 2 && (
            <Text style={styles.moreEvents}>+{dayEvents.length - 2}</Text>
          )}
        </View>
      </Pressable>
    );
  }, (prevProps, nextProps) => {
    // 커스텀 비교 함수: day가 변경되지 않았으면 리렌더링 방지
    return prevProps.day.getTime() === nextProps.day.getTime() &&
           prevProps.monthData.month === nextProps.monthData.month &&
           prevProps.monthData.year === nextProps.monthData.year;
  });
  DayCell.displayName = 'DayCell';

  // Week 컴포넌트를 React.memo로 최적화
  const Week = React.memo<{
    week: Date[];
    monthData: MonthData;
    weekIndex: number;
    onSelectDay: (date: Date) => void;
    getDayEvents: (day: Date) => Event[];
    getEventColor: (event: Event) => string;
    getEventForDay: (event: Event, day: Date) => { isStart: boolean; isEnd: boolean; visible: boolean };
  }>(({ week, monthData, weekIndex, onSelectDay, getDayEvents, getEventColor, getEventForDay }) => {
    return (
      <View style={styles.week}>
        {week.map((d, dayIndex) => (
          <DayCell
            key={`${d.getTime()}-${dayIndex}`}
            day={d}
            monthData={monthData}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            totalWeeks={monthData.weeks.length}
            onSelectDay={onSelectDay}
            getDayEvents={getDayEvents}
            getEventColor={getEventColor}
            getEventForDay={getEventForDay}
          />
        ))}
      </View>
    );
  }, (prevProps, nextProps) => {
    // week 배열의 첫 번째와 마지막 날짜가 같으면 리렌더링 방지
    if (prevProps.week.length !== nextProps.week.length) return false;
    if (prevProps.week.length === 0) return true;
    return prevProps.week[0].getTime() === nextProps.week[0].getTime() &&
           prevProps.week[prevProps.week.length - 1].getTime() === nextProps.week[nextProps.week.length - 1].getTime() &&
           prevProps.monthData.month === nextProps.monthData.month &&
           prevProps.monthData.year === nextProps.monthData.year;
  });
  Week.displayName = 'Week';

  // renderMonth를 useCallback으로 안정화
  const renderMonth = useCallback(({ item }: { item: MonthData }) => {
    return (
      <View style={[styles.monthContainer, { width: screenWidth }]}>
        {item.weeks.map((week, weekIndex) => (
          <Week
            key={`${item.id}-week-${weekIndex}`}
            week={week}
            monthData={item}
            weekIndex={weekIndex}
            onSelectDay={onSelectDay}
            getDayEvents={getDayEvents}
            getEventColor={getEventColor}
            getEventForDay={getEventForDay}
          />
        ))}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, onSelectDay, getDayEvents, getEventColor, getEventForDay]); // Week는 컴포넌트이므로 의존성에서 제외

  // keyExtractor를 useMemo로 안정화
  const keyExtractor = useMemo(() => {
    return (item: MonthData) => item.id;
  }, []);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={styles.container}>
      <View style={styles.dayNames}>
        {dayNames.map((d, i) => (
          <Text 
            key={d} 
            style={[
              styles.dayName,
              i === 0 && styles.sunday,
              i === 6 && styles.saturday
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
      <FlashList<MonthData>
        ref={listRef}
        data={monthsData}
        renderItem={renderMonth}
        keyExtractor={keyExtractor}
        horizontal={true}
        // {...({
        //   estimatedItemSize: calendarWidth,
        //   estimatedListSize: {
        //     width: calendarWidth,
        //     height: calendarHeight,
        //   },
        //   drawDistance: 2 * calendarWidth,
        //   disableHorizontalListHeightMeasurement: true,
        //   snapToInterval: calendarWidth,
        // } as any)}
        showsHorizontalScrollIndicator={false}
        getItemType={() => 'month'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dayNames: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    paddingVertical: 8,
  },
  sunday: {
    color: '#ef4444',
  },
  saturday: {
    color: '#3b82f6',
  },
  monthContainer: {
    flex: 1,
  },
  week: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 0,
    minHeight: 110,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  dayCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  dayCellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayNumber: {
    fontSize: 16,
    marginBottom: 4,
    marginHorizontal: 4,
    fontWeight: '500',
  },
  today: {
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    color: '#fff',
    overflow: 'hidden',
  },
  eventsContainer: {
    gap: 2,
    width: '100%',
    flex: 1,
  },
  eventBar: {
    height: 18,
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
    width: '100%',
  },
  eventBarContinuation: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  eventBarNotEnd: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eventBarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    overflow: 'hidden',
  },
  firstEventBar: {
    marginTop: 2,
  },
  moreEvents: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default CalendarGrid;
