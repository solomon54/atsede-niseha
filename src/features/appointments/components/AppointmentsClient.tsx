// src/features/appointments/components/AppointmentsClient.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, CalendarClock, Check, ChevronDown,
  Loader2, Plus, RefreshCw, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pusherClient } from "@/services/pusher/client";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";

import {
  LOCATION_TEMPLATES,
  MESSAGE_TEMPLATES,
  loadRecentTemplates,
  rememberTemplate,
} from "../constants/templates";
import type {
  Appointment, AppointmentRealtimeEvent,
  AppointmentStatus, AppointmentType, InAppNotification,
} from "../types/appointment.types";

type ChildOption = { uid: string; eotcUid: string; name: string; lastNisehaDate?: string };
type Props = { role: "FATHER" | "STUDENT"; uid: string; familyId: string };

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  REQUESTED: "ተጠይቋል", CONFIRMED: "ተረጋግጧል",
  COMPLETED: "ተጠናቋል", CANCELLED: "ተሰርዟል",
};
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  REQUESTED: "bg-amber-50 text-amber-800 border-amber-100",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  COMPLETED: "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-100",
};
const TYPE_LABEL: Record<AppointmentType, string> = { NISEHA: "ንስሐ", COUNSELING: "ምክክር" };

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("am-ET", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

export default function AppointmentsClient({ role, uid, familyId }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  // form state
  const [childUid, setChildUid] = useState("");
  const [type, setType] = useState<AppointmentType>("NISEHA");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [logisticsNote, setLogisticsNote] = useState("");
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [showMsgSuggestions, setShowMsgSuggestions] = useState(false);
  const recent = useRef(loadRecentTemplates());

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [aptRes, notifRes] = await Promise.all([
        fetch("/api/appointments"),
        fetch("/api/notifications"),
      ]);
      const aptJson = await aptRes.json();
      const notifJson = await notifRes.json();
      if (!aptRes.ok || !aptJson.success) throw new Error(aptJson.error || "ቀጠሮዎችን ማምጣት አልተሳካም");
      setAppointments(aptJson.appointments || []);
      setChildren(aptJson.children || []);
      if (notifRes.ok && notifJson.success) {
        setNotifications(notifJson.notifications || []);
        setUnreadCount(notifJson.unreadCount || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ስህተት");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Realtime via Pusher ──────────────────────────────────
  useEffect(() => {
    if (!familyId) return;
    const pusher = pusherClient;
    const channelName = `family-appointments-${familyId}`;
    const ch = pusher.subscribe(channelName);
    ch.bind("sanctuary-update", (event: AppointmentRealtimeEvent) => {
      if (event.type === "appointment.upsert") {
        setAppointments((prev) => {
          const idx = prev.findIndex((a) => a.id === event.appointment.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.appointment;
            return updated;
          }
          return [event.appointment, ...prev];
        });
      } else if (event.type === "notification.new") {
        setNotifications((prev) => [event.notification, ...prev]);
        setUnreadCount((c) => c + 1);
      }
    });
    return () => { ch.unbind_all(); pusher.unsubscribe(channelName); };
  }, [familyId]);

  const upcoming = useMemo(
    () => appointments.filter((a) => a.status === "REQUESTED" || a.status === "CONFIRMED"),
    [appointments]
  );
  const past = useMemo(
    () => appointments.filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED"),
    [appointments]
  );

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      if (location) rememberTemplate("locations", location);
      if (logisticsNote) rememberTemplate("messages", logisticsNote);
      const payload = {
        childUid: role === "STUDENT" ? uid : childUid,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location || undefined,
        logisticsNote: logisticsNote || undefined,
      };
      const res = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "መፍጠር አልተሳካም");
      setShowForm(false); setScheduledAt(""); setLocation(""); setLogisticsNote(""); setChildUid("");
      recent.current = loadRecentTemplates();
      // Realtime will update — but also reload to be safe
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ስህተት");
    } finally { setSubmitting(false); }
  }

  async function patchStatus(id: string, status: AppointmentStatus) {
    setActionId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ማዘመን አልተሳካም");
      // Optimistic update — Pusher will confirm
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ስህተት");
      await load(); // revert on error
    } finally { setActionId(null); }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(notificationId: string) {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    setNotifications((n) => n.map((x) => x.id === notificationId ? { ...x, read: true } : x));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  const locationSuggestions = [
    ...recent.current.locations,
    ...LOCATION_TEMPLATES.filter((t) => !recent.current.locations.includes(t)),
  ].slice(0, 5);

  const messageSuggestions = [
    ...recent.current.messages,
    ...MESSAGE_TEMPLATES.filter((t) => !recent.current.messages.includes(t)),
  ].slice(0, 5);

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
          <button type="button" onClick={() => setShowBell((v) => !v)}
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
          {/* New appointment */}
          <button type="button" onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-2xl
              bg-slate-900 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wide">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "ዝጋ" : "አዲስ"}
          </button>
          {/* Manual refresh */}
          <button type="button" onClick={load} aria-label="Refresh"
            className="p-2.5 rounded-2xl border border-slate-200 bg-white text-slate-400
              hover:text-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── NOTIFICATIONS PANEL ── */}
      <AnimatePresence>
        {showBell && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SanctuarySurface className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">ማሳሰቢያዎች</h2>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead}
                    className="text-[11px] text-[#9b2d30] font-bold">ሁሉንም አንብብ</button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">ምንም ማሳሰቢያ የለም</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id} className={cn(
                      "rounded-xl px-3 py-2.5 border text-sm transition-colors cursor-pointer",
                      n.read ? "bg-slate-50 border-slate-100 text-slate-400"
                             : "bg-amber-50/80 border-amber-100 text-slate-800"
                    )} onClick={() => !n.read && markOneRead(n.id)}>
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
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CREATE FORM ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SanctuarySurface className="p-4 sm:p-6">
              <form onSubmit={submitCreate} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="w-4 h-4 text-[#9b2d30]" />
                  <h2 className="font-black text-slate-900 text-sm">ቀጠሮ ጠይቅ / ፍጠር</h2>
                </div>

                {/* Child selector — Father only */}
                {role === "FATHER" && (
                  <label className="block space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">ልጅ</span>
                    <select required value={childUid} onChange={(e) => setChildUid(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                      <option value="">ልጅ ይምረጡ…</option>
                      {children.map((c) => (
                        <option key={c.uid} value={c.uid}>{c.name} — {c.eotcUid}</option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Type + Date row */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">ዓይነት</span>
                    <select value={type} onChange={(e) => setType(e.target.value as AppointmentType)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                      <option value="NISEHA">ንስሐ</option>
                      <option value="COUNSELING">ምክክር</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">ቀንና ሰዓት</span>
                    <input required type="datetime-local" value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                  </label>
                </div>

                {/* Location with suggestions */}
                <label className="block space-y-1 relative">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    ሥፍራ <span className="normal-case text-slate-300">(አማራጭ)</span>
                  </span>
                  <div className="relative">
                    <input value={location} onChange={(e) => setLocation(e.target.value)}
                      onFocus={() => setShowLocSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowLocSuggestions(false), 150)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                      placeholder="ቤተክርስቲያን / ቦታ" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                  </div>
                  {showLocSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl mt-1 overflow-hidden">
                      {locationSuggestions.map((s) => (
                        <button key={s} type="button" onMouseDown={() => { setLocation(s); setShowLocSuggestions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                {/* Logistics note with suggestions */}
                <label className="block space-y-1 relative">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    ማስታወሻ <span className="normal-case text-slate-300">(ኃጢአት አይጻፍ)</span>
                  </span>
                  <textarea value={logisticsNote} onChange={(e) => setLogisticsNote(e.target.value)}
                    onFocus={() => setShowMsgSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowMsgSuggestions(false), 150)}
                    rows={2} placeholder="ምሳሌ፦ ከቅዳሴ በኋላ…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                  {showMsgSuggestions && messageSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden">
                      {messageSuggestions.map((s) => (
                        <button key={s} type="button" onMouseDown={() => { setLogisticsNote(s); setShowMsgSuggestions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-700 transition-colors">
                    ሰርዝ
                  </button>
                  <button type="submit" disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9b2d30] text-white text-sm font-bold disabled:opacity-60 transition-opacity">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
          <p className="text-[10px] font-black uppercase tracking-widest">በመጫን ላይ…</p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-2.5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              መጪ ቀጠሮዎች ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-slate-300 text-sm">
                <CalendarClock className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-[11px] uppercase tracking-widest">መጪ ቀጠሮ የለም</p>
              </div>
            ) : (
              upcoming.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} role={role}
                  busy={actionId === apt.id}
                  onConfirm={() => patchStatus(apt.id, "CONFIRMED")}
                  onComplete={() => patchStatus(apt.id, "COMPLETED")}
                  onCancel={() => patchStatus(apt.id, "CANCELLED")} />
              ))
            )}
          </section>

          {/* History */}
          {past.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                ታሪክ ({past.length})
              </h2>
              {past.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} role={role} busy={false} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   APPOINTMENT CARD
───────────────────────────────────────────── */
function AppointmentCard({
  apt, role, busy, onConfirm, onComplete, onCancel,
}: {
  apt: Appointment;
  role: "FATHER" | "STUDENT";
  busy: boolean;
  onConfirm?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const isFather = role === "FATHER";
  const canConfirm = isFather && apt.status === "REQUESTED";
  const canComplete = isFather && apt.status === "CONFIRMED";
  // Students can only cancel REQUESTED appointments they created themselves
  const canCancel =
    apt.status === "REQUESTED" ||
    (apt.status === "CONFIRMED" && isFather);

  const hasActions = canConfirm || canComplete || canCancel;

  const directionLabel =
    apt.direction === "FATHER_TO_CHILD" ? "👉 ከአባት" : "👈 ከልጅ";

  return (
    <SanctuarySurface className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Type + Status */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide text-[#9b2d30]">
              {TYPE_LABEL[apt.type]}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full border",
              STATUS_COLOR[apt.status]
            )}>
              {STATUS_LABEL[apt.status]}
            </span>
            <span className="text-[9px] text-slate-400 font-medium">{directionLabel}</span>
          </div>

          {/* Who */}
          {apt.childName && (
            <p className="text-sm font-bold text-slate-900 truncate">{apt.childName}</p>
          )}

          {/* When */}
          <p className="text-[11px] sm:text-xs text-slate-500">{formatWhen(apt.scheduledAt)}</p>

          {/* Where */}
          {apt.location && (
            <p className="text-[11px] text-slate-400">📍 {apt.location}</p>
          )}

          {/* Note */}
          {(apt.logisticsNote || apt.message) && (
            <p className="text-[11px] text-slate-500 border-l-2 border-slate-200 pl-2 mt-1">
              {apt.logisticsNote || apt.message}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {hasActions && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {canConfirm && onConfirm && (
              <button type="button" disabled={busy} onClick={onConfirm}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl
                  bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide
                  disabled:opacity-50 hover:bg-emerald-700 transition-colors">
                <Check className="w-3 h-3" /> አረጋግጥ
              </button>
            )}
            {canComplete && onComplete && (
              <button type="button" disabled={busy} onClick={onComplete}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl
                  bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide
                  disabled:opacity-50 hover:bg-slate-900 transition-colors">
                <Check className="w-3 h-3" /> ተጠናቋል
              </button>
            )}
            {canCancel && onCancel && (
              <button type="button" disabled={busy} onClick={onCancel}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl
                  border border-slate-200 text-slate-500 text-[10px] font-bold
                  uppercase tracking-wide disabled:opacity-50 hover:border-red-300
                  hover:text-red-600 transition-colors">
                <X className="w-3 h-3" /> ሰርዝ
              </button>
            )}
            {busy && (
              <div className="flex justify-center py-1">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </SanctuarySurface>
  );
}
