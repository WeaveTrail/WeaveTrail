import { sha256Canonical } from "@weavetrail/canonical-kernel";
import {
  ClaimCoverageDefinitionSchema,
  ClaimCoverageRequestSchema,
  ClaimCoverageResultSchema,
  CoverageManifestSchema,
  type ClaimCoverageDefinition,
  type ClaimCoverageRequest,
  type ClaimCoverageResult,
  type CoverageManifest,
  type CoverageReasonCode,
} from "@weavetrail/contracts";

/** Scope preflight for claim checking. READY authorizes no grade or pattern run.
 * Only the supplied manifest can nominate source rows; no URL or catalog fallback.
 * See docs/adr/0052-derive-claim-resolution-scope-from-acquisitions.md. */
export function resolveClaimCoverage(
  input: ClaimCoverageRequest,
  coverage: CoverageManifest,
  definitions: readonly ClaimCoverageDefinition[] = [],
): ClaimCoverageResult {
  const request = ClaimCoverageRequestSchema.parse(input);
  const manifest = CoverageManifestSchema.parse(coverage);
  const registered = definitions.map((definition) =>
    ClaimCoverageDefinitionSchema.parse(definition),
  );
  const coverageReference = {
    schemaVersion: manifest.schemaVersion,
    derivationVersion: manifest.derivationVersion,
    sha256: sha256Canonical(manifest),
  };
  const unavailable = (reasonCode: CoverageReasonCode) =>
    ClaimCoverageResultSchema.parse({
      status: "UNCONFIRMABLE" as const,
      reasonCode,
      coverage: coverageReference,
      request,
    });
  const candidates = manifest.datasets.flatMap((dataset) => {
    if (
      !dataset.fields.includes(request.field) ||
      dataset.dateWindow.start > request.dateWindow.start ||
      dataset.dateWindow.endInclusive < request.dateWindow.endInclusive
    )
      return [];
    const observations = dataset.observations.filter(
      (observation) =>
        observation.instrumentId === request.instrumentId &&
        observation.date >= request.dateWindow.start &&
        observation.date <= request.dateWindow.endInclusive,
    );
    // The declared family/window alone cannot resolve an absent instrument/day.
    // Endpoint dates must be observed; intervening dates remain explicitly listed.
    if (
      !observations.some(({ date }) => date === request.dateWindow.start) ||
      !observations.some(({ date }) => date === request.dateWindow.endInclusive)
    )
      return [];
    return [{ dataset, observations }];
  });
  if (candidates.length === 0) return unavailable("OUTSIDE_COVERAGE");
  const precise = candidates.filter(
    ({ dataset }) => dataset.resolution === request.resolution,
  );
  if (precise.length === 0) return unavailable("RESOLUTION_TOO_COARSE");
  const bound = registered.filter(
    (definition) =>
      definition.definitionId === request.definition?.definitionId &&
      definition.version === request.definition?.version &&
      definition.field === request.field &&
      definition.resolution === request.resolution,
  );
  if (bound.length !== 1) return unavailable("DEFINITION_NOT_BOUND");
  return ClaimCoverageResultSchema.parse({
    status: "READY" as const,
    coverage: coverageReference,
    request,
    definition: bound[0]!,
    sources: precise.map(({ dataset, observations }) => ({
      datasetId: dataset.datasetId,
      source: dataset.source,
      observations,
    })),
  });
}
