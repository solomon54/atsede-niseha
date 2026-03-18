//src/features/messaging/types/messaging.api.types.ts
/**
 * Messaging API Contracts
 * ------------------------------------------------
 * Defines request/response schemas between client
 * and server. No business logic here.
 */

import { MessageType } from "./messaging.types";

/* =========================
   SEND MESSAGE
========================= */

export interface SendMessageRequest {
  channelId: string;
  type: MessageType;

  content?: string;

  media?: {
    url: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  };

  isEncrypted: boolean;
}

export interface SendMessageResponse {
  success: true;
  messageId: string;
}

/* =========================
   EDIT MESSAGE
========================= */

export interface EditMessageRequest {
  channelId: string;
  messageId: string;
  content: string;
}

export interface EditMessageResponse {
  success: true;
}

/* =========================
   DELETE MESSAGE
========================= */

export interface DeleteMessageRequest {
  channelId: string;
  messageId: string;
}

export interface DeleteMessageResponse {
  success: true;
}
