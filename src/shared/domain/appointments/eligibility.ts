// src/shared/domain/appointments/eligibility.ts
/**
 * Father-side appointment eligibility.
 *
 * A child may be present in the Father's Children page before claiming their
 * account, but is only a participant in the Father's Appointments page once
 * `accountClaimed === true` AND a valid linked `uid` exists. These helpers are
 * pure and are shared by the server, Web and Android so visibility is filtered
 * with the same rule at every boundary. They never mutate records and never
 * infer eligibility from a name, EOTC UID, cached profile or appointment row.
 */

import type {
  AppointmentChildDirectoryEntry,
  AppointmentRecord,
} from "./types";

/** Shape of an identity record's claim/link fields. */
export interface ClaimStatusFields {
  accountClaimed?: unknown;
  uid?: unknown;
}

export function hasValidLinkedUid(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The only accepted eligibility test: an explicit claim flag and a real
 * linked uid. Absence of either field means ineligible, never "assume true".
 */
export function isClaimedWithLinkedUid(record: ClaimStatusFields): boolean {
  return record.accountClaimed === true && hasValidLinkedUid(record.uid);
}

export function isEligibleFatherChild(
  child: AppointmentChildDirectoryEntry
): boolean {
  return isClaimedWithLinkedUid(child);
}

/** Eligible children only; preserves the caller's ordering. */
export function selectEligibleFatherChildren(
  children: AppointmentChildDirectoryEntry[]
): AppointmentChildDirectoryEntry[] {
  return children.filter(isEligibleFatherChild);
}

/**
 * Appointments whose subject child is currently eligible. Records are only
 * filtered from views; nothing is deleted or rewritten.
 */
export function selectEligibleFatherAppointments(
  appointments: AppointmentRecord[],
  eligibleChildren: AppointmentChildDirectoryEntry[]
): AppointmentRecord[] {
  const eligibleUids = new Set(
    eligibleChildren.map((child) => child.uid).filter(hasValidLinkedUid)
  );
  return appointments.filter((record) => eligibleUids.has(record.childUid));
}

/**
 * Single entry point used at data-ingress boundaries (server responses and
 * cached snapshots). Student data is returned untouched: the Father's rule
 * must never filter the Student's own appointment experience.
 */
export function applyFatherAppointmentEligibility(params: {
  role: string;
  children: AppointmentChildDirectoryEntry[];
  appointments: AppointmentRecord[];
}): {
  children: AppointmentChildDirectoryEntry[];
  appointments: AppointmentRecord[];
} {
  if (params.role !== "FATHER") {
    return { children: params.children, appointments: params.appointments };
  }
  const children = selectEligibleFatherChildren(params.children);
  return {
    children,
    appointments: selectEligibleFatherAppointments(
      params.appointments,
      children
    ),
  };
}
