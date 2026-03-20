//src/features/messaging/services/mediaPolicy.ts

import { MediaDescriptor } from "../types/messaging.types";

/**
 * MEDIA CONSTRAINTS
 * Centralized limits for the Atsede Niseha ecosystem.
 */
export const MEDIA_LIMITS = {
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "audio/mpeg",
    "video/mp4",
  ],
};

/**
 * Validates and normalizes media descriptors for Firestore.
 * CRITICAL: Returns 'null' instead of 'undefined' to prevent Firestore crashes.
 */
export function normalizeMedia(
  media?: Partial<MediaDescriptor> | null
): MediaDescriptor | null {
  if (!media || !media.url) {
    return null;
  }

  // Basic validation (can be expanded)
  if (media.sizeBytes && media.sizeBytes > MEDIA_LIMITS.MAX_FILE_SIZE) {
    throw new Error("File size exceeds 15MB limit.");
  }

  // Ensure every field is either a value or null/undefined is stripped
  return {
    url: media.url,
    mimeType: media.mimeType || "application/octet-stream",
    sizeBytes: media.sizeBytes || 0,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    durationSeconds: media.durationSeconds ?? undefined,
    thumbnailUrl: media.thumbnailUrl ?? undefined,
  };
}
