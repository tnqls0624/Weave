import { MaterialIcons } from "@expo/vector-icons";
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
} from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { User } from "../types";
import DateTimePicker from "./DateTimePicker";

type SettingsPage = "main" | "account" | "tags" | "notifications" | "privacy";

interface SettingsViewProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ users, setUsers }) => {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<SettingsPage>("main");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("임의");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showInCalendar, setShowInCalendar] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const colorBottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%"], []);

  const availableColors = [
    { name: "emerald", koreanName: "에메랄드 그린" },
    { name: "cyan", koreanName: "모던 사이언" },
    { name: "blue", koreanName: "딥 스카이블루" },
    { name: "indigo", koreanName: "파스텔 브라운" },
    { name: "purple", koreanName: "미드나잇 블랙" },
    { name: "red", koreanName: "애플 레드" },
    { name: "pink", koreanName: "프렌치 로즈" },
    { name: "orange", koreanName: "코랄 핑크" },
    { name: "amber", koreanName: "브라이트 오렌지" },
    { name: "violet", koreanName: "소프트 바이올렛" },
  ];

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

  const handleOpenColorPicker = (userId: string) => {
    setSelectedUserId(userId);
    colorBottomSheetRef.current?.expand();
  };

  const handleColorSelect = (colorName: string) => {
    if (selectedUserId) {
      handleColorChange(selectedUserId, colorName);
      colorBottomSheetRef.current?.close();
      setSelectedUserId(null);
    }
  };

  const handleColorChange = (userId: string, color: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((u) => (u.id === userId ? { ...u, color } : u))
    );
  };

  // Initialize profile name when users change
  useEffect(() => {
    if (users.length > 0) {
      setProfileName(users[0].name);
    }
  }, [users]);

  const getColorCode = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      red: "#ef4444",
      orange: "#f97316",
      amber: "#f59e0b",
      yellow: "#eab308",
      lime: "#84cc16",
      green: "#22c55e",
      emerald: "#10b981",
      teal: "#14b8a6",
      cyan: "#06b6d4",
      blue: "#3b82f6",
      indigo: "#6366f1",
      violet: "#8b5cf6",
      purple: "#a855f7",
      fuchsia: "#d946ef",
      pink: "#ec4899",
      rose: "#f43f5e",
    };
    return colorMap[colorName] || "#6b7280";
  };

  const renderMainPage = () => (
    <>
      <View style={styles.card}>
        <SettingsItem
          icon="person"
          label="프로필 편집"
          onPress={() => setPage("account")}
        />
        <SettingsItem
          icon="local-offer"
          label="태그 설정"
          onPress={() => setPage("tags")}
        />
        <SettingsItem
          icon="notifications"
          label="알림 설정"
          onPress={() => setPage("notifications")}
        />
        <SettingsItem
          icon="security"
          label="개인정보처리방침"
          onPress={() => setPage("privacy")}
          isLast={true}
        />
      </View>

      <View style={styles.card}>
        <Pressable style={styles.logoutButton}>
          <MaterialIcons name="logout" size={24} color="#dc2626" />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>
    </>
  );

  const renderSubPage = (title: string, children: React.ReactNode) => (
    <View style={styles.profileEditContainer}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setPage("main")}>
          <MaterialIcons name="close" size={28} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.profileHeaderTitle}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}>
        {children}
      </ScrollView>
    </View>
  );

  const renderAccountPage = () => {
    const currentUser = users[0];

    const handleSaveProfile = () => {
      if (currentUser) {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === currentUser.id ? { ...u, name: profileName } : u
          )
        );
      }
      setPage("main");
    };

    return (
      <View style={styles.profileEditContainer}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setPage("main")}>
            <MaterialIcons name="close" size={28} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.profileHeaderTitle}>프로필 편집</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
        >
          {/* Profile Picture */}
          <View style={styles.profilePictureSection}>
            <TouchableOpacity onPress={() => setShowImagePicker(true)}>
              <View style={styles.profilePicturePlaceholder}>
                <Image
                  source={{ uri: currentUser?.avatarUrl }}
                  style={styles.profilePicture}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Name */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>이름</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.formInput}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor="#9ca3af"
                />
                {profileName.length > 0 && (
                  <TouchableOpacity onPress={() => setProfileName("")}>
                    <View style={styles.clearButton}>
                      <MaterialIcons name="close" size={12} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Status Message */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>한마디</Text>
              <TextInput
                style={styles.formInput}
                value={statusMessage}
                onChangeText={setStatusMessage}
                placeholder="한마디를 입력하세요"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Birth Date */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>생년월일</Text>
              <Pressable
                style={styles.formInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {birthDate
                    ? dayjs(birthDate).format("YYYY년 M월 D일")
                    : "날짜를 선택(임의)"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Toggle: Show in Calendar */}
          <View style={styles.formSection}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>캘린더에서 보기</Text>
              <Switch
                value={showInCalendar}
                onValueChange={setShowInCalendar}
                trackColor={{ false: "#d1d5db", true: "#10b981" }}
                thumbColor="#fff"
              />
            </View>

            {/* Registration Info */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>등록 정보</Text>
              <MaterialIcons name="info-outline" size={20} color="#6b7280" />
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.formSection}>
            <TouchableOpacity
              style={styles.saveButtonContainer}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveButtonText}>저장</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderPage = () => {
    switch (page) {
      case "main":
        return renderMainPage();
      case "account":
        return renderAccountPage();
      case "tags":
        return renderSubPage(
          "태그 설정",
          <View style={styles.formSection}>
            {users.map((user, index) => {
              const userColorName =
                availableColors.find((c) => c.name === user.color)
                  ?.koreanName || user.color;
              return (
                <Pressable
                  key={user.id}
                  style={[
                    styles.colorRowPressable,
                    index === users.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleOpenColorPicker(user.id)}
                >
                  <View style={styles.userInfo}>
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={styles.avatar}
                    />
                    <Text style={styles.userName}>{user.name}</Text>
                  </View>
                  <View style={styles.colorDisplay}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: getColorCode(user.color) },
                      ]}
                    />
                    <Text style={styles.colorName}>{userColorName}</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color="#9ca3af"
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      case "notifications":
        return renderSubPage(
          "알림 설정",
          <View style={styles.formSection}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>일정 알림</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#d1d5db", true: "#10b981" }}
                thumbColor="#fff"
              />
            </View>
          </View>
        );
      case "privacy":
        return renderSubPage(
          "개인정보처리방침",
          <View style={styles.formSection}>
            <Text style={styles.placeholder}>
              개인정보처리방침 설정이 곧 제공됩니다.
            </Text>
          </View>
        );
      default:
        return renderMainPage();
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {/* <Text style={styles.title}>Settings</Text> */}
        {renderPage()}
      </ScrollView>

      {/* Color Picker Bottom Sheet */}
      <BottomSheet
        ref={colorBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>
              {selectedUserId
                ? users.find((u) => u.id === selectedUserId)?.name
                : "개인"}
            </Text>
          </View>
          <ScrollView
            style={styles.bottomSheetList}
            contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
          >
            {availableColors.map((colorOption) => (
              <Pressable
                key={colorOption.name}
                style={styles.colorOptionItem}
                onPress={() => handleColorSelect(colorOption.name)}
              >
                <View
                  style={[
                    styles.colorSwatchSmall,
                    { backgroundColor: getColorCode(colorOption.name) },
                  ]}
                />
                <Text style={styles.colorOptionText}>
                  {colorOption.koreanName}
                </Text>
                {selectedUserId &&
                users.find((u) => u.id === selectedUserId)?.color ===
                  colorOption.name ? (
                  <MaterialIcons name="check" size={24} color="#10b981" />
                ) : (
                  <MaterialIcons name="check" size={24} color="transparent" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalCancelButton}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>생년월일 선택</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.modalConfirmButton}>확인</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={birthDate || new Date()}
              mode="date"
              display="spinner"
              onChange={(selectedDate) => {
                setBirthDate(selectedDate as Date);
              }}
              locale="ko-KR"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const SettingsItem: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}> = ({ icon, label, onPress, isLast }) => (
  <Pressable
    onPress={onPress}
    style={[styles.settingsItem, !isLast && styles.settingsItemBorder]}
  >
    <View style={styles.iconContainer}>
      <MaterialIcons
        name={icon as keyof typeof MaterialIcons.glyphMap}
        size={24}
        color="#6b7280"
      />
    </View>
    <Text style={styles.settingsItemText}>{label}</Text>
    <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 24,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  settingsItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    color: "#dc2626",
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#dc2626",
    marginLeft: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginLeft: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 40,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  colorsSection: {
    gap: 16,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  colorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColor: {
    borderColor: "#3b82f6",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  colorRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colorDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  colorSwatchSmall: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  colorName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetHandle: {
    backgroundColor: "#9ca3af",
    width: 40,
    height: 4,
    marginTop: 12,
    marginBottom: 8,
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
  colorOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colorOptionText: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
  },
  profileEditContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  profileHeaderTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1f2937",
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: 40,
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 100,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editPictureButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editPictureText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  formSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  formField: {
    marginBottom: 28,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 12,
    backgroundColor: "#6b7280",
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontSize: 16,
    color: "#374151",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginTop: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  saveButtonContainer: {
    backgroundColor: "#10b981",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "88%",
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  modalCancelButton: {
    fontSize: 16,
    color: "#6b7280",
  },
  modalConfirmButton: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10b981",
  },
});

export default SettingsView;
