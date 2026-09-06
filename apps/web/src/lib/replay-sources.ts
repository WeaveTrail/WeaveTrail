import { committedReplayScenarios } from "@weavetrail/scenarios";
import { publishedReplaySources } from "@weavetrail/published-data";

// Application composition only: the scenario package remains synthetic.
export const committedReplaySources = {
  ...committedReplayScenarios,
  ...publishedReplaySources,
} as const;
