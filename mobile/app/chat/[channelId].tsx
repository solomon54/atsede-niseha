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
import * as Clipboard from "expo-clipboard";
import {
  Camera,
  Check,
  Clock,
  Copy,
  CornerUpLeft,
  Download,
  Edit2,
  FileText,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  Paperclip,
  Play,
  Send,
  Shield,
  Smile,
  Trash2,
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

export interface StagedAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  isVideo?: boolean;
  isImage?: boolean;
  isDocument?: boolean;
}

export interface ReplyToDescriptor {
  messageId: string;
  senderName: string;
  senderRole?: string;
  contentSnippet: string;
  type?: string;
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
  editedAt?: number;
  deletedAt?: number;
  status?: "PENDING" | "SENT";
  isEncrypted?: boolean;
  encryption?: EncryptionEnvelope | null;
  reactions?: Record<string, string[]>;
  replyTo?: ReplyToDescriptor | null;
}

export const DIGNIFIED_REACTIONS = [
  { emoji: "🙏", label: "አሜን / ጸሎት" },
  { emoji: "✝️", label: "መስቀል" },
  { emoji: "🕊️", label: "ሰላም" },
  { emoji: "❤️", label: "ፍቅር" },
  { emoji: "🕯️", label: "ተስፋ" },
  { emoji: "✨", label: "በረከት" },
] as const;

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

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveFilename(media?: MediaDescriptor | null): string {
  if (media?.originalName) return media.originalName;
  if (media?.url) {
    try {
      const parts = media.url.split("/");
      const last = parts[parts.length - 1];
      const clean = decodeURIComponent(last).split("?")[0];
      if (clean && clean.length > 3) return clean;
    } catch {}
  }
  return "የተላከ ፋይል";
}

