import type { Metadata } from "next";
import React from "react";
import { DataHandlingContent } from "./data-handling-content";
import { sourceRevision } from "./source-revision";

export const metadata: Metadata = {
  title: "Data handling",
  description:
    "What a check sends, keeps and logs, with the source files and tests that enforce each statement.",
  alternates: { canonical: "/data-handling" },
};

export default function DataHandlingPage() {
  return <DataHandlingContent revision={sourceRevision()} />;
}
