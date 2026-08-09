// src/features/messaging/components/MessagingClient.tsx

"use client";

import { MessageSquare, ShieldCheck, Users } from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadKey } from "../crypto/keyManager";
import {
  ChannelID,
  ChannelType,
  ConversationSummary,
  FamilyID,
  MemberDisplay,
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

  const streamRef = useRef<MessageStreamHandle>(null);

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
  // FETCH CONVERSATIONS
  // ─────────────────────────────────────────────
  const fetchConversations = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) return;
      try {
        const res = await fetch("/api/message/conversation", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch conversations");

        const data: ConversationSummary[] = await res.json();
        setConversations(data);

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
    return type === "COMMON_HOUSE" ? "Family · Common House" : "Private · Direct";
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

      {/* ── DESKTOP: Conversations Sidebar ─────────────────── */}
      <aside className="hidden md:flex w-72 border-r border-slate-100 flex-col bg-[#fdfcf6] flex-none">
        <header className="px-5 py-4 border-b border-slate-100 bg-white flex-none">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
            ምስጢር ማኅደር
          </h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            Sacred Ledger
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

      {/* ── DESKTOP: Members Sidebar ───────────────────────── */}
      <aside className="hidden lg:flex w-64 border-r border-slate-100 flex-col bg-[#fdfcf6] flex-none order-last">
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
              {/* Mobile back button when in chat */}
              {mobilePane === "chat" && (
                <button
                  onClick={() => setMobilePane("convos")}
                  className="md:hidden mr-1 text-slate-400 hover:text-slate-700 text-xs font-bold">
                  ← Back
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
            <ShieldCheck size={16} className="text-amber-600/50 shrink-0" />
          </div>

          {/* MOBILE TABS */}
          <div className="flex md:hidden bg-slate-100 p-1 rounded-xl mb-3 gap-1">
            <button
              onClick={() => setMobilePane("convos")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                mobilePane === "convos"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500"
              }`}>
              <MessageSquare size={13} className="inline mr-1" />
              ውይይቶች
            </button>
            <button
              onClick={() => setMobilePane("chat")}
              disabled={!activeChannelId}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 ${
                mobilePane === "chat"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500"
              }`}>
              <MessageSquare size={13} className="inline mr-1" />
              ምስጢር
            </button>
            <button
              onClick={() => setMobilePane("members")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                mobilePane === "members"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500"
              }`}>
              <Users size={13} className="inline mr-1" />
              አባላት
            </button>
          </div>
        </header>

        {/* ── BODY ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* MOBILE: Conversation List Pane */}
          <section className={`md:hidden flex-1 overflow-y-auto bg-[#fdfcf6] ${mobilePane === "convos" ? "flex flex-col" : "hidden"}`}>
            <ConversationList
              conversations={conversations}
              activeChannelId={activeChannelId}
              onSelect={handleSelectConversation}
              currentUserId={currentUserId}
            />
          </section>

          {/* MOBILE: Members Pane */}
          <section className={`md:hidden flex-1 overflow-y-auto bg-white ${mobilePane === "members" ? "block" : "hidden"}`}>
            <MembersList members={currentMembers} currentUserId={session?.uid} />
          </section>

          {/* CHAT PANE — visible on desktop always, on mobile only when mobilePane=chat */}
          <section
            className={`flex-1 flex flex-col min-h-0 ${
              mobilePane === "chat" ? "flex" : "hidden"
            } md:flex`}>
            {activeChannelId && session ? (
              <>
                <MessageStream
                  ref={streamRef}
                  channelId={activeChannelId}
                  currentUserId={session.uid}
                  encryptionKeyId={session.familyId}
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
    </div>
  );
};

export default MessagingClient;
