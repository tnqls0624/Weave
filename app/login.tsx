import { apiService } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { login } from "@react-native-kakao/user";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoadingProvider = "test" | "kakao" | null;

export default function LoginScreen() {
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);
  const { setTokens } = useAppStore();
  const router = useRouter();

  const handleNavigationAfterLogin = useCallback(() => {
    router.replace("/(tabs)/calendar");
  }, [router]);

  const handleKakaoLogin = useCallback(async () => {
    setLoadingProvider("kakao");
    try {
      let kakaoToken = null;

      try {
        kakaoToken = await login();
        console.log("kakaoToken:::::::", kakaoToken);
      } catch (loginError) {
        console.warn(
          "Primary Kakao login attempt failed, retrying without KakaoTalk:",
          loginError
        );
        kakaoToken = await login({ throughTalk: false });
      }

      if (!kakaoToken?.accessToken) {
        throw new Error("카카오 토큰을 가져오지 못했습니다.");
      }

      const { accessToken: kakaoAccessToken } = kakaoToken;

      const authResponse = await apiService.socialLogin(
        "KAKAO",
        kakaoAccessToken
      );

      setTokens(authResponse.accessToken, authResponse.refreshToken);
      apiService.setTokens(authResponse.accessToken, authResponse.refreshToken);

      handleNavigationAfterLogin();
    } catch (error: any) {
      console.error("Kakao login error:", error);
      const message =
        error?.message === "E_CANCELLED_OPERATION"
          ? "카카오 로그인이 취소되었습니다."
          : "카카오 로그인에 실패했습니다. 다시 시도해주세요.";
      Alert.alert("로그인 실패", message);
    } finally {
      setLoadingProvider(null);
    }
  }, [handleNavigationAfterLogin, setTokens]);

  const isLoading = loadingProvider !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 로고 영역 */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>모두의캘린더</Text>
          <Text style={styles.subtitle}>함께 만드는 우리의 일정</Text>
        </View>

        {/* 로그인 버튼 영역 */}
        {/* <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestLogin}
            disabled={isLoading}
          >
            {loadingProvider === "test" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>테스트 로그인</Text>
            )}
          </TouchableOpacity> */}

        <TouchableOpacity
          style={[
            styles.button,
            styles.kakaoButton,
            loadingProvider && styles.disabledButton,
          ]}
          onPress={handleKakaoLogin}
          disabled={isLoading}
        >
          {loadingProvider === "kakao" ? (
            <ActivityIndicator color="#3C1E1E" />
          ) : (
            <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
          )}
        </TouchableOpacity>

        {/* 개발용 표시 */}
        {/* <Text style={styles.devNote}>개발 환경용 테스트 로그인</Text> */}

        {/* 추후 소셜 로그인 버튼들 */}
        <View style={styles.socialButtonsPlaceholder}>
          {/* <Text style={styles.placeholderText}>소셜 로그인</Text> */}
          {/* <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledText]}>
                Google 로그인
              </Text>
            </View>
            <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledText]}>
                Apple 로그인
              </Text>
            </View> */}
          {/* <View style={[styles.button, styles.disabledButton]}>
            <Text style={[styles.buttonText, styles.disabledText]}>
              Kakao 로그인
            </Text>
          </View> */}
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
    fontSize: 40,
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
  kakaoButton: {
    backgroundColor: "#FEE500",
  },
  kakaoButtonText: {
    color: "#3C1E1E",
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
