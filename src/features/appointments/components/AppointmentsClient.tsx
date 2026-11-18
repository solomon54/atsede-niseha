// src/features/appointments/components/AppointmentsClient.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  User,
  WifiOff,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { pusherClient } from "@/services/pusher/client";
import EthiopianDateInput from "@/shared/components/ui/EthiopianDateInput";
import EthiopianTimeInput from "@/shared/components/ui/EthiopianTimeInput";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import {
  type AppointmentAction,
  type AppointmentActionPayload,
  type AppointmentChildDirectoryEntry,
  type AppointmentDetailResponse,
  type AppointmentParticipant,
  type AppointmentRecord,
  type AppointmentStatus,
  type AppointmentType,
  buildChildAppointmentOverviews,
  getAvailableAppointmentActions,
  getChildDisplayName,
  getFatherDisplayName,
  getNowIso,
  isAppointmentParty,
  isConfirmedOverdue,
  isUpcomingConfirmed,
  normalizeAppointment,
} from "@/shared/domain/appointments";
import {
  formatAppointmentEvent,
  getAppointmentStatusLabel,
  getAppointmentTypeLabel,
  getQueuedActionLabel,
} from "@/shared/domain/appointments/terminology";
import {
  type EthiopianClockTime,
  type EthiopianDate,
  ethiopianDateTimeToDate,
  formatEthiopianDateTimeInEAT,
  getTodayEthiopian,
  gregorianToEthiopian,
  westernToEthiopianClock,
} from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

import {
  loadRecentTemplates,
  LOCATION_TEMPLATES,
  MESSAGE_TEMPLATES,
  rememberTemplate,
} from "../constants/templates";
import {
  AppointmentOfflineError,
  appointmentOfflineService,
  onAppointmentOutboxChanged,
} from "../services/appointmentOfflineService";
import type { InAppNotification } from "../types/appointment.types";

type Props = {
  role: "FATHER" | "STUDENT";
  uid: string;
  familyId: string;
};

type Actor = { uid: string; role: "FATHER" | "STUDENT" };

type OutboxUiRow = {
  operationId: string;
  action: AppointmentAction;
  status: string;
  needsAttention?: boolean;
  lastError?: string;
};

type ViewState =
  | { kind: "overview" }
  | { kind: "child"; childUid: string }
  | { kind: "detail"; appointmentId: string };

function makeOperationId(prefix: string): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
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

function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case "REQUESTED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DECLINED":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "COMPLETED":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  const initial = (name || "?").trim().charAt(0) || "?";
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={name}
      className="rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full border border-amber-200 bg-amber-50 text-amber-900 font-black flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.4) }}
      aria-label={name}
    >
      {initial}
    </div>
  );
}

function roleLabel(role: "FATHER" | "CHILD" | "STUDENT"): string {
  if (role === "FATHER") return "አባት";
  return "ልጅ";
}

