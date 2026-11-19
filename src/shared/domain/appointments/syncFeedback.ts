// src/shared/domain/appointments/syncFeedback.ts
/**
 * Pure, framework-free appointment synchronization feedback.
 *
 * This module only interprets authoritative outbox state for display. It never
 * changes queue status, retry policy, or appointment lifecycle semantics.
 */

import { APPOINTMENT_SYNC_FEEDBACK, getQueuedActionLabel } from "./terminology";
import type { AppointmentAction, AppointmentQueueStatus } from "./types";

export type AppointmentSyncFeedbackTone =
  | "none"
  | "confirmed"
  | "queued"
  | "sending"
  | "retry"
  | "attention";

export interface AppointmentSyncQueueState {
  status?: AppointmentQueueStatus | string;
  action?: AppointmentAction;
  needsAttention?: boolean | number;
  nextRetryAt?: string;
  lastError?: string;
  lastErrorCode?: string;
}

export interface AppointmentDrainSummary {
  ran: boolean;
  processed: number;
  failed: number;
  needsAuth: boolean;
  remaining: number;
}

export interface AppointmentSyncFeedback {
  tone: AppointmentSyncFeedbackTone;
  /** Compact label for rows and badges. */
  label: string;
  /** One-sentence explanation for action feedback and detail banners. */
  detail: string;
}

export interface AppointmentSyncFeedbackInput {
  row?: AppointmentSyncQueueState | null;
  /** True when this action was just written to the outbox. */
  queuedLocally?: boolean;
  drain?: AppointmentDrainSummary | null;
  isOnline?: boolean;
  now?: number;
}

function withAction(row: AppointmentSyncQueueState, detail: string): string {
  const action = row.action ? getQueuedActionLabel(row.action) : "";
  return action ? `${action} — ${detail}` : detail;
}

function isAuthFailure(
  row: AppointmentSyncQueueState | null | undefined,
  drain?: AppointmentDrainSummary | null
): boolean {
  const code = (row?.lastErrorCode || "").toUpperCase();
  return (
    Boolean(drain?.needsAuth) ||
    code === "UNAUTHORIZED" ||
    code === "HTTP_401" ||
    code.includes("UNAUTHORIZED")
  );
}

function isConflict(code: string): boolean {
  return code === "HTTP_409" || code.includes("CONFLICT");
}

/**
 * Derive user-facing delivery feedback from an outbox row. The row remains the
 * single source of truth: an absent row after a locally queued action means
 * the existing drain logic confirmed completion and removed it.
 */
export function getAppointmentSyncFeedback(
  input: AppointmentSyncFeedbackInput
): AppointmentSyncFeedback {
  const {
    row,
    queuedLocally = false,
    drain,
    isOnline = true,
    now = Date.now(),
  } = input;

  if (!row) {
    if (queuedLocally) {
      return {
        tone: "confirmed",
        label: APPOINTMENT_SYNC_FEEDBACK.confirmed,
        detail: APPOINTMENT_SYNC_FEEDBACK.confirmedDetail,
      };
    }
    return {
      tone: "none",
      label: APPOINTMENT_SYNC_FEEDBACK.noPending,
      detail: APPOINTMENT_SYNC_FEEDBACK.noPending,
    };
  }

  if (isAuthFailure(row, drain)) {
    return {
      tone: "attention",
      label: APPOINTMENT_SYNC_FEEDBACK.authNeeded,
      detail: withAction(
        row,
        row.lastError || APPOINTMENT_SYNC_FEEDBACK.authNeededDetail
      ),
    };
  }

  if (row.status === "FAILED" && Boolean(row.needsAttention)) {
    const code = (row.lastErrorCode || "").toUpperCase();
    const conflict = isConflict(code);
    return {
      tone: "attention",
      label: conflict
        ? APPOINTMENT_SYNC_FEEDBACK.conflict
        : APPOINTMENT_SYNC_FEEDBACK.rejected,
      detail: withAction(
        row,
        row.lastError ||
          (conflict
            ? APPOINTMENT_SYNC_FEEDBACK.conflictDetail
            : APPOINTMENT_SYNC_FEEDBACK.rejectedDetail)
      ),
    };
  }

  if (row.status === "SENDING") {
    return {
      tone: "sending",
      label: APPOINTMENT_SYNC_FEEDBACK.sending,
      detail: withAction(row, APPOINTMENT_SYNC_FEEDBACK.sendingDetail),
    };
  }

  if (row.status === "QUEUED" && row.nextRetryAt) {
    const retryAt = Date.parse(row.nextRetryAt);
    if (Number.isFinite(retryAt) && retryAt > now) {
      return {
        tone: "retry",
        label: APPOINTMENT_SYNC_FEEDBACK.retryWaiting,
        detail: withAction(
          row,
          row.lastError || APPOINTMENT_SYNC_FEEDBACK.retryWaitingDetail
        ),
      };
    }
  }

  if (row.status === "QUEUED") {
    return {
      tone: "queued",
      label: isOnline
        ? APPOINTMENT_SYNC_FEEDBACK.queuedWaiting
        : APPOINTMENT_SYNC_FEEDBACK.queuedOffline,
      detail: withAction(
        row,
        isOnline
          ? APPOINTMENT_SYNC_FEEDBACK.queuedWaitingDetail
          : APPOINTMENT_SYNC_FEEDBACK.queuedOfflineDetail
      ),
    };
  }

  if (row.status === "FAILED") {
    return {
      tone: "retry",
      label: APPOINTMENT_SYNC_FEEDBACK.retryWaiting,
      detail: withAction(
        row,
        row.lastError || APPOINTMENT_SYNC_FEEDBACK.retryWaitingDetail
      ),
    };
  }

  return {
    tone: "none",
    label: APPOINTMENT_SYNC_FEEDBACK.noPending,
    detail: APPOINTMENT_SYNC_FEEDBACK.noPending,
  };
}
