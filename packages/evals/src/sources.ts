import { readFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import type {
  CaseManifest,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  actorlessMultiInstrumentMappingProposal,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  committedReplayScenarios,
} from "@weavetrail/scenarios";
import {
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
  type SourceRow,
} from "@weavetrail/replay-engine";

export type EvaluationSource = {
  rows: readonly SourceRow[];
  mappingProposal: SchemaMappingProposal;
  manifest?: CaseManifest;
};

export const sources: Record<string, EvaluationSource> = {
  ...committedReplayScenarios,
  "actorless-multi-instrument-quotes.jsonl": {
    ...committedReplayScenarios["actorless-multi-instrument-quotes.jsonl"],
    mappingProposal: actorlessMultiInstrumentMappingProposal,
  },
  "concentrated-buy-dialect-a.csv": {
    ...committedReplayScenarios["concentrated-buy-dialect-a.csv"],
    mappingProposal: concentratedBuyDialectAProposal,
  },
  "concentrated-buy-dialect-b.jsonl": {
    ...committedReplayScenarios["concentrated-buy-dialect-b.jsonl"],
    mappingProposal: concentratedBuyDialectBProposal,
  },
};

export function committedRows(name: string, source: EvaluationSource) {
  const bytes = readFileSync(
    new URL(`../../scenarios/src/sources/${name}`, import.meta.url),
  );
  const parse = name.endsWith(".csv")
    ? parseCsvSourceArtifact
    : parseJsonLinesSourceArtifact;
  // Parsers verify the original-byte SHA-256 before yielding coordinates.
  const rows = parse(bytes, source.mappingProposal.sourceArtifactHash);
  deepStrictEqual(rows, source.rows, `Committed rows: ${name}`);
  return rows;
}
