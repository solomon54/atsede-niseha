//src/features/messaging/hooks/useConversationList.ts
"use client";

import { useEffect, useState } from "react";

import { fetchChannels } from "../services/channel.service";
import { Channel } from "../types/messaging.types";

export function useConversationList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .finally(() => setLoading(false));
  }, []);

  return { channels, loading };
}
