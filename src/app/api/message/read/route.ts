// src/app/api/message/read/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { pusherServer } from "@/services/pusher";

import {
  findActiveRoomMembership,
  findRoomChannel,
  markRoomRead,
} from "../room-event-deps";
import { handleRoomEvent } from "../room-events";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const payload = body ?? {};
    const session = await requireSession().catch(() => null);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await handleRoomEvent({
      session,
      roomId: payload.channelId,
      operation: "READ_RECEIPT",
      clientActorUid: payload.actorUid ?? payload.userId ?? payload.senderId,
      payload,
      deps: {
        findActiveMembership: findActiveRoomMembership,
        findChannel: findRoomChannel,
        markRead: markRoomRead,
        trigger: async (channelName, event, eventPayload) => {
          await pusherServer.trigger(channelName, event, eventPayload);
        },
      },
    });

    if (result.status === 204) {
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(
      { error: result.body ?? "Request rejected" },
      { status: result.status }
    );
  } catch (error) {
    console.error("[message/read] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
