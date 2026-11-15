import assert from "node:assert/strict";
import test from "node:test";
import { createBackendClient } from "../src/data/backend.ts";

const healthy = () => Response.json({ status: "healthy" });

test("hung health probes abort and cannot exceed the startup budget indefinitely", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  let aborted = 0;
  const client = createBackendClient({
    startupBudgetMs: 30,
    probeTimeoutMs: 5,
    retryDelayMs: 1,
    transport: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(init.signal.reason);
          },
          { once: true },
        );
      }),
  });
  try {
    await assert.rejects(client.ready(), /longer than expected/);
    assert.ok(aborted > 0);
    assert.equal(client.getSnapshot().phase, "error");
  } finally {
    clearTimeout(keepAlive);
  }
});

test("a network failure during a chat send never duplicates the question", async () => {
  let sends = 0;
  const client = createBackendClient({
    transport: async (url) => {
      if (url === "/api/health") return healthy();
      sends++;
      throw new TypeError("connection lost after sending");
    },
  });
  await assert.rejects(
    client.apiFetch("/api/chat", { method: "POST", body: "{}" }),
    /connection lost/,
  );
  assert.equal(sends, 1);
});

test("a 70-second cold start waits through loading HTML and gateway errors before sending data", async () => {
  let clock = 0;
  const calls = [];
  const phases = [];
  const client = createBackendClient({
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    retryDelayMs: 10_000,
    transport: async (url, init) => {
      calls.push({ url, clock });
      assert.equal(init.signal.aborted, false);
      if (url !== "/api/health") return Response.json({ records: [] });
      assert.equal(init.cache, "no-store");
      if (clock < 30_000) return new Response("Starting", { status: 503 });
      if (clock < 70_000) return new Response("<html>Starting</html>");
      return healthy();
    },
  });
  client.subscribe(() => phases.push(client.getSnapshot().phase));
  assert.equal((await client.apiFetch("/api/datasets")).status, 200);
  assert.equal(calls.at(-1).clock, 70_000);
  assert.equal(calls.filter((c) => c.url !== "/api/health").length, 1);
  assert.deepEqual(phases, ["checking", "waking", "ready"]);
});

test("concurrent panels share startup and cancellation does not cancel another panel", async () => {
  let finish;
  let probes = 0;
  const sent = [];
  const client = createBackendClient({
    transport: async (url) => {
      if (url === "/api/health") {
        probes++;
        return new Promise((resolve) => {
          finish = () => resolve(healthy());
        });
      }
      sent.push(url);
      return Response.json({});
    },
  });
  const controller = new AbortController();
  const abandoned = client.apiFetch("/api/old-region", {
    signal: controller.signal,
  });
  const active = client.apiFetch("/api/new-region");
  controller.abort();
  await assert.rejects(abandoned, { name: "AbortError" });
  finish();
  await active;
  assert.equal(probes, 1);
  assert.deepEqual(sent, ["/api/new-region"]);
});

test("startup failure is bounded and a subsequent retry can recover", async () => {
  let clock = 0,
    available = false,
    probes = 0;
  const client = createBackendClient({
    startupBudgetMs: 100,
    retryDelayMs: 20,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    transport: async () => {
      probes++;
      if (available) return healthy();
      throw new TypeError("offline");
    },
  });
  await assert.rejects(client.ready(), /longer than expected/);
  assert.equal(clock, 100);
  assert.equal(probes, 5);
  assert.equal(client.getSnapshot().phase, "error");
  available = true;
  await client.ready();
  assert.equal(client.getSnapshot().phase, "ready");
});

test("a missing proxy route fails clearly without repeatedly polling", async () => {
  let calls = 0;
  const client = createBackendClient({
    transport: async () => {
      calls++;
      return new Response("missing", { status: 404 });
    },
  });
  await assert.rejects(client.ready(), /not configured correctly/);
  assert.equal(calls, 1);
});

test("recent readiness is shared, then rechecked on the first request after idle", async () => {
  let clock = 0,
    probes = 0;
  const client = createBackendClient({
    now: () => clock,
    transport: async (url) => {
      if (url === "/api/health") {
        probes++;
        return healthy();
      }
      return Response.json({});
    },
  });
  await client.apiFetch("/api/first");
  await client.apiFetch("/api/second");
  assert.equal(probes, 1);
  clock = 900_000;
  assert.equal(probes, 1); // Idle has no background keep-alive polling.
  await client.apiFetch("/api/after-idle");
  assert.equal(probes, 2);
});

test("gateway failures on GET recover once, while chat POST is never replayed", async () => {
  for (const method of ["GET", "POST"]) {
    let probes = 0,
      sends = 0;
    const client = createBackendClient({
      transport: async (url) => {
        if (url === "/api/health") {
          probes++;
          return healthy();
        }
        sends++;
        return new Response("", { status: sends === 1 ? 503 : 200 });
      },
    });
    const response = await client.apiFetch("/api/chat", { method });
    assert.equal(sends, method === "GET" ? 2 : 1);
    assert.equal(probes, method === "GET" ? 2 : 1);
    assert.equal(response.status, method === "GET" ? 200 : 503);
  }
});

test("chat waits for health before its single send and application errors are not retried", async () => {
  const calls = [];
  const client = createBackendClient({
    transport: async (url) => {
      calls.push(url);
      return url === "/api/health"
        ? healthy()
        : new Response("", { status: 422 });
    },
  });
  assert.equal(
    (await client.apiFetch("/api/chat", { method: "POST", body: "{}" })).status,
    422,
  );
  assert.deepEqual(calls, ["/api/health", "/api/chat"]);
});
