// mobile/app/governor/fathers.tsx
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
  Award,
  CheckCircle2,
  Copy,
  Clock,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { copyToClipboard } from "../../src/lib/clipboard";
import { THEME } from "../../src/constants/theme";

interface FatherItem {
  id: string;
  eotcUid: string;
  fullName: string;
  title?: string;
  diocese?: string;
  parish?: string;
  email?: string;
  phone?: string;
  academics?: string;
  accountClaimed?: boolean;
  isApproved?: boolean;
  accessGrantedAt?: string;
  createdAt?: string;
}

export default function GovernorFathersScreen() {
  const router = useRouter();
  const { role } = useAuth();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "CLAIMED" | "PENDING">("ALL");

  const {
    data: fathers = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<FatherItem[]>({
    queryKey: ["governor-fathers-directory"],
    queryFn: () => apiRequest<FatherItem[]>("/api/governor/directory?type=fathers"),
    staleTime: 30 * 1000,
  });

  const filteredFathers = useMemo(() => {
    return fathers.filter((item) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.fullName && item.fullName.toLowerCase().includes(q)) ||
        (item.eotcUid && item.eotcUid.toLowerCase().includes(q)) ||
        (item.diocese && item.diocese.toLowerCase().includes(q)) ||
        (item.parish && item.parish.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filterStatus === "CLAIMED") return !!item.accountClaimed;
      if (filterStatus === "PENDING") return !item.accountClaimed;
      return true;
    });
  }, [fathers, search, filterStatus]);

  const claimedCount = useMemo(
    () => fathers.filter((f) => f.accountClaimed).length,
    [fathers]
  );
  const pendingCount = fathers.length - claimedCount;

  const handleCopyId = async (id: string) => {
    await copyToClipboard(id, "የአባቱ መለያ ቁጥር");
  };

  const renderItem = ({ item }: { item: FatherItem }) => (
    <View style={styles.fatherCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>
            {(item.fullName || "አ").charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.fatherTitle}>{item.title || "ቀሲስ"}</Text>
            <Text style={styles.fatherName}>{item.fullName}</Text>
          </View>
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
            item.accountClaimed
              ? styles.statusPillActive
              : styles.statusPillPending,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              item.accountClaimed
                ? styles.statusTextActive
                : styles.statusTextPending,
            ]}
          >
            {item.accountClaimed ? "ተረጋግጧል" : "ተጠባባቂ"}
          </Text>
        </View>
      </View>

      {/* Details Row */}
      <View style={styles.cardBody}>
        {(item.diocese || item.parish) && (
          <View style={styles.infoRow}>
            <MapPin color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>
              {item.diocese || "—"} • {item.parish || "—"}
            </Text>
          </View>
        )}

        {item.phone ? (
          <View style={styles.infoRow}>
            <Phone color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>
        ) : null}

        {item.email ? (
          <View style={styles.infoRow}>
            <Mail color={THEME.colors.inkMuted} size={14} />
            <Text style={styles.infoText}>{item.email}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={20} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>የአባቶች መዝገብ</Text>
        <TouchableOpacity
          style={styles.navAddBtn}
          onPress={() => router.push("/governor/authorize" as any)}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={styles.navAddText}>መዝግብ</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputBox}>
          <Search color={THEME.colors.inkMuted} size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="በስም፣ በሀገረ ስብከት ወይም በመለያ ፈልግ..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter Chips & Stats */}
      <View style={styles.filterSection}>
        <View style={styles.filterChipRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterStatus === "ALL" && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus("ALL")}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === "ALL" && styles.filterChipTextActive,
              ]}
            >
              ሁሉም ({fathers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filterStatus === "CLAIMED" && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus("CLAIMED")}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === "CLAIMED" && styles.filterChipTextActive,
              ]}
            >
              ተረጋግጧል ({claimedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filterStatus === "PENDING" && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus("PENDING")}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === "PENDING" && styles.filterChipTextActive,
              ]}
            >
              ተጠባባቂ ({pendingCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.colors.sacredCrimson} />
          <Text style={styles.loadingText}>የአባቶችን መዝገብ በማውጣት ላይ...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFathers}
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
              <Award color={THEME.colors.inkSubtle} size={40} />
              <Text style={styles.emptyTitle}>ምንም አባት አልተገኘም</Text>
              <Text style={styles.emptySub}>
                የተፈለገው ስም አልተገኘም ወይም እስካሁን የተመዘገቡ አባቶች የሉም።
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
  navAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.sacredCrimson,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.pill,
  },
  navAddText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
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
  fatherCard: {
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
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fatherTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
  },
  fatherName: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
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
  statusPillPending: {
    backgroundColor: THEME.colors.amberLight,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusTextActive: {
    color: THEME.colors.success,
  },
  statusTextPending: {
    color: THEME.colors.sacredAmber,
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

