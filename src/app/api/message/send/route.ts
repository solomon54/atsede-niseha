//src/app/api/message/send/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  SendMessageRequest,
  SendMessageResponse,
} from "@/features/messaging/types/messaging.api.types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = (await req.json()) as SendMessageRequest;

    if (!body.channelId || !body.type) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const message = await messageService.sendMessage({
      familyId: session.familyId,
      channelId: body.channelId,
      senderId: session.uid,
      type: body.type,
      content: body.content,
      media: body.media,
      isEncrypted: body.isEncrypted,
    });

    const response: SendMessageResponse = {
      success: true,
      messageId: message.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleError(error);
  }
}

/* -------------------------------- */
function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({}, { status: 401 });
    }
  }

  console.error(error);

  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
