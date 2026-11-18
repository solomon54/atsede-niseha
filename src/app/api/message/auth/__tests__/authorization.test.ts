import assert from "node:assert/strict";
import test from "node:test";

import { authorizePrivateChannelRequest } from "../authorization";

const okAuth = { auth: "ok:signature" };

function makeDeps(overrides?: Partial<{ member: boolean; authorized: any[] }>) {
  const authorized: any[] = overrides?.authorized ?? [];
  return {
    deps: {
      authorizeChannel: (socketId: string, channelName: string) => {
        authorized.push({ socketId, channelName });
        return okAuth;
      },
      isActiveChannelMember: async (_channelId: string, _uid: string) => overrides?.member ?? false,
    },
    authorized,
  };
}

test("appointments channel: correct authenticated owner is authorized", async () => {
  const { deps, authorized } = makeDeps();
  const result = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "123.456",
    channelName: "private-appointments-user-a",
    deps,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, okAuth);
  assert.deepEqual(authorized, [{ socketId: "123.456", channelName: "private-appointments-user-a" }]);
});

test("appointments channel: attempt to subscribe to another UID's channel is forbidden", async () => {
  const { deps, authorized } = makeDeps();
  const result = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "123.456",
    channelName: "private-appointments-user-b",
    deps,
  });
  assert.equal(result.status, 403);
  assert.equal(result.body, "Forbidden: User mismatch");
  assert.equal(authorized.length, 0);
});

test("missing session returns unauthorized", async () => {
  const { deps } = makeDeps();
  const result = await authorizePrivateChannelRequest({
    session: null,
    socketId: "123.456",
    channelName: "private-appointments-user-a",
    deps,
  });
  assert.equal(result.status, 401);
  assert.equal(result.body, "Unauthorized");
});

test("malformed channel names/requests are rejected", async () => {
  const { deps } = makeDeps();

  const cases: Array<{ socketId: any; channelName: any; status: number }> = [
    { socketId: null, channelName: "private-appointments-user-a", status: 400 },
    { socketId: "1.1", channelName: null, status: 400 },
    { socketId: "1.1", channelName: "private-appointments-", status: 400 },
    { socketId: "1.1", channelName: "private-appointments-bad/uid", status: 400 },
    { socketId: "1.1", channelName: "private-appointments-bad uid", status: 400 },
    { socketId: "1.1", channelName: "user-appointments-user-a", status: 400 }, // public/unknown form
    { socketId: "1.1", channelName: "private-user-", status: 400 },
    { socketId: "1.1", channelName: "private-chat-", status: 400 },
  ];

  for (const c of cases) {
    const result = await authorizePrivateChannelRequest({
      session: { uid: "user-a" },
      socketId: c.socketId,
      channelName: c.channelName,
      deps,
    });
    assert.equal(result.status, c.status, `expected ${c.status} for ${String(c.channelName)}`);
  }
});

test("existing private-user channel authorization behavior is preserved", async () => {
  const { deps, authorized } = makeDeps();

  const ok = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "s1",
    channelName: "private-user-user-a",
    deps,
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, okAuth);

  const forbidden = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "s1",
    channelName: "private-user-user-b",
    deps,
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body, "Forbidden: User mismatch");

  assert.deepEqual(authorized, [{ socketId: "s1", channelName: "private-user-user-a" }]);
});

test("existing private-chat channel authorization behavior is preserved", async () => {
  const memberAuthorized: any[] = [];
  const memberDeps = {
    authorizeChannel: (socketId: string, channelName: string) => {
      memberAuthorized.push({ socketId, channelName });
      return okAuth;
    },
    isActiveChannelMember: async (channelId: string, uid: string) => {
      assert.equal(channelId, "chan-1");
      assert.equal(uid, "user-a");
      return true;
    },
  };

  const ok = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "s2",
    channelName: "private-chat-chan-1",
    deps: memberDeps,
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, okAuth);
  assert.deepEqual(memberAuthorized, [{ socketId: "s2", channelName: "private-chat-chan-1" }]);

  const nonMemberDeps = {
    ...memberDeps,
    authorizeChannel: () => {
      throw new Error("should not authorize non-member");
    },
    isActiveChannelMember: async () => false,
  };
  const forbidden = await authorizePrivateChannelRequest({
    session: { uid: "user-a" },
    socketId: "s2",
    channelName: "private-chat-chan-1",
    deps: nonMemberDeps,
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body, "Forbidden: No active membership found.");
});
