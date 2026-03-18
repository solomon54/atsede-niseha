// src/features/messaging/services/channelProvision.service.ts
import { adminDb } from "@/services/firebase/admin";

import {
  Channel,
  ChannelID,
  ChannelMember,
  ChannelRole,
  ChannelType,
  FamilyID,
  UID,
} from "../types/messaging.types";

/**
 * Custom error for channel provisioning failures
 */
export class ChannelProvisionError extends Error {
  code: string;
  constructor(message: string, code = "CHANNEL_PROVISION_FAILED") {
    super(message);
    this.code = code;
  }
}

/**
 * Generates a Firestore-safe document ID
 */
function generateId(): string {
  return adminDb.collection("_").doc().id;
}

/**
 * Provisions or ensures existence of:
 *  - one COMMON_HOUSE family channel (father + all students + governors)
 *  - direct 1:1 channels between father and each student
 *
 * Idempotent: safe to call multiple times with same inputs
 *
 * @param fatherId - UID of the father
 * @param students - Array of student UIDs to include in family channels
 * @returns Object containing the family channel and any newly created direct channels
 * @throws ChannelProvisionError
 */
export async function provisionFamilyChannels(
  fatherId: UID,
  students: UID[]
): Promise<{ familyChannel: Channel; directChannels: Channel[] }> {
  // More precise validation — allow empty students array (for father-only channel creation)
  if (!fatherId || typeof fatherId !== "string" || fatherId.trim() === "") {
    throw new ChannelProvisionError(
      "Valid father UID is required",
      "INVALID_FATHER_ID"
    );
  }

  if (!Array.isArray(students)) {
    throw new ChannelProvisionError(
      "Students parameter must be an array",
      "INVALID_INPUT"
    );
  }

  // students can be empty — that's now intentional and allowed

  // Branded type conversion — fatherId is canonical family ID
  const familyId = fatherId as unknown as FamilyID;

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const now = Date.now();

      console.log(
        `[provisionFamilyChannels] Starting for father ${fatherId} with ${students.length} students`
      );

      // ────────────────────────────────────────────────
      //  1. Ensure / create COMMON_HOUSE family channel
      // ────────────────────────────────────────────────
      const familyChannelQuery = adminDb
        .collection("Channels")
        .where("familyId", "==", familyId)
        .where("type", "==", "COMMON_HOUSE" as ChannelType)
        .limit(1);

      const familySnap = await tx.get(familyChannelQuery);

      let familyChannel: Channel;
      let familyChannelRef;

      if (familySnap.empty) {
        const channelId = generateId() as ChannelID;
        familyChannelRef = adminDb.collection("Channels").doc(channelId);

        familyChannel = {
          id: channelId,
          familyId,
          type: "COMMON_HOUSE",
          title: "Family Chat",
          createdBy: fatherId,
          createdAt: now,
        };

        tx.set(familyChannelRef, familyChannel);

        // Father → OWNER / FATHER role
        const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(fatherMemberRef, {
          id: fatherMemberRef.id,
          channelId,
          userId: fatherId,
          role: "FATHER" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

        // Students → CHILD role (safe even if empty)
        for (const studentId of students) {
          const studentMemberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(studentMemberRef, {
            id: studentMemberRef.id,
            channelId,
            userId: studentId,
            role: "CHILD" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);
        }
      } else {
        // Already exists
        familyChannel = familySnap.docs[0].data() as Channel;
        familyChannelRef = familySnap.docs[0].ref;

        const membersQuery = adminDb
          .collection("ChannelMembers")
          .where("channelId", "==", familyChannel.id);

        const membersSnap = await tx.get(membersQuery);
        const existingIds = new Set(
          membersSnap.docs.map((doc) => doc.data().userId as UID)
        );
        const now = Date.now();

        for (const studentId of students) {
          if (!existingIds.has(studentId)) {
            const memberRef = adminDb.collection("ChannelMembers").doc();
            tx.set(memberRef, {
              id: memberRef.id,
              channelId: familyChannel.id,
              userId: studentId,
              role: "CHILD" as ChannelRole,
              joinedAt: now,
              isActive: true,
            } satisfies ChannelMember);
          }
        }

        // Add Governors to family channel
        const governorSnap = await tx.get(
          adminDb.collection("Governors").where("isActive", "==", true)
        );

        for (const govDoc of governorSnap.docs) {
          const govId = govDoc.id as UID;
          if (!existingIds.has(govId)) {
            const govMemberRef = adminDb.collection("ChannelMembers").doc();
            tx.set(govMemberRef, {
              id: govMemberRef.id,
              channelId: familyChannel.id,
              userId: govId,
              role: "READONLY" as ChannelRole,
              joinedAt: now,
              isActive: true,
            } satisfies ChannelMember);
          }
        }
      }

      // ────────────────────────────────────────────────
      //  2. Ensure direct father ↔ student channels
      // ────────────────────────────────────────────────
      const directChannels: Channel[] = [];

      for (const studentId of students) {
        const directQuery = adminDb
          .collection("Channels")
          .where("type", "==", "DIRECT" as ChannelType)
          .where("familyId", "==", familyId)
          .where("createdBy", "in", [fatherId, studentId])
          .limit(1);

        const directSnap = await tx.get(directQuery);

        if (directSnap.empty) {
          const channelId = generateId() as ChannelID;
          const directChannel: Channel = {
            id: channelId,
            familyId,
            type: "DIRECT",
            createdBy: fatherId,
            createdAt: now,
          };

          const channelRef = adminDb.collection("Channels").doc(channelId);
          tx.set(channelRef, directChannel);

          // Father member
          const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(fatherMemberRef, {
            id: fatherMemberRef.id,
            channelId,
            userId: fatherId,
            role: "FATHER" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);

          // Student member
          const studentMemberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(studentMemberRef, {
            id: studentMemberRef.id,
            channelId,
            userId: studentId,
            role: "CHILD" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);

          directChannels.push(directChannel);
        }
      }

      console.log(
        `[provisionFamilyChannels] Completed successfully for father ${fatherId}`
      );

      return { familyChannel, directChannels };
    });

    return result;
  } catch (err) {
    console.error("[provisionFamilyChannels] Transaction failed:", err);
    throw new ChannelProvisionError(
      "Failed to provision family channels",
      "TRANSACTION_FAILED"
    );
  }
}

/**
 * When a STUDENT claims their account → make sure they are added to:
 *   - their father's COMMON_HOUSE channel (CHILD role)
 *   - the direct 1:1 channel with father (if it already exists)
 *
 * Very important: This function is IDEMPOTENT and does NOT fail the login flow.
 * If the family channel does not exist yet → it silently skips (father will add later).
 *
 * @param studentUid The newly created/claimed student's Auth UID
 * @param studentEotcUid The original eotcUid (Firestore document ID)
 */
export async function joinStudentToFamilyChannels(
  studentUid: UID,
  studentEotcUid: string
): Promise<void> {
  try {
    // ── 1. Get student document using eotcUid (doc ID) ──
    const studentSnap = await adminDb
      .collection("Students")
      .doc(studentEotcUid)
      .get();

    if (!studentSnap.exists) {
      console.warn(
        `[joinStudentToFamilyChannels] Student doc missing after claim: eotcUid=${studentEotcUid}, uid=${studentUid}`
      );
      return;
    }

    const studentData = studentSnap.data();
    const fatherUid = (studentData?.fatherUid ?? studentData?.fatherId) as
      | UID
      | undefined;

    if (!fatherUid) {
      console.warn(
        `[joinStudentToFamilyChannels] No fatherUid in student doc: eotcUid=${studentEotcUid}, uid=${studentUid}`
      );
      return;
    }

    // ── 2. Transaction: safe membership checks + adds ──
    await adminDb.runTransaction(async (tx) => {
      const now = Date.now();

      // ─────────────────────────
      // READ PHASE (ALL READS FIRST)
      // ─────────────────────────

      const familyQuery = adminDb
        .collection("Channels")
        .where("familyId", "==", fatherUid as unknown as FamilyID)
        .where("type", "==", "COMMON_HOUSE" as ChannelType)
        .limit(1);

      const familySnap = await tx.get(familyQuery);

      if (familySnap.empty) {
        console.log(
          `[joinStudentToFamilyChannels] No COMMON_HOUSE found yet for father ${fatherUid} — skipping`
        );
        return;
      }

      const familyChannel = familySnap.docs[0].data() as Channel;
      const familyChannelId = familyChannel.id;

      const familyMemberQuery = adminDb
        .collection("ChannelMembers")
        .where("channelId", "==", familyChannelId)
        .where("userId", "==", studentUid)
        .limit(1);

      const familyMemberSnap = await tx.get(familyMemberQuery);

      // DIRECT channel lookup (READ moved BEFORE writes)
      const directQuery = adminDb
        .collection("Channels")
        .where("type", "==", "DIRECT" as ChannelType)
        .where("familyId", "==", fatherUid as unknown as FamilyID)
        .where("createdBy", "in", [fatherUid, studentUid])
        .limit(1);

      const directSnap = await tx.get(directQuery);

      let directMemberSnap = null;
      let directChannelId: ChannelID | null = null;

      if (!directSnap.empty) {
        const directChannel = directSnap.docs[0].data() as Channel;
        directChannelId = directChannel.id;

        const directMemberQuery = adminDb
          .collection("ChannelMembers")
          .where("channelId", "==", directChannelId)
          .where("userId", "==", studentUid)
          .limit(1);

        directMemberSnap = await tx.get(directMemberQuery);
      }

      // ─────────────────────────
      // WRITE PHASE (ONLY WRITES)
      // ─────────────────────────

      if (familyMemberSnap.empty) {
        const memberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(memberRef, {
          id: memberRef.id,
          channelId: familyChannelId,
          userId: studentUid,
          role: "CHILD" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

        console.log(
          `[joinStudentToFamilyChannels] Added student ${studentUid} to COMMON_HOUSE ${familyChannelId}`
        );
      }

      if (directChannelId && directMemberSnap?.empty) {
        const memberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(memberRef, {
          id: memberRef.id,
          channelId: directChannelId,
          userId: studentUid,
          role: "CHILD" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

        console.log(
          `[joinStudentToFamilyChannels] Added student ${studentUid} to DIRECT channel ${directChannelId}`
        );
      }
    });
  } catch (err) {
    console.error("[joinStudentToFamilyChannels] Failed (non-blocking):", {
      studentUid,
      studentEotcUid,
      error: err,
    });
    // Deliberately not throwing — login must succeed
  }
}
