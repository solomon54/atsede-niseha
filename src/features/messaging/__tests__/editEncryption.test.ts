import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMessageEditedEvent,
  validateClientEditEncryption,
} from "../editEncryption";

test("client edit envelope must match the channel context", () => {
  assert.deepEqual(
    validateClientEditEncryption(
      { keyId: "room-1", iv: "iv-1" },
      "room-1"
    ),
    {
      ok: true,
      encryption: { algorithm: "AES-GCM", keyId: "room-1", iv: "iv-1" },
    }
  );
  assert.deepEqual(
    validateClientEditEncryption(
      { keyId: "room-2", iv: "iv-1" },
      "room-1"
    ),
    { ok: false, error: "Encryption context mismatch" }
  );
  assert.deepEqual(
    validateClientEditEncryption({ keyId: "room-1", iv: "" }, "room-1"),
    { ok: false, error: "Invalid encryption IV" }
  );
  assert.deepEqual(validateClientEditEncryption(null, "room-1"), {
    ok: false,
    error: "Missing encryption envelope",
  });
});

test("edit event carries canonical ids and the fresh envelope", () => {
  assert.deepEqual(
    buildMessageEditedEvent({
      messageId: "msg-1",
      content: "ciphertext",
      editedAt: 1234,
      encryption: { keyId: "room-1", iv: "iv-2" },
    }),
    {
      id: "msg-1",
      messageId: "msg-1",
      content: "ciphertext",
      editedAt: 1234,
      encryption: { algorithm: "AES-GCM", keyId: "room-1", iv: "iv-2" },
    }
  );
});
