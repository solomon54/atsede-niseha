// src/features/student/policies/student.policy.ts

import { Student } from "../types/student.types";

export class StudentPolicy {
  /* ------------------------------------------------------------
     VIEW PERMISSION
  ------------------------------------------------------------ */
  static canView(requesterUid: string, student: Student): boolean {
    // Student can view own profile
    if (requesterUid === student.uid) {
      return true;
    }

    // Spiritual father can view
    if (requesterUid === student.relationship.fatherUid) {
      return true;
    }

    return false;
  }
}
