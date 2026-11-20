import assert from "node:assert/strict";
import test from "node:test";

import { createMessageSyncNotifier } from "../messageSyncEvents";
import { preserveClientMessageIds } from "../messagingReliability";

test("message sync notifications are channel-scoped and unsubscribe cleanly", () => {
  const notifier = createMessageSyncNotifier<{ id: string }>();
  const seen: string[] = [];
  const unsubscribe = notifier.subscribe((channelId, messages, ownerUid) => {
    seen.push(`${ownerUid}:${channelId}:${messages.map((m) => m.id).join(",")}`);
  });

  notifier.notify("room-1", [{ id: "m1" }], "user-a");
  notifier.notify("room-2", [{ id: "m2" }], "user-a");
  unsubscribe();
  notifier.notify("room-1", [{ id: "m3" }], "user-a");

  assert.deepEqual(seen, ["user-a:room-1:m1", "user-a:room-2:m2"]);
});

test("one failed listener does not block other sync subscribers", () => {
  const notifier = createMessageSyncNotifier<{ id: string }>();
  const originalWarn = console.warn;
  console.warn = () => {};
  let called = false;

  try {
    notifier.subscribe(() => {
      throw new Error("broken subscriber");
    });
    notifier.subscribe(() => {
      called = true;
    });

    notifier.notify("room-1", [{ id: "m1" }]);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(called, true);
});

test("authoritative sync rows retain local client ids for optimistic de-duplication", () => {
  const rows = preserveClientMessageIds(
    [
      { id: "server-1" },
      { id: "server-2", clientMessageId: "kept-client-id" },
    ],
    [{ id: "server-1", clientMessageId: "server-1" }]
  );

  assert.equal(rows[0].clientMessageId, "server-1");
  assert.equal(rows[1].clientMessageId, "kept-client-id");
});
