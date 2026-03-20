//src/features/messaging/types/messaging.api.types.ts
/**
 * EOTC Sacred Ledger — Messaging API Contracts
 * ------------------------------------------------
 * Authoritative request/response schemas.
 * Preserves existing ledger integrity while enabling
 * End-to-End Encryption (E2EE) and Media Normalization.
 */

import { Message, MessageType } from "./messaging.types";

/* ============================================================
   SHARED SUB-TYPES
============================================================ */

/**
 * Media payload for requests.
 * Matches the incoming shape from the Composer/Uploader.
 */
export interface RequestMedia {
  url: string;
  mimeType: string;
  size: number; // Mapping to sizeBytes in the service
  width?: number;
  height?: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

/**
 * Encryption metadata required for the Sacred Ledger.
 * Ensures the server knows HOW to handle the ciphertext.
 */
export interface RequestEncryption {
  keyId: string; // Reference to the key in the user's local KeyManager
  iv?: string; // Initialization Vector for AES-GCM
  algorithm?: string; // Default: 'AES-GCM'
}

/* ============================================================
   SEND MESSAGE
============================================================ */

export interface SendMessageRequest {
  channelId: string;
  type: MessageType;

  /** Raw text if plaintext, or Ciphertext if isEncrypted is true */
  content?: string;

  /** Media attachment descriptor */
  media?: RequestMedia;

  /** * CRITICAL: Toggle for E2EE.
   * If true, 'content' must be encrypted on the client.
   */
  isEncrypted: boolean;

  /** Metadata for decryption; mandatory if isEncrypted is true */
  encryption?: RequestEncryption;

  /** * Client-side generated UUID (MessageID).
   * Prevents duplicate messages on retry (Idempotency).
   */
  clientMessageId?: string;
}

export interface SendMessageResponse {
  success: true;
  messageId: string;
}

/* ============================================================
   EDIT MESSAGE
============================================================ */

export interface EditMessageRequest {
  channelId: string;
  messageId: string;

  /** New content (Plaintext or Ciphertext) */
  content: string;

  /** If the message is being re-encrypted with a new IV */
  encryption?: RequestEncryption;
}

export interface EditMessageResponse {
  success: true;
}

/* ============================================================
   DELETE MESSAGE
============================================================ */

export interface DeleteMessageRequest {
  channelId: string;
  messageId: string;
}

export interface DeleteMessageResponse {
  success: true;
}

/* ============================================================
   LIST MESSAGES (Future-Proofing)
============================================================ */

export interface ListMessagesRequest {
  channelId: string;
  limit?: number;
  beforeCursor?: string;
}

export interface ListMessagesResponse {
  messages: Message[];
  nextCursor?: string;
}
