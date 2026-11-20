// src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { getCallRecord } from "@/services/call-state";
import {
  getChannelParticipantSummaries,
  getUserSummary,
} from "@/services/push";
import {
  isCallParticipant,
  isJoinableCallStatus,
} from "@/shared/domain/calling/callLifecycle";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "devsecretnoseha";
const LIVEKIT_URL =
  process.env.LIVEKIT_URL ||
  process.env.NEXT_PUBLIC_LIVEKIT_URL ||
  "wss://atsede-niseha-qj6cj10z.livekit.cloud";

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
    const callId = typeof body.callId === "string" ? body.callId.trim() : "";

    // 1. Explicit membership check
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

    // 2. When a call is supplied, require participant-level ownership and an
    // authoritative joinable state. Membership alone is not a call invitation.
    if (callId) {
      const call = await getCallRecord(callId);
      if (!call || call.channelId !== channelId) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      if (!isCallParticipant(call, session.uid)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!isJoinableCallStatus(call.status)) {
        return NextResponse.json({ error: "Call has ended" }, { status: 409 });
      }
    }

    // 3. Fetch channel document to enforce participant quotas
    const channelDoc = await adminDb.collection("Channels").doc(channelId).get();
    if (!channelDoc.exists) {
      return NextResponse.json(
        { error: "ክፍሉ አልተገኘም (Channel not found)" },
        { status: 404 }
      );
    }

    const channelData = channelDoc.data() || {};
    const channelType = channelData.type || "DIRECT";

    // Direct calls remain 1:1 by product rule; common-house calls have no app-imposed cap.
    const maxParticipants = channelType === "DIRECT" ? 2 : 100;

    // 4. Resolve identities from authoritative profiles (including Governors).
    const [self, participants] = await Promise.all([
      getUserSummary(session.uid),
      getChannelParticipantSummaries(channelId, session.uid),
    ]);
    const displayName = self.displayName;

    // 5. Generate LiveKit-compatible JWT using jose.
    // Header must be { alg: "HS256" } ONLY — no "typ" field.
    const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
    const now = Math.floor(Date.now() / 1000);

    const token = await new jose.SignJWT({
      video: {
        room: channelId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      name: displayName,
      metadata: JSON.stringify({
        role: session.role,
        uid: session.uid,
        callId: callId || null,
        maxParticipants,
      }),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(LIVEKIT_API_KEY)
      .setSubject(session.uid)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 2 * 60 * 60)
      .sign(secret);

    return NextResponse.json({
      success: true,
      token,
      url: LIVEKIT_URL,
      roomName: channelId,
      callId: callId || null,
      maxParticipants,
      participantName: displayName,
      participantPhotoUrl: self.photoUrl || null,
      participantRole: self.role,
      participants,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/token]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
