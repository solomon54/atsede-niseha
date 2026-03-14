// src/features/auth/components/ProfilePreviewStep.tsx

"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Church,
  GraduationCap,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { useState } from "react";

import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { AuthContext, UserRole } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

interface Props {
  data: AuthContext;
  role: UserRole;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ProfilePreviewStep({
  data,
  role,
  onConfirm,
  onBack,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const displayName = data.displayName || "የተከበሩ ተጠቃሚ";

  // Role-specific mapping
  const subDetail = role === "FATHER" ? data.parish : data.university;
  const SubIcon = role === "FATHER" ? Church : GraduationCap;
  const roleLabel = role === "FATHER" ? "መምህረ ንስሐ" : "የንስሐ ልጅ";

  return (
    <ImmersiveTransition className="flex flex-col items-center justify-center min-h-screen will-change-contents">
      {/* Container adapts to screen: Full width on mobile, max-width on desktop */}
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Sacred Header - Matching Security Step */}
        <header className="text-center space-y-3 px-6">
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">
            Identity Verification
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter font-ethiopic">
            ማንነትዎን ያረጋግጡ
          </h1>
        </header>

        <SanctuarySurface className="rounded-none md:rounded-[2.5rem] border-x-0 md:border shadow-none md:shadow-2xl">
          <div className="px-6 py-10 md:p-12 flex flex-col items-center text-center">
            {/* Back Button - Minimalist Architectural */}
            <div className="w-full flex justify-start mb-8">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-amber-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> ተመለስ
              </button>
            </div>

            {/* Profile Frame with Sacred Halo */}
            <div className="relative mb-8">
              {/* STATIC Sacred Halo */}
              <div className="absolute -inset-3 border border-amber-200/40 rounded-full border-dashed pointer-events-none" />

              {/* Secondary Glow (Static) */}
              <div className="absolute -inset-6 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

              <div className="relative w-36 h-36 rounded-full p-1.5 bg-linear-to-b from-amber-400 to-amber-100 shadow-2xl">
                <div className="w-full h-full rounded-full bg-slate-50 overflow-hidden flex items-center justify-center border-4 border-white">
                  {data.photoUrl && !imgError ? (
                    <img
                      src={data.photoUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <User className="w-16 h-16 text-slate-200" />
                  )}
                </div>

                {/* Verified Badge */}
                <div className="absolute bottom-1 right-1 bg-white rounded-full p-1.5 shadow-xl border border-slate-100">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 fill-emerald-50" />
                </div>
              </div>
            </div>

            {/* Identity Text */}
            <div className="space-y-2 mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest">
                <Award className="w-3 h-3" /> {roleLabel}
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight font-ethiopic">
                {role === "FATHER" && data.title && (
                  <span className="block text-lg text-amber-700 font-bold mb-1 opacity-80">
                    {data.title}
                  </span>
                )}
                {displayName}
              </h2>
            </div>

            {/* Structured Metadata Grid */}
            <div className="w-full space-y-3 py-6 border-y border-slate-100 mb-8">
              <div className="flex items-center justify-center gap-3 text-slate-500">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-tight">
                  {data.diocese || "ሀገረ ስብከት አልተጠቀሰም"}
                </span>
              </div>

              {subDetail && (
                <div className="flex items-center justify-center gap-3 text-slate-900">
                  <SubIcon className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-black font-ethiopic">
                    {subDetail}
                  </span>
                </div>
              )}
            </div>

            {/* Tactile Action Section */}
            <div className="w-full space-y-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                ይህ የእርስዎ መለያ መሆኑን ካረጋገጡ <br /> መግቢያዎን ያዘጋጁ
              </p>

              <button
                onClick={onConfirm}
                className="w-full py-6 bg-slate-950 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-xl md:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-transform cursor-pointer">
                <span>አዎ እኔ ነኝ - ቀጥል</span>
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </SanctuarySurface>

        {/* Legal Footer */}
        <footer className="pb-10 text-center px-8">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.4em] leading-loose opacity-60">
            Atsede Niseha Identity Ledger <br />
            <span className="text-slate-900">
              Ecclesiastical Verification System
            </span>
          </p>
        </footer>
      </div>
    </ImmersiveTransition>
  );
}
