// src/features/messaging/components/MessagingClient.tsx

"use client";

import { FC, useCallback, useEffect, useRef, useState } from "react";

import { loadKey } from "../crypto/keyManager";
import {
  ChannelID,
  ConversationSummary,
  FamilyID,
  Session,
} from "../types/messaging.types";
import Composer from "./Composer";
import { ConversationList } from "./ConversationList";
import MessageStream, { MessageStreamHandle } from "./MessageStream";

interface Props {
  conversations: ConversationSummary[];
}

const MessagingClient: FC<Props> = ({ conversations }) => {
  // --- HYDRATION FIX: Start with null to match Server HTML ---
  const [session, setSession] = useState<Session | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<ChannelID | undefined>(
    conversations[0]?.channel.id
  );
  const [appStatus, setAppStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const streamRef = useRef<MessageStreamHandle>(null);

  /**
   * BOOT SANCTUARY
   * Establish identity and security vault access.
   */
  const bootSanctuary = useCallback(async () => {
    try {
      setErrorMessage("");

      // 1. Check LocalStorage First (Client-Side only)
      const saved = localStorage.getItem("sacred_ledger_session");
      let currentSession: Session | null = saved ? JSON.parse(saved) : null;

      // 2. Refresh Auth via API
      const authRes = await fetch("/api/auth/refresh");

      if (authRes.ok) {
        const sessionData: Session = await authRes.json();
        localStorage.setItem(
          "sacred_ledger_session",
          JSON.stringify(sessionData)
        );
        setSession(sessionData);
        currentSession = sessionData;
      } else if (!currentSession) {
        // No local backup and API failed
        throw new Error("Sacred connection lost. Please log in again.");
      } else {
        // API failed but we have a local session
        console.warn("Working in Offline-First mode.");
        setSession(currentSession);
      }

      // 3. Initialize Vault
      if (currentSession?.familyId) {
        const key = await loadKey(currentSession.familyId as FamilyID);
        if (!key)
          console.warn("Security vault locked. Encryption unavailable.");
      }

      setAppStatus("ready");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unknown Connection Error";
      setErrorMessage(msg);
      setAppStatus("error");
    }
  }, []);

  // Trigger boot on mount (Client-only)
  useEffect(() => {
    bootSanctuary();
  }, [bootSanctuary]);

  // --- UI: HYDRATION LOADING STATE ---
  // This prevents the mismatch by showing a clean loader until the client is ready
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

  // UI: ERROR STATE
  if (appStatus === "error" && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FCFBF7] p-8">
        <div className="max-w-md w-full bg-white border border-amber-100 rounded-[2rem] p-10 shadow-2xl text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2 font-serif">
            Sanctuary Locked
          </h1>
          <p className="text-sm text-slate-500 mb-8">{errorMessage}</p>
          <button
            onClick={() => bootSanctuary()}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
            Re-Establish Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden selection:bg-amber-100">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-200 flex flex-col bg-[#fdfcf6]">
        <header className="p-6 border-b border-slate-100 bg-white/50">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700/50">
              EOTC Ledger
            </h2>
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                appStatus === "ready"
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-amber-50 border-amber-100"
              }`}>
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  appStatus === "ready"
                    ? "bg-emerald-500"
                    : "bg-amber-500 animate-pulse"
                }`}
              />
              <span className="text-[8px] font-black uppercase tracking-tighter text-slate-600">
                {appStatus === "ready" ? "Secure" : "Syncing"}
              </span>
            </div>
          </div>
          <p className="text-lg font-serif font-bold text-slate-900">
            Sanctuary
          </p>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ConversationList
            conversations={conversations}
            activeChannelId={activeChannelId}
            onSelect={setActiveChannelId}
          />
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col bg-[#FCFBF7] relative">
        {activeChannelId && session ? (
          <>
            <MessageStream
              ref={streamRef}
              channelId={activeChannelId}
              currentUserId={session.uid}
            />

            <footer className="px-8 pb-8 pt-2 bg-gradient-to-t from-[#FCFBF7] via-[#FCFBF7] to-transparent">
              <div className="max-w-4xl mx-auto">
                <Composer
                  channelId={activeChannelId}
                  currentUserId={session.uid}
                  encryptionKeyId={session.familyId}
                  onOptimisticSend={(msg) =>
                    streamRef.current?.addOptimistic(msg)
                  }
                  // The Composer now handles its own state internally
                />
                <div className="flex items-center justify-center gap-2 mt-4 opacity-40">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em]">
                    End-to-End Encrypted via Sacred Vault
                  </p>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-sm font-serif italic text-slate-400">
              Select a family channel
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MessagingClient;
