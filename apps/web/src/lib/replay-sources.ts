import {
  committedReplayScenarios,
  replayScenarioCatalog,
  reviewerFacingReplayScenarios,
} from "@weavetrail/scenarios";
import {
  publishedReplaySourceCatalog,
  publishedReplaySources,
} from "@weavetrail/published-data";

// Application composition only: the scenario package remains synthetic.
export const committedReplaySources = {
  ...committedReplayScenarios,
  ...publishedReplaySources,
} as const;

export const replaySourceCatalog = {
  ...replayScenarioCatalog,
  ...publishedReplaySourceCatalog,
} as const;

/** Sources offered on the human review surface. Engine regression fixtures
 * remain in committedReplaySources for API, contract, and engine tests. */
export const reviewerFacingReplaySources = {
  ...reviewerFacingReplayScenarios,
  ...publishedReplaySources,
} as const;
