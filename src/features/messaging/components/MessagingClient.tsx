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
  // 1. OFFLINE-FIRST: Initialize session from localStorage
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sacred_ledger_session");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  const [activeChannelId, setActiveChannelId] = useState<ChannelID | undefined>(
    conversations[0]?.channel.id
  );

  const [appStatus, setAppStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  /**
   * REFIERENCE FOR OPTIMISTIC UPDATES
   * This allows the Composer to "push" a message into the Stream
   * without a page refresh or a Firestore read.
   */
  const streamRef = useRef<MessageStreamHandle>(null);

  const bootSanctuary = useCallback(async () => {
    try {
      setErrorMessage("");
      const authRes = await fetch("/api/auth/refresh");

      if (!authRes.ok) {
        if (session) {
          console.warn("Auth failed, continuing in offline mode.");
          setAppStatus("ready");
          return;
        }
        throw new Error("Sacred connection lost. Please log in again.");
      }

      const sessionData: Session = await authRes.json();
      localStorage.setItem(
        "sacred_ledger_session",
        JSON.stringify(sessionData)
      );
      setSession(sessionData);

      if (!sessionData.familyId) throw new Error("No Family ID assigned.");

      const key = await loadKey(sessionData.familyId as FamilyID);
      if (!key) throw new Error("Failed to initialize security vault locally.");

      setAppStatus("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown Error";
      setErrorMessage(msg);
      setAppStatus("error");
    }
  }, [session]);

  useEffect(() => {
    bootSanctuary();
  }, [bootSanctuary]);

  // UI: ERROR STATE
  if (appStatus === "error" && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FCFBF7] p-8">
        <div className="max-w-md w-full bg-white border border-amber-100 rounded-[2rem] p-10 shadow-2xl shadow-amber-900/5 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2 font-serif">
            Sanctuary Locked
          </h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={() => bootSanctuary()}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95">
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
        <header className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
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
              <span
                className={`text-[8px] font-black uppercase tracking-tighter ${
                  appStatus === "ready" ? "text-emerald-700" : "text-amber-700"
                }`}>
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

      {/* Main Stream */}
      <main className="flex-1 flex flex-col bg-[#FCFBF7] relative">
        {errorMessage && session && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg animate-bounce">
            Connection Interrupted — Working Offline
          </div>
        )}

        {activeChannelId && session ? (
          <>
            <MessageStream
              ref={streamRef} // CONNECTING THE REF
              channelId={activeChannelId}
              currentUserId={session.uid}
            />

            <footer className="px-8 pb-8 pt-2 bg-gradient-to-t from-[#FCFBF7] via-[#FCFBF7] to-transparent">
              <div className="max-w-4xl mx-auto">
                <Composer
                  channelId={activeChannelId}
                  currentUserId={session.uid}
                  encryptionKeyId={session.familyId}
                  onOptimisticSend={(message) => {
                    // This triggers the addOptimistic method inside MessageStream
                    streamRef.current?.addOptimistic(message);
                  }}
                  onCancelSend={(messageId) => {
                    // This triggers the removeOptimistic method inside MessageStream
                    streamRef.current?.removeOptimistic(messageId);
                  }}
                />

                <div className="flex items-center justify-center gap-2 mt-4 opacity-40">
                  <svg
                    className="w-3 h-3 text-slate-400"
                    fill="currentColor"
                    viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em]">
                    End-to-End Encrypted via Sacred Vault
                  </p>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* ... (Empty State Icon) ... */}
            <p className="text-sm font-serif italic text-slate-400">
              Select a family channel to view the ledger
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MessagingClient;
