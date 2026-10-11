import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type BudgetDecision,
  type BudgetReservation,
  type DailyBudgetStore,
  PublicModelBudgetRequired,
  RedisRestDailyBudgetStore,
  RESERVE_DAILY_BUDGET_SCRIPT,
  runPublicModelRequest,
} from "./public-model-budget";

/** Test-only atomic store shared by independently invoked requests. */
class FakeDailyStore implements DailyBudgetStore {
  readonly counters = new Map<string, { value: number; expiresAt: number }>();
  readonly reservations: BudgetReservation[] = [];
  constructor(private readonly now: () => number) {}
  async reserve(r: BudgetReservation): Promise<BudgetDecision> {
    this.reservations.push(r);
    for (const [key, entry] of this.counters) {
      if (entry.expiresAt * 1000 <= this.now()) this.counters.delete(key);
    }
    if (this.now() < r.startsAt * 1000 || this.now() >= r.expiresAt * 1000)
      throw new Error("Expired reservation");
    const visitor = this.counters.get(r.visitorKey)?.value ?? 0;
    const global = this.counters.get(r.globalKey)?.value ?? 0;
    if (visitor >= r.visitorLimit) return "visitor-limit";
    if (global + r.calls > r.globalLimit) return "global-limit";
    this.counters.set(r.visitorKey, {
      value: visitor + 1,
      expiresAt: r.expiresAt,
    });
    this.counters.set(r.globalKey, {
      value: global + r.calls,
      expiresAt: r.expiresAt,
    });
    return "allowed";
  }
}

const env = {
  VERCEL: "1",
  AI_LIMIT_VISITOR_SECRET: "synthetic-budget-secret-at-least-32-bytes",
  AI_LIMIT_GLOBAL_CALLS: "100",
};
const request = (ip = "192.0.2.1") =>
  new Request("https://site.invalid/api/mapping", {
    headers: { "x-vercel-forwarded-for": ip, "x-forwarded-for": "192.0.2.99" },
  });
