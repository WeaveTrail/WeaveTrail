import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  publishedInstrumentListing,
  publishedReplaySources,
} from "@weavetrail/published-data";
import { resolvePublishedInstrument } from "./published-instrument-resolution";

describe("admitted published instrument and daily quote composition", () => {
  it.each(["동화약품", "000020", "KR7000020008"])(
    "links %s to the pinned stock quotation and unchanged numeric strings",
    (query) => {
      const { resolution, dailyQuotes } = resolvePublishedInstrument({
        query,
        eventDate: "2026-09-03",
      });
      expect(resolution).toMatchObject({
        status: "RESOLVED",
        candidate: { instrumentId: "KR7000020008" },
        quotes: { status: "LINKED" },
      });
      expect(dailyQuotes).toHaveLength(1);
      expect(dailyQuotes[0]!.rows[0]).toEqual(
        publishedReplaySources["real/fsc-stock-quotes-20260903.jsonl"].rows[0],
      );
      expect(dailyQuotes[0]!.rows[0]!.values).toMatchObject({
        clpr: "5200",
        trqu: "76746",
      });
    },
  );

  it("links an index to both admitted sources, retaining historical chart rows", () => {
    const { resolution, dailyQuotes } = resolvePublishedInstrument({
      query: "코스피 200",
      eventDate: "2026-09-03",
    });
    expect(resolution).toMatchObject({
      candidate: { instrumentId: "코스피 200", kind: "INDEX" },
    });
    expect(dailyQuotes).toHaveLength(2);
    expect(dailyQuotes.some((quote) => quote.rows.length > 1)).toBe(true);
    expect(
      dailyQuotes.every((quote) =>
        quote.rows.every((row) => row.values.basDt <= "20260903"),
      ),
    ).toBe(true);
  });

  it("never includes observations after the event date", () => {
    const { dailyQuotes } = resolvePublishedInstrument({
      query: "코스피 200",
      eventDate: "2026-07-01",
    });
    expect(dailyQuotes).toHaveLength(1);
    expect(dailyQuotes[0]!.rows).toHaveLength(1);
    expect(dailyQuotes[0]!.rows[0]!.values.basDt).toBe("20260701");
  });

  it("keeps names outside recorded coverage and unpublished English aliases unlinked", () => {
    expect(
      resolvePublishedInstrument({
        query: "동화약품",
        eventDate: "2026-09-04",
      }),
    ).toMatchObject({
      resolution: {
        status: "UNRESOLVED",
        reason: "NAME_NOT_VALID_ON_EVENT_DATE",
      },
      dailyQuotes: [],
    });
    expect(
      resolvePublishedInstrument({
        query: "KOSPI200",
        eventDate: "2026-09-03",
      }),
    ).toMatchObject({
      resolution: { status: "UNRESOLVED", reason: "NO_EXACT_MATCH" },
      dailyQuotes: [],
    });
  });

  it("traces every projected identifier back to a published source column", () => {
    for (const instrument of publishedInstrumentListing.instruments) {
      for (const identifier of instrument.identifiers) {
        const source = publishedInstrumentListing.sources.find(
          (source) => source.sourceId === identifier.evidence.sourceId,
        )!;
        if (source.reference.kind !== "committed")
          throw new Error("Expected committed source");
        const artifact =
          publishedReplaySources[
            source.reference.artifactId as keyof typeof publishedReplaySources
          ];
        const row = artifact.rows.find(
          (row) => row.coordinate.rowNumber === identifier.evidence.rowNumber,
        )!;
        const values: Record<string, string> = row.values;
        expect(identifier.value).toBe(values[identifier.evidence.column]);
        expect(identifier.validFrom.replaceAll("-", "")).toBe(values.basDt);
        expect(identifier.validThrough).toBe(identifier.validFrom);
      }
    }
  });

  it("retains verified original-byte hashes for every listing snapshot", () => {
    const root = fileURLToPath(
      new URL(
        "../../../../packages/published-data/src/sources/",
        import.meta.url,
      ),
    );
    for (const source of publishedInstrumentListing.sources) {
      if (source.reference.kind !== "committed")
        throw new Error("Expected committed source");
      for (const original of source.reference.originalBytes) {
        const bytes = readFileSync(
          resolve(root, dirname(source.reference.artifactId), original.path),
        );
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          original.sha256,
        );
      }
    }
  });
});
