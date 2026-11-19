// src/shared/domain/appointments/snapshot.ts
/**
 * Owner-scoped appointment snapshot helpers used by the Android screen.
 *
 * These helpers keep two concerns separate:
 *  - the persisted snapshot preserves every cached appointment row for one
 *    account, including rows hidden by current eligibility; and
 *  - the presentation snapshot is filtered again on every load/refresh.
 *
 * The child directory is authoritative only from the server response. Cached
 * child entries are never merged back into an eligible directory, because a
 * previously eligible child must not stay eligible after the server omits it.
 */

import { applyFatherAppointmentEligibility } from "./eligibility";
import { isAppointmentParty, normalizeAppointment } from "./legacy";
import type {
  AppointmentChildDirectoryEntry,
  AppointmentRecord,
} from "./types";

export interface AppointmentSnapshot {
  appointments: AppointmentRecord[];
  children?: AppointmentChildDirectoryEntry[];
  fatherName?: string;
  fatherPhotoUrl?: string;
  fatherTitle?: string;
  fatherEotcUid?: string;
}

export interface OwnedAppointmentSnapshot {
  ownerUid: string;
  snapshot: AppointmentSnapshot;
}

export const EMPTY_APPOINTMENT_SNAPSHOT: AppointmentSnapshot = {
  appointments: [],
  children: [],
};

/** True only when a captured async request still belongs to the active account. */
export function isOwnerCurrent(
  capturedOwnerUid: string,
  currentOwnerUid: string | null | undefined
): boolean {
  return Boolean(capturedOwnerUid) && capturedOwnerUid === currentOwnerUid;
}

/**
 * Never return a snapshot belonging to another account. Callers use this for
 * both persisted snapshots and in-memory refs on every read.
 */
export function snapshotForOwner(
  owned: OwnedAppointmentSnapshot | null | undefined,
  ownerUid: string
): AppointmentSnapshot {
  if (!owned || !isOwnerCurrent(owned.ownerUid, ownerUid)) {
    return EMPTY_APPOINTMENT_SNAPSHOT;
  }
  return owned.snapshot;
}

function normalizeForOwner(
  appointments: AppointmentRecord[] | undefined,
  ownerUid: string
): AppointmentRecord[] {
  return (appointments || [])
    .map((raw) =>
      raw && typeof raw.identityConsistent === "boolean"
        ? raw
        : normalizeAppointment(raw)
    )
    .filter((record) => isAppointmentParty(record, ownerUid));
}

/**
 * Merge a fresh server response into one account's snapshot.
 *
 * Returns null when the captured owner no longer matches the active owner, so
 * a delayed response from a previous account cannot populate the new account.
 */
export function mergeAuthoritativeAppointmentSnapshot(params: {
  capturedOwnerUid: string;
  currentOwnerUid: string | null | undefined;
  role: string;
  cached: AppointmentSnapshot | null | undefined;
  cachedOwnerUid?: string | null;
  server: AppointmentSnapshot;
}): { full: AppointmentSnapshot; presentation: AppointmentSnapshot } | null {
  if (!isOwnerCurrent(params.capturedOwnerUid, params.currentOwnerUid)) {
    return null;
  }

  const ownerUid = params.capturedOwnerUid;
  const trustedCached =
    params.cached &&
    isOwnerCurrent(params.cachedOwnerUid ?? ownerUid, ownerUid)
      ? params.cached
      : null;

  // Cached appointment rows are preserved so history is never erased by a
  // visibility filter. They stay in `full` even if they become ineligible.
  const appointmentById = new Map<string, AppointmentRecord>(
    normalizeForOwner(trustedCached?.appointments, ownerUid).map((record) => [
      record.id,
      record,
    ])
  );
  for (const record of normalizeForOwner(params.server.appointments, ownerUid)) {
    appointmentById.set(record.id, record);
  }
  const appointments = [...appointmentById.values()];

  // F2: the server child directory is authoritative for the current eligible
  // Father directory. Never merge stale cached children into it.
  const children = params.server.children || [];

  const full: AppointmentSnapshot = {
    ...params.server,
    appointments,
    children,
  };

  const eligible = applyFatherAppointmentEligibility({
    role: params.role,
    children,
    appointments,
  });

  return {
    full,
    presentation: {
      ...full,
      appointments: eligible.appointments,
      children: eligible.children,
    },
  };
}
