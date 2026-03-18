//src/app/api/message/delete/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  DeleteMessageRequest,
  DeleteMessageResponse,
} from "@/features/messaging/types/messaging.api.types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = (await req.json()) as DeleteMessageRequest;

    if (!body.channelId || !body.messageId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await messageService.deleteMessage({
      channelId: body.channelId,
      messageId: body.messageId,
      requesterId: session.uid,
    });

    const response: DeleteMessageResponse = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  console.error(error);

  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
