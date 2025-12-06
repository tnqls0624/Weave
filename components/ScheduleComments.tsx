import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScheduleComment } from "../types";
import {
  useScheduleComments,
  useCreateScheduleComment,
  useDeleteScheduleComment,
} from "../services/queries";

dayjs.extend(relativeTime);
dayjs.locale("ko");

interface ScheduleCommentsProps {
  scheduleId: string;
  currentUserId: string;
}

const ScheduleComments: React.FC<ScheduleCommentsProps> = ({
  scheduleId,
  currentUserId,
}) => {
  const [newComment, setNewComment] = useState("");
  const { data: comments = [], isLoading } = useScheduleComments(scheduleId);
  const createCommentMutation = useCreateScheduleComment();
  const deleteCommentMutation = useDeleteScheduleComment();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        scheduleId,
        content: newComment.trim(),
      });
      setNewComment("");
    } catch (error) {
      Alert.alert("오류", "댓글 작성에 실패했습니다.");
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert("댓글 삭제", "이 댓글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommentMutation.mutateAsync({
              scheduleId,
              commentId,
            });
          } catch (error) {
            Alert.alert("오류", "댓글 삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const formatTime = (dateString: string) => {
    const date = dayjs(dateString);
    const now = dayjs();
    const diffHours = now.diff(date, "hour");

    if (diffHours < 24) {
      return date.fromNow();
    } else if (diffHours < 168) {
      // 7일
      return date.format("M/D HH:mm");
    } else {
      return date.format("YYYY.M.D");
    }
  };

  const renderComment = ({ item }: { item: ScheduleComment }) => {
    const isMyComment = item.userId === currentUserId;

    return (
      <View style={styles.commentItem}>
        <Image
          source={{
            uri: item.userAvatarUrl || "https://via.placeholder.com/40",
          }}
          style={styles.avatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{item.content}</Text>
        </View>
        {isMyComment && (
          <Pressable
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
          </Pressable>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <Pressable style={styles.emptyContainer} onPress={Keyboard.dismiss}>
      <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>아직 댓글이 없습니다</Text>
      <Text style={styles.emptySubtext}>첫 번째 댓글을 남겨보세요!</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      {/* 댓글 헤더 */}
      <Pressable style={styles.header} onPress={Keyboard.dismiss}>
        <Ionicons name="chatbubbles" size={20} color="#374151" />
        <Text style={styles.headerTitle}>댓글</Text>
        <Text style={styles.commentCount}>{comments.length}</Text>
      </Pressable>

      {/* 댓글 목록 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            comments.length === 0 ? styles.emptyListContainer : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        />
      )}

      {/* 댓글 입력 (하단 고정) */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newComment}
          onChangeText={setNewComment}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!newComment.trim() || createCommentMutation.isPending) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!newComment.trim() || createCommentMutation.isPending}
        >
          {createCommentMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  commentCount: {
    fontSize: 14,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
  },
  commentItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  commentText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#374151",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
});

export default ScheduleComments;
