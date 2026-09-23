import {
  CaseManifestSchema,
  SchemaMappingProposalSchema,
  deriveApprovedSourceMapping,
} from "@weavetrail/contracts";

const FIX_SOURCE_ARTIFACT_HASH =
  "f623c3327251b5323b07d066cb940bee0ac0ed895c39fb81707469ae1e1f958b";
const FIX_CONFLICT_SOURCE_ARTIFACT_HASH =
  "fb1f933e6c979c75bd4631fb581fb5c4796b84d89d73a28bf414dc7d9e2fdc57";
const H0STCNT0_SOURCE_ARTIFACT_HASH =
  "c6fb040df7cf060d43795424f95a8261b0ca4a06486750639c9762e39893c8ef";

const constants = {
  schemaVersion: "1.1" as const,
  datasetId: "synthetic-published-execution-schema-v1",
  venueId: "SYNTH-KRX-RULES",
  eventType: "TRADE" as const,
};

const mappingField = (
  sourceColumn: string,
  targetField: string | null,
  transform: string | null,
  evidence: string,
) => ({
  sourceColumn,
  targetField,
  transform,
  confidence: 1,
  evidence,
  status: "PROPOSED" as const,
});

export const publishedExecutionFixProposal = SchemaMappingProposalSchema.parse({
  mappingVersion: "1.8",
  sourceArtifactHash: FIX_SOURCE_ARTIFACT_HASH,
  constants,
  unmappedFields: [],
  fields: [
    mappingField(
      "ExecID(17)",
      "sourceEventId",
      "IDENTITY",
      "FIX 4.4 identifies the execution report with ExecID tag 17.",
    ),
    mappingField(
      "TransactTime(60)",
      "eventTime",
      "FIX_UTC_TIMESTAMP_TO_ISO",
      "FIX 4.4 defines TransactTime tag 60 as a UTC timestamp.",
    ),
    mappingField(
      "Symbol(55)",
      "instrumentId",
      "IDENTITY",
      "FIX 4.4 carries the instrument symbol in tag 55.",
    ),
    mappingField(
      "Side(54)",
      "side",
      "FIX_SIDE_CODE",
      "FIX Side tag 54 uses 1 for buy and 2 for sell in this synthetic execution projection.",
    ),
    mappingField(
      "LastPx(31)",
      "price",
      "DECIMAL_STRING",
      "FIX 4.4 carries the last-fill price in tag 31.",
    ),
    mappingField(
      "LastQty(32)",
      "quantity",
      "DECIMAL_STRING",
      "FIX 4.4 carries the last-fill quantity in tag 32.",
    ),
    mappingField(
      "Account(1)",
      "actorId",
      "IDENTITY",
      "FIX 4.4 carries the institution-assigned account in tag 1.",
    ),
  ],
});

export const publishedExecutionH0stcnt0Proposal =
  SchemaMappingProposalSchema.parse({
    mappingVersion: "1.8",
    sourceArtifactHash: H0STCNT0_SOURCE_ARTIFACT_HASH,
    constants,
    compositeEventTime: {
      sourceColumns: ["BSOP_DATE", "STCK_CNTG_HOUR"],
      transform: "KIS_DATE_TIME_TO_KST_ISO",
      confidence: 1,
      evidence:
        "The published H0STCNT0 response supplies the Korean business date and execution time separately.",
      status: "PROPOSED",
    },
    unmappedFields: [
      {
        targetField: "actorId",
        confidence: 0,
        evidence:
          "The published H0STCNT0 response has no participant or account column; actorId remains absent.",
        status: "REVIEW_REQUIRED",
      },
    ],
    fields: [
      mappingField(
        "MKSC_SHRN_ISCD",
        "instrumentId",
        "IDENTITY",
        "The published H0STCNT0 response names the short instrument code in MKSC_SHRN_ISCD.",
      ),
      mappingField(
        "STCK_CNTG_HOUR",
        "sourceEventId",
        "IDENTITY",
        "The bounded synthetic specimen has one execution per distinct published execution-time value.",
      ),
      mappingField(
        "STCK_PRPR",
        "price",
        "DECIMAL_STRING",
        "The published H0STCNT0 response names the current execution price in STCK_PRPR.",
      ),
      mappingField(
        "CNTG_VOL",
        "quantity",
        "DECIMAL_STRING",
        "The published H0STCNT0 response names execution quantity in CNTG_VOL.",
      ),
      mappingField(
        "CCLD_DVSN",
        "side",
        "KIS_CCLD_DVSN",
        "The official H0STCNT0 sample defines 1 as buy and 5 as sell.",
      ),
      mappingField(
        "BSOP_DATE",
        null,
        null,
        "BSOP_DATE participates in compositeEventTime and has no second canonical target.",
      ),
    ],
  });

