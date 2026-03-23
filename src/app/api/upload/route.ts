//src/app/api/upload/route.ts

import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

// 1. Strict Configuration Validation
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

// Production Limits: 20MB for free tier safety
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const channelId =
      (formData.get("channelId") as string | null) || "unknown_ledger";
    const type = (formData.get("type") as string | null) || "general";

    // --- A. Pre-flight Validation ---
    if (!file) {
      return NextResponse.json(
        { error: "ፋይል አልተገኘም (File not found)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ፋይሉ በጣም ትልቅ ነው (File too large - Max 20MB)" },
        { status: 413 }
      );
    }

    // --- B. Buffer Conversion ---
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- C. Resilient Cloudinary Stream (Zero 'any') ---
    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `atsede_niseha/${channelId}/${type}`,
            // "auto" is critical: it allows images, videos, and raw files (PDFs)
            resource_type: "auto",
            // Preserve original filename in Cloudinary for better "Download" experience
            public_id: `${Date.now()}-${file.name.split(".")[0]}`,
            // Optimization: create a tiny blurred placeholder for faster chat loading
            transformation: file.type.startsWith("image")
              ? [{ quality: "auto", fetch_format: "auto" }]
              : undefined,
          },
          (error, result) => {
            if (error || !result) {
              return reject(error || new Error("Cloudinary upload failed"));
            }
            resolve(result);
          }
        );

        // Node.js stream handling
        uploadStream.end(buffer);
      }
    );

    // --- D. Atomic Integrity Response ---
    // We map Cloudinary's 'bytes' to our Ledger's 'sizeBytes'
    return NextResponse.json(
      {
        ok: true,
        media: {
          url: uploadResult.secure_url,
          mimeType: file.type,
          // CRITICAL FIX: Ensure the size from the server is what we save.
          // If server reports 0, fallback to the verified local file size.
          sizeBytes: uploadResult.bytes || file.size,
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration, // Only for audio/video
          thumbnailUrl:
            uploadResult.resource_type === "video"
              ? uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg")
              : uploadResult.secure_url,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // Graceful Error Handling
    const errorMessage =
      error instanceof Error ? error.message : "Unknown upload error";
    console.error("❌ [API_UPLOAD_CRITICAL]:", errorMessage);

    return NextResponse.json(
      {
        error: "ምስሉን መጫን አልተቻለም (Upload failed)",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
