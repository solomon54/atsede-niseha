// src/shared/types/index.ts
import React from "react";

/**
 * PRESERVED: UI & Component Props
 * Used for the high-end dashboard components
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

/**
 * SYSTEM ROLES
 */

export type SystemRole =
  | "GOVERNOR"
  | "FATHER"
  | "STUDENT"
  | "HELPER"
  | "LOG"
  | "CONFESSOR";

/**
 * BASE DIRECTORY RECORD
 */

export interface BaseDirectoryRecord {
  uid: string;
  eotcUid?: string;
  fullName: string;
  secularName?: string;
  christianName?: string;
  email?: string;
  photoUrl?: string;
  diocese: string;
  role: SystemRole;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  isApproved?: boolean;
  createdAt: Date | string;
  accountClaimed: boolean;
  lastLogin?: Date | string;
}

/**
 * SPECIFIC DIRECTORY RECORDS
 */

export interface GovernorRecord extends BaseDirectoryRecord {
  role: "GOVERNOR";
  accessLevel: "MASTER" | "MODERATOR";
  permissions: string[];
  authUid: string;
  email: string;
}

export interface FatherRecord extends BaseDirectoryRecord {
  role: "FATHER" | "CONFESSOR";
  title: string;
  parish: string;
  academics: string;
  secularTitle?: string;
  languages: string[];
  phone: string;
  email: string;
  photoUrl?: string;
}

export interface StudentRecord extends BaseDirectoryRecord {
  role: "STUDENT";
  university: string;
  department: string;
  academicYear: number;
  spiritualFatherId: string;
  fatherId: string;
  language: string;
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

/**
 * AUTHENTICATION PAYLOADS
 */

export interface AuthHandshakePayload {
  eotcUid: string;
  password?: string;
  newPassword?: string;
}

/**
 * AUTH RESPONSE (From File 2)
 */

export interface AuthResponse {
  success: boolean;
  role: SystemRole;
  target: string;
  record: DirectoryRecord;
  token?: string;
}

/**
 * GATEWAY RESPONSE
 */

export type GatewayResponse =
  | {
      success: true;
      action: "LOGIN";
      role: "GOVERNOR" | "FATHER" | "STUDENT";
      eotcUid: string;
      displayName: string;
      email?: string;
      photoUrl?: string;
      title?: string;
      diocese?: string;
      parish?: string;
      university?: string;
    }
  | {
      success: true;
      action: "CLAIM";
      role: "FATHER";
      data: {
        eotcUid: string;
        displayName: string;
        email: string;
        fullName: string;
        title: string;
        diocese: string;
        parish: string;
        photoUrl?: string;
        secularName?: string;
      };
    }
  | {
      success: true;
      action: "CLAIM";
      role: "STUDENT";
      data: {
        eotcUid: string;
        displayName: string;
        fullName: string;
        university: string;
        diocese: string; // Added
        christianName?: string;
        secularName?: string;
        email?: string;
        photoUrl?: string;
      };
    }
  | {
      success: false;
      error: string;
      code: "NOT_FOUND" | "INACTIVE" | "UNAUTHORIZED" | "SERVER_ERROR";
    };

/**
 * COMBINED DIRECTORY TYPES
 */

export type DirectoryRecord =
  | GovernorRecord
  | FatherRecord
  | StudentRecord
  | HelperRecord
  | GovernanceLog;

/**
 * ALIASES
 */

export type ConfessorRecord = FatherRecord;
