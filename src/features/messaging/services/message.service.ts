/**
 * EOTC Sacred Ledger — Messaging Service (Production-Ready)
 * ============================================================
 * Authoritative domain service for all messaging operations.
 */

import { adminDb } from "@/services/firebase/admin";

import { encryptAES, EncryptedPayload } from "../crypto/aes";
import { loadKey } from "../crypto/keyManager";
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
import { encryptionService } from "./encryption.service";
import { normalizeMedia } from "./mediaPolicy"; // New Import

/* ============================================================
   COLLECTION CONSTANTS
============================================================ */

const COLLECTIONS = {
  CHANNELS: "Channels",
  MEMBERS: "ChannelMembers",
  MESSAGES: "Messages",
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
  if (!doc.exists) throw new MessagingError("Channel not found.");
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
  if (!member.isActive || member.role === "READONLY")
    throw new PermissionDeniedError();
}

/**
 * Validates family isolation.
 * Casts role to string for "GOVERNOR" bypass comparison to satisfy TS.
 */
function assertFamilyBoundary(
  channel: Channel,
  expectedFamilyId: FamilyID,
  userRole?: string
): void {
  if (userRole === "GOVERNOR") return;

  if (channel.familyId !== expectedFamilyId) {
    console.error(
      `[ISOLATION VIOLATION] Channel: ${channel.familyId} vs Session: ${expectedFamilyId}`
    );
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
  media?: {
    url: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    thumbnailUrl?: string;
  };
  isEncrypted: boolean;
  encryption?: { keyId: string; iv?: string };
  clientMessageId?: string;
}

export interface EditMessageInput {
  familyId: FamilyID;
  channelId: ChannelID;
  editorId: UID;
  newContent: string;
  messageId: MessageID;
}

export interface DeleteMessageInput {
  familyId: FamilyID;
  messageId: MessageID;
  channelId: ChannelID;
  requesterId: UID;
}

/* ============================================================
   MESSAGE SERVICE
============================================================ */

export const messageService = {
  /* ------------------------------------------------------------
     SEND MESSAGE (Transaction-Based)
  ------------------------------------------------------------ */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    // 1. Pre-flight Validation
    if (!input.content && !input.media) {
      throw new MessagingError(
        "Message must contain either text content or media."
      );
    }

    return await adminDb.runTransaction(async (transaction) => {
      const channelRef = adminDb
        .collection(COLLECTIONS.CHANNELS)
        .doc(input.channelId);
      const channelSnap = await transaction.get(channelRef);

      if (!channelSnap.exists) throw new MessagingError("Channel not found.");
      const channel = channelSnap.data() as Channel;

      // Log exactly as requested
      console.log("CHANNEL FAMILY:", channel.familyId);
      console.log("SESSION FAMILY:", input.familyId);

      const membership = await getMembership(input.channelId, input.senderId);
      if (!membership) throw new PermissionDeniedError();

      // Boundary check with Governor Bypass
      assertFamilyBoundary(channel, input.familyId, membership.role as string);
      assertMemberCanSend(membership);

      const now = Date.now();
      const messageId: MessageID = input.clientMessageId
        ? (input.clientMessageId as MessageID)
        : createMessageId();

      // ADJUSTED: Using mediaPolicy for normalization
      // We pass through your manual normalization logic via the policy.
      const media = normalizeMedia(input.media) || undefined;

      // Find this block inside sendMessage:

      let content = input.content;
      let encryption: Message["encryption"] | undefined = undefined;

      // FIX: Only perform server-side encryption if it ISN'T already E2EE
      if (input.isEncrypted && input.content) {
        if (!input.encryption?.keyId) {
          throw new MessagingError("Encryption keyId must be provided.");
        }

        if (input.encryption.iv) {
          /**
           * CASE A: E2EE (End-to-End)
           * The client already encrypted this. Do NOT encrypt again.
           * Just pass the values through to Firestore.
           */
          content = input.content;
          encryption = {
            algorithm: "AES-GCM",
            keyId: input.encryption.keyId,
            iv: input.encryption.iv,
          };
        } else {
          /**
           * CASE B: Server-Side Encryption
           * If the client sent raw text but wants it stored encrypted.
           */
          try {
            const result = await encryptionService.encrypt(
              input.content,
              input.encryption.keyId
            );
            content = result.ciphertext;
            encryption = result.envelope;
          } catch (err) {
            throw new MessagingError("Failed to encrypt message.");
          }
        }
      }

      const message: Message = {
        id: messageId,
        channelId: input.channelId,
        senderId: input.senderId,
        type: input.type,
        content,
        media,
        version: "v1",
        isEncrypted: input.isEncrypted,
        encryption,
        createdAt: now,
      };

      const messageRef = channelRef
        .collection(COLLECTIONS.MESSAGES)
        .doc(messageId);

      // FIX: Ensure no 'undefined' fields hit Firestore
      const firestoreData = JSON.parse(JSON.stringify(message));

      // Atomic Update
      transaction.set(messageRef, firestoreData, { merge: true });
      transaction.update(channelRef, {
        lastMessageId: messageId,
        lastMessageAt: now,
      });

      return message;
    });
  },

  /* ------------------------------------------------------------
   EDIT MESSAGE (Atomic + Original Encryption Logic)
  ------------------------------------------------------------ */
  async editMessage(input: EditMessageInput): Promise<Message> {
    return await adminDb.runTransaction(async (transaction) => {
      const channelRef = adminDb
        .collection(COLLECTIONS.CHANNELS)
        .doc(input.channelId);
      const messageRef = channelRef
        .collection(COLLECTIONS.MESSAGES)
        .doc(input.messageId);

      const [chanSnap, msgSnap] = await Promise.all([
        transaction.get(channelRef),
        transaction.get(messageRef),
      ]);

      if (!msgSnap.exists) throw new MessagingError("Message not found.");
      const message = msgSnap.data() as Message;

      const membership = await getMembership(input.channelId, input.editorId);
      if (!membership || message.senderId !== input.editorId) {
        throw new PermissionDeniedError();
      }

      assertFamilyBoundary(
        chanSnap.data() as Channel,
        input.familyId,
        membership.role as string
      );

      let content = input.newContent;
      let encryption = message.encryption;

      //  Edit Encryption Logic
      if (message.isEncrypted) {
        if (!encryption?.keyId)
          throw new MessagingError("Original encryption keyId missing.");
        const key = await loadKey(encryption.keyId);
        if (!key)
          throw new MessagingError(
            "Encryption key not found for this message."
          );

        const payload: EncryptedPayload = await encryptAES(content, key);
        content = payload.ciphertext;
        encryption = {
          algorithm: "AES-GCM",
          keyId: encryption.keyId,
          iv: payload.iv,
        };
      }

      const updated: Message = {
        ...message,
        content,
        encryption,
        editedAt: Date.now(),
      };

      // Ensure clean data for Firestore
      const firestoreData = JSON.parse(JSON.stringify(updated));
      transaction.set(messageRef, firestoreData);

      return updated;
    });
  },

  /* ------------------------------------------------------------
   DELETE MESSAGE (Atomic + Original Wipe Logic)
  ------------------------------------------------------------ */
  async deleteMessage(input: DeleteMessageInput): Promise<void> {
    await adminDb.runTransaction(async (transaction) => {
      const channelRef = adminDb
        .collection(COLLECTIONS.CHANNELS)
        .doc(input.channelId);
      const messageRef = channelRef
        .collection(COLLECTIONS.MESSAGES)
        .doc(input.messageId);

      const [chanSnap, msgSnap] = await Promise.all([
        transaction.get(channelRef),
        transaction.get(messageRef),
      ]);

      if (!msgSnap.exists) throw new MessagingError("Message not found.");
      const message = msgSnap.data() as Message;

      const membership = await getMembership(
        input.channelId,
        input.requesterId
      );
      const isOwner = message.senderId === input.requesterId;
      const isGov = (membership?.role as string) === "GOVERNOR";

      if (!isOwner && !isGov) throw new PermissionDeniedError();
      assertFamilyBoundary(
        chanSnap.data() as Channel,
        input.familyId,
        membership?.role as string
      );

      let encryptedWipe: Message["encryption"] | null = null;

      // wipe logic for encrypted messages
      if (message.isEncrypted && message.encryption?.keyId) {
        const key = await loadKey(message.encryption.keyId);
        if (!key) throw new MessagingError("Encryption key not found.");

        const payload: EncryptedPayload = await encryptAES("[deleted]", key);
        encryptedWipe = {
          algorithm: "AES-GCM",
          keyId: message.encryption.keyId,
          iv: payload.iv,
        };
      }

      transaction.update(messageRef, {
        deletedAt: Date.now(),
        deletedBy: input.requesterId,
        content: message.isEncrypted ? "[deleted]" : "",
        media: null,
        encryption: encryptedWipe,
      });
    });
  },
};
