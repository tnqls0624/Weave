import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import relativeTime from "dayjs/plugin/relativeTime";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import {
  useCreateScheduleComment,
  useDeleteScheduleComment,
  useScheduleComments,
  useToggleCommentReaction,
} from "../services/queries";
import { ReactionEmoji, ScheduleComment, User } from "../types";

dayjs.extend(relativeTime);
dayjs.locale("ko");

// 리액션 이모지 목록
const REACTION_EMOJIS: ReactionEmoji[] = ["👍", "❤️", "🎉", "👀", "🙏", "😢"];

interface ScheduleCommentsProps {
  scheduleId: string;
  currentUserId: string;
  workspaceUsers?: User[];
  onCommentCountChange?: (count: number) => void;
}

const ScheduleComments: React.FC<ScheduleCommentsProps> = ({
  scheduleId,
  currentUserId,
  workspaceUsers = [],
  onCommentCountChange,
}) => {
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<ScheduleComment | null>(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState<
    string | null
  >(null);
  const inputRef = useRef<TextInput>(null);

  const { data: comments = [], isLoading } = useScheduleComments(scheduleId);
  const createCommentMutation = useCreateScheduleComment();
  const deleteCommentMutation = useDeleteScheduleComment();
  const toggleReactionMutation = useToggleCommentReaction();

  // 댓글 수 변경 시 부모에게 알림 (로딩 중에는 호출하지 않음)
  const totalCount = comments.reduce(
    (acc, comment) => acc + 1 + (comment.replies?.length || 0),
    0
  );

  useEffect(() => {
    if (onCommentCountChange && !isLoading) {
      onCommentCountChange(totalCount);
    }
  }, [totalCount, onCommentCountChange, isLoading]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        scheduleId,
        content: newComment.trim(),
        parentId: replyTo?.id,
        mentions: selectedMentions.length > 0 ? selectedMentions : undefined,
      });
      setNewComment("");
      setReplyTo(null);
      setSelectedMentions([]);
      Keyboard.dismiss();
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

  const handleReply = (comment: ScheduleComment) => {
    setReplyTo(comment);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      await toggleReactionMutation.mutateAsync({
        scheduleId,
        commentId,
        emoji,
      });
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  };

  // @멘션 입력 감지
  const handleTextChange = (text: string) => {
    setNewComment(text);

    // @ 뒤의 텍스트 추출
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex < text.length) {
      const afterAt = text.slice(lastAtIndex + 1);
      // 공백이 없으면 멘션 검색 중
      if (!afterAt.includes(" ")) {
        setMentionSearchText(afterAt);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
    setMentionSearchText("");
  };

  // 멘션 선택
  const handleSelectMention = (user: User) => {
    const lastAtIndex = newComment.lastIndexOf("@");
    const beforeAt = newComment.slice(0, lastAtIndex);
    const newText = `${beforeAt}@${user.name} `;
    setNewComment(newText);
    setShowMentionList(false);
    setMentionSearchText("");

    if (!selectedMentions.includes(user.id)) {
      setSelectedMentions([...selectedMentions, user.id]);
    }
  };

  // 멘션 필터링된 사용자 목록
  const filteredMentionUsers = workspaceUsers.filter(
    (user) =>
      user.id !== currentUserId &&
      user.name.toLowerCase().includes(mentionSearchText.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = dayjs(dateString);
    const now = dayjs();
    const diffHours = now.diff(date, "hour");

    if (diffHours < 24) {
      return date.fromNow();
    } else if (diffHours < 168) {
      return date.format("M/D HH:mm");
    } else {
      return date.format("YYYY.M.D");
    }
  };

  // 댓글 리액션 컴포넌트
  const CommentReactions = ({ comment }: { comment: ScheduleComment }) => {
    const hasReactions = comment.reactions && comment.reactions.length > 0;
    const isPickerOpen = reactionPickerCommentId === comment.id;

    return (
      <View style={styles.reactionsWrapper}>
        <View style={styles.reactionsContainer}>
          {hasReactions &&
            comment.reactions.map((reaction) => (
              <Pressable
                key={reaction.emoji}
                style={[
                  styles.reactionBadge,
                  reaction.isReactedByMe && styles.reactionBadgeActive,
                ]}
                onPress={() => handleToggleReaction(comment.id, reaction.emoji)}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                <Text
                  style={[
                    styles.reactionCount,
                    reaction.isReactedByMe && styles.reactionCountActive,
                  ]}
                >
                  {reaction.count}
                </Text>
              </Pressable>
            ))}
          <Pressable
            style={styles.addReactionButton}
            onPress={() =>
              setReactionPickerCommentId(isPickerOpen ? null : comment.id)
            }
          >
            <MaterialIcons
              name={hasReactions ? "add" : "add-reaction"}
              size={hasReactions ? 14 : 16}
              color="#9CA3AF"
            />
          </Pressable>
        </View>

        {/* 리액션 피커 - 버튼 바로 아래 (absolute) */}
        {isPickerOpen && (
          <View style={styles.reactionPickerAbsolute}>
            <View style={styles.reactionPickerBubble}>
              <View style={styles.reactionPickerArrow} />
              <View style={styles.reactionPickerContent}>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={styles.reactionPickerItem}
                    onPress={() => {
                      handleToggleReaction(comment.id, emoji);
                      setReactionPickerCommentId(null);
                    }}
                  >
                    <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // 댓글 아이템 렌더링
  const renderCommentItem = useCallback(
    (comment: ScheduleComment, isReply = false) => {
      const isMyComment = comment.userId === currentUserId;

      return (
        <View
          key={comment.id}
          style={[styles.commentItem, isReply && styles.replyItem]}
        >
          <Image
            source={{
              uri: comment.userAvatarUrl || "https://via.placeholder.com/40",
            }}
            style={[styles.avatar, isReply && styles.replyAvatar]}
          />
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.userName}>{comment.userName}</Text>
              <Text style={styles.timestamp}>
                {formatTime(comment.createdAt)}
                {comment.isEdited && " (수정됨)"}
              </Text>
            </View>

            {/* 멘션된 내용 하이라이트 */}
            <Text style={styles.commentText}>
              {comment.content.split(/(@\w+)/g).map((part, index) =>
                part.startsWith("@") ? (
                  <Text key={index} style={styles.mentionText}>
                    {part}
                  </Text>
                ) : (
                  part
                )
              )}
            </Text>

            {/* 리액션 & 답글 버튼 */}
            <View style={styles.commentActions}>
              <CommentReactions comment={comment} />
              {!isReply && (
                <Pressable
                  style={styles.replyButton}
                  onPress={() => handleReply(comment)}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={14}
                    color="#9CA3AF"
                  />
                  <Text style={styles.replyButtonText}>답글</Text>
                </Pressable>
              )}
            </View>

            {/* 답글 목록 */}
            {comment.replies && comment.replies.length > 0 && (
              <View style={styles.repliesContainer}>
                {comment.replies.map((reply) => renderCommentItem(reply, true))}
              </View>
            )}
          </View>
          {isMyComment && (
            <Pressable
              style={[styles.deleteButton, isReply && styles.deleteButtonReply]}
              onPress={() => handleDelete(comment.id)}
            >
              <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      );
    },
    [currentUserId, handleToggleReaction]
  );

  const renderComment = ({ item }: { item: ScheduleComment }) =>
    renderCommentItem(item);

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
      <Pressable
        style={styles.header}
        onPress={() => {
          Keyboard.dismiss();
          setReactionPickerCommentId(null);
        }}
      >
        <Ionicons name="chatbubbles" size={20} color="#374151" />
        <Text style={styles.headerTitle}>댓글</Text>
        <Text style={styles.commentCount}>{totalCount}</Text>
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
            comments.length === 0
              ? styles.emptyListContainer
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
            setReactionPickerCommentId(null);
          }}
        />
      )}

      {/* 멘션 목록 */}
      {showMentionList && filteredMentionUsers.length > 0 && (
        <View style={styles.mentionList}>
          {filteredMentionUsers.slice(0, 5).map((user) => (
            <Pressable
              key={user.id}
              style={styles.mentionItem}
              onPress={() => handleSelectMention(user)}
            >
              <Image
                source={{
                  uri: user.avatarUrl || "https://via.placeholder.com/32",
                }}
                style={styles.mentionAvatar}
              />
              <Text style={styles.mentionName}>{user.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 답글 대상 표시 */}
      {replyTo && (
        <View style={styles.replyToBar}>
          <Text style={styles.replyToText}>
            {replyTo.userName}님에게 답글 작성 중
          </Text>
          <Pressable onPress={handleCancelReply}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </Pressable>
        </View>
      )}

      {/* 댓글 입력 (하단 고정) */}
      <View style={styles.inputContainer}>
        <Pressable
          style={styles.mentionButton}
          onPress={() => {
            setNewComment(newComment + "@");
            setShowMentionList(true);
            inputRef.current?.focus();
          }}
        >
          <Text style={styles.mentionButtonText}>@</Text>
        </Pressable>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={newComment}
          onChangeText={handleTextChange}
          placeholder={
            replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."
          }
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

      {/* 리액션 피커 열렸을 때 배경 오버레이 */}
      {reactionPickerCommentId && (
        <Pressable
          style={styles.reactionPickerOverlay}
          onPress={() => setReactionPickerCommentId(null)}
        />
      )}
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
  replyItem: {
    paddingLeft: 0,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  mentionText: {
    color: "#007AFF",
    fontWeight: "500",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  reactionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reactionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionBadgeActive: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  reactionCountActive: {
    color: "#007AFF",
  },
  addReactionButton: {
    padding: 4,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyButtonText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: -48,
    paddingLeft: 48,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E7EB",
    overflow: "visible",
  },
  deleteButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  deleteButtonReply: {
    top: 12,
    right: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  mentionList: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  mentionName: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  replyToBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  replyToText: {
    fontSize: 13,
    color: "#6B7280",
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
  mentionButton: {
    width: 32,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  mentionButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
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
  reactionPickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  reactionsWrapper: {
    position: "relative",
    zIndex: 100,
  },
  reactionPickerAbsolute: {
    position: "absolute",
    top: 24,
    left: -20,
    zIndex: 999,
  },
  reactionPickerBubble: {
    alignItems: "flex-start",
  },
  reactionPickerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
    marginLeft: 24,
    zIndex: 10,
  },
  reactionPickerContent: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 250,
    marginTop: -1,
  },
  reactionPickerItem: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  reactionPickerEmoji: {
    fontSize: 24,
  },
});

export default ScheduleComments;
