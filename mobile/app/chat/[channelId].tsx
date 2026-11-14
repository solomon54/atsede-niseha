import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Lock, Send, Shield, Video, XCircle } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import { useCacheFirst } from "../../src/lib/use-cache-first";
import {
  decryptMessage,
  encryptMessage,
  EncryptionEnvelope,
  LOCKED_MESSAGE_PLACEHOLDER,
} from "../../src/lib/crypto";
import { THEME } from "../../src/constants/theme";

interface MessageItem {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderRole?: "FATHER" | "STUDENT" | "GOVERNOR" | "CHILD";
  content: string;
  createdAt: number;
  status?: "PENDING" | "SENT";
  isEncrypted?: boolean;
  encryption?: EncryptionEnvelope | null;
}

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { role, uid } = useAuth();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>(
    []
  );
  const [decryptedContent, setDecryptedContent] = useState<
    Record<string, string>
  >({});
  const flatListRef = useRef<FlatList>(null);
  const attemptedDecrypt = useRef<Set<string>>(new Set());
  const lastMarkedRead = useRef<string | null>(null);

  // 1. Fetch channel messages (ciphertext is what the server stores)
  const {
    data: serverMessages,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MessageItem[]>({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const res = await apiRequest<MessageItem[]>(
        `/api/message/list?channelId=${channelId}`
      );
      if (res && channelId) {
        // Cache ciphertext, never plaintext — offline storage must not
        // weaken the end-to-end guarantee.
        offlineCache.saveMessages(channelId, res);
      }
      return res || [];
    },
    enabled: Boolean(channelId),
    refetchInterval: 4000,
  });

  const cacheChecked = useCacheFirst<MessageItem[]>(
    ["messages", channelId],
    () => offlineCache.getMessages<MessageItem>(channelId)
  );

  // 2. Decrypt incoming ciphertext once per message id.
  useEffect(() => {
    const messages = serverMessages || [];
    const pending = messages.filter(
      (m) =>
        m.isEncrypted &&
        m.encryption?.keyId &&
        m.encryption?.iv &&
        m.content &&
        !attemptedDecrypt.current.has(m.id)
    );

    if (pending.length === 0) return;

    pending.forEach((m) => attemptedDecrypt.current.add(m.id));

    let cancelled = false;

    (async () => {
      const updates: Record<string, string> = {};

      for (const message of pending) {
        try {
          updates[message.id] = await decryptMessage(
            message.content,
            message.encryption as EncryptionEnvelope
          );
        } catch (e) {
          console.warn("Message decryption failed:", message.id, e);
          updates[message.id] = LOCKED_MESSAGE_PLACEHOLDER;
        }
      }

      if (!cancelled) {
        setDecryptedContent((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverMessages]);

  // 3. Mark the newest message as read so unread badges clear (web parity).
  useEffect(() => {
    const messages = serverMessages || [];
    if (!channelId || !uid || messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (
      !last ||
      last.senderId === uid ||
      last.id === lastMarkedRead.current ||
      last.status === "PENDING"
    ) {
      return;
    }

    lastMarkedRead.current = last.id;
    apiRequest("/api/message/read", {
      method: "POST",
      body: JSON.stringify({ channelId, lastMessageId: last.id }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .catch((e) => console.warn("Failed to mark channel read:", e));
  }, [serverMessages, channelId, uid, queryClient]);

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

  // 4. Send Message Mutation — encrypt with the channelId key, like the web.
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      clientMessageId: string;
    }) => {
      const { ciphertext, encryption } = await encryptMessage(
        payload.content,
        channelId!
      );

      return await apiRequest<{ success: boolean; messageId: string }>(
        "/api/message/send",
        {
          method: "POST",
          body: JSON.stringify({
            channelId,
            type: "TEXT",
            content: ciphertext,
            isEncrypted: true,
            encryption,
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
      // Firestore stores Firebase uids; matching on eotcUid made every
      // message look like it came from someone else.
      senderId: uid || "me",
      senderRole: role as MessageItem["senderRole"],
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

  const displayContent = (item: MessageItem) => {
    if (!item.isEncrypted) return item.content;
    const plain = decryptedContent[item.id];
    if (plain !== undefined) return plain;
    return item.status === "PENDING" ? item.content : "…";
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
      {isError && (
        <View style={styles.errorBanner}>
          <XCircle color={THEME.colors.error} size={16} />
          <Text style={styles.errorBannerText}>
            {(error as Error)?.message || "መልእክቶችን ማምጣት አልተሳካም"}
          </Text>
          <TouchableOpacity onPress={() => refetch()} hitSlop={8}>
            <Text style={styles.retryText}>እንደገና ሞክር</Text>
          </TouchableOpacity>
        </View>
      )}

      {(!cacheChecked || isLoading) && allMessages.length === 0 ? (
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
          ListEmptyComponent={
            cacheChecked && !isLoading && !isError ? (
              <View style={styles.emptyBox}>
                <Lock color={THEME.colors.inkSubtle} size={28} />
                <Text style={styles.emptyText}>
                  እስካሁን መልእክት የለም። የመጀመሪያውን መልእክት ይጻፉ።
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isMe = item.senderId === uid || item.senderId === "me";
            const isFather = item.senderRole === "FATHER";
            const locked =
              item.isEncrypted &&
              displayContent(item) === LOCKED_MESSAGE_PLACEHOLDER;

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

                  <View style={styles.contentRow}>
                    {locked && (
                      <Lock
                        color={
                          isMe ? "rgba(255,255,255,0.7)" : THEME.colors.inkSubtle
                        }
                        size={12}
                      />
                    )}
                    <Text
                      style={[
                        styles.msgText,
                        isMe ? styles.myMsgText : styles.otherMsgText,
                        locked && styles.lockedText,
                      ]}
                    >
                      {displayContent(item)}
                    </Text>
                  </View>

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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: THEME.colors.errorBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.errorBorder,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  errorBannerText: {
    flex: 1,
    color: THEME.colors.error,
    fontSize: 12,
    fontWeight: "600",
  },
  retryText: {
    color: THEME.colors.sacredCrimson,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: THEME.colors.inkMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
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
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 20,
    flexShrink: 1,
  },
  myMsgText: {
    color: "#FFFFFF",
  },
  otherMsgText: {
    color: THEME.colors.inkPrimary,
  },
  lockedText: {
    fontStyle: "italic",
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
