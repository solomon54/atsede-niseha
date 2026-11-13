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
import { Calendar, Plus, X, Clock, MapPin, CheckCircle, XCircle } from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { offlineCache } from "../../src/lib/cache";

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

  // 1. Query Appointments (Read cache, then sync with API)
  const { data, isLoading, refetch, isRefetching } = useQuery<AppointmentsResponse>({
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

  // 3. Update Status Mutation (Confirm / Cancel / Complete)
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
        return { label: "የተረጋገጠ", bg: "#065F46", text: "#6EE7B7" };
      case "COMPLETED":
        return { label: "የተጠናቀቀ", bg: "#1E293B", text: "#94A3B8" };
      case "CANCELLED":
        return { label: "የተሰረዘ", bg: "#7F1D1D", text: "#FCA5A5" };
      default:
        return { label: "በመጠባበቅ ላይ", bg: "#78350F", text: "#FCD34D" };
    }
  };

  const getTypeLabel = (t: AppointmentType) => {
    return t === "NISEHA" ? "የንስሐ ቀጠሮ" : "የመንፈሳዊ ምክር ቀጠሮ";
  };

  const formatSchedule = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("am-ET", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const appointmentsList = data?.appointments || [];

  return (
    <View style={styles.container}>
      {/* Header Info for Student */}
      {role === "STUDENT" && data?.fatherName && (
        <View style={styles.fatherBanner}>
          <Text style={styles.fatherBannerText}>
            የንስሐ አባት፡ <Text style={styles.bold}>{data.fatherName}</Text>
          </Text>
        </View>
      )}

      {/* Appointment List */}
      <FlatList
        data={appointmentsList}
        keyExtractor={(item: Appointment) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#D97706"
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Calendar color="#64748B" size={48} />
              <Text style={styles.emptyTitle}>ምንም ቀጠሮ አልተገኘም</Text>
              <Text style={styles.emptySubtitle}>
                {role === "STUDENT"
                  ? "ከታች ያለውን ቁልፍ በመንካት አዲስ ቀጠሮ መጠየቅ ይችላሉ።"
                  : "በአሁኑ ወቅት የቀረበ የቀጠሮ ጥያቄ የለም።"}
              </Text>
            </View>
          ) : (
            <ActivityIndicator color="#D97706" style={{ marginTop: 40 }} />
          )
        }
        renderItem={({ item }: { item: Appointment }) => {
          const badge = getStatusBadge(item.status);
          const isPending = item.status === "REQUESTED";
          const isConfirmed = item.status === "CONFIRMED";
          const isActing = actionLoadingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.typeTag}>{getTypeLabel(item.type)}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              {role === "FATHER" && item.childName && (
                <Text style={styles.personName}>
                  የንስሐ ልጅ፡ {item.childName}{" "}
                  {item.childEotcUid ? `(${item.childEotcUid})` : ""}
                </Text>
              )}

              <View style={styles.detailRow}>
                <Clock color="#94A3B8" size={15} />
                <Text style={styles.detailText}>
                  {formatSchedule(item.scheduledAt)}
                </Text>
              </View>

              {item.location && (
                <View style={styles.detailRow}>
                  <MapPin color="#94A3B8" size={15} />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
              )}

              {item.message && (
                <Text style={styles.messageText}>« {item.message} »</Text>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {role === "FATHER" && isPending && (
                  <>
                    <TouchableOpacity
                      style={[styles.btn, styles.confirmBtn]}
                      onPress={() => updateStatus(item.id, "CONFIRMED")}
                      disabled={isActing}
                    >
                      <CheckCircle color="#FFFFFF" size={15} />
                      <Text style={styles.btnText}>አረጋግጥ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.cancelBtn]}
                      onPress={() => updateStatus(item.id, "CANCELLED")}
                      disabled={isActing}
                    >
                      <XCircle color="#FCA5A5" size={15} />
                      <Text style={[styles.btnText, { color: "#FCA5A5" }]}>
                        ሰርዝ
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {role === "FATHER" && isConfirmed && (
                  <TouchableOpacity
                    style={[styles.btn, styles.completeBtn]}
                    onPress={() => updateStatus(item.id, "COMPLETED")}
                    disabled={isActing}
                  >
                    <CheckCircle color="#FFFFFF" size={15} />
                    <Text style={styles.btnText}>እንደተጠናቀቀ ምልክት አድርግ</Text>
                  </TouchableOpacity>
                )}

                {role === "STUDENT" && isPending && (
                  <TouchableOpacity
                    style={[styles.btn, styles.cancelBtn]}
                    onPress={() => updateStatus(item.id, "CANCELLED")}
                    disabled={isActing}
                  >
                    <XCircle color="#FCA5A5" size={15} />
                    <Text style={[styles.btnText, { color: "#FCA5A5" }]}>
                      ጥያቄውን ሰርዝ
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Student Request FAB */}
      {role === "STUDENT" && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Plus color="#FFFFFF" size={24} />
          <Text style={styles.fabText}>ቀጠሮ ጠይቅ</Text>
        </TouchableOpacity>
      )}

      {/* Request Appointment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>አዲስ ቀጠሮ መጠየቂያ</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#94A3B8" size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Type Selection */}
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

              {/* Date Input */}
              <Text style={styles.formLabel}>የቀጠሮ ቀን (ዓ.ም / እ.ኤ.አ)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="ምሳሌ፡ 2026-11-25"
                placeholderTextColor="#64748B"
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />

              {/* Time Input */}
              <Text style={styles.formLabel}>ሰዓት (አማራጭ)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="ምሳሌ፡ 14:30"
                placeholderTextColor="#64748B"
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />

              {/* Location Input */}
              <Text style={styles.formLabel}>ቦታ</Text>
              <TextInput
                style={styles.formInput}
                placeholder="በአካል (በቤተክርስቲያን) ወይም በቪዲዮ ጥሪ"
                placeholderTextColor="#64748B"
                value={location}
                onChangeText={setLocation}
              />

              {/* Logistics Note */}
              <Text style={styles.formLabel}>
                ማስታወሻ (የሰዓት ወይም የቦታ ማብራሪያ ብቻ)
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="አጭር መልእክት ያስገቡ..."
                placeholderTextColor="#64748B"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreate}
                disabled={createMutation.isPending}
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
    backgroundColor: "#0B1120",
  },
  fatherBanner: {
    backgroundColor: "#1E293B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  fatherBannerText: {
    color: "#CBD5E1",
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
    color: "#D97706",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeTag: {
    color: "#D97706",
    fontSize: 15,
    fontWeight: "700",
  },
  personName: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  detailText: {
    color: "#CBD5E1",
    fontSize: 13,
  },
  messageText: {
    color: "#94A3B8",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#475569",
    paddingLeft: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  confirmBtn: {
    backgroundColor: "#059669",
  },
  completeBtn: {
    backgroundColor: "#2563EB",
  },
  cancelBtn: {
    backgroundColor: "#450A0A",
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
  },
  formLabel: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  typeBtnActive: {
    borderColor: "#D97706",
    backgroundColor: "#78350F",
  },
  typeBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  typeBtnTextActive: {
    color: "#FFFFFF",
  },
  formInput: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: "#D97706",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
    marginBottom: 30,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
