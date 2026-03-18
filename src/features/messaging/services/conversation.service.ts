//src/features/messaging/services/conversation.service.ts

import { ConversationSummary } from "../types/messaging.types";

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/message/conversations", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load conversations");
  }

  return res.json();
}
