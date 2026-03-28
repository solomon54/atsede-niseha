//src/features/messaging/services/mediaCleanup.ts

/**
 * EOTC Sacred Ledger — Media Cleanup Utility
 * ============================================================
 * Ensures zero-waste and storage integrity by removing
 * orphan Cloudinary assets.
 */

import { v2 as cloudinary } from "cloudinary";

import { adminDb } from "@/services/firebase/admin";

/**
 * Scans Cloudinary for files that were uploaded but never
 * successfully recorded in the Firestore Sacred Ledger.
 */
export async function cleanupOrphanMedia(familyId: string): Promise<void> {
  console.log(`[CLEANUP] Starting scan for family: ${familyId}`);

  try {
    const folderPath = `atsede_niseha/messages/${familyId}`;

    // 1. Fetch assets from Cloudinary
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: folderPath,
      max_results: 500,
    });

    const resources = result.resources as Array<{
      public_id: string;
      created_at: string;
    }>;

    for (const asset of resources) {
      // 2. Safety Buffer: Skip files uploaded in the last 30 minutes
      const ageInMinutes =
        (Date.now() - new Date(asset.created_at).getTime()) / 60000;
      if (ageInMinutes < 30) continue;

      // 3. Check Sacred Ledger for reference
      const messageQuery = await adminDb
        .collectionGroup("Messages")
        .where("media.providerMetadata.publicId", "==", asset.public_id)
        .limit(1)
        .get();

      // 4. If orphan found, destroy it
      if (messageQuery.empty) {
        console.warn(`[CLEANUP] Deleting orphan: ${asset.public_id}`);
        await cloudinary.uploader.destroy(asset.public_id);
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown Error";
    console.error("[CLEANUP ERROR]:", msg);
  }
}
