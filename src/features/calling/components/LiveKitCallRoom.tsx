// src/features/calling/components/LiveKitCallRoom.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Shield,
  Users,
  AlertCircle,
  User,
} from "lucide-react";
import { Room, RoomEvent, VideoTrack, Participant } from "livekit-client";
import { getPusherClient } from "@/services/pusher";

interface LiveKitCallRoomProps {
  channelId: string;
  isIncoming?: boolean;
}

interface TokenResponse {
  success: boolean;
  token: string;
  url: string;
  roomName: string;
  maxParticipants: number;
  participantName: string;
}

interface ParticipantState {
  identity: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isSpeaking: boolean;
  videoTrack: VideoTrack | null;
}

type CallStatus =
  | "loading"
  | "initiating"
  | "ringing"
  | "connected"
  | "reconnecting"
  | "declined"
  | "missed"
  | "cancelled"
  | "busy"
  | "unreachable"
  | "ended"
  | "error";

interface CallStatusResponse {
  callId: string;
  status: string;
  joinable: boolean;
  callerName?: string | null;
}

function isJoinableCallStatus(status: unknown): boolean {
  return status === "ringing" || status === "answered";
}

function createRingbackController() {
  let ctx: AudioContext | null = null;
  let interval: number | null = null;
  let activeNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  const stopBurst = () => {
    activeNodes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(ctx?.currentTime || 0);
        gain.gain.setValueAtTime(0, ctx?.currentTime || 0);
        osc.stop();
      } catch {}
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    });
    activeNodes = [];
  };

  const playBurst = () => {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const duration = 2.0; // seconds on
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      gain.gain.setValueAtTime(0.06, now + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      gain.connect(ctx.destination);

      // Telephone-style ringback: dual-tone
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, now);
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      activeNodes.push({ osc: osc1, gain }, { osc: osc2, gain });
    } catch {}
  };

  const start = async () => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      if (interval) return;
      playBurst();
      interval = window.setInterval(() => {
        stopBurst();
        playBurst();
      }, 5000); // 2s on, 3s off pattern
    } catch {}
  };

  const stop = () => {
    if (interval) {
      window.clearInterval(interval);
      interval = null;
    }
    stopBurst();
  };

  const dispose = async () => {
    stop();
    try {
      await ctx?.close();
    } catch {}
    ctx = null;
  };

  return { start, stop, dispose };
}

