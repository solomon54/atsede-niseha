// src/features/appointments/services/appointment.service.ts
import "server-only";

import { createHash } from "node:crypto";

import {
  type DocumentReference,
  FieldValue,
} from "firebase-admin/firestore";

import { adminDb } from "@/services/firebase/admin";
import {
  actorMatchesParty,
  applyAppointmentAction as computeNextAppointmentState,
  type Appointment,
  type AppointmentAction,
  type AppointmentActionResponse,
  type AppointmentActor,
  type AppointmentChildDirectoryEntry,
  type AppointmentCreateResponse,
  type AppointmentDetailResponse,
  type AppointmentEvent,
  type AppointmentEventType,
  type AppointmentHistoryResponse,
  type AppointmentOperationRecord,
  type AppointmentParticipant,
  type AppointmentRecord,
  buildAppointmentNotificationCopy,
  getAvailableAppointmentActions,
  getOtherPartyUid,
  isAppointmentParty,
  isClaimedWithLinkedUid,
  isLegacyClaimedStudent,
  legacyStudentUid,
  normalizeAppointment,
} from "@/shared/domain/appointments";
import {
  formatEthiopianDateTimeInEAT,
  getTodayEastAfricaDate,
  toEastAfricaDateOnly,
} from "@/shared/utils/calendar/ethiopianCalendar";

import type {
  AppointmentActionInput,
  CreateAppointmentInput,
  InAppNotification,
  NotificationKind,
} from "../types/appointment.types";
import {
  appointmentNotificationId,
  buildNotificationRecord,
  deliverNotification,
} from "./notification.service";
import { broadcastAppointmentToParties } from "./realtime";

const APPOINTMENTS = "Appointments";
const EVENTS = "Events";
const OPERATIONS = "Operations";
const CREATE_OPERATIONS = "AppointmentCreateOperations";
const STUDENTS = "Students";
const FATHERS = "Fathers";

const ACTION_EVENT_TYPE: Record<AppointmentAction, AppointmentEventType> = {
  CONFIRM: "CONFIRMED",
  DECLINE: "DECLINED",
  RESCHEDULE: "RESCHEDULED",
  CANCEL: "CANCELLED",
  COMPLETE: "COMPLETED",
};

const EVENT_NOTIFICATION_KIND: Record<
  AppointmentEventType,
  NotificationKind
> = {
  CREATED: "APPOINTMENT_REQUESTED",
  CONFIRMED: "APPOINTMENT_CONFIRMED",
  DECLINED: "APPOINTMENT_DECLINED",
  RESCHEDULED: "APPOINTMENT_RESCHEDULED",
  CANCELLED: "APPOINTMENT_CANCELLED",
  COMPLETED: "APPOINTMENT_COMPLETED",
};

export class AppointmentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function actorFromSession(uid: string, role?: string): AppointmentActor {
  if (role !== "FATHER" && role !== "STUDENT") {
    throw new AppointmentError("ፍቃድ የለዎትም", "FORBIDDEN", 403);
  }
  return { uid, role };
}

type FirestoreSnap = {
  id: string;
  data: () => Record<string, unknown> | undefined;
};

function toAppointment(snap: FirestoreSnap): Appointment {
  return {
    ...((snap.data() ?? {}) as unknown as Appointment),
    id: snap.id,
  };
}

function childDisplayName(data: Record<string, unknown>): string {
  return (
    (data.christianName as string) ||
    (data.secularName as string) ||
    (data.fullName as string) ||
    "ልጅ"
  );
}

function fatherDisplayName(data: Record<string, unknown>): string {
  const base =
    (data.christianName as string) ||
    (data.fullName as string) ||
    (data.secularName as string) ||
    "አባት";
  return data.title ? `${data.title} ${base}` : base;
}

interface ChildProfile {
  uid: string;
  eotcUid: string;
  displayName: string;
  photoUrl?: string;
  spiritualTitle?: string;
}

