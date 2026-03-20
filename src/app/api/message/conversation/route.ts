// src/app/api/message/conversations/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  Channel,
  ChannelID,
  Message,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

// Using the exact constants from your message.service.ts
const COLLECTIONS = {
  CHANNELS: "Channels",
  MEMBERS: "ChannelMembers",
  MESSAGES: "Messages",
} as const;

export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();

    // 1. Get active memberships for the current user
    const memberSnap = await adminDb
      .collection(COLLECTIONS.MEMBERS)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json([], { status: 200 });
    }

    // 2. Map memberships to full channel data + last message
    const summaryPromises = memberSnap.docs.map(async (doc) => {
      const member = doc.data();
      const channelId = member.channelId;

      // Fetch Channel Metadata
      const channelSnap = await adminDb
        .collection(COLLECTIONS.CHANNELS)
        .doc(channelId)
        .get();

      if (!channelSnap.exists) return null;
      const channelData = channelSnap.data() as Channel;

      let lastMessage: Message | null = null;

      // Fetch the actual last message document from the sub-collection
      if (channelData.lastMessageId) {
        const msgSnap = await adminDb
          .collection(COLLECTIONS.CHANNELS)
          .doc(channelId)
          .collection(COLLECTIONS.MESSAGES)
          .doc(channelData.lastMessageId)
          .get();

        if (msgSnap.exists) {
          lastMessage = msgSnap.data() as Message;
        }
      }

      // Calculate Unread (Basic Logic)
      // If the message is newer than the last time the user opened the channel
      const isUnread =
        lastMessage &&
        (!member.lastReadAt || lastMessage.createdAt > member.lastReadAt);

      return {
        id: channelId, // Required for UI selection
        channel: { ...channelData, id: channelId as ChannelID },
        lastMessage,
        unreadCount: isUnread ? 1 : 0, // Simplified for now
      };
    });

    const summaries = (await Promise.all(summaryPromises)).filter(Boolean);

    // Sort by most recent activity
    summaries.sort((a, b) => {
      const timeA = a?.lastMessage?.createdAt || 0;
      const timeB = b?.lastMessage?.createdAt || 0;
      return timeB - timeA;
    });

    return NextResponse.json(summaries, { status: 200 });
  } catch (err) {
    console.error("[Conversations API] Critical Failure:", err);
    return NextResponse.json(
      { error: "Sacred Ledger connection failed." },
      { status: 500 }
    );
  }
}