function getFileBadge(filename: string, mime?: string) {
  const ext = filename.split(".").pop()?.toUpperCase() || "";
  if (ext === "PDF" || mime?.includes("pdf")) {
    return { label: "PDF", bg: "#FEE2E2", text: "#DC2626" };
  }
  if (["DOC", "DOCX"].includes(ext) || mime?.includes("word")) {
    return { label: "DOC", bg: "#DBEAFE", text: "#2563EB" };
  }
  if (
    ["XLS", "XLSX"].includes(ext) ||
    mime?.includes("excel") ||
    mime?.includes("sheet")
  ) {
    return { label: "XLS", bg: "#DCFCE7", text: "#16A34A" };
  }
  if (
    ["PPT", "PPTX"].includes(ext) ||
    mime?.includes("powerpoint") ||
    mime?.includes("presentation")
  ) {
    return { label: "PPT", bg: "#FFEDD5", text: "#EA580C" };
  }
  if (
    ["MP3", "M4A", "WAV", "AAC", "OGG"].includes(ext) ||
    mime?.startsWith("audio/")
  ) {
    return { label: "AUDIO", bg: "#F3E8FF", text: "#9333EA" };
  }
  if (
    ["MP4", "MOV", "AVI", "WEBM"].includes(ext) ||
    mime?.startsWith("video/")
  ) {
    return { label: "VIDEO", bg: "#E0E7FF", text: "#4F46E5" };
  }
  return { label: ext || "FILE", bg: "#F1F5F9", text: "#475569" };
}

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { role, uid } = useAuth();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState("");
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>([]);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

  // Replies, Edits, Reactions & Action Menu State
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

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

  // 6. Send Mutation (handles text, media, and replies)
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO";
      media?: MediaDescriptor | null;
      clientMessageId: string;
      replyTo?: ReplyToDescriptor | null;
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
            : payload.media.mimeType.startsWith("video/")
            ? "VIDEO"
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
            replyTo: payload.replyTo,
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

  // Edit Message Mutation
  const editMutation = useMutation({
    mutationFn: async (payload: { messageId: string; content: string }) => {
      return await apiRequest<{ success: boolean }>("/api/message/edit", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          messageId: payload.messageId,
          content: payload.content,
        }),
      });
    },
    onSuccess: (_res, vars) => {
      queryClient.setQueryData<MessageItem[]>(
        ["messages", channelId],
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === vars.messageId
              ? { ...m, content: vars.content, editedAt: Date.now() }
              : m
          );
        }
      );
      setEditingMessage(null);
      setInputText("");
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: (err: any) => {
      Alert.alert("ስህተት", "መልዕክቱን ማረም አልተቻለም፡ " + (err.message || ""));
    },
  });

  // Delete Message Mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest<{ success: boolean }>("/api/message/delete", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          messageId,
        }),
      });
    },
    onSuccess: (_res, messageId) => {
      queryClient.setQueryData<MessageItem[]>(
        ["messages", channelId],
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === messageId
              ? { ...m, deletedAt: Date.now(), content: "", media: null }
              : m
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: (err: any) => {
      Alert.alert("ስህተት", "መልዕክቱን መሰረዝ አልተቻለም፡ " + (err.message || ""));
    },
  });

  // Toggle Reaction Mutation
  const reactMutation = useMutation({
    mutationFn: async (payload: { messageId: string; emoji: string }) => {
      return await apiRequest<{
        success: boolean;
        reactions: Record<string, string[]>;
      }>("/api/message/react", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          messageId: payload.messageId,
          emoji: payload.emoji,
        }),
      });
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData<MessageItem[]>(
        ["messages", channelId],
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === vars.messageId ? { ...m, reactions: data.reactions } : m
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: (err: any) => {
      console.warn("Reaction failed:", err);
    },
  });

  const getReplySnippet = (target: MessageItem | null): ReplyToDescriptor | null => {
    if (!target) return null;
    const plain = displayContent(target);
    return {
      messageId: target.id,
      senderName:
        target.senderId === uid ? "እርስዎ" : target.senderName || "ተጠቃሚ",
      senderRole: target.senderRole,
      contentSnippet: plain
        ? plain.substring(0, 80)
        : target.media
        ? target.media.mimeType.startsWith("image/")
          ? "[ፎቶ]"
          : target.media.mimeType.startsWith("video/")
          ? "[ቪዲዮ]"
          : "[ፋይል]"
        : "[መልዕክት]",
    };
  };

  const handleSendText = () => {
    const trimmed = inputText.trim();
    if (!trimmed || sendMutation.isPending) return;

    const clientId = `local_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const replySnippet = getReplySnippet(replyingTo);

    const newMsg: MessageItem = {
      id: clientId,
      channelId: channelId!,
      senderId: uid || "me",
      senderRole: role as MessageItem["senderRole"],
      content: trimmed,
      createdAt: Date.now(),
      status: "PENDING",
      replyTo: replySnippet,
    };

    setOptimisticMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setReplyingTo(null);

    sendMutation.mutate({
      content: trimmed,
      type: "TEXT",
      clientMessageId: clientId,
      replyTo: replySnippet,
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 7. Staged Media Upload and Send Helper
  const handleSendWithAttachment = async () => {
    if (!stagedAttachment || !channelId) return;
    const attachment = stagedAttachment;
    const caption = inputText.trim();
    const replySnippet = getReplySnippet(replyingTo);

    setIsUploading(true);
    setUploadStatusText("ፋይሉን በመጫን ላይ…");
    try {
      const safeName = (attachment.name || `file_${Date.now()}`).replace(
        /\s+/g,
        "_"
      );
      const safeType = inferMime(safeName, attachment.type);

      const formData = new FormData();
      formData.append("file", {
        uri: attachment.uri,
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

        const finalMedia: MediaDescriptor = {
          ...res.media,
          originalName: attachment.name,
        };

        const newMsg: MessageItem = {
          id: clientId,
          channelId: channelId,
          senderId: uid || "me",
          senderRole: role as MessageItem["senderRole"],
          content: caption,
          media: finalMedia,
          type: msgType,
          createdAt: Date.now(),
          status: "PENDING",
          replyTo: replySnippet,
        };

        setOptimisticMessages((prev) => [...prev, newMsg]);
        setStagedAttachment(null);
        setInputText("");
        setReplyingTo(null);

        sendMutation.mutate({
          content: caption,
          type: msgType,
          media: finalMedia,
          clientMessageId: clientId,
          replyTo: replySnippet,
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

  const handlePressSend = () => {
    if (editingMessage) {
      const trimmed = inputText.trim();
      if (!trimmed || editMutation.isPending) return;
      editMutation.mutate({
        messageId: editingMessage.id,
        content: trimmed,
      });
      return;
    }

    if (stagedAttachment) {
      handleSendWithAttachment();
    } else {
      handleSendText();
    }
  };

  // 8. Picker Handlers (With Staging & Cancellation)
  const handleTakePhoto = async () => {
    setShowAttachModal(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("ፍቃድ ያስፈልጋል", "ካሜራ ለመጠቀም ፍቃድ ይስጡ");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setStagedAttachment({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          width: asset.width,
          height: asset.height,
          size: asset.fileSize,
          isImage: true,
          isVideo: false,
          isDocument: false,
        });
      }
    } catch (err: any) {
      Alert.alert("ስህተት", "ፎቶ ማንሳት አልተቻለም፡ " + err.message);
    }
  };

  const handlePickMedia = async () => {
    setShowAttachModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.85,
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

        setStagedAttachment({
          uri: asset.uri,
          name: fileName,
          type: mimeType,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
          durationSeconds: asset.duration
            ? Math.round(asset.duration / 1000)
            : undefined,
          isImage: !isVideo,
          isVideo: isVideo,
          isDocument: false,
        });
      }
    } catch (err: any) {
      Alert.alert("ስህተት", "ምስል ወይም ቪዲዮ መምረጥ አልተቻለም፡ " + err.message);
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

        setStagedAttachment({
          uri: asset.uri,
          name: asset.name,
          type: safeMime,
          size: asset.size,
          isImage: safeMime.startsWith("image/"),
          isVideo: safeMime.startsWith("video/"),
          isDocument:
            !safeMime.startsWith("image/") && !safeMime.startsWith("video/"),
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
            const isDeleted = Boolean(item.deletedAt);
            const locked =
              item.isEncrypted &&
              displayContent(item) === LOCKED_MESSAGE_PLACEHOLDER;
            const hasMedia = Boolean(item.media?.url);
            const isImg =
              item.media?.mimeType?.startsWith("image/") ||
              item.type === "IMAGE";
            const isVid =
              item.media?.mimeType?.startsWith("video/") ||
              item.type === "VIDEO";

            return (
              <View
                style={[
                  styles.msgRow,
                  isMe ? styles.myMsgRow : styles.otherMsgRow,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onLongPress={() => {
                    if (!isDeleted) {
                      setSelectedMessage(item);
                      setActionMenuVisible(true);
                    }
                  }}
                  style={[
                    styles.bubble,
                    isMe
                      ? styles.myBubble
                      : isFather
                      ? styles.fatherBubble
                      : styles.otherBubble,
                    isDeleted && styles.deletedBubble,
                  ]}
                >
                  {!isMe && isFather && !isDeleted && (
                    <View style={styles.fatherBadgeRow}>
                      <Shield color={THEME.colors.sacredAmber} size={13} />
                      <Text style={styles.fatherBadgeText}>
                        {item.senderName || "የንስሐ አባት"}
                      </Text>
                    </View>
                  )}

                  {!isMe && !isFather && item.senderName && !isDeleted ? (
                    <Text style={styles.senderName}>{item.senderName}</Text>
                  ) : null}

                  {/* Reply Quote Header in Bubble */}
                  {!isDeleted && item.replyTo && (
                    <View
                      style={[
                        styles.bubbleReplyBox,
                        isMe
                          ? styles.myBubbleReplyBox
                          : styles.otherBubbleReplyBox,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubbleReplyBar,
                          {
                            backgroundColor: isMe
                              ? THEME.colors.sacredAmber
                              : THEME.colors.sacredCrimson,
                          },
                        ]}
                      />
                      <View style={styles.bubbleReplyContent}>
                        <Text
                          style={[
                            styles.bubbleReplyAuthor,
                            isMe
                              ? styles.myBubbleReplyAuthor
                              : styles.otherBubbleReplyAuthor,
                          ]}
                          numberOfLines={1}
                        >
                          {item.replyTo.senderName}
                        </Text>
                        <Text
                          style={[
                            styles.bubbleReplySnippet,
                            isMe
                              ? styles.myBubbleReplySnippet
                              : styles.otherBubbleReplySnippet,
                          ]}
                          numberOfLines={1}
                        >
                          {item.replyTo.contentSnippet}
                        </Text>
                      </View>
                    </View>
                  )}

                  {isDeleted ? (
                    <View style={styles.deletedRow}>
                      <XCircle
                        color={
                          isMe
                            ? "rgba(255,255,255,0.6)"
                            : THEME.colors.inkSubtle
                        }
                        size={14}
                      />
                      <Text
                        style={[
                          styles.deletedText,
                          isMe
                            ? styles.myDeletedText
                            : styles.otherDeletedText,
                        ]}
                      >
                        ይህ መልዕክት ተሰርዟል
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Media Content */}
                      {hasMedia && item.media?.url && (
                        <View style={styles.mediaContainer}>
                          {isImg ? (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() =>
                                item.media?.url &&
                                Linking.openURL(item.media.url)
                              }
                              style={styles.imageCard}
                            >
                              <Image
                                source={{ uri: item.media.url }}
                                style={styles.msgImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ) : isVid ? (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() =>
                                item.media?.url &&
                                Linking.openURL(item.media.url)
                              }
                              style={styles.videoCard}
                            >
                              {item.media.thumbnailUrl ? (
                                <Image
                                  source={{ uri: item.media.thumbnailUrl }}
                                  style={styles.msgImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.videoPlaceholder}>
                                  <Video color="#FFFFFF" size={32} />
                                </View>
                              )}
                              <View style={styles.playIconOverlay}>
                                <Play
                                  color="#FFFFFF"
                                  size={24}
                                  fill="#FFFFFF"
                                />
                              </View>
                              {item.media.durationSeconds ? (
                                <View style={styles.durationBadge}>
                                  <Text style={styles.durationText}>
                                    {Math.floor(
                                      item.media.durationSeconds / 60
                                    )}
                                    :
                                    {String(
                                      item.media.durationSeconds % 60
                                    ).padStart(2, "0")}
                                  </Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() =>
                                item.media?.url &&
                                Linking.openURL(item.media.url)
                              }
                              style={[
                                styles.docCard,
                                isMe ? styles.myDocCard : styles.otherDocCard,
                              ]}
                            >
                              {(() => {
                                const fileName = resolveFilename(item.media);
                                const badge = getFileBadge(
                                  fileName,
                                  item.media.mimeType
                                );
                                return (
                                  <>
                                    <View
                                      style={[
                                        styles.docBadgeBox,
                                        { backgroundColor: badge.bg },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.docBadgeText,
                                          { color: badge.text },
                                        ]}
                                      >
                                        {badge.label}
                                      </Text>
                                    </View>
                                    <View style={styles.docInfo}>
                                      <Text
                                        numberOfLines={2}
                                        style={[
                                          styles.docName,
                                          isMe
                                            ? styles.myDocName
                                            : styles.otherDocName,
                                        ]}
                                      >
                                        {fileName}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.docSize,
                                          isMe && {
                                            color: "rgba(255,255,255,0.7)",
                                          },
                                        ]}
                                      >
                                        {item.media.sizeBytes
                                          ? formatFileSize(item.media.sizeBytes)
                                          : "ፋይል"}
                                      </Text>
                                    </View>
                                    <Download
                                      color={
                                        isMe ? "#FFFFFF" : THEME.colors.inkMuted
                                      }
                                      size={16}
                                    />
                                  </>
                                );
                              })()}
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Caption / Text Content */}
                      {item.content ? (
                        <View style={styles.contentRow}>
                          {locked && (
                            <Lock
                              color={
                                isMe
                                  ? "rgba(255,255,255,0.7)"
                                  : THEME.colors.inkSubtle
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
                    </>
                  )}

                  <View style={styles.footerRow}>
                    {Boolean(item.editedAt) && !isDeleted && (
                      <Text
                        style={[
                          styles.editedTag,
                          isMe && { color: "rgba(255, 255, 255, 0.6)" },
                        ]}
                      >
                        (የታረመ)
                      </Text>
                    )}
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
                </TouchableOpacity>

                {/* Reaction Badges Row */}
                {!isDeleted &&
                  item.reactions &&
                  Object.keys(item.reactions).length > 0 && (
                    <View
                      style={[
                        styles.reactionsRow,
                        isMe
                          ? styles.myReactionsRow
                          : styles.otherReactionsRow,
                      ]}
                    >
                      {Object.entries(item.reactions).map(([emoji, uids]) => {
                        if (!Array.isArray(uids) || uids.length === 0)
                          return null;
                        const didReact = uids.includes(uid || "");
                        return (
                          <TouchableOpacity
                            key={emoji}
                            activeOpacity={0.7}
                            onPress={() =>
                              reactMutation.mutate({
                                messageId: item.id,
                                emoji,
                              })
                            }
                            style={[
                              styles.reactionPill,
                              didReact && styles.reactionPillActive,
                            ]}
                          >
                            <Text style={styles.reactionPillEmoji}>
                              {emoji}
                            </Text>
                            <Text
                              style={[
                                styles.reactionPillCount,
                                didReact && styles.reactionPillCountActive,
                              ]}
                            >
                              {uids.length}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
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

      {/* Modern Composer Bar with Staged Attachment Preview & Reply/Edit Banners */}
      <View style={styles.composerContainer}>
        {/* Reply Quote Banner */}
        {replyingTo && (
          <View style={styles.replyBannerContainer}>
            <View style={styles.replyBannerBar} />
            <View style={styles.replyBannerContent}>
              <View style={styles.replyBannerHeader}>
                <CornerUpLeft color={THEME.colors.sacredCrimson} size={13} />
                <Text style={styles.replyBannerUser} numberOfLines={1}>
                  {replyingTo.senderId === uid
                    ? "እርስዎ"
                    : replyingTo.senderName || "ተጠቃሚ"}
                </Text>
              </View>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyingTo.content
                  ? displayContent(replyingTo)
                  : replyingTo.media
                  ? replyingTo.media.mimeType.startsWith("image/")
                    ? "📷 ፎቶ"
                    : replyingTo.media.mimeType.startsWith("video/")
                    ? "🎥 ቪዲዮ"
                    : "📎 ፋይል"
                  : "መልዕክት"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={styles.replyBannerClose}
              hitSlop={8}
            >
              <X color={THEME.colors.inkMuted} size={16} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Message Banner */}
        {editingMessage && (
          <View style={styles.editingBannerContainer}>
            <View style={styles.editingBannerBar} />
            <View style={styles.replyBannerContent}>
              <View style={styles.replyBannerHeader}>
                <Edit2 color={THEME.colors.sacredAmber} size={13} />
                <Text
                  style={[
                    styles.replyBannerUser,
                    { color: THEME.colors.sacredAmber },
                  ]}
                >
                  መልዕክት በማረም ላይ...
                </Text>
              </View>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {displayContent(editingMessage)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMessage(null);
                setInputText("");
              }}
              style={styles.replyBannerClose}
              hitSlop={8}
            >
              <X color={THEME.colors.inkMuted} size={16} />
            </TouchableOpacity>
          </View>
        )}

        {/* Staged Attachment Preview Card with Cancel/Delete Button */}
        {stagedAttachment && (
          <View style={styles.stagedCard}>
            {stagedAttachment.isImage ? (
              <Image
                source={{ uri: stagedAttachment.uri }}
                style={styles.stagedThumb}
              />
            ) : stagedAttachment.isVideo ? (
              <View
                style={[
                  styles.stagedIconBox,
                  { backgroundColor: "#E0E7FF" },
                ]}
              >
                <Video color="#4F46E5" size={20} />
              </View>
            ) : (
              <View
                style={[
                  styles.stagedIconBox,
                  { backgroundColor: "#FEE2E2" },
                ]}
              >
                <FileText color="#DC2626" size={20} />
              </View>
            )}

            <View style={styles.stagedInfo}>
              <Text numberOfLines={1} style={styles.stagedName}>
                {stagedAttachment.name}
              </Text>
              <Text style={styles.stagedSize}>
                {stagedAttachment.size
                  ? formatFileSize(stagedAttachment.size)
                  : "ተመርጧል"}
                {stagedAttachment.isVideo
                  ? " • ቪዲዮ"
                  : stagedAttachment.isImage
                  ? " • ምስል"
                  : " • ሰነድ"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.stagedRemoveBtn}
              onPress={() => setStagedAttachment(null)}
              hitSlop={8}
            >
              <XCircle color={THEME.colors.inkMuted} size={20} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Row: Attachment Paperclip inside the input bar */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachInsideBtn}
            onPress={() => setShowAttachModal(true)}
            disabled={isUploading || sendMutation.isPending}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Paperclip color={THEME.colors.sacredAmber} size={20} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={
              editingMessage
                ? "የታረመውን መልዕክት ይጻፉ..."
                : stagedAttachment
                ? "መግለጫ ይጻፉ... (አማራጭ)"
                : "መልእክት ይጻፉ... (ምክርና መመሪያ)"
            }
            placeholderTextColor={THEME.colors.inkSubtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() &&
                !stagedAttachment &&
                styles.sendBtnDisabled,
            ]}
            onPress={handlePressSend}
            disabled={
              (!inputText.trim() && !stagedAttachment) ||
              isUploading ||
              sendMutation.isPending ||
              editMutation.isPending
            }
            activeOpacity={0.8}
          >
            {isUploading || sendMutation.isPending || editMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Send color="#FFFFFF" size={16} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Message Long Press Action Sheet Modal */}
      <Modal
        visible={actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setActionMenuVisible(false);
          setSelectedMessage(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setActionMenuVisible(false);
            setSelectedMessage(null);
          }}
        >
          <View style={styles.modalCard}>
            {/* Top Row: Dignified Spiritual Reactions */}
            <View style={styles.reactionsSheetRow}>
              {DIGNIFIED_REACTIONS.map((r) => {
                const isSelected = selectedMessage?.reactions?.[
                  r.emoji
                ]?.includes(uid || "");
                return (
                  <TouchableOpacity
                    key={r.emoji}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMessage) {
                        reactMutation.mutate({
                          messageId: selectedMessage.id,
                          emoji: r.emoji,
                        });
                      }
                      setActionMenuVisible(false);
                      setSelectedMessage(null);
                    }}
                    style={[
                      styles.sheetReactionBtn,
                      isSelected && styles.sheetReactionBtnActive,
                    ]}
                  >
                    <Text style={styles.sheetReactionEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetDivider} />

            {/* Action: Reply (ጥቅስ / መልስ) */}
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                if (selectedMessage) {
                  setReplyingTo(selectedMessage);
                  setEditingMessage(null);
                }
                setActionMenuVisible(false);
                setSelectedMessage(null);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.modalOptionIcon,
                  { backgroundColor: "#EFF6FF" },
                ]}
              >
                <CornerUpLeft color="#2563EB" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>መልስ ስጥ (Reply)</Text>
                <Text style={styles.modalOptionSub}>
                  ለዚህ መልዕክት ጥቅስ ሰጥተው ይመልሱ
                </Text>
              </View>
            </TouchableOpacity>

            {/* Action: Copy Text */}
            {selectedMessage?.content ? (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={async () => {
                  if (selectedMessage) {
                    const textToCopy = displayContent(selectedMessage);
                    await Clipboard.setStringAsync(textToCopy);
                    Alert.alert(
                      "ተገልብጧል",
                      "የመልዕክቱ ጽሑፍ ወደ ቅንጥብ ሰሌዳ ተገልብጧል።"
                    );
                  }
                  setActionMenuVisible(false);
                  setSelectedMessage(null);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.modalOptionIcon,
                    { backgroundColor: "#F3F4F6" },
                  ]}
                >
                  <Copy color="#374151" size={20} />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionLabel}>ጽሑፍ ቅዳ (Copy)</Text>
                  <Text style={styles.modalOptionSub}>
                    ጽሑፉን ወደ ቅንጥብ ሰሌዳ ለመገልበጥ
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Action: Edit (isMe only) */}
            {selectedMessage &&
            (selectedMessage.senderId === uid ||
              selectedMessage.senderId === "me") &&
            !selectedMessage.deletedAt ? (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setInputText(displayContent(selectedMessage));
                  setReplyingTo(null);
                  setActionMenuVisible(false);
                  setSelectedMessage(null);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.modalOptionIcon,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Edit2 color="#B45309" size={20} />
                </View>
                <View style={styles.modalOptionText}>
                  <Text
                    style={[
                      styles.modalOptionLabel,
                      { color: THEME.colors.sacredAmber },
                    ]}
                  >
                    አርትዕ (Edit)
                  </Text>
                  <Text style={styles.modalOptionSub}>
                    የላኩትን መልዕክት ጽሑፍ ያስተካክሉ
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Action: Delete (isMe or Father) */}
            {selectedMessage &&
            !selectedMessage.deletedAt &&
            (selectedMessage.senderId === uid ||
              selectedMessage.senderId === "me" ||
              role === "FATHER" ||
              role === "GOVERNOR") ? (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  const msgId = selectedMessage.id;
                  setActionMenuVisible(false);
                  setSelectedMessage(null);
                  Alert.alert(
                    "መልዕክት ሰርዝ",
                    "ይህንን መልዕክት መሰረዝ እርግጠኛ ነዎት?",
                    [
                      { text: "ተመለስ", style: "cancel" },
                      {
                        text: "ሰርዝ",
                        style: "destructive",
                        onPress: () => deleteMutation.mutate(msgId),
                      },
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.modalOptionIcon,
                    { backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <Trash2 color="#DC2626" size={20} />
                </View>
                <View style={styles.modalOptionText}>
                  <Text
                    style={[
                      styles.modalOptionLabel,
                      { color: THEME.colors.error },
                    ]}
                  >
                    ሰርዝ (Delete)
                  </Text>
                  <Text style={styles.modalOptionSub}>
                    ይህ መልዕክት ከውይይቱ እንዲሰረዝ ያድርጉ
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setActionMenuVisible(false);
                setSelectedMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText}>ተመለስ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
                <Text style={styles.modalOptionSub}>
                  በቀጥታ ፎቶ አንስተው ያጋሩ
                </Text>
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
    maxWidth: "84%",
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
    width: 230,
    height: 160,
    borderRadius: 10,
  },
  videoCard: {
    width: 230,
    height: 160,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000000",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
  },
  playIconOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    gap: 10,
    minWidth: 210,
  },
  myDocCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  otherDocCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
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

  /* Modern Composer Styles */
  composerContainer: {
    backgroundColor: THEME.colors.navigationBg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.sacredCrimsonBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stagedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  stagedThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  stagedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stagedInfo: {
    flex: 1,
  },
  stagedName: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
  },
  stagedSize: {
    fontSize: 10.5,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  stagedRemoveBtn: {
    padding: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attachInsideBtn: {
    padding: 8,
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
    paddingHorizontal: 14,
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
    opacity: 0.35,
  },

  /* Attachment Modal Styles */
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
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
  },

  /* Reply Quote in Bubble */
  bubbleReplyBox: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  myBubbleReplyBox: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  otherBubbleReplyBox: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  bubbleReplyBar: {
    width: 3.5,
    borderRadius: 2,
    marginRight: 6,
  },
  bubbleReplyContent: {
    flex: 1,
  },
  bubbleReplyAuthor: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
  },
  myBubbleReplyAuthor: {
    color: THEME.colors.sacredAmber,
  },
  otherBubbleReplyAuthor: {
    color: THEME.colors.sacredCrimson,
  },
  bubbleReplySnippet: {
    fontSize: 11.5,
  },
  myBubbleReplySnippet: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  otherBubbleReplySnippet: {
    color: THEME.colors.inkSubtle,
  },

  /* Deleted Message State */
  deletedBubble: {
    opacity: 0.75,
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  myDeletedText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherDeletedText: {
    color: THEME.colors.inkMuted,
  },
  editedTag: {
    fontSize: 9.5,
    fontStyle: "italic",
    color: THEME.colors.inkSubtle,
    marginRight: 3,
  },

  /* Reaction Badges Row on Message */
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  myReactionsRow: {
    justifyContent: "flex-end",
  },
  otherReactionsRow: {
    justifyContent: "flex-start",
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 3,
    ...THEME.shadows.button,
  },
  reactionPillActive: {
    backgroundColor: "#FEF3C7",
    borderColor: THEME.colors.sacredAmber,
  },
  reactionPillEmoji: {
    fontSize: 13,
  },
  reactionPillCount: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  reactionPillCountActive: {
    color: "#B45309",
    fontWeight: "800",
  },

  /* Reply & Edit Composer Banners */
  replyBannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  replyBannerBar: {
    width: 3.5,
    height: "100%",
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: 2,
    marginRight: 8,
  },
  editingBannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  editingBannerBar: {
    width: 3.5,
    height: "100%",
    backgroundColor: THEME.colors.sacredAmber,
    borderRadius: 2,
    marginRight: 8,
  },
  replyBannerContent: {
    flex: 1,
  },
  replyBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyBannerUser: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.sacredCrimson,
  },
  replyBannerText: {
    fontSize: 11.5,
    color: THEME.colors.inkMuted,
    marginTop: 1,
  },
  replyBannerClose: {
    padding: 4,
  },

  /* Reaction Sheet Palette */
  reactionsSheetRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sheetReactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sheetReactionBtnActive: {
    backgroundColor: "#FEF3C7",
    borderColor: THEME.colors.sacredAmber,
    transform: [{ scale: 1.1 }],
  },
  sheetReactionEmoji: {
    fontSize: 22,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
});
