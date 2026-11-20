// src/app/api/livekit/ring/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer, triggerCallEvent } from "@/services/pusher";
import {
  getChannelParticipantSummaries,
  getChannelRecipientUids,
  getUserSummary,
  sendPushToUsers,
} from "@/services/push";
import { buildIncomingCallNotificationData } from "@/shared/domain/calling/notificationPayload";
import {
  CallRecord,
  buildCallMessageData,
  claimUserForCall,
  getCallRecord,
  isRingingStale,
  reconcileCallAsFailed,
  releaseUserCallStateIfMatch,
  upsertCallArtifacts,
} from "@/services/call-state";

/**
 * Authoritative ring:
 * - Enforces per-user busy rule (race-safe claims, stale-ringing aware)
 * - Creates a call in ringing state only when at least one eligible recipient can be rung
 * - Fans out incoming-call (Pusher + best-effort push) only to non-busy recipients
 * - Returns strongest available reachability info without claiming delivery
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);

    if (!body || typeof body.channelId !== "string" || !body.channelId.trim()) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const channelId = body.channelId.trim();
    const requestedCallId =
      typeof body.callId === "string" && body.callId.trim() ? body.callId.trim() : null;
    const callId =
      requestedCallId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Membership/authz
    const memberSnap = await adminDb
      .collection("ChannelMembers")
      .where("channelId", "==", channelId)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent: if this callId already exists, return its authoritative state.
    const existing = await getCallRecord(callId);
    if (existing) {
      if (existing.callerId !== session.uid || existing.channelId !== channelId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const stale = isRingingStale(existing.status, existing.startedAt, now);
      const status = stale ? "missed" : existing.status;
      return NextResponse.json({
        success: status === "ringing",
        redundant: true,
        callId: existing.callId,
        channelId: existing.channelId,
        status,
        joinable: status === "ringing" || status === "answered",
        notified: (existing.notifiedRecipientIds || []).length,
        busy: (existing.busyRecipientIds || []).length,
        reachability: {
          authoritative: status === "ringing",
          recipients: (existing.notifiedRecipientIds || []).length,
        },
      });
    }

    const channelDoc = await adminDb.collection("Channels").doc(channelId).get();
    const channelData = channelDoc.data() || {};
    const isGroup = (channelData.type || "DIRECT") === "COMMON_HOUSE";

    const [callerSummary, participants] = await Promise.all([
      getUserSummary(session.uid),
      getChannelParticipantSummaries(channelId, session.uid),
    ]);
    const callerName = callerSummary.displayName;
    const callerPhotoUrl = callerSummary.photoUrl || "";
    const callerRole = callerSummary.role;

    // Caller busy check/claim (race-safe). Caller cannot place/receive conflicting call.
    const callerClaim = await claimUserForCall({
      uid: session.uid,
      callId,
      channelId,
      role: "caller",
      status: "ringing",
      startedAt: now,
      now,
    });
    if (!callerClaim.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "busy",
          reason: "caller_busy",
          callId: callerClaim.current?.activeCallId || null,
          status: "busy",
        },
        { status: 409 }
      );
    }

    const acquiredClaimUids = new Set<string>([session.uid]);
    const notifiedRecipientIds: string[] = [];
    const busyRecipientIds: string[] = [];

    try {
      // Resolve recipients and evaluate busy per user (race-safe per-recipient claims)
      const recipients = await getChannelRecipientUids(channelId, session.uid);

      for (const uid of recipients) {
        const claim = await claimUserForCall({
          uid,
          callId,
          channelId,
          role: "callee",
          status: "ringing",
          startedAt: now,
          now,
        });
        if (claim.ok) {
          notifiedRecipientIds.push(uid);
          acquiredClaimUids.add(uid);
        } else {
          busyRecipientIds.push(uid);
        }
      }

      // If no eligible recipients can be rung, do not leave a ringing call.
      if (notifiedRecipientIds.length === 0) {
        await releaseUserCallStateIfMatch({ uid: session.uid, callId, now }).catch(() => {});
        const outcome = recipients.length === 0 ? "no_recipients" : "all_busy";
        return NextResponse.json(
          {
            success: false,
            error: outcome === "all_busy" ? "busy" : "unreachable",
            reason: outcome,
            status: outcome === "all_busy" ? "busy" : "failed",
            callId,
            channelId,
            notified: 0,
            busy: busyRecipientIds.length,
            reachability: {
              authoritative: false,
              recipientReached: false,
              eligibleRecipients: 0,
              totalRecipients: recipients.length,
              message:
                outcome === "all_busy"
                  ? "Recipients are busy"
                  : "No eligible recipients to reach",
            },
          },
          { status: outcome === "all_busy" ? 409 : 422 }
        );
      }

      const call: CallRecord = {
        callId,
        channelId,
        callerId: session.uid,
        callerName,
        callerPhotoUrl,
        callerRole,
        status: "ringing",
        startedAt: now,
        answeredAt: null,
        endedAt: null,
        durationSec: 0,
        isGroup,
        notifiedRecipientIds,
        busyRecipientIds,
        updatedAt: now,
      };

      const callMessageData = buildCallMessageData(call);

      // Critical establishment step: if artifacts cannot be persisted, reconcile and do not leave
      // acquired participant claims or an active/joinable call behind for this callId.
      try {
        await upsertCallArtifacts({ callId, channelId, call, messageData: callMessageData, now });
      } catch (persistErr) {
        console.error("[LiveKit Ring] Artifact persistence failed, reconciling call", callId, persistErr);
        const reconciliation = await reconcileCallAsFailed({
          callId,
          channelId,
          participantUids: [...acquiredClaimUids],
          status: "cancelled",
          reason: "artifact_persist_failed",
          now,
        });
        return NextResponse.json(
          {
            success: false,
            error: "call_setup_failed",
            status: "cancelled",
            callId,
            channelId,
            joinable: false,
            reconciliation,
          },
          { status: 500 }
        );
      }

      // Best-effort push/fanout only after a joinable authoritative record exists.
      // Partial fanout does not make the call unjoinable by itself; claims/record remain consistent.
      let pushSent = 0;
      let pushFailed = 0;
      try {
        const pushRes = await sendPushToUsers(notifiedRecipientIds, {
          title: isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
          body: `${callerName} ጥሪ አድርገዋል`,
          channelId: "atsede-call",
          sound: "call_ring",
          urgent: true,
          tag: callId,
          imageUrl: callerPhotoUrl || undefined,
          data: buildIncomingCallNotificationData({
            callId,
            channelId,
            callerId: session.uid,
            callerName,
            callerPhotoUrl,
            callerRole,
            isGroup,
            startedAt: now,
          }) as Record<string, string>,
        });
        pushSent = pushRes?.sent || 0;
        pushFailed = pushRes?.failed || 0;
      } catch (e) {
        console.warn("[LiveKit Ring] Push fanout error:", e);
        pushFailed = notifiedRecipientIds.length;
      }

      let pusherChannelOk = false;
      let pusherUserOk = 0;
      try {
        await pusherServer.trigger(`private-chat-${channelId}`, "incoming-call", {
          callId,
          channelId,
          callerId: session.uid,
          callerName,
          callerPhotoUrl,
          callerRole,
          isGroup,
          startedAt: now,
        });
        pusherChannelOk = true;

        const results = await Promise.all(
          notifiedRecipientIds.map((recipUid) =>
            pusherServer
              .trigger(`private-user-${recipUid}`, "incoming-call", {
                callId,
                channelId,
                callerId: session.uid,
                callerName,
                callerPhotoUrl,
                callerRole,
                isGroup,
                startedAt: now,
              })
              .then(() => true)
              .catch(() => false)
          )
        );
        pusherUserOk = results.filter(Boolean).length;

        await pusherServer
          .trigger(`private-chat-${channelId}`, "new-message", callMessageData)
          .catch(() => {});
      } catch (pusherErr) {
        console.warn("[LiveKit Ring] Pusher alert error:", pusherErr);
      }

      // Strongest available info: we know authoritative ringing + fanout attempts/results we observed.
      // Do NOT claim device delivery/recipient reach beyond this.
      const reachability = {
        authoritative: true,
        recipientReached: undefined as boolean | undefined, // unknown from server alone
        eligibleRecipients: notifiedRecipientIds.length,
        totalRecipients: recipients.length,
        busyRecipients: busyRecipientIds.length,
        pusher: { channelTriggered: pusherChannelOk, userChannelsTriggered: pusherUserOk },
        push: {
          attempted: notifiedRecipientIds.length,
          sent: pushSent,
          failed: pushFailed,
        },
      };

      return NextResponse.json({
        success: true,
        callId,
        channelId,
        status: "ringing",
        joinable: true,
        notified: notifiedRecipientIds.length,
        busy: busyRecipientIds.length,
        participants,
        reachability,
      });
    } catch (setupErr) {
      console.error("[LiveKit Ring] Ring setup failed after claim acquisition, reconciling", callId, setupErr);
      const reconciliation = await reconcileCallAsFailed({
        callId,
        channelId,
        participantUids: [...acquiredClaimUids],
        status: "cancelled",
        reason: "ring_setup_failed",
        now,
      });
      return NextResponse.json(
        {
          success: false,
          error: "call_setup_failed",
          status: "cancelled",
          callId,
          channelId,
          joinable: false,
          reconciliation,
        },
        { status: 500 }
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/ring]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
