import { MaterialIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GalleryPhoto } from "../services/api";

dayjs.locale("ko");

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface GalleryViewProps {
  photos: GalleryPhoto[];
  onPhotoPress?: (photo: GalleryPhoto) => void;
  onSchedulePress?: (scheduleId: string) => void;
}

interface PhotoItemProps {
  photo: GalleryPhoto;
  onPress: (photo: GalleryPhoto) => void;
}

const PhotoItem = memo<PhotoItemProps>(({ photo, onPress }) => {
  return (
    <Pressable
      onPress={() => onPress(photo)}
      style={({ pressed }) => [
        styles.photoItem,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Image
        source={{ uri: photo.thumbnailUrl || photo.url }}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </Pressable>
  );
});

PhotoItem.displayName = "PhotoItem";

interface PhotoDetailModalProps {
  visible: boolean;
  photo: GalleryPhoto | null;
  onClose: () => void;
  onSchedulePress?: (scheduleId: string) => void;
}

const PhotoDetailModal = memo<PhotoDetailModalProps>(
  ({ visible, photo, onClose, onSchedulePress }) => {
    const insets = useSafeAreaInsets();

    if (!photo) return null;

    const formattedDate = photo.scheduleDate
      ? dayjs(photo.scheduleDate).format("YYYY년 MM월 DD일")
      : "";

    const formattedUploadDate = photo.uploadedAt
      ? dayjs(photo.uploadedAt).format("YYYY.MM.DD HH:mm")
      : "";

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={onClose} />

          <View style={[styles.modalContent, { paddingTop: insets.top + 16 }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            {/* Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: photo.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>

            {/* Info */}
            <View
              style={[styles.photoInfo, { paddingBottom: insets.bottom + 16 }]}
            >
              {photo.scheduleTitle && (
                <Pressable
                  style={styles.scheduleLink}
                  onPress={() => {
                    if (onSchedulePress && photo.scheduleId) {
                      onSchedulePress(photo.scheduleId);
                      onClose();
                    }
                  }}
                >
                  <MaterialIcons name="event" size={18} color="#60a5fa" />
                  <Text style={styles.scheduleTitle}>{photo.scheduleTitle}</Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={18}
                    color="#60a5fa"
                  />
                </Pressable>
              )}

              <View style={styles.metaInfo}>
                {formattedDate && (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="calendar-today" size={14} color="#9ca3af" />
                    <Text style={styles.metaText}>{formattedDate}</Text>
                  </View>
                )}

                {photo.uploadedByName && (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="person" size={14} color="#9ca3af" />
                    <Text style={styles.metaText}>
                      {photo.uploadedByName} 님이 업로드
                    </Text>
                  </View>
                )}

                {formattedUploadDate && (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="access-time" size={14} color="#9ca3af" />
                    <Text style={styles.metaText}>{formattedUploadDate}</Text>
                  </View>
                )}
              </View>

              {photo.caption && (
                <Text style={styles.caption}>{photo.caption}</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

PhotoDetailModal.displayName = "PhotoDetailModal";

const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  onPhotoPress,
  onSchedulePress,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 월별로 그룹화
  const groupedPhotos = useMemo(() => {
    const groups: { [key: string]: { title: string; photos: GalleryPhoto[] } } =
      {};

    photos.forEach((photo) => {
      const date = photo.scheduleDate || photo.uploadedAt;
      if (!date) return;

      const monthKey = dayjs(date).format("YYYY-MM");
      const monthTitle = dayjs(date).format("YYYY년 MM월");

      if (!groups[monthKey]) {
        groups[monthKey] = {
          title: monthTitle,
          photos: [],
        };
      }

      groups[monthKey].photos.push(photo);
    });

    // 최신순으로 정렬
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => ({
        key,
        ...data,
      }));
  }, [photos]);

  const handlePhotoPress = useCallback(
    (photo: GalleryPhoto) => {
      if (onPhotoPress) {
        onPhotoPress(photo);
      } else {
        setSelectedPhoto(photo);
        setModalVisible(true);
      }
    },
    [onPhotoPress]
  );

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedPhoto(null);
  }, []);

  const renderPhoto = useCallback(
    ({ item }: { item: GalleryPhoto }) => (
      <PhotoItem photo={item} onPress={handlePhotoPress} />
    ),
    [handlePhotoPress]
  );

  const renderSection: ListRenderItem<(typeof groupedPhotos)[0]> = useCallback(
    ({ item: group }) => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{group.photos.length}장</Text>
          </View>
        </View>
        <FlatList
          data={group.photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          scrollEnabled={false}
          columnWrapperStyle={styles.row}
        />
      </View>
    ),
    [renderPhoto]
  );

  const keyExtractor = useCallback(
    (item: (typeof groupedPhotos)[0]) => item.key,
    []
  );

  const ListHeaderComponent = useCallback(
    () => <Text style={styles.mainTitle}>갤러리</Text>,
    []
  );

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <MaterialIcons name="photo-library" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>사진이 없습니다</Text>
        <Text style={styles.emptySubtext}>
          일정에서 사진을 추가해보세요
        </Text>
      </View>
    ),
    []
  );

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        data={groupedPhotos}
        renderItem={renderSection}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={5}
        windowSize={10}
      />

      <PhotoDetailModal
        visible={modalVisible}
        photo={selectedPhoto}
        onClose={handleCloseModal}
        onSchedulePress={onSchedulePress}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
  },
  sectionBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  row: {
    paddingHorizontal: GAP,
    gap: GAP,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: GAP,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e5e7eb",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 17,
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  photoInfo: {
    padding: 16,
  },
  scheduleLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(96, 165, 250, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  scheduleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#60a5fa",
  },
  metaInfo: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  caption: {
    fontSize: 14,
    color: "#fff",
    marginTop: 12,
    lineHeight: 20,
  },
});

export default GalleryView;
