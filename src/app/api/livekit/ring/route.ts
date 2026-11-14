// src/app/api/livekit/ring/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";
import {
  getChannelRecipientUids,
  getDisplayName,
  sendPushToUsers,
} from "@/services/push";

/**
 * Ring the other members of a channel.
 *
 * LiveKit has no built-in "incoming call" signal, so the caller's device calls
 * this after obtaining a token. The push is high priority so Android shows a
 * heads-up banner and the app can join with one tap.
 */
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

    // Only active members may ring a room.
    const memberSnap = await adminDb
      .collection("ChannelMembers")
      .where("channelId", "==", channelId)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json(
        { error: "ፈቃድ የለዎትም (Access Denied to this room)" },
        { status: 403 }
      );
    }

    const recipients = await getChannelRecipientUids(channelId, session.uid);
    if (recipients.length === 0) {
      return NextResponse.json({ success: true, notified: 0 });
    }

    const callerName = await getDisplayName(session.uid);

    await sendPushToUsers(recipients, {
      title: "የቪዲዮ ጥሪ",
      body: `${callerName} ጥሪ አድርገዋል`,
      channelId: "atsede-urgent",
      urgent: true,
      data: {
        type: "incoming_call",
        channelId,
        callerName,
      },
    });

    // Also trigger instant in-app web socket alert via Pusher
    try {
      await pusherServer.trigger(`private-chat-${channelId}`, "incoming-call", {
        channelId,
        callerName,
        callerUid: session.uid,
      });
    } catch (pusherErr) {
      console.warn("[LiveKit Ring] Pusher alert error:", pusherErr);
    }

    return NextResponse.json({
      success: true,
      notified: recipients.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/ring]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
