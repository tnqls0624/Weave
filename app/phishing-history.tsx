/**
 * 피싱 신고 히스토리 화면
 * 사용자의 전체 피싱 신고 내역 조회
 */

import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiService } from "../services/api";

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
  autoBlocked: boolean;
}

type FilterType = "all" | "high" | "medium" | "low";

export default function PhishingHistoryScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<PhishingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoading(true);
      }

      const response = await apiService.getMyPhishingReports({
        page: refresh ? 0 : page,
        size: 20,
      });

      if (refresh) {
        setReports(response.content);
      } else {
        setReports((prev) => [...prev, ...response.content]);
      }

      setHasMore(!response.last);
      if (!refresh) {
        setPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error("피싱 히스토리 로드 실패:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadReports(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadReports();
    }
  };

  const filteredReports = reports.filter((report) => {
    if (filter === "all") return true;
    return report.riskLevel.toLowerCase() === filter;
  });

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#10B981";
      default:
        return "#6B7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const renderReportItem = ({ item }: { item: PhishingReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => {
        // TODO: Navigate to detail screen
      }}
    >
      <View style={styles.reportHeader}>
        <View style={styles.riskBadge}>
          <View
            style={[
              styles.riskDot,
              { backgroundColor: getRiskColor(item.riskLevel) },
            ]}
          />
          <Text
            style={[
              styles.riskText,
              { color: getRiskColor(item.riskLevel) },
            ]}
          >
            {item.riskLevel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
      </View>

      <View style={styles.reportContent}>
        <View style={styles.senderRow}>
          <Ionicons name="person-outline" size={16} color="#6B7280" />
          <Text style={styles.sender}>{item.sender}</Text>
          {item.autoBlocked && (
            <View style={styles.blockedBadge}>
              <MaterialIcons name="block" size={12} color="#FFFFFF" />
              <Text style={styles.blockedText}>차단됨</Text>
            </View>
          )}
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>

        {item.phishingType && (
          <View style={styles.typeRow}>
            <Ionicons name="pricetag-outline" size={14} color="#9CA3AF" />
            <Text style={styles.typeText}>{item.phishingType}</Text>
          </View>
        )}
      </View>

      <View style={styles.reportFooter}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>위험도</Text>
          <View style={styles.scoreBar}>
            <View
              style={[
                styles.scoreFill,
                {
                  width: `${item.riskScore * 100}%`,
                  backgroundColor: getRiskColor(item.riskLevel),
                },
              ]}
            />
          </View>
          <Text style={styles.scoreValue}>
            {(item.riskScore * 100).toFixed(0)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>피싱 신고 내역이 없습니다</Text>
      <Text style={styles.emptyText}>
        {filter === "all"
          ? "아직 피싱으로 탐지된 메시지가 없습니다."
          : `${filter.toUpperCase()} 위험도의 신고 내역이 없습니다.`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>피싱 신고 내역</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
        {(
          [
            { key: "all", label: "전체" },
            { key: "high", label: "고위험" },
            { key: "medium", label: "중위험" },
            { key: "low", label: "저위험" },
          ] as const
        ).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.filterButton,
              filter === item.key && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(item.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.key && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{filteredReports.length}</Text>
          <Text style={styles.statLabel}>신고 건수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {reports.filter((r) => r.autoBlocked).length}
          </Text>
          <Text style={styles.statLabel}>자동 차단</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {reports.filter((r) => r.riskLevel === "high").length}
          </Text>
          <Text style={styles.statLabel}>고위험</Text>
        </View>
      </View>

      {/* List */}
      {loading && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            loading && reports.length > 0 ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color="#3B82F6" />
              </View>
            ) : null
          }
        />
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
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
  },
  filterButtonActive: {
    backgroundColor: "#3B82F6",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 12,
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reportContent: {
    gap: 8,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sender: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  blockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: "#EF4444",
    borderRadius: 4,
  },
  blockedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reportFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: "#6B7280",
    width: 40,
  },
  scoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 3,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    width: 30,
    textAlign: "right",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
});
