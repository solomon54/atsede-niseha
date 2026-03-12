//src/shared/types/index.ts
import React from "react";
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

// For status badges in the dashboard, e.g., "Active", "Pending", "Inactive"
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

// Unified Directory Types
export type SystemRole = "CONFESSOR" | "HELPER" | "LOG";

export interface BaseDirectoryRecord {
  uid: string;
  fullName: string;
  diocese: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  createdAt: Date | string;
}

export interface ConfessorRecord extends BaseDirectoryRecord {
  role: "CONFESSOR";
  parish: string;
}

export interface HelperRecord extends BaseDirectoryRecord {
  role: "HELPER";
  assignedToUid?: string; // UID of the Father they assist
}

export interface GovernanceLog extends BaseDirectoryRecord {
  role: "LOG";
  action: string;
  governorId: string;
}

export type DirectoryRecord = ConfessorRecord | HelperRecord | GovernanceLog;

// UI Prop Types
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
