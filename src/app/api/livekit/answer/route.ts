// src/app/api/livekit/answer/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  assertCallActorCanAct,
  getCallRecord,
  isTerminalCallStatus,
  persistCallMessageUpdate,
  transitionCallToAnswered,
} from "@/services/call-state";
import { adminDb } from "@/services/firebase/admin";
import { triggerCallEvent } from "@/services/pusher";
import { getCallParticipantUids } from "@/shared/domain/calling/callLifecycle";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);

    if (!body || typeof body.channelId !== "string" || !body.channelId.trim()) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const channelId = body.channelId.trim();
    let callId = typeof body.callId === "string" ? body.callId.trim() : null;

    if (!callId) {
      const latestCallSnap = await adminDb
        .collection("Channels")
        .doc(channelId)
        .collection("Messages")
        .where("type", "==", "CALL")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!latestCallSnap.empty) callId = latestCallSnap.docs[0].id;
    }

    if (!callId) {
      return NextResponse.json({ error: "callId not found" }, { status: 404 });
    }

    const existing = await getCallRecord(callId);
    if (!existing || existing.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (isTerminalCallStatus(existing.status)) {
      return NextResponse.json({
        success: true,
        callId,
        status: existing.status,
        terminal: true,
      });
    }

    // Membership is checked by middleware/auth; this enforces call ownership.
    assertCallActorCanAct({
      call: existing,
      actorUid: session.uid,
      action: "answer",
    });

    const now = Date.now();
    const result = await transitionCallToAnswered({ callId, channelId, actorUid: session.uid, now });
    const call = result.call || (await getCallRecord(callId));

    if (!call || call.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const lifecycleCall = {
      ...call,
      status: result.status,
      answeredAt: call.answeredAt || (result.status === "answered" ? now : null),
      updatedAt: now,
    };
    const messagePatch = await persistCallMessageUpdate({
      channelId,
      call: lifecycleCall,
      now,
    });
    const participantUids = getCallParticipantUids(lifecycleCall);

    await triggerCallEvent({
      channelId,
      participantUids,
      event: "message-updated",
      payload: messagePatch,
    });

    if (result.transitioned || result.status === "answered") {
      const payload = {
        channelId,
        callId,
        answeredBy: session.uid,
        status: result.status,
      };
      const fanout = await triggerCallEvent({
        channelId,
        participantUids,
        event: "call-answered",
        payload,
      });
      if (fanout.failed > 0) {
        console.warn("[POST /api/livekit/answer] partial call-answered fanout", fanout);
      }
    }

    const participantClaims = (result as any).participantClaims;
    if (participantClaims && participantClaims.ok === false) {
      console.warn("[POST /api/livekit/answer] Call answered but participant claim sync incomplete", {
        callId,
        failedUids: participantClaims.failedUids,
      });
    }

    return NextResponse.json({
      success: true,
      callId,
      status: result.status,
      answeredAt: lifecycleCall.answeredAt,
      participantClaims: participantClaims || null,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err?.status === 403) {
      return NextResponse.json({ error: "Forbidden", reason: err.reason }, { status: 403 });
    }
    console.error("[POST /api/livekit/answer]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
