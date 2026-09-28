import { resolveInstrument } from "@weavetrail/instrument-resolver";
import {
  publishedDailyQuoteBindings,
  publishedInstrumentListing,
  publishedReplaySources,
} from "@weavetrail/published-data";
import type { InstrumentResolutionRequest } from "@weavetrail/contracts/instrument-resolution";

/** Application composition: pass pinned artifacts into the pure resolver.
 * Quotation values remain publisher strings; no verdict or calculation runs. */
export function resolvePublishedInstrument(
  request: InstrumentResolutionRequest,
) {
  const resolution = resolveInstrument(
    request,
    publishedInstrumentListing,
    publishedDailyQuoteBindings,
  );
  if (
    resolution.status !== "RESOLVED" ||
    resolution.quotes.status !== "LINKED"
  ) {
    return { resolution, dailyQuotes: [] };
  }
  const dailyQuotes = resolution.quotes.links.map((link) => {
    if (link.source.reference.kind !== "committed")
      throw new Error("Expected a pinned committed quotation");
    const key = link.source.reference
      .artifactId as keyof typeof publishedReplaySources;
    const artifact = publishedReplaySources[key];
    if (
      !artifact ||
      artifact.sourceArtifactHash !== link.source.reference.sha256
    )
      throw new Error("Quotation artifact pin mismatch");
    const rows = artifact.rows.filter((row) => {
      const values: Record<string, string> = row.values;
      const date = `${values.basDt!.slice(0, 4)}-${values.basDt!.slice(4, 6)}-${values.basDt!.slice(6, 8)}`;
      return (
        (values.isinCd ?? values.idxNm) === link.instrumentId &&
        date <= resolution.eventDate
      );
    });
    return { datasetId: link.datasetId, source: link.source, rows };
  });
  return { resolution, dailyQuotes };
}
