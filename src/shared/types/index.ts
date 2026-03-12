//src/shared/types/index.ts
import React from "react";

/** * PRESERVED: the existing types used throughout the app
 */
export interface StudentInput {
  secularName: string;
  christianName?: string;
  university?: string;
  department?: string;
}

export interface TokenResponse {
  displayName: string;
  invitationCode: string;
}

export interface StatusBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export interface SectionHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}

export interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  variant?: "dark" | "light";
}

export type SystemRole = "CONFESSOR" | "HELPER" | "LOG" | "FATHER" | "STUDENT";

/** * ADJUSTED: Unified Directory Base
 * We keep 'uid' for compatibility but acknowledge 'eotcUid' is our database key.
 */
export interface BaseDirectoryRecord {
  uid: string;
  eotcUid?: string;
  fullName: string;
  diocese: string;
  role: SystemRole;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  isApproved?: boolean;
  createdAt: Date | string;
  accountClaimed: boolean;
}

/** * ADDED/EXTENDED: Specific Records
 */
export interface ConfessorRecord extends BaseDirectoryRecord {
  role: "FATHER";
  title: string;
  parish: string;
  academics: string;
  secularTitle?: string;
  languages: string[];
  phone: string;
  email: string;
  photoUrl?: string;
  accountClaimed: boolean;
}

//  the StudentRecord with Academic Year tracking
export interface StudentRecord extends BaseDirectoryRecord {
  role: "STUDENT";
  university: string;
  department: string;
  academicYear: number;
  spiritualFatherId: string;
  accountClaimed: boolean;
}

export interface HelperRecord extends BaseDirectoryRecord {
  role: "HELPER";
  assignedToUid?: string;
}

export interface GovernanceLog extends BaseDirectoryRecord {
  role: "LOG";
  action: string;
  governorId: string;
}

/** * Combined Directory Type
 */
export type DirectoryRecord =
  | ConfessorRecord
  | StudentRecord
  | HelperRecord
  | GovernanceLog;

export type FatherRecord = ConfessorRecord;