async function loadStudentInFamily(
  childUid: string,
  familyId: string,
  options: { preserveStudentCompatibility?: boolean } = {}
): Promise<ChildProfile> {
  const snap = await adminDb
    .collection(STUDENTS)
    .where("uid", "==", childUid)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new AppointmentError("ልጅ አልተገኘም", "CHILD_NOT_FOUND", 404);
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const childFamily = (data.familyId as string) || (data.fatherId as string);

  if (childFamily !== familyId) {
    throw new AppointmentError(
      "የቤተሰብ ገደብ ተጥሷል",
      "FAMILY_ISOLATION",
      403
    );
  }

  // Father-side creation keeps the strict claim + linked-uid rule. Student
  // creation preserves HEAD's compatibility behavior so this audit fix does
  // not silently tighten the Student's own appointment path.
  const preserveStudentCompatibility = options.preserveStudentCompatibility === true;
  if (
    preserveStudentCompatibility
      ? !isLegacyClaimedStudent(data)
      : !isClaimedWithLinkedUid(data)
  ) {
    throw new AppointmentError(
      "ልጁ አካውንቱን ገና አላረጋገጠም",
      "CHILD_UNCLAIMED",
      400
    );
  }

  return {
    uid: preserveStudentCompatibility
      ? legacyStudentUid(data, doc.id)
      : (data.uid as string),
    eotcUid: (data.eotcUid as string) || doc.id,
    displayName: childDisplayName(data),
    photoUrl: (data.photoUrl as string) || undefined,
    spiritualTitle: (data.spiritualTitle as string) || undefined,
  };
}

/**
 * Father-side guard for reading/mutating an existing appointment. The child
 * must currently be claimed and linked; historical records are never deleted
 * or rewritten, they are simply not exposed to the Father's experience.
 */
function assertFatherChildEligible(
  data: Record<string, unknown> | undefined,
  familyId: string
): void {
  if (!data || !isClaimedWithLinkedUid(data)) {
    throw new AppointmentError(
      "ልጁ አካውንቱን ገና አላረጋገጠም",
      "CHILD_UNCLAIMED",
      403
    );
  }
  const childFamily = (data.familyId as string) || (data.fatherId as string);
  if (childFamily !== familyId) {
    throw new AppointmentError(
      "የቤተሰብ ገደብ ተጥሷል",
      "FAMILY_ISOLATION",
      403
    );
  }
}

export async function getFatherProfile(
  familyId: string,
  fallbackName?: string
): Promise<AppointmentParticipant> {
  const snap = await adminDb
    .collection(FATHERS)
    .where("uid", "==", familyId)
    .limit(1)
    .get();

  if (snap.empty) {
    return {
      uid: familyId,
      role: "FATHER",
      displayName: fallbackName || "አባት",
    };
  }

  const doc = snap.docs[0];
  const data = doc.data();
  return {
    uid: (data.uid as string) || familyId,
    role: "FATHER",
    displayName: fatherDisplayName(data),
    photoUrl: (data.photoUrl as string) || undefined,
    spiritualTitle: (data.title as string) || undefined,
    eotcUid: (data.eotcUid as string) || doc.id,
  };
}

async function getChildParticipant(
  childUid: string,
  fallbackName?: string
): Promise<AppointmentParticipant> {
  const snap = await adminDb
    .collection(STUDENTS)
    .where("uid", "==", childUid)
    .limit(1)
    .get();

  if (snap.empty) {
    return {
      uid: childUid,
      role: "CHILD",
      displayName: fallbackName || "ልጅ",
    };
  }

  const doc = snap.docs[0];
  const data = doc.data();
  return {
    uid: (data.uid as string) || childUid,
    role: "CHILD",
    displayName: childDisplayName(data),
    photoUrl: (data.photoUrl as string) || undefined,
    spiritualTitle: (data.spiritualTitle as string) || undefined,
    eotcUid: (data.eotcUid as string) || doc.id,
  };
}

async function loadActorName(actor: AppointmentActor): Promise<string> {
  if (actor.role === "FATHER") {
    return (await getFatherProfile(actor.uid)).displayName;
  }
  return (await getChildParticipant(actor.uid)).displayName;
}

