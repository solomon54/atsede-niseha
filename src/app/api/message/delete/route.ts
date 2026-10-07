// src/app/api/message/delete/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  DeleteMessageRequest,
  DeleteMessageResponse,
} from "@/features/messaging/types/messaging.api.types";
    // 🔥 FIX: Cast strings to Branded Types
    await messageService.deleteMessage({
      familyId: session.familyId as FamilyID,
      channelId: body.channelId as ChannelID,
      messageId: body.messageId as MessageID,
      requesterId: session.uid as UID,
    });

    // 🔥 Trigger realtime deletion event to all clients in the channel
    await pusherServer.trigger(`private-chat-${body.channelId}`, "message-deleted", {
      messageId: body.messageId,
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
