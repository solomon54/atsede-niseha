import assert from "node:assert/strict";
import test from "node:test";

import { createInFlight } from "../calling/inFlight";

test("concurrent hints reuse a single token request", async () => {
  const inFlight = createInFlight<string>();
  let calls = 0;
  const task = async () => {
    calls += 1;
    await Promise.resolve();
    return "token";
  };

  const [first, second] = await Promise.all([
    inFlight.run("uid:call-1", task),
    inFlight.run("uid:call-1", task),
  ]);

  assert.equal(first, "token");
  assert.equal(second, "token");
  assert.equal(calls, 1);
  assert.equal(inFlight.has("uid:call-1"), false);
});

test("a failed request is not cached indefinitely", async () => {
  const inFlight = createInFlight<string>();
  let calls = 0;
  const task = async () => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return "token";
  };

  await assert.rejects(inFlight.run("uid:call-2", task), /offline/);
  assert.equal(await inFlight.run("uid:call-2", task), "token");
  assert.equal(calls, 2);
});
