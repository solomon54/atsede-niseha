//src/app/api/upload/route.ts
import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

// 1. Configure Cloudinary
// These must be set in your .env.local to avoid runtime crashes
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string | null) || "general";

    if (!file) {
      return NextResponse.json({ error: "ፋይል አልተገኘም" }, { status: 400 });
    }

    // 2. Prepare the file for Cloudinary
    // We convert the web File object into a Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Robust Upload Stream (Zero 'any')
    // We wrap the callback-based Cloudinary stream in a Promise
    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `atsede_niseha/${type}`, // Organized by upload type
            resource_type: "image",
          },
          (error, result) => {
            if (error || !result) {
              reject(error || new Error("Upload failed to return result"));
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(buffer);
      }
    );

    // 4. Return the secure URL
    // This URL will be saved in Firestore by the Governance service
    return NextResponse.json(
      {
        url: uploadResult.secure_url,
        ok: true,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failure";
    console.error("❌ UPLOAD_ERROR:", message);

    return NextResponse.json(
      { error: "ምስሉን መጫን አልተቻለም", details: message },
      { status: 500 }
    );
  }
}
