import type { Metadata } from "next";
import React from "react";

import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayModeBoundary } from "./replay-mode-boundary";

export const metadata: Metadata = {
  title: "Case Replay",
  description:
    "Run committed synthetic fixtures through WeaveTrail's approval-bound deterministic replay workflow.",
  alternates: { canonical: "/replay" },
};

export default async function ReplayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prepared = await prepareReplayScenarios();
  const guided = (await searchParams).mode === "guided";
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Case Replay</span>
        <h1>Follow a case from source to finding.</h1>
        <p>
          Review the executions behind an alert, approve their interpretation
          and scope, then inspect the versioned pattern result.
        </p>
      </div>
      <ReplayModeBoundary {...prepared} guided={guided} />
    </main>
  );
}
