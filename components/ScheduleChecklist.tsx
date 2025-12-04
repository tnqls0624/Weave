import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChecklistItem } from "../types";
import {
  useScheduleChecklist,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
} from "../services/queries";

interface ScheduleChecklistProps {
  scheduleId: string;
  currentUserId: string;
}

const ScheduleChecklist: React.FC<ScheduleChecklistProps> = ({
  scheduleId,
  currentUserId,
}) => {
  const [newItemContent, setNewItemContent] = useState("");
  const { data: checklist = [], isLoading } = useScheduleChecklist(scheduleId);
  const addItemMutation = useAddChecklistItem();
  const toggleItemMutation = useToggleChecklistItem();
  const deleteItemMutation = useDeleteChecklistItem();

  const handleAddItem = async () => {
    if (!newItemContent.trim()) return;

    try {
      await addItemMutation.mutateAsync({
        scheduleId,
        content: newItemContent.trim(),
      });
      setNewItemContent("");
    } catch (error) {
      Alert.alert("오류", "항목 추가에 실패했습니다.");
    }
  };

  const handleToggleItem = async (itemId: string) => {
    try {
      await toggleItemMutation.mutateAsync({ scheduleId, itemId });
    } catch (error) {
      Alert.alert("오류", "상태 변경에 실패했습니다.");
    }
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert("항목 삭제", "이 항목을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItemMutation.mutateAsync({ scheduleId, itemId });
          } catch (error) {
            Alert.alert("오류", "항목 삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const completedCount = checklist.filter((item: ChecklistItem) => item.isCompleted).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const renderItem = (item: ChecklistItem) => (
    <View key={item.id} style={styles.itemContainer}>
      <Pressable
        style={styles.checkbox}
        onPress={() => handleToggleItem(item.id)}
      >
        <Ionicons
          name={item.isCompleted ? "checkbox" : "square-outline"}
          size={24}
          color={item.isCompleted ? "#22C55E" : "#9CA3AF"}
        />
      </Pressable>
      <Text
        style={[
          styles.itemText,
          item.isCompleted && styles.itemTextCompleted,
        ]}
      >
        {item.content}
      </Text>
      <Pressable
        style={styles.deleteButton}
        onPress={() => handleDeleteItem(item.id)}
      >
        <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="checkbox-outline" size={20} color="#374151" />
          <Text style={styles.headerTitle}>체크리스트</Text>
        </View>
        {totalCount > 0 && (
          <Text style={styles.progressText}>
            {completedCount}/{totalCount} 완료
          </Text>
        )}
      </View>

      {/* 진행률 바 */}
      {totalCount > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      )}

      {/* 체크리스트 목록 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : (
        <View style={styles.listContainer}>
          {checklist.map((item: ChecklistItem) => renderItem(item))}

          {checklist.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>체크리스트를 추가해보세요</Text>
            </View>
          )}
        </View>
      )}

      {/* 입력 필드 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newItemContent}
          onChangeText={setNewItemContent}
          placeholder="새 항목 추가..."
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={handleAddItem}
          returnKeyType="done"
        />
        <Pressable
          style={[
            styles.addButton,
            (!newItemContent.trim() || addItemMutation.isPending) &&
              styles.addButtonDisabled,
          ]}
          onPress={handleAddItem}
          disabled={!newItemContent.trim() || addItemMutation.isPending}
        >
          {addItemMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
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
  progressText: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 2,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  listContainer: {
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  checkbox: {
    marginRight: 12,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
  },
  itemTextCompleted: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#374151",
  },
  addButton: {
    backgroundColor: "#3B82F6",
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  addButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
});

export default ScheduleChecklist;
