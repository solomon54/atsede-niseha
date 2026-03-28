// src/core/auth/claim.service.ts

import { z } from "zod";

// ────────────────────────────────────────────────
// Added imports for channel provisioning / joining
// Adjust path if your folder structure is different
import {
  joinStudentToFamilyChannels,
  provisionFamilyChannels,
} from "@/features/messaging/services/channelProvision.service";
import { UID } from "@/features/messaging/types/messaging.types";
import { adminAuth, adminDb } from "@/services/firebase/admin";

import { AuthError } from "./auth.errors";
import { createSessionFromUid } from "./session.service";

// ────────────────────────────────────────────────

/**
 * Validation Schema
 * Defines the strict requirements for claiming a pre-existing sanctuary identity.
 */
const ClaimSchema = z.object({
  eotcUid: z.string().min(4),
  password: z.string().min(8),
  role: z.enum(["FATHER", "STUDENT", "GOVERNOR"]),
});

/**
 * Firebase Auth Error Interface
 * Specific structure for Firebase Admin Auth exceptions.
 */
interface FirebaseAuthError {
  code: string;
  message: string;
}

/**
 * claimAccount: The core logic for account activation.
 * This service bridges the gap between a pre-registered Firestore record
 * and a live Firebase Authentication user with a secure session.
 */
export async function claimAccount(raw: unknown) {
  // 1. Validation
  const body = ClaimSchema.parse(raw);

  // Logic: Map the role to the correct Firestore collection
  const collection =
    body.role === "GOVERNOR"
      ? "Governors"
      : body.role === "FATHER"
      ? "Fathers"
      : "Students";

  let uidCreated: string | null = null;

  try {
    // 2. Atomic Transaction for Account Creation
    await adminDb.runTransaction(async (tx) => {
      let docRef;
      let data;

      /**
       * PROFESSIONAL FIX: Identity Resolution
       * Governors use eotcUid as the Document ID for O(1) access.
       * Fathers/Students are queried via the eotcUid field.
       */
      if (body.role === "GOVERNOR") {
        const gDoc = await tx.get(
          adminDb.collection(collection).doc(body.eotcUid)
        );
        if (!gDoc.exists) throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
        docRef = gDoc.ref;
        data = gDoc.data();
      } else {
        const query = await adminDb
          .collection(collection)
          .where("eotcUid", "==", body.eotcUid)
          .limit(1)
          .get();
        if (query.empty) throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
        docRef = query.docs[0].ref;
        data = query.docs[0].data();
      }

      // 3. Status and Integrity Checks
      if (!data || data.accountClaimed) {
        throw new AuthError("ይህ መለያ ቀድሞ ተይዟል", "ALREADY_CLAIMED", 400);
      }

      if (!data.email) {
        throw new AuthError(
          "ለአካውንት ምስረታ ኢሜል ያስፈልጋል። እባክዎ መምህርዎን ያማክሩ።",
          "VALIDATION_ERROR",
          400
        );
      }

      // 4. Firebase Auth User Creation
      const userRecord = await adminAuth.createUser({
        email: data.email,
        password: body.password,
        displayName:
          data.christianName || data.fullName || data.secularName || "User",
      });

      uidCreated = userRecord.uid;

      /**
       * 5. Sovereign Claim Injection
       * Critical: eotcUid is included here to satisfy the Middleware's performance requirement.
       */
      const role = body.role;
      let calculatedFamilyId = "";

      if (role === "FATHER") {
        // Use the newly created UID as the familyId for Fathers
        calculatedFamilyId = userRecord.uid;
      } else if (role === "STUDENT") {
        // Use the fatherId (which is a UID) from the Firestore student doc
        calculatedFamilyId = data.fatherId || "";
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role: role,
        eotcUid: body.eotcUid,
        familyId: calculatedFamilyId,
        profileVersion: data.profileVersion ?? 1,
      });

      // 6. Record Synchronization
      tx.update(docRef, {
        uid: userRecord.uid,
        accountClaimed: true,
        status: "ACTIVE",
        lastLogin: new Date().toISOString(),
      });
    });

    // 7. Session Bridge
    if (!uidCreated) {
      throw new AuthError("Account creation failed", "SERVER_ERROR", 500);
    }

    /**
     * TOKEN FIX:
     * We use createSessionFromUid here because we are in a server-side flow.
     * This handles the Custom Token -> ID Token exchange internally.
     */
    await createSessionFromUid(uidCreated);

    // ────────────────────────────────────────────────
    // Post-claim side effects – channel provisioning / joining
    // ────────────────────────────────────────────────

    if (body.role === "FATHER" && uidCreated) {
      try {
        const fatherUid = uidCreated as UID;
        const studentUids: UID[] = [];

        console.log(
          `[FATHER CLAIM] Creating/ensuring COMMON_HOUSE channel for father ${body.eotcUid} (UID: ${fatherUid})`
        );

        const { familyChannel, directChannels } = await provisionFamilyChannels(
          fatherUid,
          studentUids
        );

        console.log(
          `[FATHER CLAIM] Family channel ready → ID: ${familyChannel.id}, direct channels created: ${directChannels.length}`
        );
      } catch (provisionErr) {
        console.error(
          "[FATHER CLAIM] Channel provisioning failed but account created:",
          {
            uid: uidCreated,
            eotcUid: body.eotcUid,
            error: provisionErr,
          }
        );
      }
    } else if (body.role === "STUDENT" && uidCreated) {
      try {
        const studentDocSnap = await adminDb
          .collection("Students")
          .doc(body.eotcUid)
          .get();

        if (!studentDocSnap.exists) {
          console.warn(
            `[STUDENT CLAIM] Student doc not found: ${body.eotcUid}`
          );
        } else {
          const studentData = studentDocSnap.data();
          const studentUid = studentData?.uid as UID | undefined;

          // ✅ Defensive future-proof guard
          if (!studentUid) {
            console.warn(
              `[STUDENT CLAIM] uid missing in student doc ${body.eotcUid} — join skipped`
            );
            return;
          }

          // ✅ FIX: pass BOTH required arguments
          joinStudentToFamilyChannels(studentUid, body.eotcUid).catch((err) => {
            console.error(
              "[STUDENT CLAIM] Channel join failed (non-critical):",
              {
                uid: studentUid,
                eotcUid: body.eotcUid,
                error: err,
              }
            );
          });
        }
      } catch (err) {
        console.error("[STUDENT CLAIM] Failed fetching student doc:", {
          eotcUid: body.eotcUid,
          error: err,
        });
      }
    }

    return {
      success: true,
      redirect: `/${body.role.toLowerCase()}`,
    };
  } catch (error: unknown) {
    if (error instanceof AuthError) throw error;

    const isFbError = (err: unknown): err is FirebaseAuthError => {
      return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof (err as any).code === "string"
      );
    };

    if (isFbError(error)) {
      if (error.code === "auth/email-already-exists") {
        throw new AuthError("ይህ ኢሜይል ቀድሞ ተመዝግቧል", "ALREADY_EXISTS", 400);
      }
    }

    console.error("[CLAIM CRASH]:", error);
    throw new AuthError(
      "ክንውኑ አልተሳካም (Transaction failed)",
      "SERVER_ERROR",
      500
    );
  }
}
