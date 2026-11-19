// src/app/api/message/room-event-deps.ts
/**
 * Firestore-backed dependencies for room-scoped events.
 *
 * The pure authorization orchestration lives in `room-events.ts`; these
 * functions only supply the existing membership/channel facts and persist the
 * read receipt after the authorization decision has succeeded.
 */

import type { DocumentReference } from "firebase-admin/firestore";

import { adminDb } from "@/services/firebase/admin";

import type { RoomChannel, RoomMembership } from "./room-events";

export interface FirestoreRoomMembership extends RoomMembership {
  ref: DocumentReference;
}

export async function findActiveRoomMembership(
  channelId: string,
  uid: string
): Promise<FirestoreRoomMembership | null> {
  const snap = await adminDb
    .collection("ChannelMembers")
    .where("channelId", "==", channelId)
    .where("userId", "==", uid)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();
  return {
    ref: doc.ref,
    isActive: data.isActive === true,
    role: typeof data.role === "string" ? data.role : "",
  };
}

export async function findRoomChannel(
  channelId: string
): Promise<RoomChannel | null> {
  const doc = await adminDb.collection("Channels").doc(channelId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  return {
    familyId: typeof data?.familyId === "string" ? data.familyId : "",
    type: typeof data?.type === "string" ? data.type : undefined,
  };
}

export async function markRoomRead(
  membership: FirestoreRoomMembership,
  at: number
): Promise<void> {
  await membership.ref.update({ lastReadAt: at });
}
