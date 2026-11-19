import NetInfo from "@react-native-community/netinfo";
import {
  applyFatherAppointmentEligibility,
  type AppointmentAction,
  type AppointmentActionPayload,
  type AppointmentChildDirectoryEntry,
  appointmentBackView,
  appointmentDetailRequestKey,
  type AppointmentDetailResponse,
  type AppointmentEvent,
  type AppointmentParticipant,
  type AppointmentRecord,
  type AppointmentRouteParams,
  type AppointmentStatus,
  type AppointmentType,
  type AppointmentViewState,
  buildChildAppointmentOverviews,
  detailErrorMessage,
  EMPTY_APPOINTMENT_SNAPSHOT,
  getAppointmentIdentityDisplay,
  getAvailableAppointmentActions,
  getChildDisplayName,
  getFatherDisplayName,
  getNowIso,
  isAppointmentParty,
  isConfirmedOverdue,
  isCurrentDetailRequest,
  isEligibleFatherChild,
  isOwnerCurrent,
  isUpcomingConfirmed,
  mergeAuthoritativeAppointmentSnapshot,
  normalizeAppointment,
  appointmentRouteParams,
  appointmentViewFromParams,
  resolveAppointmentDetailChildUid,
  selectAppointmentsForChild,
  selectFatherAppointmentOverviewPresentation,
  snapshotForOwner,
  type AppointmentSnapshot,
  type OwnedAppointmentSnapshot,
} from "@shared/domain/appointments";
import {
  APPOINTMENT_IDENTITY_ROLE_TERMS,
  formatAppointmentEvent,
  getAppointmentStatusLabel,
  getAppointmentTypeLabel,
  getQueuedActionLabel,
} from "@shared/domain/appointments/terminology";
import {
  ETHIOPIAN_MONTHS,
  type EthiopianClockTime,
  type EthiopianDate,
  ethiopianDateTimeToDate,
  formatEthiopianDateTimeInEAT,
  getEthiopianMonthDays,
  getTodayEthiopian,
  gregorianToEthiopian,
  westernToEthiopianClock,
} from "@shared/utils/calendar/ethiopianCalendar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { THEME } from "../../src/constants/theme";
import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import {
  appointmentSnapshotKey,
  offlineCache,
  type SQLiteAppointmentOutboxItem,
} from "../../src/lib/cache";
import { getMobilePusher } from "../../src/lib/pusher";
import { mobileSyncService } from "../../src/lib/sync";

type PropsRole = "FATHER" | "STUDENT";

type ViewState = AppointmentViewState;

type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  appointmentId?: string;
  createdAt?: string;
};

type Snapshot = AppointmentSnapshot;

function makeOperationId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function ethiopianFromIso(iso: string): { date: EthiopianDate; time: EthiopianClockTime } {
  const d = new Date(iso);
  const et = gregorianToEthiopian(d);
  const clock = westernToEthiopianClock(d);
  return {
    date: { year: et.year, month: et.month, day: et.day },
    time: {
      hour: clock.hour === 0 ? 12 : clock.hour,
      minute: clock.minute,
      period: clock.period,
      isNight: clock.isNight,
    },
  };
}

function defaultFutureTime(): EthiopianClockTime {
  return { hour: 3, minute: 0, period: "ከሰዓት", isNight: false };
}

function statusColors(status: AppointmentStatus) {
  switch (status) {
    case "REQUESTED":
      return { bg: THEME.colors.amberLight, text: THEME.colors.sacredAmber, border: THEME.colors.amberBorder };
    case "CONFIRMED":
      return { bg: THEME.colors.successBg, text: THEME.colors.success, border: "#A7F3D0" };
    case "DECLINED":
      return { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" };
    case "COMPLETED":
      return { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
    case "CANCELLED":
      return { bg: THEME.colors.errorBg, text: THEME.colors.error, border: THEME.colors.errorBorder };
  }
}

function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string; size?: number }) {
  const initial = (name || "?").trim().charAt(0) || "?";
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        accessibilityLabel={name}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E2E8F0" }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: THEME.colors.amberLight,
        borderWidth: 1,
        borderColor: THEME.colors.amberBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "900", color: THEME.colors.sacredCrimson, fontSize: Math.max(12, size * 0.4) }}>
        {initial}
      </Text>
    </View>
  );
}

function parseParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ child?: string; appointment?: string }>();
  const { role, uid } = useAuth();
  const actorRole = (role === "FATHER" ? "FATHER" : "STUDENT") as PropsRole;
  const ownerUid = uid || "";
  const ownerUidRef = useRef(ownerUid);
  ownerUidRef.current = ownerUid;

  const childParam = parseParam(params.child);
  const appointmentParam = parseParam(params.appointment);

  const view: ViewState = useMemo(
    () =>
      appointmentViewFromParams(
        { appointment: appointmentParam, child: childParam },
        actorRole
      ),
    [appointmentParam, childParam, actorRole]
  );

  // Read-only mirrors for handlers that must not become effect dependencies.
  const currentViewRef = useRef(view);
  currentViewRef.current = view;

  const [ownedSnapshot, setOwnedSnapshot] = useState<OwnedAppointmentSnapshot | null>(null);
  const snapshot = useMemo(
    () => snapshotForOwner(ownedSnapshot, ownerUid),
    [ownedSnapshot, ownerUid]
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const [outboxRows, setOutboxRows] = useState<SQLiteAppointmentOutboxItem[]>([]);

  const [showBell, setShowBell] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createChildUid, setCreateChildUid] = useState<string>("");

  // Detail
  const [detail, setDetail] = useState<AppointmentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Explicit refresh only; list/snapshot updates keep the detail key unchanged.
  const [detailRefreshNonce, setDetailRefreshNonce] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<EthiopianDate>(() => {
    const t = getTodayEthiopian();
    return { year: t.year, month: t.month, day: t.day };
  });
  const [rescheduleTime, setRescheduleTime] = useState<EthiopianClockTime>(defaultFutureTime());
  const [confirmAction, setConfirmAction] = useState<AppointmentAction | null>(null);

  // Create form
  const today = getTodayEthiopian();
  const [createType, setCreateType] = useState<AppointmentType>("NISEHA");
  const [createDate, setCreateDate] = useState<EthiopianDate>({ year: today.year, month: today.month, day: today.day });
  const [createTime, setCreateTime] = useState<EthiopianClockTime>(defaultFutureTime());
  const [createLocation, setCreateLocation] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const appointments = useMemo(() => snapshot.appointments || [], [snapshot.appointments]);
  const children = useMemo(() => snapshot.children || [], [snapshot.children]);
  const snapshotRef = useRef<Snapshot>(EMPTY_APPOINTMENT_SNAPSHOT);
  snapshotRef.current = snapshot;
  // The persisted mirror keeps every cached row, but is explicitly owned by
  // one account. A previous account's ref is never readable by a new owner.
  const fullSnapshotRef = useRef<OwnedAppointmentSnapshot | null>(null);
  if (fullSnapshotRef.current && fullSnapshotRef.current.ownerUid !== ownerUid) {
    fullSnapshotRef.current = null;
  }

  const refreshOutbox = useCallback(async () => {
    if (!ownerUid) return;
    const rows = await offlineCache.listAppointmentOutbox(ownerUid);
    setOutboxRows(rows);
  }, [ownerUid]);

  const writeSnapshot = useCallback(
    async (next: Snapshot) => {
      const capturedOwnerUid = ownerUid;
      if (!capturedOwnerUid) return;

      const cached =
        (await offlineCache.getAppointmentSnapshot<Snapshot>(capturedOwnerUid)) ||
        snapshotForOwner(fullSnapshotRef.current, capturedOwnerUid);

      // The merge returns null when a delayed response belongs to a previous
      // account, so it cannot populate the new account's snapshot.
      const merged = mergeAuthoritativeAppointmentSnapshot({
        capturedOwnerUid,
        currentOwnerUid: ownerUidRef.current,
        role: actorRole,
        cached,
        cachedOwnerUid: capturedOwnerUid,
        server: next,
      });
      if (!merged) return;

      fullSnapshotRef.current = {
        ownerUid: capturedOwnerUid,
        snapshot: merged.full,
      };
      setOwnedSnapshot({
        ownerUid: capturedOwnerUid,
        snapshot: merged.presentation,
      });
      await offlineCache.setAppointmentSnapshot(capturedOwnerUid, merged.full);
    },
    [ownerUid, actorRole]
  );

  const upsertAppointment = useCallback(
    async (recIn: AppointmentRecord) => {
      const capturedOwnerUid = ownerUid;
      if (
        !capturedOwnerUid ||
        !isOwnerCurrent(capturedOwnerUid, ownerUidRef.current)
      ) {
        return;
      }
      let rec = typeof recIn.identityConsistent === "boolean" ? recIn : normalizeAppointment(recIn);
      if (!isAppointmentParty(rec, capturedOwnerUid)) return;
      if (actorRole === "FATHER") {
        const eligible = applyFatherAppointmentEligibility({
          role: actorRole,
          children: snapshotRef.current.children || [],
          appointments: [rec],
        }).appointments;
        if (eligible.length === 0) return;
        rec = eligible[0];
      }
      const full = snapshotForOwner(fullSnapshotRef.current, capturedOwnerUid);
      const fullList = full.appointments || [];
      const fullIdx = fullList.findIndex((a) => a.id === rec.id);
      if (fullIdx >= 0 && (fullList[fullIdx].version || 0) > (rec.version || 0)) return;
      const nextFullList = [...fullList];
      if (fullIdx >= 0) nextFullList[fullIdx] = rec;
      else nextFullList.unshift(rec);
      const nextFull: Snapshot = { ...full, appointments: nextFullList };
      fullSnapshotRef.current = {
        ownerUid: capturedOwnerUid,
        snapshot: nextFull,
      };
      offlineCache.setAppointmentSnapshot(capturedOwnerUid, nextFull).catch(() => {});

      setOwnedSnapshot((prev) => {
        if (!isOwnerCurrent(capturedOwnerUid, ownerUidRef.current)) return prev;
        const current = snapshotForOwner(prev, capturedOwnerUid);
        const list = current.appointments || [];
        const idx = list.findIndex((a) => a.id === rec.id);
        if (idx >= 0 && (list[idx].version || 0) > (rec.version || 0)) return prev;
        const nextList = [...list];
        if (idx >= 0) nextList[idx] = rec;
        else nextList.unshift(rec);
        return {
          ownerUid: capturedOwnerUid,
          snapshot: { ...current, appointments: nextList },
        };
      });
    },
    [ownerUid, actorRole]
  );

  const fetchServer = useCallback(
    async (silent = false) => {
      if (!ownerUid) return;
      if (!silent) setRefreshing(true);
      try {
        const [aptRes, notifRes] = await Promise.all([
          apiRequest<any>("/api/appointments"),
          apiRequest<any>("/api/notifications").catch(() => null),
        ]);

        if (aptRes?.success) {
          const next: Snapshot = {
            appointments: aptRes.appointments || [],
            children: aptRes.children || [],
            fatherName: aptRes.fatherName,
            fatherPhotoUrl: aptRes.fatherPhotoUrl,
            fatherTitle: aptRes.fatherTitle,
            fatherEotcUid: aptRes.fatherEotcUid,
          };
          await writeSnapshot(next);
          setError(null);
        } else if (aptRes?.error) {
          setError(aptRes.error);
        }

        if (notifRes?.success) {
          setNotifications(notifRes.notifications || []);
          setUnreadCount(notifRes.unreadCount || 0);
        }
      } catch (e: any) {
        if (isOnline) setError(e?.message || "ቀጠሮዎችን ማምጣት አልተሳካም");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [ownerUid, writeSnapshot, isOnline]
  );

  const refreshCurrentView = useCallback(async () => {
    await fetchServer(true);
    if (currentViewRef.current.kind === "detail") {
      setDetailRefreshNonce((value) => value + 1);
    }
  }, [fetchServer]);

  // Initial load (cache-first)
  useEffect(() => {
    let alive = true;
    const capturedOwnerUid = ownerUid;
    const capturedRole = actorRole;
    const isCurrent = () =>
      alive && isOwnerCurrent(capturedOwnerUid, ownerUidRef.current);

    (async () => {
      if (!capturedOwnerUid) return;
      const cached = await offlineCache.getAppointmentSnapshot<Snapshot>(capturedOwnerUid);
      if (!isCurrent()) return;
      if (cached) {
        const merged = mergeAuthoritativeAppointmentSnapshot({
          capturedOwnerUid,
          currentOwnerUid: ownerUidRef.current,
          role: capturedRole,
          cached,
          cachedOwnerUid: capturedOwnerUid,
          server: cached,
        });
        if (!merged) return;
        fullSnapshotRef.current = {
          ownerUid: capturedOwnerUid,
          snapshot: cached,
        };
        setOwnedSnapshot({
          ownerUid: capturedOwnerUid,
          snapshot: merged.presentation,
        });
      }
      await refreshOutbox();
      if (!isCurrent()) return;
      setLoading(false);
      await fetchServer(true);
      await mobileSyncService.drainAppointmentOutbox(capturedOwnerUid);
      await refreshOutbox();
      if (isCurrent()) await fetchServer(true);
    })();
    return () => {
      alive = false;
    };
  }, [ownerUid, actorRole, fetchServer, refreshOutbox]);

  // Network state
  useEffect(() => {
    const capturedOwnerUid = ownerUid;
    const sub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      if (
        online &&
        capturedOwnerUid &&
        isOwnerCurrent(capturedOwnerUid, ownerUidRef.current)
      ) {
        mobileSyncService
          .drainAppointmentOutbox(capturedOwnerUid)
          .then(() => refreshOutbox())
          .then(() => fetchServer(true))
          .catch(() => {});
      }
    });
    return () => sub();
  }, [ownerUid, fetchServer, refreshOutbox]);

  // Realtime per-user private channel (authorized by /api/message/auth)
  useEffect(() => {
    if (!ownerUid) return;
    const capturedOwnerUid = ownerUid;
    const pusher = getMobilePusher();
    const channelName = `private-appointments-${capturedOwnerUid}`;
    const ch = pusher.subscribe(channelName);

    const onUpdate = (event: any) => {
      if (!isOwnerCurrent(capturedOwnerUid, ownerUidRef.current)) return;
      if (event?.type === "appointment.upsert" && event.appointment) {
        const rec = normalizeAppointment(event.appointment);
        if (!isAppointmentParty(rec, capturedOwnerUid)) return;
        if (actorRole === "FATHER") {
          const eligible = applyFatherAppointmentEligibility({
            role: actorRole,
            children: snapshotRef.current.children || [],
            appointments: [rec],
          }).appointments;
          if (eligible.length === 0) return;
        }
        upsertAppointment(rec).catch(() => {});
        setDetail((prev) => (prev && prev.appointment.id === rec.id ? { ...prev, appointment: rec } : prev));
      } else if (event?.type === "notification.new" && event.notification) {
        const n = event.notification as NotificationItem;
        if (n.userId !== capturedOwnerUid) return;
        setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
        if (!n.read) setUnreadCount((c) => c + 1);
      }
    };

    ch.bind("sanctuary-update", onUpdate);
    return () => {
      try {
        ch.unbind("sanctuary-update", onUpdate);
        pusher.unsubscribe(channelName);
      } catch {}
    };
  }, [ownerUid, actorRole, upsertAppointment]);

  const navigate = useCallback(
    (next: AppointmentViewState | AppointmentRouteParams) => {
      const q: any = appointmentRouteParams(next);
      router.replace({ pathname: "/(tabs)/appointments", params: q } as any);
    },
    [router]
  );

  const openAppointment = useCallback(
    (appointmentId: string, contextChildUid?: string) => {
      const childUid =
        actorRole === "FATHER" &&
        contextChildUid &&
        children.some((child) => child.uid === contextChildUid)
          ? contextChildUid
          : undefined;
      navigate({ appointment: appointmentId, child: childUid });
    },
    [navigate, actorRole, children]
  );

  const goBack = useCallback(() => {
    const next = appointmentBackView(view, {
      role: actorRole,
      knownChildUids: children.map((child) => child.uid),
      appointment:
        view.kind === "detail"
          ? detail?.appointment ??
            appointments.find((item) => item.id === view.appointmentId) ??
            null
          : null,
    });
    navigate(next);
  }, [view, actorRole, children, detail, appointments, navigate]);

  // Android hardware back follows the same in-app hierarchy. Native modals
  // keep their own back handling while open.
  useEffect(() => {
    if (
      view.kind === "overview" ||
      showCreate ||
      showBell ||
      rescheduleOpen ||
      confirmAction
    ) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [view.kind, showCreate, showBell, rescheduleOpen, confirmAction, goBack]);

  // A stale or unsupported child param must not create a synthetic room.
  useEffect(() => {
    if (
      !loading &&
      actorRole === "FATHER" &&
      view.kind === "child" &&
      !children.some((child) => child.uid === view.childUid)
    ) {
      navigate({});
    }
  }, [loading, actorRole, view, children, navigate]);

  // Detail lifecycle is keyed only by account + requested appointment id.
  // Snapshot updates (list refresh, realtime, offline drain) never re-trigger it.
  const detailViewKind = view.kind;
  const detailAppointmentId = view.kind === "detail" ? view.appointmentId : null;
  const detailRequestKey = appointmentDetailRequestKey(view, ownerUid);
  useEffect(() => {
    if (!detailRequestKey || detailViewKind !== "detail" || !detailAppointmentId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      setRescheduleOpen(false);
      setActionMessage(null);
      return;
    }
    const appointmentId = detailAppointmentId;
    const requestNonce = detailRefreshNonce;
    let alive = true;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setActionMessage(null);
    setRescheduleOpen(false);

    const isCurrent = () =>
      requestNonce === detailRefreshNonce &&
      isCurrentDetailRequest(
        detailRequestKey,
        appointmentDetailRequestKey(currentViewRef.current, ownerUid)
      );

    (async () => {
      try {
        const json = await apiRequest<any>(`/api/appointments/${appointmentId}`);
        if (!alive || !isCurrent()) return;
        if (json?.success) {
          const rec = normalizeAppointment(json.appointment);
          const eligible =
            actorRole === "FATHER"
              ? applyFatherAppointmentEligibility({
                  role: actorRole,
                  children: snapshotRef.current.children || [],
                  appointments: [rec],
                }).appointments
              : [rec];
          if (eligible.length === 0) {
            setDetailError(
              detailErrorMessage(403, "ይህን ቀጠሮ ለማየት ፈቃድ የለዎትም።")
            );
            return;
          }
          setDetail({
            success: true,
            appointment: rec,
            events: json.events || [],
            participants: json.participants,
            availableActions: json.availableActions || [],
          });
          await upsertAppointment(rec);
        } else {
          setDetailError(json?.error || "ቀጠሮውን ማምጣት አልተሳካም");
        }
      } catch (e: any) {
        if (!alive || !isCurrent()) return;
        const status = e?.status;
        if (status === 404) {
          setDetailError(detailErrorMessage(status, e?.message || "ቀጠሮውን ማምጣት አልተሳካም"));
          // Terminal load state only: keep the cached/historical record intact.
        } else if (status === 403 || status === 401) {
          setDetailError(detailErrorMessage(status, e?.message || "ቀጠሮውን ማምጣት አልተሳካም"));
        } else {
          const cached = snapshotRef.current.appointments.find((a) => a.id === appointmentId);
          const eligible = cached
            ? applyFatherAppointmentEligibility({
                role: actorRole,
                children: snapshotRef.current.children || [],
                appointments: [cached],
              }).appointments
            : [];
          if (cached && eligible.length > 0) {
            setDetail({
              success: true,
              appointment: cached,
              events: [],
              participants: {
                father: { uid: cached.fatherUid, role: "FATHER", displayName: getFatherDisplayName(cached) },
                child: {
                  uid: cached.childUid,
                  role: "CHILD",
                  displayName: getChildDisplayName(cached),
                  eotcUid: cached.childEotcUid,
                },
              },
              availableActions: getAvailableAppointmentActions(cached, { uid: ownerUid, role: actorRole }),
            });
            setDetailError(null);
          } else {
            setDetailError(e?.message || "ቀጠሮውን ማምጣት አልተሳካም");
          }
        }
      } finally {
        if (alive) setDetailLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    detailRequestKey,
    detailViewKind,
    detailAppointmentId,
    detailRefreshNonce,
    ownerUid,
    actorRole,
    upsertAppointment,
  ]);

  const outboxByAppointment = useMemo(() => {
    const map = new Map<string, SQLiteAppointmentOutboxItem>();
    for (const row of outboxRows) map.set(row.appointmentId, row);
    return map;
  }, [outboxRows]);

  const refreshDetail = useCallback(
    async (appointmentId: string) => {
      try {
        const json = await apiRequest<any>(`/api/appointments/${appointmentId}`);
        if (json?.success) {
          const rec = normalizeAppointment(json.appointment);
          setDetail({
            success: true,
            appointment: rec,
            events: json.events || [],
            participants: json.participants,
            availableActions: json.availableActions || [],
          });
          await upsertAppointment(rec);
        }
      } catch {}
    },
    [upsertAppointment]
  );

  const queueAction = useCallback(
    async (appointment: AppointmentRecord, action: AppointmentAction, payload?: AppointmentActionPayload) => {
      if (!ownerUid) return;
      const operationId = makeOperationId("act");
      try {
        await offlineCache.queueAppointmentAction({
          ownerUid,
          operationId,
          appointmentId: appointment.id,
          action,
          expectedVersion: appointment.version,
          payload,
        });
        await refreshOutbox();
        await mobileSyncService.drainAppointmentOutbox(ownerUid);
        await refreshOutbox();
        await fetchServer(true);
        await refreshDetail(appointment.id);
        setActionMessage("እርምጃው ተልኳል።");
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg === "ACTION_ALREADY_QUEUED") {
          setActionMessage("በዚህ ቀጠሮ ላይ ያለ እርምጃ አስቀድሞ ተመዝግቧል።");
        } else {
          setActionMessage("እርምጃውን ማስቀመጥ አልተሳካም።");
        }
        await refreshOutbox();
      }
    },
    [ownerUid, refreshOutbox, fetchServer, refreshDetail]
  );

  const performAction = useCallback(
    async (appointment: AppointmentRecord, action: AppointmentAction, payload?: AppointmentActionPayload) => {
      setActionBusy(action);
      setActionMessage(null);
      try {
        await queueAction(appointment, action, payload);
      } finally {
        setActionBusy(null);
        setConfirmAction(null);
      }
    },
    [queueAction]
  );

  const submitReschedule = useCallback(
    async (appointment: AppointmentRecord) => {
      try {
        const scheduledAt = ethiopianDateTimeToDate(rescheduleDate, rescheduleTime).toISOString();
        await performAction(appointment, "RESCHEDULE", { scheduledAt });
        setRescheduleOpen(false);
      } catch {
        setActionMessage("ቀን/ሰዓቱ ትክክል አይደለም።");
      }
    },
    [performAction, rescheduleDate, rescheduleTime]
  );

  const markOneRead = useCallback(async (id: string) => {
    try {
      await apiRequest("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiRequest("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAll: true }),
      });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const onNotificationClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.read) await markOneRead(n.id);
      setShowBell(false);
      if (n.appointmentId) {
        const related = appointments.find((item) => item.id === n.appointmentId);
        openAppointment(n.appointmentId, related?.childUid);
      }
    },
    [markOneRead, openAppointment, appointments]
  );

  // Derived
  const nowIso = getNowIso();
  const nowDate = useMemo(() => new Date(nowIso), [nowIso]);

  const allOverviews = useMemo(() => {
    if (actorRole !== "FATHER") return [];
    return buildChildAppointmentOverviews({ appointments, children, viewerUid: ownerUid, now: nowDate });
  }, [actorRole, appointments, children, ownerUid, nowDate]);

  const { directoryOverviews, unmatchedAppointments } = useMemo(
    () =>
      selectFatherAppointmentOverviewPresentation({
        overviews: allOverviews,
        appointments,
        children,
        viewerUid: ownerUid,
      }),
    [allOverviews, appointments, children, ownerUid]
  );

  const studentBuckets = useMemo(() => {
    if (actorRole !== "STUDENT") return null;
    const mine = appointments.filter((a) => a.childUid === ownerUid).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return {
      awaitingMyResponse: mine.filter((a) => a.status === "REQUESTED" && a.pendingResponseFrom === ownerUid),
      awaitingFather: mine.filter((a) => a.status === "REQUESTED" && a.pendingResponseFrom !== ownerUid),
      upcomingConfirmed: mine.filter((a) => isUpcomingConfirmed(a, nowIso)),
      overdueConfirmed: mine.filter((a) => isConfirmedOverdue(a, nowIso)),
      past: mine
        .filter(
          (a) =>
            a.status === "DECLINED" ||
            a.status === "CANCELLED" ||
            a.status === "COMPLETED"
        )
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    };
  }, [actorRole, appointments, ownerUid, nowIso]);

  const childRoomAppointments = useMemo(() => {
    if (view.kind !== "child") return [];
    return selectAppointmentsForChild(appointments, view.childUid).sort((a, b) => {
      const aNeeds = a.status === "REQUESTED" && a.pendingResponseFrom === ownerUid ? 0 : 1;
      const bNeeds = b.status === "REQUESTED" && b.pendingResponseFrom === ownerUid ? 0 : 1;
      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
      return a.scheduledAt.localeCompare(b.scheduledAt);
    });
  }, [appointments, view, ownerUid]);

  const roomChild = useMemo(
    () =>
      view.kind === "child"
        ? children.find((child) => child.uid === view.childUid) ?? null
        : null,
    [view, children]
  );

  const activeDetailChildUid =
    view.kind === "detail"
      ? resolveAppointmentDetailChildUid(view, {
          role: actorRole,
          knownChildUids: children.map((child) => child.uid),
          appointment:
            detail?.appointment ??
            appointments.find((item) => item.id === view.appointmentId) ??
            null,
        })
      : undefined;
  const detailChildName =
    actorRole === "FATHER"
      ? children.find((child) => child.uid === activeDetailChildUid)?.displayName ||
        detail?.participants.child.displayName
      : undefined;

  const openCreate = (prefillChildUid?: string) => {
    setCreateError(null);
    setCreateType("NISEHA");
    const t = getTodayEthiopian();
    setCreateDate({ year: t.year, month: t.month, day: t.day });
    setCreateTime(defaultFutureTime());
    setCreateLocation("");
    setCreateNote("");
    if (prefillChildUid) setCreateChildUid(prefillChildUid);
    else if (view.kind === "child") setCreateChildUid(view.childUid);
    else setCreateChildUid("");
    setShowCreate(true);
  };

  const submitCreate = async () => {
    setCreateError(null);
    if (!isOnline) {
      setCreateError("ቀጠሮ ለመፍጠር የኢንተርኔት ግንኙነት ያስፈልጋል።");
      return;
    }
    const targetChildUid = actorRole === "STUDENT" ? ownerUid : createChildUid;
    if (!targetChildUid) {
      setCreateError("እባክዎ ልጅ ይምረጡ።");
      return;
    }
    if (actorRole === "FATHER") {
      const child = children.find((c) => c.uid === targetChildUid);
      if (!child || !isEligibleFatherChild(child)) {
        setCreateError("ይህ ልጅ ለቀጠሮ አይገኝም።");
        return;
      }
    }
    setCreateBusy(true);
    try {
      const scheduledAt = ethiopianDateTimeToDate(createDate, createTime).toISOString();
      const json = await apiRequest<any>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          operationId: makeOperationId("create"),
          childUid: targetChildUid,
          type: createType,
          scheduledAt,
          location: createLocation || undefined,
          message: createNote || undefined,
        }),
      });
      if (!json?.success) {
        setCreateError(json?.error || "ቀጠሮ መፍጠር አልተሳካም");
        return;
      }
      const rec = normalizeAppointment(json.appointment);
      await upsertAppointment(rec);
      setShowCreate(false);
      await fetchServer(true);
      openAppointment(rec.id, targetChildUid);
    } catch (e: any) {
      setCreateError(e?.message || "ቀጠሮ መፍጠር አልተሳካም");
    } finally {
      setCreateBusy(false);
    }
  };

  const dismissFailed = async (operationId: string) => {
    try {
      const row = outboxRows.find((r) => r.operationId === operationId);
      if (row?.status === "SENDING") return;
      await offlineCache.removeAppointmentOutbox(operationId);
      await refreshOutbox();
      await fetchServer(true);
    } catch {}
  };

  if (!ownerUid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>መለያ አልተገኘም።</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={THEME.colors.sacredAmber} />
        <Text style={styles.muted}>በመጫን ላይ…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentView} tintColor={THEME.colors.sacredAmber} />}
      >
        <Header
          title={
            view.kind === "detail" && detailChildName
              ? `${detailChildName} • የቀጠሮ ዝርዝር`
              : view.kind === "detail"
              ? "የቀጠሮ ዝርዝር"
              : view.kind === "child"
              ? roomChild?.displayName || "ልጅ"
              : actorRole === "FATHER"
              ? "የልጆች ቀጠሮዎች"
              : "ቀጠሮዎቼ"
          }
          back={view.kind !== "overview"}
          onBack={goBack}
          unreadCount={unreadCount}
          onBell={() => setShowBell((v) => !v)}
          onCreate={() => openCreate(view.kind === "child" ? view.childUid : undefined)}
          showCreate={actorRole === "STUDENT" || view.kind === "child"}
          onRefresh={refreshCurrentView}
          refreshing={refreshing}
        />

        {showBell && (
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAll={markAllRead}
            onClick={onNotificationClick}
          />
        )}

        {!isOnline && (
          <Banner tone="warn" icon={<WifiOff color={THEME.colors.sacredAmber} size={16} />} text="ከመስመር ውጭ ነዎት። የተቀመጡ ቀጠሮዎች ይታያሉ፤ የተሰለፉ እርምጃዎች ሲገናኙ ይላካሉ።" />
        )}
        {error ? <Banner tone="error" icon={<AlertTriangle color={THEME.colors.error} size={16} />} text={error} onClose={() => setError(null)} /> : null}

        {view.kind === "overview" && actorRole === "FATHER" && (
          <FatherOverview
            overviews={directoryOverviews}
            unmatched={unmatchedAppointments}
            onOpenChild={(id) => navigate({ child: id })}
            onOpenAppointment={openAppointment}
            onCreate={(id) => openCreate(id)}
          />
        )}

        {view.kind === "overview" && actorRole === "STUDENT" && studentBuckets && (
          <StudentOverview
            buckets={studentBuckets}
            fatherName={snapshot.fatherName || "አባት"}
            fatherPhotoUrl={snapshot.fatherPhotoUrl}
            fatherTitle={snapshot.fatherTitle}
            onCreate={() => openCreate()}
            renderRow={(a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                role={actorRole}
                viewerUid={ownerUid}
                nowIso={nowIso}
                outbox={outboxByAppointment.get(a.id)}
                child={children.find((c) => c.uid === a.childUid)}
                onPress={() => openAppointment(a.id, a.childUid)}
              />
            )}
          />
        )}

        {view.kind === "child" && actorRole === "FATHER" && roomChild && (
          <ChildRoom
            child={roomChild}
            appointments={childRoomAppointments}
            onCreate={() => openCreate(roomChild.uid)}
            renderRow={(a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                role={actorRole}
                viewerUid={ownerUid}
                nowIso={nowIso}
                outbox={outboxByAppointment.get(a.id)}
                child={children.find((c) => c.uid === a.childUid)}
                onPress={() => openAppointment(a.id, a.childUid)}
              />
            )}
          />
        )}

        {view.kind === "detail" && (
          <DetailView
            detail={detail}
            loading={detailLoading}
            error={detailError}
            actorRole={actorRole}
            viewerUid={ownerUid}
            outbox={appointmentParam ? outboxByAppointment.get(appointmentParam) : undefined}
            actionBusy={actionBusy}
            actionMessage={actionMessage}
            rescheduleOpen={rescheduleOpen}
            rescheduleDate={rescheduleDate}
            rescheduleTime={rescheduleTime}
            confirmAction={confirmAction}
            onOpenReschedule={(a) => {
              const t = ethiopianFromIso(a.scheduledAt);
              setRescheduleDate(t.date);
              setRescheduleTime(t.time);
              setRescheduleOpen(true);
              setConfirmAction(null);
            }}
            onCloseReschedule={() => setRescheduleOpen(false)}
            onRescheduleDate={setRescheduleDate}
            onRescheduleTime={setRescheduleTime}
            onSubmitReschedule={() => detail && submitReschedule(detail.appointment)}
            onAction={(action) => {
              if (!detail) return;
              if (action === "RESCHEDULE") {
                const t = ethiopianFromIso(detail.appointment.scheduledAt);
                setRescheduleDate(t.date);
                setRescheduleTime(t.time);
                setRescheduleOpen(true);
                return;
              }
              if (action === "DECLINE" || action === "CANCEL" || action === "COMPLETE") {
                setConfirmAction(action);
                return;
              }
              performAction(detail.appointment, action);
            }}
            onConfirmAction={() => {
              if (!detail || !confirmAction) return;
              performAction(detail.appointment, confirmAction);
            }}
            onCancelConfirmAction={() => setConfirmAction(null)}
            onDismissFailed={dismissFailed}
            onRetry={refreshCurrentView}
          />
        )}
      </ScrollView>

      <CreateModal
        visible={showCreate}
        role={actorRole}
        isOnline={isOnline}
        childrenOptions={children}
        childUid={actorRole === "STUDENT" ? ownerUid : createChildUid}
        onChildUid={setCreateChildUid}
        type={createType}
        onType={setCreateType}
        date={createDate}
        onDate={setCreateDate}
        time={createTime}
        onTime={setCreateTime}
        location={createLocation}
        onLocation={setCreateLocation}
        note={createNote}
        onNote={setCreateNote}
        busy={createBusy}
        error={createError}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
      />
    </View>
  );
}

