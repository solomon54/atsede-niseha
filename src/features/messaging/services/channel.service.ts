//src/features/messaging/services/channel.service.ts

import { Channel } from "../types/messaging.types";

export async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch("/api/message/channels");

  if (!res.ok) {
    throw new Error("Failed to load channels");
  }

  return res.json();
}
