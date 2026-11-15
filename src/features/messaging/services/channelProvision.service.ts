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

      // ⚠️ Firestore transactions require EVERY read before ANY write.
      // The previous implementation interleaved tx.get / tx.set inside the
      // student loop, which threw as soon as a family had more than one child
      // and left families without DIRECT channels. Read everything first.

      // ────────────────────────────────────────────────
      //  READ PHASE
      //  1. COMMON_HOUSE family channel + its members
      // ────────────────────────────────────────────────
      const familySnap = await tx.get(
        adminDb
          .collection("Channels")
          .where("familyId", "==", familyId)
          .where("type", "==", "COMMON_HOUSE" as ChannelType)
          .limit(1)
      );

      let familyChannel: Channel | null = null;
      const familyMemberIds = new Set<string>();

      if (!familySnap.empty) {
        familyChannel = familySnap.docs[0].data() as Channel;

        const membersSnap = await tx.get(
          adminDb
            .collection("ChannelMembers")
            .where("channelId", "==", familyChannel.id)
        );
        membersSnap.docs.forEach((doc) =>
          familyMemberIds.add(doc.data().userId as string)
        );
      }

      // Governors are only added to an existing family channel.
      const governorSnap = familyChannel
        ? await tx.get(
            adminDb.collection("Governors").where("isActive", "==", true)
          )
        : null;

      // ────────────────────────────────────────────────
      //  2. Existing DIRECT channels + their members
      // ────────────────────────────────────────────────
      const directSnap = await tx.get(
        adminDb
          .collection("Channels")
          .where("type", "==", "DIRECT" as ChannelType)
          .where("familyId", "==", familyId)
          .limit(50)
      );

      const directMemberIds = new Map<string, Set<string>>();
      for (const doc of directSnap.docs) {
        const memberSnap = await tx.get(
          adminDb
            .collection("ChannelMembers")
            .where("channelId", "==", doc.id)
        );
        directMemberIds.set(
          doc.id,
          new Set(memberSnap.docs.map((m) => m.data().userId as string))
        );
      }

      // ────────────────────────────────────────────────
      //  WRITE PHASE — never read after this point
      // ────────────────────────────────────────────────
      if (!familyChannel) {
        const channelId = generateId() as ChannelID;
        const familyChannelRef = adminDb.collection("Channels").doc(channelId);

        familyChannel = {
          id: channelId,
          familyId,
          type: "COMMON_HOUSE",
          title: "Family Chat",
          createdBy: fatherId,
          createdAt: now,
        };

        tx.set(familyChannelRef, familyChannel);

        const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(fatherMemberRef, {
          id: fatherMemberRef.id,
          channelId,
          userId: fatherId,
          role: "FATHER" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);
        familyMemberIds.add(fatherId);

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
          familyMemberIds.add(studentId);
        }
      } else {
        // Make sure the father is present even on older, partial channels.
        if (!familyMemberIds.has(fatherId)) {
          const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(fatherMemberRef, {
            id: fatherMemberRef.id,
            channelId: familyChannel.id,
            userId: fatherId,
            role: "FATHER" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);
          familyMemberIds.add(fatherId);
        }

        for (const studentId of students) {
          if (familyMemberIds.has(studentId)) continue;
          const memberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(memberRef, {
            id: memberRef.id,
            channelId: familyChannel.id,
            userId: studentId,
            role: "CHILD" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);
          familyMemberIds.add(studentId);
        }

        // Add Governors to family channel
        for (const govDoc of governorSnap?.docs ?? []) {
          const govId = govDoc.id as UID;
          if (familyMemberIds.has(govId)) continue;
          const govMemberRef = adminDb.collection("ChannelMembers").doc();
          tx.set(govMemberRef, {
            id: govMemberRef.id,
            channelId: familyChannel.id,
            userId: govId,
            role: "READONLY" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);
          familyMemberIds.add(govId);
        }
      }

      // ────────────────────────────────────────────────
      //  3. Ensure one DIRECT father ↔ student channel per child
      // ────────────────────────────────────────────────
      const directChannels: Channel[] = [];

      for (const studentId of students) {
        // A valid DIRECT channel contains BOTH the father and this student.
        // Matching on createdBy reused the first child's channel for every
        // sibling, so it must not be used to resolve the pair.
        const existing = directSnap.docs.find((doc) => {
          const members = directMemberIds.get(doc.id);
          return Boolean(
            members && members.has(fatherId) && members.has(studentId)
          );
        });

        if (existing) continue;

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

        const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(fatherMemberRef, {
          id: fatherMemberRef.id,
          channelId,
          userId: fatherId,
          role: "FATHER" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

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
    // ── 1. Resolve fatherUid from the student Firestore document ──
    // Students are stored with eotcUid as the document ID
    const studentSnap = await adminDb
      .collection("Students")
      .doc(studentEotcUid)
      .get();

    if (!studentSnap.exists) {
      // Fallback: query by eotcUid field in case doc ID differs
      const qSnap = await adminDb
        .collection("Students")
        .where("eotcUid", "==", studentEotcUid)
        .limit(1)
        .get();
      if (qSnap.empty) {
        console.warn(
          `[joinStudentToFamilyChannels] Student doc missing: eotcUid=${studentEotcUid}`
        );
        return;
      }
    }

    const studentData = (
      studentSnap.exists ? studentSnap : null
    )?.data() ?? (
      await adminDb
        .collection("Students")
        .where("eotcUid", "==", studentEotcUid)
        .limit(1)
        .get()
    ).docs[0]?.data();

    if (!studentData) return;

    // fatherId stores the father's Firebase Auth UID (set during child registration)
    const fatherUid = (studentData.fatherId ?? studentData.fatherUid) as
      | UID
      | undefined;

    if (!fatherUid) {
      console.warn(
        `[joinStudentToFamilyChannels] No fatherId in student doc: eotcUid=${studentEotcUid}`
      );
      return;
    }

    const familyId = fatherUid as unknown as FamilyID;
    const now = Date.now();

    // ── 2. ALL READS FIRST (Firestore transaction requirement) ──
    await adminDb.runTransaction(async (tx) => {
      // Read: COMMON_HOUSE channel
      const familySnap = await tx.get(
        adminDb
          .collection("Channels")
          .where("familyId", "==", familyId)
          .where("type", "==", "COMMON_HOUSE" as ChannelType)
          .limit(1)
      );

      // Read: existing DIRECT channel between father and this student
      // We search by familyId + type only (not createdBy) to avoid missing it
      const directSnap = await tx.get(
        adminDb
          .collection("Channels")
          .where("familyId", "==", familyId)
          .where("type", "==", "DIRECT" as ChannelType)
          .limit(30) // get all direct channels in family, filter below
      );

      // Find the specific direct channel that has BOTH father and this student
      // We'll check membership after reads
      let existingDirectChannelId: ChannelID | null = null;
      const directChannelIds = directSnap.docs.map(
        (d) => d.data().id as ChannelID
      );

      // Read: all member records for direct channels to find the right one
      const directMemberSnaps = directChannelIds.length
        ? await Promise.all(
            directChannelIds.map((cid) =>
              tx.get(
                adminDb
                  .collection("ChannelMembers")
                  .where("channelId", "==", cid)
                  .where("userId", "==", studentUid)
                  .limit(1)
              )
            )
          )
        : [];

      // Read: family channel membership for student
      let familyMemberSnap = null;
      let familyChannelId: ChannelID | null = null;

      if (!familySnap.empty) {
        familyChannelId = (familySnap.docs[0].data() as Channel).id;
        familyMemberSnap = await tx.get(
          adminDb
            .collection("ChannelMembers")
            .where("channelId", "==", familyChannelId)
            .where("userId", "==", studentUid)
            .limit(1)
        );
      }

      // Determine if a direct channel already includes this student
      for (let i = 0; i < directChannelIds.length; i++) {
        if (!directMemberSnaps[i].empty) {
          existingDirectChannelId = directChannelIds[i];
          break;
        }
      }

      // ── 3. WRITES ──

      // A. Add student to COMMON_HOUSE if not already a member
      if (familyChannelId) {
        if (familyMemberSnap?.empty) {
          const ref = adminDb.collection("ChannelMembers").doc();
          tx.set(ref, {
            id: ref.id,
            channelId: familyChannelId,
            userId: studentUid,
            role: "CHILD" as ChannelRole,
            joinedAt: now,
            isActive: true,
          } satisfies ChannelMember);
          console.log(
            `[joinStudent] ✅ Added ${studentUid} to COMMON_HOUSE ${familyChannelId}`
          );
        } else {
          console.log(
            `[joinStudent] Already in COMMON_HOUSE — skipping`
          );
        }
      } else {
        console.log(
          `[joinStudent] No COMMON_HOUSE found for father ${fatherUid} — will be created on next father login`
        );
      }

      // B. Create a NEW DIRECT channel if none exists for this student
      if (!existingDirectChannelId) {
        const newChannelId = generateId() as ChannelID;
        const channelRef = adminDb
          .collection("Channels")
          .doc(newChannelId);

        const directChannel: Channel = {
          id: newChannelId,
          familyId,
          type: "DIRECT",
          createdBy: fatherUid,
          createdAt: now,
        };

        tx.set(channelRef, directChannel);

        // Father member in DIRECT channel
        const fatherMemberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(fatherMemberRef, {
          id: fatherMemberRef.id,
          channelId: newChannelId,
          userId: fatherUid,
          role: "FATHER" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

        // Student member in DIRECT channel
        const studentMemberRef = adminDb.collection("ChannelMembers").doc();
        tx.set(studentMemberRef, {
          id: studentMemberRef.id,
          channelId: newChannelId,
          userId: studentUid,
          role: "CHILD" as ChannelRole,
          joinedAt: now,
          isActive: true,
        } satisfies ChannelMember);

        console.log(
          `[joinStudent] ✅ Created DIRECT channel ${newChannelId} for ${fatherUid} ↔ ${studentUid}`
        );
      } else {
        console.log(
          `[joinStudent] DIRECT channel already exists: ${existingDirectChannelId}`
        );
      }
    });
  } catch (err) {
    console.error("[joinStudentToFamilyChannels] Failed (non-blocking):", {
      studentUid,
      studentEotcUid,
      error: err,
    });
    // Non-blocking — login must succeed regardless
  }
}
