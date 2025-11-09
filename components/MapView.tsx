import { useWorkspaceUserLocations } from "@/services/queries";
import { useAppStore } from "@/stores/appStore";
import { AppleMaps, GoogleMaps } from "expo-maps";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { Schedule, User } from "../types";

interface MapViewProps {
  schedules: Schedule[];
  users: User[];
  isActive?: boolean; // 탭이 활성화되어 있는지
}

const MapViewComponent: React.FC<MapViewProps> = ({
  users,
  schedules,
  isActive = true,
}) => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { activeWorkspaceId } = useAppStore();

  // Use platform-specific map component
  const MapComponent = Platform.OS === "ios" ? AppleMaps.View : GoogleMaps.View;

  // 실시간 위치 업데이트 (map 탭이 활성화되어 있을 때만, 10초마다 자동 refetch)
  const {
    data: realtimeUsers,
    isLoading,
    error,
    dataUpdatedAt,
  } = useWorkspaceUserLocations(activeWorkspaceId, {
    enabled: !!activeWorkspaceId && isActive, // 워크스페이스 ID가 있고 탭이 활성화되어 있을 때만
    refetchInterval: isActive ? 10000 : undefined, // 탭이 활성화되어 있을 때만 10초마다 자동 업데이트
  });

  // 마지막 업데이트 시간 동기화
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  // 실시간 데이터가 있으면 사용, 없으면 props의 users 사용
  const displayUsers = realtimeUsers || users;

  // 사용자 위치 마커 생성
  const markers = useMemo(() => {
    return displayUsers
      .filter((user) => user.location?.latitude && user.location?.longitude)
      .map((user) => ({
        id: user.id,
        coordinates: {
          latitude: user.location!.latitude,
          longitude: user.location!.longitude,
        },
        title: user.name,
        color: user.color || "#007AFF",
      }));
  }, [displayUsers]);

  // 지도 중심점 계산 (모든 사용자 위치의 평균)
  const mapCenter = useMemo(() => {
    if (markers.length === 0) {
      // 기본 위치 (서울)
      return {
        latitude: 37.5665,
        longitude: 126.978,
      };
    }

    const totalLat = markers.reduce(
      (sum, m) => sum + m.coordinates.latitude,
      0
    );
    const totalLng = markers.reduce(
      (sum, m) => sum + m.coordinates.longitude,
      0
    );

    return {
      latitude: totalLat / markers.length,
      longitude: totalLng / markers.length,
    };
  }, [markers]);

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: "#dc2626", fontSize: 16, marginBottom: 8 }}>
          위치 정보를 불러올 수 없습니다
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 정보 */}
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>멤버 위치</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>실시간</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {markers.length}명의 멤버 위치 표시 중
        </Text>
      </View>

      {/* 지도 */}
      <View style={styles.mapContainer}>
        {markers.length > 0 ? (
          <MapComponent
            style={styles.map}
            cameraPosition={{
              coordinates: mapCenter,
              zoom: 13,
            }}
            markers={markers}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              위치 정보를 공유하는 멤버가 없습니다
            </Text>
            <Text style={styles.emptySubtext}>
              멤버들이 위치 공유를 활성화하면 여기에 표시됩니다
            </Text>
          </View>
        )}
      </View>

      {/* 마지막 업데이트 시간 */}
      <View style={styles.updateInfo}>
        <Text style={styles.updateText}>
          마지막 업데이트: {lastUpdate.toLocaleTimeString("ko-KR")}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#ffffff",
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
  updateInfo: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  errorContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    zIndex: 10,
  },
  errorText: {
    fontSize: 14,
    color: "#991b1b",
  },
});

export default MapViewComponent;
