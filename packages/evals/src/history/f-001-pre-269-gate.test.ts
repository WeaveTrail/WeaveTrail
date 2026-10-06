import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  HostileMappingFixtureProvider,
  adversarialMappingInput,
  adversarialMappingProbes,
} from "./adversarial-mapping-fixtures-7d18a52";
import { ConfiguredSchemaMappingProvider } from "./configured-provider-9b15a96";

// Each copy is its `git show <commit>:<origin>` blob plus a four-line header and
// the listed import rewrites; reversing them must reproduce the blob's SHA-256.
// The gate and its contract are frozen at 9b15a96; the probes at 7d18a52, the
// fixtures actually observed.
const HEADER_LINES = 4;
const COPIES = [
  {
    copy: "./configured-provider-9b15a96.ts",
    commit: "9b15a96",
    origin: "packages/ai-harness/src/configured-provider.ts",
    sha256: "d205631378b7bf6fdf1f73227b3e05dfc89b63835fcedf7d5ac30f489bd711f4",
    rewrites: [
      ['from "./schema-mapping-9b15a96";', 'from "@weavetrail/contracts";'],
      ['from "@weavetrail/ai-harness";', 'from "./provider";'],
    ],
  },
  {
    copy: "./schema-mapping-9b15a96.ts",
    commit: "9b15a96",
    origin: "packages/contracts/src/schema-mapping.ts",
    sha256: "d401796047ce29136ee05f39a76dc5a8eefa8617acd742ba3bddeea3543c9ba2",
    rewrites: [],
  },
  {
    copy: "./adversarial-mapping-fixtures-7d18a52.ts",
    commit: "7d18a52",
    origin: "packages/evals/src/adversarial-mapping-fixtures.ts",
    sha256: "9bde4e0844146d8b61d850f7493a475049de5aa9fe49e5a478831af57a505ef1",
    rewrites: [],
  },
] as const;

const configuration = {
  baseUrl: "https://hostile.invalid",
  apiKey: "synthetic-offline-secret",
  model: "synthetic-offline-model",
};

/** Replays AI failure log F-001: the pre-#269 gate over the committed probes. */
describe("F-001 historical replay of the configured gate at 9b15a96", () => {
  it.each(COPIES)(
    "freezes $origin as it was at $commit",
    ({ copy, sha256, rewrites }) => {
      // Git blobs are LF; a CRLF checkout must hash the same bytes.
      let original = readFileSync(new URL(copy, import.meta.url), "utf8")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .slice(HEADER_LINES)
        .join("\n");
      for (const [from, to] of rewrites)
        original = original.replaceAll(from, to);
      expect(createHash("sha256").update(original).digest("hex")).toBe(sha256);
    },
  );

  it("imports no live workspace runtime code besides type declarations", () => {
    for (const { copy } of COPIES) {
      const text = readFileSync(new URL(copy, import.meta.url), "utf8");
      const specifiers = [
        ...text.matchAll(/^(import|export)( type)?[^;]*?from "([^"]+)";/gms),
      ].map(([, , type, from]) => `${type ? "type " : ""}${from}`);
      for (const specifier of specifiers)
        expect(specifier, copy).toMatch(
          /^(zod|\.\/schema-mapping-9b15a96|type @weavetrail\/ai-harness(\/server)?)$/,
        );
    }
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
