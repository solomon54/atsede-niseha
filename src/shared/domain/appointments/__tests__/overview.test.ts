import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppointment } from "../legacy";
import {
  buildChildAppointmentOverviews,
  isConfirmedOverdue,
  isUpcomingConfirmed,
  selectAppointmentsForChild,
  selectFatherAppointmentOverviewPresentation,
  selectOverdueConfirmed,
  selectUpcomingConfirmed,
} from "../overview";
import type { Appointment, AppointmentChildDirectoryEntry } from "../types";

function rec(overrides: Partial<Appointment>): ReturnType<typeof normalizeAppointment> {
  return normalizeAppointment({
    id: overrides.id || "apt-1",
    familyId: "fam-1",
    fatherUid: "father-1",
    childUid: overrides.childUid || "child-1",
    childName: overrides.childName,
    type: "NISEHA",
    status: overrides.status || "REQUESTED",
    scheduledAt: overrides.scheduledAt || "2026-12-01T07:00:00.000Z",
    createdBy: overrides.createdBy || "father-1",
    createdByRole: overrides.createdByRole || "FATHER",
    direction: overrides.direction || "FATHER_TO_CHILD",
    originalRequesterUid: overrides.originalRequesterUid || "father-1",
    currentProposerUid: overrides.currentProposerUid || "father-1",
    pendingResponseFrom:
      overrides.pendingResponseFrom !== undefined
        ? overrides.pendingResponseFrom
        : (overrides.status || "REQUESTED") === "REQUESTED"
        ? "child-1"
        : undefined,
    createdAt: "2026-11-01T07:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-11-01T07:00:00.000Z",
    version: overrides.version || 1,
    ...overrides,
  } as Appointment);
}

const now = new Date("2026-11-18T10:00:00.000Z");

test("overview: upcoming vs overdue confirmed split", () => {
  const future = rec({ id: "f", status: "CONFIRMED", scheduledAt: "2026-11-20T07:00:00.000Z", pendingResponseFrom: undefined, version: 2 });
  const past = rec({ id: "p", status: "CONFIRMED", scheduledAt: "2026-11-10T07:00:00.000Z", pendingResponseFrom: undefined, version: 2 });
  assert.equal(isUpcomingConfirmed(future, now), true);
  assert.equal(isConfirmedOverdue(future, now), false);
  assert.equal(isUpcomingConfirmed(past, now), false);
  assert.equal(isConfirmedOverdue(past, now), true);
  assert.deepEqual(selectUpcomingConfirmed([past, future], now).map((x) => x.id), ["f"]);
  assert.deepEqual(selectOverdueConfirmed([past, future], now).map((x) => x.id), ["p"]);
});

test("overview: child-oriented summaries include all directory children and derived counts", () => {
  const children: AppointmentChildDirectoryEntry[] = [
    { uid: "child-1", displayName: "Alpha" },
    { uid: "child-2", displayName: "Beta" },
  ];
  const appointments = [
    rec({ id: "r1", childUid: "child-1", status: "REQUESTED", pendingResponseFrom: "father-1", currentProposerUid: "child-1", createdBy: "child-1", createdByRole: "STUDENT", direction: "CHILD_TO_FATHER", originalRequesterUid: "child-1", scheduledAt: "2026-11-19T07:00:00.000Z" }),
    rec({ id: "c1", childUid: "child-1", status: "CONFIRMED", pendingResponseFrom: undefined, version: 2, scheduledAt: "2026-11-25T07:00:00.000Z" }),
    rec({ id: "o1", childUid: "child-1", status: "CONFIRMED", pendingResponseFrom: undefined, version: 2, scheduledAt: "2026-11-10T07:00:00.000Z" }),
  ];

  const out = buildChildAppointmentOverviews({ appointments, children, viewerUid: "father-1", now });
  assert.equal(out.length, 2);

  const alpha = out.find((x) => x.child.uid === "child-1")!;
  const beta = out.find((x) => x.child.uid === "child-2")!;

  assert.equal(alpha.total, 3);
  assert.equal(alpha.attentionNeeded, 1);
  assert.equal(alpha.confirmed, 2);
  assert.equal(alpha.overdueConfirmed, 1);
  assert.equal(alpha.nearestUpcomingConfirmed?.id, "c1");
  assert.equal(beta.total, 0);
  assert.equal(beta.attentionNeeded, 0);
});

test("overview: appointments for unknown directory child remain visible", () => {
  const children: AppointmentChildDirectoryEntry[] = [{ uid: "child-1", displayName: "Alpha" }];
  const appointments = [
    rec({ id: "x1", childUid: "child-x", childName: "Unknown Child", status: "REQUESTED" }),
  ];
  const out = buildChildAppointmentOverviews({ appointments, children, viewerUid: "father-1", now });
  assert.ok(out.some((x) => x.child.uid === "child-x" && x.total === 1));
});

test("overview: presentation drops synthetic child cards without hiding their records", () => {
  const children: AppointmentChildDirectoryEntry[] = [
    { uid: "child-1", displayName: "Alpha" },
    { uid: "child-2", displayName: "Beta" },
  ];
  const appointments = [
    rec({ id: "a1", childUid: "child-1" }),
    rec({ id: "x1", childUid: "child-x", childName: "Unknown Child" }),
  ];
  const overviews = buildChildAppointmentOverviews({ appointments, children, viewerUid: "father-1", now });

  const presented = selectFatherAppointmentOverviewPresentation({
    overviews,
    appointments,
    children,
    viewerUid: "father-1",
  });

  assert.deepEqual(
    presented.directoryOverviews.map((item) => item.child.uid),
    ["child-1", "child-2"]
  );
  assert.deepEqual(
    presented.unmatchedAppointments.map((item) => item.id),
    ["x1"]
  );

  const presentedChildUids = new Set(
    presented.directoryOverviews.map((item) => item.child.uid)
  );
  const unmatchedIds = new Set(
    presented.unmatchedAppointments.map((item) => item.id)
  );
  for (const appointment of appointments) {
    const appearsAsChildCard = presentedChildUids.has(appointment.childUid);
    const appearsAsUnmatched = unmatchedIds.has(appointment.id);
    assert.ok(
      (appointment.childUid === "child-x" && appearsAsUnmatched && !appearsAsChildCard) ||
        (appointment.childUid !== "child-x" && appearsAsChildCard && !appearsAsUnmatched)
    );
  }
});

test("overview: child room shows only the selected child's records", () => {
  const appointments = [
    rec({ id: "a1", childUid: "child-1" }),
    rec({ id: "a2", childUid: "child-1", status: "CONFIRMED", version: 2, pendingResponseFrom: undefined }),
    rec({ id: "b1", childUid: "child-2" }),
  ];
  assert.deepEqual(
    selectAppointmentsForChild(appointments, "child-1").map((item) => item.id),
    ["a1", "a2"]
  );
  assert.deepEqual(selectAppointmentsForChild(appointments, "child-2"), [appointments[2]]);
  assert.deepEqual(selectAppointmentsForChild(appointments, "child-3"), []);
});