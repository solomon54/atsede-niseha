import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LogOut, ShieldCheck, User, Calendar, CheckCircle2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/lib/auth-context";
import { apiRequest } from "../../src/lib/api";

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
    queryKey: ["appointments"],
    queryFn: async () => {
      return await apiRequest<{ success: boolean; appointments: Appointment[] }>(
        "/api/appointments"
      );
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
        return "የንስሐ አባት (Spiritual Father)";
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
    <View style={styles.container}>
      {/* Identity Card */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <User color="#D97706" size={36} />
        </View>
        <Text style={styles.uidText}>{eotcUid || "EOTC User"}</Text>
        <Text style={styles.roleText}>{getRoleLabel(role)}</Text>
      </View>

      {/* Spiritual Timeline — Driven directly by appointments */}
      {role === "STUDENT" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>መንፈሳዊ ጊዜ ሰሌዳ (Spiritual Timeline)</Text>

          <View style={styles.timelineItem}>
            <CheckCircle2 color="#059669" size={20} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>የመጨረሻ ንስሐ</Text>
              <Text style={styles.timelineValue}>
                {formatDate(lastCompletedNiseha?.scheduledAt)}
              </Text>
            </View>
          </View>

          <View style={[styles.timelineItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Calendar color="#D97706" size={20} />
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
          <ShieldCheck color="#10B981" size={20} />
          <Text style={styles.securityText}>
            የስክሪን ደህንነት (FLAG_SECURE) ነቅቷል
          </Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut color="#EF4444" size={20} />
        <Text style={styles.logoutText}>ከመለያ ውጣ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
    padding: 20,
  },
  profileHeader: {
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#78350F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  uidText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  roleText: {
    color: "#D97706",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  sectionTitle: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingBottom: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    color: "#94A3B8",
    fontSize: 12,
  },
  timelineValue: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  securityText: {
    color: "#CBD5E1",
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#450A0A",
    borderColor: "#7F1D1D",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: "auto",
  },
  logoutText: {
    color: "#FCA5A5",
    fontSize: 15,
    fontWeight: "600",
  },
});
