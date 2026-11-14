// mobile/app/governor/students.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  MapPin,
  Search,
  User,
  Users,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../src/lib/api";
import { copyToClipboard } from "../../src/lib/clipboard";
import { THEME } from "../../src/constants/theme";

interface StudentItem {
  id: string;
  eotcUid: string;
  fullName: string;
  christianName?: string;
  secularName?: string;
  gender?: string;
  status?: string;
  diocese?: string;
  university?: string;
  department?: string;
  entryYear?: number;
  programDuration?: number;
  spiritualFatherId?: string;
  fatherId?: string;
  accountClaimed?: boolean;
  createdAt?: string;
}

export default function GovernorStudentsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE" | "MALE" | "FEMALE"
  >("ALL");

  const {
    data: students = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<StudentItem[]>({
    queryKey: ["governor-students-directory"],
    queryFn: () =>
      apiRequest<StudentItem[]>("/api/governor/directory?type=students"),
    staleTime: 30 * 1000,
  });

  const filteredStudents = useMemo(() => {
    return students.filter((item) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.fullName && item.fullName.toLowerCase().includes(q)) ||
        (item.christianName && item.christianName.toLowerCase().includes(q)) ||
        (item.secularName && item.secularName.toLowerCase().includes(q)) ||
        (item.eotcUid && item.eotcUid.toLowerCase().includes(q)) ||
        (item.diocese && item.diocese.toLowerCase().includes(q)) ||
        (item.university && item.university.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filterStatus === "ACTIVE") return item.status === "ACTIVE";
      if (filterStatus === "INACTIVE") return item.status !== "ACTIVE";
      if (filterStatus === "MALE") return item.gender === "MALE";
      if (filterStatus === "FEMALE") return item.gender === "FEMALE";
      return true;
    });
  }, [students, search, filterStatus]);

  const activeCount = useMemo(
    () => students.filter((s) => s.status === "ACTIVE").length,
    [students]
  );
  const maleCount = useMemo(
    () => students.filter((s) => s.gender === "MALE").length,
    [students]
  );
  const femaleCount = students.length - maleCount;

  const handleCopyId = async (id: string) => {
    await copyToClipboard(id, "የልጁ መለያ ቁጥር");
  };

  const renderItem = ({ item }: { item: StudentItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.avatarBox,
            item.gender === "FEMALE" ? styles.avatarFemale : undefined,
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              item.gender === "FEMALE" ? styles.avatarTextFemale : undefined,
            ]}
          >
            {(item.christianName || item.fullName || "ል").charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          {item.christianName ? (
            <>
              <Text style={styles.christianName}>{item.christianName}</Text>
              <Text style={styles.secularName}>
                {item.secularName || item.fullName}
              </Text>
            </>
          ) : (
            <Text style={styles.christianName}>{item.fullName}</Text>
          )}
          <TouchableOpacity
            style={styles.idChip}
            onPress={() => handleCopyId(item.eotcUid || item.id)}
          >
            <Text style={styles.idChipText}>{item.eotcUid || item.id}</Text>
            <Copy color={THEME.colors.sacredAmber} size={12} />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.statusPill,
            item.status === "ACTIVE"
              ? styles.statusPillActive
              : styles.statusPillInactive,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              item.status === "ACTIVE"
                ? styles.statusTextActive
                : styles.statusTextInactive,
            ]}
          >
            {item.status === "ACTIVE" ? "ንቁ" : "የራቀ"}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {item.diocese ? (
          <View style={styles.infoRow}>
            <MapPin color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>{item.diocese}</Text>
          </View>
        ) : null}

        {item.university ? (
          <View style={styles.infoRow}>
            <BookOpen color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>
              {item.university}
              {item.department ? ` • ${item.department}` : ""}
            </Text>
          </View>
        ) : null}

        {item.gender ? (
          <View style={styles.infoRow}>
            <User color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>
              {item.gender === "MALE" ? "ወንድ" : "ሴት"}
              {item.accountClaimed ? " • መለያው ተረጋግጧል ✓" : " • ተጠባባቂ"}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={20} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>የልጆች መዝገብ</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputBox}>
          <Search color={THEME.colors.inkMuted} size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="በስም፣ በዩኒቨርሲቲ ወይም በመለያ ፈልግ..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <View style={styles.filterChipRow}>
          {(
            [
              { key: "ALL", label: `ሁሉም (${students.length})` },
              { key: "ACTIVE", label: `ንቁ (${activeCount})` },
              {
                key: "INACTIVE",
                label: `የራቁ (${students.length - activeCount})`,
              },
              { key: "MALE", label: `ወንድ (${maleCount})` },
              { key: "FEMALE", label: `ሴት (${femaleCount})` },
            ] as const
          ).map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                filterStatus === chip.key && styles.filterChipActive,
              ]}
              onPress={() => setFilterStatus(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === chip.key && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.sacredCrimson} />
          <Text style={styles.loadingText}>የልጆችን መዝገብ በማውጣት ላይ...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id || item.eotcUid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[THEME.colors.sacredCrimson]}
              tintColor={THEME.colors.sacredCrimson}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Users color={THEME.colors.inkSubtle} size={40} />
              <Text style={styles.emptyTitle}>ምንም ልጅ አልተገኘም</Text>
              <Text style={styles.emptySub}>
                የተፈለገው ስም አልተገኘም ወይም ገና ልጆች አልተመዘገቡም።
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.navigationBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  navBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  navBackText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.sacredCrimson,
    borderColor: THEME.colors.sacredCrimson,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.sacredCrimsonLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFemale: {
    backgroundColor: THEME.colors.amberLight,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
  },
  avatarTextFemale: {
    color: THEME.colors.sacredAmber,
  },
  christianName: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  secularName: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.inkMuted,
    marginTop: 1,
  },
  idChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.surfaceAlt,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  idChipText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "800",
    color: THEME.colors.inkSecondary,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radii.pill,
  },
  statusPillActive: {
    backgroundColor: THEME.colors.successBg,
  },
  statusPillInactive: {
    backgroundColor: THEME.colors.errorBg,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusTextActive: {
    color: THEME.colors.success,
  },
  statusTextInactive: {
    color: THEME.colors.error,
  },
  cardBody: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 11,
    color: THEME.colors.inkSecondary,
    fontWeight: "600",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    fontSize: 12,
    color: THEME.colors.inkMuted,
    marginTop: 10,
    fontWeight: "600",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 240,
  },
});