function buildEventNotification(params: {
  appointment: AppointmentRecord;
  operationId: string;
  eventType: AppointmentEventType;
  actor: AppointmentActor;
  actorName: string;
  recipientUid: string;
  scheduledAt: string;
  createdAt: string;
}): InAppNotification {
  const copy = buildAppointmentNotificationCopy({
    eventType: params.eventType,
    actorName: params.actorName,
    actorParty: params.actor.role === "FATHER" ? "FATHER" : "CHILD",
    subjectName: params.appointment.childName || "ልጅ",
    type: params.appointment.type,
    scheduledLabel: formatEthiopianDateTimeInEAT(params.scheduledAt),
  });

  return buildNotificationRecord({
    id: appointmentNotificationId(
      params.appointment.id,
      params.operationId,
      params.recipientUid
    ),
    familyId: params.appointment.familyId,
    userId: params.recipientUid,
    kind: EVENT_NOTIFICATION_KIND[params.eventType],
    title: copy.title,
    body: copy.body,
    appointmentId: params.appointment.id,
    eventType: params.eventType,
    actorUid: params.actor.uid,
    actorRole: params.actor.role,
    appointmentVersion: params.appointment.version,
    createdAt: params.createdAt,
  });
}

export async function createAppointment(params: {
  actorUid: string;
  actorRole: string;
  familyId: string;
  input: CreateAppointmentInput;
}): Promise<AppointmentCreateResponse> {
  const actor = actorFromSession(params.actorUid, params.actorRole);
  const { familyId, input } = params;

  if (actor.role === "FATHER" && actor.uid !== familyId) {
    throw new AppointmentError("የቤተሰብ ገደብ ተጥሷል", "FAMILY_ISOLATION", 403);
  }

  const childUid = actor.role === "STUDENT" ? actor.uid : input.childUid;
  if (!childUid) {
    throw new AppointmentError("ልጅ ይምረጡ", "CHILD_REQUIRED", 400);
  }

  const [child, father] = await Promise.all([
    loadStudentInFamily(childUid, familyId, {
      preserveStudentCompatibility: actor.role === "STUDENT",
    }),
    getFatherProfile(familyId),
  ]);

  const scheduledAt = new Date(input.scheduledAt).toISOString();
  const message =
    input.message?.trim() || input.logisticsNote?.trim() || undefined;
  const location = input.location?.trim() || undefined;
  const createdAt = new Date().toISOString();

  const requestFingerprint = fingerprint({
    action: "CREATE",
    childUid: child.uid,
    type: input.type,
    scheduledAt,
    location: location ?? null,
    message: message ?? null,
  });

  const appointmentRef = adminDb.collection(APPOINTMENTS).doc();
  const operationRef = adminDb
    .collection(CREATE_OPERATIONS)
    .doc(`${actor.uid}_${input.operationId}`);
  const eventRef = appointmentRef.collection(EVENTS).doc(input.operationId);

  const direction =
    actor.role === "FATHER" ? "FATHER_TO_CHILD" : "CHILD_TO_FATHER";
  const pendingResponseFrom =
    actor.role === "FATHER" ? child.uid : familyId;

  const appointment: Appointment = {
    id: appointmentRef.id,
    familyId,
    fatherUid: familyId,
    fatherName: father.displayName,
    childUid: child.uid,
    childEotcUid: child.eotcUid,
    childName: child.displayName,
    type: input.type,
    status: "REQUESTED",
    scheduledAt,
    location,
    message,
    logisticsNote: message,
    direction,
    createdBy: actor.uid,
    createdByRole: actor.role,
    createdAt,
    originalRequesterUid: actor.uid,
    currentProposerUid: actor.uid,
    pendingResponseFrom,
    updatedBy: actor.uid,
    updatedAt: createdAt,
    version: 1,
  };

  const record = normalizeAppointment(appointment);

  const event: AppointmentEvent = {
    id: input.operationId,
    appointmentId: appointment.id,
    operationId: input.operationId,
    eventType: "CREATED",
    actorUid: actor.uid,
    actorRole: actor.role,
    actorNameSnapshot:
      actor.role === "FATHER" ? father.displayName : child.displayName,
    previousStatus: null,
    newStatus: "REQUESTED",
    newScheduledAt: scheduledAt,
    version: 1,
    createdAt,
  };

  const notification = buildEventNotification({
    appointment: record,
    operationId: input.operationId,
    eventType: "CREATED",
    actor,
    actorName:
      actor.role === "FATHER" ? father.displayName : child.displayName,
    recipientUid: pendingResponseFrom,
    scheduledAt,
    createdAt,
  });

  const operation: AppointmentOperationRecord = {
    operationId: input.operationId,
    appointmentId: appointment.id,
    ownerUid: actor.uid,
    action: "CREATE",
    expectedVersion: null,
    requestFingerprint,
    resultStatus: "REQUESTED",
    resultVersion: 1,
    resultScheduledAt: scheduledAt,
    createdAt,
  };

  let duplicateOperation: AppointmentOperationRecord | undefined;

  await adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(operationRef);
    if (existing.exists) {
      const previous = existing.data() as AppointmentOperationRecord;
      if (
        previous.action !== "CREATE" ||
        previous.ownerUid !== actor.uid ||
        previous.requestFingerprint !== requestFingerprint
      ) {
        throw new AppointmentError(
          "የክወና መለያው ከተለየ ጥያቄ ጋር ተመሳስሏል። እባክዎ እንደገና ይሞክሩ።",
          "OPERATION_MISMATCH",
          409
        );
      }
      duplicateOperation = previous;
      return;
    }

    transaction.set(appointmentRef, appointment);
    transaction.set(eventRef, event);
    transaction.set(operationRef, operation);
    transaction.set(
      adminDb.collection("Notifications").doc(notification.id),
      notification
    );
  });

  if (duplicateOperation) {
    const previousAppointmentId = duplicateOperation.appointmentId;
    const [appointmentSnap, eventSnap] = await Promise.all([
      adminDb.collection(APPOINTMENTS).doc(previousAppointmentId).get(),
      adminDb
        .collection(APPOINTMENTS)
        .doc(previousAppointmentId)
        .collection(EVENTS)
        .doc(duplicateOperation.operationId)
        .get(),
    ]);

    if (!appointmentSnap.exists) {
      throw new AppointmentError("ቀጠሮ አልተገኘም", "NOT_FOUND", 404);
    }

    return {
      success: true,
      appointment: normalizeAppointment(toAppointment(appointmentSnap)),
      event: eventSnap.exists
        ? (eventSnap.data() as AppointmentEvent)
        : undefined,
      duplicate: true,
    };
  }

  await deliverNotification(notification);
  await broadcastAppointmentToParties(record, {
    type: "appointment.upsert",
    appointment: record,
  });

  return { success: true, appointment: record, event };
}

