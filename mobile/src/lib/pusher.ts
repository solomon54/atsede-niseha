import PusherImport from "pusher-js/react-native";
import { authStorage } from "./storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://atsede-niseha-v1.vercel.app";
const PUSHER_KEY =
  process.env.EXPO_PUBLIC_PUSHER_KEY || "98790e9fd846a5ffd77b";
const PUSHER_CLUSTER =
  process.env.EXPO_PUBLIC_PUSHER_CLUSTER || "ap2";

const PusherClient: any = (PusherImport as any)?.default ?? PusherImport;

let pusherInstance: any = null;

export function getMobilePusher(): any {
  if (!pusherInstance) {
    pusherInstance = new PusherClient(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authorizer: (channel: any) => {
        return {
          authorize: async (socketId: string, callback: (err: any, data: any) => void) => {
            try {
              const token = await authStorage.getToken();
              const formData = new FormData();
              formData.append("socket_id", socketId);
              formData.append("channel_name", channel.name);

              const response = await fetch(`${API_BASE_URL}/api/message/auth`, {
                method: "POST",
                headers: {
                  Authorization: token ? `Bearer ${token}` : "",
                },
                body: formData,
              });

              if (!response.ok) {
                callback(
                  new Error(`Pusher auth failed: ${response.status}`),
                  null as any
                );
                return;
              }

              const data = await response.json();
              callback(null, data);
            } catch (err: any) {
              callback(err, null as any);
            }
          },
        };
      },
    });
  }
  return pusherInstance;
}

