// src/features/appointments/types/appointment.types.ts

export type AppointmentType = "NISEHA" | "COUNSELING";

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export type AppointmentDirection = "FATHER_TO_CHILD" | "CHILD_TO_FATHER";

export interface Appointment {
  id: string;
  familyId: string;
  fatherUid: string;
  childUid: string;
  childEotcUid?: string;
  childName?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  /** ISO 8601 datetime */
  scheduledAt: string;
  location?: string;
  /** Respectful custom message (logistics only — never confession) */
  message?: string;
  /** @deprecated use message */
  logisticsNote?: string;
  direction: AppointmentDirection;
  createdBy: string;
  createdByRole: "FATHER" | "STUDENT";
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationKind =
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_REMINDER";

export interface InAppNotification {
  id: string;
  familyId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  appointmentId?: string;
  read: boolean;
  createdAt: string;
}

export interface CreateAppointmentInput {
  childUid: string;
  type: AppointmentType;
  scheduledAt: string;
  location?: string;
  message?: string;
  logisticsNote?: string;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  scheduledAt?: string;
  location?: string;
  message?: string;
  logisticsNote?: string;
  lastNisehaDate?: string;
}

/** Pusher event payloads */
export type AppointmentRealtimeEvent =
  | { type: "appointment.upsert"; appointment: Appointment }
  | { type: "notification.new"; notification: InAppNotification };
