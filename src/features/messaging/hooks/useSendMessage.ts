//src/features/messaging/hooks/useSendMessage.ts

/**
 * EOTC Sacred Ledger — Production-Grade Send Hook
 * ============================================================
 * Zero 'any' policy. Robust Media Reconciliation.
 */

"use client";

import { useState } from "react";

import { db, LocalLedgerMessage } from "../db/ladger-db";
import { encryptionService } from "../services/encryption.service";
import {
  ChannelID,
  MediaDescriptor,
  MessageID,
  MessageType,
  UID,
} from "../types/messaging.types";

interface SendOptions {
  channelId: ChannelID;
  content: string;
  type: MessageType;
  file?: File;
  isEncrypted?: boolean;
}

export function useSendMessage(senderId: UID) {
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (options: SendOptions) => {
    setIsSending(true);
    const clientMessageId = crypto.randomUUID();
    const tempId = `temp_${clientMessageId}` as MessageID;
    const now = Date.now();

    // 1. OPTIMISTIC PREVIEW & SIZE CAPTURE
    const localPreviewUrl = options.file
      ? URL.createObjectURL(options.file)
      : null;
    const fileSize = options.file?.size ?? 0;

    const optimisticMessage: LocalLedgerMessage = {
      id: tempId,
      clientMessageId,
      channelId: options.channelId,
      senderId: senderId,
      content: options.content,
      type: options.type,
      status: "sending",
      createdAt: now,
      isEncrypted: false,
      isRead: false,
      version: "v1",
      localBlob: options.file, // Keep binary in Ledger for instant offline access
      media: options.file
        ? {
            url: localPreviewUrl!,
            mimeType: options.file.type,
            sizeBytes: fileSize, // Ensure UI shows correct size immediately
          }
        : null,
    };

    try {
      // Add the "Sending..." state to Dexie
      await db.messages.add(optimisticMessage);

      let finalMedia: MediaDescriptor | null = null;
      let finalContent = options.content;
      let envelope = null;

      // 2. RESILIENT MEDIA UPLOAD
      if (options.file) {
        const formData = new FormData();
        formData.append("file", options.file);
        formData.append("channelId", options.channelId);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("ፋይሉን መጫን አልተቻለም። እባክዎ ኢንተርኔትዎን አረጋግጠው እንደገና ይሞክሩ።");
        }

        const uploadData = await uploadRes.json();
        finalMedia = uploadData.media;

        // RECONCILIATION FIX: If server returns 0 or null size, force our local verified size
        if (
          finalMedia &&
          (!finalMedia.sizeBytes || finalMedia.sizeBytes === 0)
        ) {
          finalMedia.sizeBytes = fileSize;
        }
      }

      // 3. ENCRYPTION
      if (options.isEncrypted && finalContent) {
        const result = await encryptionService.encrypt(
          finalContent,
          options.channelId
        );
        finalContent = result.ciphertext;
        envelope = result.envelope;
      }

      // 4. REMOTE HANDSHAKE
      const response = await fetch("/api/message/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: options.channelId,
          content: finalContent,
          type: options.type,
          media: finalMedia,
          clientMessageId,
          isEncrypted: options.isEncrypted,
          encryption: envelope,
        }),
      });

      if (!response.ok) {
        throw new Error("መልእክቱን ወደ መዝገቡ ማስገባት አልተቻለም።");
      }

      const result = await response.json();

      // 5. ATOMIC RECONCILIATION
      // Swap Temp ID for Server ID while preserving the localBlob binary
      await db.transaction("rw", [db.messages], async () => {
        await db.messages.delete(tempId);
        await db.messages.add({
          ...optimisticMessage,
          id: result.messageId as MessageID,
          content: finalContent,
          status: "sent",
          // Fallback to optimistic media if server response is malformed
          media: finalMedia || optimisticMessage.media,
          localBlob: options.file,
          encryption: envelope,
          isEncrypted: options.isEncrypted ?? false,
        });
      });

      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "ያልታወቀ ስህተት አጋጥሟል።";
      console.error("❌ [SEND_ERROR]:", errorMessage);

      await db.messages.update(tempId, {
        status: "error",
        errorMessage: errorMessage,
      });

      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return { sendMessage, isSending };
}
