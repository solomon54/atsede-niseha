// src/app/(dashboard)/messages/page.tsx

import { requireSession } from "@/core/auth/requireSession";
import MessagingClient from "@/features/messaging/components/MessagingClient";
import type {
  ChannelID,
  ConversationSummary,
  UID,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

export default async function MessagingPage() {
  const session = await requireSession();

  const memberDocs = await adminDb
    .collection("ChannelMembers")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  const memberships = memberDocs.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const channelIds = memberships.map((m: any) => m.channelId);

  if (!channelIds.length) {
    return <div className="p-6">No conversations yet.</div>;
  }

  const channelDocs = await adminDb
    .collection("Channels")
    .where("__name__", "in", channelIds)
    .get();

  const channels = channelDocs.docs.map((doc) => ({
    id: doc.id as ChannelID,
    ...doc.data(),
  }));

  const summaries: ConversationSummary[] = await Promise.all(
    channels.map(async (channel) => {
      const lastMessageSnap = await adminDb
        .collection("Channels")
        .doc(channel.id)
        .collection("Messages")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      const lastMessage = lastMessageSnap.empty
        ? undefined
        : { id: lastMessageSnap.docs[0].id, ...lastMessageSnap.docs[0].data() };

      return {
        id: channel.id,
        channel,
        lastMessage,
        unreadCount: 0,
        photoUrl: "",
        fullName: "",
        role: "",
      } as unknown as ConversationSummary;
    })
  );

  return (
    <MessagingClient
      conversations={summaries}
      currentUserId={session.uid as UID}
    />
  );
}