const conflictConstants = {
  ...constants,
  datasetId: "synthetic-published-execution-conflict-v1",
};

export const publishedExecutionConflictProposal =
  SchemaMappingProposalSchema.parse({
    ...publishedExecutionFixProposal,
    sourceArtifactHash: FIX_CONFLICT_SOURCE_ARTIFACT_HASH,
    constants: conflictConstants,
  });

export const publishedExecutionFixMapping = deriveApprovedSourceMapping(
  publishedExecutionFixProposal,
);
export const publishedExecutionH0stcnt0Mapping = deriveApprovedSourceMapping(
  publishedExecutionH0stcnt0Proposal,
);
export const publishedExecutionConflictMapping = deriveApprovedSourceMapping(
  publishedExecutionConflictProposal,
);

const executions = [
  ["100000", "12000", "3", "SELL", "SYNTH-ACCOUNT-BASE"],
  ["100001", "12150", "4", "BUY", "SYNTH-ACCOUNT-FOCUS"],
  ["100002", "12300", "4", "BUY", "SYNTH-ACCOUNT-FOCUS"],
  ["100003", "12300", "4", "BUY", "SYNTH-ACCOUNT-FOCUS"],
  ["100004", "12050", "1", "SELL", "SYNTH-ACCOUNT-WIDE-A"],
  ["100005", "12100", "1", "SELL", "SYNTH-ACCOUNT-WIDE-B"],
] as const;

export const publishedExecutionFixRows = executions.map(
  ([time, price, quantity, side, actorId], index) => ({
    coordinate: {
      sourceArtifactHash: FIX_SOURCE_ARTIFACT_HASH,
      rowNumber: String(index + 2),
    },
    values: {
      "ExecID(17)": time,
      "TransactTime(60)": `20260903-01:00:${time.slice(-2)}`,
      "Symbol(55)": "ZZ79X1",
      "Side(54)": side === "BUY" ? "1" : "2",
      "LastPx(31)": price,
      "LastQty(32)": quantity,
      "Account(1)": actorId,
    },
  }),
);

export const publishedExecutionH0stcnt0Rows = executions.map(
  ([time, price, quantity, side], index) => ({
    coordinate: {
      sourceArtifactHash: H0STCNT0_SOURCE_ARTIFACT_HASH,
      rowNumber: String(index + 1),
    },
    values: {
      MKSC_SHRN_ISCD: "ZZ79X1",
      STCK_CNTG_HOUR: time,
      STCK_PRPR: price,
      CNTG_VOL: quantity,
      CCLD_DVSN: side === "BUY" ? "1" : "5",
      BSOP_DATE: "20260903",
    },
  }),
);

const conflictingExecutions = [
  ["120000", "20260903-01:02:00", "12000", "3", "2", "SYNTH-ACCOUNT-BASE"],
  ["120001", "20260903-01:02:01", "12150", "4", "1", "SYNTH-ACCOUNT-FOCUS"],
  ["120001", "20260903-01:02:02", "12300", "4", "1", "SYNTH-ACCOUNT-FOCUS"],
  ["120003", "20260903-01:02:03", "12050", "1", "2", "SYNTH-ACCOUNT-WIDE-A"],
] as const;

