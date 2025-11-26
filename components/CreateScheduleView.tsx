import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import KoreanLunarCalendar from "korean-lunar-calendar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RepeatOption, Schedule, User } from "../types";
import DateTimePicker from "./DateTimePicker";

// 한글 로케일 설정
LocaleConfig.locales["ko"] = {
  monthNames: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  monthNamesShort: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  dayNames: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],
  dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
  today: "오늘",
};
LocaleConfig.defaultLocale = "ko";

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

  // BottomSheet refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const memoInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // BottomSheet snap points
  const snapPoints = useMemo(() => ["50%"], []);

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
        endDate: endDate || startDate, // endDate가 없으면 startDate 사용
        participants: participantIds,
        repeatType: repeat,
        calendarType: isLunar ? "lunar" : "solar",
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
      };
      await onSave(scheduleData, scheduleToEdit?.id);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDateTime = (date: string) => {
    if (!date) return "";
    const dateObj = new Date(date + "T00:00:00");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const day = days[dateObj.getDay()];

    if (isLunar) {
      try {
        const lunarCal = new KoreanLunarCalendar();
        lunarCal.setSolarDate(
          dateObj.getFullYear(),
          dateObj.getMonth() + 1,
          dateObj.getDate()
        );
        const lunar = lunarCal.getLunarCalendar();
        return `${lunar.year}년 ${lunar.month}월 ${lunar.day}일 (${day})`;
      } catch {
        return `${dateObj.getFullYear()}년 ${
          dateObj.getMonth() + 1
        }월 ${dateObj.getDate()}일 (${day})`;
      }
    }

    return `${dateObj.getFullYear()}년 ${
      dateObj.getMonth() + 1
    }월 ${dateObj.getDate()}일 (${day})`;
  };

  const markedDates = useMemo(() => {
    const marked: any = {};
    if (activeField === "start" && startDate) {
      marked[startDate] = {
        selected: true,
        disableTouchEvent: false,
        selectedColor: "#eff6ff",
        selectedTextColor: "#007AFF",
      };
    }
    if (activeField === "end" && endDate) {
      marked[endDate] = {
        selected: true,
        disableTouchEvent: false,
        selectedColor: "#eff6ff",
        selectedTextColor: "#007AFF",
      };
    }
    return marked;
  }, [activeField, startDate, endDate]);

  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "#fff",
      textSectionTitleColor: "#6b7280",
      selectedDayBackgroundColor: "#eff6ff",
      selectedDayTextColor: "#007AFF",
      todayTextColor: "#007AFF",
      dayTextColor: "#374151",
      textDisabledColor: "#d1d5db",
      dotColor: "#007AFF",
      selectedDotColor: "#007AFF",
      arrowColor: "#007AFF",
      monthTextColor: "#1f2937",
      textDayFontWeight: "500" as const,
      textDayHeaderFontWeight: "600" as const,
      textDayFontSize: 14,
      textMonthFontSize: 16,
      textDayHeaderFontSize: 12,
      textSundayColor: "#ef4444", // 일요일 빨간색
      textSaturdayColor: "#3b82f6", // 토요일 파란색
    }),
    []
  );

  const handleDayPress = (day: DateData) => {
    const dStr = dayjs(day.dateString).format("YYYY-MM-DD");
    if (activeField === "start") {
      setStartDate(dStr);
    } else {
      setEndDate(dStr);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setActiveView("calendar")}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <MaterialIcons name="close" size={26} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {scheduleToEdit ? "일정 수정" : "새 일정"}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.6}
            disabled={!title.trim() || isSaving}
          >
            <Text
              style={[
                styles.saveButton,
                (!title.trim() || isSaving) && styles.saveButtonDisabled,
              ]}
            >
              저장
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 제목 입력 */}
          <View style={styles.titleCard}>
            {/* <View style={styles.titleIconContainer}> */}
            {/* <MaterialIcons name="title" size={24} color="#007AFF" /> */}
            {/* </View> */}
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="일정 제목"
              placeholderTextColor="#9ca3af"
              autoFocus={!scheduleToEdit}
              maxLength={50}
            />
          </View>

          {/* 날짜/시간 카드 */}
          <View style={styles.dateTimeCard}>
            {/* 시작 날짜/시간 */}
            <View style={styles.dateTimeSection}>
              <View style={styles.dateTimeSectionHeader}>
                <View style={styles.dateTimeIconBadge}>
                  <MaterialIcons
                    name="event-available"
                    size={18}
                    color="#10b981"
                  />
                </View>
                <Text style={styles.dateTimeSectionTitle}>시작</Text>
              </View>
              <View style={styles.dateTimeInputsContainer}>
                <Pressable
                  style={[
                    styles.dateTimeButton,
                    activeField === "start" && styles.dateTimeButtonActive,
                  ]}
                  onPress={() => {
                    setActiveField(activeField === "start" ? null : "start");
                    setActiveTimeField(null);
                  }}
                >
                  <MaterialIcons
                    name="calendar-today"
                    size={16}
                    color={activeField === "start" ? "#007AFF" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.dateTimeButtonText,
                      activeField === "start" &&
                        styles.dateTimeButtonTextActive,
                    ]}
                  >
                    {formattedDateTime(startDate)}
                  </Text>
                </Pressable>
                {!isAllDay && (
                  <Pressable
                    style={[
                      styles.dateTimeButton,
                      styles.timeButton,
                      activeTimeField === "start" &&
                        styles.dateTimeButtonActive,
                    ]}
                    onPress={() => {
                      setActiveTimeField(
                        activeTimeField === "start" ? null : "start"
                      );
                      setActiveField(null);
                    }}
                  >
                    <MaterialIcons
                      name="access-time"
                      size={16}
                      color={
                        activeTimeField === "start" ? "#007AFF" : "#6b7280"
                      }
                    />
                    <Text
                      style={[
                        styles.dateTimeButtonText,
                        activeTimeField === "start" &&
                          styles.dateTimeButtonTextActive,
                      ]}
                    >
                      {startTime}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* 종료 날짜/시간 */}
            <View style={styles.dateTimeSection}>
              <View style={[styles.dateTimeSectionHeader, { marginTop: 10 }]}>
                <View
                  style={[
                    styles.dateTimeIconBadge,
                    styles.dateTimeIconBadgeEnd,
                  ]}
                >
                  <MaterialIcons name="event-busy" size={18} color="#ef4444" />
                </View>
                <Text style={styles.dateTimeSectionTitle}>종료</Text>
              </View>
              <View style={styles.dateTimeInputsContainer}>
                <Pressable
                  style={[
                    styles.dateTimeButton,
                    activeField === "end" && styles.dateTimeButtonActive,
                  ]}
                  onPress={() => {
                    setActiveField(activeField === "end" ? null : "end");
                    setActiveTimeField(null);
                  }}
                >
                  <MaterialIcons
                    name="calendar-today"
                    size={16}
                    color={activeField === "end" ? "#007AFF" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.dateTimeButtonText,
                      activeField === "end" && styles.dateTimeButtonTextActive,
                    ]}
                  >
                    {formattedDateTime(endDate || startDate)}
                  </Text>
                </Pressable>
                {!isAllDay && (
                  <Pressable
                    style={[
                      styles.dateTimeButton,
                      styles.timeButton,
                      activeTimeField === "end" && styles.dateTimeButtonActive,
                    ]}
                    onPress={() => {
                      setActiveTimeField(
                        activeTimeField === "end" ? null : "end"
                      );
                      setActiveField(null);
                    }}
                  >
                    <MaterialIcons
                      name="access-time"
                      size={16}
                      color={activeTimeField === "end" ? "#007AFF" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.dateTimeButtonText,
                        activeTimeField === "end" &&
                          styles.dateTimeButtonTextActive,
                      ]}
                    >
                      {endTime}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* 종일 토글 */}
            <View style={styles.allDayToggleContainer}>
              <Pressable
                style={styles.allDayToggle}
                onPress={() => setIsAllDay(!isAllDay)}
                android_ripple={{ color: "#f3f4f6" }}
              >
                <MaterialIcons
                  name={isAllDay ? "event" : "schedule"}
                  size={20}
                  color={isAllDay ? "#007AFF" : "#6b7280"}
                />
                <Text
                  style={[
                    styles.allDayText,
                    isAllDay && styles.allDayTextActive,
                  ]}
                >
                  {isAllDay ? "종일 일정" : "시간 설정"}
                </Text>
                <Switch
                  value={isAllDay}
                  onValueChange={setIsAllDay}
                  trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
                  thumbColor={isAllDay ? "#007AFF" : "#f9fafb"}
                />
              </Pressable>
            </View>
          </View>

          {activeField && (
            <View style={styles.calendarContainer}>
              <Calendar
                current={dayjs(displayDate).format("YYYY-MM-DD")}
                onDayPress={handleDayPress}
                markedDates={markedDates}
                theme={calendarTheme}
                hideArrows={false}
                hideExtraDays={true}
                firstDay={0}
                monthFormat="yyyy년 M월"
                onMonthChange={(month) => {
                  setDisplayDate(new Date(month.dateString));
                }}
              />
            </View>
          )}

          {/* 반복 옵션 카드 */}
          <View style={styles.repeatCard}>
            <View style={styles.repeatCardHeader}>
              <View style={styles.iconBadge}>
                <MaterialIcons name="repeat" size={20} color="#007AFF" />
              </View>
              <Text style={styles.optionTitle}>반복</Text>
            </View>
            <View style={styles.repeatOptionsGrid}>
              {(["none", "daily", "weekly", "monthly"] as RepeatOption[]).map(
                (option) => (
                  <Pressable
                    key={option}
                    style={[
                      styles.repeatOptionNew,
                      repeat === option && styles.repeatOptionNewSelected,
                    ]}
                    onPress={() => setRepeat(option)}
                    android_ripple={{ color: "#e5e7eb" }}
                  >
                    <MaterialIcons
                      name={
                        option === "none"
                          ? "block"
                          : option === "daily"
                          ? "today"
                          : option === "weekly"
                          ? "date-range"
                          : "calendar-month"
                      }
                      size={20}
                      color={repeat === option ? "#007AFF" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.repeatOptionTextNew,
                        repeat === option && styles.repeatOptionTextNewSelected,
                      ]}
                    >
                      {option === "none"
                        ? "없음"
                        : option === "daily"
                        ? "매일"
                        : option === "weekly"
                        ? "매주"
                        : "매월"}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          {activeTimeField && (
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
          )}

          <View style={styles.section}>
            <MaterialIcons name="calendar-month" size={24} color="#007AFF" />
            <Text style={styles.sectionText}>음력</Text>
            <Switch
              value={isLunar}
              onValueChange={setIsLunar}
              trackColor={{ false: "#d1d5db", true: "#007AFF" }}
            />
          </View>

          <View style={styles.optionsSection}>
            {/* <View style={styles.section}>
            <MaterialIcons name="note" size={24} color="#007AFF" />
            <Text style={styles.sectionText}>메모로 저장하기</Text>
            <Switch
              value={false}
              onValueChange={() => {}}
              trackColor={{ false: "#d1d5db", true: "#007AFF" }}
            />
          </View> */}

            {/* <View style={styles.section}>
            <MaterialIcons name="label" size={24} color="#007AFF" />
            <Text style={styles.sectionText}>에메랄드 그린</Text>
            <MaterialIcons name="chevron-right" size={24} color="#d1d5db" />
          </View> */}

            {/* 참가자 카드 */}
            <Pressable
              style={styles.optionCard}
              onPress={() => bottomSheetRef.current?.expand()}
              android_ripple={{ color: "#f3f4f6" }}
            >
              <View style={styles.participantHeader}>
                <MaterialIcons name="people" size={23} color="#007AFF" />
                <View style={styles.participantHeaderText}>
                  <Text style={styles.participantTitle}>참가자</Text>
                  <Text style={styles.participantSubtitle}>
                    {participantIds.length}명 선택
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
              </View>
              <View style={styles.participantPreview}>
                {participantIds.slice(0, 5).map((userId) => {
                  const user = users.find((u) => u.id === userId);
                  if (!user) return null;
                  return (
                    <Image
                      key={user.id}
                      source={{ uri: user.avatarUrl }}
                      style={styles.participantAvatarNew}
                    />
                  );
                })}
                {participantIds.length > 5 && (
                  <View style={styles.moreParticipants}>
                    <Text style={styles.moreParticipantsText}>
                      +{participantIds.length - 5}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>

            {/* 메모 카드 */}
            <View style={styles.optionCard}>
              <View style={styles.memoHeader}>
                <MaterialIcons name="edit-note" size={20} color="#6b7280" />
                <Text style={styles.memoHeaderText}>메모</Text>
                {memo.length > 0 && (
                  <Text style={styles.memoCharCount}>{memo.length}자</Text>
                )}
              </View>
              <TextInput
                ref={memoInputRef}
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="메모 입력 (선택)"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                onFocus={() => {
                  // 키보드가 올라올 때 스크롤을 메모 입력 필드로 이동
                  setTimeout(() => {
                    memoInputRef.current?.measureLayout(
                      scrollViewRef.current as any,
                      (_left, top) => {
                        scrollViewRef.current?.scrollTo({
                          y: top - 100,
                          animated: true,
                        });
                      },
                      () => {}
                    );
                  }, 100);
                }}
              />
            </View>

            {/* <View style={styles.section}>
            <MaterialIcons name="notifications" size={24} color="#007AFF" />
            <Text style={styles.sectionText}>10분 전</Text>
            <MaterialIcons name="close" size={20} color="#9ca3af" />
          </View> */}
          </View>

          {/* <View style={styles.actionButtons}>
          <MaterialIcons name="add-circle" size={32} color="#007AFF" />
          <View style={styles.buttonRow}>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="repeat" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>반복</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="star" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>D-Day 기능</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="place" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>장소</Text>
            </Pressable>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="link" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>링크</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="description" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>메모</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="checklist" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>To-Do 리스트</Text>
            </Pressable>
          </View>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="attach-file" size={20} color="#007AFF" />
            <MaterialIcons name="star-border" size={16} color="#000" />
            <Text style={styles.actionButtonText}>첨부 파일</Text>
          </Pressable>
        </View> */}
        </ScrollView>

        {/* 참가자 선택 BottomSheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>
                참가자{" "}
                {participantIds.length > 0 && `(${participantIds.length})`}
              </Text>
            </View>

            {/* Participant List */}
            <ScrollView style={styles.bottomSheetList}>
              <Pressable
                style={[
                  styles.bottomSheetItem,
                  participantIds.includes(currentUser.id) &&
                    styles.bottomSheetItemSelected,
                ]}
                onPress={() => {
                  if (participantIds.includes(currentUser.id)) {
                    setParticipantIds(
                      participantIds.filter((id) => id !== currentUser.id)
                    );
                  } else {
                    setParticipantIds([...participantIds, currentUser.id]);
                  }
                }}
              >
                <Image
                  source={{ uri: currentUser.avatarUrl }}
                  style={styles.bottomSheetAvatar}
                />
                <Text style={styles.bottomSheetItemText}>나</Text>
                {participantIds.includes(currentUser.id) && (
                  <MaterialIcons name="check" size={24} color="#007AFF" />
                )}
              </Pressable>

              {users
                .filter((u) => u.id !== currentUser.id)
                .map((user) => (
                  <Pressable
                    key={user.id}
                    style={[
                      styles.bottomSheetItem,
                      participantIds.includes(user.id) &&
                        styles.bottomSheetItemSelected,
                    ]}
                    onPress={() => {
                      if (participantIds.includes(user.id)) {
                        setParticipantIds(
                          participantIds.filter((id) => id !== user.id)
                        );
                      } else {
                        setParticipantIds([...participantIds, user.id]);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={styles.bottomSheetAvatar}
                    />
                    <Text style={styles.bottomSheetItemText}>{user.name}</Text>
                    {participantIds.includes(user.id) && (
                      <MaterialIcons name="check" size={24} color="#007AFF" />
                    )}
                  </Pressable>
                ))}
            </ScrollView>
          </BottomSheetView>
        </BottomSheet>

        {/* 저장 중 로딩 오버레이 */}
        {isSaving && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>저장 중...</Text>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  saveButton: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 17,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  titleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    color: "#1f2937",
    padding: 0,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  sectionText: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
    marginLeft: 8,
  },
  datetimeRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  datetimeButton: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  datetimeText: {
    fontSize: 12,
    color: "#374151",
    textAlign: "center",
  },
  startDateButton: {
    backgroundColor: "#007AFF",
  },
  startDateText: {
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  optionsSection: {
    marginTop: 4,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantBadges: {
    flexDirection: "row",
    gap: 4,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  actionButtons: {
    marginTop: 24,
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: "#374151",
  },
  calendarContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
  },
  timePickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  timePickerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  timePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  timePickerCell: {
    width: "10%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timePickerSelected: {
    backgroundColor: "#a7f3d0",
    borderColor: "#a7f3d0",
  },
  timePickerText: {
    fontSize: 12,
    color: "#6b7280",
  },
  timePickerSelectedText: {
    color: "#374151",
    fontWeight: "600",
  },
  sectionIcon: {
    marginRight: 8,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },
  bottomSheetList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  bottomSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  bottomSheetItemSelected: {
    backgroundColor: "#ecfdf5",
  },
  bottomSheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  bottomSheetItemText: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
  },
  repeatOptionsRow: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  repeatOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  repeatOptionSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#007AFF",
  },
  repeatOptionText: {
    fontSize: 14,
    color: "#6b7280",
  },
  repeatOptionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  // New improved styles
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  titleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  dateTimeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  dateTimeSection: {},
  dateTimeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dateTimeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  dateTimeIconBadgeEnd: {
    backgroundColor: "#fee2e2",
  },
  dateTimeSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  dateTimeInputsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  dateDivider: {
    alignItems: "center",
  },
  allDayToggleContainer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  allDayToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  allDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    marginBottom: 16,
  },
  allDayLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allDayText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#6b7280",
  },
  allDayTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dateTimeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 70,
  },
  dateTimeLabelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  dateTimeInputs: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f9fafb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  dateTimeButtonActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#007AFF",
    borderWidth: 2,
  },
  dateTimeButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    flex: 1,
  },
  dateTimeButtonTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  timeButton: {
    flex: 0.6,
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionCardTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  optionCardTitleText: {
    flex: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
    marginTop: 3,
  },
  participantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  participantHeaderText: {
    flex: 1,
  },
  participantTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  participantSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
    marginTop: 2,
  },
  participantPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: -8,
  },
  participantAvatarNew: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fff",
  },
  moreParticipants: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  moreParticipantsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  memoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  memoHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  memoCharCount: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  memoInput: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#374151",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  repeatCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  repeatCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  repeatSection: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  repeatSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 14,
  },
  repeatOptionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  repeatOptionNew: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafa",
  },
  repeatOptionNewSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#007AFF",
    borderWidth: 2.5,
  },
  repeatOptionTextNew: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  repeatOptionTextNewSelected: {
    color: "#007AFF",
    fontWeight: "700",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default CreateScheduleView;
