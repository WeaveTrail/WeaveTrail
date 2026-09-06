import {
  SchemaMappingProposalSchema,
  type ApprovalRecord,
} from "@weavetrail/contracts";
import {
  approvedSourceMapping,
  parseJsonLinesSourceArtifact,
  sourceArtifactHash,
} from "../source-ingest";
import { mappingApprovalArtifact } from "../approval-validation";
import { sha256Canonical } from "../canonical-hash";

// Entirely synthetic specimens, never a registered real artifact or case.
export function syntheticDailyQuoteSpecimen(date = "20240229") {
  const values = ["B", "A"].map((id) => ({
    id: `synthetic-${id}`,
    instrument: `SYNTH-${id}`,
    date,
    close: "100.00",
    volume: "9007199254740993.00",
    note: '합성, quote " and newline\n',
  }));
  const bytes = Buffer.from(
    values.map((value) => JSON.stringify(value)).join("\n") + "\n",
  );
  const hash = sourceArtifactHash(bytes);
  const rows = parseJsonLinesSourceArtifact(bytes, hash);
  const proposal = SchemaMappingProposalSchema.parse({
    mappingVersion: "1.5",
    sourceArtifactHash: hash,
    constants: {
      schemaVersion: "1.2",
      datasetId: "synthetic-daily-v1",
      venueId: "SYNTH-X",
      eventType: "DAILY_QUOTE",
    },
    fields: [
      ["id", "sourceEventId", "IDENTITY"],
      ["instrument", "instrumentId", "IDENTITY"],
      ["date", "eventTime", "YYYYMMDD_TO_KST_DAY_START_ISO"],
      ["close", "price", "DECIMAL_STRING"],
      ["volume", "quantity", "DECIMAL_STRING"],
      ["note", null, null],
    ].map(([sourceColumn, targetField, transform], index) => ({
      sourceColumn,
      targetField,
      transform,
      confidence: index >= 2 && index <= 4 ? 0 : 1,
      evidence:
        "Synthetic explicit mapping; date, closing price and aggregate volume require review.",
      status: index >= 2 && index <= 4 ? "REVIEW_REQUIRED" : "PROPOSED",
    })),
  });
  if (proposal.mappingVersion !== "1.5")
    throw new Error("Expected daily proposal");
  const approval: ApprovalRecord = {
    approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
    reviewerRef: "synthetic-reviewer",
    decision: "APPROVED",
    approvedAt: "2026-09-06T00:00:00Z",
    overrides: [2, 3, 4].map((index) => ({
      fieldPath: `fields.${index}`,
      reason: `Accept synthetic field ${index} as its declared daily interpretation.`,
    })),
  };
  return { rows, proposal, approval, mapping: approvedSourceMapping(proposal) };
}
