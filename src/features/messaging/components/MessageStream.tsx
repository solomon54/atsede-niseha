//src/features/messaging/components/MessageStream.tsx

"use client";

import Pusher from "pusher-js";
import {
  FC,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { encryptionService } from "../services/encryption.service";
import { ChannelID, ChannelRole, Message, UID } from "../types/messaging.types";
import MessageBubble from "./MessageBubble";

interface MessageStreamProps {
  channelId: ChannelID;
  currentUserId?: UID;
}

export interface EnrichedMessage extends Message {
  senderName?: string;
  senderRole?: ChannelRole;
  senderPhoto?: string;
  isDiacon?: boolean;
  status?: "sending" | "sent" | "error";
}

// Define the "Internal API" that MessagingClient will call
export interface MessageStreamHandle {
  addOptimistic: (msg: EnrichedMessage) => void;
  removeOptimistic: (id: string) => void;
}

const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ channelId, currentUserId }, ref) => {
    const [messages, setMessages] = useState<EnrichedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // --- 1. OPTIMISTIC BRIDGE (Called by MessagingClient) ---
    useImperativeHandle(ref, () => ({
      addOptimistic: (msg) => {
        setMessages((prev) => [...prev, { ...msg, status: "sending" }]);
      },
      removeOptimistic: (id) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      },
    }));

    const decryptSingleMessage = async (
      msg: EnrichedMessage
    ): Promise<EnrichedMessage> => {
      if (msg.isEncrypted && msg.encryption && msg.content) {
        try {
          const decryptedText = await encryptionService.decrypt(
            msg.content,
            msg.encryption
          );
          return { ...msg, content: decryptedText, status: "sent" };
        } catch (err) {
          return { ...msg, content: "[Secure Content Hidden]", status: "sent" };
        }
      }
      return { ...msg, status: "sent" };
    };

    const processMessages = async (
      rawMessages: EnrichedMessage[]
    ): Promise<EnrichedMessage[]> => {
      return Promise.all(rawMessages.map(decryptSingleMessage));
    };

    useEffect(() => {
      if (!channelId) return;
      let isMounted = true;
      setIsInitialLoad(true);

      const fetchHistory = async () => {
        try {
          const res = await fetch(`/api/message/list?channelId=${channelId}`);
          if (!res.ok) throw new Error("Sync Failed");
          const rawData: EnrichedMessage[] = await res.json();
          if (isMounted) {
            const decryptedData = await processMessages(rawData);
            setMessages(decryptedData);
            setLoading(false);
          }
        } catch (err) {
          console.error("[Ledger] History Load Error:", err);
          setLoading(false);
        }
      };

      fetchHistory();

      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        authEndpoint: "/api/message/auth",
      });

      const channel = pusher.subscribe(`private-chat-${channelId}`);

      // NEW MESSAGE: Replaces optimistic or adds fresh
      channel.bind("new-message", async (incoming: EnrichedMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) {
            // Update the optimistic message to 'sent'
            return prev.map((m) =>
              m.id === incoming.id ? { ...m, status: "sent" } : m
            );
          }
          decryptSingleMessage(incoming).then((decrypted) => {
            if (isMounted) setMessages((current) => [...current, decrypted]);
          });
          return prev;
        });
      });

      // READ RECEIPTS
      channel.bind(
        "message-seen",
        (data: { messageId: string; userId: string }) => {
          if (data.userId !== currentUserId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.messageId || new Date(m.createdAt) <= new Date()
                  ? { ...m, isRead: true }
                  : m
              )
            );
          }
        }
      );

      // TYPING INDICATOR
      channel.bind(
        "client-typing",
        (data: { userId: string; userName: string; isTyping: boolean }) => {
          if (data.userId === currentUserId) return;
          setTypingUsers((prev) => {
            const updated = { ...prev };
            if (data.isTyping) updated[data.userId] = data.userName;
            else delete updated[data.userId];
            return updated;
          });
        }
      );

      return () => {
        isMounted = false;
        pusher.unsubscribe(`private-chat-${channelId}`);
        pusher.disconnect();
      };
    }, [channelId, currentUserId]);

    // SCROLL TRIGGERS
    useEffect(() => {
      const container = containerRef.current;
      if (!container || messages.length === 0) return;

      const handleReadTrigger = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
        if (isAtBottom) {
          const lastMsg = messages[messages.length - 1];
          if (
            lastMsg.senderId !== currentUserId &&
            !lastMsg.isRead &&
            lastMsg.status === "sent"
          ) {
            fetch("/api/message/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channelId, lastMessageId: lastMsg.id }),
            });
          }
        }
      };

      container.addEventListener("scroll", handleReadTrigger);
      handleReadTrigger();
      return () => container.removeEventListener("scroll", handleReadTrigger);
    }, [messages, channelId, currentUserId]);

    // SMART SCROLL
    useEffect(() => {
      const container = containerRef.current;
      if (container && messages.length > 0) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 150;
        if (isInitialLoad || isNearBottom) {
          container.scrollTo({
            top: scrollHeight,
            behavior: isInitialLoad ? "auto" : "smooth",
          });
          if (isInitialLoad) setIsInitialLoad(false);
        }
      }
    }, [messages, isInitialLoad]);

    if (loading && messages.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#FCFBF7]">
          <div className="w-8 h-8 border-2 border-amber-600/20 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900/40">
            Synchronizing Ledger
          </p>
        </div>
      );
    }

    function handleCancelSend(id: string) {
      throw new Error("Function not implemented.");
    }

    return (
      <section
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-10 bg-[#FCFBF7] scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
              <div className="text-2xl mb-4">📜</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                The Ledger is pristine
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === currentUserId}
                onCancel={(id) => {
                  handleCancelSend(id);
                }}
                senderName={msg.senderName}
                senderRole={msg.senderRole}
                senderPhoto={msg.senderPhoto}
                isDiacon={msg.isDiacon}
              />
            ))
          )}

          {/* REAL-TIME TYPING DISPLAY */}
          {Object.values(typingUsers).length > 0 && (
            <div className="py-2 text-[10px] text-amber-600 font-bold italic animate-pulse">
              {Object.values(typingUsers).join(", ")} is documenting...
            </div>
          )}
        </div>
      </section>
    );
  }
);

MessageStream.displayName = "MessageStream";

export default MessageStream;
