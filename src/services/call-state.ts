// src/services/call-state.ts
import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/services/firebase/admin";

export const RINGING_WINDOW_MS = 45_000;

export type CallLifecycleStatus =
  | "ringing"
  | "answered"
  | "declined"
  | "missed"
  | "cancelled"
  | "ended";

export type ActiveCallStatus = "ringing" | "answered";
export type CallParticipantRole = "caller" | "callee";

export interface UserCallState {
  activeCallId: string;
  status: ActiveCallStatus;
  channelId: string;
  role: CallParticipantRole;
  startedAt: number;
  updatedAt: number;
}

export interface CallRecord {
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl?: string | null;
  callerRole?: string | null;
  status: CallLifecycleStatus;
  startedAt: number;
  answeredAt?: number | null;
  endedAt?: number | null;
  durationSec?: number | null;
  isGroup: boolean;
  notifiedRecipientIds?: string[];
  busyRecipientIds?: string[];
  updatedAt?: number;
  failureReason?: string | null;
}

const TERMINAL: ReadonlySet<CallLifecycleStatus> = new Set([
  "declined",
  "missed",
  "cancelled",
  "ended",
]);

export function isTerminalCallStatus(
  status: unknown
): status is Exclude<CallLifecycleStatus, "ringing" | "answered"> {
  return typeof status === "string" && TERMINAL.has(status as CallLifecycleStatus);
}

export function isRingingStale(
  status: unknown,
  startedAt: unknown,
  now = Date.now()
): boolean {
  if (status !== "ringing") return false;
  const started = typeof startedAt === "number" ? startedAt : 0;
  if (!started) return true;
  return now - started > RINGING_WINDOW_MS;
}

export function isActiveCallStatus(
  status: unknown,
  startedAt: unknown,
  now = Date.now()
): status is ActiveCallStatus {
  if (status === "answered") return true;
  if (status === "ringing") return !isRingingStale(status, startedAt, now);
  return false;
}

function userCallStateRef(uid: string) {
  return adminDb.collection("UserCallStates").doc(uid);
}

function callRef(callId: string) {
  return adminDb.collection("Calls").doc(callId);
}

export async function getCallRecord(callId: string): Promise<CallRecord | null> {
  const snap = await callRef(callId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return { ...(data as CallRecord), callId: snap.id };
}

export async function claimUserForCall(args: {
  uid: string;
  callId: string;
  channelId: string;
  role: CallParticipantRole;
  status: ActiveCallStatus;
  startedAt: number;
  now?: number;
}): Promise<{ ok: true } | { ok: false; reason: "busy"; current?: UserCallState | null }> {
  const now = args.now ?? Date.now();
  const ref = userCallStateRef(args.uid);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data() as UserCallState) : null) ?? null;

    if (current && current.activeCallId === args.callId) {
      tx.set(
        ref,
        {
          activeCallId: args.callId,
          status: args.status,
          channelId: args.channelId,
          role: args.role,
          startedAt: args.startedAt,
          updatedAt: now,
        } satisfies UserCallState,
        { merge: false }
      );
      return { ok: true as const };
    }

    if (current) {
      const markerLocallyActive = isActiveCallStatus(current.status, current.startedAt, now);

      // If marker appears active locally, OR marker says answered (never stale by time) / could be inconsistent,
      // consult authoritative call record before blocking forever or before allowing takeover.
      if (markerLocallyActive || current.status === "answered" || (current.status === "ringing" && isRingingStale(current.status, current.startedAt, now))) {
        const callSnap = await tx.get(callRef(current.activeCallId));
        if (callSnap.exists) {
          const call = { ...(callSnap.data() as CallRecord), callId: callSnap.id };
          const callStaleRinging = isRingingStale(call.status, call.startedAt, now);
          const callActive = call.status === "answered" || (call.status === "ringing" && !callStaleRinging);

          if (callActive) {
            // Authoritative call still active: block competing claim for different callId.
            // Self-heal answered-call marker drift so a failed promotion cannot become stale after 45s.
            if (call.status === "answered" && current.status !== "answered") {
              tx.set(
                ref,
                {
                  activeCallId: current.activeCallId,
                  status: "answered",
                  channelId: call.channelId || current.channelId,
                  role: current.role,
                  startedAt: call.startedAt || current.startedAt,
                  updatedAt: now,
                } satisfies UserCallState,
                { merge: false }
              );
            }
            return { ok: false as const, reason: "busy" as const, current };
          }

          if (isTerminalCallStatus(call.status) || callStaleRinging) {
            // Terminal/stale authoritative call: safe callId-scoped self-healing.
            // Delete only this old marker (same callId) before taking over with new call.
            tx.delete(ref);
            const next: UserCallState = {
              activeCallId: args.callId,
              status: args.status,
              channelId: args.channelId,
              role: args.role,
              startedAt: args.startedAt,
              updatedAt: now,
            };
            tx.set(ref, next, { merge: false });
            return { ok: true as const };
          }
        } else {
          // Missing authoritative call record: if marker is locally active (esp. answered), be conservative.
          if (markerLocallyActive) {
            return { ok: false as const, reason: "busy" as const, current };
          }
          // Stale/non-active marker with missing call record can be cleared for self-healing.
          tx.delete(ref);
        }
      }
    }

    tx.set(
      ref,
      {
        activeCallId: args.callId,
        status: args.status,
        channelId: args.channelId,
        role: args.role,
        startedAt: args.startedAt,
        updatedAt: now,
      } satisfies UserCallState,
      { merge: false }
    );

    return { ok: true as const };
  });
}

