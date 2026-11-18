// src/shared/domain/appointments/overview.ts
/**
 * Derived appointment views shared by the Web and Android dashboards.
 *
 * These functions are pure: they never mutate records, never write to a
 * database, and never assume a platform. The caller supplies the current time
 * so the derived "upcoming"/"overdue" split is deterministic and testable.
 */

import { getPendingResponder } from "./lifecycle";
import type {
  AppointmentChildDirectoryEntry,
  AppointmentRecord,
} from "./types";

export function getNowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function getChildDisplayName(record: Pick<AppointmentRecord, "childName">): string {
  return record.childName?.trim() || "ልጅ";
}

export function getFatherDisplayName(record: Pick<AppointmentRecord, "fatherName">): string {
  return record.fatherName?.trim() || "አባት";
}

export function isUpcomingConfirmed(
  record: AppointmentRecord,
  now: Date | string = new Date()
): boolean {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const t = Date.parse(record.scheduledAt);
  return record.status === "CONFIRMED" && !Number.isNaN(t) && t >= nowMs;
}

export function isConfirmedOverdue(
  record: AppointmentRecord,
  now: Date | string = new Date()
): boolean {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const t = Date.parse(record.scheduledAt);
  return record.status === "CONFIRMED" && !Number.isNaN(t) && t < nowMs;
}

export interface AppointmentOverviewSummary {
  total: number;
  requested: number;
  confirmed: number;
  declined: number;
  completed: number;
  cancelled: number;

  /** Requests whose pending responder is the viewer. */
  attentionNeeded: number;
  /** Active requests waiting on the other party. */
  awaitingOtherParty: number;
  /** Confirmed appointments whose scheduled time has passed. */
  overdueConfirmed: number;
  /** Records whose identity fields contradict each other. */
  inconsistent: number;

  nearestUpcomingConfirmed: AppointmentRecord | null;
  nextAttentionNeeded: AppointmentRecord | null;
  lastActivityAt: string | null;
}

export interface AppointmentChildOverview extends AppointmentOverviewSummary {
  child: AppointmentChildDirectoryEntry;
  /** Requests waiting on the viewer, earliest schedule first. */
  attentionRequests: AppointmentRecord[];
}

export interface AppointmentChildOverviewParams {
  appointments: AppointmentRecord[];
  children: AppointmentChildDirectoryEntry[];
  viewerUid: string;
  now?: Date;
}

