import type { HeldOutResult } from "./model-comparison-data";

/**
 * The committed ADR 0067 held-out session the evaluation page reports. No
 * HELD_OUT model run has been recorded yet, so the page states that no model
 * is selected. The result amendment replaces `null` with the committed
 * `eval:mappings:select` comparison and decision, its session receipt's run
 * date and links to the committed run records.
 */
export const committedHeldOutResult: HeldOutResult | null = null;
