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
  Animated,
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
  const [isInputFocused, setIsInputFocused] = useState(false);
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

  const renderItem = (item: ChecklistItem, index: number) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [
        styles.itemContainer,
        index === checklist.length - 1 && styles.itemContainerLast,
        pressed && styles.itemPressed,
      ]}
      onPress={() => handleToggleItem(item.id)}
    >
      <View style={[styles.checkbox, item.isCompleted && styles.checkboxCompleted]}>
        {item.isCompleted && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
      <Text
        style={[
          styles.itemText,
          item.isCompleted && styles.itemTextCompleted,
        ]}
        numberOfLines={2}
      >
        {item.content}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && styles.deleteButtonPressed,
        ]}
        onPress={() => handleDeleteItem(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="list" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>체크리스트</Text>
        </View>
        {totalCount > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {completedCount}/{totalCount}
            </Text>
          </View>
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
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      ) : (
        <View style={styles.listContainer}>
          {checklist.map((item: ChecklistItem, index: number) => renderItem(item, index))}

          {checklist.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="checkbox-outline" size={28} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyTitle}>체크리스트가 비어있어요</Text>
              <Text style={styles.emptySubtitle}>할 일을 추가해보세요</Text>
            </View>
          )}
        </View>
      )}

      {/* 입력 필드 */}
      <View style={[styles.inputContainer, isInputFocused && styles.inputContainerFocused]}>
        <View style={styles.inputIconContainer}>
          <Ionicons name="add" size={18} color={isInputFocused ? "#3B82F6" : "#9CA3AF"} />
        </View>
        <TextInput
          style={styles.input}
          value={newItemContent}
          onChangeText={setNewItemContent}
          placeholder="새 항목 추가"
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={handleAddItem}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          returnKeyType="done"
        />
        {newItemContent.trim() && (
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
              addItemMutation.isPending && styles.addButtonDisabled,
            ]}
            onPress={handleAddItem}
            disabled={addItemMutation.isPending}
          >
            {addItemMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>추가</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginLeft: 10,
  },
  progressBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  listContainer: {
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemContainerLast: {
    borderBottomWidth: 0,
  },
  itemPressed: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxCompleted: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 20,
  },
  itemTextCompleted: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  deleteButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 6,
  },
  deleteButtonPressed: {
    backgroundColor: "#FEE2E2",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
  },
  inputContainerFocused: {
    borderColor: "#3B82F6",
    backgroundColor: "#FFFFFF",
  },
  inputIconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    paddingVertical: 10,
  },
  addButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  addButtonPressed: {
    backgroundColor: "#2563EB",
  },
  addButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default ScheduleChecklist;
