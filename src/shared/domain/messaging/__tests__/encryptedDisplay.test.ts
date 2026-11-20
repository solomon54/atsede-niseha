import assert from "node:assert/strict";
import test from "node:test";

import {
  encryptedContentFingerprint,
  LOCKED_MESSAGE_PLACEHOLDER,
  resolveEncryptedDisplayText,
  shouldAttemptDecryption,
} from "../encryptedDisplay";

const envelope = {
  algorithm: "AES-GCM",
  keyId: "room-1",
  iv: "aXY=",
};

const encrypted = {
  id: "m1",
  content: "ciphertext",
  isEncrypted: true,
  status: "SENT",
  encryption: envelope,
};

test("encrypted messages resolve to plaintext only for the matching payload", () => {
  const entry = {
    text: "ደህና ነሽ",
    fingerprint: encryptedContentFingerprint(encrypted),
  };

  assert.equal(resolveEncryptedDisplayText(encrypted, entry), "ደህና ነሽ");
  assert.equal(shouldAttemptDecryption(encrypted, entry), false);

  const edited = { ...encrypted, encryption: { ...envelope, iv: "bmV3" } };
  assert.equal(resolveEncryptedDisplayText(edited, entry), LOCKED_MESSAGE_PLACEHOLDER);
  assert.equal(shouldAttemptDecryption(edited, entry), true);
});

test("missing or malformed envelopes resolve to an explicit locked state", () => {
  const missing = { ...encrypted, encryption: undefined };
  const entry = {
    text: LOCKED_MESSAGE_PLACEHOLDER,
    fingerprint: encryptedContentFingerprint(missing),
  };

  assert.equal(resolveEncryptedDisplayText(missing), LOCKED_MESSAGE_PLACEHOLDER);
  assert.equal(resolveEncryptedDisplayText(missing, entry), LOCKED_MESSAGE_PLACEHOLDER);
  assert.equal(shouldAttemptDecryption(missing), true);
});

test("ambiguous ellipsis is never produced for a sent encrypted message", () => {
  const visible = resolveEncryptedDisplayText(encrypted);
  assert.notEqual(visible, "…");
  assert.equal(visible, LOCKED_MESSAGE_PLACEHOLDER);
});

test("optimistic encrypted rows keep local plaintext and are not decrypted", () => {
  const pending = { ...encrypted, status: "PENDING" };
  assert.equal(resolveEncryptedDisplayText(pending), "ciphertext");
  assert.equal(shouldAttemptDecryption(pending), false);
});

test("deleted encrypted rows do not trigger decryption work", () => {
  const deleted = { ...encrypted, content: "", deletedAt: 123 };
  assert.equal(resolveEncryptedDisplayText(deleted), "");
  assert.equal(shouldAttemptDecryption(deleted), false);
});
