import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type BudgetDecision = "allowed" | "visitor-limit" | "global-limit";
export type BudgetReservation = {
  visitorKey: string;
  globalKey: string;
  visitorLimit: number;
  globalLimit: number;
  calls: 1 | 2;
  startsAt: number;
  expiresAt: number;
};

/** Implementations must check and reserve BOTH counters atomically. */
export interface DailyBudgetStore {
  reserve(reservation: BudgetReservation): Promise<BudgetDecision>;
}

export class PublicModelBudgetRequired extends Error {
  constructor(reason: BudgetDecision | "unavailable") {
    super(
      reason === "visitor-limit"
        ? "Your daily live model request limit has been reached. No model was called. Try after 00:00 KST or use recorded runs."
        : reason === "global-limit"
          ? "The daily shared live model call limit has been reached. No model was called. Try after 00:00 KST or use recorded runs."
          : "Live model budget checks are unavailable. No model was called. Use recorded runs or retry later.",
    );
  }
}

// Read, check, reserve and absolute expiry execute on the Redis primary in one
// EVAL. A delayed request cannot recreate an expired day's counters.
export const RESERVE_DAILY_BUDGET_SCRIPT = `
local now = tonumber(redis.call('TIME')[1])
local starts = tonumber(ARGV[4])
local expires = tonumber(ARGV[5])
if now < starts or now >= expires then return 3 end
local visitor = tonumber(redis.call('GET', KEYS[1]) or '0')
local global = tonumber(redis.call('GET', KEYS[2]) or '0')
if not visitor or not global or visitor < 0 or global < 0
  or visitor % 1 ~= 0 or global % 1 ~= 0 then return 3 end
local visitorLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local calls = tonumber(ARGV[3])
if visitor >= visitorLimit then return 1 end
if global + calls > globalLimit then return 2 end
redis.call('SET', KEYS[1], visitor + 1, 'EXAT', expires)
redis.call('SET', KEYS[2], global + calls, 'EXAT', expires)
return 0
`;

/** Hosted shared storage; never fall back to per-function memory. */
export class RedisRestDailyBudgetStore implements DailyBudgetStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly transport: typeof fetch = fetch,
  ) {}

  async reserve(reservation: BudgetReservation): Promise<BudgetDecision> {
    const response = await this.transport(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        RESERVE_DAILY_BUDGET_SCRIPT,
        2,
        reservation.visitorKey,
        reservation.globalKey,
        reservation.visitorLimit,
        reservation.globalLimit,
        reservation.calls,
        reservation.startsAt,
        reservation.expiresAt,
      ]),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    // The result is one small integer. Discard store errors and their bodies.
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new PublicModelBudgetRequired("unavailable");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256) throw new PublicModelBudgetRequired("unavailable");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      Object.keys(result).length !== 1 ||
      !Object.hasOwn(result, "result")
    )
      throw new PublicModelBudgetRequired("unavailable");
    switch (Reflect.get(result, "result")) {
      case 0:
        return "allowed";
      case 1:
        return "visitor-limit";
      case 2:
        return "global-limit";
      default:
        throw new PublicModelBudgetRequired("unavailable");
    }
  }
}

function positiveCount(value: string | undefined, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!value || !/^[1-9]\d*$/.test(value))
    throw new PublicModelBudgetRequired("unavailable");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count > 1_000_000_000)
    throw new PublicModelBudgetRequired("unavailable");
  return count;
}

function hostedStore(
  env: Readonly<Record<string, string | undefined>>,
): DailyBudgetStore {
  const url = new URL(env.UPSTASH_REDIS_REST_URL ?? "");
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.href.includes("?") ||
    url.href.includes("#") ||
    !token?.trim()
  )
    throw new PublicModelBudgetRequired("unavailable");
  return new RedisRestDailyBudgetStore(url.origin, token);
}

type ModelCall = <T>(operation: () => Promise<T>) => Promise<T>;

/** One visitor request, one or two reserved provider attempts. Failed/unused
 * attempts are not refunded: ambiguous transport failures may have spent money.
 * Offline evaluators use ai-harness directly and never enter this web boundary.
 */
export async function runPublicModelRequest<T>(
  request: Request,
  calls: 1 | 2,
  operation: (call: ModelCall) => Promise<T>,
  dependencies: {
    env?: Readonly<Record<string, string | undefined>>;
    store?: DailyBudgetStore;
    now?: () => number;
  } = {},
): Promise<T> {
  const env = dependencies.env ?? process.env;
  const now = dependencies.now ?? Date.now;
  let expiresAt: number;
  try {
    if (env.VERCEL !== "1" || (calls !== 1 && calls !== 2))
      throw new PublicModelBudgetRequired("unavailable");
    // This header is supplied by Vercel. Never trust caller X-Forwarded-For,
    // cookies or a request-body visitor ID, nor headers on a non-Vercel server.
    const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
    const family = ip ? isIP(ip) : 0;
    const secret = env.AI_LIMIT_VISITOR_SECRET;
    if (!ip || !family || !secret || Buffer.byteLength(secret) < 32)
      throw new PublicModelBudgetRequired("unavailable");
    const normalized = family === 6 ? new URL(`http://[${ip}]`).hostname : ip;
    const seconds = Math.floor(now() / 1000);
    const day = Math.floor((seconds + 9 * 3600) / 86400);
    const startsAt = day * 86400 - 9 * 3600;
    expiresAt = startsAt + 86400;
    const digest = createHmac("sha256", secret)
      .update(`weavetrail/public-model/1:${day}:${normalized}`)
      .digest("hex");
    const reservation: BudgetReservation = {
      visitorKey: `weavetrail:model-budget:1:${day}:visitor:${digest}`,
      globalKey: `weavetrail:model-budget:1:${day}:global`,
      visitorLimit: positiveCount(env.AI_LIMIT_VISITOR_REQUESTS, 15),
      globalLimit: positiveCount(env.AI_LIMIT_GLOBAL_CALLS),
      calls,
      startsAt,
      expiresAt,
    };
    const decision = await (dependencies.store ?? hostedStore(env)).reserve(
      reservation,
    );
    if (decision !== "allowed") throw new PublicModelBudgetRequired(decision);
    if (now() >= expiresAt * 1000)
      throw new PublicModelBudgetRequired("unavailable");
  } catch (error) {
    if (error instanceof PublicModelBudgetRequired) throw error;
    throw new PublicModelBudgetRequired("unavailable");
  }
  let remaining: number = calls;
  return operation(async (attempt) => {
    if (remaining === 0 || now() >= expiresAt * 1000)
      // Do not say "no model was called" if an earlier routed attempt ran.
      throw new Error(
        "Live model reservation exhausted or expired. Further calls were blocked.",
      );
    remaining -= 1;
    return attempt();
  });
}
