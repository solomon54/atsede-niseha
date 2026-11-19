import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFatherAppointmentEligibility,
  hasValidLinkedUid,
  isClaimedWithLinkedUid,
  isEligibleFatherChild,
} from "../eligibility";
import { normalizeAppointment } from "../legacy";
import { buildChildAppointmentOverviews } from "../overview";
import {
  isLegacyClaimedStudent,
  legacyStudentUid,
} from "../studentCreateCompatibility";
import type {
  AppointmentChildDirectoryEntry,
  AppointmentRecord,
} from "../types";

function child(
  uid: string,
  overrides: Partial<AppointmentChildDirectoryEntry> = {}
): AppointmentChildDirectoryEntry {
  return {
    uid,
    eotcUid: `eotc-${uid}`,
    displayName: `Child ${uid}`,
    accountClaimed: true,
    ...overrides,
  };
}

function appointment(childUid: string, id: string): AppointmentRecord {
  return normalizeAppointment({
    id,
    familyId: "father-1",
    fatherUid: "father-1",
    childUid,
    childEotcUid: `eotc-${childUid}`,
    childName: `Cached name for ${childUid}`,
    type: "NISEHA",
    status: "REQUESTED",
    scheduledAt: "2026-12-01T07:00:00.000Z",
    createdBy: "father-1",
    createdByRole: "FATHER",
    direction: "FATHER_TO_CHILD",
    createdAt: "2026-11-01T07:00:00.000Z",
    updatedAt: "2026-11-01T07:00:00.000Z",
    version: 1,
  } as AppointmentRecord);
}

function fatherFilter(
  children: AppointmentChildDirectoryEntry[],
  appointments: AppointmentRecord[]
) {
  return applyFatherAppointmentEligibility({
    role: "FATHER",
    children,
    appointments,
  });
}

test("eligibility: claimed child with a valid linked uid appears for Father", () => {
  const result = fatherFilter([child("claimed")], []);
  assert.deepEqual(
    result.children.map((c) => c.uid),
    ["claimed"]
  );
  assert.equal(isEligibleFatherChild(result.children[0]), true);
  assert.equal(isClaimedWithLinkedUid({ accountClaimed: true, uid: "claimed" }), true);
});

test("eligibility: unclaimed child does not appear for Father", () => {
  const result = fatherFilter([child("unclaimed", { accountClaimed: false })], []);
  assert.deepEqual(result.children, []);
  assert.equal(isClaimedWithLinkedUid({ accountClaimed: false, uid: "unclaimed" }), false);
  // An absent marker is not treated as claimed.
  assert.deepEqual(fatherFilter([{ uid: "x", displayName: "X" }], []).children, []);
});

test("eligibility: malformed claim flags and uids are never coerced to eligible", () => {
  // F1: truthy non-boolean values must not become accountClaimed: true.
  for (const accountClaimed of ["false", 1, null, undefined] as const) {
    assert.equal(
      isClaimedWithLinkedUid({ accountClaimed, uid: "child-1" }),
      false,
      `claim value ${String(accountClaimed)} must be ineligible`
    );
  }
  assert.equal(isClaimedWithLinkedUid({ uid: "child-1" }), false);

  for (const uid of [undefined, "", "   ", null, 0] as const) {
    assert.equal(
      isClaimedWithLinkedUid({ accountClaimed: true, uid }),
      false,
      `uid value ${String(uid)} must be ineligible`
    );
  }

  // A raw Firestore-shaped record with a malformed claim never enters the
  // Father directory, and therefore cannot back an appointment row.
  const raw = { accountClaimed: "false", uid: "child-1" };
  assert.deepEqual(
    fatherFilter([raw as unknown as AppointmentChildDirectoryEntry], [appointment("child-1", "apt-1")]),
    { children: [], appointments: [] }
  );
});

test("eligibility: claimed child without a valid linked uid does not appear", () => {
  const missing = fatherFilter([child("no-uid", { uid: "" })], []);
  const whitespace = fatherFilter([child("blank", { uid: "   " })], []);
  const undefinedUid = fatherFilter(
    [child("undef", { uid: undefined as unknown as string })],
    []
  );
  assert.deepEqual(missing.children, []);
  assert.deepEqual(whitespace.children, []);
  assert.deepEqual(undefinedUid.children, []);
  assert.equal(hasValidLinkedUid("   "), false);
  assert.equal(isClaimedWithLinkedUid({ accountClaimed: true, uid: "   " }), false);
});

