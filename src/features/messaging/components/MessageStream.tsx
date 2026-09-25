// src/features/messaging/components/MessageStream.tsx
"use client";

import { ArrowDown } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { useIsMounted } from "@/shared/hooks/useIsMounted";
import {
  formatEthiopianDateLabel,
  gregorianToEthiopian,
} from "@/shared/utils/calendar/ethiopianCalendar";

import { db } from "../db/ladger-db";
import { useSendMessage } from "../hooks/useSendMessage";
import { EnrichedMessage, useMessages } from "../hooks/useMessages";
import { usePusherListener } from "../hooks/usePusherListener";
import {
  ChannelID,
  ChannelRole,
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
  /** Current user's role for premium identity display */
  currentUserRole?: ChannelRole;
  currentUserName?: string;
}

const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ channelId, currentUserId, encryptionKeyId, currentUserRole, currentUserName }, ref) => {
    const isMounted = useIsMounted();
    const scrollRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const userHasScrolled = useRef(false);

    usePusherListener(channelId);
    const { messages, isLoading } = useMessages(channelId);
    const { sendMessage } = useSendMessage(currentUserId);

    useImperativeHandle(ref, () => ({
      addOptimistic: (_msg: OptimisticMessage) => {
        // handled inside useSendMessage
      },
    }));

    // ─────────────────────────────────────────────
    // SCROLL: Initial load goes to bottom. After that, NO auto-scroll.
    // User scrolls manually. A "scroll down" button appears when far from bottom.
    // ─────────────────────────────────────────────
    useEffect(() => {
      const el = scrollRef.current;
      if (!el || messages.length === 0) return;

      if (!initialScrollDone.current) {
        // First load: jump to bottom instantly
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        initialScrollDone.current = true;
        return;
      }

      // Only auto-scroll if the user sent the last message themselves
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId === currentUserId && lastMsg.status === "sending") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
      // Otherwise: do NOT scroll. Stay exactly where the user left off.
    }, [messages, currentUserId]);

    // Reset initial scroll when switching channels
    useEffect(() => {
      initialScrollDone.current = false;
      userHasScrolled.current = false;
    }, [channelId]);

    // Track scroll position for "jump to bottom" button
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      const handleScroll = () => {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(distanceFromBottom > 200);
        if (distanceFromBottom > 50) {
          userHasScrolled.current = true;
        }
      };

      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToBottom = () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };

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

    // ─────────────────────────────────────────────
    // UNREAD DIVIDER: Find the first unread message from the other person
    // ─────────────────────────────────────────────
    const firstUnreadIndex = useMemo(() => {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].senderId !== currentUserId && !messages[i].isRead) {
          return i;
        }
      }
      return -1;
    }, [messages, currentUserId]);

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

    /**
     * Ethiopian date comparison: checks if two timestamps fall on the same Ethiopian day
     */
    const isSameEthiopianDay = (ts1: number, ts2: number): boolean => {
      const d1 = gregorianToEthiopian(new Date(ts1));
      const d2 = gregorianToEthiopian(new Date(ts2));
      return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
    };

    return (
      <section
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-5 md:px-8 py-4 sm:py-5
          bg-[#FCFBF7] custom-scrollbar overscroll-contain relative">
        <div className="max-w-3xl mx-auto space-y-0">

          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-600/10 border-t-amber-600
                rounded-full animate-spin mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest
                text-amber-900/30">
                ምስጢር ማኅደርን በመክፈት ላይ…
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20
              text-center opacity-30">
              <span className="text-3xl mb-3">📜</span>
              <p className="text-[10px] font-bold uppercase tracking-widest
                text-slate-500">
                ምንም መልዕክት የለም
              </p>
              <p className="text-[9px] text-slate-400 mt-1">
                The Ledger is Pristine
              </p>
            </div>
          ) : (
            messages.map((msg: EnrichedMessage, index) => {
              const prev = messages[index - 1];

              // Ethiopian date separator
              const showDate =
                !prev || !isSameEthiopianDay(msg.createdAt, prev.createdAt);

              // Collapse avatar/name for consecutive messages from same sender
              const grouped =
                !!prev &&
                prev.senderId === msg.senderId &&
                msg.createdAt - prev.createdAt < 2 * 60 * 1000;

              // Unread divider
              const showUnreadDivider = index === firstUnreadIndex;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4 sm:my-6">
                      <span className="px-3 py-1 bg-amber-50 rounded-full
                        text-[9px] font-black uppercase tracking-widest
                        text-amber-800/50 border border-amber-100">
                        {formatEthiopianDateLabel(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {showUnreadDivider && (
                    <div className="flex items-center gap-3 my-4 sm:my-6 px-4">
                      <div className="flex-1 h-px bg-amber-400/40" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0">
                        ያልተነበቡ መልዕክቶች
                      </span>
                      <div className="flex-1 h-px bg-amber-400/40" />
                    </div>
                  )}

                  <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === currentUserId}
                    senderName={grouped ? "" : msg.senderName}
                    senderRole={msg.senderRole}
                    senderPhoto={grouped ? undefined : msg.senderPhoto}
                    isDiacon={msg.isDiacon}
                    currentUserRole={currentUserRole}
                    currentUserName={grouped ? undefined : currentUserName}
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

        {/* Jump to bottom button */}
        {showScrollDown && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed bottom-28 right-6 md:right-10 z-40 w-10 h-10 rounded-full
              bg-slate-900 text-white shadow-xl flex items-center justify-center
              hover:bg-amber-600 transition-all active:scale-90
              animate-in fade-in zoom-in-95 duration-200">
            <ArrowDown size={18} />
          </button>
        )}
      </section>
    );
  }
);

MessageStream.displayName = "MessageStream";
export default MessageStream;

