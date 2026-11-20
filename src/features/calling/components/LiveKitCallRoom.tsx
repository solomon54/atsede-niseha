// src/features/calling/components/LiveKitCallRoom.tsx
"use client";

import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Shield,
  User,
  Users,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef } from "react";

import { callRoleLabel } from "@/shared/domain/calling/participantIdentity";

import { useCall } from "../callProvider";
import type { CallParticipantView } from "../types";

export default function LiveKitCallRoom({ channelId }: { channelId: string }) {
  const searchParams = useSearchParams();
  const requestedCallId = (searchParams.get("callId") || "").trim();
  const {
    call,
    participants,
    localParticipant,
    connection,
    duration,
    recoverCall,
    answer,
    decline,
    end,
    toggleMic,
    toggleCamera,
  } = useCall();
  const recoveryAttempted = useRef<string>("");

  useEffect(() => {
    if (!requestedCallId) return;
    const key = `${channelId}:${requestedCallId}`;
    if (recoveryAttempted.current === key) return;
    if (call?.callId === requestedCallId) return;
    recoveryAttempted.current = key;
    void recoverCall(channelId, requestedCallId);
  }, [call?.callId, channelId, recoverCall, requestedCallId]);

  if (!call || call.channelId !== channelId) {
    return (
      <CallFrame>
        <div className="flex flex-col items-center gap-3 text-center">
          <Shield className="h-10 w-10 animate-pulse text-amber-400" />
          <h2 className="text-lg font-bold text-slate-100">ክፍሉ እየተመለሰ ነው...</h2>
          <p className="max-w-xs text-xs text-slate-400">
            {requestedCallId ? "የጥሪው ሁኔታ እየተረጋገጠ ነው።" : "ንቁ ጥሪ አልተገኘም።"}
          </p>
        </div>
      </CallFrame>
    );
  }

  if (call.phase === "terminal") {
    return (
      <CallFrame>
        <div className="flex flex-col items-center gap-4 text-center">
          <PhoneOff className="h-14 w-14 text-amber-500" />
          <h2 className="text-xl font-black text-slate-100">ጥሪው ተጠናቋል</h2>
          <p className="max-w-sm text-sm text-slate-300">{call.terminal?.message}</p>
          <p className="text-[11px] text-slate-500">ወደ ውይይት ተመልሰዋል...</p>
        </div>
      </CallFrame>
    );
  }

  if (call.phase === "incoming") {
    return (
      <CallFrame>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-amber-500/60 bg-slate-800 shadow-2xl">
            {call.peer.photoUrl ? (
              <img src={call.peer.photoUrl} alt={call.peer.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-3xl font-black text-amber-400">
                {call.peer.name.charAt(0) || "✞"}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-100">{call.peer.name}</h2>
            <p className="text-sm font-semibold text-amber-400/80">{callRoleLabel(call.peer.role)}</p>
            <p className="mt-2 animate-pulse text-xs text-slate-400">እየጠራ ነው...</p>
          </div>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => void decline()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500"
              aria-label="Decline call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => void answer()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
              aria-label="Answer call"
            >
              <Phone className="h-7 w-7" />
            </button>
          </div>
        </div>
      </CallFrame>
    );
  }

  const remotes = participants.filter((p) => !p.isLocal);
  const activeSpeaker = remotes.find((p) => p.isSpeaking) || remotes[0] || null;
  const tray = remotes.filter((p) => p.identity !== activeSpeaker?.identity).slice(0, 6);
  const overflow = remotes.filter((p) => p.identity !== activeSpeaker?.identity).slice(6);
  const statusLabel =
    connection === "reconnecting"
      ? "እንደገና በመገናኘት ላይ..."
      : connection === "connecting"
      ? "በመገናኘት ላይ..."
      : call.phase === "answered"
      ? "ተገናኝቷል"
      : "እየጠራ ነው...";

  return (
    <div className="relative flex h-[100dvh] w-full select-none flex-col overflow-hidden bg-slate-950 font-sans">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-100">✞ የቪዲዮ ምክክር (Sanctuary Call)</h1>
            <span className="text-[11px] font-medium text-slate-400">
              {call.peer.name} · {callRoleLabel(call.peer.role)} · {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs font-bold text-slate-300">
          <Users className="h-3.5 w-3.5 text-amber-400" />
          <span>{participants.length} ተሳታፊዎች</span>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col gap-3 p-2 pb-24 pt-20 sm:p-4 sm:pt-20">
        {!activeSpeaker ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/30 bg-amber-500/10 text-amber-400">
              {call.peer.photoUrl ? (
                <img src={call.peer.photoUrl} alt={call.peer.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-3xl">{call.peer.name.charAt(0) || "✞"}</span>
              )}
            </div>
            <h2 className="mb-1 text-lg font-bold text-slate-100">{call.peer.name}</h2>
            <p className="text-xs text-slate-400">{callRoleLabel(call.peer.role)}</p>
            <p className="mt-3 text-xs text-slate-400">
              {call.phase === "outgoing" ? "ተቀባዩ እስኪመልስ ድረስ ይጠብቁ" : "ተሳታፊዎች እስኪገቡ ድረስ ይጠብቁ"}
            </p>
            <span className="mt-2 font-mono text-xs text-amber-400">{duration}</span>
          </div>
        ) : (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <ParticipantCard participant={activeSpeaker} />
          </div>
        )}

        {tray.length > 0 && (
          <div className="flex h-28 shrink-0 items-center gap-2 overflow-x-auto px-1 py-1 sm:h-32">
            {tray.map((p) => (
              <div key={p.identity} className="h-full w-24 shrink-0 overflow-hidden rounded-xl border border-slate-800 sm:w-28">
                <ParticipantCard participant={p} isMini />
              </div>
            ))}
          </div>
        )}

        {overflow.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 px-2 py-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">ተጨማሪ ({overflow.length}):</span>
            {overflow.map((p) => (
              <span key={p.identity} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                <User className="h-3 w-3 text-amber-400" />
                <span className="max-w-[100px] truncate">{p.name}</span>
              </span>
            ))}
          </div>
        )}

        {localParticipant && (
          <div className="absolute bottom-28 right-4 z-20 h-36 w-28 overflow-hidden rounded-2xl border-2 border-amber-500/80 bg-slate-950 shadow-2xl sm:right-6 sm:h-48 sm:w-36">
            <ParticipantCard participant={localParticipant} />
          </div>
        )}
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent py-5 sm:gap-6">
        <ControlButton
          onClick={() => void toggleMic()}
          active={!!localParticipant?.isMicrophoneEnabled}
          onIcon={<Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
          offIcon={<MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          label={localParticipant?.isMicrophoneEnabled ? "ማይክሮፎን አጥፋ" : "ማይክሮፎን አብራ"}
        />
        <ControlButton
          onClick={() => void toggleCamera()}
          active={!!localParticipant?.isCameraEnabled}
          onIcon={<VideoIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
          offIcon={<VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          label={localParticipant?.isCameraEnabled ? "ካሜራ አጥፋ" : "ካሜራ አብራ"}
        />
        <button
          type="button"
          onClick={() => void end()}
          className="rounded-full border border-red-500 bg-red-600 p-3.5 text-white shadow-2xl transition-all hover:scale-110 hover:bg-red-700 active:scale-95 sm:p-4"
          title="ጥሪውን አቋርጥ"
          aria-label="End call"
        >
          <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </footer>
    </div>
  );
}

function CallFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center bg-slate-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(217,119,6,0.1)_0%,_transparent_60%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function ControlButton({
  onClick,
  active,
  onIcon,
  offIcon,
  label,
}: {
  onClick: () => void;
  active: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-full p-3.5 shadow-xl transition-all sm:p-4 ${
        active
          ? "border border-slate-700 bg-slate-800/90 text-white hover:bg-slate-700 hover:scale-105"
          : "scale-105 border border-red-400 bg-red-500 text-white hover:bg-red-600"
      }`}
    >
      {active ? onIcon : offIcon}
    </button>
  );
}

function ParticipantCard({
  participant,
  isMini = false,
}: {
  participant: CallParticipantView;
  isMini?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !participant.videoTrack) return;
    try {
      participant.videoTrack.attach(element);
      return () => {
        try { participant.videoTrack?.detach(element); } catch {}
      };
    } catch {
      return;
    }
  }, [participant.videoTrack, participant.isCameraEnabled]);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden border ${
        participant.isSpeaking ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-slate-800"
      } bg-slate-900`}
    >
      {participant.isCameraEnabled && participant.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`h-full w-full object-cover ${participant.isLocal ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2 text-center">
          <div
            className={`overflow-hidden rounded-full border border-amber-300/40 bg-gradient-to-tr from-amber-900 via-amber-700 to-amber-500 ${
              isMini ? "h-10 w-10" : "h-20 w-20 sm:h-24 sm:w-24"
            }`}
          >
            {participant.photoUrl ? (
              <img src={participant.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className={`font-serif font-black text-amber-50 ${isMini ? "text-sm" : "text-2xl sm:text-3xl"}`}>
                  {participant.name.charAt(0) || "✞"}
                </span>
              </div>
            )}
          </div>
          {!isMini && (
            <>
              <p className="text-xs font-bold text-slate-200 sm:text-sm">{participant.name}</p>
              {participant.role && (
                <p className="text-[10px] text-amber-400/80">{callRoleLabel(participant.role)}</p>
              )}
              <span className="text-[10px] text-slate-500">ካሜራ ጠፍቷል</span>
            </>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 z-10 flex max-w-[85%] items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 backdrop-blur-sm">
        {!participant.isMicrophoneEnabled && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
        <span className="truncate text-[10px] font-bold text-slate-200">{participant.name}</span>
      </div>
    </div>
  );
}