export default function AppointmentsClient({ role, uid, familyId }: Props) {
  void familyId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const actor: Actor = useMemo(() => ({ uid, role }), [uid, role]);

  const childParam = searchParams.get("child");
  const appointmentParam = searchParams.get("appointment");

  const view: ViewState = useMemo(() => {
    if (appointmentParam) return { kind: "detail", appointmentId: appointmentParam };
    if (childParam && role === "FATHER") return { kind: "child", childUid: childParam };
    return { kind: "overview" };
  }, [appointmentParam, childParam, role]);

  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [children, setChildren] = useState<AppointmentChildDirectoryEntry[]>([]);
  const [fatherInfo, setFatherInfo] = useState<{
    name: string;
    photoUrl?: string;
    title?: string;
  }>({ name: "አባት" });

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [outboxRows, setOutboxRows] = useState<
    Awaited<ReturnType<typeof appointmentOfflineService.listOutbox>>
  >([]);

  const [showBell, setShowBell] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createChildUid, setCreateChildUid] = useState<string>("");

  // Detail state
  const [detail, setDetail] = useState<AppointmentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<EthiopianDate>(() => {
    const t = getTodayEthiopian();
    return { year: t.year, month: t.month, day: t.day };
  });
  const [rescheduleTime, setRescheduleTime] = useState<EthiopianClockTime>(defaultFutureTime());
  const [confirmAction, setConfirmAction] = useState<AppointmentAction | null>(null);

  const refreshOutbox = useCallback(async () => {
    if (!uid) return;
    const rows = await appointmentOfflineService.listOutbox(uid);
    setOutboxRows(rows);
  }, [uid]);

  const applyListData = useCallback(
    (data: {
      appointments: AppointmentRecord[];
      children?: AppointmentChildDirectoryEntry[];
      fatherName?: string;
      fatherPhotoUrl?: string;
      fatherTitle?: string;
    }) => {
      const normalized = (data.appointments || [])
        .map((a) => normalizeAppointment(a))
        .filter((a) => isAppointmentParty(a, uid));
      setAppointments(normalized);
      if (data.children) setChildren(data.children);
      if (data.fatherName || data.fatherPhotoUrl || data.fatherTitle) {
        setFatherInfo({
          name: data.fatherName || "አባት",
          photoUrl: data.fatherPhotoUrl,
          title: data.fatherTitle,
        });
      }
    },
    [uid]
  );

  const loadFromCache = useCallback(async () => {
    if (!uid) return;
    const [cachedApts, cachedChildren] = await Promise.all([
      appointmentOfflineService.readCachedAppointments(uid),
      appointmentOfflineService.readCachedChildren(uid),
    ]);
    if (cachedApts.length > 0) {
      setAppointments(cachedApts.filter((a) => isAppointmentParty(a, uid)));
    }
    if (cachedChildren.length > 0) setChildren(cachedChildren);
  }, [uid]);

  const fetchServer = useCallback(
    async (silent = false) => {
      if (!uid) return;
      if (!silent) setRefreshing(true);
      try {
        const [aptRes, notifRes] = await Promise.all([
          fetch("/api/appointments", { cache: "no-store" }),
          fetch("/api/notifications", { cache: "no-store" }),
        ]);

        if (aptRes.ok) {
          const json = await aptRes.json();
          if (json?.success) {
            applyListData(json);
            await appointmentOfflineService.writeListSnapshot({
              ownerUid: uid,
              appointments: json.appointments || [],
              children: json.children || [],
            });
            setError(null);
          } else if (json?.error) {
            setError(json.error);
          }
        } else if (aptRes.status === 401) {
          setError("እባክዎ እንደገና ይግቡ።");
        } else {
          const j = await aptRes.json().catch(() => ({}));
          setError(j?.error || "ቀጠሮዎችን ማምጣት አልተሳካም");
        }

        if (notifRes.ok) {
          const nj = await notifRes.json();
          if (nj?.success) {
            setNotifications(nj.notifications || []);
            setUnreadCount(nj.unreadCount || 0);
          }
        }
      } catch {
        if (navigator.onLine) setError("ቀጠሮዎችን ማምጣት አልተሳካም");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [uid, applyListData]
  );

  // Initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadFromCache();
      await refreshOutbox();
      if (!alive) return;
      setLoading(false);
      await fetchServer(true);
      await appointmentOfflineService.drain(uid);
      await refreshOutbox();
      if (alive) await fetchServer(true);
    })();
    return () => {
      alive = false;
    };
  }, [uid, loadFromCache, fetchServer, refreshOutbox]);

  // Online/offline + drain triggers
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      appointmentOfflineService
        .drain(uid)
        .then(() => refreshOutbox())
        .then(() => fetchServer(true))
        .catch(() => {});
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [uid, fetchServer, refreshOutbox]);

  useEffect(() => onAppointmentOutboxChanged(uid, refreshOutbox), [uid, refreshOutbox]);

  // Realtime per-user private channel (authorized by /api/message/auth)
  useEffect(() => {
    if (!uid) return;
    const channelName = `private-appointments-${uid}`;
    const ch = pusherClient.subscribe(channelName);

    const onUpdate = (
      event: { type?: string; appointment?: unknown; notification?: unknown } | null
    ) => {
      if (event?.type === "appointment.upsert" && event.appointment) {
        const rec = normalizeAppointment(event.appointment as AppointmentRecord);
        if (!isAppointmentParty(rec, uid)) return;
        setAppointments((prev) => {
          const idx = prev.findIndex((a) => a.id === rec.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = rec;
            return next;
          }
          return [rec, ...prev];
        });
        appointmentOfflineService.upsertConfirmedAppointment(uid, rec).catch(() => {});
        // keep detail in sync
        setDetail((prev) =>
          prev && prev.appointment.id === rec.id
            ? { ...prev, appointment: rec }
            : prev
        );
      } else if (event?.type === "notification.new" && event.notification) {
        const n = event.notification as InAppNotification;
        if (n.userId !== uid) return;
        setNotifications((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev;
          return [n, ...prev];
        });
        if (!n.read) setUnreadCount((c) => c + 1);
      }
    };

    ch.bind("sanctuary-update", onUpdate);
    return () => {
      ch.unbind("sanctuary-update", onUpdate);
      pusherClient.unsubscribe(channelName);
    };
  }, [uid]);

  const navigate = useCallback(
    (next: { child?: string | null; appointment?: string | null }) => {
      const params = new URLSearchParams();
      if (next.child) params.set("child", next.child);
      if (next.appointment) params.set("appointment", next.appointment);
      const qs = params.toString();
      router.push(qs ? `/appointments?${qs}` : "/appointments");
    },
    [router]
  );

  const openChild = (childUid: string) => navigate({ child: childUid });
  const openAppointment = useCallback(
    (appointmentId: string) => navigate({ appointment: appointmentId }),
    [navigate]
  );
  const goBack = () => {
    if (view.kind === "detail") {
      // If father came from child room, try to go back there
      const appt = appointments.find((a) => a.id === view.appointmentId);
      if (role === "FATHER" && appt?.childUid && childParam) {
        navigate({ child: childParam });
      } else {
        navigate({});
      }
    } else {
      navigate({});
    }
  };

  // Load detail when needed
  useEffect(() => {
    if (view.kind !== "detail") {
      setDetail(null);
      setDetailError(null);
      setRescheduleOpen(false);
      setActionMessage(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    setActionMessage(null);
    setRescheduleOpen(false);

    const cached = appointments.find((a) => a.id === view.appointmentId);
    // Optimistic show from cache while fetching authoritative detail
    if (cached) {
      // minimal placeholder; will be replaced
    }

    (async () => {
      try {
        const res = await fetch(`/api/appointments/${view.appointmentId}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && json?.success) {
          const rec = normalizeAppointment(json.appointment);
          setDetail({
            success: true,
            appointment: rec,
            events: json.events || [],
            participants: json.participants,
            availableActions: json.availableActions || [],
          });
          appointmentOfflineService.upsertConfirmedAppointment(uid, rec).catch(() => {});
          setAppointments((prev) => {
            const idx = prev.findIndex((a) => a.id === rec.id);
            if (idx >= 0) {
              const n = [...prev];
              n[idx] = rec;
              return n;
            }
            return [rec, ...prev];
          });
        } else if (res.status === 404) {
          setDetailError("ቀጠሮው አልተገኘም ወይም ተደምስሷል።");
          appointmentOfflineService.removeCachedAppointment(uid, view.appointmentId).catch(() => {});
          setAppointments((prev) => prev.filter((a) => a.id !== view.appointmentId));
        } else if (res.status === 403) {
          setDetailError("ይህን ቀጠሮ ለማየት ፈቃድ የለዎትም።");
        } else if (res.status === 401) {
          setDetailError("እባክዎ እንደገና ይግቡ።");
        } else {
          setDetailError(json?.error || "ቀጠሮውን ማምጣት አልተሳካም");
        }
      } catch {
        if (!alive) return;
        if (cached) {
          setDetail({
            success: true,
            appointment: cached,
            events: [],
            participants: {
              father: { uid: cached.fatherUid, role: "FATHER", displayName: getFatherDisplayName(cached) },
              child: { uid: cached.childUid, role: "CHILD", displayName: getChildDisplayName(cached), eotcUid: cached.childEotcUid },
            },
            availableActions: getAvailableAppointmentActions(cached, actor),
          });
          setDetailError(null);
        } else {
          setDetailError("ቀጠሮውን ማምጣት አልተሳካም");
        }
      } finally {
        if (alive) setDetailLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [view, uid, actor, appointments, childParam]);

  const outboxByAppointment = useMemo(() => {
    const map = new Map<string, (typeof outboxRows)[number]>();
    for (const row of outboxRows) map.set(row.appointmentId, row);
    return map;
  }, [outboxRows]);

  const queueAction = useCallback(
    async (
      appointment: AppointmentRecord,
      action: AppointmentAction,
      payload?: AppointmentActionPayload
    ) => {
      const operationId = makeOperationId("act");
      try {
        await appointmentOfflineService.queueAction({
          ownerUid: uid,
          appointmentId: appointment.id,
          action,
          expectedVersion: appointment.version,
          payload,
          operationId,
        });
        await refreshOutbox();
        await appointmentOfflineService.drain(uid);
        await refreshOutbox();
        await fetchServer(true);
        // refresh detail if open
        if (view.kind === "detail" && view.appointmentId === appointment.id) {
          const res = await fetch(`/api/appointments/${appointment.id}`, { cache: "no-store" });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.success) {
            const rec = normalizeAppointment(j.appointment);
            setDetail({
              success: true,
              appointment: rec,
              events: j.events || [],
              participants: j.participants,
              availableActions: j.availableActions || [],
            });
          }
        }
        setActionMessage("እርምጃው ተልኳል።");
      } catch (e) {
        if (e instanceof AppointmentOfflineError) {
          setActionMessage(e.message);
        } else {
          setActionMessage("እርምጃውን ማስቀመጥ አልተሳካም።");
        }
        await refreshOutbox();
      }
    },
    [uid, fetchServer, refreshOutbox, view]
  );

  const performAction = useCallback(
    async (
      appointment: AppointmentRecord,
      action: AppointmentAction,
      payload?: AppointmentActionPayload
    ) => {
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
        const scheduledAt = ethiopianDateTimeToDate(
          rescheduleDate,
          rescheduleTime
        ).toISOString();
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
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const onNotificationClick = useCallback(
    async (n: InAppNotification) => {
      if (!n.read) await markOneRead(n.id);
      setShowBell(false);
      if (n.appointmentId) openAppointment(n.appointmentId);
    },
    [markOneRead, openAppointment]
  );

  // Derived overview
  const nowIso = getNowIso();
  const nowDate = useMemo(() => new Date(nowIso), [nowIso]);
  const overview = useMemo(
    () =>
      role === "FATHER"
        ? buildChildAppointmentOverviews({
            appointments,
            children,
            viewerUid: uid,
            now: nowDate,
          })
        : null,
    [appointments, children, role, uid, nowDate]
  );

  const knownChildUidSet = useMemo(
    () => new Set(children.map((c) => c.uid)),
    [children]
  );

  const unmatchedAppointments = useMemo(() => {
    if (role !== "FATHER") return [] as AppointmentRecord[];
    return appointments
      .filter((a) => a.fatherUid === uid && !knownChildUidSet.has(a.childUid))
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }, [appointments, role, uid, knownChildUidSet]);

  const studentBuckets = useMemo(() => {
    if (role !== "STUDENT") return null;
    const mine = appointments
      .filter((a) => a.childUid === uid)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return {
      awaitingMyResponse: mine.filter(
        (a) => a.status === "REQUESTED" && a.pendingResponseFrom === uid
      ),
      awaitingFather: mine.filter(
        (a) => a.status === "REQUESTED" && a.pendingResponseFrom !== uid
      ),
      upcomingConfirmed: mine.filter((a) => isUpcomingConfirmed(a, nowIso)),
      overdueConfirmed: mine.filter((a) => isConfirmedOverdue(a, nowIso)),
      past: mine
        .filter(
          (a) =>
            a.status === "DECLINED" ||
            a.status === "CANCELLED" ||
            a.status === "COMPLETED" ||
            (a.status === "CONFIRMED" && isConfirmedOverdue(a, nowIso))
        )
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    };
  }, [appointments, role, uid, nowIso]);

  const childRoomAppointments = useMemo(() => {
    if (view.kind !== "child") return [];
    return appointments
      .filter((a) => a.childUid === view.childUid)
      .sort((a, b) => {
        // action-needed first, then upcoming asc, then others desc
        const aNeeds = a.status === "REQUESTED" && a.pendingResponseFrom === uid ? 0 : 1;
        const bNeeds = b.status === "REQUESTED" && b.pendingResponseFrom === uid ? 0 : 1;
        if (aNeeds !== bNeeds) return aNeeds - bNeeds;
        return a.scheduledAt.localeCompare(b.scheduledAt);
      });
  }, [appointments, view, uid]);

  const roomChild = useMemo(() => {
    if (view.kind !== "child") return null;
    return (
      children.find((c) => c.uid === view.childUid) || {
        uid: view.childUid,
        displayName:
          appointments.find((a) => a.childUid === view.childUid)?.childName || "ልጅ",
      }
    );
  }, [view, children, appointments]);

  // Create form state
  const today = getTodayEthiopian();
  const [createType, setCreateType] = useState<AppointmentType>("NISEHA");
  const [createDate, setCreateDate] = useState<EthiopianDate>({
    year: today.year,
    month: today.month,
    day: today.day,
  });
  const [createTime, setCreateTime] = useState<EthiopianClockTime>(defaultFutureTime());
  const [createLocation, setCreateLocation] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const recent = useRef(loadRecentTemplates());

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

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!isOnline) {
      setCreateError("ቀጠሮ ለመፍጠር የኢንተርኔት ግንኙነት ያስፈልጋል።");
      return;
    }
    const targetChildUid = role === "STUDENT" ? uid : createChildUid;
    if (!targetChildUid) {
      setCreateError("እባክዎ ልጅ ይምረጡ።");
      return;
    }
    setCreateBusy(true);
    try {
      const scheduledAt = ethiopianDateTimeToDate(createDate, createTime).toISOString();
      if (createLocation) rememberTemplate("locations", createLocation);
      if (createNote) rememberTemplate("messages", createNote);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: makeOperationId("create"),
          childUid: targetChildUid,
          type: createType,
          scheduledAt,
          location: createLocation || undefined,
          message: createNote || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setCreateError(json?.error || "ቀጠሮ መፍጠር አልተሳካም");
        return;
      }
      const rec = normalizeAppointment(json.appointment);
      await appointmentOfflineService.upsertConfirmedAppointment(uid, rec);
      setAppointments((prev) => {
        const idx = prev.findIndex((a) => a.id === rec.id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = rec;
          return n;
        }
        return [rec, ...prev];
      });
      setShowCreate(false);
      recent.current = loadRecentTemplates();
      await fetchServer(true);
      // navigate to detail for clarity
      openAppointment(rec.id);
    } catch {
      setCreateError("ቀጠሮ መፍጠር አልተሳካም");
    } finally {
      setCreateBusy(false);
    }
  };

  const renderOutboxBadge = (appointmentId: string) => {
    const row = outboxByAppointment.get(appointmentId);
    if (!row) return null;
    if (row.status === "FAILED" && row.needsAttention) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> ቀጠሮው ተለውጧል
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" /> በመላክ ላይ
      </span>
    );
  };

  const AppointmentRow = ({ a }: { a: AppointmentRecord }) => {
    const ob = outboxByAppointment.get(a.id);
    const isOverdue = isConfirmedOverdue(a, nowIso);
    const needsMyResponse = a.status === "REQUESTED" && a.pendingResponseFrom === uid;
    const child = children.find((c) => c.uid === a.childUid);
    return (
      <button
        type="button"
        onClick={() => openAppointment(a.id)}
        className={cn(
          "w-full text-left rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-400/40",
          ob?.status === "FAILED" && ob.needsAttention
            ? "border-red-200"
            : "border-slate-200"
        )}
      >
        <div className="flex items-start gap-3">
          {role === "FATHER" && (
            <Avatar
              name={child?.displayName || getChildDisplayName(a)}
              photoUrl={child?.photoUrl}
              size={40}
            />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black text-[#9b2d30]">
                {getAppointmentTypeLabel(a.type)}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  statusBadgeClass(a.status)
                )}
              >
                {getAppointmentStatusLabel(a.status)}
              </span>
              {isOverdue && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                  ጊዜው አልፏል
                </span>
              )}
              {needsMyResponse && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  ምላሽ ይጠበቃል
                </span>
              )}
              {ob && renderOutboxBadge(a.id)}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">
                {role === "FATHER"
                  ? child?.displayName || getChildDisplayName(a)
                  : getFatherDisplayName(a)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatEthiopianDateTimeInEAT(a.scheduledAt)}</span>
            </div>
            {a.location && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{a.location}</span>
              </div>
            )}
            {ob?.status === "FAILED" && ob.needsAttention && ob.lastError && (
              <p className="text-[11px] text-red-700 mt-1">{ob.lastError}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
        </div>
      </button>
    );
  };

  // ---------- Views ----------

  const Header = ({ title, back }: { title: string; back?: boolean }) => (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {back && (
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              aria-label="ተመለስ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#9b2d30] font-black">
              ቀጠሮ
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {title}
            </h1>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowBell((v) => !v)}
          className="relative p-2.5 rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-label="ማሳሰቢያዎች"
        >
          <Bell className="w-4 h-4 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#9b2d30] text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-[11px] font-black"
        >
          <Plus className="w-3.5 h-3.5" /> አዲስ
        </button>
        <button
          type="button"
          onClick={() => fetchServer()}
          aria-label="አድስ"
          className="p-2.5 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </button>
      </div>
    </header>
  );

  const NotificationsPanel = () =>
    showBell ? (
      <SanctuarySurface className="p-4 space-y-3" aria-label="ማሳሰቢያዎች">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">ማሳሰቢያዎች</h2>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="text-[11px] text-[#9b2d30] font-bold">
              ሁሉንም አንብብ
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">ምንም ማሳሰቢያ የለም</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onNotificationClick(n)}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-2.5 border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/40",
                    n.read
                      ? "bg-slate-50 border-slate-100 text-slate-500"
                      : "bg-amber-50/80 border-amber-100 text-slate-800"
                  )}
                >
                  <p className="font-bold text-xs">{n.title}</p>
                  <p className="text-[11px] mt-0.5 opacity-80">{n.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SanctuarySurface>
    ) : null;

  const Banner = () => (
    <>
      {!isOnline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>ከመስመር ውጭ ነዎት። የተቀመጡ ቀጠሮዎች ይታያሉ፤ የተሰለፉ እርምጃዎች ሲገናኙ ይላካሉ።</span>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="ዝጋ">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );

  // ---------- Render main content by view ----------
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-3 sm:px-6 py-10 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest">በመጫን ላይ…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-10 space-y-5">
      {view.kind === "overview" && (
        <>
          <Header title={role === "FATHER" ? "የልጆች ቀጠሮዎች" : "ቀጠሮዎቼ"} />
          <NotificationsPanel />
          <Banner />
          {role === "FATHER" && overview ? (
            <FatherOverview
              overview={overview}
              unmatchedAppointments={unmatchedAppointments}
              onOpenChild={openChild}
              onCreate={(childUid) => openCreate(childUid)}
              onOpenAppointment={openAppointment}
            />
          ) : studentBuckets ? (
            <StudentOverview
              buckets={studentBuckets}
              father={fatherInfo}
              renderRow={(a) => <AppointmentRow key={a.id} a={a} />}
              onCreate={() => openCreate()}
            />
          ) : null}
        </>
      )}

      {view.kind === "child" && role === "FATHER" && roomChild && (
        <>
          <Header title={roomChild.displayName} back />
          <NotificationsPanel />
          <Banner />
          <ChildRoom
            child={roomChild}
            appointments={childRoomAppointments}
            renderRow={(a) => <AppointmentRow key={a.id} a={a} />}
            onCreate={() => openCreate(roomChild.uid)}
          />
        </>
      )}

      {view.kind === "detail" && (
        <>
          <Header title="የቀጠሮ ዝርዝር" back />
          <NotificationsPanel />
          <Banner />
          <DetailView
            detail={detail}
            loading={detailLoading}
            error={detailError}
            actor={actor}
            outboxRow={outboxByAppointment.get(view.appointmentId)}
            actionBusy={actionBusy}
            actionMessage={actionMessage}
            rescheduleOpen={rescheduleOpen}
            rescheduleDate={rescheduleDate}
            rescheduleTime={rescheduleTime}
            confirmAction={confirmAction}
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
            onDismissFailed={async (opId) => {
              await appointmentOfflineService.removeOutboxOperation(uid, opId);
              await refreshOutbox();
              await fetchServer(true);
            }}
            onRetry={() => fetchServer()}
          />
        </>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            role={role}
            uid={uid}
            isOnline={isOnline}
            childrenOptions={children}
            childUid={role === "STUDENT" ? uid : createChildUid}
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
            recent={recent.current}
            onClose={() => setShowCreate(false)}
            onSubmit={submitCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Subviews ---------------- */

function FatherOverview({
  overview,
  unmatchedAppointments,
  onOpenChild,
  onCreate,
  onOpenAppointment,
}: {
  overview: ReturnType<typeof buildChildAppointmentOverviews>;
  unmatchedAppointments: AppointmentRecord[];
  onOpenChild: (childUid: string) => void;
  onCreate: (childUid: string) => void;
  onOpenAppointment: (id: string) => void;
}) {
  // buildChildAppointmentOverviews already includes synthetic entries for
  // unmatched children; keep a separate "ሌሎች ቀጠሮዎች" section only for records
  // that truly cannot be grouped (defensive).
  const directoryChildren = overview.filter((item) => item.child.displayName !== "ልጅ" || true);

  return (
    <div className="space-y-4">
      {directoryChildren.length === 0 && unmatchedAppointments.length === 0 ? (
        <SanctuarySurface className="p-8 text-center space-y-3">
          <CalendarClock className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">የተመዘገቡ ልጆች አልተገኙም</p>
          <p className="text-xs text-slate-500">ቀጠሮ ለመፍጠር በመጀመሪያ ልጅ መኖር አለበት።</p>
        </SanctuarySurface>
      ) : (
        <div className="grid gap-3">
          {directoryChildren.map((item) => {
            const needs = item.attentionNeeded > 0;
            const waitingChild = item.awaitingOtherParty > 0;
            const upcomingCount = Math.max(0, item.confirmed - item.overdueConfirmed);
            return (
              <div
                key={item.child.uid}
                className={cn(
                  "rounded-2xl border bg-white p-4 shadow-sm",
                  needs ? "border-amber-300" : "border-slate-200"
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenChild(item.child.uid)}
                  className="w-full text-left focus:outline-none focus:ring-2 focus:ring-amber-400/40 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={item.child.displayName}
                      photoUrl={item.child.photoUrl}
                      size={48}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900 truncate">
                          {item.child.displayName}
                        </p>
                        {item.child.spiritualTitle && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {item.child.spiritualTitle}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {needs && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            ምላሽ ይጠበቃል: {item.attentionNeeded}
                          </span>
                        )}
                        {waitingChild && !needs && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            የልጅ ምላሽ ይጠበቃል
                          </span>
                        )}
                        {upcomingCount > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            መጪ: {upcomingCount}
                          </span>
                        )}
                        {item.total === 0 && (
                          <span className="text-[11px] font-bold text-slate-400">
                            ቀጠሮ የለም
                          </span>
                        )}
                      </div>
                      {item.nearestUpcomingConfirmed && (
                        <p className="mt-2 text-xs text-slate-600">
                          ቀጣይ ቀጠሮ: {formatEthiopianDateTimeInEAT(item.nearestUpcomingConfirmed.scheduledAt)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCreate(item.child.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> ቀጠሮ ፍጠር
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChild(item.child.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-[11px] font-bold"
                  >
                    ክፈት
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unmatchedAppointments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-1">
            ሌሎች ቀጠሮዎች
          </h2>
          <div className="space-y-2">
            {unmatchedAppointments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenAppointment(a.id)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{getChildDisplayName(a)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getAppointmentTypeLabel(a.type)} • {formatEthiopianDateTimeInEAT(a.scheduledAt)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StudentBucketSection({
  title,
  items,
  renderRow,
}: {
  title: string;
  items: AppointmentRecord[];
  renderRow: (a: AppointmentRecord) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-1">
        {title} ({items.length})
      </h2>
      <div className="space-y-2">{items.map(renderRow)}</div>
    </section>
  );
}

function StudentOverview({
  buckets,
  father,
  renderRow,
  onCreate,
}: {
  buckets: NonNullable<ReturnType<typeof Object>> & {
    awaitingMyResponse: AppointmentRecord[];
    awaitingFather: AppointmentRecord[];
    upcomingConfirmed: AppointmentRecord[];
    overdueConfirmed: AppointmentRecord[];
    past: AppointmentRecord[];
  };
  father: { name: string; photoUrl?: string; title?: string };
  renderRow: (a: AppointmentRecord) => React.ReactNode;
  onCreate: () => void;
}) {
  const empty =
    buckets.awaitingMyResponse.length === 0 &&
    buckets.awaitingFather.length === 0 &&
    buckets.upcomingConfirmed.length === 0 &&
    buckets.overdueConfirmed.length === 0 &&
    buckets.past.length === 0;

  return (
    <div className="space-y-4">
      <SanctuarySurface className="p-4 flex items-center gap-3">
        <Avatar name={father.name} photoUrl={father.photoUrl} size={48} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">አባት</p>
          <p className="font-black text-slate-900">{father.name}</p>
          {father.title && <p className="text-xs text-slate-500">{father.title}</p>}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> ጠይቅ
          </button>
        </div>
      </SanctuarySurface>

      {empty ? (
        <div className="py-12 text-center text-slate-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold text-sm">ምንም ቀጠሮ የለዎትም</p>
        </div>
      ) : (
        <>
          <StudentBucketSection title="ምላሽዎን የሚጠብቁ" items={buckets.awaitingMyResponse} renderRow={renderRow} />
          <StudentBucketSection title="የአባት ምላሽ የሚጠብቁ" items={buckets.awaitingFather} renderRow={renderRow} />
          <StudentBucketSection title="መጪ የተረጋገጡ" items={buckets.upcomingConfirmed} renderRow={renderRow} />
          <StudentBucketSection title="ጊዜው ያለፈባቸው" items={buckets.overdueConfirmed} renderRow={renderRow} />
          <StudentBucketSection title="ያለፉ / የተዘጉ" items={buckets.past} renderRow={renderRow} />
        </>
      )}
    </div>
  );
}

function ChildRoom({
  child,
  appointments,
  renderRow,
  onCreate,
}: {
  child: AppointmentChildDirectoryEntry;
  appointments: AppointmentRecord[];
  renderRow: (a: AppointmentRecord) => React.ReactNode;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-4">
      <SanctuarySurface className="p-4 flex items-center gap-3">
        <Avatar name={child.displayName} photoUrl={child.photoUrl} size={52} />
        <div className="min-w-0">
          <p className="font-black text-slate-900">{child.displayName}</p>
          {child.spiritualTitle && (
            <p className="text-xs text-slate-500">{child.spiritualTitle}</p>
          )}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#9b2d30] text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> ቀጠሮ ፍጠር
          </button>
        </div>
      </SanctuarySurface>
      {appointments.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <p className="font-bold text-sm">ለዚህ ልጅ ቀጠሮ የለም</p>
        </div>
      ) : (
        <div className="space-y-2">{appointments.map(renderRow)}</div>
      )}
    </div>
  );
}

function DetailView(props: {
  detail: AppointmentDetailResponse | null;
  loading: boolean;
  error: string | null;
  actor: Actor;
  outboxRow?: OutboxUiRow;
  actionBusy: string | null;
  actionMessage: string | null;
  rescheduleOpen: boolean;
  rescheduleDate: EthiopianDate;
  rescheduleTime: EthiopianClockTime;
  confirmAction: AppointmentAction | null;
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
    detail,
    loading,
    error,
    actor,
    outboxRow,
    actionBusy,
    actionMessage,
    rescheduleOpen,
    rescheduleDate,
    rescheduleTime,
    confirmAction,
    onCloseReschedule,
    onRescheduleDate,
    onRescheduleTime,
    onSubmitReschedule,
    onAction,
    onConfirmAction,
    onCancelConfirmAction,
    onDismissFailed,
    onRetry,
  } = props;

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs font-bold">በመጫን ላይ…</p>
      </div>
    );
  }
  if (error) {
    return (
      <SanctuarySurface className="p-6 space-y-3 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
        <p className="font-bold text-slate-800">{error}</p>
        <button type="button" onClick={onRetry} className="text-sm font-bold text-[#9b2d30]">
          እንደገና ሞክር
        </button>
      </SanctuarySurface>
    );
  }
  if (!detail) return null;

  const a = detail.appointment;
  const participants = detail.participants;
  const subject = participants.child;
  const father = participants.father;
  const actions = outboxRow ? [] : detail.availableActions || getAvailableAppointmentActions(a, actor);
  const isOverdue = isConfirmedOverdue(a, getNowIso());

  const responder =
    a.status === "REQUESTED"
      ? a.pendingResponseFrom === a.fatherUid
        ? father
        : subject
      : null;

  const currentProposer =
    a.currentProposerUid === a.fatherUid ? father : subject;

  return (
    <div className="space-y-4">
      {outboxRow && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm flex items-start gap-2",
            outboxRow.status === "FAILED" && outboxRow.needsAttention
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-900"
          )}
        >
          {outboxRow.status === "FAILED" && outboxRow.needsAttention ? (
            <AlertTriangle className="w-4 h-4 mt-0.5" />
          ) : (
            <Loader2 className="w-4 h-4 mt-0.5 animate-spin" />
          )}
          <div className="flex-1">
            <p className="font-bold">
              {outboxRow.status === "FAILED" && outboxRow.needsAttention
                ? "ቀጠሮው ተለውጧል"
                : `በመላክ ላይ: ${getQueuedActionLabel(outboxRow.action)}`}
            </p>
            {outboxRow.lastError && <p className="text-xs mt-0.5">{outboxRow.lastError}</p>}
            {outboxRow.status === "FAILED" && outboxRow.needsAttention && (
              <button
                type="button"
                onClick={() => onDismissFailed(outboxRow.operationId)}
                className="mt-2 text-xs font-bold underline"
              >
                እርምጃውን አጽዳ
              </button>
            )}
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {actionMessage}
        </div>
      )}

      <SanctuarySurface className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-[#9b2d30]">
            {getAppointmentTypeLabel(a.type)}
          </span>
          <span
            className={cn(
              "text-[11px] font-bold px-2.5 py-1 rounded-full border",
              statusBadgeClass(a.status)
            )}
          >
            {getAppointmentStatusLabel(a.status)}
          </span>
          {isOverdue && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
              ጊዜው አልፏል
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <PartyBlock label="አባት" party={father} highlight={actor.role === "FATHER"} />
          <PartyBlock label="ልጅ (ባለቤት)" party={subject} highlight={actor.role === "STUDENT"} />
        </div>

        <div className="space-y-2 text-sm">
          <InfoRow icon={<User className="w-4 h-4" />} label="የአሁኑ አቅራቢ">
            {currentProposer.displayName} ({roleLabel(currentProposer.role)})
          </InfoRow>
          {responder && (
            <InfoRow icon={<Clock className="w-4 h-4" />} label="ምላስ የሚሰጥ">
              {responder.displayName} ({roleLabel(responder.role)})
            </InfoRow>
          )}
          <InfoRow icon={<CalendarClock className="w-4 h-4" />} label="ቀን / ሰዓት">
            {formatEthiopianDateTimeInEAT(a.scheduledAt)}
          </InfoRow>
          {a.location && (
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="ቦታ">
              {a.location}
            </InfoRow>
          )}
          {(a.message || a.logisticsNote) && (
            <InfoRow icon={<MessageSquare className="w-4 h-4" />} label="ማስታወሻ">
              {a.message || a.logisticsNote}
            </InfoRow>
          )}
          <InfoRow icon={<Clock className="w-4 h-4" />} label="የተፈጠረበት">
            {formatEthiopianDateTimeInEAT(a.createdAt)}
          </InfoRow>
          <InfoRow icon={<Clock className="w-4 h-4" />} label="የተዘመነበት">
            {formatEthiopianDateTimeInEAT(a.updatedAt)}
          </InfoRow>
        </div>

        {!a.identityConsistent && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            የዚህ ቀጠሮ የማንነት መረጃ አይጣጣምም። ለደህንነት ሲባል ማስተካከያ እስኪደረግ እርምጃ አይፈቀድም።
          </div>
        )}
      </SanctuarySurface>

      {actions.length > 0 && (
        <SanctuarySurface className="p-4 space-y-3">
          <h3 className="text-sm font-black text-slate-900">የሚፈቀዱ እርምጃዎች</h3>
          <div className="flex flex-wrap gap-2">
            {actions.includes("CONFIRM") && (
              <ActionButton
                label="ተቀበል"
                busy={actionBusy === "CONFIRM"}
                onClick={() => onAction("CONFIRM")}
                variant="primary"
              />
            )}
            {actions.includes("DECLINE") && (
              <ActionButton
                label="አትቀበል"
                busy={actionBusy === "DECLINE"}
                onClick={() => onAction("DECLINE")}
                variant="danger"
              />
            )}
            {actions.includes("RESCHEDULE") && (
              <ActionButton
                label="ቀን ቀይር"
                busy={actionBusy === "RESCHEDULE"}
                onClick={() => onAction("RESCHEDULE")}
                variant="secondary"
              />
            )}
            {actions.includes("CANCEL") && (
              <ActionButton
                label="ሰርዝ"
                busy={actionBusy === "CANCEL"}
                onClick={() => onAction("CANCEL")}
                variant="danger"
              />
            )}
            {actions.includes("COMPLETE") && (
              <ActionButton
                label="ተጠናቋል ምልክት አድርግ"
                busy={actionBusy === "COMPLETE"}
                onClick={() => onAction("COMPLETE")}
                variant="primary"
              />
            )}
          </div>

          {rescheduleOpen && actions.includes("RESCHEDULE") && (
            <div className="mt-3 space-y-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-800">
                አዲስ ቀን / ሰዓት
              </p>
              <EthiopianDateInput value={rescheduleDate} onChange={onRescheduleDate} allowFutureYears={3} />
              <EthiopianTimeInput value={rescheduleTime} onChange={onRescheduleTime} />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCloseReschedule} className="px-4 py-2 rounded-xl text-xs text-slate-600">
                  ዝጋ
                </button>
                <button
                  type="button"
                  onClick={onSubmitReschedule}
                  disabled={actionBusy === "RESCHEDULE"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  {actionBusy === "RESCHEDULE" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  አስገባ
                </button>
              </div>
            </div>
          )}
        </SanctuarySurface>
      )}

      <SanctuarySurface className="p-5 space-y-3">
        <h3 className="text-sm font-black text-slate-900">የቀጠሮ ታሪክ</h3>
        {detail.events.length === 0 ? (
          <p className="text-xs text-slate-500">
            የታሪክ መረጃ አልተገኘም። (የቀድሞ መዝገቦች ሙሉ ታሪክ ላይኖራቸው ይችላል)
          </p>
        ) : (
          <ol className="space-y-3">
            {detail.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{formatAppointmentEvent(ev)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatEthiopianDateTimeInEAT(ev.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SanctuarySurface>

      {/* Confirm destructive actions */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="ማረጋገጫ"
          >
            <div className="absolute inset-0 bg-black/40" onClick={onCancelConfirmAction} />
            <motion.div
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <h3 className="font-black text-slate-900">ማረጋገጫ</h3>
              <p className="text-sm text-slate-600">
                {confirmAction === "DECLINE" && "ይህን ቀጠሮ አለመቀበልዎን ያረጋግጡ።"}
                {confirmAction === "CANCEL" && "ይህን ቀጠሮ መሰረዝዎን ያረጋግጡ።"}
                {confirmAction === "COMPLETE" && "ቀጠሮው ተጠናቋል ብለው ምልክት ማድረግዎን ያረጋግጡ።"}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelConfirmAction}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                >
                  ተመለስ
                </button>
                <button
                  type="button"
                  onClick={onConfirmAction}
                  disabled={!!actionBusy}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60",
                    confirmAction === "COMPLETE" ? "bg-emerald-700" : "bg-red-700"
                  )}
                >
                  {actionBusy ? "..." : "አረጋግጥ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PartyBlock({
  label,
  party,
  highlight,
}: {
  label: string;
  party: AppointmentParticipant;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border",
        highlight ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
      )}
    >
      <Avatar name={party.displayName} photoUrl={party.photoUrl} size={40} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-900 truncate">{party.displayName}</p>
        {party.spiritualTitle && (
          <p className="text-[11px] text-slate-500 truncate">{party.spiritualTitle}</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-slate-800 font-medium">{children}</p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
  variant,
}: {
  label: string;
  busy?: boolean;
  onClick: () => void;
  variant: "primary" | "secondary" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : variant === "danger"
      ? "bg-red-700 text-white hover:bg-red-800"
      : "bg-slate-900 text-white hover:bg-slate-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[12px] font-bold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-400/40",
        cls
      )}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {label}
    </button>
  );
}

function CreateModal(props: {
  role: "FATHER" | "STUDENT";
  uid: string;
  isOnline: boolean;
  childrenOptions: AppointmentChildDirectoryEntry[];
  childUid: string;
  onChildUid: (v: string) => void;
  type: AppointmentType;
  onType: (v: AppointmentType) => void;
  date: EthiopianDate;
  onDate: (v: EthiopianDate) => void;
  time: EthiopianClockTime;
  onTime: (v: EthiopianClockTime) => void;
  location: string;
  onLocation: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  busy: boolean;
  error: string | null;
  recent: { locations: string[]; messages: string[] };
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    role,
    isOnline,
    childrenOptions,
    childUid,
    onChildUid,
    type,
    onType,
    date,
    onDate,
    time,
    onTime,
    location,
    onLocation,
    note,
    onNote,
    busy,
    error,
    recent,
    onClose,
    onSubmit,
  } = props;

  const [showLocSug, setShowLocSug] = useState(false);
  const [showMsgSug, setShowMsgSug] = useState(false);

  const locSuggestions = [
    ...recent.locations,
    ...LOCATION_TEMPLATES.filter((t) => !recent.locations.includes(t)),
  ].slice(0, 5);
  const msgSuggestions = [
    ...recent.messages,
    ...MESSAGE_TEMPLATES.filter((t) => !recent.messages.includes(t)),
  ].slice(0, 5);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="አዲስ ቀጠሮ"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl max-h-[92vh] overflow-y-auto"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-[2rem]">
          <h2 className="font-black text-slate-900">አዲስ ቀጠሮ</h2>
          <button type="button" onClick={onClose} aria-label="ዝጋ" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {!isOnline && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ቀጠሮ ለመፍጠር የኢንተርኔት ግንኙነት ያስፈልጋል።
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {role === "FATHER" && (
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">ልጅ</span>
              <select
                required
                value={childUid}
                onChange={(e) => onChildUid(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
              >
                <option value="">ልጅ ይምረጡ…</option>
                {childrenOptions.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">ዓይነት</span>
            <select
              value={type}
              onChange={(e) => onType(e.target.value as AppointmentType)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="NISEHA">ንስሐ</option>
              <option value="COUNSELING">ምክር</option>
            </select>
          </label>

          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black block">ቀን (ዓ.ም)</span>
            <EthiopianDateInput value={date} onChange={onDate} allowFutureYears={3} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black block">ሰዓት</span>
            <EthiopianTimeInput value={time} onChange={onTime} />
          </div>

          <label className="block space-y-1 relative">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">ሥፍራ (አማራጭ)</span>
            <input
              value={location}
              onChange={(e) => onLocation(e.target.value)}
              onFocus={() => setShowLocSug(true)}
              onBlur={() => setTimeout(() => setShowLocSug(false), 150)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="ቤተክርስቲያን / ቦታ"
            />
            {showLocSug && locSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl mt-1 overflow-hidden">
                {locSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => {
                      onLocation(s);
                      setShowLocSug(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="block space-y-1 relative">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">ማስታወሻ (ኃጢአት አይጻፍ)</span>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              onFocus={() => setShowMsgSug(true)}
              onBlur={() => setTimeout(() => setShowMsgSug(false), 150)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none"
              placeholder="ለምሳሌ፦ ከቅዳሴ በኋላ"
            />
            {showMsgSug && msgSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden">
                {msgSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => {
                      onNote(s);
                      setShowMsgSug(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-slate-500">
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={busy || !isOnline}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9b2d30] text-white text-sm font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              አስገባ
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
