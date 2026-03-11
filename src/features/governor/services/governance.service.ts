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
    authUid: string,
    profile: SpiritualFatherProfile
  ): Promise<GovernanceActionResult> {
    try {
      // 1. Grant Authority in Auth (Custom Claims)
      await adminAuth.setCustomUserClaims(authUid, { role: USER_ROLES.FATHER });

      // 2. Register in the Sanctuary (Firestore Admin)
      const fatherRef = adminDb.collection(COLLECTIONS.FATHERS).doc(authUid);

      await fatherRef.set(
        {
          ...profile,
          role: USER_ROLES.FATHER,
          isApproved: true,
          accessGrantedAt: FieldValue.serverTimestamp(),
          lastStatusUpdate: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true };
    } catch (error) {
      console.error("GOVERNANCE_ERROR:", error);
      return { ok: false, errorMessage: "AUTHORIZATION_FAILED" };
    }
  },

  async suspendSpiritualFatherAccess(
    authUid: string
  ): Promise<GovernanceActionResult> {
    try {
      await adminAuth.setCustomUserClaims(authUid, { role: null });
      const fatherRef = adminDb.collection(COLLECTIONS.FATHERS).doc(authUid);
      await fatherRef.update({
        isApproved: false,
        suspendedAt: FieldValue.serverTimestamp(),
        lastStatusUpdate: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, errorMessage: "SUSPENSION_FAILED" };
    }
  },
};
