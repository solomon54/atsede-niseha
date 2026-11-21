// src/features/calling/components/MiniCallIndicator.tsx
"use client";

import { ArrowUpRight, PhoneOff, Video } from "lucide-react";
import React from "react";

import { callRoleLabel } from "@/shared/domain/calling/participantIdentity";

import { useCall } from "../callProvider";

/** Persistent return path to the active call while navigating other pages. */
export function MiniCallIndicator() {
  const { call, duration, connection, isOnCallRoute, openCall, end } = useCall();

  if (!call || call.phase === "incoming" || isOnCallRoute) return null;

  const label =
    call.phase === "terminal"
      ? call.terminal?.message || "ጥሪው ተጠናቋል"
      : call.phase === "answered"
      ? connection === "reconnecting"
        ? "እንደገና በመገናኘት ላይ"
        : `${duration} · ተገናኝቷል`
      : "እየጠራ ነው...";

  return (
    <div
      className="fixed bottom-20 right-3 z-[9999] flex items-center gap-2 rounded-2xl border border-amber-500/50 bg-slate-950/95 px-3 py-2 text-slate-100 shadow-2xl shadow-black/60 ring-1 ring-amber-500/20 backdrop-blur md:bottom-6 md:right-6 animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={openCall}
        className="flex min-w-0 items-center gap-2.5 text-left transition-opacity hover:opacity-90"
        aria-label="Return to active call"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/60 bg-slate-800">
          {call.peer.photoUrl ? (
            <img src={call.peer.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Video className="h-4 w-4 text-amber-400" />
          )}
          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${
              call.phase === "answered" ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
            }`}
          />
        </span>
        <span className="min-w-0">
          <span className="block max-w-[130px] truncate text-xs font-bold sm:max-w-[170px]">
            {call.peer.name}
          </span>
          <span className="block max-w-[130px] truncate text-[10px] text-slate-300 sm:max-w-[170px]">
            {label}
          </span>
        </span>
        <span className="flex h-7 items-center rounded-lg bg-amber-500/10 px-2 text-[10px] font-bold text-amber-400 hover:bg-amber-500/20">
          ተመለስ <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
        </span>
      </button>
      {call.phase !== "terminal" && (
        <button
          type="button"
          onClick={() => void end()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500"
          aria-label="End call"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
