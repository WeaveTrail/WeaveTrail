import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Canonical } from "@weavetrail/replay-engine";
import {
  loadHeldOutSession,
  loadSelectionInputs,
  root,
} from "./held-out-protocol";
import { SELECTION_MODELS, selectMappingModels } from "./mapping-selection";

const directory = resolve(root, "packages/evals/results/mapping-held-out-v1");
const sessionId = "365e2daf-a833-427d-8921-718890100b59";
const read = (name: string) => readFileSync(resolve(directory, name), "utf8");
const receipt = JSON.parse(read(`sessions/${sessionId}/session.json`));
const { records, session } = loadHeldOutSession(
  resolve(directory, "sessions", sessionId),
);
const { source, prices } = loadSelectionInputs();

describe("first committed ADR 0067 held-out result", () => {
  it("binds the full failed grid to the original checkout and catalogue", () => {
    expect(session).toEqual({
      sessionId,
      sessionHash:
        "0cdfd13d06eec1f8a61103db2edf6343efecb16c7aa03cdd66f839afb4365371",
    });
    expect(receipt.commit).toBe("70f3b403331d543cab6f09a01a82c82a71bfcefe");
    expect(receipt.startedAt).toBe("2026-10-08T13:43:56.706Z");
    expect(receipt.catalogue).toEqual(
      JSON.parse(read("catalogue-2026-10-08.json")),
    );
    expect(receipt.catalogue.modelIds).toEqual([...SELECTION_MODELS]);
    expect(records).toHaveLength(180);
    for (const model of SELECTION_MODELS) {
      const attempts = records.filter((r) => r.requestedModel === model);
      expect(attempts).toHaveLength(36);
      for (const record of attempts)
        expect(record).toMatchObject({
          outcome: "PROVIDER_FAILED",
          failureClass: "HTTP_ERROR",
          parsedOutput: null,
          reportedModel: null,
          inputTokens: null,
          outputTokens: null,
        });
    }
  });

  it("reproduces all three published files byte for byte and verifies their hashes", () => {
    const result = selectMappingModels(records, source, prices, session);
    for (const [name, value] of Object.entries(result))
      expect(JSON.stringify(value, null, 2) + "\n").toBe(read(`${name}.json`));
    expect(result.decision).toMatchObject({
      outcome: "NO_MODEL",
      eligible: [],
      primary: null,
      escalation: null,
      session,
      comparisonHash: sha256Canonical(result.comparison),
      selectionHash: sha256Canonical(result.selection),
    });
    for (const group of result.comparison.groups.filter(
      (g) => g.role === "MODEL",
    )) {
      const all = group.byTag.ALL!;
      expect(all.validOutput).toEqual({ numerator: "0", denominator: "36" });
      expect(all.providerFailed).toEqual({
        numerator: "36",
        denominator: "36",
      });
      expect(all.costMicroUsd).toMatchObject({
        coveredRuns: "0",
        totalRuns: "36",
      });
    }
  });
});
