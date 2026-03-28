// src/app/api/message/auth/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    // 1. Parse Pusher's form-data
    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;

    if (!socketId || !channelName) {
      return new Response("Invalid request", { status: 400 });
    }

    // 2. Extract Channel ID from naming convention: "private-chat-CHANNEL_ID"
    const targetChannelId = channelName.replace("private-chat-", "");

    // 3. RESILIENT CHECK: Verify active membership in PascalCase collection
    const memberSnap = await adminDb
      .collection("ChannelMembers")
      .where("channelId", "==", targetChannelId)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true) // Ensure they haven't been removed
      .limit(1)
      .get();

    if (memberSnap.empty) {
      console.warn(
        `[Pusher Auth] Unauthorized attempt: User ${session.uid} -> Channel ${targetChannelId}`
      );
      return new Response("Forbidden: No active membership found.", {
        status: 403,
      });
    }

    // 4. Authorize via Pusher Server SDK
    const authResponse = pusherServer.authorizeChannel(socketId, channelName);

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth Error]:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
