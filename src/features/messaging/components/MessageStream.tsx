// src/features/messaging/components/MessageStream.tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, MessageSquare } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMessageDeliveryFeedback } from "@/shared/domain/messaging/syncFeedback";
import { useIsMounted } from "@/shared/hooks/useIsMounted";
import { formatEthiopianDateLabel } from "@/shared/utils/calendar/ethiopianCalendar";

import { db, type OutboxOperation } from "../db/ladger-db";
import { EnrichedMessage, useMessages } from "../hooks/useMessages";
import { usePusherListener } from "../hooks/usePusherListener";
import { useSendMessage } from "../hooks/useSendMessage";
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
  currentUserRole?: ChannelRole;
  currentUserName?: string;
}

function formatDateChip(timestamp: number): string {
  const now = new Date();
  const msgDate = new Date(timestamp);

  const isToday =
    now.getFullYear() === msgDate.getFullYear() &&
    now.getMonth() === msgDate.getMonth() &&
    now.getDate() === msgDate.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === msgDate.getFullYear() &&
    yesterday.getMonth() === msgDate.getMonth() &&
    yesterday.getDate() === msgDate.getDate();

  if (isToday) return "ዛሬ (Today)";
  if (isYesterday) return "ትናንት (Yesterday)";
  return formatEthiopianDateLabel(timestamp);
}

