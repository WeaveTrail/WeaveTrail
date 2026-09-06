import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayModeBoundary } from "./replay-mode-boundary";

export const metadata: Metadata = {
  title: "Case Replay",
  description:
    "Normalize published daily quotes and replay synthetic cases through WeaveTrail's explicit approval workflow.",
  alternates: { canonical: "/replay" },
};

// One navigation entry leads here; the two ways to use the surface are named
// and chosen inside it, with the query remaining the only mode source.
const modes = [
  {
    label: "Guided walkthrough",
    href: "/replay?mode=guided",
    guided: true,
    detail:
      "Seven steps through one worked case. Each step states what it demonstrates, what you do to advance it and who acted.",
  },
  {
    label: "Working mode",
    href: "/replay?mode=working",
    guided: false,
    detail:
      "The same case controls without the steps. Choose any committed source, approve it yourself and use the source-order and duplicate variations.",
  },
] as const;

export default async function ReplayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prepared = await prepareReplayScenarios();
  const guided = (await searchParams).mode !== "working";
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Case Replay</span>
        <h1>Follow a case from source to finding.</h1>
        <p>
          Review the executions behind an alert, approve their interpretation
          and scope, then inspect the versioned pattern result. Follow the
          guided walkthrough step by step, or take the same controls yourself in
          working mode.
        </p>
        {guided ? null : (
          <p>
            In working mode, you can also review and normalize published daily
            quotations. Their source provenance and limits on case approval
            remain visible.
          </p>
        )}
        <nav aria-label="Case Replay mode" className="mode-choice">
          {modes.map((mode) => (
            <Link
              aria-current={mode.guided === guided ? "page" : undefined}
              href={mode.href}
              key={mode.href}
            >
              <strong>{mode.label}</strong>
              <small>{mode.detail}</small>
            </Link>
          ))}
        </nav>
      </div>
      <ReplayModeBoundary {...prepared} guided={guided} />
    </main>
  );
}
