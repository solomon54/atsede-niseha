// src/app/api/message/auth/authorization.ts

export const PRIVATE_USER_PREFIX = "private-user-";
export const PRIVATE_CHAT_PREFIX = "private-chat-";
export const PRIVATE_APPOINTMENTS_PREFIX = "private-appointments-";

export type ChannelAuthDeps = {
  authorizeChannel: (socketId: string, channelName: string) => unknown;
  isActiveChannelMember: (channelId: string, uid: string) => Promise<boolean>;
};

export type ChannelAuthResult = {
  status: number;
  body: unknown;
};

export function isValidChannelUid(uid: string): boolean {
  // Firebase/Auth UIDs and app IDs are opaque strings; reject empty/unsafe shapes.
  return uid.length > 0 && uid.length <= 128 && !uid.includes("/") && !/\s/.test(uid);
}

/**
 * Pure authorization decision for Pusher private channels.
 *
 * The authenticated UID MUST come from the server session; this function never
 * infers or trusts a UID from the client except as the requested channel target.
 */
export async function authorizePrivateChannelRequest(params: {
  session: { uid: string } | null;
  socketId: string | null | undefined;
  channelName: string | null | undefined;
  deps: ChannelAuthDeps;
}): Promise<ChannelAuthResult> {
  const { session, socketId, channelName, deps } = params;

  if (!session?.uid) {
    return { status: 401, body: "Unauthorized" };
  }

  if (!socketId || !channelName) {
    return { status: 400, body: "Invalid request" };
  }

  // Private per-account appointment channel: private-appointments-{uid}
  if (channelName.startsWith(PRIVATE_APPOINTMENTS_PREFIX)) {
    const targetUid = channelName.slice(PRIVATE_APPOINTMENTS_PREFIX.length);
    if (!isValidChannelUid(targetUid)) {
      return { status: 400, body: "Invalid request" };
    }
    if (targetUid !== session.uid) {
      return { status: 403, body: "Forbidden: User mismatch" };
    }
    return {
      status: 200,
      body: deps.authorizeChannel(socketId, channelName),
    };
  }

  // Private user channel (e.g. incoming-call): private-user-{uid}
  if (channelName.startsWith(PRIVATE_USER_PREFIX)) {
    const targetUid = channelName.slice(PRIVATE_USER_PREFIX.length);
    if (!isValidChannelUid(targetUid)) {
      return { status: 400, body: "Invalid request" };
    }
    if (targetUid !== session.uid) {
      return { status: 403, body: "Forbidden: User mismatch" };
    }
    return {
      status: 200,
      body: deps.authorizeChannel(socketId, channelName),
    };
  }

  // Messaging/chat channels: private-chat-{channelId}
  if (!channelName.startsWith(PRIVATE_CHAT_PREFIX)) {
    return { status: 400, body: "Invalid request" };
  }

  const targetChannelId = channelName.slice(PRIVATE_CHAT_PREFIX.length);
  if (!isValidChannelUid(targetChannelId)) {
    return { status: 400, body: "Invalid request" };
  }

  const isMember = await deps.isActiveChannelMember(targetChannelId, session.uid);
  if (!isMember) {
    console.warn(
      `[Pusher Auth] Unauthorized attempt: User ${session.uid} -> Channel ${targetChannelId}`
    );
    return { status: 403, body: "Forbidden: No active membership found." };
  }

  return {
    status: 200,
    body: deps.authorizeChannel(socketId, channelName),
  };
}
