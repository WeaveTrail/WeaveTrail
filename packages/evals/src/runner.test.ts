import { readFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { describe, expect, it } from "vitest";
import expectations from "../../../apps/web/src/app/expectations/scenario-expectations.json";
import {
  buildFindingSourceTrace,
  replayFoundation,
  applyApprovedMapping,
  approvedSourceMapping,
} from "@weavetrail/replay-engine";
import { evaluationCases } from "./cases";
import { runEvaluation } from "./runner";
import { committedRows, sources } from "./sources";

describe("evaluation fails closed on changed oracles", () => {
  it("rejects a changed expected mapping", async () => {
    const changed = structuredClone(evaluationCases);
    Object.assign(changed.mappingCases[0].fields[0], { 1: "actorId" });
    await expect(runEvaluation(changed)).rejects.toThrow(/Mapping oracle/);
  });
  it("rejects a changed review expectation", async () => {
    const changed = structuredClone(evaluationCases);
    Object.assign(changed.mappingCases[1], { withoutOverrides: "APPROVED" });
    await expect(runEvaluation(changed)).rejects.toThrow(/Review oracle/);
  });
  it("rejects a changed mutation oracle", async () => {
    const changed = structuredClone(evaluationCases);
    Object.assign(changed.mutations[0], {
      expected: "CONFLICTING_SOURCE_IDENTITY",
    });
    await expect(runEvaluation(changed)).rejects.toThrow(/Mutation oracle/);
  });
  it("rejects a changed scenario result in the shared expectation source", async () => {
    const changed = structuredClone(expectations);
    changed.scenarios.find(
      (item) => item.scenario === "published-execution-fix44.csv",
    )!.result = "NOT_SUPPORTED";
    await expect(runEvaluation(evaluationCases, changed)).rejects.toThrow(
      /Scenario oracle/,
    );
  });
  it("rejects a changed published trace reference", async () => {
    const changed = JSON.parse(
      readFileSync(
        new URL("../results/financial-replay-v2.json", import.meta.url),
        "utf8",
      ),
    );
    changed.scenarios.find(
      (item: { trace: { entries: unknown[] } }) =>
        item.trace.entries.length > 0,
    ).trace.entries[0].eventId = "missing-event";
    const actual = await runEvaluation();
    expect(() => deepStrictEqual(actual, changed)).toThrow();
  });
  it("rejects unresolved references and source-row tampering", () => {
    const source = sources["published-execution-fix44.csv"]!;
    const rows = committedRows("published-execution-fix44.csv", source);
    const application = applyApprovedMapping(
      rows,
      approvedSourceMapping(source.mappingProposal),
    );
    if (application.status !== "APPROVED")
      throw new Error("Fixture mapping failed");
    const events = replayFoundation(application.events).events;
    expect(() =>
      buildFindingSourceTrace(
        events,
        [{ referencedEventIds: ["missing-event"] }],
        rows,
      ),
    ).toThrow(/Missing canonical event/);
    const changedRows = structuredClone(rows);
    changedRows[0]!.values["LastPx(31)"] = "999999";
    expect(() =>
      buildFindingSourceTrace(
        events,
        [{ referencedEventIds: [events[0]!.eventId] }],
        changedRows,
      ),
    ).toThrow(/Missing source row/);
  });
});
