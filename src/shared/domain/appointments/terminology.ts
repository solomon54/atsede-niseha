// src/shared/domain/appointments/terminology.ts
/**
 * Canonical appointment vocabulary shared by Web and Android.
 *
 * Both clients must render the same meaning for the same status, type, action,
 * and notification event. Keep this module free of UI framework imports so the
 * server, Web, and React Native can all use it.
 */

import type {
  AppointmentAction,
  AppointmentActorRole,
  AppointmentDirection,
  AppointmentEventType,
  AppointmentPartyRole,
  AppointmentRecord,
  AppointmentStatus,
  AppointmentType,
} from "./types";

export type AppointmentStatusTone =
  | "pending"
  | "positive"
  | "negative"
  | "neutral"
  | "muted";

export interface AppointmentStatusTerm {
  label: string;
  /** Short sentence explaining what the status means. */
  description: string;
  /** Semantic colour role; each platform maps it to native colours. */
  tone: AppointmentStatusTone;
}

export const APPOINTMENT_STATUS_TERMS: Record<
  AppointmentStatus,
  AppointmentStatusTerm
> = {
  REQUESTED: {
    label: "ተጠይቋል",
    description: "የቀጠሮ ጥያቄው ተልኳል፤ የሌላው ወገን ምላሽ ይጠበቃል።",
    tone: "pending",
  },
  CONFIRMED: {
    label: "ተረጋግጧል",
    description: "ሁለቱም ወገኖች ቀጠሮውን አረጋግጠዋል።",
    tone: "positive",
  },
  DECLINED: {
    label: "ተቀባይነት አላገኘም",
    description: "የቀጠሮ ጥያቄው ተቀባይነት አላገኘም።",
    tone: "negative",
  },
  COMPLETED: {
    label: "ተጠናቋል",
    description: "ቀጠሮው ተጠናቋል።",
    tone: "neutral",
  },
  CANCELLED: {
    label: "ተሰርዟል",
    description: "ቀጠሮው ተሰርዟል።",
    tone: "muted",
  },
};

export const APPOINTMENT_TYPE_TERMS: Record<AppointmentType, string> = {
  NISEHA: "ንስሐ",
  COUNSELING: "ምክክር",
};

export const APPOINTMENT_TYPE_DESCRIPTIONS: Record<AppointmentType, string> = {
  NISEHA: "ለግል ንስሐ የሚዘጋጅ ቀጠሮ።",
  COUNSELING: "ለመንፈሳዊ ምክክር የሚዘጋጅ ቀጠሮ።",
};

export const APPOINTMENT_ACTION_TERMS: Record<AppointmentAction, string> = {
  CONFIRM: "አረጋግጥ",
  DECLINE: "አትቀበል",
  RESCHEDULE: "ቀን ቀይር",
  CANCEL: "ሰርዝ",
  COMPLETE: "ተጠናቋል",
};

export const APPOINTMENT_PARTY_TERMS: Record<AppointmentPartyRole, string> = {
  FATHER: "አባት",
  CHILD: "ልጅ",
};

export const APPOINTMENT_ACTOR_ROLE_TERMS: Record<
  AppointmentActorRole,
  string
> = {
  FATHER: "አባት",
  STUDENT: "ልጅ",
};

export const APPOINTMENT_DIRECTION_TERMS: Record<
  AppointmentDirection,
  string
> = {
  FATHER_TO_CHILD: "ከአባት የተላከ",
  CHILD_TO_FATHER: "ከልጅ የተላከ",
};

/** Shown wherever appointments are created or read. */
export const APPOINTMENT_SACRAMENT_NOTE =
  "ቀጠሮው ለግል ንስሐ የሚዘጋጅ ሲሆን መተግበሪያው ራሱ ምሥጢረ ንስሐ አይደለም።";

export const APPOINTMENT_OFFLINE_CREATE_MESSAGE =
  "አዲስ ቀጠሮ መመዝገብ በመስመር ላይ ብቻ ይቻላል። እባክዎ ግንኙነትዎን ያረጋግጡ።";

export const APPOINTMENT_TERMINAL_MESSAGE =
  "ይህ ቀጠሮ በመጨረሻ ሁኔታ ላይ ስለሆነ ሊቀየር አይችልም።";

export const APPOINTMENT_INCONSISTENT_MESSAGE =
  "የቀጠሮው ማንነት መረጃ ወጥነት የለውም። እባክዎ አስተዳዳሪን ያግኙ።";

export function getAppointmentStatusTerm(
  status: AppointmentStatus
): AppointmentStatusTerm {
  return APPOINTMENT_STATUS_TERMS[status];
}

export function getAppointmentTypeTerm(type: AppointmentType): string {
  return APPOINTMENT_TYPE_TERMS[type];
}

export function getAppointmentActionTerm(action: AppointmentAction): string {
  return APPOINTMENT_ACTION_TERMS[action];
}

export function getAppointmentPartyTerm(
  party: AppointmentPartyRole
): string {
  return APPOINTMENT_PARTY_TERMS[party];
}

/**
 * Human-readable description of who must act next. Never guess outside the
 * stored pending responder.
 */
