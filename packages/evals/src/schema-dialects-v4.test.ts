import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import {
  mappingColumnIds,
  validateColumnIdStructure,
  validateMappingStructure,
} from "@weavetrail/ai-harness/server";
import { CorpusSchema } from "./mapping-scorer";
import { generateCorpusV4 } from "./schema-dialects-v4";
import { generateCorpusV3 } from "./schema-dialects-v3";
import { generateCorpusV2, dialectMappingInput } from "./schema-dialects-v2";
import { generateCorpus, tags } from "./schema-dialects-generator";
import { buildLexicalVocabulary } from "./lexical-baseline-vocabulary";

const fixture = new URL("../fixtures/schema-dialects-v4/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, fixture), "utf8");
const splits = ["DEV", "HELD_OUT"] as const;
const corpora = Object.fromEntries(
  splits.map((split) => [
    split,
    CorpusSchema.parse(JSON.parse(read(`${split}.json`))),
  ]),
) as Record<(typeof splits)[number], ReturnType<typeof CorpusSchema.parse>>;
const payloads = (split: (typeof splits)[number]) =>
  corpora[split].dialects.flatMap((d) =>
    d.gold.flatMap((g) => (g.injection ? [g.injection.payload] : [])),
  );
const earlier = [
  ...(["DEV", "HELD_OUT"] as const).flatMap((split) => [
    generateCorpus(split),
    generateCorpusV2(split),
  ]),
  generateCorpusV3(),
];

describe("schema-dialects/4", () => {
  it.each(splits)(
    "reproduces the sealed %s bytes from the committed generator",
    async (split) => {
      const bytes = read(`${split}.json`);
      expect(
        await format(JSON.stringify(generateCorpusV4(split)), {
          parser: "json",
        }),
      ).toBe(bytes);
      expect(read(`${split}.sha256`)).toBe(
        `${createHash("sha256").update(bytes).digest("hex")}  ${split}.json\n`,
      );
    },
  );

  it.each(splits)(
    "gives every %s dialect all tags, required targets and gold valid under both validators",
    (split) => {
      expect(corpora[split].dialects).toHaveLength(12);
      for (const d of corpora[split].dialects) {
        expect(new Set(d.gold.flatMap((g) => g.tags))).toEqual(new Set(tags));
        expect(d.gold.every((g) => g.tags.length === 1)).toBe(true);
        for (const target of [
          "sourceEventId",
          "eventTime",
          "instrumentId",
          "eventType",
        ])
          expect(d.gold.filter((g) => g.targetField === target)).toHaveLength(
            1,
          );
        const input = dialectMappingInput(d);
        for (const g of d.gold.filter((g) => g.injection))
          expect(JSON.stringify(input)).toContain(g.injection!.payload);
        const fields = d.gold.map((g) => ({
          sourceColumn: g.sourceColumn,
          targetField: g.targetField,
          transform: g.transform,
          status: g.status,
          confidence: g.status === "PROPOSED" ? 1 : 0,
          evidence: g.rationale,
        }));
        expect(
          validateMappingStructure({ kind: "fields", value: { fields } }, input)
            .status,
        ).toBe("VALID");
        const ids = mappingColumnIds(input);
        expect(
          validateColumnIdStructure(
            {
              kind: "fields",
              value: {
                fields: fields.map(({ sourceColumn, ...field }) => ({
                  columnId: ids[input.columns.indexOf(sourceColumn)],
                  ...field,
                })),
              },
            },
            input,
          ).status,
        ).toBe("VALID");
      }
    },
  );

  it("shares no attack string between the splits or with an earlier corpus", () => {
    const dev = payloads("DEV"),
      heldOut = payloads("HELD_OUT");
    expect(dev).toHaveLength(24);
    expect(heldOut).toHaveLength(24);
    const plain = (payload: string) =>
      payload.startsWith("base64:")
        ? Buffer.from(payload.slice(7), "base64").toString()
        : payload.replaceAll("​", "");
    const devText = new Set(dev.map(plain));
    for (const text of heldOut.map(plain))
      expect(devText.has(text)).toBe(false);
    const old = new Set(
      earlier.flatMap((c) =>
        c.dialects.flatMap((d) =>
          d.gold.flatMap((g) =>
            g.injection ? [plain(g.injection.payload)] : [],
          ),
        ),
      ),
    );
    for (const text of [...dev, ...heldOut].map(plain))
      expect(old.has(text)).toBe(false);
    // Placements are scheduled separately, and both splits use both placements.
    for (const split of splits)
      expect(
        new Set(
          corpora[split].dialects.flatMap((d) =>
            d.gold.flatMap((g) => (g.injection ? [g.injection.placement] : [])),
          ),
        ),
      ).toEqual(new Set(["HEADER", "CELL"]));
  });

  it("authors new whole headers and naming families for both splits", () => {
    const strip = (name: string) => name.split(" | ")[0]!;
    const names = (c: {
      dialects: { input: { columns: { name: string }[] } }[];
    }) =>
      c.dialects.flatMap((d) =>
        d.input.columns
          .map((col) => strip(col.name))
          .filter((n) => n !== "eventType"),
      );
    const oldNames = new Set(earlier.flatMap(names));
    const oldFamilies = new Set(
      earlier.flatMap((c) => c.dialects.map((d) => d.namingFamily)),
    );
    for (const split of splits) {
      for (const name of names(corpora[split]))
        expect(oldNames.has(name), name).toBe(false);
      for (const d of corpora[split].dialects)
        expect(oldFamilies.has(d.namingFamily), d.namingFamily).toBe(false);
    }
    const dev = new Set(names(corpora.DEV));
    for (const name of names(corpora.HELD_OUT))
      expect(dev.has(name)).toBe(false);
  });

  it("freezes lexical-baseline/3 from v4 DEV only", async () => {
    const bytes = read("DEV.json");
    const sha256 = read("DEV.sha256").split(" ")[0]!;
    expect(
      readFileSync(
        new URL(
          "../fixtures/lexical-baseline-v3/vocabulary.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).toBe(
      await format(
        JSON.stringify(
          buildLexicalVocabulary(bytes, sha256, "lexical-baseline/3"),
        ),
        { parser: "json" },
      ),
    );
    expect(() =>
      buildLexicalVocabulary(
        read("HELD_OUT.json"),
        read("HELD_OUT.sha256").split(" ")[0]!,
        "lexical-baseline/3",
      ),
    ).toThrow("DEV only");
  });
});
