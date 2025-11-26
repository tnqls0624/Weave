/**
 * 피싱 가드 설정 화면
 * 피싱 탐지 기능 관련 설정 관리
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiService } from "../services/api";

interface Settings {
  phishingGuardEnabled: boolean;
  autoBlock: boolean;
  notifications: boolean;
  nearbyAlerts: boolean;
  sensitivityLevel: "high" | "medium" | "low";
}

export default function PhishingSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    phishingGuardEnabled: false,
    autoBlock: false,
    notifications: true,
    nearbyAlerts: true,
    sensitivityLevel: "medium",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const profile = await apiService.getMyProfile();

      setSettings({
        phishingGuardEnabled: profile.phishingGuardEnabled ?? false,
        autoBlock: profile.phishingAutoBlock ?? false,
        notifications: profile.pushEnabled ?? true,
        nearbyAlerts: profile.locationEnabled ?? true,
        sensitivityLevel: (profile.phishingSensitivityLevel as "high" | "medium" | "low") ?? "medium",
      });
    } catch (error) {
      console.error("설정 로드 실패:", error);
      Alert.alert("오류", "설정을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    try {
      setSaving(true);
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      // Update backend
      if (key === "phishingGuardEnabled") {
        await apiService.updateProfile({
          phishingGuardEnabled: value as boolean,
        });
      } else if (key === "autoBlock") {
        await apiService.updateProfile({
          phishingAutoBlock: value as boolean,
        });
      } else if (key === "notifications") {
        await apiService.updateProfile({
          pushEnabled: value as boolean,
        });
      } else if (key === "nearbyAlerts") {
        await apiService.updateProfile({
          locationEnabled: value as boolean,
        });
      } else if (key === "sensitivityLevel") {
        await apiService.updateProfile({
          phishingSensitivityLevel: value as string,
        });
      }
    } catch (error) {
      console.error("설정 업데이트 실패:", error);
      Alert.alert("오류", "설정 업데이트 중 문제가 발생했습니다.");
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handlePhishingGuardToggle = (value: boolean) => {
    if (!value) {
      Alert.alert(
        "피싱 가드 비활성화",
        "피싱 가드를 비활성화하면 SMS 피싱 탐지 기능이 중지됩니다. 계속하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          {
            text: "비활성화",
            style: "destructive",
            onPress: () => updateSetting("phishingGuardEnabled", false),
          },
        ]
      );
    } else {
      updateSetting("phishingGuardEnabled", true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>피싱 가드 설정</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Main Toggle */}
        <View style={styles.section}>
          <View style={styles.mainToggleCard}>
            <View style={styles.mainToggleHeader}>
              <View
                style={[
                  styles.mainToggleIcon,
                  settings.phishingGuardEnabled && styles.mainToggleIconActive,
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color={settings.phishingGuardEnabled ? "#3B82F6" : "#9CA3AF"}
                />
              </View>
              <View style={styles.mainToggleText}>
                <Text style={styles.mainToggleTitle}>피싱 가드</Text>
                <Text style={styles.mainToggleDescription}>
                  {settings.phishingGuardEnabled
                    ? "SMS 피싱 탐지가 활성화되어 있습니다"
                    : "SMS 피싱 탐지가 비활성화되어 있습니다"}
                </Text>
              </View>
              <Switch
                value={settings.phishingGuardEnabled}
                onValueChange={handlePhishingGuardToggle}
                disabled={saving}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor={settings.phishingGuardEnabled ? "#3B82F6" : "#F3F4F6"}
              />
            </View>
          </View>
        </View>

        {/* Detection Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>탐지 설정</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="alert-circle" size={20} color="#6B7280" />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>검사 민감도</Text>
                  <Text style={styles.settingDescription}>
                    탐지 알고리즘의 엄격함을 조정합니다
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sensitivityButtons}>
              {(
                [
                  { key: "low", label: "낮음", desc: "분명한 피싱만 탐지" },
                  { key: "medium", label: "보통", desc: "균형잡힌 탐지" },
                  { key: "high", label: "높음", desc: "의심스러운 메시지도 탐지" },
                ] as const
              ).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.sensitivityButton,
                    settings.sensitivityLevel === item.key &&
                      styles.sensitivityButtonActive,
                  ]}
                  onPress={() => updateSetting("sensitivityLevel", item.key)}
                  disabled={saving || !settings.phishingGuardEnabled}
                >
                  <Text
                    style={[
                      styles.sensitivityLabel,
                      settings.sensitivityLevel === item.key &&
                        styles.sensitivityLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.sensitivityDesc,
                      settings.sensitivityLevel === item.key &&
                        styles.sensitivityDescActive,
                    ]}
                  >
                    {item.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="ban" size={20} color="#6B7280" />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>자동 차단</Text>
                  <Text style={styles.settingDescription}>
                    고위험 메시지를 자동으로 차단합니다
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.autoBlock}
                onValueChange={(value) => updateSetting("autoBlock", value)}
                disabled={saving || !settings.phishingGuardEnabled}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor={settings.autoBlock ? "#3B82F6" : "#F3F4F6"}
              />
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications" size={20} color="#6B7280" />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>피싱 탐지 알림</Text>
                  <Text style={styles.settingDescription}>
                    피싱 메시지 탐지 시 알림을 받습니다
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={(value) => updateSetting("notifications", value)}
                disabled={saving || !settings.phishingGuardEnabled}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor={settings.notifications ? "#3B82F6" : "#F3F4F6"}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="location" size={20} color="#6B7280" />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>근처 피싱 알림</Text>
                  <Text style={styles.settingDescription}>
                    내 주변에서 피싱 신고가 있을 때 알림을 받습니다
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.nearbyAlerts}
                onValueChange={(value) => updateSetting("nearbyAlerts", value)}
                disabled={saving || !settings.phishingGuardEnabled}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor={settings.nearbyAlerts ? "#3B82F6" : "#F3F4F6"}
              />
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            피싱 가드는 머신러닝 기반으로 SMS 메시지를 분석하여 피싱 시도를
            탐지합니다. 개인정보는 수집되지 않으며, 메시지 패턴만 분석됩니다.
          </Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정보</Text>

          <View style={styles.settingCard}>
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="document-text" size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>개인정보 처리방침</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.settingCard}>
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="help-circle" size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>도움말</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="information-circle" size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>버전</Text>
              </View>
              <Text style={styles.versionText}>1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Saving Indicator */}
      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.savingText}>저장 중...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  mainToggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  mainToggleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mainToggleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  mainToggleIconActive: {
    backgroundColor: "#EFF6FF",
  },
  mainToggleText: {
    flex: 1,
  },
  mainToggleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  mainToggleDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  settingDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  sensitivityButtons: {
    gap: 8,
    marginTop: 12,
  },
  sensitivityButton: {
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
  },
  sensitivityButtonActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  sensitivityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  sensitivityLabelActive: {
    color: "#3B82F6",
  },
  sensitivityDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sensitivityDescActive: {
    color: "#2563EB",
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    margin: 16,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  versionText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  savingIndicator: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#111827",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  savingText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
