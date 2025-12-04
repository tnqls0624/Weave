import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SchedulePhoto } from "../types";
import {
  useSchedulePhotos,
  useUploadSchedulePhoto,
  useDeleteSchedulePhoto,
} from "../services/queries";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 8) / 3; // 3열, 패딩 고려

interface SchedulePhotoAlbumProps {
  scheduleId: string;
  currentUserId: string;
}

const SchedulePhotoAlbum: React.FC<SchedulePhotoAlbumProps> = ({
  scheduleId,
  currentUserId,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<SchedulePhoto | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: photos = [], isLoading } = useSchedulePhotos(scheduleId);
  const uploadPhotoMutation = useUploadSchedulePhoto();
  const deletePhotoMutation = useDeleteSchedulePhoto();

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleUploadPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleUploadPhoto(result.assets[0].uri);
    }
  };

  const handleUploadPhoto = async (imageUri: string) => {
    setIsUploading(true);
    try {
      await uploadPhotoMutation.mutateAsync({
        scheduleId,
        imageUri,
      });
    } catch (error) {
      Alert.alert("오류", "사진 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
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
      { text: "카메라", onPress: handleTakePhoto },
      { text: "갤러리", onPress: handlePickImage },
    ]);
  };

  const renderPhoto = ({ item }: { item: SchedulePhoto }) => (
    <Pressable
      style={styles.photoItem}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image
        source={{ uri: item.thumbnailUrl || item.url }}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </Pressable>
  );

  const renderAddButton = () => (
    <Pressable
      style={[styles.photoItem, styles.addPhotoButton]}
      onPress={showAddOptions}
      disabled={isUploading}
    >
      {isUploading ? (
        <ActivityIndicator size="small" color="#9CA3AF" />
      ) : (
        <>
          <Ionicons name="add" size={32} color="#9CA3AF" />
          <Text style={styles.addPhotoText}>추가</Text>
        </>
      )}
    </Pressable>
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={20} color="#374151" />
          <Text style={styles.headerTitle}>사진 앨범</Text>
        </View>
        <Text style={styles.photoCount}>{photos.length}장</Text>
      </View>

      {/* 사진 그리드 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {renderAddButton()}
          {photos.map((photo: SchedulePhoto) => (
            <View key={photo.id}>
              {renderPhoto({ item: photo })}
            </View>
          ))}
        </View>
      )}

      {/* 사진 상세 모달 */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            {selectedPhoto?.uploadedBy === currentUserId && (
              <Pressable
                style={styles.modalDeleteButton}
                onPress={() => selectedPhoto && handleDeletePhoto(selectedPhoto)}
              >
                <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </View>

          {selectedPhoto && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.photoInfo}>
                {selectedPhoto.uploadedByName && (
                  <Text style={styles.uploaderName}>
                    {selectedPhoto.uploadedByName}
                  </Text>
                )}
                <Text style={styles.uploadDate}>
                  {formatDate(selectedPhoto.uploadedAt)}
                </Text>
                {selectedPhoto.caption && (
                  <Text style={styles.caption}>{selectedPhoto.caption}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  photoCount: {
    fontSize: 13,
    color: "#6B7280",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  addPhotoButton: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  addPhotoText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
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
    height: SCREEN_WIDTH,
  },
  photoInfo: {
    padding: 16,
    alignItems: "center",
  },
  uploaderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  uploadDate: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  caption: {
    fontSize: 14,
    color: "#D1D5DB",
    marginTop: 12,
    textAlign: "center",
  },
});

export default SchedulePhotoAlbum;
