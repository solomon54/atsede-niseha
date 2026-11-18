/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppointment } from "../legacy";
import type { Appointment } from "../types";

function raw(overrides: Partial<Appointment> = {}): Appointment {
  return {
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
    createdAt: "2026-11-01T07:00:00.000Z",
    updatedAt: "2026-11-01T07:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

test("legacy: complete record normalizes consistently", () => {
  const rec = normalizeAppointment(raw());
  assert.equal(rec.identityConsistent, true);
  assert.equal(rec.version, 1);
  assert.equal(rec.pendingResponseFrom, "child-1");
  assert.equal(rec.originalRequesterUid, "father-1");
  assert.equal(rec.currentProposerUid, "father-1");
});

test("legacy: derives missing requester/proposer/pending from direction and createdBy", () => {
  const rec = normalizeAppointment(
    raw({
      direction: undefined as any,
      createdByRole: "FATHER",
      originalRequesterUid: undefined,
      currentProposerUid: undefined,
      pendingResponseFrom: undefined,
      version: undefined,
    })
  );
  assert.equal(rec.identityConsistent, true);
  assert.equal(rec.direction, "FATHER_TO_CHILD");
  assert.equal(rec.originalRequesterUid, "father-1");
  assert.equal(rec.currentProposerUid, "father-1");
  assert.equal(rec.pendingResponseFrom, "child-1");
  assert.equal(rec.version, 1);
});

test("legacy: pending responder is cleared for non-requested statuses", () => {
  const rec = normalizeAppointment(
    raw({ status: "CONFIRMED", pendingResponseFrom: undefined })
  );
  assert.equal(rec.status, "CONFIRMED");
  assert.equal(rec.pendingResponseFrom, undefined);
  assert.equal(rec.identityConsistent, true);
});

test("legacy: contradictory identity fields are flagged inconsistent", () => {
  const rec = normalizeAppointment(
    raw({
      createdBy: "father-1",
      createdByRole: "STUDENT", // contradicts
      direction: "CHILD_TO_FATHER",
      originalRequesterUid: "child-1",
      currentProposerUid: "child-1",
      pendingResponseFrom: "father-1",
    })
  );
  assert.equal(rec.identityConsistent, false);
});

test("legacy: stale pending responder on settled appointment is flagged", () => {
  const rec = normalizeAppointment(
    raw({ status: "COMPLETED", pendingResponseFrom: "child-1" as any })
  );
  assert.equal(rec.identityConsistent, false);
});

test("legacy: invalid or missing parties are inconsistent", () => {
  const rec = normalizeAppointment(raw({ childUid: "" as any }));
  assert.equal(rec.identityConsistent, false);
});

test("legacy: version must be a positive integer when present", () => {
  const rec = normalizeAppointment(raw({ version: 0 as any }));
  assert.equal(rec.identityConsistent, false);
});