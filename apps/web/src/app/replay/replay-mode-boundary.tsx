"use client";

import { useRouter } from "next/navigation";

import { useLanguage } from "../i18n/language";

import { CaseReplay, type CaseReplayProps } from "./case-replay";

export function ReplayModeBoundary(props: CaseReplayProps) {
  const router = useRouter();
  const { language } = useLanguage();

  return (
    <CaseReplay
      {...props}
      language={language}
      onGuideComplete={() => {
        router.replace("/replay?mode=working");
      }}
    />
  );
}
