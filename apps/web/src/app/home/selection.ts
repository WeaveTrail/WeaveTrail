/**
 * What the home page may say about the mapping-model selection. It reads only
 * the committed held-out comparison and its `mapping-selection-decision/1`
 * record, and carries numbers only once that record names a primary model.
 */

import {
  outputObserved,
  primaryAccuracy,
  type Count,
  type HeldOutResult,
} from "../evals/model-comparison-data";

export type HomeSelection =
  | {
      /** No published selection; the home page shows no accuracy figures. */
      readonly state: "planned";
      /**
       * `notRun`: no held-out session is committed. `noOutput`: a session is
       * committed but no candidate returned output. `noneQualified`: output
       * was observed and no candidate met the rule.
       */
      readonly reason: "notRun" | "noOutput" | "noneQualified";
    }
  | {
      readonly state: "selected";
      readonly primary: string;
      readonly escalation: string | null;
      readonly runDate: string;
      readonly sessionReceipt: string;
      /** The rule's primary-accuracy sum for the primary model. */
      readonly primaryAccuracy: Count;
      /** The primary model's valid-output rate over every held-out run. */
      readonly validOutput: Count;
    };

export function homeSelection(result: HeldOutResult | null): HomeSelection {
  if (!result || result.decision.session === null)
    return { state: "planned", reason: "notRun" };
  const { decision, comparison } = result;
  const models = comparison.groups.filter((group) => group.role === "MODEL");
  const primary =
    decision.outcome === "SELECTED" && decision.primary !== null
      ? models.find(
          (group) => group.identity.requestedModel === decision.primary,
        )
      : undefined;
  if (!primary)
    return {
      state: "planned",
      reason: models.some((group) => outputObserved(group, group.byTag.ALL!))
        ? "noneQualified"
        : "noOutput",
    };
  return {
    state: "selected",
    primary: primary.identity.requestedModel,
    escalation: decision.escalation,
    runDate: result.runDate,
    sessionReceipt: result.links.sessionReceipt,
    primaryAccuracy: primaryAccuracy(primary),
    validOutput: primary.byTag.ALL!.validOutput,
  };
}