export async function applyAppointmentAction(params: {
  appointmentId: string;
  actorUid: string;
  actorRole: string;
  familyId: string;
  input: AppointmentActionInput;
}): Promise<AppointmentActionResponse> {
  const actor = actorFromSession(params.actorUid, params.actorRole);
  const { appointmentId, familyId, input } = params;

  const actorName = await loadActorName(actor);

  const now = new Date();
  const updatedAt = now.toISOString();

  const appointmentRef = adminDb.collection(APPOINTMENTS).doc(appointmentId);
  const operationRef = appointmentRef
    .collection(OPERATIONS)
    .doc(input.operationId);
  const eventRef = appointmentRef.collection(EVENTS).doc(input.operationId);

  const normalizedScheduledAt = input.scheduledAt
    ? new Date(input.scheduledAt).toISOString()
    : null;
  const normalizedLocation =
    input.location !== undefined ? input.location.trim() || null : null;
  const normalizedMessage =
    input.message !== undefined ? input.message.trim() || null : null;

  const requestFingerprint = fingerprint({
    action: input.action,
    expectedVersion: input.expectedVersion,
    scheduledAt: normalizedScheduledAt,
    location: normalizedLocation,
    message: normalizedMessage,
    lastNisehaDate: input.lastNisehaDate ?? null,
  });

  let duplicateOperation: AppointmentOperationRecord | undefined;
  let result:
    | {
        appointment: AppointmentRecord;
        event: AppointmentEvent;
        notification: InAppNotification;
      }
    | undefined;

  await adminDb.runTransaction(async (transaction) => {
    const appointmentSnap = await transaction.get(appointmentRef);
    if (!appointmentSnap.exists) {
      throw new AppointmentError("ቀጠሮ አልተገኘም", "NOT_FOUND", 404);
    }

    const raw = toAppointment(appointmentSnap);

    if (raw.familyId !== familyId) {
      throw new AppointmentError(
        "የቤተሰብ ገደብ ተጥሷል",
        "FAMILY_ISOLATION",
        403
      );
    }

    const record = normalizeAppointment(raw);

    if (
      !isAppointmentParty(record, actor.uid) ||
      !actorMatchesParty(record, actor)
    ) {
      throw new AppointmentError(
        "ይህ ቀጠሮ የእርስዎ አይደለም",
        "FORBIDDEN",
        403
      );
    }

    // Block bypassed client actions on an ineligible child's historical
    // appointment. No record ownership, history or lifecycle is altered.
    if (actor.role === "FATHER") {
      const childSnap = await transaction.get(
        adminDb
          .collection(STUDENTS)
          .where("uid", "==", record.childUid)
          .limit(1)
      );
      assertFatherChildEligible(
        childSnap.empty ? undefined : childSnap.docs[0].data(),
        familyId
      );
    }

    // Idempotency is checked only after the caller is known to be a current
    // party of this family's appointment.
    const operationSnap = await transaction.get(operationRef);
    if (operationSnap.exists) {
      const previous = operationSnap.data() as AppointmentOperationRecord;
      if (
        previous.ownerUid !== actor.uid ||
        previous.action !== input.action ||
        previous.expectedVersion !== input.expectedVersion ||
        previous.requestFingerprint !== requestFingerprint
      ) {
        throw new AppointmentError(
          "የክወና መለያው ከተለየ ጥያቄ ጋር ተመሳስሏል። እባክዎ እንደገና ይሞክሩ።",
          "OPERATION_MISMATCH",
          409
        );
      }
      duplicateOperation = previous;
      return;
    }

    if (!record.identityConsistent) {
      throw new AppointmentError(
        "የቀጠሮው ማንነት መረጃ ወጥነት የለውም። እባክዎ አስተዳዳሪን ያግኙ።",
        "INCONSISTENT_RECORD",
        409,
        { appointment: record, availableActions: [] }
      );
    }

    if (record.version !== input.expectedVersion) {
      throw new AppointmentError(
        "ቀጠሮው በሌላ ተጠቃሚ ተቀይሯል። እባክዎ አድስተው ይመልከቱ።",
        "VERSION_CONFLICT",
        409,
        {
          currentVersion: record.version,
          appointment: record,
          availableActions: getAvailableAppointmentActions(record, actor),
        }
      );
    }

    const application = computeNextAppointmentState(
      record,
      actor,
      input.action,
      {
        scheduledAt: input.scheduledAt,
        location: input.location,
        message: input.message,
      },
      now
    );

    if (!application.ok) {
      throw new AppointmentError(
        application.message,
        application.code,
        409,
        {
          appointment: record,
          availableActions: getAvailableAppointmentActions(record, actor),
        }
      );
    }

    const next = application.next;
    const eventType = ACTION_EVENT_TYPE[input.action];

    const nextRecord: AppointmentRecord = {
      ...record,
      status: next.status,
      scheduledAt: next.scheduledAt,
      location: next.location,
      message: next.message,
      logisticsNote: next.logisticsNote,
      currentProposerUid: next.currentProposerUid,
      pendingResponseFrom: next.pendingResponseFrom,
      updatedBy: next.updatedBy,
      updatedAt: next.updatedAt,
      version: next.version,
      identityConsistent: true,
    };

    const event: AppointmentEvent = {
      id: input.operationId,
      appointmentId,
      operationId: input.operationId,
      eventType,
      actorUid: actor.uid,
      actorRole: actor.role,
      actorNameSnapshot: actorName,
      previousStatus: application.previousStatus,
      newStatus: next.status,
      previousScheduledAt:
        input.action === "RESCHEDULE"
          ? application.previousScheduledAt
          : undefined,
      newScheduledAt:
        input.action === "RESCHEDULE" ? next.scheduledAt : undefined,
      version: next.version,
      createdAt: updatedAt,
    };

    const recipientUid = getOtherPartyUid(record, actor.uid);
    if (!recipientUid) {
      throw new AppointmentError(
        "የቀጠሮው ተቃራኒ ወገን አልተገኘም",
        "FORBIDDEN",
        403
      );
    }

    const notification = buildEventNotification({
      appointment: nextRecord,
      operationId: input.operationId,
      eventType,
      actor,
      actorName,
      recipientUid,
      scheduledAt: next.scheduledAt,
      createdAt: updatedAt,
    });

    const operation: AppointmentOperationRecord = {
      operationId: input.operationId,
      appointmentId,
      ownerUid: actor.uid,
      action: input.action,
      expectedVersion: input.expectedVersion,
      requestFingerprint,
      resultStatus: next.status,
      resultVersion: next.version,
      resultScheduledAt: next.scheduledAt,
      createdAt: updatedAt,
    };

    const patch: Record<string, unknown> = {
      status: next.status,
      scheduledAt: next.scheduledAt,
      currentProposerUid: next.currentProposerUid,
      pendingResponseFrom:
        next.pendingResponseFrom === undefined
          ? FieldValue.delete()
          : next.pendingResponseFrom,
      updatedBy: next.updatedBy,
      updatedAt: next.updatedAt,
      version: next.version,
    };

    if (input.action === "RESCHEDULE") {
      patch.location =
        next.location === undefined ? FieldValue.delete() : next.location;
      patch.message =
        next.message === undefined ? FieldValue.delete() : next.message;
      patch.logisticsNote =
        next.logisticsNote === undefined
          ? FieldValue.delete()
          : next.logisticsNote;
    }

    // Read the child timeline target before any write so the timeline update
    // commits atomically with the appointment state.
    let studentRef: DocumentReference | undefined;
    let nisehaDate: string | undefined;
    if (input.action === "COMPLETE" && record.type === "NISEHA") {
      nisehaDate =
        input.lastNisehaDate ||
        toEastAfricaDateOnly(next.scheduledAt) ||
        getTodayEastAfricaDate();

      const timelineSnap = await transaction.get(
        adminDb
          .collection(STUDENTS)
          .where("uid", "==", record.childUid)
          .limit(1)
      );
      if (!timelineSnap.empty) {
        studentRef = timelineSnap.docs[0].ref;
      }
    }

    transaction.set(appointmentRef, patch, { merge: true });
    transaction.set(eventRef, event);
    transaction.set(operationRef, operation);
    transaction.set(
      adminDb.collection("Notifications").doc(notification.id),
      notification
    );

    if (studentRef && nisehaDate) {
      transaction.update(studentRef, {
        lastNisehaDate: nisehaDate,
        updatedAt,
      });
    }

    result = { appointment: nextRecord, event, notification };
  });

  if (duplicateOperation) {
    const appointmentSnap = await appointmentRef.get();
    if (!appointmentSnap.exists) {
      throw new AppointmentError("ቀጠሮ አልተገኘም", "NOT_FOUND", 404);
    }
    const record = normalizeAppointment(toAppointment(appointmentSnap));
    const eventSnap = await eventRef.get();

    return {
      success: true,
      appointment: record,
      event: eventSnap.exists
        ? (eventSnap.data() as AppointmentEvent)
        : undefined,
      availableActions: record.identityConsistent
        ? getAvailableAppointmentActions(record, actor)
        : [],
      duplicate: true,
    };
  }

  if (!result) {
    throw new AppointmentError("ቀጠሮው አልተዘመነም", "INTERNAL_ERROR", 500);
  }

  await deliverNotification(result.notification);
  await broadcastAppointmentToParties(result.appointment, {
    type: "appointment.upsert",
    appointment: result.appointment,
  });

  return {
    success: true,
    appointment: result.appointment,
    event: result.event,
    availableActions: getAvailableAppointmentActions(result.appointment, actor),
  };
}

