// src/app/api/upload/route.ts

import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { ReadableStream as NodeReadableStream } from "stream/web";

/* ============================================================
   CLOUDINARY CONFIGURATION
============================================================ */

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ CLOUDINARY_CONFIG_MISSING: Uploads will fail.");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/* ============================================================
   CONSTANTS
============================================================ */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/* ============================================================
   STREAM BRIDGE (STRICT + SAFE)
   ------------------------------------------------------------
   Next.js gives WHATWG ReadableStream (DOM type)
   Cloudinary expects Node.js stream.

   Runtime compatible, typings differ.
   We intentionally bridge via unknown → NodeReadableStream.
============================================================ */

function webStreamToNodeStream(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>);
}

/* ============================================================
   ROUTE HANDLER
============================================================ */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const channelId =
      (formData.get("channelId") as string | null) ?? "unknown_ledger";
    const type = (formData.get("type") as string | null) ?? "general";

    /* ------------------------------------------------------------
       A. VALIDATION
    ------------------------------------------------------------ */

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "ፋይል አልተገኘም (File not found)" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Empty file upload rejected" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ፋይሉ በጣም ትልቅ ነው (Max 20MB)" },
        { status: 413 }
      );
    }

    console.log("📤 Uploading bytes:", file.size);

    /* ------------------------------------------------------------
       B. STREAM CONVERSION (NO BUFFERING)
    ------------------------------------------------------------ */

    const nodeStream = webStreamToNodeStream(file.stream());

    /* ------------------------------------------------------------
       C. STREAMING UPLOAD (BACKPRESSURE SAFE)
    ------------------------------------------------------------ */

    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `atsede_niseha/${channelId}/${type}`,
            resource_type: "auto",

            // keep readable filename without duplicate extension
            public_id: `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}`,

            use_filename: true,
            unique_filename: false,

            transformation: file.type.startsWith("image/")
              ? [{ quality: "auto", fetch_format: "auto" }]
              : undefined,
          },
          (error, result) => {
            if (error || !result) {
              reject(error ?? new Error("Cloudinary upload failed"));
              return;
            }
            resolve(result);
          }
        );

        nodeStream.on("error", reject).pipe(uploadStream);
      }
    );

    console.log("☁️ Cloudinary received:", uploadResult.bytes);

    /* ------------------------------------------------------------
       D. INTEGRITY VERIFICATION (CRITICAL)
    ------------------------------------------------------------ */

    if (!uploadResult.bytes || uploadResult.bytes <= 0) {
      console.error("❌ UPLOAD_INTEGRITY_FAILED", {
        localSize: file.size,
        cloudinaryBytes: uploadResult.bytes,
      });

      return NextResponse.json(
        { error: "Upload integrity verification failed" },
        { status: 500 }
      );
    }

    /* ------------------------------------------------------------
       E. RESPONSE (MATCHES MediaDescriptor)
    ------------------------------------------------------------ */

    return NextResponse.json(
      {
        ok: true,
        media: {
          url: uploadResult.secure_url,
          mimeType: file.type,
          sizeBytes: uploadResult.bytes,
          width: uploadResult.width ?? null,
          height: uploadResult.height ?? null,
          durationSeconds:
            typeof uploadResult.duration === "number"
              ? uploadResult.duration
              : null,
          thumbnailUrl:
            uploadResult.resource_type === "video"
              ? uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg")
              : uploadResult.secure_url,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown upload error";

    console.error("❌ [API_UPLOAD_CRITICAL]:", message);

    return NextResponse.json(
      {
        error: "ምስሉን መጫን አልተቻለም (Upload failed)",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
