//src/features/messaging/hooks/useConversation.ts
"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalConversation } from "../db/ladger-db";
import { syncService } from "../services/sync.service";
import { ConversationSummary } from "../types/messaging.types";

export function useConversations() {
  // 1. Reactive live query on Dexie conversations table (local-first)
  const localConversations = useLiveQuery(async () => {
    const list = await db.conversations.toArray();
    return list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  });

  // 2. Map LocalConversation to ConversationSummary interface expected by UI
  const data: ConversationSummary[] = useMemo(() => {
    if (!localConversations) return [];
    return localConversations.map((c) => ({
      id: c.id,
      fullName: c.fullName || (c.role === "COMMON_HOUSE" ? "የጋራ ቤት" : "የግል መልዕክት"),
      photoUrl: c.photoUrl || "",
      role: (c.role || "CHILD") as any,
      unreadCount: c.unreadCount || 0,
      channel: {
        id: c.id as any,
        familyId: "" as any,
        type: c.role as any,
        title: c.title,
        createdBy: "" as any,
        createdAt: c.updatedAt,
        lastMessageId: c.lastMessage?.id as any,
        lastMessageAt: c.lastMessageAt,
      },
      lastMessage: c.lastMessage
        ? {
            id: c.lastMessage.id as any,
            channelId: c.id as any,
            senderId: c.lastMessage.senderId as any,
            // Never expose ciphertext in previews.
            content:
              c.lastMessage.isEncrypted === true
                ? ((c.lastMessage as any).decryptedPreview || "")
                : c.lastMessage.content,
            createdAt: c.lastMessage.createdAt,
            type: (c.lastMessage.type as any) || "TEXT",
            media: c.lastMessage.media,
            isEncrypted: c.lastMessage.isEncrypted || false,
            isRead: true,
            version: "v1",
            callDetails: c.lastMessage.callDetails,
          }
        : undefined,
      members: c.members?.map((m) => ({
        id: m.userId,
        channelId: c.id as any,
        userId: m.userId as any,
        joinedAt: 0,
        isActive: true,
        fullName: m.fullName || "ተሳታፊ",
        role: (m.role as any) || "CHILD",
        photoUrl: m.photoUrl,
      })),
    }));
  }, [localConversations]);

  // 3. Trigger initial sync once on mount (no 15s interval polling)
  useEffect(() => {
    syncService.sync().catch(() => {});
  }, []);

  return {
    data,
    loading: localConversations === undefined,
    offline: typeof window !== "undefined" && !navigator.onLine,
    error: null,
  };
}
