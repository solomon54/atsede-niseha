// src/shared/domain/appointments/types.ts
/**
 * Canonical appointment domain types shared by Web and Android.
 *
 * These types are intentionally framework-agnostic: no React, no Firestore,
 * no Dexie/SQLite. Both clients and the server use the same semantics.
 */

export type AppointmentType = "NISEHA" | "COUNSELING";

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "DECLINED"
  | "COMPLETED"
  | "CANCELLED";

export type AppointmentDirection = "FATHER_TO_CHILD" | "CHILD_TO_FATHER";

/** Role as it is stored on the appointment; the child is always the subject. */
export type AppointmentActorRole = "FATHER" | "STUDENT";

/** Party role used for display and authorization. */
export type AppointmentPartyRole = "FATHER" | "CHILD";

export type AppointmentAction =
  | "CONFIRM"
  | "DECLINE"
  | "RESCHEDULE"
  | "CANCEL"
  | "COMPLETE";

export type AppointmentEventType =
  | "CREATED"
  | "CONFIRMED"
  | "DECLINED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "COMPLETED";

export type AppointmentQueueStatus = "QUEUED" | "SENDING" | "FAILED";

/**
 * Stored appointment. Legacy records may not contain the newer identity,
 * version, and responder fields; read them through `normalizeAppointment`.
 */
export interface Appointment {
  id: string;

  familyId: string;
  fatherUid: string;
  fatherName?: string;

  childUid: string;
  childEotcUid?: string;
  childName?: string;

  type: AppointmentType;
  status: AppointmentStatus;

  /** Canonical ISO instant. */
  scheduledAt: string;
  location?: string;
  /** Logistics-only note. Never confession content. */
  message?: string;
  /** @deprecated use message */
  logisticsNote?: string;

  /** Immutable creation identity. */
  createdBy: string;
  createdByRole: AppointmentActorRole;
  direction: AppointmentDirection;
  createdAt: string;

  /** Immutable requester identity (same as createdBy for all current writes). */
  originalRequesterUid?: string;

  /** Party who most recently proposed the current schedule. */
  currentProposerUid?: string;
  /** Party who must respond to the current proposal. */
  pendingResponseFrom?: string;

  /** Last actor to mutate the appointment. */
  updatedBy?: string;
  updatedAt: string;

  version?: number;
}

/**
 * Safe read-time view of an appointment. Missing legacy fields are derived;
 * `identityConsistent` is false when stored identity fields contradict each
 * other and mutations must be refused until reconciled.
 */
export interface AppointmentRecord extends Appointment {
  originalRequesterUid: string;
  currentProposerUid: string;
  version: number;
  identityConsistent: boolean;
}

export interface AppointmentActor {
  uid: string;
  role: AppointmentActorRole;
}

export interface AppointmentEvent {
  id: string;
  appointmentId: string;
  operationId: string;

  eventType: AppointmentEventType;

  actorUid: string;
  actorRole: AppointmentActorRole;
  actorNameSnapshot: string;

  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;

  previousScheduledAt?: string;
  newScheduledAt?: string;

  version: number;
  createdAt: string;
}

export interface AppointmentChildDirectoryEntry {
  uid: string;
  eotcUid?: string;
  displayName: string;
  photoUrl?: string;
  spiritualTitle?: string;
  lastNisehaDate?: string;
}

export interface AppointmentParticipant {
  uid: string;
  role: AppointmentPartyRole;
  displayName: string;
  photoUrl?: string;
  spiritualTitle?: string;
  eotcUid?: string;
}

export interface AppointmentActionPayload {
  scheduledAt?: string;
  location?: string;
  message?: string;
  /** Optional correction supplied while completing a NISEHA appointment. */
  lastNisehaDate?: string;
}

/**
 * Durable offline operation. Web stores it in Dexie, Android in SQLite.
 * `createdAt` is an ISO string so both platforms share the same shape.
 */
export interface AppointmentOutboxOperation {
  operationId: string;
  ownerUid: string;

  appointmentId: string;
  action: AppointmentAction;
  expectedVersion: number;

  payload?: AppointmentActionPayload;

  status: AppointmentQueueStatus;
  createdAt: string;
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  lastErrorCode?: string;
  needsAttention?: boolean;
}

export interface AppointmentListResponse {
  success: boolean;
  appointments: AppointmentRecord[];
  children?: AppointmentChildDirectoryEntry[];
  fatherName?: string;
  fatherPhotoUrl?: string;
  fatherTitle?: string;
  fatherEotcUid?: string;
}

export interface AppointmentDetailResponse {
  success: boolean;
  appointment: AppointmentRecord;
  events: AppointmentEvent[];
  participants: {
    father: AppointmentParticipant;
    child: AppointmentParticipant;
  };
  /** Server-derived actions for the requesting actor. */
  availableActions: AppointmentAction[];
}

export interface AppointmentActionResponse {
  success: boolean;
  appointment: AppointmentRecord;
  event?: AppointmentEvent;
  availableActions: AppointmentAction[];
  /** True when the operationId had already been committed. */
  duplicate?: boolean;
}

export interface AppointmentHistoryResponse {
  success: boolean;
  appointmentId: string;
  events: AppointmentEvent[];
}

/**
 * Stored idempotency record. One record exists per committed mutation so a
 * retried request can never bump the version or duplicate an event twice.
 */
export interface AppointmentOperationRecord {
  operationId: string;
  appointmentId: string;
  ownerUid: string;
  action: AppointmentAction | "CREATE";
  expectedVersion: number | null;
  /** SHA-256 of the request payload; never the payload itself. */
  requestFingerprint: string;
  resultStatus: AppointmentStatus;
  resultVersion: number;
  resultScheduledAt: string;
  createdAt: string;
}

export interface AppointmentCreateResponse {
  success: boolean;
  appointment: AppointmentRecord;
  event?: AppointmentEvent;
  duplicate?: boolean;
}
