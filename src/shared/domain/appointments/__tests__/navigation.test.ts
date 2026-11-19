import assert from "node:assert/strict";
import test from "node:test";

import { appointmentDetailRequestKey } from "../detailLoad";
import {
  appointmentBackView,
  appointmentRouteParams,
  appointmentViewFromParams,
  resolveAppointmentDetailChildUid,
} from "../navigation";
import type { AppointmentRecord } from "../types";

function appointmentForChild(childUid: string): AppointmentRecord {
  return { childUid } as AppointmentRecord;
}

test("navigation: father detail keeps child context through params and back", () => {
  const view = appointmentViewFromParams(
    { appointment: "apt-1", child: "child-1" },
    "FATHER"
  );
  assert.deepEqual(view, {
    kind: "detail",
    appointmentId: "apt-1",
    childUid: "child-1",
  });
  assert.deepEqual(appointmentRouteParams(view), {
    appointment: "apt-1",
    child: "child-1",
  });
  assert.deepEqual(
    appointmentBackView(view, {
      role: "FATHER",
      knownChildUids: ["child-1", "child-2"],
    }),
    { kind: "child", childUid: "child-1" }
  );
});

test("navigation: refresh/deep link without child context rebuilds it from the appointment", () => {
  const view = appointmentViewFromParams({ appointment: "apt-1" }, "FATHER");
  assert.deepEqual(view, { kind: "detail", appointmentId: "apt-1" });

  assert.equal(
    resolveAppointmentDetailChildUid(view, {
      role: "FATHER",
      knownChildUids: ["child-1"],
      appointment: appointmentForChild("child-1"),
    }),
    "child-1"
  );
  assert.deepEqual(
    appointmentBackView(view, {
      role: "FATHER",
      knownChildUids: ["child-1"],
      appointment: appointmentForChild("child-1"),
    }),
    { kind: "child", childUid: "child-1" }
  );
});

test("navigation: authoritative appointment child overrides a stale known child param", () => {
  const view = appointmentViewFromParams(
    { appointment: "apt-1", child: "child-1" },
    "FATHER"
  );
  assert.deepEqual(
    appointmentBackView(view, {
      role: "FATHER",
      knownChildUids: ["child-1", "child-2"],
      appointment: appointmentForChild("child-2"),
    }),
    { kind: "child", childUid: "child-2" }
  );
});

test("navigation: unknown child contexts never open a child room", () => {
  const view = appointmentViewFromParams(
    { appointment: "apt-1", child: "child-x" },
    "FATHER"
  );
  assert.deepEqual(
    appointmentBackView(view, {
      role: "FATHER",
      knownChildUids: ["child-1"],
      appointment: appointmentForChild("child-1"),
    }),
    { kind: "child", childUid: "child-1" }
  );
  assert.deepEqual(
    appointmentBackView(view, {
      role: "FATHER",
      knownChildUids: ["child-1"],
      appointment: appointmentForChild("child-x"),
    }),
    { kind: "overview" }
  );
});

test("navigation: students keep the personal overview and never use child context", () => {
  const overview = appointmentViewFromParams({ child: "child-1" }, "STUDENT");
  assert.deepEqual(overview, { kind: "overview" });

  const detail = appointmentViewFromParams(
    { appointment: "apt-1", child: "child-1" },
    "STUDENT"
  );
  assert.deepEqual(detail, { kind: "detail", appointmentId: "apt-1" });
  assert.deepEqual(
    appointmentBackView(detail, {
      role: "STUDENT",
      knownChildUids: ["child-1"],
      appointment: appointmentForChild("child-1"),
    }),
    { kind: "overview" }
  );
});

test("navigation: child context does not change the detail request key", () => {
  const withChild = appointmentViewFromParams(
    { appointment: "apt-1", child: "child-1" },
    "FATHER"
  );
  const withoutChild = appointmentViewFromParams(
    { appointment: "apt-1" },
    "FATHER"
  );
  assert.equal(
    appointmentDetailRequestKey(withChild, "father-1"),
    appointmentDetailRequestKey(withoutChild, "father-1")
  );
});
