// src/app/api/message/delete/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  DeleteMessageRequest,
  DeleteMessageResponse,
} from "@/features/messaging/types/messaging.api.types";
// Import the branded types here
import {
  ChannelID,
  FamilyID,
  MessageID,
  UID,
} from "@/features/messaging/types/messaging.types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    if (!session?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as DeleteMessageRequest;

    if (!body.channelId || !body.messageId) {
      return NextResponse.json(
        { error: "Missing channel or message ID" },
        { status: 400 }
      );
    }

    // 🔥 FIX: Cast strings to Branded Types
    await messageService.deleteMessage({
      familyId: session.familyId as FamilyID,
      channelId: body.channelId as ChannelID,
      messageId: body.messageId as MessageID,
      requesterId: session.uid as UID,
    });

    const response: DeleteMessageResponse = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Delete Message API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
