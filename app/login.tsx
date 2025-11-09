import { apiService } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { setTokens } = useAppStore();
  const router = useRouter();

  const handleTestLogin = async () => {
    setIsLoading(true);
    try {
      // 테스트용 accessToken
      const testAccessToken = process.env.EXPO_PUBLIC_TEST_ACCESS_TOKEN || "";

      const testRefreshToken = "test-refresh-token"; // Refresh token은 실제로는 백엔드에서 받아야 함

      // Zustand에 토큰 저장
      setTokens(testAccessToken, testRefreshToken);

      // ApiService에도 즉시 토큰 설정 (동기화)
      apiService.setTokens(testAccessToken, testRefreshToken);

      // 약간의 지연 후 메인 화면으로 이동
      setTimeout(() => {
        setIsLoading(false);
        router.replace("/(tabs)/calendar");
      }, 500);
    } catch (error) {
      setIsLoading(false);
      Alert.alert("로그인 실패", "다시 시도해주세요.");
      console.error("Login error:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 로고 영역 */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Weave</Text>
          <Text style={styles.subtitle}>함께 만드는 우리의 일정</Text>
        </View>

        {/* 로그인 버튼 영역 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>테스트 로그인</Text>
            )}
          </TouchableOpacity>

          {/* 개발용 표시 */}
          <Text style={styles.devNote}>개발 환경용 테스트 로그인</Text>

          {/* 추후 소셜 로그인 버튼들 */}
          <View style={styles.socialButtonsPlaceholder}>
            <Text style={styles.placeholderText}>
              소셜 로그인 (추후 구현 예정)
            </Text>
            <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledText]}>
                Google 로그인
              </Text>
            </View>
            <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledText]}>
                Apple 로그인
              </Text>
            </View>
            <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledText]}>
                Kakao 로그인
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 80,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 400,
  },
  button: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: "#007AFF",
  },
  disabledButton: {
    backgroundColor: "#E0E0E0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledText: {
    color: "#999",
  },
  devNote: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    marginBottom: 40,
  },
  socialButtonsPlaceholder: {
    width: "100%",
    opacity: 0.5,
  },
  placeholderText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginBottom: 16,
  },
});