function setup(config: Readonly<Record<string, string | undefined>> = env) {
  let time = Date.parse("2026-10-07T14:59:59Z"); // 23:59:59 KST
  const now = () => time;
  const store = new FakeDailyStore(now);
  const model = vi.fn(async () => "proposal");
  const run = (ip = "192.0.2.1", calls: 1 | 2 = 1) =>
    runPublicModelRequest(
      request(ip),
      calls,
      async (call) => {
        const results = [];
        for (let index = 0; index < calls; index++)
          results.push(await call(model));
        return results;
      },
      { env: config, store, now },
    );
  return {
    run,
    store,
    model,
    now,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public daily model budget", () => {
  it("permits 15 requests then blocks the visitor without consuming global budget", async () => {
    const t = setup();
    for (let i = 0; i < 15; i++) await t.run();
    const before = [...t.store.counters];
    await expect(t.run()).rejects.toThrow(
      "Your daily live model request limit",
    );
    expect(t.model).toHaveBeenCalledTimes(15);
    expect([...t.store.counters]).toEqual(before);
    await t.run("192.0.2.2");
    expect(t.model).toHaveBeenCalledTimes(16);
  });

  it("reserves a routed request once per visitor and twice globally", async () => {
    const t = setup({
      ...env,
      AI_LIMIT_VISITOR_REQUESTS: "1",
      AI_LIMIT_GLOBAL_CALLS: "3",
    });
    await t.run("192.0.2.1", 2);
    expect([...t.store.counters.values()].map((x) => x.value)).toEqual([1, 2]);
    await expect(t.run("192.0.2.2", 2)).rejects.toThrow(
      "daily shared live model call limit",
    );
    expect(t.model).toHaveBeenCalledTimes(2);
    await t.run("192.0.2.2");
    await expect(t.run("192.0.2.3")).rejects.toThrow(
      "daily shared live model call limit",
    );
    expect(t.model).toHaveBeenCalledTimes(3);
  });

  it("keeps simultaneous visitors within the shared cap", async () => {
    const t = setup({ ...env, AI_LIMIT_GLOBAL_CALLS: "7" });
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) => t.run(`192.0.2.${i + 1}`)),
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(7);
    expect(t.model).toHaveBeenCalledTimes(7);
    expect(t.store.counters.size).toBe(8);
  });

  it("resets both counters and changes the visitor HMAC exactly at KST midnight", async () => {
    const t = setup({
      ...env,
      AI_LIMIT_GLOBAL_CALLS: "1",
      AI_LIMIT_VISITOR_REQUESTS: "1",
    });
    await t.run();
    const first = t.store.reservations[0]!;
    expect(new Date(first.expiresAt * 1000).toISOString()).toBe(
      "2026-10-07T15:00:00.000Z",
    );
    await expect(t.run()).rejects.toBeInstanceOf(PublicModelBudgetRequired);
    t.advance(1000);
    await t.run();
    const next = t.store.reservations.at(-1)!;
    expect(next.visitorKey).not.toBe(first.visitorKey);
    expect(next.globalKey).not.toBe(first.globalKey);
    expect(t.store.counters.has(first.visitorKey)).toBe(false);
    expect(t.store.counters.has(first.globalKey)).toBe(false);
    expect(t.store.counters.size).toBe(2);
  });

  it("stores only the daily HMAC and counters, never IPs or secret", async () => {
    const t = setup();
    await t.run();
    const day = Math.floor((Math.floor(t.now() / 1000) + 32400) / 86400);
    const digest = createHmac("sha256", env.AI_LIMIT_VISITOR_SECRET)
      .update(`weavetrail/public-model/1:${day}:192.0.2.1`)
      .digest("hex");
    expect(t.store.reservations[0]!.visitorKey).toContain(digest);
    const stored = JSON.stringify([...t.store.counters]);
    expect(stored).not.toContain("192.0.2.");
    expect(stored).not.toContain(env.AI_LIMIT_VISITOR_SECRET);
  });

  it("normalizes equivalent IPv6 spellings to the same visitor", async () => {
    const t = setup({ ...env, AI_LIMIT_VISITOR_REQUESTS: "1" });
    await t.run("2001:db8::1");
    await expect(t.run("2001:0db8:0:0:0:0:0:1")).rejects.toThrow("Your daily");
    expect(t.model).toHaveBeenCalledTimes(1);
  });

  it.each(["", "unknown", "192.0.2.1, 192.0.2.2"])(
    "fails closed for missing or invalid platform IP %s",
    async (ip) => {
      const t = setup();
      await expect(t.run(ip)).rejects.toThrow("budget checks are unavailable");
      expect(t.model).not.toHaveBeenCalled();
      expect(t.store.reservations).toEqual([]);
    },
  );

  it.each([
    { VERCEL: undefined },
    { AI_LIMIT_VISITOR_SECRET: undefined },
    { AI_LIMIT_VISITOR_SECRET: "short" },
    { AI_LIMIT_GLOBAL_CALLS: undefined },
    { AI_LIMIT_GLOBAL_CALLS: "0" },
    { AI_LIMIT_VISITOR_REQUESTS: "1.5" },
    { AI_LIMIT_GLOBAL_CALLS: "1000000001" },
  ])(
    "rejects invalid configuration %j before storage or model calls",
    async (patch) => {
      const t = setup({ ...env, ...patch });
      await expect(t.run()).rejects.toThrow("budget checks are unavailable");
      expect(t.model).not.toHaveBeenCalled();
      expect(t.store.reservations).toEqual([]);
    },
  );

  it("discards a store failure, never invokes the flow and never refunds failed attempts", async () => {
    const t = setup();
    const flow = vi.fn();
    await expect(
      runPublicModelRequest(request(), 1, flow, {
        env,
        now: t.now,
        store: {
          reserve: async () => {
            throw new Error("raw store secret");
          },
        },
      }),
    ).rejects.toThrow("budget checks are unavailable");
    expect(flow).not.toHaveBeenCalled();
    t.model.mockRejectedValueOnce(new Error("provider failed"));
    await expect(t.run()).rejects.toThrow("provider failed");
    expect([...t.store.counters.values()].map((x) => x.value)).toEqual([1, 1]);
  });

  it("blocks a grant arriving after midnight and additional calls outside the reservation", async () => {
    const t = setup();
    const flow = vi.fn();
    await expect(
      runPublicModelRequest(request(), 1, flow, {
        env,
        now: t.now,
        store: {
          reserve: async (r) => {
            const decision = await t.store.reserve(r);
            t.advance(1000);
            return decision;
          },
        },
      }),
    ).rejects.toThrow("budget checks are unavailable");
    expect(flow).not.toHaveBeenCalled();
    await expect(
      runPublicModelRequest(
        request(),
        1,
        async (call) => {
          await call(t.model);
          await call(t.model);
        },
        { env, now: t.now, store: t.store },
      ),
    ).rejects.toThrow("reservation exhausted or expired");
    expect(t.model).toHaveBeenCalledTimes(1);
    await expect(
      runPublicModelRequest(
        request(),
        2,
        async (call) => {
          await call(t.model);
          t.advance(86400000);
          await call(t.model);
        },
        { env, now: t.now, store: t.store },
      ),
    ).rejects.toThrow("reservation exhausted or expired");
    expect(t.model).toHaveBeenCalledTimes(2);
  });
});

