//src/app/api/message/typing/route.ts

import { requireSession } from "@/core/auth/requireSession";
import { pusherServer } from "@/services/pusher";

export async function POST(req: Request) {
  const { channelId, isTyping } = await req.json();
  const session = await requireSession();

  await pusherServer.trigger(`private-chat-${channelId}`, "client-typing", {
    userId: session.uid,
    userName: session.uid || "Someone",
    isTyping: isTyping,
  });

  return new Response(null, { status: 204 });
}