export const publishedExecutionConflictRows = conflictingExecutions.map(
  ([sourceEventId, eventTime, price, quantity, side, actorId], index) => ({
    coordinate: {
      sourceArtifactHash: FIX_CONFLICT_SOURCE_ARTIFACT_HASH,
      rowNumber: String(index + 2),
    },
    values: {
      "ExecID(17)": sourceEventId,
      "TransactTime(60)": eventTime,
      "Symbol(55)": "ZZ79X1",
      "Side(54)": side,
      "LastPx(31)": price,
      "LastQty(32)": quantity,
      "Account(1)": actorId,
    },
  }),
);

export const publishedExecutionManifest = CaseManifestSchema.parse({
  manifestVersion: "1.3",
  caseId: "synthetic-published-execution-schema-v1",
  canonicalDatasetHash:
    "8ff6d5cd9b8c5362e9bcfd9337a8c52c5cbfb226eba29c10d353134e39c0d3c5",
  hypothesis: {
    pattern: "RAPID_PRICE_LIFT",
    instrumentId: "ZZ79X1",
    actorIds: ["SYNTH-ACCOUNT-FOCUS"],
    startTime: "2026-09-03T01:00:00Z",
    endTime: "2026-09-03T01:00:05Z",
  },
  rules: [
    {
      ruleId: "RAPID_PRICE_LIFT",
      ruleVersion: "1.1",
      parameters: {
        minimumPriceChangeBps: "200",
        minimumAggressiveBuyShareBps: "7000",
        minimumActorConcentrationShareBps: "8000",
        minimumExecutionsAboveReference: "2",
        minimumRemovalSensitivityBps: "100",
      },
    },
  ],
  aiTrace: {
    provider: "fixture",
    model: "deterministic",
    promptVersion: "published-execution-schema-case-v1",
    confidence: 1,
    referencedEventIds: [],
  },
  approval: {
    approvedArtifactHash:
      "25bcfc09b1e1443d961a543e685f50b7d9cfbdff02365f87eb455b85984aae88",
    reviewerRef: "reviewer-fixture",
    decision: "APPROVED",
    overrides: [],
    approvedAt: "2026-09-07T15:35:08Z",
  },
});

export const publishedExecutionSchemaScenario = {
  fix: {
    label: "Synthetic · published FIX 4.4 execution fields · CSV",
    sourceArtifactHash: FIX_SOURCE_ARTIFACT_HASH,
    constants,
    columns: publishedExecutionFixProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: publishedExecutionFixRows,
    mappingProposal: publishedExecutionFixProposal,
    manifest: publishedExecutionManifest,
    expectedResult: "SUPPORTED" as const,
  },
  h0stcnt0: {
    label: "Synthetic · published H0STCNT0 execution fields · JSON Lines",
    sourceArtifactHash: H0STCNT0_SOURCE_ARTIFACT_HASH,
    constants,
    columns: publishedExecutionH0stcnt0Proposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: publishedExecutionH0stcnt0Rows,
    mappingProposal: publishedExecutionH0stcnt0Proposal,
  },
  conflict: {
    label: "Synthetic · conflicting FIX 4.4 execution evidence · CSV",
    sourceArtifactHash: FIX_CONFLICT_SOURCE_ARTIFACT_HASH,
    constants: conflictConstants,
    columns: publishedExecutionConflictProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: publishedExecutionConflictRows,
    mappingProposal: publishedExecutionConflictProposal,
    expectedWorkflowState: "INPUT_REVIEW_REQUIRED" as const,
    expectedReviewCode: "CONFLICTING_SOURCE_IDENTITY" as const,
    demonstrates:
      "ExecID(17) 120001 is reused with different TransactTime(60) and LastPx(31) values, so normalization requires review before replay and produces no result hash.",
  },
} as const;
