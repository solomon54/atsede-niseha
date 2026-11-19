import assert from "node:assert/strict";
import test from "node:test";

import { getMessageDeliveryFeedback } from "../syncFeedback";

test("pending outbox is queued, not sent, even when optimistic status failed locally", () => {
  const offline = getMessageDeliveryFeedback({
    localStatus: "sending",
    outboxStatus: "pending",
    isOnline: false,
  });
  assert.equal(offline.state, "queued");
  assert.equal(offline.label, "በመስመር ውጭ ተቀምጧል");
  assert.equal(offline.outboxManaged, true);

  const online = getMessageDeliveryFeedback({
    localStatus: "error",
    localError: "network failed",
    outboxStatus: "pending",
    isOnline: true,
  });
  assert.equal(online.state, "queued");
  assert.equal(online.label, "ለማመሳሰል በመጠበቅ ላይ");
});

test("failed outbox is rejected and not presented as a normal local retry", () => {
  const rejected = getMessageDeliveryFeedback({
    localStatus: "sending",
    outboxStatus: "failed",
    outboxError: "መልእክቱ አልተፈቀደም።",
  });
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.label, "መልእክቱ ውድቅ ተደርጓል");
  assert.equal(rejected.detail, "መልእክቱ አልተፈቀደም።");
  assert.equal(rejected.outboxManaged, true);
});

test("local error without an outbox row stays a local error", () => {
  const localError = getMessageDeliveryFeedback({
    localStatus: "error",
    localError: "መልእክቱን መላክ አልተቻለም።",
  });
  assert.equal(localError.state, "error");
  assert.equal(localError.outboxManaged, false);
});

test("sent local status with no outbox is confirmed", () => {
  const confirmed = getMessageDeliveryFeedback({ localStatus: "sent" });
  assert.equal(confirmed.state, "confirmed");
  assert.equal(confirmed.label, "ተልኳል");
});

test("Android uppercase local statuses use the same feedback terms", () => {
  const pending = getMessageDeliveryFeedback({
    localStatus: "PENDING",
    isOnline: false,
  });
  assert.equal(pending.state, "queued");
  assert.equal(pending.label, "በመስመር ውጭ ተቀምጧል");

  const failed = getMessageDeliveryFeedback({ localStatus: "FAILED" });
  assert.equal(failed.state, "error");
  assert.equal(failed.label, "መላክ አልተሳካም");
});
