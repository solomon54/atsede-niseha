// src/features/calling/callProvider.tsx
"use client";

import {
  type AudioTrack,
  Room,
  RoomEvent,
  type Track,
  type VideoTrack,
} from "livekit-client";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getPusherClient } from "@/services/pusher";
import { normalizeCallRole } from "@/shared/domain/calling/participantIdentity";

import {
  callRouteFor,
  eventCallId,
  formatCallDuration,
  RING_TIMEOUT_MS,
  terminalMessage,
  terminalStatusFromEvent,
  terminalStatusFromLifecycle,
  toActiveCall,
} from "./callDomain";
import { createRingbackController } from "./ringback";
import type {
  ActiveCallState,
  CallIdentity,
  CallParticipantView,
  CallStatusResponse,
  CallTerminalStatus,
  CallTokenResponse,
  IncomingCallPayload,
} from "./types";

interface CallContextValue {
  call: ActiveCallState | null;
  participants: CallParticipantView[];
  localParticipant: CallParticipantView | null;
  connection: "idle" | "connecting" | "connected" | "reconnecting";
  audioBlocked: boolean;
  duration: string;
  notificationPermission: NotificationPermission | "unsupported";
  isOnCallRoute: boolean;
  requestNotificationPermission: () => Promise<void>;
  startCall: (channelId: string, peer?: CallIdentity) => Promise<void>;
  recoverCall: (channelId: string, callId: string) => Promise<void>;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  end: () => Promise<void>;
  openCall: () => void;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
}

type CallError = Error & { status?: number; data?: unknown };
type JsonRecord = Record<string, unknown>;

interface RingResponse extends JsonRecord {
  callId?: string;
  status?: string;
  reason?: string;
  participants?: CallTokenResponse["participants"];
}

interface AnswerResponse extends JsonRecord {
  status?: string;
  answeredAt?: number | null;
}

interface CallEventData extends JsonRecord {
  callId?: string;
  id?: string;
  status?: string;
  callDetails?: { callId?: string; status?: string };
}

interface ConversationLike {
  id?: string;
  channel?: { id?: string };
}

interface LiveKitPublication {
  isMuted?: boolean;
  track?: Track;
}

interface LiveKitParticipantLike {
  identity: string;
  name?: string;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isSpeaking: boolean;
  videoTrackPublications?: Map<string, LiveKitPublication>;
  audioTrackPublications?: Map<string, LiveKitPublication>;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}

