import assert from "node:assert/strict";
import test from "node:test";

import { buildIncomingCallNotificationData } from "../notificationPayload";

test("incoming call push data carries category and string-only values", () => {
  const data = buildIncomingCallNotificationData({
    callId: "call-1",
    channelId: "room-1",
    callerId: "user-1",
    callerName: "Father Test",
    callerPhotoUrl: "https://example.test/a.jpg",
    callerRole: "FATHER",
    isGroup: true,
    startedAt: 1234,
  });

  assert.equal(data.type, "incoming_call");
  assert.equal(data.categoryId, "incoming_call");
  assert.equal(data.isGroup, "true");
  assert.equal(data.startedAt, "1234");
  assert.equal(Object.values(data).every((value) => typeof value === "string"), true);
});
