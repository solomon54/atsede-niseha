// src/shared/components/calling/GlobalIncomingCallOverlay.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff, Video, Users, Shield } from "lucide-react";
import { getPusherClient } from "@/services/pusher";

interface IncomingCallPayload {
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl?: string;
  callerRole?: string;
  isGroup: boolean;
  startedAt: number;
}

export function GlobalIncomingCallOverlay() {
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize ringtone audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio("/sounds/call-ring.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;
    }
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        // Autoplay may be blocked until user interacts with the page
        console.warn("[IncomingCall] Ringtone audio playback blocked:", err);
      });
    }
  };

  // Subscribe to Pusher incoming calls
  useEffect(() => {
    let activeSubscriptions: string[] = [];

    async function setupListeners() {
      try {
        const res = await fetch("/api/message/conversation", {
          credentials: "include",
        });
        if (!res.ok) return;

        const data = await res.json();
        const convos = data.conversations || [];
        const pusher = getPusherClient();

        // Also retrieve current user uid from session to avoid ringing own device
        const sessionRes = await fetch("/api/auth/refresh", { credentials: "include" });
        const sessionData = sessionRes.ok ? await sessionRes.json() : null;
        const currentUid = sessionData?.uid || "";

        // 1. Subscribe to User's private channel
        if (currentUid) {
          const userChName = `private-user-${currentUid}`;
          activeSubscriptions.push(userChName);
          const userChannel = pusher.subscribe(userChName);

          userChannel.bind("incoming-call", (payload: IncomingCallPayload) => {
            if (payload.callerId !== currentUid) {
              handleIncomingCall(payload);
            }
          });
        }

        // 2. Subscribe to conversation channels
        convos.forEach((c: any) => {
          const chName = `private-chat-${c.id}`;
          activeSubscriptions.push(chName);
          const channel = pusher.subscribe(chName);

          channel.bind("incoming-call", (payload: IncomingCallPayload) => {
            if (payload.callerId !== currentUid) {
              handleIncomingCall(payload);
            }
          });

          channel.bind("call-declined", () => {
            dismissCall();
          });

          channel.bind("call-answered", () => {
            dismissCall();
          });

          channel.bind("call-ended", () => {
            dismissCall();
          });

          channel.bind("call-missed", () => {
            dismissCall();
          });
        });
      } catch (err) {
        console.warn("[GlobalIncomingCall] Setup error:", err);
      }
    }

    setupListeners();

    return () => {
      try {
        const pusher = getPusherClient();
        activeSubscriptions.forEach((chName) => pusher.unsubscribe(chName));
      } catch {}
    };
  }, []);

  const handleIncomingCall = (payload: IncomingCallPayload) => {
    setIncomingCall(payload);
    playAudio();

    // Show Web Notification if page is in background
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted" && document.visibilityState === "hidden") {
        try {
          new Notification(
            payload.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
            {
              body: `${payload.callerName} ጥሪ አድርገዋል`,
              icon: payload.callerPhotoUrl || "/assets/icons/favicon-for-app/icon1.png",
              tag: payload.callId,
              requireInteraction: true,
            }
          );
        } catch {}
      }
    }

    // 45s Ringing Timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      stopAudio();
      setIncomingCall(null);
      await fetch("/api/livekit/timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: payload.channelId, callId: payload.callId }),
      }).catch(() => {});
    }, 45000);
  };

  const dismissCall = () => {
    stopAudio();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIncomingCall(null);
  };

  const handleAnswer = async () => {
    if (!incomingCall) return;
    const { channelId, callId } = incomingCall;
    dismissCall();

    await fetch("/api/livekit/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, callId }),
    }).catch(() => {});

    router.push(`/call/${channelId}?incoming=1&callId=${callId}`);
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    const { channelId, callId } = incomingCall;
    dismissCall();

    await fetch("/api/livekit/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, callId }),
    }).catch(() => {});
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-between py-12 px-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col items-center text-center mt-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black tracking-wide uppercase">
          {incomingCall.isGroup ? <Users className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          {incomingCall.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቀጥታ የቪዲዮ ጥሪ"}
        </span>
        <p className="text-slate-400 text-xs mt-2">የንስሐ ሚስጥር ጥሪ እየቀረበ ነው (ታሕተ ማኅተም)</p>
      </div>

      {/* Center Caller Profile */}
      <div className="flex flex-col items-center text-center my-auto">
        <div className="relative mb-6">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-900 border-4 border-amber-500/80 shadow-[0_0_35px_rgba(217,119,6,0.4)] flex items-center justify-center overflow-hidden animate-pulse">
            {incomingCall.callerPhotoUrl ? (
              <img
                src={incomingCall.callerPhotoUrl}
                alt={incomingCall.callerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-amber-400 text-4xl sm:text-5xl font-black">✞</span>
            )}
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {incomingCall.callerName}
        </h2>
        <span className="text-amber-400/90 text-sm font-bold mt-1">
          {incomingCall.callerRole === "FATHER" ? "የንስሐ አባት" : "የንስሐ ልጅ"}
        </span>
        <p className="text-slate-400 text-xs sm:text-sm mt-3 animate-pulse">
          ጥሪ በመደወል ላይ...
        </p>
      </div>

      {/* Bottom Actions: Answer and Decline */}
      <div className="flex items-center justify-center gap-12 sm:gap-16 mb-8 w-full max-w-sm">
        {/* Decline */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleDecline}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-transform active:scale-95"
            title="አትቀበል"
          >
            <PhoneOff className="w-7 h-7 sm:w-9 sm:h-9" />
          </button>
          <span className="text-xs font-bold text-slate-300">አትቀበል</span>
        </div>

        {/* Answer */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleAnswer}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-transform active:scale-95 animate-bounce"
            title="ተቀበል"
          >
            <Phone className="w-7 h-7 sm:w-9 sm:h-9" />
          </button>
          <span className="text-xs font-bold text-emerald-400">ተቀበል</span>
        </div>
      </div>
    </div>
  );
}

