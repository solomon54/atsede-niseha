import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { AudioSession, LiveKitRoom } from "@livekit/react-native";

import ActiveCallView from "../../components/call/ActiveCallView";
import { useAuth } from "../auth-context";
import { apiRequest } from "../api";
import { notificationService } from "../notifications";
import { getMobilePusher } from "../pusher";
import { startRingback, stopRingback } from "./callAudio";
import {
  consumeInitialCallIntent,
  showNativeIncomingCall,
  stopNativeRinging,
  subscribeNativeCallEvents,
} from "./nativeCall";
import {
  ActiveCallState,
  CallPeer,
  CallTerminalStatus,
  CallTokenResponse,
  IncomingCallPayload,
  callRoleLabel,
  terminalMessage,
  toIncomingPayload,
  toPeerFromIncoming,
} from "./types";

interface CallControllerValue {
  call: ActiveCallState | null;
  showIncoming: (payload: IncomingCallPayload) => void;
  startOutgoing: (channelId: string, participants?: CallPeer[]) => Promise<boolean>;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  end: () => Promise<void>;
  finishTerminal: (status: CallTerminalStatus, message?: string) => void;
  openCall: () => void;
}

const CallControllerContext = createContext<CallControllerValue | null>(null);

const DEFAULT_PEER: CallPeer = {
  name: "የንስሐ አባል",
  role: "STUDENT",
  photoUrl: null,
};

function buildCallRoute(call: ActiveCallState): string {
  const query = [
    `channelId=${encodeURIComponent(call.channelId)}`,
    `callId=${encodeURIComponent(call.callId)}`,
    `incoming=${call.direction === "incoming" ? "1" : "0"}`,
    `name=${encodeURIComponent(call.peer.name)}`,
    `role=${encodeURIComponent(call.peer.role)}`,
    `photo=${encodeURIComponent(call.peer.photoUrl || "")}`,
    `isGroup=${call.isGroup ? "1" : "0"}`,
    `resume=${call.status === "answered" ? "1" : "0"}`,
  ].join("&");
  return `/call/${call.channelId}?${query}`;
}

