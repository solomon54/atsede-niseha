// src/features/messaging/components/MessageStream.tsx

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { useIsMounted } from "@/shared/hooks/useIsMounted";

import { EnrichedMessage, useMessages } from "../hooks/useMessages";
import { usePusherListener } from "../hooks/usePusherListener";
import { ChannelID, OptimisticMessage, UID } from "../types/messaging.types"; // ← Import from central types
import MessageBubble from "./MessageBubble";

export interface MessageStreamHandle {
  addOptimistic: (msg: OptimisticMessage) => void;
}

interface MessageStreamProps {
  channelId: ChannelID;
  currentUserId: UID;
}

const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ channelId, currentUserId }, ref) => {
    const isMounted = useIsMounted();
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasScrolledToBottom = useRef(false);

    usePusherListener(channelId);

    const { messages, isLoading } = useMessages(channelId);

    // Expose addOptimistic to Composer
    useImperativeHandle(ref, () => ({
      addOptimistic: (optimisticMsg: OptimisticMessage) => {
        // Optimistic insertion is handled inside useSendMessage hook
        // Add extra UI logic here only if needed in the future
      },
    }));

    // Auto-scroll logic (Mobile-first)
    useEffect(() => {
      const container = scrollRef.current;
      if (!container || messages.length === 0) return;

      const isNearBottom =
        container.scrollHeight - container.scrollTop <=
        container.clientHeight + 300;

      if (!hasScrolledToBottom.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
        hasScrolledToBottom.current = true;
      } else if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }, [messages]);

    // Reset scroll flag when channel changes
    useEffect(() => {
      hasScrolledToBottom.current = false;
    }, [channelId]);

    // Read Receipts
    useEffect(() => {
      if (!isMounted || messages.length === 0) return;

      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUserId && !lastMsg.isRead) {
        fetch("/api/message/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, lastMessageId: lastMsg.id }),
        }).catch(() => {});
      }
    }, [messages, channelId, currentUserId, isMounted]);

    if (!isMounted) return null;

    return (
      <section
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 bg-[#FCFBF7] 
                   scroll-smooth custom-scrollbar overscroll-contain">
        <div className="max-w-4xl mx-auto space-y-2">
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="w-10 h-10 border-2 border-amber-600/10 border-t-amber-600 rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/40">
                Opening Sacred Ledger...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-40 text-center">
              <span className="text-4xl mb-4">📜</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                The Ledger is Pristine
              </p>
            </div>
          ) : (
            messages.map((msg: EnrichedMessage, index) => {
              const prevMsg = messages[index - 1];
              const showDate =
                !prevMsg ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(prevMsg.createdAt).toDateString();

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-6">
                      <span className="px-3 py-1 bg-amber-50 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-800/60 border border-amber-100">
                        {new Date(msg.createdAt).toLocaleDateString(undefined, {
                          dateStyle: "long",
                        })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === currentUserId}
                    senderName={msg.senderName}
                    senderRole={msg.senderRole}
                    senderPhoto={msg.senderPhoto}
                    isDiacon={msg.isDiacon}
                    onDelete={(id) => console.log("Delete", id)} // connect later
                    onResend={(msg) => console.log("Resend", msg)} // connect later
                  />
                </div>
              );
            })
          )}

          <div className="h-8 w-full" />
        </div>
      </section>
    );
  }
);

MessageStream.displayName = "MessageStream";
export default MessageStream;
