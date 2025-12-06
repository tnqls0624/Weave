import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SchedulePhoto } from "../types";
import {
  useSchedulePhotos,
  useUploadSchedulePhoto,
  useDeleteSchedulePhoto,
} from "../services/queries";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 16) / 3; // 3열, 패딩 고려 (카드뷰)
const PHOTO_SIZE_FULLSCREEN = (SCREEN_WIDTH - 32 - 8) / 3; // 3열, 전체화면

interface SchedulePhotoAlbumProps {
  scheduleId: string;
  currentUserId: string;
  isFullScreen?: boolean;
  onPhotoCountChange?: (count: number) => void;
}

const SchedulePhotoAlbum: React.FC<SchedulePhotoAlbumProps> = ({
  scheduleId,
  currentUserId,
  isFullScreen = false,
  onPhotoCountChange,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<SchedulePhoto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const { data: photos = [], isLoading } = useSchedulePhotos(scheduleId);
  const uploadPhotoMutation = useUploadSchedulePhoto();
  const deletePhotoMutation = useDeleteSchedulePhoto();

  // 사진 수 변경 시 부모에게 알림 (로딩 중에는 호출하지 않음)
  useEffect(() => {
    if (onPhotoCountChange && !isLoading) {
      onPhotoCountChange(photos.length);
    }
  }, [photos.length, onPhotoCountChange, isLoading]);

  // 여러 장 선택 가능
  const handlePickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        exif: false,
        base64: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        handleUploadPhotos(result.assets.map(asset => asset.uri));
      }
    } catch (error: any) {
      console.error("Image picker error:", error);
      if (error?.code === "ERR_FAILED_TO_READ_IMAGE") {
        Alert.alert(
          "사진을 불러올 수 없음",
          "iCloud에서 다운로드되지 않은 사진일 수 있습니다. 사진 앱에서 먼저 다운로드해주세요."
        );
      } else {
        Alert.alert("오류", "사진을 불러올 수 없습니다.");
      }
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        handleUploadPhotos([result.assets[0].uri]);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("오류", "카메라를 사용할 수 없습니다.");
    }
  };

  const handleUploadPhotos = async (imageUris: string[]) => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: imageUris.length });

    try {
      for (let i = 0; i < imageUris.length; i++) {
        setUploadProgress({ current: i + 1, total: imageUris.length });
        await uploadPhotoMutation.mutateAsync({
          scheduleId,
          imageUri: imageUris[i],
        });
      }
    } catch (error) {
      Alert.alert("오류", "일부 사진 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const handleDeletePhoto = (photo: SchedulePhoto) => {
    Alert.alert("사진 삭제", "이 사진을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePhotoMutation.mutateAsync({
              scheduleId,
              photoId: photo.id,
            });
            setSelectedPhoto(null);
          } catch (error) {
            Alert.alert("오류", "사진 삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const showAddOptions = () => {
    Alert.alert("사진 추가", "사진을 어디서 가져올까요?", [
      { text: "취소", style: "cancel" },
      { text: "카메라로 촬영", onPress: handleTakePhoto },
      { text: "갤러리에서 선택", onPress: handlePickImages },
    ]);
  };

  const openPhotoViewer = (photo: SchedulePhoto, index: number) => {
    setSelectedPhoto(photo);
    setSelectedIndex(index);
  };

  const goToPreviousPhoto = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setSelectedPhoto(photos[selectedIndex - 1]);
    }
  };

  const goToNextPhoto = () => {
    if (selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setSelectedPhoto(photos[selectedIndex + 1]);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const photoSize = isFullScreen ? PHOTO_SIZE_FULLSCREEN : PHOTO_SIZE;

  return (
    <ScrollView
      style={[
        styles.container,
        isFullScreen && styles.containerFullScreen,
      ]}
      contentContainerStyle={isFullScreen && styles.contentFullScreen}
      showsVerticalScrollIndicator={false}
    >
      {/* 헤더 - 전체화면 모드가 아닐 때만 표시 */}
      {!isFullScreen && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="images-outline" size={18} color="#6B7280" />
            <Text style={styles.headerTitle}>사진</Text>
          </View>
          {photos.length > 0 && (
            <Text style={styles.photoBadgeText}>{photos.length}</Text>
          )}
        </View>
      )}

      {/* 사진 그리드 */}
      {isLoading ? (
        <View style={[styles.loadingContainer, isFullScreen && styles.loadingContainerFullScreen]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : photos.length === 0 ? (
        <View style={[styles.emptyContainer, isFullScreen && styles.emptyContainerFullScreen]}>
          <Pressable
            style={({ pressed }) => [
              styles.emptyAddButton,
              isFullScreen && styles.emptyAddButtonFullScreen,
              pressed && styles.emptyAddButtonPressed,
            ]}
            onPress={showAddOptions}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.uploadingText}>
                  {uploadProgress.current}/{uploadProgress.total}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="images-outline" size={isFullScreen ? 40 : 28} color="#9CA3AF" />
                <Text style={[styles.emptyTitle, isFullScreen && styles.emptyTitleFullScreen]}>
                  사진 없음
                </Text>
                {isFullScreen && (
                  <Text style={styles.emptySubtitleFullScreen}>
                    탭하여 추가
                  </Text>
                )}
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.gridContainer, isFullScreen && styles.gridContainerFullScreen]}>
          {/* 사진 추가 버튼 */}
          <Pressable
            style={({ pressed }) => [
              styles.photoItem,
              { width: photoSize, height: photoSize },
              styles.addPhotoButton,
              pressed && styles.addPhotoButtonPressed,
            ]}
            onPress={showAddOptions}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadingSmall}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.uploadingSmallText}>
                  {uploadProgress.current}/{uploadProgress.total}
                </Text>
              </View>
            ) : (
              <Ionicons name="add" size={24} color="#9CA3AF" />
            )}
          </Pressable>

          {/* 사진 목록 */}
          {photos.map((photo: SchedulePhoto, index: number) => (
            <Pressable
              key={photo.id}
              style={({ pressed }) => [
                styles.photoItem,
                { width: photoSize, height: photoSize },
                pressed && styles.photoItemPressed,
              ]}
              onPress={() => openPhotoViewer(photo, index)}
            >
              <Image
                source={{ uri: photo.thumbnailUrl || photo.url }}
                style={styles.photoImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* 사진 상세 모달 (갤러리 뷰어) */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          {/* 헤더 */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.modalCounter}>
              {selectedIndex + 1} / {photos.length}
            </Text>

            {selectedPhoto?.uploadedBy === currentUserId && (
              <Pressable
                style={styles.modalDeleteButton}
                onPress={() => selectedPhoto && handleDeletePhoto(selectedPhoto)}
              >
                <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </View>

          {/* 이미지 */}
          {selectedPhoto && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {/* 이전/다음 버튼 */}
              {photos.length > 1 && (
                <>
                  {selectedIndex > 0 && (
                    <Pressable
                      style={[styles.navButton, styles.navButtonLeft]}
                      onPress={goToPreviousPhoto}
                    >
                      <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
                    </Pressable>
                  )}
                  {selectedIndex < photos.length - 1 && (
                    <Pressable
                      style={[styles.navButton, styles.navButtonRight]}
                      onPress={goToNextPhoto}
                    >
                      <Ionicons name="chevron-forward" size={32} color="#FFFFFF" />
                    </Pressable>
                  )}
                </>
              )}

              {/* 사진 정보 */}
              <View style={[styles.photoInfo, { paddingBottom: insets.bottom + 20 }]}>
                {selectedPhoto.uploadedByName && (
                  <Text style={styles.uploaderName}>
                    {selectedPhoto.uploadedByName}
                  </Text>
                )}
                <Text style={styles.uploadDate}>
                  {formatDate(selectedPhoto.uploadedAt)}
                </Text>
              </View>
            </View>
          )}

          {/* 썸네일 스크롤 */}
          {photos.length > 1 && (
            <View style={styles.thumbnailContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailScroll}
              >
                {photos.map((photo: SchedulePhoto, index: number) => (
                  <Pressable
                    key={photo.id}
                    style={[
                      styles.thumbnailItem,
                      index === selectedIndex && styles.thumbnailItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedPhoto(photo);
                      setSelectedIndex(index);
                    }}
                  >
                    <Image
                      source={{ uri: photo.thumbnailUrl || photo.url }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerFullScreen: {
    flex: 1,
    borderRadius: 0,
    margin: 0,
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  contentFullScreen: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  photoBadgeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  loadingContainerFullScreen: {
    paddingVertical: 80,
  },
  emptyContainer: {
    paddingVertical: 4,
  },
  emptyContainerFullScreen: {
    flex: 1,
    paddingTop: 80,
  },
  emptyAddButton: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  emptyAddButtonFullScreen: {
    paddingVertical: 48,
    marginHorizontal: 20,
    borderRadius: 12,
  },
  emptyAddButtonPressed: {
    backgroundColor: "#F3F4F6",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 8,
  },
  emptyTitleFullScreen: {
    fontSize: 15,
    marginTop: 12,
  },
  emptySubtitleFullScreen: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  uploadingContainer: {
    alignItems: "center",
  },
  uploadingText: {
    fontSize: 13,
    color: "#007AFF",
    marginTop: 8,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  gridContainerFullScreen: {
    marginHorizontal: -2,
  },
  photoItem: {
    margin: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoItemPressed: {
    opacity: 0.8,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  addPhotoButton: {
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  addPhotoButtonPressed: {
    backgroundColor: "#F3F4F6",
  },
  uploadingSmall: {
    alignItems: "center",
  },
  uploadingSmallText: {
    fontSize: 11,
    color: "#007AFF",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalDeleteButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  photoInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: "center",
  },
  uploaderName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  uploadDate: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
  },
  thumbnailContainer: {
    paddingVertical: 16,
  },
  thumbnailScroll: {
    paddingHorizontal: 16,
  },
  thumbnailItem: {
    width: 60,
    height: 60,
    marginRight: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailItemSelected: {
    borderColor: "#FFFFFF",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
});

export default SchedulePhotoAlbum;