export function getAppointmentWaitingLabel(
  record: AppointmentRecord,
  viewerUid: string | undefined
): string {
  if (record.status === "REQUESTED") {
    const pendingResponder = record.pendingResponseFrom;
    if (!pendingResponder) return "ምላሽ ይጠበቃል";
    return pendingResponder === viewerUid
      ? "እርስዎ ምላሽ መስጠት ይኖርብዎታል"
      : "የሌላው ወገን ምላሽ ይጠበቃል";
  }
  if (record.status === "CONFIRMED") {
    return "ቀጠሮው ተረጋግጧል";
  }
  return "";
}

/**
 * Immutable origin wording. Rescheduling changes the current proposer, but the
 * original requester must always be reported accurately.
 */
export function getAppointmentOriginLabel(record: AppointmentRecord): string {
  return APPOINTMENT_DIRECTION_TERMS[record.direction];
}

export function getAppointmentSubjectName(
  record: AppointmentRecord
): string {
  return record.childName?.trim() || "ልጅ";
}

export interface AppointmentNotificationCopy {
  title: string;
  body: string;
}

/**
 * Deterministic notification copy.
 *
 * Intentionally excludes `message`, `logisticsNote`, and every free-text field
 * that could carry confidential content. The caller supplies an already
 * formatted schedule label so this module stays timezone-agnostic.
 */
export function buildAppointmentNotificationCopy(input: {
  eventType: AppointmentEventType;
  actorName: string;
  actorParty: AppointmentPartyRole;
  subjectName: string;
  type: AppointmentType;
  scheduledLabel?: string;
}): AppointmentNotificationCopy {
  const typeLabel = getAppointmentTypeTerm(input.type);
  const subject = input.subjectName.trim() || "ልጅ";
  const actor = input.actorName.trim() || APPOINTMENT_PARTY_TERMS[input.actorParty];
  const schedule = input.scheduledLabel ? ` (${input.scheduledLabel})` : "";

  switch (input.eventType) {
    case "CREATED":
      if (input.actorParty === "FATHER") {
        return {
          title: "ከአባት የመጣ የቀጠሮ ጥሪ",
          body: `${actor} ለ${subject} የ${typeLabel} ቀጠሮ ጠርተዋል${schedule}።`,
        };
      }
      return {
        title: "ከልጅ የመጣ የቀጠሮ ጥያቄ",
        body: `${actor} የ${typeLabel} ቀጠሮ ጠይቀዋል${schedule}።`,
      };

    case "CONFIRMED":
      return {
        title: "ቀጠሮ ተረጋግጧል",
        body: `${actor} የ${subject}ን የ${typeLabel} ቀጠሮ አረጋግጧል${schedule}።`,
      };

    case "DECLINED":
      return {
        title: "ቀጠሮ ተቀባይነት አላገኘም",
        body: `${actor} የ${subject} የ${typeLabel} ቀጠሮ ጥያቄ አልተቀበለም${schedule}።`,
      };

    case "RESCHEDULED":
      return {
        title: "አዲስ የቀጠሮ ሰዓት ቀርቧል",
        body: `${actor} ለ${subject} አዲስ የ${typeLabel} ቀጠሮ ሰዓት አቅርቧል${schedule}። ምላሽዎ ይጠበቃል።`,
      };

    case "CANCELLED":
      return {
        title: "ቀጠሮ ተሰርዟል",
        body: `${actor} የ${subject}ን የ${typeLabel} ቀጠሮ ሰርዟል${schedule}።`,
      };

    case "COMPLETED":
      return {
        title: "ቀጠሮ ተጠናቋል",
        body: `${actor} የ${subject}ን የ${typeLabel} ቀጠሮ እንደተጠናቀቀ መዝግቧል${schedule}።`,
      };

    default:
      return {
        title: "የቀጠሮ ማሳወቂያ",
        body: `${subject} — ${typeLabel}${schedule}።`,
      };
  }
}

export function getAppointmentEventTerm(
  eventType: AppointmentEventType
): string {
  switch (eventType) {
    case "CREATED":
      return "ተፈጠረ";
    case "CONFIRMED":
      return "ተረጋገጠ";
    case "DECLINED":
      return "አልተቀበለም";
    case "RESCHEDULED":
      return "አዲስ ሰዓት ተወሰነ";
    case "CANCELLED":
      return "ተሰረዘ";
    case "COMPLETED":
      return "ተጠናቀቀ";
    default:
      return "ተዘመነ";
  }
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_TERMS[status].label;
}

export function getAppointmentTypeLabel(type: AppointmentType): string {
  return APPOINTMENT_TYPE_TERMS[type];
}

export function getQueuedActionLabel(action: AppointmentAction): string {
  return APPOINTMENT_ACTION_TERMS[action];
}

export function formatAppointmentEvent(event: {
  eventType: AppointmentEventType;
  actorNameSnapshot: string;
  actorRole: AppointmentActorRole;
  previousScheduledAt?: string;
  newScheduledAt?: string;
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
}): string {
  const actor = event.actorNameSnapshot?.trim() || APPOINTMENT_ACTOR_ROLE_TERMS[event.actorRole];
  const verb = getAppointmentEventTerm(event.eventType);
  if (event.eventType === "RESCHEDULED" && event.newScheduledAt) {
    return `${actor} ቀጠሮውን ወደ አዲስ ሰዓት አዛውሯል።`;
  }
  return `${actor} ቀጠሮውን ${verb}።`;
}
