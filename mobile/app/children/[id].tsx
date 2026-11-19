// mobile/app/children/[id].tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Edit3,
  GraduationCap,
  Landmark,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  User,
  Video,
  X,
  Zap,
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
import { academicProgressFromEntry } from "@shared/utils/calendar/ethiopianCalendar";

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
  diocese?: string;
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
  const { role } = useAuth();
  const isFather = role === "FATHER";
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [isResolvingChannel, setIsResolvingChannel] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit form state
  const [editSecularName, setEditSecularName] = useState("");
  const [editChristianName, setEditChristianName] = useState("");
  const [editSpiritualTitle, setEditSpiritualTitle] = useState("");
  const [editGender, setEditGender] = useState<"MALE" | "FEMALE">("MALE");
  const [editLanguage, setEditLanguage] = useState("");
  const [editUniversity, setEditUniversity] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editEntryYear, setEditEntryYear] = useState("");
  const [editProgramDuration, setEditProgramDuration] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDiocese, setEditDiocese] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

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

  // Safe hardware back handling on Android
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/children" as any);
    }
  };

  // Populate edit state when opening edit modal
  const openEditModal = () => {
    if (!student) return;
    setEditSecularName(student.secularName || student.fullName || "");
    setEditChristianName(student.christianName || "");
    setEditSpiritualTitle(student.spiritualTitle || "");
    setEditGender(student.gender || "MALE");
    setEditLanguage(student.language || "አማርኛ");
    setEditUniversity(student.university || "");
    setEditCollege(student.college || "");
    setEditDepartment(student.department || "");
    setEditEntryYear(student.entryYear ? String(student.entryYear) : "");
    setEditProgramDuration(
      student.programDuration ? String(student.programDuration) : "4"
    );
    setEditRegion(student.region || "");
    setEditZone(student.zone || "");
    setEditCity(student.city || "");
    setEditDiocese(student.diocese || "");
    setEditPhone(student.phone || "");
    setEditEmail(student.email || "");
    setEditModalVisible(true);
  };

  // Profile Edit Mutation
  const editMutation = useMutation({
    mutationFn: async (payload: Partial<StudentDetail>) => {
      return await apiRequest(`/api/father/children/${student?.eotcUid || id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      Alert.alert("ተሳክቷል", "የልጁ መረጃ በተሳካ ሁኔታ ተሻሽሏል");
      setEditModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["child-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["father-children"] });
    },
    onError: (err: any) => {
      Alert.alert("ስህተት", err.message || "መረጃውን ማሻሻል አልተቻለም");
    },
  });

  const handleSaveEdit = () => {
    if (!editSecularName.trim()) {
      Alert.alert("ማሳሰቢያ", "እባክዎ የዓለም መጠሪያ ስም ያስገቡ");
      return;
    }

    const payload: any = {
      secularName: editSecularName.trim(),
      christianName: editChristianName.trim() || undefined,
      spiritualTitle: editSpiritualTitle.trim() || undefined,
      gender: editGender,
      language: editLanguage.trim() || undefined,
      university: editUniversity.trim() || undefined,
      college: editCollege.trim() || undefined,
      department: editDepartment.trim() || undefined,
      entryYear: editEntryYear ? parseInt(editEntryYear, 10) : undefined,
      programDuration: editProgramDuration
        ? parseInt(editProgramDuration, 10)
        : 4,
      region: editRegion.trim() || undefined,
      zone: editZone.trim() || undefined,
      city: editCity.trim() || undefined,
      diocese: editDiocese.trim() || undefined,
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
    };

    editMutation.mutate(payload);
  };

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

  // Direct Message targeting this exact child
  const handleMessage = async () => {
    if (!student) return;
    if (!student.accountClaimed || !student.uid) {
      showUnclaimedAccountNotice(student);
      return;
    }
    setIsResolvingChannel(true);
    try {
      const channelId = await resolveChildDirectChannel(student);
      if (channelId) {
        router.push(`/chat/${channelId}` as any);
      } else {
        Alert.alert(
          "መልዕክት መክፈት አልተቻለም",
          "ከዚህ መንፈሳዊ ልጅ ጋር ቀጥታ የውይይት መስመር አልተገኘም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።"
        );
      }
    } finally {
      setIsResolvingChannel(false);
    }
  };

  // Direct Video Call targeting this exact child
  const handleVideoCall = async () => {
    if (!student) return;
    if (!student.accountClaimed || !student.uid) {
      showUnclaimedAccountNotice(student);
      return;
    }
    setIsResolvingChannel(true);
    try {
      const channelId = await resolveChildDirectChannel(student);
      if (channelId) {
        router.push(`/call/${channelId}` as any);
      } else {
        Alert.alert(
          "ቪዲዮ ጥሪ መጀመር አልተቻለም",
          "ከዚህ መንፈሳዊ ልጅ ጋር የቪዲዮ ጥሪ መስመር አልተገኘም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።"
        );
      }
    } finally {
      setIsResolvingChannel(false);
    }
  };

  // Direct Appointment targeting this exact child
  const handleAppointment = () => {
    if (!student) return;
    if (!student.accountClaimed || !student.uid) {
      showUnclaimedAccountNotice(student);
      return;
    }
    router.push({
      pathname: "/(tabs)/appointments" as any,
      params: {
        child: student.uid,
      },
    });
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

  // Academic Progress Calculation (100% Web Parity)
  const progress = academicProgressFromEntry(
    student.entryYear ?? 0,
    student.programDuration ?? 4,
    student.gender ?? "MALE"
  );

  // Graduation Year Calculation (100% Web Parity)
  const graduationYear =
    student.entryYear && student.programDuration
      ? student.entryYear + student.programDuration
      : student.entryYear
      ? student.entryYear + 4
      : null;

  // Joined Date Formatted
  const joinedDateStr = student.createdAt
    ? new Date(student.createdAt).toLocaleDateString("am-ET", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={18} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>የልጁ መረጃ</Text>
        {isFather ? (
          <TouchableOpacity
            style={styles.navEditBtn}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <Edit3 color={THEME.colors.sacredAmber} size={15} />
            <Text style={styles.navEditText}>አርትዕ</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sacred Header Card */}
        <View style={styles.headerCard}>
          {/* Avatar with Halo Ring */}
          <View style={styles.avatarHalo}>
            <View style={styles.avatarInner}>
              {student.photoUrl ? (
                <Image
                  source={{ uri: student.photoUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <User color={THEME.colors.sacredAmber} size={40} />
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
                size={14}
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

        {/* Quick Pastoral Action Bar — Exact Child Targeted */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionItem, isResolvingChannel && { opacity: 0.7 }]}
            onPress={handleMessage}
            disabled={isResolvingChannel}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FEF2F2" }]}>
              {isResolvingChannel ? (
                <ActivityIndicator size="small" color={THEME.colors.sacredCrimson} />
              ) : (
                <MessageSquare color={THEME.colors.sacredCrimson} size={18} />
              )}
            </View>
            <Text style={styles.actionLabel}>መልዕክት</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleAppointment}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFFBEB" }]}>
              <Calendar color={THEME.colors.sacredAmber} size={18} />
            </View>
            <Text style={styles.actionLabel}>ቀጠሮ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, isResolvingChannel && { opacity: 0.7 }]}
            onPress={handleVideoCall}
            disabled={isResolvingChannel}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#EFF6FF" }]}>
              <Video color="#2563EB" size={18} />
            </View>
            <Text style={[styles.actionLabel, { color: "#2563EB" }]}>ቪዲዮ ጥሪ</Text>
          </TouchableOpacity>

          {student.phone ? (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleCallPhone}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#F0FDF4" }]}>
                <Phone color={THEME.colors.success} size={18} />
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

        {/* Section 2: የትምህርት መረጃ (Includes Graduation Year & Live Standing) */}
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
              <Text style={styles.dataLabel}>ኮሌጅ / ፋኩልቲ</Text>
              <Text style={styles.dataValue}>{student.college || "—"}</Text>
            </View>
            <View style={styles.dataPoint}>
              <Text style={styles.dataLabel}>የትምህርት ክፍል (ዲፓርትመንት)</Text>
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
            {graduationYear ? (
              <View style={styles.dataPoint}>
                <Text style={styles.dataLabel}>የምረቃ ዓመት</Text>
                <Text style={[styles.dataValue, { color: THEME.colors.success }]}>
                  {`${graduationYear} ዓ.ም`}
                </Text>
              </View>
            ) : null}

            {/* Current Academic Standing Banner (Web Parity) */}
            {student.entryYear ? (
              <View
                style={[
                  styles.standingBanner,
                  progress.graduated
                    ? styles.standingGraduated
                    : progress.onBreak
                    ? styles.standingBreak
                    : styles.standingActive,
                ]}
              >
                <Text style={styles.standingIcon}>
                  {progress.graduated ? "🎓" : progress.onBreak ? "☀️" : "📚"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.standingTitle}>{progress.label}</Text>
                  <Text style={styles.standingSub}>
                    ወቅታዊ ደረጃ — ከመዝገቡ ቀን ራሱ ይሰላል
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Section 3: የመገናኛና የመኖሪያ አድራሻ (Includes Diocese) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MapPin color={THEME.colors.success} size={16} />
            <Text style={styles.sectionTitle}>የመገናኛና የመኖሪያ አድራሻ</Text>
          </View>
          <View style={styles.detailGrid}>
            {student.diocese ? (
              <View style={styles.dataPointFull}>
                <Text style={styles.dataLabel}>ሀገረ ስብከት</Text>
                <Text style={[styles.dataValue, { color: THEME.colors.sacredCrimson }]}>
                  {student.diocese}
                </Text>
              </View>
            ) : null}

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
            {joinedDateStr ? (
              <View style={styles.dataPoint}>
                <Text style={styles.dataLabel}>የተመዘገቡበት ቀን</Text>
                <Text style={styles.dataValue}>{joinedDateStr}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal (Father-Only, 100% Web Parity) */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>የልጁን መረጃ አርትዕ</Text>
                <Text style={styles.modalSubTitle}>
                  {student.secularName || student.fullName} ({student.eotcUid})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={8}
              >
                <X color={THEME.colors.inkMuted} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.editModalScroll}>
              {/* Identity Section */}
              <Text style={styles.formSectionHeader}>1. የማንነት መረጃ</Text>
              <Text style={styles.inputLabel}>የዓለም መጠሪያ ስም *</Text>
              <TextInput
                style={styles.modalInput}
                value={editSecularName}
                onChangeText={setEditSecularName}
                placeholder="ሙሉ ስም ያስገቡ"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <Text style={styles.inputLabel}>የክርስትና ስም</Text>
              <TextInput
                style={styles.modalInput}
                value={editChristianName}
                onChangeText={setEditChristianName}
                placeholder="የክርስትና ስም"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <Text style={styles.inputLabel}>መንፈሳዊ ማዕረግ</Text>
              <TextInput
                style={styles.modalInput}
                value={editSpiritualTitle}
                onChangeText={setEditSpiritualTitle}
                placeholder="ምሳሌ፡ ዲያቆን፣ መሪጌታ፣ ምዕመን"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              {/* Gender selector */}
              <Text style={styles.inputLabel}>ጾታ</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[
                    styles.genderBtn,
                    editGender === "MALE" && styles.genderBtnActive,
                  ]}
                  onPress={() => setEditGender("MALE")}
                >
                  <Text
                    style={[
                      styles.genderBtnText,
                      editGender === "MALE" && styles.genderBtnTextActive,
                    ]}
                  >
                    ወንድ
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderBtn,
                    editGender === "FEMALE" && styles.genderBtnActive,
                  ]}
                  onPress={() => setEditGender("FEMALE")}
                >
                  <Text
                    style={[
                      styles.genderBtnText,
                      editGender === "FEMALE" && styles.genderBtnTextActive,
                    ]}
                  >
                    ሴት
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>የአፍ መፍቻ ቋንቋ</Text>
              <TextInput
                style={styles.modalInput}
                value={editLanguage}
                onChangeText={setEditLanguage}
                placeholder="ምሳሌ፡ አማርኛ፣ ኦሮምኛ፣ ትግርኛ"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              {/* Academic Section */}
              <Text style={styles.formSectionHeader}>2. የትምህርት መረጃ</Text>
              <Text style={styles.inputLabel}>ዩኒቨርሲቲ</Text>
              <TextInput
                style={styles.modalInput}
                value={editUniversity}
                onChangeText={setEditUniversity}
                placeholder="ዩኒቨርሲቲ ያስገቡ"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <Text style={styles.inputLabel}>ኮሌጅ / ፋኩልቲ</Text>
              <TextInput
                style={styles.modalInput}
                value={editCollege}
                onChangeText={setEditCollege}
                placeholder="ኮሌጅ"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <Text style={styles.inputLabel}>የትምህርት ክፍል (ዲፓርትመንት)</Text>
              <TextInput
                style={styles.modalInput}
                value={editDepartment}
                onChangeText={setEditDepartment}
                placeholder="ዲፓርትመንት"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>የመግቢያ ዓ.ም</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editEntryYear}
                    onChangeText={setEditEntryYear}
                    placeholder="ምሳሌ፡ 2014"
                    keyboardType="numeric"
                    placeholderTextColor={THEME.colors.inkSubtle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>የቆይታ ዓመታት</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editProgramDuration}
                    onChangeText={setEditProgramDuration}
                    placeholder="ምሳሌ፡ 4 ወይም 5"
                    keyboardType="numeric"
                    placeholderTextColor={THEME.colors.inkSubtle}
                  />
                </View>
              </View>

              {/* Geography Section */}
              <Text style={styles.formSectionHeader}>3. አድራሻና ሀገረ ስብከት</Text>
              <Text style={styles.inputLabel}>ሀገረ ስብከት</Text>
              <TextInput
                style={styles.modalInput}
                value={editDiocese}
                onChangeText={setEditDiocese}
                placeholder="ምሳሌ፡ አዲስ አበባ ሀገረ ስብከት"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ክልል</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editRegion}
                    onChangeText={setEditRegion}
                    placeholder="ክልል"
                    placeholderTextColor={THEME.colors.inkSubtle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ዞን</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editZone}
                    onChangeText={setEditZone}
                    placeholder="ዞን"
                    placeholderTextColor={THEME.colors.inkSubtle}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>ከተማ</Text>
              <TextInput
                style={styles.modalInput}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="ከተማ"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              {/* Contact Section */}
              <Text style={styles.formSectionHeader}>4. የመገናኛ መረጃ</Text>
              <Text style={styles.inputLabel}>ስልክ ቁጥር</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="0911223344"
                keyboardType="phone-pad"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <Text style={styles.inputLabel}>ኢሜይል አድራሻ</Text>
              <TextInput
                style={styles.modalInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="student@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={THEME.colors.inkSubtle}
              />

              <View style={{ height: 30 }} />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>ሰርዝ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  editMutation.isPending && { opacity: 0.7 },
                ]}
                onPress={handleSaveEdit}
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>አስቀምጥ</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  navEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.pill,
  },
  navEditText: {
    fontSize: 11,
    fontWeight: "800",
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
  },
  avatarHalo: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: THEME.colors.sacredAmber,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 76,
    height: 76,
  },
  secularName: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    textAlign: "center",
  },
  christianName: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    marginTop: 2,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
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
    fontSize: 9.5,
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
    marginTop: 14,
  },
  eotcLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  eotcValue: {
    fontSize: 13.5,
    fontWeight: "900",
    fontFamily: "monospace",
    color: "#FFFFFF",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: THEME.radii.md,
  },
  copyText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
  },
  actionsBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  actionItem: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  actionLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  dataPoint: {
    width: "50%",
  },
  dataPointFull: {
    width: "100%",
  },
  dataLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dataValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
    marginTop: 2,
  },
  standingBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
  },
  standingGraduated: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  standingBreak: {
    backgroundColor: "#F0F9FF",
    borderColor: "#E0F2FE",
  },
  standingActive: {
    backgroundColor: "#FEFCE8",
    borderColor: "#FEF08A",
  },
  standingIcon: {
    fontSize: 22,
  },
  standingTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  standingSub: {
    fontSize: 9,
    color: THEME.colors.inkMuted,
    marginTop: 1,
  },

  /* Edit Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  editModalContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  modalSubTitle: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  editModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  formSectionHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    marginTop: 10,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
    marginBottom: 4,
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    backgroundColor: THEME.colors.surfaceAlt,
  },
  genderBtnActive: {
    backgroundColor: THEME.colors.sacredCrimsonLight,
    borderColor: THEME.colors.sacredCrimson,
  },
  genderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  genderBtnTextActive: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "900",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: THEME.colors.surfaceAlt,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkMuted,
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: THEME.colors.sacredCrimson,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
