import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { rapidPriceLiftScenarios } from "@weavetrail/scenarios";

import { caseManifestProposal } from "./approval-validation";
import { sha256Canonical } from "./canonical-json";
import { computeDatasetProfile } from "./dataset-profile";
import { replayRapidPriceLift } from "./rapid-price-lift";
import { applyApprovedMapping, approvedSourceMapping } from "./source-ingest";

function scenarioEvents(name: keyof typeof rapidPriceLiftScenarios) {
  const scenario = rapidPriceLiftScenarios[name];
  const application = applyApprovedMapping(
    scenario.rows,
    approvedSourceMapping(scenario.mappingProposal),
  );
  if (application.status !== "APPROVED") {
    throw new Error(`Committed scenario mapping failed: ${name}`);
  }
  return { scenario, events: application.events };
}

describe("rapid price lift declared scenario goldens", () => {
  function expectGolden(
    name: keyof typeof rapidPriceLiftScenarios,
    expectedResult: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE",
    expectedHash: string,
  ) {
    const { scenario, events } = scenarioEvents(name);
    const replay = replayRapidPriceLift(events, scenario.manifest);

    expect(replay.evaluation.result).toBe(expectedResult);
    expect(replay.canonicalResultHash).toBe(expectedHash);
    expect(computeDatasetProfile(events).canonicalDatasetHash).toBe(
      scenario.manifest.canonicalDatasetHash,
    );
    expect(sha256Canonical(caseManifestProposal(scenario.manifest))).toBe(
      scenario.manifest.approval.approvedArtifactHash,
    );
  }

  it("pins rapid-price-lift-supported.csv to SUPPORTED", () => {
    expectGolden(
      "rapid-price-lift-supported.csv",
      "SUPPORTED",
      "5fe3b76bfd23ac2f26cb3537ba1405ad465931a84a0a9dc2c2747198eaf984c9",
    );
  });

  it("pins rapid-price-lift-broad-participation.csv to NOT_SUPPORTED", () => {
    expectGolden(
      "rapid-price-lift-broad-participation.csv",
      "NOT_SUPPORTED",
      "748bf513bc5acd1565ec419f1e8b6356945677b24243245155b28291a43fdc71",
    );
  });

  it("pins rapid-price-lift-insufficient-evidence.csv to INCONCLUSIVE", () => {
    expectGolden(
      "rapid-price-lift-insufficient-evidence.csv",
      "INCONCLUSIVE",
      "da33eb868e6852e665284ff79046bec730e4d77b53f5316040c770150deb57df",
    );
  });

  it.each([
    "rapid-price-lift-supported.csv",
    "rapid-price-lift-broad-participation.csv",
  ] as const)("keeps %s invariant across declared orders", (name) => {
    const { scenario, events } = scenarioEvents(name);
    const baseline = replayRapidPriceLift(events, scenario.manifest);
    const declaredOrders = [
      [...events].reverse(),
      [events[2]!, events[0]!, events[4]!, events[1]!, events[5]!, events[3]!],
      [events[5]!, events[3]!, events[1]!, events[4]!, events[0]!, events[2]!],
    ];

    for (const declaredOrder of declaredOrders) {
      const replay = replayRapidPriceLift(declaredOrder, scenario.manifest);
      expect(replay.evaluation).toEqual(baseline.evaluation);
      expect(replay.canonicalResultHash).toBe(baseline.canonicalResultHash);
    }
  });

  it("tolerates an exact duplicate without changing the rule result", () => {
    const { scenario, events } = scenarioEvents(
      "rapid-price-lift-supported.csv",
    );
    const baseline = replayRapidPriceLift(events, scenario.manifest);
    const duplicate = replayRapidPriceLift(
      [...events, events[2]!],
      scenario.manifest,
    );

    expect(duplicate.duplicateCount).toBe(1);
    expect(duplicate.evaluation).toEqual(baseline.evaluation);
    expect(duplicate.canonicalResultHash).toBe(baseline.canonicalResultHash);
  });

  it("resolves every finding reference to a canonical event", () => {
    const { scenario, events } = scenarioEvents(
      "rapid-price-lift-supported.csv",
    );
    const replay = replayRapidPriceLift(events, scenario.manifest);
    const canonicalEventIds = new Set(
      replay.events.map(({ eventId }) => eventId),
    );

    for (const finding of replay.evaluation.findings) {
      expect(finding.referencedEventIds.length).toBeGreaterThan(0);
      expect(
        finding.referencedEventIds.every((eventId) =>
          canonicalEventIds.has(eventId),
        ),
      ).toBe(true);
    }
  });

  it("keeps sensitivity outside the canonical dataset hash", () => {
    const { scenario, events } = scenarioEvents(
      "rapid-price-lift-supported.csv",
    );
    const datasetHash = computeDatasetProfile(events).canonicalDatasetHash;
    const replay = replayRapidPriceLift(events, scenario.manifest);

    expect(replay.evaluation.sensitivity).not.toBeNull();
    expect(replay.evaluation.sensitivity?.removalSensitivityBps).not.toBe(
      replay.evaluation.sensitivity?.priceChangeBps,
    );
    expect(computeDatasetProfile(replay.events).canonicalDatasetHash).toBe(
      datasetHash,
    );
  });

  it("statically excludes JavaScript number coercion from price and quantity arithmetic", () => {
    const sourceDirectory = new URL(".", import.meta.url);
    const sources = readdirSync(sourceDirectory)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => readFileSync(new URL(name, sourceDirectory), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(
      /(?:Number|parseFloat|parseInt)\([^)]*(?:price|quantity)/,
    );
    expect(sources).not.toMatch(
      /(?:price|quantity)[^\n;]*(?:\.toFixed|Math\.)/,
    );
  });
});
