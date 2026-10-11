/**
 * The example screen on the home page: the guided walkthrough's worked case,
 * read on the server from committed data only. The mapping is the case's
 * prepared proposal, and the result and thresholds are the captured
 * expectations, so the preview shows what the walkthrough returns.
 */

import { committedReplaySources } from "../../lib/replay-sources";
import publication from "../expectations/scenario-expectations.json";
import type { GateName } from "../replay/copy";

export const HOME_EXAMPLE_SCENARIO = "published-execution-fix44.csv";

/** The columns the preview shows, in this order: what the rule reads first. */
const SHOWN_TARGETS = ["price", "quantity", "side", "actorId"] as const;

export interface HomeExample {
  readonly scenario: string;
  readonly mapping: readonly {
    readonly sourceColumn: string;
    readonly targetField: string;
  }[];
  readonly result: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE";
  readonly rule: string;
  readonly gates: readonly {
    readonly gate: GateName;
    readonly observedValue: string;
    readonly threshold: string;
    readonly passed: boolean;
  }[];
  readonly canonicalResultHash: string;
}

export function homeExample(): HomeExample {
  const source = committedReplaySources[HOME_EXAMPLE_SCENARIO];
  const captured = publication.scenarios.find(
    (entry) => entry.scenario === HOME_EXAMPLE_SCENARIO,
  );
  if (
    !captured?.result ||
    !captured.hypothesis ||
    !captured.canonicalResultHash ||
    !("mappingProposal" in source)
  )
    throw new Error("The home example needs a replayed committed case");
  const fields = source.mappingProposal.fields;
  const [rule] = captured.hypothesis.rules;
  return {
    scenario: HOME_EXAMPLE_SCENARIO,
    mapping: SHOWN_TARGETS.map((target) => {
      const field = fields.find((entry) => entry.targetField === target);
      if (!field) throw new Error(`No proposed column for ${target}`);
      return { sourceColumn: field.sourceColumn, targetField: target };
    }),
    result: captured.result as HomeExample["result"],
    rule: `${rule!.ruleId} ${rule!.ruleVersion}`,
    gates: captured.gates.map(({ gate, observedValue, threshold, passed }) => {
      if (observedValue === null || passed === null)
        throw new Error(`The example's ${gate} check was not evaluated`);
      return { gate: gate as GateName, observedValue, threshold, passed };
    }),
    canonicalResultHash: captured.canonicalResultHash,
  };
}
