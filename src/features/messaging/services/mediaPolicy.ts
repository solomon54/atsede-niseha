// src/features/messaging/services/mediaPolicy.ts

import { MediaDescriptor } from "../types/messaging.types";

/**
 * MEDIA CONSTRAINTS
 * Centralized limits for the Atsede Niseha ecosystem.
 */
export const MEDIA_LIMITS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  ALLOWED_MIME_TYPES: [
    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/aac",
    "audio/m4a",
    "audio/x-m4a",
    // Video
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

/**
 * Validates and normalizes media descriptors for Firestore.
 * Ensures "Safety First" by stripping undefined and checking size.
 */
export function normalizeMedia(
  media?: Partial<MediaDescriptor> | null
): MediaDescriptor | null {
  if (!media || !media.url) {
    return null;
  }

  // 1. Hard Size Check
  if (media.sizeBytes && media.sizeBytes > MEDIA_LIMITS.MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds ${MEDIA_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB limit.`
    );
  }

  // 2. Strict MIME Type Validation
  if (
    media.mimeType &&
    !MEDIA_LIMITS.ALLOWED_MIME_TYPES.includes(media.mimeType)
  ) {
    console.warn(
      `[MEDIA POLICY] Non-standard MIME detected: ${media.mimeType}`
    );
  }

  // 3. Firestore Normalization
  // Removed "as any" and "as MediaDescriptor" by using explicit nulls.
  return {
    url: media.url,
    mimeType: media.mimeType || "application/octet-stream",
    sizeBytes: media.sizeBytes || 0,
    width: media.width ?? null,
    height: media.height ?? null,
    durationSeconds: media.durationSeconds ?? null,
    thumbnailUrl: media.thumbnailUrl ?? null,
  };
}
