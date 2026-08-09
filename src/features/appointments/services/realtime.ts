// src/features/appointments/services/realtime.ts
import "server-only";

import { pusherServer } from "@/services/pusher";

import type { AppointmentRealtimeEvent } from "../types/appointment.types";

export function familyAppointmentsChannel(familyId: string) {
  return `family-appointments-${familyId}`;
}

export async function broadcastAppointmentEvent(
  familyId: string,
  event: AppointmentRealtimeEvent
) {
  try {
    await pusherServer.trigger(
      familyAppointmentsChannel(familyId),
      "sanctuary-update",
      event
    );
  } catch (err) {
    console.error("[appointments realtime] broadcast failed", err);
  }
}
