// src/app/api/livekit/status/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  getCallRecord,
  isRingingStale,
  markRingingTimedOut,
  persistCallMessageUpdate,
} from "@/services/call-state";
import { adminDb } from "@/services/firebase/admin";
import { triggerCallEvent } from "@/services/pusher";
import {
  getCallParticipantUids,
  isCallParticipant,
} from "@/shared/domain/calling/callLifecycle";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const callId = (searchParams.get("callId") || "").trim();
    const channelId = (searchParams.get("channelId") || "").trim();

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    let call = await getCallRecord(callId);

    if (!call && channelId) {
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
      const msgSnap = await adminDb
        .collection("Channels")
        .doc(channelId)
        .collection("Messages")
        .doc(callId)
        .get();
      if (msgSnap.exists) {
        const data = msgSnap.data() || {};
        if (data.callDetails) {
          call = { ...data.callDetails, callId } as any;
        }
      }
    }

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const authChannelId = channelId || call.channelId;
    if (authChannelId) {
      const memberSnap = await adminDb
        .collection("ChannelMembers")
        .where("channelId", "==", authChannelId)
        .where("userId", "==", session.uid)
        .where("isActive", "==", true)
        .limit(1)
        .get();
      if (memberSnap.empty || !isCallParticipant(call, session.uid)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isCallParticipant(call, session.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawStatus = call.status;
    const stale = isRingingStale(rawStatus, call.startedAt);

    // A stale ringing record is reconciled on read. Without this persisted
    // transition a missed call remains "ringing" in the chat ledger forever
    // whenever the timeout event was missed. Only the chat message artifact is
    // updated here; no incoming-call notification behavior is changed.
    if (stale) {
      const now = Date.now();
      const targetChannelId = call.channelId || authChannelId;
      const timedOut = await markRingingTimedOut({
        callId,
        channelId: targetChannelId,
        now,
      });
      console.info("[LiveKit Status] stale ringing evaluation", {
        callId,
        channelId: targetChannelId,
        actorUid: session.uid,
        transitioned: timedOut.transitioned,
        effectiveStatus: timedOut.call?.status || call.status,
      });
      if (timedOut.transitioned && timedOut.call) {
        call = timedOut.call;
        const patch = await persistCallMessageUpdate({
          channelId: targetChannelId,
          call,
          now,
        });
        const participantUids = getCallParticipantUids(call);
        await triggerCallEvent({
          channelId: targetChannelId,
          participantUids,
          event: "message-updated",
          payload: patch,
        });
        await triggerCallEvent({
          channelId: targetChannelId,
          participantUids,
          event: "call-ended",
          payload: {
            channelId: targetChannelId,
            callId,
            status: call.status,
            reason: "timeout",
          },
        });
      } else if (timedOut.call) {
        call = timedOut.call;
      }
    }

    const effectiveStatus = call.status;
    const joinable = effectiveStatus === "ringing" || effectiveStatus === "answered";

    return NextResponse.json(
      {
        callId: call.callId,
        channelId: call.channelId,
        status: effectiveStatus,
        rawStatus,
        stale,
        joinable,
        callerId: call.callerId,
        callerName: call.callerName || null,
        callerPhotoUrl: call.callerPhotoUrl || null,
        callerRole: call.callerRole || null,
        isGroup: !!call.isGroup,
        startedAt: call.startedAt || null,
        answeredAt: call.answeredAt || null,
        endedAt: call.endedAt || null,
        durationSec: typeof call.durationSec === "number" ? call.durationSec : null,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/livekit/status]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