export async function releaseUserCallStateIfMatch(args: {
  uid: string;
  callId: string;
  now?: number;
}): Promise<boolean> {
  const now = args.now ?? Date.now();
  const ref = userCallStateRef(args.uid);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = snap.data() as UserCallState;
    if (current.activeCallId !== args.callId) return false;
    tx.delete(ref);
    return true;
  }).catch(() => false);
}

export async function releaseUsersForCall(
  uids: string[],
  callId: string,
  now = Date.now()
): Promise<{ released: number; failed: string[] }> {
  const unique = [...new Set(uids.filter(Boolean))];
  const results = await Promise.all(
    unique.map(async (uid) => {
      try {
        const released = await releaseUserCallStateIfMatch({ uid, callId, now });
        return { uid, ok: true as const, released };
      } catch {
        return { uid, ok: false as const, released: false };
      }
    })
  );
  const failed = results.filter((r) => !r.ok).map((r) => r.uid);
  const released = results.filter((r) => r.released).length;
  return { released, failed };
}

/**
 * Best-effort reconciliation for a call that cannot be established/joined.
 * - Persists a terminal call state when possible (without creating an "active/joinable" ringing state)
 * - Releases only claims belonging to this callId
 * Never claims global multi-document atomicity; reports partial cleanup.
 */
