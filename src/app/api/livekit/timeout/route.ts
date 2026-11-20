// src/app/api/livekit/timeout/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  assertCallActorCanAct,
  getCallRecord,
  isTerminalCallStatus,
  markRingingTimedOut,
  persistCallMessageUpdate,
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

    if (isTerminalCallStatus(existing.status) || existing.status === "answered") {
      return NextResponse.json({
        success: true,
        callId,
        status: existing.status,
        terminal: true,
      });
    }

    assertCallActorCanAct({
      call: existing,
      actorUid: session.uid,
      action: "timeout",
    });

    const now = Date.now();
    const result = await markRingingTimedOut({ callId, channelId, now });
    const call = result.call || (await getCallRecord(callId));
    if (!call || call.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const lifecycleCall = {
      ...call,
      status: result.status,
      endedAt: call.endedAt || (result.status === "missed" ? now : null),
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

    if (result.transitioned || result.status === "missed") {
      const payload = { channelId, callId, status: result.status };
      const events = await Promise.all([
        triggerCallEvent({ channelId, participantUids, event: "call-missed", payload }),
        triggerCallEvent({
          channelId,
          participantUids,
          event: "call-ended",
          payload: { ...payload, endedBy: session.uid },
        }),
      ]);
      if (events.some((event) => event.failed > 0)) {
        console.warn("[POST /api/livekit/timeout] partial terminal fanout", events);
      }
    }

    return NextResponse.json({ success: true, callId, status: result.status });
  } catch (err: any) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err?.status === 403) {
      return NextResponse.json({ error: "Forbidden", reason: err.reason }, { status: 403 });
    }
    console.error("[POST /api/livekit/timeout]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
