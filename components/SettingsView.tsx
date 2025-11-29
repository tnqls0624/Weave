import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RenderHtml from "react-native-render-html";
import { apiService } from "../services/api";
import locationTrackingService from "../services/locationTrackingService";
import {
  useUpdateNotifications,
  useUpdateParticipantColors,
} from "../services/queries";
import { useAppStore } from "../stores";
import { User } from "../types";
import MonthDayPicker from "./MonthDayPicker";

// 개인정보처리방침 페이지 컴포넌트
const PrivacyPolicyPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/policy/privacy`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        // body 태그 내용만 추출
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const bodyContent = bodyMatch ? bodyMatch[1] : text;
        setHtml(bodyContent);
      } catch (err) {
        console.error("Failed to fetch privacy policy:", err);
        setError("개인정보처리방침을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrivacyPolicy();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={privacyStyles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={privacyStyles.headerTitle}>개인정보처리방침</Text>
        <View style={{ width: 24 }} />
      </View>
      {error ? (
        <View style={privacyStyles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={privacyStyles.errorText}>{error}</Text>
        </View>
      ) : html ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <RenderHtml
            contentWidth={width - 32}
            source={{ html }}
            tagsStyles={{
              body: { color: "#333", fontSize: 15, lineHeight: 24 },
              h1: { fontSize: 22, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 },
              h2: { fontSize: 18, fontWeight: "600", color: "#1a1a1a", marginTop: 24, marginBottom: 12 },
              h3: { fontSize: 16, fontWeight: "600", color: "#333", marginTop: 16, marginBottom: 8 },
              p: { marginBottom: 12 },
              li: { marginBottom: 6 },
            }}
          />
        </ScrollView>
      ) : null}
    </View>
  );
};

const privacyStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },
});

interface SettingsViewProps {
  users: User[];
  currentUser?: User;
  workspaceId: string;
  scheduleCount: number;
  schedulesLoading?: boolean;
  onUpdateUser: (userId: string, userData: Partial<User>) => Promise<void>;
  onLogout?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  users,
  currentUser,
  workspaceId,
  scheduleCount,
  schedulesLoading,
  onUpdateUser,
  onLogout,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settingsPage, setSettingsPage } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    currentUser?.pushEnabled ?? true
  );
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(
    currentUser?.locationEnabled ?? false
  );
  // TEMPORARILY DISABLED - Security features
  // const [phishingGuardEnabled, setPhishingGuardEnabled] = useState(
  //   currentUser?.phishingGuardEnabled ?? false
  // );
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
      const participantColors: Record<string, string> = {};
      users.forEach((user) => {
        const userColorName = user.id === userId ? colorName : user.color;
        participantColors[user.id] = getColorCode(userColorName);
      });

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
      const avatarUrl = await apiService.uploadProfileImage(imageUri);
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
      setNotificationsEnabled(currentUser.pushEnabled ?? true);
      setLocationSharingEnabled(currentUser.locationEnabled ?? false);
      // TEMPORARILY DISABLED - Security features
      // setPhishingGuardEnabled(currentUser.phishingGuardEnabled ?? false);
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

  // TEMPORARILY DISABLED - Security features
  // const handlePhishingGuardToggle = async (value: boolean) => {
  //   try {
  //     setPhishingGuardEnabled(value);
  //     await apiService.updateProfile({
  //       phishingGuardEnabled: value,
  //     });
  //   } catch (error) {
  //     console.error("Failed to update phishing guard:", error);
  //     setPhishingGuardEnabled(!value);
  //     Alert.alert("오류", "피싱 가드 설정 업데이트에 실패했습니다.");
  //   }
  // };

  const renderMainPage = () => (
    <>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <TouchableOpacity
          style={styles.profileContent}
          onPress={() => setSettingsPage("account")}
        >
          <View style={styles.profileAvatarContainer}>
            <Image
              source={{ uri: currentUser?.avatarUrl }}
              style={styles.profileAvatar}
            />
            <View style={styles.profileEditBadge}>
              <Ionicons name="create" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser?.name}</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.sectionHeaderText}>워크스페이스 현황</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View
              style={[styles.statIconContainer, { backgroundColor: "#EFF6FF" }]}
            >
              <Ionicons name="people" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{users.length}</Text>
            <Text style={styles.statLabel}>멤버</Text>
          </View>
          <View style={styles.statItem}>
            <View
              style={[styles.statIconContainer, { backgroundColor: "#F0FDF4" }]}
            >
              <Ionicons name="calendar" size={24} color="#22C55E" />
            </View>
            {schedulesLoading ? (
              <ActivityIndicator size="small" color="#22C55E" />
            ) : (
              <Text style={styles.statValue}>{scheduleCount}</Text>
            )}
            <Text style={styles.statLabel}>일정</Text>
          </View>
          {/* TEMPORARILY DISABLED - Security features */}
          {/* <View style={styles.statItem}>
            <View
              style={[styles.statIconContainer, { backgroundColor: "#FEF3C7" }]}
            >
              <Ionicons name="shield-checkmark" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>
              {phishingGuardEnabled ? "ON" : "OFF"}
            </Text>
            <Text style={styles.statLabel}>피싱가드</Text>
          </View> */}
        </View>
      </View>

      {/* Quick Toggles */}
      {/* <View style={styles.card}>
        <Text style={styles.sectionHeaderText}>빠른 설정</Text>
        <View style={styles.quickToggleContainer}>
          <View style={styles.quickToggleItem}>
            <View style={styles.quickToggleIcon}>
              <Ionicons
                name="notifications"
                size={20}
                color={notificationsEnabled ? "#3B82F6" : "#9CA3AF"}
              />
            </View>
            <Text style={styles.quickToggleLabel}>푸시 알림</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={async (value) => {
                setNotificationsEnabled(value);
                try {
                  await updateNotificationsMutation.mutateAsync({
                    pushEnabled: value,
                    fcmToken: currentUser?.fcmToken,
                  });
                } catch (error) {
                  setNotificationsEnabled(!value);
                  Alert.alert("오류", "알림 설정 업데이트에 실패했습니다.");
                }
              }}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={notificationsEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>

          <View style={[styles.quickToggleItem, { borderBottomWidth: 0 }]}>
            <View style={styles.quickToggleIcon}>
              <Ionicons
                name="location"
                size={20}
                color={locationSharingEnabled ? "#3B82F6" : "#9CA3AF"}
              />
            </View>
            <Text style={styles.quickToggleLabel}>위치 공유</Text>
            <Switch
              value={locationSharingEnabled}
              onValueChange={async (value) => {
                setLocationSharingEnabled(value);
                try {
                  await apiService.updateLocationSharing(value);
                  if (value) {
                    await locationTrackingService.startForegroundTracking(
                      workspaceId,
                      30000
                    );
                  } else {
                    await locationTrackingService.stopTracking();
                  }
                } catch (error) {
                  setLocationSharingEnabled(!value);
                  Alert.alert("오류", "위치 공유 설정에 실패했습니다.");
                }
              }}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={locationSharingEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>

          <View style={[styles.quickToggleItem, { borderBottomWidth: 0 }]}>
            <View style={styles.quickToggleIcon}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={phishingGuardEnabled ? "#3B82F6" : "#9CA3AF"}
              />
            </View>
            <Text style={styles.quickToggleLabel}>피싱 가드</Text>
            <Switch
              value={phishingGuardEnabled}
              onValueChange={handlePhishingGuardToggle}
              trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
              thumbColor={phishingGuardEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>
        </View>
      </View> */}

      {/* App Settings */}
      <View style={styles.card}>
        <Text style={styles.sectionHeaderText}>앱 설정</Text>
        <SettingsItem
          icon="person-outline"
          label="프로필 편집"
          description="이름, 프로필 사진, 생일"
          onPress={() => setSettingsPage("account")}
          iconColor="#3B82F6"
          iconBg="#EFF6FF"
        />
        <SettingsItem
          icon="pricetag-outline"
          label="태그 설정"
          description="멤버별 색상 태그 관리"
          onPress={() => setSettingsPage("tags")}
          iconColor="#8B5CF6"
          iconBg="#F5F3FF"
        />
        <SettingsItem
          icon="notifications-outline"
          label="알림 및 위치"
          description="푸시 알림 및 위치 공유 설정"
          onPress={() => setSettingsPage("notifications")}
          iconColor="#F59E0B"
          iconBg="#FEF3C7"
          isLast={true}
        />
        {/* TEMPORARILY DISABLED - Security features */}
        {/* <SettingsItem
          icon="shield-checkmark-outline"
          label="피싱 가드"
          description="SMS 피싱 탐지 및 차단 설정"
          onPress={() => router.push("/phishing-settings")}
          iconColor="#EF4444"
          iconBg="#FEE2E2"
          isLast={true}
        /> */}
      </View>

      {/* Support */}
      <View style={styles.card}>
        <Text style={styles.sectionHeaderText}>지원</Text>
        <SettingsItem
          icon="document-text-outline"
          label="개인정보처리방침"
          description="개인정보 보호 정책"
          onPress={() => setSettingsPage("privacy")}
          iconColor="#6B7280"
          iconBg="#F3F4F6"
        />
        <SettingsItem
          icon="information-circle-outline"
          label="앱 정보"
          description={`버전 ${Constants.expoConfig?.version ?? "1.0.0"}`}
          onPress={() => {}}
          iconColor="#6B7280"
          iconBg="#F3F4F6"
          isLast={true}
          hideChevron={true}
        />
      </View>

      {/* Logout & Delete Account */}
      <View style={styles.card}>
        <Pressable style={[styles.logoutButton, styles.settingsItemBorder]} onPress={onLogout}>
          <View style={[styles.settingIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </View>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              "회원 탈퇴",
              "정말로 탈퇴하시겠습니까?\n\n탈퇴하면 모든 데이터가 삭제되며 복구할 수 없습니다.",
              [
                { text: "취소", style: "cancel" },
                {
                  text: "탈퇴하기",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert(
                      "최종 확인",
                      "모든 일정, 워크스페이스 참여 정보가 삭제됩니다.\n\n정말 탈퇴하시겠습니까?",
                      [
                        { text: "취소", style: "cancel" },
                        {
                          text: "탈퇴",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiService.deleteAccount();
                              Alert.alert("탈퇴 완료", "회원 탈퇴가 완료되었습니다.", [
                                {
                                  text: "확인",
                                  onPress: () => {
                                    onLogout?.();
                                  },
                                },
                              ]);
                            } catch (error) {
                              console.error("Failed to delete account:", error);
                              Alert.alert("오류", "회원 탈퇴에 실패했습니다. 다시 시도해주세요.");
                            }
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          }}
        >
          <View style={[styles.settingIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </View>
          <Text style={styles.logoutText}>회원 탈퇴</Text>
        </Pressable>
      </View>
    </>
  );

  const renderSubPage = (title: string, children: React.ReactNode, noScroll?: boolean) => (
    <View style={styles.profileEditContainer}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setSettingsPage("main")}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.profileHeaderTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {noScroll ? (
        <View style={{ flex: 1 }}>{children}</View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}>
          {children}
        </ScrollView>
      )}
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
        } catch (error) {
          console.error("Failed to update profile:", error);
          Alert.alert("오류", "프로필 업데이트에 실패했습니다.");
        }
      }
    };

    return (
      <View style={styles.settingsSubPage}>
        {/* Header */}
        <View style={styles.subPageHeaderBar}>
          <TouchableOpacity
            onPress={() => setSettingsPage("main")}
            style={styles.subPageBackButton}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.subPageTitle}>프로필 편집</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.settingsScrollView}
          contentContainerStyle={{
            paddingBottom: 64 + insets.bottom,
            flexGrow: 1,
          }}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture Card */}
          <View style={styles.settingsCard}>
            <TouchableOpacity
              onPress={handleOpenImagePicker}
              disabled={isUploadingImage}
              style={styles.profileImageSection}
            >
              <View style={styles.profilePicturePlaceholder}>
                {isUploadingImage ? (
                  <ActivityIndicator size="large" color="#3B82F6" />
                ) : (
                  <>
                    <Image
                      source={{ uri: user?.avatarUrl }}
                      style={styles.profilePicture}
                    />
                    <View style={styles.cameraIconOverlay}>
                      <Ionicons name="camera" size={20} color="#fff" />
                    </View>
                  </>
                )}
              </View>
              <Text style={styles.profileImageHint}>
                탭하여 프로필 사진 변경
              </Text>
            </TouchableOpacity>
          </View>

          {/* Basic Info Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>기본 정보</Text>

            {/* Name */}
            <View style={styles.settingsRow}>
              <Text style={styles.settingsRowLabel}>이름</Text>
              <View style={styles.settingsInputWrapper}>
                <TextInput
                  style={styles.settingsInput}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor="#9CA3AF"
                />
                {profileName.length > 0 && (
                  <TouchableOpacity onPress={() => setProfileName("")}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Birth Date */}
            <Pressable
              style={[styles.settingsRow, { borderBottomWidth: 0 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.settingsRowLabel}>생일</Text>
              <View style={styles.settingsValueRow}>
                <Text
                  style={[
                    styles.settingsRowValue,
                    !formattedBirthDate && { color: "#9CA3AF" },
                  ]}
                >
                  {formattedBirthDate ?? "선택하세요"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </Pressable>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveProfile}
          >
            <Text style={styles.primaryButtonText}>저장</Text>
          </TouchableOpacity>
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
        return (
          <View style={styles.settingsSubPage}>
            {/* Header */}
            <View style={styles.subPageHeaderBar}>
              <TouchableOpacity
                onPress={() => setSettingsPage("main")}
                style={styles.subPageBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.subPageTitle}>태그 설정</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              style={styles.settingsScrollView}
              contentContainerStyle={{
                paddingBottom: 64 + insets.bottom,
                flexGrow: 1,
              }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#8B5CF6" />
                <Text style={styles.infoText}>
                  각 멤버의 일정을 구분할 색상을 선택하세요
                </Text>
              </View>

              {/* Members Card */}
              <View style={styles.settingsCard}>
                <Text style={styles.cardTitle}>멤버별 색상 태그</Text>

                {users.map((user, index) => {
                  const userColorName =
                    availableColors.find((c) => c.name === user.color)
                      ?.koreanName || user.color;
                  return (
                    <Pressable
                      key={user.id}
                      style={[
                        styles.settingsRow,
                        index === users.length - 1 && { borderBottomWidth: 0 },
                        isUpdatingColors && styles.disabledPressable,
                      ]}
                      onPress={() =>
                        !isUpdatingColors && handleOpenColorPicker(user.id)
                      }
                      disabled={isUpdatingColors}
                    >
                      <View style={styles.userRowContent}>
                        <Image
                          source={{ uri: user.avatarUrl }}
                          style={styles.userAvatar}
                        />
                        <Text style={styles.settingsRowLabel}>{user.name}</Text>
                      </View>
                      <View style={styles.colorValueRow}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: getColorCode(user.color) },
                          ]}
                        />
                        <Text style={styles.settingsRowValue}>
                          {userColorName}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#9CA3AF"
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      case "notifications":
        return (
          <View style={styles.settingsSubPage}>
            {/* Header */}
            <View style={styles.subPageHeaderBar}>
              <TouchableOpacity
                onPress={() => setSettingsPage("main")}
                style={styles.subPageBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.subPageTitle}>알림 및 위치</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.settingsContent}>
              {/* Notifications Card */}
              <View style={styles.settingsCard}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.cardIconBg, { backgroundColor: "#EFF6FF" }]}
                  >
                    <Ionicons name="notifications" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.cardTitle}>알림 설정</Text>
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>푸시 알림</Text>
                    <Text style={styles.toggleDescription}>
                      일정 및 중요 알림 수신
                    </Text>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={async (value) => {
                      setNotificationsEnabled(value);
                      try {
                        await updateNotificationsMutation.mutateAsync({
                          pushEnabled: value,
                          fcmToken: currentUser?.fcmToken,
                        });
                      } catch (error) {
                        console.error("Failed to update notifications:", error);
                        setNotificationsEnabled(!value);
                        Alert.alert(
                          "오류",
                          "알림 설정 업데이트에 실패했습니다."
                        );
                      }
                    }}
                    trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={notificationsEnabled ? "#3B82F6" : "#F3F4F6"}
                    disabled={updateNotificationsMutation.isPending}
                  />
                </View>
              </View>

              {/* Location Card */}
              <View style={styles.settingsCard}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.cardIconBg, { backgroundColor: "#F0FDF4" }]}
                  >
                    <Ionicons name="location" size={20} color="#22C55E" />
                  </View>
                  <Text style={styles.cardTitle}>위치 설정</Text>
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
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
                        await apiService.updateLocationSharing(value);

                        if (value) {
                          // 백그라운드 추적 시작 (실시간 위치 공유)
                          const success =
                            await locationTrackingService.startBackgroundTracking(
                              workspaceId
                            );
                          if (!success) {
                            setLocationSharingEnabled(false);
                            await apiService.updateLocationSharing(false);
                            Alert.alert(
                              "위치 권한 필요",
                              "위치 공유를 사용하려면 백그라운드 위치 권한이 필요합니다."
                            );
                          }
                        } else {
                          await locationTrackingService.stopTracking();
                        }
                      } catch (error) {
                        console.error(
                          "Failed to toggle location sharing:",
                          error
                        );
                        setLocationSharingEnabled(!value);
                        Alert.alert("오류", "위치 공유 설정에 실패했습니다.");
                      }
                    }}
                    trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                    thumbColor={locationSharingEnabled ? "#3B82F6" : "#F3F4F6"}
                  />
                </View>

                {/* Debug Button - 백그라운드 태스크 상태 확인 */}
                {/* <TouchableOpacity
                  style={styles.debugButton}
                  onPress={async () => {
                    try {
                      const status = await locationTrackingService.getBackgroundTaskStatus();
                      Alert.alert(
                        "백그라운드 태스크 상태",
                        `Task Defined: ${status.isTaskDefined ? "✅" : "❌"}\n` +
                        `Task Registered: ${status.isTaskRegistered ? "✅" : "❌"}\n` +
                        `Update Count: ${status.updateCount}\n` +
                        `Workspace ID: ${status.workspaceId || "None"}\n\n` +
                        "자세한 내용은 콘솔 로그를 확인하세요."
                      );
                    } catch (error) {
                      Alert.alert("오류", "상태 확인에 실패했습니다.");
                    }
                  }}
                >
                  <Ionicons name="bug-outline" size={16} color="#6B7280" />
                  <Text style={styles.debugButtonText}>
                    백그라운드 태스크 상태 확인 (디버그)
                  </Text>
                </TouchableOpacity> */}
              </View>
            </View>
          </View>
        );
      case "privacy":
        return <PrivacyPolicyPage onBack={() => setSettingsPage("main")} />;
      default:
        return renderMainPage();
    }
  };

  // privacy 페이지는 ScrollView 밖에서 렌더링 (flex: 1 필요)
  if (settingsPage === "privacy") {
    return (
      <>
        <PrivacyPolicyPage onBack={() => setSettingsPage("main")} />
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: 80 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {renderPage()}
      </ScrollView>

      {isUpdatingColors && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#3B82F6" />
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
                  <Ionicons name="checkmark" size={24} color="#3B82F6" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="transparent" />
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
              <Ionicons name="camera" size={24} color="#374151" />
              <Text style={styles.imagePickerOptionText}>카메라로 촬영</Text>
            </Pressable>
            <Pressable
              style={[styles.imagePickerOption, { borderBottomWidth: 0 }]}
              onPress={() => handleImagePickerOption("gallery")}
            >
              <Ionicons name="images" size={24} color="#374151" />
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
  description?: string;
  onPress: () => void;
  iconColor?: string;
  iconBg?: string;
  isLast?: boolean;
  hideChevron?: boolean;
}> = ({
  icon,
  label,
  description,
  onPress,
  iconColor = "#6B7280",
  iconBg = "#F3F4F6",
  isLast,
  hideChevron,
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.settingsItem, !isLast && styles.settingsItemBorder]}
  >
    <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={24} color={iconColor} />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingsItemText}>{label}</Text>
      {description && (
        <Text style={styles.settingsItemDescription}>{description}</Text>
      )}
    </View>
    {!hideChevron && (
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    // paddingHorizontal: 16,
    paddingTop: 16,
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
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  profileAvatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickToggleContainer: {
    marginTop: 4,
  },
  quickToggleItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  quickToggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickToggleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingsItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  settingsItemDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  profileEditContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#FFFFFF",
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  formSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  formInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 15,
    color: "#374151",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontSize: 15,
    color: "#374151",
  },
  saveButtonContainer: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 40,
    lineHeight: 22,
  },
  colorRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  disabledPressable: {
    opacity: 0.5,
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
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  colorDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  colorSwatchSmall: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  colorName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetHandle: {
    backgroundColor: "#D1D5DB",
    width: 40,
    height: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
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
    borderBottomColor: "#F3F4F6",
  },
  colorOptionText: {
    flex: 1,
    fontSize: 15,
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
    borderBottomColor: "#F3F4F6",
  },
  imagePickerOptionText: {
    fontSize: 15,
    color: "#374151",
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalCancelButton: {
    fontSize: 15,
    color: "#9CA3AF",
  },
  modalConfirmButton: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3B82F6",
  },
  // New Subpage Styles
  subPageContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  subPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  subPageHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  subPageScroll: {
    flex: 1,
  },
  subPageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  cardSectionDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  profilePictureContainer: {
    alignItems: "center",
  },
  profilePictureHint: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
  },
  placeholderText: {
    color: "#9CA3AF",
  },
  subPageButtonContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  // Settings SubPage Styles (Consistent with Main Settings)
  settingsSubPage: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  subPageHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  subPageBackButton: {
    padding: 4,
  },
  subPageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  settingsScrollView: {
    flex: 1,
    paddingTop: 16,
  },
  settingsContent: {
    flex: 1,
    paddingTop: 16,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  profileImageSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  profileImageHint: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 12,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingsRowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  settingsRowValue: {
    fontSize: 15,
    color: "#6B7280",
    marginRight: 8,
  },
  settingsInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginLeft: 16,
  },
  settingsInput: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    textAlign: "right",
    paddingVertical: 0,
  },
  settingsValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userRowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  colorValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // iOS Native Styles (kept for compatibility)
  nativeContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  nativeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F2F2F7",
    borderBottomWidth: 0.5,
    borderBottomColor: "#C6C6C8",
  },
  nativeBackButton: {
    paddingRight: 8,
  },
  nativeHeaderTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
  },
  nativeScrollView: {
    flex: 1,
  },
  nativeSection: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 32,
    marginBottom: 32,
  },
  nativeProfileSection: {
    alignItems: "center",
  },
  nativeProfileHint: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 12,
  },
  nativeListSection: {
    marginTop: 32,
  },
  nativeSectionHeader: {
    fontSize: 13,
    fontWeight: "400",
    color: "#6D6D72",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  nativeSectionFooter: {
    fontSize: 13,
    color: "#6D6D72",
    paddingHorizontal: 16,
    paddingTop: 8,
    lineHeight: 18,
  },
  nativeList: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#C6C6C8",
  },
  nativeListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    minHeight: 44,
  },
  nativeListItemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#C6C6C8",
  },
  nativeListLabel: {
    fontSize: 17,
    color: "#000000",
  },
  nativeListValue: {
    fontSize: 17,
    color: "#8E8E93",
    marginRight: 8,
  },
  nativePlaceholder: {
    color: "#C7C7CC",
  },
  nativeInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  nativeInput: {
    fontSize: 17,
    color: "#000000",
    textAlign: "right",
    flex: 1,
    paddingVertical: 0,
  },
  nativeClearButton: {
    marginLeft: 8,
  },
  nativeValueContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  nativeUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nativeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  nativeColorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nativeColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  nativeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  nativeButtonSection: {
    marginTop: 32,
    marginBottom: 16,
  },
  nativeButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#C6C6C8",
  },
  nativeButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#007AFF",
    textAlign: "center",
  },
  debugButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  debugButtonText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  webViewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  webViewLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
});

export default SettingsView;