export async function reconcileCallAsFailed(args: {
  callId: string;
  channelId: string;
  participantUids: string[];
  status?: "cancelled" | "ended" | "missed";
  reason?: string;
  now?: number;
}): Promise<{
  callPersisted: boolean;
  messagePersisted: boolean;
  claims: { released: number; failed: string[] };
}> {
  const now = args.now ?? Date.now();
  const status = args.status ?? "cancelled";
  const cref = callRef(args.callId);

  let callPersisted = false;
  let messagePersisted = false;

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(cref);
      const existing = snap.exists ? ({ ...(snap.data() as CallRecord), callId: snap.id } as CallRecord) : null;
      // Never resurrect/keep an active joinable ringing state for a failed establishment.
      if (existing && isTerminalCallStatus(existing.status)) {
        return;
      }
      const base: Partial<CallRecord> = existing || {
        callId: args.callId,
        channelId: args.channelId,
        callerId: "",
        callerName: "",
        status,
        startedAt: now,
        isGroup: false,
      };
      tx.set(
        cref,
        {
          ...base,
          callId: args.callId,
          channelId: args.channelId,
          status,
          endedAt: now,
          durationSec: 0,
          updatedAt: now,
          failureReason: args.reason || null,
        },
        { merge: true }
      );
    });
    callPersisted = true;
  } catch (e) {
    console.warn("[call-state] reconcileCallAsFailed: call persist failed", args.callId, e);
  }

  try {
    await adminDb
      .collection("Channels")
      .doc(args.channelId)
      .collection("Messages")
      .doc(args.callId)
      .set(
        {
          callDetails: {
            callId: args.callId,
            channelId: args.channelId,
            status,
            endedAt: now,
            durationSec: 0,
          },
          editedAt: now,
        },
        { merge: true }
      );
    messagePersisted = true;
  } catch (e) {
    console.warn("[call-state] reconcileCallAsFailed: message persist failed", args.callId, e);
  }

  const claims = await releaseUsersForCall(args.participantUids, args.callId, now);
  return { callPersisted, messagePersisted, claims };
}

export async function transitionCallToAnswered(args: {
  callId: string;
  channelId: string;
  actorUid: string;
  now?: number;
}): Promise<{
  ok: boolean;
  status: CallLifecycleStatus;
  call: CallRecord | null;
  transitioned: boolean;
  participantClaims?: { ok: boolean; failedUids: string[] };
}> {
  const now = args.now ?? Date.now();
  const cref = callRef(args.callId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(cref);
    if (!snap.exists) return { ok: false, status: "ended" as CallLifecycleStatus, call: null, transitioned: false };
    const call = { ...(snap.data() as CallRecord), callId: snap.id };
    if (call.channelId !== args.channelId) {
      return { ok: false, status: call.status, call, transitioned: false };
    }
    if (isTerminalCallStatus(call.status)) {
      return { ok: true, status: call.status, call, transitioned: false };
    }
    if (call.status === "answered") {
      return { ok: true, status: call.status, call, transitioned: false };
    }
    if (call.status !== "ringing") {
      return { ok: false, status: call.status, call, transitioned: false };
    }

    const updated: CallRecord = {
      ...call,
      status: "answered",
      answeredAt: call.answeredAt || now,
      updatedAt: now,
    };
    tx.set(cref, { ...updated, updatedAt: now }, { merge: true });
    return { ok: true, status: "answered" as CallLifecycleStatus, call: updated, transitioned: true };
  });

  let participantClaims: { ok: boolean; failedUids: string[] } | undefined;
  if (result.transitioned && result.call) {
    const claimTargets = [args.actorUid, result.call.callerId].filter(Boolean);
    const outcomes = await Promise.all(
      claimTargets.map(async (uid) => {
        try {
          const claimRes = await claimUserForCall({
            uid,
            callId: args.callId,
            channelId: args.channelId,
            role: uid === result.call!.callerId ? "caller" : "callee",
            status: "answered",
            startedAt: result.call!.startedAt || now,
            now,
          });
          return claimRes.ok || (claimRes as any).current?.activeCallId === args.callId;
        } catch {
          return false;
        }
      })
    );
    const failedUids = claimTargets.filter((_, i) => !outcomes[i]);
    participantClaims = { ok: failedUids.length === 0, failedUids };
    if (failedUids.length > 0) {
      console.warn("[call-state] transitionCallToAnswered: participant claim sync incomplete", {
        callId: args.callId,
        failedUids,
      });
    }
  }

  return { ...result, participantClaims };
}

