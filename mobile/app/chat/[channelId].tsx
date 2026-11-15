import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Camera,
  Check,
  Clock,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Send,
  Shield,
  Video,
  X,
  XCircle,
} from "lucide-react-native";
import { apiRequest, apiUpload } from "../../src/lib/api";
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

export interface MediaDescriptor {
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalName?: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

interface MessageItem {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderRole?: "FATHER" | "STUDENT" | "GOVERNOR" | "CHILD";
  type?: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO";
  content: string;
  media?: MediaDescriptor | null;
  createdAt: number;
  status?: "PENDING" | "SENT";
  isEncrypted?: boolean;
  encryption?: EncryptionEnvelope | null;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
  "mp4",
  "mov",
  "avi",
  "webm",
  "mp3",
  "m4a",
  "wav",
  "ogg",
  "aac",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
]);

function inferMime(filename: string, fallbackMime?: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
    case "heif":
      return "image/heic";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "webm":
      return "video/webm";
    case "mp3":
      return "audio/mp3";
    case "m4a":
      return "audio/m4a";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "aac":
      return "audio/aac";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    default:
      return fallbackMime || "application/octet-stream";
  }
}

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { role, uid } = useAuth();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>([]);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

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

  // 2. Fetch conversations to know channel title / recipient name
  const { data: convos } = useQuery<any[]>({
    queryKey: ["conversations"],
    queryFn: () => apiRequest<any[]>("/api/message/conversation"),
  });
  const currentConvo = convos?.find((c) => c.id === channelId);
  const isCommonHouse =
    currentConvo?.role === "COMMON_HOUSE" ||
    currentConvo?.type === "COMMON_HOUSE";
  const channelDisplayTitle = isCommonHouse
    ? "የጋራ ቤት"
    : currentConvo?.fullName || "የግል መልዕክት";

  // 3. Decrypt incoming ciphertext once per message id
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

  // 4. Mark newest message as read
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

  // 5. Header setup: specific, context-aware Video Calling button
  useEffect(() => {
    navigation.setOptions({
      title: channelDisplayTitle,
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerCallBtn}
          onPress={() => {
            if (channelId) {
              router.push(`/call/${channelId}` as any);
            }
          }}
          activeOpacity={0.8}
          accessibilityLabel={
            isCommonHouse
              ? "የጋራ ቤት የቪዲዮ ጥሪ"
              : `ከ ${channelDisplayTitle} ጋር የቪዲዮ ጥሪ`
          }
        >
          <View style={styles.callIconBox}>
            <Video color="#FFFFFF" size={14} />
            <Text style={styles.callIconText}>
              {isCommonHouse ? "የጋራ" : "ጥሪ"}
            </Text>
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation, channelId, channelDisplayTitle, isCommonHouse, router]);

  // Merge server messages with pending optimistic messages
  const serverMsgList = serverMessages || [];
  const serverIds = new Set(serverMsgList.map((m) => m.id));
  const pendingOnly = optimisticMessages.filter(
    (m) => !serverIds.has(m.id) && m.status === "PENDING"
  );
  const allMessages = [...serverMsgList, ...pendingOnly].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  // 6. Send Mutation (handles text and media)
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO";
      media?: MediaDescriptor | null;
      clientMessageId: string;
    }) => {
      let ciphertext = payload.content || "";
      let encryptionEnvelope: EncryptionEnvelope | null = null;

      if (ciphertext && !payload.media) {
        const encrypted = await encryptMessage(ciphertext, channelId!);
        ciphertext = encrypted.ciphertext;
        encryptionEnvelope = encrypted.encryption;
      }

      const messageType =
        payload.type ||
        (payload.media
          ? payload.media.mimeType.startsWith("image/")
            ? "IMAGE"
            : "FILE"
          : "TEXT");

      return await apiRequest<{ success: boolean; messageId: string }>(
        "/api/message/send",
        {
          method: "POST",
          body: JSON.stringify({
            channelId,
            type: messageType,
            content: ciphertext,
            media: payload.media,
            isEncrypted: Boolean(encryptionEnvelope),
            encryption: encryptionEnvelope,
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
      Alert.alert("ስህተት", "መልእክቱን መላክ አልተቻለም፡ " + err.message);
    },
  });

  const handleSendText = () => {
    const trimmed = inputText.trim();
    if (!trimmed || sendMutation.isPending) return;

    const clientId = `local_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const newMsg: MessageItem = {
      id: clientId,
      channelId: channelId!,
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
      type: "TEXT",
      clientMessageId: clientId,
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 7. Media Upload and Send Helper
  const uploadAndSendMedia = async (file: {
    uri: string;
    name: string;
    type: string;
    size?: number;
    width?: number;
    height?: number;
  }) => {
    if (!channelId) return;

    if (file.size && file.size > MAX_UPLOAD_BYTES) {
      Alert.alert(
        "የፋይል መጠን ማሳሰቢያ",
        `የተመረጠው ፋይል መጠን ${(file.size / (1024 * 1024)).toFixed(1)}MB ነው። የሚፈቀደው ከፍተኛ መጠን 25MB ነው።`
      );
      return;
    }

    setIsUploading(true);
    setUploadStatusText("ፋይሉን በመጫን ላይ…");
    try {
      const safeName = (file.name || `file_${Date.now()}`).replace(/\s+/g, "_");
      const safeType = inferMime(safeName, file.type);

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: safeName,
        type: safeType,
      } as any);
      formData.append("channelId", channelId);

      const res = await apiUpload<{ ok: boolean; media: MediaDescriptor }>(
        "/api/message/chat-media-upload",
        formData
      );

      if (res?.ok && res.media) {
        const clientId = `local_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 7)}`;
        const isImg = res.media.mimeType.startsWith("image/");
        const isVid = res.media.mimeType.startsWith("video/");
        const msgType = isImg ? "IMAGE" : isVid ? "VIDEO" : "FILE";

        const newMsg: MessageItem = {
          id: clientId,
          channelId: channelId,
          senderId: uid || "me",
          senderRole: role as MessageItem["senderRole"],
          content: res.media.originalName || "",
          media: res.media,
          type: msgType,
          createdAt: Date.now(),
          status: "PENDING",
        };

        setOptimisticMessages((prev) => [...prev, newMsg]);

        sendMutation.mutate({
          content: res.media.originalName || "",
          type: msgType,
          media: res.media,
          clientMessageId: clientId,
        });

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e: any) {
      Alert.alert(
        "ስህተት",
        e.message || "ፋይሉን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።"
      );
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
    }
  };

  const handlePickMedia = async () => {
    setShowAttachModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        const fallbackName = isVideo
          ? `video_${Date.now()}.mp4`
          : `image_${Date.now()}.jpg`;
        const fileName = asset.fileName || fallbackName;
        const mimeType =
          asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

        if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
          Alert.alert(
            "የፋይል መጠን ማሳሰቢያ",
            `የተመረጠው ፋይል መጠን ${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB ነው። የሚፈቀደው ከፍተኛ መጠን 25MB ነው።`
          );
          return;
        }

        await uploadAndSendMedia({
          uri: asset.uri,
          name: fileName,
          type: mimeType,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (err: any) {
      Alert.alert("ስህተት", "ምስል ወይም ቪዲዮ መምረጥ አልተቻለም፡ " + err.message);
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachModal(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("ፍቃድ ያስፈልጋል", "ካሜራ ለመጠቀም ፍቃድ ይስጡ");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadAndSendMedia({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (err: any) {
      Alert.alert("ስህተት", "ፎቶ ማንሳት አልተቻለም፡ " + err.message);
    }
  };

  const handlePickDocument = async () => {
    setShowAttachModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const ext = asset.name.split(".").pop()?.toLowerCase();

        // Check against allowed formats
        if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
          Alert.alert(
            "ያልተፈቀደ የፋይል ዓይነት",
            `".${ext}" የፋይል ዓይነት በሲስተሙ ውስጥ አልተፈቀደም።\n\nየሚፈቀዱት፡ ፎቶ፣ ቪዲዮ፣ ድምፅ፣ PDF፣ Word (.doc, .docx)፣ Excel (.xls, .xlsx)፣ PowerPoint (.ppt, .pptx) እና Text (.txt) ፋይሎች ናቸው።`
          );
          return;
        }

        if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
          Alert.alert(
            "የፋይል መጠን ማሳሰቢያ",
            `የተመረጠው ፋይል መጠን ${(asset.size / (1024 * 1024)).toFixed(1)}MB ነው። የሚፈቀደው ከፍተኛ መጠን 25MB ነው።`
          );
          return;
        }

        const safeMime = inferMime(asset.name, asset.mimeType);

        await uploadAndSendMedia({
          uri: asset.uri,
          name: asset.name,
          type: safeMime,
          size: asset.size,
        });
      }
    } catch (err: any) {
      Alert.alert("ስህተት", "ሰነድ መምረጥ አልተቻለም፡ " + err.message);
    }
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
            const hasMedia = Boolean(item.media?.url);
            const isImg =
              item.media?.mimeType?.startsWith("image/") ||
              item.type === "IMAGE";

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

                  {/* Media Content */}
                  {hasMedia && item.media?.url && (
                    <View style={styles.mediaContainer}>
                      {isImg ? (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() =>
                            item.media?.url && Linking.openURL(item.media.url)
                          }
                          style={styles.imageCard}
                        >
                          <Image
                            source={{ uri: item.media.url }}
                            style={styles.msgImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            item.media?.url && Linking.openURL(item.media.url)
                          }
                          style={[
                            styles.docCard,
                            isMe ? styles.myDocCard : styles.otherDocCard,
                          ]}
                        >
                          <View
                            style={[
                              styles.docIconBox,
                              isMe && styles.myDocIconBox,
                            ]}
                          >
                            <FileText
                              color={
                                isMe ? "#FFFFFF" : THEME.colors.sacredCrimson
                              }
                              size={20}
                            />
                          </View>
                          <View style={styles.docInfo}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.docName,
                                isMe ? styles.myDocName : styles.otherDocName,
                              ]}
                            >
                              {item.media.originalName || "የተላከ ሰነድ"}
                            </Text>
                            <Text
                              style={[
                                styles.docSize,
                                isMe && { color: "rgba(255,255,255,0.7)" },
                              ]}
                            >
                              {item.media.sizeBytes
                                ? `${(item.media.sizeBytes / 1024).toFixed(0)} KB`
                                : "ሰነድ"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Text Content */}
                  {item.content && (!hasMedia || item.content !== item.media?.originalName) ? (
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
                  ) : null}

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

      {/* Uploading progress indicator */}
      {isUploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color={THEME.colors.sacredAmber} />
          <Text style={styles.uploadingText}>{uploadStatusText}</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => setShowAttachModal(true)}
          disabled={isUploading || sendMutation.isPending}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Paperclip color={THEME.colors.sacredAmber} size={20} />
        </TouchableOpacity>

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
          onPress={handleSendText}
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

      {/* Attachment Bottom Sheet Modal */}
      <Modal
        visible={showAttachModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachModal(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ፋይል አጋራ</Text>
              <TouchableOpacity
                onPress={() => setShowAttachModal(false)}
                hitSlop={8}
              >
                <X color={THEME.colors.inkSubtle} size={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.modalOptionIcon,
                  { backgroundColor: "#FEF3C7" },
                ]}
              >
                <Camera color="#B45309" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ካሜራ (Camera)</Text>
                <Text style={styles.modalOptionSub}>በቀጥታ ፎቶ አንስተው ወዲያውኑ ይላኩ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePickMedia}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.modalOptionIcon,
                  { backgroundColor: "#DBEAFE" },
                ]}
              >
                <ImageIcon color="#1D4ED8" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ምስል እና ቪዲዮ (Gallery)</Text>
                <Text style={styles.modalOptionSub}>
                  ከስልክዎ ማዕከለ-ስዕላት ፎቶ ወይም ቪዲዮ ይምረጡ
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePickDocument}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.modalOptionIcon,
                  { backgroundColor: "#D1FAE5" },
                ]}
              >
                <FileText color="#059669" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ፋይሎች እና ሰነዶች (Files)</Text>
                <Text style={styles.modalOptionSub}>
                  PDF፣ Word፣ Excel፣ ድምፅና ሌሎች ሰነዶች (ከ25MB በታች)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowAttachModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText}>ሰርዝ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginRight: 4,
  },
  callIconBox: {
    backgroundColor: THEME.colors.sacredCrimson,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    ...THEME.shadows.button,
  },
  callIconText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
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
    maxWidth: "82%",
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  mediaContainer: {
    marginBottom: 6,
  },
  imageCard: {
    borderRadius: 10,
    overflow: "hidden",
  },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    gap: 10,
    minWidth: 200,
  },
  myDocCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  otherDocCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  myDocIconBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  myDocName: {
    color: "#FFFFFF",
  },
  otherDocName: {
    color: THEME.colors.inkPrimary,
  },
  docSize: {
    fontSize: 10,
    color: THEME.colors.inkSubtle,
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
  uploadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
  },
  uploadingText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.navigationBg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.sacredCrimsonBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  attachBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.buttonDark,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.button,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: 12,
    ...THEME.shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    gap: 12,
  },
  modalOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
  },
  modalOptionSub: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
    marginTop: 2,
  },
  modalCancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
});
