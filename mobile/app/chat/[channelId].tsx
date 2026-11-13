import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Video, Clock, Check, Shield } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import { THEME } from "../../src/constants/theme";

interface MessageItem {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderRole?: "FATHER" | "STUDENT" | "GOVERNOR";
  content: string;
  createdAt: number;
  status?: "PENDING" | "SENT";
}

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const navigation = useNavigation();
  const { role, eotcUid } = useAuth();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>(
    []
  );
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  // 1. Fetch channel messages
  const { data: serverMessages, isLoading } = useQuery<MessageItem[]>({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const res = await apiRequest<MessageItem[]>(
        `/api/message/list?channelId=${channelId}`
      );
      if (res && channelId) {
        offlineCache.saveMessages(channelId, res);
      }
      return res || [];
    },
    enabled: Boolean(channelId),
    refetchInterval: 4000,
  });

  useEffect(() => {
    async function hydrateMessages() {
      if (!channelId) return;
      const cached = await offlineCache.getMessages<MessageItem>(channelId);
      if (cached.length > 0 && !serverMessages) {
        queryClient.setQueryData(["messages", channelId], cached);
      }
    }
    hydrateMessages();
  }, [channelId, queryClient, serverMessages]);

  // Setup video button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerCallBtn}
          onPress={() => {
            if (channelId) {
              router.push(`/call/${channelId}` as any);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.callIconBox}>
            <Video color="#FFFFFF" size={16} />
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation, channelId, router]);

  // Merge server messages with pending optimistic messages
  const serverMsgList = serverMessages || [];
  const serverIds = new Set(serverMsgList.map((m) => m.id));
  const pendingOnly = optimisticMessages.filter(
    (m) => !serverIds.has(m.id) && m.status === "PENDING"
  );
  const allMessages = [...serverMsgList, ...pendingOnly].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  // 2. Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      clientMessageId: string;
    }) => {
      return await apiRequest<{ success: boolean; messageId: string }>(
        "/api/message/send",
        {
          method: "POST",
          body: JSON.stringify({
            channelId,
            type: "TEXT",
            content: payload.content,
            clientMessageId: payload.clientMessageId,
          }),
        }
      );
    },
    onSuccess: (res, vars) => {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === vars.clientMessageId ? { ...m, status: "SENT" } : m
        )
      );
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: any, vars) => {
      setOptimisticMessages((prev) =>
        prev.filter((m) => m.id !== vars.clientMessageId)
      );
      alert("መልእክቱን መላክ አልተቻለም፡ " + err.message);
    },
  });

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || sendMutation.isPending) return;

    const clientId = `local_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const newMsg: MessageItem = {
      id: clientId,
      channelId: channelId!,
      senderId: eotcUid || "me",
      senderRole: role as any,
      content: trimmed,
      createdAt: Date.now(),
      status: "PENDING",
    };

    setOptimisticMessages((prev) => [...prev, newMsg]);
    setInputText("");

    sendMutation.mutate({
      content: trimmed,
      clientMessageId: clientId,
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (ts: number) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("am-ET", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      style={styles.container}
    >
      {isLoading && allMessages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.sacredAmber} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item }) => {
            const isMe = item.senderId === eotcUid || item.senderId === "me";
            const isFather = item.senderRole === "FATHER";

            return (
              <View
                style={[
                  styles.msgRow,
                  isMe ? styles.myMsgRow : styles.otherMsgRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? styles.myBubble
                      : isFather
                      ? styles.fatherBubble
                      : styles.otherBubble,
                  ]}
                >
                  {!isMe && isFather && (
                    <View style={styles.fatherBadgeRow}>
                      <Shield color={THEME.colors.sacredAmber} size={13} />
                      <Text style={styles.fatherBadgeText}>
                        {item.senderName || "የንስሐ አባት"}
                      </Text>
                    </View>
                  )}

                  {!isMe && !isFather && item.senderName ? (
                    <Text style={styles.senderName}>{item.senderName}</Text>
                  ) : null}

                  <Text
                    style={[
                      styles.msgText,
                      isMe ? styles.myMsgText : styles.otherMsgText,
                    ]}
                  >
                    {item.content}
                  </Text>

                  <View style={styles.footerRow}>
                    <Text
                      style={[
                        styles.timeText,
                        isMe && { color: "rgba(255, 255, 255, 0.6)" },
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                    {isMe && (
                      <View style={styles.statusIcon}>
                        {item.status === "PENDING" ? (
                          <Clock color="rgba(255, 255, 255, 0.5)" size={11} />
                        ) : (
                          <Check color={THEME.colors.sacredAmber} size={12} />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="መልእክት ይጻፉ... (ምክርና መመሪያ)"
          placeholderTextColor={THEME.colors.inkSubtle}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Send color="#FFFFFF" size={17} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCallBtn: {
    padding: 6,
    marginRight: 4,
  },
  callIconBox: {
    backgroundColor: THEME.colors.sacredCrimson,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.button,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  myMsgRow: {
    justifyContent: "flex-end",
  },
  otherMsgRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...THEME.shadows.card,
  },
  myBubble: {
    backgroundColor: THEME.colors.inkPrimary,
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    backgroundColor: THEME.colors.surface,
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  fatherBubble: {
    backgroundColor: THEME.colors.surface,
    borderLeftWidth: 3.5,
    borderLeftColor: THEME.colors.sacredAmber,
    borderBottomLeftRadius: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.colors.amberBorder,
  },
  fatherBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  fatherBadgeText: {
    color: THEME.colors.sacredAmber,
    fontSize: 12,
    fontWeight: "800",
  },
  senderName: {
    color: THEME.colors.inkSubtle,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  myMsgText: {
    color: "#FFFFFF",
  },
  otherMsgText: {
    color: THEME.colors.inkPrimary,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    color: THEME.colors.inkSubtle,
    fontSize: 10,
    fontWeight: "600",
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.navigationBg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.sacredCrimsonBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    color: THEME.colors.inkPrimary,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 9,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.buttonDark,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.button,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
