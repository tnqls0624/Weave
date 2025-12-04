import locationWebSocketService from "@/services/locationWebSocketService";
import { useAppStore } from "@/stores/appStore";
import { Ionicons } from "@expo/vector-icons";
import {
  NaverMapMarkerOverlay,
  NaverMapView as RNNaverMapView,
} from "@mj-studio/react-native-naver-map";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
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
  Text,
  View,
} from "react-native";
import { apiService } from "../services/api";
import { useMyProfile, useWorkspaceUserLocations } from "../services/queries";
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

const getColorCode = (colorName: string): string => {
  // 캘린더와 동일한 방식으로 처리
  return COLOR_MAP[colorName] || COLOR_MAP["gray"];
};

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
  const [cachedImages, setCachedImages] = useState<Record<string, string>>({});
  const { activeWorkspaceId } = useAppStore();
  const { data: currentUser } = useMyProfile();
  const mapRef = useRef<any>(null);

  // React Query로 실시간 위치 데이터 가져오기 (앱 레벨에서 WebSocket 구독 중)
  const { data: locationData } = useWorkspaceUserLocations(
    activeWorkspaceId || "",
    {
      enabled: !!activeWorkspaceId && isActive,
      refetchInterval: 0, // WebSocket으로 실시간 업데이트되므로 폴링 불필요
    }
  );

  // 위치 데이터를 users와 병합하여 realtimeUsers 생성
  const realtimeUsers = useMemo(() => {
    if (!locationData || !Array.isArray(locationData)) {
      return users;
    }

    // users 배열을 복사하고 위치 데이터 병합
    return users.map((user) => {
      const userLocation = locationData.find(
        (loc: any) => (loc.userId || loc.id) === user.id
      );

      if (userLocation && userLocation.latitude && userLocation.longitude) {
        return {
          ...user,
          location: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
        };
      }

      return user;
    });
  }, [users, locationData]);

  // 이미지 캐싱 함수
  const cacheImage = useCallback(async (uri: string, userId: string) => {
    try {
      const filename = `avatar_${userId}.jpg`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      // 이미 캐시된 파일이 있는지 확인
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        return localUri;
      }

      const downloadResult = await FileSystem.downloadAsync(uri, localUri);
      return downloadResult.uri;
    } catch (error) {
      console.error(`[Cache] ❌ Failed to cache image for ${userId}:`, error);
      return null;
    }
  }, []);

  // 사용자 아바타 이미지 캐싱
  useEffect(() => {
    const cacheAllImages = async () => {
      const newCachedImages: Record<string, string> = {};

      for (const user of realtimeUsers) {
        if (user.avatarUrl && user.avatarUrl.startsWith("http")) {
          const localUri = await cacheImage(user.avatarUrl, user.id);
          if (localUri) {
            newCachedImages[user.id] = localUri;
          }
        }
      }

      if (currentUser?.avatarUrl && currentUser.avatarUrl.startsWith("http")) {
        const localUri = await cacheImage(
          currentUser.avatarUrl,
          currentUser.id
        );
        if (localUri) {
          newCachedImages[currentUser.id] = localUri;
        }
      }

      setCachedImages(newCachedImages);
    };

    cacheAllImages();
  }, [realtimeUsers, currentUser, cacheImage]);

  const sendLocationUpdate = useCallback(
    async (latitude: number, longitude: number) => {
      if (!activeWorkspaceId) {
        return;
      }
      try {
        // REST API로 서버에 저장
        await apiService.saveLocationToWorkspace(activeWorkspaceId, {
          latitude,
          longitude,
        });

        // WebSocket으로 실시간 브로드캐스트
        await locationWebSocketService.updateLocation(
          activeWorkspaceId,
          latitude,
          longitude
        );
      } catch (updateError) {
        console.error("❌ Failed to push location update:", updateError);
      }
    },
    [activeWorkspaceId]
  );

  // 위치 데이터가 업데이트될 때마다 lastUpdate 갱신
  useEffect(() => {
    if (locationData) {
      setLastUpdate(new Date());
    }
  }, [locationData]);

  // 내 위치 추적
  useEffect(() => {
    if (!isActive || !activeWorkspaceId) return;

    let subscription: Location.LocationSubscription | null = null;

    const startMyLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("⚠️ Location permission not granted");
          return;
        }

        // 마지막으로 알려진 위치를 먼저 사용 (즉시 표시)
        const lastKnownLocation = await Location.getLastKnownPositionAsync();
        if (lastKnownLocation) {
          const quickLocation = {
            latitude: lastKnownLocation.coords.latitude,
            longitude: lastKnownLocation.coords.longitude,
          };
          setMyLocation(quickLocation);
          setCameraCenter({
            ...quickLocation,
            zoom: 13,
          });
        }

        // 정확한 현재 위치 가져오기 (백그라운드에서)
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low, // 빠른 응답을 위해 정확도 낮춤
        });
        const newLocation = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        };
        setMyLocation(newLocation);
        void sendLocationUpdate(newLocation.latitude, newLocation.longitude);

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
            void sendLocationUpdate(
              location.coords.latitude,
              location.coords.longitude
            );
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
  }, [isActive, activeWorkspaceId, sendLocationUpdate]);

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
        color: user.color || "gray", // 색상 이름 사용
        avatarUrl: user.avatarUrl,
        isMe: false,
        hasLocation,
      };
    });
  }, [otherMembers]);

  // 내 마커
  const myMarker = useMemo<MarkerUser | null>(() => {
    if (!currentUser) return null;

    // users 배열에서 현재 사용자를 찾아서 color 정보를 가져옴
    const userWithColor = users.find((u) => u.id === currentUser.id);

    return {
      id: currentUser.id,
      coordinates: myLocation,
      title: currentUser.name,
      displayTitle: `${currentUser.name}`,
      color: userWithColor?.color || currentUser.color || "gray", // users에서 color 가져오기
      avatarUrl: currentUser.avatarUrl,
      isMe: true,
      hasLocation: myLocation != null,
    };
  }, [myLocation, currentUser, users]);

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
    const borderWidth = marker.isMe ? 3 : 2.5;
    const borderColor = getColorCode(marker.color);
    const localImageUri = cachedImages[marker.id];

    // 프로필 이미지가 있으면 image prop 사용
    if (localImageUri) {
      return (
        <NaverMapMarkerOverlay
          key={marker.id}
          latitude={marker.coordinates.latitude}
          longitude={marker.coordinates.longitude}
          image={{ httpUri: localImageUri }}
          width={size}
          height={size}
          anchor={{ x: 0.5, y: 0.5 }}
          isIconPerspectiveEnabled={true}
        />
      );
    }

    // 프로필 이미지 없으면 기본 마커
    return (
      <NaverMapMarkerOverlay
        key={marker.id}
        latitude={marker.coordinates.latitude}
        longitude={marker.coordinates.longitude}
        width={size}
        height={size}
        anchor={{ x: 0.5, y: 0.5 }}
        isIconPerspectiveEnabled={true}
      >
        {/* 색상 테두리가 있는 원형 컨테이너 */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: borderColor,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <View
            style={{
              width: size - borderWidth * 2,
              height: size - borderWidth * 2,
              borderRadius: (size - borderWidth * 2) / 2,
              backgroundColor: "#e5e7eb",
              overflow: "hidden",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: marker.isMe ? 20 : 16,
                fontWeight: "700",
                color: "#000000",
              }}
            >
              {marker.title.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* 온라인 표시 */}
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#ffffff",
              justifyContent: "center",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#22c55e",
              }}
            />
          </View>
        </View>
      </NaverMapMarkerOverlay>
    );
  };

  const totalMembersWithLocation = (myMarker ? 1 : 0) + otherMarkers.length;

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
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>
            {totalMembersWithLocation}명의 멤버 위치 표시 중
          </Text>
        </View>
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
                const memberColor = getColorCode(member.color); // 모든 색상 변환
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
                    {/* 색상 띠 */}
                    <View
                      style={[
                        styles.colorStrip,
                        {
                          backgroundColor: member.hasLocation
                            ? memberColor
                            : "#d1d5db",
                        },
                        !member.hasLocation && styles.colorStripDisabled,
                      ]}
                    />
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
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  markerContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  markerShadow: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  markerBorder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  markerImage: {
    resizeMode: "cover",
  },
  onlineIndicator: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
  },
  myMarkerContainer: {
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
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
    color: "#000000",
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
  colorStrip: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
    marginBottom: 2,
  },
  colorStripDisabled: {
    opacity: 0.4,
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
  userMarker: {
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default NaverMapView;
