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
import NetInfo from "@react-native-community/netinfo";
import { usePathname, useRouter } from "expo-router";
import { AudioSession, LiveKitRoom } from "@livekit/react-native";
import { PhoneOff } from "lucide-react-native";

import ActiveCallView from "../../components/call/ActiveCallView";
import { useAuth } from "../auth-context";
import { apiRequest } from "../api";
import { notificationService } from "../notifications";
import { getMobilePusher } from "../pusher";
import { startRingback, stopRingback } from "./callAudio";
import {
  buildStatusQuery,
  canPresentIncoming,
  classifyCallStatus,
  classifyStatusError,
  incomingPayloadFromStatus,
  shouldApplyEvent,
  statusTimestamp,
  CallStatusDecision,
  CallStatusResponse,
} from "./callStatus";
import { createInFlight } from "./inFlight";
import {
  cleanupNativeCall,
  clearPendingCallIntent,
  peekInitialCallIntent,
  showNativeIncomingCall,
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
  isMinimized: boolean;
  minimizeCall: () => void;
  maximizeCall: () => void;
  showIncoming: (payload: IncomingCallPayload) => Promise<boolean>;
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

type ProcessResult = {
  accepted: boolean;
  kind: CallStatusDecision["kind"];
};

interface ValidationResult {
  decision: CallStatusDecision;
  response: CallStatusResponse | null;
}

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

function incomingPayloadFromCall(call: ActiveCallState): IncomingCallPayload {
  return {
    callId: call.callId,
    channelId: call.channelId,
    callerId: call.peer.uid,
    callerName: call.peer.name,
    callerPhotoUrl: call.peer.photoUrl || null,
    callerRole: call.peer.role,
    isGroup: call.isGroup,
    startedAt: call.startedAt,
  };
}

function eventCallId(data: any): string {
  const value = data?.callId || data?.id || data?.callDetails?.callId;
  return typeof value === "string" ? value : "";
}

function MiniCallIndicator({
  call,
  onPress,
  onEndCall,
}: {
  call: ActiveCallState;
  onPress: () => void;
  onEndCall?: () => void;
}) {
  const [label, setLabel] = useState("00:00");
  useEffect(() => {
    if (call.status !== "answered" || !call.answeredAt) {
      setLabel("እየጠራ ነው...");
      return;
    }
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
  }, [call.status, call.answeredAt]);

  const isAnswered = call.status === "answered";

  return (
    <View style={styles.mini}>
      <TouchableOpacity
        style={styles.miniClickable}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityLabel="Return to active call"
      >
        <View style={[styles.miniDot, !isAnswered && styles.miniDotRinging]} />
        <View style={styles.miniText}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {call.peer.name}
          </Text>
          <Text style={styles.miniSub}>
            {callRoleLabel(call.peer.role)} · {label}
          </Text>
        </View>
        <View style={styles.miniOpenBadge}>
          <Text style={styles.miniOpen}>ተመለስ</Text>
        </View>
      </TouchableOpacity>
      {onEndCall && (
        <TouchableOpacity
          style={styles.miniEndBtn}
          onPress={onEndCall}
          accessibilityLabel="End call"
        >
          <PhoneOff color="#FFFFFF" size={16} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, uid } = useAuth();

  const [call, setCall] = useState<ActiveCallState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const callRef = useRef<ActiveCallState | null>(null);
  const pathnameRef = useRef(pathname);
  const authRef = useRef({ isAuthenticated, isLoading, uid });
  const tokenCache = useRef(new Map<string, CallTokenResponse>());
  const tokenRequests = useRef(createInFlight<CallTokenResponse | null>());
  const statusRequests = useRef(createInFlight<ValidationResult>());
  const outgoingRef = useRef(false);
  const terminalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNav = useRef({ key: "", at: 0 });
  // In-memory guards for this process; native tombstones and backend status
  // cover process restarts and replayed intents.
  const terminalCallIds = useRef(new Set<string>());
  const handledIncomingIds = useRef(new Set<string>());
  const initialIntentHandled = useRef(false);

  const applyCall = useCallback((next: ActiveCallState | null) => {
    callRef.current = next;
    setCall(next);
    if (!next || next.status === "ended") {
      setIsMinimized(false);
    }
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

  useEffect(() => {
    tokenCache.current.clear();
    tokenRequests.current.clear();
    statusRequests.current.clear();
  }, [uid]);

  const rememberTerminal = useCallback((callId?: string | null) => {
    if (callId) terminalCallIds.current.add(callId);
  }, []);

  const checkStatus = useCallback(
    (callId: string, channelId: string): Promise<ValidationResult> =>
      statusRequests.current.run(`${uid || "anon"}:${callId}:${channelId}`, async () => {
        try {
          const response = await apiRequest<CallStatusResponse>(
            `/api/livekit/status?${buildStatusQuery({ callId, channelId })}`
          );
          return {
            response,
            decision: classifyCallStatus(response, { callId, channelId }),
          };
        } catch (error) {
          return { response: null, decision: classifyStatusError(error) };
        }
      }),
    [uid]
  );

  const cleanupPresentation = useCallback(
    async (payload: IncomingCallPayload | null, terminal: boolean) => {
      if (!payload?.callId) return;
      await cleanupNativeCall(payload, terminal);
    },
    []
  );

  const stopPresentationForCall = useCallback(
    async (state: ActiveCallState, terminal: boolean) => {
      await stopRingback().catch(() => {});
      await cleanupPresentation(incomingPayloadFromCall(state), terminal);
      await AudioSession.stopAudioSession().catch(() => {});
      await notificationService.dismissCallNotifications().catch(() => {});
    },
    [cleanupPresentation]
  );

  const leaveCallRoute = useCallback(() => {
    if (!pathnameRef.current.startsWith("/call/")) return;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/chat");
  }, [router]);

  const openCall = useCallback(() => {
    setIsMinimized(false);
    const current = callRef.current;
    if (!current || current.status === "ended") return;
    if (pathnameRef.current.startsWith("/call/")) return;
    const key = `${current.callId}:${current.status}`;
    const now = Date.now();
    if (key === lastNav.current.key && now - lastNav.current.at < 2000) return;
    lastNav.current = { key, at: now };
    router.push(buildCallRoute(current) as any);
  }, [router]);

  const minimizeCall = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizeCall = useCallback(() => {
    setIsMinimized(false);
    openCall();
  }, [openCall]);

  const finishTerminal = useCallback(
    (status: CallTerminalStatus, message?: string) => {
      const current = callRef.current;
      if (!current || current.status === "ended") return;
      outgoingRef.current = false;
      rememberTerminal(current.callId);
      handledIncomingIds.current.add(current.callId);
      void stopPresentationForCall(current, true);
      if (terminalTimer.current) clearTimeout(terminalTimer.current);
      applyCall({
        ...current,
        status: "ended",
        terminal: { status, message: message || terminalMessage(status) },
        transitioning: false,
      });

      // Best-effort terminal notification to backend so participant claims are cleanly released.
      if (!current.callId.startsWith("pending-")) {
        const durationSec = current.answeredAt
          ? Math.max(1, Math.floor((Date.now() - current.answeredAt) / 1000))
          : 0;
        const requested =
          current.status === "answered"
            ? "ended"
            : status === "declined"
            ? "declined"
            : "cancelled";
        apiRequest("/api/livekit/end", {
          method: "POST",
          body: JSON.stringify({
            channelId: current.channelId,
            callId: current.callId,
            durationSec,
            status: requested,
          }),
        }).catch(() => {});
      }

      terminalTimer.current = setTimeout(() => leaveCallRoute(), 2200);
    },
    [applyCall, leaveCallRoute, rememberTerminal, stopPresentationForCall]
  );

  const ensureToken = useCallback(
    async (target: ActiveCallState): Promise<CallTokenResponse | null> => {
      if (!target.callId || target.callId.startsWith("pending-")) return null;
      const key = `${uid || "anon"}:${target.callId}`;
      const cached = tokenCache.current.get(key);
      if (cached) return cached;

      return tokenRequests.current.run(key, async () => {
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
      });
    },
    [patchCall, uid]
  );

  const admitIncoming = useCallback(
    (payload: IncomingCallPayload, response: CallStatusResponse, ring: boolean): boolean => {
      if (!canPresentIncoming(payload, callRef.current, terminalCallIds.current)) return false;

      const current = callRef.current;
      const enriched = incomingPayloadFromStatus(response, payload) || payload;
      const peer = toPeerFromIncoming(enriched);
      const next: ActiveCallState = {
        callId: enriched.callId,
        channelId: enriched.channelId,
        direction: "incoming",
        status: "incoming",
        peer,
        isGroup: enriched.isGroup,
        startedAt:
          statusTimestamp(response, "startedAt") ||
          enriched.startedAt ||
          Date.now(),
        answeredAt: null,
        participants: enriched.callerId ? { [enriched.callerId]: peer } : {},
        token: current?.callId === payload.callId ? current.token : null,
        terminal: null,
      };
      applyCall(next);
      // Duplicate FCM/Pusher/persisted hints must not start a second ringing UI.
      if (ring && current?.callId !== payload.callId) {
        void showNativeIncomingCall(enriched);
      }
      openCall();
      return true;
    },
    [applyCall, openCall]
  );

  const resumeAnswered = useCallback(
    async (payload: IncomingCallPayload, response: CallStatusResponse) => {
      const current = callRef.current;
      await cleanupPresentation(payload, false);
      await stopRingback().catch(() => {});

      const enriched = incomingPayloadFromStatus(response, payload) || payload;
      const peer = toPeerFromIncoming(enriched);
      const base: ActiveCallState =
        current && current.callId === payload.callId
          ? current
          : {
              callId: payload.callId,
              channelId: payload.channelId,
              direction: "incoming",
              status: "answered",
              peer,
              isGroup: enriched.isGroup,
              startedAt:
                statusTimestamp(response, "startedAt") ||
                enriched.startedAt ||
                Date.now(),
              answeredAt: null,
              participants: enriched.callerId ? { [enriched.callerId]: peer } : {},
              token: null,
              terminal: null,
            };

      applyCall({
        ...base,
        status: "answered",
        answeredAt:
          statusTimestamp(response, "answeredAt") || base.answeredAt || Date.now(),
        transitioning: false,
        terminal: null,
      });
      await AudioSession.startAudioSession().catch(() => {});
      await notificationService.dismissCallNotifications().catch(() => {});
      if (callRef.current) await ensureToken(callRef.current);
    },
    [applyCall, cleanupPresentation, ensureToken]
  );

  const applyDecision = useCallback(
    async (
      payload: IncomingCallPayload,
      result: ValidationResult,
      options: { ring: boolean; currentOnly?: boolean }
    ): Promise<ProcessResult> => {
      const { decision, response } = result;
      const current = callRef.current;

      if (options.currentOnly) {
        if (!current || current.callId !== payload.callId || current.status === "ended") {
          return { accepted: false, kind: decision.kind };
        }
      }

      switch (decision.kind) {
        case "ring": {
          if (options.currentOnly) {
            // A genuinely ringing/answered local call is preserved; do not
            // restart its ringtone during reconciliation.
            return { accepted: true, kind: decision.kind };
          }
          return {
            accepted:
              !!response && admitIncoming(payload, response, options.ring),
            kind: decision.kind,
          };
        }
        case "resume": {
          if (response) await resumeAnswered(payload, response);
          return { accepted: !!response, kind: decision.kind };
        }
        case "terminal": {
          if (current && current.callId === payload.callId && current.status !== "ended") {
            finishTerminal(decision.status);
          } else {
            rememberTerminal(payload.callId);
            await cleanupPresentation(payload, true);
          }
          return { accepted: false, kind: decision.kind };
        }
        case "invalid": {
          rememberTerminal(payload.callId);
          await cleanupPresentation(payload, true);
          if (current && current.callId === payload.callId && current.status !== "ended") {
            finishTerminal("ended");
          }
          return { accepted: false, kind: decision.kind };
        }
        case "unavailable":
        default:
          return { accepted: false, kind: "unavailable" };
      }
    },
    [
      admitIncoming,
      cleanupPresentation,
      finishTerminal,
      rememberTerminal,
      resumeAnswered,
    ]
  );

  const processIncoming = useCallback(
    async (
      payload: IncomingCallPayload | null,
      options: { ring?: boolean; ignoreHandled?: boolean } = {}
    ): Promise<ProcessResult> => {
      const unavailable: ProcessResult = { accepted: false, kind: "unavailable" };
      if (!payload?.callId || !payload.channelId) return unavailable;

      const auth = authRef.current;
      if (auth.isLoading || !auth.isAuthenticated || !auth.uid) return unavailable;

      if (!canPresentIncoming(payload, callRef.current, terminalCallIds.current)) {
        await cleanupPresentation(payload, true);
        return { accepted: false, kind: "terminal" };
      }
      if (
        !options.ignoreHandled &&
        handledIncomingIds.current.has(payload.callId)
      ) {
        return { accepted: false, kind: "terminal" };
      }

      const result = await checkStatus(payload.callId, payload.channelId);
      if (result.decision.kind === "unavailable") return unavailable;

      if (!options.ignoreHandled) {
        if (handledIncomingIds.current.has(payload.callId)) {
          return { accepted: false, kind: result.decision.kind };
        }
        handledIncomingIds.current.add(payload.callId);
      }

      return applyDecision(payload, result, { ring: options.ring !== false });
    },
    [applyDecision, checkStatus, cleanupPresentation]
  );

  const showIncoming = useCallback(
    async (payload: IncomingCallPayload): Promise<boolean> => {
      const result = await processIncoming(payload, { ring: true });
      return result.accepted;
    },
    [processIncoming]
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
      // Answering stops incoming presentation only; the LiveKit session starts
      // from the single global room after the token is available.
      await cleanupPresentation(incomingPayloadFromCall(current), false);
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
  }, [applyCall, cleanupPresentation, ensureToken, finishTerminal, patchCall]);

  const decline = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.callId.startsWith("pending-")) {
      finishTerminal("declined");
      return;
    }
    if (current.status === "ended") return;
    rememberTerminal(current.callId);
    handledIncomingIds.current.add(current.callId);
    applyCall({
      ...current,
      status: "ended",
      terminal: { status: "declined", message: terminalMessage("declined") },
    });
    outgoingRef.current = false;
    void stopPresentationForCall(current, true);
    try {
      await apiRequest("/api/livekit/decline", {
        method: "POST",
        body: JSON.stringify({ channelId: current.channelId, callId: current.callId }),
      });
    } catch {}
    setTimeout(() => leaveCallRoute(), 1200);
  }, [applyCall, finishTerminal, leaveCallRoute, rememberTerminal, stopPresentationForCall]);

  const end = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.status === "ended") return;
    const durationSec = current.answeredAt
      ? Math.max(1, Math.floor((Date.now() - current.answeredAt) / 1000))
      : 0;
    const status: CallTerminalStatus = current.answeredAt ? "ended" : "cancelled";
    rememberTerminal(current.callId);
    handledIncomingIds.current.add(current.callId);
    applyCall({
      ...current,
      status: "ended",
      terminal: { status, message: terminalMessage(status) },
    });
    outgoingRef.current = false;
    void stopPresentationForCall(current, true);
    try {
      await apiRequest("/api/livekit/end", {
        method: "POST",
        body: JSON.stringify({
          channelId: current.channelId,
          callId: current.callId,
          durationSec,
          status: current.answeredAt ? "ended" : "cancelled",
        }),
      });
    } catch {}
    setTimeout(() => leaveCallRoute(), 1200);
  }, [applyCall, leaveCallRoute, rememberTerminal, stopPresentationForCall]);

  const reconcileCurrent = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.status === "ended" || current.callId.startsWith("pending-")) {
      return;
    }
    const result = await checkStatus(current.callId, current.channelId);
    await applyDecision(incomingPayloadFromCall(current), result, {
      ring: false,
      currentOnly: true,
    });
  }, [applyDecision, checkStatus]);

  const reconcileAll = useCallback(async () => {
    const auth = authRef.current;
    if (auth.isLoading || !auth.isAuthenticated || !auth.uid) return;
    await reconcileCurrent();

    const intent = await peekInitialCallIntent();
    if (intent?.action === "incoming" && intent.payload) {
      await processIncoming(intent.payload, {
        ring: callRef.current?.callId !== intent.payload.callId,
      });
    }
  }, [processIncoming, reconcileCurrent]);

  const handleNativeAction = useCallback(
    async (action: "answer" | "decline" | "hangup", incoming: IncomingCallPayload | null) => {
      if (!incoming?.callId) return;
      let result: ProcessResult | null = null;
      if (callRef.current?.callId !== incoming.callId) {
        result = await processIncoming(incoming, { ring: false, ignoreHandled: true });
        // A late action on a call the server says is already terminal/answered
        // must not end a different, active session.
        if (!result.accepted || result.kind !== "ring") return;
      }
      if (action === "answer") await answer();
      else if (action === "decline") await decline();
      else await end();
    },
    [answer, decline, end, processIncoming]
  );

  // Native events, persisted intents, and cold start are all hints. Only
  // processIncoming() may admit them, and only after /api/livekit/status.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !uid) return;

    const unsubscribe = subscribeNativeCallEvents({
      onIncoming: (incoming) => {
        void processIncoming(incoming, { ring: true });
      },
      onAction: (action, incoming) => {
        void handleNativeAction(action, incoming);
      },
    });

    if (!initialIntentHandled.current) {
      initialIntentHandled.current = true;
      void (async () => {
        const intent = await peekInitialCallIntent();
        if (!intent?.payload) return;
        if (intent.action === "incoming") {
          await processIncoming(intent.payload, { ring: true });
        } else {
          await handleNativeAction(intent.action, intent.payload);
          await clearPendingCallIntent(intent.payload);
        }
      })();
    }

    return unsubscribe;
  }, [handleNativeAction, isAuthenticated, isLoading, processIncoming, uid]);

  // App-level Pusher subscription: independent of the chat route/channel.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !uid) return;
    let pusher: any = null;
    let channel: any = null;
    const handlers: Array<[string, (data: any) => void]> = [];
    let connectionHandler: ((state: { current?: string }) => void) | null = null;
    let wasDisconnected = false;

    const reconcileEvent = (data: any) => {
      if (!shouldApplyEvent(eventCallId(data), callRef.current)) return;
      void reconcileCurrent();
    };

    try {
      pusher = getMobilePusher();
      channel = pusher.subscribe(`private-user-${uid}`);
      const bind = (event: string, handler: (data: any) => void) => {
        handlers.push([event, handler]);
        channel.bind(event, handler);
      };

      bind("incoming-call", (data: any) => {
        const incoming = toIncomingPayload(data);
        if (incoming) void processIncoming(incoming, { ring: true });
      });
      bind("call-answered", reconcileEvent);
      bind("call-declined", reconcileEvent);
      bind("call-ended", reconcileEvent);
      bind("call-missed", reconcileEvent);
      bind("message-updated", (data: any) => {
        const status = data?.callDetails?.status;
        if (!["declined", "missed", "cancelled", "ended"].includes(status)) return;
        reconcileEvent({
          callId: data?.callDetails?.callId || data?.id,
          channelId: data?.callDetails?.channelId,
        });
      });

      connectionHandler = (state) => {
        const current = state?.current;
        if (current === "disconnected" || current === "unavailable" || current === "connecting") {
          wasDisconnected = true;
        }
        if (current === "connected" && wasDisconnected) {
          wasDisconnected = false;
          void reconcileAll();
        }
      };
      pusher.connection.bind("state_change", connectionHandler);
    } catch (error) {
      console.warn("[Call] Pusher bind failed:", error);
    }

    return () => {
      handlers.forEach(([event, handler]) => {
        try {
          channel?.unbind(event, handler);
        } catch {}
      });
      if (connectionHandler) {
        try {
          pusher?.connection?.unbind("state_change", connectionHandler);
        } catch {}
      }
      // Never unsubscribe globally — chat and other listeners share the client.
    };
  }, [isAuthenticated, isLoading, processIncoming, reconcileAll, reconcileCurrent, uid]);

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

  // Foreground, Pusher reconnect, and NetInfo recovery all re-check the single
  // authoritative status endpoint. A genuinely ringing/answered call survives;
  // a terminal or missing call is cleaned up locally and natively.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void reconcileAll();
    });
    return () => subscription.remove();
  }, [reconcileAll]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void reconcileAll();
    });
    return unsubscribe;
  }, [reconcileAll]);

  const value = useMemo<CallControllerValue>(
    () => ({
      call,
      isMinimized,
      minimizeCall,
      maximizeCall,
      showIncoming,
      startOutgoing,
      answer,
      decline,
      end,
      finishTerminal,
      openCall,
    }),
    [
      call,
      isMinimized,
      minimizeCall,
      maximizeCall,
      showIncoming,
      startOutgoing,
      answer,
      decline,
      end,
      finishTerminal,
      openCall,
    ]
  );

  const showActiveRoom = call?.status === "answered" && !!call.token;
  const showFullScreenView = showActiveRoom && !isMinimized;
  const showMini =
    (call?.status === "answered" && (isMinimized || !pathname.startsWith("/call/"))) ||
    (call?.status === "ringing" && !pathname.startsWith("/call/"));

  return (
    <CallControllerContext.Provider value={value}>
      {children}
      {showActiveRoom && call?.token ? (
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
          {showFullScreenView && (
            <View style={styles.roomOverlay}>
              <ActiveCallView
                call={call}
                onEndCall={() => void end()}
                onMinimize={minimizeCall}
              />
            </View>
          )}
        </LiveKitRoom>
      ) : null}
      {showMini && call ? (
        <MiniCallIndicator
          call={call}
          onPress={maximizeCall}
          onEndCall={() => void end()}
        />
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
    bottom: 24,
    zIndex: 9999,
    elevation: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#111C33",
    borderWidth: 1.5,
    borderColor: "#D97706",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  miniClickable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginRight: 10,
  },
  miniDotRinging: {
    backgroundColor: "#F59E0B",
  },
  miniText: { flex: 1 },
  miniTitle: { color: "#F8FAFC", fontSize: 14, fontWeight: "800" },
  miniSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  miniOpenBadge: {
    backgroundColor: "rgba(217, 119, 6, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
  },
  miniOpen: { color: "#D97706", fontSize: 12, fontWeight: "800" },
  miniEndBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
