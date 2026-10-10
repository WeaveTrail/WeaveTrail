import type { Metadata } from "next";
import React from "react";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayHeading } from "./replay-heading";
import { ReplayModeBoundary } from "./replay-mode-boundary";

export const metadata: Metadata = {
  title: "Walk through a case",
  description:
    "Follow one synthetic case from an AI mapping proposal through a person's approval to versioned code's result and the source rows behind every finding.",
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
    <main
      className={guided ? "shell page-shell guided-page" : "shell page-shell"}
    >
      <ReplayHeading guided={guided} />
      <ReplayModeBoundary {...prepared} guided={guided} />
    </main>
  );
}
