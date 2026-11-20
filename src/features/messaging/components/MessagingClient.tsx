// src/features/messaging/components/MessagingClient.tsx

"use client";

import { MessageSquare, Phone, PhoneOff, ShieldCheck, Users, Video } from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCall } from "@/features/calling/callProvider";
import type { CallIdentity } from "@/features/calling/types";
import { getPusherClient } from "@/services/pusher";
import { normalizeCallRole } from "@/shared/domain/calling/participantIdentity";

import { loadKey } from "../crypto/keyManager";
import {
  ChannelID,
  ChannelRole,
  ChannelType,
  ConversationSummary,
  FamilyID,
  MemberDisplay,
  Message,
  Session,
  UID,
} from "../types/messaging.types";
import Composer from "./Composer";
import { ConversationList } from "./ConversationList";
import MembersList from "./MemberList";
import MessageStream, { MessageStreamHandle } from "./MessageStream";

interface MessagingClientProps {
  conversations: ConversationSummary[];
  currentUserId: UID;
}

const MessagingClient: FC<MessagingClientProps> = ({
  conversations: initialConversations,
  currentUserId,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [activeChannelId, setActiveChannelId] = useState<
    ChannelID | undefined
  >();
  const [appStatus, setAppStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  // Mobile: which panel is visible
  const [mobilePane, setMobilePane] = useState<"convos" | "chat" | "members">(
    "convos"
  );

  const { startCall } = useCall();

  // Foreground in-app message banner (web): never expose ciphertext.
  // Show decrypted text only when safely available; otherwise show exactly አዲስ መልዕክት.
  const [foregroundBanner, setForegroundBanner] = useState<{
    channelId: string;
    senderName: string;
    body: string;
  } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamRef = useRef<MessageStreamHandle>(null);

  // Track the open room without re-subscribing every time it changes.
  const activeChannelIdRef = useRef<ChannelID | undefined>(activeChannelId);
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  const conversationsRef = useRef<ConversationSummary[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const showForegroundBanner = useCallback(
    (payload: { channelId: string; senderName: string; body: string }) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setForegroundBanner(payload);
      bannerTimerRef.current = setTimeout(() => {
        setForegroundBanner(null);
        bannerTimerRef.current = null;
      }, 4500);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const getSafeForegroundBannerBody = useCallback((payload: any): string => {
    if (!payload) return "አዲስ መልዕክት";
    if (payload.deletedAt) return "አዲስ መልዕክት";
    if (payload.callDetails || payload.type === "CALL") {
      const st = payload.callDetails?.status;
      if (st === "answered") return "📞 የቪዲዮ ጥሪ ተደርጓል";
      if (st === "missed") return "📞 ያልተመለሰ ጥሪ";
      if (st === "declined") return "📞 ጥሪው ተቀባይነት አላገኘም";
      if (st === "cancelled") return "📞 ጥሪው ተሰርዟል";
      return "📞 የቪዲዮ ጥሪ";
    }
    if (payload.type === "IMAGE") return "📷 ፎቶ";
    if (payload.type === "VIDEO") return "🎥 ቪዲዮ";
    if (payload.type === "AUDIO") return "🎙 የድምጽ መልዕክት";
    if (payload.type === "FILE") return `📎 ${payload.media?.originalName || "ፋይል"}`;

    const isEncrypted = payload.isEncrypted === true;
    if (isEncrypted) {
      // Show decrypted text only when safely available; never expose ciphertext.
      const safeDecrypted =
        typeof payload.decryptedPreview === "string" && payload.decryptedPreview.trim()
          ? payload.decryptedPreview.trim()
          : typeof payload.decryptedContent === "string" && payload.decryptedContent.trim()
          ? payload.decryptedContent.trim()
          : typeof payload.plaintext === "string" && payload.plaintext.trim()
          ? payload.plaintext.trim()
          : "";
      if (safeDecrypted) {
        const oneLine = safeDecrypted.replace(/\s+/g, " ").trim();
        return oneLine.length > 80 ? oneLine.slice(0, 80) + "..." : oneLine;
      }
      return "አዲስ መልዕክት";
    }

    if (payload.decryptionFailed) return "አዲስ መልዕክት";
    const text = typeof payload.content === "string" ? payload.content.replace(/\s+/g, " ").trim() : "";
    if (!text) return "አዲስ መልዕክት";
    return text.length > 80 ? text.slice(0, 80) + "..." : text;
  }, []);

  // Opening a room counts as reading it; the server read receipt still runs
  // from MessageStream. This keeps the local badge in sync without waiting
  // for the next conversation snapshot.
  useEffect(() => {
    if (!activeChannelId) return;

    setConversations((prev) => {
      let changed = false;
      const next = prev.map((conversation) => {
        if (
          conversation.channel.id !== activeChannelId ||
          (conversation.unreadCount || 0) === 0
        ) {
          return conversation;
        }
        changed = true;
        return { ...conversation, unreadCount: 0 };
      });
      return changed ? next : prev;
    });
  }, [activeChannelId]);

  const conversationChannelIds = useMemo(
    () => conversations.map((c) => c.channel.id).join("|"),
    [conversations]
  );

  // Incoming-call events are handled once by the app-level CallProvider.

  // Keep conversation snippets and unread badges correct for rooms that are
  // not currently open. The open room is already marked read by MessageStream,
  // so it must not accumulate an unread badge while it is on screen.
  useEffect(() => {
    if (!conversationChannelIds) return;

    try {
      const pusher = getPusherClient();
      const channelIds = conversationChannelIds.split("|");

      const cleanups = channelIds.map((channelId) => {
        const channel = pusher.subscribe(`private-chat-${channelId}`);

        const handleNewMessage = (payload: Message & { senderName?: string; decryptedPreview?: string }) => {
          if (!payload?.id) return;

          const isActive = activeChannelIdRef.current === channelId;
          const isOwn = payload.senderId === currentUserId;

          // Never persist ciphertext in conversation snippets/previews.
          const safeSnippetPayload = {
            ...payload,
            content:
              payload.isEncrypted === true
                ? ""
                : typeof payload.content === "string"
                  ? payload.content
                  : "",
          } as Message;

          let accepted = false;
          setConversations((prev) =>
            prev.map((conversation) => {
              if (conversation.channel.id !== channelId) return conversation;

              // Pusher can redeliver the same event; never double-count it.
              if (conversation.lastMessage?.id === payload.id) {
                return conversation;
              }

              const previousAt =
                conversation.lastMessage?.createdAt ||
                conversation.channel.lastMessageAt ||
                0;

              // Ignore out-of-order events that are older than the snapshot.
              if (payload.createdAt && payload.createdAt < previousAt) {
                return conversation;
              }

              accepted = true;
              return {
                ...conversation,
                lastMessage: safeSnippetPayload,
                unreadCount:
                  isOwn || isActive
                    ? conversation.unreadCount || 0
                    : (conversation.unreadCount || 0) + 1,
                channel: {
                  ...conversation.channel,
                  lastMessageId: payload.id,
                  lastMessageAt: payload.createdAt,
                },
              };
            })
          );

          // Foreground in-app message banner (web): safe content only.
          if (accepted && !isOwn) {
            const conv = conversationsRef.current.find((c) => c.channel.id === channelId);
            const senderName =
              (payload as any).senderName ||
              conv?.fullName ||
              "አዲስ መልዕክት";
            const body = getSafeForegroundBannerBody(payload);
            showForegroundBanner({ channelId, senderName, body });
          }
        };

        channel.bind("new-message", handleNewMessage);

        return () => {
          channel.unbind("new-message", handleNewMessage);
        };
      });

      return () => {
        cleanups.forEach((cleanup) => cleanup());
      };
    } catch (e) {
      console.warn("Pusher conversation subscription error:", e);
    }
  }, [conversationChannelIds, currentUserId, getSafeForegroundBannerBody, showForegroundBanner]);

  // Persist realtime snippet changes so an offline reload does not show stale
  // unread/last-message metadata for this account.
  useEffect(() => {
    if (!session?.uid || conversations.length === 0) return;
    try {
      localStorage.setItem(
        `sacred_convos_${session.uid}`,
        JSON.stringify(conversations)
      );
    } catch {
      // Storage can be full or unavailable; the server remains authoritative.
    }
  }, [conversations, session?.uid]);

  // ─────────────────────────────────────────────
  // BOOT SANCTUARY
  // ─────────────────────────────────────────────
  const bootSanctuary = useCallback(async () => {
    try {
      setErrorMessage("");
      setAppStatus("loading");

      const saved = localStorage.getItem("sacred_ledger_session");
      let currentSession: Session | null = saved ? JSON.parse(saved) : null;

      const authRes = await fetch("/api/auth/refresh", {
        credentials: "include",
      });

      if (authRes.ok) {
        currentSession = await authRes.json();
        localStorage.setItem(
          "sacred_ledger_session",
          JSON.stringify(currentSession)
        );
        setSession(currentSession);
      } else if (!currentSession) {
        throw new Error("Sacred connection lost. Please log in again.");
      } else {
        setSession(currentSession);
      }

      if (currentSession?.familyId) {
        await loadKey(currentSession.familyId as FamilyID);
      }

      await fetchConversations(currentSession);

      // Silently repair missing DIRECT channels for students who claimed
      // before the provisioning fix — fully idempotent, runs in background
      fetch("/api/message/repair-channels", {
        method: "POST",
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.repaired) {
            // Channel was just created — reload conversations to show it
            fetchConversations(currentSession);
          }
        })
        .catch(() => {}); // non-blocking

      setAppStatus("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection Error";
      setErrorMessage(message);
      setAppStatus("error");
    }
  }, []);

  useEffect(() => {
    bootSanctuary();
  }, [bootSanctuary]);

  // ─────────────────────────────────────────────
  // FETCH CONVERSATIONS (Cache-First + Background Sync)
  // ─────────────────────────────────────────────
  const fetchConversations = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) return;
      try {
        // 1. Instantly load from localStorage cache if available
        const cached = localStorage.getItem(`sacred_convos_${currentSession.uid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setConversations(parsed);
              setActiveChannelId((prev) => prev ?? parsed[0]?.channel?.id);
            }
          } catch {}
        }

        // 2. Fetch fresh from server
        const res = await fetch("/api/message/conversation", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch conversations");

        const data: ConversationSummary[] = await res.json();
        setConversations(data);
        localStorage.setItem(
          `sacred_convos_${currentSession.uid}`,
          JSON.stringify(data)
        );

        // Default to first channel
        if (data.length > 0) {
          setActiveChannelId((prev) => prev ?? data[0].channel.id);
        }
      } catch (err) {
        console.error("[FetchConversations]", err);
      }
    },
    []
  );

  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.channel.id === activeChannelId) ??
      conversations[0],
    [conversations, activeChannelId]
  );

  // Reuse the conversation's authoritative peer for any call started from this
  // room. The call provider still reconciles against /status and /token so the
  // signed-in user can never be presented as the other participant.
  const activeCallPeer = useMemo<CallIdentity | undefined>(() => {
    if (!activeConversation || activeConversation.channel.type === "COMMON_HOUSE") {
      return undefined;
    }
    const other = (activeConversation.otherParticipant ||
      activeConversation.members?.find((m) => m.userId !== currentUserId)) as
      | {
          uid?: string;
          userId?: string;
          fullName?: string;
          displayName?: string;
          photoUrl?: string;
          role?: string;
        }
      | undefined;
    if (!other) return undefined;
    return {
      uid: other.uid || other.userId || "",
      name:
        other.fullName ||
        other.displayName ||
        activeConversation.fullName ||
        "የንስሐ አባል",
      photoUrl: other.photoUrl || activeConversation.photoUrl || null,
      role: normalizeCallRole(other.role),
    };
  }, [activeConversation, currentUserId]);

  // ─────────────────────────────────────────────
  // CHANNEL LABEL HELPER
  // ─────────────────────────────────────────────
  function getChannelLabel(c: ConversationSummary): string {
    if (c.channel.type === "COMMON_HOUSE") return "የጋራ ቤት";
    // For DIRECT, find the other member's name
    const other = c.members?.find((m) => m.userId !== currentUserId);
    return other?.fullName || c.fullName || "Private Chat";
  }

  function getChannelSub(type: ChannelType): string {
    return type === "COMMON_HOUSE"
      ? "የጋራ ቤት (Family)"
      : "የግል መልዕክት (Direct)";
  }

  // ─────────────────────────────────────────────
  // MEMBERS
  // ─────────────────────────────────────────────
  const currentMembers: MemberDisplay[] = useMemo(() => {
    if (!activeConversation?.members?.length) return [];
    return activeConversation.members.map((m, idx) => ({
      id: m.id ?? m.userId ?? `fallback-${idx}`,
      userId: m.userId ?? `fallback-${idx}`,
      channelId: activeConversation.channel.id as ChannelID,
      fullName: m.fullName || m.userId || "Unknown Member",
      photoUrl: m.photoUrl || "/assets/images/qdst-bite-krstiyan.jpg",
      role: m.role ?? "CHILD",
      joinedAt: m.joinedAt ?? Date.now(),
      isActive: m.isActive ?? false,
    }));
  }, [activeConversation, currentUserId]);

  // ─────────────────────────────────────────────
  // HANDLE SELECT CONVERSATION (mobile-aware)
  // ─────────────────────────────────────────────
  const handleSelectConversation = useCallback((channelId: ChannelID) => {
    setActiveChannelId(channelId);
    setMobilePane("chat");
  }, []);

  // ─────────────────────────────────────────────
  // LOADING / ERROR STATES
  // ─────────────────────────────────────────────
  if (appStatus === "loading" && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FCFBF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900/40">
            Establishing Sanctuary...
          </p>
        </div>
      </div>
    );
  }

  if (appStatus === "error" && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FCFBF7] p-8">
        <div className="max-w-md w-full bg-white border border-amber-100 rounded-[2rem] p-10 shadow-2xl text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2 font-serif">
            Sanctuary Locked
          </h1>
          <p className="text-sm text-slate-500 mb-8">{errorMessage}</p>
          <button
            onClick={bootSanctuary}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
            Re-Establish Connection
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // FULL LAYOUT
  // ─────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden fixed inset-0 md:pl-20 lg:pl-64 pb-16 md:pb-0">

      {/* ── Conversations Sidebar (visible on xl screens to give ample space to chat) ─────────────────── */}
      <aside className="hidden xl:flex w-72 border-r border-slate-100 flex-col bg-[#fdfcf6] flex-none">
        <header className="px-5 py-4 border-b border-slate-100 bg-white flex-none">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
            መልዕክት
          </h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            Messages
          </p>
        </header>
        <div className="flex-1 overflow-y-auto min-h-0">
          <ConversationList
            conversations={conversations}
            activeChannelId={activeChannelId}
            onSelect={handleSelectConversation}
            currentUserId={currentUserId}
          />
        </div>
      </aside>

      {/* ── Members Sidebar (only on 2xl ultra wide screens) ───────────────────────── */}
      <aside className="hidden 2xl:flex w-64 border-l border-slate-100 flex-col bg-[#fdfcf6] flex-none order-last">
        <header className="p-5 border-b bg-white flex-none">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
            {activeConversation?.channel.type === "COMMON_HOUSE"
              ? "Family Members"
              : "Chat Members"}
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto min-h-0">
          <MembersList members={currentMembers} currentUserId={session?.uid} />
        </div>
      </aside>

      {/* ── MAIN AREA ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#FCFBF7] relative">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header className="flex-none border-b bg-white px-4 md:px-5 pt-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Back button on non-xl screens when not on convos tab */}
              {mobilePane !== "convos" && (
                <button
                  onClick={() => setMobilePane("convos")}
                  className="xl:hidden mr-1 text-slate-600 hover:text-slate-900 text-xs font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 shrink-0">
                  <span>←</span>
                  <span className="hidden sm:inline">ውይይቶች</span>
                </button>
              )}
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">
                  {activeConversation
                    ? getChannelLabel(activeConversation)
                    : "Sanctuary"}
                </h1>
                {activeConversation && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-0.5">
                    {getChannelSub(activeConversation.channel.type)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {activeConversation && (
                <button
                  onClick={() => void startCall(activeConversation.id, activeCallPeer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title={
                    activeConversation.channel.type === "COMMON_HOUSE"
                      ? "የጋራ ቤት የቪዲዮ ጥሪ"
                      : `ከ ${getChannelLabel(activeConversation)} ጋር የቪዲዮ ጥሪ`
                  }
                >
                  <Video size={14} className="text-amber-700" />
                  <span className="hidden sm:inline">
                    {activeConversation.channel.type === "COMMON_HOUSE"
                      ? "የጋራ ቤት ጥሪ"
                      : `ከ ${getChannelLabel(activeConversation)} ጋር ጥሪ`}
                  </span>
                </button>
              )}
              <ShieldCheck size={16} className="text-amber-600/50" />
            </div>
          </div>

          {/* TABLET & MOBILE NAVIGATION TABS (visible below xl breakpoint) */}
          <div className="flex xl:hidden bg-slate-100 p-1 rounded-xl mb-3 gap-1">
            <button
              onClick={() => setMobilePane("convos")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                mobilePane === "convos"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <MessageSquare size={13} className="inline mr-1" />
              ውይይቶች (Chats)
            </button>
            <button
              onClick={() => setMobilePane("chat")}
              disabled={!activeChannelId}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 ${
                mobilePane === "chat"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <MessageSquare size={13} className="inline mr-1" />
              መልዕክቶች (Messages)
            </button>
            <button
              onClick={() => setMobilePane("members")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                mobilePane === "members"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <Users size={13} className="inline mr-1" />
              አባላት (Members)
            </button>
          </div>
        </header>

        {/* ── BODY ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Conversation List Pane (for mobile & tablet when tab is active) */}
          <section className={`xl:hidden flex-1 overflow-y-auto bg-[#fdfcf6] ${mobilePane === "convos" ? "flex flex-col" : "hidden"}`}>
            <ConversationList
              conversations={conversations}
              activeChannelId={activeChannelId}
              onSelect={handleSelectConversation}
              currentUserId={currentUserId}
            />
          </section>

          {/* Members Pane (for mobile & tablet when tab is active) */}
          <section className={`xl:hidden flex-1 overflow-y-auto bg-white ${mobilePane === "members" ? "block" : "hidden"}`}>
            <MembersList members={currentMembers} currentUserId={session?.uid} />
          </section>

          {/* CHAT PANE — visible on desktop (xl+) always, on tablet/mobile when mobilePane=chat */}
          <section
            className={`flex-1 flex flex-col min-h-0 ${
              mobilePane === "chat" ? "flex" : "hidden"
            } xl:flex`}>
            {activeChannelId && session ? (
              <>
                <MessageStream
                  ref={streamRef}
                  channelId={activeChannelId}
                  currentUserId={session.uid}
                  encryptionKeyId={session.familyId}
                  currentUserRole={session.role as ChannelRole}
                  currentUserName={session.fullName}
                  callPeer={activeCallPeer}
                />
                <div className="flex-none bg-white border-t p-2 sm:p-3 pb-[env(safe-area-inset-bottom)]">
                  <div className="max-w-4xl mx-auto w-full px-2 sm:px-4">
                    <Composer
                      channelId={activeChannelId}
                      currentUserId={session.uid}
                      encryptionKeyId={session.familyId}
                      onOptimisticSend={(msg) =>
                        streamRef.current?.addOptimistic(msg)
                      }
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <MessageSquare size={32} className="text-slate-200" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  ውይይት ይምረጡ
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Foreground in-app message banner (web, safe only) */}
      {foregroundBanner && (
        <button
          type="button"
          onClick={() => {
            setActiveChannelId(foregroundBanner.channelId as ChannelID);
            setMobilePane("chat");
            setForegroundBanner(null);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,28rem)] text-left bg-white/95 backdrop-blur border border-slate-200 shadow-xl rounded-2xl px-4 py-3 hover:bg-white transition-colors"
          aria-label="Open new message"
        >
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 truncate">
            {foregroundBanner.senderName}
          </p>
          <p className="text-sm text-slate-700 mt-0.5 line-clamp-2 break-words">
            {foregroundBanner.body}
          </p>
        </button>
      )}

      {/* Incoming call is now handled globally by GlobalIncomingCallOverlay in layout.tsx */}
    </div>
  );
};

export default MessagingClient;
