// src/shared/components/calling/GlobalIncomingCallOverlay.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

type CallTerminalStatus = "declined" | "missed" | "cancelled" | "ended" | "answered";

function terminalFromMessageStatus(status: unknown): CallTerminalStatus | null {
  if (status === "declined" || status === "missed" || status === "cancelled" || status === "ended") {
    return status;
  }
  if (status === "answered") return "answered";
  return null;
}

export function GlobalIncomingCallOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const channelSubsRef = useRef<Set<string>>(new Set());
  const userChannelRef = useRef<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  useEffect(() => {
    activeCallIdRef.current = incomingCall?.callId || null;
  }, [incomingCall]);

  // Initialize ringtone audio (single instance)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/call-ring.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch {}
      audioRef.current = null;
    };
  }, []);

  const stopRingtone = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
    setAudioBlocked(false);
  };

  const dismissIncoming = (callId?: string | null) => {
    if (callId && activeCallIdRef.current && callId !== activeCallIdRef.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopRingtone();
    activeCallIdRef.current = null;
    setIncomingCall(null);
  };

  // Start/stop ringtone based on incoming call
  useEffect(() => {
    if (incomingCall) {
      let cancelled = false;
      setAudioBlocked(false);
      const playPromise = audioRef.current?.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (cancelled) stopRingtone();
          })
          .catch(() => {
            // Autoplay blocked: keep full-screen UI visible; never pretend audible ringing works.
            if (!cancelled) setAudioBlocked(true);
          });
      }

      // Auto-dismiss after 45 seconds (client-side fallback; server remains authoritative)
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        dismissIncoming(incomingCall.callId);
      }, 45000);

      return () => {
        cancelled = true;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else {
      stopRingtone();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [incomingCall?.callId]);

  // Keep tab title in sync (small UX aid)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (incomingCall) document.title = "📞 ጥሪ እየመጣ ነው...";
    return () => {
      document.title = original;
    };
  }, [incomingCall?.callId]);

  // App-wide Pusher subscriptions with reconnect/recovery
  useEffect(() => {
    if (typeof window === "undefined") return;
    mountedRef.current = true;
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    let connectionHandler: (() => void) | null = null;

    const isOnCallRoute = (channelId: string) => {
      try {
        return window.location.pathname.includes(`/call/${channelId}`);
      } catch {
        return false;
      }
    };

    const handleIncomingCall = (data: IncomingCallPayload) => {
      if (!mountedRef.current || !data?.callId || !data?.channelId) return;
      // Ignore if already viewing this call
      if (isOnCallRoute(data.channelId)) return;
      // One active incoming call at a time per device (client-side guard; server enforces busy)
      if (activeCallIdRef.current && activeCallIdRef.current !== data.callId) return;

      setIncomingCall((prev) => {
        if (prev?.callId === data.callId) return prev;
        if (prev && prev.callId !== data.callId) return prev; // keep existing active incoming call
        return data;
      });

      // Browser notification when tab hidden (best-effort)
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(data.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ", {
            body: `${data.callerName} ጥሪ አድርገዋል`,
            icon: data.callerPhotoUrl || "/icons/icon-192x192.png",
            tag: `incoming-call-${data.callId}`,
            requireInteraction: true,
          } as NotificationOptions);
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {}
      }
    };

    const handleCallTerminal = (eventCallId: unknown, status: CallTerminalStatus) => {
      const cid = typeof eventCallId === "string" ? eventCallId : null;
      if (!cid) return;
      // answered means this incoming call UI should dismiss (someone answered/joined elsewhere)
      dismissIncoming(cid);
    };

    const bindChannel = (channelName: string) => {
      if (!pusher || channelSubsRef.current.has(channelName)) return;
      const ch = pusher.subscribe(channelName);
      channelSubsRef.current.add(channelName);

      // Avoid duplicate bindings by unbinding our known handlers first (pusher-js allows named binds; keep simple)
      ch.unbind("incoming-call");
      ch.unbind("call-declined");
      ch.unbind("call-ended");
      ch.unbind("call-missed");
      ch.unbind("call-answered");
      ch.unbind("message-updated");

      ch.bind("incoming-call", handleIncomingCall);
      ch.bind("call-declined", (d: any) => handleCallTerminal(d?.callId, "declined"));
      ch.bind("call-ended", (d: any) => handleCallTerminal(d?.callId, "ended"));
      ch.bind("call-missed", (d: any) => handleCallTerminal(d?.callId, "missed"));
      ch.bind("call-answered", (d: any) => handleCallTerminal(d?.callId, "answered"));
      ch.bind("message-updated", (d: any) => {
        const st = terminalFromMessageStatus(d?.callDetails?.status);
        if (st) handleCallTerminal(d?.id || d?.callId || d?.callDetails?.callId, st);
      });
    };

    const unbindAllChannels = () => {
      if (!pusher) return;
      channelSubsRef.current.forEach((name) => {
        try {
          const ch = pusher!.channel(name);
          if (ch) {
            ch.unbind("incoming-call", handleIncomingCall);
            // other handlers anonymous per bind; unsubscribe ensures cleanup
          }
          pusher!.unsubscribe(name);
        } catch {}
      });
      channelSubsRef.current.clear();
      userChannelRef.current = null;
    };

    const refreshSubscriptions = async () => {
      if (!mountedRef.current || !pusher || refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        // Ensure session/user
        if (!uidRef.current) {
          const sessionRes = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
          if (sessionRes?.ok) {
            const session = await sessionRes.json().catch(() => null);
            uidRef.current = session?.uid || null;
          }
        }
        const uid = uidRef.current;
        if (!uid) return;

        // User channel (global incoming-call delivery)
        const userChName = `private-user-${uid}`;
        if (userChannelRef.current !== userChName) {
          if (userChannelRef.current) {
            try { pusher.unsubscribe(userChannelRef.current); } catch {}
            channelSubsRef.current.delete(userChannelRef.current);
          }
          userChannelRef.current = userChName;
        }
        bindChannel(userChName);

        // Current channel memberships
        const convRes = await fetch("/api/message/conversation", { cache: "no-store" }).catch(() => null);
        if (!convRes?.ok) return;
        const conversations = await convRes.json().catch(() => []);
        if (!Array.isArray(conversations)) return;

        const desired = new Set<string>([userChName]);
        conversations.forEach((c: any) => {
          const cid = c?.channel?.id || c?.id;
          if (cid) desired.add(`private-chat-${cid}`);
        });

        // Subscribe missing
        desired.forEach((name) => bindChannel(name));
        // Unsubscribe stale chat channels (keep user channel)
        [...channelSubsRef.current].forEach((name) => {
          if (!desired.has(name)) {
            try { pusher!.unsubscribe(name); } catch {}
            channelSubsRef.current.delete(name);
          }
        });
      } catch (e) {
        // best-effort; will retry on reconnect/interval
      } finally {
        refreshingRef.current = false;
      }
    };

    const setup = async () => {
      try {
        pusher = getPusherClient();
      } catch {
        return;
      }

      await refreshSubscriptions();

      // Reconnect recovery: ensure connected and resubscribe/refresh
      connectionHandler = () => {
        if (!mountedRef.current) return;
        void refreshSubscriptions();
      };
      try {
        pusher.connection.bind("connected", connectionHandler);
      } catch {}

      // Periodic refresh to pick up membership changes/new channels while app stays open
      const interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void refreshSubscriptions();
      }, 30000);

      const onVis = () => {
        if (document.visibilityState === "visible") void refreshSubscriptions();
      };
      document.addEventListener("visibilitychange", onVis);

      return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", onVis);
      };
    };

    let extraCleanup: (() => void) | undefined;
    setup().then((c) => {
      extraCleanup = c;
    });

    return () => {
      mountedRef.current = false;
      try { extraCleanup?.(); } catch {}
      if (pusher && connectionHandler) {
        try { pusher.connection.unbind("connected", connectionHandler); } catch {}
      }
      unbindAllChannels();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopRingtone();
    };
  }, [router]);

  if (!incomingCall) return null;

  const isOnCallPage =
    typeof pathname === "string" && pathname.includes(`/call/${incomingCall.channelId}`);

  // If already on this call page, do not show incoming overlay
  if (isOnCallPage) return null;

  const handleAnswer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stopRingtone();
    const call = incomingCall;
    setIncomingCall(null);
    activeCallIdRef.current = null;
    router.push(
      `/call/${call.channelId}?incoming=1&callId=${encodeURIComponent(call.callId)}&callerName=${encodeURIComponent(call.callerName)}&callerPhoto=${encodeURIComponent(call.callerPhotoUrl || "")}&callerRole=${encodeURIComponent(call.callerRole || "")}&isGroup=${call.isGroup ? "1" : "0"}`
    );
  };

  const handleDecline = async () => {
    const call = incomingCall;
    dismissIncoming(call.callId);
    try {
      await fetch("/api/livekit/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: call.channelId, callId: call.callId }),
      });
    } catch {
      // best-effort
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Full-screen sacred backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(217,119,6,0.12)_0%,_transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center justify-between h-full w-full max-w-md mx-auto py-16 px-6">
        {/* Top: Call Type Badge */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-extrabold text-amber-300 tracking-wide">
              {incomingCall.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቀጥታ የቪዲዮ ጥሪ"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            የንስሐ ሚስጥር ጥሪ እየቀረበ ነው
          </p>
          {audioBlocked && (
            <p className="text-[10px] text-amber-400/90 font-semibold text-center max-w-xs">
              የጥሪ ድምጽ በአሳሹ ተከልክሏል፤ ጥሪው እየመጣ ነው።
            </p>
          )}
        </div>

        {/* Center: Caller Identity */}
        <div className="flex flex-col items-center gap-5">
          {/* Pulsing ring animation */}
          <div className="relative">
            <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-amber-500/30 animate-ping" />
            <div className="absolute -inset-3 w-[152px] h-[152px] rounded-full border border-amber-500/15 animate-pulse" />
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-amber-500/60 shadow-2xl shadow-amber-900/40 bg-slate-800 flex items-center justify-center">
              {incomingCall.callerPhotoUrl ? (
                <img
                  src={incomingCall.callerPhotoUrl}
                  alt={incomingCall.callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-black text-amber-400 font-serif">
                  {incomingCall.callerName.charAt(0) || "✞"}
                </span>
              )}
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              {incomingCall.callerName}
            </h2>
            {incomingCall.callerRole && (
              <p className="text-sm text-amber-400/80 font-semibold">
                {incomingCall.callerRole === "FATHER" ? "የንስሐ አባት" : incomingCall.callerRole === "STUDENT" ? "የንስሐ ልጅ" : "አባል"}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 mt-2">
              {incomingCall.isGroup ? (
                <Users className="w-4 h-4 text-slate-400" />
              ) : (
                <Video className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs text-slate-400 font-medium animate-pulse">
                እየጠራ ነው...
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: Answer / Decline */}
        <div className="flex items-center justify-center gap-16 sm:gap-20">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-red-600 hover:bg-red-500 active:scale-95 flex items-center justify-center shadow-xl shadow-red-900/40 transition-all duration-200 border-2 border-red-400/30"
              aria-label="Decline call"
            >
              <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </button>
            <span className="text-xs font-bold text-red-400">አትቀበል</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAnswer}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex items-center justify-center shadow-xl shadow-emerald-900/40 transition-all duration-200 border-2 border-emerald-400/30 animate-bounce"
              aria-label="Answer call"
              style={{ animationDuration: "2s" }}
            >
              <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </button>
            <span className="text-xs font-bold text-emerald-400">ተቀበል</span>
          </div>
        </div>
      </div>
    </div>
  );
}
