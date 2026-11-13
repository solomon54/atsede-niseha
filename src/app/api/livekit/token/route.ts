// src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
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

    // 4. Generate token using the official LiveKit SDK
    //    (jose-signed tokens include typ:"JWT" which LiveKit Cloud rejects)
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: session.uid,
      name: displayName,
      ttl: "2h",
      metadata: JSON.stringify({ role: session.role, maxParticipants }),
    });

    at.addGrant({
      room: channelId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

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

