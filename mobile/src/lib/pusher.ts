import * as PusherModule from "pusher-js/react-native";
import { authStorage } from "./storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://atsede-niseha-v1.vercel.app";
const PUSHER_KEY =
  process.env.EXPO_PUBLIC_PUSHER_KEY || "98790e9fd846a5ffd77b";
const PUSHER_CLUSTER =
  process.env.EXPO_PUBLIC_PUSHER_CLUSTER || "ap2";

type PusherConstructor = new (
  key: string,
  options: Record<string, any>
) => any;

/**
 * Validates constructor semantics without invoking the Pusher constructor.
 * `pusher-js` ships a CommonJS bundle whose export shape differs between the
 * React Native, web, and Node entries, and Metro interop is not identical to
 * Node's. Checking the actual value avoids calling `new` on a module object.
 */
function isConstructable(value: unknown): value is PusherConstructor {
  if (typeof value !== "function") return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the Pusher constructor from the installed package.
 *
 * Installed `pusher-js@8.6.0` React Native build (`dist/react-native/pusher.js`)
 * ends with `module.exports.Pusher = ...` and provides no `default` export, so
 * the named `Pusher` property must be preferred. `default` is kept as a
 * fallback for builds/type definitions that expose the constructor that way.
 */
function resolvePusherConstructor(mod: unknown): PusherConstructor | null {
  if (isConstructable(mod)) return mod;

  if (!mod || typeof mod !== "object") return null;

  const exported = mod as Record<string, any>;
  const candidates: unknown[] = [
    exported.Pusher,
    exported.default,
    exported.default?.Pusher,
  ];

  for (const candidate of candidates) {
    if (isConstructable(candidate)) return candidate;
  }

  return null;
}

/** Describes exported names/types only — never values, tokens, or config. */
function describePusherExportShape(mod: unknown): string {
  if (mod === null) return "null";
  if (typeof mod !== "object") return typeof mod;
  try {
    const keys = Object.keys(mod);
    if (keys.length === 0) return "object with no enumerable keys";
    return keys
      .map((key) => `${key}:${typeof (mod as Record<string, any>)[key]}`)
      .join(", ");
  } catch {
    return "uninspectable object";
  }
}

const PusherClient = resolvePusherConstructor(PusherModule as unknown);

let pusherInstance: any = null;

export function getMobilePusher(): any {
  if (!pusherInstance) {
    if (!PusherClient) {
      throw new Error(
        '[MobilePusher] Could not resolve a constructable Pusher client from "pusher-js/react-native". ' +
          `Export shape: ${describePusherExportShape(PusherModule as unknown)}`
      );
    }

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
