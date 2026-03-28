//src/app/unauthorized/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(21);

  const requiredRole = searchParams.get("required") || "ፈቃድ";
  const attemptedPath = searchParams.get("from") || "";

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) router.push("/");
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FCFBF7] p-4 sm:p-6 selection:bg-amber-100 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-64 h-64 rounded-full bg-amber-600 blur-[80px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-64 h-64 rounded-full bg-slate-900 blur-[80px]" />
      </div>

      <div className="max-w-md w-full bg-white border border-amber-100/50 rounded-[2rem] p-6 sm:p-10 shadow-2xl shadow-amber-900/5 text-center relative z-10">
        {/* Icon - Scaled for mobile */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* English Labels - Micro fonts for small screens */}
        <h2 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/60 mb-1">
          Access Restricted
        </h2>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 mb-4">
          ይህ ገጽ ለእርስዎ አልተፈቀደም
        </h1>

        <div className="space-y-4 mb-8 text-center">
          <p className="text-slate-600 text-[13px] sm:text-sm leading-relaxed">
            ወደ{" "}
            <span className="font-mono text-amber-800 font-bold bg-amber-50 px-1 rounded text-[11px]">
              {attemptedPath || "ገጹ"}
            </span>{" "}
            ለመግባት የ
            <span className="text-slate-900 font-bold"> {requiredRole} </span>
            {"__"}
            ኃላፊነት ያስፈልጋል።
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 italic leading-snug">
            ስህተት ነው ብለው ካሰቡ እባክዎ አስተዳዳሪውን ያነጋግሩ።
          </p>
        </div>

        {/* Action Buttons - Stack on tiny screens, side-by-side on small */}
        <div className="flex flex-col xs:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
            ወደ መግቢያ ተመለስ
          </Link>

          <button
            onClick={() => router.back()}
            className="flex-1 bg-white border border-slate-200 text-slate-600 py-3.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">
            ወደ ኋላ ተመለስ
          </button>
        </div>

        {/* Redirect Timer */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-px w-6 bg-slate-300" />
          <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
            በ{" "}
            <span className="text-amber-400 font-black underline hover:cursor-pointer">
              {countdown}
            </span>{" "}
            ሰከንድ ውስጥ በራሱ ይመለሳል
          </span>
          <div className="h-px w-6 bg-slate-100" />
        </div>
      </div>

      {/* Footer Branding */}
      <p className="mt-6 text-[8px] text-slate-400 font-bold uppercase tracking-[0.3em] opacity-40">
        አጸደ ንሴህ • Atsede Niseha
      </p>
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams in Next.js 13+ Client Components
export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FCFBF7]" />}>
      <UnauthorizedContent />
    </Suspense>
  );
}
