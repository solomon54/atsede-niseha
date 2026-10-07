import { requireSession } from "@/core/auth/requireSession";
import { pusherServer } from "@/services/pusher";
import { adminDb } from "@/services/firebase/admin";

// src/app/api/message/read/route.ts
export async function POST(req: Request) {
  try {
    const { channelId, lastMessageId } = await req.json();
    const session = await requireSession();

    // 🔥 Update the member's lastReadAt in Firestore so unread counts work
    const membersRef = adminDb.collection("ChannelMembers");
    const memberSnap = await membersRef
      .where("channelId", "==", channelId)
      .where("userId", "==", session.uid)
      .limit(1)
      .get();
      
    if (!memberSnap.empty) {
      await memberSnap.docs[0].ref.update({
        lastReadAt: Date.now()
      });
    }

    await pusherServer.trigger(`private-chat-${channelId}`, "message-seen", {
      messageId: lastMessageId,
      userId: session.uid,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
