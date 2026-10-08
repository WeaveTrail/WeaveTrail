import comparison from "../../../../../packages/evals/results/mapping-held-out-v1/comparison.json";
import decision from "../../../../../packages/evals/results/mapping-held-out-v1/decision.json";
import receipt from "../../../../../packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59/session.json";
import type { HeldOutResult } from "./model-comparison-data";

/**
 * The first ADR 0067 held-out session, captured on 2026-10-08. All 180 attempts
 * failed with HTTP_ERROR; the committed selector decision is NO_MODEL. These
 * outputs and receipt are verified offline by held-out-result.test.ts.
 */
const capture =
  "https://github.com/WeaveTrail/WeaveTrail/blob/1f4694476620796189197e63771b08b4313ced6a/packages/evals/results/mapping-held-out-v1";

export const committedHeldOutResult: HeldOutResult = {
  comparison: comparison as HeldOutResult["comparison"],
  decision: decision as HeldOutResult["decision"],
  runDate: receipt.startedAt.slice(0, 10),
  links: {
    records: `${capture}/sessions/${receipt.sessionId}/records.json`,
    sessionReceipt: `${capture}/sessions/${receipt.sessionId}/session.json`,
  },
};