function MiniCallIndicator({
  call,
  onPress,
}: {
  call: ActiveCallState;
  onPress: () => void;
}) {
  const [label, setLabel] = useState("00:00");
  useEffect(() => {
    const tick = () => {
      const total = Math.max(0, Math.floor((Date.now() - (call.answeredAt || Date.now())) / 1000));
      setLabel(
        `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60)
          .toString()
          .padStart(2, "0")}`
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.answeredAt]);

  return (
    <TouchableOpacity style={styles.mini} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.miniDot} />
      <View style={styles.miniText}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {call.peer.name}
        </Text>
        <Text style={styles.miniSub}>
          {callRoleLabel(call.peer.role)} · {label} · ጥሪው እየቀጠለ ነው
        </Text>
      </View>
      <Text style={styles.miniOpen}>ክፈት</Text>
    </TouchableOpacity>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, uid } = useAuth();

  const [call, setCall] = useState<ActiveCallState | null>(null);
  const callRef = useRef<ActiveCallState | null>(null);
  const pathnameRef = useRef(pathname);
  const authRef = useRef({ isAuthenticated, isLoading, uid });
  const tokenCache = useRef(new Map<string, CallTokenResponse>());
  const outgoingRef = useRef(false);
  const terminalTimer = useRef<NodeJS.Timeout | null>(null);
  const lastNav = useRef({ key: "", at: 0 });
  // A persisted native intent must not re-ring a call that already ended.
  const terminalCallIds = useRef(new Set<string>());

  const applyCall = useCallback((next: ActiveCallState | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const patchCall = useCallback(
    (patch: Partial<ActiveCallState>) => {
      const current = callRef.current;
      if (!current) return;
      applyCall({ ...current, ...patch });
    },
    [applyCall]
  );

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    authRef.current = { isAuthenticated, isLoading, uid };
  }, [isAuthenticated, isLoading, uid]);

  const stopAllAudio = useCallback(async () => {
    await stopRingback().catch(() => {});
    await stopNativeRinging().catch(() => {});
    await AudioSession.stopAudioSession().catch(() => {});
    await notificationService.dismissCallNotifications().catch(() => {});
  }, []);

  const leaveCallRoute = useCallback(() => {
    if (!pathnameRef.current.startsWith("/call/")) return;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/chat");
  }, [router]);

  const openCall = useCallback(() => {
    const current = callRef.current;
    if (!current || current.status === "ended") return;
    if (pathnameRef.current.startsWith("/call/")) return;
    const key = `${current.callId}:${current.status}`;
    const now = Date.now();
    if (key === lastNav.current.key && now - lastNav.current.at < 2000) return;
    lastNav.current = { key, at: now };
    router.push(buildCallRoute(current) as any);
  }, [router]);

  const finishTerminal = useCallback(
    (status: CallTerminalStatus, message?: string) => {
      const current = callRef.current;
      if (!current || current.status === "ended") return;
      outgoingRef.current = false;
      void stopAllAudio();
      if (terminalTimer.current) clearTimeout(terminalTimer.current);
      if (current.callId) terminalCallIds.current.add(current.callId);
      applyCall({
        ...current,
        status: "ended",
        terminal: { status, message: message || terminalMessage(status) },
        transitioning: false,
      });
      terminalTimer.current = setTimeout(() => leaveCallRoute(), 2200);
    },
    [applyCall, leaveCallRoute, stopAllAudio]
  );

  const ensureToken = useCallback(
    async (target: ActiveCallState): Promise<CallTokenResponse | null> => {
      if (!target.callId || target.callId.startsWith("pending-")) return null;
      const key = `${uid || "anon"}:${target.callId}`;
      const cached = tokenCache.current.get(key);
      if (cached) return cached;
      try {
        const res = await apiRequest<CallTokenResponse>("/api/livekit/token", {
          method: "POST",
          body: JSON.stringify({ channelId: target.channelId, callId: target.callId }),
        });
        if (!res?.token || !res?.url) throw new Error("Missing LiveKit credentials");
        tokenCache.current.set(key, res);
        if (callRef.current?.callId === target.callId) {
          const participants: Record<string, CallPeer> = {
            ...(callRef.current.participants || {}),
          };
          (res.participants || []).forEach((peer) => {
            if (peer.uid) participants[peer.uid] = peer;
          });
          patchCall({ token: res, participants });
        }
        return res;
      } catch (error: any) {
        console.warn("[Call] token request failed:", error);
        return null;
      }
    },
    [patchCall, uid]
  );

  const showIncoming = useCallback(
    (payload: IncomingCallPayload, presentNatively = true) => {
      const auth = authRef.current;
      if (auth.isLoading || !auth.isAuthenticated) return;
      if (terminalCallIds.current.has(payload.callId)) return;
      const current = callRef.current;
      if (
        current &&
        current.callId &&
        current.callId !== payload.callId &&
        current.status !== "ended"
      ) {
        return;
      }
      const peer = toPeerFromIncoming(payload);
      const next: ActiveCallState = {
        callId: payload.callId,
        channelId: payload.channelId,
        direction: "incoming",
        status: "incoming",
        peer,
        isGroup: payload.isGroup,
        startedAt: payload.startedAt || Date.now(),
        answeredAt: null,
        participants: payload.callerId ? { [payload.callerId]: peer } : {},
        token: current?.callId === payload.callId ? current.token : null,
        terminal: null,
      };
      applyCall(next);
      // A native action intent already stopped ringing; don't re-ring while
      // the authoritative answer/decline transition is in flight.
      if (presentNatively) void showNativeIncomingCall(payload);
      openCall();
    },
    [applyCall, openCall]
  );

  const startOutgoing = useCallback(
    async (channelId: string, participants: CallPeer[] = []) => {
      const current = callRef.current;
      if (current && current.status !== "ended") return false;
      if (outgoingRef.current) return false;
      outgoingRef.current = true;

      const map: Record<string, CallPeer> = {};
      participants.forEach((peer) => {
        if (peer.uid) map[peer.uid] = peer;
      });
      const peer = participants[0] || DEFAULT_PEER;
      const pendingId = `pending-${channelId}-${Date.now()}`;
      const pending: ActiveCallState = {
        callId: pendingId,
        channelId,
        direction: "outgoing",
        status: "ringing",
        peer,
        isGroup: participants.length > 1,
        startedAt: Date.now(),
        answeredAt: null,
        participants: map,
        token: null,
        terminal: null,
      };
      applyCall(pending);
      void startRingback();

      try {
        const res = await apiRequest<any>("/api/livekit/ring", {
          method: "POST",
          body: JSON.stringify({ channelId }),
        });
        if (!res?.success || res?.status !== "ringing" || !res?.callId) {
          const status: CallTerminalStatus =
            res?.error === "busy" || res?.status === "busy"
              ? "busy"
              : "unreachable";
          finishTerminal(status, terminalMessage(status, res?.reason === "all_busy"));
          return false;
        }

        const notifiedParticipants: CallPeer[] = Array.isArray(res.participants)
          ? res.participants
          : [];
        const nextPeer = notifiedParticipants[0] || peer;
        const nextMap: Record<string, CallPeer> = { ...map };
        notifiedParticipants.forEach((item) => {
          if (item.uid) nextMap[item.uid] = item;
        });
        applyCall({
          ...pending,
          callId: res.callId,
          peer: nextPeer,
          participants: nextMap,
          startedAt: res.startedAt || pending.startedAt,
          isGroup: notifiedParticipants.length > 1,
        });
        const token = await ensureToken({
          ...pending,
          callId: res.callId,
          participants: nextMap,
        });
        if (!token) {
          finishTerminal("unreachable", "የጥሪ ፈቃድ ማግኘት አልተቻለም");
          return false;
        }
        return true;
      } catch (error: any) {
        const status: CallTerminalStatus =
          error?.status === 409 ? "busy" : "unreachable";
        finishTerminal(status, terminalMessage(status));
        return false;
      } finally {
        outgoingRef.current = false;
      }
    },
    [applyCall, ensureToken, finishTerminal]
  );

  const answer = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.status !== "incoming" || current.transitioning) return;
    patchCall({ transitioning: true });
    try {
      const res = await apiRequest<any>("/api/livekit/answer", {
        method: "POST",
        body: JSON.stringify({ channelId: current.channelId, callId: current.callId }),
      });
      if (res?.terminal || ["declined", "missed", "cancelled", "ended"].includes(res?.status)) {
        finishTerminal(res?.status || "ended");
        return;
      }
      await stopRingback();
      await stopNativeRinging();
      await AudioSession.startAudioSession().catch(() => {});
      await notificationService.dismissCallNotifications().catch(() => {});
      const answeredAt = res?.answeredAt || Date.now();
      applyCall({
        ...callRef.current!,
        status: "answered",
        answeredAt,
        transitioning: false,
        terminal: null,
      });
      if (!callRef.current?.token) {
        const token = await ensureToken(callRef.current!);
        if (!token) finishTerminal("unreachable", "የጥሪ ፈቃድ ማግኘት አልተቻለም");
      }
    } catch (error: any) {
      patchCall({ transitioning: false });
      finishTerminal(error?.status === 403 ? "ended" : "unreachable");
    }
  }, [applyCall, ensureToken, finishTerminal, patchCall]);

  const decline = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.callId.startsWith("pending-")) {
      finishTerminal("declined");
      return;
    }
    if (current.status === "ended") return;
    terminalCallIds.current.add(current.callId);
    applyCall({ ...current, status: "ended", terminal: { status: "declined", message: terminalMessage("declined") } });
    outgoingRef.current = false;
    await stopAllAudio();
    try {
      await apiRequest("/api/livekit/decline", {
        method: "POST",
        body: JSON.stringify({ channelId: current.channelId, callId: current.callId }),
      });
    } catch {}
    setTimeout(() => leaveCallRoute(), 1200);
  }, [applyCall, finishTerminal, leaveCallRoute, stopAllAudio]);

  const end = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.status === "ended") return;
    const durationSec = current.answeredAt
      ? Math.max(1, Math.floor((Date.now() - current.answeredAt) / 1000))
      : 0;
    const status: CallTerminalStatus = current.answeredAt ? "ended" : "cancelled";
    terminalCallIds.current.add(current.callId);
    applyCall({
      ...current,
      status: "ended",
      terminal: { status, message: terminalMessage(status) },
    });
    outgoingRef.current = false;
    await stopAllAudio();
    try {
      await apiRequest("/api/livekit/end", {
        method: "POST",
        body: JSON.stringify({
          channelId: current.channelId,
          callId: current.callId,
          durationSec,
          status: current.answeredAt ? "answered" : "cancelled",
        }),
      });
    } catch {}
    setTimeout(() => leaveCallRoute(), 1200);
  }, [applyCall, leaveCallRoute, stopAllAudio]);

  // Native full-screen/notification actions and cold-start intents.
  // Wait for auth before consuming the persisted intent: showIncoming() bails
  // while the session is loading, and the native intent is one-shot.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !uid) return;
    const unsubscribe = subscribeNativeCallEvents({
      onIncoming: (payload) => showIncoming(payload),
      onAction: (action, payload) => {
        if (payload && (!callRef.current || callRef.current.callId !== payload.callId)) {
          showIncoming(payload, false);
        }
        if (action === "answer") void answer();
        else if (action === "decline") void decline();
        else void end();
      },
    });
    consumeInitialCallIntent().then((intent) => {
      if (!intent?.payload) return;
      showIncoming(intent.payload, intent.action === "incoming");
      if (intent.action === "answer") void answer();
      else if (intent.action === "decline") void decline();
    });
    return unsubscribe;
  }, [answer, decline, end, showIncoming, isAuthenticated, isLoading, uid]);

  // App-level Pusher subscription: independent of the chat route/channel.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !uid) return;
    let pusher: any = null;
    let channel: any = null;
    const handlers: Array<[string, (data: any) => void]> = [];

    const matches = (data: any, event: string): boolean => {
      const eventId = data?.callId || data?.id || data?.callDetails?.callId;
      const current = callRef.current;
      if (event === "incoming-call") return !current || current.status === "ended";
      if (!eventId) return false;
      if (!current || current.status === "ended") return false;
      return current.callId === eventId;
    };

    try {
      pusher = getMobilePusher();
      channel = pusher.subscribe(`private-user-${uid}`);
      const bind = (event: string, handler: (data: any) => void) => {
        handlers.push([event, handler]);
        channel.bind(event, handler);
      };

      bind("incoming-call", (data: any) => {
        const payload = toIncomingPayload(data);
        if (payload) showIncoming(payload);
      });
      bind("call-answered", (data: any) => {
        if (!matches(data, "call-answered")) return;
        void stopRingback();
        void stopNativeRinging();
        const current = callRef.current!;
        applyCall({
          ...current,
          status: "answered",
          answeredAt: current.answeredAt || Date.now(),
          transitioning: false,
        });
        void AudioSession.startAudioSession().catch(() => {});
        void ensureToken(callRef.current!);
      });
      bind("call-declined", (data: any) => {
        if (!matches(data, "call-declined")) return;
        finishTerminal(data?.status === "busy" ? "busy" : "declined");
      });
      bind("call-ended", (data: any) => {
        if (!matches(data, "call-ended")) return;
        const status = data?.status;
        finishTerminal(
          status === "missed"
            ? "missed"
            : status === "cancelled"
            ? "cancelled"
            : "ended"
        );
      });
      bind("call-missed", (data: any) => {
        if (!matches(data, "call-missed")) return;
        finishTerminal("missed");
      });
      bind("message-updated", (data: any) => {
        const status = data?.callDetails?.status;
        if (!["declined", "missed", "cancelled", "ended"].includes(status)) return;
        if (!matches({ callId: data?.callDetails?.callId || data?.id }, "message-updated")) return;
        finishTerminal(status);
      });
    } catch (error) {
      console.warn("[Call] Pusher bind failed:", error);
    }

    return () => {
      handlers.forEach(([event, handler]) => {
        try {
          channel?.unbind(event, handler);
        } catch {}
      });
      // Never unsubscribe globally — chat and other listeners share the client.
    };
  }, [applyCall, ensureToken, finishTerminal, isAuthenticated, isLoading, showIncoming, uid]);

  // Caller timeout is owned by the caller; on return to foreground a stale
  // ringing call is reconciled by the server status endpoint.
  useEffect(() => {
    const current = call;
    if (!current || current.status !== "ringing" || current.direction !== "outgoing" || current.callId.startsWith("pending-")) {
      return;
    }
    const timer = setTimeout(() => {
      const active = callRef.current;
      if (!active || active.callId !== current.callId || active.status !== "ringing") return;
      apiRequest("/api/livekit/timeout", {
        method: "POST",
        body: JSON.stringify({ channelId: active.channelId, callId: active.callId }),
      }).catch(() => {});
      finishTerminal("missed");
    }, 45_000);
    return () => clearTimeout(timer);
  }, [call, finishTerminal]);

  // Recover an answered call after app resume/process restart: re-fetch a token
  // and reconnect the single global room if the server still considers it live.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const current = callRef.current;
      if (!current || current.status !== "answered") return;
      if (current.token) return;
      const restored: ActiveCallState = {
        ...current,
        callId: current.callId.startsWith("pending-") ? "" : current.callId,
      };
      if (restored.callId) void ensureToken(restored);
    });
    return () => subscription.remove();
  }, [ensureToken]);

  const value = useMemo<CallControllerValue>(
    () => ({
      call,
      showIncoming,
      startOutgoing,
      answer,
      decline,
      end,
      finishTerminal,
      openCall,
    }),
    [call, showIncoming, startOutgoing, answer, decline, end, finishTerminal, openCall]
  );

  const showOverlay = call?.status === "answered" && !!call.token;
  const showMini = call?.status === "answered" && !pathname.startsWith("/call/");

  return (
    <CallControllerContext.Provider value={value}>
      {children}
      {showOverlay && call.token ? (
        <LiveKitRoom
          serverUrl={call.token.url}
          token={call.token.token}
          connect={true}
          video={true}
          audio={true}
          onDisconnected={() => {
            const current = callRef.current;
            if (current?.status === "answered") void end();
          }}
        >
          <View style={styles.roomOverlay}>
            <ActiveCallView call={call} onEndCall={() => void end()} />
          </View>
        </LiveKitRoom>
      ) : null}
      {showMini && call ? (
        <MiniCallIndicator call={call} onPress={openCall} />
      ) : null}
    </CallControllerContext.Provider>
  );
}

export function useCallController(): CallControllerValue {
  const ctx = useContext(CallControllerContext);
  if (!ctx) throw new Error("useCallController must be used inside CallProvider");
  return ctx;
}

const styles = StyleSheet.create({
  roomOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0B1120", zIndex: 40 },
  mini: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 18,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#111C33",
    borderWidth: 1,
    borderColor: "#D97706",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  miniDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E", marginRight: 10 },
  miniText: { flex: 1 },
  miniTitle: { color: "#F8FAFC", fontSize: 14, fontWeight: "800" },
  miniSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  miniOpen: { color: "#D97706", fontSize: 12, fontWeight: "800" },
});
