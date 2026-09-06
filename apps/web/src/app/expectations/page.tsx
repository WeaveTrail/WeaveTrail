import type { Metadata } from "next";
import React from "react";

import publication from "./scenario-expectations.json";
import { ExpectationsContent } from "./expectations-content";

export const metadata: Metadata = {
  title: "Scenario expectations",
  description:
    "Compare committed replay sources with their engine-derived workflow state, result, gate readings, and canonical hashes.",
  alternates: { canonical: "/expectations" },
};

export default function ExpectationsPage() {
  return <ExpectationsContent scenarios={publication.scenarios} />;
}
