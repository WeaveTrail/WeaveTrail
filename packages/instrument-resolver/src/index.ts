import {
  DailyQuoteBindingSchema,
  InstrumentListingSchema,
  InstrumentResolutionRequestSchema,
  InstrumentResolutionSchema,
  type DailyQuoteBinding,
  type InstrumentListing,
  type InstrumentResolution,
  type InstrumentResolutionRequest,
} from "@weavetrail/contracts/instrument-resolution";
import { canonicalJson } from "@weavetrail/canonical-kernel/canonical-json";
import { sha256Canonical } from "@weavetrail/canonical-kernel/canonical-hash";

export const INSTRUMENT_RESOLVER_VERSION = "exact-dated-identifiers-v1";

// Preserve punctuation, internal spaces, leading zeroes and share-class suffixes.
// Only canonical Unicode spelling, outer whitespace and ASCII letter case vary.
export function normalizeInstrumentName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/[a-z]/g, (letter) => letter.toUpperCase());
}

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const compareJson = (
  left: Parameters<typeof canonicalJson>[0],
  right: Parameters<typeof canonicalJson>[0],
) => compareText(canonicalJson(left), canonicalJson(right));

/** Caller supplies admitted, re-hashed sources. No network, storage or model lookup. */
export function resolveInstrument(
  request: InstrumentResolutionRequest,
  listing: InstrumentListing,
  quoteBindings: readonly DailyQuoteBinding[],
): InstrumentResolution {
  const input = InstrumentResolutionRequestSchema.parse(request);
  const validated = InstrumentListingSchema.parse(listing);
  const bindings = quoteBindings.map((binding) =>
    DailyQuoteBindingSchema.parse(binding),
  );
  const sourcesById = new Map(
    validated.sources.map((source) => [source.sourceId, canonicalJson(source)]),
  );
  const bindingIds = new Set<string>();
  for (const binding of bindings) {
    const identity = canonicalJson([binding.datasetId, binding.instrumentId]);
    if (bindingIds.has(identity)) {
      throw new Error(
        "Duplicate daily-quote binding; combine dates explicitly",
      );
    }
    bindingIds.add(identity);
    const source = canonicalJson(binding.source);
    const previous = sourcesById.get(binding.source.sourceId);
    if (previous !== undefined && previous !== source) {
      throw new Error("Conflicting metadata for the same source identity");
    }
    sourcesById.set(binding.source.sourceId, source);
  }
  const orderedListing = {
    ...validated,
    sources: [...validated.sources].sort((left, right) =>
      compareText(left.sourceId, right.sourceId),
    ),
    instruments: validated.instruments
      .map((instrument) => ({
        ...instrument,
        identifiers: [...instrument.identifiers].sort(compareJson),
      }))
      .sort((left, right) =>
        compareText(left.instrumentId, right.instrumentId),
      ),
  };
  const base = {
    ...input,
    schemaVersion: "1.0" as const,
    resolverVersion: INSTRUMENT_RESOLVER_VERSION,
    listing: {
      listingId: orderedListing.listingId,
      sha256: sha256Canonical({
        schemaVersion: orderedListing.schemaVersion,
        listingId: orderedListing.listingId,
        sources: orderedListing.sources.map(({ sourceId, reference }) => ({
          sourceId,
          reference,
        })),
        instruments: orderedListing.instruments,
      }),
      sources: orderedListing.sources,
    },
  };
  const query = normalizeInstrumentName(input.query);
  let foundOutsideDate = false;
  const candidates = orderedListing.instruments.flatMap((instrument) => {
    const exact = instrument.identifiers.filter(
      (identifier) => normalizeInstrumentName(identifier.value) === query,
    );
    if (exact.length) foundOutsideDate = true;
    const reasons = exact.filter(
      ({ validFrom, validThrough }) =>
        validFrom <= input.eventDate && input.eventDate <= validThrough,
    );
    return reasons.length
      ? [
          {
            instrumentId: instrument.instrumentId,
            kind: instrument.kind,
            reasons,
          },
        ]
      : [];
  });
  if (candidates.length === 0) {
    return InstrumentResolutionSchema.parse({
      ...base,
      status: "UNRESOLVED",
      reason: foundOutsideDate
        ? "NAME_NOT_VALID_ON_EVENT_DATE"
        : "NO_EXACT_MATCH",
    });
  }
  if (candidates.length > 1) {
    return InstrumentResolutionSchema.parse({
      ...base,
      status: "REVIEW_REQUIRED",
      reason: "AMBIGUOUS_NAME",
      candidates,
    });
  }
  const candidate = candidates[0]!;
  const links = bindings
    .filter(
      (binding) =>
        binding.instrumentId === candidate.instrumentId &&
        binding.availableDates.includes(input.eventDate),
    )
    .map((binding) => ({
      ...binding,
      availableDates: [...binding.availableDates].sort(compareText),
    }))
    .sort(compareJson);
  return InstrumentResolutionSchema.parse({
    ...base,
    status: "RESOLVED",
    candidate,
    quotes: links.length
      ? { status: "LINKED", links }
      : { status: "UNAVAILABLE", reason: "NO_ADMITTED_QUOTES_ON_EVENT_DATE" },
  });
}
