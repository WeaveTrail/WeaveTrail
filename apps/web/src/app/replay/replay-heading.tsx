"use client";

import Link from "next/link";
import React from "react";

import { useCopy, type Language } from "../i18n/language";

const copy: Readonly<
  Record<
    Language,
    {
      heading: string;
      lede: string;
      guidedMeta: string;
      label: string;
      modes: readonly {
        label: string;
        href: string;
        guided: boolean;
      }[];
    }
  >
> = {
  en: {
    heading: "Follow a case from source to finding.",
    lede: "The same case without the steps: pick a source, approve it, run it.",
    guidedMeta:
      "One synthetic case · 8 steps · about 5–10 minutes · no sign-in, a refresh starts over",
    label: "Case Replay mode",
    modes: [
      {
        label: "Guided walkthrough",
        href: "/replay?mode=guided",
        guided: true,
      },
      { label: "Working mode", href: "/replay?mode=working", guided: false },
    ],
  },
  ko: {
    heading: "의심 사례의 근거를 직접 확인합니다.",
    lede: "단계 안내 없이 같은 사례를 다룹니다. 원본을 고르고, 승인하고, 실행하세요.",
    guidedMeta:
      "합성 사례 하나 · 8단계 · 약 5~10분 · 회원가입 없음, 새로고침하면 처음부터",
    label: "사례를 확인하는 방식",
    modes: [
      { label: "사례 따라가기", href: "/replay?mode=guided", guided: true },
      { label: "직접 조작", href: "/replay?mode=working", guided: false },
    ],
  },
};

/**
 * One line for the page and one switch between the modes. In the walkthrough
 * the step rail says what to do, so the heading only says what this is and
 * how long it takes.
 */
export function ReplayHeading({ guided }: { guided: boolean }) {
  const text = useCopy(copy);
  return (
    <div className="page-heading replay-heading">
      <div>
        <h1>{text.heading}</h1>
        <p>{guided ? text.guidedMeta : text.lede}</p>
      </div>
      <nav aria-label={text.label} className="mode-choice">
        {text.modes.map((mode) => (
          <Link
            aria-current={mode.guided === guided ? "page" : undefined}
            href={mode.href}
            key={mode.href}
          >
            {mode.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
