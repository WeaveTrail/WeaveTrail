import { createHash } from "node:crypto";
import { z } from "zod";
import { compareCounts, type Count } from "./mapping-scorer";
import { StudyCountSchema } from "./mapping-study-protocol";

const FamilyPairSchema = z
  .object({
    familyId: z.string().min(1),
    stratum: z.string().min(1),
    left: StudyCountSchema,
    right: StudyCountSchema,
  })
  .strict();
const gcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
export function rational(n: bigint, d: bigint): Count {
  if (d <= 0n) throw new Error("Positive denominator required");
  const divisor = gcd(n, d);
  return { numerator: String(n / divisor), denominator: String(d / divisor) };
}
export function addRationals(a: Count, b: Count) {
  return rational(
    BigInt(a.numerator) * BigInt(b.denominator) +
      BigInt(b.numerator) * BigInt(a.denominator),
    BigInt(a.denominator) * BigInt(b.denominator),
  );
}
export function subtractRationals(a: Count, b: Count) {
  return addRationals(a, {
    numerator: String(-BigInt(b.numerator)),
    denominator: b.denominator,
  });
}
export function meanRationals(values: Count[]) {
  if (!values.length) throw new Error("Empty rational mean");
  const sum = values.reduce(addRationals, rational(0n, 1n));
  return rational(
    BigInt(sum.numerator),
    BigInt(sum.denominator) * BigInt(values.length),
  );
}
/** SHA-256 counter stream and rejection sampling avoid modulo bias and floating point. */
function sampler(seed: string) {
  let counter = 0n;
  return (length: number) => {
    const n = BigInt(length),
      range = 1n << 256n,
      limit = range - (range % n);
    for (;;) {
      const value = BigInt(
        `0x${createHash("sha256").update(`${seed}:${counter++}`).digest("hex")}`,
      );
      if (value < limit) return Number(value % n);
    }
  };
}
/** Stratified paired family macro difference. All repeats/variants remain in each family. */
export function pairedFamilyBootstrap(
  input: unknown,
  configuration: {
    version: "family-bootstrap/1";
    seed: string;
    resamples: number;
    tailProbability: Count;
  },
) {
  const pairs = z
    .array(FamilyPairSchema)
    .min(1)
    .parse(input)
    .sort((a, b) =>
      a.familyId < b.familyId ? -1 : a.familyId > b.familyId ? 1 : 0,
    );
  if (new Set(pairs.map((p) => p.familyId)).size !== pairs.length)
    throw new Error("Duplicate analysis family");
  const config = z
    .object({
      version: z.literal("family-bootstrap/1"),
      seed: z.string().min(1),
      resamples: z.number().int().min(100).max(100_000),
      tailProbability: StudyCountSchema,
    })
    .strict()
    .parse(configuration);
  const tail = BigInt(config.tailProbability.numerator),
    denominator = BigInt(config.tailProbability.denominator);
  if (tail <= 0n || tail * 2n >= denominator)
    throw new Error("Invalid bootstrap tail probability");
  for (const pair of pairs)
    for (const value of [pair.left, pair.right])
      if (
        BigInt(value.numerator) < 0n ||
        BigInt(value.numerator) > BigInt(value.denominator)
      )
        throw new Error("Analysis counts must be rates");
  const strata = [...new Set(pairs.map((p) => p.stratum))]
    .sort()
    .map((s) => pairs.filter((p) => p.stratum === s));
  const next = sampler(config.seed),
    draws: Count[] = [];
  for (let i = 0; i < config.resamples; i++)
    draws.push(
      meanRationals(
        strata.flatMap((stratum) =>
          stratum.map(() => {
            const pair = stratum[next(stratum.length)]!;
            return subtractRationals(pair.left, pair.right);
          }),
        ),
      ),
    );
  draws.sort((a, b) => compareCounts(a, b)!);
  // Inverse empirical CDF / nearest-rank quantiles, with no interpolation.
  const quantile = (n: bigint) =>
    draws[
      Number((BigInt(draws.length) * n + denominator - 1n) / denominator - 1n)
    ]!;
  return {
    version: config.version,
    method: "STRATIFIED_PAIRED_FAMILY_MACRO_PERCENTILE",
    quantile: "INVERSE_EMPIRICAL_CDF",
    seed: config.seed,
    resamples: String(config.resamples),
    tailProbability: config.tailProbability,
    independentFamilies: String(pairs.length),
    strata: strata.map((s) => ({
      stratum: s[0]!.stratum,
      families: String(s.length),
    })),
    point: meanRationals(pairs.map((p) => subtractRationals(p.left, p.right))),
    lower: quantile(tail),
    upper: quantile(denominator - tail),
    degenerate: compareCounts(draws[0]!, draws.at(-1)!) === 0,
    limitation:
      "Synthetic family sample; repeats are not independent units. A degenerate interval does not establish safety.",
  };
}
/** Conservative rational bracket for the one-sided zero-event binomial upper bound. */
export function zeroEventFamilyUpperBound(
  families: number,
  scale = 1_000_000n,
) {
  if (
    !Number.isSafeInteger(families) ||
    families < 1 ||
    families > 10_000 ||
    scale < 1n ||
    scale > 1_000_000_000n
  )
    throw new Error("Invalid zero-event bound scope");
  const n = BigInt(families),
    power = scale ** n;
  let low = 0n,
    high = scale;
  // Upper confidence bound u solves (1-u)^n = 1/20; return an upward bracket.
  while (high - low > 1n) {
    const middle = (low + high) / 2n;
    if (20n * (scale - middle) ** n > power) low = middle;
    else high = middle;
  }
  return {
    families: String(families),
    confidence: { numerator: "19", denominator: "20" },
    lower: rational(low, scale),
    upper: rational(high, scale),
    limitation:
      "Independent Bernoulli families assumed; not a general attack probability for a fixed adversarial suite.",
  };
}
