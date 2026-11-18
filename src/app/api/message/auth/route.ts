// src/app/api/message/auth/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { pusherServer } from "@/services/pusher";

import { authorizePrivateChannelRequest } from "./authorization";

async function isActiveChannelMember(channelId: string, uid: string): Promise<boolean> {
  const memberSnap = await adminDb
    .collection("ChannelMembers")
    .where("channelId", "==", channelId)
    .where("userId", "==", uid)
    .where("isActive", "==", true)
    .limit(1)
    .get();
  return !memberSnap.empty;
}

export async function POST(req: Request) {
  try {
    let session: { uid: string } | null = null;
    try {
      session = await requireSession();
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string | null;
    const channelName = formData.get("channel_name") as string | null;

    const result = await authorizePrivateChannelRequest({
      session,
      socketId,
      channelName,
      deps: {
        authorizeChannel: (sid, ch) => pusherServer.authorizeChannel(sid, ch),
        isActiveChannelMember,
      },
    });

    if (result.status === 200) {
      return NextResponse.json(result.body);
    }
    return new Response(String(result.body), { status: result.status });
  } catch (error) {
    console.error("[Pusher Auth Error]:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
