// src/app/api/message/room-events.ts
/**
 * Pure authorization and side-effect orchestration for room-scoped events.
 *
 * The authenticated actor is the only identity source. A client-supplied actor
 * UID is rejected when it disagrees with the session, and no Firestore read
 * state or Pusher room event is touched until authorization succeeds.
 *
 * Room membership and family boundary rules mirror the existing messaging
 * service: an active ChannelMembers row is required, the channel's familyId
 * must match the session's familyId, and READONLY members cannot perform a
 * write-like operation such as typing. READONLY members may still acknowledge
 * that they read a room.
 */

import { isValidChannelUid } from "./auth/authorization";

export type RoomEventOperation = "READ_RECEIPT" | "TYPING";

export interface RoomEventActor {
  uid: string;
  familyId: string;
  role?: string;
}

export interface RoomMembership {
  isActive: boolean;
  role: string;
}

export interface RoomChannel {
  familyId: string;
  type?: string;
}

export interface RoomEventDeps<
  M extends RoomMembership,
  C extends RoomChannel
> {
  findActiveMembership: (channelId: string, uid: string) => Promise<M | null>;
  findChannel: (channelId: string) => Promise<C | null>;
  markRead: (membership: M, at: number) => Promise<void>;
  trigger: (
    channelName: string,
    event: string,
    payload: unknown
  ) => Promise<void>;
}

export type RoomEventDecision<
  M extends RoomMembership,
  C extends RoomChannel
> =
  | { status: 200; channelId: string; membership: M; channel: C }
  | { status: 400 | 401 | 403; error: string };

export interface RoomEventResult {
  status: 204 | 400 | 401 | 403;
  body?: string;
}

const FORBIDDEN = "Forbidden";

/** One generic denial avoids revealing whether another family's room exists. */
function forbidden(): { status: 403; error: string } {
  return { status: 403, error: FORBIDDEN };
}

/**
 * Authorize one room-scoped operation. Framework-independent so the decision
 * can be tested without Firestore or Pusher.
 */
export async function authorizeRoomEvent<
  M extends RoomMembership,
  C extends RoomChannel
>(params: {
  session: RoomEventActor | null;
  roomId: unknown;
  operation: RoomEventOperation;
  clientActorUid?: unknown;
  deps: Pick<RoomEventDeps<M, C>, "findActiveMembership" | "findChannel">;
}): Promise<RoomEventDecision<M, C>> {
  const { session, roomId, operation, clientActorUid, deps } = params;

  if (!session?.uid) {
    return { status: 401, error: "Unauthorized" };
  }

  // Existing endpoints ignore client identity. If a caller supplies one, it
  // must agree with the authenticated session; it is never used to derive the
  // actor or the event payload.
  if (
    clientActorUid !== undefined &&
    clientActorUid !== null &&
    clientActorUid !== "" &&
    clientActorUid !== session.uid
  ) {
    return forbidden();
  }

  if (typeof roomId !== "string") {
    return { status: 400, error: "Invalid room id" };
  }
  const channelId = roomId.trim();
  if (!isValidChannelUid(channelId)) {
    return { status: 400, error: "Invalid room id" };
  }

  const membership = await deps.findActiveMembership(channelId, session.uid);
  if (!membership || membership.isActive !== true) {
    return forbidden();
  }

  const channel = await deps.findChannel(channelId);
  if (!channel) {
    return forbidden();
  }

  // Mirrors the existing messaging service's family boundary rule. Governors
  // are outside familyId allocation; an active membership is still required.
  if (
    session.role !== "GOVERNOR" &&
    channel.familyId !== session.familyId
  ) {
    return forbidden();
  }

  if (operation === "TYPING" && membership.role === "READONLY") {
    return forbidden();
  }

  return { status: 200, channelId, membership, channel };
}

/**
 * Authorize first, then perform the existing read-receipt/typing side effects.
 * Returns a transport-neutral result; routes convert it to HTTP responses.
 */
export async function handleRoomEvent<
  M extends RoomMembership,
  C extends RoomChannel
>(params: {
  session: RoomEventActor | null;
  roomId: unknown;
  operation: RoomEventOperation;
  clientActorUid?: unknown;
  payload: Record<string, unknown>;
  deps: RoomEventDeps<M, C>;
  now?: () => number;
}): Promise<RoomEventResult> {
  const { session } = params;
  const isTyping = params.payload.isTyping;
  if (!session?.uid) {
    return { status: 401, body: "Unauthorized" };
  }

  if (params.operation === "TYPING" && typeof isTyping !== "boolean") {
    return { status: 400, body: "Invalid request" };
  }

  const decision = await authorizeRoomEvent({
    session,
    roomId: params.roomId,
    operation: params.operation,
    clientActorUid: params.clientActorUid,
    deps: {
      findActiveMembership: params.deps.findActiveMembership,
      findChannel: params.deps.findChannel,
    },
  });

  if (decision.status !== 200) {
    return { status: decision.status, body: decision.error };
  }

  const channelName = `private-chat-${decision.channelId}`;

  if (params.operation === "TYPING") {
    await params.deps.trigger(channelName, "client-typing", {
      userId: session.uid,
      userName: session.uid || "Someone",
      isTyping,
    });
    return { status: 204 };
  }

  await params.deps.markRead(
    decision.membership,
    (params.now ?? Date.now)()
  );
  await params.deps.trigger(channelName, "message-seen", {
    messageId: params.payload.lastMessageId,
    userId: session.uid,
  });
  return { status: 204 };
}
