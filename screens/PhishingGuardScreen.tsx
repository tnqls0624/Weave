/**
 * 피싱 가드 메인 화면
 * SMS 피싱 탐지 기능 관리 및 통계 표시
 */

import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiService } from "../services/api";
import {
  locationWebSocketService,
  type PhishingAlert,
} from "../services/locationWebSocketService";
import { smsPhishingGuardService } from "../services/smsPhishingGuardService";

interface PhishingReport {
  id: string;
  smsId: string;
  sender: string;
  message: string;
  riskScore: number;
  riskLevel: string;
  detectionReasons: string[];
  phishingType: string;
  timestamp: string;
  status: string;
}

interface PhishingStatistics {
  totalScanned: number;
  phishingDetected: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  detectionRate: number;
  accuracyRate: number;
  phishingTypeStats: Record<string, number>;
}

export default function PhishingGuardScreen() {
  const navigation = useNavigation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistics, setStatistics] = useState<PhishingStatistics | null>(null);
  const [recentReports, setRecentReports] = useState<PhishingReport[]>([]);
  const [nearbyAlerts, setNearbyAlerts] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    initializePhishingGuard();

    return () => {
      unsubscribeFromAlerts();
    };
  }, []);

  const initializePhishingGuard = async () => {
    try {
      // WebSocket 연결 먼저 수행
      console.log("🔌 Connecting to WebSocket...");
      await locationWebSocketService.connect();
      console.log("✅ WebSocket connected");

      // 데이터 로드
      await loadInitialData();

      // 피싱 알림 구독
      await subscribeToPhishingAlerts();
    } catch (error) {
      console.error("❌ Failed to initialize PhishingGuard:", error);
      setLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // 피싱 가드 상태 확인
      const guardStatus = await smsPhishingGuardService.isEnabled();
      setIsEnabled(guardStatus);

      // 통계 가져오기
      const stats = await apiService.getMyPhishingStatistics();
      setStatistics(stats);

      // 최근 신고 목록 가져오기
      const reports = await apiService.getMyPhishingReports({
        page: 0,
        size: 10,
      });
      setRecentReports(reports.content || []);

      // 현재 위치 가져오기
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);

        // 근처 피싱 알림 가져오기
        const nearby = await apiService.getNearbyPhishingReports(
          location.latitude,
          location.longitude,
          5000
        );
        setNearbyAlerts(nearby || []);
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const subscribeToPhishingAlerts = async () => {
    try {
      // 피싱 알림 전용 채널 구독
      await locationWebSocketService.subscribeToPhishingAlerts(
        (alert: PhishingAlert) => {
          handlePhishingAlert(alert);
        }
      );
    } catch (error) {
      console.error("피싱 알림 구독 실패:", error);
    }
  };

  const unsubscribeFromAlerts = () => {
    locationWebSocketService.unsubscribeFromPhishingAlerts();
  };

  const handlePhishingAlert = (alert: PhishingAlert) => {
    console.log("🚨 새 피싱 알림 수신:", alert);

    // PhishingReport 형식으로 변환
    const newReport: PhishingReport = {
      id: Date.now().toString(), // 임시 ID
      smsId: alert.smsId,
      sender: alert.sender,
      message: alert.message,
      riskScore: alert.riskScore,
      riskLevel: alert.riskLevel,
      detectionReasons: alert.detectionReasons,
      phishingType: "unknown", // alert에 없으면 기본값
      timestamp: new Date(alert.timestamp).toISOString(),
      status: "pending",
    };

    // 최근 신고 목록 업데이트
    setRecentReports((prev) => [newReport, ...prev].slice(0, 10));

    // 통계 업데이트 (피싱 감지 수 증가)
    if (statistics) {
      setStatistics({
        ...statistics,
        phishingDetected: statistics.phishingDetected + 1,
        [alert.riskLevel === "high"
          ? "highRiskCount"
          : alert.riskLevel === "medium"
          ? "mediumRiskCount"
          : "lowRiskCount"]:
          statistics[
            alert.riskLevel === "high"
              ? "highRiskCount"
              : alert.riskLevel === "medium"
              ? "mediumRiskCount"
              : "lowRiskCount"
          ] + 1,
      });
    }

    // 고위험 알림인 경우 사용자에게 알림
    if (alert.riskLevel === "high") {
      Alert.alert(
        "⚠️ 고위험 피싱 감지",
        `발신자: ${alert.sender}\n위험도: ${(alert.riskScore * 100).toFixed(
          0
        )}%`,
        [
          { text: "확인", onPress: () => console.log("피싱 알림 확인") },
          {
            text: "상세보기",
            onPress: () =>
              navigation.navigate("PhishingReportDetail", {
                reportId: newReport.id,
              }),
          },
        ]
      );
    }

    // 위치 정보가 있으면 근처 알림 업데이트
    if (alert.location && currentLocation) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        alert.location.latitude,
        alert.location.longitude
      );

      if (distance <= 5000) {
        // 5km 이내
        setNearbyAlerts((prev) =>
          [
            {
              ...newReport,
              distance,
            },
            ...prev,
          ].slice(0, 5)
        );
      }
    }
  };

  // 두 지점 간 거리 계산 (미터 단위)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // 지구 반경 (미터)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const togglePhishingGuard = async (value: boolean) => {
    try {
      setIsEnabled(value);

      if (value) {
        const success = await smsPhishingGuardService.startMonitoring();
        if (!success) {
          Alert.alert("오류", "SMS 피싱 가드를 시작할 수 없습니다");
          setIsEnabled(false);
          return;
        }
      } else {
        await smsPhishingGuardService.stopMonitoring();
      }

      // 서버에 상태 저장
      try {
        await apiService.updateUser("me", { phishingGuardEnabled: value });
        Alert.alert(
          "성공",
          value
            ? "SMS 피싱 가드가 활성화되었습니다"
            : "SMS 피싱 가드가 비활성화되었습니다"
        );
      } catch (apiError) {
        console.error("서버 저장 실패:", apiError);
        Alert.alert(
          "경고",
          "로컬에서는 활성화되었지만 서버 저장에 실패했습니다"
        );
      }
    } catch (error) {
      console.error("피싱 가드 토글 실패:", error);
      Alert.alert("오류", "설정을 변경할 수 없습니다");
      setIsEnabled(!value);
    }
  };

  const getCurrentLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    // 실제 구현에서는 위치 권한 확인 및 현재 위치 가져오기
    return { latitude: 37.5665, longitude: 126.978 }; // 서울 시청 좌표 (예시)
  };

  const handleReportPress = (report: PhishingReport) => {
    // 상세 화면으로 이동
    navigation.navigate("PhishingReportDetail", { reportId: report.id });
  };

  const handleManualCheck = async () => {
    // TODO: 수동 피싱 검사 화면 구현 예정
    // navigation.navigate("PhishingManualCheck");
    Alert.alert(
      "준비 중",
      "수동 검사 기능은 곧 제공될 예정입니다.",
      [{ text: "확인" }]
    );
  };

  const renderStatisticsCard = () => {
    if (!statistics) return null;

    const detectionRatePercent = (statistics.detectionRate * 100).toFixed(1);
    const accuracyRatePercent = (statistics.accuracyRate * 100).toFixed(1);

    return (
      <View style={styles.statisticsCard}>
        <Text style={styles.cardTitle}>📊 피싱 탐지 통계</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.totalScanned}</Text>
            <Text style={styles.statLabel}>검사 메시지</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.dangerText]}>
              {statistics.phishingDetected}
            </Text>
            <Text style={styles.statLabel}>피싱 탐지</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{detectionRatePercent}%</Text>
            <Text style={styles.statLabel}>탐지율</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{accuracyRatePercent}%</Text>
            <Text style={styles.statLabel}>정확도</Text>
          </View>
        </View>

        <View style={styles.riskBreakdown}>
          <Text style={styles.subTitle}>위험도별 분포</Text>
          <View style={styles.riskBars}>
            <View
              style={[
                styles.riskBar,
                { flex: statistics.highRiskCount, backgroundColor: "#ef4444" },
              ]}
            />
            <View
              style={[
                styles.riskBar,
                {
                  flex: statistics.mediumRiskCount,
                  backgroundColor: "#f59e0b",
                },
              ]}
            />
            <View
              style={[
                styles.riskBar,
                { flex: statistics.lowRiskCount, backgroundColor: "#10b981" },
              ]}
            />
          </View>
          <View style={styles.riskLabels}>
            <Text style={styles.riskLabel}>
              고위험: {statistics.highRiskCount}
            </Text>
            <Text style={styles.riskLabel}>
              중위험: {statistics.mediumRiskCount}
            </Text>
            <Text style={styles.riskLabel}>
              저위험: {statistics.lowRiskCount}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderReportItem = ({ item }: { item: PhishingReport }) => {
    const riskColor =
      item.riskLevel === "high"
        ? "#ef4444"
        : item.riskLevel === "medium"
        ? "#f59e0b"
        : "#10b981";

    return (
      <TouchableOpacity
        style={styles.reportItem}
        onPress={() => handleReportPress(item)}
      >
        <View style={[styles.riskIndicator, { backgroundColor: riskColor }]} />
        <View style={styles.reportContent}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportSender}>{item.sender}</Text>
            <Text style={styles.reportTime}>
              {new Date(item.timestamp).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.reportMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <View style={styles.reportFooter}>
            <Text style={[styles.reportRisk, { color: riskColor }]}>
              {item.riskLevel.toUpperCase()} (
              {(item.riskScore * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.reportType}>{item.phishingType}</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  const renderNearbyAlert = ({ item }: { item: any }) => {
    return (
      <View style={styles.nearbyAlertItem}>
        <Ionicons name="location-sharp" size={20} color="#ef4444" />
        <View style={styles.nearbyAlertContent}>
          <Text style={styles.nearbyAlertSender}>{item.sender}</Text>
          <Text style={styles.nearbyAlertDistance}>
            {item.distance ? `${(item.distance / 1000).toFixed(1)}km` : "근처"}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>🛡️ SMS 피싱 가드</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("PhishingSettings")}
          >
            <Ionicons name="settings-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* 활성화 스위치 */}
        <View style={styles.switchCard}>
          <View style={styles.switchContent}>
            <View>
              <Text style={styles.switchTitle}>실시간 피싱 탐지</Text>
              <Text style={styles.switchDescription}>
                수신 SMS를 실시간으로 분석하여 피싱을 탐지합니다
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#d1d5db", true: "#6366f1" }}
              thumbColor={isEnabled ? "#ffffff" : "#f3f4f6"}
              ios_backgroundColor="#d1d5db"
              onValueChange={togglePhishingGuard}
              value={isEnabled}
            />
          </View>
        </View>

        {/* 통계 카드 */}
        {renderStatisticsCard()}

        {/* 수동 검사 버튼 */}
        <TouchableOpacity
          style={styles.manualCheckButton}
          onPress={handleManualCheck}
        >
          <MaterialIcons name="search" size={24} color="#ffffff" />
          <Text style={styles.manualCheckText}>수동으로 메시지 검사</Text>
        </TouchableOpacity>

        {/* 근처 피싱 알림 */}
        {nearbyAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 근처 피싱 알림</Text>
            <FlatList
              data={nearbyAlerts}
              renderItem={renderNearbyAlert}
              keyExtractor={(item, index) => `nearby-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyAlertsList}
            />
          </View>
        )}

        {/* 최근 신고 목록 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 최근 피싱 신고</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("PhishingHistory")}
            >
              <Text style={styles.seeAllText}>전체보기</Text>
            </TouchableOpacity>
          </View>

          {recentReports.length > 0 ? (
            <FlatList
              data={recentReports}
              renderItem={renderReportItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color="#10b981"
              />
              <Text style={styles.emptyStateText}>
                최근 피싱 신고가 없습니다
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  switchCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: "#6b7280",
    maxWidth: 250,
  },
  statisticsCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  dangerText: {
    color: "#ef4444",
  },
  riskBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  riskBars: {
    flexDirection: "row",
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  riskBar: {
    height: "100%",
  },
  riskLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  riskLabel: {
    fontSize: 11,
    color: "#6b7280",
  },
  manualCheckButton: {
    flexDirection: "row",
    backgroundColor: "#6366f1",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  manualCheckText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#6366f1",
  },
  nearbyAlertsList: {
    paddingHorizontal: 20,
  },
  nearbyAlertItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 150,
  },
  nearbyAlertContent: {
    marginLeft: 8,
  },
  nearbyAlertSender: {
    fontSize: 14,
    fontWeight: "600",
    color: "#991b1b",
  },
  nearbyAlertDistance: {
    fontSize: 12,
    color: "#dc2626",
  },
  reportItem: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  riskIndicator: {
    width: 4,
    height: 60,
    borderRadius: 2,
    marginRight: 12,
  },
  reportContent: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reportSender: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reportTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  reportMessage: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reportRisk: {
    fontSize: 12,
    fontWeight: "600",
  },
  reportType: {
    fontSize: 12,
    color: "#9ca3af",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
  },
});
