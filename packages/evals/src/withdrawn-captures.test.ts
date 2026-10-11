import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import current from "../results/financial-replay-v3.json";
import historical from "../results/financial-replay-v2.json";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * The real-data tier was withdrawn (ADR 0056). The current evaluation keeps
 * every synthetic oracle, and the captures made with withdrawn sources stay
 * byte for byte as historical records.
 */
describe("withdrawn real-data captures", () => {
  it("preserves all retained evaluation oracles, hashes, mappings and mutations", () => {
    expect(current.scenarios).toEqual(
      historical.scenarios.filter((item) => item.dataKind === "synthetic"),
    );
    expect(current.mappings).toEqual(historical.mappings);
    expect(current.mutations).toEqual(historical.mutations);
    expect(current.counts.publishedBaselines).toBe(0);
    expect(current.evaluationVersion).toBe("financial-replay-evaluation/3");
    expect(read("packages/evals/results/README.md")).toContain("withdrawn");
  });

  it("keeps historical captures byte-for-byte unchanged", () => {
    const pins: Record<string, string> = {
      "packages/evals/results/financial-replay-v1.json":
        "2611d2d468dcd3b118d27dd2d2e800ff79f1879205128fe42e5061756abc9532",
      "packages/evals/results/financial-replay-v1.run.json":
        "f3e38bdfb8c4d67752ef765d072af94372c7f4bf7d8fa95a472818c2edd16f17",
      "packages/evals/results/financial-replay-v2.json":
        "7945d3626a2e334d64d61628c777457974db65f12a3f40144797f49af29b58cf",
      "packages/evals/results/financial-replay-v2.run.json":
        "f94cf2e38bd259454fe5772f5b96cd06ba00a5a71d5364bb958c04b4937b73ef",
      "packages/evals/results/published-claim-coverage-v1.json":
        "1aa0903e92d335d774a115a4265299ad3cbc88419dd6f3ec265430e28e040e44",
      "packages/evals/results/published-claim-coverage-v1.run.json":
        "65a4ccf4ccd4289681ac1a6889017bde1c02cf5fa0644fe290a2062bc80b46a7",
    };
    for (const [path, hash] of Object.entries(pins))
      expect(
        createHash("sha256").update(readFileSync(path)).digest("hex"),
        path,
      ).toBe(hash);
  });
});
