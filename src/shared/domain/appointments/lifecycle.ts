// src/shared/domain/appointments/lifecycle.ts
import {
  getOtherPartyUid,
  getPartyRole,
  isAppointmentParty,
  isTerminalAppointmentStatus,
} from "./legacy";
import type {
  AppointmentAction,
  AppointmentActionPayload,
  AppointmentActor,
  AppointmentPartyRole,
  AppointmentRecord,
  AppointmentStatus,
} from "./types";

export type AppointmentTransitionErrorCode =
  | "INCONSISTENT_RECORD"
  | "FORBIDDEN"
  | "TERMINAL_STATE"
  | "WRONG_STATUS"
  | "NOT_PENDING_RESPONDER"
  | "INVALID_SCHEDULE";

export type AppointmentTransitionResult =
  | { ok: true }
  | { ok: false; code: AppointmentTransitionErrorCode; message: string };

const TERMINAL_MESSAGE = "ይህ ቀጠሮ በመጨረሻ ሁኔታ ላይ ስለሆነ ሊቀየር አይችልም።";
const FORBIDDEN_MESSAGE = "ይህን ቀጠሮ ለመቀየር ፈቃድ የለዎትም።";
const PENDING_MESSAGE = "ምላሹ የሚጠበቅበት ተጠቃሚ ብቻ ነው ይህን ማድረግ የሚችለው።";

export function getPendingResponder(
  record: AppointmentRecord
): string | undefined {
  if (record.status !== "REQUESTED") return undefined;
  return (
    record.pendingResponseFrom ||
    getOtherPartyUid(record, record.currentProposerUid)
  );
}

export function getCurrentRecipient(
  record: AppointmentRecord
): string | undefined {
  if (record.status !== "REQUESTED") return undefined;
  return getPendingResponder(record);
}

export function getOriginalRequester(
  record: AppointmentRecord
): string {
  return record.originalRequesterUid;
}

export function actorMatchesParty(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  if (actor.role === "FATHER") return actor.uid === record.fatherUid;
  if (actor.role === "STUDENT") return actor.uid === record.childUid;
  return false;
}

function validateBase(
  record: AppointmentRecord,
  actor: AppointmentActor
): AppointmentTransitionResult | null {
  if (!record.identityConsistent) {
    return {
      ok: false,
      code: "INCONSISTENT_RECORD",
      message:
        "የቀጠሮው ማንነት መረጃ ወጥነት የለውም። እባክዎ አስተዳዳሪን ያግኙ።",
    };
  }

  if (!isAppointmentParty(record, actor.uid) || !actorMatchesParty(record, actor)) {
    return { ok: false, code: "FORBIDDEN", message: FORBIDDEN_MESSAGE };
  }

  if (isTerminalAppointmentStatus(record.status)) {
    return { ok: false, code: "TERMINAL_STATE", message: TERMINAL_MESSAGE };
  }

  return null;
}

export function canActorConfirm(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  return validateAppointmentTransition(record, actor, "CONFIRM").ok;
}

export function canActorDecline(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  return validateAppointmentTransition(record, actor, "DECLINE").ok;
}

export function canActorCancel(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  return validateAppointmentTransition(record, actor, "CANCEL").ok;
}

export function canActorReschedule(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  return validateAppointmentTransition(record, actor, "RESCHEDULE").ok;
}

export function canActorComplete(
  record: AppointmentRecord,
  actor: AppointmentActor
): boolean {
  return validateAppointmentTransition(record, actor, "COMPLETE").ok;
}

export function validateAppointmentTransition(
  record: AppointmentRecord,
  actor: AppointmentActor,
  action: AppointmentAction
): AppointmentTransitionResult {
  const base = validateBase(record, actor);
  if (base) return base;

  switch (action) {
    case "CONFIRM":
    case "DECLINE": {
      if (record.status !== "REQUESTED") {
        return {
          ok: false,
          code: "WRONG_STATUS",
          message: "የምላሽ ጥያቄ ያለው ቀጠሮ ብቻ ማረጋገጥ ወይም አለመቀበል ይችላል።",
        };
      }
      if (getPendingResponder(record) !== actor.uid) {
        return { ok: false, code: "NOT_PENDING_RESPONDER", message: PENDING_MESSAGE };
      }
      return { ok: true };
    }

    case "RESCHEDULE":
      if (record.status !== "CONFIRMED") {
        return {
          ok: false,
          code: "WRONG_STATUS",
          message: "የተረጋገጠ ቀጠሮ ብቻ አዲስ ሰዓት ሊቀርብለት ይችላል።",
        };
      }
      return { ok: true };

    case "CANCEL":
      if (record.status !== "REQUESTED" && record.status !== "CONFIRMED") {
        return {
          ok: false,
          code: "WRONG_STATUS",
          message: "ይህ ቀጠሮ ሊሰረዝ አይችልም።",
        };
      }
      return { ok: true };

    case "COMPLETE":
      if (record.status !== "CONFIRMED") {
        return {
          ok: false,
          code: "WRONG_STATUS",
          message: "የተረጋገጠ ቀጠሮ ብቻ እንደተጠናቀቀ ሊመዘገብ ይችላል።",
        };
      }
      if (actor.role !== "FATHER" || actor.uid !== record.fatherUid) {
        return { ok: false, code: "FORBIDDEN", message: FORBIDDEN_MESSAGE };
      }
      return { ok: true };

    default:
      return {
        ok: false,
        code: "WRONG_STATUS",
        message: "ያልታወቀ እርምጃ።",
      };
  }
}

