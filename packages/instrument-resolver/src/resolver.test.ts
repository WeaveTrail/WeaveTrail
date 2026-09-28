import { describe, expect, it, vi } from "vitest";
import {
  InstrumentResolutionSchema,
  type DailyQuoteBinding,
  type InstrumentIdentifier,
  type InstrumentListing,
  type ListingSource,
} from "@weavetrail/contracts/instrument-resolution";
import { resolveInstrument } from "./index";

// Entirely synthetic listing, English names, rename history and quote coverage.
const source: ListingSource = {
  sourceId: "synthetic-listing-v1",
  reference: {
    kind: "committed",
    artifactId: "synthetic/listing.json",
    sha256: "a".repeat(64),
    originalBytes: [{ path: "listing.json", sha256: "a".repeat(64) }],
  },
  provenanceRecordUrl: "https://example.org/synthetic/provenance",
  source: {
    originUrl: "https://example.org/synthetic/listing",
    publisher: "WeaveTrail synthetic fixture",
    collectorVersion: "synthetic-fixture-v1",
    licence: {
      label: "Apache-2.0 (synthetic fixture)",
      termsUrl: "https://example.org/synthetic/licence",
      checkedAt: "2026-09-01T00:00:00Z",
      attributionRequirements: "Synthetic fixture; retain attribution",
      attribution: "WeaveTrail synthetic fixture",
      permitsStorage: true,
      permitsModification: true,
      permitsRedistribution: true,
    },
  },
  retrievedAt: "2026-09-02T00:00:00Z",
};

const identifier = (
  kind: InstrumentIdentifier["kind"],
  value: string,
  validFrom = "2026-01-01",
  validThrough = "2026-12-31",
): InstrumentIdentifier => ({
  kind,
  value,
  validFrom,
  validThrough,
  evidence: { sourceId: source.sourceId, rowNumber: "1", column: kind },
});
const listing: InstrumentListing = {
  schemaVersion: "1.0",
  listingId: "synthetic-listing-v1",
  sources: [source],
  instruments: [
    {
      instrumentId: "WT-ALPHA",
      kind: "INSTRUMENT",
      identifiers: [
        identifier("SHORT_CODE", "001234"),
        identifier("ISIN", "KR7001234000"),
        identifier("FORMER_NAME", "예전알파", "2026-01-01", "2026-06-30"),
        identifier("KOREAN_NAME", "새알파", "2026-07-01"),
        identifier("ENGLISH_NAME", "New Alpha", "2026-07-01"),
        identifier("ABBREVIATION", "NA", "2026-07-01"),
        identifier("ABBREVIATION", "공통"),
      ],
    },
    {
      instrumentId: "WT-INDEX",
      kind: "INDEX",
      identifiers: [
        identifier("ENGLISH_NAME", "Weave 200"),
        identifier("ABBREVIATION", "W200"),
        identifier("ABBREVIATION", "공통"),
      ],
    },
  ],
};
const bindings: DailyQuoteBinding[] = [
  {
    datasetId: "synthetic-quotes-v1",
    instrumentId: "WT-ALPHA",
    source,
    availableDates: ["2026-06-30", "2026-07-01", "2026-09-03"],
  },
];
const resolve = (
  query: string,
  eventDate = "2026-09-03",
  input = listing,
  quotes = bindings,
) => resolveInstrument({ query, eventDate }, input, quotes);

