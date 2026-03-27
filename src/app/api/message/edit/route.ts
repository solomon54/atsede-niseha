//src/app/api/message/edit/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { messageService } from "@/features/messaging/services/message.service";
import {
  EditMessageRequest,
  EditMessageResponse,
} from "@/features/messaging/types/messaging.api.types";
import {
  ChannelID,
  FamilyID,
  MessageID,
  UID,
} from "@/features/messaging/types/messaging.types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    // Ensure session and familyId exist for the isolation boundary
    if (!session?.uid || !session?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as EditMessageRequest;

    if (!body.channelId || !body.messageId || !body.content) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Call service with all required fields + branded casting
    await messageService.editMessage({
      familyId: session.familyId as FamilyID,
      channelId: body.channelId as ChannelID,
      messageId: body.messageId as MessageID,
      editorId: session.uid as UID,
      newContent: body.content,
    });

    const response: EditMessageResponse = { success: true };
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Edit Message API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
