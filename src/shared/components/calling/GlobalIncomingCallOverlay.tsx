// src/shared/components/calling/GlobalIncomingCallOverlay.tsx
"use client";

import { BellRing, Phone, PhoneOff, Shield, Users, Video } from "lucide-react";
import React from "react";

import { useCall } from "@/features/calling/callProvider";
import { callRoleLabel } from "@/shared/domain/calling/participantIdentity";

/** Global incoming-call presentation. State and transitions live in CallProvider. */
export function GlobalIncomingCallOverlay() {
  const {
    call,
    audioBlocked,
    isOnCallRoute,
    notificationPermission,
    requestNotificationPermission,
    answer,
    decline,
  } = useCall();

  if (!call || call.phase !== "incoming" || isOnCallRoute) return null;

  const peer = call.peer;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(217,119,6,0.12)_0%,_transparent_60%)]" />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col items-center justify-between px-6 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
            <Shield className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-extrabold tracking-wide text-amber-300">
              {call.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቀጥታ የቪዲዮ ጥሪ"}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">የንስሐ ሚስጥር ጥሪ እየቀረበ ነው</p>
          {audioBlocked && (
            <p className="mt-1 max-w-xs text-center text-[10px] font-semibold text-amber-400/90">
              የጥሪ ድምጽ በአሳሹ ተከልክሏል፤ ጥሪው እየመጣ ነው።
            </p>
          )}
          {notificationPermission === "default" && (
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="mt-2 flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:border-amber-500/40"
            >
              <BellRing className="h-3 w-3 text-amber-400" />
              የጥሪ ማሳወቂያ አንቃ
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 h-32 w-32 animate-ping rounded-full border-2 border-amber-500/30" />
            <div className="absolute -inset-3 h-[152px] w-[152px] animate-pulse rounded-full border border-amber-500/15" />
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-amber-500/60 bg-slate-800 shadow-2xl shadow-amber-900/40">
              {peer?.photoUrl ? (
                <img src={peer.photoUrl} alt={peer.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-4xl font-black text-amber-400">
                  {peer?.name?.charAt(0) || "✞"}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-100">{peer?.name}</h2>
            {peer?.role && (
              <p className="text-sm font-semibold text-amber-400/80">{callRoleLabel(peer.role)}</p>
            )}
            <div className="mt-2 flex items-center justify-center gap-2 text-slate-400">
              {call.isGroup ? <Users className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              <span className="animate-pulse text-xs font-medium">እየጠራ ነው...</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-16 sm:gap-20">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void decline()}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/30 bg-red-600 shadow-xl shadow-red-900/40 transition-all duration-200 hover:bg-red-500 active:scale-95 sm:h-[72px] sm:w-[72px]"
              aria-label="Decline call"
            >
              <PhoneOff className="h-7 w-7 text-white sm:h-8 sm:w-8" />
            </button>
            <span className="text-xs font-bold text-red-400">አትቀበል</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void answer()}
              className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full border-2 border-emerald-400/30 bg-emerald-600 shadow-xl shadow-emerald-900/40 transition-all duration-200 hover:bg-emerald-500 active:scale-95 sm:h-[72px] sm:w-[72px]"
              style={{ animationDuration: "2s" }}
              aria-label="Answer call"
            >
              <Phone className="h-7 w-7 text-white sm:h-8 sm:w-8" />
            </button>
            <span className="text-xs font-bold text-emerald-400">ተቀበል</span>
          </div>
        </div>
      </div>
    </div>
  );
}
