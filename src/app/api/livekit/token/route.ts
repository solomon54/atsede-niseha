// src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret_atsede_livekit_key_32chars_min";
const LIVEKIT_URL =
  process.env.LIVEKIT_URL ||
  process.env.NEXT_PUBLIC_LIVEKIT_URL ||
  "wss://atsede-niseha.livekit.cloud";

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

    // 1. Explicit Membership Check
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

    // 2. Fetch Channel Document to enforce participant quotas
    const channelDoc = await adminDb.collection("Channels").doc(channelId).get();
    if (!channelDoc.exists) {
      return NextResponse.json(
        { error: "ክፍሉ አልተገኘም (Channel not found)" },
        { status: 404 }
      );
    }

    const channelData = channelDoc.data() || {};
    const channelType = channelData.type || "DIRECT"; // "DIRECT" or "COMMON_HOUSE"
    const maxParticipants = channelType === "DIRECT" ? 2 : 8;

    // 3. Resolve participant display name
    const profileColl = session.role === "FATHER" ? "Fathers" : "Students";
    const profileSnap = await adminDb
      .collection(profileColl)
      .doc(session.uid)
      .get();
    const profileData = profileSnap.data() || {};
    const displayName =
      profileData.christianName ||
      profileData.fullName ||
      profileData.secularName ||
      (session.role === "FATHER" ? "የንስሐ አባት" : "የንስሐ ልጅ");

    // 4. Generate LiveKit Access Token (HS256 signed JWT)
    const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 2 * 60 * 60; // 2 hours TTL (matches PLAN.md)

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
        maxParticipants,
      }),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(LIVEKIT_API_KEY)
      .setSubject(session.uid)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(exp)
      .sign(secret);

    return NextResponse.json({
      success: true,
      token,
      url: LIVEKIT_URL,
      roomName: channelId,
      maxParticipants,
      participantName: displayName,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/livekit/token]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

