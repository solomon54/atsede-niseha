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
import {
  Room,
  RoomEvent,
  VideoTrack,
  Participant,
} from "livekit-client";
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

export default function LiveKitCallRoom({
  channelId,
  isIncoming = false,
}: LiveKitCallRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callId, setCallId] = useState<string>(searchParams.get("callId") || "");

  const [status, setStatus] = useState<
    "loading" | "ringing" | "connected" | "reconnecting" | "declined" | "no_answer" | "error" | "ended"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);

  // LiveKit room & participants state
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRungRef = useRef(false);

  // Helper: map LiveKit participant to state
  const mapParticipant = (
    p: Participant,
    isLocal: boolean
  ): ParticipantState => {
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
    if (room.localParticipant) {
      list.push(mapParticipant(room.localParticipant, true));
    }
    room.remoteParticipants.forEach((rp) => {
      list.push(mapParticipant(rp, false));
    });
    setParticipants(list);

    if (room.remoteParticipants.size > 0) {
      setStatus("connected");
      if (!answeredAt) {
        setAnsweredAt(Date.now());
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    async function init() {
      try {
        setStatus("loading");

        // 1. Fetch token from server
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
        if (!isMounted) return;

        // 2. Setup Pusher listeners
        try {
          const pusher = getPusherClient();
          const pChannel = pusher.subscribe(`private-chat-${channelId}`);
          pChannel.bind("call-declined", () => {
            if (isMounted) {
              setStatus("declined");
              setTimeout(() => {
                router.push("/messages");
              }, 2500);
            }
          });
          pChannel.bind("call-ended", () => {
            if (isMounted) {
              setStatus("ended");
              setTimeout(() => {
                router.push("/messages");
              }, 2000);
            }
          });
        } catch (pe) {
          console.warn("[Pusher Call Listener Error]", pe);
        }

        // 3. Setup Room Listeners
        const update = () => {
          if (isMounted) syncParticipants(room);
        };

        room.on(RoomEvent.TrackSubscribed, update);
        room.on(RoomEvent.TrackUnsubscribed, update);
        room.on(RoomEvent.TrackMuted, update);
        room.on(RoomEvent.TrackUnmuted, update);
        room.on(RoomEvent.ParticipantConnected, update);
        room.on(RoomEvent.ParticipantDisconnected, update);
        room.on(RoomEvent.ActiveSpeakersChanged, update);

        room.on(RoomEvent.Reconnecting, () => {
          if (isMounted) setStatus("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (isMounted) setStatus("connected");
        });
        room.on(RoomEvent.Disconnected, () => {
          if (isMounted) setStatus("ended");
        });

        // 4. Connect to LiveKit Room
        await room.connect(data.url, data.token);

        // 5. Publish local camera & mic
        await room.localParticipant.enableCameraAndMicrophone();
        if (!isMounted) return;

        syncParticipants(room);

        // 6. Ring other members if initiating
        if (!isIncoming && !hasRungRef.current) {
          hasRungRef.current = true;
          setStatus("ringing");

          fetch("/api/livekit/ring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId }),
          })
            .then((r) => r.json())
            .then((resData) => {
              if (resData.callId) {
                setCallId(resData.callId);
              }
            })
            .catch((e) => console.warn("Failed to ring:", e));

          // 45s Timeout for No Answer
          timeoutRef.current = setTimeout(() => {
            if (isMounted && room.remoteParticipants.size === 0) {
              setStatus("no_answer");
              fetch("/api/livekit/timeout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId, callId }),
              }).catch(() => {});
              setTimeout(() => {
                router.push("/messages");
              }, 3000);
            }
          }, 45000);
        } else {
          setStatus(room.remoteParticipants.size > 0 ? "connected" : "ringing");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "የኔትወርክ ስህተት ተከስቷል";
        setErrorMessage(msg);
        setStatus("error");
      }
    }

    init();

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (room.state !== "disconnected") {
        room.disconnect();
      }
      try {
        const pusher = getPusherClient();
        pusher.unsubscribe(`private-chat-${channelId}`);
      } catch {}
    };
  }, [channelId, isIncoming, router]);

  // Controls
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const durationSec = answeredAt ? Math.max(1, Math.floor((Date.now() - answeredAt) / 1000)) : 0;
    fetch("/api/livekit/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        callId,
        durationSec,
        status: status === "connected" ? "answered" : "cancelled",
      }),
    }).catch(() => {});

    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    router.push("/messages");
  };

  // Adaptive 3-tier partitioning for participants
  const localParticipant = participants.find((p) => p.isLocal);
  const remoteParticipants = participants.filter((p) => !p.isLocal);

  // Dominant active speaker (or first remote)
  const activeSpeaker =
    remoteParticipants.find((p) => p.isSpeaking) ||
    remoteParticipants[0] ||
    null;

  // Horizontal Tray: up to 6 thumbnails
  const trayParticipants = remoteParticipants
    .filter((p) => p.identity !== activeSpeaker?.identity)
    .slice(0, 6);

  // Overflow for large groups
  const overflowParticipants = remoteParticipants
    .filter((p) => p.identity !== activeSpeaker?.identity)
    .slice(6);

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 overflow-hidden select-none flex flex-col font-sans">
      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
              ✞ የቪዲዮ ምክክር (Sanctuary Call)
            </h1>
            <span className="text-[11px] text-slate-400 font-medium">
              በቀጥታ በሚስጥር የተጠበቀ (ታሕተ ማኅተም)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-full text-xs font-bold text-slate-300">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>{participants.length} ተሳታፊዎች</span>
        </div>
      </header>

      {/* Main Video View: Adaptive Stage + Tray */}
      <main className="relative flex-1 w-full h-full p-2 sm:p-4 pt-20 pb-24 flex flex-col gap-3">
        {/* Ringing or Waiting State */}
        {remoteParticipants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
              <span className="text-3xl font-serif">✞</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">
              {status === "ringing" ? "እየጠራ ነው... ተሳታፊዎችን በመጠበቅ ላይ" : "ክፍሉ እየተዘጋጀ ነው..."}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs">
              ተሳታፊዎች እስኪገቡ ድረስ እባክዎ ይጠብቁ
            </p>
          </div>
        ) : (
          /* Active Speaker Dominant Stage */
          <div className="flex-1 relative w-full rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            {activeSpeaker && <ParticipantCard participant={activeSpeaker} />}
          </div>
        )}

        {/* Tier 2: Horizontal Video Tray (Max 6 for group calls) */}
        {trayParticipants.length > 0 && (
          <div className="h-28 sm:h-32 flex items-center gap-2 overflow-x-auto px-1 py-1 shrink-0">
            {trayParticipants.map((p) => (
              <div
                key={p.identity}
                className="w-24 sm:w-28 h-full rounded-xl overflow-hidden shadow-lg border border-slate-800 shrink-0"
              >
                <ParticipantCard participant={p} isMini />
              </div>
            ))}
          </div>
        )}

        {/* Tier 3: Overflow Participant List */}
        {overflowParticipants.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-2 py-1 bg-slate-900/60 rounded-xl border border-slate-800 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              ተጨማሪ ({overflowParticipants.length}):
            </span>
            {overflowParticipants.map((p) => (
              <div
                key={p.identity}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300"
              >
                <User className="w-3 h-3 text-amber-400" />
                <span className="truncate max-w-[100px]">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Floating Local PiP Camera */}
        {localParticipant && (
          <div className="absolute bottom-28 right-4 sm:right-6 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/80 bg-slate-950 z-20">
            <ParticipantCard participant={localParticipant} />
          </div>
        )}
      </main>

      {/* Error Overlay */}
      {status === "error" && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-black text-slate-100 mb-2">
            የጥሪ ስህተት ተከስቷል
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            {errorMessage || "ወደ ክፍሉ መገናኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።"}
          </p>
          <button
            onClick={handleEndCall}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            ወደ ውይይት ተመለስ
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-4 sm:gap-6 py-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
        <button
          onClick={toggleMic}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isMicOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
          }`}
          title={isMicOn ? "ማይክሮፎን አጥፋ" : "ማይክሮፎን አብራ"}
        >
          {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        <button
          onClick={toggleCam}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isCamOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
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
      participant.videoTrack?.detach(el);
    };
  }, [participant.videoTrack, participant.isCameraEnabled]);

  const initial = useMemo(() => {
    const clean = participant.name.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
    return clean.charAt(0) || "✞";
  }, [participant.name]);

  return (
    <div
      className={`relative w-full h-full bg-slate-900 border overflow-hidden flex items-center justify-center transition-all ${
        participant.isSpeaking
          ? "border-emerald-500 shadow-emerald-500/20 shadow-lg"
          : "border-slate-800"
      }`}
    >
      {participant.isCameraEnabled && participant.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`w-full h-full object-cover ${
            participant.isLocal ? "scale-x-[-1]" : ""
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2 text-center gap-2">
          <div
            className={`rounded-full flex items-center justify-center ${
              isMini ? "w-10 h-10" : "w-20 h-20 sm:w-24 sm:h-24"
            } bg-gradient-to-tr from-amber-900 via-amber-700 to-amber-500 border border-amber-300/40`}
          >
            <span
              className={`${
                isMini ? "text-sm" : "text-2xl sm:text-3xl"
              } font-black text-amber-50 font-serif`}
            >
              {initial}
            </span>
          </div>
          {!isMini && (
            <>
              <p className="text-xs sm:text-sm font-bold text-slate-200">
                {participant.name}
              </p>
              <span className="text-[10px] text-slate-500">ካሜራ ጠፍቷል</span>
            </>
          )}
        </div>
      )}

      {/* Participant Name Badge */}
      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1.5 max-w-[85%]">
        {!participant.isMicrophoneEnabled && (
          <MicOff className="w-3 h-3 text-red-400 shrink-0" />
        )}
        <span className="text-[10px] font-bold text-slate-200 truncate">
          {participant.name}
        </span>
      </div>
    </div>
  );
}
