import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Event, User } from "../../types";
import CalendarGrid from "./CalendarGrid";
import CalendarHeader from "./CalendarHeader";
import DayDetailDrawer from "./DayDetailDrawer";
import MonthYearPicker from "./MonthYearPicker";

interface CalendarViewProps {
  events: Event[];
  users: User[];
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  onStartEdit: (event: Event) => void;
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
  activeCalendarName: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  users,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  onStartEdit,
  onOpenSidebar,
  onOpenSearch,
  activeCalendarName,
}) => {
  const [filteredUserIds, setFilteredUserIds] = useState<string[]>(
    users.map((u) => u.id)
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<
    "left" | "right" | null
  >(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const filteredEvents = events.filter((event) =>
    event.participantIds.some((id) => filteredUserIds.includes(id))
  );

  // Single tap: 날짜 선택 (시각적 피드백만)
  const handleSelectDay = useCallback(
    (day: Date) => {
      // 선택한 날짜의 월로 currentDate도 업데이트
      const dayMonth = day.getMonth();
      const dayYear = day.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      setSelectedDate(day);
      setIsDrawerOpen(false);

      if (dayMonth !== currentMonth || dayYear !== currentYear) {
        const newDate = new Date(day);
        newDate.setDate(1);
        setCurrentDate(newDate);
      }
    },
    [currentDate, setCurrentDate, setSelectedDate]
  );

  // Double tap: 상세 스케줄 열기
  const handleDoubleTap = useCallback(
    (day: Date) => {
      // 선택한 날짜의 월로 currentDate도 업데이트
      const dayMonth = day.getMonth();
      const dayYear = day.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      setSelectedDate(day);
      setIsDrawerOpen(true);

      if (dayMonth !== currentMonth || dayYear !== currentYear) {
        const newDate = new Date(day);
        newDate.setDate(1);
        setCurrentDate(newDate);
      }
    },
    [currentDate, setCurrentDate, setSelectedDate]
  );

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleChangeMonth = useCallback(
    (amount: number) => {
      setAnimationDirection(amount > 0 ? "right" : "left");
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + amount);
      setCurrentDate(newDate);
    },
    [currentDate, setCurrentDate]
  );

  // currentDate가 변경될 때 selectedDate와 동기화
  useEffect(() => {
    if (selectedDate) {
      const selectedMonth = selectedDate.getMonth();
      const selectedYear = selectedDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // selectedDate가 currentDate와 다른 달이면 초기화
      // 단, 드로어가 열려있으면 닫지 않음 (double tap 후 currentDate 변경 방지)
      if (selectedMonth !== currentMonth || selectedYear !== currentYear) {
        if (!isDrawerOpen) {
          setSelectedDate(null);
        }
        // 드로어가 열려있으면 날짜는 유지하되 드로어는 닫지 않음
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const handleTitleClick = () => {
    setIsMonthPickerOpen((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <CalendarHeader
        currentDate={currentDate}
        onOpenSidebar={onOpenSidebar}
        onOpenSearch={onOpenSearch}
        activeCalendarName={activeCalendarName}
        onTitleClick={handleTitleClick}
        isPickerOpen={isMonthPickerOpen}
      />
      {isMonthPickerOpen && (
        <MonthYearPicker
          currentDate={currentDate}
          onDateSelect={(date) => {
            setCurrentDate(date);
            setIsMonthPickerOpen(false);
          }}
          onClose={() => setIsMonthPickerOpen(false)}
        />
      )}
      <CalendarGrid
        currentDate={currentDate}
        events={filteredEvents}
        onSelectDay={handleSelectDay}
        onDoubleTap={handleDoubleTap}
        users={users}
        currentUser={users.find((u) => u.id === "user1")!}
        onChangeMonth={handleChangeMonth}
        animationDirection={animationDirection}
        onAnimationEnd={() => setAnimationDirection(null)}
        selectedDate={selectedDate}
      />
      {selectedDate && isDrawerOpen && (
        <DayDetailDrawer
          date={selectedDate}
          events={filteredEvents}
          onClose={handleCloseDrawer}
          users={users}
          currentUser={users.find((u) => u.id === "user1")!}
          onStartEdit={onStartEdit}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
  },
});

export default CalendarView;
