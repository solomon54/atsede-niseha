//src/features/student/types/student.types.ts

// ─────────────────────────────────────────────
// Domain Enums (Stable Across System)
// ─────────────────────────────────────────────

export type StudentRole = "STUDENT";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type Gender = "MALE" | "FEMALE";

export type SpiritualTitle = "ምዕመን";

export interface EthiopianDate {
  day: number;
  month: number;
  year: number;
}

export interface StudentAcademicProfile {
  university: string;
  college: string;
  department: string;
  /** Ethiopian year the student entered university (stored in DB) */
  entryYear: number;
  /** Total years of the program — stored in DB, never manually updated */
  programDuration: number;
  /**
   * COMPUTED — derived from entryYear + programDuration via
   * academicProgressFromEntry(). Never written to Firestore.
   */
  academicYear: number;
  /** COMPUTED — see academicYear note above */
  semester: number;
  /** COMPUTED — true once the student has finished all program years */
  graduated: boolean;
}

// ─────────────────────────────────────────────
// Core Domain Types (Subject to Change)
// ─────────────────────────────────────────────

export interface SpiritualRelationship {
  spiritualFatherId: string; // EOTC UID
  fatherUid: string; // Firebase UID
  familyId: string; // isolation boundary
}

export interface StudentProfileDocument {
  uid: string;
  fullName: string;
  christianName: string;
  photoUrl?: string;
  university: string;
  department: string;
  entryYear: number;
  programDuration: number;
  status: string;
}

// ─────────────────────────────────────────────
// Main Entity Type
// ────────────────────────────────────────────
export interface Student {
  // Identity
  uid: string;
  eotcUid: string;

  // Names
  fullName: string;
  christianName: string;
  secularName: string;

  // Personal
  gender: Gender;
  birthDate: EthiopianDate;
  language: string;

  // Contact
  email: string;
  phone: string;
  photoUrl?: string;

  // Location
  region: string;
  zone: string;
  city: string;
  diocese: string;

  // Academic
  academics: StudentAcademicProfile;

  // Spiritual Authority
  relationship: SpiritualRelationship;
  spiritualTitle: SpiritualTitle;

  // System State
  role: StudentRole;
  status: StudentStatus;
  accountClaimed: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

// Raw DB representation
export interface StudentDocument {
  uid: string;
  eotcUid: string;

  fullName: string;
  christianName: string;
  secularName: string;

  gender: Gender;
  birthDate: EthiopianDate;

  language: string;
  email: string;
  phone: string;
  photoUrl?: string;

  region: string;
  zone: string;
  city: string;
  diocese: string;

  university: string;
  college: string;
  department: string;
  entryYear: number;
  /**
   * Total program length in years (e.g. 4 for Engineering, 3 for diploma).
   * Stored in Firestore. academicYear + semester are COMPUTED, never stored.
   * Legacy docs without this field default to 4 years.
   */
  programDuration: number;

  fatherId: string;
  spiritualFatherId: string;

  spiritualTitle: SpiritualTitle;

  role: StudentRole;
  status: StudentStatus;
  accountClaimed: boolean;

  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface StudentSessionIdentity {
  uid: string;
  eotcUid: string;
  role: "STUDENT";
  familyId: string;
}
