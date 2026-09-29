import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RapidPriceLiftResultSchema } from "@weavetrail/contracts";
import {
  publishedExecutionBroadManifest,
  publishedExecutionBroadProposal,
  publishedExecutionBroadRows,
  publishedExecutionBroadScenario,
} from "@weavetrail/scenarios";

import {
  caseManifestProposal,
  mappingApprovalArtifact,
  replayApproved,
} from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import { computeDatasetProfile } from "./dataset-profile";
import { RequestWorkflow } from "./request-workflow";
import { deriveRawRowHash, parseCsvSourceArtifact } from "./source-ingest";
import { buildFindingSourceTrace } from "./source-trace";

const resultHash =
  "6eed9e96766ee2af23b9a6bad795b069d58833f5a21141c4fdffad41af00ddf5";

describe("published FIX not-supported source", () => {
  it("pins the parsed bytes, comparable inputs and manifest approval", () => {
    const bytes = readFileSync(
      new URL(
        "../../scenarios/src/sources/published-execution-fix44-broad-participation.csv",
        import.meta.url,
      ),
    );
    expect(
      parseCsvSourceArtifact(
        bytes,
        "aa7fb847474c978919160ae2d93ec4a6f157fd4e09759f497340649324303680",
      ),
    ).toEqual(publishedExecutionBroadRows);
    for (const { values } of publishedExecutionBroadRows) {
      expect(values["Symbol(55)"]).toBe("ZZ79X1");
      expect(values["Account(1)"]).toMatch(/^SYNTH-ACCOUNT-/);
      expect(["1", "2"]).toContain(values["Side(54)"]);
      expect(BigInt(values["LastPx(31)"]) % 50n).toBe(0n);
      expect(BigInt(values["LastQty(32)"]) > 0n).toBe(true);
      expect(values["TransactTime(60)"]).toMatch(/^20260903-01:03:0[0-5]$/);
    }
    expect(
      sha256Canonical(caseManifestProposal(publishedExecutionBroadManifest)),
    ).toBe("fa3b1b1136ac8f925dfd2b76caae9657e36845f7ad7a3c5f83c2cad944e8a094");
    expect(publishedExecutionBroadManifest.approval.approvedArtifactHash).toBe(
      "fa3b1b1136ac8f925dfd2b76caae9657e36845f7ad7a3c5f83c2cad944e8a094",
    );
  });

  it.each(["baseline", "shuffle", "duplicate"] as const)(
    "pins NOT_SUPPORTED, the failing gates and result hash through approved %s replay",
    (mutation) => {
      const rows =
        mutation === "shuffle"
          ? [...publishedExecutionBroadRows].reverse()
          : publishedExecutionBroadRows;
      const workflow = new RequestWorkflow();
      const replay = replayApproved(
        rows,
        publishedExecutionBroadRows,
        publishedExecutionBroadProposal,
        {
          approvedArtifactHash: sha256Canonical(
            mappingApprovalArtifact(publishedExecutionBroadProposal),
          ),
          reviewerRef: "reviewer-fixture",
          decision: "APPROVED",
          overrides: [],
          approvedAt: "2026-09-29T00:00:00Z",
        },
        publishedExecutionBroadManifest,
        mutation,
        workflow,
      );
      expect(workflow.state).toBe("REPLAYED");
      if (!("canonicalResultHash" in replay) || !("evaluation" in replay))
        throw new Error(JSON.stringify(replay));
      const evaluation = RapidPriceLiftResultSchema.parse(replay.evaluation);

      expect(computeDatasetProfile(replay.events).canonicalDatasetHash).toBe(
        "35785e7ed4c4ce9b1b4c7cb390d4c2117b9509ac5eefb951b82803bed2e2f33d",
      );
      expect(publishedExecutionBroadManifest.canonicalDatasetHash).toBe(
        computeDatasetProfile(replay.events).canonicalDatasetHash,
      );
      expect(replay.canonicalResultHash).toBe(resultHash);
      expect(replay.canonicalEventCount).toBe(6);
      expect(replay.duplicateCount).toBe(mutation === "duplicate" ? 1 : 0);
      expect(evaluation.result).toBe("NOT_SUPPORTED");
      expect(evaluation.nonComparableEventCount).toBe(0);
      expect(
        evaluation.findings.map(
          ({ gate, observedValue, threshold, passed }) => ({
            gate,
            observedValue,
            threshold,
            passed,
          }),
        ),
      ).toEqual([
        {
          gate: "PRICE_CHANGE",
          observedValue: "250.0000",
          threshold: "200",
          passed: true,
        },
        {
          gate: "AGGRESSIVE_BUY_SHARE",
          observedValue: "7542.1994",
          threshold: "7000",
          passed: true,
        },
        {
          gate: "ACTOR_CONCENTRATION",
          observedValue: "1658.1892",
          threshold: "8000",
          passed: false,
        },
        {
          gate: "REPEATED_EXECUTION",
          observedValue: "2",
          threshold: "2",
          passed: true,
        },
        {
          gate: "REMOVAL_SENSITIVITY",
          observedValue: "0.0000",
          threshold: "100",
          passed: false,
        },
      ]);
      expect(
        evaluation.findings
          .filter(({ passed }) => !passed)
          .map(({ gate }) => gate),
      ).toEqual(publishedExecutionBroadScenario.expectedFailingGates);
      const trace = buildFindingSourceTrace(
        replay.events,
        evaluation.findings,
        publishedExecutionBroadRows,
      );
      expect(trace.entries).toHaveLength(6);
      for (const entry of trace.entries) {
        expect(entry.event.rawRowHash).toBe(deriveRawRowHash(entry.sourceRow));
        expect(entry.sourceRow.coordinate.sourceArtifactHash).toBe(
          publishedExecutionBroadProposal.sourceArtifactHash,
        );
      }
    },
  );
});
