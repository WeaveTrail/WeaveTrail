/** Authored oracles: changing these requires review, never an update flag. */
export const evaluationCases = {
  version: "financial-replay-evaluation/1",
  mutationVersion: "canonical-mutations/1",
  mappingCases: [
    {
      source: "published-execution-fix44.csv",
      fields: [
        ["ExecID(17)", "sourceEventId", "IDENTITY", "PROPOSED"],
        [
          "TransactTime(60)",
          "eventTime",
          "FIX_UTC_TIMESTAMP_TO_ISO",
          "PROPOSED",
        ],
        ["Symbol(55)", "instrumentId", "IDENTITY", "PROPOSED"],
        ["Side(54)", "side", "FIX_SIDE_CODE", "PROPOSED"],
        ["LastPx(31)", "price", "DECIMAL_STRING", "PROPOSED"],
        ["LastQty(32)", "quantity", "DECIMAL_STRING", "PROPOSED"],
        ["Account(1)", "actorId", "IDENTITY", "PROPOSED"],
      ],
      compositeEventTime: null,
      absentFields: [],
      withoutOverrides: "APPROVED",
    },
    {
      source: "published-execution-h0stcnt0.jsonl",
      fields: [
        ["MKSC_SHRN_ISCD", "instrumentId", "IDENTITY", "PROPOSED"],
        ["STCK_CNTG_HOUR", "sourceEventId", "IDENTITY", "PROPOSED"],
        ["STCK_PRPR", "price", "DECIMAL_STRING", "PROPOSED"],
        ["CNTG_VOL", "quantity", "DECIMAL_STRING", "PROPOSED"],
        ["CCLD_DVSN", "side", "KIS_CCLD_DVSN", "PROPOSED"],
        ["BSOP_DATE", null, null, "PROPOSED"],
      ],
      compositeEventTime: {
        sourceColumns: ["BSOP_DATE", "STCK_CNTG_HOUR"],
        transform: "KIS_DATE_TIME_TO_KST_ISO",
        status: "PROPOSED",
      },
      absentFields: [["actorId", "REVIEW_REQUIRED"]],
      withoutOverrides: "REVIEW_REQUIRED",
    },
  ],
  mutations: [
    { id: "repeat", expected: "PRESERVED" },
    { id: "reverse", expected: "PRESERVED" },
    { id: "duplicate", expected: "PRESERVED" },
    { id: "equivalent-time", expected: "PRESERVED" },
    { id: "late-arrival", expected: "PRESERVED" },
    { id: "source-conflict", expected: "CONFLICTING_SOURCE_IDENTITY" },
    { id: "event-id-conflict", expected: "CONFLICTING_EVENT_IDENTIFIER" },
    { id: "mixed-sequence", expected: "MIXED_SEQUENCE_PRESENCE" },
  ],
} as const;

export const limitations = [
  "Authored fixture agreement counts are not accuracy estimates or independent samples.",
  "Only the registered fixture provider runs; configured AI providers are excluded.",
  "Synthetic RAPID_PRICE_LIFT outcomes are rule regressions, not real-market performance.",
  "Canonical mutations are synthetic engine probes, not changed source facts or market observations.",
  "Published artifacts enter baseline normalization only; no real-instrument rule verdict is aggregated.",
  "Generated approvals are evaluation fixtures, not human-approved cases or publication permission.",
  "Zero findings have zero trace references and are not counted as successful trace coverage.",
  "No latency, memory, investigation-effort, generalization, or evidence-grade shares are measured.",
];
