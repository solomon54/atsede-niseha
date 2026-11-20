import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCallMessageData,
  buildCallMessageUpdate,
  isRingingStale,
  RINGING_WINDOW_MS,
} from "../callMessages";

const call = {
  callId: "call-1",
  channelId: "room-1",
  callerId: "user-a",
  callerName: "Father",
  status: "answered" as const,
  startedAt: 1_000,
  answeredAt: 1_500,
  endedAt: 10_000,
  durationSec: 9,
  isGroup: false,
  updatedAt: 10_000,
};

test("call message artifacts are complete and renderable as CALL rows", () => {
  const data = buildCallMessageData(call);

  assert.equal(data.id, "call-1");
  assert.equal(data.type, "CALL");
  assert.equal(data.isEncrypted, false);
  assert.equal(data.createdAt, 1_000);
  assert.equal(data.callDetails.status, "answered");
  assert.equal(data.callDetails.callerName, "Father");
});

test("call status updates carry updatedAt so delta sync can observe them", () => {
  const patch = buildCallMessageUpdate(call, 20_000);

  assert.equal(patch.updatedAt, 20_000);
  assert.equal(patch.editedAt, 20_000);
  assert.equal(patch.type, "CALL");
  assert.equal(patch.callDetails.status, "answered");
  assert.equal(patch.senderId, "user-a");
});

test("stale ringing calls are detected deterministically", () => {
  assert.equal(isRingingStale("ringing", 1_000, 1_000 + RINGING_WINDOW_MS), false);
  assert.equal(isRingingStale("ringing", 1_000, 1_000 + RINGING_WINDOW_MS + 1), true);
  assert.equal(isRingingStale("answered", 1_000, 999_999), false);
  assert.equal(isRingingStale("ringing", undefined, 50_000), true);
});
