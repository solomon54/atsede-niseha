// src/features/calling/components/LiveKitCallRoom.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Shield,
  Users,
  AlertCircle,
  Volume2,
  Clock,
  PhoneMissed,
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

  const [status, setStatus] = useState<
    "loading" | "ringing" | "connected" | "reconnecting" | "declined" | "no_answer" | "error" | "ended"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  // LiveKit room & participants state
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRungRef = useRef(false);

  // Helper: map LiveKit participant to our clean state
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

        // 2. Setup Pusher listener for call-declined event
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

        // 6. Ring other channel members if initiating
        if (!isIncoming && !hasRungRef.current) {
          hasRungRef.current = true;
          setStatus("ringing");

          fetch("/api/livekit/ring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId }),
          }).catch((e) => console.warn("Failed to ring:", e));

          // 45s Timeout for No Answer
          timeoutRef.current = setTimeout(() => {
            if (isMounted && room.remoteParticipants.size === 0) {
              setStatus("no_answer");
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
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    router.push("/messages");
  };

  // Grid layout class based on participant count
  const gridClass = useMemo(() => {
    const total = participants.length;
    if (total <= 1) return "grid-cols-1";
    if (total === 2) return "grid-cols-1 sm:grid-cols-2";
    if (total <= 4) return "grid-cols-2";
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  }, [participants.length]);

  return (
    <div className="relative w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
              የተጠበቀ የቪዲዮ ግንኙነት (E2EE)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-300 bg-slate-900/60 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>{participants.length} ተሳታፊ</span>
          </div>
        </div>

        {/* Live Call Status */}
        <div className="flex items-center gap-2">
          {status === "ringing" && (
            <div className="flex items-center gap-2 bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse border border-amber-500/30">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              እየጠራ ነው...
            </div>
          )}
          {status === "connected" && (
            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              የተገናኘ ✞
            </div>
          )}
          {status === "reconnecting" && (
            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
              በድጋሚ በማገናኘት ላይ...
            </div>
          )}
          {status === "declined" && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/30">
              <PhoneMissed className="w-3.5 h-3.5 text-red-400" />
              ጥሪው አልተመለሰም (Declined)
            </div>
          )}
          {status === "no_answer" && (
            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-500/30">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              ምላሽ አልተገኘም (No Answer)
            </div>
          )}
        </div>
      </header>

      {/* Main Video Stage / Conference Grid */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center p-3 sm:p-6 pt-16 pb-24">
        {/* If Only 1 participant (Caller alone waiting) */}
        {participants.length <= 1 && status === "ringing" ? (
          <div className="flex flex-col items-center justify-center gap-6 max-w-sm text-center">
            <div className="relative">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-amber-950 via-slate-900 to-amber-900/60 border-2 border-amber-500/40 flex items-center justify-center text-amber-300 shadow-2xl">
                <Users className="w-12 h-12 sm:w-16 sm:h-16 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-2 rounded-full shadow-lg animate-bounce">
                <Volume2 className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                እየጠራ ነው...
              </h2>
              <p className="text-xs text-amber-200/80 leading-relaxed font-medium">
                የተቀደሰ ጥሪ ወደ አባቱ/ልጁ ተልኳል፤ ጥሪውን እስኪቀበሉ ድረስ እባክዎ ይጠብቁ።
              </p>
            </div>

            {/* Self-Preview Floating Card */}
            {participants[0] && (
              <div className="w-32 h-44 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl mt-2">
                <ParticipantCard participant={participants[0]} />
              </div>
            )}
          </div>
        ) : (
          /* Multi-party Conference Grid */
          <div
            className={`w-full h-full grid gap-3 sm:gap-4 max-w-7xl max-h-[85vh] ${gridClass}`}
          >
            {participants.map((p) => (
              <div
                key={p.identity}
                className="w-full h-full min-h-[160px] rounded-2xl overflow-hidden shadow-xl"
              >
                <ParticipantCard participant={p} />
              </div>
            ))}
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
        {/* Toggle Microphone */}
        <button
          onClick={toggleMic}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isMicOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
          }`}
          title={isMicOn ? "ማይክሮፎን አጥፋ" : "ማይክሮፎን አብራ"}
        >
          {isMicOn ? (
            <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {/* Toggle Camera (Hide Face / Show Face) */}
        <button
          onClick={toggleCam}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-xl ${
            isCamOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 border border-red-400 scale-105"
          }`}
          title={isCamOn ? "ካሜራ አጥፋ (በስም ፊደል ተሳተፍ)" : "ካሜራ አብራ"}
        >
          {isCamOn ? (
            <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {/* End Call / Hang Up */}
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

// ─── PARTICIPANT TILE (Handles Camera OR Name Initials Avatar) ──────
function ParticipantCard({ participant }: { participant: ParticipantState }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.videoTrack) return;

    participant.videoTrack.attach(el);
    return () => {
      participant.videoTrack?.detach(el);
    };
  }, [participant.videoTrack, participant.isCameraEnabled]);

  // Extract initial letter (Ge'ez or English)
  const initial = useMemo(() => {
    const clean = participant.name.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
    return clean.charAt(0) || "✞";
  }, [participant.name]);

  return (
    <div
      className={`relative w-full h-full bg-slate-900 border-2 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${
        participant.isSpeaking
          ? "border-emerald-500 shadow-emerald-500/20 shadow-lg"
          : "border-slate-800"
      }`}
    >
      {/* 1. Camera View if Camera is On */}
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
        /* 2. Initials Avatar (Face Hidden / Camera Off) — No Broken Screen! */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4 text-center gap-3">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-transform ${
              participant.isSpeaking ? "scale-105" : ""
            } bg-gradient-to-tr from-amber-900 via-amber-700 to-amber-500 shadow-2xl border-2 border-amber-300/40`}
          >
            <span className="text-2xl sm:text-3xl font-black text-amber-50 font-serif">
              {initial}
            </span>
          </div>

          <div className="space-y-0.5 max-w-[85%]">
            <p className="text-sm font-bold text-slate-100 truncate">
              {participant.name}
            </p>
            <span className="text-[10px] text-amber-400/80 font-medium">
              ካሜራ ጠፍቷል (ድምፅ ብቻ)
            </span>
          </div>
        </div>
      )}

      {/* Bottom Name & Mic Pill */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md max-w-[70%]">
          <p className="text-[11px] font-bold text-white truncate">
            {participant.name} {participant.isLocal && "(እርስዎ)"}
          </p>
        </div>

        <div
          className={`p-1.5 rounded-full shadow-md backdrop-blur-md ${
            participant.isMicrophoneEnabled
              ? "bg-emerald-600/90 text-white"
              : "bg-red-600/90 text-white"
          }`}
        >
          {participant.isMicrophoneEnabled ? (
            <Mic className="w-3 h-3" />
          ) : (
            <MicOff className="w-3 h-3" />
          )}
        </div>
      </div>
    </div>
  );
}
