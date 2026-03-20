import { requireSession } from "@/core/auth/requireSession";
import { pusherServer } from "@/services/pusher";

// src/app/api/message/read/route.ts
export async function POST(req: Request) {
  const { channelId, lastMessageId } = await req.json();
  const session = await requireSession();

  await pusherServer.trigger(`private-chat-${channelId}`, "message-seen", {
    messageId: lastMessageId,
    userId: session.uid,
  });

  return new Response(null, { status: 204 });
}
