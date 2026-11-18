// src/features/appointments/types/appointment.types.ts
/**
 * Feature-level appointment contracts.
 *
 * Domain types come from the shared module so Web, Android, and the server
 * cannot drift apart.
 */

import type {
  AppointmentActorRole,
  AppointmentEventType,
} from "@/shared/domain/appointments";

export type {
  Appointment,
  AppointmentAction,
  AppointmentActionPayload,
  AppointmentActionResponse,
  AppointmentActor,
  AppointmentActorRole,
  AppointmentChildDirectoryEntry,
  AppointmentCreateResponse,
  AppointmentDetailResponse,
  AppointmentDirection,
  AppointmentEvent,
  AppointmentEventType,
  AppointmentHistoryResponse,
  AppointmentOperationRecord,
  AppointmentOutboxOperation,
  AppointmentParticipant,
  AppointmentPartyRole,
  AppointmentQueueStatus,
  AppointmentRecord,
  AppointmentStatus,
  AppointmentType,
} from "@/shared/domain/appointments";

export type NotificationKind =
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_DECLINED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_REMINDER";

export interface InAppNotification {
  id: string;
  familyId: string;
  /** Recipient. */
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  appointmentId?: string;
  eventType?: AppointmentEventType;
  actorUid?: string;
  actorRole?: AppointmentActorRole;
  appointmentVersion?: number;
  read: boolean;
  createdAt: string;
}

export interface CreateAppointmentInput {
  operationId: string;
  childUid: string;
  type: "NISEHA" | "COUNSELING";
  scheduledAt: string;
  location?: string;
  message?: string;
  /** @deprecated alias accepted for older clients. */
  logisticsNote?: string;
}

export interface AppointmentActionInput {
  operationId: string;
  expectedVersion: number;
  action: "CONFIRM" | "DECLINE" | "RESCHEDULE" | "CANCEL" | "COMPLETE";
  scheduledAt?: string;
  location?: string;
  message?: string;
  /** Optional correction when completing a NISEHA appointment. */
  lastNisehaDate?: string;
}

/** @deprecated use AppointmentActionInput */
export type UpdateAppointmentInput = AppointmentActionInput;

/** Pusher event payloads */
export type AppointmentRealtimeEvent =
  | {
      type: "appointment.upsert";
      appointment: import("@/shared/domain/appointments").AppointmentRecord;
    }
  | { type: "notification.new"; notification: InAppNotification };
