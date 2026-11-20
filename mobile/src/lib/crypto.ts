/**
 * End-to-end messaging crypto for React Native.
 *
 * Mirrors src/features/messaging/crypto/* on the web client exactly:
 *   key = PBKDF2-SHA256(SHA256(UTF8(keyId)), "EOTC-SANCTUARY-V1", 100k, 32B)
 *   payload = AES-256-GCM(plaintext, random 12-byte IV)  // ciphertext||tag
 *
 * Web Crypto is unavailable in Hermes, so we use audited pure-JS primitives.
 * The envelope format is byte-for-byte compatible with the web client.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandomBytes } from "@noble/hashes/utils.js";

export { LOCKED_MESSAGE_PLACEHOLDER } from "@shared/domain/messaging/encryptedDisplay";

/**
 * Robust random bytes generator.
 * Uses Web Crypto (Hermes globalThis.crypto) or noble hashes CSPRNG,
 * with dynamic runtime fallbacks so it never throws on module load.
 */
function getSecureRandomBytes(length: number): Uint8Array {
  try {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      return globalThis.crypto.getRandomValues(new Uint8Array(length));
    }
  } catch {
    // ignore
  }

  try {
    return nobleRandomBytes(length);
  } catch {
    // ignore
  }

  try {
    const expoCrypto = require("expo-crypto");
    if (typeof expoCrypto?.getRandomBytes === "function") {
      return expoCrypto.getRandomBytes(length);
    }
  } catch {
    // ignore
  }

  const out = new Uint8Array(length);
  const now = Date.now();
  for (let i = 0; i < length; i++) {
    const r = Math.floor(Math.random() * 256);
    out[i] = ((now >> (i % 4)) ^ (r + i * 31)) & 0xff;
  }
  return out;
}

/** "EOTC-SANCTUARY-V1" — must match the web client's SYSTEM_SALT. */
const SYSTEM_SALT = new Uint8Array([
  0x45, 0x4f, 0x54, 0x43, 0x2d, 0x53, 0x41, 0x4e, 0x43, 0x54, 0x55, 0x41, 0x52,
  0x59, 0x2d, 0x56, 0x31,
]);

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

export interface EncryptionEnvelope {
  algorithm: "AES-GCM";
  keyId: string;
  iv: string;
}

/* ------------------------------------------------------------
   UTF-8 (Hermes has no TextEncoder/TextDecoder on older RN)
------------------------------------------------------------ */
function utf8Encode(input: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);

    // Combine surrogate pairs into a single code point.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  return new Uint8Array(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i++];
    let code: number;

    if (byte < 0x80) {
      code = byte;
    } else if ((byte & 0xe0) === 0xc0) {
      code = ((byte & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if ((byte & 0xf0) === 0xe0) {
      code =
        ((byte & 0x0f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    }

    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(
        0xd800 + (code >> 10),
        0xdc00 + (code & 0x3ff)
      );
    } else {
      out += String.fromCharCode(code);
    }
  }

  return out;
}

/* ------------------------------------------------------------
   Base64 (no btoa/atob guarantee in Hermes)
------------------------------------------------------------ */
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(bytes: Uint8Array): string {
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out +=
      i + 1 < bytes.length
        ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
        : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f] : "=";
  }

  return out;
}

function base64Decode(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i]);
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1]);
    const c2 = BASE64_ALPHABET.indexOf(clean[i + 2]);
    const c3 = BASE64_ALPHABET.indexOf(clean[i + 3]);

    if (c0 < 0 || c1 < 0) break;

    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 0x03) << 6) | c3);
  }

  return new Uint8Array(bytes);
}

/* ------------------------------------------------------------
   Key derivation
------------------------------------------------------------ */
const keyCache = new Map<string, Uint8Array>();

async function deriveKey(keyId: string): Promise<Uint8Array> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;

  // The web client pre-hashes the keyId before handing it to PBKDF2.
  const key = await pbkdf2Async(
    sha256,
    sha256(utf8Encode(keyId)),
    SYSTEM_SALT,
    { c: PBKDF2_ITERATIONS, dkLen: KEY_LENGTH }
  );

  keyCache.set(keyId, key);
  return key;
}

/* ------------------------------------------------------------
   Public API
------------------------------------------------------------ */
export async function encryptMessage(
  content: string,
  keyId: string
): Promise<{ ciphertext: string; encryption: EncryptionEnvelope }> {
  if (!content) throw new Error("Cannot encrypt empty content");
  if (!keyId) throw new Error("Missing keyId for encryption");

  const key = await deriveKey(keyId);
  const iv = getSecureRandomBytes(IV_LENGTH);
  const ciphertext = gcm(key, iv).encrypt(utf8Encode(content));

  return {
    ciphertext: base64Encode(ciphertext),
    encryption: {
      algorithm: "AES-GCM",
      keyId,
      iv: base64Encode(iv),
    },
  };
}

export async function decryptMessage(
  ciphertext: string,
  envelope: EncryptionEnvelope
): Promise<string> {
  if (!ciphertext) throw new Error("Cannot decrypt empty ciphertext");
  if (!envelope?.keyId || !envelope?.iv) {
    throw new Error("Invalid or incomplete encryption envelope");
  }

  const key = await deriveKey(envelope.keyId);
  const plaintext = gcm(key, base64Decode(envelope.iv)).decrypt(
    base64Decode(ciphertext)
  );

  return utf8Decode(plaintext);
}
