// src/app/api/livekit/decline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";
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

    try {
      await pusherServer.trigger(`private-chat-${channelId}`, "call-declined", {
        channelId,
        declinerUid: session.uid,
      });
    } catch (e) {
      console.warn("[POST /api/livekit/decline] Pusher trigger failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

