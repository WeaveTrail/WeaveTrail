import {
  committedReplayScenarios,
  replayScenarioCatalog,
  reviewerFacingReplayScenarios,
} from "@weavetrail/scenarios";

export const committedReplaySources = committedReplayScenarios;
export const replaySourceCatalog = replayScenarioCatalog;
/** Engine regression fixtures remain available to API and engine tests. */
export const reviewerFacingReplaySources = reviewerFacingReplayScenarios;
