import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppointment } from "../legacy";
import {
  type AppointmentSnapshot,
  EMPTY_APPOINTMENT_SNAPSHOT,
  mergeAuthoritativeAppointmentSnapshot,
  snapshotForOwner,
} from "../snapshot";
import type {
  AppointmentChildDirectoryEntry,
  AppointmentRecord,
} from "../types";

const FATHER = "father-1";

function child(
  uid: string,
  accountClaimed = true
): AppointmentChildDirectoryEntry {
  return {
    uid,
    eotcUid: `eotc-${uid}`,
    displayName: `Child ${uid}`,
    accountClaimed,
  };
}

function appointment(
  fatherUid: string,
  childUid: string,
  id: string
): AppointmentRecord {
  return normalizeAppointment({
    id,
    familyId: fatherUid,
    fatherUid,
    childUid,
    childEotcUid: `eotc-${childUid}`,
    childName: `Cached name for ${childUid}`,
    type: "NISEHA",
    status: "REQUESTED",
    scheduledAt: "2026-12-01T07:00:00.000Z",
    createdBy: fatherUid,
    createdByRole: "FATHER",
    direction: "FATHER_TO_CHILD",
    createdAt: "2026-11-01T07:00:00.000Z",
    updatedAt: "2026-11-01T07:00:00.000Z",
    version: 1,
  } as AppointmentRecord);
}

function merge(params: {
  capturedOwnerUid: string;
  currentOwnerUid: string;
  cached: AppointmentSnapshot | null;
  cachedOwnerUid?: string | null;
  server: AppointmentSnapshot;
}) {
  return mergeAuthoritativeAppointmentSnapshot({
    role: "FATHER",
    ...params,
  });
}

test("Android refresh: fresh child directory replaces stale omitted children", () => {
  const result = merge({
    capturedOwnerUid: FATHER,
    currentOwnerUid: FATHER,
    cachedOwnerUid: FATHER,
    cached: {
      appointments: [
        appointment(FATHER, "stale", "apt-stale"),
        appointment(FATHER, "current", "apt-kept"),
      ],
      children: [child("stale"), child("current")],
    },
    server: {
      appointments: [appointment(FATHER, "current", "apt-current")],
      children: [child("current")],
    },
  });

  assert.ok(result);
  assert.deepEqual(
    result.full.children?.map((c) => c.uid),
    ["current"]
  );
  assert.deepEqual(
    result.full.appointments.map((a) => a.id).sort(),
    ["apt-current", "apt-kept", "apt-stale"]
  );
  assert.deepEqual(
    result.presentation.children?.map((c) => c.uid),
    ["current"]
  );
  assert.deepEqual(
    result.presentation.appointments.map((a) => a.id).sort(),
    ["apt-current", "apt-kept"]
  );
});

test("Android refresh: a child no longer eligible in the server response stays cached but is not presented", () => {
  const result = merge({
    capturedOwnerUid: FATHER,
    currentOwnerUid: FATHER,
    cachedOwnerUid: FATHER,
    cached: {
      appointments: [appointment(FATHER, "child-1", "apt-1")],
      children: [child("child-1", true)],
    },
    server: {
      appointments: [],
      children: [child("child-1", false)],
    },
  });

  assert.ok(result);
  assert.equal(result.full.appointments.some((a) => a.id === "apt-1"), true);
  assert.equal(result.full.children?.[0].accountClaimed, false);
  assert.deepEqual(result.presentation.appointments, []);
  assert.deepEqual(result.presentation.children, []);
});

test("F3: a snapshot owned by account A cannot be reused by account B", () => {
  const snapshot: AppointmentSnapshot = {
    appointments: [appointment("account-a", "child-1", "apt-a")],
    children: [child("child-1")],
  };

  assert.equal(
    snapshotForOwner({ ownerUid: "account-a", snapshot }, "account-a"),
    snapshot
  );
  assert.equal(
    snapshotForOwner({ ownerUid: "account-a", snapshot }, "account-b"),
    EMPTY_APPOINTMENT_SNAPSHOT
  );
  assert.equal(snapshotForOwner(null, "account-b"), EMPTY_APPOINTMENT_SNAPSHOT);
});

test("F3: a delayed response from account A cannot populate account B's snapshot", () => {
  const cached: AppointmentSnapshot = {
    appointments: [appointment("account-a", "child-1", "apt-a")],
    children: [child("child-1")],
  };

  const delayed = merge({
    capturedOwnerUid: "account-a",
    currentOwnerUid: "account-b",
    cachedOwnerUid: "account-a",
    cached,
    server: { appointments: [], children: [] },
  });
  assert.equal(delayed, null);

  // Even an explicitly cached snapshot from A is ignored by B's merge.
  const ignoredCached = merge({
    capturedOwnerUid: "account-b",
    currentOwnerUid: "account-b",
    cachedOwnerUid: "account-a",
    cached,
    server: { appointments: [], children: [] },
  });
  assert.ok(ignoredCached);
  assert.deepEqual(ignoredCached.full.appointments, []);
  assert.deepEqual(ignoredCached.full.children, []);

  // A same-account response still restores its own cache.
  const current = merge({
    capturedOwnerUid: "account-a",
    currentOwnerUid: "account-a",
    cachedOwnerUid: "account-a",
    cached,
    server: { appointments: [], children: [] },
  });
  assert.ok(current);
  assert.deepEqual(
    current.full.appointments.map((a) => a.id),
    ["apt-a"]
  );
});
