// src/app/(dashboard)/messages/page.tsx

import { FC } from "react";

import { requireSession } from "@/core/auth/requireSession";
import Composer from "@/features/messaging/components/Composer";
import { ConversationList } from "@/features/messaging/components/ConversationList";
import MessageStream from "@/features/messaging/components/MessageStream";
import {
  Channel,
  ChannelMember,
  ConversationSummary,
  Message,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

const MessagingPage: FC = async () => {
  const session = await requireSession();

  const memberDocs = await adminDb
    .collection("ChannelMembers")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  const memberships = memberDocs.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ChannelMember[];

  const channelIds = memberships.map((m) => m.channelId);
  console.log("UI conversations:", ConversationList);
  if (channelIds.length === 0) {
    return <div className="p-6">No conversations yet.</div>;
  }

  const channelDocs = await adminDb
    .collection("channels")
    .where("__name__", "in", channelIds)
    .get();

  const channels = channelDocs.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Channel[];

  const summaries: ConversationSummary[] = await Promise.all(
    channels.map(async (channel) => {
      const lastMessageSnap = await adminDb
        .collection("Channels")
        .doc(channel.id)
        .collection("Messages")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      const lastMessage: Message | undefined = lastMessageSnap.empty
        ? undefined
        : ({
            id: lastMessageSnap.docs[0].id,
            ...lastMessageSnap.docs[0].data(),
          } as Message);

      return {
        channel,
        lastMessage,
        unreadCount: 0,
      };
    })
  );

  return (
    <div className="flex h-full w-full">
      <aside className="w-80 border-r border-gray-200">
        <ConversationList conversations={summaries} />
      </aside>

      <main className="flex-1 flex flex-col">
        <MessageStream channelIds={channelIds} />
        <Composer />
      </main>
    </div>
  );
};

export default MessagingPage;
