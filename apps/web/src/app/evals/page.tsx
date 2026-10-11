import type { Metadata } from "next";
import React from "react";
import { checks } from "./checks";
import { EvalsContent } from "./evals-content";
import { committedHeldOutResult } from "./held-out-result";

export const metadata: Metadata = {
  title: "Model comparison",
  description:
    "See which mapping models were compared and selected, what the choice costs and how each fails, beside the checks behind WeaveTrail's deterministic replay claims.",
  alternates: { canonical: "/evals" },
};

export default function EvalsPage() {
  return <EvalsContent checks={checks} heldOut={committedHeldOutResult} />;
}
