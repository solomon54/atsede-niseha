// src/features/appointments/services/notification.service.ts
import "server-only";

import { adminDb } from "@/services/firebase/admin";
import { sendPushToUsers } from "@/services/push";
import type {
  AppointmentActorRole,
  AppointmentEventType,
} from "@/shared/domain/appointments";

import type {
  InAppNotification,
  NotificationKind,
} from "../types/appointment.types";
import { broadcastAppointmentEventToUser } from "./realtime";

/**
 * Deterministic notification id. One committed appointment operation can only
 * ever produce one notification per recipient, even when the action is retried.
 */
export function appointmentNotificationId(
  appointmentId: string,
  operationId: string,
  recipientUid: string
): string {
  return `${appointmentId}__${operationId}__${recipientUid}`;
}

export interface BuildNotificationInput {
  id: string;
  familyId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  appointmentId: string;
  eventType: AppointmentEventType;
  actorUid: string;
  actorRole: AppointmentActorRole;
  appointmentVersion: number;
  createdAt: string;
}

export function buildNotificationRecord(
  input: BuildNotificationInput
): InAppNotification {
  return {
    id: input.id,
    familyId: input.familyId,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    appointmentId: input.appointmentId,
    eventType: input.eventType,
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    appointmentVersion: input.appointmentVersion,
    read: false,
    createdAt: input.createdAt,
  };
}

/**
 * Realtime broadcast and push are best-effort and run only after the
 * appointment transaction committed. A delivery failure must never roll back a
 * committed action.
 */
export async function deliverNotification(
  notification: InAppNotification
): Promise<void> {
  await broadcastAppointmentEventToUser(notification.userId, {
    type: "notification.new",
    notification,
  });

  try {
    await sendPushToUsers([notification.userId], {
      title: notification.title,
      body: notification.body,
      channelId: "atsede-appointments",
      data: {
        type: "appointment",
        ...(notification.appointmentId
          ? {
              appointmentId: notification.appointmentId,
              route: `/appointments/${notification.appointmentId}`,
            }
          : {}),
        ...(notification.eventType
          ? { eventType: notification.eventType }
          : {}),
        ...(notification.appointmentVersion
          ? {
              appointmentVersion: String(notification.appointmentVersion),
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("[appointments notification] push failed", {
      notificationId: notification.id,
      error,
    });
  }
}

/**
 * Non-transactional creation helper for callers outside an appointment
 * transaction. Appointment mutations build the record inside their transaction
 * and call `deliverNotification` afterwards.
 */
export async function createNotification(
  input: BuildNotificationInput
): Promise<InAppNotification> {
  const record = buildNotificationRecord(input);
  await adminDb.collection("Notifications").doc(record.id).set(record, {
    merge: true,
  });
  await deliverNotification(record);
  return record;
}

export async function listNotificationsForUser(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<InAppNotification[]> {
  const snap = await adminDb
    .collection("Notifications")
    .where("userId", "==", userId)
    .limit(opts?.limit ?? 80)
    .get();

  let items = snap.docs.map((d) => d.data() as InAppNotification);
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (opts?.unreadOnly) {
    items = items.filter((n) => !n.read);
  }
  return items.slice(0, opts?.limit ?? 40);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const ref = adminDb.collection("Notifications").doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  const data = snap.data() as InAppNotification;
  if (data.userId !== userId) throw new Error("FORBIDDEN");
  await ref.update({ read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const snap = await adminDb
    .collection("Notifications")
    .where("userId", "==", userId)
    .limit(100)
    .get();

  const unread = snap.docs.filter((d) => !(d.data() as InAppNotification).read);
  if (unread.length === 0) return 0;

  const batch = adminDb.batch();
  unread.forEach((doc) => batch.update(doc.ref, { read: true }));
  await batch.commit();
  return unread.length;
}
