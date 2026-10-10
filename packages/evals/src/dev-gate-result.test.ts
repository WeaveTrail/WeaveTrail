import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { evaluateDevGate } from "./dev-gate";

// The committed ADR 0075 gate 2 capture of 2026-10-10 reproduces offline,
// without credentials, byte for byte, and records that the gate did not pass.
const capture = new URL("../results/mapping-dev-gate-v4/", import.meta.url);
const session = (id: string) =>
  fileURLToPath(new URL(`sessions/${id}`, capture));

it("reproduces the committed gate 2 result, which did not pass", () => {
  const result = evaluateDevGate(
    session("fa32db2a-3f6a-4f7e-842c-aaa9a531addf"),
    session("82d1d299-4060-444c-ba92-70ced8fe62fa"),
  );
  expect(JSON.stringify(result, null, 2) + "\n").toBe(
    readFileSync(new URL("gate.json", capture), "utf8"),
  );
  expect(result.passed).toBe(false);
  expect(result.candidates.filter((c) => c.opensHeldOut)).toEqual([]);
  expect(
    result.candidates.filter((c) => !c.noIncrease).map((c) => c.model),
  ).toEqual([
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash-lite",
  ]);
});
