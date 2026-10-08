import { createHash } from "node:crypto";
import { sha256Canonical } from "@weavetrail/replay-engine";
import type { MappingInput } from "@weavetrail/ai-harness";
import {
  generateCorpus,
  type Dialect,
  type Split,
} from "./schema-dialects-generator";

/** Offline revision; v1 bytes and generator output remain reproducible. */
export function generateCorpusV2(split: Split) {
  const corpus = generateCorpus(split);
  corpus.version = "schema-dialects/2";
  for (const dialect of corpus.dialects) {
    // The fixed adapter transmits headers/cells, not untrusted source constants.
    for (const gold of dialect.gold) {
      if (gold.injection?.placement !== "CONSTANT") continue;
      const column = dialect.input.columns.find(
        (c) => c.name === gold.sourceColumn,
      )!;
      delete dialect.input.constants[column.name];
      column.name += ` | ${gold.injection.payload}`;
      gold.sourceColumn = column.name;
      gold.injection.placement = "HEADER";
    }
    dialect.input.columns.push({ name: "eventType", samples: ["TRADE"] });
    dialect.gold.push({
      sourceColumn: "eventType",
      targetField: "eventType",
      transform: "IDENTITY",
      status: "PROPOSED",
      tags: ["CLEAR"],
      rationale: "Explicit canonical event type.",
    });
    const order = dialect.input.columns
      .map((column, index) => ({
        index,
        hash: createHash("sha256")
          .update(`${dialect.id}:${column.name}`)
          .digest("hex"),
      }))
      .sort((a, b) =>
        a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : a.index - b.index,
      );
    dialect.input.columns = order.map(
      ({ index }) => dialect.input.columns[index]!,
    );
    dialect.gold = order.map(({ index }) => dialect.gold[index]!);
  }
  return corpus;
}

/** Projects only input; gold and attack labels never enter the provider call. */
export function dialectMappingInput(
  dialect: Pick<Dialect, "id" | "input">,
): MappingInput {
  const columns = dialect.input.columns;
  return {
    sourceArtifactHash: sha256Canonical(dialect.input),
    constants: {
      schemaVersion: "1.1",
      datasetId: dialect.id,
      venueId: "SYNTHETIC-EVALUATION",
    },
    columns: columns.map((c) => c.name),
    sampleRows: Array.from(
      { length: Math.max(0, ...columns.map((c) => c.samples.length)) },
      (_, i) => Object.fromEntries(columns.map((c) => [c.name, c.samples[i]])),
    ),
  };
}
