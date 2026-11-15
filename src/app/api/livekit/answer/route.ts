// src/app/api/livekit/answer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);

    if (!body || typeof body.channelId !== "string" || !body.channelId.trim()) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
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

      if (!latestCallSnap.empty) {
        callId = latestCallSnap.docs[0].id;
      }
    }

    const now = Date.now();

    if (callId) {
      const msgRef = adminDb
        .collection("Channels")
        .doc(channelId)
        .collection("Messages")
        .doc(callId);

      const msgSnap = await msgRef.get();
      if (msgSnap.exists) {
        const existingData = msgSnap.data() || {};
        const callDetails = existingData.callDetails || {};
        const updatedCallDetails = {
          ...callDetails,
          status: "answered",
          answeredAt: callDetails.answeredAt || now,
        };

        await msgRef.update({
          callDetails: updatedCallDetails,
          editedAt: now,
        });

        await adminDb.collection("Calls").doc(callId).set({
          ...updatedCallDetails,
          updatedAt: now,
        }, { merge: true });

        try {
          await pusherServer.trigger(`private-chat-${channelId}`, "message-updated", {
            id: callId,
            channelId,
            callDetails: updatedCallDetails,
            editedAt: now,
          });
        } catch {}
      }
    }

    try {
      await pusherServer.trigger(`private-chat-${channelId}`, "call-answered", {
        channelId,
        callId,
        answeredBy: session.uid,
      });
    } catch (e) {
      console.warn("[POST /api/livekit/answer] Pusher trigger failed:", e);
    }

    return NextResponse.json({ success: true, callId });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

