import { apiService } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { Ionicons } from "@expo/vector-icons";
import { login } from "@react-native-kakao/user";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoadingProvider = "test" | "kakao" | "apple" | null;

export default function LoginScreen() {
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [isAppleLoginAvailable, setIsAppleLoginAvailable] = useState(false);
  const { setTokens } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    // Apple 로그인 가능 여부 확인 (iOS 13+ 에서만 가능)
    const checkAppleLogin = async () => {
      if (Platform.OS === "ios") {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setIsAppleLoginAvailable(isAvailable);
      }
    };
    checkAppleLogin();
  }, []);

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

  const handleAppleLogin = useCallback(async () => {
    setLoadingProvider("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple 인증 토큰을 가져오지 못했습니다.");
      }

      const authResponse = await apiService.socialLogin(
        "APPLE",
        credential.identityToken
      );

      setTokens(authResponse.accessToken, authResponse.refreshToken);
      apiService.setTokens(authResponse.accessToken, authResponse.refreshToken);

      handleNavigationAfterLogin();
    } catch (error: any) {
      console.error("Apple login error:", error);
      if (error.code === "ERR_REQUEST_CANCELED") {
        // 사용자가 취소한 경우 무시
        return;
      }
      Alert.alert(
        "로그인 실패",
        "Apple 로그인에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoadingProvider(null);
    }
  }, [handleNavigationAfterLogin, setTokens]);

  const handleTestLogin = useCallback(async () => {
    if (!testEmail.trim() || !testPassword.trim()) {
      Alert.alert("입력 오류", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoadingProvider("test");
    try {
      const authResponse = await apiService.testLogin(
        testEmail.trim(),
        testPassword.trim()
      );

      setTokens(authResponse.accessToken, authResponse.refreshToken);
      apiService.setTokens(authResponse.accessToken, authResponse.refreshToken);

      handleNavigationAfterLogin();
    } catch (error: any) {
      console.error("Test login error:", error);
      Alert.alert("로그인 실패", "테스트 계정 정보가 올바르지 않습니다.");
    } finally {
      setLoadingProvider(null);
    }
  }, [testEmail, testPassword, handleNavigationAfterLogin, setTokens]);

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
        <View style={styles.buttonContainer}>
          {/* Apple 로그인 버튼 (iOS만) */}
          {Platform.OS === "ios" && isAppleLoginAvailable && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.appleButton,
                isLoading && styles.disabledButton,
              ]}
              onPress={handleAppleLogin}
              disabled={isLoading}
            >
              {loadingProvider === "apple" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.appleButtonText}>Apple로 로그인</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* 카카오 로그인 버튼 */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.kakaoButton,
              isLoading && styles.disabledButton,
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

          {/* 테스트 로그인 토글 버튼 */}
          <TouchableOpacity
            style={styles.testLoginToggle}
            onPress={() => setShowTestLogin(!showTestLogin)}
          >
            <Text style={styles.testLoginToggleText}>
              {showTestLogin
                ? "테스트 로그인 숨기기"
                : "테스트 계정으로 로그인"}
            </Text>
          </TouchableOpacity>

          {/* 테스트 로그인 폼 */}
          {showTestLogin && (
            <View style={styles.testLoginContainer}>
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor="#999"
                value={testEmail}
                onChangeText={setTestEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                placeholderTextColor="#999"
                value={testPassword}
                onChangeText={setTestPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.testButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleTestLogin}
                disabled={isLoading}
              >
                {loadingProvider === "test" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>로그인</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  appleButton: {
    backgroundColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  kakaoButton: {
    backgroundColor: "#FEE500",
  },
  kakaoButtonText: {
    color: "#3C1E1E",
    fontSize: 16,
    fontWeight: "600",
  },
  testButton: {
    backgroundColor: "#007AFF",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  testLoginToggle: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
  },
  testLoginToggleText: {
    color: "#666",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  testLoginContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
  },
  input: {
    width: "100%",
    height: 48,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    color: "#333",
  },
});
