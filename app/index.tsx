import { useAppStore } from "@/stores/appStore";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isAuthenticated } = useAppStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 인증 상태 체크 (비동기 스토리지에서 로드될 때까지 대기)
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 로딩 중에는 스피너 표시
  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 인증 상태에 따라 라우팅
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/calendar" />;
  }

  return <Redirect href="/login" />;
}
