// src/app/api/livekit/decline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";
import { getCallRecord, transitionCallToTerminal } from "@/services/call-state";

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
    const result = await transitionCallToTerminal({
      callId,
      channelId,
      actorUid: session.uid,
      to: "declined",
      now,
    });
    const call = result.call || (await getCallRecord(callId));
    if (!call || call.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const msgRef = adminDb.collection("Channels").doc(channelId).collection("Messages").doc(callId);
    const callDetails = {
      callId: call.callId,
      channelId: call.channelId,
      callerId: call.callerId,
      callerName: call.callerName,
      callerPhotoUrl: call.callerPhotoUrl || null,
      callerRole: call.callerRole || null,
      status: result.status,
      startedAt: call.startedAt,
      answeredAt: call.answeredAt || null,
      endedAt: call.endedAt || now,
      durationSec: typeof call.durationSec === "number" ? call.durationSec : 0,
      isGroup: !!call.isGroup,
    };
    await msgRef.set({ callDetails, editedAt: now }, { merge: true });

    try {
      await pusherServer.trigger(`private-chat-${channelId}`, "message-updated", {
        id: callId,
        channelId,
        callDetails,
        editedAt: now,
      });
    } catch {}

    if (result.transitioned || result.status === "declined") {
      try {
        await pusherServer.trigger(`private-chat-${channelId}`, "call-declined", {
          channelId,
          callId,
          declinerUid: session.uid,
          status: result.status,
        });
      } catch (e) {
        console.warn("[POST /api/livekit/decline] Pusher trigger failed:", e);
      }
    }

    return NextResponse.json({ success: true, callId, status: result.status });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/decline]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
