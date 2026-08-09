//src/app/api/message/chat-media-upload/route.ts

import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { ReadableStream as NodeReadableStream } from "stream/web";

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
   STREAM BRIDGE
============================================================ */

function webStreamToNodeStream(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>);
}

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

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "ፋይል አልተገኘም (File not found)" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "ባዶ ፋይል አይቀበልም (Empty file rejected)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `ፋይሉ በጣም ትልቅ ነው (Max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` },
        { status: 413 }
      );
    }

    // Normalize MIME — browsers sometimes send empty string for some types
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== "application/octet-stream") {
      console.warn(`[UPLOAD] Non-standard MIME: ${mimeType} — allowing through`);
    }

    console.log(
      `[UPLOAD] User=${session.uid} Channel=${channelId} File=${file.name} Size=${file.size} MIME=${mimeType}`
    );

    // 3. STREAM UPLOAD TO CLOUDINARY

    const nodeStream = webStreamToNodeStream(file.stream());

    // Determine resource_type based on MIME
    let resourceType: "image" | "video" | "raw" | "auto" = "auto";
    if (mimeType.startsWith("image/")) resourceType = "image";
    else if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) resourceType = "video";
    else resourceType = "raw"; // PDFs, docs, etc.

    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `atsede_niseha/${channelId}`,
            resource_type: resourceType,
            public_id: `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")}`,
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

        nodeStream.on("error", reject).pipe(uploadStream);
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
          originalName: file.name,
          sizeBytes: uploadResult.bytes || file.size,
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