const isSameDay = (ts1: number, ts2: number): boolean => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ channelId, currentUserId, encryptionKeyId, currentUserRole, currentUserName }, ref) => {
    const isMounted = useIsMounted();
    const scrollRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [hasNewMessagePill, setHasNewMessagePill] = useState(false);
    const prevCountRef = useRef(0);

    const storageKey = `chat_last_seen_${currentUserId}_${channelId}`;

    usePusherListener(channelId);
    const { messages, isLoading } = useMessages(channelId);
    const { sendMessage } = useSendMessage(currentUserId);

    const outboxRows = useLiveQuery(
      () =>
        currentUserId
          ? db.outbox.where("userId").equals(currentUserId).toArray()
          : Promise.resolve([] as OutboxOperation[]),
      [currentUserId]
    );
    const outboxByClientId = useMemo(() => {
      const map = new Map<string, OutboxOperation>();
      for (const row of outboxRows ?? []) {
        const clientMessageId = row.payload?.clientMessageId;
        if (typeof clientMessageId === "string") map.set(clientMessageId, row);
      }
      return map;
    }, [outboxRows]);
    const [isOnline, setIsOnline] = useState(
      () => typeof navigator === "undefined" || navigator.onLine
    );
    useEffect(() => {
      const update = () => setIsOnline(navigator.onLine);
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      addOptimistic: (_msg: OptimisticMessage) => {},
    }));

    // Find the first unread message from the other party
    const firstUnreadIndex = useMemo(() => {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].senderId !== currentUserId && !messages[i].isRead) {
          return i;
        }
      }
      return -1;
    }, [messages, currentUserId]);

    // ─────────────────────────────────────────────
    // SCROLL POSITION RESTORATION:
    // 1. If unread messages, open on first unread with unread line above it
    // 2. If nothing unread, restore exact message last left on screen
    // 3. Remember position per room per user in localStorage
    // ─────────────────────────────────────────────
    useEffect(() => {
      const el = scrollRef.current;
      if (!el || messages.length === 0 || initialScrollDone.current) return;

      const timer = setTimeout(() => {
        if (firstUnreadIndex !== -1 && messages[firstUnreadIndex]) {
          const unreadEl = document.getElementById(`msg-${messages[firstUnreadIndex].id}`);
          if (unreadEl) {
            unreadEl.scrollIntoView({ block: "center", behavior: "auto" });
            initialScrollDone.current = true;
            return;
          }
        }

        const savedId = localStorage.getItem(storageKey);
        if (savedId) {
          const savedEl = document.getElementById(`msg-${savedId}`);
          if (savedEl) {
            savedEl.scrollIntoView({ block: "center", behavior: "auto" });
            initialScrollDone.current = true;
            return;
          }
        }

        // Default to bottom
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        initialScrollDone.current = true;
      }, 50);

      return () => clearTimeout(timer);
    }, [messages, firstUnreadIndex, storageKey]);

    // Reset when switching rooms
    useEffect(() => {
      initialScrollDone.current = false;
      setHasNewMessagePill(false);
      setShowScrollDown(false);
    }, [channelId]);

    // ─────────────────────────────────────────────
    // NEW MESSAGES ARRIVAL WHILE READING UPWARD:
    // Auto-scroll only if already at bottom or user sent it.
    // Otherwise show "New message" pill.
    // ─────────────────────────────────────────────
    useEffect(() => {
      if (!initialScrollDone.current) {
        prevCountRef.current = messages.length;
        return;
      }

      if (messages.length > prevCountRef.current) {
        const newMsg = messages[messages.length - 1];
        const el = scrollRef.current;
        if (el) {
          const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const isAtBottom = distanceFromBottom < 100;
          const isMe = newMsg.senderId === currentUserId;

          if (isMe || isAtBottom) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setHasNewMessagePill(false);
          } else {
            setHasNewMessagePill(true);
          }
        }
      }
      prevCountRef.current = messages.length;
    }, [messages, currentUserId]);

    // Track scroll position to remember last left message & show jump buttons
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      const handleScroll = () => {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = distanceFromBottom < 100;
        setShowScrollDown(distanceFromBottom > 200);

        if (atBottom) {
          setHasNewMessagePill(false);
        }

        // Save visible message position
        const messageElements = el.querySelectorAll("[data-message-id]");
        for (let i = 0; i < messageElements.length; i++) {
          const rect = messageElements[i].getBoundingClientRect();
          const parentRect = el.getBoundingClientRect();
          if (rect.top >= parentRect.top && rect.bottom <= parentRect.bottom + 100) {
            const mid = messageElements[i].getAttribute("data-message-id");
            if (mid) {
              try {
                localStorage.setItem(storageKey, mid);
              } catch {}
              break;
            }
          }
        }
      };

      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }, [storageKey]);

    const scrollToBottom = () => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setHasNewMessagePill(false);
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

    /* ── DELETE ── */
    const handleDelete = useCallback(
      async (messageId: string) => {
        // Keep a tombstone instead of physically removing the row. Other
        // devices receive `message-deleted` too, and a mismatch in local
        // presence must never make the message reappear on the next sync.
        await db.messages.update(messageId as MessageID, {
          deletedAt: Date.now(),
          content: "[deleted]",
          media: null,
        });
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

    /* ── CANCEL ── */
    const handleCancel = useCallback(async (messageId: string) => {
      await db.messages.delete(messageId as MessageID);
    }, []);

    /* ── RESEND ── */
    const handleResend = useCallback(
      async (msg: Message) => {
        await db.messages.delete(msg.id);
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
        className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-5 md:px-8 py-4 sm:py-5 bg-[#FCFBF7] custom-scrollbar overscroll-contain relative"
      >
        <div className="max-w-3xl mx-auto space-y-0">
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-600/10 border-t-amber-600 rounded-full animate-spin mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/30">
                መልዕክቶችን በመክፈት ላይ…
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
              <span className="text-3xl mb-3">📜</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                ምንም መልዕክት የለም
              </p>
              <p className="text-[9px] text-slate-400 mt-1">The Ledger is Pristine</p>
            </div>
          ) : (
            messages.map((msg: EnrichedMessage, index) => {
              const prev = messages[index - 1];

              // Date chips between days ("Today", "Yesterday", or formatted date)
              const showDate =
                !prev || !isSameDay(msg.createdAt, prev.createdAt);

              // Collapse avatar/name for consecutive messages from same sender
              const grouped =
                !!prev &&
                prev.senderId === msg.senderId &&
                msg.createdAt - prev.createdAt < 2 * 60 * 1000;

              // Small unread divider line above the first unread message
              const showUnreadDivider = index === firstUnreadIndex;

              const clientMessageId =
                msg.clientMessageId ||
                (msg.id.startsWith("temp_") ? msg.id.slice("temp_".length) : undefined);
              const outboxRow = clientMessageId
                ? outboxByClientId.get(clientMessageId)
                : undefined;
              const delivery =
                msg.id.startsWith("temp_") || outboxRow || msg.status !== "sent"
                  ? getMessageDeliveryFeedback({
                      localStatus: msg.status,
                      outboxStatus: outboxRow?.status,
                      outboxError: outboxRow?.errorMessage,
                      localError: (msg as Message & { errorMessage?: string }).errorMessage,
                      isOnline,
                    })
                  : undefined;

              return (
                <div key={msg.id} id={`msg-${msg.id}`} data-message-id={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4 sm:my-6">
                      <span className="px-3 py-1 bg-amber-50 rounded-full text-[10px] font-bold text-amber-900/70 border border-amber-200/60 shadow-2xs">
                        {formatDateChip(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {showUnreadDivider && (
                    <div className="flex items-center gap-3 my-4 sm:my-6 px-4">
                      <div className="flex-1 h-px bg-amber-400/50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 shrink-0 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
                        ያልተነበቡ መልዕክቶች (Unread)
                      </span>
                      <div className="flex-1 h-px bg-amber-400/50" />
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
                    delivery={delivery}
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

        {/* Floating "New message" pill if reading upward */}
        {hasNewMessagePill && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-xl flex items-center gap-2 text-xs font-bold transition-all animate-bounce"
          >
            <MessageSquare size={14} />
            <span>አዲስ መልእክት ↓</span>
          </button>
        )}

        {/* Jump to bottom button */}
        {showScrollDown && !hasNewMessagePill && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed bottom-24 right-6 md:right-10 z-40 w-10 h-10 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-amber-600 transition-all active:scale-90 animate-in fade-in zoom-in-95 duration-200"
          >
            <ArrowDown size={18} />
          </button>
        )}
      </section>
    );
  }
);

MessageStream.displayName = "MessageStream";
export default MessageStream;
