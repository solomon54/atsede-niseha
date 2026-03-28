// src/features/governor/services/governance.service.ts

import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/services/firebase/admin";

// Import from your validators file
import { SpiritualFatherProfile, SpiritualFatherSchema } from "./validators";

// Re-export them so the API Route can find them through this service module
export { SpiritualFatherSchema };
export type { SpiritualFatherProfile };

export const USER_ROLES = {
  FATHER: "FATHER",
  GOVERNOR: "GOVERNOR",
  STUDENT: "STUDENT",
} as const;

const COLLECTIONS = {
  FATHERS: "Fathers",
} as const;

export type GovernanceActionResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export const governanceService = {
  async authorizeSpiritualFather(
    eotcUid: string, // Renamed from authUid to be clear this is the EOTC-ID
    profile: SpiritualFatherProfile
  ): Promise<GovernanceActionResult> {
    try {
      /**
       * Note: We are NOT calling setCustomUserClaims here.
       * Because the Father hasn't created his password/account yet,
       * there is no record in Firebase Auth to attach claims to.
       */

      // 1. Register in the Sanctuary (Firestore Admin)
      // Using the eotcUid (EOTC-...) as the Document ID
      const fatherRef = adminDb.collection(COLLECTIONS.FATHERS).doc(eotcUid);

      await fatherRef.set(
        {
          ...profile,
          eotcUid: eotcUid,
          role: USER_ROLES.FATHER,
          isApproved: true,
          accountClaimed: false, // NEW: Tracks if the father has set his password yet
          accessGrantedAt: FieldValue.serverTimestamp(),
          lastStatusUpdate: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      console.error("GOVERNANCE_ERROR:", message);
      return { ok: false, errorMessage: "AUTHORIZATION_FAILED" };
    }
  },

  async suspendSpiritualFatherAccess(
    eotcUid: string
  ): Promise<GovernanceActionResult> {
    try {
      /**
       * When suspending, we check if they have a linked Auth account.
       * If they do, we remove the role. If not, we just update the DB.
       */
      const fatherRef = adminDb.collection(COLLECTIONS.FATHERS).doc(eotcUid);
      const doc = await fatherRef.get();
      const data = doc.data();

      // If the account was already claimed/linked to an Auth UID, remove claims
      if (data?.authUid) {
        await adminAuth.setCustomUserClaims(data.authUid, { role: null });
      }

      await fatherRef.update({
        isApproved: false,
        suspendedAt: FieldValue.serverTimestamp(),
        lastStatusUpdate: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "SUSPENSION_FAILED";
      console.error("SUSPENSION_ERROR:", message);
      return { ok: false, errorMessage: "SUSPENSION_FAILED" };
    }
  },

  /**
   * Fetches all registered Fathers.
   * Maps Firestore Timestamps to ISO strings for frontend compatibility.
   */
  async getFathers() {
    try {
      const snapshot = await adminDb
        .collection(COLLECTIONS.FATHERS)
        .orderBy("accessGrantedAt", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        accessGrantedAt:
          doc.data().accessGrantedAt?.toDate?.()?.toISOString() || null,
      }));

      return { ok: true, data };
    } catch (error: unknown) {
      console.error("GET_FATHERS_ERROR:", error);
      return { ok: false, errorMessage: "አባቶችን መጫን አልተቻለም" };
    }
  },

  /**
   * Fetches all registered Students.
   * Assuming a "Students" collection exists following the same pattern.
   */
  async getStudents() {
    try {
      const snapshot = await adminDb
        .collection("Students")
        .orderBy("createdAt", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      }));

      return { ok: true, data };
    } catch (error: unknown) {
      console.error("GET_STUDENTS_ERROR:", error);
      return { ok: false, errorMessage: "ተማሪዎችን መጫን አልተቻለም" };
    }
  },
};
