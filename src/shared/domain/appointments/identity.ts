// src/shared/domain/appointments/identity.ts
/**
 * Read-only identity presentation for appointment details.
 *
 * Every role is resolved from authoritative UIDs on the normalized record and
 * the server-provided participants. Display names and card position are never
 * used to infer who created, received, proposed, answered, or last changed a
 * request.
 */

import { getOtherPartyUid } from "./legacy";
import { getOriginalRequester, getPendingResponder } from "./lifecycle";
import type { AppointmentParticipant, AppointmentRecord } from "./types";

export type AppointmentIdentityRole =
  | "ORIGINAL_REQUESTER"
  | "RECIPIENT"
  | "CURRENT_PROPOSER"
  | "PENDING_RESPONDER"
  | "LAST_ACTOR";

export interface AppointmentIdentityGroup {
  participant: AppointmentParticipant;
  roles: AppointmentIdentityRole[];
}

export interface AppointmentIdentityDisplay {
  /** The appointment subject, identified by the record's child UID. */
  subject: AppointmentParticipant;
  /** Participants grouped once each, with all authoritative roles attached. */
  groups: AppointmentIdentityGroup[];
}

const ROLE_ORDER: readonly AppointmentIdentityRole[] = [
  "ORIGINAL_REQUESTER",
  "RECIPIENT",
  "CURRENT_PROPOSER",
  "PENDING_RESPONDER",
  "LAST_ACTOR",
];

export function getAppointmentIdentityDisplay(
  record: AppointmentRecord,
  participants: {
    father: AppointmentParticipant;
    child: AppointmentParticipant;
  }
): AppointmentIdentityDisplay {
  const byUid = new Map<string, AppointmentParticipant>();
  for (const participant of [participants.father, participants.child]) {
    if (participant?.uid) byUid.set(participant.uid, participant);
  }

  const subject = byUid.get(record.childUid) ?? participants.child;
  const roleByUid = new Map<string, Set<AppointmentIdentityRole>>();

  const assign = (role: AppointmentIdentityRole, uid: string | undefined) => {
    if (!uid || !byUid.has(uid)) return;
    const roles = roleByUid.get(uid) ?? new Set<AppointmentIdentityRole>();
    roles.add(role);
    roleByUid.set(uid, roles);
  };

  const originalRequesterUid = getOriginalRequester(record);
  assign("ORIGINAL_REQUESTER", originalRequesterUid);
  assign("RECIPIENT", getOtherPartyUid(record, originalRequesterUid));
  assign("CURRENT_PROPOSER", record.currentProposerUid);
  assign("PENDING_RESPONDER", getPendingResponder(record));
  assign("LAST_ACTOR", record.updatedBy);

  const groups: AppointmentIdentityGroup[] = [];
  for (const [uid, roles] of roleByUid) {
    const participant = byUid.get(uid);
    if (!participant) continue;
    groups.push({
      participant,
      roles: ROLE_ORDER.filter((role) => roles.has(role)),
    });
  }

  // Keep Father then Child stable on both platforms, with any unexpected
  // participant appended in a deterministic order.
  const rank = (participant: AppointmentParticipant) =>
    participant.uid === participants.father?.uid
      ? 0
      : participant.uid === participants.child?.uid
      ? 1
      : 2;
  groups.sort((a, b) => rank(a.participant) - rank(b.participant));

  return { subject, groups };
}
