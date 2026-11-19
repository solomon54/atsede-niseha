import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationCacheKey,
  conversationQueryKey,
  isSameSyncContext,
  messageQueryKey,
  sanitizeConversationPreviews,
  sanitizeMessagePreview,
  toSyncContext,
} from "../messagingReliability";

test("conversation cache and query keys are partitioned by account", () => {
  assert.equal(conversationCacheKey("user-a"), "conversations:user-a");
  assert.equal(conversationCacheKey("user-b"), "conversations:user-b");
  assert.equal(conversationCacheKey(null), null);
  assert.deepEqual(conversationQueryKey("user-a"), ["conversations", "user-a"]);
  assert.deepEqual(conversationQueryKey("user-b"), ["conversations", "user-b"]);
  assert.deepEqual(messageQueryKey("user-a", "room-1"), [
    "messages",
    "user-a",
    "room-1",
  ]);
  assert.deepEqual(messageQueryKey("user-b", "room-1"), [
    "messages",
    "user-b",
    "room-1",
  ]);
});

test("sync context distinguishes account and active-room changes", () => {
  const a = toSyncContext("room-1", "user-a");
  assert.equal(isSameSyncContext(a, toSyncContext("room-1", "user-a")), true);
  assert.equal(isSameSyncContext(a, toSyncContext("room-2", "user-a")), false);
  assert.equal(isSameSyncContext(a, toSyncContext("room-1", "user-b")), false);
});

test("encrypted conversation previews never retain ciphertext", () => {
  const conversations = [
    {
      id: "room-1",
      fullName: "Father",
      lastMessage: {
        id: "m1",
        content: "ciphertext",
        isEncrypted: true,
        decryptedPreview: "decrypted",
      },
    },
    {
      id: "room-2",
      fullName: "Common House",
      lastMessage: { id: "m2", content: "plaintext", isEncrypted: false },
    },
    { id: "room-3", fullName: "Empty", lastMessage: null },
  ];

  const safe = sanitizeConversationPreviews(conversations);

  assert.equal(
    sanitizeMessagePreview({ content: "ciphertext", isEncrypted: true }),
    ""
  );
  assert.equal(safe[0].lastMessage?.content, "decrypted");
  assert.equal(safe[0].fullName, "Father");
  assert.equal(safe[1].lastMessage?.content, "plaintext");
  assert.equal(safe[2].lastMessage, null);
  assert.equal(conversations[0].lastMessage?.content, "ciphertext");
});
