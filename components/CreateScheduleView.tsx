import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import * as Location from "expo-location";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { RepeatOption, Schedule, User, ChecklistItem } from "../types";
import DateTimePicker from "./DateTimePicker";
import ScheduleConflictService, { ConflictInfo } from "../services/scheduleConflictService";
import { useSearchPlaces } from "../services/queries";
import { PlaceItem } from "../services/api";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const RADIUS_OPTIONS = [
  { label: "100m", value: 100 },
  { label: "300m", value: 300 },
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
];

// 음력을 양력으로 변환
const lunarToSolar = (year: number, month: number, day: number): { year: number; month: number; day: number } | null => {
  try {
    const calendar = new KoreanLunarCalendar();
    calendar.setLunarDate(year, month, day, false);
    const solarDate = calendar.getSolarCalendar();
    return { year: solarDate.year, month: solarDate.month, day: solarDate.day };
  } catch {
    return null;
  }
};


interface CreateScheduleViewProps {
  onSave: (
    scheduleData: Omit<Schedule, "id" | "workspace">,
    scheduleId?: string
  ) => void;
  users: User[];
  currentUser: User;
  setActiveView: (view: string) => void;
  scheduleToEdit: Schedule | null;
  initialDate?: Date | null;
  existingSchedules?: Schedule[]; // 충돌 감지를 위한 기존 일정
}

