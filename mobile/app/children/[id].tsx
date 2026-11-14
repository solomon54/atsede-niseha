// mobile/app/children/[id].tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  GraduationCap,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  User,
  Video,
} from "lucide-react-native";

import { apiRequest } from "../../src/lib/api";
import { offlineCache } from "../../src/lib/cache";
import { copyToClipboard } from "../../src/lib/clipboard";
import { useCacheFirst } from "../../src/lib/use-cache-first";
import { THEME } from "../../src/constants/theme";

export interface StudentDetail {
  id: string;
  uid?: string;
  eotcUid: string;
  secularName?: string;
  fullName?: string;
  christianName?: string;
  gender?: "MALE" | "FEMALE";
  phone?: string;
  email?: string;
  photoUrl?: string;
  spiritualTitle?: string;
  spiritualFatherId?: string;
  language?: string;
  university?: string;
  college?: string;
  department?: string;
  entryYear?: number;
  programDuration?: number;
  region?: string;
  zone?: string;
  city?: string;
  accountClaimed?: boolean;
  status?: string;
  createdAt?: string;
  birthDate?: {
    year?: number | string;
    month?: number | string;
    day?: number | string;
  };
}

export default function ChildProfileDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [copied, setCopied] = useState(false);

  // 1. Fetch Student Details
  const { data, isLoading, error } = useQuery<{
    success: boolean;
    student: StudentDetail;
  }>({
    queryKey: ["child-detail", id],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; student: StudentDetail }>(
        `/api/father/children/${id}`
      );
      if (res?.student) {
        offlineCache.setQuery(`child_detail_${id}`, res.student);
      }
      return res;
    },
    enabled: Boolean(id),
  });

  // 2. Cache-first hydration for instant offline viewing
  useCacheFirst<StudentDetail>(["child-detail", id], () =>
    offlineCache.getQuery<StudentDetail>(`child_detail_${id}`)
  );

  const student = data?.student;

  const handleCopyId = async () => {
    if (!student?.eotcUid) return;
    await copyToClipboard(student.eotcUid, "የልጁ መለያ ቁጥር");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCallPhone = () => {
    if (student?.phone) {
      Linking.openURL(`tel:${student.phone}`).catch(() => {});
    }
  };

  const handleSendEmail = () => {
    if (student?.email) {
      Linking.openURL(`mailto:${student.email}`).catch(() => {});
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/children" as any);
    }
  };

  if (isLoading && !student) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={THEME.colors.sacredAmber} />
        <Text style={styles.loadingText}>የመንፈሳዊ ልጁን መረጃ በመጫን ላይ...</Text>
      </View>
    );
  }

  if (error || !student) {
    return (
      <View style={styles.centerContainer}>
        <Shield color={THEME.colors.sacredCrimson} size={48} />
        <Text style={styles.errorTitle}>ልጁ አልተገኘም</Text>
        <Text style={styles.errorSubtitle}>
          የተጠየቀው መንፈሳዊ ልጅ መረጃ በሲስተሙ ውስጥ አልተገኘም።
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>ወደ መንጋዬ ተመለስ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isClaimed = Boolean(student.accountClaimed);
  const birthDateStr = student.birthDate
    ? `${student.birthDate.day}/${student.birthDate.month}/${student.birthDate.year} ዓ.ም`
    : "ያልተገለጸ";

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={20} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>የልጁ መረጃ</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sacred Header Card */}
        <View style={styles.headerCard}>
          {/* Avatar with Golden Halo Ring */}
          <View style={styles.avatarHalo}>
            <View style={styles.avatarInner}>
              {student.photoUrl ? (
                <Image
                  source={{ uri: student.photoUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <User color={THEME.colors.sacredAmber} size={42} />
              )}
            </View>
          </View>

          {/* Names */}
          <Text style={styles.secularName}>
            {student.secularName || student.fullName || "ስም ያልተገለጸ"}
          </Text>
          <Text style={styles.christianName}>
            {student.christianName || "የክርስትና ስም የለም"}
          </Text>

          {/* Title & Status Badges */}
          <View style={styles.badgeRow}>
            {student.spiritualTitle ? (
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>
                  {student.spiritualTitle}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.statusBadge,
                isClaimed ? styles.statusBadgeActive : styles.statusBadgePending,
              ]}
            >
              {isClaimed ? (
                <CheckCircle2 color={THEME.colors.success} size={12} />
              ) : (
                <Clock color={THEME.colors.sacredAmber} size={12} />
              )}
              <Text
                style={[
                  styles.statusText,
                  isClaimed
                    ? styles.statusTextActive
                    : styles.statusTextPending,
                ]}
              >
                {isClaimed ? "የጸና አካውንት (ACTIVE)" : "በመጠባበቅ ላይ (PENDING)"}
              </Text>
            </View>
          </View>

          {/* EOTC UID Token Card with Copy */}
          <TouchableOpacity
            style={styles.eotcCard}
            onPress={handleCopyId}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.eotcLabel}>የቃል ኪዳን መለያ ቁጥር (EOTC ID)</Text>
              <Text style={styles.eotcValue}>{student.eotcUid}</Text>
            </View>
            <View style={styles.copyBtn}>
              <Copy
                color={
                  copied
                    ? THEME.colors.success
                    : THEME.colors.sacredAmber
                }
                size={16}
              />
              <Text
                style={[
                  styles.copyText,
                  copied && { color: THEME.colors.success },
                ]}
              >
                {copied ? "ተቀድቷል ✓" : "ቅዳ"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Pastoral Action Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/chat" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FEF2F2" }]}>
              <MessageSquare color={THEME.colors.sacredCrimson} size={20} />
            </View>
            <Text style={styles.actionLabel}>መልዕክት</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/appointments" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFFBEB" }]}>
              <Calendar color={THEME.colors.sacredAmber} size={20} />
            </View>
            <Text style={styles.actionLabel}>ቀጠሮ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/chat" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#EFF6FF" }]}>
              <Video color="#2563EB" size={20} />
            </View>
            <Text style={styles.actionLabel}>ቪዲዮ ጥሪ</Text>
          </TouchableOpacity>

          {student.phone ? (
            <TouchableOpacity style={styles.actionItem} onPress={handleCallPhone}>
              <View style={[styles.actionIconBox, { backgroundColor: "#F0FDF4" }]}>
                <Phone color={THEME.colors.success} size={20} />
              </View>
              <Text style={styles.actionLabel}>ስልክ</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Section 1: የማንነትና መንፈሳዊ መረጃ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <User color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የማንነትና መንፈሳዊ መረጃ</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የክርስትና ስም</Text>
              <Text style={[styles.dataValue, { color: THEME.colors.sacredAmber }]}>
                {student.christianName || "—"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የዓለም መጠሪያ ስም</Text>
              <Text style={styles.dataValue}>
                {student.secularName || student.fullName || "—"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>ጾታ</Text>
              <Text style={styles.dataValue}>
                {student.gender === "FEMALE" ? "ሴት" : "ወንድ"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የተወለዱበት ቀን (ዓ.ም)</Text>
              <Text style={styles.dataValue}>{birthDateStr}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>መንፈሳዊ ማዕረግ</Text>
              <Text style={styles.dataValue}>
                {student.spiritualTitle || "ምዕመን"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የአፍ መፍቻ ቋንቋ</Text>
              <Text style={styles.dataValue}>{student.language || "አማርኛ"}</Text>
            </View>
          </View>
        </View>

        {/* Section 2: የትምህርት መረጃ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <GraduationCap color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.sectionTitle}>የትምህርት መረጃ</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.dataPointFull}>
              <Text style={styles.dataLabel}>ዩኒቨርሲቲ</Text>
              <Text style={styles.dataValue}>
                {student.university || "ያልተገለጸ"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>ኮሌጅ / ኢንስቲትዩት</Text>
              <Text style={styles.dataValue}>{student.college || "—"}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የትምህርት ክፍል</Text>
              <Text style={styles.dataValue}>{student.department || "—"}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የመግቢያ ዓመት</Text>
              <Text style={styles.dataValue}>
                {student.entryYear ? `${student.entryYear} ዓ.ም` : "—"}
              </Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የትምህርት ቆይታ</Text>
              <Text style={styles.dataValue}>
                {student.programDuration
                  ? `${student.programDuration} ዓመታት`
                  : "4 ዓመታት"}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 3: የመገናኛና የመኖሪያ አድራሻ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MapPin color={THEME.colors.success} size={16} />
            <Text style={styles.sectionTitle}>የመገናኛና የመኖሪያ አድራሻ</Text>
          </View>
          <View style={styles.detailGrid}>
            {student.phone ? (
              <TouchableOpacity
                style={styles.dataPointFull}
                onPress={handleCallPhone}
              >
                <Text style={styles.dataLabel}>ስልክ ቁጥር (ንካ ለመደወል)</Text>
                <Text style={[styles.dataValue, { color: THEME.colors.success }]}>
                  {student.phone}
                </Text>
              </TouchableOpacity>
            ) : null}

            {student.email ? (
              <TouchableOpacity
                style={styles.dataPointFull}
                onPress={handleSendEmail}
              >
                <Text style={styles.dataLabel}>ኢሜይል አድራሻ (ንካ ለመላክ)</Text>
                <Text style={[styles.dataValue, { color: THEME.colors.sacredCrimson }]}>
                  {student.email}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>ክልል</Text>
              <Text style={styles.dataValue}>{student.region || "—"}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>ዞን</Text>
              <Text style={styles.dataValue}>{student.zone || "—"}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>ከተማ</Text>
              <Text style={styles.dataValue}>{student.city || "—"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: THEME.colors.inkMuted,
    fontWeight: "700",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    marginTop: 16,
  },
  errorSubtitle: {
    fontSize: 13,
    color: THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: THEME.colors.buttonDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: THEME.radii.pill,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    elevation: 2,
    shadowColor: THEME.colors.inkPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  avatarHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: THEME.colors.sacredAmber,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 78,
    height: 78,
  },
  secularName: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    textAlign: "center",
  },
  christianName: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    marginTop: 2,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  titleBadge: {
    backgroundColor: THEME.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
  },
  titleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.pill,
  },
  statusBadgeActive: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgePending: {
    backgroundColor: "#FEF08A",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusTextActive: {
    color: THEME.colors.success,
  },
  statusTextPending: {
    color: "#B45309",
  },
  eotcCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: THEME.colors.buttonDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radii.lg,
    marginTop: 16,
  },
  eotcLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  eotcValue: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "monospace",
    color: "#FFFFFF",
    letterSpacing: 2,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.md,
  },
  copyText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
  },
  actionsBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  actionItem: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  dataPoint: {
    width: "50%",
  },
  dataPointFull: {
    width: "100%",
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
    marginTop: 2,
  },
});
