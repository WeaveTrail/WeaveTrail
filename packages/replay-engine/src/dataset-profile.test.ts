import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
  concentratedBuyEvents,
} from "@weavetrail/scenarios";

import { computeDatasetProfile } from "./dataset-profile";
import {
  applyApprovedMapping,
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
} from "./source-ingest";

function artifactBytes(name: string): Buffer {
  return readFileSync(
    new URL(`../../scenarios/src/sources/${name}`, import.meta.url),
  );
}

function approvedDialectEvents(): [unknown[], unknown[]] {
  const dialectA = applyApprovedMapping(
    parseCsvSourceArtifact(
      artifactBytes("concentrated-buy-dialect-a.csv"),
      concentratedBuyDialectAMapping.sourceArtifactHash,
    ),
    concentratedBuyDialectAMapping,
  );
  const dialectB = applyApprovedMapping(
    parseJsonLinesSourceArtifact(
      artifactBytes("concentrated-buy-dialect-b.jsonl"),
      concentratedBuyDialectBMapping.sourceArtifactHash,
    ),
    concentratedBuyDialectBMapping,
  );

  if (dialectA.status !== "APPROVED" || dialectB.status !== "APPROVED") {
    throw new Error("committed dialect mappings must be approved");
  }

  return [dialectA.events, dialectB.events];
}

describe("computeDatasetProfile", () => {
  it("is deterministic under event shuffling", () => {
    const baseline = computeDatasetProfile(concentratedBuyEvents);
    const shuffled = computeDatasetProfile(
      [...concentratedBuyEvents].reverse(),
    );

    expect(shuffled).toEqual(baseline);
    expect(baseline).toMatchObject({
      instrumentIds: ["WT-DEMO"],
      actorIds: ["actor-a", "actor-b", "actor-c", "actor-d"],
      earliestEventTime: "2026-08-25T00:00:00.000000000Z",
      latestEventTime: "2026-08-25T00:00:02.000000000Z",
    });
  });

  it("is identical across the two committed source dialects", () => {
    const [dialectAEvents, dialectBEvents] = approvedDialectEvents();

    expect(computeDatasetProfile(dialectAEvents)).toEqual(
      computeDatasetProfile(dialectBEvents),
    );
  });
});
