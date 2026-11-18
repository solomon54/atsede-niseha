// src/features/appointments/services/realtime.ts
import "server-only";

import { pusherServer } from "@/services/pusher";
import type { AppointmentRecord } from "@/shared/domain/appointments";

import type { AppointmentRealtimeEvent } from "../types/appointment.types";

/**
 * Private, per-account appointment channel.
 *
 * Uses the Pusher private-channel convention (`private-*`) so subscription
 * requires server authorization. The UID segment must match the authenticated
 * session UID in `/api/message/auth`.
 */
export function userAppointmentsChannel(uid: string) {
  return `private-appointments-${uid}`;
}

export async function broadcastAppointmentEventToUser(
  uid: string,
  event: AppointmentRealtimeEvent
): Promise<void> {
  try {
    await pusherServer.trigger(
      userAppointmentsChannel(uid),
      "sanctuary-update",
      event
    );
  } catch (err) {
    console.error("[appointments realtime] broadcast failed", err);
  }
}

/** Both parties must be told about a committed appointment change. */
export async function broadcastAppointmentToParties(
  appointment: Pick<AppointmentRecord, "fatherUid" | "childUid">,
  event: AppointmentRealtimeEvent
): Promise<void> {
  await Promise.all([
    broadcastAppointmentEventToUser(appointment.fatherUid, event),
    broadcastAppointmentEventToUser(appointment.childUid, event),
  ]);
}
