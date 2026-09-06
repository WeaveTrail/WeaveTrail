import type { TradeEvent } from "@weavetrail/contracts";

type OhlcEvent = Extract<TradeEvent, { schemaVersion: "1.3" }>;

function event(
  id: string,
  tradingDate: string,
  instrumentId: string,
  values: {
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    netChange: string;
  },
): OhlcEvent {
  return {
    schemaVersion: "1.3",
    eventId: `event:synthetic-cross-market-v1:SYNTH:${id}`,
    sourceEventId: id,
    datasetId: "synthetic-cross-market-v1",
    venueId: "SYNTH",
    eventTime: `${tradingDate}T00:00:00Z`,
    tradingDate,
    instrumentId,
    eventType: "DAILY_QUOTE",
    ...values,
    rawRowHash: id.length.toString(16).padStart(64, "0"),
  };
}

const baseline = [
  event("primary-2026-08-31", "2026-08-31", "SYNTH-PRIMARY", {
    openPrice: "100",
    highPrice: "103",
    lowPrice: "98",
    closePrice: "102",
    netChange: "2",
  }),
  event("primary-2026-09-01", "2026-09-01", "SYNTH-PRIMARY", {
    openPrice: "102",
    highPrice: "104",
    lowPrice: "99",
    closePrice: "100",
    netChange: "-1",
  }),
];

const supportedDate = [
  event("primary-2026-09-02", "2026-09-02", "SYNTH-PRIMARY", {
    openPrice: "105",
    highPrice: "110",
    lowPrice: "95",
    closePrice: "100",
    netChange: "1",
  }),
  event("confirming-2026-09-02", "2026-09-02", "SYNTH-CONFIRMING", {
    openPrice: "205",
    highPrice: "210",
    lowPrice: "190",
    closePrice: "200",
    netChange: "1",
  }),
];

export const crossMarketSessionReversalSpecimens = {
  supported: {
    expectedResult: "SUPPORTED",
    events: [...baseline, ...supportedDate],
  },
  notSupported: {
    expectedResult: "NOT_SUPPORTED",
    events: [
      ...baseline,
      supportedDate[0]!,
      event("confirming-aligned-2026-09-02", "2026-09-02", "SYNTH-CONFIRMING", {
        openPrice: "195",
        highPrice: "202",
        lowPrice: "190",
        closePrice: "200",
        netChange: "1",
      }),
    ],
  },
  inconclusive: {
    expectedResult: "INCONCLUSIVE",
    events: [
      ...baseline,
      supportedDate[0]!,
      event("confirming-flat-2026-09-02", "2026-09-02", "SYNTH-CONFIRMING", {
        openPrice: "200",
        highPrice: "205",
        lowPrice: "195",
        closePrice: "200",
        netChange: "0",
      }),
    ],
  },
} as const;
