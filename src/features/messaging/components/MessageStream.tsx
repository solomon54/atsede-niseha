// src/features/messaging/components/MessageStream.tsx
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { useIsMounted } from "@/shared/hooks/useIsMounted";

import { db } from "../db/ladger-db";
import { useSendMessage } from "../hooks/useSendMessage";
import { EnrichedMessage, useMessages } from "../hooks/useMessages";
import { usePusherListener } from "../hooks/usePusherListener";
import {
  ChannelID,
  Message,
  MessageID,
  MessageType,
  OptimisticMessage,
  UID,
} from "../types/messaging.types";
import MessageBubble from "./MessageBubble";

export interface MessageStreamHandle {
  addOptimistic: (msg: OptimisticMessage) => void;
}

interface MessageStreamProps {
  channelId: ChannelID;
  currentUserId: UID;
  encryptionKeyId?: string;
}

const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ channelId, currentUserId, encryptionKeyId }, ref) => {
    const isMounted = useIsMounted();
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasScrolledToBottom = useRef(false);

    usePusherListener(channelId);
    const { messages, isLoading } = useMessages(channelId);
    const { sendMessage } = useSendMessage(currentUserId);

    useImperativeHandle(ref, () => ({
      addOptimistic: (_msg: OptimisticMessage) => {
        // handled inside useSendMessage
      },
    }));

    // Auto-scroll
    useEffect(() => {
      const el = scrollRef.current;
      if (!el || messages.length === 0) return;
      const nearBottom =
        el.scrollHeight - el.scrollTop <= el.clientHeight + 300;
      if (!hasScrolledToBottom.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        hasScrolledToBottom.current = true;
      } else if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }, [messages]);

    useEffect(() => {
      hasScrolledToBottom.current = false;
    }, [channelId]);

    // Mark last message as read
    useEffect(() => {
      if (!isMounted || messages.length === 0) return;
      const last = messages[messages.length - 1];
      if (last.senderId !== currentUserId && !last.isRead) {
        fetch("/api/message/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, lastMessageId: last.id }),
        }).catch(() => {});
      }
    }, [messages, channelId, currentUserId, isMounted]);

    /* ── DELETE ── */
    const handleDelete = useCallback(
      async (messageId: string) => {
        // Optimistic remove
        await db.messages.delete(messageId as MessageID);
        try {
          await fetch("/api/message/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, messageId }),
          });
        } catch (err) {
          console.error("[delete]", err);
        }
      },
      [channelId]
    );

    /* ── CANCEL (optimistic only, never hit server) ── */
    const handleCancel = useCallback(async (messageId: string) => {
      await db.messages.delete(messageId as MessageID);
    }, []);

    /* ── RESEND ── */
    const handleResend = useCallback(
      async (msg: Message) => {
        // Remove the failed message from Dexie first
        await db.messages.delete(msg.id);

        // Re-send with original content and type
        try {
          await sendMessage({
            channelId,
            content: msg.content ?? "",
            type: msg.type as MessageType,
            isEncrypted: !!encryptionKeyId,
          });
        } catch (err) {
          console.error("[resend]", err);
        }
      },
      [channelId, encryptionKeyId, sendMessage]
    );

    if (!isMounted) return null;

    return (
      <section
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-5 md:px-8 py-4 sm:py-5
          bg-[#FCFBF7] scroll-smooth custom-scrollbar overscroll-contain">
        <div className="max-w-3xl mx-auto space-y-0">

          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-600/10 border-t-amber-600
                rounded-full animate-spin mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest
                text-amber-900/30">
                Opening Sacred Ledger…
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20
              text-center opacity-30">
              <span className="text-3xl mb-3">📜</span>
              <p className="text-[10px] font-bold uppercase tracking-widest
                text-slate-500">
                The Ledger is Pristine
              </p>
            </div>
          ) : (
            messages.map((msg: EnrichedMessage, index) => {
              const prev = messages[index - 1];
              const showDate =
                !prev ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(prev.createdAt).toDateString();

              // Collapse avatar/name for consecutive messages from same sender
              const grouped =
                !!prev &&
                prev.senderId === msg.senderId &&
                msg.createdAt - prev.createdAt < 2 * 60 * 1000;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4 sm:my-6">
                      <span className="px-3 py-1 bg-amber-50 rounded-full
                        text-[9px] font-black uppercase tracking-widest
                        text-amber-800/50 border border-amber-100">
                        {new Date(msg.createdAt).toLocaleDateString(undefined, {
                          dateStyle: "long",
                        })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === currentUserId}
                    senderName={grouped ? "" : msg.senderName}
                    senderRole={msg.senderRole}
                    senderPhoto={grouped ? undefined : msg.senderPhoto}
                    isDiacon={msg.isDiacon}
                    onDelete={handleDelete}
                    onCancel={handleCancel}
                    onResend={handleResend}
                  />
                </div>
              );
            })
          )}

          <div className="h-3" />
        </div>
      </section>
    );
  }
);

MessageStream.displayName = "MessageStream";
export default MessageStream;
