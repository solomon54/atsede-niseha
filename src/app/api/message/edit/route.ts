//src/app/api/message/edit/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  buildMessageEditedEvent,
  validateClientEditEncryption,
} from "@/features/messaging/editEncryption";
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
import { pusherServer } from "@/services/pusher";

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

    // Validate a client E2EE envelope before it reaches persistence. The
    // established context is channelId, so a mismatched keyId is rejected.
    const validatedEncryption = body.encryption
      ? validateClientEditEncryption(body.encryption, body.channelId)
      : null;
    if (validatedEncryption && !validatedEncryption.ok) {
      return NextResponse.json(
        { error: validatedEncryption.error },
        { status: 400 }
      );
    }

    const updated = await messageService.editMessage({
      familyId: session.familyId as FamilyID,
      channelId: body.channelId as ChannelID,
      messageId: body.messageId as MessageID,
      editorId: session.uid as UID,
      newContent: body.content,
      encryption: validatedEncryption?.ok
        ? validatedEncryption.encryption
        : undefined,
    });

    try {
      const editedEncryption =
        updated.encryption && "iv" in updated.encryption
          ? {
              keyId: updated.encryption.keyId,
              iv: updated.encryption.iv as string,
            }
          : null;
      await pusherServer.trigger(
        `private-chat-${body.channelId}`,
        "message-edited",
        buildMessageEditedEvent({
          messageId: body.messageId,
          content: updated.content ?? body.content,
          editedAt: updated.editedAt || Date.now(),
          encryption: editedEncryption,
        })
      );
    } catch (pushErr) {
      console.warn("[Pusher Edit Trigger Warning]:", pushErr);
    }

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
