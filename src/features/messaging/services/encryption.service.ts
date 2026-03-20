// src/features/messaging/services/encryption.service.ts
import { decryptAES, encryptAES, EncryptedPayload } from "../crypto/aes";
import { loadKey } from "../crypto/keyManager";
import { EncryptionEnvelope } from "../types/messaging.types";

/* ------------------------------------------------------------
   Custom Encryption Errors
------------------------------------------------------------ */
export class EncryptionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "DecryptionError";
  }
}

/* ------------------------------------------------------------
   Encryption Service
------------------------------------------------------------ */
export const encryptionService = {
  /**
   * Encrypt content with a keyId and return ciphertext + envelope
   */
  async encrypt(
    content: string,
    keyId: string
  ): Promise<{ ciphertext: string; envelope: EncryptionEnvelope }> {
    if (!content) throw new EncryptionError("Cannot encrypt empty content");
    if (!keyId) throw new EncryptionError("Missing keyId for encryption");

    try {
      const key = await loadKey(keyId);
      if (!key)
        throw new EncryptionError(
          `Encryption key not found for keyId: ${keyId}`
        );

      const payload: EncryptedPayload = await encryptAES(content, key);

      const envelope: EncryptionEnvelope = {
        algorithm: "AES-GCM",
        keyId,
        iv: payload.iv,
      };

      return { ciphertext: payload.ciphertext, envelope };
    } catch (err) {
      console.error("[encryptionService] encryption failed", err);
      throw new EncryptionError("Failed to encrypt content", err);
    }
  },

  /**
   * Decrypt ciphertext with its encryption envelope
   */
  async decrypt(
    ciphertext: string,
    envelope: EncryptionEnvelope
  ): Promise<string> {
    if (!ciphertext)
      throw new DecryptionError("Cannot decrypt empty ciphertext");
    if (!envelope || !envelope.iv || !envelope.algorithm || !envelope.keyId)
      throw new DecryptionError("Invalid or incomplete encryption envelope");

    try {
      const key = await loadKey(envelope.keyId);
      if (!key)
        throw new DecryptionError(
          `Decryption key not found for keyId: ${envelope.keyId}`
        );

      return decryptAES({ iv: envelope.iv, ciphertext }, key);
    } catch (err) {
      console.error("[encryptionService] decryption failed", err);
      throw new DecryptionError("Failed to decrypt content", err);
    }
  },
};
