import type { Metadata } from "next";
import React from "react";

import publication from "./scenario-expectations.json";
import { ExpectationsContent } from "./expectations-content";

export const metadata: Metadata = {
  title: "Scenario expectations",
  description:
    "Compare reviewer-facing and engine-regression sources with their workflow state, result, gate readings, and canonical hashes.",
  alternates: { canonical: "/expectations" },
};

export default function ExpectationsPage() {
  return <ExpectationsContent scenarios={publication.scenarios} />;
}
