// src/app/api/message/react/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  ChannelID,
  FamilyID,
  MessageID,
  UID,
} from "@/features/messaging/types/messaging.types";
import { pusherServer } from "@/services/pusher";

const DIGNIFIED_REACTIONS = new Set(["🙏", "✝️", "🕊️", "❤️", "🕯️", "✨"]);

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    if (!session?.uid || !session?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, messageId, emoji } = body;

    if (!channelId || !messageId || !emoji) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!DIGNIFIED_REACTIONS.has(emoji)) {
      return NextResponse.json(
        { error: "Invalid reaction symbol" },
        { status: 400 }
      );
    }

    const reactions = await messageService.toggleReaction({
      familyId: session.familyId as FamilyID,
      channelId: channelId as ChannelID,
      messageId: messageId as MessageID,
      userId: session.uid as UID,
      emoji,
    });

    try {
      await pusherServer.trigger(
        `private-chat-${channelId}`,
        "message-reaction",
        { messageId, reactions }
      );
    } catch (pushErr) {
      console.warn("[Pusher Reaction Trigger Warning]:", pushErr);
    }

    return NextResponse.json({ success: true, reactions });
  } catch (error: any) {
    console.error("[Reaction API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

