// src/features/appointments/services/appointment.service.ts
import "server-only";

import { adminDb } from "@/services/firebase/admin";

import type {
  Appointment,
  AppointmentDirection,
  AppointmentStatus,
  AppointmentType,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "../types/appointment.types";
import { createNotification } from "./notification.service";
import { broadcastAppointmentEvent } from "./realtime";

export class AppointmentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

function assertParty(
  apt: Appointment,
  uid: string,
  role?: string
): "FATHER" | "CHILD" {
  if (role === "FATHER" && apt.fatherUid === uid) return "FATHER";
  if (role === "STUDENT" && apt.childUid === uid) return "CHILD";
  if (apt.fatherUid === uid) return "FATHER";
  if (apt.childUid === uid) return "CHILD";
  throw new AppointmentError("ይህ ቀጠሮ የእርስዎ አይደለም", "FORBIDDEN", 403);
}

async function loadStudentInFamily(childUid: string, familyId: string) {
  const snap = await adminDb
    .collection("Students")
    .where("uid", "==", childUid)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new AppointmentError("ልጅ አልተገኘም", "CHILD_NOT_FOUND", 404);
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const childFamily = data.familyId || data.fatherId;

  if (childFamily !== familyId) {
    throw new AppointmentError("የቤተሰብ ገደብ ተጥሷል", "FAMILY_ISOLATION", 403);
  }

  if (!data.accountClaimed) {
    throw new AppointmentError(
      "ልጁ አካውንቱን ገና አላረጋገጠም",
      "CHILD_UNCLAIMED",
      400
    );
  }

  return {
    uid: data.uid as string,
    eotcUid: (data.eotcUid as string) || doc.id,
    name:
      (data.christianName as string) ||
      (data.secularName as string) ||
      (data.fullName as string) ||
      "ልጅ",
  };
}

export async function createAppointment(params: {
  actorUid: string;
  actorRole: string;
  familyId: string;
  input: CreateAppointmentInput;
}): Promise<Appointment> {
  const { actorUid, actorRole, familyId, input } = params;

  if (actorRole !== "FATHER" && actorRole !== "STUDENT") {
    throw new AppointmentError("ፍቃድ የለዎትም", "FORBIDDEN", 403);
  }

  const fatherUid = familyId;
  let childUid = input.childUid;

  if (actorRole === "STUDENT") {
    childUid = actorUid;
  }

  const child = await loadStudentInFamily(childUid, familyId);

  if (actorRole === "FATHER" && actorUid !== fatherUid) {
    throw new AppointmentError("የቤተሰብ ገደብ ተጥሷል", "FAMILY_ISOLATION", 403);
  }

  const ref = adminDb.collection("Appointments").doc();
  const now = new Date().toISOString();
  const direction: AppointmentDirection =
    actorRole === "FATHER" ? "FATHER_TO_CHILD" : "CHILD_TO_FATHER";
  const message =
    input.message?.trim() || input.logisticsNote?.trim() || undefined;

  const appointment: Appointment = {
    id: ref.id,
    familyId,
    fatherUid,
    childUid: child.uid,
    childEotcUid: child.eotcUid,
    childName: child.name,
    type: input.type,
    status: "REQUESTED",
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    location: input.location?.trim() || undefined,
    message,
    logisticsNote: message,
    direction,
    createdBy: actorUid,
    createdByRole: actorRole === "FATHER" ? "FATHER" : "STUDENT",
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(appointment);

  const recipientUid = actorRole === "FATHER" ? child.uid : fatherUid;
  const typeLabel = input.type === "NISEHA" ? "ንስሐ" : "ምክክር";

  const notifTitle =
    direction === "FATHER_TO_CHILD"
      ? "ከአባት የመጣ የቀጠሮ ጥሪ"
      : "ከልጅ የመጣ የቀጠሮ ጥያቄ";

  const notifBody =
    direction === "FATHER_TO_CHILD"
      ? `አባትዎ ለ${child.name} የ${typeLabel} ቀጠሮ በአክብሮት ጠርተዋል።`
      : `${child.name} ለአባታቸው የ${typeLabel} ቀጠሮ በትሕትና ጠይቀዋል።`;

  await createNotification({
    familyId,
    userId: recipientUid,
    kind: "APPOINTMENT_REQUESTED",
    title: notifTitle,
    body: notifBody,
    appointmentId: appointment.id,
  });

  await broadcastAppointmentEvent(familyId, {
    type: "appointment.upsert",
    appointment,
  });

  return appointment;
}

export async function listAppointments(params: {
  actorUid: string;
  actorRole: string;
  familyId: string;
}): Promise<Appointment[]> {
  const { actorUid, actorRole, familyId } = params;

  const snap = await adminDb
    .collection("Appointments")
    .where("familyId", "==", familyId)
    .limit(120)
    .get();

  let items = snap.docs.map((d) => d.data() as Appointment);
  items.sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));

  if (actorRole === "STUDENT") {
    items = items.filter((a) => a.childUid === actorUid);
  }

  return items;
}

const STATUS_NOTIFY: Partial<
  Record<
    AppointmentStatus,
    { kind: Parameters<typeof createNotification>[0]["kind"]; title: string }
  >