function scheduleTime(record: AppointmentRecord): number {
  const parsed = Date.parse(record.scheduledAt);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function updateTime(record: AppointmentRecord): number {
  const parsed = Date.parse(record.updatedAt || record.createdAt);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareScheduledAsc(
  a: AppointmentRecord,
  b: AppointmentRecord
): number {
  const delta = scheduleTime(a) - scheduleTime(b);
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

function compareScheduledDesc(
  a: AppointmentRecord,
  b: AppointmentRecord
): number {
  return -compareScheduledAsc(a, b);
}

function isActive(record: AppointmentRecord): boolean {
  return record.status === "REQUESTED" || record.status === "CONFIRMED";
}

/** All appointments for one child, including terminal history. */
export function selectAppointmentsForChild(
  appointments: AppointmentRecord[],
  childUid: string
): AppointmentRecord[] {
  return appointments.filter((record) => record.childUid === childUid);
}

/** Requests that the viewer is personally expected to answer. */
export function selectAttentionRequests(
  appointments: AppointmentRecord[],
  viewerUid: string
): AppointmentRecord[] {
  return appointments
    .filter(
      (record) =>
        record.status === "REQUESTED" &&
        record.identityConsistent &&
        getPendingResponder(record) === viewerUid
    )
    .sort(compareScheduledAsc);
}

/** Confirmed appointments with a future schedule, nearest first. */
export function selectUpcomingConfirmed(
  appointments: AppointmentRecord[],
  now: Date = new Date()
): AppointmentRecord[] {
  const nowMs = now.getTime();
  return appointments
    .filter(
      (record) =>
        record.status === "CONFIRMED" && scheduleTime(record) >= nowMs
    )
    .sort(compareScheduledAsc);
}

/**
 * Confirmed appointments whose scheduled time has passed. They stay separate
 * from "upcoming" so they are never shown as future commitments.
 */
export function selectOverdueConfirmed(
  appointments: AppointmentRecord[],
  now: Date = new Date()
): AppointmentRecord[] {
  const nowMs = now.getTime();
  return appointments
    .filter(
      (record) =>
        record.status === "CONFIRMED" && scheduleTime(record) < nowMs
    )
    .sort(compareScheduledAsc);
}

export function selectNearestUpcomingConfirmed(
  appointments: AppointmentRecord[],
  now: Date = new Date()
): AppointmentRecord | null {
  return selectUpcomingConfirmed(appointments, now)[0] ?? null;
}

/** Active appointments (requested or confirmed), nearest schedule first. */
export function selectActiveAppointments(
  appointments: AppointmentRecord[],
  now: Date = new Date()
): AppointmentRecord[] {
  const nowMs = now.getTime();
  const upcoming = appointments
    .filter(
      (record) => isActive(record) && scheduleTime(record) >= nowMs
    )
    .sort(compareScheduledAsc);
  const overdue = appointments
    .filter(
      (record) => isActive(record) && scheduleTime(record) < nowMs
    )
    .sort(compareScheduledAsc);
  return [...upcoming, ...overdue];
}

/** Terminal appointments (declined, completed, cancelled), newest first. */
export function selectTerminalAppointments(
  appointments: AppointmentRecord[]
): AppointmentRecord[] {
  return appointments
    .filter(
      (record) =>
        record.status === "DECLINED" ||
        record.status === "COMPLETED" ||
        record.status === "CANCELLED"
    )
    .sort(compareScheduledDesc);
}

export function summariseAppointments(
  appointments: AppointmentRecord[],
  viewerUid: string,
  now: Date = new Date()
): AppointmentOverviewSummary {
  let requested = 0;
  let confirmed = 0;
  let declined = 0;
  let completed = 0;
  let cancelled = 0;
  let awaitingOtherParty = 0;
  let inconsistent = 0;
  let lastActivityMs = Number.NEGATIVE_INFINITY;

  for (const record of appointments) {
    switch (record.status) {
      case "REQUESTED":
        requested += 1;
        if (
          !record.identityConsistent ||
          getPendingResponder(record) !== viewerUid
        ) {
          awaitingOtherParty += 1;
        }
        break;
      case "CONFIRMED":
        confirmed += 1;
        break;
      case "DECLINED":
        declined += 1;
        break;
      case "COMPLETED":
        completed += 1;
        break;
      case "CANCELLED":
        cancelled += 1;
        break;
      default:
        break;
    }

    if (!record.identityConsistent) inconsistent += 1;

    const touched = updateTime(record);
    if (touched > lastActivityMs) lastActivityMs = touched;
  }

  const attention = selectAttentionRequests(appointments, viewerUid);
  const overdue = selectOverdueConfirmed(appointments, now);

  return {
    total: appointments.length,
    requested,
    confirmed,
    declined,
    completed,
    cancelled,
    attentionNeeded: attention.length,
    awaitingOtherParty,
    overdueConfirmed: overdue.length,
    inconsistent,
    nearestUpcomingConfirmed: selectNearestUpcomingConfirmed(appointments, now),
    nextAttentionNeeded: attention[0] ?? null,
    lastActivityAt:
      lastActivityMs === Number.NEGATIVE_INFINITY
        ? null
        : new Date(lastActivityMs).toISOString(),
  };
}

function emptySummary(): AppointmentOverviewSummary {
  return {
    total: 0,
    requested: 0,
    confirmed: 0,
    declined: 0,
    completed: 0,
    cancelled: 0,
    attentionNeeded: 0,
    awaitingOtherParty: 0,
    overdueConfirmed: 0,
    inconsistent: 0,
    nearestUpcomingConfirmed: null,
    nextAttentionNeeded: null,
    lastActivityAt: null,
  };
}

/**
 * Child-oriented Father overview. Every directory child is present, even when
 * they have no appointments, so the overview never hides a child.
 */
export function buildChildAppointmentOverviews(
  params: AppointmentChildOverviewParams
): AppointmentChildOverview[] {
  const { appointments, children, viewerUid } = params;
  const now = params.now ?? new Date();

  const byChild = new Map<string, AppointmentRecord[]>();
  for (const record of appointments) {
    const list = byChild.get(record.childUid);
    if (list) {
      list.push(record);
    } else {
      byChild.set(record.childUid, [record]);
    }
  }

  const knownChildren = new Set(children.map((child) => child.uid));
  const overviews: AppointmentChildOverview[] = children.map((child) => {
    const records = byChild.get(child.uid) ?? [];
    const summary = summariseAppointments(records, viewerUid, now);
    return {
      child,
      ...summary,
      attentionRequests: selectAttentionRequests(records, viewerUid),
    };
  });

  // Defensive: an appointment whose child is missing from the directory must
  // still be visible rather than silently disappearing.
  for (const [childUid, records] of byChild) {
    if (knownChildren.has(childUid)) continue;
    const first = records[0];
    overviews.push({
      child: {
        uid: childUid,
        displayName: first.childName?.trim() || "ልጅ",
        eotcUid: first.childEotcUid,
      },
      ...summariseAppointments(records, viewerUid, now),
      attentionRequests: selectAttentionRequests(records, viewerUid),
    });
  }

  return overviews.sort((a, b) => {
    if (a.attentionNeeded !== b.attentionNeeded) {
      return b.attentionNeeded - a.attentionNeeded;
    }
    const aNext = a.nearestUpcomingConfirmed;
    const bNext = b.nearestUpcomingConfirmed;
    if (aNext && bNext) {
      const delta = scheduleTime(aNext) - scheduleTime(bNext);
      if (delta !== 0) return delta;
    } else if (aNext) {
      return -1;
    } else if (bNext) {
      return 1;
    }
    return a.child.displayName.localeCompare(b.child.displayName, "am");
  });
}

export { emptySummary as emptyAppointmentOverviewSummary };
