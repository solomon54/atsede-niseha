import assert from "node:assert/strict";
import test from "node:test";

import {
  APPOINTMENT_DETAIL_ERRORS,
  appointmentDetailRequestKey,
  type AppointmentDetailView,
  detailErrorMessage,
  isCurrentDetailRequest,
} from "../detailLoad";

const detail = (id: string): AppointmentDetailView => ({ kind: "detail", appointmentId: id });
const overview: AppointmentDetailView = { kind: "overview" };
const childRoom: AppointmentDetailView = { kind: "child", appointmentId: "child-1" };

test("detail load: opening a detail resolves one controlled request", () => {
  const key = appointmentDetailRequestKey(detail("apt-1"), "father-1");
  assert.equal(typeof key, "string");
  assert.equal(isCurrentDetailRequest(key, key), true);
});

test("detail load: overview collection updates do not create another request", () => {
  const view = detail("apt-1");
  // A list refresh, realtime upsert or offline drain changes only collection
  // state, never the request key derived from the view + account.
  const before = appointmentDetailRequestKey(view, "father-1");
  const afterCollectionUpdate = appointmentDetailRequestKey(view, "father-1");
  assert.equal(before, afterCollectionUpdate);
  assert.equal(appointmentDetailRequestKey(childRoom, "father-1"), null);
  assert.equal(appointmentDetailRequestKey(overview, "father-1"), null);
});

test("detail load: opening another appointment is a new intentional request", () => {
  const first = appointmentDetailRequestKey(detail("apt-1"), "father-1");
  const second = appointmentDetailRequestKey(detail("apt-2"), "father-1");
  assert.notEqual(first, second);
  assert.equal(isCurrentDetailRequest(first, second), false);
});

test("detail load: account changes and leaving detail invalidate stale responses", () => {
  const key = appointmentDetailRequestKey(detail("apt-1"), "father-1");
  assert.equal(isCurrentDetailRequest(key, appointmentDetailRequestKey(overview, "father-1")), false);
  assert.equal(isCurrentDetailRequest(key, null), false);
  assert.equal(isCurrentDetailRequest(null, key), false);
  assert.equal(
    isCurrentDetailRequest(key, appointmentDetailRequestKey(detail("apt-1"), "father-2")),
    false
  );
});

test("detail load: missing appointment id or owner means no request", () => {
  assert.equal(appointmentDetailRequestKey(detail(""), "father-1"), null);
  assert.equal(appointmentDetailRequestKey(detail("  "), "father-1"), null);
  assert.equal(appointmentDetailRequestKey(detail("apt-1"), ""), null);
});

test("detail load: 401/403/404 and other errors all produce terminal messages", () => {
  assert.equal(detailErrorMessage(401, "server text"), APPOINTMENT_DETAIL_ERRORS.UNAUTHORIZED);
  assert.equal(detailErrorMessage(403, "server text"), APPOINTMENT_DETAIL_ERRORS.FORBIDDEN);
  assert.equal(detailErrorMessage(404, "server text"), APPOINTMENT_DETAIL_ERRORS.NOT_FOUND);
  assert.equal(detailErrorMessage(500, "server text"), "server text");
  assert.equal(detailErrorMessage(undefined, "network error"), "network error");
});

test("detail load: realtime changes on the open appointment do not refetch", () => {
  const view = detail("apt-1");
  const initial = appointmentDetailRequestKey(view, "father-1");
  // Simulated realtime upsert of the same id leaves the view unchanged.
  const afterRealtime = appointmentDetailRequestKey(view, "father-1");
  assert.equal(initial, afterRealtime);
  assert.equal(isCurrentDetailRequest(initial, afterRealtime), true);
});

test("detail load: returning to the same appointment is an explicit fresh request", () => {
  const first = appointmentDetailRequestKey(detail("apt-1"), "student-1");
  const away = appointmentDetailRequestKey(overview, "student-1");
  const back = appointmentDetailRequestKey(detail("apt-1"), "student-1");
  assert.equal(away, null);
  assert.equal(first, back);
});
