"use client";
// src/features/settings/components/SettingsClient.tsx

import {
  Bell, Check, ChevronRight, Eye, EyeOff,
  Globe, Loader2, Lock, LogOut, ShieldAlert,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";

interface Props {
  role: string;
  uid: string;
  email: string;
}

interface Settings {
  notifyAppointments: boolean;
  notifyMessages: boolean;
  language: "am" | "en";
  acceptingRequests: boolean; // Father only
}

const DEFAULT: Settings = {
  notifyAppointments: true,
  notifyMessages: true,
  language: "am",
  acceptingRequests: true,
};

const LANG_LABELS: Record<string, string> = { am: "አማርኛ", en: "English" };

export default function SettingsClient({ role, uid, email }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // Password change
  const [pwSection, setPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Logout
  const [loggingOut, setLoggingOut] = useState(false);

  // Load settings on mount
  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  // Toggle a boolean setting and auto-save
  async function toggleSetting(key: keyof Settings) {
    const newVal = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newVal }));
    setSavingKey(key);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: newVal }),
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      // Revert on failure
      setSettings((prev) => ({ ...prev, [key]: !newVal }));
    } finally {
      setSavingKey(null);
    }
  }

  // Change language and auto-save
  async function changeLanguage(lang: "am" | "en") {
    setSettings((prev) => ({ ...prev, language: lang }));
    setSavingKey("language");
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ language: lang }),
      });
      setSavedKey("language");
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      setSettings((prev) => ({ ...prev, language: prev.language }));
    } finally {
      setSavingKey(null);
    }
  }

  // Password change submit
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) { setPwError("ይለፍ ቃሎቹ አይዛመዱም"); return; }
    if (newPw.length < 8) { setPwError("ቢያንስ 8 ፊደላት መሆን አለበት"); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "ለውጡ አልተሳካም"); return; }
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwSuccess(false); setPwSection(false); }, 2500);
    } catch {
      setPwError("የመረብ ስህተት ተፈጥሯል");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    localStorage.removeItem("sacred_ledger_session");
    localStorage.removeItem("atsede_niseha_uid");
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  }

  if (loadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfcf6]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  const isFather = role === "FATHER";

  return (
    <main className="relative min-h-screen bg-[#fdfcf6] pb-24">
      <SanctuaryBackground />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 space-y-5">

        {/* Header */}
        <div className="mb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-600">
            ቅንብሮች
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
            Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">{email}</p>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <SettingsSection title="ማሳሰቢያዎች" sub="Notifications"
          icon={<Bell className="w-4 h-4" />}>
          <ToggleRow
            label="የቀጠሮ ማሳሰቢያ"
            sub="Appointment reminders"
            value={settings.notifyAppointments}
            saving={savingKey === "notifyAppointments"}
            saved={savedKey === "notifyAppointments"}
            onToggle={() => toggleSetting("notifyAppointments")} />
          <ToggleRow
            label="የመልዕክት ማሳሰቢያ"
            sub="New message alerts"
            value={settings.notifyMessages}
            saving={savingKey === "notifyMessages"}
            saved={savedKey === "notifyMessages"}
            onToggle={() => toggleSetting("notifyMessages")} />
        </SettingsSection>

        {/* ── LANGUAGE ── */}
        <SettingsSection title="ቋንቋ" sub="Language"
          icon={<Globe className="w-4 h-4" />}>
          <div className="flex gap-2 p-1">
            {(["am", "en"] as const).map((lang) => (
              <button key={lang} type="button"
                onClick={() => changeLanguage(lang)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                  settings.language === lang
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                )}>
                {LANG_LABELS[lang]}
                {savingKey === "language" && settings.language === lang && (
                  <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />
                )}
                {savedKey === "language" && settings.language === lang && (
                  <Check className="inline w-3 h-3 ml-1 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 px-1 pb-1">
            ቋንቋ ለወደፊት ስርዓቱ ሙሉ ድጋፍ ሲያገኝ ይሰፋል።
          </p>
        </SettingsSection>

        {/* ── FATHER AVAILABILITY ── */}
        {isFather && (
          <SettingsSection title="ተደራሽነት" sub="Availability"
            icon={<ToggleRight className="w-4 h-4" />}>
            <ToggleRow
              label="ቀጠሮ ጥያቄ ተቀበል"
              sub="Accept appointment requests from students"
              value={settings.acceptingRequests}
              saving={savingKey === "acceptingRequests"}
              saved={savedKey === "acceptingRequests"}
              onToggle={() => toggleSetting("acceptingRequests")} />
            <p className="text-[9px] text-slate-400 px-1 pb-1">
              ሲያጠፉ ልጆቻቸው አዲስ ቀጠሮ መጠየቅ አይችሉም።
            </p>
          </SettingsSection>
        )}

        {/* ── SECURITY ── */}
        <SettingsSection title="ደህንነት" sub="Security"
          icon={<Lock className="w-4 h-4" />}>
          {/* Change password toggle row */}
          <button type="button"
            onClick={() => { setPwSection((v) => !v); setPwError(null); }}
            className="w-full flex items-center justify-between px-1 py-2.5
              hover:bg-slate-50 rounded-xl transition-colors">
            <div>
              <p className="text-sm font-bold text-slate-800">ይለፍ ቃል ቀይር</p>
              <p className="text-[10px] text-slate-400">Change password</p>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 text-slate-300 transition-transform",
              pwSection && "rotate-90"
            )} />
          </button>

          {pwSection && (
            <form onSubmit={handlePasswordChange}
              className="space-y-3 pt-2 border-t border-slate-100 mt-1">
              <PasswordInput label="የአሁኑ ይለፍ ቃል" sub="Current password"
                value={currentPw} onChange={setCurrentPw} show={showPw}
                onToggleShow={() => setShowPw((v) => !v)} />
              <PasswordInput label="አዲስ ይለፍ ቃል" sub="New password (min 8 chars)"
                value={newPw} onChange={setNewPw} show={showPw}
                onToggleShow={() => setShowPw((v) => !v)} />
              <PasswordInput label="አዲስ ይለፍ ቃል አረጋግጥ" sub="Confirm new password"
                value={confirmPw} onChange={setConfirmPw} show={showPw}
                onToggleShow={() => setShowPw((v) => !v)}
                error={confirmPw.length > 0 && newPw !== confirmPw} />

              {pwError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl
                  border border-red-100">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-700">{pwError}</p>
                </div>
              )}

              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl
                  border border-emerald-100">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs font-bold text-emerald-700">
                    ይለፍ ቃሉ ተለውጧል ✓
                  </p>
                </div>
              )}

              <button type="submit" disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs
                  font-black uppercase tracking-widest disabled:opacity-40
                  hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                {pwLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Lock className="w-4 h-4" />}
                {pwLoading ? "በማስቀመጥ ላይ…" : "ይለፍ ቃሉን ለውጥ"}
              </button>
            </form>
          )}
        </SettingsSection>

        {/* ── ABOUT ── */}
        <SanctuarySurface className="p-4 sm:p-5">
          <div className="space-y-1 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              ዐጸደ ንስሐ
            </p>
            <p className="text-[9px] text-slate-300">
              Atsede Niseha · v1.0 · EOTC Digital Sanctuary
            </p>
            <p className="text-[8px] text-slate-200 mt-2">
              UID: <span className="font-mono">{uid.slice(0, 12)}…</span>
            </p>
          </div>
        </SanctuarySurface>

        {/* ── LOGOUT ── */}
        <button type="button" onClick={handleLogout} disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
            border border-red-200 bg-white text-red-600 text-xs font-black uppercase
            tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50">
          {loggingOut
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <LogOut className="w-4 h-4" />}
          {loggingOut ? "በመውጣት ላይ…" : "ወጣ / Logout"}
        </button>

      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function SettingsSection({ title, sub, icon, children }: {
  title: string; sub: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <SanctuarySurface className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 pb-3 border-b border-amber-50">
        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">{icon}</div>
        <div>
          <p className="text-xs font-black text-slate-800">{title}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">{sub}</p>
        </div>
      </div>
      {children}
    </SanctuarySurface>
  );
}

function ToggleRow({ label, sub, value, saving, saved, onToggle }: {
  label: string; sub: string; value: boolean;
  saving: boolean; saved: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-400">{sub}</p>
      </div>
      <button type="button" onClick={onToggle} disabled={saving}
        className="relative shrink-0 ml-4 transition-all"
        aria-pressed={value}>
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : saved ? (
          <Check className="w-5 h-5 text-emerald-500" />
        ) : value ? (
          <ToggleRight className="w-8 h-8 text-amber-600" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-slate-300" />
        )}
      </button>
    </div>
  );
}

function PasswordInput({ label, sub, value, onChange, show, onToggleShow, error }: {
  label: string; sub: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; error?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all",
            "bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-400/20",
            error
              ? "border-red-300 bg-red-50"
              : "border-slate-200 focus:border-amber-400/50"
          )} />
        <button type="button" onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
            hover:text-slate-700 transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[9px] text-slate-400">{sub}</p>
    </div>
  );
}
