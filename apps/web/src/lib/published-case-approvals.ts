import type { ApprovalRecord } from "@weavetrail/contracts";

/**
 * The reviewed mapping approvals for the two published artifacts this case
 * reads, committed rather than derived.
 *
 * Both the approved artifact hash and the reviewer's recorded reasons are
 * pinned here. Recomputing the hash from whatever proposal the package
 * currently exports and stamping that same proposal `APPROVED` would let a
 * changed mapping authorize its own new shape; the application verifies the
 * recomputed hash against these pins and fails closed when they differ, so
 * mapping drift reaches a review stop instead of a result.
 */
export const REVIEWED_MAPPING_APPROVALS = {
  baseline: {
    approvedArtifactHash:
      "a76fe2fb61abdaa0d3e9a28706cd1aba1ff35a9a7f12029cec12458baa599020",
    reviewerRef: "published-golden-mapping-reviewer",
    decision: "APPROVED",
    approvedAt: "2026-09-07T00:00:00Z",
    overrides: [
      {
        fieldPath: "fields.0",
        reason:
          "Publisher trading date is interpreted as Korean day start and also participates in the ordered publisher observation identity.",
      },
      {
        fieldPath: "fields.4",
        reason:
          "Publisher clpr is interpreted as the daily aggregate closePrice.",
      },
      {
        fieldPath: "fields.5",
        reason: "Publisher vs is interpreted as the daily aggregate netChange.",
      },
      {
        fieldPath: "fields.7",
        reason:
          "Publisher mkp is interpreted as the daily aggregate openPrice.",
      },
      {
        fieldPath: "fields.8",
        reason:
          "Publisher hipr is interpreted as the daily aggregate highPrice.",
      },
      {
        fieldPath: "fields.9",
        reason:
          "Publisher lopr is interpreted as the daily aggregate lowPrice.",
      },
      {
        fieldPath: "fields.10",
        reason:
          "Publisher trqu is interpreted as the daily aggregate quantity.",
      },
    ],
  },
  futures: {
    approvedArtifactHash:
      "e45fb0c54c6b02a357878e076b9009304be7f45156c7f8694a9aeb3b785e1f6c",
    reviewerRef: "published-golden-mapping-reviewer",
    decision: "APPROVED",
    approvedAt: "2026-09-07T00:00:00Z",
    overrides: [
      {
        fieldPath: "fields.0",
        reason: "Publisher trading date is interpreted as Korean day start.",
      },
      {
        fieldPath: "fields.5",
        reason:
          "Publisher clpr is interpreted as the daily aggregate closePrice.",
      },
      {
        fieldPath: "fields.6",
        reason: "Publisher vs is interpreted as the daily aggregate netChange.",
      },
      {
        fieldPath: "fields.7",
        reason:
          "Publisher mkp is interpreted as the daily aggregate openPrice.",
      },
      {
        fieldPath: "fields.8",
        reason:
          "Publisher hipr is interpreted as the daily aggregate highPrice.",
      },
      {
        fieldPath: "fields.9",
        reason:
          "Publisher lopr is interpreted as the daily aggregate lowPrice.",
      },
      {
        fieldPath: "fields.12",
        reason:
          "Publisher trqu is interpreted as the daily aggregate quantity.",
      },
    ],
  },
} as const satisfies Record<string, ApprovalRecord>;
