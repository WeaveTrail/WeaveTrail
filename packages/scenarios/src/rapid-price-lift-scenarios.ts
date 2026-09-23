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
  expectedWorkflowState: "REPLAYED";
  demonstrates: string;
  expectedInconclusiveReason?: "INSUFFICIENT_ELIGIBLE_EVENTS";
  expectedNonComparableEventCount?: number;
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
    expectedWorkflowState: "REPLAYED",
    demonstrates:
      input.expectedResult === "SUPPORTED"
        ? "Complete evidence satisfies every declared RAPID_PRICE_LIFT gate."
        : "Complete evidence is sufficient to evaluate, but broad participation fails the declared concentration gates.",
  };
}

const legacyRapidPriceLiftScenarios = Object.fromEntries(
  Object.entries(SCENARIO_INPUTS).map(([name, input]) => [
    name,
    buildScenario(input),
  ]),
) as Record<keyof typeof SCENARIO_INPUTS, ScenarioDefinition>;

function buildMissingEvidenceScenario(): ScenarioDefinition {
  const sourceArtifactHash =
    "33db4b61e5bb86a057f9f2c80f9c9d0033d024d0499d3ef2133f7c5aa102bb4b";
  const constants = {
    schemaVersion: "1.1" as const,
    datasetId: "synthetic-rapid-price-lift-missing-evidence-v1",
    venueId: "SYNTH-KRX-RULES",
    eventType: "TRADE" as const,
  };
  const fields = [
    ["ExecID(17)", "sourceEventId", "IDENTITY"],
    ["TransactTime(60)", "eventTime", "FIX_UTC_TIMESTAMP_TO_ISO"],
    ["Symbol(55)", "instrumentId", "IDENTITY"],
    ["LastPx(31)", "price", "DECIMAL_STRING"],
    ["LastQty(32)", "quantity", "DECIMAL_STRING"],
    ["Account(1)", "actorId", "IDENTITY"],
  ] as const;
  const mappingProposal = SchemaMappingProposalSchema.parse({
    mappingVersion: "1.8",
    sourceArtifactHash,
    constants,
    unmappedFields: [],
    fields: fields.map(([sourceColumn, targetField, transform]) => ({
      sourceColumn,
      targetField,
      transform,
      confidence: 1,
      evidence:
        "Matched to the named FIX 4.4 execution field; Side(54) is absent from this committed source.",
      status: "PROPOSED",
    })),
  });
  const sourceRows = [
    ["110000", "20260903-01:01:00", "12000", "3", "SYNTH-ACCOUNT-BASE"],
    ["110001", "20260903-01:01:01", "12150", "4", "SYNTH-ACCOUNT-FOCUS"],
    ["110002", "20260903-01:01:02", "12300", "4", "SYNTH-ACCOUNT-FOCUS"],
    ["110003", "20260903-01:01:03", "12050", "1", "SYNTH-ACCOUNT-WIDE-A"],
  ] as const;
  const rows = sourceRows.map(
    ([sourceEventId, eventTime, price, quantity, actorId], index) => ({
      coordinate: { sourceArtifactHash, rowNumber: String(index + 2) },
      values: {
        "ExecID(17)": sourceEventId,
        "TransactTime(60)": eventTime,
        "Symbol(55)": "ZZ79X1",
        "LastPx(31)": price,
        "LastQty(32)": quantity,
        "Account(1)": actorId,
      },
    }),
  );
  const manifest = CaseManifestSchema.parse({
    manifestVersion: "1.3",
    caseId: constants.datasetId,
    canonicalDatasetHash:
      "df9992cf54c354d5d9c4feb3d68929af0f36dfc59435fba0c5f26056972a7298",
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: "ZZ79X1",
      actorIds: ["SYNTH-ACCOUNT-FOCUS"],
      startTime: "2026-09-03T01:01:00Z",
      endTime: "2026-09-03T01:01:03Z",
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
      approvedArtifactHash:
        "a9e6e047b611cd5a2b392f494bea2d01e8404bf93a57e9bde6d0b6e41f4bc257",
      reviewerRef: "reviewer-fixture",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-08T00:00:00Z",
    },
  });

  return {
    label: "Rapid price lift · missing side evidence",
    sourceArtifactHash,
    constants,
    columns: fields.map(([sourceColumn]) => sourceColumn),
    rows,
    mappingProposal,
    manifest,
    expectedResult: "INCONCLUSIVE",
    expectedWorkflowState: "REPLAYED",
    expectedInconclusiveReason: "INSUFFICIENT_ELIGIBLE_EVENTS",
    expectedNonComparableEventCount: 4,
    demonstrates:
      "Every in-window trade lacks Side(54), so the rule withholds all four as non-comparable evidence and abstains.",
  };
}

export const rapidPriceLiftScenarios = {
  ...legacyRapidPriceLiftScenarios,
  "rapid-price-lift-insufficient-evidence.csv": buildMissingEvidenceScenario(),
} as const;
