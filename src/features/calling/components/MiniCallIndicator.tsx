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
      className="fixed bottom-16 right-3 z-[9000] flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-slate-950/95 px-2.5 py-2 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur md:bottom-5 md:right-5"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={openCall}
        className="flex min-w-0 items-center gap-2 text-left"
        aria-label="Return to active call"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/50 bg-slate-800">
          {call.peer.photoUrl ? (
            <img src={call.peer.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Video className="h-4 w-4 text-amber-400" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block max-w-[130px] truncate text-xs font-bold sm:max-w-[170px]">
            {call.peer.name}
          </span>
          <span className="block max-w-[130px] truncate text-[10px] text-slate-400 sm:max-w-[170px]">
            {callRoleLabel(call.peer.role)} · {label}
          </span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-400" />
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