test("eligibility: unclaimed child's appointment is not an unmatched or synthetic entry", () => {
  const unclaimed = child("unclaimed", { accountClaimed: false });
  const appt = appointment("unclaimed", "apt-legacy-unclaimed");
  const filtered = fatherFilter([unclaimed], [appt]);

  assert.deepEqual(filtered.appointments, []);

  const overviews = buildChildAppointmentOverviews({
    appointments: filtered.appointments,
    children: filtered.children,
    viewerUid: "father-1",
    now: new Date("2026-11-18T10:00:00.000Z"),
  });
  assert.deepEqual(overviews, []);
});

test("eligibility: name, eotc uid and cached profile never make a child eligible", () => {
  const appt = appointment("unclaimed", "apt-1");
  const lookAlike = child("unclaimed", {
    accountClaimed: false,
    eotcUid: "eotc-unclaimed",
    displayName: appt.childName,
    photoUrl: "https://example.invalid/photo.png",
  });
  const result = fatherFilter([lookAlike], [appt]);
  assert.deepEqual(result.children, []);
  assert.deepEqual(result.appointments, []);
});

test("eligibility: after claiming, normal refresh makes the child eligible", () => {
  const before = fatherFilter([child("child-1", { accountClaimed: false })], [
    appointment("child-1", "apt-1"),
  ]);
  assert.deepEqual(before.appointments, []);

  const after = fatherFilter([child("child-1", { accountClaimed: true })], [
    appointment("child-1", "apt-1"),
  ]);
  assert.deepEqual(
    after.appointments.map((a) => a.id),
    ["apt-1"]
  );
  assert.deepEqual(
    after.children.map((c) => c.uid),
    ["child-1"]
  );
});

test("eligibility: Student's own appointments are not filtered by the Father rule", () => {
  const appointments = [
    appointment("student-1", "apt-student"),
    appointment("other-child", "apt-historical"),
  ];
  const children = [child("unclaimed", { accountClaimed: false })];
  const result = applyFatherAppointmentEligibility({
    role: "STUDENT",
    children,
    appointments,
  });
  assert.equal(result.appointments, appointments);
  assert.equal(result.children, children);
});

test("eligibility: filtering never deletes or mutates historical records", () => {
  const children = Object.freeze([
    child("claimed"),
    child("unclaimed", { accountClaimed: false }),
  ]);
  const historical = Object.freeze([
    appointment("claimed", "a1"),
    appointment("unclaimed", "a2"),
  ]);
  const snapshotBefore = JSON.stringify({ children, historical });

  const result = fatherFilter([...children], [...historical]);

  assert.deepEqual(
    result.appointments.map((a) => a.id),
    ["a1"]
  );
  assert.equal(JSON.stringify({ children, historical }), snapshotBefore);
  assert.equal(historical.length, 2);
  assert.equal(historical[1].status, "REQUESTED");
  assert.equal(historical[1].childUid, "unclaimed");
});

test("F4 compatibility: Student create keeps HEAD's claim and uid fallback", () => {
  // The compatibility shim is deliberately narrower than Father eligibility.
  assert.equal(isLegacyClaimedStudent({ accountClaimed: true }), true);
  assert.equal(isLegacyClaimedStudent({ accountClaimed: 1 }), true);
  assert.equal(isLegacyClaimedStudent({ accountClaimed: false }), false);
  assert.equal(legacyStudentUid({ uid: "linked-uid" }, "doc-1"), "linked-uid");
  assert.equal(legacyStudentUid({ uid: undefined }, "doc-1"), "doc-1");
  assert.equal(legacyStudentUid({ uid: "" }, "doc-1"), "doc-1");

  // A Father-side rule still rejects the same malformed legacy values.
  assert.equal(
    isClaimedWithLinkedUid({ accountClaimed: 1, uid: "linked-uid" }),
    false
  );
  assert.equal(isClaimedWithLinkedUid({ accountClaimed: true, uid: undefined }), false);
});
