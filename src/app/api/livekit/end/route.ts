// src/app/api/livekit/end/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  assertCallActorCanAct,
  getCallRecord,
  isTerminalCallStatus,
  persistCallMessageUpdate,
  transitionCallToTerminal,
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

    const isCaller = session.uid === existing.callerId;
    assertCallActorCanAct({
      call: existing,
      actorUid: session.uid,
      action: existing.status === "ringing" ? (isCaller ? "cancel" : "decline") : "end",
    });

    const now = Date.now();
    // Callers may cancel while ringing; recipients who end while ringing decline.
    // Answered calls transition to ended.
    const requested =
      existing.status === "ringing" && body.status === "missed"
        ? "missed"
        : existing.status === "ringing" && !isCaller
        ? "declined"
        : existing.status === "ringing" && (body.status === "cancelled" || isCaller)
        ? "cancelled"
        : "ended";
    const result = await transitionCallToTerminal({
      callId,
      channelId,
      actorUid: session.uid,
      to: requested,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
      now,
    });
    console.info("[LiveKit End] call termination processed", {
      callId,
      channelId,
      actorUid: session.uid,
      requested,
      status: result.status,
      transitioned: result.transitioned,
    });
    const call = result.call || (await getCallRecord(callId));
    if (!call || call.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const lifecycleCall = {
      ...call,
      status: result.status,
      endedAt: call.endedAt || now,
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

    const fanout = await triggerCallEvent({
      channelId,
      participantUids,
      event: "call-ended",
      payload: {
        channelId,
        callId,
        endedBy: session.uid,
        status: result.status,
      },
    });
    if (fanout.failed > 0) {
      console.warn("[POST /api/livekit/end] partial call-ended fanout", fanout);
    }

    return NextResponse.json({ success: true, callId, status: result.status });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const error = err as { status?: unknown; reason?: unknown } | null;
    if (error?.status === 403) {
      return NextResponse.json(
        { error: "Forbidden", reason: typeof error.reason === "string" ? error.reason : undefined },
        { status: 403 }
      );
    }
    console.error("[POST /api/livekit/end]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
