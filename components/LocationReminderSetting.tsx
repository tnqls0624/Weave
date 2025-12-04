import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { LocationReminder } from "../types";
import {
  useLocationReminder,
  useSetLocationReminder,
  useToggleLocationReminder,
  useDeleteLocationReminder,
} from "../services/queries";

interface LocationReminderSettingProps {
  scheduleId: string;
}

const RADIUS_OPTIONS = [
  { label: "100m", value: 100 },
  { label: "300m", value: 300 },
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
];

const LocationReminderSetting: React.FC<LocationReminderSettingProps> = ({
  scheduleId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [selectedRadius, setSelectedRadius] = useState(300);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const { data: reminder, isLoading } = useLocationReminder(scheduleId);
  const setReminderMutation = useSetLocationReminder();
  const toggleReminderMutation = useToggleLocationReminder();
  const deleteReminderMutation = useDeleteLocationReminder();

  useEffect(() => {
    if (reminder) {
      setPlaceName(reminder.placeName || "");
      setSelectedRadius(reminder.radius || 300);
      if (reminder.latitude && reminder.longitude) {
        setCurrentLocation({
          latitude: reminder.latitude,
          longitude: reminder.longitude,
          address: reminder.address,
        });
      }
    }
  }, [reminder]);

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

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressString,
      });
    } catch (error) {
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!currentLocation) {
      Alert.alert("알림", "먼저 위치를 설정해주세요.");
      return;
    }

    try {
      await setReminderMutation.mutateAsync({
        scheduleId,
        data: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: selectedRadius,
          address: currentLocation.address,
          placeName: placeName.trim() || undefined,
        },
      });
      Alert.alert("완료", "위치 알림이 설정되었습니다.");
    } catch (error) {
      Alert.alert("오류", "위치 알림 설정에 실패했습니다.");
    }
  };

  const handleToggleReminder = async (isEnabled: boolean) => {
    try {
      await toggleReminderMutation.mutateAsync({ scheduleId, isEnabled });
    } catch (error) {
      Alert.alert("오류", "설정 변경에 실패했습니다.");
    }
  };

  const handleDeleteReminder = () => {
    Alert.alert("위치 알림 삭제", "위치 알림 설정을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReminderMutation.mutateAsync(scheduleId);
            setCurrentLocation(null);
            setPlaceName("");
          } catch (error) {
            Alert.alert("오류", "삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="location-outline" size={20} color="#374151" />
            <Text style={styles.headerTitle}>위치 알림</Text>
          </View>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Pressable
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="location-outline" size={20} color="#374151" />
          <Text style={styles.headerTitle}>위치 알림</Text>
          {reminder?.isEnabled && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>활성</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#9CA3AF"
        />
      </Pressable>

      {/* 설명 */}
      <Text style={styles.description}>
        설정한 장소에 도착하면 알림을 받습니다
      </Text>

      {isExpanded && (
        <View style={styles.content}>
          {/* 기존 설정이 있으면 활성화/비활성화 토글 표시 */}
          {reminder && (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>알림 받기</Text>
              <Switch
                value={reminder.isEnabled}
                onValueChange={handleToggleReminder}
                trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
                thumbColor={reminder.isEnabled ? "#3B82F6" : "#F3F4F6"}
                disabled={toggleReminderMutation.isPending}
              />
            </View>
          )}

          {/* 현재 위치 버튼 */}
          <Pressable
            style={styles.locationButton}
            onPress={handleGetCurrentLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <>
                <Ionicons name="navigate" size={18} color="#3B82F6" />
                <Text style={styles.locationButtonText}>현재 위치 사용</Text>
              </>
            )}
          </Pressable>

          {/* 선택된 위치 표시 */}
          {currentLocation && (
            <View style={styles.selectedLocation}>
              <Ionicons name="pin" size={16} color="#22C55E" />
              <Text style={styles.locationAddress} numberOfLines={2}>
                {currentLocation.address || `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
              </Text>
            </View>
          )}

          {/* 장소 이름 입력 */}
          <TextInput
            style={styles.input}
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="장소 이름 (선택사항)"
            placeholderTextColor="#9CA3AF"
          />

          {/* 반경 선택 */}
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

          {/* 버튼들 */}
          <View style={styles.buttonRow}>
            {reminder && (
              <Pressable
                style={styles.deleteButton}
                onPress={handleDeleteReminder}
                disabled={deleteReminderMutation.isPending}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.saveButton,
                (!currentLocation || setReminderMutation.isPending) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSaveReminder}
              disabled={!currentLocation || setReminderMutation.isPending}
            >
              {setReminderMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {reminder ? "수정" : "저장"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  activeBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  description: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  content: {
    marginTop: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 15,
    color: "#374151",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 6,
  },
  selectedLocation: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationAddress: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    marginLeft: 8,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#374151",
    marginBottom: 16,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  radiusOptions: {
    flexDirection: "row",
    marginBottom: 16,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  radiusOptionSelected: {
    backgroundColor: "#3B82F6",
  },
  radiusOptionText: {
    fontSize: 14,
    color: "#6B7280",
  },
  radiusOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default LocationReminderSetting;
