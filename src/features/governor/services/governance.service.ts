// src/features/governor/services/governance.service.ts

import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { db } from "@/services/firebase/client";

// 1. የሲስተሙን ሚናዎች (Roles) በጽኑ መተርጎም
export const USER_ROLES = {
  FATHER: "FATHER",
  GOVERNOR: "GOVERNOR",
  STUDENT: "STUDENT",
} as const;

// 2. የCollection ስሞችን ማእከላዊ ማድረግ (Typo ለመከላከል)
const COLLECTIONS = {
  FATHERS: "fathers",
} as const;

export type GovernanceActionResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export interface SpiritualFatherProfile {
  fullName: string;
  parish: string;
  assignedRegion?: string;
}

/**
 * Sovereign Governance Service
 * This is the ultimate authority layer for system access control.
 */
export const governanceService = {
  async authorizeSpiritualFather(
    authUid: string,
    profile: SpiritualFatherProfile
  ): Promise<GovernanceActionResult> {
    try {
      const fatherRef = doc(db, COLLECTIONS.FATHERS, authUid);

      // { merge: true } መጠቀም የነበረን ዳታ እንዳይደመሰስ ይጠብቃል
      await setDoc(
        fatherRef,
        {
          ...profile,
          role: USER_ROLES.FATHER,
          isApproved: true,
          accessGrantedAt: serverTimestamp(),
          lastStatusUpdate: serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AUTHORIZATION_FAILED";
      return { ok: false, errorMessage: message };
    }
  },

  async suspendSpiritualFatherAccess(
    authUid: string
  ): Promise<GovernanceActionResult> {
    try {
      const fatherRef = doc(db, COLLECTIONS.FATHERS, authUid);

      await updateDoc(fatherRef, {
        isApproved: false,
        suspendedAt: serverTimestamp(),
        lastStatusUpdate: serverTimestamp(),
      });

      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "SUSPENSION_FAILED";
      return { ok: false, errorMessage: message };
    }
  },
};
