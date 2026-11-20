// src/app/api/livekit/end/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  getCallRecord,
  persistCallMessageUpdate,
  transitionCallToTerminal,
} from "@/services/call-state";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";

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

    const now = Date.now();
    const requested = body.status === "missed" ? "missed" : "ended";
    const result = await transitionCallToTerminal({
      callId,
      channelId,
      actorUid: session.uid,
      to: requested,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
      now,
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

    try {
      await pusherServer.trigger(
        `private-chat-${channelId}`,
        "message-updated",
        messagePatch
      );
    } catch {}

    // Always emit terminal event for this callId so UIs/notifications can dismiss.
    try {
      await pusherServer.trigger(`private-chat-${channelId}`, "call-ended", {
        channelId,
        callId,
        endedBy: session.uid,
        status: result.status,
      });
    } catch (e) {
      console.warn("[POST /api/livekit/end] Pusher trigger failed:", e);
    }

    return NextResponse.json({ success: true, callId, status: result.status });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/end]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