describe("exact, dated instrument resolution", () => {
  it.each([
    ["새알파", "KOREAN_NAME"],
    [" new alpha ", "ENGLISH_NAME"],
    ["na", "ABBREVIATION"],
    ["001234", "SHORT_CODE"],
    ["kr7001234000", "ISIN"],
  ])("resolves %s and retains the matching evidence", (query, kind) => {
    const result = resolve(query);
    expect(result.status).toBe("RESOLVED");
    if (result.status !== "RESOLVED") throw new Error("Expected resolved");
    expect(result.candidate.instrumentId).toBe("WT-ALPHA");
    expect(result.candidate.reasons.map((reason) => reason.kind)).toEqual([
      kind,
    ]);
    expect(result.candidate.reasons[0]!.evidence.sourceId).toBe(
      source.sourceId,
    );
    expect(result.quotes.status).toBe("LINKED");
    expect(InstrumentResolutionSchema.parse(result)).toEqual(result);
  });

  it("uses both sides of a rename boundary without treating a former name as timeless", () => {
    expect(resolve("예전알파", "2026-06-30").status).toBe("RESOLVED");
    expect(resolve("새알파", "2026-07-01").status).toBe("RESOLVED");
    expect(resolve("예전알파", "2026-07-01")).toMatchObject({
      status: "UNRESOLVED",
      reason: "NAME_NOT_VALID_ON_EVENT_DATE",
    });
    expect(resolve("새알파", "2026-06-30")).toMatchObject({
      status: "UNRESOLVED",
      reason: "NAME_NOT_VALID_ON_EVENT_DATE",
    });
  });

  it("resolves a reused code to its date-specific instrument", () => {
    const input = structuredClone(listing);
    input.instruments[0]!.identifiers = [
      identifier("SHORT_CODE", "001234", "2026-01-01", "2026-06-30"),
    ];
    input.instruments[1]!.identifiers = [
      identifier("SHORT_CODE", "001234", "2026-07-01"),
    ];
    expect(resolve("001234", "2026-06-30", input)).toMatchObject({
      candidate: { instrumentId: "WT-ALPHA" },
    });
    expect(resolve("001234", "2026-07-01", input)).toMatchObject({
      candidate: { instrumentId: "WT-INDEX" },
    });
  });

  it("returns every ambiguous candidate and its reason without quotation links", () => {
    const result = resolve("공통");
    expect(result.status).toBe("REVIEW_REQUIRED");
    if (result.status !== "REVIEW_REQUIRED")
      throw new Error("Expected ambiguity");
    expect(result.candidates.map(({ instrumentId }) => instrumentId)).toEqual([
      "WT-ALPHA",
      "WT-INDEX",
    ]);
    expect(
      result.candidates.every(
        ({ reasons }) => reasons[0]!.kind === "ABBREVIATION",
      ),
    ).toBe(true);
    expect(result).not.toHaveProperty("quotes");
  });

  it("does not prefer a code over another instrument's equal name", () => {
    const input = structuredClone(listing);
    input.instruments[1]!.identifiers.push(identifier("KOREAN_NAME", "001234"));
    expect(resolve("001234", "2026-09-03", input).status).toBe(
      "REVIEW_REQUIRED",
    );
  });

  it.each([
    "New Alpa",
    "NewAlpha",
    "New Alpha ordinary",
    "1234",
    "00123",
    "새알",
    "Ｗ２００",
  ])(
    "keeps %s unlinked rather than matching by similarity or stripping identity",
    (query) => {
      expect(resolve(query)).toMatchObject({
        status: "UNRESOLVED",
        reason: "NO_EXACT_MATCH",
      });
      expect(resolve(query)).not.toHaveProperty("quotes");
    },
  );

  it("normalizes canonical Unicode without dropping Korean name distinctions", () => {
    expect(resolve("새알파".normalize("NFD")).status).toBe("RESOLVED");
    expect(resolve("새 알파").status).toBe("UNRESOLVED");
  });

  it("reports unavailable daily quotes separately from an exact identity", () => {
    expect(resolve("W200")).toMatchObject({
      status: "RESOLVED",
      candidate: { kind: "INDEX" },
      quotes: {
        status: "UNAVAILABLE",
        reason: "NO_ADMITTED_QUOTES_ON_EVENT_DATE",
      },
    });
    expect(resolve("NA", "2026-09-04")).toMatchObject({
      status: "RESOLVED",
      quotes: { status: "UNAVAILABLE" },
    });
  });

  it("pins the listing and each quote source, including original-byte hashes", () => {
    const result = resolve("001234");
    expect(result.listing.sources[0]!.reference).toEqual(source.reference);
    expect(result).toMatchObject({ quotes: { links: [{ source }] } });
    const input = structuredClone(listing);
    input.instruments[0]!.identifiers[0]!.validThrough = "2026-10-01";
    expect(resolve("001234", "2026-09-03", input).listing.sha256).not.toBe(
      result.listing.sha256,
    );
    const changedSource = structuredClone(listing);
    if (changedSource.sources[0]!.reference.kind !== "committed")
      throw new Error("Expected committed");
    changedSource.sources[0]!.reference.originalBytes[0]!.sha256 = "b".repeat(
      64,
    );
    expect(
      resolve("001234", "2026-09-03", changedSource, []).listing.sha256,
    ).not.toBe(result.listing.sha256);
  });

  it("preserves service snapshot references without opening a store or fetching", () => {
    const input = structuredClone(listing);
    input.sources[0]!.reference = {
      kind: "service",
      snapshotId: "b".repeat(64),
      sha256: "c".repeat(64),
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Must not fetch"));
    try {
      expect(
        resolve("NA", "2026-09-03", input, []).listing.sources[0]!.reference,
      ).toEqual(input.sources[0]!.reference);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("excludes acquisition timestamps from the canonical listing fingerprint", () => {
    const input = structuredClone(listing);
    input.sources[0]!.retrievedAt = "2026-09-04T00:00:00Z";
    input.sources[0]!.source.licence.checkedAt = "2026-09-03T00:00:00Z";
    expect(resolve("NA", "2026-09-03", input, []).listing.sha256).toBe(
      resolve("NA").listing.sha256,
    );
  });

  it("rejects duplicate quote bindings and conflicting source pins", () => {
    expect(() =>
      resolve("NA", "2026-09-03", listing, [...bindings, bindings[0]!]),
    ).toThrow("Duplicate daily-quote binding");
    const conflict = structuredClone(bindings);
    if (conflict[0]!.source.reference.kind !== "committed")
      throw new Error("Expected committed");
    conflict[0]!.source.reference.sha256 = "b".repeat(64);
    expect(() => resolve("NA", "2026-09-03", listing, conflict)).toThrow(
      "Conflicting metadata",
    );
  });

  it("is stable under listing and quote order changes and leaves caller inputs intact", () => {
    const original = structuredClone({ listing, bindings });
    const shuffled = structuredClone(listing);
    shuffled.sources.reverse();
    shuffled.instruments
      .reverse()
      .forEach((instrument) => instrument.identifiers.reverse());
    const shuffledBindings = structuredClone(bindings);
    shuffledBindings
      .reverse()
      .forEach((binding) => binding.availableDates.reverse());
    expect(resolve("NA", "2026-09-03", shuffled, shuffledBindings)).toEqual(
      resolve("NA"),
    );
    expect(resolve("공통", "2026-09-03", shuffled)).toEqual(resolve("공통"));
    expect({ listing, bindings }).toEqual(original);
  });

  it.each([
    [
      "duplicate instrument",
      (input: InstrumentListing) =>
        input.instruments.push(input.instruments[0]!),
    ],
    [
      "duplicate source",
      (input: InstrumentListing) => input.sources.push(input.sources[0]!),
    ],
    [
      "unknown evidence source",
      (input: InstrumentListing) => {
        input.instruments[0]!.identifiers[0]!.evidence.sourceId = "unknown";
      },
    ],
    [
      "reversed dates",
      (input: InstrumentListing) => {
        input.instruments[0]!.identifiers[0]!.validThrough = "2025-12-31";
      },
    ],
    [
      "invalid ISIN",
      (input: InstrumentListing) => {
        input.instruments[0]!.identifiers[1]!.value = "1234";
      },
    ],
    [
      "unreviewed redistribution",
      (input: InstrumentListing) => {
        Object.assign(input.sources[0]!.source.licence, {
          permitsRedistribution: false,
        });
      },
    ],
    [
      "permission reviewed after retrieval",
      (input: InstrumentListing) => {
        input.sources[0]!.source.licence.checkedAt = "2026-09-03T00:00:00Z";
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    const input = structuredClone(listing);
    mutate(input);
    expect(() => resolve("NA", "2026-09-03", input)).toThrow();
  });

  it.each(["", " ", "a".repeat(257)])("rejects an invalid query", (query) => {
    expect(() => resolve(query)).toThrow();
  });

  it.each(["2026-02-30", "20260903", "2026-09-03T00:00:00Z"])(
    "rejects invalid event date %s",
    (eventDate) => {
      expect(() => resolve("NA", eventDate)).toThrow();
    },
  );
});