export async function transitionCallToTerminal(args: {
  callId: string;
  channelId: string;
  actorUid?: string;
  to: "declined" | "missed" | "cancelled" | "ended";
  durationSec?: number;
  now?: number;
}): Promise<{
  ok: boolean;
  status: CallLifecycleStatus;
  call: CallRecord | null;
  transitioned: boolean;
  claimRelease?: { released: number; failed: string[] };
}> {
  const now = args.now ?? Date.now();
  const cref = callRef(args.callId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(cref);
    if (!snap.exists) return { ok: false, status: "ended" as CallLifecycleStatus, call: null, transitioned: false };
    const call = { ...(snap.data() as CallRecord), callId: snap.id };
    if (call.channelId !== args.channelId) {
      return { ok: false, status: call.status, call, transitioned: false };
    }
    if (isTerminalCallStatus(call.status)) {
      return { ok: true, status: call.status, call, transitioned: false };
    }

    let finalStatus: CallLifecycleStatus = args.to;
    let durationSec = typeof call.durationSec === "number" ? call.durationSec : 0;

    if (call.status === "answered") {
      finalStatus = "ended";
      if (call.answeredAt) {
        const elapsed = Math.floor((now - call.answeredAt) / 1000);
        durationSec = Math.max(1, typeof args.durationSec === "number" ? args.durationSec : elapsed);
      } else if (typeof args.durationSec === "number") {
        durationSec = Math.max(0, args.durationSec);
      }
    } else if (call.status === "ringing") {
      if (args.to === "declined") finalStatus = "declined";
      else if (args.to === "missed") finalStatus = "missed";
      else finalStatus = "cancelled";
      durationSec = 0;
    }

    const updated: CallRecord = {
      ...call,
      status: finalStatus,
      endedAt: call.status === "answered" ? call.endedAt || now : now,
      durationSec,
      updatedAt: now,
    };

    const stored: CallRecord =
      call.status === "answered"
        ? { ...updated, status: "answered", endedAt: now }
        : updated;

    tx.set(cref, { ...stored, updatedAt: now }, { merge: true });
    return { ok: true, status: stored.status, call: stored, transitioned: true };
  });

  let claimRelease: { released: number; failed: string[] } | undefined;
  if (result.transitioned && result.call) {
    const participants = [
      result.call.callerId,
      ...(result.call.notifiedRecipientIds || []),
      ...(result.call.busyRecipientIds || []),
      args.actorUid || "",
    ].filter(Boolean);
    claimRelease = await releaseUsersForCall(participants, args.callId, now);
    if (claimRelease.failed.length > 0) {
      console.warn("[call-state] transitionCallToTerminal: claim release incomplete", {
        callId: args.callId,
        failed: claimRelease.failed,
        status: result.status,
      });
    }
  }

  return { ...result, claimRelease };
}

export async function markRingingTimedOut(args: {
  callId: string;
  channelId: string;
  now?: number;
}): Promise<{ ok: boolean; status: CallLifecycleStatus; call: CallRecord | null; transitioned: boolean }> {
  return transitionCallToTerminal({
    callId: args.callId,
    channelId: args.channelId,
    to: "missed",
    now: args.now,
  });
}

export async function upsertCallArtifacts(args: {
  callId: string;
  channelId: string;
  call: CallRecord;
  messageData: Record<string, any>;
  now?: number;
}): Promise<void> {
  const now = args.now ?? Date.now();
  const msgRef = adminDb
    .collection("Channels")
    .doc(args.channelId)
    .collection("Messages")
    .doc(args.callId);

  await Promise.all([
    msgRef.set({ ...args.messageData, id: args.callId }, { merge: true }),
    callRef(args.callId).set({ ...args.call, updatedAt: now }, { merge: true }),
    adminDb
      .collection("Channels")
      .doc(args.channelId)
      .update({ lastMessageId: args.callId, lastMessageAt: args.call.startedAt })
      .catch(() => {}),
  ]);
}

export function buildCallMessageData(call: CallRecord) {
  return {
    id: call.callId,
    channelId: call.channelId,
    senderId: call.callerId,
    senderName: call.callerName,
    senderRole: call.callerRole || null,
    type: "CALL" as const,
    content: call.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
    version: "v1" as const,
    isEncrypted: false,
    createdAt: call.startedAt,
    callDetails: call,
  };
}
