// src/core/auth/requireSession.ts

/**
 * Auth Guard
 * ------------------------------------------------
 * Converts existing session into strict API context.
 * Provides runtime resilience if session claims are stale or missing.
 */
import { adminDb } from "@/services/firebase/admin";

import { getSession } from "./session.service";

export interface SessionUser {
  uid: string;
  familyId: string;
  role?: string;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  /**
   * 1. Fast Path: Trust existing claims if fully populated
   */
  if (session.familyId && session.role) {
    return {
      uid: session.uid,
      familyId: session.familyId,
      role: session.role,
    };
  }

  /**
   * 2. Fallback Path: Source of Truth (Firestore)
   * Essential for handling the "Data Ghost" during the first session after a claim.
   */
  let familyId = "";
  let role: string | undefined = session.role;

  // Try Fathers Collection
  const fatherSnap = await adminDb
    .collection("Fathers")
    .where("uid", "==", session.uid)
    .limit(1)
    .get();

  if (!fatherSnap.empty) {
    const data = fatherSnap.docs[0].data();
    role = "FATHER";
    // In your system, the Father's UID is the familyId used in Channels
    familyId = data.familyId || data.fatherId || data.uid;
  }

  // Try Students Collection
  if (!role || (!familyId && role === "STUDENT")) {
    const studentSnap = await adminDb
      .collection("Students")
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!studentSnap.empty) {
      const data = studentSnap.docs[0].data();
      role = "STUDENT";
      /** * CRITICAL FIX: Your Firestore Student docs use 'fatherId'
       * to store the family's root UID.
       */
      familyId = data.familyId || data.fatherId || data.uid;
    }
  }

  // Try Governors Collection
  if (!role) {
    const governorSnap = await adminDb
      .collection("Governors")
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!governorSnap.empty) {
      role = "GOVERNOR";
      familyId = ""; // Governors are outside the family isolation boundary
    }
  }

  if (!role) {
    throw new Error("USER_NOT_FOUND");
  }

  // Security check: If they aren't a Governor, they MUST have a familyId
  if (role !== "GOVERNOR" && !familyId) {
    console.error(
      `[requireSession] Isolation Error: No familyId for UID ${session.uid}`
    );
    throw new Error("INCOMPLETE_PROFILE");
  }

  return {
    uid: session.uid,
    familyId,
    role,
  };
}
