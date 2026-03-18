/**
 * EOTC Sacred Ledger — Messaging Service
 * ============================================================
 * Authoritative domain service for all messaging operations.
 *
 * RESPONSIBILITIES
 * ------------------------------------------------------------
 * - Permission enforcement
 * - Family isolation boundary validation
 * - Message lifecycle management
 * - Firestore persistence
 * - Ledger consistency
 *
 * NOTE:
 * UI and API routes MUST NEVER write directly to Firestore.
 * All writes flow through this service.
 */

import { adminDb } from "@/services/firebase/admin";

import {
  Channel,
  ChannelID,
  ChannelMember,
  FamilyID,
  Message,
  MessageID,
  MessageType,
  UID,
} from "../types/messaging.types";

/* ============================================================
   COLLECTION CONSTANTS
============================================================ */

const COLLECTIONS = {
  CHANNELS: "channels",
  MEMBERS: "channelMembers",
  MESSAGES: "messages",
} as const;

/* ============================================================
   ERROR TYPES
============================================================ */

export class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingError";
  }
}

export class PermissionDeniedError extends MessagingError {
  constructor() {
    super("User does not have permission to perform this action.");
  }
}

export class IsolationBoundaryError extends MessagingError {
  constructor() {
    super("Family isolation boundary violation detected.");
  }
}

/* ============================================================
   INTERNAL HELPERS
============================================================ */

async function getChannel(channelId: ChannelID): Promise<Channel> {
  const doc = await adminDb
    .collection(COLLECTIONS.CHANNELS)
    .doc(channelId)
    .get();

  if (!doc.exists) {
    throw new MessagingError("Channel not found.");
  }

  return doc.data() as Channel;
}

async function getMembership(
  channelId: ChannelID,
  userId: UID
): Promise<ChannelMember | null> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.MEMBERS)
    .where("channelId", "==", channelId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as ChannelMember;
}

function assertMemberCanSend(member: ChannelMember): void {
  if (!member.isActive) {
    throw new PermissionDeniedError();
  }

  if (member.role === "READONLY") {
    throw new PermissionDeniedError();
  }
}

function assertFamilyBoundary(
  channel: Channel,
  expectedFamilyId: FamilyID
): void {
  if (channel.familyId !== expectedFamilyId) {
    throw new IsolationBoundaryError();
  }
}

function createMessageId(): MessageID {
  return crypto.randomUUID() as MessageID;
}

/* ============================================================
   SERVICE INPUT TYPES
============================================================ */

export interface SendMessageInput {
  familyId: FamilyID;
  channelId: ChannelID;
  senderId: UID;

  type: MessageType;

  content?: string;

  media?: Message["media"];

  isEncrypted: boolean;
  encryption?: Message["encryption"];
}

export interface EditMessageInput {
  messageId: MessageID;
  channelId: ChannelID;
  editorId: UID;
  newContent: string;
}

export interface DeleteMessageInput {
  messageId: MessageID;
  channelId: ChannelID;
  requesterId: UID;
}

/* ============================================================
   MESSAGE SERVICE
============================================================ */

export const messageService = {
  /* ------------------------------------------------------------
     SEND MESSAGE
  ------------------------------------------------------------ */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const channel = await getChannel(input.channelId);

    assertFamilyBoundary(channel, input.familyId);

    const membership = await getMembership(input.channelId, input.senderId);

    if (!membership) {
      throw new PermissionDeniedError();
    }

    assertMemberCanSend(membership);

    const messageId = createMessageId();

    const now = Date.now();

    const message: Message = {
      id: messageId,
      channelId: input.channelId,
      senderId: input.senderId,
      type: input.type,
      content: input.content,
      media: input.media,
      version: "v1",
      isEncrypted: input.isEncrypted,
      encryption: input.encryption,
      createdAt: now,
    };

    const messageRef = adminDb
      .collection(COLLECTIONS.CHANNELS)
      .doc(input.channelId)
      .collection(COLLECTIONS.MESSAGES)
      .doc(messageId);

    const channelRef = adminDb
      .collection(COLLECTIONS.CHANNELS)
      .doc(input.channelId);

    const batch = adminDb.batch();

    batch.set(messageRef, message);

    batch.update(channelRef, {
      lastMessageId: messageId,
      lastMessageAt: now,
    });

    await batch.commit();

    return message;
  },

  /* ------------------------------------------------------------
     EDIT MESSAGE
  ------------------------------------------------------------ */
  async editMessage(input: EditMessageInput): Promise<Message> {
    const messageRef = adminDb
      .collection(COLLECTIONS.CHANNELS)
      .doc(input.channelId)
      .collection(COLLECTIONS.MESSAGES)
      .doc(input.messageId);

    const snap = await messageRef.get();

    if (!snap.exists) {
      throw new MessagingError("Message not found.");
    }

    const message = snap.data() as Message;

    if (message.senderId !== input.editorId) {
      throw new PermissionDeniedError();
    }

    const updated: Message = {
      ...message,
      content: input.newContent,
      editedAt: Date.now(),
    };

    await messageRef.set(updated);

    return updated;
  },

  /* ------------------------------------------------------------
     DELETE MESSAGE (Soft Delete Ledger)
  ------------------------------------------------------------ */
  async deleteMessage(input: DeleteMessageInput): Promise<void> {
    const messageRef = adminDb
      .collection(COLLECTIONS.CHANNELS)
      .doc(input.channelId)
      .collection(COLLECTIONS.MESSAGES)
      .doc(input.messageId);

    const snap = await messageRef.get();

    if (!snap.exists) {
      throw new MessagingError("Message not found.");
    }

    const message = snap.data() as Message;

    if (message.senderId !== input.requesterId) {
      throw new PermissionDeniedError();
    }

    await messageRef.update({
      deletedAt: Date.now(),
      content: "",
      media: null,
    });
  },
};
