import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Schedule, User } from "../../types";
import CalendarGrid from "./CalendarGrid";
import CalendarHeader from "./CalendarHeader";
import DayDetailDrawer from "./DayDetailDrawer";
import MonthYearPicker from "./MonthYearPicker";

interface CalendarViewProps {
  schedules: Schedule[];
  users: any[];
  currentUser?: User; // 로그인한 사용자
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  onStartEdit: (schedule: Schedule) => void;
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
  activeCalendarName: string;
}

const CalendarViewComponent: React.FC<CalendarViewProps> = ({
  schedules,
  users,
  currentUser,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  onStartEdit,
  onOpenSidebar,
  onOpenSearch,
  activeCalendarName,
}) => {
  // 로그인한 사용자 또는 첫 번째 사용자 사용 (메모이제이션)
  const activeUser = useMemo(
    () => currentUser || users[0],
    [currentUser, users]
  );

  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<
    "left" | "right" | null
  >(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const previousSelectedDateRef = React.useRef<Date | null>(null);
  const isInternalDateChangeRef = React.useRef(false); // 내부에서 날짜 변경 여부
  const isInitialMountRef = React.useRef(true); // 초기 마운트 여부
  // 스케줄별 댓글/사진 수 로컬 상태 (Drawer 닫혀도 유지)
  const [localCounts, setLocalCounts] = useState<Record<string, { comment?: number; photo?: number }>>({});

  // 필터링된 사용자 ID (Set으로 저장하여 includes O(1)로 최적화)
  const filteredUserIds = useMemo(() => {
    return new Set(users.map((u: User) => u.id));
  }, [users]);

  // 필터링된 일정 (Set lookup으로 성능 최적화)
  const filteredEvents = useMemo(
    () =>
      schedules.filter((schedule: Schedule) =>
        schedule.participants.some((id: string) => filteredUserIds.has(id))
      ),
    [schedules, filteredUserIds]
  );

  // 싱글탭: 날짜 선택 (포커스)
  const handleSelectDay = useCallback(
    (day: Date) => {
      // drawer가 열려있으면 닫기만 하고 날짜 변경 안함
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return;
      }

      // 선택한 날짜의 월로 currentDate도 업데이트
      const dayMonth = day.getMonth();
      const dayYear = day.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // 내부에서 날짜 변경임을 표시 (useEffect에서 drawer 열지 않도록)
      isInternalDateChangeRef.current = true;
      previousSelectedDateRef.current = day;
      setSelectedDate(day);

      if (dayMonth !== currentMonth || dayYear !== currentYear) {
        const newDate = new Date(day);
        newDate.setDate(1);
        setCurrentDate(newDate);
      }
    },
    [currentDate, setCurrentDate, setSelectedDate, isDrawerOpen]
  );

  // Double tap: 상세 스케줄 열기
  const handleDoubleTap = useCallback(
    (day: Date) => {
      // 선택한 날짜의 월로 currentDate도 업데이트
      const dayMonth = day.getMonth();
      const dayYear = day.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // ref 업데이트를 통해 useEffect가 drawer를 다시 열지 않도록 함
      previousSelectedDateRef.current = day;
      setSelectedDate(day);
      // drawer를 직접 열기
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
    // selectedDate는 유지 (날짜 선택 상태 유지)
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

  const handleAnimationEnd = useCallback(() => {
    setAnimationDirection(null);
  }, []);

  // 외부에서 selectedDate가 변경될 때 drawer 열기 (피드에서 스케줄 선택 시)
  useEffect(() => {
    // 초기 마운트 시에는 drawer 열지 않음
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousSelectedDateRef.current = selectedDate;
      return;
    }

    // 내부에서 변경된 경우 무시
    if (isInternalDateChangeRef.current) {
      isInternalDateChangeRef.current = false;
      previousSelectedDateRef.current = selectedDate;
      return;
    }

    // 외부에서 날짜가 설정되었고, 이전 값과 다르면 drawer 열기
    if (
      selectedDate &&
      previousSelectedDateRef.current?.getTime() !== selectedDate.getTime()
    ) {
      setIsDrawerOpen(true);
    }
    previousSelectedDateRef.current = selectedDate;
  }, [selectedDate]);

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

  const handleTitleClick = useCallback(() => {
    setIsMonthPickerOpen((prev) => !prev);
  }, []);

  const handleMonthYearSelect = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      setIsMonthPickerOpen(false);
    },
    [setCurrentDate]
  );

  const handleMonthYearPickerClose = useCallback(() => {
    setIsMonthPickerOpen(false);
  }, []);

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
          onDateSelect={handleMonthYearSelect}
          onClose={handleMonthYearPickerClose}
        />
      )}
      <CalendarGrid
        currentDate={currentDate}
        schedules={filteredEvents}
        onSelectDay={handleSelectDay}
        onDoubleTap={handleDoubleTap}
        users={users}
        currentUser={activeUser}
        onChangeMonth={handleChangeMonth}
        animationDirection={animationDirection}
        onAnimationEnd={handleAnimationEnd}
        selectedDate={selectedDate}
      />
      {isDrawerOpen && selectedDate && (
        <DayDetailDrawer
          date={selectedDate}
          events={filteredEvents}
          onClose={handleCloseDrawer}
          users={users}
          currentUser={activeUser}
          onStartEdit={onStartEdit}
          localCounts={localCounts}
          setLocalCounts={setLocalCounts}
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

// CalendarView 컴포넌트를 메모이제이션하여 불필요한 리렌더링 방지
const CalendarView = React.memo(
  CalendarViewComponent,
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
    if (prevProps.currentUser?.id !== nextProps.currentUser?.id) {
      return false;
    }

    // 캘린더 이름 비교
    if (prevProps.activeCalendarName !== nextProps.activeCalendarName) {
      return false;
    }

    // 함수는 참조 비교 (부모에서 useCallback으로 안정화되어야 함)
    if (prevProps.setCurrentDate !== nextProps.setCurrentDate) {
      return false;
    }

    if (prevProps.setSelectedDate !== nextProps.setSelectedDate) {
      return false;
    }

    if (prevProps.onStartEdit !== nextProps.onStartEdit) {
      return false;
    }

    if (prevProps.onOpenSidebar !== nextProps.onOpenSidebar) {
      return false;
    }

    if (prevProps.onOpenSearch !== nextProps.onOpenSearch) {
      return false;
    }

    return true;
  }
);

CalendarView.displayName = "CalendarView";

export default CalendarView;
