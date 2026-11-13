import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users, ChevronRight, Lock } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { THEME } from "../../src/constants/theme";

interface Conversation {
  id: string;
  fullName: string;
  role: "DIRECT" | "COMMON_HOUSE";
  lastMessage?: {
    id: string;
    content: string;
    createdAt: number;
    senderId: string;
  } | null;
  unreadCount?: number;
}

export default function ChatScreen() {
  const router = useRouter();
  const { role } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiRequest<Conversation[]>("/api/message/conversation");
      return res || [];
    },
    refetchInterval: 8000,
  });

  const conversations = data || [];

  const formatMessageTime = (ts?: number) => {
    if (!ts) return "";
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
    <View style={styles.container}>
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
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageCircle color={THEME.colors.sacredAmber} size={36} />
              </View>
              <Text style={styles.emptyTitle}>ምንም የውይይት ክፍል የለም</Text>
              <Text style={styles.emptySubtitle}>
                የተመደቡበት የውይይት ክፍል ወይም የንስሐ ግንኙነት ሲኖር እዚህ በምስጢር
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
          const isCommonHouse = item.role === "COMMON_HOUSE";

          return (
            <TouchableOpacity
              style={styles.roomCard}
              onPress={() => router.push(`/chat/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconCircle,
                  isCommonHouse
                    ? styles.iconCircleCommon
                    : styles.iconCircleDirect,
                ]}
              >
                {isCommonHouse ? (
                  <Users color={THEME.colors.surface} size={22} />
                ) : (
                  <MessageCircle color={THEME.colors.surface} size={22} />
                )}
              </View>

              <View style={styles.roomInfo}>
                <View style={styles.roomTitleRow}>
                  <Text style={styles.roomTitle} numberOfLines={1}>
                    {item.fullName ||
                      (isCommonHouse ? "የጋራ አዳራሽ" : "የግል ክፍል")}
                  </Text>
                  {item.lastMessage?.createdAt ? (
                    <Text style={styles.timeText}>
                      {formatMessageTime(item.lastMessage.createdAt)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.subRow}>
                  <Text style={styles.previewText} numberOfLines={1}>
                    {item.lastMessage?.content ||
                      (isCommonHouse
                        ? "የጋራ ትምህርት እና መመሪያዎች"
                        : "የግል መንፈሳዊ ውይይት")}
                  </Text>
                  {item.unreadCount && item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  ) : (
                    <ChevronRight color={THEME.colors.inkSubtle} size={16} />
                  )}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexGrow: 1,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconCircleDirect: {
    backgroundColor: THEME.colors.sacredCrimson,
  },
  iconCircleCommon: {
    backgroundColor: THEME.colors.sacredAmber,
  },
  roomInfo: {
    flex: 1,
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
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    color: THEME.colors.inkSubtle,
    fontSize: 11,
    fontWeight: "600",
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
  unreadBadge: {
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 10,
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
