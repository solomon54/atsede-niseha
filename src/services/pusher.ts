// src/services/pusher.ts
import PusherServer from "pusher";
import PusherClient from "pusher-js";

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

let clientInstance: PusherClient | null = null;

/**
 * Call events must reach the app-level controller even when the chat route is
 * not mounted, so every call event is also fanned out to private-user channels.
 */
export async function triggerCallEvent(args: {
  channelId: string;
  participantUids: string[];
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ delivered: number; failed: number }> {
  const targets = [
    `private-chat-${args.channelId}`,
    ...[...new Set(args.participantUids.filter(Boolean))].map(
      (uid) => `private-user-${uid}`
    ),
  ];

  const results = await Promise.allSettled(
    targets.map((channel) => pusherServer.trigger(channel, args.event, args.payload))
  );

  return {
    delivered: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

export const getPusherClient = () => {
  if (!clientInstance) {
    clientInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/message/auth",
    });
  } else if (
    clientInstance.connection.state === "disconnected" ||
    clientInstance.connection.state === "failed"
  ) {
    // Account cleanup disconnects the socket so it cannot stay authenticated
    // as the previous user. The next signed-in screen must be able to use
    // realtime again without requiring a full page reload.
    clientInstance.connect();
  }
  return clientInstance;
};
