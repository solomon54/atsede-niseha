import assert from "node:assert/strict";
import test from "node:test";

import { getAppointmentIdentityDisplay } from "../identity";
import { normalizeAppointment } from "../legacy";
import type { Appointment, AppointmentParticipant } from "../types";

function record(overrides: Partial<Appointment>) {
  return normalizeAppointment({
    id: "apt-1",
    familyId: "fam-1",
    fatherUid: "father-1",
    childUid: "child-1",
    type: "NISEHA",
    status: "REQUESTED",
    scheduledAt: "2026-12-01T07:00:00.000Z",
    createdBy: "father-1",
    createdByRole: "FATHER",
    direction: "FATHER_TO_CHILD",
    originalRequesterUid: "father-1",
    currentProposerUid: "father-1",
    pendingResponseFrom: "child-1",
    updatedBy: "father-1",
    createdAt: "2026-11-01T07:00:00.000Z",
    updatedAt: "2026-11-02T07:00:00.000Z",
    version: 1,
    ...overrides,
  } as Appointment);
}

const participants = {
  father: {
    uid: "father-1",
    role: "FATHER",
    displayName: "Father",
  },
  child: {
    uid: "child-1",
    role: "CHILD",
    displayName: "Child",
  },
} satisfies {
  father: AppointmentParticipant;
  child: AppointmentParticipant;
};

test("identity: father-created request uses authoritative UIDs for every role", () => {
  const display = getAppointmentIdentityDisplay(record({}), participants);

  assert.equal(display.subject.uid, "child-1");
  assert.deepEqual(
    display.groups.map((group) => [group.participant.uid, group.roles]),
    [
      ["father-1", ["ORIGINAL_REQUESTER", "CURRENT_PROPOSER", "LAST_ACTOR"]],
      ["child-1", ["RECIPIENT", "PENDING_RESPONDER"]],
    ]
  );
});

test("identity: child-created request flips requester and responder without name inference", () => {
  const display = getAppointmentIdentityDisplay(
    record({
      createdBy: "child-1",
      createdByRole: "STUDENT",
      direction: "CHILD_TO_FATHER",
      originalRequesterUid: "child-1",
      currentProposerUid: "child-1",
      pendingResponseFrom: "father-1",
      updatedBy: "child-1",
    }),
    participants
  );

  assert.equal(display.subject.uid, "child-1");
  assert.deepEqual(
    display.groups.map((group) => [group.participant.uid, group.roles]),
    [
      ["father-1", ["RECIPIENT", "PENDING_RESPONDER"]],
      ["child-1", ["ORIGINAL_REQUESTER", "CURRENT_PROPOSER", "LAST_ACTOR"]],
    ]
  );
});
