import assert from "node:assert/strict";
import test from "node:test";

import {
  handleRoomEvent,
  type RoomChannel,
  type RoomMembership,
} from "../room-events";

const SESSION = {
  uid: "user-a",
  familyId: "family-a",
  role: "STUDENT",
};

interface TestMembership extends RoomMembership {
  id: string;
}

const ACTIVE_MEMBER: TestMembership = {
  id: "member-1",
  isActive: true,
  role: "CHILD",
};

const FAMILY_CHANNEL: RoomChannel = {
  familyId: "family-a",
  type: "DIRECT",
};

function setup(options: {
  membership?: TestMembership | null;
  channel?: RoomChannel | null;
}) {
  const calls = {
    membership: [] as Array<{ channelId: string; uid: string }>,
    channel: [] as string[],
    reads: [] as Array<{ membership: TestMembership; at: number }>,
    triggers: [] as Array<{
      channelName: string;
      event: string;
      payload: unknown;
    }>,
  };

  const deps = {
    findActiveMembership: async (channelId: string, uid: string) => {
      calls.membership.push({ channelId, uid });
      return options.membership ?? null;
    },
    findChannel: async (channelId: string) => {
      calls.channel.push(channelId);
      return options.channel ?? null;
    },
    markRead: async (membership: TestMembership, at: number) => {
      calls.reads.push({ membership, at });
    },
    trigger: async (
      channelName: string,
      event: string,
      payload: unknown
    ) => {
      calls.triggers.push({ channelName, event, payload });
    },
  };

  return { calls, deps };
}

test("room events: no session is rejected before any lookup or broadcast", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: FAMILY_CHANNEL,
  });
  const result = await handleRoomEvent({
    session: null,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: true },
    deps,
  });

  assert.equal(result.status, 401);
  assert.equal(result.body, "Unauthorized");
  assert.deepEqual(calls.membership, []);
  assert.deepEqual(calls.channel, []);
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.triggers, []);
});

test("room events: authorized read receipt preserves existing behavior", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: FAMILY_CHANNEL,
  });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: { lastMessageId: "message-9" },
    deps,
    now: () => 1234,
  });

  assert.equal(result.status, 204);
  assert.deepEqual(calls.membership, [{ channelId: "chan-1", uid: "user-a" }]);
  assert.deepEqual(calls.channel, ["chan-1"]);
  assert.deepEqual(calls.reads, [{ membership: ACTIVE_MEMBER, at: 1234 }]);
  assert.deepEqual(calls.triggers, [
    {
      channelName: "private-chat-chan-1",
      event: "message-seen",
      payload: { messageId: "message-9", userId: "user-a" },
    },
  ]);
});

test("room events: authorized typing preserves existing event contract", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: FAMILY_CHANNEL,
  });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: true },
    deps,
  });

  assert.equal(result.status, 204);
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.triggers, [
    {
      channelName: "private-chat-chan-1",
      event: "client-typing",
      payload: {
        userId: "user-a",
        userName: "user-a",
        isTyping: true,
      },
    },
  ]);
});

test("room events: non-member is rejected with no state mutation or broadcast", async () => {
  const { calls, deps } = setup({ membership: null, channel: FAMILY_CHANNEL });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: { lastMessageId: "message-9" },
    deps,
  });

  assert.equal(result.status, 403);
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.triggers, []);
  assert.deepEqual(calls.channel, []);
});

test("room events: wrong-family user is rejected without revealing the room", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: { familyId: "family-b", type: "DIRECT" },
  });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: true },
    deps,
  });

  assert.equal(result.status, 403);
  assert.equal(result.body, "Forbidden");
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.triggers, []);
});

test("room events: unknown room is denied with the same response as non-membership", async () => {
  const nonMember = setup({ membership: null, channel: FAMILY_CHANNEL });
  const unknownRoom = setup({ membership: ACTIVE_MEMBER, channel: null });

  const first = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: {},
    deps: nonMember.deps,
  });
  const second = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: {},
    deps: unknownRoom.deps,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(unknownRoom.calls.reads, []);
  assert.deepEqual(unknownRoom.calls.triggers, []);
});

test("room events: client-supplied actor UID mismatch is rejected", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: FAMILY_CHANNEL,
  });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    clientActorUid: "user-b",
    payload: { isTyping: true, userId: "user-b" },
    deps,
  });

  assert.equal(result.status, 403);
  assert.deepEqual(calls.membership, []);
  assert.deepEqual(calls.triggers, []);
  assert.deepEqual(calls.reads, []);
});

test("room events: invalid room IDs are safely rejected", async () => {
  const invalidIds = ["", "   ", "bad/id", "has space", "x".repeat(129)];

  for (const roomId of invalidIds) {
    const { calls, deps } = setup({
      membership: ACTIVE_MEMBER,
      channel: FAMILY_CHANNEL,
    });
    const result = await handleRoomEvent({
      session: SESSION,
      roomId,
      operation: "READ_RECEIPT",
      payload: {},
      deps,
    });

    assert.equal(result.status, 400, `room id ${JSON.stringify(roomId)}`);
    assert.deepEqual(calls.membership, []);
    assert.deepEqual(calls.triggers, []);
    assert.deepEqual(calls.reads, []);
  }
});

test("room events: inactive membership is rejected for both operations", async () => {
  const inactive: TestMembership = {
    id: "member-2",
    isActive: false,
    role: "CHILD",
  };
  const read = setup({ membership: inactive, channel: FAMILY_CHANNEL });
  const typing = setup({ membership: inactive, channel: FAMILY_CHANNEL });

  const readResult = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: {},
    deps: read.deps,
  });
  const typingResult = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: true },
    deps: typing.deps,
  });

  assert.equal(readResult.status, 403);
  assert.equal(typingResult.status, 403);
  assert.deepEqual(read.calls.reads, []);
  assert.deepEqual(read.calls.triggers, []);
  assert.deepEqual(typing.calls.triggers, []);
});

test("room events: READONLY members can acknowledge reads but cannot type", async () => {
  const readonlyMember: TestMembership = {
    id: "member-3",
    isActive: true,
    role: "READONLY",
  };
  const read = setup({ membership: readonlyMember, channel: FAMILY_CHANNEL });
  const typing = setup({ membership: readonlyMember, channel: FAMILY_CHANNEL });

  const readResult = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "READ_RECEIPT",
    payload: { lastMessageId: "message-1" },
    deps: read.deps,
  });
  const typingResult = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: true },
    deps: typing.deps,
  });

  assert.equal(readResult.status, 204);
  assert.equal(read.calls.reads.length, 1);
  assert.equal(read.calls.triggers.length, 1);
  assert.equal(typingResult.status, 403);
  assert.deepEqual(typing.calls.reads, []);
  assert.deepEqual(typing.calls.triggers, []);
});

test("room events: invalid typing payload is rejected before broadcast", async () => {
  const { calls, deps } = setup({
    membership: ACTIVE_MEMBER,
    channel: FAMILY_CHANNEL,
  });
  const result = await handleRoomEvent({
    session: SESSION,
    roomId: "chan-1",
    operation: "TYPING",
    payload: { isTyping: "yes" },
    deps,
  });

  assert.equal(result.status, 400);
  assert.deepEqual(calls.triggers, []);
  assert.deepEqual(calls.reads, []);
});
