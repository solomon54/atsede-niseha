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
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // 1. Fetch channel messages (SQLite cache first, then API)
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
    refetchInterval: 4000, // Background poll every 4s for catch-up
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

  const router = useRouter();

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
        >
          <Video color="#D97706" size={20} />
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
      // Mark optimistic message as SENT
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === vars.clientMessageId ? { ...m, status: "SENT" } : m))
      );
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err, vars) => {
      setOptimisticMessages((prev) =>
        prev.filter((m) => m.id !== vars.clientMessageId)
      );
      alert("መልእክቱን መላክ አልተቻለም፡ " + err.message);
    },
  });

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || sendMutation.isPending) return;

    const clientId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#D97706" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item: MessageItem) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item }: { item: MessageItem }) => {
            const isMe =
              item.senderId === eotcUid ||
              (item.status === "PENDING" && item.senderId === (eotcUid || "me"));
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
                  {/* Father Role Badge for Common House distinction */}
                  {!isMe && isFather && (
                    <View style={styles.fatherBadgeRow}>
                      <Shield color="#D97706" size={13} />
                      <Text style={styles.fatherBadgeText}>
                        {item.senderName || "የንስሐ አባት"}
                      </Text>
                    </View>
                  )}

                  {!isMe && !isFather && item.senderName && (
                    <Text style={styles.senderName}>{item.senderName}</Text>
                  )}

                  <Text
                    style={[
                      styles.msgText,
                      isMe ? styles.myMsgText : styles.otherMsgText,
                    ]}
                  >
                    {item.content}
                  </Text>

                  <View style={styles.footerRow}>
                    <Text style={styles.timeText}>
                      {formatTime(item.createdAt)}
                    </Text>
                    {isMe && (
                      <View style={styles.statusIcon}>
                        {item.status === "PENDING" ? (
                          <Clock color="#94A3B8" size={11} />
                        ) : (
                          <Check color="#D97706" size={12} />
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
          placeholderTextColor="#64748B"
          value={inputText}
          onChangeText={(txt: string) => setInputText(txt)}
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
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Send color="#FFFFFF" size={18} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCallBtn: {
    padding: 8,
    marginRight: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: "#1E293B",
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  otherBubble: {
    backgroundColor: "#1E293B",
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  fatherBubble: {
    backgroundColor: "#1F1D17",
    borderLeftWidth: 3,
    borderLeftColor: "#D97706",
    borderBottomLeftRadius: 2,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#78350F",
  },
  fatherBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  fatherBadgeText: {
    color: "#D97706",
    fontSize: 12,
    fontWeight: "700",
  },
  senderName: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMsgText: {
    color: "#F8FAFC",
  },
  otherMsgText: {
    color: "#E2E8F0",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    color: "#64748B",
    fontSize: 10,
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    color: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#334155",
    opacity: 0.5,
  },
});

