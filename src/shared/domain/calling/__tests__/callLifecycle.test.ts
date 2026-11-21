import assert from "node:assert/strict";
import test from "node:test";

import {
  canActorPerformCallAction,
  getCallParticipantUids,
  isJoinableCallStatus,
  isTerminalCallStatus,
  resolveTerminalStatus,
} from "../callLifecycle";

const ringing = {
  callerId: "caller",
  notifiedRecipientIds: ["alice", "bob"],
  busyRecipientIds: ["carol"],
  status: "ringing" as const,
};

test("answered calls persist as ended regardless of requested terminal status", () => {
  assert.equal(resolveTerminalStatus("answered", "missed"), "ended");
  assert.equal(resolveTerminalStatus("answered", "cancelled"), "ended");
  assert.equal(resolveTerminalStatus("answered", "declined"), "ended");
  assert.equal(resolveTerminalStatus("ringing", "missed"), "missed");
  assert.equal(resolveTerminalStatus("declined", "ended"), "declined");
});

test("terminal and joinable status helpers agree", () => {
  assert.equal(isTerminalCallStatus("ended"), true);
  assert.equal(isTerminalCallStatus("answered"), false);
  assert.equal(isJoinableCallStatus("ringing"), true);
  assert.equal(isJoinableCallStatus("ended"), false);
});

test("only notified participants are call participants", () => {
  assert.deepEqual(getCallParticipantUids(ringing), ["caller", "alice", "bob"]);
});

test("answer and decline require a notified recipient, not any member", () => {
  assert.equal(canActorPerformCallAction(ringing, "alice", "answer").allowed, true);
  assert.equal(canActorPerformCallAction(ringing, "caller", "answer").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "carol", "answer").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "outsider", "decline").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "bob", "decline").allowed, true);
});

test("only the caller can cancel or time out a ringing call", () => {
  assert.equal(canActorPerformCallAction(ringing, "caller", "cancel").allowed, true);
  assert.equal(canActorPerformCallAction(ringing, "alice", "cancel").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "caller", "timeout").allowed, true);
  assert.equal(canActorPerformCallAction(ringing, "bob", "timeout").allowed, false);
});

test("ended calls are no longer joinable", () => {
  const ended = { ...ringing, status: "ended" as const };
  assert.equal(canActorPerformCallAction(ended, "caller", "join").allowed, false);
  assert.equal(canActorPerformCallAction(ended, "alice", "join").allowed, false);
});

test("answered participants may end; ringing recipients may only decline", () => {
  const answered = { ...ringing, status: "answered" as const };
  assert.equal(canActorPerformCallAction(answered, "alice", "end").allowed, true);
  assert.equal(canActorPerformCallAction(answered, "outsider", "end").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "alice", "end").allowed, false);
  assert.equal(canActorPerformCallAction(ringing, "alice", "decline").allowed, true);
});
