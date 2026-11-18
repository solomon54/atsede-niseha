// src/shared/domain/appointments/legacy.ts
import type {
  Appointment,
  AppointmentDirection,
  AppointmentPartyRole,
  AppointmentRecord,
  AppointmentStatus,
} from "./types";

const TERMINAL_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "DECLINED",
  "COMPLETED",
  "CANCELLED",
]);

export function isTerminalAppointmentStatus(
  status: AppointmentStatus
): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function getOtherPartyUid(
  record: Pick<Appointment, "fatherUid" | "childUid">,
  uid: string
): string | undefined {
  if (uid === record.fatherUid) return record.childUid;
  if (uid === record.childUid) return record.fatherUid;
  return undefined;
}

export function getPartyRole(
  record: Pick<Appointment, "fatherUid" | "childUid">,
  uid: string
): AppointmentPartyRole | null {
  if (uid === record.fatherUid) return "FATHER";
  if (uid === record.childUid) return "CHILD";
  return null;
}

export function isAppointmentParty(
  record: Pick<Appointment, "fatherUid" | "childUid">,
  uid: string
): boolean {
  return Boolean(uid) && (uid === record.fatherUid || uid === record.childUid);
}

function deriveDirection(record: Appointment): AppointmentDirection | undefined {
  if (record.fatherUid && record.createdBy === record.fatherUid) {
    return "FATHER_TO_CHILD";
  }
  if (record.childUid && record.createdBy === record.childUid) {
    return "CHILD_TO_FATHER";
  }
  if (record.createdByRole === "FATHER") return "FATHER_TO_CHILD";
  if (record.createdByRole === "STUDENT") return "CHILD_TO_FATHER";
  return undefined;
}

/**
 * Read-time normalization for legacy and new records.
 *
 * It never writes to the document. New writes must persist the complete shape.
 */
export function normalizeAppointment(raw: Appointment): AppointmentRecord {
  let identityConsistent = true;

  const fatherUid = raw.fatherUid;
  const childUid = raw.childUid;

  if (!fatherUid || !childUid || fatherUid === childUid) {
    identityConsistent = false;
  }

  const direction = raw.direction || deriveDirection(raw);
  const createdByRole =
    raw.createdByRole ||
    (direction === "FATHER_TO_CHILD"
      ? "FATHER"
      : direction === "CHILD_TO_FATHER"
        ? "STUDENT"
        : undefined);

  const expectedRequesterUid =
    direction === "FATHER_TO_CHILD"
      ? fatherUid
      : direction === "CHILD_TO_FATHER"
        ? childUid
        : undefined;

  if (!direction || !createdByRole || !expectedRequesterUid) {
    identityConsistent = false;
  }

  if (
    direction === "FATHER_TO_CHILD" &&
    createdByRole !== "FATHER"
  ) {
    identityConsistent = false;
  }
  if (
    direction === "CHILD_TO_FATHER" &&
    createdByRole !== "STUDENT"
  ) {
    identityConsistent = false;
  }

  if (
    raw.createdBy &&
    expectedRequesterUid &&
    raw.createdBy !== expectedRequesterUid
  ) {
    identityConsistent = false;
  }

  const createdBy =
    raw.createdBy || expectedRequesterUid || "";
  const originalRequesterUid =
    raw.originalRequesterUid || createdBy || expectedRequesterUid || "";

  if (!originalRequesterUid) {
    identityConsistent = false;
  }

  if (
    raw.originalRequesterUid &&
    raw.createdBy &&
    raw.originalRequesterUid !== raw.createdBy
  ) {
    identityConsistent = false;
  }

  if (
    raw.originalRequesterUid &&
    expectedRequesterUid &&
    raw.originalRequesterUid !== expectedRequesterUid
  ) {
    identityConsistent = false;
  }

  const currentProposerUid =
    raw.currentProposerUid || originalRequesterUid;

  if (
    !currentProposerUid ||
    !isAppointmentParty({ fatherUid, childUid }, currentProposerUid)
  ) {
    identityConsistent = false;
  }

  const pendingResponseFrom =
    raw.status === "REQUESTED"
      ? raw.pendingResponseFrom ||
        getOtherPartyUid({ fatherUid, childUid }, currentProposerUid)
      : undefined;

  if (
    raw.pendingResponseFrom &&
    !isAppointmentParty({ fatherUid, childUid }, raw.pendingResponseFrom)
  ) {
    identityConsistent = false;
  }

  if (
    raw.status === "REQUESTED" &&
    pendingResponseFrom &&
    pendingResponseFrom === currentProposerUid
  ) {
    identityConsistent = false;
  }

  if (
    raw.status !== "REQUESTED" &&
    raw.pendingResponseFrom !== undefined
  ) {
    // A stale pending responder on a settled appointment is harmless but
    // indicates a record written by an older, unsafe client. Refuse mutations
    // until it is reconciled rather than silently accepting the identity.
    identityConsistent = false;
  }

  let version = 1;
  if (
    typeof raw.version === "number" &&
    Number.isInteger(raw.version) &&
    raw.version >= 1
  ) {
    version = raw.version;
  } else if (raw.version !== undefined) {
    identityConsistent = false;
  }

  return {
    ...raw,
    direction: direction as AppointmentDirection,
    createdByRole: createdByRole as AppointmentRecord["createdByRole"],
    createdBy,
    originalRequesterUid,
    currentProposerUid,
    pendingResponseFrom,
    version,
    identityConsistent,
  };
}

export function isRecordSafeForMutation(record: AppointmentRecord): boolean {
  return record.identityConsistent;
}
