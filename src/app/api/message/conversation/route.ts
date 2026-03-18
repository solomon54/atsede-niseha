//src/app/api/message/conversations/route.ts

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

export async function GET() {
  const session = await requireSession();

  // 1️⃣ find memberships
  const memberSnap = await adminDb
    .collection("channelMembers")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  if (memberSnap.empty) {
    return Response.json([]);
  }

  const summaries = await Promise.all(
    memberSnap.docs.map(async (doc) => {
      const member = doc.data();

      const channelDoc = await adminDb
        .collection("channels")
        .doc(member.channelId)
        .get();

      const channel = channelDoc.data();

      let lastMessage = null;

      if (channel?.lastMessageId) {
        const msgDoc = await adminDb
          .collection("channels")
          .doc(member.channelId)
          .collection("messages")
          .doc(channel.lastMessageId)
          .get();

        lastMessage = msgDoc.data() ?? null;
      }

      return {
        channel: {
          id: channelDoc.id,
          ...channel,
        },
        lastMessage,
        unreadCount: 0, // phase 1
      };
    })
  );

  return Response.json(summaries);
}
