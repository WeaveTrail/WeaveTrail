import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MappingRunRecordSchema } from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import {
  loadHeldOutSession,
  loadSelectionInputs,
  root,
} from "./held-out-protocol";
import { SELECTION_MODELS, selectMappingModels } from "./mapping-selection";

const directory = resolve(root, "packages/evals/results/mapping-held-out-v2");
const sessionId = "f869738c-fb61-42df-9b50-ecfd9c3b299a";
const read = (name: string) => readFileSync(resolve(directory, name), "utf8");

describe("committed ADR 0069 recovery session", () => {
  it("binds all 180 attempts to the pre-run commit and retains original runner bytes", () => {
    const { records, protocolVersion } = loadHeldOutSession(
      resolve(directory, "sessions", sessionId),
    );
    const receipt = JSON.parse(read(`sessions/${sessionId}/session.json`));
    expect(protocolVersion).toBe(2);
    expect(receipt.commit).toBe("b36d078be4d2daabba736ce051bd1c71f8f1053b");
    expect(receipt.startedAt).toBe("2026-10-08T16:15:18.202Z");
    expect(records).toHaveLength(180);
    expect(receipt.catalogue).toEqual(
      JSON.parse(read("catalogue-2026-10-08.json")),
    );
    const { source, corpus } = loadSelectionInputs(false, 2);
    for (const model of SELECTION_MODELS) {
      const attempts = records.filter((r) => r.requestedModel === model);
      expect(attempts).toHaveLength(36);
      expect(
        new Set(attempts.map((r) => `${r.dialectId}:${r.repeat}`)).size,
      ).toBe(36);
      expect(new Set(attempts.map((r) => r.dialectId))).toEqual(
        new Set(corpus.dialects.map((d) => d.id)),
      );
    }
    for (const r of records)
      expect(r).toMatchObject({
        evaluationSet: {
          version: "schema-dialects/3",
          sha256: source.sha256,
          split: "HELD_OUT",
        },
        adapterVersion: "openai-compatible-mapping/2",
      });
    for (const file of readdirSync(resolve(directory, "sessions", sessionId))) {
      const bytes = read(`sessions/${sessionId}/${file}`);
      const value = JSON.parse(bytes);
      expect(JSON.stringify(value, null, 2) + "\n").toBe(bytes);
      if (/^[a-f0-9-]{36}\.json$/.test(file))
        expect(
          JSON.stringify(MappingRunRecordSchema.parse(value), null, 2) + "\n",
        ).toBe(bytes);
      expect(value).not.toHaveProperty("bodyBase64");
      expect(value).not.toHaveProperty("authorization");
      expect(value).not.toHaveProperty("apiKey");
    }
  });
  it("reproduces every selection file byte for byte with immutable session and result hashes", () => {
    const { records, session } = loadHeldOutSession(
      resolve(directory, "sessions", sessionId),
    );
    const { source, prices } = loadSelectionInputs(false, 2);
    const result = selectMappingModels(records, source, prices, session);
    for (const [name, value] of Object.entries(result))
      expect(JSON.stringify(value, null, 2) + "\n").toBe(read(`${name}.json`));
    expect(session.sessionHash).toBe(
      "17481f6c239a1af367cb72f35be60beed5bb5b427828f7c664fb0f9026194623",
    );
    expect(result.decision).toMatchObject({
      rule: "ADR-0069",
      outcome: "NO_MODEL",
      primary: null,
      escalation: null,
      eligible: [],
      session,
      comparisonHash:
        "e45b17dc548dd5a0522c2c3c4979281ba1aa5c9cb23ea296b3ef3049a5db4b53",
      selectionHash:
        "b0c5f4b6ae58aad188a5199662d11801e07f43ccba18559bc07f84ad83121781",
    });
    expect(result.decision.comparisonHash).toBe(
      sha256Canonical(result.comparison),
    );
    expect(result.decision.selectionHash).toBe(
      sha256Canonical(result.selection),
    );
    expect(result.selection.selected).toEqual([]);
    const expected = {
      "gemini-3.1-flash-lite": [0, 36, 0],
      "gemini-3.5-flash-lite": [0, 36, 0],
      "gemini-3.8-flash": [27, 0, 9],
      "gemini-2.5-pro": [0, 0, 36],
      "gemini-3.1-pro-preview": [29, 7, 0],
    };
    for (const group of result.comparison.groups.filter(
      (g) => g.role === "MODEL",
    )) {
      const all = group.byTag.ALL!;
      expect(
        [all.validOutput, all.contractRejected, all.providerFailed].map(
          (c) => c.numerator,
        ),
      ).toEqual(
        expected[group.identity.requestedModel as keyof typeof expected].map(
          String,
        ),
      );
    }
  });
});
