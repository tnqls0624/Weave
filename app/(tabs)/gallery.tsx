import GalleryView from "@/components/GalleryView";
import { useWorkspaceGallery } from "@/services/queries";
import { useAppStore } from "@/stores";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeWorkspaceId, setCalendarDate, setDetailDrawerDate } =
    useAppStore();

  const {
    data: photos = [],
    isLoading,
    error,
  } = useWorkspaceGallery(activeWorkspaceId, {
    enabled: !!activeWorkspaceId,
  });

  const handleSchedulePress = (scheduleId: string) => {
    // 해당 스케줄의 날짜로 캘린더 이동
    const photo = photos.find((p) => p.scheduleId === scheduleId);
    if (photo?.scheduleDate) {
      const eventDate = dayjs(photo.scheduleDate).toDate();
      setCalendarDate(eventDate);
      setDetailDrawerDate(eventDate);
    }
    router.push("/(tabs)/calendar");
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text>갤러리를 불러오는 중 오류가 발생했습니다</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <GalleryView photos={photos} onSchedulePress={handleSchedulePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});
