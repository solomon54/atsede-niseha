// mobile/app/(tabs)/children.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  MapPin,
  MessageSquare,
  Plus,
  Search,
  User,
  Users,
  Video,
} from "lucide-react-native";

import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import {
  resolveChildDirectChannel,
  showUnclaimedAccountNotice,
} from "../../src/lib/channel-helper";
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
  region?: string;
  zone?: string;
  city?: string;
  diocese?: string;
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
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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
          (child.eotcUid || "").toLowerCase().includes(query) ||
          (child.university || "").toLowerCase().includes(query);

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

  // Direct Message targeting this exact child
  const handleChildMessage = async (e: any, child: ChildItem) => {
    e.stopPropagation();
    if (!child.accountClaimed || !child.uid) {
      showUnclaimedAccountNotice(child);
      return;
    }
    const targetKey = child.eotcUid || child.id;
    setResolvingId(targetKey);
    try {
      const channelId = await resolveChildDirectChannel(child);
      if (channelId) {
        router.push(`/chat/${channelId}` as any);
      } else {
        Alert.alert(
          "መልዕክት መክፈት አልተቻለም",
          "ከዚህ መንፈሳዊ ልጅ ጋር ቀጥታ የውይይት መስመር አልተገኘም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።"
        );
      }
    } finally {
      setResolvingId(null);
    }
  };

  // Direct Video Call targeting this exact child
  const handleChildCall = async (e: any, child: ChildItem) => {
    e.stopPropagation();
    if (!child.accountClaimed || !child.uid) {
      showUnclaimedAccountNotice(child);
      return;
    }
    const targetKey = child.eotcUid || child.id;
    setResolvingId(targetKey);
    try {
      const channelId = await resolveChildDirectChannel(child);
      if (channelId) {
        router.push(`/call/${channelId}` as any);
      } else {
        Alert.alert(
          "ቪዲዮ ጥሪ መጀመር አልተቻለም",
          "ከዚህ መንፈሳዊ ልጅ ጋር የጥሪ መስመር አልተገኘም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።"
        );
      }
    } finally {
      setResolvingId(null);
    }
  };

  // Direct Appointment targeting this exact child
  const handleChildAppointment = (e: any, child: ChildItem) => {
    e.stopPropagation();
    if (!child.accountClaimed || !child.uid) {
      showUnclaimedAccountNotice(child);
      return;
    }
    router.push({
      pathname: "/(tabs)/appointments" as any,
      params: {
        childUid: child.uid,
        childEotcUid: child.eotcUid,
        openModal: "true",
      },
    });
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
          <Plus color="#FFFFFF" size={15} />
          <Text style={styles.registerBtnText}>አዲስ መዝግብ</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards - Calmer and refined */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{childrenList.length}</Text>
          <Text style={styles.statLabel}>ጠቅላላ ልጆች</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statDotRow}>
            <View style={[styles.statDot, { backgroundColor: THEME.colors.success }]} />
            <Text style={[styles.statValue, { color: THEME.colors.success }]}>
              {activeCount}
            </Text>
          </View>
          <Text style={styles.statLabel}>የጸኑ (Active)</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statDotRow}>
            <View style={[styles.statDot, { backgroundColor: THEME.colors.sacredAmber }]} />
            <Text style={[styles.statValue, { color: THEME.colors.sacredAmber }]}>
              {pendingCount}
            </Text>
          </View>
          <Text style={styles.statLabel}>በመጠባበቅ ላይ</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search color={THEME.colors.inkMuted} size={16} />
        <TextInput
          style={styles.searchInput}
          placeholder="በስም፣ ዩኒቨርሲቲ ወይም መለያ ቁጥር ይፈልጉ..."
          placeholderTextColor={THEME.colors.inkSubtle}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
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
        {filteredChildren.length} መንፈሳዊ ልጆች ተገኝተዋል
      </Text>
    </View>
  );

  const renderChildCard = ({ item }: { item: ChildItem }) => {
    const isClaimed = Boolean(item.accountClaimed);
    const childKey = item.eotcUid || item.id;
    const isResolving = resolvingId === childKey;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => router.push(`/children/${childKey}` as any)}
      >
        {/* Top Header: Avatar + Identity + Status */}
        <View style={styles.cardHeader}>
          {/* Calm, Dignified Avatar */}
          <View style={styles.avatarBox}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(item.secularName || item.fullName || "ል").charAt(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Names Block */}
          <View style={styles.nameBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.secularName} numberOfLines={1}>
                {item.secularName || item.fullName || "ስም ያልተገለጸ"}
              </Text>
              {item.spiritualTitle ? (
                <View style={styles.titleBadge}>
                  <Text style={styles.titleBadgeText}>{item.spiritualTitle}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.christianName} numberOfLines={1}>
              {item.christianName || "የክርስትና ስም የለም"}
            </Text>

            {/* EOTC UID Pill with Copy */}
            <TouchableOpacity
              style={styles.uidPill}
              onPress={() => handleCopyId(item.eotcUid)}
              hitSlop={4}
            >
              <Text style={styles.uidText}>{item.eotcUid}</Text>
              <Copy
                color={
                  copiedId === item.eotcUid
                    ? THEME.colors.success
                    : THEME.colors.inkMuted
                }
                size={10}
              />
            </TouchableOpacity>
          </View>

          {/* Calm Status Pill */}
          <View
            style={[
              styles.statusPill,
              isClaimed ? styles.statusPillActive : styles.statusPillPending,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isClaimed
                    ? THEME.colors.success
                    : THEME.colors.sacredAmber,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                isClaimed
                  ? styles.statusPillTextActive
                  : styles.statusPillTextPending,
              ]}
            >
              {isClaimed ? "የጸና" : "በመጠባበቅ"}
            </Text>
          </View>
        </View>

        {/* Academic / Location Tags */}
        <View style={styles.tagsRow}>
          {item.university ? (
            <View style={styles.tagItem}>
              <GraduationCap color={THEME.colors.inkMuted} size={12} />
              <Text style={styles.tagText} numberOfLines={1}>
                {item.department ? `${item.department} • ` : ""}
                {item.university}
              </Text>
            </View>
          ) : null}

          {item.city || item.region ? (
            <View style={styles.tagItem}>
              <MapPin color={THEME.colors.inkMuted} size={12} />
              <Text style={styles.tagText} numberOfLines={1}>
                {item.city || item.region}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Bar: Exact Child Direct Messaging, Calling, Appointment */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              !isClaimed && styles.actionBtnMuted,
            ]}
            onPress={(e) => handleChildMessage(e, item)}
            disabled={isResolving}
            activeOpacity={0.7}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color={THEME.colors.sacredCrimson} />
            ) : (
              <>
                <MessageSquare color={THEME.colors.sacredCrimson} size={13} />
                <Text style={styles.actionBtnText}>መልዕክት</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              !isClaimed && styles.actionBtnMuted,
            ]}
            onPress={(e) => handleChildCall(e, item)}
            disabled={isResolving}
            activeOpacity={0.7}
          >
            <Video color="#2563EB" size={13} />
            <Text style={[styles.actionBtnText, { color: "#2563EB" }]}>
              ቪዲዮ ጥሪ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              !isClaimed && styles.actionBtnMuted,
            ]}
            onPress={(e) => handleChildAppointment(e, item)}
            activeOpacity={0.7}
          >
            <Calendar color={THEME.colors.sacredAmber} size={13} />
            <Text style={[styles.actionBtnText, { color: THEME.colors.sacredAmber }]}>
              ቀጠሮ
            </Text>
          </TouchableOpacity>

          <View style={styles.viewLink}>
            <Text style={styles.viewLinkText}>ዝርዝር</Text>
            <ChevronRight color={THEME.colors.inkMuted} size={13} />
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
        <Users color={THEME.colors.inkSubtle} size={44} />
        <Text style={styles.emptyTitle}>ምንም መንፈሳዊ ልጆች አልተገኙም</Text>
        <Text style={styles.emptySubtitle}>
          በዚህ መፈለጊያ መስፈርት የተመዘገበ መንፈሳዊ ልጅ የለም።
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push("/children/register" as any)}
        >
          <Plus color="#FFFFFF" size={15} />
          <Text style={styles.emptyBtnText}>አዲስ ልጅ መዝግብ</Text>
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
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 8.5,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: THEME.colors.buttonDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.pill,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
  },
  statDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    fontSize: 9.5,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  filterChipTextSelected: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "800",
  },
  resultCount: {
    fontSize: 9.5,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  /* Calm, Beautiful Card */
  card: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 42,
    height: 42,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
  },
  nameBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secularName: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  titleBadge: {
    backgroundColor: THEME.colors.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  titleBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
  },
  christianName: {
    fontSize: 11.5,
    fontWeight: "700",
    color: THEME.colors.sacredAmber,
    marginTop: 1,
  },
  uidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  uidText: {
    fontSize: 9.5,
    fontFamily: "monospace",
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  statusPillPending: {
    backgroundColor: "#FEFCE8",
    borderColor: "#FEF08A",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusPillTextActive: {
    color: THEME.colors.success,
  },
  statusPillTextPending: {
    color: "#B45309",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  tagItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  actionBtnMuted: {
    opacity: 0.75,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  viewLink: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 2,
  },
  viewLinkText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
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
    gap: 5,
    backgroundColor: THEME.colors.buttonDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radii.pill,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
