//src/app/api/message/edit/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  EditMessageRequest,
  EditMessageResponse,
} from "@/features/messaging/types/messaging.api.types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = (await req.json()) as EditMessageRequest;

    if (!body.channelId || !body.messageId || !body.content) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await messageService.editMessage({
      channelId: body.channelId,
      messageId: body.messageId,
      editorId: session.uid,
      newContent: body.content,
    });

    const response: EditMessageResponse = { success: true };

    return NextResponse.json(response);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  console.error(error);

  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
