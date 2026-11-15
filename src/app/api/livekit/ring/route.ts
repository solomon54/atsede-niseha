// src/app/api/livekit/ring/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";
import {
  getChannelRecipientUids,
  getUserSummary,
  sendPushToUsers,
} from "@/services/push";
import { CallDetails } from "@/features/messaging/types/messaging.types";

/**
 * Ring the other members of a channel.
 *
 * 1. Creates a call record in `Channels/${channelId}/Messages/${callId}` and `Calls/${callId}`
 * 2. High-priority FCM push with custom ringtone to wake Android lock screen
 * 3. Instant in-app Pusher alert with rich caller info (photo, role, name, callId)
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

    // 1. Check channel membership
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

    // 2. Fetch Channel Document to determine type & isGroup
    const channelDoc = await adminDb.collection("Channels").doc(channelId).get();
    const channelData = channelDoc.data() || {};
    const channelType = channelData.type || "DIRECT";
    const isGroup = channelType === "COMMON_HOUSE";

    // 3. Resolve caller info & callId
    const callerSummary = await getUserSummary(session.uid);
    const callerName = callerSummary.displayName;
    const callerPhotoUrl = callerSummary.photoUrl || "";
    const callerRole = callerSummary.role;

    const callId =
      typeof body.callId === "string" && body.callId.trim()
        ? body.callId.trim()
        : `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const now = Date.now();

    const callDetails: CallDetails = {
      callId,
      channelId,
      callerId: session.uid,
      callerName,
      callerPhotoUrl,
      callerRole,
      status: "ringing",
      startedAt: now,
      answeredAt: null,
      endedAt: null,
      durationSec: 0,
      isGroup,
    };

    // 4. Save call message to Channels/${channelId}/Messages/${callId}
    const messageDocRef = adminDb
      .collection("Channels")
      .doc(channelId)
      .collection("Messages")
      .doc(callId);

    const callMessageData = {
      id: callId,
      channelId,
      senderId: session.uid,
      senderName: callerName,
      senderRole: callerRole,
      type: "CALL",
      content: isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
      version: "v1",
      isEncrypted: false,
      createdAt: now,
      callDetails,
    };

    await messageDocRef.set(callMessageData, { merge: true });

    // Also persist in global Calls collection for fast state lookups
    await adminDb.collection("Calls").doc(callId).set({
      ...callDetails,
      updatedAt: now,
    }, { merge: true });

    // Update Channel lastMessageAt
    await adminDb.collection("Channels").doc(channelId).update({
      lastMessageId: callId,
      lastMessageAt: now,
    }).catch(() => {});

    // 5. Notify recipients via Push & Pusher
    const recipients = await getChannelRecipientUids(channelId, session.uid);

    if (recipients.length > 0) {
      await sendPushToUsers(recipients, {
        title: isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
        body: `${callerName} ጥሪ አድርገዋል`,
        channelId: "atsede-call",
        sound: "call_ring",
        urgent: true,
        tag: callId,
        data: {
          type: "incoming_call",
          callId,
          channelId,
          callerId: session.uid,
          callerName,
          callerPhotoUrl: callerPhotoUrl || "",
          callerRole,
          isGroup: isGroup ? "true" : "false",
        },
      });
    }

    // 6. Broadcast Pusher events
    try {
      // Broadcast incoming call event on channel
      await pusherServer.trigger(`private-chat-${channelId}`, "incoming-call", {
        callId,
        channelId,
        callerId: session.uid,
        callerName,
        callerPhotoUrl,
        callerRole,
        isGroup,
        startedAt: now,
      });

      // Also trigger on each recipient's private user channel for instant delivery anywhere in the app
      await Promise.all(
        recipients.map((recipUid) =>
          pusherServer
            .trigger(`private-user-${recipUid}`, "incoming-call", {
              callId,
              channelId,
              callerId: session.uid,
              callerName,
              callerPhotoUrl,
              callerRole,
              isGroup,
              startedAt: now,
            })
            .catch(() => {})
        )
      );

      // Also trigger new-message event so the chat stream renders the call bubble in real time
      await pusherServer.trigger(`private-chat-${channelId}`, "new-message", callMessageData);
    } catch (pusherErr) {
      console.warn("[LiveKit Ring] Pusher alert error:", pusherErr);
    }

    return NextResponse.json({
      success: true,
      callId,
      channelId,
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
