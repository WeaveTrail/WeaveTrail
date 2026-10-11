import { describe, expect, it } from "vitest";
import { syntheticCoverageManifest } from "./testing/coverage";
import type {
  ClaimCoverageRequest,
  CoverageManifest,
} from "@weavetrail/contracts";
import { resolveClaimCoverage } from "./claim-coverage";

// Generated definition fixture only; this is neither an approved case nor evidence.
const definition = {
  definitionId: "synthetic-close",
  version: "1.0.0",
  field: "close",
  resolution: "DAILY" as const,
};
const request: ClaimCoverageRequest = {
  instrumentId: "SYNTH-INDEX",
  dateWindow: { start: "2024-02-29", endInclusive: "2024-02-29" },
  field: "close",
  resolution: "DAILY",
  definition: {
    definitionId: definition.definitionId,
    version: definition.version,
  },
};

function onlyBaseline(): CoverageManifest {
  const manifest = structuredClone(syntheticCoverageManifest);
  manifest.datasets = manifest.datasets.filter(
    (dataset) => dataset.instrumentFamily.kind === "index",
  );
  manifest.asOf = manifest.datasets[0]!.source.retrievedAt;
  return manifest;
}

describe("manifest-only claim resolution", () => {
  it.each([
    { instrumentId: "SYNTHETIC-OUTSIDE-INSTRUMENT" },
    { dateWindow: { start: "2024-03-01", endInclusive: "2024-03-01" } },
    { field: "actorId" },
    { dateWindow: { start: "2024-02-27", endInclusive: "2024-02-27" } },
  ])(
    "reports OUTSIDE_COVERAGE for missing instruments, dates, fields and unobserved days: %j",
    (change) => {
      expect(
        resolveClaimCoverage(
          { ...request, ...change },
          syntheticCoverageManifest,
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
        syntheticCoverageManifest,
      ),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "RESOLUTION_TOO_COARSE",
    });
    expect(
      resolveClaimCoverage(request, syntheticCoverageManifest),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "DEFINITION_NOT_BOUND",
    });
    expect(
      resolveClaimCoverage(
        { ...request, instrumentId: "OUTSIDE", resolution: "INTRADAY" },
        syntheticCoverageManifest,
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
        resolveClaimCoverage(request, syntheticCoverageManifest, definitions),
      ).toMatchObject({
        status: "UNCONFIRMABLE",
        reasonCode: "DEFINITION_NOT_BOUND",
      });
    const { definition: _, ...withoutDefinition } = request;
    void _;
    expect(
      resolveClaimCoverage(withoutDefinition, syntheticCoverageManifest, [
        definition,
      ]),
    ).toMatchObject({
      status: "UNCONFIRMABLE",
      reasonCode: "DEFINITION_NOT_BOUND",
    });
  });

  it("never falls back to the catalog when supplied coverage omits an otherwise supplied observation", () => {
    const manifest = onlyBaseline();
    manifest.datasets[0]!.observations =
      manifest.datasets[0]!.observations.filter(
        ({ date }) => date !== "2024-02-29",
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
        ({ date }) => date === "2024-02-29",
      ),
    ]);
    expect(result.sources[0]!.source.reference).toEqual(
      manifest.datasets[0]!.source.reference,
    );
    expect(result).not.toHaveProperty("grade");
    expect(result).not.toHaveProperty("computedValue");
  });
});