function syntheticCreatedEvent(record: AppointmentRecord): AppointmentEvent {
  return {
    id: `${record.id}__created`,
    appointmentId: record.id,
    operationId: "legacy-created",
    eventType: "CREATED",
    actorUid: record.originalRequesterUid,
    actorRole: record.createdByRole,
    actorNameSnapshot:
      record.createdByRole === "FATHER"
        ? record.fatherName || "አባት"
        : record.childName || "ልጅ",
    previousStatus: null,
    newStatus: "REQUESTED",
    newScheduledAt: record.scheduledAt,
    version: 1,
    createdAt: record.createdAt,
  };
}

export async function getAppointmentDetail(params: {
  appointmentId: string;
  actorUid: string;
  actorRole: string;
  familyId: string;
}): Promise<AppointmentDetailResponse> {
  const actor = actorFromSession(params.actorUid, params.actorRole);
  const { appointmentId, familyId } = params;

  const snap = await adminDb
    .collection(APPOINTMENTS)
    .doc(appointmentId)
    .get();
  if (!snap.exists) {
    throw new AppointmentError("ቀጠሮ አልተገኘም", "NOT_FOUND", 404);
  }

  const raw = toAppointment(snap);
  if (raw.familyId !== familyId) {
    throw new AppointmentError("የቤተሰብ ገደብ ተጥሷል", "FAMILY_ISOLATION", 403);
  }

  const record = normalizeAppointment(raw);
  if (
    !isAppointmentParty(record, actor.uid) ||
    !actorMatchesParty(record, actor)
  ) {
    throw new AppointmentError(
      "ይህ ቀጠሮ የእርስዎ አይደለም",
      "FORBIDDEN",
      403
    );
  }

  // A Father must not see an appointment whose child has not claimed/linked.
  // This also blocks direct detail deep links and history requests for such
  // records. Student actors are intentionally unaffected.
  if (actor.role === "FATHER") {
    const childSnap = await adminDb
      .collection(STUDENTS)
      .where("uid", "==", record.childUid)
      .limit(1)
      .get();
    assertFatherChildEligible(
      childSnap.empty ? undefined : childSnap.docs[0].data(),
      familyId
    );
  }

  const [eventSnap, father, child] = await Promise.all([
    snap.ref.collection(EVENTS).limit(200).get(),
    getFatherProfile(record.fatherUid, record.fatherName),
    getChildParticipant(record.childUid, record.childName),
  ]);

  const storedEvents = eventSnap.docs
    .map((doc) => doc.data() as AppointmentEvent)
    .sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const events =
    storedEvents.length > 0 ? storedEvents : [syntheticCreatedEvent(record)];

  return {
    success: true,
    appointment: record,
    events,
    participants: { father, child },
    availableActions: record.identityConsistent
      ? getAvailableAppointmentActions(record, actor)
      : [],
  };
}

