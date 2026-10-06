import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  HostileMappingFixtureProvider,
  adversarialMappingInput,
  adversarialMappingProbes,
} from "../adversarial-mapping-fixtures";
import { ConfiguredSchemaMappingProvider } from "./configured-provider-9b15a96";

// SHA-256 of `git show 9b15a96:packages/ai-harness/src/configured-provider.ts`.
const ORIGINAL_SHA256 =
  "d205631378b7bf6fdf1f73227b3e05dfc89b63835fcedf7d5ac30f489bd711f4";
const HEADER_LINES = 4;

const configuration = {
  baseUrl: "https://hostile.invalid",
  apiKey: "synthetic-offline-secret",
  model: "synthetic-offline-model",
};

/** Replays AI failure log F-001: the pre-#269 gate over the committed probes. */
describe("F-001 historical replay of the configured gate at 9b15a96", () => {
  it("is the original source apart from its header and import specifiers", () => {
    const copy = readFileSync(
      new URL("./configured-provider-9b15a96.ts", import.meta.url),
      "utf8",
    );
    // Git blobs are LF; a CRLF checkout must hash the same bytes.
    const original = copy
      .replace(/\r\n/g, "\n")
      .split("\n")
      .slice(HEADER_LINES)
      .join("\n")
      .replaceAll('from "@weavetrail/ai-harness";', 'from "./provider";');
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      ORIGINAL_SHA256,
    );
  });

  it("accepted the two transform-invalid probes and rejected the other 24", async () => {
    const fixtures = new HostileMappingFixtureProvider();
    const accepted: Record<string, unknown> = {};
    const rejected: string[] = [];
    for (const probe of [undefined, ...adversarialMappingProbes]) {
      const output = fixtures.provide(probe);
      const transport = vi
        .fn<typeof fetch>()
        .mockImplementation(
          async () => new Response(new Uint8Array(output.body)),
        );
      const id = probe?.id ?? "valid-control";
      try {
        const proposal = await new ConfiguredSchemaMappingProvider(
          configuration,
          transport,
        ).propose(structuredClone(adversarialMappingInput));
        accepted[id] = proposal.fields.map(
          ({ sourceColumn, targetField, transform }) => [
            sourceColumn,
            targetField,
            transform,
          ],
        );
      } catch {
        rejected.push(id);
      }
    }
    expect(Object.keys(accepted)).toEqual([
      "valid-control",
      "target-transform-mismatch",
      "transform-fails-on-rows",
    ]);
    expect(rejected).toHaveLength(24);
    expect(accepted["target-transform-mismatch"]).toContainEqual([
      "id",
      "sourceEventId",
      "DECIMAL_STRING",
    ]);
    expect(accepted["transform-fails-on-rows"]).toContainEqual([
      "time",
      "eventTime",
      "EPOCH_MS_TO_ISO",
    ]);
  });
});
