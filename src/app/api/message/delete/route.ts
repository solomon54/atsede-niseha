// src/app/api/message/delete/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  DeleteMessageRequest,
  DeleteMessageResponse,
} from "@/features/messaging/types/messaging.api.types";
import {
  ChannelID,
  FamilyID,
  MessageID,
  UID,
} from "@/features/messaging/types/messaging.types";
import { pusherServer } from "@/services/pusher";

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = (await req.json()) as DeleteMessageRequest;

    if (!body.channelId || !body.messageId) {
      return NextResponse.json(
        { success: false, error: "channelId and messageId are required" },
        { status: 400 }
      );
    }

    await messageService.deleteMessage({
      familyId: session.familyId as FamilyID,
      channelId: body.channelId as ChannelID,
      messageId: body.messageId as MessageID,
      requesterId: session.uid as UID,
    });

    await pusherServer.trigger(
      `private-chat-${body.channelId}`,
      "message-deleted",
      { messageId: body.messageId }
    );

    const response: DeleteMessageResponse = { success: true };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("[Delete Message API Error]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: message } satisfies DeleteMessageResponse,
      { status: 500 }
    );
  }
}