/* ---------- UI pieces ---------- */

function Header(props: {
  title: string;
  back?: boolean;
  onBack: () => void;
  unreadCount: number;
  onBell: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  showCreate?: boolean;
}) {
  const { title, back, onBack, unreadCount, onBell, onCreate, onRefresh, refreshing, showCreate = true } = props;
  return (
    <View style={styles.headerRow}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        {back && (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="ተመለስ" style={styles.iconBtn}>
            <ChevronLeft color={THEME.colors.inkSecondary} size={20} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ቀጠሮ</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={onBell} accessibilityRole="button" accessibilityLabel="ማሳሰቢያዎች" style={styles.iconBtn}>
          <Bell color={THEME.colors.inkSecondary} size={18} />
          {unreadCount > 0 && (
            <View style={styles.badgeDot}><Text style={styles.badgeDotText}>{unreadCount}</Text></View>
          )}
        </Pressable>
        {showCreate && (
          <Pressable onPress={onCreate} accessibilityRole="button" accessibilityLabel="አዲስ ቀጠሮ" style={styles.primaryBtnSmall}>
            <Plus color="#fff" size={16} />
            <Text style={styles.primaryBtnSmallText}>አዲስ</Text>
          </Pressable>
        )}
        <Pressable onPress={onRefresh} accessibilityRole="button" accessibilityLabel="አድስ" style={styles.iconBtn}>
          <RefreshCw color={THEME.colors.inkSecondary} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function Banner({
  tone,
  icon,
  text,
  onClose,
}: {
  tone: "warn" | "error";
  icon: React.ReactNode;
  text: string;
  onClose?: () => void;
}) {
  const bg = tone === "warn" ? THEME.colors.amberLight : THEME.colors.errorBg;
  const border = tone === "warn" ? THEME.colors.amberBorder : THEME.colors.errorBorder;
  const color = tone === "warn" ? THEME.colors.sacredAmber : THEME.colors.error;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      {icon}
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="ዝጋ" style={styles.touch44}>
          <X color={color} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAll,
  onClick,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAll: () => void;
  onClick: (n: NotificationItem) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>ማሳሰቢያዎች</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={onMarkAll} accessibilityRole="button" style={styles.touch44}>
            <Text style={styles.linkText}>ሁሉንም አንብብ</Text>
          </Pressable>
        ) : null}
      </View>
      {notifications.length === 0 ? (
        <Text style={styles.muted}>ምንም ማሳሰቢያ የለም</Text>
      ) : (
        notifications.slice(0, 20).map((n) => (
          <Pressable
            key={n.id}
            onPress={() => onClick(n)}
            accessibilityRole="button"
            style={[styles.notifRow, !n.read && styles.notifUnread]}
          >
            <Text style={styles.notifTitle}>{n.title}</Text>
            <Text style={styles.notifBody}>{n.body}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function AppointmentRow(props: {
  appointment: AppointmentRecord;
  role: PropsRole;
  viewerUid: string;
  nowIso: string;
  outbox?: SQLiteAppointmentOutboxItem;
  child?: AppointmentChildDirectoryEntry;
  onPress: () => void;
}) {
  const { appointment: a, role, viewerUid, nowIso, outbox, child, onPress } = props;
  const sc = statusColors(a.status);
  const needsMyResponse = a.status === "REQUESTED" && a.pendingResponseFrom === viewerUid;
  const overdue = isConfirmedOverdue(a, nowIso);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        {role === "FATHER" ? <Avatar name={child?.displayName || getChildDisplayName(a)} photoUrl={child?.photoUrl} size={40} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <Text style={{ fontWeight: "900", color: THEME.colors.sacredCrimson, fontSize: 12 }}>{getAppointmentTypeLabel(a.type)}</Text>
            <Chip label={getAppointmentStatusLabel(a.status)} bg={sc.bg} text={sc.text} border={sc.border} />
            {needsMyResponse ? <Chip label="ምላሽ ይጠበቃል" bg="#EFF6FF" text="#1D4ED8" border="#BFDBFE" /> : null}
            {overdue ? <Chip label="ጊዜው አልፏል" bg="#FFF7ED" text="#C2410C" border="#FED7AA" /> : null}
            {outbox ? (
              outbox.status === "FAILED" && outbox.needsAttention ? (
                <Chip label="ቀጠሮው ተለውጧል" bg={THEME.colors.errorBg} text={THEME.colors.error} border={THEME.colors.errorBorder} />
              ) : (
                <Chip label="በመላክ ላይ" bg={THEME.colors.amberLight} text={THEME.colors.sacredAmber} border={THEME.colors.amberBorder} />
              )
            ) : null}
          </View>
          <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }}>
            {role === "FATHER" ? (child?.displayName || getChildDisplayName(a)) : getFatherDisplayName(a)}
          </Text>
          <RowIcon icon={<Clock color={THEME.colors.inkSubtle} size={14} />} text={formatEthiopianDateTimeInEAT(a.scheduledAt)} />
          {a.location ? <RowIcon icon={<MapPin color={THEME.colors.inkSubtle} size={14} />} text={a.location} /> : null}
          {outbox?.status === "FAILED" && outbox.needsAttention && outbox.lastError ? (
            <Text style={{ fontSize: 11, color: THEME.colors.error }}>{outbox.lastError}</Text>
          ) : null}
        </View>
        <ChevronRight color="#CBD5E1" size={18} />
      </View>
    </Pressable>
  );
}

function Chip({ label, bg, text, border }: { label: string; bg: string; text: string; border: string }) {
  return (
    <View style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: text, fontSize: 10, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function RowIcon({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <Text style={{ fontSize: 12, color: THEME.colors.inkSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}

function FatherOverview(props: {
  overviews: ReturnType<typeof buildChildAppointmentOverviews>;
  unmatched: AppointmentRecord[];
  onOpenChild: (id: string) => void;
  onOpenAppointment: (id: string) => void;
  onCreate: (id: string) => void;
}) {
  const { overviews, unmatched, onOpenChild, onOpenAppointment, onCreate } = props;
  if (overviews.length === 0 && unmatched.length === 0) {
    return (
      <View style={[styles.card, { alignItems: "center", paddingVertical: 28, gap: 8 }]}>
        <CalendarClock color="#CBD5E1" size={36} />
        <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }}>የተመዘገቡ ልጆች አልተገኙም</Text>
        <Text style={styles.muted}>ቀጠሮ ለመፍጠር በመጀመሪያ ልጅ መኖር አለበት።</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {overviews.map((item) => {
        const needs = item.attentionNeeded > 0;
        const upcomingCount = Math.max(0, item.confirmed - item.overdueConfirmed);
        return (
          <View key={item.child.uid} style={[styles.card, needs && { borderColor: THEME.colors.amberBorder }]}>
            <Pressable onPress={() => onOpenChild(item.child.uid)} accessibilityRole="button" style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Avatar name={item.child.displayName} photoUrl={item.child.photoUrl} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: THEME.colors.inkPrimary }}>{item.child.displayName}</Text>
                  {item.child.spiritualTitle ? <Text style={styles.muted}>{item.child.spiritualTitle}</Text> : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {needs ? <Chip label={`ምላሽ ይጠበቃል: ${item.attentionNeeded}`} bg={THEME.colors.amberLight} text={THEME.colors.sacredAmber} border={THEME.colors.amberBorder} /> : null}
                    {!needs && item.awaitingOtherParty > 0 ? <Chip label="የልጅ ምላሽ ይጠበቃል" bg="#EFF6FF" text="#1D4ED8" border="#BFDBFE" /> : null}
                    {upcomingCount > 0 ? <Chip label={`መጪ: ${upcomingCount}`} bg={THEME.colors.successBg} text={THEME.colors.success} border="#A7F3D0" /> : null}
                    {item.total === 0 ? <Text style={styles.muted}>ቀጠሮ የለም</Text> : null}
                  </View>
                  {item.nearestUpcomingConfirmed ? (
                    <Text style={[styles.muted, { marginTop: 4 }]}>ቀጣይ ቀጠሮ: {formatEthiopianDateTimeInEAT(item.nearestUpcomingConfirmed.scheduledAt)}</Text>
                  ) : null}
                </View>
                <ChevronRight color="#CBD5E1" size={18} />
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable onPress={() => onCreate(item.child.uid)} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44 }]}>
                <Plus color="#fff" size={16} />
                <Text style={styles.primaryBtnSmallText}>ቀጠሮ ፍጠር</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {unmatched.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>ሌሎች ቀጠሮዎች</Text>
          {unmatched.map((a) => (
            <Pressable key={a.id} onPress={() => onOpenAppointment(a.id)} accessibilityRole="button" style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }}>{getChildDisplayName(a)}</Text>
                  <Text style={styles.muted}>{getAppointmentTypeLabel(a.type)} • {formatEthiopianDateTimeInEAT(a.scheduledAt)}</Text>
                </View>
                <ChevronRight color="#CBD5E1" size={18} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function StudentOverview(props: {
  buckets: any;
  fatherName: string;
  fatherPhotoUrl?: string;
  fatherTitle?: string;
  onCreate: () => void;
  renderRow: (a: AppointmentRecord) => React.ReactNode;
}) {
  const { buckets, fatherName, fatherPhotoUrl, fatherTitle, onCreate, renderRow } = props;
  const Section = ({ title, items }: { title: string; items: AppointmentRecord[] }) =>
    items.length > 0 ? (
      <View style={{ gap: 8 }}>
        <Text style={styles.sectionTitle}>{title} ({items.length})</Text>
        {items.map(renderRow)}
      </View>
    ) : null;

  const empty =
    buckets.awaitingMyResponse.length === 0 &&
    buckets.awaitingFather.length === 0 &&
    buckets.upcomingConfirmed.length === 0 &&
    buckets.overdueConfirmed.length === 0 &&
    buckets.past.length === 0;

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Avatar name={fatherName} photoUrl={fatherPhotoUrl} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>አባት</Text>
          <Text style={{ fontWeight: "900", color: THEME.colors.inkPrimary }}>{fatherName}</Text>
          {fatherTitle ? <Text style={styles.muted}>{fatherTitle}</Text> : null}
        </View>
        <Pressable onPress={onCreate} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44 }]}>
          <Plus color="#fff" size={16} />
          <Text style={styles.primaryBtnSmallText}>ጠይቅ</Text>
        </Pressable>
      </View>
      {empty ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          <CalendarClock color="#CBD5E1" size={36} />
          <Text style={{ fontWeight: "700", color: THEME.colors.inkMuted }}>ምንም ቀጠሮ የለዎትም</Text>
        </View>
      ) : (
        <>
          <Section title="ምላሽዎን የሚጠብቁ" items={buckets.awaitingMyResponse} />
          <Section title="የአባት ምላሽ የሚጠብቁ" items={buckets.awaitingFather} />
          <Section title="መጪ የተረጋገጡ" items={buckets.upcomingConfirmed} />
          <Section title="ጊዜው ያለፈባቸው" items={buckets.overdueConfirmed} />
          <Section title="ያለፉ / የተዘጉ" items={buckets.past} />
        </>
      )}
    </View>
  );
}

function ChildRoom(props: {
  child: AppointmentChildDirectoryEntry;
  appointments: AppointmentRecord[];
  onCreate: () => void;
  renderRow: (a: AppointmentRecord) => React.ReactNode;
}) {
  const { child, appointments, onCreate, renderRow } = props;
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Avatar name={child.displayName} photoUrl={child.photoUrl} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", color: THEME.colors.inkPrimary }}>{child.displayName}</Text>
          {child.spiritualTitle ? <Text style={styles.muted}>{child.spiritualTitle}</Text> : null}
        </View>
        <Pressable onPress={onCreate} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44, backgroundColor: THEME.colors.sacredCrimson }]}>
          <Plus color="#fff" size={16} />
          <Text style={styles.primaryBtnSmallText}>ቀጠሮ ፍጠር</Text>
        </Pressable>
      </View>
      {appointments.length === 0 ? (
        <Text style={[styles.muted, { textAlign: "center", paddingVertical: 20 }]}>ለዚህ ልጅ ቀጠሮ የለም</Text>
      ) : (
        <View style={{ gap: 8 }}>{appointments.map(renderRow)}</View>
      )}
    </View>
  );
}

function DetailView(props: {
  detail: AppointmentDetailResponse | null;
  loading: boolean;
  error: string | null;
  actorRole: PropsRole;
  viewerUid: string;
  outbox?: SQLiteAppointmentOutboxItem;
  actionBusy: string | null;
  actionMessage: string | null;
  rescheduleOpen: boolean;
  rescheduleDate: EthiopianDate;
  rescheduleTime: EthiopianClockTime;
  confirmAction: AppointmentAction | null;
  onOpenReschedule: (a: AppointmentRecord) => void;
  onCloseReschedule: () => void;
  onRescheduleDate: (d: EthiopianDate) => void;
  onRescheduleTime: (t: EthiopianClockTime) => void;
  onSubmitReschedule: () => void;
  onAction: (action: AppointmentAction) => void;
  onConfirmAction: () => void;
  onCancelConfirmAction: () => void;
  onDismissFailed: (operationId: string) => void;
  onRetry: () => void;
}) {
  const {
    detail, loading, error, actorRole, viewerUid, outbox, actionBusy, actionMessage,
    rescheduleOpen, rescheduleDate, rescheduleTime, confirmAction,
    onOpenReschedule, onCloseReschedule, onRescheduleDate, onRescheduleTime, onSubmitReschedule,
    onAction, onConfirmAction, onCancelConfirmAction, onDismissFailed, onRetry,
  } = props;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={THEME.colors.sacredAmber} /><Text style={styles.muted}>በመጫን ላይ…</Text></View>;
  }
  if (error) {
    return (
      <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
        <AlertTriangle color={THEME.colors.error} size={28} />
        <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary, textAlign: "center" }}>{error}</Text>
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.secondaryBtnSmall}><Text style={styles.secondaryBtnSmallText}>እንደገና ሞክር</Text></Pressable>
      </View>
    );
  }
  if (!detail) return null;

  const a = detail.appointment;
  const { father } = detail.participants;
  const identity = getAppointmentIdentityDisplay(a, detail.participants);
  const child = identity.subject;
  const identityRolesByUid = new Map(
    identity.groups.map((group) => [
      group.participant.uid,
      group.roles.map((role) => APPOINTMENT_IDENTITY_ROLE_TERMS[role]).join(" · "),
    ])
  );
  const actor = { uid: viewerUid, role: actorRole };
  const actions = outbox ? [] : (detail.availableActions || getAvailableAppointmentActions(a, actor));
  const sc = statusColors(a.status);
  const overdue = isConfirmedOverdue(a, getNowIso());

  return (
    <View style={{ gap: 10 }}>
      {outbox ? (
        <View style={[styles.banner, outbox.status === "FAILED" && outbox.needsAttention ? { backgroundColor: THEME.colors.errorBg, borderColor: THEME.colors.errorBorder } : { backgroundColor: THEME.colors.amberLight, borderColor: THEME.colors.amberBorder }]}>
          {outbox.status === "FAILED" && outbox.needsAttention ? <AlertTriangle color={THEME.colors.error} size={16} /> : <ActivityIndicator size="small" color={THEME.colors.sacredAmber} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }}>
              {outbox.status === "FAILED" && outbox.needsAttention ? "ቀጠሮው ተለውጧል" : `በመላክ ላይ: ${getQueuedActionLabel(outbox.action)}`}
            </Text>
            {outbox.lastError ? <Text style={{ fontSize: 12, color: THEME.colors.inkSecondary }}>{outbox.lastError}</Text> : null}
            {outbox.status === "FAILED" && outbox.needsAttention ? (
              <Pressable onPress={() => onDismissFailed(outbox.operationId)} accessibilityRole="button" style={[styles.touch44, { alignSelf: "flex-start" }]}>
                <Text style={{ color: THEME.colors.error, fontWeight: "700", textDecorationLine: "underline" }}>እርምጃውን አጽዳ</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {actionMessage ? <Banner tone="warn" icon={<AlertTriangle color={THEME.colors.sacredAmber} size={16} />} text={actionMessage} /> : null}

      <View style={styles.card}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <Text style={{ fontWeight: "900", color: THEME.colors.sacredCrimson }}>{getAppointmentTypeLabel(a.type)}</Text>
          <Chip label={getAppointmentStatusLabel(a.status)} bg={sc.bg} text={sc.text} border={sc.border} />
          {overdue ? <Chip label="ጊዜው አልፏል" bg="#FFF7ED" text="#C2410C" border="#FED7AA" /> : null}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <PartyBlock
            label="አባት"
            party={father}
            rolesLabel={identityRolesByUid.get(father.uid)}
            highlight={actorRole === "FATHER"}
          />
          <PartyBlock
            label="ልጅ (ርዕሰ ጉዳይ)"
            party={child}
            rolesLabel={identityRolesByUid.get(child.uid)}
            highlight={actorRole === "STUDENT"}
          />
        </View>

        <Info label="ቀን / ሰዓት" value={formatEthiopianDateTimeInEAT(a.scheduledAt)} icon={<CalendarClock color={THEME.colors.inkSubtle} size={14} />} />
        {a.location ? <Info label="ቦታ" value={a.location} icon={<MapPin color={THEME.colors.inkSubtle} size={14} />} /> : null}
        {(a.message || a.logisticsNote) ? <Info label="ማስታወሻ" value={a.message || a.logisticsNote || ""} icon={<MessageSquare color={THEME.colors.inkSubtle} size={14} />} /> : null}
        <Info label="የተፈጠረበት" value={formatEthiopianDateTimeInEAT(a.createdAt)} icon={<Clock color={THEME.colors.inkSubtle} size={14} />} />
        <Info label="የተዘመነበት" value={formatEthiopianDateTimeInEAT(a.updatedAt)} icon={<Clock color={THEME.colors.inkSubtle} size={14} />} />

        {!a.identityConsistent ? (
          <View style={[styles.banner, { backgroundColor: THEME.colors.errorBg, borderColor: THEME.colors.errorBorder, marginTop: 8 }]}>
            <Text style={{ color: THEME.colors.error, fontSize: 12 }}>የዚህ ቀጠሮ የማንነት መረጃ አይጣጣምም። ለደህንነት ሲባል ማስተካከያ እስኪደረግ እርምጃ አይፈቀድም።</Text>
          </View>
        ) : null}
      </View>

      {actions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>የሚፈቀዱ እርምጃዎች</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {actions.includes("CONFIRM") ? <ActionBtn label="ተቀበል" busy={actionBusy === "CONFIRM"} onPress={() => onAction("CONFIRM")} variant="primary" /> : null}
            {actions.includes("DECLINE") ? <ActionBtn label="አትቀበል" busy={actionBusy === "DECLINE"} onPress={() => onAction("DECLINE")} variant="danger" /> : null}
            {actions.includes("RESCHEDULE") ? <ActionBtn label="ቀን ቀይር" busy={actionBusy === "RESCHEDULE"} onPress={() => onAction("RESCHEDULE")} variant="secondary" /> : null}
            {actions.includes("CANCEL") ? <ActionBtn label="ሰርዝ" busy={actionBusy === "CANCEL"} onPress={() => onAction("CANCEL")} variant="danger" /> : null}
            {actions.includes("COMPLETE") ? <ActionBtn label="ተጠናቋል ምልክት አድርግ" busy={actionBusy === "COMPLETE"} onPress={() => onAction("COMPLETE")} variant="primary" /> : null}
          </View>

          {rescheduleOpen && actions.includes("RESCHEDULE") ? (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: THEME.colors.amberLight, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.amberBorder, gap: 10 }}>
              <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }}>አዲስ ቀን / ሰዓት</Text>
              <EthiopianDatePicker value={rescheduleDate} onChange={onRescheduleDate} />
              <EthiopianTimePicker value={rescheduleTime} onChange={onRescheduleTime} />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                <Pressable onPress={onCloseReschedule} accessibilityRole="button" style={[styles.secondaryBtnSmall, { minHeight: 44 }]}><Text style={styles.secondaryBtnSmallText}>ዝጋ</Text></Pressable>
                <Pressable onPress={onSubmitReschedule} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44 }]} disabled={actionBusy === "RESCHEDULE"}>
                  {actionBusy === "RESCHEDULE" ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnSmallText}>አስገባ</Text>}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>የቀጠሮ ታሪክ</Text>
        {detail.events.length === 0 ? (
          <Text style={styles.muted}>የታሪክ መረጃ አልተገኘም። (የቀድሞ መዝገቦች ሙሉ ታሪክ ላይኖራቸው ይችላል)</Text>
        ) : (
          detail.events.map((ev) => (
            <View key={ev.id} style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.colors.sacredAmber, marginTop: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: THEME.colors.inkPrimary }}>{formatAppointmentEvent(ev)}</Text>
                <Text style={styles.muted}>{formatEthiopianDateTimeInEAT(ev.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <ConfirmModal
        visible={!!confirmAction}
        title="ማረጋገጫ"
        message={
          confirmAction === "DECLINE"
            ? "ይህን ቀጠሮ አለመቀበልዎን ያረጋግጡ።"
            : confirmAction === "CANCEL"
            ? "ይህን ቀጠሮ መሰረዝዎን ያረጋግጡ።"
            : "ቀጠሮው ተጠናቋል ብለው ምልክት ማድረግዎን ያረጋግጡ።"
        }
        confirmLabel="አረጋግጥ"
        danger={confirmAction !== "COMPLETE"}
        busy={!!actionBusy}
        onCancel={onCancelConfirmAction}
        onConfirm={onConfirmAction}
      />
    </View>
  );
}

function PartyBlock({ label, party, rolesLabel, highlight }: { label: string; party: AppointmentParticipant; rolesLabel?: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: highlight ? THEME.colors.amberBorder : THEME.colors.border, backgroundColor: highlight ? THEME.colors.amberLight : THEME.colors.surfaceAlt }}>
      <Avatar name={party.displayName} photoUrl={party.photoUrl} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{label}</Text>
        <Text style={{ fontWeight: "800", color: THEME.colors.inkPrimary }} numberOfLines={1}>{party.displayName}</Text>
        {party.spiritualTitle ? <Text style={styles.muted} numberOfLines={1}>{party.spiritualTitle}</Text> : null}
        {rolesLabel ? <Text style={{ marginTop: 3, fontSize: 10, fontWeight: "700", color: THEME.colors.inkSecondary }} numberOfLines={2}>{rolesLabel}</Text> : null}
      </View>
    </View>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <View style={{ marginTop: 2 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{label}</Text>
        <Text style={{ color: THEME.colors.inkPrimary, fontWeight: "600" }}>{value}</Text>
      </View>
    </View>
  );
}

function ActionBtn({ label, busy, onPress, variant }: { label: string; busy?: boolean; onPress: () => void; variant: "primary" | "secondary" | "danger" }) {
  const style =
    variant === "primary"
      ? { backgroundColor: THEME.colors.success }
      : variant === "danger"
      ? { backgroundColor: THEME.colors.error }
      : { backgroundColor: THEME.colors.buttonDark };
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={[styles.actionBtn, style, busy && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function ConfirmModal(props: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { visible, title, message, confirmLabel, danger, busy, onCancel, onConfirm } = props;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: THEME.colors.inkPrimary }}>{title}</Text>
          <Text style={{ color: THEME.colors.inkSecondary, marginTop: 8 }}>{message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.secondaryBtnSmall, { minHeight: 44 }]}><Text style={styles.secondaryBtnSmallText}>ተመለስ</Text></Pressable>
            <Pressable onPress={onConfirm} disabled={busy} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44, backgroundColor: danger ? THEME.colors.error : THEME.colors.success }]}>
              <Text style={styles.primaryBtnSmallText}>{busy ? "..." : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Create / Ethiopian pickers ---------- */

function CreateModal(props: any) {
  const {
    visible, role, isOnline, childrenOptions, childUid, onChildUid, type, onType,
    date, onDate, time, onTime, location, onLocation, note, onNote, busy, error, onClose, onSubmit,
  } = props;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: "90%" }]}>
          <View style={styles.rowBetween}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: THEME.colors.inkPrimary }}>አዲስ ቀጠሮ</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="ዝጋ" style={styles.touch44}><X color={THEME.colors.inkMuted} size={18} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
            {!isOnline ? <Banner tone="warn" icon={<WifiOff color={THEME.colors.sacredAmber} size={16} />} text="ቀጠሮ ለመፍጠር የኢንተርኔት ግንኙነት ያስፈልጋል።" /> : null}
            {error ? <Banner tone="error" icon={<AlertTriangle color={THEME.colors.error} size={16} />} text={error} /> : null}

            {role === "FATHER" ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.eyebrow}>ልጅ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {childrenOptions.map((c: AppointmentChildDirectoryEntry) => {
                    const active = childUid === c.uid;
                    return (
                      <Pressable key={c.uid} onPress={() => onChildUid(c.uid)} accessibilityRole="button" style={[styles.childChip, active && styles.childChipActive]}>
                        <Text style={{ fontWeight: "700", color: active ? THEME.colors.sacredCrimson : THEME.colors.inkPrimary }}>{c.displayName}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={styles.eyebrow}>ዓይነት</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["NISEHA", "COUNSELING"] as AppointmentType[]).map((t) => (
                  <Pressable key={t} onPress={() => onType(t)} accessibilityRole="button" style={[styles.typeBtn, type === t && styles.typeBtnActive]}>
                    <Text style={{ fontWeight: "800", color: type === t ? THEME.colors.sacredAmber : THEME.colors.inkMuted }}>
                      {t === "NISEHA" ? "ንስሐ" : "ምክር"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.eyebrow}>ቀን (ዓ.ም)</Text>
              <EthiopianDatePicker value={date} onChange={onDate} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.eyebrow}>ሰዓት</Text>
              <EthiopianTimePicker value={time} onChange={onTime} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.eyebrow}>ሥፍራ (አማራጭ)</Text>
              <TextInput value={location} onChangeText={onLocation} placeholder="ቤተክርስቲያን / ቦታ" placeholderTextColor={THEME.colors.inkSubtle} style={styles.input} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.eyebrow}>ማስታወሻ (ኃጢአት አይጻፍ)</Text>
              <TextInput value={note} onChangeText={onNote} placeholder="ለምሳሌ፦ ከቅዳሴ በኋላ" placeholderTextColor={THEME.colors.inkSubtle} style={[styles.input, { height: 72, textAlignVertical: "top" }]} multiline />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <Pressable onPress={onClose} accessibilityRole="button" style={[styles.secondaryBtnSmall, { minHeight: 44 }]}><Text style={styles.secondaryBtnSmallText}>ሰርዝ</Text></Pressable>
              <Pressable onPress={onSubmit} disabled={busy || !isOnline} accessibilityRole="button" style={[styles.primaryBtnSmall, { minHeight: 44, backgroundColor: THEME.colors.sacredCrimson }, (busy || !isOnline) && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Check color="#fff" size={16} />}
                <Text style={styles.primaryBtnSmallText}>አስገባ</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EthiopianDatePicker({ value, onChange }: { value: EthiopianDate; onChange: (v: EthiopianDate) => void }) {
  const maxDay = getEthiopianMonthDays(value.year, value.month);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => getTodayEthiopian().year - 1 + i);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SmallSelect label={`${value.day}`} options={days.map((d) => ({ label: String(d), value: d }))} onSelect={(d) => onChange({ ...value, day: Number(d) })} />
        <SmallSelect label={ETHIOPIAN_MONTHS[value.month - 1]} options={ETHIOPIAN_MONTHS.map((m, i) => ({ label: m, value: i + 1 }))} onSelect={(m) => {
          const month = Number(m);
          const md = getEthiopianMonthDays(value.year, month);
          onChange({ ...value, month, day: Math.min(value.day, md) });
        }} flex={2} />
        <SmallSelect label={String(value.year)} options={yearOptions.map((y) => ({ label: String(y), value: y }))} onSelect={(y) => {
          const year = Number(y);
          const md = getEthiopianMonthDays(year, value.month);
          onChange({ ...value, year, day: Math.min(value.day, md) });
        }} />
      </View>
    </View>
  );
}

function EthiopianTimePicker({ value, onChange }: { value: EthiopianClockTime; onChange: (v: EthiopianClockTime) => void }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = [0, 15, 30, 45];
  const periods: Array<{ label: string; period: EthiopianClockTime["period"]; isNight: boolean }> = [
    { label: "ጥዋት", period: "ጥዋት", isNight: false },
    { label: "ከሰዓት", period: "ከሰዓት", isNight: false },
    { label: "ምሽት", period: "ምሽት", isNight: false },
    { label: "ማታ", period: "ማታ", isNight: true },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <SmallSelect label={String(value.hour)} options={hours.map((h) => ({ label: String(h), value: h }))} onSelect={(h) => onChange({ ...value, hour: Number(h) })} />
      <SmallSelect label={String(value.minute).padStart(2, "0")} options={minutes.map((m) => ({ label: String(m).padStart(2, "0"), value: m }))} onSelect={(m) => onChange({ ...value, minute: Number(m) })} />
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {periods.map((p) => (
          <Pressable key={p.label} onPress={() => onChange({ ...value, period: p.period, isNight: p.isNight })} accessibilityRole="button" style={[styles.pill, value.period === p.period && styles.pillActive, { minHeight: 44, minWidth: 44 }]}>
            <Text style={{ fontWeight: "700", color: value.period === p.period ? THEME.colors.sacredAmber : THEME.colors.inkMuted }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SmallSelect({ label, options, onSelect, flex = 1 }: { label: string; options: { label: string; value: any }[]; onSelect: (v: any) => void; flex?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex }}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[styles.input, { minHeight: 44, justifyContent: "center" }]}>
        <Text style={{ color: THEME.colors.inkPrimary, fontWeight: "700" }}>{label}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.modalCard, { maxHeight: "70%" }]}>
            <ScrollView>
              {options.map((o) => (
                <Pressable key={String(o.value)} onPress={() => { onSelect(o.value); setOpen(false); }} accessibilityRole="button" style={{ paddingVertical: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight }}>
                  <Text style={{ fontSize: 15, color: THEME.colors.inkPrimary }}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.sanctuaryBg },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: THEME.colors.sacredCrimson, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "900", color: THEME.colors.inkPrimary },
  muted: { fontSize: 12, color: THEME.colors.inkMuted },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radii.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 14, ...THEME.shadows.card },
  iconBtn: { minWidth: 44, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surface, alignItems: "center", justifyContent: "center" },
  primaryBtnSmall: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, backgroundColor: THEME.colors.buttonDark },
  primaryBtnSmallText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  secondaryBtnSmall: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surface },
  secondaryBtnSmallText: { color: THEME.colors.inkPrimary, fontWeight: "700", fontSize: 12 },
  badgeDot: { position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: THEME.colors.sacredCrimson, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeDotText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "900", color: THEME.colors.inkSecondary, letterSpacing: 0.5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  linkText: { color: THEME.colors.sacredCrimson, fontWeight: "700", fontSize: 12 },
  notifRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.borderLight, marginTop: 8, minHeight: 44 },
  notifUnread: { backgroundColor: THEME.colors.amberLight, borderColor: THEME.colors.amberBorder },
  notifTitle: { fontWeight: "800", color: THEME.colors.inkPrimary, fontSize: 12 },
  notifBody: { color: THEME.colors.inkSecondary, fontSize: 11, marginTop: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: THEME.colors.surface, borderRadius: 20, padding: 16 },
  input: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: THEME.colors.surfaceAlt, color: THEME.colors.inkPrimary },
  childChip: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surfaceAlt },
  childChipActive: { borderColor: THEME.colors.sacredAmber, backgroundColor: THEME.colors.amberLight },
  typeBtn: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surfaceAlt },
  typeBtnActive: { borderColor: THEME.colors.sacredAmber, backgroundColor: THEME.colors.amberLight },
  touch44: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  pill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  pillActive: { borderColor: THEME.colors.amberBorder, backgroundColor: THEME.colors.amberLight },
});
