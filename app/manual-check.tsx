/**
 * 수동 메시지 검사 화면
 * 사용자가 직접 SMS 메시지를 입력하여 피싱 여부를 검사
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiService } from "../services/api";

interface DetectionResult {
  isPhishing: boolean;
  riskScore: number;
  riskLevel: string;
  detectionReasons: string[];
  phishingType: string;
  confidence: number;
}

export default function ManualCheckScreen() {
  const router = useRouter();
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [sensitivityLevel, setSensitivityLevel] = useState<
    "high" | "medium" | "low"
  >("medium");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const handleCheck = async () => {
    if (!sender.trim() || !message.trim()) {
      Alert.alert("입력 오류", "발신자와 메시지 내용을 모두 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const response = await apiService.detectPhishing({
        sender: sender.trim(),
        message: message.trim(),
        sensitivityLevel,
      });

      setResult(response);
    } catch (error) {
      console.error("피싱 검사 실패:", error);
      Alert.alert(
        "검사 실패",
        "메시지 검사 중 오류가 발생했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSender("");
    setMessage("");
    setSensitivityLevel("medium");
    setResult(null);
  };

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

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case "high":
        return "alert-circle";
      case "medium":
        return "warning";
      case "low":
        return "information-circle";
      default:
        return "shield-checkmark";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>수동 메시지 검사</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text style={styles.infoText}>
              의심스러운 SMS 메시지를 입력하면 피싱 여부를 분석해드립니다.
            </Text>
          </View>

          {/* Input Form */}
          <View style={styles.form}>
            {/* 발신자 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>발신자 번호</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 010-1234-5678"
                placeholderTextColor="#9CA3AF"
                value={sender}
                onChangeText={setSender}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            {/* 메시지 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>메시지 내용</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="메시지 내용을 입력하세요"
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* 민감도 선택 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>검사 민감도</Text>
              <View style={styles.sensitivityContainer}>
                {(["high", "medium", "low"] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.sensitivityButton,
                      sensitivityLevel === level &&
                        styles.sensitivityButtonActive,
                    ]}
                    onPress={() => setSensitivityLevel(level)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.sensitivityText,
                        sensitivityLevel === level &&
                          styles.sensitivityTextActive,
                      ]}
                    >
                      {level === "high"
                        ? "높음"
                        : level === "medium"
                        ? "보통"
                        : "낮음"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sensitivityHint}>
                민감도가 높을수록 더 엄격하게 검사합니다
              </Text>
            </View>

            {/* 검사 버튼 */}
            <TouchableOpacity
              style={[
                styles.checkButton,
                loading && styles.checkButtonDisabled,
              ]}
              onPress={handleCheck}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.checkButtonText}>피싱 검사하기</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 초기화 버튼 */}
            {(sender || message || result) && !loading && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
              >
                <Text style={styles.resetButtonText}>초기화</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 검사 결과 */}
          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={getRiskIcon(result.riskLevel) as any}
                  size={32}
                  color={getRiskColor(result.riskLevel)}
                />
                <View style={styles.resultHeaderText}>
                  <Text style={styles.resultTitle}>
                    {result.isPhishing ? "⚠️ 피싱 의심" : "✅ 안전"}
                  </Text>
                  <Text
                    style={[
                      styles.resultRiskLevel,
                      { color: getRiskColor(result.riskLevel) },
                    ]}
                  >
                    위험도: {result.riskLevel.toUpperCase()} (
                    {(result.riskScore * 100).toFixed(0)}점)
                  </Text>
                </View>
              </View>

              {/* 신뢰도 */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>분석 신뢰도</Text>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${result.confidence * 100}%`,
                        backgroundColor: getRiskColor(result.riskLevel),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>
                  {(result.confidence * 100).toFixed(1)}%
                </Text>
              </View>

              {/* 피싱 유형 */}
              {result.phishingType && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>피싱 유형</Text>
                  <Text style={styles.resultValue}>{result.phishingType}</Text>
                </View>
              )}

              {/* 탐지 이유 */}
              {result.detectionReasons &&
                result.detectionReasons.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>탐지 이유</Text>
                    {result.detectionReasons.map((reason, index) => (
                      <View key={index} style={styles.reasonItem}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                )}

              {/* 권장 사항 */}
              <View style={styles.recommendationCard}>
                <Ionicons name="bulb" size={20} color="#F59E0B" />
                <Text style={styles.recommendationText}>
                  {result.isPhishing
                    ? "이 메시지는 피싱일 가능성이 높습니다. 링크를 클릭하거나 개인정보를 입력하지 마세요."
                    : "이 메시지는 안전한 것으로 보이지만, 항상 주의하세요."}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  keyboardView: {
    flex: 1,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  form: {
    padding: 16,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  messageInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  sensitivityContainer: {
    flexDirection: "row",
    gap: 8,
  },
  sensitivityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    alignItems: "center",
  },
  sensitivityButtonActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  sensitivityText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  sensitivityTextActive: {
    color: "#FFFFFF",
  },
  sensitivityHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  checkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  resultCard: {
    margin: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  resultHeaderText: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  resultRiskLevel: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultSection: {
    gap: 8,
  },
  resultSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  resultValue: {
    fontSize: 15,
    color: "#111827",
  },
  confidenceBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "right",
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  recommendationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
});
