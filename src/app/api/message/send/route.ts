// src/app/api/message/send/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  IsolationBoundaryError,
  messageService,
  MessagingError,
  PermissionDeniedError,
} from "@/features/messaging/services/message.service";
import {
  SendMessageRequest,
  SendMessageResponse,
} from "@/features/messaging/types/messaging.api.types";
import {
  ChannelID,
  FamilyID,
  UID,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher"; // Ensure this matches your export

/* ============================================================
   TYPE CASTING HELPERS
   Used to satisfy branded types (UID, FamilyID, ChannelID)
============================================================ */
const asFamilyID = (id: string): FamilyID => id as FamilyID;
const asChannelID = (id: string): ChannelID => id as ChannelID;
const asUID = (id: string): UID => id as UID;

/* ============================================================
   MEDIA MAPPING
   Normalizes the API request media to the Service Descriptor
============================================================ */
function mapMedia(media?: SendMessageRequest["media"]) {
  if (!media) return undefined;

  return {
    url: media.url,
    mimeType: media.mimeType,
    sizeBytes: media.size,
    thumbnailUrl: media.thumbnailUrl,

    width: media.width,
    height: media?.height as number | undefined,
    durationSeconds: (media as { durationSeconds?: number }).durationSeconds,
  };
}

/* ============================================================
   POST /api/message/send
   Main entry point for the Sacred Ledger messaging.
============================================================ */
export async function POST(req: NextRequest) {
  try {
    // 1. Authorize Session
    const session = await requireSession();

    // 2. Parse and Validate Request Body
    const body = (await req.json()) as SendMessageRequest;

    if (!body.channelId || !body.type) {
      return NextResponse.json(
        { error: "Missing required channelId or type" },
        { status: 400 }
      );
    }

    // 3. Delegate to Authoritative Message Service
    const message = await messageService.sendMessage({
      familyId: asFamilyID(session.familyId),
      channelId: asChannelID(body.channelId),
      senderId: asUID(session.uid),
      type: body.type,
      content: body.content,
      media: mapMedia(body.media),
      isEncrypted: body.isEncrypted ?? false,
      encryption: body.encryption
        ? {
            keyId: body.encryption.keyId,
            iv: body.encryption.iv,
          }
        : undefined,
      clientMessageId: body.clientMessageId,
    });

    // 4. ROBUST BROADCAST (The Real-Time Layer)
    // We fetch the sender profile in parallel to minimize latency
    try {
      // Determine collection based on session (EOTC Doc ID rule)
      // Note: session.role should be 'FATHER' or 'CHILD' (from your auth logic)
      const profileColl = session.role === "FATHER" ? "Fathers" : "Students";
      const profileSnap = await adminDb
        .collection(profileColl)
        .doc(session.uid)
        .get();
      const profileData = profileSnap.data();

      await pusherServer.trigger(
        `private-chat-${body.channelId}`,
        "new-message",
        {
          ...message,
          senderName: profileData?.fullName || "የቤተሰብ አባል",
          senderTitle: profileData?.title || profileData?.spiritualTitle || "",
          senderPhoto: profileData?.photoUrl || null,
          senderRole: session.role,
          isDiacon: profileData?.isDiacon || false,
        }
      );
    } catch (pushError) {
      // We log the error but don't fail the request.
      // The message is already in the Ledger (Firestore), so it's safe.
      console.error("[Pusher Broadcast Failed]:", pushError);
    }

    // 5. Return Standardized Success Response
    const response: SendMessageResponse = {
      success: true,
      messageId: message.id,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    return handleError(error);
  }
}

/* ============================================================
   CENTRALIZED ERROR HANDLING
============================================================ */
function handleError(error: unknown) {
  console.error("[api/message/send] Critical Failure:", error);

  if (error instanceof MessagingError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (
    error instanceof IsolationBoundaryError ||
    error instanceof PermissionDeniedError
  ) {
    return NextResponse.json(
      {
        error:
          "Forbidden: Family isolation boundary or permission violation detected.",
      },
      { status: 403 }
    );
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Internal Server Error. The Sacred Ledger could not be updated at this time.",
    },
    { status: 500 }
  );
}
