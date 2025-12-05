import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  useSearchPlaces,
} from "../services/queries";
import { PlaceItem } from "../services/api";
import locationTrackingService from "../services/locationTrackingService";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRadius, setSelectedRadius] = useState(300);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const { data: reminder, isLoading } = useLocationReminder(scheduleId);
  const setReminderMutation = useSetLocationReminder();
  const toggleReminderMutation = useToggleLocationReminder();
  const deleteReminderMutation = useDeleteLocationReminder();
  const searchPlacesMutation = useSearchPlaces();

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

  // 디바운스된 검색
  useEffect(() => {
    if (searchQuery.length < 2) {
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      searchPlacesMutation.mutate({ query: searchQuery, display: 5 });
      setShowSearchResults(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      setSearchQuery("");
      setShowSearchResults(false);
    } catch (error) {
      Alert.alert("오류", "현재 위치를 가져올 수 없습니다.");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSelectPlace = (place: PlaceItem) => {
    setCurrentLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.roadAddress || place.address,
    });
    setPlaceName(place.title);
    setSearchQuery("");
    setShowSearchResults(false);
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

      // 위치 추적에 알림 등록 (백그라운드에서 도착 감지)
      await locationTrackingService.addLocationReminder({
        scheduleId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius: selectedRadius,
        placeName: placeName.trim() || currentLocation.address,
      });

      Alert.alert("완료", "위치 알림이 설정되었습니다.\n해당 장소에 도착하면 참여자들에게 알림이 전송됩니다.");
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
            // 위치 추적에서도 제거
            await locationTrackingService.removeLocationReminder(scheduleId);
            setCurrentLocation(null);
            setPlaceName("");
          } catch (error) {
            Alert.alert("오류", "삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const renderSearchResult = ({ item }: { item: PlaceItem }) => (
    <Pressable
      style={styles.searchResultItem}
      onPress={() => handleSelectPlace(item)}
    >
      <View style={styles.searchResultIcon}>
        <Ionicons name="location" size={18} color="#3B82F6" />
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.searchResultAddress} numberOfLines={1}>
          {item.roadAddress || item.address}
        </Text>
        {item.category && (
          <Text style={styles.searchResultCategory} numberOfLines={1}>
            {item.category}
          </Text>
        )}
      </View>
    </Pressable>
  );

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

          {/* 장소 검색 입력 */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="장소 검색 (예: 강남역, 스타벅스)"
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          {/* 검색 결과 */}
          {showSearchResults && (
            <View style={styles.searchResultsContainer}>
              {searchPlacesMutation.isPending ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.searchLoadingText}>검색 중...</Text>
                </View>
              ) : searchPlacesMutation.data?.items?.length ? (
                <FlatList
                  data={searchPlacesMutation.data.items}
                  renderItem={renderSearchResult}
                  keyExtractor={(item, index) => `${item.title}-${index}`}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
                </View>
              )}
            </View>
          )}

          {/* 또는 현재 위치 버튼 */}
          <View style={styles.orDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

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
              <View style={styles.selectedLocationInfo}>
                {placeName && (
                  <Text style={styles.selectedPlaceName}>{placeName}</Text>
                )}
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {currentLocation.address || `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
                </Text>
              </View>
            </View>
          )}

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
  searchContainer: {
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#374151",
  },
  clearButton: {
    padding: 4,
  },
  searchResultsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 12,
    color: "#6B7280",
  },
  searchResultCategory: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  searchLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  searchLoadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  noResults: {
    padding: 20,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginHorizontal: 12,
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
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedLocationInfo: {
    flex: 1,
    marginLeft: 8,
  },
  selectedPlaceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: "#6B7280",
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
