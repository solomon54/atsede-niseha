import assert from "node:assert/strict";
import test from "node:test";

import { getAppointmentSyncFeedback } from "../syncFeedback";
import { APPOINTMENT_SYNC_FEEDBACK } from "../terminology";

test("queued appointment action is never reported as server-confirmed", () => {
  const queued = getAppointmentSyncFeedback({
    row: { status: "QUEUED", action: "CONFIRM" },
    isOnline: false,
  });
  assert.equal(queued.tone, "queued");
  assert.equal(queued.label, APPOINTMENT_SYNC_FEEDBACK.queuedOffline);
  assert.match(queued.detail, /ገና አልተመዘገበም/);

  const waiting = getAppointmentSyncFeedback({
    row: { status: "QUEUED", action: "CONFIRM" },
    isOnline: true,
  });
  assert.equal(waiting.tone, "queued");
  assert.equal(waiting.label, APPOINTMENT_SYNC_FEEDBACK.queuedWaiting);
});

test("sending and retry-waiting states remain distinct", () => {
  const sending = getAppointmentSyncFeedback({
    row: { status: "SENDING", action: "CANCEL" },
    isOnline: true,
  });
  assert.equal(sending.tone, "sending");

  const retry = getAppointmentSyncFeedback({
    row: {
      status: "QUEUED",
      action: "CANCEL",
      nextRetryAt: "2999-01-01T00:00:00.000Z",
      lastError: "ጊዜያዊ የአገልጋይ ችግር።",
    },
    isOnline: true,
    now: Date.parse("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(retry.tone, "retry");
  assert.equal(retry.label, APPOINTMENT_SYNC_FEEDBACK.retryWaiting);
});

test("conflict, rejection, and authentication failures are not success", () => {
  const conflict = getAppointmentSyncFeedback({
    row: {
      status: "FAILED",
      action: "RESCHEDULE",
      needsAttention: true,
      lastErrorCode: "HTTP_409",
      lastError: "የቀጠሮው ስሪት ተቀይሯል።",
    },
  });
  assert.equal(conflict.tone, "attention");
  assert.equal(conflict.label, APPOINTMENT_SYNC_FEEDBACK.conflict);
  assert.match(conflict.detail, /የቀጠሮው ስሪት ተቀይሯል/);

  const rejected = getAppointmentSyncFeedback({
    row: {
      status: "FAILED",
      action: "COMPLETE",
      needsAttention: true,
      lastErrorCode: "HTTP_403",
    },
  });
  assert.equal(rejected.tone, "attention");
  assert.equal(rejected.label, APPOINTMENT_SYNC_FEEDBACK.rejected);

  const auth = getAppointmentSyncFeedback({
    row: { status: "QUEUED", action: "CONFIRM", lastErrorCode: "UNAUTHORIZED" },
    drain: {
      ran: true,
      processed: 0,
      failed: 0,
      needsAuth: true,
      remaining: 1,
    },
  });
  assert.equal(auth.tone, "attention");
  assert.equal(auth.label, APPOINTMENT_SYNC_FEEDBACK.authNeeded);
});

test("removed outbox row after a queued action means server confirmation", () => {
  const confirmed = getAppointmentSyncFeedback({
    row: null,
    queuedLocally: true,
    drain: {
      ran: true,
      processed: 1,
      failed: 0,
      needsAuth: false,
      remaining: 0,
    },
  });
  assert.equal(confirmed.tone, "confirmed");
  assert.equal(confirmed.label, APPOINTMENT_SYNC_FEEDBACK.confirmed);

  const noPending = getAppointmentSyncFeedback({ row: null });
  assert.equal(noPending.tone, "none");
  assert.equal(noPending.label, APPOINTMENT_SYNC_FEEDBACK.noPending);
});
