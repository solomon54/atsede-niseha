// src/services/push.ts
import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

import { adminDb } from "@/services/firebase/admin";

const PROFILE_COLLECTIONS = ["Fathers", "Students", "Governors"] as const;
const FIRESTORE_IN_LIMIT = 30;
const MULTICAST_LIMIT = 500;

/** Errors that mean the token will never work again. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

interface TokenTarget {
  token: string;
  collection: (typeof PROFILE_COLLECTIONS)[number];
  docId: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Data-only extras. Values must be strings (FCM requirement). */
  data?: Record<string, string>;
  /** Android notification channel. */
  channelId?: string;
  /** Incoming calls get a max-priority heads-up banner. */
  urgent?: boolean;
  sound?: string;
  tag?: string;
  /** Optional notification image (e.g. sender/caller photo). */
  imageUrl?: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Resolve the device tokens for a set of Firebase uids. Users may appear in
 * exactly one profile collection; we query all of them and de-duplicate.
 */
async function resolveTokenTargets(uids: string[]): Promise<TokenTarget[]> {
  const uniqueUids = [...new Set(uids.filter(Boolean))];
  if (uniqueUids.length === 0) return [];

  const targets = new Map<string, TokenTarget>();
  const uidChunks = chunk(uniqueUids, FIRESTORE_IN_LIMIT);

  for (const collection of PROFILE_COLLECTIONS) {
    for (const uidChunk of uidChunks) {
      const snap = await adminDb
        .collection(collection)
        .where("uid", "in", uidChunk)
        .get();

      snap.docs.forEach((doc) => {
        const data = doc.data();
        const token =
          typeof data.fcmToken === "string" ? data.fcmToken.trim() : "";

        if (token && !targets.has(token)) {
          targets.set(token, {
            token,
            collection,
            docId: doc.id,
          });
        }
      });
    }
  }

  return [...targets.values()];
}

async function pruneDeadToken(target: TokenTarget): Promise<void> {
  try {
    await adminDb
      .collection(target.collection)
      .doc(target.docId)
      .update({ fcmToken: FieldValue.delete() });
  } catch (error) {
    console.error("[push] Failed to prune dead token:", target.docId, error);
  }
}

/**
 * Send a notification to every device belonging to the given users.
 * Never throws — push is best-effort and must not break the primary action.
 */
export async function sendPushToUsers(
  uids: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  try {
    const targets = await resolveTokenTargets(uids);
    if (targets.length === 0) return { sent: 0, failed: 0 };

    const channelId =
      payload.channelId ?? (payload.urgent ? "atsede-call" : "atsede-messages");
    const sound = payload.sound ?? (payload.urgent ? "call_ring" : "default");

    let sent = 0;
    let failed = 0;

    for (const batch of chunk(targets, MULTICAST_LIMIT)) {
      const imageUrl = payload.imageUrl || undefined;
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch.map((t) => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
          ...(imageUrl ? { imageUrl } : {}),
        },
        data: payload.data ?? {},
        android: {
          priority: payload.urgent ? "high" : "normal",
          notification: {
            channelId,
            sound,
            priority: payload.urgent ? "max" : "default",
            visibility: "public",
            ...(payload.tag ? { tag: payload.tag } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound === "call_ring" ? "call-ring.mp3" : "default",
              ...(payload.urgent
                ? { interruptionLevel: "timeSensitive" }
                : {}),
            },
          },
          ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
        },
      });

      sent += response.successCount;
      failed += response.failureCount;

      const deadTargets: TokenTarget[] = [];
      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code;
        if (code && DEAD_TOKEN_CODES.has(code)) {
          deadTargets.push(batch[index]);
        }
      });

      await Promise.all(deadTargets.map(pruneDeadToken));
    }

    return { sent, failed };
  } catch (error) {
    console.error("[push] sendPushToUsers failed:", error);
    return { sent: 0, failed: 0 };
  }
}

/** Active member uids of a channel, excluding the actor. */
export async function getChannelRecipientUids(
  channelId: string,
  excludeUid: string
): Promise<string[]> {
  try {
    const snap = await adminDb
      .collection("ChannelMembers")
      .where("channelId", "==", channelId)
      .where("isActive", "==", true)
      .get();

    return snap.docs
      .map((doc) => doc.data().userId as string | undefined)
      .filter((uid): uid is string => Boolean(uid) && uid !== excludeUid);
  } catch (error) {
    console.error("[push] Failed to resolve channel recipients:", error);
    return [];
  }
}

/** Best-effort display name for a sender, used in push titles. */
export async function getDisplayName(uid: string): Promise<string> {
  for (const collection of PROFILE_COLLECTIONS) {
    try {
      const snap = await adminDb
        .collection(collection)
        .where("uid", "==", uid)
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data();
        return (
          data.christianName ||
          data.fullName ||
          data.secularName ||
          (collection === "Fathers" ? "የንስሐ አባት" : "የቤተሰብ አባል")
        );
      }
    } catch (error) {
      console.error(`[push] Profile lookup failed in ${collection}:`, error);
    }
  }

  return "የቤተሰብ አባል";
}

export interface UserSummary {
  displayName: string;
  photoUrl?: string | null;
  role: "FATHER" | "STUDENT" | "GOVERNOR" | "CHILD";
}

export async function getUserSummary(uid: string): Promise<UserSummary> {
  for (const collection of PROFILE_COLLECTIONS) {
    try {
      const snap = await adminDb
        .collection(collection)
        .where("uid", "==", uid)
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data();
        const displayName =
          data.christianName ||
          data.fullName ||
          data.secularName ||
          (collection === "Fathers" ? "የንስሐ አባት" : "የቤተሰብ አባል");
        const photoUrl =
          data.photoUrl || data.avatarUrl || data.profileImage || null;
        const role =
          collection === "Fathers"
            ? "FATHER"
            : collection === "Governors"
            ? "GOVERNOR"
            : "STUDENT";
        return { displayName, photoUrl, role };
      }
    } catch (error) {
      console.error(`[push] Profile lookup failed in ${collection}:`, error);
    }
  }

  return { displayName: "የቤተሰብ አባል", photoUrl: null, role: "STUDENT" };
}
