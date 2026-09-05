import type { CaseManifest, DatasetProfile } from "@weavetrail/contracts";

import { compareCanonicalEventTimes } from "./canonical-order";

export type CaseProfileIssueCode =
  | "CANONICAL_DATASET_HASH_MISMATCH"
  | "INSTRUMENT_OUTSIDE_DATASET_PROFILE"
  | "ACTOR_OUTSIDE_DATASET_PROFILE"
  | "TIME_WINDOW_OUTSIDE_DATASET_PROFILE";

// Paths are relative to the validated manifest, not an HTTP request.
export type CaseProfileValidation =
  | { accepted: true }
  | {
      accepted: false;
      status: "REVIEW_REQUIRED";
      issues: { code: CaseProfileIssueCode; path: (string | number)[] }[];
    };

export function validateCaseAgainstProfile(
  manifest: CaseManifest,
  profile: DatasetProfile,
): CaseProfileValidation {
  const issues: { code: CaseProfileIssueCode; path: (string | number)[] }[] =
    [];

  if (manifest.canonicalDatasetHash !== profile.canonicalDatasetHash) {
    issues.push({
      code: "CANONICAL_DATASET_HASH_MISMATCH",
      path: ["canonicalDatasetHash"],
    });
  }
  if (!profile.instrumentIds.includes(manifest.hypothesis.instrumentId)) {
    issues.push({
      code: "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
      path: ["hypothesis", "instrumentId"],
    });
  }
  for (const [index, actorId] of manifest.hypothesis.actorIds.entries()) {
    if (!profile.actorIds.includes(actorId)) {
      issues.push({
        code: "ACTOR_OUTSIDE_DATASET_PROFILE",
        path: ["hypothesis", "actorIds", index],
      });
    }
  }
  if (
    compareCanonicalEventTimes(
      manifest.hypothesis.startTime,
      profile.earliestEventTime,
    ) < 0 ||
    compareCanonicalEventTimes(
      manifest.hypothesis.endTime,
      profile.latestEventTime,
    ) > 0
  ) {
    issues.push({
      code: "TIME_WINDOW_OUTSIDE_DATASET_PROFILE",
      path: ["hypothesis"],
    });
  }

  return issues.length === 0
    ? { accepted: true }
    : { accepted: false, status: "REVIEW_REQUIRED", issues };
}
