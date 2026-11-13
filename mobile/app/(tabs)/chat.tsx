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
import { MessageCircle, Users, ChevronRight } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";

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
    refetchInterval: 10000, // 10s background refresh
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
        keyExtractor={(item: Conversation) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#D97706"
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <MessageCircle color="#64748B" size={48} />
              <Text style={styles.emptyTitle}>ምንም የውይይት ክፍል የለም</Text>
              <Text style={styles.emptySubtitle}>
                የተመደቡበት የውይይት ክፍል ሲኖር እዚህ ይታያል።
              </Text>
            </View>
          ) : (
            <ActivityIndicator color="#D97706" style={{ marginTop: 40 }} />
          )
        }
        renderItem={({ item }: { item: Conversation }) => {
          const isCommonHouse = item.role === "COMMON_HOUSE";

          return (
            <TouchableOpacity
              style={styles.roomCard}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            >
              <View
                style={[
                  styles.iconCircle,
                  isCommonHouse && { backgroundColor: "#1E3A8A" },
                ]}
              >
                {isCommonHouse ? (
                  <Users color="#60A5FA" size={24} />
                ) : (
                  <MessageCircle color="#D97706" size={24} />
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
                    <ChevronRight color="#475569" size={16} />
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
    backgroundColor: "#0B1120",
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#78350F",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
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
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    color: "#64748B",
    fontSize: 12,
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewText: {
    color: "#94A3B8",
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#D97706",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
