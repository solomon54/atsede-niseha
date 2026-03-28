//src/features/messaging/types/messaging.types.ts
/**
 * EOTC Sacred Ledger — Messaging Domain Types
 * ============================================================
 * Canonical messaging contract for Atsede Niseha.
 *
 * DESIGN PRINCIPLES
 * ------------------------------------------------------------
 * - Zero `any`
 * - Explicit schema evolution
 * - Hard multi-tenant isolation (family boundary)
 * - Encryption-ready
 * - Backend + Frontend shared contract
 * - Firestore-safe serialization
 */

/* ============================================================
   1. CORE BRAND TYPES (Prevents ID Mixing)
============================================================ */

export type UID = string & { readonly __brand: "UID" };
export type ChannelID = string & { readonly __brand: "ChannelID" };
export type MessageID = string & { readonly __brand: "MessageID" };
export type FamilyID = string & { readonly __brand: "FamilyID" };

/* ============================================================
   2. CHANNEL DOMAIN
============================================================ */

export type ChannelType = "COMMON_HOUSE" | "DIRECT";

export type ChannelRole = "FATHER" | "CHILD" | "READONLY";

/**
 * Strict metadata — extensible WITHOUT `any`
 */
export interface ChannelMetadata {
  description?: string;
  avatarUrl?: string;
  isArchived?: boolean;
}

export interface Channel {
  id: ChannelID;

  /** Isolation Boundary — SECURITY CRITICAL */
  familyId: FamilyID;

  type: ChannelType;
  title?: string;

  createdBy: UID;
  createdAt: number;

  lastMessageId?: MessageID;
  lastMessageAt?: number;

  metadata?: ChannelMetadata;
}

export interface ChannelMember {
  id: string;

  channelId: ChannelID;
  userId: UID;

  role: ChannelRole;

  joinedAt: number;
  lastReadAt?: number;

  isActive: boolean;
}

/* ============================================================
   3. MESSAGE DOMAIN
============================================================ */

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "FILE"
  | "LINK"
  | "AUDIO";

// Shared OptimisticMessage used by Composer and MessageStream
export type OptimisticMessage = Omit<
  Message,
  "id" | "isRead" | "version" | "isEncrypted"
>;

export type ComposerVersion = "v1";

/**
 * Encryption envelope (future-proof)
 */
export interface EncryptionEnvelope {
  algorithm: "AES-GCM";
  keyId: string;
  iv: string;
}

/**
 * Media descriptor (Cloudinary compatible)
 */

export interface MediaDescriptor {
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
}

export interface Message {
  isRead: boolean;
  id: MessageID;
  channelId: ChannelID;
  senderId: UID;
  clientMessageId?: string | null;
  type: MessageType;
  content?: string;
  media?: MediaDescriptor | null;
  version: ComposerVersion;
  isEncrypted: boolean;
  encryption?: EncryptionEnvelope | null;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
}

/* ============================================================
   4. LINK PREVIEW DOMAIN
============================================================ */

export type LinkProvider = "youtube" | "vimeo" | "other";

export interface LinkMetadata {
  url: string;
  provider: LinkProvider;

  title?: string;
  description?: string;
  thumbnail?: string;

  /** sanitized iframe source */
  safeEmbedUrl?: string;
}

/* ============================================================
   5. DELIVERY & READ RECEIPTS
============================================================ */

export interface MessageReceipt {
  messageId: MessageID;
  userId: UID;

  deliveredAt?: number;
  readAt?: number;
}

/* ============================================================
   6. PRESENCE DOMAIN
============================================================ */

export interface UserPresence {
  userId: UID;

  online: boolean;
  lastSeenAt: number;

  /** Prevent duplicate push notifications */
  activeChannelId?: ChannelID;
}

/* ============================================================
   7. QUERY / UI PROJECTIONS (READ MODELS)
============================================================ */

/**
 * Member as displayed in UI (enriched with profile data)
 */
export interface MemberDisplay extends ChannelMember {
  fullName?: string;
  photoUrl?: string;
  // Add any other fields your backend actually returns
}

/**
 * Read-model optimized for conversation list rendering.
 * Never stored directly — computed projection.
 */
export interface ConversationSummary {
  photoUrl: string;
  fullName: string;
  role: string;
  id: string;
  channel: Channel;
  lastMessage?: Message;

  unreadCount: number;

  otherParticipant?: {
    uid: UID;
    fullName: string;
    photoUrl?: string;
    online?: boolean;
  };

  /** Members enriched with display info */
  members?: MemberDisplay[];
}

/* ============================================================
   8. SERVER EVENTS (Realtime Contracts)
============================================================ */

export type MessagingEvent =
  | {
      type: "MESSAGE_CREATED";
      payload: Message;
    }
  | {
      type: "MESSAGE_UPDATED";
      payload: Message;
    }
  | {
      type: "MESSAGE_DELETED";
      payload: {
        messageId: MessageID;
        channelId: ChannelID;
      };
    }
  | {
      type: "PRESENCE_UPDATED";
      payload: UserPresence;
    };

/* ============================================================
   9. AUTH & SESSION DOMAIN
============================================================ */

export interface Session {
  fullName: string;
  photoUrl: string | undefined;
  isDiacon: boolean;
  uid: UID;
  familyId: FamilyID;
  role: ChannelRole;
  email?: string;
}
