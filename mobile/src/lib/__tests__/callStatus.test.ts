import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStatusQuery,
  canPresentIncoming,
  classifyCallStatus,
  classifyStatusError,
  incomingPayloadFromStatus,
  shouldApplyEvent,
  statusTimestamp,
} from "../calling/callStatus";
import { IncomingCallPayload } from "../calling/types";

function response(overrides: Record<string, unknown> = {}) {
  return {
    callId: "call-1",
    channelId: "channel-1",
    status: "ringing",
    joinable: true,
    callerName: "Caller",
    callerRole: "FATHER",
    callerId: "user-2",
    isGroup: false,
    startedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function payload(callId = "call-1"): IncomingCallPayload {
  return {
    callId,
    channelId: "channel-1",
    callerId: "user-2",
    callerName: "Caller",
    callerRole: "FATHER",
    isGroup: false,
    startedAt: 1_700_000_000_000,
  };
}

test("authoritative ringing status admits an incoming call", () => {
  const decision = classifyCallStatus(response(), {
    callId: "call-1",
    channelId: "channel-1",
  });
  assert.equal(decision.kind, "ring");

  const admitted = canPresentIncoming(payload(), null, new Set());
  assert.equal(admitted, true);
  assert.equal(
    incomingPayloadFromStatus(response({ callerName: "Authoritative" })!, payload())?.callerName,
    "Authoritative"
  );
});

test("answered status is recoverable and stops being treated as incoming", () => {
  const decision = classifyCallStatus(
    response({ status: "answered", answeredAt: "1700000005000" })
  );
  assert.equal(decision.kind, "resume");
  if (decision.kind === "resume") {
    assert.equal(statusTimestamp(decision.response, "answeredAt"), 1_700_000_005_000);
  }
});

test("terminal statuses and stale ringing never reopen a call", () => {
  for (const status of ["ended", "declined", "missed", "cancelled"]) {
    const decision = classifyCallStatus(response({ status }));
    assert.equal(decision.kind, "terminal", status);
    if (decision.kind === "terminal") assert.equal(decision.status, status);
  }

  const stale = classifyCallStatus(
    response({ status: "ringing", stale: true, joinable: false })
  );
  assert.equal(stale.kind, "terminal");
  if (stale.kind === "terminal") assert.equal(stale.status, "missed");

  const remembered = canPresentIncoming(payload(), null, new Set(["call-1"]));
  assert.equal(remembered, false);
});

test("missing, unauthorized, mismatched, and non-joinable calls are rejected", () => {
  assert.deepEqual(classifyStatusError({ status: 401 }), {
    kind: "invalid",
    reason: "unauthorized",
  });
  assert.deepEqual(classifyStatusError({ status: 404 }), {
    kind: "invalid",
    reason: "missing",
  });
  assert.deepEqual(
    classifyCallStatus(response(), { callId: "call-1", channelId: "other-channel" }),
    { kind: "invalid", reason: "mismatch" }
  );
  assert.deepEqual(classifyCallStatus(response({ joinable: false })), {
    kind: "invalid",
    reason: "not-joinable",
  });
});

test("network failure is retryable and does not clear local state", () => {
  assert.deepEqual(classifyStatusError({ status: 503 }), { kind: "unavailable" });
  assert.deepEqual(classifyStatusError(new Error("offline")), {
    kind: "unavailable",
  });
});

test("a different active call is never replaced by a stale incoming hint", () => {
  assert.equal(
    canPresentIncoming(
      payload(),
      { callId: "call-new", status: "incoming" },
      new Set()
    ),
    false
  );
  assert.equal(shouldApplyEvent("call-old", { callId: "call-new", status: "incoming" }), false);
  assert.equal(shouldApplyEvent("call-new", { callId: "call-new", status: "incoming" }), true);
});

test("status query keeps call and channel identity explicit", () => {
  const query = buildStatusQuery({ callId: "a b", channelId: "c/d" });
  assert.match(query, /callId=a%20b/);
  assert.match(query, /channelId=c%2Fd/);
});
