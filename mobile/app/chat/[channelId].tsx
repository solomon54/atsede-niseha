import NetInfo from "@react-native-community/netinfo";
import {
  encryptedContentFingerprint,
  LOCKED_MESSAGE_PLACEHOLDER,
  resolveEncryptedDisplayText,
  shouldAttemptDecryption,
  type DecryptedMessageEntry,
} from "@shared/domain/messaging/encryptedDisplay";
import {
  getMessageDeliveryFeedback,
  MESSAGE_SYNC_TERMS,
} from "@shared/domain/messaging/syncFeedback";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";
import { Audio, Video, ResizeMode } from "expo-av";
import {
  AlertCircle,
  ArrowDown,
  Camera,
  Check,
  CheckCheck,
  Clock,
  Copy,
  CornerUpLeft,
  Download,
  Edit2,
  FileText,
  Lock,
  Paperclip,
  Pause,
  Phone,
  PhoneOff,
  PhoneMissed,
  Play,
  RotateCcw,
  Send,
  Shield,
  Video as VideoIcon,
  X,
  XCircle,
} from "lucide-react-native";
import { apiRequest, apiUpload } from "../../src/lib/api";
import { setActiveChatChannel } from "../../src/lib/active-chat";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import { useCacheFirst } from "../../src/lib/use-cache-first";
import { getMobilePusher } from "../../src/lib/pusher";
import { messageSyncNotifier } from "../../src/lib/messageSyncEvents";
import {
  conversationCacheKey,
  conversationQueryKey,
  messageQueryKey,
  preserveClientMessageIds,
} from "../../src/lib/messagingReliability";
import { mobileSyncService } from "../../src/lib/sync";
import {
  decryptMessage,
  encryptMessage,
  EncryptionEnvelope,
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

export interface MessageItem {
  id: string;
  clientMessageId?: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderRole?: "FATHER" | "STUDENT" | "GOVERNOR" | "CHILD";
  senderPhotoUrl?: string;
  type?: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO" | "CALL";
  content: string;
  media?: MediaDescriptor | null;
  createdAt: number;
  updatedAt?: number;
  editedAt?: number;
  deletedAt?: number;
  status?: "PENDING" | "SENT" | "FAILED";
  isEncrypted?: boolean;
  encryption?: EncryptionEnvelope | null;
  reactions?: Record<string, string[]>;
  replyTo?: ReplyToDescriptor | null;
  callDetails?: {
    callId: string;
    channelId: string;
    callerId: string;
    callerName: string;
    callerPhotoUrl?: string | null;
    callerRole?: string | null;
    status: "answered" | "declined" | "missed" | "cancelled" | "ringing" | "ended";
    startedAt: number;
    answeredAt?: number | null;
    endedAt?: number | null;
    durationSec?: number | null;
    isGroup: boolean;
  } | null;
}

interface MessageUpdateEvent {
  messageId?: string;
  id?: string;
  callId?: string;
  updatedAt?: number;
  editedAt?: number;
  content?: string;
  type?: MessageItem["type"];
  createdAt?: number;
  senderId?: string;
  senderName?: string;
  senderRole?: MessageItem["senderRole"];
  isEncrypted?: boolean;
  media?: MessageItem["media"];
  encryption?: EncryptionEnvelope | null;
  callDetails?: MessageItem["callDetails"];
  deletedAt?: number;
}

interface RoomChannel {
  bind(event: string, handler: (payload: any) => void): void;
  unbind(event: string, handler: (payload: any) => void): void;
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
const MAX_CHAR_LIMIT = 4000;
const CHAR_WARNING_THRESHOLD = 3600;

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif",
  "mp4", "mov", "avi", "webm",
  "mp3", "m4a", "wav", "ogg", "aac",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt",
]);

function sanitizePlainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

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
  if (["XLS", "XLSX"].includes(ext) || mime?.includes("excel") || mime?.includes("sheet")) {
    return { label: "XLS", bg: "#DCFCE7", text: "#16A34A" };
  }
  if (["PPT", "PPTX"].includes(ext) || mime?.includes("powerpoint") || mime?.includes("presentation")) {
    return { label: "PPT", bg: "#FFEDD5", text: "#EA580C" };
  }
  if (["MP3", "M4A", "WAV", "AAC", "OGG"].includes(ext) || mime?.startsWith("audio/")) {
    return { label: "AUDIO", bg: "#F3E8FF", text: "#9333EA" };
  }
  if (["MP4", "MOV", "AVI", "WEBM"].includes(ext) || mime?.startsWith("video/")) {
    return { label: "VIDEO", bg: "#E0E7FF", text: "#4F46E5" };
  }
  return { label: ext || "FILE", bg: "#F1F5F9", text: "#475569" };
}

