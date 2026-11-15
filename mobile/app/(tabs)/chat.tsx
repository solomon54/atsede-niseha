import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users, XCircle } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { offlineCache } from "../../src/lib/cache";
import { useCacheFirst } from "../../src/lib/use-cache-first";
import { useAuth } from "../../src/lib/auth-context";
import { THEME } from "../../src/constants/theme";

interface Conversation {
  id: string;
  fullName: string;
  role: "DIRECT" | "COMMON_HOUSE";
  type?: "DIRECT" | "COMMON_HOUSE";
  title?: string;
  members?: Array<{
    userId: string;
    fullName?: string;
    role?: string;
    photoUrl?: string;
  }>;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: number;
    senderId: string;
    type?: string;
    media?: {
      url: string;
      originalName?: string;
      mimeType?: string;
    } | null;
    callDetails?: any;
    isEncrypted?: boolean;
  } | null;
  unreadCount?: number;
}

export default function ChatScreen() {
  const router = useRouter();
  const { uid } = useAuth();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<
    Conversation[]
  >({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiRequest<Conversation[]>("/api/message/conversation");
      const conversations = res || [];
      // Cache the list so the rooms render before the network answers.
      offlineCache.setQuery("conversations", conversations);
      return conversations;
    },
    refetchInterval: 8000,
  });

  const cacheChecked = useCacheFirst<Conversation[]>(["conversations"], () =>
    offlineCache.getQuery<Conversation[]>("conversations")
  );

  // Sort conversations most recent first
  const conversations = useMemo(() => {
    const list = [...(data || [])];
    return list.sort(
      (a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0)
    );
  }, [data]);

  const formatMessageTime = (ts?: number) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      if (isToday) {
        return d.toLocaleTimeString("am-ET", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return d.toLocaleDateString("am-ET", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getCleanErrorMessage = (err: any) => {
    const msg = (err?.message || "").toString();
    if (msg.toUpperCase().includes("FORBIDDEN")) {
      return "ይህንን ክፍል ለማየት ፈቃድ የለዎትም";
    }
    return msg || "ውይይቶችን ማምጣት አልተሳካም";
  };

  return (
    <View style={styles.container}>
      {isError && (
        <View style={styles.errorBanner}>
          <XCircle color={THEME.colors.error} size={16} />
          <Text style={styles.errorBannerText} numberOfLines={1}>
            {getCleanErrorMessage(error)}
          </Text>
          <TouchableOpacity onPress={() => refetch()} hitSlop={8}>
            <Text style={styles.retryText}>እንደገና ሞክር</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={THEME.colors.sacredAmber}
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          isError ? null : cacheChecked && !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageCircle color={THEME.colors.sacredAmber} size={36} />
              </View>
              <Text style={styles.emptyTitle}>ምንም የውይይት ክፍል የለም</Text>
              <Text style={styles.emptySubtitle}>
                የተመደቡበት የውይይት ክፍል ወይም የንስሐ ግንኙነት ሲኖር እዚህ በመልዕክት
                ይቀመጣል።
              </Text>
            </View>
          ) : (
            <ActivityIndicator
              color={THEME.colors.sacredAmber}
              style={{ marginTop: 40 }}
            />
          )
        }
        renderItem={({ item }) => {
          const isCommonHouse =
            item.role === "COMMON_HOUSE" || item.type === "COMMON_HOUSE";
          const hasUnread = Boolean(item.unreadCount && item.unreadCount > 0);

          // Find display name and photo
          const otherMember = !isCommonHouse && uid
            ? item.members?.find((m) => m.userId !== uid)
            : null;

          const displayName = isCommonHouse
            ? item.title || "የጋራ ቤት"
            : otherMember?.fullName || item.fullName || "የግል መልዕክት";

          const displayPhoto = !isCommonHouse ? otherMember?.photoUrl : null;

          // Initial letter
          const cleanName = displayName.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
          const initial = cleanName.charAt(0) || "✞";

          // Format last message
          const lm = item.lastMessage;
          let lastMessageText = "";

          if (!lm) {
            lastMessageText = isCommonHouse
              ? "የጋራ ቤት ትምህርት እና መመሪያዎች"
              : "የግል መልዕክት ውይይት";
          } else if (lm.type === "CALL" || lm.callDetails) {
            lastMessageText = "📞 የቪዲዮ ጥሪ";
          } else if (lm.type === "IMAGE" || lm.media?.mimeType?.startsWith("image/")) {
            lastMessageText = "📷 Photo";
          } else if (lm.type === "VIDEO" || lm.media?.mimeType?.startsWith("video/")) {
            lastMessageText = "🎥 Video";
          } else if (lm.type === "AUDIO" || lm.media?.mimeType?.startsWith("audio/")) {
            lastMessageText = "🎵 Audio";
          } else if (lm.type === "FILE" || lm.media?.url) {
            const fname = lm.media?.originalName || "ፋይል";
            lastMessageText = `📎 ${fname}`;
          } else if (lm.isEncrypted && !lm.content) {
            lastMessageText = "🔒 የተቆለፈ መልእክት";
          } else {
            lastMessageText = (lm.content || "").trim() || "መልእክት";
          }

          // If group, prefix with sender's first name
          if (isCommonHouse && lm?.senderId) {
            let senderFirst = "";
            if (lm.senderId === uid) {
              senderFirst = "እርስዎ";
            } else {
              const member = item.members?.find((m) => m.userId === lm.senderId);
              const rawName = member?.fullName || "";
              senderFirst = rawName.split(" ")[0] || "ተሳታፊ";
            }
            lastMessageText = `${senderFirst}: ${lastMessageText}`;
          }

          return (
            <TouchableOpacity
              style={[styles.roomRow, hasUnread && styles.roomRowUnread]}
              onPress={() => router.push(`/chat/${item.id}` as any)}
              activeOpacity={0.7}
            >
              {/* Circle Avatar (Photo or Initial) */}
              <View
                style={[
                  styles.avatarCircle,
                  isCommonHouse ? styles.avatarCommon : styles.avatarDirect,
                ]}
              >
                {displayPhoto ? (
                  <Image
                    source={{ uri: displayPhoto }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : isCommonHouse ? (
                  <Users color="#FFFFFF" size={20} />
                ) : (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                )}
              </View>

              <View style={styles.roomInfo}>
                <View style={styles.roomTitleRow}>
                  <Text
                    style={[
                      styles.roomTitle,
                      hasUnread && styles.roomTitleUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {lm?.createdAt ? (
                    <Text
                      style={[
                        styles.timeText,
                        hasUnread && styles.timeTextUnread,
                      ]}
                    >
                      {formatMessageTime(lm.createdAt)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.subRow}>
                  <Text
                    style={[
                      styles.previewText,
                      hasUnread && styles.previewTextUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {lastMessageText}
                  </Text>

                  {hasUnread && item.unreadCount! > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  listContainer: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.border,
  },
  roomRowUnread: {
    backgroundColor: "#FEFCE8", // Subtle golden-amber tint for unread
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarDirect: {
    backgroundColor: THEME.colors.sacredAmber,
  },
  avatarCommon: {
    backgroundColor: THEME.colors.sacredCrimson,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  roomInfo: {
    flex: 1,
    justifyContent: "center",
  },
  roomTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  roomTitle: {
    color: THEME.colors.inkPrimary,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  roomTitleUnread: {
    fontWeight: "800",
    color: "#0F172A",
  },
  timeText: {
    color: THEME.colors.inkSubtle,
    fontSize: 12,
    fontWeight: "500",
  },
  timeTextUnread: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "700",
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewText: {
    color: THEME.colors.inkMuted,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  previewTextUnread: {
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
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
  unreadBadge: {
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.amberLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: THEME.colors.inkPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    color: THEME.colors.inkSubtle,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
