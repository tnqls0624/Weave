import locationWebSocketService from "@/services/locationWebSocketService";
import { useAppStore } from "@/stores/appStore";
import {
  NaverMapMarkerOverlay,
  NaverMapView as RNNaverMapView,
} from "@mj-studio/react-native-naver-map";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMyProfile } from "../services/queries";
import type { Schedule, User } from "../types";

const COLOR_MAP: Record<string, string> = {
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

const getColorCode = (colorName: string): string =>
  COLOR_MAP[colorName] || "#007AFF";

type MarkerUser = {
  id: string;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null; // 위치가 없을 수 있음
  title: string;
  displayTitle: string;
  color: string;
  avatarUrl: string;
  isMe: boolean;
  hasLocation: boolean; // 위치 유무 플래그
};

interface NaverMapViewProps {
  schedules: Schedule[];
  users: User[];
  isActive?: boolean; // 탭이 활성화되어 있는지
}

const NaverMapView: React.FC<NaverMapViewProps> = ({
  users,
  schedules,
  isActive = true,
}) => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [realtimeUsers, setRealtimeUsers] = useState<User[]>(users);
  const [error, setError] = useState<Error | null>(null);
  const [myLocation, setMyLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [cameraCenter, setCameraCenter] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
  }>({
    latitude: 37.5665,
    longitude: 126.978,
    zoom: 13,
  });
  const { activeWorkspaceId } = useAppStore();
  const { data: currentUser } = useMyProfile();
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!activeWorkspaceId || !isActive) {
      return;
    }

    let subscription: { unsubscribe: () => void } | null = null;

    const startStreaming = async () => {
      try {
        // STOMP 스트림 구독
        subscription = await locationWebSocketService.streamLocations(
          activeWorkspaceId,
          (locationData: any) => {
            // 위치 업데이트 수신
            console.log(
              "🗺️ Received location data:",
              JSON.stringify(locationData, null, 2)
            );

            setRealtimeUsers((prevUsers) => {
              console.log("📋 Current users before update:", prevUsers.length);
              const updatedUsers = [...prevUsers];

              // 서버에서 오는 데이터 형식에 따라 userId 추출
              const userId = locationData.userId || locationData.id;

              if (!userId) {
                console.warn(
                  "⚠️ No userId found in location data:",
                  locationData
                );
                return updatedUsers;
              }

              const userIndex = updatedUsers.findIndex((u) => u.id === userId);

              if (userIndex !== -1) {
                // 기존 사용자 위치 업데이트
                console.log(
                  `✅ Updating location for user: ${updatedUsers[userIndex].name} (${userId})`
                );
                updatedUsers[userIndex] = {
                  ...updatedUsers[userIndex],
                  location: {
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                  },
                };
              } else {
                console.log(
                  `⚠️ User ${userId} not found in current users. Available users:`,
                  updatedUsers.map((u) => ({ id: u.id, name: u.name }))
                );
                // 새 사용자 추가 (서버에서 전체 사용자 정보가 오는 경우)
                if (locationData.user) {
                  updatedUsers.push({
                    ...locationData.user,
                    location: {
                      latitude: locationData.latitude,
                      longitude: locationData.longitude,
                    },
                  });
                }
              }

              return updatedUsers;
            });
            setLastUpdate(new Date());
            setError(null);
          }
        );
      } catch (err) {
        console.error("❌ STOMP streaming error:", err);
        setError(err as Error);
      }
    };

    startStreaming();

    // 클린업: STOMP 구독 해제
    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [activeWorkspaceId, isActive]);

  // 초기 사용자 데이터 동기화
  useEffect(() => {
    setRealtimeUsers(users);
  }, [users]);

  // 내 위치 추적
  useEffect(() => {
    if (!isActive) return;

    let subscription: Location.LocationSubscription | null = null;

    const startMyLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("⚠️ Location permission not granted");
          return;
        }

        // 초기 위치를 즉시 가져오기
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const newLocation = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        };
        setMyLocation(newLocation);

        // 초기 위치로 카메라 이동
        setCameraCenter({
          ...newLocation,
          zoom: 13,
        });

        // 지속적인 위치 추적 시작 (5초마다 업데이트)
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000, // 5초마다 업데이트
            distanceInterval: 0, // 거리 조건 없이 시간만으로 업데이트
          },
          (location) => {
            setMyLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );
      } catch (error) {
        console.error("❌ Failed to track my location:", error);
      }
    };

    startMyLocationTracking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isActive]);

  const displayUsers = realtimeUsers;

  // 다른 멤버들 (나를 제외한 모든 멤버, 위치 유무 상관없이)
  const otherMembers = useMemo(() => {
    displayUsers.forEach((user) => {});
    // 위치 유무와 상관없이 나를 제외한 모든 멤버 표시
    const filtered = displayUsers.filter((user) => user.id !== currentUser?.id);
    return filtered;
  }, [displayUsers, currentUser?.id]);

  // 다른 멤버 마커/아이콘 생성 (위치 유무 상관없이)
  const otherMarkers = useMemo<MarkerUser[]>(() => {
    return otherMembers.map((user) => {
      const hasLocation =
        user.location?.latitude != null && user.location?.longitude != null;
      return {
        id: user.id,
        coordinates: hasLocation
          ? {
              latitude: user.location!.latitude,
              longitude: user.location!.longitude,
            }
          : null,
        title: user.name,
        displayTitle: user.name,
        color: user.color || "#007AFF",
        avatarUrl: user.avatarUrl,
        isMe: false,
        hasLocation,
      };
    });
  }, [otherMembers]);

  // 내 마커
  const myMarker = useMemo<MarkerUser | null>(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      coordinates: myLocation,
      title: currentUser.name,
      displayTitle: `${currentUser.name}`,
      color: "#ef4444", // 빨간색으로 특별 표시
      avatarUrl: currentUser.avatarUrl,
      isMe: true,
      hasLocation: myLocation != null,
    };
  }, [myLocation, currentUser]);

  // 모든 멤버 아이콘 리스트 (나 + 다른 멤버들)
  const allMemberIcons = useMemo<MarkerUser[]>(() => {
    const icons: MarkerUser[] = [];

    // 내 아이콘을 맨 앞에 추가
    if (myMarker) {
      icons.push(myMarker);
    }

    // 다른 멤버들 추가
    icons.push(...otherMarkers);
    return icons;
  }, [myMarker, otherMarkers]);

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

  // 멤버 아이콘 클릭 시 해당 위치로 이동
  const moveToMember = (latitude: number, longitude: number) => {
    if (mapRef.current) {
      // mapRef를 사용하여 직접 카메라 애니메이션
      mapRef.current.animateCameraTo({
        latitude,
        longitude,
        zoom: 15,
        duration: 500, // 0.5초 애니메이션
      });
    } else {
      // fallback: mapRef가 없을 경우 상태 업데이트
      setCameraCenter({
        latitude,
        longitude,
        zoom: 15,
      });
    }
  };

  const renderMarker = (marker: MarkerUser) => {
    // 위치가 없으면 마커를 렌더링하지 않음
    if (!marker.hasLocation || !marker.coordinates) {
      return null;
    }

    const size = marker.isMe ? 56 : 48;

    return (
      <NaverMapMarkerOverlay
        key={marker.id}
        latitude={marker.coordinates.latitude}
        longitude={marker.coordinates.longitude}
        width={size}
        height={size}
        image={{ httpUri: marker.avatarUrl }}
        isIconPerspectiveEnabled={true}
        caption={{
          text: marker.displayTitle,
          textSize: marker.isMe ? 13 : 12,
          color: "#111827",
        }}
      ></NaverMapMarkerOverlay>
    );
  };

  const totalMembersWithLocation =
    (myMarker?.hasLocation ? 1 : 0) +
    otherMarkers.filter((m) => m.hasLocation).length;

  return (
    <View style={styles.container}>
      {/* 상단 정보 */}
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>멤버 위치</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {locationWebSocketService.isConnected() ? "실시간" : "연결 중"}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {totalMembersWithLocation}명의 멤버 위치 표시 중
        </Text>
      </View>

      {/* 지도 */}
      <View style={styles.mapContainer}>
        <RNNaverMapView
          ref={mapRef}
          style={styles.map}
          camera={{
            latitude: cameraCenter.latitude,
            longitude: cameraCenter.longitude,
            zoom: cameraCenter.zoom,
          }}
          isShowLocationButton={true}
        >
          {/* 내 마커 */}
          {myMarker && renderMarker(myMarker)}

          {/* 다른 멤버 마커 */}
          {otherMarkers.map((marker) => renderMarker(marker))}
        </RNNaverMapView>

        {/* 멤버 아이콘 리스트 (왼쪽 위) */}
        {allMemberIcons.length > 0 && (
          <View style={styles.memberListContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.memberListContent}
            >
              {allMemberIcons.map((member) => {
                const memberColor = member.isMe
                  ? member.color // 내 색상은 이미 hex 코드
                  : getColorCode(member.color); // 다른 멤버는 변환 필요
                const hasAvatar =
                  typeof member.avatarUrl === "string" &&
                  member.avatarUrl.trim().length > 0;

                return (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.memberItem,
                      member.isMe && styles.myMemberItem,
                      !member.hasLocation && styles.memberItemDisabled, // 위치 없으면 비활성화 스타일
                    ]}
                    onPress={() => {
                      // 위치가 있을 때만 이동
                      if (member.hasLocation && member.coordinates) {
                        moveToMember(
                          member.coordinates.latitude,
                          member.coordinates.longitude
                        );
                      }
                    }}
                    disabled={!member.hasLocation} // 위치 없으면 클릭 불가
                  >
                    {hasAvatar ? (
                      <Image
                        source={{ uri: member.avatarUrl! }}
                        style={[
                          styles.memberAvatar,
                          {
                            borderColor: member.hasLocation
                              ? memberColor
                              : "#d1d5db", // 회색
                          },
                          !member.hasLocation && styles.memberAvatarDisabled, // 위치 없으면 회색 필터
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.memberAvatar,
                          styles.memberAvatarPlaceholder,
                          {
                            borderColor: member.hasLocation
                              ? memberColor
                              : "#d1d5db", // 회색
                          },
                          !member.hasLocation && styles.memberAvatarDisabled, // 위치 없으면 회색 필터
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.memberName,
                        !member.hasLocation && styles.memberNameDisabled, // 위치 없으면 회색 텍스트
                      ]}
                      numberOfLines={1}
                    >
                      {member.displayTitle}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 내 위치가 없을 때 안내 메시지 */}
        {!myMarker && (
          <View style={styles.emptyOverlay}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>내 위치를 가져오는 중...</Text>
              <Text style={styles.emptySubtext}>위치 권한을 허용해주세요</Text>
            </View>
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
  markerContainer: {
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  myMarkerContainer: {
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  markerImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  markerPlaceholder: {
    backgroundColor: "#ffffff",
  },
  markerInitial: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  markerInitialText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  markerHalo: {
    position: "absolute",
    bottom: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
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
  emptyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 280,
  },
  emptyText: {
    fontSize: 16,
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
  memberListContainer: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    zIndex: 10,
    height: 80, // 높이 고정
  },
  memberListContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap", // 줄바꿈 방지
  },
  memberItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 70,
    marginRight: 12,
  },
  myMemberItem: {},
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    marginBottom: 4,
  },
  myMemberAvatar: {
    borderWidth: 4, // 내 아바타는 더 두꺼운 테두리
  },
  memberAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  memberAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  markerMeBadge: {
    position: "absolute",
    bottom: -2,
    alignSelf: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  markerMeBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  memberName: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
    maxWidth: 60,
    textAlign: "center",
  },
  memberItemDisabled: {
    opacity: 0.5, // 위치 없는 멤버는 반투명
  },
  memberAvatarDisabled: {
    opacity: 0.4, // 아바타도 더 흐리게
  },
  memberNameDisabled: {
    color: "#9ca3af", // 회색 텍스트
  },
  meBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default NaverMapView;
