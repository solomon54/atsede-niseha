//src/app/api/message/chat-media-upload/route.ts

import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";

/* ============================================================
   CLOUDINARY CONFIGURATION
============================================================ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/* ============================================================
   CONSTANTS
============================================================ */

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME_TYPES = [
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
];

/* ============================================================
   ROUTE HANDLER
============================================================ */

export async function POST(req: NextRequest) {
  try {
    // 1. AUTH CHECK — must be a logged-in member
    const session = await requireSession();

    const formData = await req.formData();
    const file = formData.get("file");
    const channelId =
      (formData.get("channelId") as string | null) ?? "unknown_ledger";

    // 2. VALIDATION
    if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "ፋይል አልተገኘም (File not found)" },
        { status: 400 }
      );
    }

    const safeFile = file as File;

    if (safeFile.size === 0) {
      return NextResponse.json(
        { error: "ባዶ ፋይል አይቀበልም (Empty file rejected)" },
        { status: 400 }
      );
    }

    if (safeFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `ፋይሉ በጣም ትልቅ ነው (Max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` },
        { status: 413 }
      );
    }

    // Normalize MIME — browsers sometimes send empty string for some types
    const mimeType = safeFile.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== "application/octet-stream") {
      console.warn(`[UPLOAD] Non-standard MIME: ${mimeType} — allowing through`);
    }

    console.log(
      `[UPLOAD] User=${session.uid} Channel=${channelId} File=${safeFile.name} Size=${safeFile.size} MIME=${mimeType}`
    );

    // 3. BUFFER UPLOAD TO CLOUDINARY (Bulletproof across Node and Mobile clients)
    const arrayBuffer = await safeFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine resource_type based on MIME
    let resourceType: "image" | "video" | "raw" | "auto" = "auto";
    if (mimeType.startsWith("image/")) resourceType = "image";
    else if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) resourceType = "video";
    else resourceType = "raw"; // PDFs, docs, etc.

    const rawName = safeFile.name || `file_${Date.now()}`;
    const cleanPublicId = `${Date.now()}-${rawName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `atsede_niseha/${channelId}`,
            resource_type: resourceType,
            public_id: cleanPublicId,
            use_filename: true,
            unique_filename: false,
            // Only transform images
            transformation: resourceType === "image"
              ? [{ quality: "auto:good", fetch_format: "auto" }]
              : undefined,
          },
          (error, result) => {
            if (error || !result) {
              reject(error ?? new Error("Cloudinary upload returned no result"));
              return;
            }
            resolve(result);
          }
        );

        uploadStream.end(buffer);
      }
    );

    console.log(
      `[UPLOAD] ✅ Cloudinary success: ${uploadResult.secure_url} (${uploadResult.bytes} bytes)`
    );

    // 4. BUILD THUMBNAIL URL FOR VIDEO/AUDIO
    let thumbnailUrl: string | null = null;
    if (uploadResult.resource_type === "video") {
      // Cloudinary auto-generates a thumbnail for video at .jpg
      thumbnailUrl = uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg");
    } else {
      thumbnailUrl = uploadResult.secure_url;
    }

    // 5. RESPONSE
    return NextResponse.json(
      {
        ok: true,
        media: {
          url: uploadResult.secure_url,
          mimeType: mimeType,
          // Preserve original filename in the URL via a custom field
          // so resolveFilename() can use it on the client
          originalName: safeFile.name || rawName,
          sizeBytes: uploadResult.bytes || safeFile.size,
          width: uploadResult.width ?? null,
          height: uploadResult.height ?? null,
          durationSeconds:
            typeof uploadResult.duration === "number"
              ? uploadResult.duration
              : null,
          thumbnailUrl,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown upload error";

    // Auth errors
    if (message === "UNAUTHORIZED" || message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("❌ [API_UPLOAD_CRITICAL]:", message);

    return NextResponse.json(
      {
        error: "ፋይሉን ወደ ደመናው መጫን አልተቻለም",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