export default function LiveKitCallRoom({
  channelId,
  isIncoming = false,
}: LiveKitCallRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCallId = (searchParams.get("callId") || "").trim();
  const [callId, setCallId] = useState<string>(initialCallId);

  const [status, setStatus] = useState<CallStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);

  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRungRef = useRef(false);
  const terminalRef = useRef(false);
  const callIdRef = useRef<string>(initialCallId);
  const statusRef = useRef<CallStatus>("loading");
  const ringbackRef = useRef<ReturnType<typeof createRingbackController> | null>(null);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const ensureRingback = () => {
    if (!ringbackRef.current) ringbackRef.current = createRingbackController();
    return ringbackRef.current;
  };
  const stopRingback = () => {
    try { ringbackRef.current?.stop(); } catch {}
  };

  const setTerminal = (next: CallStatus, message: string, redirectMs = 2500) => {
    if (terminalRef.current) return;
    terminalRef.current = true;
    stopRingback();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus(next);
    setTerminalMessage(message);
    setErrorMessage(next === "error" || next === "unreachable" || next === "busy" ? message : null);
    setTimeout(() => {
      try { router.push("/messages"); } catch {}
    }, redirectMs);
  };

  const mapParticipant = (p: Participant, isLocal: boolean): ParticipantState => {
    const videoPub = Array.from(p.videoTrackPublications.values())[0];
    const isCameraOn = p.isCameraEnabled && !videoPub?.isMuted;
    const vTrack = (videoPub?.track as VideoTrack) || null;
    return {
      identity: p.identity,
      name: p.name || p.identity || (isLocal ? "እርስዎ" : "ተሳታፊ"),
      isLocal,
      isCameraEnabled: Boolean(isCameraOn && vTrack),
      isMicrophoneEnabled: p.isMicrophoneEnabled,
      isSpeaking: p.isSpeaking,
      videoTrack: vTrack,
    };
  };

  const syncParticipants = (room: Room) => {
    const list: ParticipantState[] = [];
    if (room.localParticipant) list.push(mapParticipant(room.localParticipant, true));
    room.remoteParticipants.forEach((rp) => list.push(mapParticipant(rp, false)));
    setParticipants(list);

    if (room.remoteParticipants.size > 0) {
      stopRingback();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setStatus((prev) => (prev === "reconnecting" || prev === "connected" || prev === "ringing" || prev === "initiating" ? "connected" : prev));
      setAnsweredAt((prev) => prev || Date.now());
    }
  };

  useEffect(() => {
    let isMounted = true;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const handlePusherEventForCall = (event: string, data: any) => {
      if (!isMounted || terminalRef.current) return;
      const eventCallId = typeof data?.callId === "string" ? data.callId : null;
      const activeCallId = callIdRef.current;
      if (eventCallId && activeCallId && eventCallId !== activeCallId) return;

      if (event === "call-declined") {
        const st = data?.status || "declined";
        if (st === "busy") setTerminal("busy", "ተቀባዩ በሌላ ጥሪ ላይ ነው");
        else setTerminal("declined", "ጥሪው ተቀባይነት አላገኘም");
      } else if (event === "call-missed") {
        setTerminal("missed", "ጥሪው አልተመለሰም");
      } else if (event === "call-ended") {
        const st = data?.status;
        if (st === "missed") setTerminal("missed", "ጥሪው አልተመለሰም");
        else if (st === "cancelled") setTerminal("cancelled", "ጥሪው ተሰርዟል");
        else setTerminal("ended", "ጥሪው ተጠናቋል");
      } else if (event === "call-answered") {
        // Caller side: callee answered elsewhere/device; proceed as connected when media joins.
        stopRingback();
        if (statusRef.current === "ringing" || statusRef.current === "initiating") {
          // keep waiting for participant/media; timeout guard remains until connected
        }
      } else if (event === "message-updated") {
        const st = data?.callDetails?.status;
        const id = data?.callDetails?.callId || data?.id;
        if (id && activeCallId && id !== activeCallId) return;
        if (st === "declined") setTerminal("declined", "ጥሪው ተቀባይነት አላገኘም");
        else if (st === "missed") setTerminal("missed", "ጥሪው አልተመለሰም");
        else if (st === "cancelled") setTerminal("cancelled", "ጥሪው ተሰርዟል");
        else if (st === "ended" || st === "answered") {
          if (st === "ended") setTerminal("ended", "ጥሪው ተጠናቋል");
        }
      }
    };

    async function init() {
      try {
        setStatus("loading");
        setErrorMessage(null);

        const pusher = getPusherClient();
        const pChannel = pusher.subscribe(`private-chat-${channelId}`);
        const boundHandlers: Array<[string, (d: any) => void]> = [];
        const bind = (ev: string) => {
          const h = (d: any) => handlePusherEventForCall(ev, d);
          boundHandlers.push([ev, h]);
          pChannel.bind(ev, h);
        };
        bind("call-declined");
        bind("call-ended");
        bind("call-missed");
        bind("call-answered");
        bind("message-updated");

        // Room listeners
        const update = () => { if (isMounted) syncParticipants(room); };
        room.on(RoomEvent.TrackSubscribed, update);
        room.on(RoomEvent.TrackUnsubscribed, update);
        room.on(RoomEvent.TrackMuted, update);
        room.on(RoomEvent.TrackUnmuted, update);
        room.on(RoomEvent.ParticipantConnected, update);
        room.on(RoomEvent.ParticipantDisconnected, update);
        room.on(RoomEvent.ActiveSpeakersChanged, update);
        room.on(RoomEvent.Reconnecting, () => { if (isMounted && !terminalRef.current) setStatus("reconnecting"); });
        room.on(RoomEvent.Reconnected, () => { if (isMounted && !terminalRef.current) setStatus("connected"); });
        room.on(RoomEvent.Disconnected, () => {
          if (!isMounted || terminalRef.current) return;
          // If we intentionally ended, terminalRef will be set by handler paths; otherwise treat as ended.
          setTerminal("ended", "ጥሪው ተጠናቋል", 1500);
        });

        // Authoritative pre-join validation for incoming/specific-call joins
        const incomingCallId = initialCallId;
        if (isIncoming || incomingCallId) {
          if (!incomingCallId) {
            setTerminal("error", "የጥሪ መለያ አልተገኘም። ጥሪውን መቀላቀል አይቻልም።");
            return;
          }
          const statusRes = await fetch(
            `/api/livekit/status?callId=${encodeURIComponent(incomingCallId)}&channelId=${encodeURIComponent(channelId)}`,
            { cache: "no-store" }
          );
          if (!isMounted) return;
          if (!statusRes.ok) {
            const msg = statusRes.status === 404 ? "ጥሪው አልተገኘም ወይም ተጠናቋል" : "ጥሪውን ማረጋገጥ አልተቻለም";
            setTerminal("ended", msg);
            return;
          }
          const callStatus = (await statusRes.json().catch(() => null)) as CallStatusResponse | null;
          if (!callStatus || !callStatus.joinable || !isJoinableCallStatus(callStatus.status)) {
            const st = callStatus?.status;
            if (st === "declined") setTerminal("declined", "ጥሪው ተቀባይነት አላገኘም");
            else if (st === "missed") setTerminal("missed", "ጥሪው አልተመለሰም");
            else if (st === "cancelled") setTerminal("cancelled", "ጥሪው ተሰርዟል");
            else setTerminal("ended", "ጥሪው ተጠናቋል");
            return;
          }
          setCallId(incomingCallId);
          callIdRef.current = incomingCallId;

          // Mark answered (idempotent, authoritative)
          fetch("/api/livekit/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, callId: incomingCallId }),
          }).catch(() => {});
        }

        // Fetch token and connect
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "የቪዲዮ ጥሪ ፈቃድ ማግኘት አልተቻለም");
        }
        const data: TokenResponse = await res.json();
        if (!isMounted || terminalRef.current) return;

        await room.connect(data.url, data.token);
        await room.localParticipant.enableCameraAndMicrophone();
        if (!isMounted || terminalRef.current) return;
        syncParticipants(room);

        // Caller flow: initiate ring and play ringback only while authoritatively ringing
        if (!isIncoming && !incomingCallId && !hasRungRef.current) {
          hasRungRef.current = true;
          setStatus("initiating");
          let ringJson: any = null;
          try {
            const ringRes = await fetch("/api/livekit/ring", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channelId }),
            });
            ringJson = await ringRes.json().catch(() => ({}));
            if (!ringRes.ok || ringJson?.status === "busy" || ringJson?.error === "busy") {
              const reason = ringJson?.reason;
              if (reason === "all_busy" || reason === "caller_busy" || ringJson?.error === "busy") {
                setTerminal("busy", "ተቀባዩ በሌላ ጥሪ ላይ ነው");
              } else {
                setTerminal("unreachable", "ጥሪው ተቀባዩን አልደረሰም። እባክዎ እንደገና ይሞክሩ።");
              }
              return;
            }

            if (ringJson?.callId) {
              setCallId(ringJson.callId);
              callIdRef.current = ringJson.callId;
            }

            if (ringJson?.status === "ringing" && ringJson?.success) {
              if (!isMounted || terminalRef.current) return;
              setStatus("ringing");
              // Telephone-style ringback only while authoritatively ringing
              void ensureRingback().start();

              // 45s timeout (caller side) - authoritative transition via server
              timeoutRef.current = setTimeout(async () => {
                if (!isMounted || terminalRef.current) return;
                if (room.remoteParticipants.size === 0) {
                  stopRingback();
                  const cid = callIdRef.current;
                  if (cid) {
                    fetch("/api/livekit/timeout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ channelId, callId: cid }),
                    }).catch(() => {});
                  }
                  setTerminal("missed", "ጥሪው አልተመለሰም", 3000);
                }
              }, 45000);
            } else {
              setTerminal("unreachable", "ጥሪው ተቀባዩን አልደረሰም። እባክዎ እንደገና ይሞክሩ።");
              return;
            }
          } catch (e) {
            console.warn("Failed to ring:", e);
            stopRingback();
            setTerminal("unreachable", "ጥሪው ተቀባዩን አልደረሰም። እባክዎ እንደገና ይሞክሩ።");
            return;
          }
        } else {
          // Incoming join after validation: wait for connection/participants
          setStatus(room.remoteParticipants.size > 0 ? "connected" : "ringing");
        }

        // store bound handlers for cleanup
        (init as any)._boundHandlers = boundHandlers;
        (init as any)._pChannel = pChannel;
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "የኔትወርክ ስህተት ተከስቷል";
        stopRingback();
        setErrorMessage(msg);
        setStatus("error");
      }
    }

    init();

    return () => {
      isMounted = false;
      stopRingback();
      void ringbackRef.current?.dispose();
      ringbackRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try {
        const pusher = getPusherClient();
        const ch = pusher.channel(`private-chat-${channelId}`);
        const handlers = (init as any)._boundHandlers as Array<[string, (d: any) => void]> | undefined;
        if (ch && handlers) {
          handlers.forEach(([ev, h]) => {
            try { ch.unbind(ev, h); } catch {}
          });
        }
        // Do NOT unsubscribe the channel: GlobalIncomingCallOverlay relies on it app-wide.
      } catch {}
      if (room.state !== "disconnected") {
        try { room.disconnect(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isIncoming, router]);

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const newState = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    setIsMicOn(newState);
    syncParticipants(roomRef.current);
  };

  const toggleCam = async () => {
    if (!roomRef.current) return;
    const newState = !isCamOn;
    await roomRef.current.localParticipant.setCameraEnabled(newState);
    setIsCamOn(newState);
    syncParticipants(roomRef.current);
  };

  const handleEndCall = () => {
    if (terminalRef.current) {
      try { router.push("/messages"); } catch {}
      return;
    }
    terminalRef.current = true;
    stopRingback();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const durationSec = answeredAt ? Math.max(1, Math.floor((Date.now() - answeredAt) / 1000)) : 0;
    const cid = callIdRef.current;
    // If caller cancels while ringing before answer -> cancelled; if connected -> answered/end
    const endStatus = statusRef.current === "connected" ? "answered" : "cancelled";
    if (cid) {
      fetch("/api/livekit/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, callId: cid, durationSec, status: endStatus }),
      }).catch(() => {});
    }
    if (roomRef.current) {
      try { roomRef.current.disconnect(); } catch {}
    }
    router.push("/messages");
  };

  const localParticipant = participants.find((p) => p.isLocal);
  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const activeSpeaker = remoteParticipants.find((p) => p.isSpeaking) || remoteParticipants[0] || null;
  const trayParticipants = remoteParticipants.filter((p) => p.identity !== activeSpeaker?.identity).slice(0, 6);
  const overflowParticipants = remoteParticipants.filter((p) => p.identity !== activeSpeaker?.identity).slice(6);

  const statusLabel =
    status === "ringing" || status === "initiating"
      ? "እየጠራ ነው..."
      : status === "connecting" as any
      ? "በመገናኘት ላይ..."
      : status === "reconnecting"
      ? "እንደገና በመገናኘት ላይ..."
      : status === "connected"
      ? "ተገናኝቷል"
      : null;

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 overflow-hidden select-none flex flex-col font-sans">
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">✞ የቪዲዮ ምክክር (Sanctuary Call)</h1>
            <span className="text-[11px] text-slate-400 font-medium">
              {statusLabel || "በቀጥታ በሚስጥር የተጠበቀ (ታሕተ ማኅተም)"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-full text-xs font-bold text-slate-300">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>{participants.length} ተሳታፊዎች</span>
        </div>
      </header>

      <main className="relative flex-1 w-full h-full p-2 sm:p-4 pt-20 pb-24 flex flex-col gap-3">
        {remoteParticipants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
              <span className="text-3xl font-serif">✞</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">
              {status === "ringing" || status === "initiating"
                ? "እየጠራ ነው..."
                : status === "loading"
                ? "ክፍሉ እየተዘጋጀ ነው..."
                : status === "connected"
                ? "ተገናኝቷል"
                : "በመጠበቅ ላይ"}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs">
              {status === "ringing" || status === "initiating"
                ? "ተቀባዩ እስኪመልስ ድረስ እባክዎ ይጠብቁ"
                : "ተሳታፊዎች እስኪገቡ ድረስ እባክዎ ይጠብቁ"}
            </p>
          </div>
        ) : (
          <div className="flex-1 relative w-full rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            {activeSpeaker && <ParticipantCard participant={activeSpeaker} />}
          </div>
        )}

        {trayParticipants.length > 0 && (
          <div className="h-28 sm:h-32 flex items-center gap-2 overflow-x-auto px-1 py-1 shrink-0">
            {trayParticipants.map((p) => (
              <div key={p.identity} className="w-24 sm:w-28 h-full rounded-xl overflow-hidden shadow-lg border border-slate-800 shrink-0">
                <ParticipantCard participant={p} isMini />
              </div>
            ))}
          </div>
        )}

        {overflowParticipants.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-2 py-1 bg-slate-900/60 rounded-xl border border-slate-800 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase">ተጨማሪ ({overflowParticipants.length}):</span>
            {overflowParticipants.map((p) => (
              <div key={p.identity} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300">
                <User className="w-3 h-3 text-amber-400" />
                <span className="truncate max-w-[100px]">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {localParticipant && (
          <div className="absolute bottom-28 right-4 sm:right-6 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/80 bg-slate-950 z-20">
            <ParticipantCard participant={localParticipant} />
          </div>
        )}
      </main>

      {/* Terminal / outcome overlay (dead calls, declined, missed, cancelled, busy, unreachable, ended) */}
      {terminalMessage && status !== "error" && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <PhoneOff className="w-14 h-14 text-amber-500 mb-4" />
          <h2 className="text-xl font-black text-slate-100 mb-2">
            {status === "busy" ? "ተይዟል" : status === "unreachable" ? "አልደረሰም" : "ጥሪው ተጠናቋል"}
          </h2>
          <p className="text-sm text-slate-300 max-w-sm mb-6">{terminalMessage}</p>
          <button
            onClick={() => router.push("/messages")}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            ወደ ውይይት ተመለስ
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-black text-slate-100 mb-2">የጥሪ ስህተት ተከስቷል</h2>
          <p className="text-sm text-slate-400 max-w-sm mb-6">{errorMessage || "ወደ ክፍሉ መገናኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።"}</p>
          <button
            onClick={() => {
              try { router.push("/messages"); } catch {}
            }}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            ወደ ውይይት ተመለስ
          </button>
        </div>
      )}

      <footer className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-4 sm:gap-6 py-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
        <button
          onClick={toggleMic}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isMicOn ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
          }`}
          title={isMicOn ? "ማይክሮፎን አጥፋ" : "ማይክሮፎን አብራ"}
        >
          {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        <button
          onClick={toggleCam}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isCamOn ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
          }`}
          title={isCamOn ? "ካሜራ አጥፋ" : "ካሜራ አብራ"}
        >
          {isCamOn ? <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        <button
          onClick={handleEndCall}
          className="p-3.5 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-2xl hover:scale-110 active:scale-95 border border-red-500"
          title="ጥሪውን አቋርጥ"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </footer>
    </div>
  );
}

