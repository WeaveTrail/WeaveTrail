import type { Metadata } from "next";
import React from "react";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayHeading } from "./replay-heading";
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
  const guided = (await searchParams).mode !== "working";
  return (
    <main className="shell page-shell">
      <ReplayHeading guided={guided} />
      <ReplayModeBoundary {...prepared} guided={guided} />
    </main>
  );
}
