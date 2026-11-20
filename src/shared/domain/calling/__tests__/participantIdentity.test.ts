import assert from "node:assert/strict";
import test from "node:test";

import {
  callRoleLabel,
  normalizeCallRole,
  toCallParticipantSummary,
} from "../participantIdentity";

test("all registered profile collections map to explicit call roles", () => {
  assert.equal(normalizeCallRole(undefined, "Fathers"), "FATHER");
  assert.equal(normalizeCallRole(undefined, "Governors"), "GOVERNOR");
  assert.equal(normalizeCallRole("CHILD"), "CHILD");
  assert.equal(callRoleLabel("GOVERNOR"), "የንስሐ ገዥ");
  assert.equal(callRoleLabel("CHILD"), "የንስሐ ልጅ");
});

test("participant summary uses registered name, photo and collection-derived role", () => {
  const summary = toCallParticipantSummary({
    uid: "uid-1",
    collection: "Students",
    data: {
      christianName: "Niseha",
      photoUrl: "https://example.test/child.jpg",
    },
  });
  assert.deepEqual(summary, {
    uid: "uid-1",
    displayName: "Niseha",
    photoUrl: "https://example.test/child.jpg",
    role: "STUDENT",
  });
});

test("missing photo stays null so UI can render an explicit fallback", () => {
  const summary = toCallParticipantSummary({
    uid: "uid-2",
    collection: "Fathers",
    data: { fullName: "Father Test" },
  });
  assert.equal(summary.photoUrl, null);
  assert.equal(summary.displayName, "Father Test");
});
