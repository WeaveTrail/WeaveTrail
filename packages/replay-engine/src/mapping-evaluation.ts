import { CANONICAL_EVENT_FIELDS, canonicalizeEvents } from "./canonicalize";
import { canonicalJson } from "./canonical-json";
import type { MappingApplicationResult } from "./source-ingest";

export type FieldAgreementCount = {
  field: (typeof CANONICAL_EVENT_FIELDS)[number];
  agreements: number;
  comparisons: number;
};

export type MappingEvaluationReport = {
  reviewOutcomes: {
    left: MappingApplicationResult["status"];
    right: MappingApplicationResult["status"];
  };
  comparedEventCount: number;
  fieldAgreement: FieldAgreementCount[];
};

export function evaluateMappingAgreement(
  left: MappingApplicationResult,
  right: MappingApplicationResult,
): MappingEvaluationReport {
  const reviewOutcomes = { left: left.status, right: right.status };
  if (left.status !== "APPROVED" || right.status !== "APPROVED") {
    return { reviewOutcomes, comparedEventCount: 0, fieldAgreement: [] };
  }

  const leftEvents = canonicalizeEvents(left.events).events;
  const rightEvents = canonicalizeEvents(right.events).events;
  const identityKey = (event: (typeof leftEvents)[number]) =>
    canonicalJson([event.datasetId, event.venueId, event.sourceEventId]);
  const rightByIdentity = new Map(
    rightEvents.map((event) => [identityKey(event), event]),
  );

  return {
    reviewOutcomes,
    comparedEventCount: Math.max(leftEvents.length, rightEvents.length),
    fieldAgreement: CANONICAL_EVENT_FIELDS.map((field) => {
      let agreements = 0;
      for (const leftEvent of leftEvents) {
        const rightEvent = rightByIdentity.get(identityKey(leftEvent));
        if (rightEvent && leftEvent[field] === rightEvent[field])
          agreements += 1;
      }
      return {
        field,
        agreements,
        comparisons: Math.max(leftEvents.length, rightEvents.length),
      };
    }),
  };
}
