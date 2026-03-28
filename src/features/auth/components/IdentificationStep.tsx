//src/features/auth/components/IdentificationStep.tsx
"use client";

import { motion } from "framer-motion";
import { RefreshCcw, Search, ShieldAlert, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { GatewayResponse } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

interface Props {
  onSuccess: (data: GatewayResponse) => void;
}

export default function IdentificationStep({ onSuccess }: Props) {
  const [eotcUid, setEotcUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem("atsede_niseha_uid");
    if (savedId) setEotcUid(savedId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eotcUid) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eotcUid: eotcUid.trim().toUpperCase() }),
      });
      const data: GatewayResponse = await res.json();
      if (data.success) {
        localStorage.setItem("atsede_niseha_uid", eotcUid.trim().toUpperCase());
        onSuccess(data);
      } else {
        setError(data.error || "መለያው አልተገኘም።");
      }
    } catch (err) {
      setError("የመረብ ግንኙነት ችግር አጋጥሟል።");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImmersiveTransition className="flex flex-col items-center justify-center min-h-screen md:min-h-[80vh] py-3 will-change-contents -mt-21 md:-mt-3">
      {/* Reduced gap for mobile (gap-4 vs gap-8) */}
      <div className="w-full max-w-md flex flex-col gap-4 md:gap-8">
        {/* Responsive Header */}
        <header className="text-center space-y-2 md:space-y-4 px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative mx-auto w-21 h-21 md:w-24 md:h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-white border-2 border-amber-400 shadow-xl overflow-hidden p-1">
              <Image
                src="/assets/images/qdst-bite-krstiyan.jpg"
                alt="Logo"
                fill
                className="object-cover rounded-full"
                priority
              />
            </div>
          </motion.div>

          <div className="space-y-0.5 md:space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-ethiopic">
              ዐጸደ ንስሐ
            </h1>
            <p className="text-[8px] md:text-[10px] text-amber-700 font-black uppercase tracking-[0.3em] md:tracking-[0.4em]">
              Ecclesiastical Gateway
            </p>
          </div>
        </header>

        {/* Sanctuary Surface with adaptive padding */}
        <SanctuarySurface className="rounded-none md:rounded-[2.5rem] border-x-0 md:border shadow-none md:shadow-2xl">
          <div className="px-6 py-8 md:p-12">
            <div className="mb-6 md:mb-10 text-center">
              <h2 className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                የመለያ ቁጥርዎን ያስገቡ
              </h2>
              <div className="h-0.5 w-8 md:w-12 bg-amber-400 mx-auto rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-8">
              <div className="relative group">
                <input
                  type="text"
                  value={eotcUid}
                  autoComplete="off"
                  onChange={(e) => setEotcUid(e.target.value.toUpperCase())}
                  placeholder="EOTC-XXXXXX"
                  className={cn(
                    "w-full px-4 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-amber-500/25 rounded-xl md:rounded-2xl outline-none transition-all",
                    "text-base md:text-xl font-black tracking-widest md:tracking-[0.2em] text-center text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal",
                    "focus:bg-white focus:border-amber-500/35 focus:ring-4 focus:ring-slate-900/5",
                    "will-change-transform"
                  )}
                  required
                />
                <Sparkles className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200 group-focus-within:text-amber-400" />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-[10px] font-bold text-red-700 leading-tight">
                    {error}
                  </p>
                </motion.div>
              )}

              <button
                disabled={loading || !eotcUid}
                className="group relative w-full py-5 md:py-6 bg-slate-950 text-white rounded-xl md:rounded-2xl overflow-hidden active:scale-[0.98] transition-all shadow-xl">
                <div className="relative z-10 flex items-center justify-center gap-3 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
                  {loading ? (
                    <RefreshCcw className="w-4 h-4 animate-spin text-amber-500" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-amber-400" />
                      <span>መለያውን ፈልግ</span>
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>
        </SanctuarySurface>

        {/* Footer info */}
        <div className="px-10 text-center pb-6 md:pb-0">
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">
            ይህ መለያ በአጥቢያዎ በሚገኝ <br />
            <span className="text-slate-600">መምህረ ንስሐ ብቻ የሚሰጥ ነው።</span>
          </p>
          {eotcUid && (
            <button
              onClick={() => {
                localStorage.removeItem("atsede_niseha_uid");
                setEotcUid("");
              }}
              className="mt-3 text-[8px] md:text-[9px] text-slate-300 hover:text-red-400 transition-colors uppercase font-bold">
              አዲስ መለያ ለመጠቀም
            </button>
          )}
        </div>
      </div>
    </ImmersiveTransition>
  );
}