function ParticipantCard({
  participant,
  isMini = false,
}: {
  participant: ParticipantState;
  isMini?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.videoTrack) return;
    participant.videoTrack.attach(el);
    return () => {
      try { participant.videoTrack?.detach(el); } catch {}
    };
  }, [participant.videoTrack, participant.isCameraEnabled]);

  const initial = useMemo(() => {
    const clean = participant.name.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
    return clean.charAt(0) || "✞";
  }, [participant.name]);

  return (
    <div
      className={`relative w-full h-full bg-slate-900 border overflow-hidden flex items-center justify-center transition-all ${
        participant.isSpeaking ? "border-emerald-500 shadow-emerald-500/20 shadow-lg" : "border-slate-800"
      }`}
    >
      {participant.isCameraEnabled && participant.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`w-full h-full object-cover ${participant.isLocal ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2 text-center gap-2">
          <div
            className={`rounded-full flex items-center justify-center ${
              isMini ? "w-10 h-10" : "w-20 h-20 sm:w-24 sm:h-24"
            } bg-gradient-to-tr from-amber-900 via-amber-700 to-amber-500 border border-amber-300/40`}
          >
            <span className={`${isMini ? "text-sm" : "text-2xl sm:text-3xl"} font-black text-amber-50 font-serif`}>{initial}</span>
          </div>
          {!isMini && (
            <>
              <p className="text-xs sm:text-sm font-bold text-slate-200">{participant.name}</p>
              <span className="text-[10px] text-slate-500">ካሜራ ጠፍቷል</span>
            </>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1.5 max-w-[85%]">
        {!participant.isMicrophoneEnabled && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
        <span className="text-[10px] font-bold text-slate-200 truncate">{participant.name}</span>
      </div>
    </div>
  );
}
