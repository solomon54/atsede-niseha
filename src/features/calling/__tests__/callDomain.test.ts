import assert from "node:assert/strict";
import test from "node:test";

import {
  callRouteFor,
  eventCallId,
  formatCallDuration,
  RING_TIMEOUT_MS,
  terminalMessage,
  terminalStatusFromEvent,
  terminalStatusFromLifecycle,
  toActiveCall,
} from "../callDomain";
import type { CallStatusResponse } from "../types";

const status: CallStatusResponse = {
  callId: "call-1",
  channelId: "channel-1",
  status: "ringing",
  joinable: true,
  callerId: "caller-uid",
  callerName: "Caller Name",
  callerPhotoUrl: "https://example.test/caller.jpg",
  callerRole: "FATHER",
  isGroup: false,
  startedAt: 1_000,
  answeredAt: null,
};

test("terminal event mapping ignores non-terminal call statuses", () => {
  assert.equal(terminalStatusFromLifecycle("ringing"), null);
  assert.equal(terminalStatusFromLifecycle("answered"), null);
  assert.equal(terminalStatusFromLifecycle("declined"), "declined");
  assert.equal(terminalStatusFromLifecycle("busy"), "busy");

  assert.equal(terminalStatusFromEvent("message-updated", { status: "answered" }), null);
  assert.equal(
    terminalStatusFromEvent("message-updated", { callDetails: { status: "cancelled" } }),
    "cancelled"
  );
  assert.equal(terminalStatusFromEvent("call-declined", { status: "busy" }), "busy");
  assert.equal(terminalStatusFromEvent("call-missed", {}), "missed");
  assert.equal(terminalStatusFromEvent("call-ended", {}), "ended");
  assert.equal(terminalStatusFromEvent("incoming-call", { status: "ended" }), null);
  assert.equal(RING_TIMEOUT_MS, 45_000);
});

test("eventCallId reads the authoritative call id from all fanout shapes", () => {
  assert.equal(eventCallId({ callId: " call-a " }), "call-a");
  assert.equal(eventCallId({ id: "call-b" }), "call-b");
  assert.equal(eventCallId({ callDetails: { callId: "call-c" } }), "call-c");
  assert.equal(eventCallId({ status: "ended" }), null);
});

test("incoming recovery never presents the signed-in user as the peer", () => {
  const active = toActiveCall({
    status,
    currentUid: "me",
    participants: [{ uid: "me", displayName: "My Name", photoUrl: null, role: "STUDENT" }],
  });

  assert.equal(active.direction, "incoming");
  assert.equal(active.phase, "incoming");
  assert.equal(active.peer.uid, "caller-uid");
  assert.equal(active.peer.name, "Caller Name");
  assert.notEqual(active.peer.uid, "me");
  assert.equal(active.participants["caller-uid"].photoUrl, status.callerPhotoUrl);
});

test("outgoing recovery resolves the peer from authoritative participant summaries", () => {
  const outgoing = toActiveCall({
    status: {
      ...status,
      callerId: "me",
      callerName: "My Name",
      status: "answered",
      answeredAt: 5_000,
      isGroup: true,
    },
    currentUid: "me",
    participants: [
      { uid: "me", displayName: "My Name", photoUrl: null, role: "STUDENT" },
      {
        uid: "peer-uid",
        displayName: "Peer Name",
        photoUrl: "https://example.test/peer.jpg",
        role: "GOVERNOR",
      },
    ],
  });

  assert.equal(outgoing.direction, "outgoing");
  assert.equal(outgoing.phase, "answered");
  assert.equal(outgoing.isGroup, true);
  assert.equal(outgoing.peer.uid, "peer-uid");
  assert.equal(outgoing.peer.name, "Peer Name");
  assert.equal(outgoing.peer.role, "GOVERNOR");
  assert.notEqual(outgoing.peer.uid, "me");
  assert.equal(outgoing.answeredAt, 5_000);
});

test("duration and call routes are stable and encoded", () => {
  assert.equal(formatCallDuration(null), "00:00");
  assert.equal(formatCallDuration(1_000, 76_000), "01:15");
  assert.equal(
    callRouteFor({ channelId: "channel/one", callId: "call one" }),
    "/call/channel%2Fone?callId=call%20one"
  );
  assert.equal(terminalMessage("cancelled"), "ጥሪው ተሰርዟል");
});
