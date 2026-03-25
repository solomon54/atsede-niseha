// src/features/messaging/components/MessagingClient.tsx
"use client";

import { MessageSquare, ShieldCheck, Users } from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadKey } from "../crypto/keyManager";
import {
  ChannelID,
  ConversationSummary,
  FamilyID,
  MemberDisplay,
  Session,
} from "../types/messaging.types";
import Composer from "./Composer";
import MembersList from "./MemberList";
import MessageStream, { MessageStreamHandle } from "./MessageStream";

const MessagingClient: FC = () => {
  // ─────────────────────────────────────────────
  // CORE STATE
  // ─────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<
    ChannelID | undefined
  >();
  const [appStatus, setAppStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "members">("chat");

  const streamRef = useRef<MessageStreamHandle>(null);

  // ─────────────────────────────────────────────
  // BOOT
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

      setAppStatus("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection Error";
      console.error("[BootSanctuary]", err);
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

        if (!activeChannelId && data.length > 0) {
          setActiveChannelId(data[0].channel.id);
        }
      } catch (err) {
        console.error("[FetchConversations]", err);
      }
    },
    [activeChannelId]
  );

  // ─────────────────────────────────────────────
  // ACTIVE CONVERSATION
  // ─────────────────────────────────────────────
  const activeConversation = useMemo(() => {
    if (!conversations.length) return undefined;
    return (
      conversations.find((c) => c.channel.id === activeChannelId) ??
      conversations[0]
    );
  }, [conversations, activeChannelId]);

  // ─────────────────────────────────────────────
  // MEMBERS SYNC
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversation) {
      setMembers([]);
      return;
    }

    const normalized: MemberDisplay[] = (activeConversation.members ?? []).map(
      (m, idx) => ({
        id: m.id ?? m.userId ?? `fallback-${idx}`,
        userId: m.userId ?? `fallback-${idx}`,
        channelId: activeConversation.channel.id,
        fullName: m.fullName || m.userId || "Unknown Member",
        photoUrl: m.photoUrl || "/assets/images/qdst-bite-krstiyan.jpg",
        role: m.role ?? "MEMBER",
        joinedAt: m.joinedAt ?? new Date().toISOString(),
        isActive: m.isActive ?? false,
      })
    );

    setMembers(normalized);
  }, [activeConversation]);

  // ─────────────────────────────────────────────
  // LOADING
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

  // ─────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────
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
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.985]">
            Re-Establish Connection
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // MAIN UI (FIXED LAYOUT)
  // ─────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] w-full bg-white overflow-hidden fixed inset-0">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-80 border-r border-slate-200 flex-col bg-[#fdfcf6]">
        <header className="p-6 border-b bg-white flex-none">
          <h2 className="text-lg font-serif font-bold">Sanctuary</h2>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          <MembersList members={members} />
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FCFBF7]">
        {/* HEADER */}
        <header className="flex-none border-b bg-white px-4 md:px-6 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm font-bold">Family Sanctuary</h1>
            </div>
            <ShieldCheck size={16} />
          </div>

          {/* MOBILE TABS */}
          <div className="flex md:hidden bg-slate-100 p-1 rounded-xl mb-3">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                activeTab === "chat"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500"
              }`}>
              <MessageSquare size={14} /> Chat
            </button>

            <button
              onClick={() => setActiveTab("members")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                activeTab === "members"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500"
              }`}>
              <Users size={14} /> Members
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 flex flex-col min-h-0">
          <section
            className={`flex-1 flex flex-col min-h-0 ${
              activeTab === "chat" ? "flex" : "hidden"
            } md:flex`}>
            {activeChannelId && session ? (
              <>
                {/* ✅ SCROLL OWNER */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <MessageStream
                    ref={streamRef}
                    channelId={activeChannelId}
                    currentUserId={session.uid}
                  />
                </div>

                {/* ✅ FIXED COMPOSER */}
                <div className="flex-none bg-white border-t pb-[env(safe-area-inset-bottom)]">
                  <Composer
                    channelId={activeChannelId}
                    currentUserId={session.uid}
                    encryptionKeyId={session.familyId}
                    onOptimisticSend={(msg) =>
                      streamRef.current?.addOptimistic(msg)
                    }
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 italic">
                Harmonizing records...
              </div>
            )}
          </section>

          {/* MEMBERS MOBILE */}
          <section
            className={`flex-1 overflow-y-auto bg-white md:hidden ${
              activeTab === "members" ? "block" : "hidden"
            }`}>
            <MembersList members={members} />
          </section>
        </div>
      </main>
    </div>
  );
};

export default MessagingClient;