export async function getAppointmentHistory(params: {
  appointmentId: string;
  actorUid: string;
  actorRole: string;
  familyId: string;
}): Promise<AppointmentHistoryResponse> {
  const detail = await getAppointmentDetail(params);
  return {
    success: true,
    appointmentId: detail.appointment.id,
    events: detail.events,
  };
}

export async function listAppointments(params: {
  actorUid: string;
  actorRole: string;
  familyId: string;
}): Promise<AppointmentRecord[]> {
  const actor = actorFromSession(params.actorUid, params.actorRole);
  const { familyId } = params;

  const snap = await adminDb
    .collection(APPOINTMENTS)
    .where("familyId", "==", familyId)
    .limit(200)
    .get();

  let items = snap.docs
    .map((doc) => normalizeAppointment(toAppointment(doc)));

  if (actor.role === "STUDENT") {
    items = items.filter((item) => item.childUid === actor.uid);
  } else {
    // The Father's list is scoped to claimed children with a linked uid.
    // listFamilyChildren applies that same rule; use it as the authority so
    // unmatched/synthetic entries cannot resurrect ineligible appointments.
    const eligibleChildren = await listFamilyChildren(familyId);
    const eligibleUids = new Set(eligibleChildren.map((child) => child.uid));
    items = items.filter((item) => eligibleUids.has(item.childUid));
  }

  items.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return items;
}

export async function listFamilyChildren(
  familyId: string
): Promise<AppointmentChildDirectoryEntry[]> {
  const snap = await adminDb
    .collection(STUDENTS)
    .where("fatherId", "==", familyId)
    .get();

  return snap.docs
    .map((doc) => ({ doc, data: doc.data() }))
    // F1: enforce the shared strict rule on the raw identity fields. Malformed
    // claim values or whitespace-only/missing uids are never promoted to true.
    .filter(({ data }) => isClaimedWithLinkedUid(data))
    .map(({ doc, data }) => ({
      uid: data.uid as string,
      eotcUid: (data.eotcUid as string) || doc.id,
      displayName: childDisplayName(data),
      photoUrl: (data.photoUrl as string) || undefined,
      spiritualTitle: (data.spiritualTitle as string) || undefined,
      lastNisehaDate: (data.lastNisehaDate as string) || undefined,
      // Only strictly eligible entries reach this map, so the marker is a
      // deliberate response-contract value, not a coerced raw field.
      accountClaimed: true as const,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "am"));
}

export type { AppointmentAction };
