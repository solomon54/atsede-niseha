// src/app/api/message/send/route.ts

import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  IsolationBoundaryError,
  messageService,
  MessagingError,
  PermissionDeniedError,
} from "@/features/messaging/services/message.service";
import {
  RequestMedia,
  SendMessageRequest,
} from "@/features/messaging/types/messaging.api.types";
import {
  ChannelID,
  FamilyID,
  UID,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";

/* ============================================================
   CLOUDINARY CONFIGURATION
============================================================ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ============================================================
   TYPES & HELPERS
============================================================ */
const asFamilyID = (id: string): FamilyID => id as FamilyID;
const asChannelID = (id: string): ChannelID => id as ChannelID;
const asUID = (id: string): UID => id as UID;

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  mimetype?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail_url?: string;
}

/**
 * MEDIA MAPPING (Wise & Robust - Zero 'any')
 * Normalizes data from Cloudinary and client fallbacks safely.
 * Fixed: Explicitly typed to resolve ts(2322) with nulls.
 */
function mapMedia(
  media?: RequestMedia | null,
  uploadRes?: Partial<CloudinaryResponse>
) {
  const url = uploadRes?.secure_url || media?.url;
  if (!url) return null; // Use null to satisfy service input

  const inferredMime =
    uploadRes?.mimetype ||
    (uploadRes?.format ? `application/${uploadRes.format}` : media?.mimeType) ||
    "application/octet-stream";

  return {
    url,
    mimeType: inferredMime,
    sizeBytes: uploadRes?.bytes || media?.size || 0,
    width: uploadRes?.width || media?.width || null,
    height: uploadRes?.height || media?.height || null,
    durationSeconds: uploadRes?.duration || media?.durationSeconds || null,
    thumbnailUrl: uploadRes?.thumbnail_url || media?.thumbnailUrl || null,
    providerMetadata: uploadRes?.public_id
      ? { publicId: uploadRes.public_id }
      : undefined,
  };
}

/* ============================================================
   POST /api/message/send
============================================================ */
export async function POST(req: NextRequest) {
  let uploadedPublicId: string | null = null;

  try {
    const session = await requireSession();
    const body = (await req.json()) as SendMessageRequest & { file?: string };

    // 1. BASIC VALIDATION
    if (!body.channelId || !body.type) {
      return NextResponse.json(
        { error: "Missing channelId or type" },
        { status: 400 }
      );
    }

    // 2. OFFLINE-FIRST SAFETY: Idempotency Check
    if (body.clientMessageId) {
      const existing = await messageService.findByClientId(
        asChannelID(body.channelId),
        body.clientMessageId
      );
      if (existing) {
        return NextResponse.json({
          success: true,
          messageId: existing.id,
          redundant: true,
        });
      }
    }

    // 3. CONTENT VALIDATION
    if (!body.content?.trim() && !body.file && !body.media?.url) {
      return NextResponse.json(
        { error: "መልእክቱ ባዶ መሆን አይችልም (Message cannot be empty)" },
        { status: 400 }
      );
    }

    // 4. CLOUDINARY UPLOAD (The "Risky" Step)
    let uploadResult: Partial<CloudinaryResponse> = {};
    if (body.file) {
      try {
        const res = await cloudinary.uploader.upload(body.file, {
          folder: `atsede_niseha/messages/${session.familyId}`,
          resource_type: "auto",
        });
        uploadResult = res;
        uploadedPublicId = res.public_id;
      } catch (uploadErr) {
        console.error("[Cloudinary Failure]:", uploadErr);
        throw new MessagingError("የፋይል መላክ አልተሳካም (Media Upload Failed)");
      }
    }

    // 5. PREPARE & SAVE (The "Sacred Ledger" Step)
    const finalMedia = mapMedia(body.media, uploadResult);

    const message = await messageService.sendMessage({
      familyId: asFamilyID(session.familyId),
      channelId: asChannelID(body.channelId),
      senderId: asUID(session.uid),
      type: body.type,
      content: body.content?.trim() || "",
      media: finalMedia,
      isEncrypted: body.isEncrypted ?? false,
      encryption: body.encryption
        ? {
            keyId: body.encryption.keyId,
            iv: body.encryption.iv,
          }
        : undefined,
      clientMessageId: body.clientMessageId,
    });

    // 6. ASYNC BROADCAST (Non-Blocking)
    // Preserved: Exact original broadcast parameters
    broadcastNewMessage(
      { uid: session.uid, role: session.role as "FATHER" | "STUDENT" },
      body.channelId,
      {
        ...message,
        content: message.content || "",
      }
    ).catch((err) => console.error("[Pusher Deferred Failure]:", err));

    return NextResponse.json(
      { success: true, messageId: message.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    // 7. ATOMIC CLEANUP
    if (uploadedPublicId) {
      cloudinary.uploader
        .destroy(uploadedPublicId)
        .catch((e) =>
          console.error(
            "[Cleanup Failure]: Orphan file remains:",
            uploadedPublicId,
            e
          )
        );
    }
    return handleError(error);
  }
}

/* ============================================================
   DECOUPLED BROADCAST LOGIC
============================================================ */
async function broadcastNewMessage(
  session: { uid: string; role: "FATHER" | "STUDENT" },
  channelId: string,
  message: {
    id: string;
    content: string;
    media?: {
      url: string;
      mimeType: string;
      sizeBytes: number;
      width?: number | null;
      height?: number | null;
      durationSeconds?: number | null;
      thumbnailUrl?: string | null;
      providerMetadata?: { publicId: string };
    } | null;
    [key: string]: unknown;
  }
) {
  const profileColl = session.role === "FATHER" ? "Fathers" : "Students";
  const profileSnap = await adminDb
    .collection(profileColl)
    .doc(session.uid)
    .get();

  const profileData = profileSnap.data();

  // Preserved: isDiacon and senderTitle logic exactly as before
  await pusherServer.trigger(`private-chat-${channelId}`, "new-message", {
    ...message,
    senderName: profileData?.fullName || "የቤተሰብ አባል",
    senderTitle: profileData?.title || profileData?.spiritualTitle || "",
    senderPhoto: profileData?.photoUrl || null,
    senderRole: session.role,
    isDiacon: profileData?.isDiacon || false,
  });
}

/* ============================================================
   CENTRALIZED ERROR HANDLING
============================================================ */
function handleError(error: unknown) {
  // Use console.error strictly to avoid 'any' linting issues if necessary
  console.error("[api/message/send] Critical Failure:", error);

  if (error instanceof MessagingError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (
    error instanceof IsolationBoundaryError ||
    error instanceof PermissionDeniedError
  ) {
    return NextResponse.json(
      { error: "Forbidden: የቤተሰብ መለያ ጥሰት ተገኝቷል (Family isolation violation)." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: "Internal Server Error. The Sacred Ledger could not be updated." },
    { status: 500 }
  );
}
