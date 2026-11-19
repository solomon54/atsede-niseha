// src/shared/domain/appointments/studentCreateCompatibility.ts
/**
 * Narrow compatibility shim for the Student create path only.
 *
 * Before Phase 8.1, `loadStudentInFamily` accepted any truthy `accountClaimed`
 * flag and used the Firestore document id when `uid` was absent. Those values
 * are preserved here for STUDENT actors so the audit fix for Father eligibility
 * does not silently tighten Student appointment creation.
 *
 * This is NOT an eligibility rule. It must never be used to expose a child in
 * the Father's Appointments feature or to bypass `isClaimedWithLinkedUid`.
 */

import type { ClaimStatusFields } from "./eligibility";

export function isLegacyClaimedStudent(data: ClaimStatusFields): boolean {
  return Boolean(data.accountClaimed);
}

export function legacyStudentUid(
  data: ClaimStatusFields,
  documentId: string
): string {
  return typeof data.uid === "string" && data.uid.length > 0
    ? data.uid
    : documentId;
}
