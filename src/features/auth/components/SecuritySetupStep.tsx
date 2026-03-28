// src/features/auth/components/SecuritySetupStep.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { AuthContext } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

interface Props {
  context: AuthContext;
  onBack: () => void;
}

export default function SecuritySetupStep({ context, onBack }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const isNewAccount = !context.accountClaimed;
  const isFormValid = useMemo(() => {
    if (isNewAccount)
      return password.length >= 8 && password === confirmPassword;
    return password.length > 0;
  }, [isNewAccount, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !isOnline) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = isNewAccount ? "/api/auth/claim" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eotcUid: context.eotcUid,
          password,
          ...(isNewAccount && { role: context.role }),
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) router.push(result.redirect);
      else
        setError(
          result.error || (isNewAccount ? "ምዝገባው አልተሳካም።" : "የተሳሳተ የይለፍ ቃል ነው።")
        );
    } catch {
      setError("የመረብ ግንኙነት ችግር አለ።");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImmersiveTransition className="flex flex-col items-center justify-center min-h-screen p-0 md:p-6">
      {/* Network Status - Sticky for high visibility */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 inset-x-0 z-[100] bg-red-600/95 backdrop-blur-md text-white py-4 px-6 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl">
            <WifiOff className="w-4 h-4" /> የመረብ ግንኙነት ተቋርጧል (OFFLINE)
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md flex flex-col gap-8">
        {/* Modern Adaptive Header */}
        <header className="text-center space-y-4 px-6 mt-12 md:mt-0">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.1,
            }}
            className="relative mx-auto w-24 h-24 flex items-center justify-center">
            {/* Outer Glow / Halo Effect */}
            <div className="absolute inset-0 rounded-full bg-amber-200/20 blur-2xl animate-pulse" />

            {/* The Main Token */}
            <div
              className={cn(
                "relative w-full h-full rounded-full flex items-center justify-center text-3xl",
                "bg-linear-to-b from-white to-slate-50",
                "border-[1.5px] border-amber-400/45",
                "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,1)]"
              )}>
              {/* Inner Ring for "Vault" feel */}
              <div className="absolute inset-1.5 rounded-full border border-amber-300/45" />

              {/* The Icon with its own depth */}
              <span className="relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.1)] text-amber-500">
                ✞
              </span>

              {/* Reflection Highlight */}
              <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight font-ethiopic">
              {isNewAccount ? "የቃል ኪዳን መቆለፊያ" : "የምስጢር ማኅደር"}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] inline-block px-3 py-1 bg-slate-100 rounded-full">
              {isNewAccount ? "Access Generation" : "Authorized Entry Only"}
            </p>
          </div>
        </header>

        {/* The Vault Surface */}
        <SanctuarySurface
          className={cn(
            "relative flex flex-col transition-all duration-500",
            "min-h-[60vh] md:min-h-0",
            "border-x-0 border-b-0 md:border border-white/60"
          )}>
          {/* Recovery Overlay ( backdrop) */}
          <AnimatePresence>
            {showForgotInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center rounded-[inherit]">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
                  <Fingerprint className="w-10 h-10 text-amber-500 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  ምስጢር ቃልን መልሶ ማግኘት
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-12">
                  ይህ ሥርዓት አባታዊ ፈቃድ የሚጠይቅ ነው። <br />
                  እባክዎ መምህረ ንስሐዎን ያነጋግሩ።
                </p>
                <button
                  onClick={() => setShowForgotInfo(false)}
                  className="w-full py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 transition-all active:scale-95">
                  ተረድቻለሁ
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-5 md:p-10 flex-1 flex flex-col">
            {/* Identity Bar */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={onBack}
                aria-label="Go back"
                className="group flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                <div className="p-2 bg-slate-100 rounded-full group-hover:bg-slate-200">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                ተመለስ
              </button>
              <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-2xl shadow-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                  {context.displayName}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 flex-1">
              <div className="space-y-6">
                {/* Custom Styled Input Group */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    {isNewAccount ? "Create Secure Key" : "Access Key"}
                  </label>
                  <div className="relative group">
                    <input
                      title="password"
                      autoFocus
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-6 py-5 bg-slate-100/50 text-slate-500 border-2 border-transparent rounded-[1.25rem] focus:bg-white focus:border-amber-500/30 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all text-lg font-bold tracking-widest"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-amber-600 transition-colors">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {isNewAccount && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Verify Key
                    </label>
                    <input
                      title="confirm password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        "w-full px-6 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.25rem] outline-none transition-all text-lg font-bold tracking-widest",
                        confirmPassword && password !== confirmPassword
                          ? "border-red-500/50 bg-red-50"
                          : "focus:bg-white focus:border-slate-900"
                      )}
                      required
                    />
                  </motion.div>
                )}
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-xs font-bold text-red-700 leading-tight">
                    {error}
                  </p>
                </motion.div>
              )}

              {/* High-Impact Action Section */}
              <div className="pt-6 space-y-4">
                <button
                  disabled={loading || !isFormValid || !isOnline}
                  className={cn(
                    "group relative w-full py-6 bg-slate-950 text-white rounded-[1.5rem] overflow-hidden transition-all active:scale-[0.97] disabled:opacity-40",
                    "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]"
                  )}>
                  <div className="absolute inset-0 bg-linear-to-r from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.25em] cursor-pointer">
                    {loading ? (
                      <RefreshCcw className="w-5 h-5 animate-spin text-amber-500" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                        <span>
                          {isNewAccount
                            ? "Establish Covenant"
                            : "Open Sanctuary"}
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {!isNewAccount && (
                  <button
                    type="button"
                    onClick={() => setShowForgotInfo(true)}
                    className="w-full text-center text-[10px] font-black text-slate-400 hover:text-amber-800 uppercase tracking-widest py-2 transition-colors">
                    Lost your access key?
                  </button>
                )}
              </div>
            </form>
          </div>
        </SanctuarySurface>

        {/* Legal Disclaimer */}
        <footer className="pb-12 text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.4em] leading-loose opacity-60">
            Secure Ecclesiastical Node <br />
            <span className="text-slate-900">Atsede Niseha Juris v3.1</span>
          </p>
        </footer>
      </div>
    </ImmersiveTransition>
  );
}
