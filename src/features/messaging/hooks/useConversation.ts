//src/features/messaging/hooks/useConversation.ts
"use client";

import { useEffect, useState } from "react";

import { fetchConversations } from "../services/conversation.service";
import { ConversationSummary } from "../types/messaging.types";

const CACHE_KEY = "atsede_conversation";

export function useConversations() {
  const [data, setData] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      setData(JSON.parse(cached));
      setLoading(false);
    }

    fetchConversations()
      .then((res) => {
        setData(res);
        localStorage.setItem(CACHE_KEY, JSON.stringify(res));
        setOffline(false);
      })
      .catch(() => {
        setOffline(true);
        if (!cached) {
          setError("Unable to load conversations");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, offline, error };
}
