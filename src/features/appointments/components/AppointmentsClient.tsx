// src/features/appointments/components/AppointmentsClient.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarClock, Check, ChevronRight,
  Clock, Loader2, MapPin, MessageSquare,
  Plus, RefreshCw, RotateCcw, User, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EthiopianDateInput from "@/shared/components/ui/EthiopianDateInput";
import EthiopianTimeInput from "@/shared/components/ui/EthiopianTimeInput";
import { pusherClient } from "@/services/pusher/client";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import {
  EthiopianClockTime,
  EthiopianDate,
  ethiopianDateTimeToDate,
  formatEthiopianDateTime,
  getTodayEthiopian,
  gregorianToEthiopian,
  westernToEthiopianClock,
} from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

import {
  LOCATION_TEMPLATES,
  MESSAGE_TEMPLATES,
  loadRecentTemplates,
  rememberTemplate,
} from "../constants/templates";
import type {
  Appointment,
  AppointmentRealtimeEvent,
  AppointmentStatus,
  AppointmentType,
  InAppNotification,
} from "../types/appointment.types";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type ChildOption = {
  uid: string;
  eotcUid: string;
  name: string;
  lastNisehaDate?: string;
};

type Props = {
  role: "FATHER" | "STUDENT";
  uid: string;
  familyId: string;
};

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  REQUESTED: "ተጠይቋል",
  CONFIRMED: "ተረጋግጧል",
  COMPLETED: "ተጠናቋል",
  CANCELLED: "ተሰርዟል",
};

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  REQUESTED:  "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:  "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED:  "bg-red-50 text-red-600 border-red-200",
};

// Who needs to act next
const WAITING_ON: Record<
  AppointmentStatus,
  { father: string; child: string }
> = {
  REQUESTED:  { father: "ምላሽ ይጠበቃል", child: "ምላሽ ይጠበቃል" },
  CONFIRMED:  { father: "ቀጠሮው ተቋቁሟል",  child: "ቀጠሮው ተቋቁሟል" },
  COMPLETED:  { father: "",              child: "" },
  CANCELLED:  { father: "",              child: "" },
};

