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
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Event, RepeatOption, User } from "../types";
import DateTimePicker from "./DateTimePicker";

interface CreateEventViewProps {
  onSave: (
    eventData: Omit<Event, "id" | "calendarId">,
    eventId?: string
  ) => void;
  users: User[];
  currentUser: User;
  setActiveView: (view: string) => void;
  eventToEdit: Event | null;
}

const CreateEventView: React.FC<CreateEventViewProps> = ({
  onSave,
  users,
  currentUser,
  setActiveView,
  eventToEdit,
}) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [displayDate, setDisplayDate] = useState(new Date());
  const [activeField, setActiveField] = useState<"start" | "end" | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<
    "start" | "end" | null
  >(null);
  const [isLunar, setIsLunar] = useState(false);

  const [participantIds, setParticipantIds] = useState<string[]>([
    currentUser.id,
  ]);
  const [repeat, setRepeat] = useState<RepeatOption>("none");

  // BottomSheet refs
  const bottomSheetRef = useRef<BottomSheet>(null);

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
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setStartDate(eventToEdit.startDate);
      setEndDate(eventToEdit.endDate);
      setParticipantIds(eventToEdit.participantIds);
      setRepeat(eventToEdit.repeat || "none");
      setStartTime(eventToEdit.startTime || dayjs().format("HH:mm"));
      setEndTime(eventToEdit.endTime || dayjs().add(1, "hour").format("HH:mm"));
      setIsAllDay(!eventToEdit.startTime);
    } else {
      setTitle("");
      setStartDate(dayjs().format("YYYY-MM-DD"));
      setEndDate(undefined);
      setParticipantIds([currentUser.id]);
      setRepeat("none");
      setStartTime(dayjs().format("HH:mm"));
      setEndTime(dayjs().add(1, "hour").format("HH:mm"));
      setIsAllDay(false);
    }
  }, [eventToEdit, currentUser.id]);

  const handleSubmit = () => {
    const eventData: Omit<Event, "id" | "calendarId"> = {
      title: title || "Event",
      description: undefined,
      startDate,
      participantIds,
      repeat,
      endDate: endDate && endDate !== startDate ? endDate : undefined,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      location: eventToEdit?.location,
    };
    onSave(eventData, eventToEdit?.id);
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
        // 음력 변환 실패 시 양력 반환
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
      marked[startDate] = { selected: true, selectedColor: "#a7f3d0" };
    }
    if (activeField === "end" && endDate) {
      marked[endDate] = { selected: true, selectedColor: "#a7f3d0" };
    }
    return marked;
  }, [activeField, startDate, endDate]);

  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "#fff",
      textSectionTitleColor: "#6b7280",
      selectedDayBackgroundColor: "#a7f3d0",
      selectedDayTextColor: "#374151",
      todayTextColor: "#fbbf24",
      dayTextColor: "#374151",
      textDisabledColor: "#d1d5db",
      dotColor: "transparent",
      selectedDotColor: "transparent",
      arrowColor: "transparent",
      monthTextColor: "#000000",
      textDayFontWeight: "500" as const,
      textDayHeaderFontWeight: "600" as const,
      textDayFontSize: 14,
      textMonthFontSize: 16,
      textDayHeaderFontSize: 12,
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setActiveView("calendar")}>
          <MaterialIcons name="close" size={28} color="#10b981" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSubmit}>
          <Text style={styles.saveButton}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
      >
        <View style={styles.titleSection}>
          <Text style={styles.label}>제목</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.section}>
          <MaterialIcons name="access-time" size={24} color="#10b981" />
          <Text style={styles.sectionText}>종일</Text>
          <Switch
            value={isAllDay}
            onValueChange={setIsAllDay}
            trackColor={{ false: "#d1d5db", true: "#10b981" }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>시작</Text>
          <View style={styles.datetimeRow}>
            <Pressable
              style={[
                styles.datetimeButton,
                activeField === "start" && styles.startDateButton,
              ]}
              onPress={() => {
                setActiveField(activeField === "start" ? null : "start");
                setActiveTimeField(null);
              }}
            >
              <Text
                style={
                  activeField === "start"
                    ? styles.startDateText
                    : styles.datetimeText
                }
              >
                {formattedDateTime(startDate)}
              </Text>
            </Pressable>
            {!isAllDay && (
              <Pressable
                style={[
                  styles.datetimeButton,
                  activeTimeField === "start" && styles.startDateButton,
                ]}
                onPress={() => {
                  setActiveTimeField(
                    activeTimeField === "start" ? null : "start"
                  );
                  setActiveField(null);
                }}
              >
                <Text
                  style={
                    activeTimeField === "start"
                      ? styles.startDateText
                      : styles.datetimeText
                  }
                >
                  {startTime}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>종료</Text>
          <View style={styles.datetimeRow}>
            <Pressable
              style={[
                styles.datetimeButton,
                activeField === "end" && styles.startDateButton,
              ]}
              onPress={() => {
                setActiveField(activeField === "end" ? null : "end");
                setActiveTimeField(null);
              }}
            >
              <Text
                style={
                  activeField === "end"
                    ? styles.startDateText
                    : styles.datetimeText
                }
              >
                {formattedDateTime(endDate || startDate)}
              </Text>
            </Pressable>
            {!isAllDay && (
              <Pressable
                style={[
                  styles.datetimeButton,
                  activeTimeField === "end" && styles.startDateButton,
                ]}
                onPress={() => {
                  setActiveTimeField(activeTimeField === "end" ? null : "end");
                  setActiveField(null);
                }}
              >
                <Text
                  style={
                    activeTimeField === "end"
                      ? styles.startDateText
                      : styles.datetimeText
                  }
                >
                  {endTime}
                </Text>
              </Pressable>
            )}
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

        {/* 시간만 선택하는 DatePicker  24시간 표시*/}
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
          <MaterialIcons name="calendar-month" size={24} color="#10b981" />
          <Text style={styles.sectionText}>음력</Text>
          <Switch
            value={isLunar}
            onValueChange={setIsLunar}
            trackColor={{ false: "#d1d5db", true: "#10b981" }}
          />
        </View>

        <View style={styles.optionsSection}>
          {/* <View style={styles.section}>
            <MaterialIcons name="note" size={24} color="#10b981" />
            <Text style={styles.sectionText}>메모로 저장하기</Text>
            <Switch
              value={false}
              onValueChange={() => {}}
              trackColor={{ false: "#d1d5db", true: "#10b981" }}
            />
          </View> */}

          {/* <View style={styles.section}>
            <MaterialIcons name="label" size={24} color="#10b981" />
            <Text style={styles.sectionText}>에메랄드 그린</Text>
            <MaterialIcons name="chevron-right" size={24} color="#d1d5db" />
          </View> */}

          <Pressable
            style={styles.section}
            onPress={() => bottomSheetRef.current?.expand()}
          >
            <View style={styles.sectionIcon}>
              <MaterialIcons name="people" size={24} color="#10b981" />
            </View>
            <View style={styles.participantsRow}>
              <View style={styles.participantBadges}>
                {participantIds.slice(0, 3).map((userId) => {
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
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#d1d5db" />
            </View>
          </Pressable>

          {/* <View style={styles.section}>
            <MaterialIcons name="notifications" size={24} color="#10b981" />
            <Text style={styles.sectionText}>10분 전</Text>
            <MaterialIcons name="close" size={20} color="#9ca3af" />
          </View> */}
        </View>

        {/* <View style={styles.actionButtons}>
          <MaterialIcons name="add-circle" size={32} color="#10b981" />
          <View style={styles.buttonRow}>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="repeat" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>반복</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="star" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>D-Day 기능</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="place" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>장소</Text>
            </Pressable>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="link" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>링크</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="description" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>메모</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="checklist" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>To-Do 리스트</Text>
            </Pressable>
          </View>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="attach-file" size={20} color="#10b981" />
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
              참가자 {participantIds.length > 0 && `(${participantIds.length})`}
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
                <MaterialIcons name="check" size={24} color="#10b981" />
              )}
            </Pressable>

            {/* 다른 참가자들 */}
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
                    <MaterialIcons name="check" size={24} color="#10b981" />
                  )}
                </Pressable>
              ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveButton: {
    color: "#10b981",
    fontWeight: "600",
    fontSize: 16,
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
  titleInput: {
    marginTop: 8,
    fontSize: 16,
    color: "#374151",
    padding: 8,
    borderRadius: 8,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
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
    backgroundColor: "#10b981",
  },
  startDateText: {
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  optionsSection: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
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
    marginTop: 16,
  },
  timePickerContainer: {
    backgroundColor: "#fff",
    marginTop: 16,
    padding: 16,
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
});

export default CreateEventView;
