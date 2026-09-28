import { describe, expect, it } from "vitest";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import type {
  ClaimCoverageRequest,
  CoverageManifest,
} from "@weavetrail/contracts";
import { resolveClaimCoverage } from "./claim-coverage";

// Generated definition fixture only; this is neither an approved case nor evidence.
const definition = {
  definitionId: "synthetic-close",
  version: "1.0.0",
  field: "clpr",
  resolution: "DAILY" as const,
};
const request: ClaimCoverageRequest = {
  instrumentId: "코스피 200",
  dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
  field: "clpr",
  resolution: "DAILY",
  definition: {
    definitionId: definition.definitionId,
    version: definition.version,
  },
};

function onlyBaseline(): CoverageManifest {
  const manifest = structuredClone(publishedCoverageManifest);
  manifest.datasets = manifest.datasets.filter(
    (dataset) => dataset.instrumentFamily.kind === "index",
  );
  manifest.asOf = manifest.datasets[0]!.source.retrievedAt;
  return manifest;
}

describe("manifest-only claim resolution", () => {
  it.each([
    { instrumentId: "SYNTHETIC-OUTSIDE-INSTRUMENT" },
    { dateWindow: { start: "2026-09-04", endInclusive: "2026-09-04" } },
    { field: "actorId" },
    { dateWindow: { start: "2026-07-04", endInclusive: "2026-07-04" } },
  ])(
    "reports OUTSIDE_COVERAGE for missing instruments, dates, fields and unobserved days: %j",
    (change) => {
      expect(
        resolveClaimCoverage(
          { ...request, ...change },
          publishedCoverageManifest,
          [definition],
        ),
      ).toMatchObject({
        status: "UNCONFIRMABLE",
        reasonCode: "OUTSIDE_COVERAGE",
      });
    },
  );

  it("distinguishes intraday requests from missing definitions with stable precedence", () => {
    expect(
      resolveClaimCoverage(
        { ...request, resolution: "INTRADAY" },
        publishedCoverageManifest,
      ),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "RESOLUTION_TOO_COARSE",
    });
    expect(
      resolveClaimCoverage(request, publishedCoverageManifest),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "DEFINITION_NOT_BOUND",
    });
    expect(
      resolveClaimCoverage(
        { ...request, instrumentId: "OUTSIDE", resolution: "INTRADAY" },
        publishedCoverageManifest,
      ),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "OUTSIDE_COVERAGE",
    });
  });

  it("requires an exact, unique code-owned definition binding", () => {
    for (const definitions of [
      [{ ...definition, version: "2.0.0" }],
      [{ ...definition, field: "mkp" }],
      [{ ...definition, resolution: "INTRADAY" as const }],
      [definition, definition],
    ])
      expect(
        resolveClaimCoverage(request, publishedCoverageManifest, definitions),
      ).toMatchObject({
        status: "UNCONFIRMABLE",
        reasonCode: "DEFINITION_NOT_BOUND",
      });
    const { definition: _, ...withoutDefinition } = request;
    void _;
    expect(
      resolveClaimCoverage(withoutDefinition, publishedCoverageManifest, [
        definition,
      ]),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "DEFINITION_NOT_BOUND",
    });
  });

  it("never falls back to the catalog when supplied coverage omits an otherwise admitted observation", () => {
    const manifest = onlyBaseline();
    manifest.datasets[0]!.observations =
      manifest.datasets[0]!.observations.filter(
        ({ date }) => date !== "2026-09-03",
      );
    expect(resolveClaimCoverage(request, manifest, [definition])).toMatchObject(
      { status: "UNCONFIRMABLE", reasonCode: "OUTSIDE_COVERAGE" },
    );
  });

  it("returns only pinned matching rows and is deterministic without mutating the supplied manifest", () => {
    const manifest = onlyBaseline();
    const before = structuredClone(manifest);
    const result = resolveClaimCoverage(request, manifest, [definition]);
    expect(result).toEqual(
      resolveClaimCoverage(request, manifest, [definition]),
    );
    expect(manifest).toEqual(before);
    expect(result.status).toBe("READY");
    if (result.status !== "READY")
      throw new Error("Expected coverage readiness");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.observations).toEqual([
      manifest.datasets[0]!.observations.find(
        ({ date }) => date === "2026-09-03",
      ),
    ]);
    expect(result.sources[0]!.source.reference).toEqual(
      manifest.datasets[0]!.source.reference,
    );
    expect(result).not.toHaveProperty("grade");
    expect(result).not.toHaveProperty("computedValue");
  });
});