function extractFirstHttpsUrl(text: string): string | null {
  const match = text.match(/https:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// In-Bubble Safe Link Preview Card Component
function BubbleLinkPreview({ url }: { url: string }) {
  const { data: preview } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      return await apiRequest<{
        url: string;
        title?: string;
        description?: string;
        image?: string;
        siteName?: string;
      }>(`/api/message/link-preview?url=${encodeURIComponent(url)}`);
    },
    staleTime: 1000 * 60 * 60,
  });

  if (!preview || !preview.title) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => WebBrowser.openBrowserAsync(url)}
      style={styles.linkCard}
    >
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={styles.linkImage} resizeMode="cover" />
      ) : null}
      <View style={styles.linkInfo}>
        <Text style={styles.linkDomain} numberOfLines={1}>
          {preview.siteName || url.replace(/^https?:\/\//i, "").split("/")[0]}
        </Text>
        <Text style={styles.linkTitle} numberOfLines={2}>
          {preview.title}
        </Text>
        {preview.description ? (
          <Text style={styles.linkDesc} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// In-Bubble Audio Player Component
function BubbleAudioPlayer({
  url,
  isMe,
  durationSeconds,
}: {
  url: string;
  isMe: boolean;
  durationSeconds?: number | null;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(
    durationSeconds ? durationSeconds * 1000 : 0
  );

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const togglePlay = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPositionMs(status.positionMillis);
              setDurationMs(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMs(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  };

  const formatAudioTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.audioContainer, isMe ? styles.myAudioBg : styles.otherAudioBg]}>
      <TouchableOpacity
        onPress={togglePlay}
        style={[styles.audioPlayBtn, isMe ? styles.myAudioPlayBtn : styles.otherAudioPlayBtn]}
        activeOpacity={0.8}
      >
        {isPlaying ? (
          <Pause size={16} color={isMe ? "#0F172A" : "#FFFFFF"} />
        ) : (
          <Play size={16} color={isMe ? "#0F172A" : "#FFFFFF"} fill={isMe ? "#0F172A" : "#FFFFFF"} />
        )}
      </TouchableOpacity>
      <View style={styles.audioWaveform}>
        <View
          style={[
            styles.audioProgressBar,
            {
              width: durationMs > 0 ? `${Math.min(100, (positionMs / durationMs) * 100)}%` : "0%",
              backgroundColor: isMe ? THEME.colors.sacredAmber : THEME.colors.sacredCrimson,
            },
          ]}
        />
      </View>
      <Text style={[styles.audioTimeText, isMe && { color: "rgba(255,255,255,0.7)" }]}>
        {formatAudioTime(positionMs > 0 ? positionMs : durationMs)}
      </Text>
    </View>
  );
}

export default function ChannelChatScreen() {
  const { channelId, targetMessageId } = useLocalSearchParams<{ channelId: string; targetMessageId?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { role, uid } = useAuth();
  const queryClient = useQueryClient();
  const conversationsKey = useMemo(() => conversationQueryKey(uid), [uid]);
  const conversationsCacheKey = conversationCacheKey(uid);
  const messagesKey = useMemo(
    () => messageQueryKey(uid, channelId),
    [uid, channelId]
  );

  const [inputText, setInputText] = useState("");
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);
  const attemptedDecrypt = useRef<Set<string>>(new Set());
  const [decryptedContent, setDecryptedContent] = useState<
    Record<string, DecryptedMessageEntry>
  >({});
  const forgetDecryptedMessage = useCallback((messageId: string) => {
    // Keys are `${id}:${fingerprint}`; drop every attempt for this id so an
    // edited envelope or a retried fetch can be resolved again.
    for (const key of attemptedDecrypt.current) {
      if (key.startsWith(`${messageId}:`)) attemptedDecrypt.current.delete(key);
    }
    setDecryptedContent((prev) => {
      if (!(messageId in prev)) return prev;
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");

  // In-App Media Viewer States
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [viewingVideoUrl, setViewingVideoUrl] = useState<string | null>(null);

  // File Download Tracking
  const [downloadedFiles, setDownloadedFiles] = useState<Record<string, string>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // Replies, Edits, Reactions & Action Menu State
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  // Scroll and Position Restoration State
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);
  const isAtBottomRef = useRef(true);
  const flatListRef = useRef<FlatList>(null);
  const initialScrollDone = useRef(false);

  // One query function for both the mounted query and explicit recovery
  // triggers. SQLite is the immediate source; persisted messages are the
  // authoritative source whenever the network is available.
  const loadMessages = useCallback(async (): Promise<MessageItem[]> => {
    const cached = await offlineCache.getMessages<MessageItem>(channelId);
    try {
      const synced = await mobileSyncService.syncChannelMessages(
        channelId,
        uid || undefined
      );
      const authoritative =
        synced && synced.length > 0 ? (synced as MessageItem[]) : cached;
      return preserveClientMessageIds<MessageItem>(authoritative, cached);
    } catch {
      return cached;
    }
  }, [channelId, uid]);

  const refreshMessages = useCallback(() => {
    if (!channelId || !uid) return Promise.resolve<MessageItem[]>([]);
    return queryClient.fetchQuery<MessageItem[]>({
      queryKey: messagesKey,
      queryFn: loadMessages,
      staleTime: 0,
    });
  }, [channelId, uid, messagesKey, queryClient, loadMessages]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      const wasOnline = isOnlineRef.current;
      isOnlineRef.current = online;
      setIsOnline(online);
      if (online && !wasOnline) refreshMessages().catch(() => {});
    });
    return () => unsubscribe();
  }, [refreshMessages]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") refreshMessages().catch(() => {});
    });
    return () => subscription.remove();
  }, [refreshMessages]);

  // Any successful delta sync (including root-level AppState/Pusher recovery)
  // publishes the new SQLite rows here so a mounted screen cannot stay stale.
  useEffect(
    () =>
      messageSyncNotifier.subscribe((syncedChannelId, messages, ownerUid) => {
        if (syncedChannelId !== channelId || ownerUid !== uid) return;
        queryClient.setQueryData<MessageItem[]>(messagesKey, (old = []) =>
          preserveClientMessageIds<MessageItem>(
            messages as MessageItem[],
            old
          )
        );
      }),
    [channelId, messagesKey, queryClient, uid]
  );

  // 1. Fetch channel messages (SQLite-first + background delta sync)
  const {
    data: serverMessages,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MessageItem[]>({
    queryKey: messagesKey,
    queryFn: loadMessages,
    enabled: Boolean(channelId && uid),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const cacheChecked = useCacheFirst<MessageItem[]>(
    messagesKey,
    () => offlineCache.getMessages<MessageItem>(channelId)
  );

  // Exact-message recovery for notification tap (G): fetch targeted message if missing locally.
  // Must be idempotent and must NOT advance ordinary sync cursor.
  useEffect(() => {
    const mid = typeof targetMessageId === "string" ? targetMessageId.trim() : "";
    if (!channelId || !mid) return;
    let cancelled = false;
    (async () => {
      try {
        const cached = await offlineCache.getMessages<MessageItem>(channelId, 500);
        const exists = cached.some((m) => m.id === mid);
        if (exists) return;
        const res = await apiRequest<any[]>(`/api/message/list?channelId=${encodeURIComponent(channelId)}&messageId=${encodeURIComponent(mid)}`);
        if (cancelled) return;
        const msg = Array.isArray(res) ? res[0] : null;
        if (!msg || !msg.id) {
          Alert.alert("መልዕክት አልተገኘም", "የተመረጠው መልዕክት ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።");
          return;
        }
        if (cancelled) return;
        if (msg.deletedAt) {
          await offlineCache.saveMessages(channelId, [{ ...msg, content: "", media: null, status: "SENT" }]);
        } else {
          await offlineCache.saveMessages(channelId, [{ ...msg, status: "SENT" }]);
        }
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: messagesKey });
        }
      } catch (e: any) {
        if (cancelled) return;
        const m = String(e?.message || "");
        if (/404|not found/i.test(m)) {
          Alert.alert("መልዕክት አልተገኘም", "የተመረጠው መልዕክት ተሰርዟል ወይም አይገኝም።");
        } else if (/403|forbidden|unauthorized/i.test(m)) {
          Alert.alert("ፈቃድ የለም", "ይህን መልዕክት ለማየት ፈቃድ የለዎትም።");
        } else {
          Alert.alert("መልዕክት መጫን አልተቻለም", "የተመረጠው መልዕክት ማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [channelId, targetMessageId, messagesKey, queryClient]);


  // 2. Fetch conversations to know channel title / recipient name
  const { data: convos } = useQuery<any[]>({
    queryKey: conversationsKey,
    enabled: Boolean(conversationsCacheKey),
    queryFn: async () => {
      if (!conversationsCacheKey) return [];
      const cached = await offlineCache.getQuery<any[]>(conversationsCacheKey);
      if (cached && cached.length > 0) return cached;
      return await mobileSyncService.syncConversations(uid || undefined);
    },
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const currentConvo = convos?.find((c) => c.id === channelId);
  const isCommonHouse =
    currentConvo?.role === "COMMON_HOUSE" ||
    currentConvo?.type === "COMMON_HOUSE";
  const channelDisplayTitle = isCommonHouse
    ? "የጋራ ቤት"
    : currentConvo?.fullName || "የግል መልዕክት";

  // Sanitize header title: hide "FORBIDDEN"
  const cleanHeaderTitle = channelDisplayTitle
    .replace(/FORBIDDEN/gi, "")
    .trim() || "ውይይት";

  useEffect(() => {
    navigation.setOptions({
      title: cleanHeaderTitle,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (!channelId) return;
            router.push(`/call/${channelId}`);
          }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          accessibilityLabel="Start video call"
        >
          <VideoIcon color={THEME.colors.sacredAmber} size={22} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, cleanHeaderTitle, channelId, router]);

  // 3. Resolve every encrypted row to plaintext or an explicit locked state.
  // The previous gate required `encryption?.keyId`, so encrypted rows with a
  // missing/partial envelope were never attempted and rendered "…" forever.
  useEffect(() => {
    const messages = serverMessages || [];
    const queuedKeys: string[] = [];
    const queued = messages.filter((message) => {
      if (!shouldAttemptDecryption(message, decryptedContent[message.id])) {
        return false;
      }
      const key = `${message.id}:${encryptedContentFingerprint(message)}`;
      if (attemptedDecrypt.current.has(key)) return false;
      attemptedDecrypt.current.add(key);
      queuedKeys.push(key);
      return true;
    });

    if (queued.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates: Record<string, DecryptedMessageEntry> = {};
      for (const message of queued) {
        const fingerprint = encryptedContentFingerprint(message);
        let text = LOCKED_MESSAGE_PLACEHOLDER;
        if (
          message.content &&
          message.encryption?.keyId &&
          message.encryption?.iv
        ) {
          try {
            text = await decryptMessage(message.content, message.encryption);
          } catch {
            text = LOCKED_MESSAGE_PLACEHOLDER;
          }
        }
        updates[message.id] = { text, fingerprint };
      }
      if (cancelled) return;
      setDecryptedContent((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      cancelled = true;
      // If this batch was superseded before it resolved, release its attempt
      // keys so the next render can retry the still-unresolved payload.
      for (const key of queuedKeys) {
        attemptedDecrypt.current.delete(key);
      }
    };
  }, [serverMessages, decryptedContent]);

  // 4. Mark channel read on mount / change & drain outbox
  useEffect(() => {
    if (!channelId || !uid) return;
    offlineCache.queueOutbox(channelId, "MARK_READ", { channelId }, uid).catch(() => {});
    mobileSyncService.drainOutbox(uid).catch(() => {});
  }, [channelId, uid]);

  // Tell the conversation list which room is on screen so it never shows an
  // unread badge for the message the user is currently reading.
  useFocusEffect(
    useCallback(() => {
      if (!channelId) return;
      setActiveChatChannel(channelId);
      // Re-opening a room must always consult the persisted ledger, even when
      // a cached React Query result exists.
      refreshMessages().catch(() => {});
      queryClient.setQueryData<any[]>(conversationsKey, (old) =>
        old?.map((room) =>
          room.id === channelId ? { ...room, unreadCount: 0 } : room
        )
      );
      return () => setActiveChatChannel(null);
    }, [channelId, conversationsKey, queryClient, refreshMessages])
  );

  // 5. Pusher Real-Time Channel Subscription
  useEffect(() => {
    if (!channelId || !uid) return;

    mobileSyncService.syncChannelMessages(channelId, uid).catch(() => {});

    let pusher: any;
    let ch: RoomChannel | undefined;
    const channelName = `private-chat-${channelId}`;
    const bindings: Array<{ event: string; handler: (payload: any) => void }> = [];

    const bind = (event: string, handler: (payload: any) => void) => {
      if (!ch) return;
      ch.bind(event, handler);
      bindings.push({ event, handler });
    };

    const updateMessage = async (event: MessageUpdateEvent) => {
      const messageId =
        event.messageId || event.id || event.callId || event.callDetails?.callId;
      if (!messageId) return;

      const editedAt = event.editedAt || event.updatedAt || Date.now();
      const patch: Partial<MessageItem> = { editedAt };
      if (typeof event.updatedAt === "number") patch.updatedAt = event.updatedAt;
      if (typeof event.content === "string") patch.content = event.content;
      if (event.type) patch.type = event.type;
      if (typeof event.createdAt === "number") patch.createdAt = event.createdAt;
      if (typeof event.senderId === "string") patch.senderId = event.senderId;
      if (typeof event.senderName === "string") patch.senderName = event.senderName;
      if (event.senderRole) patch.senderRole = event.senderRole;
      if (typeof event.isEncrypted === "boolean") patch.isEncrypted = event.isEncrypted;
      if (event.media !== undefined) patch.media = event.media;
      if (event.encryption) patch.encryption = event.encryption;
      if (event.callDetails) patch.callDetails = event.callDetails;
      if (event.deletedAt) {
        patch.deletedAt = event.deletedAt;
        patch.content = "";
        patch.media = null;
      }

      // A fresh encrypted edit has a fresh IV. Forget the old plaintext so the
      // decrypt effect runs again with the new envelope.
      if (event.encryption && typeof event.content === "string") {
        forgetDecryptedMessage(messageId);
      }

      let existed = false;
      await offlineCache.updateMessage(channelId, messageId, (m) => {
        existed = true;
        return { ...m, ...patch };
      });
      if (!existed) {
        // A call transition can arrive before the original CALL row has been
        // synced. Persist a complete row instead of dropping the update.
        const created: MessageItem = {
          id: messageId,
          channelId,
          senderId: event.senderId || uid || "unknown",
          content: event.content || "",
          createdAt: event.createdAt || Date.now(),
          ...patch,
        };
        await offlineCache.saveMessages(channelId, [created]);
      }

      queryClient.setQueryData<MessageItem[]>(
        messagesKey,
        (old = []) => {
          const next = old.map((m) =>
            m.id === messageId ? { ...m, ...patch } : m
          );
          if (existed || next.some((m) => m.id === messageId)) return next;
          const created: MessageItem = {
            id: messageId,
            channelId,
            senderId: event.senderId || uid || "unknown",
            content: event.content || "",
            createdAt: event.createdAt || Date.now(),
            ...patch,
          };
          return [...next, created].sort((a, b) => a.createdAt - b.createdAt);
        }
      );
    };

    try {
      pusher = getMobilePusher();
      ch = pusher.subscribe(channelName);

      bind("new-message", async (msg: any) => {
        if (!msg || !msg.id) return;

        if (msg.isEncrypted) {
          let text = LOCKED_MESSAGE_PLACEHOLDER;
          if (msg.content && msg.encryption?.keyId && msg.encryption?.iv) {
            try {
              text = await decryptMessage(msg.content, msg.encryption);
            } catch {
              text = LOCKED_MESSAGE_PLACEHOLDER;
            }
          }
          setDecryptedContent((prev) => ({
            ...prev,
            [msg.id]: { text, fingerprint: encryptedContentFingerprint(msg) },
          }));
        }

        const normalized: MessageItem = { ...msg, status: "SENT" };
        await offlineCache.saveMessages(channelId, [normalized]);
        queryClient.setQueryData<MessageItem[]>(
          messagesKey,
          (old = []) => {
            if (old.some((m) => m.id === normalized.id)) {
              return old.map((m) => (m.id === normalized.id ? normalized : m));
            }
            return [...old, normalized].sort((a, b) => a.createdAt - b.createdAt);
          }
        );
      });

      bind("message-updated", updateMessage);
      // Text edits are canonically emitted as `message-edited`; `message-updated`
      // remains supported for call/artifact transitions and legacy payloads.
      bind("message-edited", updateMessage);

      bind(
        "message-deleted",
        async (data: { messageId: string; deletedAt?: number }) => {
          if (!data?.messageId) return;
          await offlineCache.updateMessage(channelId, data.messageId, (m) => ({
            ...m,
            deletedAt: data.deletedAt || Date.now(),
            content: "",
            media: null,
          }));
          queryClient.setQueryData<MessageItem[]>(
            messagesKey,
            (old = []) =>
              old.map((m) =>
                m.id === data.messageId
                  ? {
                      ...m,
                      deletedAt: data.deletedAt || Date.now(),
                      content: "",
                      media: null,
                    }
                  : m
              )
          );
        }
      );

      bind(
        "message-reaction",
        async (data: { messageId: string; reactions: Record<string, string[]> }) => {
          if (!data?.messageId) return;
          await offlineCache.updateMessage(channelId, data.messageId, (m) => ({
            ...m,
            reactions: data.reactions,
          }));
          queryClient.setQueryData<MessageItem[]>(
            messagesKey,
            (old = []) =>
              old.map((m) =>
                m.id === data.messageId
                  ? { ...m, reactions: data.reactions }
                  : m
              )
          );
        }
      );

      bind("message-seen", () => {
        // Read state acknowledged
      });
    } catch (e) {
      console.warn("[ChannelChat] Realtime subscription setup failed:", e);
    }

    return () => {
      // The chat tab stays mounted underneath this screen and uses the same
      // private channel. Remove only this screen's handlers; never globally
      // unsubscribe or unbind handlers installed by another mounted view.
      bindings.forEach(({ event, handler }) => {
        try {
          ch?.unbind(event, handler);
        } catch {}
      });
    };
  }, [channelId, uid, messagesKey, queryClient, forgetDecryptedMessage]);

  // Combine server messages with optimistic messages
  const allMessages: MessageItem[] = useMemo(() => {
    const server = serverMessages || [];
    const optimisticUnconfirmed = optimisticMessages.filter(
      (om) =>
        !server.some(
          (sm) =>
            sm.id === om.id ||
            (Boolean(om.clientMessageId) &&
              sm.clientMessageId === om.clientMessageId)
        )
    );
    return [...server, ...optimisticUnconfirmed].sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }, [serverMessages, optimisticMessages]);

  // 5. Scroll Position Restoration & Floating Pill Handler
  useEffect(() => {
    if (allMessages.length === 0 || initialScrollDone.current) return;

    (async () => {
      initialScrollDone.current = true;
      try {
        const lastSeenId = await SecureStore.getItemAsync(
          `chat_last_seen_${uid}_${channelId}`
        );
        if (lastSeenId) {
          const targetIndex = allMessages.findIndex((m) => m.id === lastSeenId);
          if (targetIndex >= 0 && flatListRef.current) {
            flatListRef.current.scrollToIndex({
              index: targetIndex,
              animated: false,
              viewPosition: 0.5,
            });
            return;
          }
        }
      } catch {}
      // Fallback: bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 80);
    })();
  }, [allMessages.length, channelId, uid]);

  // Save last visible message
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distanceFromBottom < 80;
    isAtBottomRef.current = atBottom;

    if (atBottom) {
      setShowNewMsgPill(false);
    }
  };

  // If a new message arrives and user is not at bottom, show pill
  const prevMsgCountRef = useRef(allMessages.length);
  useEffect(() => {
    if (allMessages.length > prevMsgCountRef.current) {
      if (!isAtBottomRef.current) {
        setShowNewMsgPill(true);
      } else {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
    prevMsgCountRef.current = allMessages.length;
  }, [allMessages.length]);

  // 6. Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO";
      media?: MediaDescriptor | null;
      clientMessageId: string;
      replyTo?: ReplyToDescriptor | null;
      createdAt?: number;
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
            : payload.media.mimeType.startsWith("audio/")
            ? "AUDIO"
            : "FILE"
          : "TEXT");

      // Queue in SQLite outbox for guaranteed delivery across offline & restarts
      await offlineCache.queueOutbox(
        channelId!,
        "SEND_MESSAGE",
        {
          channelId,
          content: ciphertext,
          type: messageType,
          media: payload.media,
          isEncrypted: Boolean(encryptionEnvelope),
          encryption: encryptionEnvelope,
          clientMessageId: payload.clientMessageId,
          replyTo: payload.replyTo,
          senderId: uid || undefined,
        },
        uid || undefined
      );

      // Save to SQLite message cache as PENDING. Keep the client id so the
      // optimistic bubble can be cleared only when sync confirms that message.
      await offlineCache.saveMessages(channelId!, [
        {
          id: payload.clientMessageId,
          clientMessageId: payload.clientMessageId,
          channelId: channelId!,
          senderId: uid || "me",
          senderRole: role as MessageItem["senderRole"],
          content: payload.content || "",
          media: payload.media,
          type: messageType,
          createdAt: payload.createdAt ?? Date.now(),
          status: "PENDING",
          replyTo: payload.replyTo,
        },
      ]);

      // Drain outbox in single flight, then refresh from SQLite. The pending
      // bubble is cleared by allMessages only after sync has persisted the
      // server-confirmed row with the same clientMessageId.
      mobileSyncService
        .drainOutbox(uid || undefined)
        .then(() => queryClient.invalidateQueries({ queryKey: messagesKey }))
        .catch(() => {});

      return { success: true, messageId: payload.clientMessageId };
    },
    onError: (_err: any, vars) => {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === vars.clientMessageId ? { ...m, status: "FAILED" } : m
        )
      );
      if (channelId) {
        offlineCache
          .updateMessage(channelId, vars.clientMessageId, (m) => ({
            ...m,
            status: "FAILED",
          }))
          .catch(() => {});
      }
    },
  });

  // Retry an existing failed bubble. Reuse its client id and never create a
  // second optimistic row or a second outbox operation for the same message.
  const handleRetryMessage = useCallback(
    async (item: MessageItem) => {
      if (!channelId) return;
      const clientMessageId = item.clientMessageId || item.id;

      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, clientMessageId, status: "PENDING" } : m
        )
      );
      queryClient.setQueryData<MessageItem[]>(messagesKey, (old) =>
        old?.map((m) =>
          m.id === item.id ? { ...m, clientMessageId, status: "PENDING" } : m
        )
      );
      await offlineCache.updateMessage(channelId, item.id, (m) => ({
        ...m,
        clientMessageId,
        status: "PENDING",
      }));

      const pending = await offlineCache.getPendingOutbox(uid || undefined);
      if (!pending.some((op) => op.payload?.clientMessageId === clientMessageId)) {
        sendMutation.mutate({
          content: item.content,
          type: item.type as any,
          media: item.media,
          clientMessageId,
          replyTo: item.replyTo,
          createdAt: item.createdAt,
        });
        return;
      }

      mobileSyncService
        .drainOutbox(uid || undefined)
        .then(() => queryClient.invalidateQueries({ queryKey: messagesKey }))
        .catch(() => {});
    },
    [channelId, messagesKey, queryClient, sendMutation, uid]
  );

  // Edit Message Mutation
  const editMutation = useMutation({
    mutationFn: async (payload: {
      messageId: string;
      content: string;
      encryption?: EncryptionEnvelope | null;
    }) => {
      await offlineCache.queueOutbox(
        channelId!,
        "EDIT_MESSAGE",
        {
          channelId,
          messageId: payload.messageId,
          content: payload.content,
          isEncrypted: Boolean(payload.encryption),
          encryption: payload.encryption || undefined,
        },
        uid || undefined
      );
      await offlineCache.updateMessage(channelId!, payload.messageId, (m) => ({
        ...m,
        content: payload.content,
        encryption: payload.encryption || m.encryption,
        editedAt: Date.now(),
      }));
      if (payload.encryption) {
        forgetDecryptedMessage(payload.messageId);
      }
      mobileSyncService.drainOutbox(uid || undefined).catch(() => {});
      return { success: true };
    },
    onSuccess: (_res, vars) => {
      queryClient.setQueryData<MessageItem[]>(
        messagesKey,
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === vars.messageId
              ? {
                  ...m,
                  content: vars.content,
                  encryption: vars.encryption || m.encryption,
                  editedAt: Date.now(),
                }
              : m
          );
        }
      );
      if (vars.encryption) {
        forgetDecryptedMessage(vars.messageId);
      }
      setEditingMessage(null);
      setInputText("");
    },
    onError: (err: any) => {
      Alert.alert("ስህተት", "መልዕክቱን ማረም አልተቻለም፡ " + (err.message || ""));
    },
  });

  // Delete Message Mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await offlineCache.queueOutbox(
        channelId!,
        "DELETE_MESSAGE",
        {
          channelId,
          messageId,
        },
        uid || undefined
      );
      await offlineCache.updateMessage(channelId!, messageId, (m) => ({
        ...m,
        deletedAt: Date.now(),
        content: "",
        media: null,
      }));
      mobileSyncService.drainOutbox(uid || undefined).catch(() => {});
      return { success: true };
    },
    onSuccess: (_res, messageId) => {
      queryClient.setQueryData<MessageItem[]>(
        messagesKey,
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === messageId
              ? { ...m, deletedAt: Date.now(), content: "", media: null }
              : m
          );
        }
      );
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
        messagesKey,
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === vars.messageId ? { ...m, reactions: data.reactions } : m
          );
        }
      );
      offlineCache.updateMessage(channelId!, vars.messageId, (m) => ({
        ...m,
        reactions: data.reactions,
      }));
    },
  });

  const displayContent = (item: MessageItem) =>
    resolveEncryptedDisplayText(item, decryptedContent[item.id]);

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
          : target.media.mimeType.startsWith("audio/")
          ? "[ድምፅ]"
          : "[ፋይል]"
        : "[መልዕክት]",
    };
  };

  const handleSendText = () => {
    const sanitized = sanitizePlainText(inputText);
    if (!sanitized || sanitized.length > MAX_CHAR_LIMIT || sendMutation.isPending) {
      return;
    }

    const clientId = `local_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const replySnippet = getReplySnippet(replyingTo);

    const newMsg: MessageItem = {
      id: clientId,
      clientMessageId: clientId,
      channelId: channelId!,
      senderId: uid || "me",
      senderRole: role as MessageItem["senderRole"],
      content: sanitized,
      createdAt: Date.now(),
      status: "PENDING",
      replyTo: replySnippet,
    };

    setOptimisticMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setReplyingTo(null);

    sendMutation.mutate({
      content: sanitized,
      type: "TEXT",
      clientMessageId: clientId,
      replyTo: replySnippet,
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  // Staged Media Upload and Send Helper
  const handleSendWithAttachment = async () => {
    if (!stagedAttachment || !channelId) return;
    const attachment = stagedAttachment;
    const caption = sanitizePlainText(inputText);
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
        const isAud = res.media.mimeType.startsWith("audio/");
        const msgType = isImg ? "IMAGE" : isVid ? "VIDEO" : isAud ? "AUDIO" : "FILE";

        const finalMedia: MediaDescriptor = {
          ...res.media,
          originalName: attachment.name,
        };

        const newMsg: MessageItem = {
          id: clientId,
          clientMessageId: clientId,
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
        }, 80);
      }
    } catch (e: any) {
      // Offline fallback: stage file and queue in SQLite outbox
      const safeName = (attachment.name || `file_${Date.now()}`).replace(
        /\s+/g,
        "_"
      );
      const safeType = inferMime(safeName, attachment.type);
      const clientId = `local_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      const isImg = safeType.startsWith("image/");
      const isVid = safeType.startsWith("video/");
      const isAud = safeType.startsWith("audio/");
      const msgType = isImg ? "IMAGE" : isVid ? "VIDEO" : isAud ? "AUDIO" : "FILE";

      const optimisticMedia: MediaDescriptor = {
        url: attachment.uri,
        mimeType: safeType,
        sizeBytes: attachment.size || 0,
        originalName: attachment.name,
      };

      const newMsg: MessageItem = {
        id: clientId,
        clientMessageId: clientId,
        channelId: channelId,
        senderId: uid || "me",
        senderRole: role as MessageItem["senderRole"],
        content: caption,
        media: optimisticMedia,
        type: msgType,
        createdAt: Date.now(),
        status: "PENDING",
        replyTo: replySnippet,
      };

      setOptimisticMessages((prev) => [...prev, newMsg]);
      setStagedAttachment(null);
      setInputText("");
      setReplyingTo(null);

      offlineCache
        .queueOutbox(
          channelId,
          "SEND_MESSAGE",
          {
            channelId,
            content: caption,
            type: msgType,
            clientMessageId: clientId,
            replyTo: replySnippet,
            senderId: uid || undefined,
            _stagedFile: {
              uri: attachment.uri,
              name: safeName,
              type: safeType,
            },
          },
          uid || undefined
        )
        .catch(() => {});
      offlineCache.saveMessages(channelId, [newMsg]).catch(() => {});

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
    }
  };

  const handlePressSend = () => {
    if (editingMessage) {
      const sanitized = sanitizePlainText(inputText);
      if (!sanitized || sanitized.length > MAX_CHAR_LIMIT || editMutation.isPending) {
        return;
      }

      const performEdit = async () => {
        let contentToSend = sanitized;
        let freshEncryption: EncryptionEnvelope | undefined;
        if (editingMessage.isEncrypted && channelId) {
          try {
            const enc = await encryptMessage(sanitized, channelId);
            contentToSend = enc.ciphertext;
            // Carry the fresh IV envelope with the edited ciphertext. Dropping
            // it left the old IV paired with new ciphertext, corrupting edits.
            freshEncryption = enc.encryption;
          } catch {
            Alert.alert("ስህተት", "መልዕክቱን ማመስጠር አልተቻለም");
            return;
          }
        }
        editMutation.mutate({
          messageId: editingMessage.id,
          content: contentToSend,
          encryption: freshEncryption,
        });
      };
      performEdit();
      return;
    }

    if (stagedAttachment) {
      handleSendWithAttachment();
    } else {
      handleSendText();
    }
  };

  const handlePickImage = async (useCamera = false) => {
    setShowAttachModal(false);
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        allowsEditing: false,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename =
          asset.fileName ||
          (asset.type === "video" ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`);
        const ext = filename.split(".").pop()?.toLowerCase();

        if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
          Alert.alert("ያልተፈቀደ የፋይል ዓይነት", `".${ext}" የፋይል ዓይነት አልተፈቀደም።`);
          return;
        }

        if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
          Alert.alert(
            "የፋይል መጠን ማሳሰቢያ",
            `የተመረጠው ፋይል መጠን ${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB ነው። የሚፈቀደው ከፍተኛ መጠን 25MB ነው።`
          );
          return;
        }

        const isVid = asset.type === "video";
        setStagedAttachment({
          uri: asset.uri,
          name: filename,
          type: isVid ? "video/mp4" : "image/jpeg",
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
          durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          isImage: !isVid,
          isVideo: isVid,
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
            `".${ext}" የፋይል ዓይነት አልተፈቀደም።`
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

  // In-App File Download & View Handler
  const handleOpenFile = async (media?: MediaDescriptor | null) => {
    if (!media?.url) return;
    const filename = resolveFilename(media);
    const mime = media.mimeType || "";

    // 1. Image -> In-app modal viewer
    if (mime.startsWith("image/")) {
      setViewingImageUrl(media.url);
      return;
    }

    // 2. Video -> In-app modal player
    if (mime.startsWith("video/")) {
      setViewingVideoUrl(media.url);
      return;
    }

    // 3. PDF -> In-app browser sheet
    if (mime.includes("pdf") || filename.toLowerCase().endsWith(".pdf")) {
      await WebBrowser.openBrowserAsync(media.url);
      return;
    }

    // 4. Other Files -> Download into app storage and open in-app via Sharing
    const localUri = downloadedFiles[media.url];
    if (localUri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        await WebBrowser.openBrowserAsync(media.url);
      }
      return;
    }

    try {
      setDownloadProgress((prev) => ({ ...prev, [media.url]: 0.1 }));
      const targetPath = `${FileSystem.documentDirectory}${filename}`;
      const downloadResumable = FileSystem.createDownloadResumable(
        media.url,
        targetPath,
        {},
        (p) => {
          const prog = p.totalBytesWritten / p.totalBytesExpectedToWrite;
          setDownloadProgress((prev) => ({ ...prev, [media.url]: prog }));
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        setDownloadedFiles((prev) => ({ ...prev, [media.url]: result.uri }));
        setDownloadProgress((prev) => {
          const cp = { ...prev };
          delete cp[media.url];
          return cp;
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri);
        }
      }
    } catch (err: any) {
      setDownloadProgress((prev) => {
        const cp = { ...prev };
        delete cp[media.url];
        return cp;
      });
      Alert.alert("ማውረድ አልተሳካም", err.message || "ፋይሉን ማውረድ አልተቻለም");
    }
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

  const formatDateChip = (ts: number) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (isToday) return "ዛሬ (Today)";

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
      if (isYesterday) return "ትናንት (Yesterday)";

      return d.toLocaleDateString("am-ET", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const isDifferentDay = (idx: number) => {
    if (idx === 0) return true;
    const prev = allMessages[idx - 1];
    const curr = allMessages[idx];
    const d1 = new Date(prev.createdAt);
    const d2 = new Date(curr.createdAt);
    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
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
          <Text style={styles.errorBannerText} numberOfLines={1}>
            {(error as Error)?.message?.replace(/FORBIDDEN/gi, "") || "መልእክቶችን ማምጣት አልተሳካም"}
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
          renderItem={({ item, index }) => {
            const showDateChip = isDifferentDay(index);

            // CALL ITEM
            if (item.type === "CALL" || item.callDetails) {
              const cd = item.callDetails;
              const isMissed = cd?.status === "missed";
              const isDeclined = cd?.status === "declined";
              const isCancelled = cd?.status === "cancelled";
              const isAnswered =
                cd?.status === "answered" || cd?.status === "ended";

              const formatDuration = (sec?: number | null) => {
                if (!sec) return "";
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                return `${m}:${s.toString().padStart(2, "0")}`;
              };

              const title = cd?.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ";
              let subtitle = "ጥሪ";

              if (isAnswered) {
                subtitle = cd?.durationSec
                  ? `የተመለሰ (${formatDuration(cd.durationSec)})`
                  : "የተመለሰ";
              } else if (isMissed) {
                subtitle = item.senderId === uid ? "ያልተመለሰ ጥሪ" : "ያመለጠ ጥሪ";
              } else if (isDeclined) {
                subtitle = "የተዘጋ ጥሪ";
              } else if (isCancelled) {
                subtitle = item.senderId === uid ? "የተሰረዘ ጥሪ" : "ያመለጠ ጥሪ";
              }

              const isCallerMissed = isMissed || (isCancelled && item.senderId !== uid);

              return (
                <View key={item.id}>
                  {showDateChip && (
                    <View style={styles.dateChipContainer}>
                      <View style={styles.dateChip}>
                        <Text style={styles.dateChipText}>{formatDateChip(item.createdAt)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.callRowContainer}>
                    <View style={styles.callBubbleBox}>
                      <View
                        style={[
                          styles.callIconCircle,
                          isCallerMissed
                            ? styles.callIconMissed
                            : isDeclined || isCancelled
                            ? styles.callIconDeclined
                            : styles.callIconAnswered,
                        ]}
                      >
                        {isCallerMissed ? (
                          <PhoneMissed size={18} color="#EF4444" />
                        ) : isDeclined || isCancelled ? (
                          <PhoneOff size={18} color="#94A3B8" />
                        ) : (
                          <VideoIcon size={18} color="#10B981" />
                        )}
                      </View>
                      <View style={styles.callDetailsCol}>
                        <Text style={styles.callTitleText} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text
                          style={[
                            styles.callSubtitleText,
                            isCallerMissed && styles.callMissedText,
                          ]}
                        >
                          {subtitle} · {formatTime(item.createdAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push(`/call/${channelId}`)}
                        style={styles.callRecallBtn}
                      >
                        <Text style={styles.callRecallBtnText}>ደውል</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }

            // CHAT MESSAGE ITEM
            const isMe = item.senderId === uid || item.senderId === "me";
            const isFather = item.senderRole === "FATHER";
            const isDeleted = Boolean(item.deletedAt);
            const delivery = isMe
              ? getMessageDeliveryFeedback({ localStatus: item.status, isOnline })
              : undefined;
            const hasDeliveryFailure =
              delivery?.state === "error" || delivery?.state === "rejected";
            const hasMedia = Boolean(item.media?.url);
            const isImg =
              item.media?.mimeType?.startsWith("image/") || item.type === "IMAGE";
            const isVid =
              item.media?.mimeType?.startsWith("video/") || item.type === "VIDEO";
            const isAud =
              item.media?.mimeType?.startsWith("audio/") || item.type === "AUDIO";

            const plainText = displayContent(item);
            const detectedUrl = !isDeleted && plainText ? extractFirstHttpsUrl(plainText) : null;
            const senderInitial = (item.senderName || "ተ").charAt(0) || "✞";

            return (
              <View key={item.id}>
                {showDateChip && (
                  <View style={styles.dateChipContainer}>
                    <View style={styles.dateChip}>
                      <Text style={styles.dateChipText}>{formatDateChip(item.createdAt)}</Text>
                    </View>
                  </View>
                )}

                <View
                  style={[
                    styles.msgRow,
                    isMe ? styles.myMsgRow : styles.otherMsgRow,
                  ]}
                >
                  {/* Circle Avatar on incoming message */}
                  {!isMe && (
                    <View style={styles.bubbleAvatarCircle}>
                      {item.senderPhotoUrl ? (
                        <Image
                          source={{ uri: item.senderPhotoUrl }}
                          style={styles.bubbleAvatarImg}
                        />
                      ) : (
                        <Text style={styles.bubbleAvatarInitial}>{senderInitial}</Text>
                      )}
                    </View>
                  )}

                  {/* Single Bubble: max ~80% width, mine dark right, theirs light left */}
                  <View
                    style={[
                      styles.bubbleWrapper,
                      isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper,
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.88}
                      delayLongPress={180}
                      onLongPress={() => {
                        if (!isDeleted) {
                          setSelectedMessage(item);
                          setActionMenuVisible(true);
                        }
                      }}
                      style={[
                        styles.bubble,
                        isMe ? styles.myBubble : styles.otherBubble,
                        isDeleted && styles.deletedBubble,
                      ]}
                    >
                      {/* Sender Name & Father Title */}
                      {!isMe && !isDeleted && (
                        <View style={styles.senderHeaderRow}>
                          {isFather && (
                            <Shield color={THEME.colors.sacredCrimson} size={12} />
                          )}
                          <Text
                            style={[
                              styles.senderHeaderName,
                              isFather && styles.fatherHeaderName,
                            ]}
                            numberOfLines={1}
                          >
                            {item.senderName || (isFather ? "የንስሐ አባት" : "ተጠቃሚ")}
                          </Text>
                        </View>
                      )}

                      {/* Reply Quote Excerpt */}
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

                      {/* Deleted Message State */}
                      {isDeleted ? (
                        <View style={styles.deletedRow}>
                          <XCircle
                            color={isMe ? "rgba(255,255,255,0.6)" : THEME.colors.inkSubtle}
                            size={14}
                          />
                          <Text
                            style={[
                              styles.deletedText,
                              isMe ? styles.myDeletedText : styles.otherDeletedText,
                            ]}
                          >
                            ይህ መልዕክት ተሰርዟል
                          </Text>
                        </View>
                      ) : (
                        <>
                          {/* Media: Image */}
                          {hasMedia && isImg && item.media?.url && (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => handleOpenFile(item.media)}
                              style={styles.imageCard}
                            >
                              <Image
                                source={{ uri: item.media.url }}
                                style={styles.msgImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          )}

                          {/* Media: Video */}
                          {hasMedia && isVid && item.media?.url && (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => handleOpenFile(item.media)}
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
                                  <VideoIcon color="#FFFFFF" size={32} />
                                </View>
                              )}
                              <View style={styles.playIconOverlay}>
                                <Play color="#FFFFFF" size={24} fill="#FFFFFF" />
                              </View>
                              {item.media.durationSeconds ? (
                                <View style={styles.durationBadge}>
                                  <Text style={styles.durationText}>
                                    {Math.floor(item.media.durationSeconds / 60)}:
                                    {String(item.media.durationSeconds % 60).padStart(2, "0")}
                                  </Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          )}

                          {/* Media: Audio In-Bubble Player */}
                          {hasMedia && isAud && item.media?.url && (
                            <BubbleAudioPlayer
                              url={item.media.url}
                              isMe={isMe}
                              durationSeconds={item.media.durationSeconds}
                            />
                          )}

                          {/* Media: Other File/PDF Card */}
                          {hasMedia && !isImg && !isVid && !isAud && item.media?.url && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleOpenFile(item.media)}
                              style={[
                                styles.docCard,
                                isMe ? styles.myDocCard : styles.otherDocCard,
                              ]}
                            >
                              {(() => {
                                const fileName = resolveFilename(item.media);
                                const badge = getFileBadge(fileName, item.media.mimeType);
                                const isDownloaded = Boolean(downloadedFiles[item.media.url]);
                                const prog = downloadProgress[item.media.url];

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
                                        numberOfLines={1}
                                        style={[
                                          styles.docName,
                                          isMe ? styles.myDocName : styles.otherDocName,
                                        ]}
                                      >
                                        {fileName}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.docSize,
                                          isMe && { color: "rgba(255,255,255,0.7)" },
                                        ]}
                                      >
                                        {item.media.sizeBytes
                                          ? formatFileSize(item.media.sizeBytes)
                                          : "ፋይል"}
                                      </Text>
                                    </View>
                                    {prog !== undefined ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={isMe ? "#FFFFFF" : THEME.colors.sacredAmber}
                                      />
                                    ) : isDownloaded ? (
                                      <Check
                                        size={16}
                                        color={isMe ? "#10B981" : "#059669"}
                                      />
                                    ) : (
                                      <Download
                                        color={isMe ? "#FFFFFF" : THEME.colors.inkMuted}
                                        size={16}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </TouchableOpacity>
                          )}

                          {/* Message Text */}
                          {item.content ? (
                            <Text
                              style={[
                                styles.msgText,
                                isMe ? styles.myMsgText : styles.otherMsgText,
                              ]}
                            >
                              {plainText}
                            </Text>
                          ) : null}

                          {/* Safe Link Preview inside bubble */}
                          {detectedUrl && <BubbleLinkPreview url={detectedUrl} />}
                        </>
                      )}

                      {/* Inside Bubble State & Time */}
                      <View style={styles.bubbleFooter}>
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
                        {isMe && delivery ? (
                          <View
                            style={styles.statusIcon}
                            accessible
                            accessibilityLabel={
                              delivery.detail
                                ? `${delivery.label}. ${delivery.detail}`
                                : delivery.label
                            }
                          >
                            {delivery.state === "queued" ? (
                              <View style={styles.deliveryPendingRow}>
                                <Clock color="rgba(255, 255, 255, 0.65)" size={11} />
                                <Text style={styles.deliveryPendingText}>
                                  {delivery.label}
                                </Text>
                              </View>
                            ) : hasDeliveryFailure ? (
                              <TouchableOpacity
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={`${delivery.label}. ${MESSAGE_SYNC_TERMS.retry}`}
                                onPress={() => handleRetryMessage(item)}
                                style={styles.deliveryRetryRow}
                              >
                                <RotateCcw size={12} color="#FCA5A5" />
                                <Text style={styles.deliveryRetryText}>
                                  {MESSAGE_SYNC_TERMS.retry}
                                </Text>
                              </TouchableOpacity>
                            ) : delivery.state === "sending" ? (
                              <ActivityIndicator
                                size="small"
                                color="rgba(255, 255, 255, 0.65)"
                              />
                            ) : (
                              <CheckCheck
                                color={THEME.colors.sacredAmber}
                                size={13}
                              />
                            )}
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {/* Reactions Docked below bubble */}
                    {!isDeleted &&
                      item.reactions &&
                      Object.keys(item.reactions).length > 0 && (
                        <View
                          style={[
                            styles.reactionsRow,
                            isMe ? styles.myReactionsRow : styles.otherReactionsRow,
                          ]}
                        >
                          {Object.entries(item.reactions).map(([emoji, uids]) => {
                            if (!Array.isArray(uids) || uids.length === 0) return null;
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
                                <Text style={styles.reactionPillEmoji}>{emoji}</Text>
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
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Floating "New Message" Pill */}
      {showNewMsgPill && (
        <TouchableOpacity
          style={styles.newMsgPill}
          activeOpacity={0.85}
          onPress={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowNewMsgPill(false);
          }}
        >
          <Text style={styles.newMsgPillText}>አዲስ መልእክት</Text>
          <ArrowDown size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Uploading progress indicator */}
      {isUploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color={THEME.colors.sacredAmber} />
          <Text style={styles.uploadingText}>{uploadStatusText}</Text>
        </View>
      )}

      {/* Modern Composer Bar */}
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

        {/* Staged Attachment Preview */}
        {stagedAttachment && (
          <View style={styles.stagedCard}>
            {stagedAttachment.isImage ? (
              <Image
                source={{ uri: stagedAttachment.uri }}
                style={styles.stagedThumb}
              />
            ) : stagedAttachment.isVideo ? (
              <View style={[styles.stagedIconBox, { backgroundColor: "#E0E7FF" }]}>
                <VideoIcon color="#4F46E5" size={20} />
              </View>
            ) : (
              <View style={[styles.stagedIconBox, { backgroundColor: "#FEE2E2" }]}>
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

        {/* Character Count Warning near 4,000 limit */}
        {inputText.length >= CHAR_WARNING_THRESHOLD && (
          <View style={styles.charCounterRow}>
            <Text
              style={[
                styles.charCounterText,
                inputText.length > MAX_CHAR_LIMIT && styles.charCounterOver,
              ]}
            >
              {inputText.length.toLocaleString()} / {MAX_CHAR_LIMIT.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Composer Input Row */}
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
                : "መልእክት ይጻፉ..."
            }
            placeholderTextColor={THEME.colors.inkSubtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={MAX_CHAR_LIMIT + 50}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() && !stagedAttachment) ||
              inputText.length > MAX_CHAR_LIMIT
                ? styles.sendBtnDisabled
                : null,
            ]}
            onPress={handlePressSend}
            disabled={
              (!inputText.trim() && !stagedAttachment) ||
              inputText.length > MAX_CHAR_LIMIT ||
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

      {/* In-App Fullscreen Image Modal */}
      <Modal
        visible={Boolean(viewingImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImageUrl(null)}
      >
        <View style={styles.fullscreenModalBg}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setViewingImageUrl(null)}
            hitSlop={12}
          >
            <X size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingImageUrl && (
            <Image
              source={{ uri: viewingImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* In-App Fullscreen Video Modal */}
      <Modal
        visible={Boolean(viewingVideoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingVideoUrl(null)}
      >
        <View style={styles.fullscreenModalBg}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setViewingVideoUrl(null)}
            hitSlop={12}
          >
            <X size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingVideoUrl && (
            <Video
              source={{ uri: viewingVideoUrl }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
        </View>
      </Modal>

      {/* Attachment Bottom Sheet Modal */}
      <Modal
        visible={showAttachModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachModal(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ፋይል አያይዝ</Text>
              <TouchableOpacity onPress={() => setShowAttachModal(false)} hitSlop={8}>
                <X color={THEME.colors.inkMuted} size={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#EFF6FF" }]}>
                <FileText color="#2563EB" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ፎቶ ወይም ቪዲዮ</Text>
                <Text style={styles.modalOptionSub}>ከስልክ ጋለሪ ይምረጡ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#FEF3C7" }]}>
                <Camera color="#D97706" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ካሜራ</Text>
                <Text style={styles.modalOptionSub}>በቀጥታ ፎቶ ያንሱ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePickDocument}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#FEE2E2" }]}>
                <FileText color="#DC2626" size={20} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionLabel}>ሰነድ (PDF, Word, ወዘተ)</Text>
                <Text style={styles.modalOptionSub}>እስከ 25MB የሚደርስ ፋይል</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowAttachModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>ተመለስ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action Sheet Modal */}
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
          <View style={styles.actionModalSheet}>
            {/* Quick Reactions Capsule */}
            <View style={styles.floatingReactionCapsule}>
              {DIGNIFIED_REACTIONS.map((r) => {
                const isSelected = selectedMessage?.reactions?.[r.emoji]?.includes(
                  uid || ""
                );
                return (
                  <TouchableOpacity
                    key={r.emoji}
                    activeOpacity={0.65}
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
                      styles.capsuleEmojiBtn,
                      isSelected && styles.capsuleEmojiBtnActive,
                    ]}
                  >
                    <Text style={styles.capsuleEmojiText}>{r.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Message Preview */}
            {selectedMessage && (
              <View style={styles.actionPreviewCard}>
                <View style={styles.actionPreviewBar} />
                <View style={styles.actionPreviewContent}>
                  <Text style={styles.actionPreviewAuthor} numberOfLines={1}>
                    {selectedMessage.senderId === uid
                      ? "የእርስዎ መልዕክት"
                      : selectedMessage.senderName || "መልዕክት"}
                  </Text>
                  <Text style={styles.actionPreviewText} numberOfLines={2}>
                    {displayContent(selectedMessage) ||
                      (selectedMessage.media ? "📎 ፋይል ተያይዟል" : "መልዕክት")}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Group */}
            <View style={styles.actionGroupCard}>
              <TouchableOpacity
                style={styles.actionRowItem}
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
                <View style={[styles.actionRowIcon, { backgroundColor: "#EFF6FF" }]}>
                  <CornerUpLeft color="#2563EB" size={17} />
                </View>
                <Text style={styles.actionRowText}>መልስ ስጥ (Reply)</Text>
              </TouchableOpacity>

              {selectedMessage?.content ? (
                <>
                  <View style={styles.actionRowDivider} />
                  <TouchableOpacity
                    style={styles.actionRowItem}
                    onPress={async () => {
                      if (selectedMessage) {
                        const textToCopy = displayContent(selectedMessage);
                        await Clipboard.setStringAsync(textToCopy);
                        Alert.alert("ተገልብጧል", "የመልዕክቱ ጽሑፍ ተገልብጧል።");
                      }
                      setActionMenuVisible(false);
                      setSelectedMessage(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionRowIcon, { backgroundColor: "#F1F5F9" }]}>
                      <Copy color="#475569" size={17} />
                    </View>
                    <Text style={styles.actionRowText}>ጽሑፍ ቅዳ (Copy)</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {selectedMessage &&
              (selectedMessage.senderId === uid || selectedMessage.senderId === "me") &&
              !selectedMessage.deletedAt ? (
                <>
                  <View style={styles.actionRowDivider} />
                  <TouchableOpacity
                    style={styles.actionRowItem}
                    onPress={() => {
                      setEditingMessage(selectedMessage);
                      setInputText(displayContent(selectedMessage));
                      setReplyingTo(null);
                      setActionMenuVisible(false);
                      setSelectedMessage(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionRowIcon, { backgroundColor: "#FEF3C7" }]}>
                      <Edit2 color="#D97706" size={17} />
                    </View>
                    <Text style={[styles.actionRowText, { color: THEME.colors.sacredAmber }]}>
                      አርትዕ (Edit)
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {selectedMessage &&
              !selectedMessage.deletedAt &&
              (selectedMessage.senderId === uid ||
                selectedMessage.senderId === "me" ||
                role === "FATHER" ||
                role === "GOVERNOR") ? (
                <>
                  <View style={styles.actionRowDivider} />
                  <TouchableOpacity
                    style={styles.actionRowItem}
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
                    <View style={[styles.actionRowIcon, { backgroundColor: "#FEE2E2" }]}>
                      <XCircle color="#DC2626" size={17} />
                    </View>
                    <Text style={[styles.actionRowText, { color: THEME.colors.error }]}>
                      ሰርዝ (Delete)
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.actionModalDismissBtn}
              onPress={() => {
                setActionMenuVisible(false);
                setSelectedMessage(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.actionModalDismissText}>ተመለስ</Text>
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
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexGrow: 1,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyText: {
    color: THEME.colors.inkSubtle,
    fontSize: 13,
  },
  dateChipContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateChip: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateChipText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  newMsgPill: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: THEME.colors.buttonDark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    ...THEME.shadows.button,
    zIndex: 99,
  },
  newMsgPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-end",
  },
  myMsgRow: {
    justifyContent: "flex-end",
  },
  otherMsgRow: {
    justifyContent: "flex-start",
  },
  bubbleAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.sacredAmber,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 2,
    overflow: "hidden",
  },
  bubbleAvatarImg: {
    width: 32,
    height: 32,
  },
  bubbleAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  bubbleWrapper: {
    maxWidth: "80%",
  },
  myBubbleWrapper: {
    alignItems: "flex-end",
  },
  otherBubbleWrapper: {
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 80,
    ...THEME.shadows.card,
  },
  myBubble: {
    backgroundColor: "#0F172A", // Dark right bubble
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#FFFFFF", // Light left bubble
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  senderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  senderHeaderName: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  fatherHeaderName: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "800",
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
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: THEME.colors.inkSubtle,
    fontWeight: "500",
  },
  statusIcon: {
    marginLeft: 2,
    maxWidth: 150,
  },
  deliveryPendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  deliveryPendingText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.75)",
  },
  deliveryRetryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 24,
  },
  deliveryRetryText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FCA5A5",
  },
  editedTag: {
    fontSize: 9.5,
    fontStyle: "italic",
    color: THEME.colors.inkSubtle,
  },
  deletedBubble: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  myDeletedText: {
    color: "rgba(255,255,255,0.7)",
  },
  otherDeletedText: {
    color: THEME.colors.inkSubtle,
  },
  bubbleReplyBox: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
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
  imageCard: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
  },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  videoCard: {
    width: 220,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000000",
    marginBottom: 4,
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
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    gap: 8,
    minWidth: 190,
    marginBottom: 4,
  },
  myAudioBg: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  otherAudioBg: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  audioPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  myAudioPlayBtn: {
    backgroundColor: THEME.colors.sacredAmber,
  },
  otherAudioPlayBtn: {
    backgroundColor: THEME.colors.sacredCrimson,
  },
  audioWaveform: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(148, 163, 184, 0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  audioProgressBar: {
    height: "100%",
    borderRadius: 3,
  },
  audioTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    gap: 10,
    minWidth: 200,
    marginBottom: 4,
  },
  myDocCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  otherDocCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: "700",
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
    marginTop: 2,
  },
  linkCard: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  linkImage: {
    width: "100%",
    height: 110,
  },
  linkInfo: {
    padding: 8,
  },
  linkDomain: {
    fontSize: 10.5,
    fontWeight: "700",
    color: THEME.colors.sacredAmber,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  linkTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
    marginBottom: 2,
  },
  linkDesc: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: -8,
    marginHorizontal: 6,
    zIndex: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 3,
    ...THEME.shadows.card,
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
  composerContainer: {
    backgroundColor: THEME.colors.navigationBg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.sacredCrimsonBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  charCounterRow: {
    alignItems: "flex-end",
    paddingRight: 6,
    marginBottom: 4,
  },
  charCounterText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.sacredAmber,
  },
  charCounterOver: {
    color: "#EF4444",
    fontWeight: "800",
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
    maxHeight: 110,
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
  replyBannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
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
  editingBannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
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
  fullscreenModalBg: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenCloseBtn: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 99,
    padding: 8,
  },
  fullscreenImage: {
    width: "100%",
    height: "85%",
  },
  fullscreenVideo: {
    width: "100%",
    height: "80%",
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
  actionModalSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: 12,
    ...THEME.shadows.card,
  },
  floatingReactionCapsule: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 30,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  capsuleEmojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  capsuleEmojiBtnActive: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1.5,
    borderColor: THEME.colors.sacredAmber,
    transform: [{ scale: 1.15 }],
  },
  capsuleEmojiText: {
    fontSize: 24,
  },
  actionPreviewCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionPreviewBar: {
    width: 3.5,
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: 2,
    marginRight: 8,
  },
  actionPreviewContent: {
    flex: 1,
  },
  actionPreviewAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.sacredCrimson,
    marginBottom: 2,
  },
  actionPreviewText: {
    fontSize: 12,
    color: THEME.colors.inkMuted,
    lineHeight: 16,
  },
  actionGroupCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  actionRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginLeft: 46,
  },
  actionRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRowText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
  },
  actionModalDismissBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    marginTop: 2,
  },
  actionModalDismissText: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
  },
  callRowContainer: {
    alignItems: "center",
    marginVertical: 6,
  },
  callBubbleBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
    minWidth: 260,
    ...THEME.shadows.card,
  },
  callIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  callIconMissed: {
    backgroundColor: "#FEE2E2",
  },
  callIconDeclined: {
    backgroundColor: "#F1F5F9",
  },
  callIconAnswered: {
    backgroundColor: "#D1FAE5",
  },
  callDetailsCol: {
    flex: 1,
  },
  callTitleText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  callSubtitleText: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  callMissedText: {
    color: "#EF4444",
    fontWeight: "700",
  },
  callRecallBtn: {
    backgroundColor: THEME.colors.sacredCrimson,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  callRecallBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
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
});
