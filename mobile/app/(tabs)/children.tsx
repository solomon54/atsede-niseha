// mobile/app/(tabs)/children.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  GraduationCap,
  MessageSquare,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react-native";

import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import { copyToClipboard } from "../../src/lib/clipboard";
import { useCacheFirst } from "../../src/lib/use-cache-first";
import { THEME } from "../../src/constants/theme";

export interface ChildItem {
  id: string;
  uid: string;
  eotcUid: string;
  fullName?: string;
  secularName?: string;
  christianName?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  gender?: "MALE" | "FEMALE";
  university?: string;
  department?: string;
  college?: string;
  entryYear?: number;
  programDuration?: number;
  academicYear?: number;
  accountClaimed?: boolean;
  status?: string;
  spiritualTitle?: string;
}

export default function ChildrenDirectoryScreen() {
  const router = useRouter();
  const { eotcUid, role } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Fetch children directory for this Father
  const {
    data: serverData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ success: boolean; children: ChildItem[]; count: number }>({
    queryKey: ["father-children", eotcUid],
    queryFn: async () => {
      const endpoint = eotcUid
        ? `/api/father/children?fatherEotcUid=${eotcUid}`
        : "/api/father/children";
      const res = await apiRequest<{
        success: boolean;
        children: ChildItem[];
        count: number;
      }>(endpoint);

      if (res?.children) {
        offlineCache.setQuery("father_children_cache", res.children);
      }
      return res;
    },
    enabled: role === "FATHER",
  });

  // 2. Cache-first hydration for instant 0ms offline load
  useCacheFirst<ChildItem[]>(["father-children", eotcUid], () =>
    offlineCache.getQuery<ChildItem[]>("father_children_cache")
  );

  const childrenList = serverData?.children || [];

  // Filter & search
  const filteredChildren = useMemo(() => {
    return childrenList
      .filter((child) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          (child.secularName || "").toLowerCase().includes(query) ||
          (child.fullName || "").toLowerCase().includes(query) ||
          (child.christianName || "").toLowerCase().includes(query) ||
          (child.eotcUid || "").toLowerCase().includes(query);

        const matchesGender =
          selectedGender === "ALL" || child.gender === selectedGender;

        const matchesStatus =
          selectedStatus === "ALL" ||
          (selectedStatus === "ACTIVE"
            ? child.accountClaimed
            : !child.accountClaimed);

        return matchesSearch && matchesGender && matchesStatus;
      })
      .sort((a, b) => {
        const nameA = (a.secularName || a.fullName || "").toLowerCase();
        const nameB = (b.secularName || b.fullName || "").toLowerCase();
        return nameA.localeCompare(nameB, "am");
      });
  }, [childrenList, search, selectedGender, selectedStatus]);

  const activeCount = useMemo(
    () => childrenList.filter((c) => c.accountClaimed).length,
    [childrenList]
  );
  const pendingCount = childrenList.length - activeCount;

  const handleCopyId = async (id: string) => {
    await copyToClipboard(id, "የልጁ መለያ ቁጥር");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderHeader = () => (
    <View style={styles.headerArea}>
      {/* Top Banner with Register Button */}
      <View style={styles.topBanner}>
        <View>
          <Text style={styles.pageTitle}>መንጋዬ</Text>
          <Text style={styles.pageSubtitle}>የንስሐ ልጆች ዝርዝር (FLOCK DIRECTORY)</Text>
        </View>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push("/children/register" as any)}
          activeOpacity={0.8}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={styles.registerBtnText}>አዲስ መዝግብ</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{childrenList.length}</Text>
          <Text style={styles.statLabel}>ጠቅላላ</Text>
        </View>
        <View style={[styles.statCard, styles.statCardActive]}>
          <Text style={[styles.statValue, styles.statValueActive]}>
            {activeCount}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelActive]}>የጸኑ</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPending]}>
          <Text style={[styles.statValue, styles.statValuePending]}>
            {pendingCount}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelPending]}>
            በመጠባበቅ
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search color={THEME.colors.inkMuted} size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="በስም ወይም በመለያ ቁጥር ይፈልጉ..."
          placeholderTextColor={THEME.colors.inkSubtle}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {/* Gender Filters */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedGender === "ALL" && styles.filterChipSelected,
          ]}
          onPress={() => setSelectedGender("ALL")}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedGender === "ALL" && styles.filterChipTextSelected,
            ]}
          >
            ጾታ: ሁሉም
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedGender === "MALE" && styles.filterChipSelected,
          ]}
          onPress={() => setSelectedGender("MALE")}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedGender === "MALE" && styles.filterChipTextSelected,
            ]}
          >
            ወንድ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedGender === "FEMALE" && styles.filterChipSelected,
          ]}
          onPress={() => setSelectedGender("FEMALE")}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedGender === "FEMALE" && styles.filterChipTextSelected,
            ]}
          >
            ሴት
          </Text>
        </TouchableOpacity>

        {/* Status Filters */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedStatus === "ACTIVE" && styles.filterChipSelected,
          ]}
          onPress={() =>
            setSelectedStatus(selectedStatus === "ACTIVE" ? "ALL" : "ACTIVE")
          }
        >
          <Text
            style={[
              styles.filterChipText,
              selectedStatus === "ACTIVE" && styles.filterChipTextSelected,
            ]}
          >
            የጸና ✓
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedStatus === "PENDING" && styles.filterChipSelected,
          ]}
          onPress={() =>
            setSelectedStatus(selectedStatus === "PENDING" ? "ALL" : "PENDING")
          }
        >
          <Text
            style={[
              styles.filterChipText,
              selectedStatus === "PENDING" && styles.filterChipTextSelected,
            ]}
          >
            በመጠባበቅ ⏳
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.resultCount}>
        በአጠቃላይ {filteredChildren.length} መንፈሳዊ ልጆች ተገኝተዋል
      </Text>
    </View>
  );

  const renderChildCard = ({ item }: { item: ChildItem }) => {
    const isClaimed = Boolean(item.accountClaimed);
    const childId = item.eotcUid || item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => router.push(`/children/${childId}` as any)}
      >
        <View style={styles.cardHeader}>
          {/* Avatar with Halo Ring */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarHalo} />
            <View style={styles.avatarInner}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
              ) : (
                <User color={THEME.colors.sacredAmber} size={22} />
              )}
            </View>
          </View>

          {/* Names and Identity */}
          <View style={styles.nameBlock}>
            <Text style={styles.secularName} numberOfLines={1}>
              {item.secularName || item.fullName || "ስም ያልተገለጸ"}
            </Text>
            <Text style={styles.christianName} numberOfLines={1}>
              {item.christianName || "የክርስትና ስም የለም"}
            </Text>

            {/* EOTC UID Pill */}
            <TouchableOpacity
              style={styles.uidPill}
              onPress={() => handleCopyId(item.eotcUid)}
            >
              <Text style={styles.uidText}>{item.eotcUid}</Text>
              <Copy
                color={
                  copiedId === item.eotcUid
                    ? THEME.colors.success
                    : THEME.colors.inkMuted
                }
                size={11}
              />
            </TouchableOpacity>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isClaimed ? styles.statusBadgeActive : styles.statusBadgePending,
            ]}
          >
            {isClaimed ? (
              <CheckCircle2 color={THEME.colors.success} size={11} />
            ) : (
              <Clock color={THEME.colors.sacredAmber} size={11} />
            )}
            <Text
              style={[
                styles.statusText,
                isClaimed ? styles.statusTextActive : styles.statusTextPending,
              ]}
            >
              {isClaimed ? "የጸና" : "በመጠባበቅ"}
            </Text>
          </View>
        </View>

        {/* Academic / Info Line */}
        {(item.department || item.university) && (
          <View style={styles.academicRow}>
            <GraduationCap color={THEME.colors.inkMuted} size={13} />
            <Text style={styles.academicText} numberOfLines={1}>
              {item.department ? `${item.department} ` : ""}
              {item.university ? `@ ${item.university}` : ""}
            </Text>
          </View>
        )}

        {/* Action Bar */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push("/(tabs)/chat" as any);
            }}
          >
            <MessageSquare color={THEME.colors.sacredCrimson} size={14} />
            <Text style={styles.cardActionText}>ምስጢር</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push("/(tabs)/appointments" as any);
            }}
          >
            <Calendar color={THEME.colors.sacredAmber} size={14} />
            <Text style={styles.cardActionText}>ቀጠሮ</Text>
          </TouchableOpacity>

          <View style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>ዝርዝር መረጃ</Text>
            <ChevronRight color={THEME.colors.sacredCrimson} size={14} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={THEME.colors.sacredAmber} />
          <Text style={styles.emptyText}>መንፈሳዊ ልጆችን በመጫን ላይ...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Users color={THEME.colors.inkSubtle} size={48} />
        <Text style={styles.emptyTitle}>ምንም መንፈሳዊ ልጆች አልተገኙም</Text>
        <Text style={styles.emptySubtitle}>
          በዚህ መፈለጊያ መስፈርት የተመዘገበ መንፈሳዊ ልጅ የለም።
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push("/children/register" as any)}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={styles.emptyBtnText}>የመጀመሪያ ልጅ መዝግብ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredChildren}
        keyExtractor={(item) => item.eotcUid || item.id}
        renderItem={renderChildCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={THEME.colors.sacredCrimson}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerArea: {
    padding: 16,
    paddingTop: 12,
  },
  topBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.buttonDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radii.pill,
    elevation: 3,
    shadowColor: THEME.colors.buttonDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
  },
  statCardActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  statCardPending: {
    backgroundColor: "#FEFCE8",
    borderColor: "#FEF08A",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  statValueActive: {
    color: THEME.colors.success,
  },
  statValuePending: {
    color: THEME.colors.sacredAmber,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statLabelActive: {
    color: THEME.colors.success,
  },
  statLabelPending: {
    color: THEME.colors.sacredAmber,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.pill,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipSelected: {
    backgroundColor: THEME.colors.sacredCrimsonLight,
    borderColor: THEME.colors.sacredCrimson,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  filterChipTextSelected: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "800",
  },
  resultCount: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    letterSpacing: 0.5,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: THEME.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 2,
    shadowColor: THEME.colors.inkPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarWrapper: {
    position: "relative",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHalo: {
    position: "absolute",
    inset: -2,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: THEME.colors.sacredAmber,
    opacity: 0.5,
  },
  avatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  nameBlock: {
    flex: 1,
  },
  secularName: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  christianName: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    marginTop: 1,
  },
  uidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  uidText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radii.pill,
  },
  statusBadgeActive: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgePending: {
    backgroundColor: "#FEF08A",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  statusTextActive: {
    color: THEME.colors.success,
  },
  statusTextPending: {
    color: "#B45309",
  },
  academicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  academicText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  cardActionText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  viewProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  viewProfileText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
    marginTop: 12,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.buttonDark,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: THEME.radii.pill,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
