//src/services/pusher/client.ts
/**
 * EOTC Sacred Ledger — Pusher Client (Browser)
 * ============================================================
 */
import PusherClient from "pusher-js";

// Enable logging in development
if (process.env.NODE_ENV === "development") {
  PusherClient.logToConsole = true;
}

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    forceTLS: true,
    // This allows Pusher to hit your /api/message/auth route for private channels
    authEndpoint: "/api/message/auth",
  }
);
