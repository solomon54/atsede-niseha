// src/features/calling/components/LiveKitCallRoom.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  VideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
} from "livekit-client";

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

export default function LiveKitCallRoom({
  channelId,
  isIncoming = false,
}: LiveKitCallRoomProps) {
  const router = useRouter();

  // Call connection states
  const [status, setStatus] = useState<
    "loading" | "ringing" | "connected" | "reconnecting" | "error" | "ended"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio/Video toggle states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [remoteName, setRemoteName] = useState<string | null>(null);

  // References
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const hasRungRef = useRef(false);

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

        // 2. Setup Room Event Listeners
        room.on(
          RoomEvent.TrackSubscribed,
          (
            track: Track,
            publication: RemoteTrackPublication,
            participant: RemoteParticipant
          ) => {
            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
              setRemoteName(participant.name || participant.identity);
            } else if (
              track.kind === Track.Kind.Audio &&
              remoteAudioRef.current
            ) {
              track.attach(remoteAudioRef.current);
            }
            setParticipantCount(room.remoteParticipants.size + 1);
            setStatus("connected");
          }
        );

        room.on(
          RoomEvent.TrackUnsubscribed,
          (track: Track) => {
            track.detach();
          }
        );

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          setRemoteName(participant.name || participant.identity);
          setParticipantCount(room.remoteParticipants.size + 1);
          setStatus("connected");
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setParticipantCount(room.remoteParticipants.size + 1);
          if (room.remoteParticipants.size === 0) {
            setRemoteName(null);
          }
        });

        room.on(RoomEvent.Reconnecting, () => {
          setStatus("reconnecting");
        });

        room.on(RoomEvent.Reconnected, () => {
          setStatus("connected");
        });

        room.on(RoomEvent.Disconnected, () => {
          if (isMounted) setStatus("ended");
        });

        // 3. Connect to LiveKit Room
        await room.connect(data.url, data.token);

        // 4. Publish local camera & mic
        await room.localParticipant.enableCameraAndMicrophone();

        // 5. Attach local video to self-view element
        const localVideoTrack = Array.from(
          room.localParticipant.videoTrackPublications.values()
        )[0]?.track as VideoTrack | undefined;

        if (localVideoTrack && localVideoRef.current) {
          localVideoTrack.attach(localVideoRef.current);
        }

        if (!isMounted) return;

        // 6. Ring other channel members if initiating
        if (!isIncoming && !hasRungRef.current) {
          hasRungRef.current = true;
          setStatus("ringing");
          fetch("/api/livekit/ring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId }),
          }).catch((e) => console.warn("Failed to ring:", e));
        } else {
          setStatus(
            room.remoteParticipants.size > 0 ? "connected" : "ringing"
          );
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
      if (room.state !== "disconnected") {
        room.disconnect();
      }
    };
  }, [channelId, isIncoming]);

  // Controls
  const toggleMic = async () => {
    if (!roomRef.current) return;
    const newState = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    setIsMicOn(newState);
  };

  const toggleCam = async () => {
    if (!roomRef.current) return;
    const newState = !isCamOn;
    await roomRef.current.localParticipant.setCameraEnabled(newState);
    setIsCamOn(newState);

    if (newState && localVideoRef.current) {
      const localVideoTrack = Array.from(
        roomRef.current.localParticipant.videoTrackPublications.values()
      )[0]?.track as VideoTrack | undefined;
      if (localVideoTrack) {
        localVideoTrack.attach(localVideoRef.current);
      }
    }
  };

  const handleEndCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    router.push("/messages");
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Hidden Audio Element for Remote Sound */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full backdrop-blur-md">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
              ምስጢራዊ የቪዲዮ ጥሪ (E2EE)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>{participantCount} ተሳታፊ</span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {status === "ringing" && (
            <div className="flex items-center gap-2 bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full animate-pulse border border-amber-500/30">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              እየጠራ ነው...
            </div>
          )}
          {status === "connected" && (
            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              የተገናኘ ✞
            </div>
          )}
          {status === "reconnecting" && (
            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
              በድጋሚ በማገናኘት ላይ...
            </div>
          )}
        </div>
      </header>

      {/* Main Video Stage */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-slate-900">
        {/* Remote Video (Full Screen / Primary) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Remote Placeholder when video is not active / waiting */}
        {(!remoteName || status === "ringing") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 gap-4">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-amber-950/40 border-2 border-amber-600/40 flex items-center justify-center text-amber-400 shadow-2xl">
                <Users className="w-10 h-10 sm:w-14 sm:h-14 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-lg">
                <Volume2 className="w-4 h-4" />
              </div>
            </div>

            <div className="text-center space-y-1 px-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-100">
                {remoteName || "ጥሪው እየተገናኘ ነው..."}
              </h2>
              <p className="text-xs text-amber-300/80 font-medium">
                {status === "ringing"
                  ? "የተቀደሰ ጥሪ ወደ አባቱ/ልጁ ተልኳል፤ እባክዎ እስኪቀበሉ ይጠብቁ"
                  : "ድምጽና ቪዲዮ በምስጢር የተጠበቀ ነው"}
              </p>
            </div>
          </div>
        )}

        {/* Local Video (Floating Picture-in-Picture) */}
        <div className="absolute bottom-24 right-4 sm:bottom-28 sm:right-8 w-28 h-40 sm:w-36 sm:h-52 bg-slate-800 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${
              !isCamOn ? "hidden" : ""
            } scale-x-[-1]`}
          />
          {!isCamOn && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 gap-2">
              <VideoOff className="w-6 h-6 text-slate-400" />
              <span className="text-[10px] font-bold">ካሜራ ጠፍቷል</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-bold text-white">
            እርስዎ
          </div>
        </div>
      </div>

      {/* Error Overlay */}
      {status === "error" && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
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
      <footer className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-4 sm:gap-6 py-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        {/* Toggle Microphone */}
        <button
          onClick={toggleMic}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-lg ${
            isMicOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700"
              : "bg-red-500/90 text-white hover:bg-red-600 border border-red-400"
          }`}
          title={isMicOn ? "ማይክሮፎን አጥፋ" : "ማይክሮፎን አብራ"}
        >
          {isMicOn ? (
            <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={toggleCam}
          className={`p-3.5 sm:p-4 rounded-full transition-all duration-200 shadow-lg ${
            isCamOn
              ? "bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700"
              : "bg-red-500/90 text-white hover:bg-red-600 border border-red-400"
          }`}
          title={isCamOn ? "ካሜራ አጥፋ" : "ካሜራ አብራ"}
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
          className="p-3.5 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-xl hover:scale-105 border border-red-500"
          title="ጥሪውን አቋርጥ"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </footer>
    </div>
  );
}
