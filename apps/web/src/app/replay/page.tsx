import type { Metadata } from "next";
import React from "react";

import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayModeBoundary } from "./replay-mode-boundary";

export const metadata: Metadata = {
  title: "Case Replay",
  description:
    "Normalize published daily quotes and replay synthetic cases through WeaveTrail's explicit approval workflow.",
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
        <p>
          In working mode, you can also review and normalize published daily
          quotations. Their source provenance and limits on case approval remain
          visible.
        </p>
      </div>
      <ReplayModeBoundary {...prepared} guided={guided} />
    </main>
  );
}
