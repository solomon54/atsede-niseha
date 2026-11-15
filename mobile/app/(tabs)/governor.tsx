// mobile/app/(tabs)/governor.tsx
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Award,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Plus,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { copyToClipboard } from "../../src/lib/clipboard";
import { THEME } from "../../src/constants/theme";

interface GovernorOverviewData {
  success: boolean;
  fathersCount: number;
  studentsCount: number;
  systemStatus: string;
  ledgerStatus: string;
  recentFathers: Array<{
    id: string;
    eotcUid: string;
    fullName: string;
    title: string;
    diocese: string;
    parish: string;
    phone: string;
    email: string;
    accountClaimed: boolean;
    isApproved: boolean;
    createdAt: string;
  }>;
  recentStudents: Array<{
    id: string;
    eotcUid: string;
    fullName: string;
    christianName: string;
    secularName: string;
    diocese: string;
    status: string;
    accountClaimed: boolean;
    createdAt: string;
  }>;
  timestamp: string;
}

export default function GovernorScreen() {
  const router = useRouter();
  const { role } = useAuth();

  const {
    data: overview,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery<GovernorOverviewData>({
    queryKey: ["governor-overview"],
    queryFn: () => apiRequest<GovernorOverviewData>("/api/governor/overview"),
    staleTime: 30 * 1000,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleCopyId = async (id: string, label: string) => {
    await copyToClipboard(id, label);
  };

  React.useEffect(() => {
    if (role && role !== "GOVERNOR") {
      if (role === "FATHER") {
        router.replace("/(tabs)/children" as any);
      } else {
        router.replace("/(tabs)/appointments" as any);
      }
    }
  }, [role, router]);

  if (role !== "GOVERNOR") {
    return (
      <View style={styles.unauthContainer}>
        <ShieldAlert color={THEME.colors.sacredCrimson} size={48} />
        <Text style={styles.unauthTitle}>ያልተፈቀደ ገጽ</Text>
        <Text style={styles.unauthSub}>
          ይህ ገጽ ለበላይ ተቆጣጣሪዎች (System Governors) ብቻ የተፈቀደ ነው። ወደ ተፈቀደው ገጽ በመመለስ ላይ...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          colors={[THEME.colors.sacredCrimson]}
          tintColor={THEME.colors.sacredCrimson}
        />
      }
    >
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.badgeRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>SYSTEM LIVE</Text>
            </View>
            <Text style={styles.versionText}>v1.0 SECURE</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={() => refetch()}
          >
            <RefreshCw
              color={THEME.colors.sacredAmber}
              size={16}
              style={isRefetching ? styles.rotating : undefined}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>የበላይ መቆጣጠሪያ ማዕከል</Text>
        <Text style={styles.headerSub}>
          የአባቶች መመዝገቢያ እና የመላው ቤተክርስቲያን ልጆች መቆጣጠሪያ
        </Text>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsGrid}>
        {/* Total Fathers */}
        <View style={[styles.metricCard, styles.metricCardDark]}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricIconBoxDark}>
              <Award color={THEME.colors.sacredAmber} size={18} />
            </View>
            <Text style={styles.metricTagDark}>አባቶች</Text>
          </View>
          <Text style={styles.metricValueDark}>
            {isLoading ? "—" : overview?.fathersCount ?? 0}
          </Text>
          <Text style={styles.metricLabelDark}>ጠቅላላ መንፈሳዊ አባቶች</Text>
        </View>

        {/* Active Students */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricIconBox}>
              <Users color={THEME.colors.sacredCrimson} size={18} />
            </View>
            <Text style={styles.metricTag}>ልጆች</Text>
          </View>
          <Text style={styles.metricValue}>
            {isLoading ? "—" : overview?.studentsCount ?? 0}
          </Text>
          <Text style={styles.metricLabel}>ንቁ መንፈሳዊ ልጆች</Text>
        </View>

        {/* Ledger Sync Status */}
        <View style={[styles.metricCard, styles.metricCardWide]}>
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerIconBox}>
              <Server color={THEME.colors.success} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ledgerStatusTitle}>የመዝገብ ሁኔታ (LEDGER)</Text>
              <Text style={styles.ledgerStatusSub}>
                Firebase Firestore + E2EE Cryptographic Verification Active
              </Text>
            </View>
            <View style={styles.syncedPill}>
              <ShieldCheck color={THEME.colors.success} size={14} />
              <Text style={styles.syncedPillText}>SYNCED</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions Navigation */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionHeaderTitle}>ፈጣን ተግባራት (COMMAND ACTIONS)</Text>

        {/* 1. Authorize Father */}
        <TouchableOpacity
          style={styles.actionCardPrimary}
          onPress={() => router.push("/governor/authorize" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.actionIconPrimary}>
            <UserPlus color="#FFFFFF" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitlePrimary}>አዲስ አባት ፍቃድ መስጠት</Text>
            <Text style={styles.actionSubPrimary}>
              አዲስ መንፈሳዊ አባት በ EOTC ቁልፍ ፍቃድ ሰጥቶ መመዝገብ
            </Text>
          </View>
          <ChevronRight color="#FFFFFF" size={20} />
        </TouchableOpacity>

        {/* 2. Fathers Directory */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/governor/fathers" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.actionIcon}>
            <Award color={THEME.colors.sacredCrimson} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>የአባቶች መዝገብ (Fathers Ledger)</Text>
            <Text style={styles.actionSub}>
              የተመዘገቡ አባቶች ዝርዝር፣ ሁኔታ እና ሀገረ ስብከት
            </Text>
          </View>
          <ChevronRight color={THEME.colors.inkMuted} size={18} />
        </TouchableOpacity>

        {/* 3. Students Directory */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/governor/students" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.actionIcon}>
            <Users color={THEME.colors.sacredAmber} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>የተማሪዎች መዝገብ (Students Ledger)</Text>
            <Text style={styles.actionSub}>
              በመላው ቤተክርስቲያን የተመዘገቡ መንፈሳዊ ልጆች ዝርዝር
            </Text>
          </View>
          <ChevronRight color={THEME.colors.inkMuted} size={18} />
        </TouchableOpacity>
      </View>

      {/* Recently Authorized Fathers */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>በቅርብ የተፈቀደላቸው አባቶች</Text>
          <TouchableOpacity onPress={() => router.push("/governor/fathers" as any)}>
            <Text style={styles.seeAllLink}>ሁሉንም እይ →</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={THEME.colors.sacredCrimson}
            style={{ marginVertical: 20 }}
          />
        ) : overview?.recentFathers && overview.recentFathers.length > 0 ? (
          overview.recentFathers.map((father) => (
            <View key={father.id} style={styles.recentCard}>
              <View style={styles.recentCardLeft}>
                <View style={styles.fatherAvatarBox}>
                  <Text style={styles.fatherAvatarText}>
                    {father.fullName.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentItemName}>
                    {father.title} {father.fullName}
                  </Text>
                  <Text style={styles.recentItemSub}>
                    {father.diocese} • {father.parish}
                  </Text>
                  <TouchableOpacity
                    style={styles.idChip}
                    onPress={() => handleCopyId(father.eotcUid, "የአባቱ መለያ")}
                  >
                    <Text style={styles.idChipText}>{father.eotcUid}</Text>
                    <Copy color={THEME.colors.sacredAmber} size={12} />
                  </TouchableOpacity>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  father.accountClaimed
                    ? styles.statusBadgeActive
                    : styles.statusBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    father.accountClaimed
                      ? styles.statusTextActive
                      : styles.statusTextPending,
                  ]}
                >
                  {father.accountClaimed ? "ተረጋግጧል" : "ተጠባባቂ"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRecentText}>የተመዘገቡ አባቶች አልተገኙም</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.xl,
    padding: 20,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#34D399",
    letterSpacing: 1,
  },
  versionText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 1,
  },
  refreshIconBtn: {
    padding: 4,
  },
  rotating: {
    transform: [{ rotate: "45deg" }],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 4,
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  metricCardDark: {
    backgroundColor: THEME.colors.inkPrimary,
    borderColor: THEME.colors.inkPrimary,
  },
  metricCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.sacredCrimsonLight,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconBoxDark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricTag: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    textTransform: "uppercase",
  },
  metricTagDark: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    fontFamily: "monospace",
  },
  metricValueDark: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    fontFamily: "monospace",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
    marginTop: 4,
  },
  metricLabelDark: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  metricCardWide: {
    width: "100%",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ledgerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  ledgerStatusTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: 0.5,
  },
  ledgerStatusSub: {
    fontSize: 9,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  syncedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.successBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radii.pill,
  },
  syncedPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: THEME.colors.success,
  },
  actionsSection: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  actionCardPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: THEME.radii.xl,
    padding: 16,
    gap: 14,
    marginBottom: 10,
    elevation: 3,
    shadowColor: THEME.colors.sacredCrimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  actionIconPrimary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitlePrimary: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  actionSubPrimary: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    lineHeight: 15,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 16,
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  actionSub: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  recentSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  seeAllLink: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  recentCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  fatherAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.sacredCrimsonLight,
    alignItems: "center",
    justifyContent: "center",
  },
  fatherAvatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
  },
  recentItemName: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  recentItemSub: {
    fontSize: 10,
    color: THEME.colors.inkMuted,
    marginTop: 2,
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
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radii.pill,
  },
  statusBadgeActive: {
    backgroundColor: THEME.colors.successBg,
  },
  statusBadgePending: {
    backgroundColor: THEME.colors.amberLight,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusTextActive: {
    color: THEME.colors.success,
  },
  statusTextPending: {
    color: THEME.colors.sacredAmber,
  },
  emptyRecentText: {
    textAlign: "center",
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginVertical: 16,
  },
  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  unauthTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    marginTop: 12,
  },
  unauthSub: {
    fontSize: 12,
    color: THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});

