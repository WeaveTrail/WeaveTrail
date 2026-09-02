import {
  CaseManifestSchema,
  SchemaMappingProposalSchema,
  deriveApprovedSourceMapping,
  type CaseManifest,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";

type SourceRow = {
  coordinate: { sourceArtifactHash: string; rowNumber: string };
  values: Record<string, string>;
};

type ScenarioDefinition = {
  label: string;
  sourceArtifactHash: string;
  constants: SchemaMappingProposal["constants"];
  columns: string[];
  rows: SourceRow[];
  mappingProposal: SchemaMappingProposal;
  manifest: CaseManifest;
  expectedResult: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE";
};

const SOURCE_COLUMNS = [
  "source_id",
  "ts",
  "seq",
  "symbol",
  "kind",
  "side",
  "actor",
  "px",
  "qty",
] as const;

const SCENARIO_INPUTS = {
  "rapid-price-lift-supported.csv": {
    label: "Rapid price lift · supported",
    sourceArtifactHash:
      "72511e0c67ec066130fcb10d92f0afa43e1147023722ca0fa6d82ef57a90a827",
    datasetId: "synthetic-rapid-price-lift-supported-v1",
    expectedResult: "SUPPORTED",
    canonicalDatasetHash:
      "d5f7482dab89bd7006f9e3e71e61d1fa8197ac4e714b1dc8a5036fd2140fede9",
    approvedManifestHash:
      "3bee8ad2bd52bea49c4e64b13cfee48913f4c757ad010629eab3ae05fdb9e8f8",
    rows: [
      [
        "supported-001",
        "2026-09-01T00:00:00Z",
        "1",
        "S",
        "participant-base",
        "100",
        "1",
      ],
      [
        "supported-002",
        "2026-09-01T00:00:01Z",
        "2",
        "B",
        "participant-focus",
        "101",
        "4",
      ],
      [
        "supported-003",
        "2026-09-01T00:00:02Z",
        "3",
        "B",
        "participant-focus",
        "102",
        "4",
      ],
      [
        "supported-004",
        "2026-09-01T00:00:03Z",
        "4",
        "B",
        "participant-focus",
        "102",
        "4",
      ],
      [
        "supported-005",
        "2026-09-01T00:00:04Z",
        "5",
        "S",
        "participant-wide-a",
        "100.5",
        "1",
      ],
      [
        "supported-006",
        "2026-09-01T00:00:05Z",
        "6",
        "S",
        "participant-wide-b",
        "100.75",
        "1",
      ],
    ],
  },
  "rapid-price-lift-broad-participation.csv": {
    label: "Rapid price lift · broad participation",
    sourceArtifactHash:
      "08b1d150939e10d91c8818424572feab58e55e6fd2e71acd3a2149b72b76f6d0",
    datasetId: "synthetic-rapid-price-lift-broad-v1",
    expectedResult: "NOT_SUPPORTED",
    canonicalDatasetHash:
      "84dd3996bebf1668be5bd87ca2ad0314c8bda278704d73880ae25118d6199bd9",
    approvedManifestHash:
      "5f388b1d6ebb6cd1a47b98caa9c6a399c5f576d31a79c075166259d980ab6b0b",
    rows: [
      [
        "broad-001",
        "2026-09-01T00:00:00Z",
        "1",
        "S",
        "participant-base",
        "100",
        "3",
      ],
      [
        "broad-002",
        "2026-09-01T00:00:01Z",
        "2",
        "B",
        "participant-focus",
        "101",
        "1",
      ],
      [
        "broad-003",
        "2026-09-01T00:00:02Z",
        "3",
        "B",
        "participant-focus",
        "102",
        "1",
      ],
      [
        "broad-004",
        "2026-09-01T00:00:03Z",
        "4",
        "B",
        "participant-wide-a",
        "102",
        "5",
      ],
      [
        "broad-005",
        "2026-09-01T00:00:04Z",
        "5",
        "B",
        "participant-wide-b",
        "102",
        "5",
      ],
      [
        "broad-006",
        "2026-09-01T00:00:05Z",
        "6",
        "S",
        "participant-wide-c",
        "100.5",
        "3",
      ],
    ],
  },
  "rapid-price-lift-insufficient-evidence.csv": {
    label: "Rapid price lift · insufficient evidence",
    sourceArtifactHash:
      "15f79ef0265f836b5a01635bbcdd8e2f241431fbcc87fc504a1e2f7ea05582f7",
    datasetId: "synthetic-rapid-price-lift-insufficient-v1",
    expectedResult: "INCONCLUSIVE",
    canonicalDatasetHash:
      "b2fd0250f1e39205cf61b5447d8af9652a036f6276d2b8017334a0231d4fa630",
    approvedManifestHash:
      "a05de0032c21a3a1007593c4e2c34486b789e8b23402141ecb1d1a5c592bb57f",
    rows: [
      [
        "insufficient-001",
        "2026-09-01T00:00:00Z",
        "1",
        "B",
        "participant-focus",
        "100",
        "2",
      ],
      [
        "insufficient-002",
        "2026-09-01T00:00:01Z",
        "2",
        "B",
        "participant-focus",
        "101",
        "2",
      ],
      [
        "insufficient-003",
        "2026-09-01T00:00:02Z",
        "3",
        "B",
        "participant-focus",
        "102",
        "2",
      ],
      [
        "insufficient-004",
        "2026-09-01T00:00:03Z",
        "4",
        "S",
        "participant-wide-a",
        "100.5",
        "1",
      ],
    ],
  },
} as const;

function buildScenario(
  input: (typeof SCENARIO_INPUTS)[keyof typeof SCENARIO_INPUTS],
): ScenarioDefinition {
  const constants = {
    schemaVersion: "1.0" as const,
    datasetId: input.datasetId,
    venueId: "SYNTH-RULE",
  };
  const mappingProposal = SchemaMappingProposalSchema.parse({
    mappingVersion: "1.2",
    sourceArtifactHash: input.sourceArtifactHash,
    constants,
    fields: [
      ["source_id", "sourceEventId", "IDENTITY"],
      ["ts", "eventTime", "ISO_DATETIME"],
      ["seq", "sequence", "IDENTITY"],
      ["symbol", "instrumentId", "IDENTITY"],
      ["kind", "eventType", "EVENT_TYPE_CODE"],
      ["side", "side", "BUY_SELL_CODE"],
      ["actor", "actorId", "IDENTITY"],
      ["px", "price", "DECIMAL_STRING"],
      ["qty", "quantity", "DECIMAL_STRING"],
    ].map(([sourceColumn, targetField, transform]) => ({
      sourceColumn,
      targetField,
      transform,
      confidence: 1,
      evidence: "Matched by the versioned synthetic fixture mapping table.",
      status: "PROPOSED",
    })),
  });
  const mapping = deriveApprovedSourceMapping(mappingProposal);
  const rows = input.rows.map(
    ([sourceId, eventTime, sequence, side, actor, price, quantity], index) => ({
      coordinate: {
        sourceArtifactHash: mapping.sourceArtifactHash,
        rowNumber: String(index + 2),
      },
      values: {
        source_id: sourceId,
        ts: eventTime,
        seq: sequence,
        symbol: "WT-RPL-SYNTH",
        kind: "T",
        side,
        actor,
        px: price,
        qty: quantity,
      },
    }),
  );
  const manifest = CaseManifestSchema.parse({
    manifestVersion: "1.2",
    caseId: input.datasetId,
    canonicalDatasetHash: input.canonicalDatasetHash,
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: "WT-RPL-SYNTH",
      actorIds: ["participant-focus"],
      startTime: "2026-09-01T00:00:00Z",
      endTime: "2026-09-01T00:00:05Z",
    },
    rules: [
      {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.0",
        parameters: {
          minimumPriceChangeBps: "100",
          minimumAggressiveBuyShareBps: "7000",
          minimumActorConcentrationShareBps: "8000",
          minimumExecutionsAboveReference: "2",
          minimumRemovalSensitivityBps: "50",
        },
      },
    ],
    aiTrace: {
      provider: "fixture",
      model: "deterministic",
      promptVersion: "rapid-price-lift-case-v1",
      confidence: 1,
      referencedEventIds: [],
    },
    approval: {
      approvedArtifactHash: input.approvedManifestHash,
      reviewerRef: "reviewer-fixture",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-03T00:00:00Z",
    },
  });

  return {
    label: input.label,
    sourceArtifactHash: input.sourceArtifactHash,
    constants,
    columns: [...SOURCE_COLUMNS],
    rows,
    mappingProposal,
    manifest,
    expectedResult: input.expectedResult,
  };
}

export const rapidPriceLiftScenarios = Object.fromEntries(
  Object.entries(SCENARIO_INPUTS).map(([name, input]) => [
    name,
    buildScenario(input),
  ]),
) as Record<keyof typeof SCENARIO_INPUTS, ScenarioDefinition>;
