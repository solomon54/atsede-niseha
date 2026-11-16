// src/app/api/livekit/answer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";
import { getCallRecord, transitionCallToAnswered } from "@/services/call-state";

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

    // Must be an active channel member to answer
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
    const result = await transitionCallToAnswered({ callId, channelId, actorUid: session.uid, now });
    const call = result.call || (await getCallRecord(callId));

    if (!call || call.channelId !== channelId) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Persist message callDetails to reflect authoritative state
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
      answeredAt: call.answeredAt || (result.status === "answered" ? now : null),
      endedAt: call.endedAt || null,
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

    if (result.transitioned || result.status === "answered") {
      try {
        await pusherServer.trigger(`private-chat-${channelId}`, "call-answered", {
          channelId,
          callId,
          answeredBy: session.uid,
        });
      } catch (e) {
        console.warn("[POST /api/livekit/answer] Pusher trigger failed:", e);
      }
    }

    // Do not treat a successful call-status transition as proof that all participant
    // claim markers were updated; report claim-sync outcome explicitly.
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
      participantClaims: participantClaims || null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/answer]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