const TYPE_LABEL: Record<AppointmentType, string> = {
  NISEHA: "ንስሐ",
  COUNSELING: "ምክክር",
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function toEthDate(iso: string): EthiopianDate {
  return gregorianToEthiopian(new Date(iso));
}

function toEthClock(iso: string): EthiopianClockTime {
  return westernToEthiopianClock(new Date(iso));
}

function defaultEthClock(): EthiopianClockTime {
  return { hour: 3, minute: 0, period: "ጥዋት", isNight: false };
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function AppointmentsClient({ role, uid, familyId }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [fatherName, setFatherName] = useState<string>("");
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);

  // ── Create form state ─────────────────────
  const today = getTodayEthiopian();
  const [childUid, setChildUid] = useState("");
  const [aptType, setAptType] = useState<AppointmentType>("NISEHA");
  const [ethDate, setEthDate] = useState<EthiopianDate>({
    year: today.year, month: today.month, day: today.day,
  });
  const [ethTime, setEthTime] = useState<EthiopianClockTime>(defaultEthClock());
  const [location, setLocation] = useState("");
  const [msgNote, setMsgNote] = useState("");
  const [showLocSug, setShowLocSug] = useState(false);
  const [showMsgSug, setShowMsgSug] = useState(false);
  const recent = useRef(loadRecentTemplates());

  // ── Load ─────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [aptRes, notifRes] = await Promise.all([
        fetch("/api/appointments"),
        fetch("/api/notifications"),
      ]);
      const aptJson = await aptRes.json();
      const notifJson = await notifRes.json();
      if (!aptRes.ok || !aptJson.success)
        throw new Error(aptJson.error || "ቀጠሮዎችን ማምጣት አልተሳካም");
      setAppointments(aptJson.appointments || []);
      setChildren(aptJson.children || []);
      if (aptJson.fatherName) setFatherName(aptJson.fatherName);
      if (notifRes.ok && notifJson.success) {
        setNotifications(notifJson.notifications || []);
        setUnreadCount(notifJson.unreadCount || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ስህተት");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Pusher realtime ───────────────────────
  useEffect(() => {
    if (!familyId) return;
    const ch = pusherClient.subscribe(`family-appointments-${familyId}`);
    ch.bind("sanctuary-update", (event: AppointmentRealtimeEvent) => {
      if (event.type === "appointment.upsert") {
        setAppointments((prev) => {
          const idx = prev.findIndex((a) => a.id === event.appointment.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.appointment;
            // Keep drawer in sync
            setSelectedApt((sel) =>
              sel?.id === event.appointment.id ? event.appointment : sel
            );
            return updated;
          }
          return [event.appointment, ...prev];
        });
      } else if (event.type === "notification.new") {
        setNotifications((prev) => [event.notification, ...prev]);
        setUnreadCount((c) => c + 1); // stays live without full reload
      }
    });
    return () => {
      ch.unbind_all();
      pusherClient.unsubscribe(`family-appointments-${familyId}`);
    };
  }, [familyId]);

  // ── Derived lists ─────────────────────────
  const upcoming = useMemo(
    () => appointments.filter(
      (a) => a.status === "REQUESTED" || a.status === "CONFIRMED"
    ),
    [appointments]
  );
  const past = useMemo(
    () => appointments.filter(
      (a) => a.status === "COMPLETED" || a.status === "CANCELLED"
    ),
    [appointments]
  );

  // ── Create submit ─────────────────────────
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      if (location) rememberTemplate("locations", location);
      if (msgNote)   rememberTemplate("messages",  msgNote);

      const scheduledAt = ethiopianDateTimeToDate(ethDate, ethTime).toISOString();

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childUid: role === "STUDENT" ? uid : childUid,
          type: aptType,
          scheduledAt,
          location:     location || undefined,
          logisticsNote: msgNote  || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "መፍጠር አልተሳካም");
      setShowForm(false);
      setLocation(""); setMsgNote(""); setChildUid("");
      setEthDate({ year: today.year, month: today.month, day: today.day });
      setEthTime(defaultEthClock());
      recent.current = loadRecentTemplates();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ስህተት");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status patch (from list) ──────────────
  async function patchStatus(id: string, status: AppointmentStatus) {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "ማዘመን አልተሳካም");
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ስህተት");
      await load();
    }
  }

  // ── Notification helpers ──────────────────
  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(notifId: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: notifId }),
    });
    setNotifications((n) =>
      n.map((x) => (x.id === notifId ? { ...x, read: true } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  // ── Template suggestions ──────────────────
  const locSuggestions = [
    ...recent.current.locations,
    ...LOCATION_TEMPLATES.filter(
      (t) => !recent.current.locations.includes(t)
    ),
  ].slice(0, 5);

  const msgSuggestions = [
    ...recent.current.messages,
    ...MESSAGE_TEMPLATES.filter(
      (t) => !recent.current.messages.includes(t)
    ),
  ].slice(0, 5);

  /* ── RENDER ── */
  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-6 py-6 sm:py-10 space-y-5">

      {/* ── HEADER ── */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#9b2d30] font-black">
            ቀጠሮ
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 leading-tight">
            የንስሐ / ምክክር ቀጠሮዎች
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            ለአካል ንስሐ ብቻ — ኃጢአት አይመዘገብም።
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Bell */}
          <button
            type="button"
            onClick={() => setShowBell((v) => !v)}
            className="relative p-2.5 rounded-2xl border border-slate-200 bg-white shadow-sm"
            aria-label="ማሳሰቢያዎች">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full
                bg-[#9b2d30] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {/* New */}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl
              bg-slate-900 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wide">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "ዝጋ" : "አዲስ"}
          </button>
          {/* Refresh */}
          <button
            type="button"
            onClick={load}
            aria-label="Refresh"
            className="p-2.5 rounded-2xl border border-slate-200 bg-white text-slate-400
              hover:text-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── NOTIFICATIONS PANEL ── */}
      <AnimatePresence>
        {showBell && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SanctuarySurface className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">ማሳሰቢያዎች</h2>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead}
                    className="text-[11px] text-[#9b2d30] font-bold">
                    ሁሉንም አንብብ
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  ምንም ማሳሰቢያ የለም
                </p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => !n.read && markOneRead(n.id)}
                      className={cn(
                        "rounded-xl px-3 py-2.5 border text-sm transition-colors cursor-pointer",
                        n.read
                          ? "bg-slate-50 border-slate-100 text-slate-400"
                          : "bg-amber-50/80 border-amber-100 text-slate-800"
                      )}>
                      <p className="font-bold text-xs">{n.title}</p>
                      <p className="text-[11px] mt-0.5 opacity-80">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SanctuarySurface>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ERROR ── */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3
          text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CREATE FORM ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SanctuarySurface className="p-4 sm:p-6">
              <form onSubmit={submitCreate} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="w-4 h-4 text-[#9b2d30]" />
                  <h2 className="font-black text-slate-900 text-sm">
                    ቀጠሮ ጠይቅ / ፍጠር
                  </h2>
                </div>

                {/* Child selector — Father only */}
                {role === "FATHER" && (
                  <label className="block space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                      ልጅ
                    </span>
                    <select
                      required
                      value={childUid}
                      onChange={(e) => setChildUid(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
                        bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                      <option value="">ልጅ ይምረጡ…</option>
                      {children.map((c) => (
                        <option key={c.uid} value={c.uid}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Type */}
                <label className="block space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    ዓይነት
                  </span>
                  <select
                    value={aptType}
                    onChange={(e) => setAptType(e.target.value as AppointmentType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
                      bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                    <option value="NISEHA">ንስሐ</option>
                    <option value="COUNSELING">ምክክር</option>
                  </select>
                </label>

                {/* Ethiopian date */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black block">
                    ቀን (ዓ.ም)
                  </span>
                  <EthiopianDateInput
                    value={ethDate}
                    onChange={setEthDate}
                    allowFutureYears={3}
                  />
                </div>

                {/* Ethiopian time */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black block">
                    ሰዓት
                  </span>
                  <EthiopianTimeInput value={ethTime} onChange={setEthTime} />
                </div>

                {/* Location with suggestions */}
                <label className="block space-y-1 relative">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    ሥፍራ <span className="normal-case text-slate-300">(አማራጭ)</span>
                  </span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={() => setShowLocSug(true)}
                    onBlur={() => setTimeout(() => setShowLocSug(false), 150)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
                      bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    placeholder="ቤተክርስቲያን / ቦታ"
                  />
                  {showLocSug && locSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 bg-white border
                      border-slate-100 rounded-xl shadow-xl mt-1 overflow-hidden">
                      {locSuggestions.map((s) => (
                        <button
                          key={s} type="button"
                          onMouseDown={() => {
                            setLocation(s);
                            setShowLocSug(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm
                            hover:bg-amber-50 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                {/* Message with suggestions */}
                <label className="block space-y-1 relative">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    ማስታወሻ <span className="normal-case text-slate-300">(ኃጢአት አይጻፍ)</span>
                  </span>
                  <textarea
                    value={msgNote}
                    onChange={(e) => setMsgNote(e.target.value)}
                    onFocus={() => setShowMsgSug(true)}
                    onBlur={() => setTimeout(() => setShowMsgSug(false), 150)}
                    rows={2}
                    placeholder="ምሳሌ፦ ከቅዳሴ በኋላ…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
                      bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  {showMsgSug && msgSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 bg-white border
                      border-slate-100 rounded-xl shadow-xl overflow-hidden">
                      {msgSuggestions.map((s) => (
                        <button
                          key={s} type="button"
                          onMouseDown={() => {
                            setMsgNote(s);
                            setShowMsgSug(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm
                            hover:bg-amber-50 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-slate-400
                      hover:text-slate-700 transition-colors">
                    ሰርዝ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                      bg-[#9b2d30] text-white text-sm font-bold disabled:opacity-60
                      transition-opacity">
                    {submitting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Check className="w-4 h-4" />}
                    አስገባ
                  </button>
                </div>
              </form>
            </SanctuarySurface>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LISTS ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest">
            በመጫን ላይ…
          </p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-2.5">
            <h2 className="text-[10px] font-black uppercase tracking-widest
              text-slate-400 px-1">
              መጪ ቀጠሮዎች ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-slate-300 text-sm">
                <CalendarClock className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-[11px] uppercase tracking-widest">
                  መጪ ቀጠሮ የለም
                </p>
              </div>
            ) : (
              upcoming.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  apt={apt}
                  role={role}
                  uid={uid}
                  fatherName={fatherName}
                  onOpen={() => setSelectedApt(apt)}
                  onConfirm={() => patchStatus(apt.id, "CONFIRMED")}
                  onComplete={() => patchStatus(apt.id, "COMPLETED")}
                  onCancel={() => patchStatus(apt.id, "CANCELLED")}
                />
              ))
            )}
          </section>

          {/* History */}
          {past.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-[10px] font-black uppercase tracking-widest
                text-slate-400 px-1">
                ታሪክ ({past.length})
              </h2>
              {past.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  apt={apt}
                  role={role}
                  uid={uid}
                  fatherName={fatherName}
                  onOpen={() => setSelectedApt(apt)}
                />
              ))}
            </section>
          )}
        </>
      )}

      {/* ── DETAIL DRAWER ── */}
      <AnimatePresence>
        {selectedApt && (
          <AppointmentDetailDrawer
            apt={selectedApt}
            role={role}
            uid={uid}
            fatherName={fatherName}
            onClose={() => setSelectedApt(null)}
            onPatch={async (id, patch) => {
              const res = await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
              });
              const json = await res.json();
              if (!res.ok || !json.success)
                throw new Error(json.error || "ማዘመን አልተሳካም");
              setAppointments((prev) =>
                prev.map((a) => (a.id === id ? json.appointment : a))
              );
              setSelectedApt(json.appointment);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════
   APPOINTMENT CARD
══════════════════════════════════════════════ */
function AppointmentCard({
  apt, role, uid, fatherName, onOpen, onConfirm, onComplete, onCancel,
}: {
  apt: Appointment;
  role: "FATHER" | "STUDENT";
  uid: string;
  fatherName: string;
  onOpen: () => void;
  onConfirm?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const isFather = role === "FATHER";

  // Who sent this appointment
  const iMadeit = apt.createdBy === uid;
  const dirLabel = iMadeit ? "ከእኔ" : (isFather ? "ከልጅ" : "ከአባት");
  const dirColor = iMadeit
    ? "bg-slate-100 text-slate-500"
    : "bg-amber-50 text-amber-700";

  // Other party name
  const otherName = isFather
    ? (apt.childName || "ልጅ")
    : (apt.fatherName || fatherName || "አባት");

  // What needs to happen next
  const waitingOn = WAITING_ON[apt.status];
  const nextAction = isFather ? waitingOn.father : waitingOn.child;

  // Who can do what
  const canConfirm  = isFather && apt.status === "REQUESTED" && apt.direction === "CHILD_TO_FATHER";
  const canComplete = isFather && apt.status === "CONFIRMED";
  const canCancel   =
    apt.status === "REQUESTED" ||
    (apt.status === "CONFIRMED" && isFather);

  const isActive = apt.status === "REQUESTED" || apt.status === "CONFIRMED";

  return (
    <SanctuarySurface
      className={cn(
        "p-4 sm:p-5 cursor-pointer hover:shadow-md transition-shadow",
        !isActive && "opacity-70"
      )}
      onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">

          {/* Row 1: type + status + direction */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] sm:text-xs font-black uppercase
              tracking-wide text-[#9b2d30]">
              {TYPE_LABEL[apt.type]}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full border",
              STATUS_COLOR[apt.status]
            )}>
              {STATUS_LABEL[apt.status]}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full",
              dirColor
            )}>
              {dirLabel}
            </span>
          </div>

          {/* Row 2: other party */}
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            <p className="text-sm font-bold text-slate-900 truncate">
              {otherName}
            </p>
          </div>

          {/* Row 3: scheduled time */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <p className="text-[11px] sm:text-xs text-slate-500">
              {formatEthiopianDateTime(apt.scheduledAt)}
            </p>
          </div>

          {/* Row 4: location */}
          {apt.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <p className="text-[11px] text-slate-400 truncate">{apt.location}</p>
            </div>
          )}

          {/* Row 5: waiting-on hint */}
          {nextAction && isActive && (
            <p className="text-[10px] text-amber-600 font-bold">{nextAction}</p>
          )}
        </div>

        {/* Right: quick actions + chevron */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ChevronRight className="w-4 h-4 text-slate-300" />
          {canConfirm && onConfirm && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                bg-emerald-600 text-white text-[9px] font-bold uppercase
                hover:bg-emerald-700 transition-colors">
              <Check className="w-2.5 h-2.5" /> አረጋግጥ
            </button>
          )}
          {canComplete && onComplete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                bg-slate-800 text-white text-[9px] font-bold uppercase
                hover:bg-slate-900 transition-colors">
              <Check className="w-2.5 h-2.5" /> ተጠናቋል
            </button>
          )}
          {canCancel && onCancel && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                border border-slate-200 text-slate-500 text-[9px] font-bold
                uppercase hover:border-red-300 hover:text-red-600 transition-colors">
              <X className="w-2.5 h-2.5" /> ሰርዝ
            </button>
          )}
        </div>
      </div>
    </SanctuarySurface>
  );
}

/* ══════════════════════════════════════════════
   DETAIL DRAWER
   Full info + all actions including reschedule.
══════════════════════════════════════════════ */
function AppointmentDetailDrawer({
  apt, role, uid, fatherName, onClose, onPatch,
}: {
  apt: Appointment;
  role: "FATHER" | "STUDENT";
  uid: string;
  fatherName: string;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const isFather = role === "FATHER";
  const [acting, setActing] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rEthDate, setREthDate] = useState<EthiopianDate>(toEthDate(apt.scheduledAt));
  const [rEthTime, setREthTime] = useState<EthiopianClockTime>(toEthClock(apt.scheduledAt));

  const otherName = isFather
    ? (apt.childName || "ልጅ")
    : (apt.fatherName || fatherName || "አባት");

  const iMadeIt = apt.createdBy === uid;

  const canConfirm  = isFather && apt.status === "REQUESTED" && apt.direction === "CHILD_TO_FATHER";
  const canComplete = isFather && apt.status === "CONFIRMED";
  const canCancel   = apt.status === "REQUESTED" || (apt.status === "CONFIRMED" && isFather);
  const canReschedule =
    apt.status === "REQUESTED" || apt.status === "CONFIRMED";

  async function act(patch: Record<string, unknown>, label: string) {
    setActing(label);
    setDrawerError(null);
    try {
      await onPatch(apt.id, patch);
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : "ስህተት ተፈጥሯል");
    } finally {
      setActing(null);
    }
  }

  async function submitReschedule() {
    const scheduledAt = ethiopianDateTimeToDate(rEthDate, rEthTime).toISOString();
    await act({ scheduledAt }, "reschedule");
    setShowReschedule(false);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative w-full sm:max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem]
          shadow-2xl max-h-[90vh] flex flex-col"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black border",
              STATUS_COLOR[apt.status]
            )}>
              {STATUS_LABEL[apt.status]}
            </div>
            <span className="text-sm font-black text-slate-900">
              {TYPE_LABEL[apt.type]}
            </span>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock
              label="አባት"
              value={apt.fatherName || fatherName || "አባት"}
              highlight={!isFather}
            />
            <InfoBlock
              label="ልጅ"
              value={apt.childName || "ልጅ"}
              highlight={isFather}
            />
          </div>

          {/* Direction / who created */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold",
            iMadeIt
              ? "bg-slate-50 text-slate-600 border border-slate-100"
              : "bg-amber-50 text-amber-700 border border-amber-100"
          )}>
            <MessageSquare size={13} />
            {iMadeIt
              ? "እርስዎ ጠይቀዋል"
              : `${otherName} ጠይቀዋል`}
          </div>

          {/* Schedule */}
          <DetailRow icon={<Clock size={14} />} label="ቀን ሰዓት">
            {formatEthiopianDateTime(apt.scheduledAt)}
          </DetailRow>

          {/* Location */}
          {apt.location && (
            <DetailRow icon={<MapPin size={14} />} label="ቦታ">
              {apt.location}
            </DetailRow>
          )}

          {/* Message */}
          {(apt.message || apt.logisticsNote) && (
            <DetailRow icon={<MessageSquare size={14} />} label="ማስታወሻ">
              {apt.message || apt.logisticsNote}
            </DetailRow>
          )}

          {/* Reschedule form */}
          {showReschedule && canReschedule && (
            <div className="space-y-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                አዲስ ቀን / ሰዓት ይምረጡ
              </p>
              <EthiopianDateInput
                value={rEthDate}
                onChange={setREthDate}
                allowFutureYears={3}
              />
              <EthiopianTimeInput value={rEthTime} onChange={setREthTime} />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowReschedule(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400
                    hover:text-slate-700 transition-colors">
                  ሰርዝ
                </button>
                <button
                  onClick={submitReschedule}
                  disabled={!!acting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
                    bg-amber-600 text-white text-xs font-bold disabled:opacity-60">
                  {acting === "reschedule"
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RotateCcw size={12} />}
                  ቀጠሮ ቀይር
                </button>
              </div>
            </div>
          )}

          {drawerError && (
            <p className="text-[11px] text-red-600 font-bold bg-red-50
              border border-red-200 rounded-xl px-3 py-2">
              ⚠ {drawerError}
            </p>
          )}
        </div>

        {/* Action footer */}
        {(canConfirm || canComplete || canCancel || canReschedule) && (
          <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex flex-wrap gap-2">
            {canConfirm && (
              <ActionBtn
                color="emerald"
                icon={<Check size={13} />}
                label="አረጋግጥ"
                busy={acting === "confirm"}
                onClick={() => act({ status: "CONFIRMED" }, "confirm")}
              />
            )}
            {canComplete && (
              <ActionBtn
                color="slate"
                icon={<Check size={13} />}
                label="ተጠናቋል"
                busy={acting === "complete"}
                onClick={() => act({ status: "COMPLETED" }, "complete")}
              />
            )}
            {canReschedule && !showReschedule && (
              <ActionBtn
                color="amber"
                icon={<RotateCcw size={13} />}
                label="ቀን ቀይር"
                busy={false}
                onClick={() => setShowReschedule(true)}
              />
            )}
            {canCancel && (
              <ActionBtn
                color="red"
                icon={<X size={13} />}
                label="ሰርዝ"
                busy={acting === "cancel"}
                onClick={() => act({ status: "CANCELLED" }, "cancel")}
              />
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
function InfoBlock({
  label, value, highlight,
}: { label: string; value: string; highlight: boolean }) {
  return (
    <div className={cn(
      "p-3 rounded-2xl border",
      highlight
        ? "bg-amber-50 border-amber-100"
        : "bg-slate-50 border-slate-100"
    )}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function DetailRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </p>
        <p className="text-sm text-slate-700 font-medium mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function ActionBtn({
  color, icon, label, busy, onClick,
}: {
  color: "emerald" | "slate" | "amber" | "red";
  icon: React.ReactNode;
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
    slate:   "bg-slate-800 hover:bg-slate-900 text-white",
    amber:   "bg-amber-500 hover:bg-amber-600 text-white",
    red:     "border border-red-200 text-red-600 hover:bg-red-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl",
        "text-[11px] font-black uppercase tracking-wide",
        "disabled:opacity-50 transition-colors",
        colors[color]
      )}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
