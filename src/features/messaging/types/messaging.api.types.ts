// src/app/api/message/conversations/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  ChannelID,
  MessageID,
  MessageType,
} from "@/features/messaging/types/messaging.types";



/**
 * Metadata for a media attachment being sent to the API.
 * This aligns with the MediaDescriptor used in Firestore.
 */
export interface RequestMedia {
  url: string;
  mimeType: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
}

/**
 * The primary payload for the /api/message/send endpoint.
 */
export interface SendMessageRequest {
  channelId: string;
  type: MessageType;
  content?: string;
  media?: RequestMedia | null;
  clientMessageId?: string;
  isEncrypted?: boolean;
  encryption?: {
    keyId: string;
    iv: string;
  };
}

//
export interface DeleteMessageRequest {
  channelId: ChannelID;
  messageId: MessageID;
}

export interface DeleteMessageResponse {
  success: boolean;
  error?: string;
}

export interface EditMessageRequest {
  channelId: ChannelID;
  messageId: MessageID;
  content: string;
}

export interface EditMessageResponse {
  success: boolean;
  error?: string;
}