export function getAvailableAppointmentActions(
  record: AppointmentRecord,
  actor: AppointmentActor
): AppointmentAction[] {
  const actions: AppointmentAction[] = [];
  if (canActorConfirm(record, actor)) actions.push("CONFIRM");
  if (canActorDecline(record, actor)) actions.push("DECLINE");
  if (canActorReschedule(record, actor)) actions.push("RESCHEDULE");
  if (canActorCancel(record, actor)) actions.push("CANCEL");
  if (canActorComplete(record, actor)) actions.push("COMPLETE");
  return actions;
}

export interface AppointmentNextState {
  status: AppointmentStatus;
  scheduledAt: string;
  location?: string;
  message?: string;
  logisticsNote?: string;
  currentProposerUid: string;
  pendingResponseFrom?: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
}

export type AppointmentActionApplication =
  | {
      ok: true;
      previousStatus: AppointmentStatus;
      previousScheduledAt: string;
      next: AppointmentNextState;
    }
  | { ok: false; code: AppointmentTransitionErrorCode; message: string };

/**
 * Pure state calculation for an authorized action. The server persists this;
 * clients never apply it as if it were server-confirmed.
 */
export function applyAppointmentAction(
  record: AppointmentRecord,
  actor: AppointmentActor,
  action: AppointmentAction,
  input: AppointmentActionPayload,
  now: Date = new Date()
): AppointmentActionApplication {
  const validation = validateAppointmentTransition(record, actor, action);
  if (!validation.ok) return validation;

  const updatedAt = now.toISOString();
  const previousStatus = record.status;
  const previousScheduledAt = record.scheduledAt;

  const next: AppointmentNextState = {
    status: record.status,
    scheduledAt: record.scheduledAt,
    location: record.location,
    message: record.message,
    logisticsNote: record.logisticsNote,
    currentProposerUid: record.currentProposerUid,
    pendingResponseFrom: record.pendingResponseFrom,
    updatedBy: actor.uid,
    updatedAt,
    version: record.version + 1,
  };

  switch (action) {
    case "CONFIRM":
      next.status = "CONFIRMED";
      next.pendingResponseFrom = undefined;
      break;

    case "DECLINE":
      next.status = "DECLINED";
      next.pendingResponseFrom = undefined;
      break;

    case "CANCEL":
      next.status = "CANCELLED";
      next.pendingResponseFrom = undefined;
      break;

    case "COMPLETE":
      next.status = "COMPLETED";
      next.pendingResponseFrom = undefined;
      break;

    case "RESCHEDULE": {
      if (!input.scheduledAt) {
        return {
          ok: false,
          code: "INVALID_SCHEDULE",
          message: "አዲስ የቀንና ሰዓት መረጃ ያስፈልጋል።",
        };
      }
      const parsed = new Date(input.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return {
          ok: false,
          code: "INVALID_SCHEDULE",
          message: "የቀንና ሰዓት መረጃው ትክክል አይደለም።",
        };
      }

      next.status = "REQUESTED";
      next.scheduledAt = parsed.toISOString();
      next.currentProposerUid = actor.uid;
      next.pendingResponseFrom =
        getOtherPartyUid(record, actor.uid) || undefined;
      if (input.location !== undefined) {
        next.location = input.location.trim() || undefined;
      }
      if (input.message !== undefined) {
        next.message = input.message.trim() || undefined;
        next.logisticsNote = next.message;
      }
      break;
    }
  }

  return { ok: true, previousStatus, previousScheduledAt, next };
}

export function getPartyLabelForUid(
  record: AppointmentRecord,
  uid: string | undefined
): AppointmentPartyRole | null {
  if (!uid) return null;
  return getPartyRole(record, uid);
}
