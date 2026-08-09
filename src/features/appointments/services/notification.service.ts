// src/features/appointments/services/notification.service.ts
import "server-only";

import { adminDb } from "@/services/firebase/admin";

import type {
  InAppNotification,
  NotificationKind,
} from "../types/appointment.types";
import { broadcastAppointmentEvent } from "./realtime";

export async function createNotification(input: {
  familyId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  appointmentId?: string;
}): Promise<InAppNotification> {
  const ref = adminDb.collection("Notifications").doc();
  const record: InAppNotification = {
    id: ref.id,
    familyId: input.familyId,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    appointmentId: input.appointmentId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await ref.set(record);

  await broadcastAppointmentEvent(input.familyId, {
    type: "notification.new",
    notification: record,
  });

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
