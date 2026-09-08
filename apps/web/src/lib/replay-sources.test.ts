import { describe, expect, it } from "vitest";

import {
  committedReplaySources,
  replaySourceCatalog,
  reviewerFacingReplaySources,
} from "./replay-sources";

function declaredResult(source: object) {
  return "expectedResult" in source ? source.expectedResult : undefined;
}

describe("replay source audiences", () => {
  it("includes every grounded source and only justified regression fallbacks", () => {
    for (const [name, metadata] of Object.entries(replaySourceCatalog)) {
      if (metadata.purpose === "REVIEWER_FACING")
        expect(reviewerFacingReplaySources).toHaveProperty(name);
    }
    for (const name of Object.keys(reviewerFacingReplaySources)) {
      const metadata =
        replaySourceCatalog[name as keyof typeof replaySourceCatalog];
      expect(metadata.availableInCaseReplay).toBe(true);
    }
  });

  it("keeps every declared result meaning reachable from the reviewer list", () => {
    const allResults = new Set(
      Object.values(committedReplaySources)
        .map(declaredResult)
        .filter((result) => result !== undefined),
    );
    const reviewerResults = new Set(
      Object.values(reviewerFacingReplaySources)
        .map(declaredResult)
        .filter((result) => result !== undefined),
    );

    expect(allResults).toEqual(
      new Set(["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"]),
    );
    expect(reviewerResults).toEqual(allResults);
  });

  it("removes a placeholder once a grounded source reproduces its result meaning", () => {
    const groundedResults = new Set(
      Object.entries(committedReplaySources)
        .filter(
          ([name]) =>
            replaySourceCatalog[name as keyof typeof replaySourceCatalog]
              .purpose === "REVIEWER_FACING",
        )
        .map(([, source]) => declaredResult(source))
        .filter((result) => result !== undefined),
    );
    const surfacedPlaceholders = Object.entries(reviewerFacingReplaySources)
      .filter(
        ([name]) =>
          replaySourceCatalog[name as keyof typeof replaySourceCatalog]
            .purpose === "ENGINE_REGRESSION",
      )
      .map(([, source]) => declaredResult(source))
      .filter((result) => result !== undefined);

    expect(groundedResults).toEqual(new Set(["SUPPORTED"]));
    expect(surfacedPlaceholders).toEqual(["NOT_SUPPORTED", "INCONCLUSIVE"]);
    for (const result of surfacedPlaceholders)
      expect(groundedResults.has(result)).toBe(false);
  });

  it("offers only non-fabricating controls for licensed published sources", () => {
    for (const [name, source] of Object.entries(reviewerFacingReplaySources)) {
      if (source.provenance.kind !== "real") continue;
      expect(
        replaySourceCatalog[name as keyof typeof replaySourceCatalog]
          .availableMutations,
      ).toEqual(["baseline", "shuffle"]);
      expect(source).not.toHaveProperty("manifest");
      expect(source).not.toHaveProperty("expectedResult");
    }
  });
});
