import type { Metadata } from "next";
import React from "react";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayHeading } from "./replay-heading";
import { ReplayModeBoundary } from "./replay-mode-boundary";
import { GuidedTour } from "./tour/guided-tour";

export const metadata: Metadata = {
  title: "Try it",
  description:
    "Try one synthetic case in five steps: see the AI's column matches, approve them and the scope, get the result, and find the source trades behind it.",
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
      {guided ? (
        <GuidedTour {...prepared} />
      ) : (
        <ReplayModeBoundary {...prepared} />
      )}
    </main>
  );
}
