//src/features/messaging/components/Composer.tsx

"use client";

import { FC, FormEvent, useEffect, useRef, useState } from "react";

import { encryptionService } from "../services/encryption.service";
import { SendMessageRequest } from "../types/messaging.api.types";
import { ChannelID, MessageType, UID } from "../types/messaging.types";

interface ComposerProps {
  channelId: ChannelID;
  currentUserId: UID;
  encryptionKeyId?: string;
  disabled?: boolean;
  onOptimisticSend: (msg: {
    id: string;
    content: string;
    senderId: UID;
    createdAt: string;
    status: "sending" | "sent" | "failed";
    type: MessageType;
  }) => void;
  onCancelSend: (clientMessageId: string) => void;
}

const Composer: FC<ComposerProps> = ({
  channelId,
  currentUserId,
  encryptionKeyId,
  disabled = false,
  onOptimisticSend,
  onCancelSend,
}) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  // --- TYPING LOGIC ---
  const sendTypingStatus = async (status: boolean) => {
    try {
      await fetch("/api/message/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, isTyping: status }),
      });
    } catch (err) {
      // Typing status is "fire and forget", we don't crash on error
      console.warn("Typing signal lost in the ether");
    }
  };

  const handleInputChange = (newValue: string) => {
    setValue(newValue);

    // If we weren't typing before, tell the world we started
    if (!isTyping && newValue.trim().length > 0) {
      setIsTyping(true);
      sendTypingStatus(true);
    }

    // Reset the "Stopped Typing" timer (3 seconds of silence)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(false);
    }, 3000);
  };

  // --- SEND/CANCEL LOGIC ---
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      if (currentMessageIdRef.current) {
        onCancelSend(currentMessageIdRef.current);
      }
      setIsSending(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const rawContent = value.trim();
    if (!rawContent || isSending || disabled) return;

    // Immediately stop typing indicator when message is sent
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    sendTypingStatus(false);

    const clientMsgId = crypto.randomUUID();
    currentMessageIdRef.current = clientMsgId;
    setIsSending(true);
    const originalText = value;
    setValue(""); // Instant clear

    // 1. Display immediately in MessageStream
    onOptimisticSend({
      id: clientMsgId,
      content: rawContent,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      status: "sending",
      type: "TEXT",
    });

    abortControllerRef.current = new AbortController();

    try {
      let finalContent = rawContent;
      let encryptionPayload = undefined;

      if (encryptionKeyId) {
        const result = await encryptionService.encrypt(
          rawContent,
          encryptionKeyId
        );
        finalContent = result.ciphertext;
        encryptionPayload = result.envelope;
      }

      const res = await fetch("/api/message/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          type: "TEXT",
          content: finalContent,
          isEncrypted: !!encryptionKeyId,
          encryption: encryptionPayload,
          clientMessageId: clientMsgId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error("Server rejected message");
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        onCancelSend(clientMsgId);
        setValue(originalText); // Restore text so user can try again
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white p-4">
      <form
        className="mx-auto max-w-4xl flex items-center gap-3"
        onSubmit={handleSend}>
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={disabled || isSending}
            placeholder="Write to the ledger..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
          />
        </div>

        {isSending ? (
          <button
            type="button"
            onClick={handleCancel}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-all hover:bg-red-50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-amber-600 group-hover:hidden" />
            <span className="hidden text-xs font-bold text-red-500 group-hover:block">
              ✕
            </span>
          </button>
        ) : (
          <button
            title="Send Message"
            type="submit"
            disabled={disabled || !value.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-white shadow-md hover:bg-amber-700 disabled:opacity-30">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current rotate-90">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </form>
    </footer>
  );
};

export default Composer;
