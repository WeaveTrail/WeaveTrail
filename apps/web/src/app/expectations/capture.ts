/**
 * The environment `pnpm expectations:update` captured the committed
 * expectations in. `expectations.test.ts` pins it to the run receipt in
 * `packages/evals/results/financial-replay-v2.run.json`, which only tests may
 * import from this app.
 */
export const captureEnvironment = {
  node: "22.18.0",
  pnpm: "10.33.2",
  vitest: "5.0.1",
} as const;