async function postJson<T = JsonRecord>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as JsonRecord;
  if (!res.ok) {
    const error = new Error(
      typeof data.error === "string" ? data.error : `Request failed (${res.status})`
    ) as CallError;
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [call, setCall] = useState<ActiveCallState | null>(null);
  const callRef = useRef<ActiveCallState | null>(null);
  const [participants, setParticipants] = useState<CallParticipantView[]>([]);
  const [connection, setConnection] = useState<CallContextValue["connection"]>("idle");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [now, setNow] = useState(() => Date.now());

  const roomRef = useRef<Room | null>(null);
  const roomCallIdRef = useRef<string | null>(null);
  const identitiesRef = useRef<Record<string, CallIdentity>>({});
  const terminalCallIds = useRef(new Set<string>());
  const seenIncoming = useRef(new Set<string>());
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const ringbackRef = useRef<ReturnType<typeof createRingbackController> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUidRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

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

  /** Resolve the signed-in uid before any identity decision or recovery. */
  const ensureCurrentUid = useCallback(async (): Promise<string | null> => {
    if (currentUidRef.current) return currentUidRef.current;
    try {
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      if (sessionRes.ok) {
        const session = await sessionRes.json().catch(() => null);
        currentUidRef.current = typeof session?.uid === "string" ? session.uid : null;
      }
    } catch {
      currentUidRef.current = null;
    }
    return currentUidRef.current;
  }, []);

  const isOnCallRoute =
    !!call &&
    typeof pathname === "string" &&
    pathname.startsWith(`/call/${call.channelId}`);

  const duration = formatCallDuration(call?.answeredAt || call?.startedAt || null, now);

  useEffect(() => {
    if (!call?.answeredAt && !call?.startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [call?.answeredAt, call?.startedAt]);

  /* ------------------------------------------------------------------ */
  /* Audio                                                               */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/call-ring.mp3");
    audio.loop = true;
    audio.preload = "auto";
    ringtoneRef.current = audio;
    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      ringtoneRef.current = null;
    };
  }, []);

  const stopRingtone = useCallback(() => {
    try {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    } catch {}
    setAudioBlocked(false);
  }, []);

  const startRingtone = useCallback(() => {
    const audio = ringtoneRef.current;
    if (!audio) return;
    setAudioBlocked(false);
    try {
      const promise = audio.play();
      promise?.catch(() => setAudioBlocked(true));
    } catch {
      setAudioBlocked(true);
    }
  }, []);

  const ringback = useCallback(() => {
    if (!ringbackRef.current) ringbackRef.current = createRingbackController();
    return ringbackRef.current;
  }, []);

  const stopAllAudio = useCallback(() => {
    stopRingtone();
    try { ringbackRef.current?.stop(); } catch {}
  }, [stopRingtone]);

  /* ------------------------------------------------------------------ */
  /* LiveKit room (owned by the provider, never by a page component)      */
  /* ------------------------------------------------------------------ */

  const mapParticipant = useCallback(
    (p: LiveKitParticipantLike, isLocal: boolean): CallParticipantView => {
    const videoPub = Array.from(
      p.videoTrackPublications?.values() || []
    )[0];
    const audioPub = Array.from(
      p.audioTrackPublications?.values() || []
    )[0];
    const identity = identitiesRef.current[p.identity];
    return {
      identity: p.identity,
      name: isLocal ? "እርስዎ" : identity?.name || p.name || "ተሳታፊ",
      role: identity?.role || null,
      photoUrl: identity?.photoUrl || null,
      isLocal,
      isCameraEnabled: Boolean(p.isCameraEnabled && !videoPub?.isMuted && videoPub?.track),
      isMicrophoneEnabled: Boolean(p.isMicrophoneEnabled),
      isSpeaking: Boolean(p.isSpeaking),
      videoTrack: (videoPub?.track as VideoTrack | undefined) || null,
      audioTrack: (audioPub?.track as AudioTrack | undefined) || null,
    };
    },
    []
  );

  const syncParticipants = useCallback(
    (roomInstance: Room) => {
      const list: CallParticipantView[] = [];
      if (roomInstance.localParticipant) {
        list.push(mapParticipant(roomInstance.localParticipant, true));
      }
      roomInstance.remoteParticipants.forEach((p) => list.push(mapParticipant(p, false)));
      setParticipants(list);

      if (roomInstance.remoteParticipants.size > 0) {
        stopAllAudio();
        setConnection("connected");
        const current = callRef.current;
        if (current && current.phase !== "answered") {
          applyCall({ ...current, phase: "answered", answeredAt: current.answeredAt || Date.now() });
        }
      }
    },
    [applyCall, mapParticipant, stopAllAudio]
  );

  const disconnectRoom = useCallback(() => {
    const roomInstance = roomRef.current;
    roomRef.current = null;
    roomCallIdRef.current = null;
    setParticipants([]);
    setConnection("idle");
    if (roomInstance && roomInstance.state !== "disconnected") {
      try { roomInstance.disconnect(); } catch {}
    }
  }, []);

  const fetchCredentials = useCallback(
    async (callId: string, channelId: string): Promise<CallTokenResponse> =>
      postJson<CallTokenResponse>("/api/livekit/token", { channelId, callId }),
    []
  );

  const finishTerminal = useCallback(
    async (status: CallTerminalStatus, message?: string) => {
      const current = callRef.current;
      if (!current) return;
      terminalCallIds.current.add(current.callId);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current);
      stopAllAudio();
      disconnectRoom();
      applyCall({
        ...current,
        phase: "terminal",
        terminal: { status, message: message || terminalMessage(status) },
      });

      const finishedCallId = current.callId;
      const wasOnCallRoute = pathnameRef.current?.startsWith(`/call/${current.channelId}`);
      terminalTimerRef.current = setTimeout(() => {
        if (callRef.current?.callId !== finishedCallId) return;
        applyCall(null);
        if (wasOnCallRoute) router.push("/messages");
      }, 2600);
    },
    [applyCall, disconnectRoom, router, stopAllAudio]
  );

  const connectRoom = useCallback(
    async (active: ActiveCallState, credentials: CallTokenResponse) => {
      if (!mountedRef.current) return;
      if (roomRef.current && roomCallIdRef.current === active.callId) return;
      if (roomCallIdRef.current && roomCallIdRef.current !== active.callId) disconnectRoom();

      const identityMap: Record<string, CallIdentity> = { ...active.participants };
      if (currentUidRef.current && !identityMap[currentUidRef.current]) {
        identityMap[currentUidRef.current] = {
          uid: currentUidRef.current,
          name: credentials.participantName || "እርስዎ",
          photoUrl: credentials.participantPhotoUrl || null,
          role: credentials.participantRole,
        };
      }
      credentials.participants.forEach((p) => {
        if (p.uid === currentUidRef.current) return;
        identityMap[p.uid] = {
          uid: p.uid,
          name: p.displayName,
          photoUrl: p.photoUrl || null,
          role: normalizeCallRole(p.role),
        };
      });
      identitiesRef.current = identityMap;
      patchCall({ participants: identityMap });

      const roomInstance = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = roomInstance;
      roomCallIdRef.current = active.callId;
      setConnection("connecting");

      const update = () => { if (mountedRef.current) syncParticipants(roomInstance); };
      roomInstance.on(RoomEvent.TrackSubscribed, update);
      roomInstance.on(RoomEvent.TrackUnsubscribed, update);
      roomInstance.on(RoomEvent.TrackMuted, update);
      roomInstance.on(RoomEvent.TrackUnmuted, update);
      roomInstance.on(RoomEvent.ParticipantConnected, update);
      roomInstance.on(RoomEvent.ParticipantDisconnected, update);
      roomInstance.on(RoomEvent.ActiveSpeakersChanged, update);
      roomInstance.on(RoomEvent.Reconnecting, () => {
        if (mountedRef.current && callRef.current?.callId === active.callId) setConnection("reconnecting");
      });
      roomInstance.on(RoomEvent.Reconnected, () => {
        if (mountedRef.current && callRef.current?.callId === active.callId) setConnection("connected");
      });
      roomInstance.on(RoomEvent.Disconnected, () => {
        if (!mountedRef.current || callRef.current?.callId !== active.callId) return;
        if (terminalCallIds.current.has(active.callId)) return;
        void finishTerminal("ended");
      });

      try {
        await roomInstance.connect(credentials.url, credentials.token);
        if (!mountedRef.current || callRef.current?.callId !== active.callId) return;
        // Request devices independently: denying camera must not also drop audio.
        await Promise.allSettled([
          roomInstance.localParticipant.setMicrophoneEnabled(true),
          roomInstance.localParticipant.setCameraEnabled(true),
        ]);
        if (!mountedRef.current || callRef.current?.callId !== active.callId) return;
        syncParticipants(roomInstance);
      } catch (error) {
        if (!mountedRef.current || callRef.current?.callId !== active.callId) return;
        disconnectRoom();
        void finishTerminal("error", error instanceof Error ? error.message : undefined);
      }
    },
    [disconnectRoom, finishTerminal, patchCall, syncParticipants]
  );

  /* ------------------------------------------------------------------ */
  /* Transitions                                                         */
  /* ------------------------------------------------------------------ */

  const openCall = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    router.push(callRouteFor(current));
  }, [router]);

  const startCall = useCallback(
    async (channelId: string, peer?: CallIdentity) => {
      const current = callRef.current;
      if (current && current.phase !== "terminal") {
        if (current.channelId === channelId) openCall();
        return;
      }
      if (!channelId.trim()) return;
      await ensureCurrentUid();

      const pendingId = `pending-${Date.now()}`;
      const optimistic: ActiveCallState = {
        callId: pendingId,
        channelId,
        direction: "outgoing",
        phase: "outgoing",
        isGroup: false,
        peer: peer || {
          uid: "",
          name: "የንስሐ አባል",
          photoUrl: null,
          role: "STUDENT",
        },
        participants: peer ? { [peer.uid]: peer } : {},
        startedAt: Date.now(),
        answeredAt: null,
        terminal: null,
      };
      applyCall(optimistic);
      setConnection("connecting");

      try {
        const ringResult = await postJson<RingResponse>("/api/livekit/ring", { channelId });
        if (!ringResult?.callId || ringResult?.status !== "ringing") {
          const status =
            ringResult?.reason === "caller_busy" || ringResult?.reason === "all_busy"
              ? "busy"
              : "unreachable";
          await finishTerminal(status);
          return;
        }
        if (callRef.current?.callId !== pendingId) return;

        const [statusRes, credentials] = await Promise.all([
          fetch(`/api/livekit/status?callId=${encodeURIComponent(ringResult.callId)}&channelId=${encodeURIComponent(channelId)}`, {
            cache: "no-store",
          }).then((r) => (r.ok ? (r.json() as Promise<CallStatusResponse>) : Promise.resolve(null))).catch(() => null),
          fetchCredentials(ringResult.callId, channelId),
        ]);
        if (!mountedRef.current || callRef.current?.callId !== pendingId) return;

        const participantList = credentials.participants || ringResult.participants || [];
        const active = statusRes
          ? toActiveCall({ status: statusRes, currentUid: currentUidRef.current, participants: participantList })
          : {
              ...optimistic,
              callId: ringResult.callId,
            };
        // Preserve a peer the caller already sees (e.g. conversation avatar)
        // when the authoritative status has no caller-side identity yet.
        if (peer && active.peer.uid !== peer.uid && active.peer.name === "የንስሐ አባል") {
          active.peer = peer;
          active.participants[peer.uid] = peer;
        }
        applyCall(active);
        openCall();
        void ringback().start();
        await connectRoom(active, credentials);

        if (!mountedRef.current || callRef.current?.callId !== active.callId) return;
        ringTimeoutRef.current = setTimeout(async () => {
          const latest = callRef.current;
          if (!latest || latest.callId !== active.callId || latest.phase === "answered" || latest.phase === "terminal") return;
          stopAllAudio();
          try {
            await postJson("/api/livekit/timeout", { channelId, callId: active.callId });
          } catch {}
          await finishTerminal("missed");
        }, RING_TIMEOUT_MS);
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        const status: CallTerminalStatus = errorStatus(error) === 409 ? "busy" : "unreachable";
        await finishTerminal(
          status,
          errorStatus(error) === 500 && error instanceof Error ? error.message : undefined
        );
      }
    },
    [applyCall, connectRoom, ensureCurrentUid, fetchCredentials, finishTerminal, openCall, ringback, stopAllAudio]
  );

  const recoverCall = useCallback(
    async (channelId: string, callId: string) => {
      const current = callRef.current;
      if (current && current.callId === callId) return;
      if (terminalCallIds.current.has(callId)) {
        applyCall(null);
        return;
      }
      await ensureCurrentUid();
      try {
        const statusRes = await fetch(
          `/api/livekit/status?callId=${encodeURIComponent(callId)}&channelId=${encodeURIComponent(channelId)}`,
          { cache: "no-store" }
        );
        if (!statusRes.ok) {
          applyCall(null);
          return;
        }
        const status = (await statusRes.json()) as CallStatusResponse;
        if (!status.joinable || (status.status !== "ringing" && status.status !== "answered")) {
          const terminal = terminalStatusFromLifecycle(status.status) || "ended";
          applyCall({
            callId,
            channelId,
            direction: "incoming",
            phase: "terminal",
            isGroup: false,
            peer: {
              uid: status.callerId || "",
              name: status.callerName || "የንስሐ አባል",
              photoUrl: status.callerPhotoUrl || null,
              role: normalizeCallRole(status.callerRole),
            },
            participants: {},
            startedAt: status.startedAt || Date.now(),
            answeredAt: status.answeredAt || null,
            terminal: { status: terminal, message: terminalMessage(terminal) },
          });
          terminalCallIds.current.add(callId);
          return;
        }
        const credentials = await fetchCredentials(callId, channelId);
        const active = toActiveCall({
          status,
          currentUid: currentUidRef.current,
          participants: credentials.participants || [],
        });
        applyCall(active);
        await connectRoom(active, credentials);
      } catch {
        applyCall(null);
      }
    },
    [applyCall, connectRoom, ensureCurrentUid, fetchCredentials]
  );

  const answer = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.phase !== "incoming" || current.callId.startsWith("pending-")) return;
    try {
      const result = await postJson<AnswerResponse>("/api/livekit/answer", {
        channelId: current.channelId,
        callId: current.callId,
      });
      const terminal = terminalStatusFromLifecycle(result.status);
      if (terminal) {
        await finishTerminal(terminal);
        return;
      }
      if (!mountedRef.current) return;
      stopAllAudio();
      const answered: ActiveCallState = {
        ...current,
        phase: "answered",
        answeredAt: result.answeredAt || current.answeredAt || Date.now(),
      };
      applyCall(answered);
      const credentials = await fetchCredentials(current.callId, current.channelId);
      await connectRoom(answered, credentials);
      openCall();
    } catch (error: unknown) {
      await finishTerminal(errorStatus(error) === 403 ? "ended" : "error");
    }
  }, [applyCall, connectRoom, fetchCredentials, finishTerminal, openCall, stopAllAudio]);

  const decline = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.phase !== "incoming" || current.callId.startsWith("pending-")) return;
    await finishTerminal("declined");
    try {
      await postJson("/api/livekit/decline", {
        channelId: current.channelId,
        callId: current.callId,
      });
    } catch {}
  }, [finishTerminal]);

  const end = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.phase === "terminal" || current.callId.startsWith("pending-")) return;
    const durationSec = current.answeredAt
      ? Math.max(1, Math.floor((Date.now() - current.answeredAt) / 1000))
      : 0;
    const requested = current.phase === "answered" ? "ended" : "cancelled";
    await finishTerminal(requested);
    try {
      await postJson("/api/livekit/end", {
        channelId: current.channelId,
        callId: current.callId,
        durationSec,
        status: requested,
      });
    } catch {}
  }, [finishTerminal]);

  const toggleMic = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    try { await local.setMicrophoneEnabled(!local.isMicrophoneEnabled); } catch {}
    if (roomRef.current) syncParticipants(roomRef.current);
  }, [syncParticipants]);

  const toggleCamera = useCallback(async () => {
    const local = roomRef.current?.localParticipant;
    if (!local) return;
    try { await local.setCameraEnabled(!local.isCameraEnabled); } catch {}
    if (roomRef.current) syncParticipants(roomRef.current);
  }, [syncParticipants]);

  /* ------------------------------------------------------------------ */
  /* Browser notifications                                               */
  /* ------------------------------------------------------------------ */

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {}
  }, []);

  const showBrowserNotification = useCallback((active: ActiveCallState) => {
    if (typeof document === "undefined" || typeof Notification === "undefined") return;
    if (document.visibilityState !== "hidden" || Notification.permission !== "granted") return;
    const url = callRouteFor(active);
    const options: NotificationOptions = {
      body: `${active.peer.name} ጥሪ አድርገዋል`,
      icon: active.peer.photoUrl || "/icons/icon-192x192.png",
      tag: `incoming-call-${active.callId}`,
      requireInteraction: true,
      data: { callUrl: url },
    };
    const fallback = () => {
      try {
        const notification = new Notification("የቪዲዮ ጥሪ", options);
        notification.onclick = () => {
          window.focus();
          router.push(url);
          notification.close();
        };
      } catch {}
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("የቪዲዮ ጥሪ", options))
        .catch(fallback);
    } else {
      fallback();
    }
  }, [router]);

  /* ------------------------------------------------------------------ */
  /* App-wide Pusher events                                              */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined") return;
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);

    let pusher: ReturnType<typeof getPusherClient> | null = null;
    let disposed = false;
    let interval: number | null = null;
    let onVisibility: (() => void) | null = null;
    let onConnected: (() => void) | null = null;
    const bound = new Map<string, Array<[string, (data: CallEventData) => void]>>();
    const subscribed = new Set<string>();
    let refreshing = false;

    const handleTerminal = (eventCall: string | null, status: CallTerminalStatus | null) => {
      const current = callRef.current;
      if (!current || !eventCall || current.callId !== eventCall) return;
      if (current.phase === "terminal") return;
      void finishTerminal(status || "ended");
    };

    const handleIncoming = (data: IncomingCallPayload, channelName: string) => {
      if (disposed || !data?.callId || !data?.channelId) return;

      // A private-user channel is authenticated to exactly this account, so its
      // channel name is a safe local uid hint. The server still authorizes the
      // subscription and the call record.
      if (channelName.startsWith("private-user-")) {
        const channelUid = channelName.slice("private-user-".length);
        if (channelUid && !currentUidRef.current) currentUidRef.current = channelUid;
      }
      if (currentUidRef.current && data.callerId === currentUidRef.current) return;
      // The caller also receives the private-chat fanout. Until the account uid
      // is known, only recipient-targeted private-user events may ring.
      if (channelName.startsWith("private-chat-") && !currentUidRef.current) return;
      if (terminalCallIds.current.has(data.callId) || seenIncoming.current.has(data.callId)) return;
      seenIncoming.current.add(data.callId);
      const current = callRef.current;
      if (current && current.callId !== data.callId && current.phase !== "terminal") return;

      // Stale/ended events must never reopen the overlay. The authoritative
      // record also supplies registered profile identity, not event text alone.
      void (async () => {
        await ensureCurrentUid();
        if (disposed || !currentUidRef.current) return;
        if (data.callerId === currentUidRef.current) return;
        try {
          const statusRes = await fetch(
            `/api/livekit/status?callId=${encodeURIComponent(data.callId)}&channelId=${encodeURIComponent(data.channelId)}`,
            { cache: "no-store" }
          );
          const status = statusRes.ok
            ? ((await statusRes.json().catch(() => null)) as CallStatusResponse | null)
            : null;
          if (disposed) return;
          if (
            !status ||
            !status.joinable ||
            (status.status !== "ringing" && status.status !== "answered") ||
            status.callerId === currentUidRef.current
          ) {
            terminalCallIds.current.add(data.callId);
            return;
          }
          if (callRef.current && callRef.current.callId !== data.callId && callRef.current.phase !== "terminal") return;
          const active = toActiveCall({
            status,
            currentUid: currentUidRef.current,
            participants: [
              {
                uid: data.callerId,
                displayName: data.callerName,
                photoUrl: data.callerPhotoUrl || null,
                role: data.callerRole,
              },
            ],
          });
          applyCall(active);
          startRingtone();
          showBrowserNotification(active);
        } catch {
          // A failed status check must not present a possibly stale call.
        }
      })();
    };

    const bindAll = (channelName: string) => {
      if (!pusher || subscribed.has(channelName)) return;
      const channel = pusher.subscribe(channelName);
      subscribed.add(channelName);
      const handlers: Array<[string, (data: CallEventData) => void]> = [
        ["incoming-call", (data) => handleIncoming(data as unknown as IncomingCallPayload, channelName)],
        ["call-declined", (data) => handleTerminal(eventCallId(data), terminalStatusFromEvent("call-declined", data))],
        ["call-missed", (data) => handleTerminal(eventCallId(data), terminalStatusFromEvent("call-missed", data))],
        ["call-ended", (data) => handleTerminal(eventCallId(data), terminalStatusFromEvent("call-ended", data))],
        ["call-answered", (data) => {
          const current = callRef.current;
          if (!current || eventCallId(data) !== current.callId) return;
          stopAllAudio();
          if (current.phase === "outgoing") patchCall({ answeredAt: current.answeredAt || Date.now() });
        }],
        ["message-updated", (data) => handleTerminal(eventCallId(data), terminalStatusFromEvent("message-updated", data))],
      ];
      handlers.forEach(([event, handler]) => channel.bind(event, handler));
      bound.set(channelName, handlers);
    };

    const refreshSubscriptions = async () => {
      if (disposed || !pusher || refreshing) return;
      refreshing = true;
      try {
        const uid = await ensureCurrentUid();
        if (!uid) return;
        const desired = new Set<string>([`private-user-${uid}`]);
        bindAll(`private-user-${uid}`);
        const convRes = await fetch("/api/message/conversation", { cache: "no-store" }).catch(() => null);
        if (convRes?.ok) {
          const conversations = await convRes.json().catch(() => []);
          if (Array.isArray(conversations)) {
            conversations.forEach((value: unknown) => {
              const conversation = value as ConversationLike;
              const cid = conversation?.channel?.id || conversation?.id;
              if (cid) desired.add(`private-chat-${cid}`);
            });
          }
        }
        desired.forEach(bindAll);
        subscribed.forEach((name) => {
          if (desired.has(name)) return;
          const handlers = bound.get(name) || [];
          try {
            const channel = pusher!.channel(name);
            handlers.forEach(([event, handler]) => channel?.unbind(event, handler));
            pusher!.unsubscribe(name);
          } catch {}
          bound.delete(name);
          subscribed.delete(name);
        });
      } catch {
        // best-effort; retried on reconnect/visibility/interval
      } finally {
        refreshing = false;
      }
    };

    try {
      pusher = getPusherClient();
      void refreshSubscriptions();
      onConnected = () => void refreshSubscriptions();
      pusher.connection.bind("connected", onConnected);
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void refreshSubscriptions();
      }, 30_000);
      onVisibility = () => {
        if (document.visibilityState === "visible") void refreshSubscriptions();
      };
      document.addEventListener("visibilitychange", onVisibility);
    } catch {}

    return () => {
      disposed = true;
      mountedRef.current = false;
      if (interval) window.clearInterval(interval);
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      if (pusher && onConnected) {
        try { pusher.connection.unbind("connected", onConnected); } catch {}
      }
      bound.forEach((handlers, name) => {
        try {
          const channel = pusher?.channel(name);
          handlers.forEach(([event, handler]) => channel?.unbind(event, handler));
          pusher?.unsubscribe(name);
        } catch {}
      });
      bound.clear();
      subscribed.clear();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current);
      stopAllAudio();
      void ringbackRef.current?.dispose();
      ringbackRef.current = null;
      const roomInstance = roomRef.current;
      roomRef.current = null;
      if (roomInstance && roomInstance.state !== "disconnected") {
        try { roomInstance.disconnect(); } catch {}
      }
    };
  }, [applyCall, ensureCurrentUid, finishTerminal, patchCall, showBrowserNotification, startRingtone, stopAllAudio]);

  const value: CallContextValue = {
    call,
    participants,
    localParticipant: participants.find((p) => p.isLocal) || null,
    connection,
    audioBlocked,
    duration,
    notificationPermission,
    isOnCallRoute,
    requestNotificationPermission,
    startCall,
    recoverCall,
    answer,
    decline,
    end,
    openCall,
    toggleMic,
    toggleCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
