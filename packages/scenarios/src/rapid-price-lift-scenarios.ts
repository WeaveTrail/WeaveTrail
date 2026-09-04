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
    startTime: "2026-09-01T00:00:00Z",
    endTime: "2026-09-01T00:00:05Z",
    canonicalDatasetHash:
      "9eeb45d15373e1222c8b7e1b147b5010d415a72109aca8a264f1da0a8ae4b706",
    approvedManifestHash:
      "5f4334b7b9cbd719a1ea38f882fac4d81fadd472a6f28da714fbe7967176802f",
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
    startTime: "2026-09-01T00:00:00Z",
    endTime: "2026-09-01T00:00:05Z",
    canonicalDatasetHash:
      "704fb15495b7fb2c5b612ba9a9213d1a429342e408587a085cdf4e28e859100f",
    approvedManifestHash:
      "8974645046e0f26d0ad112652c3f7bc3c604ad8fc6306979e9f959cb1cf9e4a7",
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
    startTime: "2026-09-01T00:00:00Z",
    endTime: "2026-09-01T00:00:03Z",
    canonicalDatasetHash:
      "0deca356833da2703b3a307b31b5426302a985ea91bdaad64218f5999a0965c2",
    approvedManifestHash:
      "75f042f8768934ac440d5f8f89f81fe4fbfd221cf8ce148fb96b60462504c096",
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
    schemaVersion: "1.1" as const,
    datasetId: input.datasetId,
    venueId: "SYNTH-RULE",
  };
  const mappingProposal = SchemaMappingProposalSchema.parse({
    mappingVersion: "1.4",
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
    manifestVersion: "1.3",
    caseId: input.datasetId,
    canonicalDatasetHash: input.canonicalDatasetHash,
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: "WT-RPL-SYNTH",
      actorIds: ["participant-focus"],
      startTime: input.startTime,
      endTime: input.endTime,
    },
    rules: [
      {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.1",
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
