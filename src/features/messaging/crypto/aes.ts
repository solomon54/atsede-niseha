// src/features/messaging/crypto/aes.ts
/**
 * AES-256-GCM encryption/decryption utilities.
 * Production-ready: secure random IV, authenticated encryption, base64 output.
 */

import { decode as base64Decode, encode as base64Encode } from "./serializer";

export interface EncryptedPayload {
  iv: string; // Base64-encoded IV
  ciphertext: string; // Base64-encoded ciphertext
}

/**
 * Encrypt a string using AES-GCM
 * @param plaintext UTF-8 string
 * @param key CryptoKey (AES-256-GCM)
 */
export async function encryptAES(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce recommended
  const encoder = new TextEncoder();
  const encoded = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt AES-GCM encrypted payload
 * @param payload EncryptedPayload
 * @param key CryptoKey
 */
export async function decryptAES(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  try {
    const iv = base64Decode(payload.iv);
    const ciphertext = base64Decode(payload.ciphertext);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // This catches the OperationError (Key Mismatch)
    console.error(
      "Decryption failed. This usually means the key is incorrect.",
      error
    );
    return "[Decryption Failed: Key Mismatch]";
  }
}
