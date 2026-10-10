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

it("reproduces the committed revision 1 gate result, which did not pass on invented fields alone", () => {
  const result = evaluateDevGate(
    session("162a9e46-a011-488a-9fb5-10cb427e7e1a"),
    session("706cc7a9-a262-411d-89fa-9ae127b850a7"),
  );
  expect(JSON.stringify(result, null, 2) + "\n").toBe(
    readFileSync(new URL("gate-r1.json", capture), "utf8"),
  );
  expect(result.passed).toBe(false);
  for (const c of result.candidates) {
    expect(c.noIncrease).toBe(true);
    expect(c.after.validOutput.numerator).toBe("36");
    expect(c.after.inventedOnNullGold.numerator).not.toBe("0");
  }
});

it("reproduces the void revision 2 run, in which no after record retained output", () => {
  const result = evaluateDevGate(
    session("abf2cd88-68ba-4571-b43c-569939e20f95"),
    session("3551c0b9-7e20-4c5f-9881-88ed746bc878"),
  );
  expect(JSON.stringify(result, null, 2) + "\n").toBe(
    readFileSync(new URL("gate-r2-void.json", capture), "utf8"),
  );
  for (const c of result.candidates) {
    expect(c.pairs).toEqual([]);
    expect(c.after.validOutput.numerator).toBe("0");
  }
});
