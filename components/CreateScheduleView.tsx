import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
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
import { RepeatOption, Schedule, User } from "../types";
import DateTimePicker from "./DateTimePicker";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

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
}

const CreateScheduleView: React.FC<CreateScheduleViewProps> = ({
  onSave,
  users,
  currentUser,
  setActiveView,
  scheduleToEdit,
  initialDate,
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

  // BottomSheet refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const calendarSheetRef = useRef<BottomSheet>(null);
  const timeSheetRef = useRef<BottomSheet>(null);
  const reminderSheetRef = useRef<BottomSheet>(null);
  const customReminderSheetRef = useRef<BottomSheet>(null);
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
      setIsAllDay(!scheduleToEdit.startTime);
      setReminderMinutes(scheduleToEdit.reminderMinutes ?? null);
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
      setIsAllDay(false);
    }
  }, [scheduleToEdit, currentUser.id, initialDate]);

  const handleSubmit = async () => {
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
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
        reminderMinutes: reminderMinutes ?? undefined,
      };
      await onSave(scheduleData, scheduleToEdit?.id);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateDisplay = (date: string) => {
    if (!date) return "";
    const dateObj = new Date(date + "T00:00:00");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const day = days[dateObj.getDay()];
    return `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${day})`;
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
            </View>
          </Pressable>

          {/* 반복 */}
          <Pressable
            style={styles.section}
            onPress={() => isKeyboardVisible && Keyboard.dismiss()}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="repeat" size={20} color="#007AFF" />
              <Text style={styles.sectionTitle}>반복</Text>
            </View>
            <View style={styles.repeatOptions}>
              {repeatOptions.map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.repeatChip,
                    repeat === option.key && styles.repeatChipActive,
                  ]}
                  onPress={() => {
                    if (isKeyboardVisible) {
                      Keyboard.dismiss();
                    } else {
                      setRepeat(option.key);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.repeatChipText,
                      repeat === option.key && styles.repeatChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>

          {/* 알림 */}
          <Pressable
            style={styles.section}
            onPress={() => {
              if (isKeyboardVisible) {
                Keyboard.dismiss();
              } else {
                reminderSheetRef.current?.expand();
              }
            }}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications-outline" size={20} color="#007AFF" />
              <Text style={styles.sectionTitle}>알림</Text>
              <Text style={styles.sectionBadge}>
                {reminderMinutes === null
                  ? "없음"
                  : reminderMinutes === 0
                  ? "시작"
                  : reminderMinutes >= 60
                  ? `${reminderMinutes / 60}시간 전`
                  : `${reminderMinutes}분 전`}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </View>
          </Pressable>

          {/* 참가자 */}
          <Pressable
            style={styles.section}
            onPress={() => {
              if (isKeyboardVisible) {
                Keyboard.dismiss();
              } else {
                bottomSheetRef.current?.expand();
              }
            }}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color="#007AFF" />
              <Text style={styles.sectionTitle}>참가자</Text>
              <Text style={styles.sectionBadge}>{participantIds.length}명</Text>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </View>
            <View style={styles.participantAvatars}>
              {participantIds.slice(0, 6).map((userId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return null;
                return (
                  <Image
                    key={user.id}
                    source={{ uri: user.avatarUrl }}
                    style={styles.participantAvatar}
                  />
                );
              })}
              {participantIds.length > 6 && (
                <View style={styles.participantMore}>
                  <Text style={styles.participantMoreText}>
                    +{participantIds.length - 6}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* 메모 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color="#007AFF" />
              <Text style={styles.sectionTitle}>메모</Text>
            </View>
            <TextInput
              ref={memoInputRef}
              style={styles.memoInput}
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력하세요 (선택)"
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
  toggleChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  toggleChipTextActive: {
    color: "#FFFFFF",
  },
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
