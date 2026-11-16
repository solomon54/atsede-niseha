// src/app/api/livekit/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { getCallRecord, isRingingStale } from "@/services/call-state";

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
      if (memberSnap.empty && call.callerId !== session.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (call.callerId !== session.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stale = isRingingStale(call.status, call.startedAt);
    const effectiveStatus = stale ? "missed" : call.status;
    const joinable = effectiveStatus === "ringing" || effectiveStatus === "answered";

    return NextResponse.json(
      {
        callId: call.callId,
        channelId: call.channelId,
        status: effectiveStatus,
        rawStatus: call.status,
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