describe("Redis REST budget adapter", () => {
  const reservation: BudgetReservation = {
    visitorKey: "visitor:hmac",
    globalKey: "global:day",
    visitorLimit: 15,
    globalLimit: 100,
    calls: 2,
    startsAt: 100,
    expiresAt: 86500,
  };
  it.each([
    [0, "allowed"],
    [1, "visitor-limit"],
    [2, "global-limit"],
  ] as const)("maps only store decision %i", async (result, decision) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ result }));
    const store = new RedisRestDailyBudgetStore(
      "https://budget.invalid",
      "test-token",
      transport,
    );
    expect(await store.reserve(reservation)).toBe(decision);
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe("https://budget.invalid");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: { authorization: "Bearer test-token" },
    });
    expect(JSON.parse(init!.body as string)).toEqual([
      "EVAL",
      RESERVE_DAILY_BUDGET_SCRIPT,
      2,
      "visitor:hmac",
      "global:day",
      15,
      100,
      2,
      100,
      86500,
    ]);
  });
  it.each([
    () => Response.json({ error: "raw store secret" }),
    () => Response.json({ result: 3 }),
    () => Response.json({ result: "0" }),
    () => Response.json({ result: 0, error: "bad" }),
    () => new Response("unavailable", { status: 503 }),
    () => new Response("malformed"),
    () => new Response("x".repeat(257)),
  ])(
    "rejects unexpected, failed or oversized store responses",
    async (response) => {
      const store = new RedisRestDailyBudgetStore(
        "https://budget.invalid",
        "test-token",
        vi.fn().mockResolvedValue(response()),
      );
      const flow = vi.fn();
      await expect(
        runPublicModelRequest(request(), 1, flow, { env, store }),
      ).rejects.toThrow("budget checks are unavailable");
      expect(flow).not.toHaveBeenCalled();
    },
  );
  it("aborts a stalled store response body without invoking a model", async () => {
    vi.useFakeTimers();
    const transport: typeof fetch = async (_url, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init!.signal!.addEventListener("abort", () =>
              controller.error(new Error("timeout")),
            );
          },
        }),
      );
    // AbortSignal.timeout uses real Node timers, so substitute a controllable signal.
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(controller.signal);
    const store = new RedisRestDailyBudgetStore(
      "https://budget.invalid",
      "token",
      transport,
    );
    const flow = vi.fn();
    const result = runPublicModelRequest(request(), 1, flow, { env, store });
    const assertion = expect(result).rejects.toThrow(
      "budget checks are unavailable",
    );
    await Promise.resolve();
    controller.abort();
    await assertion;
    expect(flow).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