> = {
  CONFIRMED: {
    kind: "APPOINTMENT_CONFIRMED",
    title: "ቀጠሮ ተረጋግጧል",
  },
  CANCELLED: {
    kind: "APPOINTMENT_CANCELLED",
    title: "ቀጠሮ ተሰርዟል",
  },
  COMPLETED: {
    kind: "APPOINTMENT_COMPLETED",
    title: "ቀጠሮ ተጠናቋል",
  },
  REQUESTED: {
    kind: "APPOINTMENT_RESCHEDULED",
    title: "ቀጠሮ ተቀይሯል",
  },
};

export async function updateAppointment(params: {
  appointmentId: string;
  actorUid: string;
  actorRole: string;
  familyId: string;
  input: UpdateAppointmentInput;
}): Promise<Appointment> {
  const { appointmentId, actorUid, actorRole, familyId, input } = params;
  const ref = adminDb.collection("Appointments").doc(appointmentId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new AppointmentError("ቀጠሮ አልተገኘም", "NOT_FOUND", 404);
  }

  const apt = snap.data() as Appointment;

  if (apt.familyId !== familyId) {
    throw new AppointmentError("የቤተሰብ ገደብ ተጥሷል", "FAMILY_ISOLATION", 403);
  }

  assertParty(apt, actorUid, actorRole);

  const patch: Partial<Appointment> = {
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };

  if (input.scheduledAt) {
    patch.scheduledAt = new Date(input.scheduledAt).toISOString();
    if (apt.status === "CONFIRMED" || apt.status === "REQUESTED") {
      // Reschedule keeps or returns to REQUESTED for re-confirm clarity
      if (input.status === undefined) {
        patch.status = "REQUESTED";
      }
    }
  }
  if (input.location !== undefined) patch.location = input.location.trim();
  if (input.message !== undefined) {
    patch.message = input.message.trim();
    patch.logisticsNote = patch.message;
  } else if (input.logisticsNote !== undefined) {
    patch.logisticsNote = input.logisticsNote.trim();
    patch.message = patch.logisticsNote;
  }
  if (input.status) patch.status = input.status;

  await ref.update(patch);
  const updated = { ...apt, ...patch } as Appointment;

  // Timeline: auto lastNisehaDate on NISEHA complete
  if (input.status === "COMPLETED" && apt.type === "NISEHA") {
    const nisehaDate =
      input.lastNisehaDate ||
      updated.scheduledAt.slice(0, 10) ||
      new Date().toISOString().slice(0, 10);

    await setStudentTimelineDate(apt.childUid, {
      lastNisehaDate: nisehaDate,
    });
  } else if (input.lastNisehaDate) {
    await setStudentTimelineDate(apt.childUid, {
      lastNisehaDate: input.lastNisehaDate,
    });
  }

  if (input.status && input.status !== apt.status) {
    const meta = STATUS_NOTIFY[input.status];
    if (meta) {
      const otherUid =
        actorUid === apt.fatherUid ? apt.childUid : apt.fatherUid;
      const typeLabel = apt.type === "NISEHA" ? "ንስሐ" : "ምክክር";
      await createNotification({
        familyId,
        userId: otherUid,
        kind: meta.kind,
        title: meta.title,
        body: `${apt.childName || "ልጅ"} — ${typeLabel}`,
        appointmentId: apt.id,
      });
    }
  } else if (input.scheduledAt && input.scheduledAt !== apt.scheduledAt) {
    const otherUid = actorUid === apt.fatherUid ? apt.childUid : apt.fatherUid;
    await createNotification({
      familyId,
      userId: otherUid,
      kind: "APPOINTMENT_RESCHEDULED",
      title: "ቀጠሮ ተቀይሯል",
      body: `${apt.childName || "ልጅ"} — አዲስ ሰዓት ተቀምጧል`,
      appointmentId: apt.id,
    });
  }

  await broadcastAppointmentEvent(familyId, {
    type: "appointment.upsert",
    appointment: updated,
  });

  return updated;
}

async function setStudentTimelineDate(
  childUid: string,
  fields: { lastNisehaDate?: string; lastQurbanDate?: string }
) {
  const snap = await adminDb
    .collection("Students")
    .where("uid", "==", childUid)
    .limit(1)
    .get();

  if (snap.empty) return;

  await snap.docs[0].ref.update({
    ...fields,
    updatedAt: new Date().toISOString(),
  });
}

export async function listFamilyChildren(familyId: string): Promise<
  Array<{ uid: string; eotcUid: string; name: string; lastNisehaDate?: string }>
> {
  const snap = await adminDb
    .collection("Students")
    .where("fatherId", "==", familyId)
    .get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: (data.uid as string) || "",
        eotcUid: (data.eotcUid as string) || d.id,
        name:
          (data.christianName as string) ||
          (data.secularName as string) ||
          (data.fullName as string) ||
          "ልጅ",
        lastNisehaDate: data.lastNisehaDate as string | undefined,
        accountClaimed: Boolean(data.accountClaimed),
      };
    })
    .filter((c) => c.uid && c.accountClaimed)
    .map(({ accountClaimed: _, ...rest }) => rest);
}

export type { AppointmentType };
