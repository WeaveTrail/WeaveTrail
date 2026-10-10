import type { Metadata } from "next";
import React from "react";

import publication from "./scenario-expectations.json";
import { captureEnvironment } from "./capture";
import { ExpectationsContent } from "./expectations-content";

export const metadata: Metadata = {
  title: "Expected results",
  description:
    "The expected outcome of every committed synthetic case, how to reproduce one, and the environment the values were captured in.",
  alternates: { canonical: "/expectations" },
};

export default function ExpectationsPage() {
  return (
    <ExpectationsContent
      environment={captureEnvironment}
      scenarios={publication.scenarios}
    />
  );
}
