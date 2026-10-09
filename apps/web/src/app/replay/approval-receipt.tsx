"use client";

import React from "react";

import type { ApprovalRecord } from "@weavetrail/contracts";

import { replayCopy } from "./copy";
import { HashValue, Instant } from "./machine-values";
import { useReplayLanguage } from "./replay-language";

/**
 * What a person approved: the artifact hash the approval binds to, who and
 * when, and each reviewer reason verbatim. `coverage` says in words what the
 * hash covers, above it.
 */
export function ApprovalReceipt({
  approval,
  coverage,
}: {
  approval: ApprovalRecord;
  coverage?: string;
}) {
  const text = replayCopy[useReplayLanguage()].receipt;
  return (
    <>
      {coverage ? <p className="approval-coverage">{coverage}</p> : null}
      <dl className="approval-receipt">
        <div>
          <dt>{text.hash}</dt>
          <dd>
            <HashValue
              scope="approvedArtifact"
              value={approval.approvedArtifactHash}
            />
          </dd>
        </div>
        <div>
          <dt>{text.reviewer}</dt>
          <dd>{approval.reviewerRef}</dd>
        </div>
        <div>
          <dt>{text.decision}</dt>
          <dd>{approval.decision}</dd>
        </div>
        <div>
          <dt>{text.approvedAt}</dt>
          <dd>
            <Instant value={approval.approvedAt} />
          </dd>
        </div>
        {approval.overrides.map(({ fieldPath, reason }) => (
          <div key={fieldPath}>
            <dt>{fieldPath}</dt>
            <dd>{reason}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
