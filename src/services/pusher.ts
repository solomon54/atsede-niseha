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
