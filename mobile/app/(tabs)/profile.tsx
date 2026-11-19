import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/lib/auth-context";
import { apiRequest } from "../../src/lib/api";
import { THEME } from "../../src/constants/theme";

interface Appointment {
  id: string;
  type: "NISEHA" | "COUNSELING";
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
}

export default function ProfileScreen() {
  const { role, eotcUid, logout } = useAuth();
  const router = useRouter();

  const { data: appointmentsData } = useQuery<{
    success: boolean;
    appointments: Appointment[];
  }>({
    queryKey: ["appointments", eotcUid],
    queryFn: async () => {
      return await apiRequest<{
        success: boolean;
        appointments: Appointment[];
      }>("/api/appointments");
    },
  });

  const appointments = appointmentsData?.appointments || [];

  // Derive Spiritual Timeline from appointments
  const lastCompletedNiseha = appointments
    .filter((a) => a.type === "NISEHA" && a.status === "COMPLETED")
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )[0];

  const nextConfirmedApt = appointments
    .filter((a) => a.status === "CONFIRMED")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )[0];

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const getRoleLabel = (r: string | null) => {
    switch (r) {
      case "FATHER":
        return "መምህረ ንስሐ (Spiritual Father)";
      case "STUDENT":
        return "የንስሐ ልጅ (Child of Confession)";
      case "GOVERNOR":
        return "አስተዳዳሪ (Governor)";
      default:
        return "ተጠቃሚ";
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "አልተመዘገበም";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("am-ET", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity Card */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarHaloContainer}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatarCircle}>
            <User color={THEME.colors.sacredAmber} size={36} />
          </View>
        </View>

        <Text style={styles.uidText}>{eotcUid || "EOTC User"}</Text>

        <View style={styles.rolePill}>
          <Award color={THEME.colors.sacredAmber} size={14} />
          <Text style={styles.roleText}>{getRoleLabel(role)}</Text>
        </View>
      </View>

      {/* Father Flock Banner */}
      {role === "FATHER" && (
        <TouchableOpacity
          style={styles.flockBanner}
          onPress={() => router.push("/(tabs)/children" as any)}
          activeOpacity={0.85}
        >
          <View style={styles.flockBannerIcon}>
            <Users color={THEME.colors.sacredCrimson} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.flockBannerTitle}>የንስሐ ልጆች (መንጋዬ)</Text>
            <Text style={styles.flockBannerSub}>
              የልጆችዎን ዝርዝር ለማየት እና አዲስ ለመመዝገብ እዚህ ይጫኑ
            </Text>
          </View>
          <ChevronRight color={THEME.colors.sacredCrimson} size={18} />
        </TouchableOpacity>
      )}

      {/* Spiritual Timeline */}
      {role === "STUDENT" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>መንፈሳዊ ጊዜ ሰሌዳ (Spiritual Timeline)</Text>

          <View style={styles.timelineItem}>
            <View style={styles.timelineIconBox}>
              <CheckCircle2 color={THEME.colors.success} size={20} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>የመጨረሻ ንስሐ</Text>
              <Text style={styles.timelineValue}>
                {formatDate(lastCompletedNiseha?.scheduledAt)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.timelineItem,
              { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
            ]}
          >
            <View style={styles.timelineIconBox}>
              <Calendar color={THEME.colors.sacredAmber} size={20} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>ቀጣይ የተረጋገጠ ቀጠሮ</Text>
              <Text style={styles.timelineValue}>
                {formatDate(nextConfirmedApt?.scheduledAt)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Security Status */}
      <View style={styles.section}>
        <View style={styles.securityRow}>
          <ShieldCheck color={THEME.colors.success} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>የስክሪን ደህንነት (FLAG_SECURE)</Text>
            <Text style={styles.securitySub}>
              ምስጢራዊነትን ለመጠበቅ የስክሪን ቅጂ (Screenshot) ተከልክሏል።
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Action */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => router.push("/settings" as any)}
        activeOpacity={0.85}
      >
        <Settings color={THEME.colors.inkPrimary} size={18} />
        <Text style={styles.settingsText}>ቅንብሮች (Settings)</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <LogOut color={THEME.colors.error} size={18} />
        <Text style={styles.logoutText}>ከመለያ ውጣ (Sign Out)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xxl,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  avatarHaloContainer: {
    position: "relative",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarGlow: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: THEME.colors.amberLight,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: THEME.colors.amberBorder,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.card,
  },
  uidText: {
    color: THEME.colors.inkPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  roleText: {
    color: THEME.colors.sacredAmber,
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  sectionTitle: {
    color: THEME.colors.inkMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
    paddingBottom: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  timelineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    color: THEME.colors.inkSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  timelineValue: {
    color: THEME.colors.inkPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  securityTitle: {
    color: THEME.colors.inkPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  securitySub: {
    color: THEME.colors.inkSubtle,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  flockBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    gap: 12,
  },
  flockBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.sacredCrimsonLight,
    alignItems: "center",
    justifyContent: "center",
  },
  flockBannerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  flockBannerSub: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 14,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  settingsText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: THEME.colors.errorBg,
    borderColor: THEME.colors.errorBorder,
    borderWidth: 1,
    borderRadius: THEME.radii.lg,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    color: THEME.colors.error,
    fontSize: 14,
    fontWeight: "800",
  },
});
