"use client";

import { useRouter } from "next/navigation";

import { CaseReplay, type CaseReplayProps } from "./case-replay";

export function ReplayModeBoundary(props: CaseReplayProps) {
  const router = useRouter();

  return (
    <CaseReplay
      {...props}
      onGuideComplete={() => {
        router.replace("/replay");
      }}
    />
  );
}
