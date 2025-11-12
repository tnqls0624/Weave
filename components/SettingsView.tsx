import { MaterialIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
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
import { apiService } from "../services/api";
import locationTrackingService from "../services/locationTrackingService";
import {
  useUpdateNotifications,
  useUpdateParticipantColors,
} from "../services/queries";
import { useAppStore } from "../stores";
import { User } from "../types";
import MonthDayPicker from "./MonthDayPicker";

interface SettingsViewProps {
  users: User[];
  currentUser?: User; // 로그인한 사용자
  workspaceId: string; // 워크스페이스 ID
  onUpdateUser: (userId: string, userData: Partial<User>) => Promise<void>;
  onLogout?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  users,
  currentUser,
  workspaceId,
  onUpdateUser,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const { settingsPage, setSettingsPage } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    currentUser?.pushEnabled ?? true
  );
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(
    locationTrackingService.isTracking()
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const updateParticipantColorsMutation = useUpdateParticipantColors();
  const isUpdatingColors = updateParticipantColorsMutation.isPending;

  const updateNotificationsMutation = useUpdateNotifications();

  const [profileName, setProfileName] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const formattedBirthDate = useMemo(() => {
    if (!birthDate || birthDate.length !== 4) return null;
    const month = Number.parseInt(birthDate.slice(0, 2), 10);
    const day = Number.parseInt(birthDate.slice(2, 4), 10);
    if (Number.isNaN(month) || Number.isNaN(day)) return null;
    return `${month}월 ${day}일`;
  }, [birthDate]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const colorBottomSheetRef = useRef<BottomSheet>(null);
  const imagePickerBottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%"], []);
  const imagePickerSnapPoints = useMemo(() => ["35%"], []);

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

  const handleColorChange = async (userId: string, colorName: string) => {
    try {
      // 현재 워크스페이스의 모든 사용자 색상을 hex 코드로 변환하여 준비
      const participantColors: Record<string, string> = {};
      users.forEach((user) => {
        const userColorName = user.id === userId ? colorName : user.color;
        participantColors[user.id] = getColorCode(userColorName);
      });

      // mutation이 완료될 때까지 기다림 (캐시 무효화 포함)
      await updateParticipantColorsMutation.mutateAsync({
        workspaceId,
        participantColors,
      });
    } catch (error) {
      console.error("❌ [Color Update] Failed:", error);
      Alert.alert("오류", "색상 업데이트에 실패했습니다.");
    }
  };

  const handleOpenImagePicker = () => {
    imagePickerBottomSheetRef.current?.expand();
  };

  const handleImagePickerOption = async (option: "camera" | "gallery") => {
    imagePickerBottomSheetRef.current?.close();

    try {
      let result: ImagePicker.ImagePickerResult;

      if (option === "camera") {
        // 카메라 권한 요청
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert("권한 필요", "카메라 권한이 필요합니다.");
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // 갤러리 권한 요청
        const mediaPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다.");
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        await uploadAndUpdateAvatar(imageUri);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("오류", "이미지를 선택하는 중 오류가 발생했습니다.");
    }
  };

  const uploadAndUpdateAvatar = async (imageUri: string) => {
    if (!currentUser) return;

    setIsUploadingImage(true);
    try {
      // 1. 이미지 업로드
      const avatarUrl = await apiService.uploadProfileImage(imageUri);

      // 2. 사용자 프로필 업데이트
      await onUpdateUser(currentUser.id, { avatarUrl });

      Alert.alert("성공", "프로필 사진이 업데이트되었습니다.");
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      Alert.alert("오류", "프로필 사진 업로드에 실패했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setBirthDate(currentUser.birthday ?? null);
    }
  }, [currentUser, users]);

  const getColorCode = (colorName: string) => {
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
  };

  const renderMainPage = () => (
    <>
      <View style={styles.card}>
        <SettingsItem
          icon="person"
          label="프로필 편집"
          onPress={() => setSettingsPage("account")}
        />
        <SettingsItem
          icon="local-offer"
          label="태그 설정"
          onPress={() => setSettingsPage("tags")}
        />
        <SettingsItem
          icon="notifications"
          label="알림 설정"
          onPress={() => setSettingsPage("notifications")}
        />
        <SettingsItem
          icon="security"
          label="개인정보처리방침"
          onPress={() => setSettingsPage("privacy")}
          isLast={true}
        />
      </View>

      <View style={styles.card}>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <MaterialIcons name="logout" size={24} color="#dc2626" />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>
    </>
  );

  const renderSubPage = (title: string, children: React.ReactNode) => (
    <View style={styles.profileEditContainer}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setSettingsPage("main")}>
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
    const user = currentUser || users[0];

    const handleSaveProfile = async () => {
      if (user) {
        try {
          const data = {
            name: profileName,
            birthday: birthDate ?? undefined,
          };
          await onUpdateUser(user.id, data);
          Alert.alert("성공", "프로필이 업데이트되었습니다.");
          // setSettingsPage("main");
        } catch (error) {
          console.error("Failed to update profile:", error);
          Alert.alert("오류", "프로필 업데이트에 실패했습니다.");
        }
      }
    };

    return (
      <View style={styles.profileEditContainer}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setSettingsPage("main")}>
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
            <TouchableOpacity
              onPress={handleOpenImagePicker}
              disabled={isUploadingImage}
            >
              <View style={styles.profilePicturePlaceholder}>
                {isUploadingImage ? (
                  <ActivityIndicator size="large" color="#007AFF" />
                ) : (
                  <>
                    <Image
                      source={{ uri: user?.avatarUrl }}
                      style={styles.profilePicture}
                    />
                    <View style={styles.cameraIconOverlay}>
                      <MaterialIcons name="camera-alt" size={24} color="#fff" />
                    </View>
                  </>
                )}
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
            {/* <View style={styles.formField}>
              <Text style={styles.formLabel}>한마디</Text>
              <TextInput
                style={styles.formInput}
                value={statusMessage}
                onChangeText={setStatusMessage}
                placeholder="한마디를 입력하세요"
                placeholderTextColor="#9ca3af"
              />
            </View> */}

            {/* Birth Date */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>생일</Text>
              <Pressable
                style={styles.formInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {formattedBirthDate ?? "생일을 선택하세요"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* <View style={styles.formSection}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>캘린더에서 보기</Text>
              <Switch
                value={showInCalendar}
                onValueChange={setShowInCalendar}
                trackColor={{ false: "#d1d5db", true: "#007AFF" }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>등록 정보</Text>
              <MaterialIcons name="info-outline" size={20} color="#6b7280" />
            </View>
          </View> */}

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
    switch (settingsPage) {
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
                    isUpdatingColors && styles.disabledPressable,
                  ]}
                  onPress={() =>
                    !isUpdatingColors && handleOpenColorPicker(user.id)
                  }
                  disabled={isUpdatingColors}
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
          "알림 및 위치 설정",
          <View style={styles.formSection}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>푸시 알림</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={async (value) => {
                  setNotificationsEnabled(value);
                  try {
                    await updateNotificationsMutation.mutateAsync(value);
                  } catch (error) {
                    console.error("Failed to update notifications:", error);
                    // 실패 시 원래 값으로 되돌림
                    setNotificationsEnabled(!value);
                    Alert.alert("오류", "알림 설정 업데이트에 실패했습니다.");
                  }
                }}
                trackColor={{ false: "#d1d5db", true: "#007AFF" }}
                thumbColor="#fff"
                disabled={updateNotificationsMutation.isPending}
              />
            </View>

            <View style={styles.toggleContainer}>
              <View style={styles.toggleLabelContainer}>
                <Text style={styles.toggleLabel}>위치 공유</Text>
                <Text style={styles.toggleDescription}>
                  실시간으로 워크스페이스 멤버들과 위치 공유
                </Text>
              </View>
              <Switch
                value={locationSharingEnabled}
                onValueChange={async (value) => {
                  setLocationSharingEnabled(value);
                  try {
                    if (value) {
                      // 위치 공유 시작
                      const success =
                        await locationTrackingService.startForegroundTracking(
                          workspaceId,
                          30000 // 30초마다 업데이트
                        );
                      if (!success) {
                        setLocationSharingEnabled(false);
                        Alert.alert(
                          "위치 권한 필요",
                          "위치 공유를 사용하려면 위치 권한이 필요합니다. 설정에서 권한을 허용해주세요."
                        );
                      }
                    } else {
                      // 위치 공유 중지
                      await locationTrackingService.stopTracking();
                    }
                  } catch (error) {
                    console.error("Failed to toggle location sharing:", error);
                    setLocationSharingEnabled(!value);
                    Alert.alert("오류", "위치 공유 설정에 실패했습니다.");
                  }
                }}
                trackColor={{ false: "#d1d5db", true: "#007AFF" }}
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

      {/* Loading Overlay - 기존 UI 위에 회색 반투명 레이어 */}
      {isUpdatingColors && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

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
                  <MaterialIcons name="check" size={24} color="#007AFF" />
                ) : (
                  <MaterialIcons name="check" size={24} color="transparent" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>

      {/* Image Picker Bottom Sheet */}
      <BottomSheet
        ref={imagePickerBottomSheetRef}
        index={-1}
        snapPoints={imagePickerSnapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>프로필 사진 변경</Text>
          </View>
          <View
            style={[
              styles.imagePickerOptions,
              { paddingBottom: insets.bottom + 20 },
            ]}
          >
            <Pressable
              style={styles.imagePickerOption}
              onPress={() => handleImagePickerOption("camera")}
            >
              <MaterialIcons name="camera-alt" size={24} color="#374151" />
              <Text style={styles.imagePickerOptionText}>카메라로 촬영</Text>
            </Pressable>
            <Pressable
              style={[styles.imagePickerOption, { borderBottomWidth: 0 }]}
              onPress={() => handleImagePickerOption("gallery")}
            >
              <MaterialIcons name="photo-library" size={24} color="#374151" />
              <Text style={styles.imagePickerOptionText}>갤러리에서 선택</Text>
            </Pressable>
          </View>
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
            <MonthDayPicker
              value={birthDate ?? undefined}
              onChange={setBirthDate}
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
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(128, 128, 128, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
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
    borderColor: "#007AFF",
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
  disabledPressable: {
    opacity: 0.5,
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
  cameraIconOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
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
  imagePickerOptions: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  imagePickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  imagePickerOptionText: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 12,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  saveButtonContainer: {
    backgroundColor: "#007AFF",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#007AFF",
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
    color: "#007AFF",
  },
});

export default SettingsView;
