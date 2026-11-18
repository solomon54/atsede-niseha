/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppointment } from "../legacy";
import {
  applyAppointmentAction,
  getAvailableAppointmentActions,
  getPendingResponder,
  validateAppointmentTransition,
} from "../lifecycle";
import type { Appointment, AppointmentActor, AppointmentRecord } from "../types";

function base(overrides: Partial<Appointment> = {}): AppointmentRecord {
  const raw: Appointment = {
    id: "apt-1",
    familyId: "fam-1",
    fatherUid: "father-1",
    fatherName: "Abba",
    childUid: "child-1",
    childName: "Lydia",
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
    updatedAt: "2026-11-01T07:00:00.000Z",
    version: 1,
    ...overrides,
  };
  return normalizeAppointment(raw);
}

const father: AppointmentActor = { uid: "father-1", role: "FATHER" };
const child: AppointmentActor = { uid: "child-1", role: "STUDENT" };
const other: AppointmentActor = { uid: "other", role: "STUDENT" };

test("lifecycle: father-created request requires child response", () => {
  const rec = base();
  assert.equal(getPendingResponder(rec), "child-1");
  assert.equal(validateAppointmentTransition(rec, child, "CONFIRM").ok, true);
  assert.equal(validateAppointmentTransition(rec, child, "DECLINE").ok, true);
  assert.equal(validateAppointmentTransition(rec, father, "CONFIRM").ok, false);
  assert.equal(validateAppointmentTransition(rec, father, "DECLINE").ok, false);
});

test("lifecycle: child-created request requires father response", () => {
  const rec = base({
    createdBy: "child-1",
    createdByRole: "STUDENT",
    direction: "CHILD_TO_FATHER",
    originalRequesterUid: "child-1",
    currentProposerUid: "child-1",
    pendingResponseFrom: "father-1",
  });
  assert.equal(getPendingResponder(rec), "father-1");
  assert.equal(validateAppointmentTransition(rec, father, "CONFIRM").ok, true);
  assert.equal(validateAppointmentTransition(rec, child, "CONFIRM").ok, false);
});

test("lifecycle: reschedule is allowed only from CONFIRMED and returns to REQUESTED for other party", () => {
  const confirmed = base({ status: "CONFIRMED", pendingResponseFrom: undefined, version: 2 });
  const res = applyAppointmentAction(
    confirmed,
    father,
    "RESCHEDULE",
    { scheduledAt: "2026-12-05T08:00:00.000Z", location: "Church", message: "note" },
    new Date("2026-11-10T10:00:00.000Z")
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.next.status, "REQUESTED");
    assert.equal(res.next.currentProposerUid, "father-1");
    assert.equal(res.next.pendingResponseFrom, "child-1");
    assert.equal(res.next.version, 3);
    assert.equal(res.next.scheduledAt, "2026-12-05T08:00:00.000Z");
    assert.equal(res.next.location, "Church");
  }

  const requested = base({ status: "REQUESTED" });
  assert.equal(validateAppointmentTransition(requested, father, "RESCHEDULE").ok, false);
});

test("lifecycle: only father can complete confirmed appointment", () => {
  const confirmed = base({ status: "CONFIRMED", pendingResponseFrom: undefined, version: 2 });
  assert.equal(validateAppointmentTransition(confirmed, father, "COMPLETE").ok, true);
  assert.equal(validateAppointmentTransition(confirmed, child, "COMPLETE").ok, false);
  assert.equal(validateAppointmentTransition(base({ status: "REQUESTED" }), father, "COMPLETE").ok, false);
});

test("lifecycle: either party can cancel requested or confirmed, not terminal", () => {
  const requested = base({ status: "REQUESTED" });
  const confirmed = base({ status: "CONFIRMED", pendingResponseFrom: undefined, version: 2 });
  assert.equal(validateAppointmentTransition(requested, father, "CANCEL").ok, true);
  assert.equal(validateAppointmentTransition(requested, child, "CANCEL").ok, true);
  assert.equal(validateAppointmentTransition(confirmed, father, "CANCEL").ok, true);
  assert.equal(validateAppointmentTransition(confirmed, child, "CANCEL").ok, true);

  const declined = base({ status: "DECLINED", pendingResponseFrom: undefined, version: 2 });
  assert.equal(validateAppointmentTransition(declined, father, "CANCEL").ok, false);
});

test("lifecycle: terminal states reject all transitions", () => {
  for (const status of ["DECLINED", "COMPLETED", "CANCELLED"] as const) {
    const rec = base({ status, pendingResponseFrom: undefined, version: 2 });
    for (const action of ["CONFIRM", "DECLINE", "RESCHEDULE", "CANCEL", "COMPLETE"] as const) {
      const r = validateAppointmentTransition(rec, father, action);
      assert.equal(r.ok, false, `${status} must reject ${action}`);
    }
  }
});

test("lifecycle: available actions reflect authorization and status", () => {
  const requestedByFather = base();
  // Pending responder (child) may confirm/decline and either party may cancel REQUESTED.
  assert.deepEqual(
    getAvailableAppointmentActions(requestedByFather, child).sort(),
    ["CANCEL", "CONFIRM", "DECLINE"].sort()
  );
  assert.deepEqual(getAvailableAppointmentActions(requestedByFather, father).sort(), ["CANCEL"]);

  const confirmed = base({ status: "CONFIRMED", pendingResponseFrom: undefined, version: 2 });
  assert.deepEqual(getAvailableAppointmentActions(confirmed, father).sort(), ["CANCEL", "COMPLETE", "RESCHEDULE"].sort());
  assert.deepEqual(getAvailableAppointmentActions(confirmed, child).sort(), ["CANCEL", "RESCHEDULE"].sort());
});

test("lifecycle: non-party and mismatched role are forbidden", () => {
  const rec = base();
  assert.equal(validateAppointmentTransition(rec, other, "CONFIRM").ok, false);
  const wrongRole: AppointmentActor = { uid: "father-1", role: "STUDENT" as any };
  assert.equal(validateAppointmentTransition(rec, wrongRole, "CANCEL").ok, false);
});

test("lifecycle: inconsistent records cannot be mutated", () => {
  const rec = normalizeAppointment({
    ...base(),
    originalRequesterUid: "child-1", // contradicts father-created direction/createdBy
  });
  assert.equal(rec.identityConsistent, false);
  assert.equal(validateAppointmentTransition(rec, child, "CONFIRM").ok, false);
});