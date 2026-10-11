import comparison from "../../../../../packages/evals/results/mapping-held-out-v2/comparison.json";
import decision from "../../../../../packages/evals/results/mapping-held-out-v2/decision.json";
import receipt from "../../../../../packages/evals/results/mapping-held-out-v2/sessions/f869738c-fb61-42df-9b50-ecfd9c3b299a/session.json";
import type { HeldOutResult } from "./model-comparison-data";

/**
 * The ADR 0069 recovery session on the fresh HELD_OUT v3 set, captured on
 * 2026-10-08. Output was observed, but no candidate met the unchanged rule;
 * the committed selector decision is NO_MODEL. These outputs and receipt are
 * verified offline by recovered-held-out-result.test.ts.
 */
const capture =
  "https://github.com/WeaveTrail/WeaveTrail/blob/2ef2cc3577cc1370b9377b7d5ae2c4485a77d8fe/packages/evals/results/mapping-held-out-v2";

export const committedHeldOutResult: HeldOutResult = {
  comparison: comparison as HeldOutResult["comparison"],
  decision: decision as HeldOutResult["decision"],
  runDate: receipt.startedAt.slice(0, 10),
  links: {
    records: `${capture}/sessions/${receipt.sessionId}/records.json`,
    sessionReceipt: `${capture}/sessions/${receipt.sessionId}/session.json`,
  },
};
