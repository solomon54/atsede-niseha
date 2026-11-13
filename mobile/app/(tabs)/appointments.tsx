import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  X,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  User,
} from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";
import { THEME } from "../../src/constants/theme";

type AppointmentType = "NISEHA" | "COUNSELING";
type AppointmentStatus = "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

interface Appointment {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string;
  location?: string;
  message?: string;
  fatherName?: string;
  childName?: string;
  childEotcUid?: string;
  createdByRole?: string;
}

interface AppointmentsResponse {
  success: boolean;
  appointments: Appointment[];
  fatherName?: string;
  fatherEotcUid?: string;
}

export default function AppointmentsScreen() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentType>("NISEHA");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [location, setLocation] = useState("በአካል (በቤተክርስቲያን)");
  const [note, setNote] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 1. Query Appointments
  const { data, isLoading, refetch, isRefetching } =
    useQuery<AppointmentsResponse>({
      queryKey: ["appointments"],
      queryFn: async () => {
        const res = await apiRequest<AppointmentsResponse>("/api/appointments");
        if (res?.appointments) {
          offlineCache.saveAppointments(res.appointments);
        }
        return res;
      },
    });

  React.useEffect(() => {
    async function hydrateFromSqlite() {
      const cached = await offlineCache.getAppointments<Appointment>();
      if (cached.length > 0 && !data) {
        queryClient.setQueryData(["appointments"], {
          success: true,
          appointments: cached,
        });
      }
    }
    hydrateFromSqlite();
  }, [queryClient, data]);

  // 2. Create Appointment Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      type: AppointmentType;
      scheduledAt: string;
      location?: string;
      message?: string;
    }) => {
      return await apiRequest("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setModalVisible(false);
      resetForm();
    },
    onError: (err: any) => {
      Alert.alert("ስህተት", err.message || "ቀጠሮውን መመዝገብ አልተቻለም");
    },
  });

  // 3. Update Status Mutation
  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setActionLoadingId(id);
    try {
      await apiRequest(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err: any) {
      Alert.alert("ስህተት", err.message || "ሁኔታውን መቀየር አልተቻለም");
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetForm = () => {
    setSelectedType("NISEHA");
    setScheduledDate("");
    setScheduledTime("");
    setLocation("በአካል (በቤተክርስቲያን)");
    setNote("");
  };

  const handleCreate = () => {
    if (!scheduledDate.trim()) {
      Alert.alert("ማሳሰቢያ", "እባክዎ የቀጠሮ ቀን ያስገቡ (ምሳሌ፡ 2026-11-20)");
      return;
    }
    const combinedDatetime = scheduledTime.trim()
      ? `${scheduledDate.trim()}T${scheduledTime.trim()}:00`
      : `${scheduledDate.trim()}T10:00:00`;

    createMutation.mutate({
      type: selectedType,
      scheduledAt: combinedDatetime,
      location: location.trim() || undefined,
      message: note.trim() || undefined,
    });
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "CONFIRMED":
        return {
          label: "የተረጋገጠ",
          bg: THEME.colors.successBg,
          text: THEME.colors.success,
        };
      case "COMPLETED":
        return { label: "የተጠናቀቀ", bg: "#F1F5F9", text: "#64748B" };
      case "REQUESTED":
        return {
          label: "በመጠባበቅ ላይ",
          bg: THEME.colors.amberLight,
          text: THEME.colors.sacredAmber,
        };
      case "CANCELLED":
        return {
          label: "የተሰረዘ",
          bg: THEME.colors.errorBg,
          text: THEME.colors.error,
        };
      default:
        return { label: status, bg: "#F1F5F9", text: "#64748B" };
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return (
        d.toLocaleDateString("am-ET", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) +
        " " +
        d.toLocaleTimeString("am-ET", { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return iso;
    }
  };

  const appointments = data?.appointments || [];

  return (
    <View style={styles.container}>
      {/* Father Banner for Students */}
      {data?.fatherName && role === "STUDENT" && (
        <View style={styles.fatherBanner}>
          <Text style={styles.fatherBannerText}>
            የንስሐ አባትዎ፡{" "}
            <Text style={styles.bold}>{data.fatherName}</Text>
          </Text>
        </View>
      )}

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={THEME.colors.sacredAmber}
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Calendar color={THEME.colors.sacredAmber} size={36} />
              </View>
              <Text style={styles.emptyTitle}>ምንም የተቀጠረ ቀጠሮ የለም</Text>
              <Text style={styles.emptySubtitle}>
                ለቃል ንስሐ ወይም ለመንፈሳዊ ምክክር አዲስ ቀጠሮ እዚህ መመዝገብ ይችላሉ።
              </Text>
            </View>
          ) : (
            <ActivityIndicator
              color={THEME.colors.sacredAmber}
              style={{ marginTop: 40 }}
            />
          )
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const isPending = item.status === "REQUESTED";
          const isConfirmed = item.status === "CONFIRMED";
          const isFather = role === "FATHER";
          const isLoadingAction = actionLoadingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.typeTag}>
                  {item.type === "NISEHA" ? "የንስሐ ቀጠሮ" : "የምክክር ቀጠሮ"}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              {item.childName && isFather && (
                <View style={styles.detailRow}>
                  <User color={THEME.colors.inkSubtle} size={15} />
                  <Text style={styles.personName}>
                    {item.childName}{" "}
                    {item.childEotcUid ? `(${item.childEotcUid})` : ""}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Clock color={THEME.colors.sacredAmber} size={15} />
                <Text style={styles.detailText}>
                  {formatDateTime(item.scheduledAt)}
                </Text>
              </View>

              {item.location ? (
                <View style={styles.detailRow}>
                  <MapPin color={THEME.colors.inkSubtle} size={15} />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
              ) : null}

              {item.message ? (
                <Text style={styles.messageText}>"{item.message}"</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {isFather && isPending && (
                  <TouchableOpacity
                    style={[styles.btn, styles.confirmBtn]}
                    onPress={() => updateStatus(item.id, "CONFIRMED")}
                    disabled={isLoadingAction}
                  >
                    <CheckCircle color="#FFFFFF" size={15} />
                    <Text style={styles.btnText}>አረጋግጥ</Text>
                  </TouchableOpacity>
                )}

                {isFather && isConfirmed && (
                  <TouchableOpacity
                    style={[styles.btn, styles.completeBtn]}
                    onPress={() => updateStatus(item.id, "COMPLETED")}
                    disabled={isLoadingAction}
                  >
                    <CheckCircle color="#FFFFFF" size={15} />
                    <Text style={styles.btnText}>ተፈጽሟል</Text>
                  </TouchableOpacity>
                )}

                {(isPending || isConfirmed) && (
                  <TouchableOpacity
                    style={[styles.btn, styles.cancelBtn]}
                    onPress={() => updateStatus(item.id, "CANCELLED")}
                    disabled={isLoadingAction}
                  >
                    <XCircle color={THEME.colors.error} size={15} />
                    <Text style={styles.cancelBtnText}>ሰርዝ</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Plus color="#FFFFFF" size={18} />
        <Text style={styles.fabText}>አዲስ ቀጠሮ</Text>
      </TouchableOpacity>

      {/* Modal: New Appointment */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>አዲስ ቀጠሮ መመዝገቢያ</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X color={THEME.colors.inkMuted} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>የቀጠሮ ዓይነት</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    selectedType === "NISEHA" && styles.typeBtnActive,
                  ]}
                  onPress={() => setSelectedType("NISEHA")}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      selectedType === "NISEHA" && styles.typeBtnTextActive,
                    ]}
                  >
                    የንስሐ ቀጠሮ
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    selectedType === "COUNSELING" && styles.typeBtnActive,
                  ]}
                  onPress={() => setSelectedType("COUNSELING")}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      selectedType === "COUNSELING" && styles.typeBtnTextActive,
                    ]}
                  >
                    የምክር ቀጠሮ
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>ቀን (ዓ.ም / ምሳሌ፡ 2026-11-20)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="2026-11-20"
                placeholderTextColor={THEME.colors.inkSubtle}
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />

              <Text style={styles.formLabel}>ሰዓት (ምሳሌ፡ 10:00)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="10:00"
                placeholderTextColor={THEME.colors.inkSubtle}
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />

              <Text style={styles.formLabel}>ቦታ</Text>
              <TextInput
                style={styles.formInput}
                placeholder="በአካል (በቤተክርስቲያን)"
                placeholderTextColor={THEME.colors.inkSubtle}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={styles.formLabel}>ማስታወሻ / መልእክት</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="ለአባትዎ ማስታወሻ ያስቀምጡ..."
                placeholderTextColor={THEME.colors.inkSubtle}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreate}
                disabled={createMutation.isPending}
                activeOpacity={0.85}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>የቀጠሮ ጥያቄውን ላክ</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  fatherBanner: {
    backgroundColor: THEME.colors.navigationBg,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.sacredCrimsonBorder,
  },
  fatherBannerText: {
    color: THEME.colors.inkSecondary,
    fontSize: 13,
  },
  bold: {
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeTag: {
    color: THEME.colors.sacredCrimson,
    fontSize: 15,
    fontWeight: "800",
  },
  personName: {
    color: THEME.colors.inkPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  detailText: {
    color: THEME.colors.inkSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  messageText: {
    color: THEME.colors.inkMuted,
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: THEME.colors.amberBorder,
    paddingLeft: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.radii.md,
  },
  confirmBtn: {
    backgroundColor: THEME.colors.success,
  },
  completeBtn: {
    backgroundColor: THEME.colors.buttonDark,
  },
  cancelBtn: {
    backgroundColor: THEME.colors.errorBg,
    borderWidth: 1,
    borderColor: THEME.colors.errorBorder,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelBtnText: {
    color: THEME.colors.error,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.amberLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: THEME.colors.inkPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    color: THEME.colors.inkSubtle,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: THEME.colors.sacredCrimson,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    ...THEME.shadows.button,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "85%",
    ...THEME.shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    color: THEME.colors.inkPrimary,
    fontSize: 17,
    fontWeight: "900",
  },
  formLabel: {
    color: THEME.colors.inkSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
  },
  typeBtnActive: {
    borderColor: THEME.colors.sacredAmber,
    backgroundColor: THEME.colors.amberLight,
  },
  typeBtnText: {
    color: THEME.colors.inkMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  typeBtnTextActive: {
    color: THEME.colors.sacredAmber,
  },
  formInput: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    color: THEME.colors.inkPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    height: 76,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
    ...THEME.shadows.button,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
