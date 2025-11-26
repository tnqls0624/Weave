/**
 * 피싱 가드 메인 UI 컴포넌트
 * 피싱 알림 목록, 통계, 실시간 모니터링 표시
 */

import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PhishingAlert,
  PhishingGuardConfig,
  smsPhishingGuardService,
} from "../../services/smsPhishingGuardService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface Statistics {
  totalScanned: number;
  phishingDetected: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

export default function PhishingGuardView() {
  const insets = useSafeAreaInsets();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [phishingAlerts, setPhishingAlerts] = useState<PhishingAlert[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalScanned: 0,
    phishingDetected: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
  });
  const [selectedAlert, setSelectedAlert] = useState<PhishingAlert | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<PhishingGuardConfig | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterLevel, setFilterLevel] = useState<
    "all" | "high" | "medium" | "low"
  >("all");

  // 애니메이션
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initialize();
    startAnimations();

    return () => {
      // Cleanup
    };
  }, []);

  /**
   * 초기화
   */
  const initialize = async () => {
    try {
      setIsLoading(true);

      // 설정 로드
      const guardConfig = smsPhishingGuardService.getConfig();
      setConfig(guardConfig);
      setIsMonitoring(guardConfig.enabled);

      // 피싱 히스토리 로드
      const history = await smsPhishingGuardService.getPhishingHistory();
      setPhishingAlerts(history.sort((a, b) => b.timestamp - a.timestamp));

      // 통계 로드
      const stats = await smsPhishingGuardService.getStatistics();
      setStatistics(stats);

      setIsLoading(false);
    } catch (error) {
      console.error("초기화 실패:", error);
      setIsLoading(false);
    }
  };

  /**
   * 애니메이션 시작
   */
  const startAnimations = () => {
    // 펄스 애니메이션 (모니터링 중일 때)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 슬라이드 인 애니메이션
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  /**
   * 모니터링 토글
   */
  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await smsPhishingGuardService.stopMonitoring();
        setIsMonitoring(false);
        Alert.alert("피싱 가드", "모니터링이 중지되었습니다.");
      } else {
        const success = await smsPhishingGuardService.startMonitoring();
        if (success) {
          setIsMonitoring(true);
          Alert.alert("피싱 가드", "모니터링이 시작되었습니다.");
        } else {
          Alert.alert("오류", "SMS 권한이 필요합니다.");
        }
      }
    } catch (error) {
      console.error("모니터링 토글 실패:", error);
      Alert.alert("오류", "모니터링 상태 변경 실패");
    }
  };

  /**
   * 새로고침
   */
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await initialize();
    } catch (error) {
      console.error("새로고침 실패:", error);
    }

    setIsRefreshing(false);
  }, []);

  /**
   * 피싱 알림 삭제
   */
  const deleteAlert = async (alertId: string) => {
    Alert.alert("삭제 확인", "이 알림을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setPhishingAlerts((prev) => prev.filter((a) => a.smsId !== alertId));
          // TODO: 서버에서도 삭제
        },
      },
    ]);
  };

  /**
   * 화이트리스트에 추가
   */
  const addToWhitelist = async (sender: string) => {
    try {
      const currentConfig = smsPhishingGuardService.getConfig();
      currentConfig.whitelistedNumbers.push(sender);
      await smsPhishingGuardService.updateConfig(currentConfig);

      Alert.alert("성공", `${sender}를 안전한 번호로 등록했습니다.`);
    } catch (error) {
      console.error("화이트리스트 추가 실패:", error);
      Alert.alert("오류", "안전한 번호 등록 실패");
    }
  };

  /**
   * 필터된 알림 목록
   */
  const getFilteredAlerts = () => {
    if (filterLevel === "all") {
      return phishingAlerts;
    }
    return phishingAlerts.filter((alert) => alert.riskLevel === filterLevel);
  };

  /**
   * 위험도 색상
   */
  const getRiskColor = (level: string) => {
    switch (level) {
      case "high":
        return "#FF3B30";
      case "medium":
        return "#FF9500";
      case "low":
        return "#FFCC00";
      default:
        return "#8E8E93";
    }
  };

  /**
   * 위험도 아이콘
   */
  const getRiskIcon = (level: string) => {
    switch (level) {
      case "high":
        return "alert-circle";
      case "medium":
        return "alert-triangle";
      case "low":
        return "alert-octagon";
      default:
        return "help-circle";
    }
  };

  /**
   * 알림 아이템 렌더링
   */
  const renderAlertItem = ({ item }: { item: PhishingAlert }) => (
    <TouchableOpacity
      style={styles.alertCard}
      onPress={() => {
        setSelectedAlert(item);
        setShowDetailModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.alertHeader}>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: getRiskColor(item.riskLevel) },
          ]}
        >
          <Ionicons name={getRiskIcon(item.riskLevel)} size={16} color="#FFF" />
          <Text style={styles.riskBadgeText}>
            {item.riskLevel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.alertTime}>
          {formatDistanceToNow(new Date(item.timestamp), {
            addSuffix: true,
            locale: ko,
          })}
        </Text>
      </View>

      <View style={styles.alertContent}>
        <Text style={styles.alertSender}>{item.sender}</Text>
        <Text style={styles.alertMessage} numberOfLines={2}>
          {item.message}
        </Text>
        {item.detectionReasons.length > 0 && (
          <View style={styles.alertReasons}>
            <Ionicons name="shield-checkmark" size={12} color="#8E8E93" />
            <Text style={styles.alertReasonText}>
              {item.detectionReasons[0]}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.alertActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => addToWhitelist(item.sender)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.actionText}>안전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteAlert(item.smsId)}
        >
          <Ionicons name="trash" size={20} color="#FF3B30" />
          <Text style={styles.actionText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  /**
   * 통계 카드 컴포넌트
   */
  const StatCard = ({
    title,
    value,
    icon,
    color,
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <FontAwesome5 name={icon} size={16} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>
        {value.toLocaleString()}
      </Text>
    </View>
  );

  /**
   * 상세 모달
   */
  const DetailModal = () => (
    <Modal
      visible={showDetailModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {selectedAlert && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>피싱 메시지 상세</Text>
                <TouchableOpacity
                  onPress={() => setShowDetailModal(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>발신자</Text>
                  <Text style={styles.detailValue}>{selectedAlert.sender}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>위험도</Text>
                  <View
                    style={[
                      styles.riskBadge,
                      {
                        backgroundColor: getRiskColor(selectedAlert.riskLevel),
                      },
                    ]}
                  >
                    <Text style={styles.riskBadgeText}>
                      {selectedAlert.riskLevel.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>위험 점수</Text>
                  <Text style={styles.detailValue}>
                    {(selectedAlert.riskScore * 100).toFixed(1)}%
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>메시지 내용</Text>
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>
                      {selectedAlert.message}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>탐지 이유</Text>
                  {selectedAlert.detectionReasons.map((reason, index) => (
                    <View key={index} style={styles.reasonItem}>
                      <Ionicons name="warning" size={16} color="#FF9500" />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>

                {selectedAlert.location && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>수신 위치</Text>
                    <Text style={styles.detailValue}>
                      위도: {selectedAlert.location.latitude.toFixed(6)}
                      {"\n"}
                      경도: {selectedAlert.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>수신 시간</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedAlert.timestamp).toLocaleString("ko-KR")}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.safeButton]}
                  onPress={() => {
                    addToWhitelist(selectedAlert.sender);
                    setShowDetailModal(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>안전한 번호로 등록</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.blockButton]}
                  onPress={() => {
                    // TODO: 차단 기능
                    setShowDetailModal(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>번호 차단</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>피싱 가드 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <LinearGradient
        colors={["#007AFF", "#0051D5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>SMS 피싱 가드</Text>
          <TouchableOpacity
            style={[
              styles.monitoringButton,
              isMonitoring && styles.monitoringButtonActive,
            ]}
            onPress={toggleMonitoring}
          >
            <Animated.View
              style={{
                transform: [{ scale: isMonitoring ? pulseAnim : 1 }],
              }}
            >
              <Ionicons
                name={isMonitoring ? "shield-checkmark" : "shield-outline"}
                size={24}
                color="#FFF"
              />
            </Animated.View>
            <Text style={styles.monitoringButtonText}>
              {isMonitoring ? "보호 중" : "보호 시작"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 실시간 상태 */}
        {isMonitoring && (
          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>실시간 SMS 모니터링 활성화</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 통계 섹션 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>오늘의 통계</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statsScroll}
          >
            <StatCard
              title="검사된 메시지"
              value={statistics.totalScanned}
              icon="search"
              color="#007AFF"
            />
            <StatCard
              title="피싱 감지"
              value={statistics.phishingDetected}
              icon="shield-alt"
              color="#FF3B30"
            />
            <StatCard
              title="고위험"
              value={statistics.highRiskCount}
              icon="exclamation-triangle"
              color="#FF3B30"
            />
            <StatCard
              title="중위험"
              value={statistics.mediumRiskCount}
              icon="exclamation-circle"
              color="#FF9500"
            />
            <StatCard
              title="저위험"
              value={statistics.lowRiskCount}
              icon="info-circle"
              color="#FFCC00"
            />
          </ScrollView>
        </View>

        {/* 필터 탭 */}
        <View style={styles.filterTabs}>
          {["all", "high", "medium", "low"].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.filterTab,
                filterLevel === level && styles.filterTabActive,
              ]}
              onPress={() => setFilterLevel(level as any)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterLevel === level && styles.filterTabTextActive,
                ]}
              >
                {level === "all"
                  ? "전체"
                  : level === "high"
                  ? "고위험"
                  : level === "medium"
                  ? "중위험"
                  : "저위험"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 피싱 알림 목록 */}
        <View style={styles.alertsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>피싱 의심 메시지</Text>
            <Text style={styles.alertCount}>
              {getFilteredAlerts().length}건
            </Text>
          </View>

          {getFilteredAlerts().length > 0 ? (
            <FlatList
              data={getFilteredAlerts()}
              renderItem={renderAlertItem}
              keyExtractor={(item) => item.smsId}
              scrollEnabled={false}
              contentContainerStyle={styles.alertsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark" size={64} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>피싱 메시지가 없습니다</Text>
              <Text style={styles.emptyText}>
                의심스러운 메시지가 감지되면 여기에 표시됩니다
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 상세 모달 */}
      <DetailModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#8E8E93",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
  },
  monitoringButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  monitoringButtonActive: {
    backgroundColor: "rgba(52, 199, 89, 0.3)",
  },
  monitoringButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34C759",
    marginRight: 8,
  },
  statusText: {
    color: "#FFF",
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  statsSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  statsScroll: {
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 15,
    marginRight: 12,
    minWidth: 120,
    borderLeftWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 12,
    color: "#8E8E93",
    marginLeft: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FFF",
    marginRight: 10,
  },
  filterTabActive: {
    backgroundColor: "#007AFF",
  },
  filterTabText: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  filterTabTextActive: {
    color: "#FFF",
  },
  alertsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  alertCount: {
    fontSize: 14,
    color: "#8E8E93",
  },
  alertsList: {
    paddingBottom: 20,
  },
  alertCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
  },
  alertTime: {
    fontSize: 12,
    color: "#8E8E93",
  },
  alertContent: {
    marginBottom: 10,
  },
  alertSender: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
  },
  alertReasons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  alertReasonText: {
    fontSize: 12,
    color: "#8E8E93",
    marginLeft: 4,
  },
  alertActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  actionText: {
    fontSize: 12,
    color: "#3C3C43",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3C3C43",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalClose: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 16,
    color: "#000",
  },
  messageBox: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  messageText: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  reasonText: {
    fontSize: 14,
    color: "#3C3C43",
    marginLeft: 8,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  safeButton: {
    backgroundColor: "#34C759",
  },
  blockButton: {
    backgroundColor: "#FF3B30",
  },
  modalButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
