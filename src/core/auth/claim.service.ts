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
  eotcUid: z.string().trim().min(4),
  password: z.string().min(8),
  /**
   * Role is optional: the mobile gateway does not know the role of every
   * account it previews. When omitted we resolve it from Firestore, which is
   * the source of truth anyway.
   */
  role: z.enum(["FATHER", "STUDENT", "GOVERNOR"]).optional(),
  /**
   * Optional fallback email. Legacy records sometimes have no email stored;
   * in that case the claimer supplies one and it is persisted on the record.
   */
  email: z.string().trim().email().optional(),
});

type ClaimRole = "FATHER" | "STUDENT" | "GOVERNOR";

function collectionForRole(role: ClaimRole) {
  if (role === "GOVERNOR") return "Governors";
  if (role === "FATHER") return "Fathers";
  return "Students";
}

/**
 * Finds the pre-registered Firestore record for an EOTC id.
 * Governors are keyed by document id; Fathers/Students by `eotcUid` field.
 */
async function resolveClaimRecord(eotcUid: string, requestedRole?: ClaimRole) {
  const allRoles: ClaimRole[] = ["GOVERNOR", "FATHER", "STUDENT"];
  // Prefer the hinted role, then fall back to the other collections so a
  // stale/wrong client hint cannot block a legitimate claim.
  const candidates = requestedRole
    ? [requestedRole, ...allRoles.filter((r) => r !== requestedRole)]
    : allRoles;

  for (const role of candidates) {
    const collection = collectionForRole(role);

    if (role === "GOVERNOR") {
      const snap = await adminDb.collection(collection).doc(eotcUid).get();
      if (snap.exists) {
        return {
          role,
          docRef: snap.ref,
          data: snap.data() ?? ({} as FirebaseFirestore.DocumentData),
        };
      }
      continue;
    }

    const query = await adminDb
      .collection(collection)
      .where("eotcUid", "==", eotcUid)
      .limit(1)
      .get();

    if (!query.empty) {
      const doc = query.docs[0];
      return {
        role,
        docRef: doc.ref,
        data: doc.data() ?? ({} as FirebaseFirestore.DocumentData),
      };
    }
  }

  return null;
}

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
  const eotcUid = body.eotcUid.trim().toUpperCase();

  // 2. Identity resolution — the client may not know the role.
  const identity = await resolveClaimRecord(eotcUid, body.role);
  if (!identity) {
    throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
  }

  const role = identity.role;
  const email = (identity.data.email || body.email || "").trim().toLowerCase();

  if (!email) {
    throw new AuthError(
      "ለአካውንት ምስረታ ኢሜል ያስፈልጋል። እባክዎ መምህርዎን ያማክሩ።",
      "VALIDATION_ERROR",
      400
    );
  }

  let uidCreated: string | null = null;

  try {
    // 3. Atomic Transaction for Account Creation
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(identity.docRef);
      const data = snap.data();

      // 4. Status and Integrity Checks
      if (!snap.exists || !data) {
        throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
      }

      if (data.accountClaimed) {
        throw new AuthError("ይህ መለያ ቀድሞ ተይዟል", "ALREADY_CLAIMED", 400);
      }

      // 5. Firebase Auth User Creation
      const userRecord = await adminAuth.createUser({
        email,
        password: body.password,
        displayName:
          data.christianName || data.fullName || data.secularName || "User",
      });

      uidCreated = userRecord.uid;

      /**
       * 6. Sovereign Claim Injection
       * Critical: eotcUid is included here to satisfy the Middleware's performance requirement.
       */
      let calculatedFamilyId = "";

      if (role === "FATHER") {
        // Use the newly created UID as the familyId for Fathers
        calculatedFamilyId = userRecord.uid;
      } else if (role === "STUDENT") {
        // Use the fatherId (which is a UID) from the Firestore student doc
        calculatedFamilyId = data.fatherId || data.familyId || "";
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role,
        eotcUid,
        familyId: calculatedFamilyId,
        profileVersion: data.profileVersion ?? 1,
      });

      // 7. Record Synchronization
      tx.update(identity.docRef, {
        uid: userRecord.uid,
        email,
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
    const sessionToken = await createSessionFromUid(uidCreated);

    // ────────────────────────────────────────────────
    // Post-claim side effects – channel provisioning / joining
    // ────────────────────────────────────────────────

    if (role === "FATHER") {
      try {
        const fatherUid = uidCreated as UID;
        const studentUids: UID[] = [];

        console.log(
          `[FATHER CLAIM] Creating/ensuring COMMON_HOUSE channel for father ${eotcUid} (UID: ${fatherUid})`
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
            eotcUid,
            error: provisionErr,
          }
        );
      }
    } else if (role === "STUDENT") {
      try {
        // The claim transaction just wrote `uid` onto this same record.
        const studentDocSnap = await identity.docRef.get();
        const studentData = studentDocSnap.data();
        const studentUid = studentData?.uid as UID | undefined;

        if (!studentUid) {
          console.warn(
            `[STUDENT CLAIM] uid missing in student doc ${eotcUid} — join skipped`
          );
        } else {
          await joinStudentToFamilyChannels(studentUid, eotcUid);
        }
      } catch (err) {
        // Non-critical: the account exists and can still log in.
        console.error("[STUDENT CLAIM] Channel join failed:", {
          eotcUid,
          error: err,
        });
      }
    }

    return {
      success: true,
      role,
      token: sessionToken,
      redirect: `/${role.toLowerCase()}`,
    };
  } catch (error: unknown) {
    if (error instanceof AuthError) throw error;

    const isFbError = (err: unknown): err is FirebaseAuthError => {
      return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof (err as { code?: unknown }).code === "string"
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