const CreateScheduleView: React.FC<CreateScheduleViewProps> = ({
  onSave,
  users,
  currentUser,
  setActiveView,
  scheduleToEdit,
  initialDate,
  existingSchedules = [],
}) => {
  const insets = useSafeAreaInsets();

  const getInitialDate = () => {
    if (initialDate) {
      return dayjs(initialDate).format("YYYY-MM-DD");
    }
    return dayjs().format("YYYY-MM-DD");
  };

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(getInitialDate());
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [displayDate, setDisplayDate] = useState(initialDate || new Date());
  const [activeField, setActiveField] = useState<"start" | "end" | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<
    "start" | "end" | null
  >(null);
  const [isLunar, setIsLunar] = useState(false);

  const [participantIds, setParticipantIds] = useState<string[]>([
    currentUser.id,
  ]);
  const [repeat, setRepeat] = useState<RepeatOption>("none");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [isImportant, setIsImportant] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  // 장소 검색 및 위치 알림 관련 상태
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [showLocationSearchResults, setShowLocationSearchResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    placeName?: string;
  } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState(300);
  const [enableArrivalNotification, setEnableArrivalNotification] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // 체크리스트 관련 상태
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; content: string }>>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // 장소 검색 mutation
  const searchPlacesMutation = useSearchPlaces();

  // 충돌 감지 - 일정 정보가 변경될 때마다 체크
  useEffect(() => {
    if (existingSchedules.length === 0) {
      setConflictInfo(null);
      return;
    }

    const scheduleData: Partial<Schedule> = {
      startDate,
      endDate: endDate || startDate,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      isAllDay,
      participants: participantIds,
    };

    const conflict = ScheduleConflictService.checkConflict(
      scheduleData,
      existingSchedules,
      scheduleToEdit?.id // 수정 시 자기 자신 제외
    );

    setConflictInfo(conflict.hasConflict ? conflict : null);
  }, [startDate, endDate, startTime, endTime, isAllDay, participantIds, existingSchedules, scheduleToEdit?.id]);

  // 키보드 상태 감지
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // 디바운스된 장소 검색
  useEffect(() => {
    if (locationSearchQuery.length < 2) {
      setShowLocationSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      searchPlacesMutation.mutate({ query: locationSearchQuery, display: 5 });
      setShowLocationSearchResults(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [locationSearchQuery]);

  // BottomSheet refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const calendarSheetRef = useRef<BottomSheet>(null);
  const timeSheetRef = useRef<BottomSheet>(null);
  const reminderSheetRef = useRef<BottomSheet>(null);
  const customReminderSheetRef = useRef<BottomSheet>(null);
  const repeatSheetRef = useRef<BottomSheet>(null);
  const locationSheetRef = useRef<BottomSheet>(null);
  const checklistSheetRef = useRef<BottomSheet>(null);
  const memoInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // 임의 알림 설정 state
  const [customReminderValue, setCustomReminderValue] = useState(30);
  const [customReminderUnit, setCustomReminderUnit] = useState<"minutes" | "hours">("minutes");

  // BottomSheet snap points
  const snapPoints = useMemo(() => ["50%"], []);
  const calendarSnapPoints = useMemo(() => ["55%"], []);
  const timeSnapPoints = useMemo(() => ["40%"], []);
  const reminderSnapPoints = useMemo(() => ["45%"], []);
  const customReminderSnapPoints = useMemo(() => ["45%"], []);
  const repeatSnapPoints = useMemo(() => ["40%"], []);
  const locationSnapPoints = useMemo(() => ["75%"], []);
  const checklistSnapPoints = useMemo(() => ["60%"], []);

  // BottomSheet backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  useEffect(() => {
    if (scheduleToEdit) {
      setTitle(scheduleToEdit.title);
      setStartDate(scheduleToEdit.startDate || dayjs().format("YYYY-MM-DD"));
      setEndDate(scheduleToEdit.endDate);
      setParticipantIds(scheduleToEdit.participants);
      setRepeat((scheduleToEdit.repeatType as RepeatOption) || "none");
      setMemo(scheduleToEdit.memo || "");
      setStartTime(scheduleToEdit.startTime || dayjs().format("HH:mm"));
      setEndTime(
        scheduleToEdit.endTime || dayjs().add(1, "hour").format("HH:mm")
      );
      setIsAllDay(scheduleToEdit.isAllDay ?? !scheduleToEdit.startTime);
      setIsLunar(scheduleToEdit.calendarType === "lunar");
      setReminderMinutes(scheduleToEdit.reminderMinutes ?? null);
      setIsImportant(scheduleToEdit.isImportant ?? false);

      // 위치 알림 데이터 불러오기
      if (scheduleToEdit.locationReminder) {
        setSelectedLocation({
          latitude: scheduleToEdit.locationReminder.latitude,
          longitude: scheduleToEdit.locationReminder.longitude,
          address: scheduleToEdit.locationReminder.address,
          placeName: scheduleToEdit.locationReminder.placeName,
        });
        setSelectedRadius(scheduleToEdit.locationReminder.radius || 300);
        setEnableArrivalNotification(scheduleToEdit.locationReminder.isEnabled);
      }

      // 체크리스트 데이터 불러오기
      if (scheduleToEdit.checklist && scheduleToEdit.checklist.length > 0) {
        setChecklistItems(
          scheduleToEdit.checklist.map((item) => ({
            id: item.id,
            content: item.content,
          }))
        );
      }
    } else {
      setTitle("");
      const initialDateStr = initialDate
        ? dayjs(initialDate).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD");
      setStartDate(initialDateStr);
      setEndDate(undefined);
      setParticipantIds([currentUser.id]);
      setRepeat("none");
      setMemo("");
      setStartTime(dayjs().format("HH:mm"));
      setEndTime(dayjs().add(1, "hour").format("HH:mm"));
      setReminderMinutes(null);
      setIsImportant(false);
      setIsAllDay(false);
      setIsLunar(false);
      setSelectedLocation(null);
      setSelectedRadius(300);
      setEnableArrivalNotification(false);
      setChecklistItems([]);
      setNewChecklistItem("");
    }
  }, [scheduleToEdit, currentUser.id, initialDate]);

  const handleSubmit = async () => {
    // 충돌이 있으면 경고 표시
    if (conflictInfo && conflictInfo.hasConflict) {
      Alert.alert(
        "일정 충돌 알림",
        `${conflictInfo.message}\n\n그래도 일정을 저장하시겠습니까?`,
        [
          {
            text: "취소",
            style: "cancel",
          },
          {
            text: "저장",
            onPress: () => saveSchedule(),
          },
        ]
      );
      return;
    }

    await saveSchedule();
  };

  const saveSchedule = async () => {
    setIsSaving(true);
    try {
      const scheduleData: Omit<Schedule, "id" | "workspace"> = {
        title,
        memo: memo || undefined,
        startDate,
        endDate: endDate || startDate,
        participants: participantIds,
        repeatType: repeat,
        calendarType: isLunar ? "lunar" : "solar",
        isAllDay,
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
        reminderMinutes: reminderMinutes ?? undefined,
        isImportant,
        // 위치 알림 데이터
        locationReminder: selectedLocation && enableArrivalNotification
          ? {
              id: scheduleToEdit?.locationReminder?.id || "",
              scheduleId: scheduleToEdit?.id || "",
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
              radius: selectedRadius,
              address: selectedLocation.address,
              placeName: selectedLocation.placeName,
              isEnabled: true,
            }
          : undefined,
        // 체크리스트 데이터
        checklist: checklistItems.length > 0
          ? checklistItems.map((item) => ({
              id: item.id,
              content: item.content,
              isCompleted: false,
              createdBy: currentUser.id,
              createdAt: new Date().toISOString(),
            }))
          : undefined,
      };
      await onSave(scheduleData, scheduleToEdit?.id);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateDisplay = (date: string) => {
    if (!date) return "";
    const d = dayjs(date);
    const year = d.year();
    const month = d.month() + 1;
    const day = d.date();

    if (isLunar) {
      // 음력 날짜를 양력으로 변환하여 함께 표시
      const solar = lunarToSolar(year, month, day);
      if (solar) {
        const solarDate = new Date(solar.year, solar.month - 1, solar.day);
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const dayName = days[solarDate.getDay()];
        return `음력 ${month}월 ${day}일 (양력 ${solar.month}/${solar.day} ${dayName})`;
      }
      return `음력 ${month}월 ${day}일`;
    } else {
      // 양력 날짜 표시
      const dateObj = new Date(date + "T00:00:00");
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const dayName = days[dateObj.getDay()];
      return `${month}월 ${day}일 (${dayName})`;
    }
  };

  const handleDayPress = (dateString: string) => {
    const dStr = dayjs(dateString).format("YYYY-MM-DD");
    if (activeField === "start") {
      setStartDate(dStr);
      // 시작일이 종료일보다 뒤면 종료일도 같이 변경
      if (endDate && dStr > endDate) {
        setEndDate(dStr);
      }
    } else {
      setEndDate(dStr);
    }
  };

  const selectedDateForCalendar = useMemo(() => {
    if (activeField === "start") return startDate;
    if (activeField === "end") return endDate || startDate;
    return startDate;
  }, [activeField, startDate, endDate]);

  const openDatePicker = (field: "start" | "end") => {
    setActiveField(field);
    setDisplayDate(new Date((field === "start" ? startDate : (endDate || startDate)) + "T00:00:00"));
    calendarSheetRef.current?.expand();
  };

  const openTimePicker = (field: "start" | "end") => {
    setActiveTimeField(field);
    timeSheetRef.current?.expand();
  };

  // 캘린더 피커
  const CalendarPicker = useCallback(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const totalCells = firstDayOfWeek + daysInMonth;
    const numberOfWeeks = Math.ceil(totalCells / 7);

    const days: Array<{ date: Date; dateString: string; isCurrentMonth: boolean }> = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: true,
      });
    }

    const remainingCells = numberOfWeeks * 7 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        dateString: dayjs(date).format("YYYY-MM-DD"),
        isCurrentMonth: false,
      });
    }

    const weeks: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const todayString = dayjs().format("YYYY-MM-DD");

    return (
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <TouchableOpacity
            onPress={() => setDisplayDate(new Date(year, month - 1, 1))}
            style={pickerStyles.arrowButton}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={pickerStyles.monthText}>
            {year}년 {month + 1}월
          </Text>
          <TouchableOpacity
            onPress={() => setDisplayDate(new Date(year, month + 1, 1))}
            style={pickerStyles.arrowButton}
          >
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={pickerStyles.dayNamesRow}>
          {DAY_NAMES.map((dayName, index) => (
            <Text
              key={dayName}
              style={[
                pickerStyles.dayName,
                index === 0 && pickerStyles.sundayText,
                index === 6 && pickerStyles.saturdayText,
              ]}
            >
              {dayName}
            </Text>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={pickerStyles.weekRow}>
            {week.map((dayData) => {
              const isSelected = dayData.dateString === selectedDateForCalendar;
              const isToday = dayData.dateString === todayString;
              const dayOfWeek = dayData.date.getDay();

              let textColor = dayData.isCurrentMonth ? "#374151" : "#d1d5db";
              if (dayData.isCurrentMonth) {
                if (dayOfWeek === 0) textColor = "#EF4444";
                if (dayOfWeek === 6) textColor = "#3B82F6";
              }

              return (
                <Pressable
                  key={dayData.dateString}
                  style={[
                    pickerStyles.dayCell,
                    isSelected && pickerStyles.selectedDay,
                  ]}
                  onPress={() => handleDayPress(dayData.dateString)}
                >
                  <Text
                    style={[
                      pickerStyles.dayText,
                      { color: isSelected ? "#FFFFFF" : textColor },
                      isToday && !isSelected && pickerStyles.todayText,
                    ]}
                  >
                    {dayData.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [displayDate, selectedDateForCalendar, activeField]);

  // 장소 선택 핸들러
  const handleSelectPlace = (place: PlaceItem) => {
    setSelectedLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.roadAddress || place.address,
      placeName: place.title,
    });
    setLocationSearchQuery("");
    setShowLocationSearchResults(false);
  };

  // 현재 위치 가져오기
  const handleGetCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "위치 접근 권한이 필요합니다.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // 역지오코딩으로 주소 가져오기
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = address
        ? `${address.city || ""} ${address.district || ""} ${address.street || ""}`.trim()
        : undefined;

      setSelectedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressString,
        placeName: "현재 위치",
      });
      setLocationSearchQuery("");
      setShowLocationSearchResults(false);
    } catch (error) {
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // 체크리스트 항목 추가
  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([
        ...checklistItems,
        {
          id: `temp-${Date.now()}`,
          content: newChecklistItem.trim(),
        },
      ]);
      setNewChecklistItem("");
    }
  };

  // 체크리스트 항목 삭제
  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  // 장소 검색 결과 렌더링
  const renderPlaceSearchResult = ({ item }: { item: PlaceItem }) => (
    <Pressable
      style={styles.searchResultItem}
      onPress={() => handleSelectPlace(item)}
    >
      <View style={styles.searchResultIcon}>
        <Ionicons name="location" size={16} color="#3B82F6" />
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.searchResultAddress} numberOfLines={1}>
          {item.roadAddress || item.address}
        </Text>
      </View>
    </Pressable>
  );

  const repeatOptions: { key: RepeatOption; label: string; icon: string }[] = [
    { key: "none", label: "없음", icon: "close-circle-outline" },
    { key: "daily", label: "매일", icon: "today-outline" },
    { key: "weekly", label: "매주", icon: "calendar-outline" },
    { key: "monthly", label: "매월", icon: "calendar-number-outline" },
    { key: "yearly", label: "매년", icon: "gift-outline" },
  ];


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        {/* 헤더 - 미니멀 */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setActiveView("calendar")}
            disabled={isSaving}
          >
            <Ionicons name="close" size={28} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!title.trim() || isSaving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {/* 제목 입력 - 크고 심플하게 */}
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="일정 제목"
            placeholderTextColor="#D1D5DB"
            autoFocus={!scheduleToEdit}
            maxLength={50}
          />

          {/* 충돌 경고 배너 */}
          {conflictInfo && conflictInfo.hasConflict && (
            <View style={styles.conflictBanner}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <View style={styles.conflictTextContainer}>
                <Text style={styles.conflictTitle}>일정이 겹칩니다</Text>
                <Text style={styles.conflictMessage}>{conflictInfo.message}</Text>
                {conflictInfo.conflictingSchedules.slice(0, 2).map((schedule) => (
                  <Text key={schedule.id} style={styles.conflictSchedule}>
                    • {schedule.title} ({schedule.startTime || "종일"})
                  </Text>
                ))}
                {conflictInfo.conflictingSchedules.length > 2 && (
                  <Text style={styles.conflictMore}>
                    +{conflictInfo.conflictingSchedules.length - 2}개 더
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* 날짜/시간 카드 */}
          <Pressable
            style={styles.dateTimeCard}
            onPress={() => isKeyboardVisible && Keyboard.dismiss()}
          >
            {/* 시작 */}
            <Pressable
              style={styles.dateTimeRow}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                } else {
                  openDatePicker("start");
                }
              }}
            >
              <View style={[styles.dateTimeDot, { backgroundColor: "#10B981" }]} />
              <View style={styles.dateTimeContent}>
                <Text style={styles.dateTimeLabel}>시작</Text>
                <Text style={styles.dateTimeValue}>{formatDateDisplay(startDate)}</Text>
              </View>
              {!isAllDay && (
                <Pressable
                  style={styles.timeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (isKeyboardVisible) {
                      Keyboard.dismiss();
                    } else {
                      openTimePicker("start");
                    }
                  }}
                >
                  <Text style={styles.timeButtonText}>{startTime}</Text>
                </Pressable>
              )}
            </Pressable>

            <View style={styles.dateTimeDivider} />

            {/* 종료 */}
            <Pressable
              style={styles.dateTimeRow}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                } else {
                  openDatePicker("end");
                }
              }}
            >
              <View style={[styles.dateTimeDot, { backgroundColor: "#EF4444" }]} />
              <View style={styles.dateTimeContent}>
                <Text style={styles.dateTimeLabel}>종료</Text>
                <Text style={styles.dateTimeValue}>{formatDateDisplay(endDate || startDate)}</Text>
              </View>
              {!isAllDay && (
                <Pressable
                  style={styles.timeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (isKeyboardVisible) {
                      Keyboard.dismiss();
                    } else {
                      openTimePicker("end");
                    }
                  }}
                >
                  <Text style={styles.timeButtonText}>{endTime}</Text>
                </Pressable>
              )}
            </Pressable>

            <View style={styles.dateTimeDivider} />

            {/* 옵션 토글 */}
            <View style={styles.togglesRow}>
              <Pressable
                style={[styles.toggleChip, isAllDay && styles.toggleChipActive]}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                  } else {
                    setIsAllDay(!isAllDay);
                  }
                }}
              >
                <Ionicons
                  name={isAllDay ? "sunny" : "sunny-outline"}
                  size={16}
                  color={isAllDay ? "#FFFFFF" : "#6B7280"}
                />
                <Text style={[styles.toggleChipText, isAllDay && styles.toggleChipTextActive]}>
                  종일
                </Text>
              </Pressable>

              <Pressable
                style={[styles.toggleChip, isLunar && styles.toggleChipActive]}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                  } else {
                    // 음력 토글: 날짜는 그대로 두고 타입만 변경
                    // 선택한 날짜가 음력인지 양력인지만 표시
                    setIsLunar(!isLunar);
                  }
                }}
              >
                <Ionicons
                  name={isLunar ? "moon" : "moon-outline"}
                  size={16}
                  color={isLunar ? "#FFFFFF" : "#6B7280"}
                />
                <Text style={[styles.toggleChipText, isLunar && styles.toggleChipTextActive]}>
                  음력
                </Text>
              </Pressable>

              <Pressable
                style={[styles.toggleChip, isImportant && styles.toggleChipImportant]}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                  } else {
                    setIsImportant(!isImportant);
                  }
                }}
              >
                <Ionicons
                  name={isImportant ? "star" : "star-outline"}
                  size={16}
                  color={isImportant ? "#FFFFFF" : "#6B7280"}
                />
                <Text style={[styles.toggleChipText, isImportant && styles.toggleChipTextActive]}>
                  중요
                </Text>
              </Pressable>
            </View>
          </Pressable>

          {/* 기본 설정 그룹 */}
          <View style={styles.settingsGroup}>
            {/* 반복 */}
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                } else {
                  repeatSheetRef.current?.expand();
                }
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="repeat" size={20} color="#007AFF" />
                <Text style={styles.settingTitle}>반복</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {repeatOptions.find(o => o.key === repeat)?.label || "없음"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </View>
            </Pressable>

            <View style={styles.settingDivider} />

            {/* 알림 */}
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                } else {
                  reminderSheetRef.current?.expand();
                }
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={20} color="#007AFF" />
                <Text style={styles.settingTitle}>알림</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {reminderMinutes === null
                    ? "없음"
                    : reminderMinutes === 0
                    ? "일정 시작 시"
                    : reminderMinutes >= 60
                    ? `${reminderMinutes / 60}시간 전`
                    : `${reminderMinutes}분 전`}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </View>
            </Pressable>

            <View style={styles.settingDivider} />

            {/* 참가자 */}
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                } else {
                  bottomSheetRef.current?.expand();
                }
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="people" size={20} color="#007AFF" />
                <Text style={styles.settingTitle}>참가자</Text>
              </View>
              <View style={styles.settingRight}>
                <View style={styles.participantAvatarsSmall}>
                  {participantIds.slice(0, 3).map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    if (!user) return null;
                    return (
                      <Image
                        key={user.id}
                        source={{ uri: user.avatarUrl }}
                        style={styles.participantAvatarSmall}
                      />
                    );
                  })}
                  {participantIds.length > 3 && (
                    <View style={styles.participantMoreSmall}>
                      <Text style={styles.participantMoreSmallText}>
                        +{participantIds.length - 3}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </View>
            </Pressable>
          </View>

          {/* 추가 옵션 라벨 */}
          <Text style={styles.sectionLabel}>추가 옵션</Text>

          {/* 약속 장소 - 미리보기 */}
          {selectedLocation ? (
            <View style={styles.previewSection}>
              <View style={styles.previewContent}>
                <Ionicons name="location" size={18} color="#22C55E" />
                <View style={styles.previewTextContainer}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {selectedLocation.placeName || selectedLocation.address}
                  </Text>
                  {enableArrivalNotification && (
                    <Text style={styles.previewSubtitle}>도착 알림 ON</Text>
                  )}
                </View>
              </View>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => locationSheetRef.current?.expand()}
                  style={styles.previewEditButton}
                >
                  <Text style={styles.previewEditText}>수정</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedLocation(null);
                    setEnableArrivalNotification(false);
                  }}
                  style={styles.previewRemoveButton}
                >
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.addOptionButton}
              onPress={() => locationSheetRef.current?.expand()}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.addOptionText}>약속 장소 추가</Text>
            </Pressable>
          )}

          {/* 체크리스트 - 미리보기 */}
          {checklistItems.length > 0 ? (
            <View style={styles.previewSection}>
              <Pressable
                style={styles.previewContent}
                onPress={() => checklistSheetRef.current?.expand()}
              >
                <Ionicons name="checkbox" size={18} color="#007AFF" />
                <View style={styles.previewTextContainer}>
                  <Text style={styles.previewTitle}>
                    체크리스트 {checklistItems.length}개
                  </Text>
                  <Text style={styles.previewSubtitle} numberOfLines={1}>
                    {checklistItems.map(item => item.content).join(", ")}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => checklistSheetRef.current?.expand()}
                  style={styles.previewEditButton}
                >
                  <Text style={styles.previewEditText}>수정</Text>
                </Pressable>
                <Pressable
                  onPress={() => setChecklistItems([])}
                  style={styles.previewRemoveButton}
                >
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.addOptionButton}
              onPress={() => checklistSheetRef.current?.expand()}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.addOptionText}>체크리스트 추가</Text>
            </Pressable>
          )}

          {/* 메모 */}
          <View style={styles.memoSection}>
            <View style={styles.memoHeader}>
              <Ionicons name="document-text-outline" size={18} color="#9CA3AF" />
              <Text style={styles.memoLabel}>메모</Text>
            </View>
            <TextInput
              ref={memoInputRef}
              style={styles.memoInput}
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력하세요..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
            />
          </View>
        </ScrollView>

        {/* 반복 설정 BottomSheet */}
        <BottomSheet
          ref={repeatSheetRef}
          index={-1}
          snapPoints={repeatSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>반복</Text>
            <View style={styles.repeatSheetList}>
              {repeatOptions.map((option) => (
                <Pressable
                  key={option.key}
                  style={styles.repeatSheetItem}
                  onPress={() => {
                    setRepeat(option.key);
                    repeatSheetRef.current?.close();
                  }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={22}
                    color={repeat === option.key ? "#007AFF" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.repeatSheetItemText,
                      repeat === option.key && styles.repeatSheetItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {repeat === option.key && (
                    <Ionicons name="checkmark" size={22} color="#007AFF" />
                  )}
                </Pressable>
              ))}
            </View>
          </BottomSheetView>
        </BottomSheet>

        {/* 참가자 선택 BottomSheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>참가자 선택</Text>
            <ScrollView style={styles.bottomSheetList}>
              {/* 나 */}
              <Pressable
                style={styles.participantItem}
                onPress={() => {
                  if (participantIds.includes(currentUser.id)) {
                    setParticipantIds(participantIds.filter((id) => id !== currentUser.id));
                  } else {
                    setParticipantIds([...participantIds, currentUser.id]);
                  }
                }}
              >
                <Image
                  source={{ uri: currentUser.avatarUrl }}
                  style={styles.participantItemAvatar}
                />
                <Text style={styles.participantItemName}>나</Text>
                <View
                  style={[
                    styles.checkbox,
                    participantIds.includes(currentUser.id) && styles.checkboxActive,
                  ]}
                >
                  {participantIds.includes(currentUser.id) && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
              </Pressable>

              {/* 다른 사용자들 */}
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((user) => (
                  <Pressable
                    key={user.id}
                    style={styles.participantItem}
                    onPress={() => {
                      if (participantIds.includes(user.id)) {
                        setParticipantIds(participantIds.filter((id) => id !== user.id));
                      } else {
                        setParticipantIds([...participantIds, user.id]);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={styles.participantItemAvatar}
                    />
                    <Text style={styles.participantItemName}>{user.name}</Text>
                    <View
                      style={[
                        styles.checkbox,
                        participantIds.includes(user.id) && styles.checkboxActive,
                      ]}
                    >
                      {participantIds.includes(user.id) && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                ))}
            </ScrollView>
          </BottomSheetView>
        </BottomSheet>

        {/* 캘린더 BottomSheet */}
        <BottomSheet
          ref={calendarSheetRef}
          index={-1}
          snapPoints={calendarSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>
              {activeField === "start" ? "시작 날짜" : "종료 날짜"}
            </Text>
            <CalendarPicker />
          </BottomSheetView>
        </BottomSheet>

        {/* 시간 선택 BottomSheet */}
        <BottomSheet
          ref={timeSheetRef}
          index={-1}
          snapPoints={timeSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>
              {activeTimeField === "start" ? "시작 시간" : "종료 시간"}
            </Text>
            <View style={styles.timePickerContainer}>
              <DateTimePicker
                value={activeTimeField === "start" ? startTime : endTime}
                onChange={(timeStr) => {
                  if (activeTimeField === "start") {
                    setStartTime(timeStr as string);
                  } else {
                    setEndTime(timeStr as string);
                  }
                }}
                mode="time"
                display="spinner"
                is24Hour={true}
                locale="en_GB"
              />
            </View>
          </BottomSheetView>
        </BottomSheet>

        {/* 알림 설정 BottomSheet */}
        <BottomSheet
          ref={reminderSheetRef}
          index={-1}
          snapPoints={reminderSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>알림</Text>

            <View style={styles.reminderPresetList}>
              {[
                { key: null, label: "없음" },
                { key: 0, label: "시작" },
                { key: 10, label: "10분 전" },
                { key: 60, label: "1시간 전" },
              ].map((option) => (
                <Pressable
                  key={option.key ?? "none"}
                  style={styles.reminderPresetItem}
                  onPress={() => {
                    setReminderMinutes(option.key);
                    reminderSheetRef.current?.close();
                  }}
                >
                  <Text style={styles.reminderPresetText}>{option.label}</Text>
                  {reminderMinutes === option.key && (
                    <Ionicons name="checkmark" size={22} color="#007AFF" />
                  )}
                </Pressable>
              ))}

              {/* 임의... */}
              <Pressable
                style={styles.reminderPresetItem}
                onPress={() => {
                  reminderSheetRef.current?.close();
                  setTimeout(() => {
                    customReminderSheetRef.current?.expand();
                  }, 300);
                }}
              >
                <Text style={styles.reminderPresetText}>임의...</Text>
                {reminderMinutes !== null &&
                  reminderMinutes !== 0 &&
                  reminderMinutes !== 10 &&
                  reminderMinutes !== 60 && (
                    <Text style={styles.reminderPresetValue}>
                      {reminderMinutes >= 60
                        ? `${reminderMinutes / 60}시간 전`
                        : `${reminderMinutes}분 전`}
                    </Text>
                  )}
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </Pressable>
            </View>
          </BottomSheetView>
        </BottomSheet>

        {/* 임의 알림 설정 BottomSheet */}
        <BottomSheet
          ref={customReminderSheetRef}
          index={-1}
          snapPoints={customReminderSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>알림 시간 설정</Text>

            <View style={styles.reminderPickerRow}>
              <Picker
                selectedValue={customReminderValue}
                onValueChange={(value) => setCustomReminderValue(value)}
                style={[styles.reminderPicker, { marginLeft: 20 }]}
                itemStyle={styles.reminderPickerItem}
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => (
                  <Picker.Item key={num} label={`${num}`} value={num} />
                ))}
              </Picker>

              <Picker
                selectedValue={customReminderUnit}
                onValueChange={(value) => setCustomReminderUnit(value)}
                style={[styles.reminderPicker, { marginRight: 20 }]}
                itemStyle={styles.reminderPickerItem}
              >
                <Picker.Item label="분 전" value="minutes" />
                <Picker.Item label="시간 전" value="hours" />
              </Picker>
            </View>

            <TouchableOpacity
              style={styles.customReminderConfirmButton}
              onPress={() => {
                const minutes = customReminderUnit === "hours"
                  ? customReminderValue * 60
                  : customReminderValue;
                setReminderMinutes(minutes);
                customReminderSheetRef.current?.close();
              }}
            >
              <Text style={styles.customReminderConfirmText}>확인</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>

        {/* 장소 설정 BottomSheet */}
        <BottomSheet
          ref={locationSheetRef}
          index={-1}
          snapPoints={locationSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>약속 장소</Text>

            {/* 장소 검색 입력 */}
            <View style={styles.locationSearchContainer}>
              <View style={styles.locationSearchInputWrapper}>
                <Ionicons name="search" size={16} color="#9CA3AF" style={styles.locationSearchIcon} />
                <TextInput
                  style={styles.locationSearchInput}
                  value={locationSearchQuery}
                  onChangeText={setLocationSearchQuery}
                  placeholder="장소 검색 (예: 강남역, 스타벅스)"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                />
                {locationSearchQuery.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setLocationSearchQuery("");
                      setShowLocationSearchResults(false);
                    }}
                    style={styles.locationClearButton}
                  >
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* 검색 결과 */}
            {showLocationSearchResults && (
              <View style={styles.locationSearchResults}>
                {searchPlacesMutation.isPending ? (
                  <View style={styles.locationSearchLoading}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                    <Text style={styles.locationSearchLoadingText}>검색 중...</Text>
                  </View>
                ) : searchPlacesMutation.data?.items?.length ? (
                  <FlatList
                    data={searchPlacesMutation.data.items}
                    renderItem={renderPlaceSearchResult}
                    keyExtractor={(item, index) => `${item.title}-${index}`}
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 180 }}
                  />
                ) : (
                  <View style={styles.locationNoResults}>
                    <Text style={styles.locationNoResultsText}>검색 결과가 없습니다</Text>
                  </View>
                )}
              </View>
            )}

            {/* 현재 위치 버튼 */}
            <Pressable
              style={styles.currentLocationButton}
              onPress={handleGetCurrentLocation}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <>
                  <Ionicons name="navigate" size={16} color="#3B82F6" />
                  <Text style={styles.currentLocationButtonText}>현재 위치 사용</Text>
                </>
              )}
            </Pressable>

            {/* 선택된 장소 */}
            {selectedLocation && (
              <View style={styles.selectedLocationContainer}>
                <View style={styles.selectedLocationInfo}>
                  <Ionicons name="pin" size={16} color="#22C55E" />
                  <View style={styles.selectedLocationText}>
                    {selectedLocation.placeName && (
                      <Text style={styles.selectedLocationName}>{selectedLocation.placeName}</Text>
                    )}
                    <Text style={styles.selectedLocationAddress} numberOfLines={1}>
                      {selectedLocation.address || `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedLocation(null)}
                    style={styles.removeLocationButton}
                  >
                    <Ionicons name="close" size={16} color="#9CA3AF" />
                  </Pressable>
                </View>

                {/* 도착 알림 토글 */}
                <Pressable
                  style={[
                    styles.arrivalNotificationToggle,
                    enableArrivalNotification && styles.arrivalNotificationToggleActive,
                  ]}
                  onPress={() => setEnableArrivalNotification(!enableArrivalNotification)}
                >
                  <Ionicons
                    name={enableArrivalNotification ? "notifications" : "notifications-outline"}
                    size={16}
                    color={enableArrivalNotification ? "#FFFFFF" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.arrivalNotificationToggleText,
                      enableArrivalNotification && styles.arrivalNotificationToggleTextActive,
                    ]}
                  >
                    도착 알림 받기
                  </Text>
                </Pressable>

                {/* 반경 선택 */}
                {enableArrivalNotification && (
                  <View style={styles.radiusContainer}>
                    <Text style={styles.radiusLabel}>도착 인식 범위</Text>
                    <View style={styles.radiusOptions}>
                      {RADIUS_OPTIONS.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.radiusOption,
                            selectedRadius === option.value && styles.radiusOptionSelected,
                          ]}
                          onPress={() => setSelectedRadius(option.value)}
                        >
                          <Text
                            style={[
                              styles.radiusOptionText,
                              selectedRadius === option.value && styles.radiusOptionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 확인 버튼 */}
            <TouchableOpacity
              style={[
                styles.locationConfirmButton,
                !selectedLocation && styles.locationConfirmButtonDisabled,
              ]}
              onPress={() => locationSheetRef.current?.close()}
            >
              <Text style={styles.locationConfirmButtonText}>
                {selectedLocation ? "확인" : "닫기"}
              </Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>

        {/* 체크리스트 BottomSheet */}
        <BottomSheet
          ref={checklistSheetRef}
          index={-1}
          snapPoints={checklistSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.bottomSheetHandle}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <Text style={styles.bottomSheetTitle}>체크리스트</Text>

            <ScrollView style={styles.checklistScrollView}>
              {/* 체크리스트 항목들 */}
              {checklistItems.map((item) => (
                <View key={item.id} style={styles.checklistItem}>
                  <View style={styles.checklistItemCheckbox}>
                    <Ionicons name="square-outline" size={18} color="#D1D5DB" />
                  </View>
                  <Text style={styles.checklistItemText}>{item.content}</Text>
                  <Pressable
                    onPress={() => handleRemoveChecklistItem(item.id)}
                    style={styles.checklistItemRemove}
                  >
                    <Ionicons name="close" size={16} color="#9CA3AF" />
                  </Pressable>
                </View>
              ))}

              {/* 새 항목 추가 */}
              <View style={styles.addChecklistItem}>
                <Ionicons name="add-circle-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.addChecklistInput}
                  value={newChecklistItem}
                  onChangeText={setNewChecklistItem}
                  placeholder="항목 추가..."
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  onSubmitEditing={handleAddChecklistItem}
                />
                {newChecklistItem.trim() && (
                  <Pressable
                    onPress={handleAddChecklistItem}
                    style={styles.addChecklistButton}
                  >
                    <Text style={styles.addChecklistButtonText}>추가</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>

            {/* 확인 버튼 */}
            <TouchableOpacity
              style={styles.checklistConfirmButton}
              onPress={() => checklistSheetRef.current?.close()}
            >
              <Text style={styles.checklistConfirmButtonText}>확인</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButton: {
    padding: 4,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#F3F4F6",
    marginBottom: 24,
  },
  conflictBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  conflictTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  conflictMessage: {
    fontSize: 13,
    color: "#A16207",
    marginBottom: 4,
  },
  conflictSchedule: {
    fontSize: 12,
    color: "#A16207",
    marginLeft: 4,
  },
  conflictMore: {
    fontSize: 12,
    color: "#D97706",
    marginTop: 2,
    fontStyle: "italic",
  },
  dateTimeCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  dateTimeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  dateTimeContent: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  timeButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },
  dateTimeDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 24,
  },
  togglesRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  toggleChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  toggleChipImportant: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  toggleChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  toggleChipTextActive: {
    color: "#FFFFFF",
  },
  // 새로운 설정 그룹 스타일
  settingsGroup: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  settingDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 48,
  },
  participantAvatarsSmall: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: "#F9FAFB",
  },
  participantMoreSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
    borderWidth: 2,
    borderColor: "#F9FAFB",
  },
  participantMoreSmallText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6B7280",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
    marginTop: 4,
  },
  // 메모 섹션 스타일
  memoSection: {
    marginTop: 8,
  },
  memoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  memoLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  // 반복 BottomSheet 스타일
  repeatSheetList: {
    marginTop: 8,
    marginBottom: 20,
  },
  repeatSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 14,
  },
  repeatSheetItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  repeatSheetItemTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  // 기존 스타일 (호환성 유지)
  section: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  sectionBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007AFF",
  },
  repeatOptions: {
    flexDirection: "row",
    gap: 8,
  },
  repeatChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  repeatChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  repeatChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  repeatChipTextActive: {
    color: "#FFFFFF",
  },
  reminderPresetList: {
    marginBottom: 20,
  },
  reminderPresetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  reminderPresetText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  reminderPresetValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
    marginRight: 8,
  },
  reminderPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reminderPicker: {
    flex: 1,
    height: 180,
  },
  reminderPickerItem: {
    fontSize: 20,
    fontWeight: "500",
    color: "#374151",
  },
  customReminderConfirmButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  customReminderConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  participantAvatars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  participantMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  participantMoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  timePickerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  memoInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#374151",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  bottomSheetHandle: {
    backgroundColor: "#E5E7EB",
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },
  bottomSheetList: {
    flex: 1,
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  participantItemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  participantItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  // 장소 검색 스타일
  sectionOptional: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: "auto",
  },
  locationSearchContainer: {
    marginBottom: 8,
  },
  locationSearchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  locationSearchIcon: {
    marginRight: 8,
  },
  locationSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#374151",
  },
  locationClearButton: {
    padding: 4,
  },
  locationSearchResults: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  locationSearchLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  locationSearchLoadingText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
  },
  locationNoResults: {
    padding: 16,
    alignItems: "center",
  },
  locationNoResultsText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchResultIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  searchResultAddress: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  currentLocationButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 6,
  },
  selectedLocationContainer: {
    marginTop: 4,
  },
  selectedLocationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: 8,
  },
  selectedLocationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  selectedLocationAddress: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  removeLocationButton: {
    padding: 4,
  },
  arrivalNotificationToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginTop: 8,
    gap: 6,
  },
  arrivalNotificationToggleActive: {
    backgroundColor: "#3B82F6",
  },
  arrivalNotificationToggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  arrivalNotificationToggleTextActive: {
    color: "#FFFFFF",
  },
  radiusContainer: {
    marginTop: 10,
  },
  radiusLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 6,
  },
  radiusOptions: {
    flexDirection: "row",
    gap: 6,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  radiusOptionSelected: {
    backgroundColor: "#3B82F6",
  },
  radiusOptionText: {
    fontSize: 12,
    color: "#6B7280",
  },
  radiusOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // 체크리스트 스타일
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  checklistItemCheckbox: {
    marginRight: 10,
  },
  checklistItemText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  checklistItemRemove: {
    padding: 4,
  },
  addChecklistItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  addChecklistInput: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    marginLeft: 10,
    paddingVertical: 0,
  },
  addChecklistButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addChecklistButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // 미리보기 스타일
  previewSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  previewContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  previewTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  previewSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewEditText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#007AFF",
  },
  previewRemoveButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
    marginLeft: 8,
  },
  // BottomSheet 확인 버튼 스타일
  locationConfirmButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  locationConfirmButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  locationConfirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  checklistScrollView: {
    flex: 1,
    marginBottom: 8,
  },
  checklistConfirmButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  checklistConfirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  arrowButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  dayNamesRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    paddingVertical: 8,
  },
  sundayText: {
    color: "#EF4444",
  },
  saturdayText: {
    color: "#3B82F6",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  selectedDay: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "500",
  },
  todayText: {
    fontWeight: "700",
    color: "#007AFF",
  },
});

export default CreateScheduleView;
